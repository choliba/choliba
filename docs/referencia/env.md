# `.env` da pasta de trabalho

> Cada variável do `.env` da pasta de trabalho: onde ficam projetos, agentes, skills e MCPs, qual provider roda os
> agentes e as cores da saída.

Para ver o valor em vigor de cada uma e de onde ele vem (o ambiente, o `.env` ou o padrão), rode
`choliba list config`; as credenciais aparecem só como `definida` ou `não definida`.

Para gravar uma delas no `.env`, rode `choliba set config CHAVE valor`, por exemplo
`choliba set config CHOL_SANDBOX docker`. O comando grava uma chave por vez e diz o valor anterior. Uma chave com uma
lista de valores só aceita um deles. Se o ambiente do processo define a chave, ele vence o `.env`, e o comando avisa.
Uma credencial (`CLAUDE_CODE_OAUTH_TOKEN`, `CURSOR_API_KEY`) não vai na linha de comando, porque ficaria no histórico
do shell. Rode `choliba set config CURSOR_API_KEY` sem o valor: num terminal, o choliba pede o valor sem mostrar o
que é digitado; fora de um terminal, lê do stdin (`echo "$TOKEN" | choliba set config CURSOR_API_KEY`).

Quais destes valores o `agent.yaml` pode usar, e como: veja [Variáveis](agent-yaml.md#variáveis). As credenciais de um
projeto ficam no `.env.json` dele, não aqui: [`.env.json` do projeto](env-json.md).

Cada pacote declara o próprio grupo. `choliba list config` mostra os grupos nesta ordem: `agents`, `projects`,
`sandbox` e `choliba`.

| Grupo      | Variável                         | Para quê                                                                                                                                                                                                         |
| ---------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agents`   | `CHOL_AGENTS_PROVIDER`           | Provider padrão (`auto`, `claude`, `claude-ollama` ou `cursor`; padrão `auto`); `--provider` na linha de comando vence.                                                                                          |
| `agents`   | `CHOL_OLLAMA_URL`                | Onde o provider `claude-ollama` encontra o Ollama (padrão `http://localhost:11434`); veja [Modelos do Ollama](agent-yaml.md#modelos-do-ollama).                                                                  |
| `agents`   | `CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR` | Onde a ferramenta `playwright-cli` grava arquivos e onde `playwright-trace` roda; padrão `.cache/playwright-cli`.                                                                                                |
| `agents`   | `CHOL_AGENTS_DIR`                | Pasta dos agentes (padrão `.choliba/agents`).                                                                                                                                                                    |
| `agents`   | `CHOL_SKILLS_DIR`                | Pasta das skills (padrão `.choliba/skills`).                                                                                                                                                                     |
| `agents`   | `CHOL_MCPS_DIR`                  | Pasta dos MCPs (padrão `.choliba/mcps`).                                                                                                                                                                         |
| `agents`   | `CLAUDE_CODE_OAUTH_TOKEN`        | Com `CHOL_SANDBOX=docker`, token de autenticação do provider correspondente. É uma credencial e nunca aparece em listagens.                                                                                      |
| `agents`   | `CURSOR_API_KEY`                 | Com `CHOL_SANDBOX=docker`, chave de usuário do provider correspondente. É uma credencial e nunca aparece em listagens.                                                                                           |
| `projects` | `CHOL_GLOBAL_DIR`                | Raiz dos artefatos e, sem `CHOL_PROJECTS_DIR`, dos projetos (`CHOL_GLOBAL_DIR/projects`). O `setup` preenche com `.cache/choliba` da pasta de trabalho.                                                          |
| `projects` | `CHOL_PROJECTS_DIR`              | Onde ficam os projetos, se não em `CHOL_GLOBAL_DIR/projects`. O `setup` preenche com `projects/` da pasta de trabalho.                                                                                           |
| `projects` | `CHOL_TICKET_RUNS`               | Raiz opcional de `ticket-runs/`; sem ela, usa `CHOL_PROJECTS_DIR`.                                                                                                                                               |
| `sandbox`  | `CHOL_SANDBOX`                   | Onde o provider roda: `local` (padrão) ou `docker`; veja [Sandbox](sandbox.md).                                                                                                                                  |
| `sandbox`  | `CHOL_SANDBOX_IMAGE`             | Imagem do sandbox Docker (padrão `choliba-agent`).                                                                                                                                                               |
| `sandbox`  | `CHOL_NETWORK`                   | Rede do container: `isolated` (padrão) ou `host`; veja [Rede](sandbox.md#rede).                                                                                                                                  |
| `choliba`  | `CHOL_COLORS`                    | Cores no formato `papel.nome=cor`, separadas por vírgula. Papéis: `providers`, `agents`, `states`, `gates`, `labels`. Aceita as 16 cores do terminal; os padrões estão comentados no `.env` criado pelo `setup`. |
