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
- **`tech-stack-analyzer`**: registra a linguagem, os frameworks, as bibliotecas e as ferramentas da aplicação no
  `config.json` do projeto.

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
- [Codex CLI](https://developers.openai.com/codex/cli) (`codex`)
- [Cursor CLI](https://cursor.com/cli) (`cursor-agent`)

Agentes podem usar skills e servidores MCP, instalados na pasta de trabalho.

## Instalação

O choliba não está no npm: os pacotes são os `.tgz` da pré-release
[`v0.0.1-dev`](https://github.com/choliba/choliba/releases/tag/v0.0.1-dev), refeita a cada merge na `master`.

Instale numa pasta que já tenha o próprio `package.json` (sem ele, o Bun pode instalar numa pasta acima). Baixe o
pacote e o checksum publicado na mesma release e verifique o arquivo antes de instalar:

```sh
echo '{ "name": "dev-tools", "private": true }' > package.json
curl -LO https://github.com/choliba/choliba/releases/download/v0.0.1-dev/choliba-0.0.1-dev.tgz
curl -LO https://github.com/choliba/choliba/releases/download/v0.0.1-dev/choliba-0.0.1-dev.tgz.sha256
sha256sum -c choliba-0.0.1-dev.tgz.sha256
bun add --trust ./choliba-0.0.1-dev.tgz
```

Não instale se `sha256sum -c` não terminar em `OK`. O `--trust` autoriza o pacote a executar o `postinstall`, que
roda `choliba setup`, monta a pasta de trabalho e liga o autocomplete.

Dependências, o que o setup cria e como atualizar: [Primeiros passos](docs/primeiros-passos.md).

## Uso

Numa pasta de trabalho com o choliba instalado, do projeto ao código implementado (o passo a passo completo, de
uma pasta vazia ao `check` verde, está em
[Do zero ao primeiro ticket](docs/primeiros-passos.md#do-zero-ao-primeiro-ticket)):

```sh
# o exemplo que o setup cria, e os agentes em .choliba/agents/
bun choliba check

# o ticket, os testes e a implementação
bun choliba run agent product-owner --project minha-app --type story "a busca aceita filtro por data"
bun choliba run agent test-writer --project minha-app --ticket minha-app-1
bun choliba run agent implementer --project minha-app --ticket minha-app-1

# os testes do ticket, a qualquer momento
bun choliba run tests minha-app:1
```

Qualquer comando de agente aceita [`--dry-run`](docs/comandos/run.md#--dry-run), que mostra o que ele faria, na
ordem, sem executar nada. Todos os comandos: [Comandos](docs/comandos/index.md) ou `choliba --help`.

**Segurança:** cada agente só lê, escreve e roda o que o seu `agent.yaml` libera, e cada execução roda numa pasta
vazia. Detalhes e limites de cada provider: [Segurança](docs/referencia/seguranca.md).

## Documentação

No site [choliba.github.io](https://choliba.github.io/), com busca, ou em
[`docs/`](docs/README.md), por tipo:

- **Para começar:** [Primeiros passos](docs/primeiros-passos.md).
- **Guias:** [escrever um agente](docs/guias/escrever-um-agente.md),
  [instalar agentes, skills e MCPs](docs/guias/instalar-agentes.md).
- **Referência:** [Comandos](docs/comandos/index.md),
  [ciclo de execução de um agente](docs/referencia/ciclo-de-execucao-agente.md),
  [`agent.yaml`](docs/referencia/agent-yaml.md), [segurança](docs/referencia/seguranca.md),
  [`.env`](docs/referencia/env.md).
- **Princípios:** [PHILOSOPHY.md](PHILOSOPHY.md).

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
