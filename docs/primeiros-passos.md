# Primeiros passos

> Instale o choliba, crie a pasta de trabalho e leve o primeiro pedido até o código implementado, com ticket e
> testes no caminho.

## Instalação

O choliba não está no npm: os pacotes são os `.tgz` da pré-release
[`v0.0.1-dev`](https://github.com/choliba/choliba/releases/tag/v0.0.1-dev), que é refeita a cada merge na
`master` (o endereço não muda).

Instale numa pasta que já tenha o próprio `package.json`:

```
echo '{ "name": "dev-tools", "private": true }' > package.json
bun add --trust \
  https://github.com/choliba/choliba/releases/download/v0.0.1-dev/choliba-0.0.1-dev.tgz
```

O `bun add` usa o primeiro `package.json` que encontra subindo a partir da pasta atual. Numa pasta vazia dentro de
outra que tenha um, ele instala o choliba **na de cima**, sem avisar. Com o `package.json` na pasta, a instalação
fica nela. O `name` identifica a pasta de trabalho, e o `private` evita uma publicação acidental no npm.

O `--trust` deixa o Bun rodar o `postinstall` do pacote, que já executa `choliba setup` (veja abaixo). Sem
`--trust`, instale e rode o setup à mão:

```
bun add \
  https://github.com/choliba/choliba/releases/download/v0.0.1-dev/choliba-0.0.1-dev.tgz
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
- cria um exemplo para experimentar: a aplicação `app/exemplo/` (uma página só) e o projeto de teste
  `projects/exemplo/`, que já passa com `bunx choliba tests exemplo`;
- copia de um template `.env.example`, `.gitignore`, `.editorconfig` (largura e indentação, que o Prettier lê) e os
  arquivos do Prettier e do ESLint, e cria o `.env` inicial com `CHOL_GLOBAL_DIR` apontando para
  `.cache/choliba` e `CHOL_PROJECTS_DIR` para `projects/`, os dois da própria pasta de trabalho;
- lista `choliba` em `trustedDependencies` do `package.json`, para que instalações futuras rodem o setup de novo
  sem pedir `--trust`;
- aponta o VS Code para o schema do `agent.yaml` (`.vscode/settings.json`);
- liga o autocomplete do bash (veja [Autocomplete](referencia/cli.md#autocomplete)).

## Atualização

A URL da release não muda a cada versão. Para o Bun baixar o pacote novo (e não reaproveitar o do cache), remova e
instale de novo, dentro da pasta de trabalho:

```
bun remove choliba
bun add --trust \
  https://github.com/choliba/choliba/releases/download/v0.0.1-dev/choliba-0.0.1-dev.tgz
```

Para conferir qual versão ficou instalada, rode `bunx choliba --version` e compare com o título da última
atualização nas [notas da release](https://github.com/choliba/choliba/releases/tag/v0.0.1-dev). A saída tem
este formato:

```
$ bunx choliba --version
choliba 0.0.1-dev.16+1a2b3c4
```

## Do zero ao primeiro ticket

Este passo a passo monta uma pasta de trabalho `~/dev/dev-tools` para testar e desenvolver uma aplicação em
`~/dev/minha-app`, que ainda pode estar vazia. As saídas são de uma execução real (com `/home/voce` no lugar da
pasta pessoal).

1. Crie a pasta da aplicação e a pasta de trabalho, e instale o choliba nela. O `setup` roda sozinho com `--trust`
   e cria o projeto de exemplo `projects/exemplo`:

   ```sh
   mkdir -p ~/dev/minha-app ~/dev/dev-tools
   cd ~/dev/dev-tools
   echo '{ "name": "dev-tools", "private": true }' > package.json
   bun add --trust https://github.com/choliba/choliba/releases/download/v0.0.1-dev/choliba-0.0.1-dev.tgz
   ```

2. O projeto de teste da aplicação segue o `projects/exemplo` que o setup criou: uma pasta em `projects/<nome>/`
   com `config.json` (o `baseURL` com `http://` e o `appDir`) e o `.env.json` a partir do exemplo.

   O `.env.json` guarda os dados que os testes usam em cada ambiente, como um usuário de teste. O `.gitignore` da
   pasta de trabalho o deixa fora do git. Crie-o a partir do exemplo e troque os `CHANGE_ME`. Se a aplicação ainda
   não tem login, qualquer valor serve:

   ```sh
   cp projects/minha-app/.env.example.json projects/minha-app/.env.json
   ```

   Enquanto o `.env.json` não existir, o `check` marca o projeto com `✗`, e os agentes não rodam nele, nem com
   `--dry-run`.

   Se a aplicação precisa de preparo ou de alguém que a suba para os testes, diga como no ambiente do
   `projects/minha-app/config.json`. Os dois campos são opcionais:

   ```json
   {
     "nome": "development",
     "baseURL": "http://localhost:3000",
     "appDir": "/home/voce/dev/minha-app",
     "setup": ["bun install"],
     "start": "bun run dev --port 3000",
     "default": true
   }
   ```

   - `setup`: comandos que o choliba roda em `appDir`, em ordem, antes de cada rodada de testes e de cada execução
     de agente.
   - `start`: o comando que sobe a aplicação. O choliba só o roda quando nada responde no `baseURL`, espera a
     aplicação responder e a derruba no fim. Uma aplicação que você já subiu é usada como está.

   Os agentes nunca sobem a aplicação. Sem `start`, quem sobe é você, e um agente com a aplicação fora do ar não
   roda (veja
   [A aplicação do projeto](referencia/cli.md#a-aplicação-do-projeto)).

3. O `product-owner` traz o MCP `mcp-app`, que precisa de `CHOL_MCP_APP_DIR` e `CHOL_MCP_APP_LOG_DIR` no `.env`.
   Como instalar o servidor e preencher as duas:
   [O servidor do MCP `mcp-app`](guias/instalar-agentes.md#o-servidor-do-mcp-mcp-app).

4. Confira. Com tudo no lugar, nada sai com `✗`:

   ```
   $ bunx choliba check
   Agentes (/home/voce/dev/dev-tools/.choliba/agents)
     ✓ implementer
     ✓ product-owner
     ✓ test-writer

   Projetos (/home/voce/dev/dev-tools/projects)
     ✓ exemplo
     ✓ minha-app
   ```

   Antes de rodar um agente de verdade, `--dry-run` mostra o que ele faria, na ordem, sem executar nada (veja
   [`--dry-run`](guias/dry-run.md)):

   ```sh
   bunx choliba product-owner --project minha-app --type story "a página inicial mostra o nome do site" --dry-run
   ```

5. Do ticket ao código implementado:

   ```sh
   # o ticket, os testes e a implementação
   bunx choliba product-owner --project minha-app --type story "a página inicial mostra o nome do site"
   bunx choliba test-writer --project minha-app --ticket minha-app-1
   bunx choliba implementer --project minha-app --ticket minha-app-1

   # os testes do ticket, a qualquer momento
   bunx choliba tests minha-app:1
   ```
