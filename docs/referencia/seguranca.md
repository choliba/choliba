# Segurança

> Como o choliba restringe o que cada agente alcança: as permissões do `agent.yaml`, os MCPs declarados e as regras
> que valem em qualquer provider.

Os agentes rodam comandos e mexem em arquivos, então o choliba restringe o que cada um alcança, a partir do
`permissions` do [`agent.yaml`](../guias/escrever-um-agente.md):

- **Negado por padrão, em qualquer lugar.** O agente só lê, escreve e roda o que está em `permissions.allow`, no
  workspace ou fora dele; `deny` prevalece sobre `allow`, menos no que uma exceção `!` do deny tira dele. O choliba escreve as permissões no prompt e as aplica no
  provider. Cada execução roda numa pasta vazia, `.cache/runs/<id>/`, criada antes e apagada depois, porque os dois
  providers liberam tudo na pasta em que rodam. No Claude, as regras dizem exatamente onde ele lê e escreve, e ele
  só tem as ferramentas que as permissões pedem. No Cursor, que não trata `allow` como limite, o choliba gera um
  `deny` para todo o resto do disco e grava o `cli.json` nessa pasta da execução: é o diretório em que o
  cursor-agent nasce, e sem um raiz de git ele só lê o `cli.json` dali. O de `~/.cursor` continua de base; as
  listas `allow` e `deny` da run substituem as dele. O `mcp.json` fica na raiz do workspace. O `Grep` e o `Glob` do Cursor
  leem o que um `deny` de leitura cobre, e nenhuma permissão os tira: o prompt diz ao modelo para nunca usá-los, e o
  choliba interrompe a execução na primeira chamada a um deles, com código 1. Limite do Cursor: um
  arquivo **novo**, criado direto numa pasta do caminho até um item liberado (a raiz do workspace, por exemplo),
  não é bloqueado.
- **Caminhos.** Caminho relativo é relativo à raiz do workspace. Um caminho sem glob é o item e tudo abaixo dele,
  com ou sem `/` no fim, em qualquer provider: o choliba entrega a cada um o glob explícito. Num glob, o Cursor libera
  a pasta antes dele inteira.
