// The command reference of the documentation (docs/comandos/), written from each command's spec: the same spec that
// gives its --help and its completion, so the page and the help never say different things.

import type { CommandEntry, CommandSpec, FlagSpec } from '../../../packages/core/src/help';

/** One command of the reference: its words (`run agent`), its one-line description and its spec. */
export interface DocCommand {
  readonly name: string;
  readonly description: string;
  readonly spec: CommandSpec;
}

/** A group of the reference, in the order the index and the menu show it. */
export interface CommandGroup {
  readonly title: string;
  readonly commands: readonly string[];
}

/** The groups of the reference, by what the person is doing. A command missing here stops the generator. */
export const COMMAND_GROUPS: readonly CommandGroup[] = [
  { title: 'Ticket e testes', commands: ['run'] },
  { title: 'Projetos', commands: ['new', 'list', 'check'] },
  { title: 'Agentes, skills e MCPs', commands: ['add'] },
  { title: 'Pasta de trabalho', commands: ['setup', 'lint', 'format'] },
  { title: 'Gerais', commands: ['help', 'version', 'terminal run'] },
];

/**
 * The sentence under a verb's title. The root help keeps the short line; the page needs 100–160 characters, and it
 * names the types that share this page.
 */
const VERB_LEAD: Readonly<Record<string, string>> = {
  run: 'Roda um agente da pasta de trabalho ou os testes E2E de um projeto. O tipo vem depois do verbo: agent ou tests.',
  new: 'Cria um projeto de teste a partir do modelo. O tipo é project; o que faltar, como a pasta e a URL, é perguntado no terminal.',
  list: 'Lista os agentes instalados na pasta de trabalho ou os projetos da pasta configurada, com os tickets quando se pede.',
};

/** `help` and `version` are words of the root, not commands with a spec: their pages are described here. */
export const ROOT_WORDS: readonly DocCommand[] = [
  {
    name: 'help',
    description: 'Mostra a ajuda da raiz ou de um comando',
    spec: {
      usage: 'choliba help [COMANDO...]',
      description:
        'Mostra a ajuda da raiz ou de um comando, a mesma de --help, e termina com o endereço da página do comando.',
      examples: [
        { description: 'Os comandos da raiz', command: 'choliba --help' },
        { description: 'A ajuda de um comando', command: 'choliba help run tests' },
      ],
      details:
        '`choliba --help`, `choliba -h` e `choliba COMANDO --help` mostram o mesmo. A ajuda de cada comando termina com o ' +
        'endereço da página dele nesta referência.',
    },
  },
  {
    name: 'version',
    description: 'Mostra a versão instalada',
    spec: {
      usage: 'choliba version',
      description:
        'Mostra a versão instalada: a base da pré-release, o número da release e, quando houver, o commit do build.',
      examples: [{ description: 'A versão instalada', command: 'choliba --version' }],
      details:
        'A versão segue o [SemVer](https://semver.org/lang/pt-BR/): a base da pré-release, o número da release (a ' +
        'contagem das releases, que aparece no título de cada atualização nas notas) e, como metadado de build, o ' +
        'commit, por exemplo `choliba 0.0.1-dev.16+1a2b3c4`. Rodando dos fontes ou de um `chol:pack` local, sai só a ' +
        'base (`0.0.1-dev`).',
    },
  },
];

/** The note every generated page starts with. */
const GENERATED = '<!-- Gerado por `bun run docs:commands` a partir do spec do comando: não edite à mão. -->';

/** The file of a command's page in docs/comandos/: its words joined by `-` (`terminal-run.md`). */
export function pageFile(name: string): string {
  return `${name.split(' ').join('-')}.md`;
}

/**
 * Pages that are not what the generator would write: each wanted file that is missing or different, then each file
 * on disk the generator does not write. `docs:commands --check` fails naming them.
 */
export function stalePages(
  wanted: ReadonlyMap<string, string>,
  onDisk: ReadonlyMap<string, string>,
): readonly string[] {
  const changed = [...wanted].filter(([file, text]) => onDisk.get(file) !== text).map(([file]) => file);
  const extra = [...onDisk.keys()].filter((file) => !wanted.has(file));
  return [...changed, ...extra];
}

