# Catraca de cobertura: detalhes

A catraca não só define números: ela impede que a cobertura caia sem ninguém ver. Os limites começaram em 0 e
subiram até o que o código alcançou.

## Como funciona

1. `bun run test:cov` é `bun test test/ --coverage && bun scripts/coverage-ratchet.ts`. O `&&` faz o script rodar só
   se os testes passaram.
2. O `bunfig.toml` (seção `[test]`) diz ao Bun os relatórios (`text` e `lcov`), a pasta (`coverage/`, fora do git),
   que os arquivos de teste não contam (`coverageSkipTestFiles`) e o que fica fora da conta
   (`coveragePathIgnorePatterns`).
3. O `scripts/coverage-ratchet.ts` lê `coverage/lcov.info`, calcula o total e o compara com
   `coverage-thresholds.json` (`{ "functions": …, "lines": … }`, em porcentagem). Abaixo, sai com 1 e não regrava
   nada; acima, sobe os limites e regrava `COVERAGE.md` e o badge. As contas, sem disco, ficam em
   `scripts/coverage-report.ts`, testadas em `test/coverage-report.test.ts`.

## Onde fica cada coisa

| Arquivo | Papel |
| ------- | ----- |
| `bunfig.toml` | Relatórios, pasta e exclusões da cobertura do Bun |
| `coverage-thresholds.json` | Os limites, que só sobem |
| `scripts/coverage-ratchet.ts` | A catraca: confere, sobe os limites, regrava `COVERAGE.md` e o badge |
| `scripts/coverage-report.ts` | As contas: lê o lcov, calcula o total, monta o `COVERAGE.md` e o badge |
| `COVERAGE.md` | O relatório por módulo e arquivo, versionado |
| `.github/badges/coverage.json` | O badge (endpoint do shields.io), versionado |

## Decisões de desenho

| Escolha | Alternativa não tomada | Motivo |
| ------- | ---------------------- | ------ |
| Limites em `coverage-thresholds.json`, conferidos pelo script | `coverageThreshold` no `bunfig.toml` | O do Bun vale para **cada arquivo**, não para o total: com um arquivo pouco coberto, qualquer limite acima dele falha sempre (conferido no Bun 1.4.2). O script confere o total, como o `global` do Jest. |
| O total é a média por arquivo, um arquivo sem nada a cobrir valendo 100 | Somar linhas e funções de todos os arquivos | É a conta do "All files" do Bun (conferida contra o lcov). Somar daria outro número, e o relatório não bateria com o que o Bun mostra. |
| Limite arredondado para baixo em 0,01 | Gravar o medido exato | Nunca fica acima do medido: a próxima execução, com a mesma cobertura, passa. |
| Funções e linhas | As quatro métricas do Jest | O Bun mede só essas duas; branches e statements não existem no lcov dele. |
| Não regravar nada numa execução abaixo do limite | Regravar sempre | Os arquivos mostram o último estado bom. |
| Regravar `COVERAGE.md`, badge e limites só quando o conteúdo muda (a linha da hora não conta) | Regravar sempre | Cada execução sujaria a árvore com uma hora nova. |
| Script em `scripts/`, pelo `src/filesystem` e pelo `src/output` | `node:fs` e `console` | A regra do AGENTS.md vale também para os scripts. |
| Agrupar por módulo (`src/mcp`, `src/rounds`…) | Por pacote | O Choliba é um pacote só, com um módulo por pasta. |

## O que fica fora da cobertura, e por quê

Só o produto conta. Ficam fora os testes e o que eles criam em pastas temporárias (`test/**` e `../**`, os
`choliba.config.ts` de mentira que os testes escrevem em `/tmp`), os exemplos dos cursos (`guides/**`), as
ferramentas dos agentes do projeto (`tools/**`, como o `tools/fetch-web-content.ts`) e a configuração do projeto
(`config/**`, `choliba.config.ts`). A lista é a do `coveragePathIgnorePatterns`, no `bunfig.toml`.

Não acrescente uma exclusão para um número subir. Excluir um arquivo com lógica esconde o que a catraca existe para
proteger; se alguém pedir isso, pare e confirme. Também não escreva testes que só executam declarações: teste
comportamento, inclusive os caminhos de erro.

## No CI

O job `test` do `.github/workflows/ci.yml` roda a catraca em todo pull request:

1. Instala o bubblewrap (e libera o user namespace que o Ubuntu do runner bloqueia) e baixa a imagem
   `oven/bun:latest`: sem ela, os testes do Docker pulam e a cobertura cai abaixo do limite.
2. Roda `bun run test:cov`, que falha se a cobertura medida fica abaixo do `coverage-thresholds.json` do PR.
3. Compara o `coverage-thresholds.json` do PR com o da branch de destino: um limite que desceu reprova o job, mesmo
   com a cobertura medida acima dele.
4. Numa falha, publica a pasta `coverage/` como artefato (`coverage-report`, guardado por 5 dias), para investigar.

O CI não grava de volta um limite que subiu: suba-o no próprio PR, commitando o `coverage-thresholds.json`, o
`COVERAGE.md` e o badge que o `bun run test:cov` regravou. O job `check`, que os rulesets da `develop` e da `master`
exigem, só passa com o `test` verde.
