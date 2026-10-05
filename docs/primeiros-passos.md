# Primeiros passos

## Instalação

O choliba não está no npm: o pacote é o `.tgz` da pré-release
[`v0.0.1-dev`](https://github.com/jacksonbicalho/choliba/releases/tag/v0.0.1-dev), que é refeita a cada merge na
`master` (o endereço não muda).

```
bun add --trust \
  https://github.com/jacksonbicalho/choliba/releases/download/v0.0.1-dev/choliba-0.0.1-dev.tgz
```

O `--trust` deixa o Bun rodar o `postinstall` do pacote, que já executa `choliba setup` (veja abaixo). Sem
`--trust`, instale e rode o setup à mão:

```
bun add \
  https://github.com/jacksonbicalho/choliba/releases/download/v0.0.1-dev/choliba-0.0.1-dev.tgz
bunx choliba setup
```

## Dependências

- [Bun](https://bun.sh) (o choliba roda com ele).
- Os navegadores do Playwright, uma vez por máquina:

  ```
  bunx playwright install chromium
  ```

- Para rodar agentes, o CLI de um provider instalado e autenticado: `claude` (Claude Code) ou `cursor-agent`.

## `choliba setup`

Roda sozinho no `postinstall` (com `--trust`) ou à mão (`bunx choliba setup`). Sem sobrescrever o que já existe,
ele:

- cria `.choliba/agents/`, `.choliba/skills/`, `.choliba/mcps/` e `projects/` na pasta de trabalho;
- copia de um template `.env.example`, `.gitignore`, `.editorconfig` (largura e indentação, que o Prettier lê) e os
  arquivos do Prettier e do ESLint, e cria o `.env` inicial com `CHOL_GLOBAL_DIR` apontando para
  `.cache/choliba` e `CHOL_PROJECTS_DIR` para `projects/`, os dois da própria pasta de trabalho;
- lista `choliba` em `trustedDependencies` do `package.json`, para que instalações futuras rodem o setup de novo
  sem pedir `--trust`;
- liga o autocomplete do bash (veja abaixo).

## Atualização

A URL da release não muda a cada versão. Para o Bun baixar o pacote novo (e não reaproveitar o do cache), remova e
instale de novo:

```
bun remove choliba
bun add --trust \
  https://github.com/jacksonbicalho/choliba/releases/download/v0.0.1-dev/choliba-0.0.1-dev.tgz
```

## Uso

Numa pasta de trabalho com o choliba instalado, do projeto ao código implementado:

```sh
# um projeto para a aplicação em ../minha-app, e os agentes do repositório do choliba
bunx choliba projects create-project minha-app \
  --app-dir ../minha-app --base-url http://localhost:3000
bunx choliba install github:jacksonbicalho/choliba --path .choliba/agents/product-owner
bunx choliba install github:jacksonbicalho/choliba --path .choliba/agents/test-writer
bunx choliba install github:jacksonbicalho/choliba --path .choliba/agents/implementer
bunx choliba check

# o ticket, os testes e a implementação
bunx choliba product-owner --project minha-app --type story "a busca aceita filtro por data"
bunx choliba test-writer --project minha-app --ticket minha-app-1
bunx choliba implementer --project minha-app --ticket minha-app-1

# os testes do ticket, a qualquer momento
bunx choliba tests minha-app:1
```

Qualquer comando de agente aceita `--dry-run`, que mostra o que ele faria, na ordem, sem executar nada (veja
[`--dry-run`](guias/dry-run.md)).
