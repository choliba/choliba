import type { CommandEntry } from '../../packages/core/src/help';

import {
  commandPage,
  groupOf,
  indexPage,
  orderOf,
  pageFile,
  rootCommands,
  stalePages,
  stalePagesMessage,
  type CommandGroup,
  type DocCommand,
} from '../libs/docs';

const primeiro: CommandGroup = { title: 'Primeiro', commands: ['run agent', 'ausente'] };
const segundo: CommandGroup = { title: 'Segundo', commands: ['check'] };
const GROUPS: readonly CommandGroup[] = [primeiro, segundo];

const RUN_AGENT: DocCommand = {
  name: 'run agent',
  description: 'Roda um agente',
  spec: {
    usage: 'choliba run agent [OPTIONS]',
    description: 'Usa `<nome>` e <pasta>.',
    examples: [{ description: 'O mais comum', command: 'choliba run agent implementer' }],
    details: 'O modo padrão é execute.',
    flags: [
      {
        name: '--mode',
        aliases: ['-m'],
        description: 'O modo | a | b',
        value: { name: 'execute|plan|ask' },
        choices: [
          { name: 'execute', description: 'Faz <id>' },
          { name: 'plan', description: 'Só planeja' },
        ],
      },
    ],
  },
};

const CHECK: DocCommand = {
  name: 'check',
  description: 'Confere a pasta',
  spec: { usage: 'choliba check' },
};

describe('pageFile', () => {
  it('joins the command words with a hyphen', () => {
    expect(pageFile('run agent')).toBe('run-agent.md');
    expect(pageFile('check')).toBe('check.md');
  });
});

describe('groupOf', () => {
  it('finds the group, and stops when a command is in none', () => {
    expect(groupOf('run agent', GROUPS).title).toBe('Primeiro');
    expect(() => groupOf('sumiu', GROUPS)).toThrow('o comando "sumiu" não está em nenhum grupo');
  });
});

describe('orderOf', () => {
  it('counts from 1 in group order, the index staying at 0', () => {
    expect(orderOf('run')).toBe(1);
    expect(orderOf('check')).toBe(4);
    expect(orderOf('check', GROUPS)).toBe(3);
  });
});

describe('rootCommands', () => {
  it('lists each command once, a verb included, and skips what is not listed', () => {
    const entries: readonly CommandEntry[] = [
      { name: 'check', description: 'Confere', group: 'Commands', spec: { usage: 'choliba check' } },
      { name: 'hidden', description: 'Não', group: 'Commands', spec: { usage: 'x' }, listed: false },
      {
        name: 'run',
        description: 'Roda',
        group: 'Commands',
        spec: {
          usage: 'choliba run',
          commands: () => [
            { name: 'agent', description: 'Um agente', group: 'Types', spec: { usage: 'choliba run agent' } },
          ],
        },
      },
    ];

    expect(rootCommands(entries).map((command) => command.name)).toEqual(['check', 'run']);
  });
});

describe('commandPage', () => {
  it('writes Uso, Exemplos, Detalhes and Opções from the spec', () => {
    const page = commandPage(RUN_AGENT, primeiro, 1);

    expect(page).toContain('group: Primeiro\norder: 1\n');
    expect(page).toContain('# `choliba run agent`');
    expect(page).toContain('> Usa `<nome>` e &lt;pasta&gt;.');
    expect(page).toContain('## Uso\n\n```sh\ncholiba run agent [OPTIONS]\n```');
    expect(page).toContain('## Exemplos\n\nO mais comum:\n\n```sh\ncholiba run agent implementer\n```');
    expect(page).toContain('## Detalhes\n\nO modo padrão é execute.');
    expect(page).toContain(
      '| `-m`, `--mode <execute\\|plan\\|ask>` | O modo \\| a \\| b<br>`execute`: Faz &lt;id&gt;<br>`plan`: Só planeja |',
    );
    expect(page).toContain('[Comandos](./index.md#opções-globais)');
  });

  it('puts each type of a verb on that verb’s page', () => {
    const page = commandPage(
      {
        name: 'list',
        description: 'Lista',
        spec: {
          usage: 'choliba list TYPE [ARGS]',
          examples: [{ description: 'Os projetos', command: 'choliba list projects' }],
          commands: () => [
            {
              name: 'projects',
              description: 'Os projetos',
              group: 'Types',
              spec: {
                usage: 'choliba list projects [OPTIONS]',
                description: 'Lista os projetos.',
                examples: [{ description: 'Com os tickets', command: 'choliba list projects --tickets' }],
                details: 'Uma linha por projeto.',
                flags: [{ name: '--tickets', description: 'Mostra os tickets' }],
              },
            },
          ],
        },
      },
      primeiro,
      2,
    );

    expect(page).toContain('# `choliba list`');
    expect(page).toContain('## Uso\n\n```sh\ncholiba list TYPE [ARGS]\n```');
    expect(page).toContain('## `projects`');
    expect(page).toContain('### Uso\n\n```sh\ncholiba list projects [OPTIONS]\n```');
    expect(page).toContain('### Exemplos\n\nCom os tickets:\n\n```sh\ncholiba list projects --tickets\n```');
    expect(page).toContain('### Detalhes\n\nUma linha por projeto.');
    expect(page).toContain('### Opções');
    expect(page).toContain('| `--tickets` | Mostra os tickets |');
    expect(page).not.toContain('list-projects');
  });

  it('omits Exemplos, Detalhes and Opções when the spec has none', () => {
    const page = commandPage(CHECK, segundo, 3);

    expect(page).toContain('> Confere a pasta');
    expect(page).not.toContain('## Exemplos');
    expect(page).not.toContain('## Detalhes');
    expect(page).not.toContain('## Opções');
  });
});

describe('indexPage', () => {
  it('lists the groups in order and links each command that exists', () => {
    const page = indexPage([RUN_AGENT, CHECK], GROUPS);

    const first = page.indexOf('## Primeiro');
    const second = page.indexOf('## Segundo');
    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(first);
    expect(page).toContain('| [`choliba run agent`](./run-agent.md) | Roda um agente |');
    expect(page).toContain('| [`choliba check`](./check.md) | Confere a pasta |');
    expect(page).not.toContain('ausente');
    expect(page).toContain('## Opções globais');
  });
});

describe('stalePages', () => {
  it('names a missing page, a changed page and an extra file, and stays quiet when they match', () => {
    const wanted = new Map([
      ['a.md', 'atual'],
      ['b.md', 'igual'],
    ]);

    expect(stalePages(wanted, new Map([['b.md', 'igual']]))).toEqual(['a.md']);
    expect(
      stalePages(
        wanted,
        new Map([
          ['a.md', 'velha'],
          ['b.md', 'igual'],
          ['c.md', 'sobra'],
        ]),
      ),
    ).toEqual(['a.md', 'c.md']);
    expect(stalePages(wanted, wanted)).toEqual([]);
    expect(stalePagesMessage(['a.md', 'c.md'])).toBe(
      'docs/comandos/ está desatualizada: a.md, c.md. Rode: bun run docs:commands',
    );
  });
});
