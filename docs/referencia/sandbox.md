# Sandbox

> Onde o provider roda: na sua máquina (`local`) ou num container Docker que só enxerga o que o agente alcança
> (`docker`).

`CHOL_SANDBOX`, no `.env` da pasta de trabalho, escolhe onde o provider roda:

| Valor            | Onde roda      | Quem limita o agente                                                      |
| ---------------- | -------------- | ------------------------------------------------------------------------- |
| `local` (padrão) | na sua máquina | as regras que o choliba aplica no provider, com os limites de cada um     |
| `docker`         | num container  | o container, que só monta o que o `agent.yaml` libera, e as mesmas regras |

As permissões são as mesmas nos dois: as do [`agent.yaml`](agent-yaml.md), descritas em [Segurança](seguranca.md).

## Local

O provider roda na sua máquina, com o seu usuário, numa pasta vazia (`.cache/runs/<id>/`) criada antes da execução
e apagada depois. O que o agente alcança é o que as regras do provider deixam, e cada provider tem seus limites: no
Cursor, por exemplo, um arquivo novo criado direto numa pasta do caminho até um item liberado não é bloqueado. Os
limites de cada um estão em [Segurança](seguranca.md).

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
- **Um MCP com `command`** que chama um serviço da máquina por variável de ambiente não é traduzido: use
  `host.docker.internal` nele. O serviço precisa aceitar conexões pela interface do Docker, não somente por
  `127.0.0.1`.
- **`CHOL_NETWORK=host`** dá ao container a rede da máquina, e `localhost` volta a apontar para o host. Use quando a
  aplicação não aceita conexões pela interface do Docker ou a sessão precisa da rede completa.
- **O que a bridge protege**: ela separa o namespace de rede do container e evita o acesso implícito aos serviços do
  host por `localhost`. Ela não é um firewall de saída: internet e rotas alcançáveis pelo Docker podem continuar
  disponíveis. Um bloqueio de egress exige uma política de rede externa ao choliba.

### Credencial

A credencial do provider entra por variável de ambiente, do `.env`: `CLAUDE_CODE_OAUTH_TOKEN` (gerado por
`claude setup-token`, usa a assinatura e só chama o modelo) ou `ANTHROPIC_API_KEY`, e `CURSOR_API_KEY`. O agente
consegue lê-la, como consegue fora do container: prefira o token, que não serve para mais nada.

### Imagem

A imagem traz o Node e os navegadores do Playwright da versão do choliba, o Bun, o Claude Code e o Cursor CLI, este
numa versão fixa e baixado como pacote conferido pelo sha256, sem rodar script de instalação, e que não se atualiza
durante a run (o choliba passa `--disable-auto-update` ao Cursor, também fora do container). Construa-a uma vez na
raiz do repositório do choliba:

```sh
docker build -f docker/agent.Dockerfile -t choliba-agent .
```

Outra imagem: `CHOL_SANDBOX_IMAGE`.

### Conferir antes de rodar

O [`--dry-run`](../comandos/run.md#--dry-run) mostra o container, a imagem e cada caminho que ele vê, com leitura,
escrita ou oculto, sem executar nada.
