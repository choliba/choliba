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

Medido em 10/10/2026, com Bun 1.4.2 e Linux, 10 execuções por cenário, depois de o `main.ts` passar a despachar só
pela tabela (sem o grafo de injeção e sem relançar o processo):

| Cenário                            | mín (ms) | mediana (ms) | média (ms) | máx (ms) |
| ---------------------------------- | -------: | -----------: | ---------: | -------: |
| Bun vazio (piso)                   |        4 |            7 |          7 |        8 |
| fonte, dentro do repo: `--version` |       83 |           87 |         86 |       88 |
| fonte, dentro do repo: `--help`    |      117 |          120 |        121 |      128 |
| fonte, fora do repo: `--version`   |       86 |           90 |         90 |       95 |
| instalado (.tgz): `--version`      |       78 |           80 |         80 |       84 |
| instalado (.tgz): `--help`         |       81 |           85 |         85 |       88 |

A medição anterior (09/10/2026, 20 execuções) tinha mediana de 218 ms para `--version` dentro do repo, 274 ms para
`--help` e 463 ms fora do repo.

## Leitura

- **O boot caiu para cerca de um terço.** `--version` no fonte, dentro do repo, foi de 218 ms para 87 ms de mediana.
  `--help` foi de 274 ms para 120 ms.
- **Fora do repositório não dobra mais.** Sem o segundo processo, `--version` fora fica em 90 ms, ao lado dos 87 ms
  de dentro.
- **Instalado fica no mesmo patamar.** O `.tgz` mede 80 ms em `--version` e 85 ms em `--help`: um arquivo só, sem
  as dependências que o boot antigo carregava.
- **Ainda acima do piso.** O piso desta máquina foi 7 ms. O que resta é carregar o fonte (ou o bundle) e montar a
  tabela.

## Alvo

O alvo de uma mudança no boot do CLI é aproximar `--version` e `--help` do piso, mais o trabalho real do comando, e
eliminar a diferença entre rodar de dentro e de fora do repositório. Ao mudar o boot, rode de novo
`bun run bench:startup 20` e atualize a tabela e a data acima no mesmo PR.