- **Exceções no deny.** Em `deny.read`, `deny.write` e `deny.delete`, `!caminho` tira esse caminho de um deny da
  mesma lista, como no `.gitignore` (veja
  [Exceções no deny](agent-yaml.md#exceções-no-deny)). Nenhum provider entende `!`, então o choliba
  resolve antes: o deny que contém a exceção vira tudo o que há dentro dele, menos o caminho até ela, lido do disco
  no começo da execução. Assim Claude e Cursor recebem regras que não se contradizem e chegam ao mesmo resultado.
  Limite: o que for criado depois, numa dessas pastas, fica fora do deny (no Claude continua bloqueado, porque nada
  o libera).
- **Skills.** A pasta de cada skill declarada fica liberada para leitura e é uma exceção dos `deny.read` do agente:
  declarar a skill é pedir para lê-la. Vale só para essa pasta, não para `.choliba/skills/` inteira.
- **`--add-dir <pasta>`** libera a leitura de uma pasta a mais só naquela execução (pode repetir), como se ela
  estivesse em `allow.read`; o `deny` do agente continua valendo por cima dela.
- **Execução por diretório.** Os comandos rodam a partir da pasta da execução, dentro do workspace (por isso
  `bunx choliba ...` funciona sem `cd`). Um diretório de `execute` fora do workspace precisa estar em `allow.read`,
  porque rodar comandos nele já dá acesso ao que há lá. Os providers aplicam em que diretórios o agente entra e
  quais comandos roda, mas não o vínculo "este comando só neste diretório": na prática vale a união dos dois.
- **Ferramentas da run.** O que só os agentes usam (apagar, o navegador, o leitor de trace) não é comando público do
  choliba: é um script que ele cria ao lado da pasta da execução, libera só para aquela sessão, nega para escrita e
  apaga no fim. O apagar resolve cada caminho antes de agir e recusa o que sai de `allow.delete`. Veja
  [Ferramentas da run](agent-yaml.md#ferramentas-da-run).
- **Nenhum agente delega.** Nenhum agente chama um subagente nem põe outro agente para trabalhar por ele, e isso não
  se configura. O prompt de todo agente diz isso. No Claude, a ferramenta de subagente (`Agent`) nem existe na
  sessão. O Cursor não tem permissão que a tire, então o choliba interrompe a execução no primeiro `Task`, com
  código 1.
- **MCP só declarado.** O agente só usa os servidores e as tools de `mcps`. O prompt diz isso, e o choliba
  confere cada chamada: um servidor ou uma tool fora do declarado (ou procurar tools de MCP num agente sem `mcps`)
  interrompe a execução com código 1, em qualquer provider. No Claude, a sessão só tem os servidores declarados. No
  Cursor, que soma os MCPs do `~/.cursor/mcp.json` do usuário, o choliba também nega os que o agente não declara.
- **`steps` não passam pelas permissões.** Os passos são executados pelo choliba, fora da sessão do modelo: um
  passo pode fazer o que o modelo não pode (o `docs-updater` proíbe o modelo de rodar o Prettier e o roda no
  `steps.execute.after`). Veja [Steps](agent-yaml.md#steps).

## O container

As regras acima são aplicadas pelo próprio provider, e cada um tem os limites descritos. Com `CHOL_SANDBOX=docker` no
`.env`, o provider roda num container que só enxerga o que o agente alcança, e esses limites deixam de importar: o
que não está montado não existe lá dentro, para nenhuma ferramenta do provider, nenhum comando que ele rode e nenhum
MCP que ele suba.

- **O que o container vê**, cada caminho no mesmo caminho absoluto: com leitura, `allow.read`, as skills, o
  `--add-dir`, os diretórios de `execute` (um comando precisa enxergar onde roda), as ferramentas da run e o
  `node_modules` da pasta de trabalho; com escrita, a pasta da execução, `allow.write` (fora de `plan` e `ask`), a
  saída das ferramentas do Playwright e o `ticket-runs/` do projeto. Um `deny.read` dentro disso aparece vazio; um
  `deny.write` dentro de algo com escrita volta a ser só leitura. Um arquivo que o agente pode criar e ainda não
  existe abre a pasta dele; as regras do provider, que continuam valendo lá dentro, limitam ao arquivo.
- **O que ele não vê**: o resto do disco, a sua pasta pessoal (a do container é vazia e some no fim) e o socket do
  Docker. Roda com o seu usuário, na rede da máquina (a aplicação e os MCPs em `localhost` respondem), com a raiz
  só de leitura e sem capabilities. Navegar não escapa: `cd / && ls` mostra a raiz da imagem, e uma pasta acima
  de uma montagem (`/home/<você>`) só tem o caminho até ela.
- **As pastas do sistema são da imagem**: `/` inteira, `/usr`, `/bin`, `/sbin`, `/lib*`, `/etc`, `/opt`,
  `/ms-playwright`, `/root`, `/boot`, `/dev`, `/proc`, `/sys`, `/run` e a home do container nunca vêm desta
  máquina. Um `allow` com uma delas, ou com algo dentro (`/etc/passwd`), não é montado: o agente vê a versão da
  imagem, e o choliba avisa no início da execução e no `--dry-run` (`ignorado /etc/passwd (da imagem)`). Os seus
  dados, em qualquer outro lugar (`/home/...`, `/var/www/...`, `/srv`, `/mnt`, `/tmp/...`), continuam liberáveis.
  Uma pasta de trabalho em `/` não é montada inteira pelo mesmo motivo.
- **A credencial do provider** entra por variável de ambiente: `CLAUDE_CODE_OAUTH_TOKEN` (gerado por
  `claude setup-token`, usa a assinatura e só chama o modelo) ou `ANTHROPIC_API_KEY`, e `CURSOR_API_KEY`. O agente
  consegue lê-la, como consegue fora do container: prefira o token, que não serve para mais nada.
- **A imagem** traz o Node e os navegadores do Playwright da versão do choliba, o Bun, o Claude Code e o Cursor CLI.
  Construa-a uma vez na raiz do repositório do choliba: `docker build -f docker/agent.Dockerfile -t choliba-agent .`
  (outra imagem: `CHOL_SANDBOX_IMAGE`).
- O [`--dry-run`](comandos.md#--dry-run) mostra o container e cada caminho que ele vê.

Testado no Linux. No macOS e no Windows, a rede da máquina (`--network host`) ainda não é tratada.
