# playwright-trace (cópia da skill oficial do Playwright)

Cópia literal de `playwright-core/lib/tools/skills/playwright-trace/`, versão **1.63.0** — a mesma do
`@playwright/test` declarado em `packages/runner/package.json`, cujo `playwright trace` é o comando que ela
descreve. Licença do Playwright: Apache-2.0.

Neste repo, o comando é a ferramenta da run `playwright-trace` (`permissions.allow.tools` do `agent.yaml`; o prompt
traz o caminho), não o `npx playwright trace` que o texto da skill cita: o `npx` pode baixar outra versão do
Playwright. Quem usa: os agentes `test-writer` e `implementer`, para entender por que um teste falhou. O runner guarda um `trace.zip` por teste que falha (`trace: 'retain-on-failure'`), e o resumo
de `choliba tests --failures` traz o caminho de cada um.

Para atualizar depois de subir o `@playwright/test`: copie de novo a pasta da versão instalada
(`node_modules/.bun/playwright-core@<versão>/node_modules/playwright-core/lib/tools/skills/playwright-trace/`) e troque
a versão acima. Não edite `SKILL.md` à mão.
