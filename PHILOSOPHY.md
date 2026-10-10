# Filosofia do choliba

> **Observar antes de agir. Limitar antes de executar. Verificar antes de concluir.**

## Por que choliba?

O nome vem da _Megascops choliba_, a corujinha-do-mato.

É uma pequena ave de rapina noturna que frequentemente permanece em um ponto de observação antes de capturar uma
presa. Em vez de depender de força bruta, observa o ambiente, identifica um alvo e age sobre ele.

Essa imagem representa a maneira como o choliba aborda mudanças de software.

O objetivo não é entregar um repositório inteiro a um agente e pedir que ele "resolva o problema". O choliba procura
dar a cada agente um **alvo delimitado**, o **contexto necessário para observá-lo**, as **ferramentas necessárias
para agir** e uma forma independente de **verificar o resultado**.

A coruja inspira o nome. Os princípios abaixo definem o projeto.

---

## 1. Observar antes de agir

Uma mudança começa pela compreensão do comportamento esperado, não pela alteração do código.

No fluxo padrão do choliba, a aplicação é observada pelo navegador, a necessidade é transformada em um ticket, os
critérios de aceite tornam-se testes e somente depois a implementação é modificada.

```text
observar
   ↓
definir
   ↓
testar
   ↓
implementar
   ↓
verificar
```

O código não é necessariamente a primeira fonte de verdade sobre o comportamento de uma aplicação. O comportamento
observável e os critérios de aceite também fazem parte dela.

Antes de modificar, o agente deve entender o alvo.

---

## 2. Um agente, um papel

Um agente deve ter uma responsabilidade clara. No fluxo de um ticket:

- o `product-owner` entende a mudança e produz o ticket;
- o `test-writer` transforma os critérios de aceite em testes;
- o `implementer` altera a aplicação para satisfazer esses testes.

Fora desse fluxo, o `docs-updater` mantém a documentação do próprio choliba coerente com o código.

Essas separações são intencionais.

Um agente que define o requisito, escreve sua própria verificação e modifica a implementação tem liberdade demais
para reinterpretar o problema até considerar sua própria solução correta.

Separar responsabilidades cria limites e permite que o resultado de uma etapa seja verificado pela seguinte.

---

## 3. O alvo deve ser delimitado

Um ticket representa o alvo de uma execução.

O agente não recebe simplesmente a missão de "melhorar o projeto". Ele recebe uma mudança específica, com critérios
que permitem determinar quando o trabalho terminou.

Isso reduz ambiguidade e limita alterações não relacionadas ao objetivo original.

Sempre que possível:

```text
uma intenção
    ↓
um ticket
    ↓
critérios observáveis
    ↓
evidências verificáveis
```

O agente deve modificar somente aquilo que é necessário para atingir esse alvo.

---

## 4. Menor privilégio por padrão

Um agente deve ter acesso apenas ao que precisa para cumprir seu papel.

Por isso, permissões no choliba são negadas por padrão e declaradas explicitamente no `agent.yaml`.

Um agente que precisa ler um diretório não ganha automaticamente permissão para escrevê-lo.

Um agente que precisa executar testes não ganha automaticamente permissão para executar qualquer comando.

O `implementer` altera a aplicação, mas não pode alterar os testes que julgam sua implementação.

A pergunta não deve ser:

> O que precisamos impedir este agente de fazer?

Mas:

> O que este agente realmente precisa fazer?

Todo o restante permanece fora de seu alcance. A força dessa garantia depende do provider: os limites de cada um
estão em [Segurança](docs/referencia/seguranca.md).

---

## 5. A ferramenta garante; o prompt orienta

Prompts são instruções para um modelo. Não são mecanismos de garantia.

Escrever no prompt:

> "não altere os testes"

não oferece a mesma garantia que impedir a escrita no diretório dos testes.

Pedir:

> "faça TDD"

não prova que os testes falharam antes da implementação.

Por isso, sempre que uma regra puder ser garantida mecanicamente pelo choliba, ela deve estar na ferramenta, e não
depender apenas do comportamento do modelo.

```text
prompt       → intenção
permissões   → limites
steps        → processo
testes       → evidência
portões      → garantia
```

Quanto mais importante a regra, menos ela deve depender apenas de uma instrução em linguagem natural.

---

## 6. Falhar faz parte da evidência

Um teste que falha antes da implementação não representa necessariamente um problema no processo.

