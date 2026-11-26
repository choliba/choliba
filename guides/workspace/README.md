<a id="topo"></a>

# Módulo workspace: preparar um ambiente isolado

> Um `Workspace` define a raiz que o agente altera e roda cada comando numa sandbox, com permissões de arquivos, programas visíveis e rede.

Um `Workspace` define a raiz que o agente pode alterar e prepara cada comando para executá-lo dentro de um sandbox. Também reúne as permissões de filesystem, os programas que o agente vê, a fronteira de rede e o acesso declarado pelo provider ao estado da CLI no host. Nada disso depende de agente: qualquer programa roda num workspace (veja o [Exemplo 2](#2-rodar-programas-num-workspace-sem-agente)).

## Índice

- [Os arquivos](#os-arquivos)
- [Interface](#interface)
  - [O que o agente vê: `/home/choliba`](#o-que-o-agente-vê-homecholiba)
  - [Programas visíveis: `programs`](#programas-visíveis-programs)
- [Como funciona](#como-funciona)
- [Exemplos](#exemplos)
  - [1. Homes persistentes e modos de hostState](#1-homes-persistentes-e-modos-de-hoststate)
  - [2. Rodar programas num workspace, sem agente](#2-rodar-programas-num-workspace-sem-agente)
- [Regras do módulo](#regras-do-módulo)
- [Exercícios](#exercícios)

## Os arquivos

| Arquivo                                 | Papel                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `src/workspace/index.ts`                | `Workspace`: valida opções, escolhe sandbox, fixa diretório de trabalho, calcula o home por raiz e encaminha permissões e rede. |
| `src/workspace/sandbox/types.ts`        | Contratos de `Sandbox` e da saída de rede.                                                                                      |
| `src/workspace/sandbox/bubblewrap.ts`   | Montagens, jaula persistente e comandos que entram com `nsenter`.                                                               |
| `src/workspace/sandbox/docker.ts`       | Contêineres, montagens, ambiente e rede do Docker.                                                                              |
| `src/workspace/sandbox/host-access.ts`  | Traduz o contrato do provider e `hostState` em home, credenciais, ambiente e caminhos visíveis.                                 |
| `src/workspace/sandbox/host-state.ts`   | Caminhos genéricos de estado que o sandbox compartilha quando não recebe um contrato de host.                                   |
| `src/workspace/sandbox/path-map.ts`     | `SandboxPaths`: onde o sandbox vê cada caminho do host (a raiz em `/home/choliba`, o resto de `/home` em `/opt/choliba`).       |
| `src/workspace/sandbox/programs.ts`     | Os programas visíveis: acha cada nome no `PATH` como o sandbox, a base e as pastas de programas que o sandbox esvazia.          |
| `src/workspace/sandbox/protect.ts`      | `protectedMasks`: as máscaras somente leitura dos caminhos protegidos; um caminho que não existe não tem o que proteger.        |
| `src/workspace/sandbox/wrap-command.ts` | `wrapCommand`: põe o comando atrás do lançador da sandbox, com os argumentos dele.                                              |
| `src/workspace/sandbox/debug.ts`        | `logSandbox`: grava no log (em `debug`) o comando que a sandbox roda.                                                           |
| `src/workspace/sandbox/index.ts`        | O que o resto do Choliba importa das sandboxes: `BubblewrapSandbox`, `DockerSandbox` e o tipo `Sandbox`.                        |
| `src/workspace/constants.ts`            | Os valores do workspace: `AGENT_ROOT`, `DEFAULT_DOCKER_IMAGE`, as pastas de programas e a base que sempre aparece.              |

[↑ topo](#topo)

## Interface

Do pacote (`choliba`) vêm o `Workspace`, os tipos `WorkspaceOptions` e `WorkspaceType`, as duas sandboxes
(`BubblewrapSandbox`, `DockerSandbox`), o `SandboxPaths`, o `AGENT_ROOT` e o `DEFAULT_DOCKER_IMAGE`.

| Exportação                                     | O que faz                                                                                                                                                         |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Workspace`                                    | Representa a raiz e o sandbox escolhido (`bubblewrap` ou `docker`).                                                                                               |
| `WorkspaceOptions`                             | Recebe `type` (`bubblewrap` ou `docker`; outro é recusado), `root`, caminhos graváveis, portas, imagem do Docker, `hostState`, `homes`, `agentRoot` e `programs`. |
| `Workspace.programs`                           | Os programas que o agente vê: a opção `programs` ou, sem ela, `workspaces.programs` da config; `undefined`: todos os do host.                                     |
| `Workspace.checkPrograms(names?, searchPath?)` | Diz quais programas (os de `programs`, por padrão) o sandbox acha no `PATH` e onde: `{ found: [{ name, path, file }], missing }`. Não roda nada.                  |
| `Workspace.homes`                              | A pasta dos homes: a opção `homes` ou, sem ela, `workspaces.homes` da config.                                                                                     |
| `Workspace.home()`                             | Retorna o home persistente daquela raiz em `homes`; raízes iguais produzem o mesmo caminho.                                                                       |
| `Workspace.paths`                              | O `SandboxPaths` do workspace: `paths.inside(caminho)` diz onde o sandbox vê um caminho do host.                                                                  |
| `Workspace.applyPermissions(policy, network?)` | Compila as permissões de filesystem e, com `network`, monta a fronteira de rede com as regras da política (`networkRulesOf`).                                     |
| `Workspace.configureNetwork(boundary)`         | Liga uma fronteira de rede montada à mão (`NetworkBoundary`): o sandbox fica sem rede própria. Um sandbox que não sabe isolar a rede recusa.                      |
| `Workspace.useHost(host)`                      | Passa ao sandbox o conjunto já calculado de montagens e variáveis.                                                                                                |
| `Workspace.protect(paths)`                     | Mantém arquivos de configuração e hooks somente para leitura.                                                                                                     |
| `Workspace.prepare(command)`                   | Prepara o comando com o diretório de trabalho da raiz, criando a raiz se ela não existir.                                                                         |
| `Workspace.close()`                            | Encerra sandbox e rede.                                                                                                                                           |

`hostState` aceita três valores. `login` é o padrão: a CLI ganha um home por workspace e somente seu arquivo de login entra, montado para leitura. `none` não compartilha arquivos de login e exige uma variável de credencial declarada pelo provider; um provider local sem credenciais continua válido. `share` entrega o estado do provider no host, gravável, incluindo o histórico de outras raízes.

**Sem agente, não há `hostState`.** Quem aplica o modo é o agente: ele passa ao sandbox (`useHost`) só o que o provider
pede do host. Um `Workspace` usado sozinho, como no [Exemplo 2](#2-rodar-programas-num-workspace-sem-agente), não passa
por isso: o sandbox monta **graváveis** as pastas de estado do host (`~/.config`, `~/.cache` com o `~/.cache/choliba`,
`~/.local/share`, `~/.cursor`, `~/.codex`, `~/.claude` e `~/.claude.json`, em `sandbox/host-state.ts`) e repassa o
ambiente inteiro de quem roda o programa. Um programa nesse workspace lê, por exemplo, o arquivo de login da CLI e grava
no cache do host.

Com `type: 'docker'`, a opção `image` diz de onde vem a imagem: `FROM nome:tag` baixa a imagem do registro (o Docker
Hub) quando ela falta na máquina, e `nome:tag` sozinho usa uma imagem construída na máquina, sem nunca baixar (sem
`image`, vale o `DEFAULT_DOCKER_IMAGE`).

O diretório dos homes é a opção `homes` do `Workspace`; sem ela, vale `workspaces.homes` do `choliba.config.ts`, cujo padrão é `.choliba/homes`. O diretório que contém todos os homes fica oculto dentro do sandbox se estiver dentro da raiz do workspace.

### O que o agente vê: `/home/choliba`

Nas duas sandboxes, a raiz do workspace aparece em **`/home/choliba`** (a opção `agentRoot`, uma pasta direto em
`/home`), e é o diretório de trabalho: `pwd` mostra `/home/choliba`. É a única coisa em `/home`: os homes do host não
existem lá dentro, nem a pasta de onde a raiz veio. `/usr`, `/etc` e as outras pastas do sistema continuam onde estão,
somente leitura.

O que o agente precisa dos homes do host vai para `/opt/choliba`:

| No host                                                                        | No sandbox            |
| ------------------------------------------------------------------------------ | --------------------- |
| a raiz do workspace                                                            | `/home/choliba`       |
| o home do workspace (o da CLI)                                                 | `/opt/choliba/home`   |
| o home de quem roda o Choliba (`~/.bun`, `~/.local/bin`, `~/.cache/choliba/…`) | `/opt/choliba/user`   |
| qualquer outro caminho em `/home`                                              | `/opt/choliba/host/…` |

Só aparecem ali as pastas montadas (as ferramentas, o estado da CLI, o gate), nunca o home inteiro. O Choliba traduz
para esses caminhos tudo o que entrega ao sandbox: o comando e os argumentos, as variáveis (`HOME`, `PATH`, `XDG_*`),
o hook do gate e o servidor das ferramentas gravados na configuração da CLI. O executável da CLI que é um link para o
home (`~/.local/bin/claude`) entra pelo caminho real. Um link **absoluto** para dentro de `/home` que o agente siga por
conta própria (outra ferramenta em `~/.local/bin`) não funciona lá dentro: o destino não existe.

No Docker, `/home` e `/opt` são tmpfs vazios (as entradas do `/opt` do host voltam, uma a uma, somente leitura): o `/`
do host é somente leitura, e o Docker não consegue criar pontos de montagem nele. Por isso o workspace Docker precisa
da pasta `/opt` no host.

Num workspace de agente, o cache do Choliba (`~/.cache/choliba`) também fica fora do sandbox, em qualquer `hostState`: lá ficam os gates dos outros agentes e homes antigos de CLIs. Do cache, o sandbox vê só o que é do próprio agente: o diretório do gate de execução, somente leitura, e o da saída de rede. Num `Workspace` sozinho, o cache entra com o resto do `~/.cache`, gravável.

### Programas visíveis: `programs`

Sem `programs`, o agente vê todos os programas instalados no host (as pastas do sistema, somente leitura). Com
`programs`, ele vê **só os escolhidos**, mesmo que haja outros instalados:

```ts
new Workspace({ type: 'bubblewrap', root, programs: ['php', 'composer'] });
```

- A lista tem **nomes de executáveis**, como se roda no shell: `php`, não `/usr/bin/php` nem o pacote `php-cli`. O
  Choliba não instala nada: o programa precisa estar no host, numa pasta do `PATH`.
- As pastas de programas viram vazias lá dentro: `/usr/bin`, `/usr/sbin`, `/usr/local/bin`, `/usr/local/sbin`,
  `~/.local/bin`, `~/.bun/bin` e cada pasta do `PATH`. Cada programa visível volta, somente leitura, onde o `PATH` o
  acha, montado do arquivo final do link (`/usr/bin/php` → `php8.5`).
- Além dos escolhidos, uma **base** sempre aparece: o que o próprio Choliba roda lá dentro (`env`, `cat` e, no Docker,
  `setpriv`), o shell (`sh`, `bash`) e o runtime do Choliba. Nada mais: `ls`, `grep`, `git` e os outros só aparecem se
  estiverem na lista. A CLI do provider entra pela pasta de instalação dela, como sem `programs`.
- Um escolhido que não existe para o sandbox **antes** de ele subir, com um `UsageError` que diz o que falta. Nenhum
  agente é chamado.
- O resto do sistema fica como está: bibliotecas (`/usr/lib`), `/usr/share`, `/etc`. Um executável fora das pastas de
  programas (dentro de `/usr/lib`, por exemplo) ainda roda pelo caminho absoluto, e a raiz é gravável: `programs` decide
  o que o agente acha, não é uma trava contra quem procura.

Sem a opção, vale `workspaces.programs` do `choliba.config.ts` (veja o [curso de config](../config/README.md)). Uma
lista vazia (`programs: []`) mostra só a base.

[↑ topo](#topo)

## Como funciona

1. `Workspace` valida a raiz e `hostState`, depois cria o sandbox adequado.
2. `home()` calcula um identificador estável a partir do caminho resolvido da raiz. O home guarda sessões e configuração da CLI entre execuções.
3. O agente consulta `provider.hostAccess()` e prepara o acesso conforme `hostState`. O sandbox recebe o resultado por `useHost`. Sem agente, ninguém chama `useHost`, e o sandbox monta as pastas de estado do host.
4. O agente passa as permissões, os caminhos protegidos e a rede por operações de `Workspace`.
   Com `programs`, o sandbox confere os programas ao subir (antes de qualquer comando) e esvazia as pastas de programas.
5. `prepare` define `cwd` como a raiz e delega ao sandbox, que traduz o comando para os caminhos de dentro
   (`SandboxPaths`). `close` encerra os recursos.

Claude recebe `CLAUDE_CONFIG_DIR` apontando para `.claude` no home isolado; Codex recebe `CODEX_HOME` apontando para `.codex`. Com `share` e o gate de execução, o Codex roda com um `CODEX_HOME` próprio, `.codex-share` no home do workspace: o hook do gate e as regras da política ficam ali, somente leitura, e o resto (sessões, login, configuração) são links para o `~/.codex` do host, apontando para onde o sandbox o vê (`/opt/choliba/user/.codex`). Nada do Choliba é gravado no `~/.codex`. O home do workspace é montado também em `share`, mas o `HOME` continua o do host (visto em `/opt/choliba/user`).

[↑ topo](#topo)

## Exemplos

### 1. Homes persistentes e modos de hostState

O exemplo cria workspaces sem iniciar uma CLI ou sandbox. Mostra que o padrão é `login`, que cada raiz ganha um home estável e que a escolha de `hostState` fica nas opções.

`guides/workspace/exemplos/1-homes.ts`:

```ts
/** Exemplo 1 do curso de workspace: homes persistentes e hostState. */
import { writeOut } from '../../../src/output/stdio';
import { Workspace } from '../../../src/workspace/index';

const root = '/workspace/app';
const login = new Workspace({ type: 'bubblewrap', root });
const sameRoot = new Workspace({
  type: 'bubblewrap',
  root: '/workspace/./app',
});
const isolated = new Workspace({
  type: 'bubblewrap',
  root,
  hostState: 'none',
});
const shared = new Workspace({
  type: 'bubblewrap',
  root,
  hostState: 'share',
});

writeOut(`hostState padrão: ${login.hostState}\n`);
writeOut(`home: ${login.home().replace(login.homes, '<homes>')}\n`);
writeOut(
  `mesma raiz, mesmo home: ${String(login.home() === sameRoot.home())}\n`,
);
writeOut(`hostState sem login: ${isolated.hostState}\n`);
writeOut(`hostState compartilhado: ${shared.hostState}\n`);
```

```text
hostState padrão: login
home: <homes>/af7e243d70b1613d
mesma raiz, mesmo home: true
hostState sem login: none
hostState compartilhado: share
```

O nome do diretório é um hash da raiz resolvida; o mesmo caminho normalizado sempre resulta no mesmo home. O diretório de todos os homes é ocultado dentro do sandbox quando está sob a raiz do projeto.

### 2. Rodar programas num workspace, sem agente

Um workspace serve a qualquer programa, não só a um agente. O exemplo cria um workspace, roda `pwd` dentro dele, depois
cria outro que mostra só o `php` e roda o `php` lá dentro. Cada comando passa por `workspace.prepare`, que o embrulha na
sandbox, e pelo `Executor`, que o roda (veja o [curso de execute](../execute/README.md)). Precisa do bubblewrap e do
`php` instalado no host.

`guides/workspace/exemplos/2-programas.ts`:

```ts
/**
 * Exemplo 2 do curso de workspace: rodar programas dentro de um workspace,
 * sem agente nenhum. Cria um workspace, roda `pwd` dentro dele, depois um
 * workspace que mostra só o programa escolhido (`programs`) e roda esse
 * programa lá dentro. Precisa do bubblewrap e do php instalado no host; rode
 * na raiz do repositório.
 */
import { Executor, ProgramExecutionError } from '../../../src/execute/index';
import { currentDirectory } from '../../../src/execute/process';
import type { ProgramCommand } from '../../../src/execute/types';
import { join } from '../../../src/filesystem/index';
import { writeOut } from '../../../src/output/stdio';
import { Workspace } from '../../../src/workspace/index';

// A raiz do workspace: uma pasta qualquer do host (criada se não existir).
const root = join(currentDirectory(), '.choliba/exemplo-programas');

/** Roda `command` dentro de `workspace` e mostra o que ele imprime. */
async function runInside(
  workspace: Workspace,
  command: ProgramCommand,
): Promise<void> {
  const label = [command.executable, ...(command.arguments ?? [])].join(' ');
  writeOut(`$ ${label}\n`);
  try {
    for await (const { chunk } of new Executor().run(
      await workspace.prepare(command),
    )) {
      writeOut(chunk);
    }
  } catch (error) {
    const code =
      error instanceof ProgramExecutionError
        ? ` (código ${String(error.code)})`
        : '';
    writeOut(`falhou${code}\n`);
  }
}

// 1. Um workspace sem `programs`: o agente veria todos os programas do host.
const workspace = new Workspace({ type: 'bubblewrap', root });
try {
  await runInside(workspace, { executable: 'pwd' });
} finally {
  await workspace.close();
}

// 2. Um workspace que mostra só o php (mais a base: env, cat, sh, bash e o
// runtime do Choliba).
const onlyPhp = new Workspace({ type: 'bubblewrap', root, programs: ['php'] });
const { found, missing } = onlyPhp.checkPrograms();
writeOut(
  `\nprograms: ${found.map(({ name, path }) => `${name} em ${path}`).join(', ')}; faltando: ${missing.length}\n`,
);
try {
  await runInside(onlyPhp, {
    executable: 'php',
    arguments: [
      '-r',
      'echo getcwd(), " com PHP ", PHP_MAJOR_VERSION, PHP_EOL;',
    ],
  });
  // O que existe em /usr/bin lá dentro (o `echo` do bash, sem o `ls`).
  await runInside(onlyPhp, {
    executable: 'bash',
    arguments: ['-c', 'echo /usr/bin/*'],
  });
  // Instalado no host, mas não escolhido: lá dentro ele não existe.
  await runInside(onlyPhp, {
    executable: 'bash',
    arguments: ['-c', 'git --version'],
  });
} finally {
  await onlyPhp.close();
}
```

Saída real:

```text
$ pwd
/home/choliba

programs: php em /usr/bin/php; faltando: 0
$ php -r echo getcwd(), " com PHP ", PHP_MAJOR_VERSION, PHP_EOL;
/home/choliba com PHP 8
$ bash -c echo /usr/bin/*
/usr/bin/bash /usr/bin/cat /usr/bin/env /usr/bin/php /usr/bin/sh
$ bash -c git --version
bash: line 1: git: command not found
falhou (código 127)
```

- `pwd` mostra `/home/choliba`: a raiz do workspace (`.choliba/exemplo-programas`, no host) aparece ali, e é o
  diretório de trabalho.
- `checkPrograms` achou o `php` sem rodar nada.
- No segundo workspace, `/usr/bin` tem só o `php` e a base. O `git` está instalado no host, mas não foi escolhido: lá
  dentro ele não existe. Com `type: 'docker'` a saída é a mesma, com `setpriv` a mais na base.
- Os dois workspaces não têm agente, então não há `hostState`: os programas lá dentro veem e gravam as pastas de estado
  do host (veja a [Interface](#interface)).

[↑ topo](#topo)

## Regras do módulo

- Só `Workspace` escolhe e configura `DockerSandbox` ou `BubblewrapSandbox`.
- Quem usa workspace passa política, caminhos protegidos, host e rede por suas operações; não monta esses limites à mão no comando do agente.
- A raiz não pode ser vazia nem `/`.
- Lá dentro, a raiz é `agentRoot` (`/home/choliba`) e `/home` não tem mais nada; o que vai para o sandbox passa por
  `SandboxPaths`, nunca com o caminho do host.
- O provider descreve o que precisa do host; `Workspace` aplica somente a parte permitida pelo `hostState` escolhido.
- Configure filesystem, host e rede antes de iniciar a jaula Bubblewrap.
- `programs` lista nomes de executáveis; o Choliba nunca instala nem copia programas, só escolhe quais o sandbox mostra.

[↑ topo](#topo)

## Exercícios

1. Crie dois workspaces com raízes equivalentes após normalização. Compare `home()` e explique por que a sessão da CLI pode continuar entre execuções.
2. Escolha `hostState: 'none'` para um provider de nuvem. Quais variáveis declaradas pelo provider precisam estar configuradas?
3. Compare o que entra no sandbox em `login` e `share`. Que dado de outros projetos passa a ficar disponível em `share`?
4. Rode o Exemplo 2 com `programs: ['php', 'ls']` e depois com `programs: ['composer']`. O que muda em `/usr/bin`, e em que momento o segundo para?

[↑ topo](#topo)