/** What `--check` prints when `stalePages` is not empty. */
export function stalePagesMessage(files: readonly string[]): string {
  return `docs/comandos/ está desatualizada: ${files.join(', ')}. Rode: bun run docs:commands`;
}

/** Where a command comes in the reference: after every command of the groups before it (the index is 0). */
export function orderOf(name: string, groups: readonly CommandGroup[] = COMMAND_GROUPS): number {
  return groups.flatMap((group) => group.commands).indexOf(name) + 1;
}

/** The group a command is in; a command no group lists is a mistake the generator stops at. */
export function groupOf(name: string, groups: readonly CommandGroup[] = COMMAND_GROUPS): CommandGroup {
  const group = groups.find(({ commands }) => commands.includes(name));
  if (group === undefined) {
    throw new Error(`o comando "${name}" não está em nenhum grupo de COMMAND_GROUPS (scripts/libs/docs/commands.ts).`);
  }
  return group;
}

/**
 * The commands of a root's entries, one page each. A verb (`run`, `list`, `new`) is one command: its types are
 * sections of that page, the same way `choliba --help` lists the verb and not each type.
 */
export function rootCommands(entries: readonly CommandEntry[]): readonly DocCommand[] {
  return entries
    .filter((entry) => entry.listed !== false)
    .map((entry) => ({ name: entry.name, description: entry.description, spec: entry.spec }));
}

/**
 * Plain text of the help (a description), safe as Markdown: `<` and `>` outside code would read as HTML tags
 * (`.choliba/agents/<nome>/`). Code between backticks stays as it is.
 */
export function plain(text: string): string {
  return text
    .split('`')
    .map((part, index) => (index % 2 === 1 ? part : part.replaceAll('<', '&lt;').replaceAll('>', '&gt;')))
    .join('`');
}

