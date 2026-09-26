import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = join(import.meta.dirname, '..');

console.log('Configurando o monorepo choliba...');

const install = spawnSync('bun', ['install'], { cwd: repoRoot, stdio: 'inherit' });
if (install.status !== 0) {
  process.exit(install.status ?? 1);
}

const home = process.env['HOME'];
if (home === undefined || home === '') {
  console.error('Não foi possível determinar o diretório HOME do usuário.');
  process.exit(1);
}

const bashrc = join(home, '.bashrc');
const completionPath = join(import.meta.dirname, 'libs/chol-completion.bash');
const targetLine = `source ${completionPath}`;

if (existsSync(bashrc)) {
  const content = readFileSync(bashrc, 'utf8');
  if (!content.includes(targetLine)) {
    appendFileSync(bashrc, `\n# Autocomplete choliba\n${targetLine}\n`);
    console.log('Autocomplete adicionado ao ~/.bashrc');
  } else {
    console.log('Autocomplete já estava configurado.');
  }
}

console.log('\nSetup concluído!');
