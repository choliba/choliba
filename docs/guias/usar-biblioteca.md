# Usar a biblioteca

> Como ler, de um script TypeScript, providers, agentes, skills, projetos, tickets e resultados de testes, com as
> mesmas regras da linha de comando.

`choliba` também é uma biblioteca: cada assunto é um módulo que você importa pelo nome, e cada módulo usa as mesmas
regras do `choliba` na linha de comando. Um script e a CLI sempre dão a mesma resposta.

A biblioteca só lê, e é experimental até a versão 1.0. Para criar ou alterar alguma coisa, use os comandos
(`choliba set config`, `choliba add`, `choliba new project`).

## Exemplo

Dentro de uma pasta de trabalho (uma pasta cujo `package.json` depende de `choliba`), crie `choliba.ts`:

<!-- exemplo-instalado: choliba.ts -->

```ts
import { agents, providers, skills, workspace } from 'choliba';

process.stdout.write(`raiz: ${workspace.root}\n`);
process.stdout.write(
  `providers: ${providers
    .list()
    .map((provider) => provider.id)
    .join(', ')}\n`,
);
process.stdout.write(`agentes em ${agents.dir}\n`);
for (const agent of agents.list()) {
  process.stdout.write(`- ${agent.id} ${agent.version}\n`);
}
for (const skill of skills.list()) {
  process.stdout.write(`skill ${skill.name}: ${skill.description}\n`);
}
```

Rode `bun choliba.ts` de qualquer subpasta. A saída é parecida com:

```text
raiz: /home/voce/meu-workspace
providers: claude, claude-ollama, codex, cursor
agentes em /home/voce/meu-workspace/.choliba/agents
- implementer 1.0.3
- product-owner 1.3.2
- tech-stack-analyzer 1.0.0
- test-writer 1.1.3
skill playwright-cli: Automate browser interactions, test web pages and work with Playwright tests.
```

O teste do pacote distribuído roda esse exemplo com o Bun e confere os tipos do arquivo.

## Workspace

```ts
import { workspace } from 'choliba';

workspace.root; // '/home/voce/meu-workspace', rodando de qualquer subpasta dele
workspace.version; // 'choliba 0.0.1-dev.69+1a2b3c4', a mesma linha de `choliba --version`
```

`root` é a pasta mais próxima, subindo a partir da pasta atual, cujo `package.json` depende de `choliba`. Nada é lido
no `import`: a raiz é procurada no primeiro uso e guardada. Fora de uma pasta de trabalho, esse primeiro uso lança
`WorkspaceNotFoundError`:

```text
Nenhuma pasta de trabalho do choliba acima de /tmp: rode dentro de uma pasta cujo package.json dependa de choliba
(crie uma com `bun add choliba`).
```

`version` não depende da pasta de trabalho. Sem o `package.json` do choliba à vista, vale
`choliba (versão desconhecida)`.

### Outra pasta ou outro ambiente

Os módulos importados pelo nome leem a pasta e o ambiente do processo. Para outra pasta, ou outro ambiente sem mexer
no processo, `openCholiba` devolve os mesmos módulos:

```ts
import { openCholiba } from 'choliba';

const outro = openCholiba({ cwd: '/srv/outro-workspace' });
outro.agents.list();

const isolado = openCholiba({ cwd: '/tmp/ws', env: { CHOL_AGENTS_DIR: 'meus/agentes' } });
isolado.agents.dir; // '/tmp/ws/meus/agentes'
```

Sem `cwd`, a busca parte da pasta atual. Sem `env`, o ambiente é o do processo. `import { choliba } from 'choliba'`
também continua dando todos os módulos juntos (`choliba.agents`, `choliba.projects`…), além de `choliba.root` e
`choliba.version`.

## Configuração

```ts
import { config } from 'choliba';
import { agentsConfig } from 'choliba/agents';
import { defineConfig } from 'choliba/config';
import { sandboxConfig } from 'choliba/sandbox';

config(agentsConfig).provider; // 'auto'
config(sandboxConfig); // { mode: 'local', image: 'choliba-agent', network: 'isolated' }

const meuScript = defineConfig('meu-script', {
  retries: { env: 'MEU_RETRIES', type: 'number', description: 'tentativas', default: 3 },
});
config(meuScript).retries; // 3, ou o MEU_RETRIES do ambiente ou do .env
```

`config(grupo)` lê um grupo das mesmas fontes da CLI, nesta ordem:

1. o ambiente;
2. o `.env` da raiz;
3. o padrão de cada chave.

Serve para os grupos do choliba e para os seus, declarados com [`defineConfig`](../referencia/config.md). Um valor
inválido lança o mesmo erro da CLI, nomeando a origem e a chave
(`.env: CHOL_SANDBOX: valor inválido ("vm"); esperava um de: local, docker.`).

`config.list()` devolve cada chave do choliba com o valor em vigor e a origem. São os dados de `choliba list config`.
Uma credencial só informa se está definida, e o valor dela fica de fora:

