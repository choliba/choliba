import { BufferWritable, fakePlatform, replace, runShell } from '../../../../scripts/entries/core/testing';
import { RELOGIO, relogioModule } from './relogio';

describe('agora', () => {
  it('escreve a hora do relógio da CLI', async () => {
    const stdout = new BufferWritable();
    const meioDia = (): Date => new Date('2026-05-01T12:00:00.000Z');

    await runShell([relogioModule], fakePlatform({ argv: ['agora'], stdout }), [replace(RELOGIO, meioDia)]);

    expect(stdout.text()).toBe('2026-05-01T12:00:00.000Z\n');
  });
});
