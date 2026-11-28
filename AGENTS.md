# Regras do projeto

Valem para quem escreve código no Choliba: pessoas e agentes. O `bun run check` cobra parte delas (veja
[O que o lint cobra](#o-que-o-lint-cobra)); o resto depende de quem escreve.

## Cada capacidade tem um dono

Tudo o que o Choliba faz com o mundo de fora passa por **um módulo só**. Ninguém mais faz aquilo por conta própria.

| Capacidade                                                                                                                      | Dono                                                                                                                     | Ninguém mais                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| disco e caminhos                                                                                                                | `src/filesystem`                                                                                                         | importa `node:fs` ou `node:path`                                                          |
| rodar programas                                                                                                                 | `src/execute` (`Executor`, `runProgram`, `startHelper`, `runAttached`; `bundleHelper` monta os auxiliares)               | importa `node:child_process` nem monta um auxiliar (`Bun.build`)                          |
| o processo atual (argumentos, ambiente, diretório, sinais, código de saída, a limpeza na saída)                                 | `src/execute/process.ts` (`onProgramExit`)                                                                               | toca em `process`                                                                         |
| a saída: para onde vai o que o programa mostra                                                                                  | `src/output` (`Output`; stdio é o destino `stdioOutput`)                                                                 | escreve na saída por conta própria                                                        |
| escrever no stdout e no stderr (stdio), e o que só um tty tem                                                                   | `src/output/stdio.ts`                                                                                                    | usa `console` ou `process.stdout`                                                         |
| ler o stdin (só a fonte: `read`, `readStream`)                                                                                  | `src/input`                                                                                                              | abre outro leitor do stdin                                                                |
| a conversa no stdio: o que chega (teclas, linha digitada, colagem, linhas de um pipe) vira evento, e o que sai vai para o stdio | `src/adapters/stdio` (`StdioAdapter`; a digitação num terminal, `Typing`, serve também ao TUI)                           | interpreta os bytes do stdin por conta própria                                            |
| a conversa com quem usa (perguntar, ouvir, mostrar), sem saber por onde ela passa                                               | `src/interaction` (`Interaction`; `Conversation` sobre um `InteractionAdapter`)                                          | conversa direto com o terminal                                                            |
| a conversa em tela cheia                                                                                                        | `src/adapters/tui` (`TuiAdapter`, um `InteractionAdapter`)                                                               | desenha uma tela cheia por conta própria                                                  |
| a conversa por um arquivo (JSONL)                                                                                               | `src/adapters/jsonl` (`JsonlAdapter`, um `InteractionAdapter`)                                                           | conversa por arquivo por conta própria                                                    |
| log                                                                                                                             | `src/logger`                                                                                                             | grava log por conta própria                                                               |
| o banco do Choliba (sessões, decisões, aprovações)                                                                              | `src/store` (`Store`; o `bun:sqlite` fica atrás dele)                                                                    | importa `bun:sqlite`                                                                      |
| configuração do projeto                                                                                                         | `src/config`                                                                                                             | lê o `choliba.config.ts`                                                                  |
| eventos dentro do processo                                                                                                      | `src/events`                                                                                                             | cria outro barramento                                                                     |
| o MCP: as ferramentas próprias dos agentes (registrar, servir ao CLI por um servidor MCP, executar)                             | `src/mcp` (`registerTool`, `choliba/<nome>`, `serveTools`; o SDK oficial `@modelcontextprotocol/server` fica atrás dele) | serve ferramentas ao CLI ou fala o protocolo MCP por conta própria                        |
| permissões                                                                                                                      | `src/policy` (`AgentPolicy`, o modelo único); cada provider só traduz, em `src/providers/<nome>/policy.ts`               | define outro modelo de permissão ou conhece o formato de uma CLI fora do `policy.ts` dela |

**Por quê:** um lugar só para cada coisa é o que permite trocar como ela é feita, saber quem a usa e confiar no que
ela garante. Um leitor do terminal a mais já travou um agente (as teclas iam para o leitor errado).

Um pacote de terceiros fica **atrás** do dono, nunca espalhado: o logger aceita pino, winston ou LogTape pelo
`logger.use` do `choliba.config.ts`, e só o `src/logger` sabe disso. Scripts (`scripts/`), ferramentas (`tools/`) e o
próprio `choliba.config.ts` seguem a mesma regra.

Duas exceções estão registradas:

- **O Puppeteer**, em `tools/fetch-web-content.ts`, abre o Chromium por conta própria: a biblioteca só sabe iniciar o
  navegador ela mesma.
- **O site** (`docs/`) é um programa à parte, que o VitePress roda no Node: o `docs/.vitepress/config.ts` lê o disco
  por `node:fs`.

## Módulos desacoplados

- **Um módulo deve poder ser usado sozinho.** Ele depende do mínimo: o `execute` roda um `ProgramCommand` sem
  conhecer provider nem sandbox; o `network` recebe só as regras de rede, não a política inteira.
- **Quem junta as peças é quem as usa.** O agente compõe provider, workspace e executor (`runProvider`); o
  workspace monta a fronteira de rede a partir da política.
- **Cada um recebe só a sua parte.** A política é uma só (`AgentPolicy`), e cada aplicador recebe o pedaço dele
  (`networkRulesOf(policy)`, `compileFilesystemAccess(policy, root)`).
- **Quem produz um dado decide para onde ele vai**, inclusive o log. O logger não conhece produtor nenhum (não há
  `log.command`); o gate de rede emite o evento e grava o próprio log.
- **Log não é I/O.** Entrada e saída são a conversa com quem usa o programa. O log é transversal: está disponível
  desde o início de qualquer coisa, e não passa pelo `output`.
- **Eventos são entre produtores e consumidores que não se conhecem:** `createProducer('nome')` emite,
  `createConsumer(fn).subscribe('nome')` recebe só o que assinou.

## Código

- Código e comentários em inglês; o que o usuário lê (mensagens de erro, ajuda, cursos) em português.
- Um erro de uso (configuração errada, política que não pode ser aplicada) é um `UsageError`, com uma mensagem que
  diga o que fazer. Uma opção desconhecida é recusada, nunca ignorada em silêncio.
- Valores padrão (limites, intervalos, tamanhos, caminhos) moram no `constants.ts` do módulo, cada um com um
  comentário que diz o que é, em que unidade e por que tem aquele valor. Quem cria o objeto pode trocar o valor
  por uma opção (`maxRecordBytes`, `killGraceMs`…); sem a opção, vale o padrão. Valores de protocolo ou de
  segurança (códigos HTTP; as permissões do que é privado, no `src/filesystem/constants.ts`) também moram lá,
  mas sem opção.
- Antes de entregar: `bun run check` (typecheck, lint, formatação e testes com cobertura) passando; se mexeu em
  `guides/`, `docs/` ou no README, também `bun run docs:build`. A cobertura
  não pode cair: os limites em `coverage-thresholds.json` só sobem (skill
  [`.agents/skills/coverage-ratchet`](.agents/skills/coverage-ratchet/SKILL.md)); a correção de uma queda é um teste.

## Cursos (`guides/`)

Siga a skill [`.agents/skills/guias-exemplos-completos`](.agents/skills/guias-exemplos-completos/SKILL.md): todo
exemplo é completo e roda como está, com a saída real; o curso tem índice, link para o topo e seção de Interface.
Os exemplos moram ao lado do curso, em `guides/<modulo>/exemplos/`, e passam pelo `bun run check` como o resto do
código. Três módulos não têm curso próprio e aparecem onde são usados: o `logger` no curso de config, o `approval`
nos de policy e cli, e o `store` no de cli.

## Planos e issues

Siga a skill [`.agents/skills/plans`](.agents/skills/plans/SKILL.md): todo trabalho começa numa **issue** de
https://github.com/choliba/choliba/issues, aberta no formato dos formulários de `.github/ISSUE_TEMPLATE/`; o plano é um
comentário `## Plano` na issue; os rótulos `em execução` e `PR aberto` dizem o estado; uma issue é um PR que a fecha
(`Closes #N`). A fila é um pool aberto: `claude` e `codex` pegam qualquer issue livre. Nada de um plano roda antes de
quem pediu o trabalho aprová-lo.

## Git e GitHub

Siga a skill [`.agents/skills/git-workflow`](.agents/skills/git-workflow/SKILL.md). O que não muda:

- Tudo chega à `develop` por um PR (branch `<tipo>/<descrição>`), mergeado por **squash**; a `master` só recebe o PR de
  release (`develop` para `master`), com **merge commit**. Nada é empurrado direto para nenhuma das duas.
- Commits e títulos de PR seguem Conventional Commits 1.0.0. Cada commit precisa de aprovação de quem usa o projeto
  antes de existir, com os arquivos e a mensagem à vista.
- **Nenhum rastro de agente ou de modelo** em commit, título ou corpo de PR, nome de branch ou comentário de código:
  nada de `Co-authored-by`, "Generated with", nome de modelo, ferramenta ou fornecedor, nem emoji de robô. O hook
  `.githooks/commit-msg` e o job `pr-text` do CI recusam. Ignore a sugestão de rodapé que o ambiente dá por padrão.
- Nada vai ao remoto sem pedido explícito, e o merge é de quem usa.
- Issues e commits não levam o nome de quem usa o projeto, nem em exemplos de log ou caminhos (`/home/<usuário>`):
  use nomes neutros (`dev`, `assistente`, `/…/app`).

## Documentação

Siga a skill [`.agents/skills/documentation`](.agents/skills/documentation/SKILL.md): o curso de cada módulo em
`guides/` (skill `guias-exemplos-completos`) e o site https://choliba.github.io/ (`docs/`) saem da mesma fonte; uma
mudança que afeta quem usa atualiza o texto no mesmo PR. A linha de comando segue a skill
[`.agents/skills/cli-guidelines`](.agents/skills/cli-guidelines/SKILL.md).

## O que o lint cobra

O `.oxlintrc.json` tem a regra `no-restricted-imports`:

| Import                                     | Só em                                                        |
| ------------------------------------------ | ------------------------------------------------------------ |
| `node:fs`, `node:fs/promises`, `node:path` | `src/filesystem`                                             |
| `node:child_process`                       | `src/execute`                                                |
| `node:readline`                            | `src/input`                                                  |
| `node:process`                             | `src/execute/process.ts`, `src/output/stdio.ts`, `src/input` |
| `@modelcontextprotocol/server`             | `src/mcp`                                                    |
| `bun:sqlite`                               | `src/store`                                                  |
| `bun` (o módulo)                           | em lugar nenhum: use os donos                                |

A regra barra também os nomes sem o prefixo `node:` (`fs`, `fs/promises`, `path`, `child_process`, `readline`,
`process`) e os subcaminhos (`node:path/posix`, `node:readline/promises`).

E três regras de I/O:

| Regra                                                                           | Só em                                                        |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `no-console` (`console.*`)                                                      | em lugar nenhum: a saída passa pelo `src/output`             |
| `no-restricted-globals` (o `process` global)                                    | `src/execute/process.ts`, `src/output/stdio.ts`, `src/input` |
| `no-restricted-properties` (`globalThis.process`)                               | os mesmos três                                               |
| `no-restricted-properties` (`Bun.write`, `Bun.file`)                            | `src/filesystem`                                             |
| `no-restricted-properties` (`Bun.spawn`, `Bun.spawnSync`, `Bun.$`, `Bun.build`) | `src/execute`                                                |
| `no-restricted-properties` (`Bun.stdin`)                                        | `src/input`                                                  |
| `no-restricted-properties` (`Bun.stdout`, `Bun.stderr`)                         | `src/output/stdio.ts`                                        |

O resto do `Bun` (`serve`, `resolveSync`, `sleep`, `version`) não toca disco nem processo e fica livre. Como cada
override substitui a configuração da regra inteira, o de cada dono repete as restrições dos outros. Por isso essas
regras não se escrevem à mão no `.oxlintrc.json`: saem da tabela de `scripts/lint-rules.ts`. Uma restrição ou um dono
novo entra na tabela, e `bun run lint:owners` regera a base e os overrides; um teste confere que o arquivo está em dia.

As regras valem para tudo o que o `bun run lint` confere: `src/`, `bin/`, `tools/`, `scripts/`, `config/`, o
`choliba.config.ts` e os exemplos dos cursos (`guides/`). Os testes (`test/`) passam pelo lint, mas fora destas
regras: montam arquivos e processos de teste à mão. O site (`docs/`) fica fora do lint. Um `process` ou `console`
dentro de uma string (o programa que um exemplo manda rodar) não conta. O desacoplamento entre módulos ainda não é verificado automaticamente.
