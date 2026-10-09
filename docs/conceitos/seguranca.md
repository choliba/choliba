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
  listas `allow` e `deny` da run substituem as dele. O `mcp.json` fica na raiz do workspace. Limite do Cursor: um
  arquivo **novo**, criado direto numa pasta do caminho até um item liberado (a raiz do workspace, por exemplo),
  não é bloqueado.
- **Caminhos.** Caminho relativo é relativo à raiz do workspace. Um caminho sem glob é o item e tudo abaixo dele,
  com ou sem `/` no fim, em qualquer provider: o choliba entrega a cada um o glob explícito. Num glob, o Cursor libera
  a pasta antes dele inteira.
- **Exceções no deny.** Em `deny.read`, `deny.write` e `deny.delete`, `!caminho` tira esse caminho de um deny da
  mesma lista, como no `.gitignore` (veja
  [Exceções no deny](../referencia/agent-yaml.md#exceções-no-deny)). Nenhum provider entende `!`, então o choliba
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
  [Ferramentas da run](../referencia/agent-yaml.md#ferramentas-da-run).
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
  `steps.execute.after`). Veja [Steps](../referencia/agent-yaml.md#steps).
