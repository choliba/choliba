# Primeiros passos

> Instale o Choliba, escreva um agente de dez linhas e rode-o dentro de uma sandbox. Você precisa do Bun, de Linux com bwrap ou do Docker e da CLI do agente.

## Antes de começar

Você precisa de:

- o [Bun](https://bun.sh);
- Linux com `bwrap` e `nsenter` (para o workspace `bubblewrap`) ou o Docker;
- a CLI que o agente vai usar: `claude`, `codex`, `agent` ou o [Ollama](https://ollama.com).

## Instale o pacote

O Choliba é um pacote Bun. Num projeto que já usa o Bun, instale do repositório:

```bash
bun add github:choliba/choliba
```

Ou baixe o `choliba-<versão>.tgz` da [última release](https://github.com/choliba/choliba/releases) e instale o arquivo:

```bash
bun add ./choliba-0.1.1.tgz
```

## Configure o projeto

O `choliba.config.ts`, na raiz do projeto, diz onde o Choliba guarda o log, o banco e as sandboxes dos agentes. Crie-o:

```ts
import { defineConfig } from 'choliba';

export default defineConfig({
  logger: { dir: 'storage/logs' },
  database: { dir: 'storage/db', name: 'choliba.db' },
  workspaces: {
    dir: 'storage/workspaces',
    homes: 'storage/homes',
  },
});
```

- `logger.dir`: o log de cada sessão, em JSONL.
- `database`: o banco SQLite com as sessões, as decisões e as aprovações.
- `workspaces.dir`: a pasta onde o agente trabalha. `workspaces.homes`: o home da CLI de cada workspace, com as sessões e o histórico dela.

Os caminhos são relativos ao arquivo. O Choliba o procura da pasta atual para cima, e importar `choliba` já o carrega. Sem o arquivo valem os padrões, dentro de `.choliba/`; uma opção que não existe é recusada, nunca ignorada. Ponha `storage/` no `.gitignore`: o log, o banco e as sandboxes são do seu ambiente, não do projeto. Todas as opções estão no curso de [config](/guias/config).

## Escreva um agente

Um agente junta um **provider** (qual CLI roda), um **workspace** (a sandbox onde ela roda), uma **política** (o que ela
pode fazer) e uma **conversa** (com quem ela fala). Salve como `analista.ts`:

```ts
import {
  Agent,
  ClaudeProvider,
  getConfig,
  runScript,
  Workspace,
} from 'choliba';

await runScript(async () => {
  await new Agent({
    name: 'analista',
    prompt: 'Analise o projeto.',
    provider: new ClaudeProvider({ model: 'claude-sonnet-5-5' }),
    workspace: new Workspace({
      type: 'bubblewrap',
      root: getConfig().workspaces.dir,
    }),
  }).run();
});
```

A raiz da sandbox vem da configuração: `getConfig().workspaces.dir` é o `workspaces.dir` do arquivo que você acabou de criar.

Rode:

```bash
bun analista.ts
```

No terminal, **Ctrl+A** abre as aprovações, **Ctrl+C** para o agente e **Ctrl+D** encerra a conversa.

## Para onde ir

- [Os cursos](/guias/): um por módulo, com exemplos completos que rodam como estão. Comece pelo [agente](/guias/agent).
- [Os comandos](/comandos) do `choliba`: rodadas, aprovações e limpeza.
- A configuração do projeto, em [config](/guias/config).
