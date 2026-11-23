<a id="topo"></a>

# Módulo config: para que ele existe

Um projeto que usa o Choliba tem **um arquivo de configuração**, o `choliba.config.ts`. Ele define o log, o banco, os workspaces (a raiz padrão e os homes isolados deles), onde as rodadas rodam e as variáveis de ambiente.

| Opção        | O que é                                                                                                                                                                              | Sem ela                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `debug`      | grava também os registros de `debug` no log                                                                                                                                          | `false`                                                                                     |
| `logger`     | onde fica o log (`dir`) e qual pacote o escreve (`use`)                                                                                                                              | `.choliba/logs`, em JSONL, sem pacote                                                       |
| `database`   | onde fica o banco SQLite (sessões, decisões, aprovações)                                                                                                                             | `.choliba/choliba.db`                                                                       |
| `workspaces` | a raiz padrão dos workspaces (`dir`) e os homes isolados deles (`homes`)                                                                                                             | `.choliba/workspaces`, `.choliba/homes`                                                     |
| `rounds`     | onde as rodadas rodam (`dir`), fora do projeto, e onde ficam as declarações, fixtures e registros (`definitions`, `fixtures`, `data`); veja o [curso de rounds](../rounds/README.md) | nenhum: a config carrega sem elas, e só os comandos das rodadas as cobram (`requireRounds`) |
| `envs`       | variáveis de ambiente que o projeto usa                                                                                                                                              | nenhuma                                                                                     |

É **dado do projeto**: não é a política de um agente (isso é a `AgentPolicy`, do módulo `policy`) nem o código de nenhum agente. O módulo `config` encontra o arquivo, **confere** o que ele diz, completa com os padrões e entrega o resultado já resolvido, com caminhos absolutos, para quem precisa: o logger, o banco, a tela de aprovações, o agente.

```
choliba.config.ts  ──loadConfig()──▶  ResolvedCholibaConfig  ──getConfig()──▶ logger, store, agente, scripts
   (você escreve)     procura, confere,      (caminhos absolutos,
                      completa               padrões aplicados)
```

## Índice

