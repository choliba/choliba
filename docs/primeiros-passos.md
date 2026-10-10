# Primeiros passos

> Instale o choliba, crie a pasta de trabalho e leve o primeiro pedido até o código implementado, com ticket e
> testes no caminho.

## Dependências

- [Bun](https://bun.sh)
  ```bash
  curl -fsSL https://bun.com/install | bash
  ```
- [install-browsers](https://playwright.dev/docs/browsers#install-browsers)

  ```bash
  bunx playwright install chromium
  ```

- Para rodar agentes, o CLI de um provider instalado e autenticado:
  - Provider suportados:
    [claude](https://claude.com/download)
    [cursor-agent](https://cursor.com/pt-BR/docs/cli/installation)

## Instalação

> _Atenção_

> _Durante a fase de desenvolvimento, choliba não será publicado como package no npm_

A versão de desenvolvimento é [v0.0.1-dev](https://github.com/choliba/choliba/releases/tag/v0.0.1-dev)

### Para instalar

```bash
mkdir dev-tools && cd dev-tools
echo '{ "name": "dev-tools", "private": true }' > package.json
bun add --trust \
  https://github.com/choliba/choliba/releases/download/v0.0.1-dev/choliba-0.0.1-dev.tgz
```

- O `--trust` deixa o Bun rodar o `postinstall` do pacote, que já executa `choliba setup`

- Se você rodou sem `--trust`:

```
bunx choliba setup
```

Sem sobrescrever o que já existe, ele:

- cria
  - `.choliba/agents/`
  - `.choliba/skills/`
  - `.choliba/mcps/`
  - `projects/`

- cria em `app/exemplo/` (uma página só)
- cria em `projects/exemplo/` um projeto que aponta para app/exemplo/
- copia de um template `.env.example`, `.gitignore`, `.editorconfig` (largura e indentação, que o Prettier lê) e os
  arquivos do Prettier e do ESLint, e cria o `.env` inicial com `CHOL_GLOBAL_DIR` apontando para
  `.cache/choliba` e `CHOL_PROJECTS_DIR` para `projects/`, os dois da própria pasta de trabalho;
- lista `choliba` em `trustedDependencies` do `package.json`, para que instalações futuras rodem o setup de novo
  sem pedir `--trust`;
- aponta o VS Code para o schema do `agent.yaml` (`.vscode/settings.json`);
- liga o autocomplete do bash (veja [Autocomplete](referencia/comandos.md#autocomplete)).

## A pasta de trabalho

`choliba` roda sempre numa **pasta de trabalho**: a pasta, subindo a partir de onde o comando é chamado, cujo
`package.json` depende de `choliba`. A [instalação](#instalação) começa criando um na pasta nova, porque o Bun também
procura o `package.json` subindo de pasta. É nela que ficam o `.env`, os agentes (`.choliba/agents/`), as skills
(`.choliba/skills/`) e os MCPs (`.choliba/mcps/`) usados pelos comandos. Rodar `choliba` de qualquer subpasta dela
funciona do mesmo jeito. Essas três pastas são o padrão; `CHOL_AGENTS_DIR`, `CHOL_SKILLS_DIR` e `CHOL_MCPS_DIR` no
[`.env`](referencia/env.md) apontam para outras.

## Atualização

A URL da release não muda a cada versão.

> _Durante a fase de desenvolvimento_

Para o Bun baixar o pacote novo (e não reaproveitar o do cache), remova e instale de novo, dentro da pasta de trabalho:

```
bun remove choliba
bun add --trust \
  https://github.com/choliba/choliba/releases/download/v0.0.1-dev/choliba-0.0.1-dev.tgz
```

Para conferir qual versão ficou instalada, rode

```
bunx choliba --version
```

e compare com o título da última atualização nas [notas da release](https://github.com/choliba/choliba/releases/tag/v0.0.1-dev).

A saída tem este formato:

```
$ bunx choliba --version
choliba 0.0.1-dev.16+1a2b3c4
```
