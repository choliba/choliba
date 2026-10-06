# A pasta de trabalho

`choliba` roda sempre numa **pasta de trabalho**: a pasta, subindo a partir de onde o comando é chamado, cujo
`package.json` depende de `choliba` (é o que `bun add choliba` cria; o Bun também procura o `package.json`
subindo de pasta, por isso a [instalação](../primeiros-passos.md#instalação) começa criando um na pasta nova). É
nela que ficam o `.env`, os agentes (`.choliba/agents/`), as skills (`.choliba/skills/`) e os MCPs
(`.choliba/mcps/`) usados pelos comandos. Rodar
`choliba` de qualquer subpasta dela funciona do mesmo jeito. Essas três pastas são o padrão; `CHOL_AGENTS_DIR`,
`CHOL_SKILLS_DIR` e `CHOL_MCPS_DIR` no `.env` apontam para outras.
