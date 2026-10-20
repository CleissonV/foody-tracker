import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const jar = join(root, 'backend/target/tracker-1.0.0.jar');
if (!existsSync(jar)) {
  console.error('Compile a API primeiro: cd backend && ./mvnw verify (Windows: .\\mvnw.cmd verify).');
  process.exit(1);
}
const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java';
const args = ['-jar', jar];
if (process.argv.includes('--e2e')) args.push('--server.port=8081', '--spring.datasource.url=jdbc:h2:mem:e2e;DB_CLOSE_DELAY=-1');
const child = spawn(java, args, { cwd: join(root, 'backend'), stdio: 'inherit', windowsHide: true });
child.on('error', error => { console.error('Não foi possível iniciar o Java:', error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 0; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { child.kill(); });
