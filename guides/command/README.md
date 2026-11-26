<a id="topo"></a>

# Módulo command: declarar um comando de linha de comando

> O módulo `command` separa a declaração de um comando da execução: valida a linha antes de tudo e gera o `--help` e o parser da mesma declaração.

Um comando de linha de comando precisa ler os argumentos, recusar o que não faz sentido, mostrar a ajuda e só então
trabalhar. O módulo `command` faz isso a partir de **uma declaração**: o nome, a descrição, os argumentos e as opções.
Dela saem o parser, a ajuda (`--help`) e os tipos que o `run` recebe.

Quem usa o módulo são os comandos do próprio Choliba (`src/cli`, os de `choliba <comando>`) e os scripts deste
repositório (`scripts/`). O pacote (`choliba`) não o exporta.

## Índice

- [Os arquivos](#os-arquivos)
- [Interface](#interface)
  - [A declaração: `defineCommand`](#a-declaração-definecommand)
  - [A execução: `runCommand`](#a-execução-runcommand)
  - [Peças que dá para usar sozinhas](#peças-que-dá-para-usar-sozinhas)
- [Como funciona](#como-funciona)
- [Exemplos](#exemplos)
  - [1. Um comando com argumento e opções](#1-um-comando-com-argumento-e-opções)
  - [2. A ajuda gerada](#2-a-ajuda-gerada)
  - [3. Erros de uso](#3-erros-de-uso)
- [Regras do módulo](#regras-do-módulo)
- [Exercícios](#exercícios)

## Os arquivos

| Arquivo    | Papel                                                                                                                                                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts` | A forma da declaração (`CommandDefinition`), dos argumentos (`ArgSpec`) e das opções (`BooleanOptionSpec`, `StringOptionSpec`), e o que o `run` recebe (`CommandContext`, com `args` e `options` tipados pela declaração). |
| `parse.ts` | `parseCommandLine`: confere a linha contra a declaração e devolve `{ args, options }` ou `{ help: true }`; recusa com `UsageError` o que não bate. `usageLine`: a linha de uso.                                            |
| `help.ts`  | `helpText`: a ajuda, montada da declaração.                                                                                                                                                                                |
| `index.ts` | `defineCommand` e `runCommand`, que roda um comando como script; reexporta os tipos, o `helpText` e o `parseCommandLine`.                                                                                                  |

[↑ topo](#topo)

## Interface

### A declaração: `defineCommand`

`defineCommand(declaração)` devolve a declaração como veio: serve para tipar os `args` e as `options` do `run` a partir
dela.

| Campo          | Obrigatório | O que é                                                                                                                                 |
| -------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `name`         | sim         | como o comando é chamado: `<program> <name>`                                                                                            |
| `program`      | não         | o programa que aparece na linha de uso; `bun` por padrão (os comandos do Choliba usam `choliba`)                                        |
| `description`  | sim         | a frase da ajuda                                                                                                                        |
| `args`         | não         | os argumentos posicionais, na ordem: `{ description, required? }`                                                                       |
| `options`      | não         | as opções: `{ type: 'boolean', description, short? }` ou `{ type: 'string', description, short?, value?, default? }`                    |
| `run(context)` | sim         | o trabalho; recebe `args`, `options`, `signal` (abortado no Ctrl+C) e `output` (a conversa: a única forma de mostrar ou perguntar algo) |

No `run`, um argumento obrigatório é sempre `string`, e um opcional, `string | undefined`. Uma opção boolean vale
`false` sem a flag; uma de texto com `default` é sempre `string`.

### A execução: `runCommand`

`runCommand(declaração, opções?)` roda o comando como um script. As opções (`RunCommandOptions`):

| Opção       | O que é                                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------- |
| `argv`      | a linha de comando; a do processo por padrão                                                        |
| `onFailure` | como uma falha termina o programa; com o código de saída 1, por padrão                              |
| `output`    | onde as mensagens aparecem; o stdout, por padrão                                                    |
| `config`    | qual `choliba.config.ts` carregar (`{ cwd?, path? }`); o achado a partir da pasta atual, por padrão |

### Peças que dá para usar sozinhas

| Peça                                 | O que faz                                                                                             |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `parseCommandLine(declaração, argv)` | confere a linha e devolve `{ args, options }` ou `{ help: true }`; lança `UsageError` no que não bate |
| `helpText(declaração)`               | o texto do `--help`                                                                                   |
| `usageLine(declaração)`              | a linha de uso (`bun saudar <nome> [opções]`); importe de `src/command/parse`                         |

[↑ topo](#topo)

## Como funciona

1. **A linha primeiro.** O `runCommand` confere a linha contra a declaração (`parseCommandLine`) antes de qualquer
   coisa. Com `--help` ou `-h`, mostra a ajuda e termina. Uma linha que não bate (falta um argumento obrigatório, uma
   opção não existe, falta o valor de uma opção) mostra o erro, a linha de uso e como pedir a ajuda, e termina pelo
   `onFailure`. Nada disso carrega a config nem abre o log.
2. **Depois, o script.** Uma linha válida roda dentro do `runScript`: a config é carregada, o log é aberto, e o Ctrl+C
   aborta o `signal`.
3. **O `run`.** Recebe os `args` e as `options` já tipados, o `signal` e o `output`. Um erro de uso que só ele sabe
   conferir (um valor fora do esperado) é um `UsageError`: a mensagem aparece, e o programa termina pelo `onFailure`.
   Qualquer outro erro é inesperado e sobe.

[↑ topo](#topo)

## Exemplos

Os exemplos são arquivos completos em `guides/command/exemplos/` e rodam como estão. Cada um fixa a linha de comando no
`argv` para mostrar um caso; num programa de verdade, ela é a do processo.

### 1. Um comando com argumento e opções

Uma declaração com um argumento obrigatório, uma opção boolean e uma de texto com padrão, rodada com uma linha que usa
as duas.

`guides/command/exemplos/1-comando.ts`:

```ts
/**
 * Exemplo 1 do curso de command: um comando com um argumento e duas opções,
 * declarado uma vez com `defineCommand` e rodado com `runCommand`. A linha de
 * comando vem fixa no `argv`, para o exemplo rodar como está; num programa de
 * verdade, ela é a do processo.
 *
 *   bun guides/command/exemplos/1-comando.ts
 */
import { defineCommand, runCommand } from '../../../src/command/index';

const saudar = defineCommand({
  name: 'saudar',
  description: 'Diz olá para alguém.',
  args: {
    nome: { description: 'Quem recebe o olá', required: true },
  },
  options: {
    alto: { type: 'boolean', short: 'a', description: 'Em letras maiúsculas' },
    vezes: {
      type: 'string',
      value: 'n',
      default: '1',
      description: 'Quantas vezes dizer',
    },
  },
  run: ({ args, options, output }) => {
    // args.nome é string (obrigatório); options.alto é boolean; options.vezes
    // é string (tem padrão).
    const ola = `Olá, ${args.nome}!`;
    const linha = options.alto ? ola.toUpperCase() : ola;
    output.write(
      Array.from({ length: Number(options.vezes) }, () => linha).join('\n'),
    );
  },
});

await runCommand(saudar, { argv: ['Ana', '--alto', '--vezes', '2'] });
```

`bun guides/command/exemplos/1-comando.ts` (saída real):

```text
OLÁ, ANA!
OLÁ, ANA!
```

### 2. A ajuda gerada

A ajuda sai da declaração: a linha de uso (com o `program`, aqui `exemplo`), a descrição, os argumentos e as opções,
com o padrão de cada uma. Com `--help`, o `run` não roda.

`guides/command/exemplos/2-ajuda.ts`:

```ts
/**
 * Exemplo 2 do curso de command: a ajuda que o `--help` mostra, gerada da
 * declaração do comando (`helpText`). Com `--help`, o `runCommand` responde
 * na hora, sem carregar a config nem rodar o `run`. O `program` diz o nome
 * que aparece na linha de uso.
 *
 *   bun guides/command/exemplos/2-ajuda.ts
 */
import { defineCommand, runCommand } from '../../../src/command/index';

const saudar = defineCommand({
  name: 'saudar',
  program: 'exemplo',
  description: 'Diz olá para alguém.',
  args: {
    nome: { description: 'Quem recebe o olá', required: true },
  },
  options: {
    alto: { type: 'boolean', short: 'a', description: 'Em letras maiúsculas' },
    vezes: {
      type: 'string',
      value: 'n',
      default: '1',
      description: 'Quantas vezes dizer',
    },
  },
  run: ({ output }) => {
    output.write('com --help, isto não roda');
  },
});

await runCommand(saudar, { argv: ['--help'] });
```

`bun guides/command/exemplos/2-ajuda.ts` (saída real):

```text
Uso: exemplo saudar <nome> [opções]

Diz olá para alguém.

Argumentos:
  <nome>  Quem recebe o olá

Opções:
  -a, --alto       Em letras maiúsculas
      --vezes <n>  Quantas vezes dizer (padrão: 1)
  -h, --help       Mostra esta ajuda
```

### 3. Erros de uso

Três linhas que não servem: sem o argumento obrigatório, com uma opção que não existe e com um valor que só o `run`
sabe recusar.

`guides/command/exemplos/3-erros.ts`:

```ts
/**
 * Exemplo 3 do curso de command: erros de uso. Uma linha que não bate com a
 * declaração (sem o argumento obrigatório, com uma opção que não existe) é
 * recusada antes de qualquer coisa; um valor que só o `run` sabe conferir
 * vira um `UsageError` lá dentro. Nos três casos, a mensagem aparece e o
 * programa termina com o código 1; aqui, um `onFailure` mostra isso no lugar
 * de encerrar o processo.
 *
 *   bun guides/command/exemplos/3-erros.ts
 */
import { defineCommand, runCommand } from '../../../src/command/index';
import { UsageError } from '../../../src/errors';
import { writeOut } from '../../../src/output/stdio';

const saudar = defineCommand({
  name: 'saudar',
  description: 'Diz olá para alguém.',
  args: {
    nome: { description: 'Quem recebe o olá', required: true },
  },
  options: {
    vezes: {
      type: 'string',
      value: 'n',
      default: '1',
      description: 'Quantas vezes dizer',
    },
  },
  run: ({ args, options, output }) => {
    const vezes = Number(options.vezes);
    if (!Number.isInteger(vezes) || vezes < 1) {
      throw new UsageError(
        `--vezes precisa ser um número inteiro maior que zero, não "${options.vezes}".`,
      );
    }
    output.write(`Olá, ${args.nome}!`);
  },
});

for (const argv of [[], ['Ana', '--cor', 'azul'], ['Ana', '--vezes', 'duas']]) {
  writeOut(`${['$ bun saudar', ...argv].join(' ')}\n`);
  let code = 0;
  await runCommand(saudar, {
    argv,
    onFailure: () => {
      code = 1;
    },
  });
  writeOut(`(código de saída: ${String(code)})\n\n`);
}
```

`bun guides/command/exemplos/3-erros.ts` (saída real):

```text
$ bun saudar
Falta o argumento <nome>.
Uso: bun saudar <nome> [opções]
Veja: bun saudar --help
(código de saída: 1)

$ bun saudar Ana --cor azul
Opção desconhecida: --cor
Uso: bun saudar <nome> [opções]
Veja: bun saudar --help
(código de saída: 1)

$ bun saudar Ana --vezes duas
--vezes precisa ser um número inteiro maior que zero, não "duas".
(código de saída: 1)
```

- Os dois primeiros erros vêm da declaração: o `runCommand` os recusa antes de carregar a config, com a linha de uso e
  como pedir a ajuda.
- O terceiro vem do `run`, que recusa o valor com um `UsageError` que diz o que fazer.
- Nos três, quem termina o programa é o `onFailure`: com o padrão, o código de saída é 1.

[↑ topo](#topo)

## Regras do módulo

- **Uma declaração, tudo dela.** O parser, a ajuda e os tipos do `run` saem da mesma declaração: não escreva a ajuda à
  mão nem leia o `argv` por fora.
- **A linha antes de tudo.** Um erro de uso aparece antes de carregar a config ou abrir o log.
- **Erros de uso são `UsageError`**, em português, dizendo o que fazer; terminam pelo `onFailure`.
- **O `run` só fala pelo `output`.** Nada de `console` nem de `process.stdout`: o lint recusa.
- O desenho de cada comando (nomes de opções, ajuda, saídas) segue a skill
  [`cli-guidelines`](../../.agents/skills/cli-guidelines/SKILL.md).

[↑ topo](#topo)

## Exercícios

1. **Simples.** No Exemplo 1, acrescente uma opção `--educado` (boolean, `-e`) que troca "Olá" por "Bom dia". O que
   muda na ajuda do Exemplo 2?
2. **Médio.** Acrescente ao Exemplo 1 uma opção `--formato` que aceite `texto` ou `json` e recuse outro valor com um
   `UsageError`. Em que parte do caminho o erro aparece, e por que não na conferência da linha?
3. **Difícil.** Escreva um comando que leia o `choliba.config.ts` de uma pasta passada como argumento (`config: { cwd
}` no `runCommand`) e mostre o `logger.dir`. Por que um erro no argumento aparece antes de a config ser carregada?

[↑ topo](#topo)
