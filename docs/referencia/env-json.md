# `.env.json` do projeto

> O `.env.json` de um projeto: as credenciais do ambiente ativo, a seção `_global` e o que a spec recebe, como
> `BASE_URL` e `APP_DIR`.

O arquivo fica em `projects/<nome>/.env.json` (a pasta é `CHOL_PROJECTS_DIR`). O `new project` não o cria: ele grava
o `.env.example.json`, e você copia. O `setup` põe `projects/*/.env.json` no `.gitignore` da pasta de trabalho. O
`.env` da pasta de trabalho é outro arquivo, o das variáveis `CHOL_*`: [`.env` da pasta de trabalho](env.md).

## Formato

Um objeto JSON. Cada chave é o `nome` de um ambiente do `config.json`, ou `_global`. O valor de cada chave é um
objeto, e cada valor dentro dele é texto. O modelo que o `new project` grava:

```json
{
  "development": {
    "TEST_USERNAME": "CHANGE_ME",
    "TEST_PASSWORD": "CHANGE_ME"
  }
}
```

`TEST_USERNAME` e `TEST_PASSWORD` são as chaves do modelo. Qualquer outra chave de texto vale do mesmo jeito: o
choliba não tem uma lista fechada de credenciais.

`_global` é opcional. Esse nome é reservado: um ambiente do `config.json` não pode se chamar `_global`.

## Ambiente ativo

A seção lida é a do ambiente ativo do `config.json`, nesta ordem:

1. o campo `environment`, quando nomeia um ambiente de `envs`;
2. o ambiente com `"default": true`;
3. o primeiro de `envs`.

Essa seção precisa existir. As outras ficam no arquivo e o choliba não as confere.

## O que a spec recebe

Antes dos testes, o choliba monta o `process.env` nesta ordem. Uma chave repetida fica com o valor de quem vem
depois:

1. `BASE_URL`, o `baseURL` do ambiente ativo no `config.json`;
2. `APP_DIR`, o `appDir` desse ambiente, em caminho absoluto (um caminho relativo é resolvido a partir da pasta do
   projeto);
3. as chaves da seção do ambiente ativo;
4. as chaves de `_global`.

Esses valores substituem os de mesmo nome que já estavam no shell. `baseURL`, `appDir`, `setup` e `start` continuam
no [`config.json`](config-json.md). O que o choliba faz com `setup` e `start`: [A aplicação do projeto](aplicacao-do-projeto.md).

## Onde ficam os resultados

`_global.resultsDir`, quando o texto não está em branco, é a pasta dos artefatos de uma rodada sem ticket. Sem ele,
vale o `resultsDir` do ambiente ativo no `config.json`. Sem esse, vale a pasta de runs do projeto, ao lado das runs
por ticket.

## O que barra a execução

O projeto não roda, e o [`choliba check`](../comandos/check.md) o marca com `✗`, quando:

- o `.env.json` não existe (a mensagem aponta o `.env.example.json`);
- falta a seção do ambiente ativo, ou essa seção não é um objeto;
- um valor da seção ativa ou de `_global` não é texto;
- um desses valores, sem espaços nas pontas, é `CHANGE_ME`.

Um `CHANGE_ME` num ambiente que não é o ativo não barra. Criar o arquivo e trocar os `CHANGE_ME` está em
[Do zero ao primeiro ticket](../guias/do-zero-ao-primeiro-ticket.md).
