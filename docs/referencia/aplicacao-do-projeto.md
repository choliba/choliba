# A aplicação do projeto

> O que o choliba faz com a aplicação de um projeto antes dos testes e dos agentes: o setup, a conferência do
> `baseURL` e a subida pelo `envs[].start`.

O choliba deixa a aplicação do projeto pronta, pelo ambiente ativo do [`config.json`](config-json.md), em dois momentos: antes de
rodar o Playwright no [`choliba run tests`](../comandos/run.md#tests), e antes de qualquer agente rodado com `--project` (antes até dos `before` dele):

1. Roda cada comando de `envs[].setup` em `appDir`, em ordem (por exemplo, `["bun install"]`). A tela diz só qual
   comando roda; o que ele escreve vai para `.cache/app/<projeto>.setup.log`, refeito a cada vez. Um que falha para
   tudo: `a aplicação não ficou pronta: "<comando>" saiu com código N`, com o fim desse log. Numa rodada de vários
   tickets, o setup roda uma vez só.
2. Confere o `baseURL`. Uma aplicação que já está no ar, como a que você subiu, é usada como está, e continua no ar
   depois.
3. Fora do ar, com `envs[].start`, sobe a aplicação em `appDir`, espera ela responder (até 3 minutos) e a derruba
   no fim, também quando a execução é interrompida. No `choliba run tests`, o log do servidor sai junto com o dos
   testes. Numa execução de agente, ele vai para `.cache/app/<projeto>.log`, que diz quando foi o choliba que a
   derrubou (o `exited with code 143` que vem depois é esse fim, não uma falha). Se ela não sobe:
   `a aplicação não subiu (envs[].start): …`, com o fim do log.
4. Fora do ar e sem `envs[].start`, a execução de um agente para antes dele (`a aplicação não responde em … e o
ambiente … não tem envs[].start`). No `choliba run tests`, `--expect` falha com
   `a aplicação não respondeu no baseURL: …`.

Os dois campos são opcionais. Um projeto com `global-setup.ts`, como o `exemplo`, continua subindo a aplicação por
ele nos testes. O [`--dry-run`](../comandos/run.md#--dry-run) de um agente mostra o que seria feito, sem subir nada.

Os agentes nunca sobem, derrubam ou simulam a aplicação, nem mexem nas dependências instaladas dela: todo agente
rodado com `--project` recebe essa regra no prompt, e o choliba nega a ele escrever em `<appDir>/node_modules/`.