```ts
import { config } from 'choliba';

for (const setting of config.list()) {
  process.stdout.write(`${setting.key.address.env} = ${setting.value ?? '-'} (${setting.origin})\n`);
}
config.list().filter((setting) => setting.origin === '.env'); // só o que veio do .env
```

## Providers

```ts
import { providers } from 'choliba';

providers.list().map((provider) => provider.id); // ['claude', 'claude-ollama', 'codex', 'cursor']
providers.list().filter((provider) => provider.installed);
providers.preferred; // 'auto', o CHOL_AGENTS_PROVIDER em vigor

const claude = providers.get('claude');
claude.installed; // true: o comando `claude` está no PATH
claude.inAuto; // true: o `auto` pode escolhê-lo
claude.credentials; // [{ name: 'CLAUDE_CODE_OAUTH_TOKEN', set: true }, { name: 'ANTHROPIC_API_KEY', set: false }, …]

providers.get('claude-ollama').needsModel; // true: não tem modelo próprio, roda o que o agente declara
providers.get('codex').installed; // true: o comando `codex` está no PATH
```

| Membro      | Devolve                                                                        |
| ----------- | ------------------------------------------------------------------------------ |
| `list()`    | Cada provider que o choliba conhece, por id                                    |
| `get(id)`   | Um provider. Um id desconhecido falha dizendo os que existem                   |
| `preferred` | A preferência em vigor (`CHOL_AGENTS_PROVIDER`): `auto` ou o id de um provider |

Cada provider tem:

- `id`;
- `installed`: se algum dos comandos dele está no `PATH`;
- `inAuto`: se o `auto` pode escolhê-lo;
- `credentials`: cada variável que o autentica, com `set` (definida no ambiente ou no `.env`). O valor nunca aparece;
- `needsModel`: se ele não tem modelo próprio (o `claude-ollama`), e então a execução pede o primeiro que o agente declara para ele;
- `summary`, o que o `--help` diz dele.

## Agentes

```ts
import { agents } from 'choliba';

agents.dir; // '/home/voce/meu-workspace/.choliba/agents'
agents.list().map((agent) => agent.id); // ['implementer', 'product-owner', 'test-writer']
agents.list().filter((agent) => agent.projectRequired);

const implementer = agents.get('implementer');
implementer.version; // '1.0.3'
implementer.providers; // [{ id: 'claude', models: ['claude-sonnet-5'] }, { id: 'cursor', models: [...] }]
implementer.modes; // ['execute', 'plan', 'ask']

agents.skills('implementer'); // [{ name: 'playwright-cli', description, path, instructions }, ...]
agents.mcps('test-writer'); // [{ name: 'playwright', path, exists: true, tools, instructions }]
agents.provider('implementer')?.id; // 'claude', o provider que o roda
```

| Membro         | Devolve                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------ |
| `dir`          | A pasta dos agentes, absoluta: `CHOL_AGENTS_DIR` (relativo à raiz) ou `.choliba/agents`                      |
| `list()`       | Cada agente que carrega, por id                                                                              |
| `get(id)`      | Um agente validado. Um id desconhecido falha nomeando o `agent.yaml` procurado                               |
| `skills(id)`   | As skills que o agente declara, como uma execução as entrega (com as `instructions` do `agent.yaml`)         |
| `mcps(id)`     | Os MCPs que o agente declara: `name`, `path` (o JSON em `CHOL_MCPS_DIR`), `exists`, `tools` e `instructions` |
| `provider(id)` | O provider que roda o agente, ou `undefined` (abaixo)                                                        |

Cada agente é um `AgentDefinition`, o mesmo tipo que a CLI usa, exportado por `choliba`.

`mcps(id)` não lê o conteúdo do JSON de cada MCP, que pode ter credenciais. Diz só onde ele está e se existe.

`provider(id)` segue a escolha do `choliba run agent` sem `--provider`:

1. `providers.preferred`, quando o agente o declara;
2. em `auto`, o primeiro provider que o agente declara e que está instalado;
3. `undefined` quando nenhum pode rodá-lo (a preferência não é declarada, ou nenhum declarado está instalado).

## Skills

```ts
import { skills } from 'choliba';

skills.dir; // '/home/voce/meu-workspace/.choliba/skills'
skills.list().map((skill) => skill.name);
skills.get('playwright-cli').path; // '…/.choliba/skills/playwright-cli/SKILL.md'
```

| Membro      | Devolve                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------ |
| `dir`       | A pasta das skills, absoluta: `CHOL_SKILLS_DIR` ou `.choliba/skills`                             |
| `list()`    | Cada subpasta com `SKILL.md`, por nome. Um `SKILL.md` sem `description` falha nomeando o arquivo |
| `get(nome)` | Uma skill. Um nome desconhecido falha nomeando o `SKILL.md` procurado                            |

Cada skill é um `SkillSummary` (`name`, `description`, `path`).

## Projetos

