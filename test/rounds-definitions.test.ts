import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, expect, test } from 'bun:test';

import { servePages } from '../src/rounds/pages';
import { definitionsPayload, roundsPayload } from '../src/rounds/payload';
import {
  declarationFromFiles,
  declarationFromSource,
  definitionOfFile,
  projectDefinitions,
  type ProjectDefinition,
} from '../src/rounds/web/src/load-definition';
import {
  toolsAt,
  toolsOfFiles,
  type ProjectTool,
} from '../src/rounds/web/src/project-tools';

let dir = '';

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'choliba-round-defs-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** The piece of a round in a folder: its actor, imported by the definition. */
const PIECE = `import { OllamaProvider, type AgentPolicy } from 'choliba';
import { roundDir, type RoundActor } from 'choliba/rounds';

export const id = 'em-pasta';
export const ACTOR = 'product-owner';
const root = roundDir(id);

const POLICY: AgentPolicy = {
  default: 'deny',
  allow: { filesystem: [{ operations: ['*'], paths: ['/workspace/**'] }] },
};

export const productOwner = {
  'product-owner': {
    provider: new OllamaProvider({ cli: 'codex', model: 'qwen3.5:4b', contextWindow: 10000 }),
    workspace: { type: 'bubblewrap', root, hostState: 'none' },
    policy: POLICY,
  },
} satisfies Readonly<Record<string, RoundActor>>;
`;

/** The definition of the round in a folder: it imports its piece. */
const ENTRY = `import { defineRound, noQuestions } from 'choliba/rounds';
import { ACTOR, id, productOwner } from './product-owner';

export default defineRound({
  repeat: 5,
  id,
  goal: \`\${ACTOR} deve conseguir analisar um ticket\`,
  start: { fixture: id },
  inputs: { size: 'Qual tamanho?' },
  actors: productOwner,
  flow: [{ actor: ACTOR, prompt: ({ inputs }) => ['Leia ticket.json', \`Tamanho: \${inputs.size}\`] }],
  criteria: {
    'product-owner': [{ file: { name: 'ticket.json', changed: true, contains: ['"completed": true'] } }],
  },
  rules: [noQuestions()],
});
`;

const FOLDER: ProjectDefinition = {
  id: 'em-pasta',
  entry: 'em-pasta.ts',
  files: { 'em-pasta.ts': ENTRY, 'product-owner.ts': PIECE },
};

test('definitionsPayload: arquivo só, pasta com as peças; pasta sem <id>.ts e pasta inexistente ficam de fora', () => {
  writeFileSync(join(dir, 'solta.ts'), 'solta');
  mkdirSync(join(dir, 'em-pasta'));
  writeFileSync(join(dir, 'em-pasta', 'em-pasta.ts'), 'entrada');
  writeFileSync(join(dir, 'em-pasta', 'product-owner.ts'), 'peça');
  writeFileSync(join(dir, 'em-pasta', 'LEIAME.md'), 'não é código');
  mkdirSync(join(dir, 'rascunho'));
  writeFileSync(join(dir, 'rascunho', 'outra.ts'), '');

  expect(JSON.parse(definitionsPayload(dir))).toEqual([
    {
      id: 'em-pasta',
      entry: 'em-pasta.ts',
      files: { 'em-pasta.ts': 'entrada', 'product-owner.ts': 'peça' },
    },
    { id: 'solta', entry: 'solta.ts', files: { 'solta.ts': 'solta' } },
  ]);
  expect(definitionsPayload(join(dir, 'nao-existe'))).toBe('[]');
});

test('servePages serve definitions.json ao lado de rounds.json', async () => {
  const dist = join(dir, 'dist');
  const data = join(dir, 'data');
  const definitions = join(dir, 'definitions');
  mkdirSync(dist);
  mkdirSync(definitions);
  writeFileSync(join(dist, 'index.html'), '<!doctype html>');
  writeFileSync(join(definitions, 'solta.ts'), 'solta');

  const server = servePages({ dist, data, definitions, port: 0 });
  try {
    const response = await fetch(new URL('definitions.json', server.url));
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual([
      { id: 'solta', entry: 'solta.ts', files: { 'solta.ts': 'solta' } },
    ]);
    const records = await fetch(new URL('rounds.json', server.url));
    expect(await records.json()).toEqual([]);
  } finally {
    await server.stop();
  }
});

