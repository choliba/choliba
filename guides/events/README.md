<a id="topo"></a>

# Módulo events: ligar produtores e consumidores que não se conhecem

> O módulo `events` liga as partes do Choliba sem que uma conheça a outra: o produtor avisa o que aconteceu com o próprio nome e o consumidor assina os que quer.

Dentro do Choliba, uma parte do sistema faz algo (um agente recebe uma entrada, gera uma saída, "pensa", erra) e outras
partes precisam saber disso. O módulo `events` liga essas partes **sem que uma conheça a outra**:

- o **produtor** avisa o que aconteceu, com o próprio nome;
- o **consumidor** assina os produtores que lhe interessam e recebe só os eventos deles.

Os dois se encontram pelo **nome do produtor**, e nada mais. Quem faz o pedido não sabe que existe cobrança; quem cobra
não sabe quem fez o pedido.

O módulo não faz I/O: nada sai do processo por aqui. Entregar para fora é papel da saída (`src/output`); registrar é
papel do logger (`src/logger`).

## Índice

- [Os arquivos](#os-arquivos)
- [Interface](#interface)
- [Como funciona](#como-funciona)
  - [Do produtor ao consumidor](#do-produtor-ao-consumidor)
  - [O agente](#o-agente)
- [Exemplos](#exemplos)
  - [1. Pedido e cobrança](#1-pedido-e-cobrança)
  - [2. Vários produtores, vários consumidores](#2-vários-produtores-vários-consumidores)
  - [3. Um consumidor de tudo](#3-um-consumidor-de-tudo)
  - [4. O que vem junto no evento](#4-o-que-vem-junto-no-evento)
  - [5. Assinar só durante uma tarefa](#5-assinar-só-durante-uma-tarefa)
- [Regras do módulo](#regras-do-módulo)
- [Exercícios](#exercícios)

## Os arquivos

| Arquivo                | Papel                                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/events/index.ts`  | O módulo inteiro: os tipos (`CholibaEvent`, `EventInput`, `Producer`, `Consumer`, `EventListener`), `createProducer`, `createConsumer` e `ALL_SOURCES`. |
| `src/context/index.ts` | Não é do módulo, mas é usado por ele: `currentContext()` diz qual agente está rodando, e esses dados entram em todo evento.                             |
| `src/agent/events.ts`  | Também não é do módulo: o produtor de todos os agentes (`agentEvents`, com o nome `AGENT_SOURCE`), o maior usuário dele.                                |

[↑ topo](#topo)

## Interface

| Nome                       | O que é                                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `createProducer(source)`   | um produtor: `{ source, emit(input) }`; recusa um nome vazio ou `'*'`                                                      |
| `createConsumer(listener)` | um consumidor: `{ subscribe(...sources), unsubscribe(...sources), unsubscribeAll(), sources() }`; criar não assina nada    |
| `ALL_SOURCES`              | `'*'`: assina todos os produtores, inclusive os que ainda não existem                                                      |
| `EventInput`               | o que se emite: `{ type, ...dados }`                                                                                       |
| `CholibaEvent`             | o que o consumidor recebe: o que foi emitido, mais `ts`, `source` e, dentro de um agente, `agent`, `run` e `agentProvider` |
| `EventListener`            | a função do consumidor: `(event: CholibaEvent) => void`                                                                    |

O pacote (`choliba`) exporta só o tipo `CholibaEvent`. Quem usa o pacote ouve um agente pela opção `subscribe` do
`Agent`, que recebe cada evento dele já filtrado (veja [O agente](#o-agente)).

[↑ topo](#topo)

## Como funciona

### Do produtor ao consumidor

```
fazerPedido() ── loja.emit() ──▶ [ 'loja' ] ──┬─▶ cobranca
                                              └─▶ notaFiscal
                                 [ '*'    ] ────▶ painel (assina todos)
```

1. **Criar um produtor.** `createProducer('loja')` devolve um objeto com `source` (o nome) e `emit`. O nome não pode
   ser vazio nem `'*'`, que é reservado.
2. **Criar um consumidor.** `createConsumer(funcao)` devolve um objeto com `subscribe`, `unsubscribe`,
   `unsubscribeAll` e `sources`. Criar não assina nada.
3. **Assinar.** `consumidor.subscribe('loja')`, ou vários de uma vez: `subscribe('loja', 'estoque')`. `ALL_SOURCES`
   (`'*'`) assina todos os produtores, inclusive os que ainda não existem.
4. **Emitir.** `loja.emit({ type: 'pedido_feito', ...dados })`. O módulo monta o evento:
   - `ts`: data e hora ISO;
   - os dados do `currentContext()`: `agent`, `run` e `agentProvider`, **se** a chamada estiver dentro de `runAs(...)`;
   - o que foi emitido;
   - `source`: o nome do produtor, que vence um `source` nos dados.
5. **Entregar.** Cada consumidor assinado no nome do produtor, ou em `'*'`, recebe o evento **uma vez**, na hora, de
   forma síncrona.
6. **Desassinar.** `unsubscribe('loja')` tira de um produtor; `unsubscribeAll()` tira de todos. `sources()` diz o que
   ele assina agora.

### O agente

Há **um produtor para todos os agentes**, o `agentEvents` (nome `AGENT_SOURCE`, `'agent'`), em `src/agent/events.ts`.
A função `publish` de lá emite o evento e também o grava no log; o `tick` do "pensando" só é emitido, porque é um
relógio, não algo que aconteceu.

E há **um consumidor por conversa**, no `converse()` de `src/agent/agent.ts`: ele assina o `AGENT_SOURCE` no começo,
desassina no `finally`, e só passa adiante os eventos do próprio agente (`event.agent`), porque o produtor é
compartilhado. É esse consumidor que entrega cada evento às funções da opção `subscribe`, como um `AgentOutput`
(`type()`, `data()`, `ts()`, `agent()`). O Exemplo 3 do [curso do agente](../agent/README.md#3-acompanhar-o-agente)
mostra isso rodando.

Tudo o que roda durante um `Agent.run()` (o executor, a sandbox, o gate, os providers) está dentro de `runAs(...)`: um
produtor qualquer, chamado ali, já leva o agente no evento sem passar nada (o Exemplo 4).

[↑ topo](#topo)

## Exemplos

Os exemplos são arquivos completos em `guides/events/exemplos/` e rodam como estão, sem agente nem modelo.

### 1. Pedido e cobrança

O caso que abre o curso: todo pedido feito dispara a cobrança, sem que um saiba do outro.

`guides/events/exemplos/1-pedido-e-cobranca.ts`:

```ts
/**
 * Exemplo 1 do curso de events: pedido e cobrança. Todo pedido feito dispara
 * a cobrança, mas `fazerPedido` não sabe que existe cobrança, e `cobrar` não
 * sabe quem fez o pedido: os dois só conhecem o nome do produtor, 'loja'.
 *
 *   bun guides/events/exemplos/1-pedido-e-cobranca.ts
 */
import { createConsumer, createProducer } from '../../../src/events/index';
import { writeOut } from '../../../src/output/stdio';

const loja = createProducer('loja');

/** Faz um pedido e avisa que ele foi feito. */
function fazerPedido(cliente: string, valor: number): void {
  writeOut(`pedido de ${cliente}: R$ ${valor.toFixed(2)}\n`);
  loja.emit({ type: 'pedido_feito', cliente, valor });
}

/** Cobra um pedido. */
function cobrar(cliente: string, valor: number): void {
  writeOut(`  cobrança de ${cliente}: R$ ${valor.toFixed(2)}\n`);
}

const cobranca = createConsumer((event) => {
  if (event.type !== 'pedido_feito') return;
  cobrar(String(event['cliente']), Number(event['valor']));
});
cobranca.subscribe('loja');

fazerPedido('Ana', 42.5); // → cobrança de Ana
fazerPedido('Bruno', 18); // → cobrança de Bruno

cobranca.unsubscribeAll();
fazerPedido('Carla', 10); // sem cobrança: ninguém assina mais a loja
```

`bun guides/events/exemplos/1-pedido-e-cobranca.ts` (saída real):

```text
pedido de Ana: R$ 42.50
  cobrança de Ana: R$ 42.50
pedido de Bruno: R$ 18.00
  cobrança de Bruno: R$ 18.00
pedido de Carla: R$ 10.00
```

### 2. Vários produtores, vários consumidores

Dois produtores e três consumidores, um deles ouvindo os dois; depois, desassinar de um produtor só e de todos.

`guides/events/exemplos/2-varios.ts`:

```ts
/**
 * Exemplo 2 do curso de events: dois produtores e três consumidores, um deles
 * ouvindo os dois; depois, desassinar de um produtor só e de todos.
 *
 *   produtor1 ─┬─▶ consumidor1
 *              └─▶ consumidor2
 *   produtor2 ─┬─▶ consumidor1
 *              └─▶ consumidor3
 *
 *   bun guides/events/exemplos/2-varios.ts
 */
import {
  createConsumer,
  createProducer,
  type CholibaEvent,
} from '../../../src/events/index';
import { writeOut } from '../../../src/output/stdio';

/** A função de um consumidor que mostra o que recebeu, com o próprio nome. */
function imprimir(consumidor: string) {
  return (event: CholibaEvent): void => {
    writeOut(`  ${consumidor} ← ${event.source}: ${event.type}\n`);
  };
}

const produtor1 = createProducer('produtor1');
const produtor2 = createProducer('produtor2');

const consumidor1 = createConsumer(imprimir('consumidor1'));
const consumidor2 = createConsumer(imprimir('consumidor2'));
const consumidor3 = createConsumer(imprimir('consumidor3'));

consumidor1.subscribe('produtor1', 'produtor2'); // escuta dois
consumidor2.subscribe('produtor1');
consumidor3.subscribe('produtor2');

writeOut('dois produtores, três consumidores\n');
produtor1.emit({ type: 'a' }); // consumidor1 e consumidor2
produtor2.emit({ type: 'b' }); // consumidor1 e consumidor3

writeOut('desassinar o consumidor1 do produtor1\n');
consumidor1.unsubscribe('produtor1');
writeOut(`  consumidor1 assina: ${consumidor1.sources().join(', ')}\n`);
produtor1.emit({ type: 'c' }); // só consumidor2
produtor2.emit({ type: 'd' }); // consumidor1 e consumidor3

for (const consumidor of [consumidor1, consumidor2, consumidor3]) {
  consumidor.unsubscribeAll();
}
produtor1.emit({ type: 'e' }); // ninguém ouve
writeOut('depois de unsubscribeAll, ninguém recebe "e"\n');
```

`bun guides/events/exemplos/2-varios.ts` (saída real):

```text
dois produtores, três consumidores
  consumidor1 ← produtor1: a
  consumidor2 ← produtor1: a
  consumidor1 ← produtor2: b
  consumidor3 ← produtor2: b
desassinar o consumidor1 do produtor1
  consumidor1 assina: produtor2
  consumidor2 ← produtor1: c
  consumidor1 ← produtor2: d
  consumidor3 ← produtor2: d
depois de unsubscribeAll, ninguém recebe "e"
```

### 3. Um consumidor de tudo

`ALL_SOURCES` assina todos os produtores, inclusive os criados depois.

`guides/events/exemplos/3-tudo.ts`:

```ts
/**
 * Exemplo 3 do curso de events: um consumidor de tudo. `ALL_SOURCES` assina
 * todos os produtores, inclusive os que ainda não existem: um painel de
 * depuração, por exemplo.
 *
 *   bun guides/events/exemplos/3-tudo.ts
 */
import {
  ALL_SOURCES,
  createConsumer,
  createProducer,
} from '../../../src/events/index';
import { writeOut } from '../../../src/output/stdio';

const painel = createConsumer((event) => {
  writeOut(`painel ← ${event.source}: ${event.type}\n`);
});
painel.subscribe(ALL_SOURCES);

// Dois produtores criados depois da assinatura: o painel recebe os dois.
createProducer('curso').emit({ type: 'gravado', path: 'guides/x/README.md' });
createProducer('rede').emit({ type: 'negado', host: 'exemplo.com:443' });

painel.unsubscribeAll();
```

`bun guides/events/exemplos/3-tudo.ts` (saída real):

```text
painel ← curso: gravado
painel ← rede: negado
```

### 4. O que vem junto no evento

Fora de um agente, o evento leva o `ts`, os dados e o `source`; dentro de um (`runAs`), também `agent`, `run` e
`agentProvider`. A data e o `run` mudam a cada execução.

`guides/events/exemplos/4-evento.ts`:

```ts
/**
 * Exemplo 4 do curso de events: o que vem junto no evento. Fora de um agente,
 * o `ts`, os dados e o `source`; dentro de um (`runAs`, como tudo o que roda
 * durante um `Agent.run()`), também `agent`, `run` e `agentProvider`. O
 * produtor manda na origem: um `source` nos dados é ignorado.
 *
 *   bun guides/events/exemplos/4-evento.ts
 */
import { runAs } from '../../../src/context/index';
import { createConsumer, createProducer } from '../../../src/events/index';
import { writeOut } from '../../../src/output/stdio';

const curso = createProducer('curso');
const detalhe = createConsumer((event) => {
  writeOut(`${JSON.stringify(event)}\n`);
});
detalhe.subscribe('curso');

curso.emit({ type: 'gravado', path: 'a.md' }); // fora de um agente

runAs(
  { name: 'assistente', provider: { name: 'ollama', model: 'qwen3.5:4b' } },
  () => curso.emit({ type: 'gravado', path: 'b.md' }), // dentro
);

curso.emit({ type: 'gravado', source: 'outro', path: 'c.md' }); // source fica 'curso'

detalhe.unsubscribeAll();
```

`bun guides/events/exemplos/4-evento.ts` (saída real):

```text
{"ts":"2026-11-26T02:17:28.244Z","type":"gravado","path":"a.md","source":"curso"}
{"ts":"2026-11-26T02:17:28.247Z","agent":"assistente","run":"458a17ec-16e7-4c0a-b074-e5fc773580a9","agentProvider":{"name":"ollama","model":"qwen3.5:4b"},"type":"gravado","path":"b.md","source":"curso"}
{"ts":"2026-11-26T02:17:28.247Z","type":"gravado","source":"curso","path":"c.md"}
```

- Um consumidor pode separar os eventos por agente (`event.agent`) ou por execução (`event.run`), mesmo vindo de um
  produtor que não sabe nada de agentes.
- O terceiro evento mandou `source: 'outro'` nos dados, e o evento chegou com `source: 'curso'`: o produtor manda na
  origem.

### 5. Assinar só durante uma tarefa

O consumidor assina no começo e desassina no `finally`, aconteça o que acontecer, como o agente faz a cada conversa.

`guides/events/exemplos/5-durante-uma-tarefa.ts`:

```ts
/**
 * Exemplo 5 do curso de events: assinar só durante uma tarefa. O consumidor
 * assina no começo e desassina no `finally`, aconteça o que acontecer: é o
 * que o agente faz a cada conversa.
 *
 *   bun guides/events/exemplos/5-durante-uma-tarefa.ts
 */
import { createConsumer, createProducer } from '../../../src/events/index';
import { writeOut } from '../../../src/output/stdio';

const pedidos = createProducer('pedidos');

function tarefaComEventos(): void {
  const observador = createConsumer((event) => {
    writeOut(`observador ← ${event.source}: ${event.type}\n`);
  });
  observador.subscribe('pedidos');
  try {
    pedidos.emit({ type: 'criado', id: 3 });
    pedidos.emit({ type: 'pronto', id: 3 });
  } finally {
    observador.unsubscribeAll();
  }
}

tarefaComEventos();
pedidos.emit({ type: 'criado', id: 4 }); // fora da tarefa: ninguém ouve
writeOut('fora da tarefa, o pedido 4 não foi ouvido\n');
```

`bun guides/events/exemplos/5-durante-uma-tarefa.ts` (saída real):

```text
observador ← pedidos: criado
observador ← pedidos: pronto
fora da tarefa, o pedido 4 não foi ouvido
```

[↑ topo](#topo)

## Regras do módulo

**Só o módulo pode:**

- Guardar quem assina cada produtor. O registro não é exportado: só se entra por `subscribe` e só se sai por
  `unsubscribe`/`unsubscribeAll`.
- Pôr `source`, `ts` e o escopo do agente em todo evento. O `source` é sempre o do produtor.

**Ninguém deve:**

- **Esquecer de desassinar.** Um consumidor assinado continua recebendo (e segurando o que a função dele referencia)
  até o processo acabar. Assine e desassine no mesmo lugar, com `try/finally`.
- **Lançar erro num consumidor.** A entrega é síncrona e em sequência, sem `try/catch`: um erro impede os consumidores
  seguintes e sobe para quem chamou `emit`.
- **Usar evento para gravar log ou entregar para fora.** Quem produz decide se o acontecimento também vai para o log,
  chamando o logger à parte (como `publish` faz).
- **Criar produtor com nome vazio ou `'*'`.** `createProducer` recusa.

[↑ topo](#topo)

## Exercícios

1. **Simples.** No Exemplo 1, acrescente uma nota fiscal: um segundo consumidor que, a cada `pedido_feito`, gera a
   nota. Que linha de `fazerPedido` você precisou mudar?
2. **Intermediário.** Um consumidor faz `subscribe(ALL_SOURCES, 'loja')` e a loja emite um pedido. Quantas vezes ele
   recebe esse evento, e por quê? Depois ele chama `unsubscribe('loja')`: continua recebendo os pedidos da loja?
3. **Difícil.** Dois agentes, `a` e `b`, rodam ao mesmo tempo no mesmo processo, e cada um tem uma função em
   `subscribe`. Seguindo o `converse()` de `src/agent/agent.ts`, explique por que a função de `a` não recebe a
   conversa de `b`, e o que aconteceria sem o filtro por `event.agent`. Depois proponha, sem implementar, como o
   módulo poderia deixar o próprio consumidor pedir só os eventos de um agente.

[↑ topo](#topo)