```ts
import { projects } from 'choliba';

projects.dir; // '<CHOL_GLOBAL_DIR>/projects'
projects.list(); // [{ name: 'app', description: 'Loja de exemplo' }]

const app = projects.get('app');
app.dir; // '<CHOL_GLOBAL_DIR>/projects/app'
app.settings.environment.nome; // 'local', o ambiente ativo
app.settings.appDir; // o código da aplicação desse ambiente, absoluto
app.settings.config.stack?.language.name; // 'TypeScript', quando um agente já gravou o stack
app.readme; // 'Loja: Uma loja de exemplo.', o resumo do README da aplicação, ou undefined
app.counts; // { tickets: 3, criteria: 12, criteriaWithTests: 9 }
```

`projects.dir` é `CHOL_PROJECTS_DIR` ou, sem ela, `CHOL_GLOBAL_DIR/projects`. Sem `CHOL_GLOBAL_DIR`, os membros de
`projects` falham com o mesmo erro da CLI (`CHOL_GLOBAL_DIR não definida: …`).

| Membro      | Devolve                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------- |
| `list()`    | Cada projeto com a `description` do `config.json`, por nome. São os dados de `choliba list projects` |
| `get(nome)` | Um projeto. Um nome desconhecido falha nomeando o `config.json` procurado                            |

Um projeto tem:

| Membro        | Devolve                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------- |
| `name`, `dir` | O nome e a pasta do projeto                                                                  |
| `settings`    | O `config.json` e o `.env.json` lidos e conferidos como numa execução. Inclui as credenciais |
| `readme`      | O resumo do README da aplicação (no `appDir` do ambiente ativo), ou `undefined`              |
| `counts`      | Quantos tickets, quantos critérios e quantos critérios com teste                             |
| `tickets`     | Os tickets (abaixo)                                                                          |
| `tests`       | `tests.dir`, a pasta `tests/`, e `tests.list()`, os specs dela, também em subpastas          |

`settings` traz `credentials` e `env` com os valores do `.env.json`. Não imprima esses campos.

## Tickets

```ts
import { projects } from 'choliba';

const app = projects.get('app');

app.tickets.list().map((ticket) => `${ticket.id}: ${ticket.title ?? '-'}`);
app.tickets.get('app-1').specs; // ['carrinho.spec.ts'], os specs que cobrem os critérios
app.tickets.get('1'); // o mesmo, pelo sufixo
app.tickets.list().filter((ticket) => ticket.criteria.some((criterion) => criterion.tests.length === 0));
app.tickets.retired(); // [{ ticket: 'app-1', criterion: 'CA-01', by: 'app-4', tests: [...] }]
```

| Membro        | Devolve                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| `list()`      | Cada ticket tipado (`TicketInfo`), pela chave                                                        |
| `get(id)`     | Um ticket, pela chave (`app-1`) ou pelo sufixo (`1`)                                                 |
| `retired()`   | Os critérios que um ticket mais novo substituiu (`substitui`): `ticket`, `criterion`, `by` e `tests` |
| `results(id)` | O resultado da última execução do ticket (abaixo), ou `undefined` se ele nunca rodou                 |

Um `TicketInfo` tem:

- `id`, `type` (o `tipo`) e `title` (o `titulo`);
- `criteria`, em que cada critério tem `id`, `description` e `tests`;
- `specs` e `file`;
- `fields`, com o JSON inteiro, para os campos que o tipo não nomeia (`contexto`, `substitui`…).

Um ticket com um campo do tipo errado falha nomeando o arquivo e o campo.

## Resultados dos testes de um ticket

```ts
import { projects } from 'choliba';

const resultado = projects.get('site').tickets.results('site-1');

if (resultado === undefined) {
  process.stdout.write('site-1 ainda não rodou\n');
} else {
  process.stdout.write(`${resultado.ranAt}: ${resultado.stats.passed} passaram, ${resultado.stats.failed} falharam\n`);
  for (const test of resultado.tests.filter((each) => each.status === 'failed')) {
    process.stdout.write(`✗ ${test.file} › ${test.title}: ${test.error ?? ''}\n`);
  }
  resultado.criteria; // [{ id: 'CA-01', status: 'falhou' }, { id: 'CA-04', status: 'passou' }, ...]
}
```

O resultado vem do relatório que o `choliba run tests` grava em `ticket-runs/<ticket>/playwright-report/`, dentro de
`CHOL_TICKET_RUNS` ou, sem ela, da pasta dos projetos. É o mesmo relatório que os portões `--expect red` e
`--expect green` conferem.

| Membro     | O que é                                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| `ranAt`    | Quando a última execução começou                                                                                 |
| `duration` | Quanto ela durou, em milissegundos                                                                               |
| `stats`    | Quantos testes passaram (`passed`), falharam (`failed`), foram pulados (`skipped`) e foram instáveis (`flaky`)   |
| `tests`    | Cada teste dos critérios: `title`, `file`, `status` (`passed`, `failed`, `skipped`, `flaky`), `device` e `error` |
| `criteria` | Cada critério: `id` e `status` (`sem teste`, `passou`, `falhou`, `não rodou`)                                    |
