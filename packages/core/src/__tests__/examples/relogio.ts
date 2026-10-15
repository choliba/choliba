import { PLATFORM, token, type Clock, type ShellModule } from '../../index';

/** O relógio da CLI, como um serviço: um teste troca por um relógio fixo. */
export const RELOGIO = token<Clock>('Relogio');

export const relogioModule: ShellModule = {
  name: 'relogio',
  provide: (container) => {
    container.provide(RELOGIO, (atual) => atual.get(PLATFORM).clock);
  },
  commands: [
    {
      name: 'agora',
      run: (container, io) => {
        io.write(`${container.get(RELOGIO)().toISOString()}\n`);
        return Promise.resolve();
      },
    },
  ],
};