- [Os arquivos](#os-arquivos)
- [Interface](#interface)
  - [O arquivo: `CholibaConfig`](#o-arquivo-cholibaconfig)
  - [O resultado: `ResolvedCholibaConfig`](#o-resultado-resolvedcholibaconfig)
  - [Funções](#funções)
- [Como funciona](#como-funciona)
  - [Onde o arquivo é procurado](#onde-o-arquivo-é-procurado)
  - [Do arquivo ao resultado](#do-arquivo-ao-resultado)
  - [envs](#envs)
  - [logger.logrotate: como os logs são guardados](#loggerlogrotate-como-os-logs-são-guardados)
  - [Quem carrega a config](#quem-carrega-a-config)
- [Exemplos](#exemplos)
  - [1. Um arquivo e o que ele vira](#1-um-arquivo-e-o-que-ele-vira)
  - [2. Sem arquivo: os padrões](#2-sem-arquivo-os-padrões)
  - [3. envs e uma config que é uma função](#3-envs-e-uma-config-que-é-uma-função)
  - [4. Uma config errada não é ignorada](#4-uma-config-errada-não-é-ignorada)
  - [5. CHOLIBA_DEBUG e CHOLIBA_LOG_DIR](#5-choliba_debug-e-choliba_log_dir)
  - [6. Importar o Choliba já carrega a config](#6-importar-o-choliba-já-carrega-a-config)
  - [7. Homes dos workspaces](#7-homes-dos-workspaces)
- [Regras do módulo](#regras-do-módulo)
- [Exercícios](#exercícios)

## Os arquivos

| Arquivo    | Papel                                                                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts` | O módulo inteiro: os tipos, `defineConfig`, `loadConfig` (procura, importa, confere e resolve), `getConfig`, `getEnv` e o cache. |

[↑ topo](#topo)

## Interface

### O arquivo: `CholibaConfig`

O que você escreve no `choliba.config.ts`, com `defineConfig` para ter os tipos:

```ts
import { defineConfig } from './src/config';

export default defineConfig({
  debug: true, // boolean
  logger: {
    dir: 'storage/logs', // relativo a este arquivo
    use: () => ({ debug() {}, info() {}, warn() {}, error() {} }),
    // como os logs são guardados; sem isso, toda sessão fica, num arquivo só
    logrotate: {
      maxFileSize: '20mb',
      days: 14,
      maxTotalSize: '200mb',
      compress: false,
    },
  },
  database: { dir: 'storage/db', name: 'agentes.db' },
  workspaces: {
    dir: 'storage/workspaces', // a raiz padrão: onde o agente trabalha
    homes: 'storage/homes', // o home da CLI de cada workspace; também aceita ~/...
  },
  envs: [{ API_URL: 'https://api.exemplo.com' }],
});
```

| Tipo                      | Forma                                                                                                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CholibaConfig`           | `{ debug?, logger?, database?, workspaces?, rounds?, envs? }`                                                                                                                                  |
| `CholibaLoggerConfig`     | `{ dir?: string, use?: LoggerFactory }`                                                                                                                                                        |
| `LoggerFactory`           | `(target: { dir, session }) => object`: cria a instância do pacote de log                                                                                                                      |
| `CholibaDatabaseConfig`   | `{ dir?: string, name?: string }`: `name` é só o nome do arquivo, sem barras                                                                                                                   |
| `CholibaWorkspacesConfig` | `{ dir?: string, homes?: string }`: a raiz padrão e a pasta dos homes; relativos ao arquivo ou `~/…`                                                                                           |
| `CholibaRoundsConfig`     | `{ dir?, definitions?, fixtures?, data? }`: onde as rodadas rodam (recusado dentro do projeto) e onde ficam as declarações, os pontos de partida e os registros; relativos ao arquivo ou `~/…` |
| `CholibaEnv`              | `{ [nome]: string \| boolean \| number \| undefined }`                                                                                                                                         |
| `CholibaConfigFactory`    | um `CholibaConfig` ou uma função (até `async`) que o devolve                                                                                                                                   |

### O resultado: `ResolvedCholibaConfig`

O que `loadConfig` e `getConfig` devolvem. Tudo já decidido, com caminhos absolutos; só as pastas das rodadas podem faltar.

| Campo                | Tipo                                                           | O que é                                                                                                 |
| -------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `logger.dir`         | `string`                                                       | diretório do log, absoluto                                                                              |
| `logger.use`         | `LoggerFactory \| undefined`                                   | a fábrica do pacote, se houver                                                                          |
| `logger.logrotate`   | `{ maxFileBytes, days, maxTotalBytes, compress } \| undefined` | como os logs são guardados, com os padrões preenchidos e os tamanhos em bytes; sem a opção, `undefined` |
| `databasePath`       | `string`                                                       | caminho absoluto do arquivo do banco                                                                    |
| `workspaces.dir`     | `string`                                                       | a raiz padrão dos workspaces, absoluta                                                                  |
| `workspaces.homes`   | `string`                                                       | diretório absoluto dos homes, um por workspace                                                          |
| `rounds.dir`         | `string \| undefined`                                          | onde as rodadas rodam, absoluto; `undefined` sem a opção                                                |
| `rounds.definitions` | `string \| undefined`                                          | a pasta das declarações das rodadas, absoluta; `undefined` sem a opção                                  |
| `rounds.fixtures`    | `string \| undefined`                                          | a pasta dos pontos de partida, absoluta; `undefined` sem a opção                                        |
| `rounds.data`        | `string \| undefined`                                          | a pasta dos registros das execuções, absoluta; `undefined` sem a opção                                  |
| `project`            | `string`                                                       | o projeto: a pasta do arquivo de config (ou onde a busca começou)                                       |
| `debug`              | `boolean`                                                      |                                                                                                         |
| `configPath`         | `string \| undefined`                                          | o arquivo lido; `undefined` sem arquivo                                                                 |
| `env`                | `{ vars } \| undefined`                                        | o env ativo: o **primeiro** de `envs`                                                                   |
| `envs`               | `{ vars }[]`                                                   | todos os envs; `vars` tem só os valores de texto                                                        |

### Funções

| Função                                                          | O que faz                                                                                                                         |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `defineConfig(config)`                                          | devolve a config como veio; só serve para os tipos (e acusa opção errada no editor)                                               |
| `loadConfig({ cwd?, path? })`                                   | procura, importa, confere e resolve o arquivo; põe as variáveis do env ativo no processo; guarda em cache                         |
| `getConfig()`                                                   | a config carregada; **sem `loadConfig` antes, os padrões** (não lê o arquivo)                                                     |
| `isConfigLoaded()`                                              | se algum `loadConfig` já terminou                                                                                                 |
| `getEnv()`                                                      | o env ativo; erro de uso se não houver `envs`                                                                                     |
| `clearConfigCache()`                                            | esquece o que foi carregado (para testes e para recarregar)                                                                       |
| `requireRounds(...pastas)`                                      | as pastas das rodadas pedidas (todas, sem argumento), absolutas; faltando alguma, um erro de uso que diz qual e onde configurá-la |
| `env.string/number/boolean/list(nome, { default?, required? })` | lê uma variável de ambiente num arquivo de config; vazia conta como ausente, e `required` sem ela é erro de uso                   |

[↑ topo](#topo)

## Como funciona

### Onde o arquivo é procurado

`loadConfig()` começa no diretório atual (ou em `cwd`) e **sobe** até achar um destes, nesta ordem, em cada diretório:

```
choliba.config.ts   choliba.config.mts   choliba.config.js   choliba.config.mjs
```

Com `path`, usa exatamente esse arquivo (e falha se ele não existir). Sem arquivo nenhum até a raiz do disco, não é erro: valem os padrões.

### Do arquivo ao resultado

1. **Importa** o arquivo e pega o `export default`. Se for uma função, chama (e espera, se for `async`).
2. **Confere**:
   - opção desconhecida é erro, com a dica da opção certa para os enganos comuns (`databasePath` → `database: { dir, name }`, `logDir` → `logger: { dir }`, `env` → `envs`);
   - cada opção com o tipo certo (`debug` boolean, `database.name` sem barras, `envs` array…).
3. **Resolve**:
   - caminhos relativos são relativos **ao arquivo de config**, não ao diretório de onde você rodou; `workspaces.dir` e `workspaces.homes` também aceitam `~/…`;
   - o que faltar recebe o padrão;
   - duas variáveis de ambiente valem mais que o arquivo: `CHOLIBA_DEBUG` (`1`, `true`, `yes`, `on` ou `0`, `false`, `no`, `off`) e `CHOLIBA_LOG_DIR`.
4. **Aplica o env ativo**: as variáveis de texto do primeiro env entram no ambiente do processo, **só as que ainda não existem**.

### envs

`envs` é uma lista, mas **só o primeiro** é o env ativo: é ele que `getEnv()` devolve e que entra no ambiente. Os outros só servem ao logger, que mascara no log os valores de todos.

De cada env, só entram valores de **texto**. Um número, um boolean ou um `undefined` (por exemplo, `process.env.X` de uma variável que não existe) é descartado sem aviso.

### logger.logrotate: como os logs são guardados

Cada execução de um programa abre uma **sessão** de log, gravada em `<logger.dir>/<início>.jsonl`. Sem
`logrotate`, toda sessão fica, num arquivo só. Com ele, o `src/logger` cuida de duas coisas, para o logger padrão e
para o do `use` (desde que ele grave em `dir/<session>.jsonl`, como o pino do exemplo):

| Campo          | Padrão    | O que faz                                                                                                   |
| -------------- | --------- | ----------------------------------------------------------------------------------------------------------- |
| `maxFileSize`  | `'20mb'`  | Limite suave de um arquivo: o registro termina inteiro e o próximo vai para `<início>.2.jsonl`, `.3.jsonl`… |
| `days`         | 14        | Quando uma sessão abre, as sessões mais antigas que isso são apagadas (todas as partes juntas).             |
| `maxTotalSize` | `'200mb'` | Se a pasta passa disso, as sessões mais antigas são apagadas até caber.                                     |
| `compress`     | false     | As sessões encerradas viram `.jsonl.gz` (leia com `zcat` ou `zgrep`).                                       |

Os tamanhos levam a unidade: `'500k'`, `'1024kb'`, `'10m'`, `'20mb'`, `'50M'`, `'1g'`, `'2gb'` (maiúscula ou minúscula, com decimais, como `'1.5mb'`). Um `k` vale 1024 bytes, como no `du -h`. Um número sem unidade é recusado: `20` não diz se são bytes ou megabytes. O campo que você não diz vale o padrão (`src/logger/constants.ts`). A sessão atual nunca é apagada nem compactada, nem a de outro programa ainda gravando, como uma rodada com as páginas abertas: enquanto escreve, cada sessão deixa um `<início>.pid` com o número do processo, e a limpeza só a toca depois que esse processo termina, por mais parada que ela esteja.
Um campo desconhecido (`size`, `dias`) é recusado.

### Quem carrega a config

| Quem                                | Quando                                                                                                                                                         |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| importar o Choliba (`src/index.ts`) | ao importar: `await loadConfig()`, procurando a partir do diretório atual. Por isso, no topo de um arquivo de agente, `process.env` já tem as variáveis do env |
| `runScript` / `runCommand`          | antes de rodar o script, com as opções que receberem                                                                                                           |
| você                                | `loadConfig({ cwd })`, para um outro projeto ou num teste                                                                                                      |

O resultado fica em cache por diretório e arquivo: carregar de novo devolve o mesmo, até `clearConfigCache()`.

[↑ topo](#topo)

## Exemplos

Cada exemplo é um arquivo de `guides/config/exemplos/` que roda como está. Os que precisam de um `choliba.config.ts` criam um projeto temporário, carregam e apagam.

### 1. Um arquivo e o que ele vira

`guides/config/exemplos/1-arquivo.ts`:

```ts
/**
 * Exemplo 1 do curso de config: um choliba.config.ts e o que `loadConfig`
 * devolve. Cria um projeto temporário, carrega e apaga.
 */
import { randomUUID } from 'node:crypto';

import { loadConfig } from '../../../src/config/index';
import { environment } from '../../../src/execute/process';
import {
  ensureDirectory,
  join,
  removePath,
  writeText,
  cholibaCacheDir,
} from '../../../src/filesystem/index';
import { writeOut } from '../../../src/output/stdio';

const project = join(
  cholibaCacheDir(environment()),
  'config-exemplo',
  randomUUID(),
);
ensureDirectory(project);
writeText(
  join(project, 'choliba.config.ts'),
  `export default {
  debug: true,
  logger: { dir: 'storage/logs' },
  database: { dir: 'storage/db', name: 'agentes.db' },
  workspaces: { dir: 'storage/workspaces', homes: 'storage/homes' },
};
`,
);

try {
  const config = await loadConfig({ cwd: project });
  writeOut(
    `${JSON.stringify(config, null, 2).replaceAll(project, '<projeto>')}\n`,
  );
} finally {
  removePath(project);
}
```

Saída real:

```
{
  "logger": {
    "dir": "<projeto>/storage/logs"
  },
  "databasePath": "<projeto>/storage/db/agentes.db",
  "workspaces": {
    "dir": "<projeto>/storage/workspaces",
    "homes": "<projeto>/storage/homes"
  },
  "rounds": {},
  "project": "<projeto>",
  "debug": true,
  "configPath": "<projeto>/choliba.config.ts",
  "envs": []
}
```

- `storage/logs` e `storage/db` ficaram absolutos, **a partir do arquivo de config**.
- `logger.use`, `env` e as pastas das rodadas não aparecem porque são `undefined` (o `JSON.stringify` não mostra
  campos `undefined`): sem `rounds`, a config carrega igual, e só os comandos das rodadas as cobram.

### 2. Sem arquivo: os padrões

`guides/config/exemplos/2-padroes.ts`:

```ts
/**
 * Exemplo 2 do curso de config: sem choliba.config.ts, os padrões. Num
 * diretório sem arquivo de config (nem nos pais), `loadConfig` não falha.
 */
import { randomUUID } from 'node:crypto';

import { loadConfig } from '../../../src/config/index';
import { environment } from '../../../src/execute/process';
import {
  ensureDirectory,
  join,
  removePath,
  cholibaCacheDir,
} from '../../../src/filesystem/index';
import { writeOut } from '../../../src/output/stdio';

const empty = join(
  cholibaCacheDir(environment()),
  'config-exemplo',
  randomUUID(),
);
ensureDirectory(empty);

try {
  const config = await loadConfig({ cwd: empty });
  writeOut(
    `${JSON.stringify(config, null, 2).replaceAll(empty, '<diretório>')}\n`,
  );
} finally {
  removePath(empty);
}
```

Saída real:

```
{
  "logger": {
    "dir": "<diretório>/.choliba/logs"
  },
  "databasePath": "<diretório>/.choliba/choliba.db",
  "workspaces": {
    "dir": "<diretório>/.choliba/workspaces",
    "homes": "<diretório>/.choliba/homes"
  },
  "rounds": {},
  "project": "<diretório>",
  "debug": false,
  "envs": []
}
```

Tudo dentro de `.choliba/`, no diretório onde a busca começou. `configPath` é `undefined`: não havia arquivo.

### 3. envs e uma config que é uma função

`guides/config/exemplos/3-envs.ts`:

```ts
/**
 * Exemplo 3 do curso de config: `envs` e uma config que é uma função. As
 * variáveis do primeiro env entram no ambiente do processo, sem sobrescrever
 * as que já existem; só textos entram.
 */
import { randomUUID } from 'node:crypto';

import { getEnv, loadConfig } from '../../../src/config/index';
import {
  environment,
  setEnvironmentDefault,
} from '../../../src/execute/process';
import {
  ensureDirectory,
  join,
  removePath,
  writeText,
  cholibaCacheDir,
} from '../../../src/filesystem/index';
import { writeOut } from '../../../src/output/stdio';

const project = join(
  cholibaCacheDir(environment()),
  'config-exemplo',
  randomUUID(),
);
ensureDirectory(project);
writeText(
  join(project, 'choliba.config.ts'),
  `// Uma função (pode ser async): roda ao carregar a config.
export default async () => ({
  envs: [
    {
      API_URL: 'https://api.exemplo.com',
      REGION: 'sa-east-1',
      RETRIES: 3,              // número: não vira variável
      TOKEN: undefined,        // ausente: não vira variável
    },
    { API_URL: 'https://outro.exemplo.com' }, // só o primeiro env vale
  ],
});
`,
);

// Já existe no processo antes da config: não é sobrescrita.
setEnvironmentDefault('REGION', 'us-east-1');

try {
  await loadConfig({ cwd: project });
  writeOut(`getEnv().vars: ${JSON.stringify(getEnv().vars)}\n`);
  for (const name of ['API_URL', 'REGION', 'RETRIES', 'TOKEN']) {
    writeOut(`environment().${name} = ${String(environment()[name])}\n`);
  }
} finally {
  removePath(project);
}
```

Saída real:

```
getEnv().vars: {"API_URL":"https://api.exemplo.com","REGION":"sa-east-1"}
environment().API_URL = https://api.exemplo.com
environment().REGION = us-east-1
environment().RETRIES = undefined
environment().TOKEN = undefined
```

| Variável  | No env                    | No processo | Por quê                                          |
| --------- | ------------------------- | ----------- | ------------------------------------------------ |
| `API_URL` | `https://api.exemplo.com` | a mesma     | texto, e não existia                             |
| `REGION`  | `sa-east-1`               | `us-east-1` | já existia no processo: a config não sobrescreve |
| `RETRIES` | —                         | —           | número: descartado                               |
| `TOKEN`   | —                         | —           | `undefined`: descartado                          |

E o `API_URL` do segundo env não apareceu: só o primeiro vale.

### 4. Uma config errada não é ignorada

`guides/config/exemplos/4-erros.ts`:

```ts
/**
 * Exemplo 4 do curso de config: uma config errada não é ignorada. Cada
 * arquivo abaixo falha ao carregar, com a mensagem que o Choliba mostra.
 */
import { randomUUID } from 'node:crypto';

import { clearConfigCache, loadConfig } from '../../../src/config/index';
import { environment } from '../../../src/execute/process';
import {
  ensureDirectory,
  join,
  removePath,
  writeText,
  cholibaCacheDir,
} from '../../../src/filesystem/index';
import { writeOut } from '../../../src/output/stdio';

const wrong = [
  `export default { databasePath: 'dados/choliba.db' };`,
  `export default { logDir: 'logs' };`,
  `export default { debug: 'sim' };`,
  `export default { database: { name: 'dados/choliba.db' } };`,
  `export default { envs: { API_URL: 'x' } };`,
];

for (const source of wrong) {
  const project = join(
    cholibaCacheDir(environment()),
    'config-exemplo',
    randomUUID(),
  );
  ensureDirectory(project);
  writeText(join(project, 'choliba.config.ts'), `${source}\n`);
  clearConfigCache();
  try {
    await loadConfig({ cwd: project });
    writeOut(`${source}\n  carregou (não deveria)\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeOut(`${source}\n  → ${message.replaceAll(project, '<projeto>')}\n`);
  } finally {
    removePath(project);
  }
}
```

Saída real:

```
export default { databasePath: 'dados/choliba.db' };
  → Opção desconhecida "databasePath" em <projeto>/choliba.config.ts. Use database: { dir, name }.
export default { logDir: 'logs' };
  → Opção desconhecida "logDir" em <projeto>/choliba.config.ts. Use logger: { dir }.
export default { debug: 'sim' };
  → debug em <projeto>/choliba.config.ts deve ser um boolean.
export default { database: { name: 'dados/choliba.db' } };
  → database.name em <projeto>/choliba.config.ts deve ser um nome de arquivo, sem barras.
export default { envs: { API_URL: 'x' } };
  → envs em <projeto>/choliba.config.ts deve ser um array.
```

Uma opção com nome errado não fica sem efeito em silêncio: ela impede o carregamento, e os enganos comuns vêm com a opção certa.

### 5. CHOLIBA_DEBUG e CHOLIBA_LOG_DIR

`guides/config/exemplos/5-variaveis.ts`:

```ts
/**
 * Exemplo 5 do curso de config: CHOLIBA_DEBUG e CHOLIBA_LOG_DIR valem mais que
 * o arquivo, sem editá-lo. Rode de três jeitos:
 *
 *   bun guides/config/exemplos/5-variaveis.ts
 *   CHOLIBA_DEBUG=0 bun guides/config/exemplos/5-variaveis.ts
 *   CHOLIBA_LOG_DIR=/tmp/meus-logs bun guides/config/exemplos/5-variaveis.ts
 */
import { randomUUID } from 'node:crypto';

import { loadConfig } from '../../../src/config/index';
import { environment } from '../../../src/execute/process';
import {
  ensureDirectory,
  join,
  removePath,
  writeText,
  cholibaCacheDir,
} from '../../../src/filesystem/index';
import { writeOut } from '../../../src/output/stdio';

const project = join(
  cholibaCacheDir(environment()),
  'config-exemplo',
  randomUUID(),
);
ensureDirectory(project);
writeText(
  join(project, 'choliba.config.ts'),
  `export default { debug: true, logger: { dir: 'logs' } };\n`,
);

try {
  const { debug, logger } = await loadConfig({ cwd: project });
  writeOut(
    `debug: ${String(debug)}, logger.dir: ${logger.dir.replaceAll(project, '<projeto>')}\n`,
  );
} finally {
  removePath(project);
}
```

Saída real, dos três jeitos:

```
$ bun guides/config/exemplos/5-variaveis.ts
debug: true, logger.dir: <projeto>/logs
$ CHOLIBA_DEBUG=0 bun guides/config/exemplos/5-variaveis.ts
debug: false, logger.dir: <projeto>/logs
$ CHOLIBA_LOG_DIR=/tmp/meus-logs bun guides/config/exemplos/5-variaveis.ts
debug: true, logger.dir: /tmp/meus-logs
```

O arquivo diz `debug: true` e `logs`; as variáveis mudam o resultado sem editar o arquivo. Útil para uma execução pontual ou para o CI.

### 6. Importar o Choliba já carrega a config

Com o `choliba.config.ts` deste repositório (o logger é o pino, o banco fica em `storage/db`). `guides/config/exemplos/6-importar.ts`, rodado na raiz:

```ts
/**
 * Exemplo 6 do curso de config: importar o Choliba já carrega o
 * choliba.config.ts do projeto (procurando do diretório atual para cima).
 * Rode na raiz do repositório.
 */
import { getConfig, isConfigLoaded } from '../../../src/index';
import { currentDirectory } from '../../../src/execute/process';
import { writeOut } from '../../../src/output/stdio';

const root = currentDirectory();
const config = getConfig();

writeOut(`isConfigLoaded(): ${String(isConfigLoaded())}\n`);
writeOut(
  `configPath: ${String(config.configPath).replaceAll(root, '<raiz>')}\n`,
);
writeOut(`logger.dir: ${config.logger.dir.replaceAll(root, '<raiz>')}\n`);
writeOut(
  `logger.use: ${config.logger.use === undefined ? 'não' : 'sim (pino)'}\n`,
);
writeOut(`databasePath: ${config.databasePath.replaceAll(root, '<raiz>')}\n`);
writeOut(
  `workspaces.dir: ${config.workspaces.dir.replaceAll(root, '<raiz>')}\n`,
);
writeOut(
  `workspaces.homes: ${config.workspaces.homes.replaceAll(root, '<raiz>')}\n`,
);
writeOut(`debug: ${String(config.debug)}\n`);
writeOut(
  `envs: ${String(config.envs.length)}, variáveis do env ativo: ${Object.keys(config.env?.vars ?? {}).join(', ')}\n`,
);
```

Saída real:

```
isConfigLoaded(): true
configPath: <raiz>/choliba.config.ts
logger.dir: <raiz>/storage/logs
logger.use: sim (pino)
databasePath: <raiz>/storage/db/batata.db
workspaces.dir: <raiz>/storage/workspaces
workspaces.homes: <raiz>/storage/homes
debug: true
envs: 1, variáveis do env ativo: CURSOR_API_KEY, CLAUDE_CODE_OAUTH_TOKEN
```

Nenhuma chamada a `loadConfig`: o import de `src/index` já procurou o arquivo a partir da raiz, carregou e pôs no processo as variáveis do env. É por isso que um agente pode usar `getConfig().workspaces.dir` (a pasta onde ele trabalha) ou `process.env.CURSOR_API_KEY` logo na primeira linha.

[↑ topo](#topo)

### 7. Homes dos workspaces

`workspaces.homes` define onde o Choliba guarda os homes isolados. Cada raiz de workspace recebe um diretório persistente e estável, usado pela CLI para histórico e sessões. O diretório não fica visível dentro do sandbox; no modo `login`, só o arquivo de login do provider entra, em leitura.

`guides/config/exemplos/7-homes.ts`:

```ts
/** Exemplo 7 do curso de config: escolher onde os homes dos workspaces ficam. */
import { randomUUID } from 'node:crypto';

import { loadConfig } from '../../../src/config/index';
import { environment } from '../../../src/execute/process';
import {
  ensureDirectory,
  cholibaCacheDir,
  join,
  removePath,
  writeText,
} from '../../../src/filesystem/index';
import { writeOut } from '../../../src/output/stdio';

const project = join(
  cholibaCacheDir(environment()),
  'config-exemplo',
  randomUUID(),
);
ensureDirectory(project);
writeText(
  join(project, 'choliba.config.ts'),
  `export default { workspaces: { homes: 'storage/homes' } };\n`,
);

try {
  const config = await loadConfig({ cwd: project });
  writeOut(
    `workspaces.homes: ${config.workspaces.homes.replaceAll(project, '<projeto>')}\n`,
  );
} finally {
  removePath(project);
}
```

Saída real:

```text
workspaces.homes: <projeto>/storage/homes
```

O caminho relativo é resolvido a partir de `choliba.config.ts`. Para colocar os homes fora do projeto, use um caminho absoluto ou `~/…`.

[↑ topo](#topo)

## Regras do módulo

**Só o módulo pode:**

- Ler o `choliba.config.ts`. Quem precisa de uma opção pede a `getConfig()`, que já vem conferida e com caminhos absolutos.
- Decidir os padrões (`.choliba/logs`, `.choliba/choliba.db`, `.choliba/workspaces`, `.choliba/homes`, `debug: false`).

**Ninguém deve:**

- **Ler `getConfig()` antes de carregar.** Sem `loadConfig` (ou o import do Choliba), ela devolve os **padrões**, não o arquivo.
- **Contar com o segundo env.** Só o primeiro de `envs` é aplicado.
- **Pôr número ou boolean em `envs` esperando uma variável.** Só texto vira variável; escreva `'3'`, não `3`.
- **Esperar que a config sobrescreva uma variável que já existe.** O ambiente do processo vence.
- **Escrever caminho relativo pensando no diretório de onde roda.** É relativo ao arquivo de config.

[↑ topo](#topo)

## Exercícios

1. **Simples.** Um projeto tem `choliba.config.ts` em `/projeto` com `logger: { dir: 'logs' }`. Você roda um script de dentro de `/projeto/src/scripts`. Qual é o `logger.dir` resolvido, e por quê?

2. **Intermediário.** O `choliba.config.ts` tem `envs: [{ PORT: 3000, HOST: 'localhost' }]`, e o processo já tem `HOST=0.0.0.0`. Depois de `loadConfig()`, quais são `getEnv().vars`, `process.env.PORT` e `process.env.HOST`? O que você mudaria para o `PORT` chegar ao processo?

3. **Difícil.** Um teste chama `loadConfig({ cwd: a })`, depois edita o `choliba.config.ts` de `a` e chama `loadConfig({ cwd: a })` de novo. Seguindo o `cache` de `loadConfig`, o segundo resultado vê a edição? E se entre as duas chamadas houver um `clearConfigCache()`? Por que o import do arquivo leva `?t=<mtime>` na URL?

[↑ topo](#topo)