Pode ser exatamente a evidência necessária de que existe algo a implementar.

Por isso o choliba distingue explicitamente os estados **red** e **green**.

```text
RED
o comportamento esperado ainda não existe
        ↓
IMPLEMENTAÇÃO
        ↓
GREEN
o comportamento esperado foi atendido
```

O estado anterior importa.

Um teste que passa depois de uma implementação demonstra alguma coisa.

Um teste que comprovadamente falhava antes e passa depois demonstra muito mais.

---

## 7. Verificar resultados, não intenções

Um agente afirmar que terminou não significa que terminou.

Uma implementação parecer correta não significa que satisfaz os critérios.

Um teste existir não significa que testa o comportamento esperado.

O choliba procura verificar resultados por meio de evidências externas ao raciocínio do agente.

A conclusão de uma etapa deve, sempre que possível, ser consequência de uma verificação executável.

```text
"acho que funciona"        ≠ evidência
"implementei corretamente" ≠ evidência

teste esperado em red
        +
implementação
        +
teste esperado em green
        =
evidência verificável
```

O agente propõe e executa mudanças.

A ferramenta decide se as condições verificáveis foram satisfeitas.

---

## 8. Contexto é uma capacidade

Dar mais contexto a um agente nem sempre é melhor.

Cada arquivo, ferramenta, comando, skill ou servidor MCP disponível aumenta aquilo que o agente pode considerar e, em
alguns casos, aquilo que pode alterar.

O choliba trata contexto como parte da definição do agente.

Um agente deve conhecer o suficiente para executar seu papel, mas não precisa conhecer todo o sistema.

Menos contexto irrelevante significa menos possibilidades de desvio e uma responsabilidade mais clara.

---

## 9. Execuções são descartáveis; as evidências, reproduzíveis

O estado incidental de uma execução não deve se transformar silenciosamente em dependência da próxima.

Por isso o choliba executa agentes em áreas de trabalho temporárias e controla explicitamente os artefatos que entram
e saem do processo.

Uma execução deve poder terminar, deixar suas evidências e desaparecer.

O que importa deve estar no projeto, no ticket, nos testes, no código ou em outro artefato explicitamente
persistido — não escondido no estado interno de uma sessão anterior do agente.

Duas execuções do mesmo agente podem chegar a resultados diferentes. As verificações, não: os testes de um ticket
podem ser rodados de novo a qualquer momento e devem dizer a mesma coisa.

---

## 10. Agentes são substituíveis; contratos devem permanecer

Modelos mudam.

Providers mudam.

Prompts evoluem.

O comportamento fundamental do sistema não deveria depender de um modelo específico interpretar perfeitamente uma
instrução específica.

O choliba procura colocar contratos importantes fora do modelo:

- entradas;
- saídas;
- permissões;
- comandos disponíveis;
- etapas da execução;
- critérios de aceite;
- testes;
- condições de sucesso.

Um agente pode ficar mais inteligente sem ganhar automaticamente mais autoridade.

---

## 11. Automação não elimina responsabilidade

O objetivo do choliba não é fazer alterações indiscriminadamente sem participação humana.

É tornar partes do processo de engenharia delegáveis sem perder seus limites e suas evidências.

Automação deve reduzir trabalho mecânico mantendo visível:

- o que foi solicitado;
- quem pode alterar o quê;
- quais critérios definem sucesso;
- quais mudanças foram realizadas;
- e quais verificações sustentam o resultado.

Quanto maior a autonomia, mais importantes se tornam esses limites.

---

## O princípio central

Todos esses princípios podem ser reduzidos a uma ideia:

> **Autonomia deve crescer junto com verificabilidade.**

Dar mais capacidade a um agente sem aumentar a capacidade de limitar e verificar suas ações apenas aumenta a
confiança necessária no modelo.

O choliba procura seguir a direção oposta.

```text
mais autonomia
      +
limites explícitos
      +
evidência verificável
      =
automação confiável
```

É por isso que a disciplina pertence à ferramenta, não ao prompt.

---

## A coruja

A _Megascops choliba_ não é a maior ave de rapina.

Não precisa ser.

Ela observa, seleciona seu alvo e age.

Essa é a ideia que o nome **choliba** procura carregar para o projeto:

> **observe com atenção, aja com precisão e deixe evidências de que o trabalho foi concluído.**
