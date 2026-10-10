# Desempenho do CLI

O choliba é chamado o tempo todo: por agentes, pelo autocomplete, em `--help`. Por isso o que mais pesa é o **cold
start**, o tempo entre o processo começar e o comando terminar. Este arquivo guarda a medição de referência para
comparar mudanças que mexem no boot do CLI.

## Como medir

```sh
bun run chol:pack          # gera o .tgz, para medir também o choliba instalado
bun run bench:startup 20   # 20 execuções por cenário (padrão: 10)
```

O script ([`scripts/bench-startup.ts`](scripts/bench-startup.ts)) roda cada cenário duas vezes para aquecer o cache e
depois mede o tempo de parede de cada execução. Os cenários são:

- **Bun vazio**: o piso, um processo Bun que não faz nada;
- **fonte, dentro do repo**: `bun packages/choliba/src/main.ts`, da raiz do repositório;
- **fonte, fora do repo**: o mesmo, a partir de uma pasta sem `tsconfig.json`, como um agente roda o choliba numa
  subpasta;
- **instalado**: o `.tgz` instalado numa pasta limpa, como um usuário instala. O Bun bloqueia o `postinstall`, então só
  o comando medido roda.

## Referência

Medido em 09/10/2026, no commit `7464ad2` do `develop`, com Bun 1.4.2, Linux, Intel Core i7-12650H (16 threads) e 20
execuções por cenário:

| Cenário                            | mín (ms) | mediana (ms) | média (ms) | máx (ms) |
| ---------------------------------- | -------: | -----------: | ---------: | -------: |
| Bun vazio (piso)                   |        2 |            3 |          3 |        4 |
| fonte, dentro do repo: `--version` |      212 |          218 |        221 |      248 |
| fonte, dentro do repo: `--help`    |      251 |          274 |        277 |      313 |
| fonte, fora do repo: `--version`   |      421 |          463 |        461 |      517 |
| instalado (.tgz): `--version`      |      208 |          219 |        219 |      240 |
| instalado (.tgz): `--help`         |      211 |          221 |        222 |      236 |

## Leitura

- **O tempo é o boot, não o comando.** `--version` só imprime uma linha e custa uns 220 ms, contra 3 ms do piso. Esse
  tempo vai em carregar o NestJS, o `nest-commander`, o `reflect-metadata` e o `rxjs`, e em montar o grafo de injeção
  inteiro, com todos os módulos, seja qual for o comando.
- **Fora do repositório o custo dobra.** Rodando do código-fonte numa pasta sem `tsconfig.json`, o Bun não liga os
  decorators e o `main.ts` relança um segundo processo a partir da pasta do pacote: são dois boots, uns 460 ms.
- **Instalado custa o mesmo que o código-fonte.** O bundle junta os pacotes do workspace num arquivo, mas as
  dependências externas e o grafo continuam iguais, então o boot não cai.

## Alvo

O alvo de uma mudança no boot do CLI é aproximar `--version` e `--help` do piso, mais o trabalho real do comando, e
eliminar a diferença entre rodar de dentro e de fora do repositório. Ao mudar o boot, rode de novo
`bun run bench:startup 20` e atualize a tabela e a data acima no mesmo PR.