test('projectDefinitions deixa de fora o que não é uma rodada com a sua entrada', () => {
  expect(projectDefinitions('não é lista')).toEqual([]);
  expect(
    projectDefinitions([
      FOLDER,
      { id: 'sem-entrada', entry: 'sem-entrada.ts', files: {} },
      { id: 1, entry: 'x.ts', files: { 'x.ts': '' } },
      {
        id: 'com-lixo',
        entry: 'com-lixo.ts',
        files: { 'com-lixo.ts': 'a', 'numero.ts': 3 },
      },
    ]),
  ).toEqual([
    FOLDER,
    { id: 'com-lixo', entry: 'com-lixo.ts', files: { 'com-lixo.ts': 'a' } },
  ]);
});

test('declarationFromFiles lê uma rodada em pasta, resolvendo ./ entre os arquivos dela', async () => {
  const declaration = await declarationFromFiles(
    FOLDER.files,
    FOLDER.entry,
    [],
  );
  expect(declaration.id).toBe('em-pasta');
  expect(declaration.goal).toBe(
    'product-owner deve conseguir analisar um ticket',
  );
  expect(declaration.repeat).toBe(5);
  expect(declaration.start).toEqual({ fixture: 'em-pasta' });
  expect(declaration.inputs).toEqual({ size: 'Qual tamanho?' });
  expect(declaration.rules).toEqual(['no-questions']);
  const actor = declaration.actors['product-owner'];
  expect(actor.provider).toEqual({
    name: 'ollama',
    cli: 'codex',
    model: 'qwen3.5:4b',
    contextWindow: 10000,
  });
  expect(actor.workspace.root).toBe('em-pasta');
  expect(actor.policy?.default).toBe('deny');
  expect(declaration.flow).toEqual([
    {
      actor: 'product-owner',
      by: null,
      prompt: ['Leia ticket.json', 'Tamanho: {{input:size}}'],
    },
  ]);
  expect(declaration.criteria?.['product-owner']).toEqual([
    {
      file: {
        name: 'ticket.json',
        changed: true,
        contains: ['"completed": true'],
      },
    },
  ]);
});

test('declarationFromFiles roda cada arquivo uma vez, e um ciclo recebe o que já foi exportado', async () => {
  const files = {
    'ciclo.ts': `import { nome } from './a';
import { visto } from './b.js';
import { defineRound } from 'choliba/rounds';
export default defineRound({ id: nome + visto, actors: {}, flow: [] });`,
    'a.ts': `export const nome = 'ciclo';
import { visto } from './b.ts';
export const repetido = visto;`,
    'b.ts': `import { nome } from './a';
export const visto = typeof nome === 'string' ? '-ok' : '-meio';`,
  };
  const declaration = await declarationFromFiles(files, 'ciclo.ts', []);
  expect(declaration.id).toBe('ciclo-ok');
});

test('colada sozinha, a definição de uma pasta diz que o import é desconhecido e aponta para a lista', async () => {
  const pasted = declarationFromSource(ENTRY, []);
  await expect(pasted).rejects.toThrow(
    'importa ./product-owner, que esta página não conhece',
  );
  await expect(pasted).rejects.toThrow('Abrir uma rodada do projeto');
});

test('quando a falta da peça quebra a definição, o erro diz o que quebrou e o import desconhecido', async () => {
  const source = `import { defineRound } from 'choliba/rounds';
import { ACTOR } from './product-owner';
export default defineRound({ id: ACTOR.toUpperCase(), actors: {}, flow: [] });`;
  const pasted = declarationFromSource(source, []);
  await expect(pasted).rejects.toThrow(/^A definição não rodou: /);
  await expect(pasted).rejects.toThrow('Abrir uma rodada do projeto');
});

test('um import desconhecido que não quebra a definição ainda é recusado', async () => {
  const source = `import { defineRound } from 'choliba/rounds';
import { nada } from 'pacote-de-fora';
export default defineRound({ id: 'x', actors: {}, flow: [], extra: nada });`;
  await expect(declarationFromSource(source, [])).rejects.toThrow(
    'A definição importa pacote-de-fora, que esta página não conhece: cole',
  );
});

test('uma peça colada sozinha diz que a rodada fica em <id>/<id>.ts', async () => {
  await expect(declarationFromSource(PIECE, [])).rejects.toThrow(
    'a rodada fica em <rounds.definitions>/<id>/<id>.ts',
  );
});

test('um arquivo que não dá para ler diz qual é', async () => {
  await expect(declarationFromSource('const = ;', [])).rejects.toThrow(
    'Não deu para ler a definição',
  );
  await expect(
    declarationFromFiles(
      { 'x.ts': `import './quebrada';`, 'quebrada.ts': 'const = ;' },
      'x.ts',
      [],
    ),
  ).rejects.toThrow('Não deu para ler quebrada.ts');
});

