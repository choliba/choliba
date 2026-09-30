# playwright-component-testing (cópia da skill oficial do Playwright)

Cópia literal de `playwright-core/lib/tools/skills/playwright-component-testing/`, versão **1.63.0** — a mesma do
`@playwright/test` declarado em `packages/runner/package.json`. Licença do Playwright: Apache-2.0.

Ensina a testar componentes React ou Vue isolados com testes Playwright comuns, contra uma galeria de stories servida
pela própria aplicação. Nenhum agente a usa ainda: montar a galeria muda a estrutura da aplicação, então ela só entra
num agente quando um projeto pedir teste de componente.

Para atualizar depois de subir o `@playwright/test`: copie de novo a pasta da versão instalada
(`node_modules/.bun/playwright-core@<versão>/node_modules/playwright-core/lib/tools/skills/playwright-component-testing/`)
e troque a versão acima. Não edite `SKILL.md` nem `references/` à mão.
