# Diátaxis na prática

Fonte: <https://diataxis.fr/>. A Diátaxis separa a documentação pela necessidade do leitor em dois eixos, *adquirir*
habilidade ou *aplicá-la*, e *fazer* ou *saber*, o que dá quatro tipos. Cada um tem propósito, forma e defeitos típicos.

## Tutorial: aprender fazendo

- **Para:** quem chega e quer ficar capaz de trabalhar com o projeto.
- **Forma:** uma lição com um caminho só, passos concretos e um resultado visível a cada etapa ("agora você deve ver…").
  Quem escreve responde pelo sucesso do leitor, então o caminho é seguro e testado.
- **Evite:** oferecer escolhas, explicar teoria no meio da lição, depender do que o leitor não preparou.
- **Sintoma:** "Como alternativa, você pode…": isso é de um guia prático.

## Guia prático: resolver uma tarefa

- **Para:** quem já sabe o básico e tem um objetivo ("rodar um agente com o codex", "aprovar um comando negado").
- **Forma:** o título é o objetivo, depois os pré-requisitos, passos numerados e o resultado esperado. Condições do
  mundo real e variações cabem; ensinar não.
- **Evite:** explicar conceitos do zero (ligue para a explicação); cobrir toda opção (isso é referência).
- **Sintoma:** parágrafos de contexto antes do primeiro passo.

## Referência: consultar

- **Para:** quem está no meio do trabalho e precisa de um fato exato: uma opção, um campo, um padrão, um erro.
- **Forma:** espelha a estrutura da coisa descrita (uma seção por comando, uma linha por campo); completa, exata,
  neutra e regular. Tabelas e listas servem bem.
- **Evite:** instruções e opiniões; listas incompletas ("algumas das opções são…").
- **Sintoma:** uma entrada de referência que precisa de uma história para fazer sentido: a história é explicação.

## Explicação: entender

- **Para:** quem quer saber por que as coisas são como são.
- **Forma:** discursiva: contexto, história, decisões de desenho, trocas, alternativas, como as partes se encaixam.
  Pode ter opinião e ligar assuntos.
- **Evite:** passo a passo e fatos exaustivos.
- **Sintoma:** uma lista numerada de comandos: isso é um guia prático.

## Classificando uma página que já existe

Pergunte de cada seção: o leitor está *fazendo* ou *pensando*? *Aprendendo* ou *trabalhando*? Seções que respondem
diferente pertencem a páginas diferentes. Separe e ligue ("para entender por quê, veja…", "para todas as opções,
veja…").

## Num projeto pequeno

Projeto pequeno raramente precisa de quatro árvores. Um formato honesto e comum:

- `README.md`: um começo rápido (um tutorial pequeno) e links;
- uma página por área, cada uma em seções de guia prático com uma seção de referência no fim (tabelas de comandos,
  opções, chaves);
- explicação onde o desenho não é óbvio, em geral como ADR.

O que importa é que cada *seção* tenha um tipo, não que a árvore de pastas tenha quatro ramos.
