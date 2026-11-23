# Checklist do clig.dev

Uma versão condensada das [Command Line Interface Guidelines](https://clig.dev/), seção por seção. Leia o original
para o raciocínio; o `SKILL.md` diz quais regras o Choliba aplica e como.

## Conteúdo

- Filosofia
- O básico
- Ajuda e documentação
- Saída
- Erros
- Argumentos e opções
- Interatividade
- Subcomandos
- Robustez
- Compatibilidade futura
- Sinais
- Configuração e variáveis de ambiente
- Nome, distribuição e análise de uso

## Filosofia

Desenho pensado em gente primeiro; peças simples que se compõem (stdin/stdout/stderr, códigos de saída, sinais, texto
simples, JSON); coerência com as convenções existentes; diga só o bastante; fácil de descobrir; a CLI como conversa
(sugira correções, confirme passos arriscados, mostre o estado); robustez, a real e a percebida; empatia; quebre uma
regra só com um motivo claro.

## O básico

- Use uma biblioteca de análise de argumentos.
- Saída 0 em sucesso, diferente de 0 em falha.
- Saída principal no stdout; logs, erros e mensagens no stderr.

## Ajuda e documentação

- `-h` e `--help` mostram a ajuda; `help` e `help <subcomando>` também em ferramentas no estilo do git. A ajuda ignora
  as outras opções.
- Um comando sem os argumentos obrigatórios mostra uma ajuda concisa: descrição, um ou dois exemplos, as opções
  principais e um aponte para `--help`.
- A ajuda completa abre com exemplos e com as opções mais usadas; liga para a documentação na web e para onde pedir
  suporte.
- Sugira uma correção para um erro de digitação provável, mas não rode o comando corrigido em silêncio.
- Um comando que lê o stdin e acha um TTY mostra a ajuda em vez de travar.
- Tenha documentação na web; a do terminal (`help`) é um bônus.

## Saída

- Primeiro legível por gente; detecte um TTY para saber se uma pessoa está lendo.
- Legível por máquina quando não custa nada: `--plain` (um registro por linha), `--json`.
- Em sucesso, imprima algo breve; `-q`/`--quiet` silencia o não essencial.
- Depois de mudar estado, diga o que aconteceu e o novo estado; deixe fácil ver o estado atual; sugira o próximo
  comando.
- Torne explícito quando o programa cruza a própria fronteira (lê arquivo que não recebeu, chama a rede).
- Cor com intenção. Desligue quando o stdout/stderr não é um TTY, quando `NO_COLOR` está definida e não vazia, com
  `TERM=dumb` ou com `--no-color`.
- Sem animação quando o stdout não é um TTY.
- Símbolos e emoji só onde dão estrutura.
- Sem saída de depuração por padrão; o stderr não é um arquivo de log (sem prefixo de nível, a menos que seja verboso).
- Pagine saída longa (`less -FIRX`) quando o stdout é um TTY.

## Erros

- Capture os erros esperados e reescreva-os para gente, com como corrigir.
- Boa relação sinal/ruído: agrupe erros repetidos sob um título; a informação mais importante por último; vermelho só
  onde importa.
- Para erros inesperados: informação de depuração (de preferência num arquivo) e como reportar o bug, de forma fácil.

## Argumentos e opções

- Prefira opções a argumentos posicionais; vários posicionais só para o mesmo tipo de coisa (`rm a b c`) ou a forma
  comum de dois (`cp origem destino`).
- Toda opção tem forma longa; as de uma letra só para as mais comuns.
- Nomes padrão: `-a/--all`, `-d/--debug`, `-f/--force`, `--json`, `-h/--help` (só ajuda), `-n/--dry-run`, `--no-input`,
  `-o/--output`, `-p/--port`, `-q/--quiet`, `-u/--user`, `--version`; evite `-v` (verboso ou versão?).
- Faça o padrão certo para a maioria de quem usa.
- Pergunte o que falta, mas nunca exija a pergunta; pule as perguntas quando o stdin não é um TTY.
- Confirme o perigo pela gravidade: leve (talvez), moderado (pergunte, ofereça `--dry-run`), grave (digite o nome ou
  passe `--confirm=<nome>`).
- Aceite `-` para stdin/stdout onde se esperam arquivos.
- Uma palavra especial (`none`) para "sem valor", em vez de um valor vazio.
- Opções e subcomandos independentes da ordem, quando der.
- Nunca leia segredos de opções; use um arquivo (`--password-file`) ou o stdin.

## Interatividade

- Pergunte só quando o stdin é um TTY; com `--no-input`, nunca pergunte e falhe nomeando a opção.
- Sem eco para senhas.
- Deixe óbvio como sair; o Ctrl-C precisa funcionar.

## Subcomandos

- Os mesmos nomes de opção e o mesmo estilo de saída em todos.
- Uma ordem de nomes para comandos aninhados (substantivo verbo ou verbo substantivo), usada em todo lugar.
- Sem nomes parecidos demais (`update` e `upgrade`).

## Robustez

- Valide a entrada cedo.
- Responsivo mais que rápido: imprima algo em até ~100 ms, sobretudo antes de chamar a rede.
- Mostre progresso em trabalho longo; cuidado com a saída em paralelo.
- Dê tempo limite às operações de rede.
- Recuperável: rodar de novo depois de uma interrupção continua de onde parou.
- Só cair (crash-only): pouca limpeza na saída, adiada para a próxima execução.
- Espere o mau uso: scripts, redes ruins, muitas instâncias, ambientes estranhos.

## Compatibilidade futura

- Mantenha as mudanças aditivas; avise antes das não aditivas, dizendo como migrar.
- O texto para gente pode mudar; scripts devem usar `--plain`/`--json`.
- Sem subcomando coringa; sem abreviação implícita de subcomandos (só aliases explícitos).
- Sem bomba-relógio: nenhuma dependência dura de um serviço que pode sumir; nenhuma análise de uso que bloqueie.

## Sinais

- No Ctrl-C, diga algo na hora e saia o quanto antes; limite a limpeza com um tempo.
- Num segundo Ctrl-C durante a limpeza, pule o resto e diga isso.

## Configuração e variáveis de ambiente

- Ajustes por execução: opções (e talvez variáveis de ambiente). Por usuário ou projeto: opções e variáveis (talvez
  `.env`). Ajustes do projeto sob controle de versão: um arquivo de configuração.
- Precedência: opções > ambiente do shell > configuração do projeto (`.env`) > do usuário > do sistema.
- Siga o XDG (`~/.config`). Pergunte antes de alterar configuração que o programa não é dono; prefira outro arquivo.
- Variáveis: maiúsculas, dígitos e sublinhado; valor de uma linha; evite nomes do POSIX.
- Respeite as de uso geral: `NO_COLOR`, `FORCE_COLOR`, `DEBUG`, `EDITOR`, `HTTP(S)_PROXY`, `NO_PROXY`, `SHELL`, `TERM`,
  `TMPDIR`, `HOME`, `PAGER`, `LINES`, `COLUMNS`.
- `.env` serve para ajustes locais do projeto, não substitui um arquivo de configuração.
- Não leia segredos de variáveis de ambiente; use arquivos, pipes ou um cofre de segredos.

## Nome, distribuição e análise de uso

- Nome: uma palavra curta, memorável, em minúsculas (hífen vale), fácil de digitar, não genérica.
- Distribua como um binário ou um pacote nativo; documente a desinstalação.
- Sem telemetria sem consentimento; seja explícito sobre o que se coleta; prefira a adesão voluntária.
