<p align="center">
  <img src="docs/public/owl-logo-choliba.svg" alt="" width="140" />
</p>

<h1 align="center">choliba</h1>
<p align="center">
  <strong>Observe com atenção. Aja com precisão. Deixe evidências.</strong>
  <br />
  <em>Testes E2E multiprojeto com Playwright, operados por agentes.</em>
</p>

<p align="center">
  <a href="https://github.com/choliba/choliba/actions/workflows/ci.yml"><img src="https://github.com/choliba/choliba/actions/workflows/ci.yml/badge.svg?branch=develop" alt="CI" /></a>
  <a href="COVERAGE.md"><img src="https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/choliba/choliba/develop/.github/badges/coverage.json" alt="cobertura" /></a>
  <a href="https://github.com/choliba/choliba/releases/tag/v0.0.1-dev"><img src="https://img.shields.io/github/v/release/choliba/choliba?include_prereleases" alt="release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/licen%C3%A7a-MIT-blue.svg" alt="licença MIT" /></a>
</p>

O choliba organiza os testes de ponta a ponta de várias aplicações em **projetos** (a URL de cada ambiente, as
credenciais de teste e os specs) e **tickets** (o que muda na aplicação, com critérios de aceite). Agentes de IA
fazem o trabalho em etapas:

- **`product-owner`**: escreve o ticket usando a aplicação no navegador.
- **`test-writer`**: transforma cada critério de aceite num teste que falha.
- **`implementer`**: altera a aplicação até os testes passarem.

Quem garante a disciplina é a ferramenta, não o prompt: portões conferem que os testes falham antes e passam
depois, e cada agente só lê, escreve e roda o que o seu `agent.yaml` libera. Tudo roda numa pasta de trabalho, que
o pacote cria ao ser instalado.

## Índice

