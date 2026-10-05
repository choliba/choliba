# Segurança

Os agentes rodam comandos e mexem em arquivos, então o choliba restringe o que cada um alcança, a partir do
`permissions` do [`agent.yaml`](../guias/escrever-um-agente.md):

- **Negado por padrão, em qualquer lugar.** O agente só lê, escreve e roda o que está em `permissions.allow`, no
  workspace ou fora dele; `deny` prevalece sobre `allow`. O choliba escreve as permissões no prompt e as aplica no
  provider. Cada execução roda numa pasta vazia, `.cache/runs/<id>/`, criada antes e apagada depois, porque os dois
  providers liberam tudo na pasta em que rodam. No Claude, as regras dizem exatamente onde ele lê e escreve, e ele
  só tem as ferramentas que as permissões pedem. No Cursor, que não trata `allow` como limite, o choliba gera um
  `deny` para todo o resto do disco. Limite do Cursor: um arquivo **novo**, criado direto numa pasta do caminho até
  um item liberado (a raiz do workspace, por exemplo), não é bloqueado.
- **Caminhos.** Caminho relativo é relativo à raiz do workspace. As pastas das skills declaradas ficam liberadas para
  leitura sozinhas. Num glob, o Cursor libera a pasta antes dele inteira.
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
- **`steps` não passam pelas permissões.** Os passos são executados pelo choliba, fora da sessão do modelo: um
  passo pode fazer o que o modelo não pode (o `docs-updater` proíbe o modelo de rodar o Prettier e o roda no
  `steps.execute.after`). Veja [Steps](../referencia/agent-yaml.md#steps).
