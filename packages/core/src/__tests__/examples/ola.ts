import type { CommandSpec, ShellModule } from '../../index';

const OLA_SPEC: CommandSpec = {
  usage: 'ola ola [NOME]',
  description: 'Cumprimenta alguém.',
  flags: [{ name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true }],
};

export const olaModule: ShellModule = {
  name: 'ola',
  root: {
    spec: { usage: 'ola COMMAND [ARGS]', description: 'Uma CLI de exemplo.' },
    version: () => 'ola 1.0.0',
  },
  commands: [
    {
      name: 'ola',
      help: () => [{ name: 'ola', description: 'Cumprimenta alguém', group: 'Commands', spec: OLA_SPEC }],
      run: (_container, io) => {
        const args = io.args('ola');
        if (io.wantsHelp(args)) {
          io.printHelp(OLA_SPEC);
          return Promise.resolve();
        }
        const [nome = 'mundo'] = args;
        io.write(`Olá, ${nome}!\n`);
        return Promise.resolve();
      },
    },
  ],
};
