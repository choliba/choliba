import { BufferWritable, fakePlatform, runShell } from '../../testing';
import { olaModule } from './ola';

async function ola(argv: readonly string[]): Promise<{ code: number; out: string }> {
  const stdout = new BufferWritable();
  const code = await runShell([olaModule], fakePlatform({ argv, stdout }));
  return { code, out: stdout.text() };
}

describe('ola', () => {
  it('cumprimenta pelo nome, ou o mundo', async () => {
    expect(await ola(['ola', 'Ana'])).toEqual({ code: 0, out: 'Olá, Ana!\n' });
    expect(await ola(['ola'])).toEqual({ code: 0, out: 'Olá, mundo!\n' });
  });
});
