// Explicit opt-in demo data. Never runs during normal startup.
const base = process.env.API_URL ?? 'http://127.0.0.1:8080/api';
const email = process.env.DEMO_EMAIL ?? 'demo@foody.local';
const password = process.env.DEMO_PASSWORD ?? 'FoodyDemo123!';
const cookies = new Map();
let csrf;

async function call(route, method = 'GET', body) {
  if (method !== 'GET' && !csrf) csrf = await call('/auth/csrf');
  const response = await fetch(base + route, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '),
      ...(method !== 'GET' ? { [csrf.headerName]: csrf.token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(';', 1)[0];
    const position = pair.indexOf('=');
    cookies.set(pair.slice(0, position), pair.slice(position + 1));
  }
  if (response.status === 204) return;
  const result = await response.json();
  if (!response.ok) {
    if (route === '/auth/register' && response.status === 409) return;
    throw new Error(`${response.status}: ${result.detail}`);
  }
  return result;
}

try {
  await call('/auth/register', 'POST', { name: 'Equipe Foody', email, password });
  await call('/auth/login', 'POST', { email, password });
  csrf = undefined;
  const existing = await call('/orders?size=1');
  if (existing.totalElements > 0) {
    console.log(`A conta ${email} já tem pedidos. Nenhum dado foi duplicado.`);
  } else {
    const samples = [
      ['Maria Silva', 'Pizza Margherita', 39.9, 'ENTREGUE', 'Centro'],
      ['Pedro Almeida', 'Burger da casa', 28.5, 'SAIU_PARA_ENTREGA', 'Vila Universitária'],
      ['Ana Oliveira', 'Combo vegetariano', 32.9, 'EM_PREPARO', 'Jardim América'],
      ['Lucas Santos', 'Pizza Portuguesa', 45.9, 'RECEBIDO', 'Vila Falcão'],
      ['Beatriz Costa', 'Açaí com frutas', 24.9, 'EM_PREPARO', 'Jardim Estoril'],
      ['Rafael Souza', 'Bowl de frango', 34.9, 'ENTREGUE', 'Centro'],
      ['Camila Ferreira', 'Combo da casa', 52.5, 'CANCELADO', 'Vila Cardia'],
      ['Bruno Lima', 'Pizza de quatro queijos', 48.9, 'RECEBIDO', 'Jardim Brasil'],
    ];
    for (const [name, item, price, target, neighborhood] of samples) {
      let order = await call('/orders', 'POST', { customerName: name, deliveryAddress: { street: 'Rua das Flores', number: '42', complement: 'Casa', neighborhood, city: 'Bauru', state: 'SP', postalCode: '17010-000' }, items: [{ name: item, quantity: 1, unitPrice: price }] });
      const transitions = target === 'CANCELADO' ? ['CANCELADO'] : ['EM_PREPARO', 'SAIU_PARA_ENTREGA', 'ENTREGUE'].slice(0, ['RECEBIDO', 'EM_PREPARO', 'SAIU_PARA_ENTREGA', 'ENTREGUE'].indexOf(target));
      for (const status of transitions) order = await call(`/orders/${order.id}/status`, 'PATCH', { status, expectedVersion: order.version });
    }
    console.log(`8 pedidos de demonstração criados. Conta: ${email}`);
    console.log('Senha padrão de desenvolvimento: FoodyDemo123! (ou DEMO_PASSWORD, se definida).');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
