# Modelo de permissões

> Quem pode fazer o quê, sobre o quê e em que situação: a mesma regra em qualquer sandbox, imposta em níveis.

Esta página define o modelo de permissões do choliba. Ele é o alvo: o código chega a ele em etapas. Onde o
comportamento de hoje ainda é diferente, a página diz isso. Para o que vale hoje regra por regra, veja
[Segurança](seguranca.md) e [Sandbox](sandbox.md).

## A pergunta

Toda permissão responde à mesma pergunta: **este sujeito pode fazer esta ação neste objeto, neste contexto?** É o
modelo ABAC do NIST (SP 800-162), na forma que o [Cedar](https://docs.cedarpolicy.com/auth/authorization.html) usa
(principal, ação, recurso, contexto). O choliba adota a forma, não a linguagem do Cedar.

- **Negado por padrão.** Só é permitido o que uma regra `allow` libera.
- **`deny` vence `allow`.**
- **Uma exceção tira um caminho de um `deny`** da mesma ação e não libera nada sozinha: o caminho ainda precisa de um
  `allow`. A exceção é declarada num campo próprio, `permissions.exception`. O prefixo `!` no caminho continua
  aceito como a forma antiga do mesmo campo.

## Sujeitos

| Sujeito  | Quem é                                   | De onde vem a política                                          |
| -------- | ---------------------------------------- | --------------------------------------------------------------- |
| `agent`  | a sessão de um agente (`agent.id`)       | o `agent.yaml`, mais as regras que o choliba põe em todo agente |
| `step`   | uma ação de `steps` (`run`, `git_diff`…) | o código da ação; pode o que o agente não pode                  |
| `script` | quem usa o `choliba/sandbox` direto      | a política que o próprio script passa                           |

Os três passam pela mesma decisão. A política de um step não herda a do agente: um step existe justamente para fazer
o que o agente não faz. A do `run`, que executa um comando escrito pelo próprio usuário no `agent.yaml`, é a pasta de
trabalho inteira, com leitura e escrita. Hoje os steps rodam fora das permissões.

## Objetos

| Objeto     | Identificado por                                                 |
| ---------- | ---------------------------------------------------------------- |
| caminho    | caminho absoluto, ou um glob                                     |
| comando    | a pasta onde roda e o argv                                       |
| ferramenta | o nome e o subcomando; um MCP é uma ferramenta (servidor e tool) |
| rede       | rede desligada, ou um destino                                    |
| variável   | o nome da variável de ambiente                                   |

Um caminho sem glob vale para ele e tudo abaixo.

Um MCP sem tool vale para todas as tools dele. Uma ferramenta sem servidor é do próprio provider (`Read`, `Task`) e
não se confunde com a tool de um MCP que tenha o mesmo nome.

## Ações

| Ação      | Objeto              | Equivale a                                                |
| --------- | ------------------- | --------------------------------------------------------- |
| `read`    | caminho             | ler um arquivo                                            |
| `list`    | caminho             | listar uma pasta                                          |
| `create`  | caminho             | criar arquivo ou pasta                                    |
| `edit`    | caminho             | alterar um arquivo existente                              |
| `delete`  | caminho             | apagar arquivo ou pasta                                   |
| `invocar` | comando, ferramenta | rodar o comando ou a ferramenta (o subcomando é atributo) |
| `connect` | rede                | abrir conexão                                             |
| `bind`    | rede                | aceitar conexão                                           |

Mover é derivado: `delete` na origem e `create` no destino. Salvar um arquivo trocando-o por um temporário, como faz o
provider, pede `create`, `edit` e `delete` na pasta dele.

## Contexto

O contexto muda a decisão sem mudar a regra:

- **Modo.** Em `plan` e `ask`, `create`, `edit` e `delete` são negados, mesmo com `allow`. `invocar` uma ferramenta
  não é bloqueado pelo modo: o que ela fizer num caminho é decidido à parte.
- **Projeto e ticket** da execução.

Duas concessões valem só para uma execução:

- **`--add-dir`** soma uma pasta à leitura.
- **A pasta da execução** (`.cache/runs/<id>/`), onde o provider nasce e grava os próprios arquivos, tem escrita, é
  declarada (não implícita) e é a pasta de trabalho em qualquer sandbox.

## Quem decide e quem impõe

Um único ponto decide: o sandbox. Ele responde `allow` ou `deny` a cada pedido. A execução do agente escreve a
política e traduz o que o provider faz (uma chamada de ferramenta no stream) em pedidos; ela não decide. A decisão é
imposta em camadas, e cada decisão diz onde foi imposta:

| Nível       | Quem impõe                                                       |
| ----------- | ---------------------------------------------------------------- |
| `enforced`  | o sistema: o kernel ou o container                               |
| `delegated` | o provider (as regras do Claude, o `cli.json` do Cursor)         |
| `guarded`   | o choliba, que interrompe a execução ao ver a violação no stream |
| `advisory`  | só o prompt pediu                                                |

`advisory` não é limite: é o registro de que ninguém impôs aquela regra.

### O piso de cada ação

| Ação                                | Nível mínimo                   |
| ----------------------------------- | ------------------------------ |
| `read`, escrita e `deny` em caminho | `enforced`                     |
| argv de um comando                  | `delegated` ou `guarded`       |
| `invocar` ferramenta ou MCP         | `delegated` ou `guarded`       |
| rede                                | `enforced` para rede desligada |

Abaixo do piso de uma ação, o choliba recusa o comando ou a regra, nunca a sessão inteira, e nunca alarga a
permissão.

### Arredondar só para o lado restrito

Um sandbox que não exprime uma regra exata arredonda para o lado mais restrito e informa; nunca para o mais
permissivo. Um mount, por exemplo, só sabe nada, leitura, escrita ou oculto: dentro de um mount já imposto,
`list`, `create`, `edit` e `delete` são apertados pelo provider (`delegated`) ou pelo choliba (`guarded`). Se nenhum
dos dois consegue apertar, a regra é recusada. Um `create` sem `delete` não vira um mount de escrita.

A única exceção nomeada: um arquivo com escrita abre a pasta dele, porque o provider salva trocando o arquivo por um
temporário, e o resto da pasta fica só leitura. O provider limita a escrita ao arquivo.

## Exceções conhecidas

- **A credencial do provider** é legível pelo agente, dentro e fora do container: o provider precisa dela.
- **Pedir a uma pessoa** no meio da execução não existe: o provider roda em modo não interativo (`-p`).
- **Rede por domínio** exige um proxy; o Landlock só cobre portas TCP. A saída do provider para a API do modelo e o
  acesso à aplicação do projeto ficam `advisory` até haver proxy ou controle de porta. Outra regra de rede que o
  sandbox não imponha é recusada.

## Do `agent.yaml` para o modelo

| No `agent.yaml`                         | No modelo                                             |
| --------------------------------------- | ----------------------------------------------------- |
| `permissions.allow.read`                | `allow` de `read` e `list`                            |
| `permissions.allow.write`               | `allow` de `create` e `edit`                          |
| `permissions.allow.delete`              | `allow` de `delete`                                   |
| `permissions.deny.<ação>`               | `deny` das mesmas ações                               |
| `permissions.exception.<ação>`          | `exception` das mesmas ações                          |
| `!caminho` num `deny` (forma antiga)    | `exception` daquela ação                              |
| `permissions.allow.execute`             | `invocar` comando: pasta e prefixo do argv            |
| `permissions.allow.tools`/`.deny.tools` | `invocar` ferramenta, com os subcomandos              |
| `mcps`                                  | `invocar` ferramenta: servidor e tool                 |
| `modes`                                 | contexto `modo`                                       |
| pastas de agentes, skills e MCPs        | `deny` de `create`, `edit` e `delete`, em todo agente |
| delegar a um subagente                  | `deny` de `invocar`, em todo agente                   |

A tradução não alarga nem estreita o que cada agente alcança hoje.

## Por sandbox

O nível que cada objeto alcança. Para o que muda na prática entre `local` e `docker`, veja [Sandbox](sandbox.md).

| Objeto                                                         | `local`, hoje                               | `local`, no modelo (`bwrap`)      | `docker`                                                           |
| -------------------------------------------------------------- | ------------------------------------------- | --------------------------------- | ------------------------------------------------------------------ |
| caminho: leitura, escrita, deny                                | `enforced` (`bwrap`); sem `bwrap`, recusado | `enforced`; sem `bwrap`, recusado | `enforced` (mounts)                                                |
| caminho: `list`, `create`, `edit`, `delete` dentro de um mount | `delegated`                                 | `delegated` ou `guarded`          | `delegated` ou `guarded`                                           |
| comando: argv                                                  | `delegated`                                 | `delegated` ou `guarded`          | `delegated` ou `guarded`                                           |
| ferramenta e MCP                                               | `delegated` e `guarded`                     | `delegated` e `guarded`           | `delegated` e `guarded`                                            |
| rede desligada                                                 | não existe                                  | `enforced` (`--unshare-net`)      | `enforced` (`--network none`); hoje só há `isolated` e `host`      |
| saída para a API e a aplicação                                 | sem limite                                  | `advisory` (exceção conhecida)    | hoje sem limite (a bridge não filtra saída); no modelo, `advisory` |
| pasta de trabalho                                              | a pasta da execução (`bwrap --chdir`)       | a pasta da execução (`--chdir`)   | a pasta da execução (`--workdir`)                                  |

No modelo, o `local` isola desde o início, como qualquer outro sandbox: sem `bwrap`, uma regra de caminho é recusada,
com a instrução de como instalá-lo. Não existe modo sem isolamento.

## Casos

| Caso                                                                           | Hoje                                                                                                           | No modelo                                                                                    |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Um script roda `rm` com `CHOL_SANDBOX=local` e `policy: 'read-only'`           | sem `bwrap`, recusado; com `bwrap`, o caminho é só leitura e o `rm` falha                                      | sem `bwrap`, recusado; com `bwrap`, o caminho é só leitura e o `rm` falha                    |
| Um script aponta a pasta da execução para uma pasta do usuário, em `read-only` | o `docker` a monta com escrita                                                                                 | ela é uma concessão declarada da execução, com escrita; nunca uma pasta com dados do usuário |
| Um script roda o mesmo plano em `local` e em `docker`                          | `pwd` é a pasta da execução nos dois                                                                           | `pwd` é a pasta da execução nos dois                                                         |
| O provider salva o ticket trocando-o por um temporário                         | resolvido: o arquivo com escrita abre a pasta, o resto fica só leitura                                         | igual: a exceção nomeada do arredondamento                                                   |
| O agente chama um MCP que não declarou                                         | o choliba interrompe (`guarded`); no Claude a sessão nem tem o servidor (`delegated`)                          | igual, com a decisão vinda do sandbox                                                        |
| O agente chama um subagente                                                    | no Claude a ferramenta não existe (`delegated`); no Cursor o choliba interrompe no primeiro `Task` (`guarded`) | igual: um `deny` de `invocar` que vale para todo agente                                      |
