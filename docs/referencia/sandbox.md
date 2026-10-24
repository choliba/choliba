# Sandbox

> Onde o provider roda: na sua máquina (`local`) ou num container Docker que só enxerga o que o agente alcança
> (`docker`).

`CHOL_SANDBOX`, no `.env` da pasta de trabalho, escolhe onde o provider roda:

| Valor            | Onde roda                         | Quem limita o agente                                                      |
| ---------------- | --------------------------------- | ------------------------------------------------------------------------- |
| `local` (padrão) | na sua máquina, dentro do `bwrap` | o `bwrap`, com o mesmo recorte do container, e as regras do provider      |
| `docker`         | num container                     | o container, que só monta o que o `agent.yaml` libera, e as mesmas regras |

As permissões são as mesmas nos dois: as do [`agent.yaml`](agent-yaml.md), descritas em [Segurança](seguranca.md). O modelo, com o nível em que cada sandbox impõe cada regra, está em [Modelo de permissões](permissoes.md).

## Local

O provider roda na sua máquina, com o seu usuário, dentro do `bwrap`. O recorte é o mesmo do container: o que não
está montado não existe, com leitura, escrita ou oculto. A pasta da execução (`.cache/runs/<id>/`) é a pasta de
trabalho. Sem o `bwrap` no `PATH`, o comando é recusado e a mensagem diz como instalá-lo (no Debian e no Ubuntu:
`sudo apt install bubblewrap`).

O choliba resolve o executável instalado antes de entrar no sandbox e monta somente a closure necessária, só para
leitura: o executável do Claude Code, os pacotes `@openai/codex` e `@openai/codex-<plataforma>` usados pelo launcher
do Codex, ou a pasta da versão do Cursor CLI, que também contém o runtime e os arquivos JavaScript. A pasta pessoal
real fica escondida por uma pasta vazia em memória; ela some no fim da execução.
O nome curto (`claude`, `agent`, `codex`) vira um link na pasta `.bin` da execução, a primeira do `PATH`, e essa pasta
é montada só para leitura: o `bwrap` e o próprio provider, se chamarem só o nome, encontram o arquivo, porque
`~/.local/bin` estava na pasta pessoal que ficou vazia. O link sozinho não pode ser montado — o destino dele some com
a pasta pessoal vazia, e o `bwrap` falha ao criar o arquivo.
Os caminhos liberados pelo agente que ficam abaixo dela são montados depois e continuam acessíveis. Com uma
ferramenta da run do Playwright (`playwright-cli`, `playwright-trace`), a pasta dos navegadores do Playwright
(`PLAYWRIGHT_BROWSERS_PATH`, ou `~/.cache/ms-playwright`) também volta, só para leitura: sem ela, o
`playwright-trace snapshot` não acha o navegador.

A credencial do Claude vem do `.env`: `CLAUDE_CODE_OAUTH_TOKEN` (gerado por `claude setup-token`),
`ANTHROPIC_API_KEY` ou `ANTHROPIC_AUTH_TOKEN`; a do Cursor é `CURSOR_API_KEY`. O Codex usa a sessão criada por
`codex login`: antes de entrar no sandbox, o choliba copia somente `auth.json` para o `CODEX_HOME` efêmero da run.
Configuração, histórico, plugins e skills pessoais ficam de fora. O restante do ambiente configurado continua
herdado, inclusive pelas instâncias de MCP que o provider inicia.

A rede é a da máquina. O `/run` vira uma pasta vazia, mas a configuração de nomes que mora nele (o
`/etc/resolv.conf` do systemd-resolved, do NetworkManager ou do resolvconf aponta para lá) volta montada só para
leitura, e o provider alcança a própria API. A execução tem os próprios números de processo: quando ela termina ou é
interrompida (`Ctrl+C`), nada que o provider iniciou continua rodando. O navegador das ferramentas da run roda sem o sandbox
próprio do Chrome, como no Docker: quem isola é o `bwrap`.

