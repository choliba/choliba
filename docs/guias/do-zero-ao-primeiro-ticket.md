# Do zero ao primeiro ticket

> Monte a pasta de trabalho `~/dev/dev-tools` e leve o primeiro pedido de `~/dev/minha-app` até o código, com ticket e
> testes.

A aplicação ainda pode estar vazia. Nas saídas, `/home/voce` está no lugar da pasta pessoal.

1. Crie a pasta da aplicação e a pasta de trabalho

```bash
mkdir -p ~/dev/{minha-app,dev-tools}
```

2. Na pasta de trabalho crie o ambiente choliba

```bash
cd ~/dev/dev-tools
echo '{ "name": "dev-tools", "private": true }' > package.json
bun add --trust \
  https://github.com/choliba/choliba/releases/download/v0.0.1-dev/choliba-0.0.1-dev.tgz
```

O `setup` roda sozinho com `--trust` e cria o projeto de exemplo `projects/exemplo`. O que mais ele cria está em
[Primeiros passos](../primeiros-passos.md#para-instalar). Os comandos abaixo rodam nessa pasta.

3. Crie o projeto de teste da aplicação

O projeto segue o `projects/exemplo`: uma pasta `projects/<nome>/` com `config.json` e `.env.json`.

```bash
mkdir -p projects/minha-app
cp projects/exemplo/.env.example.json projects/minha-app/.env.json
```

Grave `projects/minha-app/config.json`. O `baseURL` leva `http://`, e o `appDir` é a pasta da aplicação. Só o
Chromium fica ligado, o navegador de [Dependências](../primeiros-passos.md#dependências):

```json
{
  "name": "minha-app",
  "envs": [
    {
      "nome": "development",
      "baseURL": "http://localhost:3000",
      "appDir": "/home/voce/dev/minha-app",
      "default": true
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

O `.env.json` guarda os dados que os testes usam em cada ambiente, como um usuário de teste. O `.gitignore` da pasta
de trabalho o deixa fora do git. Troque os `CHANGE_ME`. Se a aplicação ainda não tem login, qualquer valor serve:

```json
{
  "development": {
    "TEST_USERNAME": "ana",
    "TEST_PASSWORD": "senha"
  }
}
```

Enquanto o `.env.json` não existir, o `check` marca o projeto com `✗`, e os agentes não rodam nele, nem com
[`--dry-run`](../referencia/cli.md#--dry-run).

Se a aplicação precisa de preparo ou de alguém que a suba para os testes, diga como no ambiente do
`config.json`. Os dois campos são opcionais:

- `setup`: comandos que o choliba roda em `appDir`, em ordem, antes de cada rodada de testes e de cada execução de
  agente.
- `start`: o comando que sobe a aplicação. O choliba só o roda quando nada responde no `baseURL`, espera a aplicação
  responder e a derruba no fim. Uma aplicação que você já subiu é usada como está.

Os agentes nunca sobem a aplicação. Sem `start`, quem sobe é você, e um agente com a aplicação fora do ar não roda
(veja [A aplicação do projeto](../referencia/cli.md#a-aplicação-do-projeto)).

4. Instale os agentes que escrevem o ticket, os testes e o código

```bash
bunx choliba add github:choliba/choliba --path .agents/agents/product-owner
bunx choliba add github:choliba/choliba --path .agents/agents/test-writer
bunx choliba add github:choliba/choliba --path .agents/agents/implementer
```

Cada um traz as skills que declara. O que mais dá para instalar está em
[Instalar agentes, skills e MCPs](instalar-agentes.md).

5. Confira

Com tudo no lugar, nada sai com `✗`:

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

6. Do ticket ao código implementado

A aplicação precisa responder no `baseURL`. O ticket novo fica `minha-app-1`:

```bash
bunx choliba product-owner --project minha-app --type story "a página inicial mostra o nome do site"
bunx choliba test-writer --project minha-app --ticket minha-app-1
bunx choliba implementer --project minha-app --ticket minha-app-1
```

Os testes desse ticket, a qualquer momento:

```bash
bunx choliba tests minha-app:1
```
