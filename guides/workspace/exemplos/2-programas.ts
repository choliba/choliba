/**
 * Exemplo 2 do curso de workspace: rodar programas dentro de um workspace,
 * sem agente nenhum. Cria um workspace, roda `pwd` dentro dele, depois um
 * workspace que mostra só o programa escolhido (`programs`) e roda esse
 * programa lá dentro. Precisa do bubblewrap e do php instalado no host; rode
 * na raiz do repositório.
 */
import { Executor, ProgramExecutionError } from '../../../src/execute/index';
import { currentDirectory } from '../../../src/execute/process';
import type { ProgramCommand } from '../../../src/execute/types';
import { join } from '../../../src/filesystem/index';
import { writeOut } from '../../../src/output/stdio';
import { Workspace } from '../../../src/workspace/index';

// A raiz do workspace: uma pasta qualquer do host (criada se não existir).
const root = join(currentDirectory(), '.choliba/exemplo-programas');

/** Roda `command` dentro de `workspace` e mostra o que ele imprime. */
async function runInside(
  workspace: Workspace,
  command: ProgramCommand,
): Promise<void> {
  const label = [command.executable, ...(command.arguments ?? [])].join(' ');
  writeOut(`$ ${label}\n`);
  try {
    for await (const { chunk } of new Executor().run(
      await workspace.prepare(command),
    )) {
      writeOut(chunk);
    }
  } catch (error) {
    const code =
      error instanceof ProgramExecutionError
        ? ` (código ${String(error.code)})`
        : '';
    writeOut(`falhou${code}\n`);
  }
}

// 1. Um workspace sem `programs`: o agente veria todos os programas do host.
const workspace = new Workspace({ type: 'bubblewrap', root });
try {
  await runInside(workspace, { executable: 'pwd' });
} finally {
  await workspace.close();
}

// 2. Um workspace que mostra só o php (mais a base: env, cat, sh, bash e o
// runtime do Choliba).
const onlyPhp = new Workspace({ type: 'bubblewrap', root, programs: ['php'] });
const { found, missing } = onlyPhp.checkPrograms();
writeOut(
  `\nprograms: ${found.map(({ name, path }) => `${name} em ${path}`).join(', ')}; faltando: ${missing.length}\n`,
);
try {
  await runInside(onlyPhp, {
    executable: 'php',
    arguments: [
      '-r',
      'echo getcwd(), " com PHP ", PHP_MAJOR_VERSION, PHP_EOL;',
    ],
  });
  // O que existe em /usr/bin lá dentro (o `echo` do bash, sem o `ls`).
  await runInside(onlyPhp, {
    executable: 'bash',
    arguments: ['-c', 'echo /usr/bin/*'],
  });
  // Instalado no host, mas não escolhido: lá dentro ele não existe.
  await runInside(onlyPhp, {
    executable: 'bash',
    arguments: ['-c', 'git --version'],
  });
} finally {
  await onlyPhp.close();
}
