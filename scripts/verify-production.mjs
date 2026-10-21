import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
assert.ok(
  process.env.DATABASE_URL,
  'Supply the dedicated PostgreSQL verification database through the environment.',
);
const java = process.env.JAVA_HOME
  ? join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
  : 'java';
const processes = new Map();
const logs = new Map();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const server = (port) => `http://127.0.0.1:${port}`;

async function start(port) {
  let log = '';
  const child = spawn(
    java,
    [
      '-Xmx384m',
      '-jar',
      join(root, 'backend/target/tracker-1.0.0.jar'),
      '--spring.profiles.active=production',
      '--server.address=127.0.0.1',
      `--server.port=${port}`,
    ],
    {
      cwd: join(root, 'backend'),
      env: process.env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  processes.set(port, child);
  child.stdout.on('data', (data) => {
    log += data;
    logs.set(port, log);
  });
  child.stderr.on('data', (data) => {
    log += data;
    logs.set(port, log);
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Java exited on ${port}. ${log.slice(-5000)}`);
    try {
      if ((await fetch(server(port) + '/actuator/health')).ok) return;
    } catch {}
    await sleep(500);
  }
  throw new Error(`Java startup timed out on ${port}. ${log.slice(-5000)}`);
}

async function stop(port) {
  const child = processes.get(port);
  processes.delete(port);
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill();
  await exited;
}

class Client {
  cookies = new Map();
  async raw(port, path, init = {}) {
    const headers = new Headers(init.headers);
    headers.set('Cookie', [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; '));
    const response = await fetch(server(port) + path, {
      signal: AbortSignal.timeout(20000),
      ...init,
      headers,
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';');
      const separator = pair.indexOf('=');
      const key = pair.slice(0, separator),
        value = pair.slice(separator + 1);
      if (value) this.cookies.set(key, value);
      else this.cookies.delete(key);
    }
    return response;
  }
  async request(port, path, method = 'GET', body, expected = 200) {
    const headers = new Headers();
    if (method !== 'GET') {
      const token = await this.raw(port, '/api/auth/csrf');
      assert.equal(token.status, 200, 'CSRF session must initialize');
      const csrf = await token.json();
      headers.set(csrf.headerName, csrf.token);
    }
    const multipart = body instanceof FormData;
    if (body && !multipart) headers.set('Content-Type', 'application/json');
    const response = await this.raw(port, path, {
      method,
      headers,
      body: body ? (multipart ? body : JSON.stringify(body)) : undefined,
    });
    assert.equal(
      response.status,
      expected,
      `${method} ${path}: expected ${expected}, got ${response.status}`,
    );
    return response.status === 204 ? undefined : response.json();
  }
}

let streamAbort;
try {
  await start(8082);
  await start(8083);
  console.log('PASS PostgreSQL migrations and schema validation on two instances');
  const password = randomBytes(20).toString('base64url');
  const email = `pg-${randomUUID()}@e2e.invalid`;
  const client = new Client();
  await client.request(
    8082,
    '/api/auth/register',
    'POST',
    { name: 'Verificação PostgreSQL', email, password },
    201,
  );
  const user = await client.request(8082, '/api/auth/login', 'POST', { email, password });
  assert.equal((await client.request(8083, '/api/auth/me')).id, user.id);
  console.log('PASS serialized login and CSRF shared between independent instances');

  streamAbort = new AbortController();
  const stream = await client.raw(8083, '/api/orders/events', { signal: streamAbort.signal });
  assert.equal(stream.status, 200);
  const reader = stream.body.getReader();
  let buffered = '';
  async function event(name) {
    const timeout = setTimeout(() => streamAbort.abort(), 12000);
    try {
      for (;;) {
        let end;
        while ((end = buffered.indexOf('\n\n')) >= 0) {
          const block = buffered.slice(0, end);
          buffered = buffered.slice(end + 2);
          if (block.includes(`event:${name}`) || block.includes(`event: ${name}`)) return;
        }
        const chunk = await reader.read();
        assert.equal(chunk.done, false, 'SSE must stay connected');
        buffered += new TextDecoder().decode(chunk.value).replaceAll('\r\n', '\n');
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  await event('ready');
  await event('orders-changed'); // Consume the initial authoritative refresh before writing.
  const started = Date.now();
  const order = await client.request(
    8082,
    '/api/orders',
    'POST',
    {
      customerName: 'Cliente de verificação',
      items: [{ name: 'Pedido PostgreSQL', quantity: 2, unitPrice: 12.5 }],
      deliveryAddress: {
        street: 'Praça da Sé',
        number: '10',
        complement: '',
        neighborhood: 'Sé',
        city: 'São Paulo',
        state: 'SP',
        postalCode: '01001-000',
      },
    },
    201,
  );
  await event('orders-changed');
  assert.ok(Date.now() - started < 7000, 'Cross-instance SSE should update promptly');
  const loaded = await client.request(8083, '/api/orders/' + order.id);
  assert.equal(loaded.status, 'RECEBIDO');
  assert.equal(Number(loaded.total), 25);
  console.log('PASS cross-instance SSE and PostgreSQL order persistence');

  await client.request(8082, `/api/orders/${order.id}/status`, 'PATCH', {
    status: 'EM_PREPARO',
    expectedVersion: loaded.version,
  });
  await event('orders-changed');
  assert.equal((await client.request(8083, '/api/orders/' + order.id)).status, 'EM_PREPARO');
  streamAbort.abort();

  const photo = await readFile(join(root, 'frontend/public/brand/foody-logo.png'));
  const form = new FormData();
  form.set('file', new Blob([photo], { type: 'image/png' }), 'verification.png');
  const profile = await client.request(8082, '/api/profile/avatar', 'PUT', form);
  const avatar = await client.raw(8083, profile.avatarUrl);
  assert.equal(avatar.status, 200);
  assert.ok((await avatar.arrayBuffer()).byteLength > 0);
  console.log('PASS avatar bytea roundtrip across instances');

  const other = new Client();
  await other.request(8083, '/api/auth/login', 'POST', { email, password });
  const updated = await client.request(8082, '/api/profile', 'PATCH', {
    name: 'Perfil PostgreSQL atualizado',
    email: `updated-${email}`,
    currentPassword: password,
    expectedVersion: profile.version,
  });
  assert.equal((await client.request(8083, '/api/auth/me')).email, updated.email);
  assert.equal((await other.raw(8083, '/api/auth/me')).status, 401);
  console.log('PASS session rotation and revocation after credential changes');

  await stop(8082);
  await stop(8083);
  await start(8082);
  assert.equal((await client.request(8082, '/api/auth/me')).id, user.id);
  const persisted = await client.request(8082, '/api/orders/' + order.id);
  assert.equal(persisted.status, 'EM_PREPARO');
  const persistedAvatar = await client.raw(8082, updated.avatarUrl);
  assert.equal(persistedAvatar.status, 200);
  console.log('PASS login, order status, profile and photo survive complete Java restart');
  await client.request(8082, '/api/auth/logout', 'POST', undefined, 204);
  assert.equal((await client.raw(8082, '/api/auth/me')).status, 401);
  console.log('PASS persistent logout');
} finally {
  streamAbort?.abort();
  await Promise.all([...processes.keys()].map(stop));
}
