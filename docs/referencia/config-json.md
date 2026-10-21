# `config.json` do projeto

> O `config.json` de um projeto: o nome, os ambientes com `baseURL` e `appDir`, o `setup` e o `start`, e quais
> navegadores rodam.

O arquivo fica em `projects/<nome>/config.json` (a pasta é `CHOL_PROJECTS_DIR`). O `new project` o cria a partir do
modelo. As credenciais de cada ambiente ficam no [`.env.json`](env-json.md), não aqui.

## Formato

Um objeto JSON. `name` e `envs` são obrigatórios. `envs` tem pelo menos um ambiente, e cada ambiente tem `nome`,
`baseURL` e `appDir` com texto não vazio.

```json
{
  "name": "app",
  "description": "",
  "environment": "development",
  "envs": [
    {
      "nome": "development",
      "baseURL": "http://localhost:3000",
      "appDir": "/home/voce/dev/app",
      "default": true,
      "setup": ["bun install"],
      "start": "bun index.ts",
      "resultsDir": "/tmp/app-resultados"
    }
  ],
  "devices": {
    "chromium": true,
    "firefox": false,
    "webkit": false,
    "mobile-chrome": false
  }
}
```

`environment`, `description`, `default`, `setup`, `start`, `resultsDir`, `devices` e `stack` podem faltar.

## Ambiente ativo

O choliba usa um ambiente, nesta ordem:

1. `environment`, quando o texto é o `nome` de um item de `envs`;
2. o item com `"default": true`;
3. o primeiro de `envs`.

Só `true` marca o padrão. Outro valor em `default` é ignorado. Um `environment` que não existe em `envs` é erro, e a
mensagem lista os nomes disponíveis. Um `nome` não pode ser `_global`.

O `appDir` relativo é resolvido a partir da pasta do projeto. O absoluto é usado como está. A spec recebe esse
caminho em `APP_DIR`, e o `baseURL` em `BASE_URL`: veja [O que a spec recebe](env-json.md#o-que-a-spec-recebe).

## `setup` e `start`

Os dois são opcionais e valem para o ambiente em que estão.

`setup` é uma lista de comandos. O choliba os roda em `appDir`, em ordem, antes dos testes e antes de um agente com
`--project`. Um comando que falha interrompe a rodada.

`start` é um comando só. O choliba o roda em `appDir` quando nada responde no `baseURL`, espera a aplicação e a
derruba no fim. Uma aplicação que já responde é usada como está, e o `start` não roda. O que acontece em cada passo:
[A aplicação do projeto](aplicacao-do-projeto.md).

## Onde ficam os resultados

`resultsDir` do ambiente ativo é a pasta dos artefatos de uma rodada sem ticket. Texto em branco conta como ausente.
`_global.resultsDir` no `.env.json` ganha dele. Sem os dois, vale a pasta de runs do projeto.

## Navegadores

`devices` liga ou desliga os quatro que o runner conhece: `chromium` (Desktop Chrome), `firefox` (Desktop Firefox),
`webkit` (Desktop Safari) e `mobile-chrome` (Pixel 7). Roda só o navegador cujo valor é `true`: um que não aparece
fica desligado. Sem `devices`, os quatro rodam. Um projeto novo traz os quatro, só com o `chromium` ligado.

Um ticket ainda pode ligar um navegador que o projeto deixa desligado, com `devices` no ticket ou num critério.

## `stack`

Com o que a aplicação é feita. Quem costuma gravar é um agente que analisa o código, por um step
[`write_config`](agent-yaml.md#steps); dá para escrever à mão também.

```json
"stack": {
  "language": { "name": "TypeScript", "version": "^5.9", "url": "https://www.typescriptlang.org/" },
  "frameworks": [{ "name": "react", "version": "^19.0", "url": "https://react.dev/" }],
  "libraries": [{ "name": "tailwindcss", "version": "^4.1", "url": "" }],
  "tools": [{ "name": "Docker", "version": "", "url": "" }]
}
```

Cada item tem `name`, a versão que o manifesto declara (`version`) e a página dele (`url`). Só `name` é obrigatório:
`version` e `url` que faltem viram `""`, e os espaços nas pontas saem. `language`, a linguagem principal, é obrigatório.
`frameworks`, `libraries` (as bibliotecas mais importantes) e `tools` (banco, ORM, Docker e outras ferramentas) são
listas de itens e podem faltar. Outra chave, em `stack` ou num item, é erro.

## O que barra a execução

O projeto não roda, e o [`choliba check`](../comandos/check.md) o marca com `✗`, quando o arquivo não é um objeto, falta
`name` ou `envs`, um ambiente não tem `nome`, `baseURL` ou `appDir`, ou um valor que a rodada usa, sem espaços nas
pontas, é `CHANGE_ME`. Isso vale para `name`, e no ambiente ativo para `baseURL`, `appDir`, `start` e cada comando
de `setup`. Um `CHANGE_ME` num ambiente que não é o ativo não barra. Um `stack` fora do formato também barra.