/** A tool of the project, as tools/browser.ts registers it. */
const BROWSER: ProjectTool = {
  name: 'choliba/open_page',
  binding: 'OPEN_PAGE',
  from: '../../tools/browser',
  description: 'Abre uma página.',
};

test('toolsAt casa a ferramenta pelo fim, tools/<arquivo>, de onde o import estiver', () => {
  expect(toolsAt([BROWSER], '../../tools/browser')).toEqual([BROWSER]);
  expect(toolsAt([BROWSER], '../../../tools/browser.ts')).toEqual([BROWSER]);
  expect(toolsAt([BROWSER], '../../tools/outra')).toEqual([]);
  expect(toolsAt([BROWSER], './browser')).toEqual([]);
});

test('declarationFromFiles dá a uma peça em pasta as ferramentas do projeto', async () => {
  const files = {
    'com-ferramenta.ts': `import { defineRound } from 'choliba/rounds';
import { OPEN_PAGE } from '../../../tools/browser';
export default defineRound({ id: OPEN_PAGE, actors: {}, flow: [] });`,
  };
  const declaration = await declarationFromFiles(files, 'com-ferramenta.ts', [
    BROWSER,
  ]);
  expect(declaration.id).toBe('choliba/open_page');
});

test('definitionOfFile acha a rodada pela entrada ou por uma peça, sem ligar para fim de linha', () => {
  const solta: ProjectDefinition = {
    id: 'solta',
    entry: 'solta.ts',
    files: { 'solta.ts': 'export default 1;' },
  };
  expect(definitionOfFile([solta, FOLDER], ENTRY)).toEqual({
    kind: 'one',
    definition: FOLDER,
    file: 'em-pasta.ts',
  });
  expect(
    definitionOfFile(
      [solta, FOLDER],
      `\n  ${PIECE.replaceAll('\n', '\r\n')}  `,
    ),
  ).toEqual({ kind: 'one', definition: FOLDER, file: 'product-owner.ts' });
  expect(definitionOfFile([solta, FOLDER], 'outra coisa')).toEqual({
    kind: 'none',
  });
  expect(definitionOfFile([solta, FOLDER], '   ')).toEqual({ kind: 'none' });
});

test('definitionOfFile não escolhe quando o mesmo arquivo está em duas rodadas', () => {
  const copia: ProjectDefinition = {
    id: 'copia',
    entry: 'copia.ts',
    files: { 'copia.ts': 'x', 'product-owner.ts': PIECE },
  };
  expect(definitionOfFile([FOLDER, copia], PIECE)).toEqual({
    kind: 'many',
    ids: ['em-pasta', 'copia'],
  });
});

test('servePages: sem as páginas geradas, diz o que rodar; serve o dist e nada fora dele', async () => {
  const dist = join(dir, 'dist');
  const data = join(dir, 'data');
  expect(() => servePages({ dist, data, definitions: dir, port: 0 })).toThrow(
    'Instale o Choliba pelo .tgz da release, que já as traz; no repositório do Choliba, rode bun run rounds:build',
  );

  mkdirSync(dist);
  mkdirSync(data);
  writeFileSync(join(dist, 'index.html'), '<!doctype html>');
  writeFileSync(join(dist, 'app.js'), 'export {};');
  writeFileSync(join(data, 'rodada-1.json'), '{"id":"rodada"}');
  writeFileSync(join(data, 'notas.txt'), 'não é registro');
  const server = servePages({ dist, data, definitions: dir, port: 0 });
  try {
    const page = await fetch(server.url);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(await page.text()).toBe('<!doctype html>');
    const script = await fetch(new URL('app.js', server.url));
    expect(script.headers.get('content-type')).toContain('text/javascript');
    expect((await fetch(new URL('nada.js', server.url))).status).toBe(404);
    expect(
      (await fetch(new URL('%2e%2e/data/rodada-1.json', server.url))).status,
    ).toBe(404);
    const records = await fetch(new URL('rounds.json', server.url));
    expect(await records.json()).toEqual([
      { file: 'rodada-1.json', record: { id: 'rodada' } },
    ]);
  } finally {
    await server.stop();
  }
  expect(JSON.parse(roundsPayload(join(dir, 'nao-existe')))).toEqual([]);
});

test('toolsOfFiles monta as ferramentas que toolsAt acha, por arquivo', () => {
  const tools = toolsOfFiles({
    'tools/zeta.ts': `export const Z = registerTool({ name: 'zeta', description: 'Z.'`,
    'tools/alfa.ts': `export const A = registerTool({ name: 'alfa'`,
  });
  expect(tools.map((tool) => tool.name)).toEqual([
    'choliba/alfa',
    'choliba/zeta',
  ]);
  expect(toolsAt(tools, '../../../tools/zeta')).toEqual([
    {
      name: 'choliba/zeta',
      binding: 'Z',
      from: '../../tools/zeta',
      description: 'Z.',
    },
  ]);
});