/** A table cell: plain text on one line, with the `|` that would end the cell escaped. */
function cell(text: string): string {
  return plain(text).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

/** A flag as the options table names it: its short forms, its long form and its value (`-h`, `--help`). */
function flagName(flag: FlagSpec): string {
  const value = flag.value === undefined ? '' : ` <${flag.value.name}>`;
  return [...(flag.aliases ?? []), `${flag.name}${value}`].map((name) => `\`${name}\``).join(', ');
}

/** What a flag does, with the values it takes, each with what it means. */
function flagDescription(flag: FlagSpec): string {
  const choices = (flag.choices ?? []).map((choice) => `<br>\`${choice.name}\`: ${plain(choice.description)}`);
  return `${plain(flag.description)}${choices.join('')}`;
}

/** What holds for every command, under the options of a page that has some. */
const GLOBAL_OPTIONS =
  '`--no-color` e `--version` valem em qualquer comando: veja [Comandos](./index.md#opções-globais).';

/** The options of a spec as a table, or nothing for a spec without options. */
function optionsSection(flags: readonly FlagSpec[], heading: string): readonly string[] {
  if (flags.length === 0) return [];
  const rows = flags.map(
    (flag) => `| ${flagName(flag).replaceAll('|', '\\|')} | ${flagDescription(flag).replaceAll('|', '\\|')} |`,
  );
  return [heading, '', '| Opção | Descrição |', '| --- | --- |', ...rows, ''];
}

/** The examples of a spec: what each does, then its command line. */
function examplesSection(spec: CommandSpec, heading: string): readonly string[] {
  const examples = spec.examples ?? [];
  if (examples.length === 0) return [];
  return [
    heading,
    '',
    ...examples.flatMap(({ description, command }) => [`${plain(description)}:`, '', '```sh', command, '```', '']),
  ];
}

/** One type of a verb (`agent` of `run`): its own Uso, Exemplos, Detalhes and Opções on the verb's page. */
function typeSection(type: CommandEntry): readonly string[] {
  const { spec } = type;
  return [
    `## \`${type.name}\``,
    '',
    plain(spec.description ?? type.description),
    '',
    '### Uso',
    '',
    '```sh',
    spec.usage,
    '```',
    '',
    ...examplesSection(spec, '### Exemplos'),
    ...(spec.details === undefined ? [] : ['### Detalhes', '', spec.details, '']),
    ...optionsSection(spec.flags ?? [], '### Opções'),
  ];
}

/** The sentence under the title: a verb's lead, else what its spec says, else the one-line description. */
function lead(command: DocCommand): string {
  return VERB_LEAD[command.name] ?? command.spec.description ?? command.description;
}

/** The page of one command: its description, Uso, Exemplos, Detalhes and Opções, as the reference of Yarn has them. */
export function commandPage(command: DocCommand, group: CommandGroup, order: number): string {
  const { spec } = command;
  const types = spec.commands?.() ?? [];
  const options =
    types.length === 0 ? optionsSection(spec.flags ?? [], '## Opções') : types.flatMap((type) => typeSection(type));
  const note = options.length === 0 ? [] : [GLOBAL_OPTIONS, ''];
  return [
    '---',
    `group: ${group.title}`,
    `order: ${String(order)}`,
    'editLink: false',
    '---',
    '',
    GENERATED,
    '',
    `# \`choliba ${command.name}\``,
    '',
    `> ${plain(lead(command))}`,
    '',
    '## Uso',
    '',
    '```sh',
    spec.usage,
    '```',
    '',
    ...examplesSection(spec, '## Exemplos'),
    ...(spec.details === undefined ? [] : ['## Detalhes', '', spec.details, '']),
    ...options,
    ...note,
  ].join('\n');
}

/** The index of the reference: how to run choliba, the global options, then the groups with each command. */
export function indexPage(commands: readonly DocCommand[], groups: readonly CommandGroup[] = COMMAND_GROUPS): string {
  const byName = new Map(commands.map((command) => [command.name, command]));
  const sections = groups.flatMap((group) => [
    `## ${group.title}`,
    '',
    '| Comando | O que faz |',
    '| --- | --- |',
    ...group.commands.flatMap((name) => {
      const command = byName.get(name);
      return command === undefined
        ? []
        : [`| [\`choliba ${name}\`](./${pageFile(name)}) | ${cell(command.description)} |`];
    }),
    '',
  ]);
  return ['---', 'order: 0', 'editLink: false', '---', '', GENERATED, '', ...INDEX_INTRO, ...sections].join('\n');
}

/** What the index says before the groups: how to run choliba and what holds for every command. */
const INDEX_INTRO: readonly string[] = [
  '# Comandos',
  '',
  '> Cada comando do choliba, com o uso, os exemplos, os detalhes e as opções, gerado do mesmo spec que produz o --help.',
  '',
  'O comando é `choliba`, instalado na pasta de trabalho, em `node_modules/.bin/`, que não está no `PATH`. Rode-o com o',
  'Bun na frente: `bunx choliba <comando>` (ou `bun choliba <comando>`); as páginas omitem o `bunx`. A raiz tem poucos',
  'comandos. `run`, `new` e `list` são verbos: o tipo vem na palavra seguinte (`choliba run agent`, `choliba new',
  'project`, `choliba list projects`) e está na página do verbo. Uma palavra que o choliba não conhece é erro, com a',
  'sugestão do nome mais parecido (`comando desconhecido: chek. Você quis dizer "check"?`).',
  '',
  '## Opções globais',
  '',
  '| Opção | Descrição |',
  '| --- | --- |',
  '| `-h`, `--help` | A ajuda da raiz ou do comando, terminando com o endereço da página dele aqui |',
  '| `--version` | A versão instalada (veja [`choliba version`](./version.md)) |',
  '| `--no-color` | Saída sem cores |',
  '',
  'A saída só tem cor num terminal. `--no-color`, `NO_COLOR=1`, `FORCE_COLOR=0`, `TERM=dumb` ou um pipe tiram a cor;',
  '`FORCE_COLOR=1` força. Quais cores usar vem de `CHOL_COLORS` no `.env` (veja',
  '[`.env` da pasta de trabalho](../referencia/env.md)) e, para o rótulo de um agente, do `agent.color` dele.',
  '',
];
