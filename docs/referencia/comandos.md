# Comandos

> Cada comando do choliba, instalado na pasta de trabalho: agentes, testes, projetos, check, lint, format e setup.

O comando é `choliba` (alias `chol`), instalado na pasta de trabalho; `bunx choliba` roda o mesmo.

| Comando                                      | O que faz                                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `choliba agents COMMAND [OPTIONS] [TASK...]` | Roda um agente da pasta de trabalho (`.choliba/agents/<nome>/`); `choliba <agente>` é atalho |
| `choliba projects COMMAND [ARGS]`            | Lista e confere projetos e tickets em `CHOL_PROJECTS_DIR`                                    |
| `choliba tests [PROJECT[:TICKET]] [OPTIONS]` | Roda os testes E2E dos projetos com o Playwright                                             |
| `choliba check`                              | Confere a pasta de trabalho: agentes (schemas, skills, MCPs) e projetos                      |
| `choliba lint`                               | ESLint na pasta de trabalho, com a configuração que vem no choliba                           |
| `choliba format`                             | Prettier na pasta de trabalho: confere, ou corrige com `--write`                             |
| `choliba setup`                              | Liga o autocomplete no bash (roda sozinho ao instalar com `--trust`)                         |

`choliba --help` (ou `choliba COMMAND --help`) lista os comandos. `choliba setup` também prepara a pasta de
trabalho na instalação; o que ele cria está em [Primeiros passos](../primeiros-passos.md#choliba-setup).

`choliba terminal run` não aparece nessa lista. Ele roda um processo e rotula cada linha da saída, para um script:

```
choliba terminal run --label demo -- echo ok
```

A linha sai como `[demo] ok`, e o código de saída é o do processo.

`choliba --version` mostra a versão instalada no formato [SemVer](https://semver.org/lang/pt-BR/): a base da
pré-release, o número da release (a contagem das releases, que aparece no título de cada atualização nas notas) e,
como metadado de build, o commit, por exemplo `choliba 0.0.1-dev.16+1a2b3c4`. Rodando dos fontes ou de um `chol:pack` local, sai só a base (`0.0.1-dev`).

Cores: a saída só tem cor num terminal. `--no-color` (em qualquer comando), `NO_COLOR=1`, `FORCE_COLOR=0`, `TERM=dumb`
ou um pipe tiram a cor; `FORCE_COLOR=1` força. Quais cores usar vem de `CHOL_COLORS` no `.env` (veja
[`.env` da pasta de trabalho](env.md)) e, para o rótulo de um agente, do `agent.color` dele.

Um comando de agente passa pelo [ciclo de execução](ciclo-de-execucao-agente.md): o choliba antes, o modelo, o choliba
depois.

## `--dry-run`

`--dry-run` mostra, na ordem, o que o comando faria sem ele, e **não executa nada**: nenhum step, nenhum ticket,
nenhuma pasta de execução, nenhum provider. Vale em qualquer modo. Ele só lê o que precisa para montar a lista (o
`agent.yaml`, as skills, os MCPs, o projeto e o ticket), então um problema que faria a execução falhar antes do
agente aparece do mesmo jeito.

```
$ bunx choliba docs-updater --mode plan --dry-run
Sem --dry-run, faria nesta ordem:

 1. [CLI]    plan.before 1/3 — git_diff: develop .cache/docs-updater/diff.patch --pending …
             se falhar: para aqui, o agente não roda
 2. [CLI]    plan.before 2/3 — add_files: documentacao_atual docs/**/*.md
             se falhar: para aqui, o agente não roda
 3. [CLI]    plan.before 3/3 — add_files: readme_atual README.md
             se falhar: para aqui, o agente não roda
 4. [agente] claude · modelo padrão do provider · modo plan · na pasta .cache/runs/<id>
             skills: documentation · MCPs: nenhum
             prompt de sistema: 5953 bytes · prompt do usuário: 444 bytes (--show-prompt mostra os dois)
             comando: claude -p <prompt do usuário> --output-format stream-json --verbose …
 5. [CLI]    plan.after.success (se o agente sair com 0): nada
             plan.after.failure (se o agente falhar): nada
             plan.after.always:
               1/1 run: rm -f .cache/docs-updater/diff.patch
```

Com `--show-prompt` (só junto de `--dry-run`), a saída segue com os dois prompts completos, a linha de comando
completa (em JSON, um argumento por item) e, no Cursor, o `.cursor/cli.json` da pasta da execução e o
`.cursor/mcp.json` da raiz, como seriam gravados.

## A aplicação do projeto

O choliba deixa a aplicação do projeto pronta, pelo ambiente ativo do `config.json`, em dois momentos: antes de
rodar o Playwright no `choliba tests`, e antes de qualquer agente rodado com `--project` (antes até dos `before` dele):

1. Roda cada comando de `envs[].setup` em `appDir`, em ordem (por exemplo, `["bun install"]`). Um que falha para
   tudo: `a aplicação não ficou pronta: "<comando>" saiu com código N`. Numa rodada de vários tickets, o setup roda
   uma vez só.
2. Confere o `baseURL`. Uma aplicação que já está no ar, como a que você subiu, é usada como está, e continua no ar
   depois.
3. Fora do ar, com `envs[].start`, sobe a aplicação em `appDir`, espera ela responder (até 3 minutos) e a derruba
   no fim, também quando a execução é interrompida. No `choliba tests`, o log do servidor sai junto com o dos
   testes. Numa execução de agente, ele vai para `.cache/app/<projeto>.log`. Se ela não sobe:
   `a aplicação não subiu (envs[].start): …`, com o fim do log.
4. Fora do ar e sem `envs[].start`, a execução de um agente para antes dele (`a aplicação não responde em … e o
ambiente … não tem envs[].start`). No `choliba tests`, `--expect` falha com
   `a aplicação não respondeu no baseURL: …`.

Os dois campos são opcionais. Um projeto com `global-setup.ts`, como o `exemplo`, continua subindo a aplicação por
ele nos testes. O [`--dry-run`](#--dry-run) de um agente mostra o que seria feito, sem subir nada.

Os agentes nunca sobem, derrubam ou simulam a aplicação, nem mexem nas dependências instaladas dela: todo agente
rodado com `--project` recebe essa regra no prompt, e o choliba nega a ele escrever em `<appDir>/node_modules/`.

## Critérios de aceite e portões

### Critérios de aceite

Cada critério do ticket (`criterios[]`) tem um `id` (`CA-01`, `CA-02`…) e uma `descricao` em Gherkin: uma lista de
frases, uma por passo. A primeira começa com `Dado`, depois vêm um `Quando` e um `Então`, nessa ordem; `E` e `Mas`
continuam qualquer um deles:

```json
{
  "id": "CA-01",
  "descricao": ["Dado que estou na página da loja", "E ainda não assinei a newsletter", "Quando informo meu e-mail e clico em Assinar", "Então vejo a mensagem \"Obrigado por assinar!\"", "Mas não recebo nenhum aviso de erro"],
  "testes": []
}
```

Não existe `Ou`: um resultado com "ou" são dois comportamentos, e cada um vira um critério. Uma execução que deixa um
critério fora desse formato (ou com `CHANGE_ME`) falha, dizendo qual frase corrigir.

### Portões dos testes de um ticket

`choliba tests PROJECT:TICKET --expect red|green [--failures ARQUIVO]` roda os testes de um ticket e confere o que
eles mostram. É assim que os agentes `test-writer` e `implementer` garantem o TDD:

- **`--expect red`**: todo critério do ticket tem teste, nenhum quebra no próprio código nem é pulado, e **pelo
  menos um falha pelo comportamento** (há o que implementar). Um critério cujos testes já passam fica como **já
  atendido**: o teste continua valendo como proteção contra regressão. Se todos passam, o portão recusa (nada a
  implementar).
- **`--expect green`**: todos os testes do ticket passam, inclusive os dos critérios já atendidos.
- **`--failures ARQUIVO`**: grava, em Markdown, os critérios a implementar com a falha de cada teste e, por último,
  os já atendidos. O `test-writer` grava esse arquivo no seu `steps.execute.after.success`, e o `implementer` o
  confere e o põe no prompt no seu `steps.<modo>.before` (veja
  [Ciclo de execução de um agente](ciclo-de-execucao-agente.md)).

### Quando um ticket substitui outro

Um ticket novo pode tornar errado o que um ticket antigo pede: o antigo exige o link "Blog", o novo o tira. Os testes
do antigo continuam valendo como regressão, então quebrariam assim que o novo fosse implementado. O campo
`substitui` do ticket novo diz quais critérios ele aposenta:

```json
"substitui": ["minha-app-1:CA-03", "minha-app-1:CA-04"]
```

Cada item é `<ticket>:<critério>`, ou só `<ticket>` para todos os critérios dele. O ticket antigo não muda: fica como
histórico.

- **Os testes aposentados saem das rodadas do projeto** (`choliba tests minha-app`, `choliba tests minha-app/tests` e
  as rodadas dos agentes). Cada rodada começa dizendo o que ficou de fora:
  `aposentados: minha-app-1 CA-03, CA-04 (substituídos por minha-app-2)`. Um ticket com todos os critérios
  aposentados não roda no lote.
- **Rodar o ticket antigo sozinho** (`choliba tests minha-app:1`) ainda roda os testes dele, com um aviso. Com
  `--expect`, falha: não há o que conferir num critério substituído.
- **Uma referência inválida** (ticket ou critério que não existe, ou o próprio ticket) faz as rodadas do projeto
  falharem e o `choliba check` marcar o projeto com `✗`.

O `product-owner` lê os outros tickets do projeto e preenche o `substitui` quando a história nova troca um
comportamento que outro ticket descreve. O `implementer` para e avisa quando um teste de outro ticket contradiz o seu
sem estar em `substitui`.

## Autocomplete

O Tab completa comandos, opções e nomes (agentes, projetos, tickets) em `choliba`, `chol`, `bunx choliba` e
`bun chol:*`, no bash. Ele liga sozinho no `choliba setup`.

Se o Tab não completar no terminal que já estava aberto, abra outro ou rode `source ~/.bashrc`. O script fica em
`~/.local/share/choliba/completion.bash`, carregado por um bloco do `~/.bashrc` que começa com
`# Autocomplete do choliba`; apague esse bloco para desligar.
