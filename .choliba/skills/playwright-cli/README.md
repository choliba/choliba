# playwright-cli (cópia da skill oficial do Playwright)

Cópia literal de `playwright-core/lib/tools/skills/playwright-cli/`, versão **1.63.0** — a mesma do
`@playwright/test` declarado em `packages/runner/package.json`, cujo `playwright cli` é o comando que ela
descreve. Licença do Playwright: Apache-2.0.

Neste repo, o comando é `bunx choliba playwright-cli <comando>` (o CLI do choliba), não o `playwright-cli` global que o
texto da skill cita. Quem usa: o agente `product-owner`, para navegar na aplicação como um usuário.

Para atualizar depois de subir o `@playwright/test`: copie de novo a pasta da versão instalada
(`node_modules/.bun/playwright-core@<versão>/node_modules/playwright-core/lib/tools/skills/playwright-cli/`) e troque
a versão acima. Não edite `SKILL.md` nem `references/` à mão.
