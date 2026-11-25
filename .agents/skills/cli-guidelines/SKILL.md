---
name: cli-guidelines
description: Regras de desenho da linha de comando do Choliba (`bin/choliba.ts`, `src/cli/`, `scripts/`), baseadas nas Command Line Interface Guidelines (clig.dev) e adaptadas ao repositório — texto de ajuda, stdout e stderr, códigos de saída, cor e TTY, opções e seus nomes padrão, perguntas, `--dry`, erros, sinais, precedência da configuração, segredos e compatibilidade futura. Use ao criar ou mudar qualquer comando, opção, texto de ajuda, mensagem de erro, pergunta ou saída de terminal, ao revisar código de CLI, ou quando perguntarem como um comando deve se comportar, como uma opção deve se chamar ou para onde vai a saída.
argument-hint: 'O comando, a opção ou a saída que você está desenhando ou revisando.'
user-invocable: true
disable-model-invocation: false
---

# Diretrizes da linha de comando

A CLI do Choliba é usada por pessoas num terminal e por agentes e scripts que leem a saída dela. A referência é uma só,
o [clig.dev](https://clig.dev/) (o checklist inteiro está em `references/clig-checklist.md`), seguida por padrão: o que
o clig.dev diz vale, salvo o que este arquivo disser em contrário. POSIX e os padrões GNU não são referência.

Duas listas mantêm o resto honesto. Os **desvios deliberados** do clig.dev estão em "Onde o Choliba se afasta do
clig.dev", cada um com o motivo; um desvio novo se decide com quem usa o projeto e se escreve ali. As **lacunas**, o que
o clig.dev pede e o Choliba ainda não faz, estão em `references/lacunas.md`; consulte antes de dizer que um
comportamento já existe, e apague a linha quando ela fechar.

## Onde mora a CLI

- `src/cli/commands.ts`: a tabela `COMMANDS`, em que a chave é o nome do comando e os campos são `run` e `summary`. O
  `bin/choliba.ts` e a página de comandos do site (`scripts/docs-pages.ts`) a leem.
- `bin/choliba.ts`: a ajuda geral, montada da tabela, e a recusa de comando desconhecido.
- `src/cli/<comando>.ts`: os comandos (`approvals`, `clear`, `rounds`, este com o `rounds:web`), cada um definido com
  `defineCommand` e executado por `runCommand` (`src/command`). A declaração (descrição, argumentos, opções) gera o
  `--help` e o parser; o `run` recebe `args`, `options`, `signal` (abortado no Ctrl+C) e `output`.
- `scripts/*.ts` seguem a mesma forma (`issue`, `git:clean`, `release:notes`).
- Tudo o que o comando mostra ou pergunta passa por `output` (`src/interaction`) ou por `src/output`; nunca `console`
  nem `process.stdout` (o lint recusa). Ver `AGENTS.md`, "Cada capacidade tem um dono".

## As regras de todo comando

1. **A saída principal vai para o stdout; erros, progresso e mensagens vão para o stderr.** Um agente ou script que
   encadeia o comando precisa receber só o resultado no stdout. Nunca escreva um aviso no stdout.
2. **Saída 0 em caso de sucesso, diferente de 0 em caso de falha**, erro de uso inclusive. Um comando que achou
   problemas (um gate vermelho) falha com código diferente de 0 mesmo que tenha imprimido um relatório. Todo código de
   saída novo tem um teste.
3. **`-h` e `--help` funcionam** e imprimem a ajuda em português, gerada da declaração (`helpText`); a ajuda ignora as
   outras opções. Um comando sem um argumento obrigatório mostra o uso curto e como pedir a ajuda, no stderr, e sai com 1.
4. **Abra a ajuda com exemplos**, o uso mais comum primeiro. Todo comando e toda opção tem descrição.
5. **Opções antes de argumentos posicionais.** No máximo um tipo de posicional por comando. Toda opção tem nome longo;
   alias de uma letra só nas mais usadas. Prefira os nomes padrão: `--help`, `--version`, `--dry-run`, `--force`,
   `--json`, `--quiet`, `--no-input`, `--no-color`, `--output`. Nunca reuse um nome padrão com outro sentido.
6. **Cor só para gente.** Sem cor quando o stdout não é um TTY, quando `NO_COLOR` está definida e não vazia, com
   `TERM=dumb` ou com `--no-color`; `FORCE_COLOR` liga. Decida uma vez, num lugar só, e passe a decisão adiante; nunca
   teste o ambiente no meio da renderização. Sem animação nem região viva quando o stdout não é um TTY.
7. **Perguntar só num TTY, e nunca ser obrigatório.** Todo valor perguntado também pode vir por opção. Com o stdin fora
   de um TTY, ou com `--no-input`, pule a pergunta e falhe com uma mensagem que nomeia a opção a usar.
8. **Ação perigosa pede confirmação.** Uma que apaga ou sobrescreve oferece `--dry-run` (descreve, não grava nada) e,
   num TTY, pergunta antes; `--yes` ou `--force` pula a pergunta.
9. **Erros são para pessoas, em português**: o que deu errado, o caminho ou o valor, e como corrigir. A linha mais
   importante por último; sem stack trace, salvo num erro inesperado, que vai com a dica de como reportar. Um erro de
   uso é um `UsageError`, com uma mensagem que diz o que fazer; uma opção desconhecida é recusada, nunca ignorada.
10. **Diga o que mudou e o que vem depois.** Um comando que muda estado mostra o novo estado em poucas palavras e
    sugere o próximo comando do fluxo.
11. **Precedência da configuração: opções > ambiente do processo > `.env` do projeto > padrões.** Variáveis de ambiente
    em maiúsculas com sublinhado e com prefixo (`CHOLIBA_*`), salvo as de uso geral (`NO_COLOR`, `TERM`, `TMPDIR`…).
12. **Sem segredo em opção.** Credenciais ficam em arquivos ou no ambiente; nunca crie uma opção que recebe senha ou
    token: ele vaza no `ps` e no histórico do shell.
13. **O Ctrl-C funciona.** Passe SIGINT/SIGTERM aos processos filhos (o `signal` do `run` existe para isso), escreva
    algo na hora, limpe com limite de tempo e não deixe nada pela metade que a próxima execução não recupere.
14. **As mudanças são aditivas.** Acrescente opções em vez de mudar o que uma existente faz; avise antes de remover, dizendo
    o que usar. O texto para gente pode mudar; o que script ou agente lê fica atrás de `--json` e estável.
15. **`--` encerra as opções.** O que vem depois é operando, mesmo começando com `-`, e segue como foi digitado.
16. **Sem comando coringa.** Um nome que a tabela `COMMANDS` não conhece é erro de uso, em português, com a ajuda geral
    e código de saída 1. Subcomandos nunca são abreviados.

## Onde o Choliba se afasta do clig.dev

Cada um de propósito, com o motivo. O que não está aqui, o clig.dev manda.

| O clig.dev diz | O Choliba faz | Por quê |
| --- | --- | --- |
| Use uma biblioteca de análise de argumentos | `defineCommand` e `parseCommandLine` (`src/command`) | Uma declaração dá a ajuda e o parser, sem dependência |
| Mensagens no idioma de quem usa | Ajuda, mensagens e erros em português | Quem usa o Choliba lê português |
| Não leia segredos de variáveis de ambiente | As credenciais dos providers vêm do ambiente ou do `.env` (`CLAUDE_CODE_OAUTH_TOKEN`, `CURSOR_API_KEY`…) | É como as CLIs dos providers as leem; o Choliba só as repassa |
| Distribua um binário só | Um pacote Bun (`choliba-<versão>.tgz`) instalado no projeto | O Choliba também é biblioteca: os scripts do projeto importam `choliba`, e o projeto fixa a versão no `package.json` |

## Checklist para um comando novo ou alterado

- [ ] o stdout só tem o resultado; o resto vai para o stderr
- [ ] códigos de saída: 0 em sucesso, 1 em falha ou erro de uso, cobertos por um teste
- [ ] `--help` em português com um exemplo; opções descritas
- [ ] nomes de opção padrão onde há padrão; a forma longa sempre existe
- [ ] cor e perguntas respeitam TTY, `NO_COLOR`, `TERM=dumb`, `--no-color` e `--no-input`
- [ ] efeito destrutivo com `--dry-run` e confirmação ou `--force`
- [ ] erros dizem o quê, onde e como corrigir, em português, como `UsageError`
- [ ] nenhum segredo vem de uma opção; nada é escrito com `console` nem `process`
- [ ] um desvio novo do clig.dev foi decidido com quem usa e entrou em "Onde o Choliba se afasta do clig.dev"
- [ ] a tabela `COMMANDS` de `src/cli/commands.ts` e o README (seção da CLI) estão em dia; a página de comandos do site
  sai da tabela (skill `documentation`)
