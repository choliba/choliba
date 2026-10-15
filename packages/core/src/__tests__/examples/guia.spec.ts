import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { boldAnsi, loadConfigFile, paintAnsi, rawArgsAfter, visibleWidth, wrapVisible } from '../../index';
import { BufferWritable, FakeSignals, fakePlatform, runShell } from '../../testing';
import { fakeSpawner, streamFromChunks } from '../terminal/helpers/fake-spawner';
import { ajudaDeServir, sugestoes } from './ajuda';
import { configuracao } from './configuracao';
import { lerLinha } from './linha';
import { olaModule } from './ola';
import { rodar } from './processo';
import { quadro } from './quadro';
import { relogioModule } from './relogio';
import { tabelaDeIdades } from './tabela';
import { emVerde } from './tema';

/** A code block of the README and the marker comment right above it (`<!-- exemplo: ola.ts -->`), if any. */
interface Block {
  readonly language: string;
  readonly code: string;
  readonly marker?: { readonly kind: string; readonly value: string };
}

const README = readFileSync(join(__dirname, '..', '..', '..', 'README.md'), 'utf8');

/** The README's fenced blocks, dedented to their fence, each with the marker the lines above it name. */
function blocks(markdown: string): readonly Block[] {
  const found: Block[] = [];
  const lines = markdown.split('\n');
  let marker: Block['marker'];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? '';
    const comment = /^\s*<!-- ([a-z-]+): (.+) -->$/.exec(line);
    if (comment !== null) {
      marker = { kind: comment[1] ?? '', value: comment[2] ?? '' };
      continue;
    }
    const fence = /^(\s*)```(\w*)$/.exec(line);
    if (fence === null) continue;
    const indent = fence[1]?.length ?? 0;
    const body: string[] = [];
    index++;
    while (index < lines.length && (lines[index] ?? '').trim() !== '```') {
      body.push((lines[index] ?? '').slice(indent));
      index++;
    }
    found.push({ language: fence[2] ?? '', code: `${body.join('\n')}\n`, ...(marker === undefined ? {} : { marker }) });
    marker = undefined;
  }
  return found;
}

/** An example's source as the README shows it: imported from the installed package, not from this folder. */
function asInstalled(file: string): string {
  return readFileSync(join(__dirname, file), 'utf8')
    .replaceAll("'../../index'", "'choliba/core'")
    .replaceAll("'../../testing'", "'choliba/core/testing'");
}

async function cliOutput(modules: Parameters<typeof runShell>[0], line: string): Promise<string> {
  const out = new BufferWritable();
  await runShell(modules, fakePlatform({ argv: line.split(' '), stdout: out, stderr: out }));
  return out.text();
}

/** What each `saida` marker of the README shows, computed from the example it names. */
const OUTPUTS: Readonly<Record<string, () => Promise<string>>> = {
  'ola Ana': () => cliOutput([olaModule], 'ola Ana'),
  '--help': () => cliOutput([olaModule], '--help'),
  nada: () => cliOutput([olaModule], 'nada'),
  agora: () => cliOutput([relogioModule], 'agora'),
  "lerLinha(['ola', '--no-color', 'Ana'])": () => Promise.resolve(`${lerLinha(['ola', '--no-color', 'Ana'])}\n`),
  'ajudaDeServir()': () => Promise.resolve(`${ajudaDeServir()}\n`),
  'tabelaDeIdades(40)': () => Promise.resolve(`${tabelaDeIdades(40)}\n`),
  "quadro('build', 'compilando\\npronto', 24)": () => Promise.resolve(`${quadro('build', 'compilando\npronto', 24)}\n`),
  "configuracao({ PORTA: '8080' })": () => Promise.resolve(`${JSON.stringify(configuracao({ PORTA: '8080' }))}\n`),
};

describe('o guia do core (README.md)', () => {
  const all = blocks(README);

  it('mostra cada exemplo exatamente como o código que roda', () => {
    const examples = all.filter((block) => block.marker?.kind === 'exemplo');
    for (const block of examples) {
      expect({ file: block.marker?.value, code: block.code }).toEqual({
        file: block.marker?.value,
        code: asInstalled(block.marker?.value ?? ''),
      });
    }
    const sources = readdirSync(__dirname).filter((file) => file !== 'guia.spec.ts');
    expect(examples.map((block) => block.marker?.value).toSorted()).toEqual(sources.toSorted());
  });

  it('marca todo bloco de TypeScript com o exemplo de onde ele vem', () => {
    const unmarked = all.filter(
      (block) => block.language === 'ts' && !['exemplo', 'exemplo-instalado'].includes(block.marker?.kind ?? ''),
    );
    expect(unmarked).toEqual([]);
  });

  it('mostra a saída que os exemplos dão de verdade', async () => {
    const outputs = all.filter((block) => block.marker?.kind === 'saida');
    expect(outputs.map((block) => block.marker?.value)).toEqual(Object.keys(OUTPUTS));
    for (const block of outputs) {
      const compute = OUTPUTS[block.marker?.value ?? ''];
      expect(await compute?.()).toBe(block.code);
    }
  });

  it('roda um processo e escreve a saída com o rótulo', async () => {
    const written: string[] = [];
    const { spawner } = fakeSpawner({ stdout: streamFromChunks(['pronto\n']) });

    const code = await rodar(spawner, ['echo', 'pronto'], (texto) => written.push(texto));

    expect(code).toBe(0);
    expect(written).toEqual(['[app] pronto\n']);
  });

  it('dá os valores que o texto do guia cita', () => {
    expect(rawArgsAfter(['list', 'projects', '--json'], 'list', 'projects')).toEqual(['--json']);
    expect(visibleWidth(paintAnsi('green', 'ok'))).toBe(2);
    expect(wrapVisible('uma linha comprida', 10)).toEqual(['uma linha', 'comprida']);
    expect(boldAnsi('x')).toBe('\u001b[1mx\u001b[22m');
    expect(loadConfigFile(join(__dirname, 'sem-env'))).toBeUndefined();
  });

  it('avisa quem se inscreveu quando o teste dispara um sinal', () => {
    const signals = new FakeSignals();
    const recebidos: string[] = [];
    signals.on('SIGINT', () => recebidos.push('SIGINT'));

    signals.emit('SIGINT');

    expect(recebidos).toEqual(['SIGINT']);
  });

  it('sugere as opções do comando', () => {
    expect(sugestoes(['--'])).toEqual({ kind: 'values', values: ['--porta', '--help'] });
  });

  it('pinta de verde só quando a saída aceita cor', () => {
    expect(emVerde('ok', {}, true)).toBe('\u001b[32mok\u001b[0m');
    expect(emVerde('ok', { NO_COLOR: '1' }, true)).toBe('ok');
    expect(emVerde('ok', {}, false)).toBe('ok');
  });
});
