import { boldAnsi, entryHelp, THEME, WORKSPACE_ROOT, type CommandEntry, type ShellCommand } from '@choliba/shell';

import { RUNTIME } from '../runtime';
import { RELEASES_PAGE, update } from './update';

/** How `choliba --help` lists `update`, and its own `--help`. */
const ENTRY: CommandEntry = {
  name: 'update',
  description: 'Atualiza o choliba para a versão mais recente e mostra as novidades',
  group: 'Commands',
  spec: {
    usage: 'choliba update [--check] [--force]',
    description:
      'Compara a versão instalada com a release mais recente e, havendo uma nova, baixa, confere o SHA-256, instala e ' +
      'mostra as novidades.',
    examples: [
      { description: 'Atualiza e mostra as novidades', command: 'choliba update' },
      { description: 'Só mostra se há versão nova e as novidades, sem instalar', command: 'choliba update --check' },
      { description: 'Troca um pacote local pela release', command: 'choliba update --force' },
    ],
    flags: [
      { name: '--check', description: 'Só confere: diz se há versão nova e as novidades, sem instalar' },
      { name: '--force', description: 'Troca pela release também um pacote local, que pode ser mais novo que ela' },
      { name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true },
    ],
    details: [
      'Roda na pasta de trabalho: o pacote novo fica nela (`choliba-0.0.1-dev.N.tgz`, no lugar do anterior), é instalado',
      'com `bun add --trust` (que roda o `choliba setup`) e o `package.json` passa a apontar para ele. Um pacote que não',
      'confere com o SHA-256 da release não é instalado.',
      '',
      `As novidades são as da [página de releases](${RELEASES_PAGE}) desde a versão instalada. Rodando do código-fonte`,
      'do choliba, o comando recusa: ali se atualiza com `git pull`.',
      '',
      'Um pacote local (feito com `bun run chol:pack`, cuja versão não tem o número da release) pode ser mais novo que',
      'a release: o comando para e só o troca pela release com `--force`, sem mostrar novidades.',
    ].join('\n'),
  },
};

/** `choliba update [--check] [--force]`: the current pre-release, installed in the workspace with what is new. */
export const updateCommand: ShellCommand = {
  name: 'update',
  help: () => [ENTRY],
  run: async (container, io) => {
    const args = io.args('update');
    if (io.wantsHelp(args)) {
      io.printHelp(entryHelp(ENTRY));
      return;
    }
    const unknown = args.find((arg) => arg !== '--check' && arg !== '--force');
    if (unknown !== undefined) {
      io.usageError(`opção desconhecida: ${unknown}`, 'choliba update');
      return;
    }
    const options = { check: args.includes('--check'), force: args.includes('--force') };
    const code = await update(container.get(RUNTIME), container.get(WORKSPACE_ROOT), options, {
      write: (text) => {
        io.write(text);
      },
      fail: (text) => {
        io.warn(text);
      },
      bold: container.get(THEME).enabled() ? boldAnsi : (text) => text,
    });
    io.exit(code);
  },
};