- [Contexto](#contexto)
- [Instalação](#instalação)
- [Uso](#uso)
- [Documentação](#documentação)
- [Filosofia](#filosofia)
- [Contribuindo](#contribuindo)
- [Mantenedores](#mantenedores)
- [Licença](#licença)

## Contexto

Testar várias aplicações com Playwright costuma espalhar specs, URLs e credenciais; e pedir a um agente de IA que
"faça TDD" não garante que ele escreva o teste antes, nem que não o afrouxe para passar. O choliba junta os testes
por projeto e ticket e divide o trabalho entre agentes com papéis e permissões separados, com a conferência do
red e do green feita pelo próprio CLI.

Ele depende do [Playwright](https://playwright.dev) (os testes e o navegador que os agentes usam, via
`playwright cli`), do [Bun](https://bun.sh) e de um provider de agente:

- [Claude Code](https://claude.com/claude-code) (`claude`)
- [Cursor CLI](https://cursor.com/cli) (`cursor-agent`)

Agentes podem usar skills e servidores MCP, instalados na pasta de trabalho.

## Instalação

O choliba não está no npm: o pacote é o `.tgz` da pré-release
[`v0.0.1-dev`](https://github.com/choliba/choliba/releases/tag/v0.0.1-dev), refeita a cada merge na `master`.

Numa pasta com o próprio `package.json` (sem ele, o Bun pode instalar numa pasta acima):

```
echo '{ "name": "dev-tools", "private": true }' > package.json
bun add --trust \
  https://github.com/choliba/choliba/releases/download/v0.0.1-dev/choliba-0.0.1-dev.tgz
```

O `--trust` roda o `choliba setup`, que monta a pasta de trabalho e liga o autocomplete. Dependências, o que o setup
cria e como atualizar: [Primeiros passos](docs/primeiros-passos.md).

Também dá para começar pelo assistente [`choliba-cli`](docs/choliba-cli.md), instalado uma vez na máquina, que
cria a pasta, instala o choliba e os agentes, e cria agentes novos:

```
bun add -g \
  https://github.com/choliba/choliba/releases/download/v0.0.1-dev/choliba-cli-0.0.1-dev.tgz
choliba-cli new dev-tools
```

## Uso

Numa pasta de trabalho com o choliba instalado, do projeto ao código implementado (o passo a passo completo, de
uma pasta vazia ao `check` verde, está em
[Do zero ao primeiro ticket](docs/primeiros-passos.md#do-zero-ao-primeiro-ticket)):

```sh
# um projeto para a aplicação em ../minha-app, e os agentes do repositório do choliba
bunx choliba projects create-project minha-app \
  --app-dir ../minha-app --base-url http://localhost:3000
bunx choliba install github:choliba/choliba --path .choliba/agents/product-owner
bunx choliba install github:choliba/choliba --path .choliba/agents/test-writer
bunx choliba install github:choliba/choliba --path .choliba/agents/implementer
bunx choliba check

# o ticket, os testes e a implementação
bunx choliba product-owner --project minha-app --type story "a busca aceita filtro por data"
bunx choliba test-writer --project minha-app --ticket minha-app-1
bunx choliba implementer --project minha-app --ticket minha-app-1

# os testes do ticket, a qualquer momento
bunx choliba tests minha-app:1
```

Qualquer comando de agente aceita `--dry-run`, que mostra o que ele faria, na ordem, sem executar nada. Todos os
comandos: [CLI](docs/referencia/cli.md) ou `choliba --help`.

**Segurança:** cada agente só lê, escreve e roda o que o seu `agent.yaml` libera, e cada execução roda numa pasta
vazia. Detalhes e limites de cada provider: [Segurança](docs/conceitos/seguranca.md).

## Documentação

No site [choliba.github.io](https://choliba.github.io/), com busca, ou em
[`docs/`](docs/README.md), por tipo:

- **Para começar:** [Primeiros passos](docs/primeiros-passos.md) e o assistente [`choliba-cli`](docs/choliba-cli.md).
- **Guias:** [escrever um agente](docs/guias/escrever-um-agente.md),
  [instalar agentes, skills e MCPs](docs/guias/instalar-agentes.md), [`--dry-run`](docs/guias/dry-run.md).
- **Referência:** [CLI](docs/referencia/cli.md), [`agent.yaml`](docs/referencia/agent-yaml.md),
  [`.env`](docs/referencia/env.md).
- **Conceitos:** [a pasta de trabalho](docs/conceitos/pasta-de-trabalho.md),
  [o que acontece numa execução](docs/conceitos/execucao.md),
  [critérios de aceite e portões](docs/conceitos/criterios-e-portoes.md), [segurança](docs/conceitos/seguranca.md),
  e os princípios em [PHILOSOPHY.md](PHILOSOPHY.md).

Para quem mexe no código: [CONTRIBUTING.md](CONTRIBUTING.md) (como contribuir e os padrões do projeto) e
[ARCHITECTURE.md](ARCHITECTURE.md) (como o código é organizado).

## Filosofia

O nome vem da _Megascops choliba_, a corujinha-do-mato. Assim como ela observa antes de agir e ataca um alvo
específico com precisão, o choliba procura transformar mudanças de software num processo observável, delimitado e
verificável.

Um agente não recebe liberdade irrestrita para "resolver o problema". Cada agente tem um papel, um contexto, um alvo
e permissões definidos. A ferramenta controla o processo e verifica os resultados; o prompt orienta o trabalho, mas
não garante que as regras foram cumpridas.

Em resumo: observar antes de agir, limitar antes de executar e verificar antes de concluir. Esses princípios e as
decisões de projeto que derivam deles estão em [PHILOSOPHY.md](PHILOSOPHY.md).

## Contribuindo

Perguntas, bugs e sugestões vão para as [issues](https://github.com/choliba/choliba/issues). Para enviar um
pull request, veja [CONTRIBUTING.md](CONTRIBUTING.md).

## Mantenedores

- Jackson Bicalho — [@jacksonbicalho](https://github.com/jacksonbicalho)

## Licença

[MIT](LICENSE) © 2026 Jackson Bicalho