/** A definition with every kind of field the form reads back. */
const FULL = `import { defineRound, ClaudeProvider, OllamaProvider, readOnlyRespected } from 'choliba';

export default defineRound({
  id: 'completa',
  goal: 'tudo',
  start: { git: { root: '/…/app', tag: 'v1' } },
  actors: {
    leitor: {
      provider: new ClaudeProvider({
        model: 'modelo',
        think: true,
        tools: ['file_read'],
        host: 'localhost',
        retries: 2,
        verbose: false,
        flags: ['--a', '--b'],
        callback: () => 1,
        mixed: ['a', 1],
      }),
      workspace: {
        type: 'docker',
        image: 'node:22',
        root: 'completa',
        hostState: 'login',
        writable: ['src'],
        ports: [3000, -1, 1.5, 'x'],
        homes: '/…/homes',
      },
      readOnly: true,
    },
    simples: {
      provider: new OllamaProvider(),
      workspace: { root: 'completa', hostState: 'outro' },
    },
  },
  flow: [
    { actor: 'leitor', by: 'simples', prompt: ({ said }) => ['Leia', said.simples] },
    { actor: 'simples', prompt: () => { throw new Error('não'); } },
    { actor: 'simples', prompt: () => 'não é lista' },
  ],
  criteria: {
    round: [{ limit: { time: '1min', tokens: 10, cost: '$1' } }],
    leitor: [
      { file: { name: 'a.txt', exists: true, created: false, ignore: ['*.log'], matches: [/^a+$/, 'b', /c/i], equals: 'aaa' } },
      {
        if: { name: 'b.txt', exists: true, contains: ['x'] },
        check: [{ limit: { time: '1min' } }, { desconhecido: 1 }],
        else: [{ file: { name: 'c.txt', deleted: true } }],
      },
      { if: { name: 'd.txt' }, check: 'não é lista' },
      { nenhum: true },
    ],
  },
  rules: [readOnlyRespected()],
});
`;

test('declarationFromSource lê todos os campos que o formulário mostra', async () => {
  const declaration = await declarationFromSource(FULL, []);
  expect(declaration.start).toEqual({ git: { root: '/…/app', tag: 'v1' } });
  expect(declaration.repeat).toBe(1);
  expect(declaration.rules).toEqual(['read-only-respected']);
  expect(declaration.actors['leitor']).toEqual({
    provider: {
      name: 'claude',
      cli: null,
      model: 'modelo',
      think: true,
      tools: ['file_read'],
      options: {
        host: 'localhost',
        retries: 2,
        verbose: false,
        flags: ['--a', '--b'],
      },
    },
    workspace: {
      type: 'docker',
      image: 'node:22',
      root: 'completa',
      hostState: 'login',
      writable: ['src'],
      ports: [3000],
      homes: '/…/homes',
    },
    policy: null,
    readOnly: true,
  });
  expect(declaration.actors['simples']).toEqual({
    provider: { name: 'ollama', cli: null, model: null },
    workspace: {
      type: 'bubblewrap',
      image: null,
      root: 'completa',
      hostState: null,
    },
    policy: null,
    readOnly: false,
  });
  expect(declaration.flow).toEqual([
    { actor: 'leitor', by: 'simples', prompt: ['Leia', '{{said:simples}}'] },
    { actor: 'simples', by: null, prompt: null },
    { actor: 'simples', by: null, prompt: null },
  ]);
  expect(declaration.criteria).toEqual({
    round: [{ limit: { time: '1min', tokens: 10, cost: '$1' } }],
    leitor: [
      {
        file: {
          name: 'a.txt',
          exists: true,
          created: false,
          ignore: ['*.log'],
          matches: ['^a+$', 'b', { source: 'c', flags: 'i' }],
          equals: 'aaa',
        },
      },
      {
        if: { name: 'b.txt', exists: true, contains: ['x'] },
        check: [{ limit: { time: '1min' } }],
        else: [{ file: { name: 'c.txt', deleted: true } }],
      },
      { if: { name: 'd.txt' }, check: [] },
    ],
  });
});

test('uma rodada sem id, actors ou flow diz o que falta', async () => {
  await expect(
    declarationFromSource(
      `import { defineRound } from 'choliba'; export default defineRound({ id: 'x' });`,
      [],
    ),
  ).rejects.toThrow('A rodada precisa de id, actors e flow.');
});
