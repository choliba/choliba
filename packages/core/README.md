# `@choliba/core`

> A base de linha de comando do choliba: comandos, acesso ao processo, ajuda, terminal e cores, para a sua CLI.

## Índice

- [O que é](#o-que-é)
- [Instalar](#instalar)
- [Exemplo simples de uso](#exemplo-simples-de-uso)
- [`shell`](#shell)
  - [`createShell`](#createshell)
  - [`ShellModule`](#shellmodule)
  - [`ShellCommand`](#shellcommand)
  - [`ShellRoot`](#shellroot)
  - [`ShellIo`](#shellio)
  - [`Container` e `token`](#container-e-token)
- [`platform`](#platform)
  - [A interface `Platform`](#a-interface-platform)
  - [`takeGlobalFlags`](#takeglobalflags)
  - [`rawArgsAfter`](#rawargsafter)
  - [`createSpawnGitRunner`](#createspawngitrunner)
  - [`createBunProcessSpawner`](#createbunprocessspawner)
- [`help`](#help)
  - [`CommandSpec`](#commandspec)
  - [`formatHelp`](#formathelp)
  - [`complete`](#complete)
- [`terminal`](#terminal)
  - [`ProcessRunnerService` e `Session`](#processrunnerservice-e-session)
  - [`Table`, `th` e `td`](#table-th-e-td)
  - [`frameTop`, `frameLines` e `frameBottom`](#frametop-framelines-e-framebottom)
  - [`LiveRegion`](#liveregion)
  - [`StatusFooter`](#statusfooter)
  - [`openOpenTuiPanel`](#openopentuipanel)
  - [`visibleWidth` e `wrapVisible`](#visiblewidth-e-wrapvisible)
- [`theme`](#theme)
  - [`paintAnsi` e `boldAnsi`](#paintansi-e-boldansi)
  - [`colorEnabled`](#colorenabled)
- [Configuração](#configuração)
- [`testing`](#testing)
  - [`runShell`](#runshell)
  - [`fakePlatform`](#fakeplatform)
  - [`BufferWritable`](#bufferwritable)
  - [`replace`](#replace)
  - [`FakeSignals`](#fakesignals)
- [O que ainda não é independente](#o-que-ainda-não-é-independente)

<!-- #region guia -->

## O que é

O `core` é a base de linha de comando do choliba: o que lê a linha de comando e roda o comando pedido, o acesso ao
processo (um valor que os testes trocam por um falso), o `--help` e o autocomplete, o terminal (processos, tabelas,
quadros, o painel) e as cores. O objetivo do pacote é ter só o que funciona sozinho, sem os agentes, os projetos ou o
Playwright. Hoje isso ainda não vale para tudo: a [auditoria](#o-que-ainda-não-é-independente) no fim desta página
diz, export por export, o que já funciona fora do choliba e o que ainda depende dele.

Este guia mostra como instalar o `core`, um exemplo simples de uso e, módulo por módulo, o que cada export é, para que
serve e como usá-lo.

## Instalar

O `core` não é publicado sozinho: ele vem dentro do pacote `choliba`, no subcaminho `choliba/core`. O pacote é
distribuído como o `.tgz` da pre-release `v0.0.1-dev`. Você precisa do [Bun](https://bun.sh).

```sh
bun add https://github.com/choliba/choliba/releases/download/v0.0.1-dev/choliba-0.0.1-dev.tgz
```

O que você importa:

| Import                 | O que tem                                                               |
| ---------------------- | ----------------------------------------------------------------------- |
| `choliba/core`         | os comandos, o acesso ao processo, a ajuda, o terminal e as cores       |
| `choliba/core/testing` | os falsos para testar uma CLI: plataforma, saída em memória, `runShell` |

O pacote traz o choliba inteiro, com o Playwright, o ESLint e o TypeScript entre as dependências. Ele também declara
um `postinstall` (`choliba setup`), que prepara uma pasta de trabalho do choliba. O Bun bloqueia esse script por
padrão. Se você só quer o `core`, deixe-o bloqueado: nada do que está nesta página depende dele.

## Exemplo simples de uso

Você vai montar a CLI `ola`, com um comando que cumprimenta alguém, `--help` e `--version`.

1. Crie `ola.ts` com o módulo da CLI. Um `ShellModule` diz o que a raiz da CLI mostra (`root`) e quais comandos ela
   tem (`commands`). O comando lê os argumentos pelo `io` e escreve por ele.

   <!-- exemplo: ola.ts -->

   <!-- prettier-ignore -->
   ```ts
   import type { CommandSpec, ShellModule } from 'choliba/core';

   const OLA_SPEC: CommandSpec = {
     usage: 'ola ola [NOME]',
     description: 'Cumprimenta alguém.',
     flags: [{ name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true }],
   };

   export const olaModule: ShellModule = {
     name: 'ola',
     root: {
       spec: { usage: 'ola COMMAND [ARGS]', description: 'Uma CLI de exemplo.' },
       version: () => 'ola 1.0.0',
     },
     commands: [
       {
         name: 'ola',
         help: () => [{ name: 'ola', description: 'Cumprimenta alguém', group: 'Commands', spec: OLA_SPEC }],
         run: (_container, io) => {
           const args = io.args('ola');
           if (io.wantsHelp(args)) {
             io.printHelp(OLA_SPEC);
             return Promise.resolve();
           }
           const [nome = 'mundo'] = args;
           io.write(`Olá, ${nome}!\n`);
           return Promise.resolve();
         },
       },
     ],
   };
   ```

2. Crie `main.ts`, que monta a plataforma com o processo e o Bun e roda a CLI. É o único arquivo que lê `process`
   e `Bun`; o resto recebe a plataforma pronta.

   <!-- exemplo-instalado: main.ts -->

   ```ts
   import { createBunProcessSpawner, createShell, createSpawnGitRunner, takeGlobalFlags, type BunSpawnFn, type Platform } from 'choliba/core';

   import { olaModule } from './ola';

   const { argv, noColorFlag } = takeGlobalFlags(process.argv.slice(2));

   const platform: Platform = {
     argv,
     cwd: process.cwd(),
     env: process.env,
     stdout: process.stdout,
     stderr: process.stderr,
     clock: () => new Date(),
     signals: process,
     spawn: createBunProcessSpawner(Bun.spawn as unknown as BunSpawnFn),
     which: (bin) => Bun.which(bin),
     git: createSpawnGitRunner(),
     noColorFlag,
   };

   process.exitCode = await createShell(platform, [olaModule]).run();
   ```

3. Rode:

   ```sh
   bun main.ts ola Ana
   ```

   <!-- saida: ola Ana -->

   ```text
   Olá, Ana!
   ```

   ```sh
   bun main.ts --help
   ```

   <!-- saida: --help -->

   ```text
   Usage:  ola COMMAND [ARGS]

   Uma CLI de exemplo.

   Commands:
     ola   Cumprimenta alguém
   ```

   Uma palavra que não é comando dá erro de uso, com código de saída 1:

   ```sh
   bun main.ts nada
   ```

   <!-- saida: nada -->

   ```text
   comando desconhecido: nada.
   Run 'ola --help' for usage.
   ```

Para testar a `ola` sem rodar um processo, veja [`runShell`](#runshell).

## `shell`

Os comandos da CLI: ler a linha de comando, achar o comando que ela pede e rodá-lo, com os serviços de que ele
precisa.

### `createShell`

**O que é.** A função que monta a CLI a partir de uma plataforma e de uma lista de módulos.

**Para que serve.** Para ter uma CLI pronta sem escrever o tratamento da linha de comando. Com uma `root` em algum
módulo, a CLI já responde a `--help`, `help <comando>`, `--version` e ao autocomplete, e uma palavra desconhecida vira
erro de uso com código 1.

**Como usar.** `await createShell(platform, [olaModule]).run()` roda a linha de comando da plataforma e devolve o código
de saída, como no `main.ts` do [exemplo simples](#exemplo-simples-de-uso). Os módulos entram na ordem dada.

### `ShellModule`

**O que é.** O que um módulo acrescenta à CLI: `name`, os comandos (`commands`), os serviços (`provide`) e, em um só
módulo da CLI, a raiz (`root`).

**Para que serve.** Para dividir a CLI em partes que não se conhecem: cada parte exporta o seu módulo, e o `main.ts`
só os lista. Um comando novo entra no módulo dele, sem mexer nos outros.

**Como usar.** O `olaModule` do [exemplo simples](#exemplo-simples-de-uso) é um módulo com raiz e um comando; o
`relogioModule` de [`Container` e `token`](#container-e-token) é um módulo com um serviço e um comando, sem raiz.

### `ShellCommand`

**O que é.** Um comando: a palavra que o roda (`name`), outras palavras que também o rodam (`aliases`), as entradas do
`--help` (`help`) e o que ele faz (`run`). Com `verb`, ele é a segunda palavra de um verbo da raiz, como `list` em
`list projects`.

**Para que serve.** Para descrever um comando num lugar só: a palavra, a ajuda e o comportamento.

**Como usar.** `run(container, io)` recebe o container, de onde pede os serviços, e o `io`, por onde lê os argumentos
e escreve. Ele devolve uma `Promise`; o código de saída é o que o `io` registrou.

### `ShellRoot`

**O que é.** A raiz da CLI: o `spec` (o uso e a descrição do programa), a linha do `--version` (`version`), os verbos
(`verbs`) e a ordem das seções do `--help` (`groups`, `order`).

**Para que serve.** Para a CLI responder ao que não é comando: a linha vazia, `--help`, `--version` e o autocomplete.
Sem raiz, a CLI só roda os comandos.

**Como usar.** Ponha `root` em um só módulo, como no `olaModule`:
`root: { spec: { usage: 'ola COMMAND [ARGS]' }, version: () => 'ola 1.0.0' }`.

### `ShellIo`

**O que é.** O que um comando lê e escreve: os argumentos, a saída, as mensagens e o código de saída.

**Para que serve.** Para o comando não tocar em `process`: ele escreve pelo `io`, e o mesmo código roda no terminal e
num teste.

**Como usar.** No `run` do comando:

| Método                          | O que faz                                                           |
| ------------------------------- | ------------------------------------------------------------------- |
| `args(...palavras)`             | Os argumentos depois das palavras do comando, como foram digitados. |
| `wantsHelp(args)`               | Se os argumentos pedem a ajuda (`--help`, `-h`).                    |
| `printHelp(spec)`               | Escreve o `--help` do comando no stdout.                            |
| `write(texto)`                  | Escreve o resultado no stdout.                                      |
| `warn(mensagem)`                | Escreve um aviso no stderr, sem mudar o código de saída.            |
| `fail(mensagem)`                | Escreve o erro no stderr; código de saída 1.                        |
| `usageError(mensagem, comando)` | Erro de uso: a mensagem e onde ler a ajuda; código de saída 1.      |
| `exit(código)`                  | Usa o código de saída de outro processo que o comando rodou.        |

### `Container` e `token`

**O que é.** Onde ficam os serviços da CLI. Cada serviço tem um token (`token<T>('nome')`) e uma fábrica, e só é
construído na primeira vez que alguém o pede. `PLATFORM` é o token da plataforma, que `createShell` registra.

**Para que serve.** Para um comando pedir o que precisa sem construí-lo, e para um teste trocar qualquer serviço por um
falso (veja [`replace`](#replace)).

**Como usar.** O módulo registra o serviço no `provide`, com `container.provide`, e o comando o pede no `run`, com
`container.get`. Aqui o serviço é o relógio, tirado da plataforma:

<!-- exemplo: relogio.ts -->

<!-- prettier-ignore -->
```ts
import { PLATFORM, token, type Clock, type ShellModule } from 'choliba/core';

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
```

`agora` escreve a hora do relógio da plataforma:

<!-- saida: agora -->

```text
2026-01-02T03:04:05.000Z
```

## `platform`

O acesso ao processo: tudo o que uma CLI lê dele, reunido num valor que os testes trocam por um falso.

### A interface `Platform`

**O que é.** A interface com a linha de comando (`argv`), a pasta (`cwd`), o ambiente (`env`), a saída (`stdout`,
`stderr`), o relógio (`clock`), os sinais (`signals`), a criação de processos (`spawn`), a busca de executáveis
(`which`), o `git` e, quando há terminal, as perguntas (`ask`, `askSecret`) ou, quando não há, o que chegou pelo stdin
(`readStdin`).

**Para que serve.** Para nenhum comando ler `process` nem `Bun` direto. Só o `main.ts` monta a plataforma real; os
comandos usam a que receberem, e os testes dão uma falsa ([`fakePlatform`](#fakeplatform)).

**Como usar.** O `main.ts` do [exemplo simples](#exemplo-simples-de-uso) monta a real. Num serviço, peça-a ao
container: `container.get(PLATFORM)`.

### `takeGlobalFlags`

**O que é.** A função que tira o `--no-color` da linha de comando e diz se ele estava lá. O que vem depois de `--` fica
como está.

**Para que serve.** Para o `--no-color` valer em qualquer posição e para qualquer comando, sem que cada comando o
trate.

**Como usar.** No `main.ts`, antes de montar a plataforma:

<!-- exemplo: linha.ts -->

<!-- prettier-ignore -->
```ts
import { takeGlobalFlags } from 'choliba/core';

/** A linha de comando sem o `--no-color`, e se ele estava lá. */
export function lerLinha(argv: readonly string[]): string {
  const { argv: resto, noColorFlag } = takeGlobalFlags(argv);
  return `${resto.join(' ')} (cor: ${noColorFlag ? 'não' : 'sim'})`;
}
```

`lerLinha(['ola', '--no-color', 'Ana'])` devolve:

<!-- saida: lerLinha(['ola', '--no-color', 'Ana']) -->

```text
ola Ana (cor: não)
```

### `rawArgsAfter`

**O que é.** A função que devolve os argumentos depois das palavras do comando, exatamente como foram digitados.

**Para que serve.** Para o comando ler as próprias opções. É o que `ShellIo.args` usa.

**Como usar.** `rawArgsAfter(['list', 'projects', '--json'], 'list', 'projects')` devolve `['--json']`.

### `createSpawnGitRunner`

**O que é.** O `git` da plataforma: roda `git` numa pasta e devolve `stdout`, `stderr` e o código de saída.

**Para que serve.** Para um comando usar o `git` por uma interface que o teste troca.

**Como usar.** No `main.ts`, `git: createSpawnGitRunner()`; num comando,
`container.get(PLATFORM).git.run(['status', '--short'], pasta)`.

### `createBunProcessSpawner`

**O que é.** O `spawn` da plataforma, sobre o `Bun.spawn`.

**Para que serve.** Para criar processos pela plataforma. É o que [`ProcessRunnerService`](#processrunnerservice-e-session)
usa.

**Como usar.** No `main.ts`, `spawn: createBunProcessSpawner(Bun.spawn as unknown as BunSpawnFn)`.

## `help`

A ajuda e o autocomplete, gerados a partir da descrição de cada comando.

### `CommandSpec`

**O que é.** A descrição de um comando: o uso (`usage`), o que ele faz (`description`), os exemplos (`examples`), as
opções (`flags`), os subcomandos (`commands`) e os argumentos posicionais (`positionals`).

**Para que serve.** Um só spec gera o `--help` e as sugestões do autocomplete, então os dois nunca divergem.

**Como usar.** Escreva o spec do comando e entregue-o a [`formatHelp`](#formathelp) e [`complete`](#complete):

<!-- exemplo: ajuda.ts -->

<!-- prettier-ignore -->
```ts
import { complete, formatHelp, type CommandSpec, type Suggestions } from 'choliba/core';

const SERVIR: CommandSpec = {
  usage: 'app servir [OPTIONS]',
  description: 'Sobe o servidor de desenvolvimento.',
  flags: [
    { name: '--porta', description: 'Porta em que ele escuta', value: { name: 'número' } },
    { name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true },
  ],
};

/** O `--help` do comando, como o terminal o mostra. */
export function ajudaDeServir(): string {
  return formatHelp(SERVIR);
}

/** O que o autocomplete oferece para a última palavra digitada. */
export function sugestoes(palavras: readonly string[]): Suggestions {
  return complete(SERVIR, palavras);
}
```

### `formatHelp`

**O que é.** A função que escreve o texto do `--help` de um spec.

**Para que serve.** Para mostrar a ajuda de um comando. `ShellIo.printHelp` usa ela.

**Como usar.** `ajudaDeServir()`, do exemplo de [`CommandSpec`](#commandspec), devolve:

<!-- saida: ajudaDeServir() -->

```text
Usage:  app servir [OPTIONS]

Sobe o servidor de desenvolvimento.

Options:
      --porta número   Porta em que ele escuta
  -h, --help           Mostra esta ajuda
```

### `complete`

**O que é.** A função que dá as sugestões do autocomplete para a última palavra digitada, a partir do spec.

**Para que serve.** Para o shell do sistema completar comandos, opções e valores. A raiz de uma CLI montada com
`createShell` já responde a `__complete` com ela.

**Como usar.** `sugestoes(['--'])`, do exemplo de [`CommandSpec`](#commandspec), devolve
`{ kind: 'values', values: ['--porta', '--help'] }`.

## `terminal`

A saída no terminal: processos, tabelas, quadros, linhas que se redesenham e um painel em tela cheia. O texto é medido
pela largura que a pessoa vê na tela; os códigos de cor não contam.

### `ProcessRunnerService` e `Session`

**O que é.** O `ProcessRunnerService` roda um processo e devolve a `Session` dele. A sessão entrega cada linha da
saída, com rótulo, a quem se inscrever, e avisa quando o processo termina.

**Para que serve.** Para acompanhar a saída de um processo linha a linha, por exemplo para mostrá-la com rótulo ou
gravá-la.

**Como usar.** Rodar um processo e escrever a saída com rótulo:

<!-- exemplo: processo.ts -->

<!-- prettier-ignore -->
```ts
import { ProcessRunnerService, type ProcessSpawner, type SessionExitEvent } from 'choliba/core';

/** Roda `comando`, escreve cada linha da saída com o rótulo `app` e devolve o código de saída. */
export async function rodar(
  spawner: ProcessSpawner,
  comando: readonly string[],
  escrever: (texto: string) => void,
): Promise<number | null> {
  const runner = new ProcessRunnerService({ spawner });
  const sessao = runner.start({ label: 'app', command: comando, colorize: false });
  sessao.subscribe((linha) => {
    escrever(`${linha.formatted}\n`);
  });
  const fim = await new Promise<SessionExitEvent>((resolve) => {
    sessao.onExit(resolve);
  });
  return fim.exitCode;
}
```

Com `rodar(platform.spawn, ['echo', 'pronto'], (texto) => platform.stdout.write(texto))`, a saída é `[app] pronto`.

### `Table`, `th` e `td`

**O que é.** Uma tabela como o `<table>` do HTML: cabeçalho, corpos e rodapé, com células de cabeçalho (`th`) e de
dados (`td`).

**Para que serve.** Para mostrar dados em colunas que cabem na largura do terminal: as colunas encolhem e o texto é
cortado quando falta espaço.

**Como usar.** Uma tabela com a segunda coluna alinhada à direita:

<!-- exemplo: tabela.ts -->

<!-- prettier-ignore -->
```ts
import { Table, td, th } from 'choliba/core';

/** As idades numa tabela que cabe em `largura` colunas do terminal. */
export function tabelaDeIdades(largura: number): string {
  const tabela = new Table({
    cols: [{}, { align: 'right' }],
    head: [[th('Nome'), th('Idade')]],
    bodies: [
      [
        [td('Ana'), td('30')],
        [td('Bruno'), td('4')],
      ],
    ],
  });
  return tabela.render(largura).join('\n');
}
```

<!-- saida: tabelaDeIdades(40) -->

```text
Nome   Idade
────────────
Ana       30
Bruno      4
```

### `frameTop`, `frameLines` e `frameBottom`

**O que é.** As três partes de um quadro com título: a borda de cima, as linhas de dentro e a borda de baixo.

**Para que serve.** Para destacar um bloco de texto. As linhas compridas quebram dentro do quadro, e a borda da direita
fica alinhada mesmo com cores.

**Como usar.** Juntar as três partes:

<!-- exemplo: quadro.ts -->

<!-- prettier-ignore -->
```ts
import { frameBottom, frameLines, frameTop } from 'choliba/core';

/** `texto` num quadro de `largura` colunas, com `titulo` em cima. */
export function quadro(titulo: string, texto: string, largura: number): string {
  return [frameTop(titulo, largura), ...frameLines(texto, largura), frameBottom(largura)].join('\n');
}
```

<!-- saida: quadro('build', 'compilando\npronto', 24) -->

```text
┌─ build ──────────────┐
│ compilando           │
│ pronto               │
└──────────────────────┘
```

### `LiveRegion`

**O que é.** Linhas que ficam embaixo da saída e se redesenham sozinhas, cada uma com um spinner e o tempo decorrido.

**Para que serve.** Para mostrar o que está em andamento, como tarefas paralelas, enquanto outras linhas são impressas
acima.

**Como usar.** `const vivo = new LiveRegion(process.stdout)`; `vivo.set({ id: 'build', text: 'compilando', since:
Date.now() })` mostra a linha; `vivo.printPermanent('pronto\n')` imprime acima dela; `vivo.remove('build')` e
`vivo.stop()` a tiram. Só num terminal.

### `StatusFooter`

**O que é.** Um rodapé fixo no fim do terminal, redesenhado embaixo de cada linha impressa.

**Para que serve.** Para mostrar um estado que muda, como o tempo decorrido, sem se misturar com a saída.

**Como usar.** `const rodape = new StatusFooter(process.stdout, (largura) => ['executando…'])`; escreva pela saída que
`rodape.writer(process.stdout)` devolve, chame `rodape.draw()` para redesenhar e `rodape.close()` no fim. Só num
terminal.

### `openOpenTuiPanel`

**O que é.** Um painel em tela cheia, sobre o [OpenTUI](https://opentui.com): um quadro com rolagem, um campo de texto
e um rodapé.

**Para que serve.** Para uma sessão longa com interação: a pessoa rola a saída, responde perguntas e manda mensagens.

**Como usar.** `const painel = await openOpenTuiPanel({ title: 'app', titleColor: 'cyan', footer: () => [], hint:
'Digite uma mensagem' })` devolve o painel, ou `undefined` onde ele não abre. Então `painel.write(texto)` acrescenta
linhas, `painel.ask(pergunta)` pergunta no campo, `painel.onMessage(...)` recebe o que a pessoa enviar e
`painel.close()` devolve o terminal.

### `visibleWidth` e `wrapVisible`

**O que é.** A largura de um texto na tela e a quebra dele numa largura, sem contar os códigos de cor.

**Para que serve.** Para alinhar e quebrar texto colorido.

**Como usar.** `visibleWidth(paintAnsi('green', 'ok'))` devolve `2`, e `wrapVisible('uma linha comprida', 10)` devolve
`['uma linha', 'comprida']`.

## `theme`

As 16 cores do terminal e a regra de quando usá-las.

### `paintAnsi` e `boldAnsi`

**O que é.** As funções que pintam um texto com uma das 16 cores (`ANSI_COLORS`) e que o põem em negrito.

**Para que serve.** Para destacar partes da saída.

**Como usar.** `paintAnsi('green', 'ok')` e `boldAnsi('x')`, que devolve `'\u001b[1mx\u001b[22m'`. Use só quando
[`colorEnabled`](#colorenabled) disser que a saída aceita cor.

### `colorEnabled`

**O que é.** A função que decide se a saída aceita cor.

**Para que serve.** Para pintar só quando a saída vai para uma pessoa num terminal. Sem cor com `--no-color`,
`NO_COLOR`, `FORCE_COLOR=0`, `TERM=dumb` ou fora de um terminal; com cor com qualquer outro `FORCE_COLOR`, mesmo num
pipe.

**Como usar.** Decidir pela cor e pintar:

<!-- exemplo: tema.ts -->

<!-- prettier-ignore -->
```ts
import { colorEnabled, paintAnsi } from 'choliba/core';

/** `texto` em verde quando a saída aceita cor, e sem códigos de escape quando não aceita. */
export function emVerde(texto: string, env: Readonly<Record<string, string | undefined>>, isTTY: boolean): string {
  const comCor = colorEnabled({ env, isTTY, noColorFlag: false });
  return comCor ? paintAnsi('green', texto) : texto;
}
```

## Configuração

A configuração tipada e suas fontes ficam no pacote independente [`@choliba/config`](../../docs/referencia/config.md).
O `core` apenas reúne os grupos declarados pelos módulos da CLI e registra seus tokens no container.

## `testing`

Os falsos de `choliba/core/testing`, para testar uma CLI sem rodar um processo.

### `runShell`

**O que é.** A função que roda a linha de comando de uma plataforma contra os módulos, como o `main.ts`, e devolve o
código de saída.

**Para que serve.** Para testar um comando de ponta a ponta: a linha de comando, o que ele escreveu e o código.

**Como usar.** Com [`fakePlatform`](#fakeplatform) e [`BufferWritable`](#bufferwritable), um teste da `ola`:

<!-- exemplo: ola.spec.ts -->

<!-- prettier-ignore -->
```ts
import { BufferWritable, fakePlatform, runShell } from 'choliba/core/testing';
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
```

### `fakePlatform`

**O que é.** Uma plataforma de teste: sem ambiente, com relógio fixo (`FAKE_NOW`), e com `spawn` e `git` que falham se
usados.

**Para que serve.** Para o teste dizer só o que importa: `fakePlatform({ argv, stdout })` troca as partes que você
passar.

**Como usar.** `fakePlatform({ argv: ['ola', 'Ana'], stdout })`, como no exemplo de [`runShell`](#runshell).

### `BufferWritable`

**O que é.** Uma saída em memória, no lugar do `stdout` ou do `stderr`.

**Para que serve.** Para ler o que o comando escreveu.

**Como usar.** `const stdout = new BufferWritable()`, passado à plataforma; depois, `stdout.text()` devolve tudo o que
foi escrito.

### `replace`

**O que é.** Uma troca de serviço para `runShell`: o token e o falso que fica no lugar.

**Para que serve.** Para controlar o que o comando recebe, como um relógio fixo ou um serviço que não acessa a rede.

**Como usar.** No terceiro argumento de `runShell`. Aqui o relógio do exemplo de [`Container` e `token`](#container-e-token)
vira um relógio fixo:

<!-- exemplo: relogio.spec.ts -->

<!-- prettier-ignore -->
```ts
import { BufferWritable, fakePlatform, replace, runShell } from 'choliba/core/testing';
import { RELOGIO, relogioModule } from './relogio';

describe('agora', () => {
  it('escreve a hora do relógio da CLI', async () => {
    const stdout = new BufferWritable();
    const meioDia = (): Date => new Date('2026-05-01T12:00:00.000Z');

    await runShell([relogioModule], fakePlatform({ argv: ['agora'], stdout }), [replace(RELOGIO, meioDia)]);

    expect(stdout.text()).toBe('2026-05-01T12:00:00.000Z\n');
  });
});
```

### `FakeSignals`

**O que é.** Sinais do processo (`SIGINT`, `SIGTERM`) que o teste dispara.

**Para que serve.** Para testar o que o comando faz quando a pessoa tecla Ctrl+C.

**Como usar.** `const signals = new FakeSignals()`, passado em `fakePlatform({ signals })`; depois,
`signals.emit('SIGINT')` avisa quem se inscreveu.

## O que ainda não é independente

Tudo o que `choliba/core` exporta é público. A tabela diz o que já funciona fora do choliba e o que ainda depende
dele, com o motivo e para onde vai.

| Export                                                                                                 | Estado       | Motivo                                                                                       | Destino previsto                               |
| ------------------------------------------------------------------------------------------------------ | ------------ | -------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `Container`, `token`, `ShellIo`, tipos dos comandos                                                    | independente | —                                                                                            | —                                              |
| `createShell`                                                                                          | acoplado     | o erro inesperado manda reportar no repositório do choliba e lê `CHOL_DEBUG`                 | mensagem e variável definidas pela raiz da CLI |
| `coreShell`, `THEME`, `THEME_CHOICES`, `WORKSPACE_ROOT`                                                | independente | o app fornece as escolhas do tema e a raiz da sua pasta de trabalho                          | —                                              |
| `TERMINAL_RUN_SPEC`                                                                                    | acoplado     | o uso é `choliba terminal run`                                                               | nome do programa vindo da raiz                 |
| `RUNTIME`                                                                                              | acoplado     | o tipo `Runtime` é do app `choliba`                                                          | o token vai para o app                         |
| `RootOptions`, `messageOf`, `ExpectedError`                                                            | independente | —                                                                                            | —                                              |
| `takeGlobalFlags`, `rawArgsAfter`, `createSpawnGitRunner`, tokens da plataforma                        | independente | não há uma fábrica da plataforma real: cada CLI a monta, como no `main.ts` acima             | —                                              |
| `CommandSpec`, `formatHelp`, `formatRows`, `complete`, `describe`, `entryHelp`                         | independente | —                                                                                            | —                                              |
| `DOCS_URL`, `commandPage`, `commandWords`                                                              | acoplado     | apontam para o site e as páginas de comando do choliba                                       | o site do choliba, fora do `core`              |
| `COMPLETION_BASH`, `installShellCompletion` e afins                                                    | acoplado     | o script de autocomplete é do comando `choliba`                                              | o autocomplete do app                          |
| `scriptsHelpSpec`, `readPackageScripts` e afins                                                        | acoplado     | descrevem os scripts `bun chol:*` deste repositório                                          | o ferramental do repositório                   |
| `ProcessRunnerService`, `Session`, `Table`, quadro, `LiveRegion`, `StatusFooter`, painel, `formatLine` | independente | —                                                                                            | —                                              |
| `printBox`, `defaultStdout`, `writeStdout`                                                             | independente | sem um destino, escrevem no `process.stdout`, não na plataforma (`printBox` aceita `stream`) | a plataforma como destino padrão               |
| `paintAnsi`, `boldAnsi`, `ANSI_COLORS`, `colorEnabled`, `colorForLabel`                                | independente | —                                                                                            | —                                              |
| `DEFAULT_THEME`, `THEME_ROLES`, `buildTheme`, `parseColors`, `ThemeService`                            | acoplado     | as cores padrão citam os providers e os agentes do choliba                                   | tema registrado pelos pacotes                  |
| `findResource`, `locateResource`, `resourceStarts`; `findManifest`, `versionLine`                      | acoplado     | acham os arquivos e a versão do pacote `choliba` instalado                                   | o app `choliba`                                |
| `fakePlatform`, `BufferWritable`, `FakeSignals`, `runShell`, `replace`                                 | independente | —                                                                                            | —                                              |
| `VERBS_ROOT`                                                                                           | acoplado     | uma raiz com os verbos do choliba, para testar os pacotes dele                               | os testes de cada pacote                       |

<!-- #endregion guia -->