`list`, `create`, `edit` e `delete` dentro de um caminho já montado continuam nas regras do provider. O que cada
mount mostra — inclusive o arquivo com escrita que abre a pasta — está em [Docker](#docker): os dois usam a mesma
função.

## Docker

Com `CHOL_SANDBOX=docker`, o provider roda num container, e os limites do provider deixam de importar: o que não
está montado não existe lá dentro, para nenhuma ferramenta do provider, nenhum comando que ele rode e nenhum MCP que
ele suba. As regras do provider continuam valendo dentro do container.

### Container

- **O que ele vê**, cada caminho no mesmo caminho absoluto: com leitura, `allow.read`, as skills, o `--add-dir`, os
  diretórios de `execute` (um comando precisa enxergar onde roda), as ferramentas da run e o `node_modules` da pasta
  de trabalho; com escrita, a pasta da execução, `allow.write` (fora de `plan` e `ask`), a saída das ferramentas do
  Playwright e o `ticket-runs/` do projeto. Um `deny.read` dentro disso aparece vazio; um `deny.write` dentro de algo
  com escrita volta a ser só leitura.
- **Um arquivo com escrita abre a pasta dele**, exista ou não: o provider grava um arquivo temporário ao lado e o
  renomeia por cima, o que um arquivo montado sozinho não aceita. O resto dessa pasta que não leva a um caminho com
  escrita (os outros tickets, por exemplo) fica só leitura, e as regras do provider limitam a escrita ao arquivo.
- **O que ele não vê**: o resto do disco, a sua pasta pessoal (a do container é vazia e some no fim) e o socket do
  Docker. Roda com o seu usuário, com a raiz só de leitura e sem capabilities. Navegar não escapa: `cd / && ls`
  mostra a raiz da imagem, e uma pasta acima de uma montagem (`/home/<você>`) só tem o caminho até ela.
- **As pastas do sistema são da imagem**: `/` inteira, `/usr`, `/bin`, `/sbin`, `/lib*`, `/etc`, `/opt`,
  `/ms-playwright`, `/root`, `/boot`, `/dev`, `/proc`, `/sys`, `/run` e a home do container nunca vêm desta máquina.
  Um `allow` com uma delas, ou com algo dentro (`/etc/passwd`), não é montado: o agente vê a versão da imagem, e o
  choliba avisa no início da execução e no `--dry-run` (`ignorado /etc/passwd (da imagem)`). Os seus dados, em
  qualquer outro lugar (`/home/...`, `/var/www/...`, `/srv`, `/mnt`, `/tmp/...`), continuam liberáveis. Uma pasta de
  trabalho em `/` não é montada inteira pelo mesmo motivo.
- **O nome dele** é `choliba-<id>`, o mesmo id da pasta `.cache/runs/<id>` da execução: `docker ps` e `docker logs`
  acham a sessão enquanto ela roda, e a tabela do rodapé mostra esse nome. O `docker logs` mostra o stream cru do
  provider (JSON), que o choliba lê e desenha no quadro. O `--rm` remove o container, e o log junto, no fim.

### Rede

- **Por padrão, uma rede bridge** (`CHOL_NETWORK=isolated`). Dentro do container, `localhost` é o próprio container.
  Escreva as URLs como a máquina as vê (`localhost`, no `baseURL` do `config.json` e no `url` de um MCP): o choliba
  confere a aplicação por elas e entrega ao agente o mesmo endereço com `host.docker.internal` no lugar de
  `localhost`, `127.0.0.1`, `[::1]` e `0.0.0.0`, nome que ele registra no container. O `--dry-run` mostra os dois
  endereços.
- **A aplicação precisa aceitar conexões pela interface do Docker.** Uma que ouve só em `127.0.0.1` (o padrão do
  Vite) responde na máquina, mas não no container. No Linux, antes do agente, o choliba confere a aplicação pelo
  endereço da interface do Docker (o da `docker0`) e, se ela não responde, para ali, dizendo o motivo: suba-a ouvindo
  em todas as interfaces (no Vite, `--host`) ou use `CHOL_NETWORK=host`. No Docker Desktop, que alcança o
  `localhost` da máquina, não há o que conferir.
- **Um MCP com `command`** que chama um serviço da máquina por variável de ambiente não é traduzido: use
  `host.docker.internal` nele. O serviço precisa aceitar conexões pela interface do Docker, não somente por
  `127.0.0.1`.
- **`CHOL_NETWORK=host`** dá ao container a rede da máquina, e `localhost` volta a apontar para o host. Use quando a
  aplicação não aceita conexões pela interface do Docker ou a sessão precisa da rede completa.
- **O que a bridge protege**: ela separa o namespace de rede do container e evita o acesso implícito aos serviços do
  host por `localhost`. Ela não é um firewall de saída: internet e rotas alcançáveis pelo Docker podem continuar
  disponíveis. Um bloqueio de egress exige uma política de rede externa ao choliba.

### Ollama

Com o provider `claude-ollama`, o endereço do Ollama (`CHOL_OLLAMA_URL`) também passa pela troca de `localhost` por
`host.docker.internal`. O Ollama, por padrão, só escuta em `127.0.0.1`, que o container não alcança: suba o servidor
com `OLLAMA_HOST=0.0.0.0`, ou use `CHOL_NETWORK=host`.

### Credencial

A credencial do Claude e do Cursor entra por variável de ambiente, do `.env`: `CLAUDE_CODE_OAUTH_TOKEN` (gerado por
`claude setup-token`, usa a assinatura e só chama o modelo), `ANTHROPIC_API_KEY` ou `ANTHROPIC_AUTH_TOKEN`, e
`CURSOR_API_KEY`. O Codex recebe no diretório da run uma cópia de `auth.json`, criada por `codex login`; o diretório
é montado no container e apagado ao final. O agente consegue ler a credencial do provider: prefira credenciais com o
menor alcance possível.

### Imagem

A imagem traz o Node e os navegadores do Playwright da versão do choliba, o Bun, o Claude Code, o Codex numa versão
fixa e o Cursor CLI, este baixado como pacote conferido pelo sha256, sem rodar script de instalação, e que não se atualiza
durante a run (o choliba passa `--disable-auto-update` ao Cursor, também fora do container). Construa-a uma vez na
raiz do repositório do choliba:

```sh
docker build -f docker/agent.Dockerfile -t choliba-agent .
```

Outra imagem: `CHOL_SANDBOX_IMAGE`.

### Conferir antes de rodar

O [`--dry-run`](../comandos/run.md#--dry-run) mostra o container, a imagem e cada caminho que ele vê, com leitura,
escrita ou oculto, sem executar nada.
