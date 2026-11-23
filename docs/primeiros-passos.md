# Primeiros passos

Instale o Choliba, escreva um agente de dez linhas e rode-o dentro de uma sandbox.

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
bun add ./choliba-0.1.0.tgz
```

## Escreva um agente

Um agente junta um **provider** (qual CLI roda), um **workspace** (a sandbox onde ela roda), uma **política** (o que ela
pode fazer) e uma **conversa** (com quem ela fala). Salve como `analista.ts`:

```ts
import { Agent, ClaudeProvider, resolve, runScript, Workspace } from 'choliba';

await runScript(async () => {
  await new Agent({
    name: 'analista',
    prompt: 'Analise o projeto.',
    provider: new ClaudeProvider({ model: 'claude-sonnet-5-5' }),
    workspace: new Workspace({
      type: 'bubblewrap',
      root: resolve('storage', 'workspace'),
    }),
  }).run();
});
```

Rode:

```bash
bun analista.ts
```

No terminal, **Ctrl+A** abre as aprovações, **Ctrl+C** para o agente e **Ctrl+D** encerra a conversa.

## Para onde ir

- [Os cursos](/guias/): um por módulo, com exemplos completos que rodam como estão. Comece pelo [agente](/guias/agent).
- [Os comandos](/comandos) do `choliba`: rodadas, aprovações e limpeza.
- A configuração do projeto, em [config](/guias/config).
