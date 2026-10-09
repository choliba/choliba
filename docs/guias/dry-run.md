# `--dry-run`

> Com `--dry-run`, o choliba mostra na ordem o que um comando faria, sem executar nada: nenhum step, nenhum ticket,
> nenhum provider.

`--dry-run` mostra, na ordem, o que o comando faria sem ele, e **não executa nada**: nenhum step, nenhum ticket,
nenhuma pasta de execução, nenhum provider. Vale em qualquer modo. Ele só lê o que precisa para montar a lista (o
`agent.yaml`, as skills, os MCPs, o projeto e o ticket), então um problema que faria a execução falhar antes do
agente aparece do mesmo jeito.

```
$ bunx choliba docs-updater --mode plan --dry-run
Sem --dry-run, faria nesta ordem:

 1. [CLI]    plan.before 1/3 — git_diff: develop .cache/docs-updater/diff.patch --pending …
             se falhar: para aqui, o agente não roda
 2. [CLI]    plan.before 2/3 — add_files: documentacao_atual docs/**/*.md
             se falhar: para aqui, o agente não roda
 3. [CLI]    plan.before 3/3 — add_files: readme_atual README.md
             se falhar: para aqui, o agente não roda
 4. [agente] claude · modelo padrão do provider · modo plan · na pasta .cache/runs/<id>
             skills: documentation · MCPs: nenhum
             prompt de sistema: 5953 bytes · prompt do usuário: 444 bytes (--show-prompt mostra os dois)
             comando: claude -p <prompt do usuário> --output-format stream-json --verbose …
 5. [CLI]    plan.after.success (se o agente sair com 0): nada
             plan.after.failure (se o agente falhar): nada
             plan.after.always:
               1/1 run: rm -f .cache/docs-updater/diff.patch
```

Com `--show-prompt` (só junto de `--dry-run`), a saída segue com os dois prompts completos, a linha de comando
completa (em JSON, um argumento por item) e, no Cursor, o `.cursor/cli.json` da pasta da execução e o
`.cursor/mcp.json` da raiz, como seriam gravados.
