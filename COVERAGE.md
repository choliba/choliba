# Cobertura de testes

Gerado automaticamente por `bun run test:cov` em 04/10/2026 22:16:01 — não editar manualmente.

## Resumo

Status|Pacote|% Stmts|% Branch|% Funcs|% Lines
--|--|--|--|--|--
🟢|**Total**|100.00|100.00|100.00|100.00
🟢|[packages/agents](packages/agents)|100.00|100.00|100.00|100.00
🟢|[packages/choliba](packages/choliba)|100.00|100.00|100.00|100.00
🟢|[packages/core](packages/core)|100.00|100.00|100.00|100.00
🟢|[packages/projects](packages/projects)|100.00|100.00|100.00|100.00
🟢|[packages/runner](packages/runner)|100.00|100.00|100.00|100.00
🟢|[packages/terminal](packages/terminal)|100.00|100.00|100.00|100.00

## Por pacote

<details>
<summary>🟢 <b>packages/agents</b> — 100.00% das linhas, 39 arquivos</summary>

Status|Arquivo|% Stmts|% Branch|% Funcs|% Lines
--|--|--|--|--|--
🟢|[src/agents/agent-loader.ts](packages/agents/src/agents/agent-loader.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/agent-validation.ts](packages/agents/src/agents/agent-validation.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/agents.help.ts](packages/agents/src/agents/agents.help.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/commands/agent.ts](packages/agents/src/agents/commands/agent.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/commands/command-registry.ts](packages/agents/src/agents/commands/command-registry.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/commands/define-command.ts](packages/agents/src/agents/commands/define-command.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/commands/index.ts](packages/agents/src/agents/commands/index.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/dto/run-agent.dto.ts](packages/agents/src/agents/dto/run-agent.dto.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/workspace-dirs.ts](packages/agents/src/agents/workspace-dirs.ts)|100.00|100.00|100.00|100.00
🟢|[src/index.ts](packages/agents/src/index.ts)|100.00|100.00|100.00|100.00
🟢|[src/mcps/mcps.ts](packages/agents/src/mcps/mcps.ts)|100.00|100.00|100.00|100.00
🟢|[src/plans/plan-store.ts](packages/agents/src/plans/plan-store.ts)|100.00|100.00|100.00|100.00
🟢|[src/providers/claude/index.ts](packages/agents/src/providers/claude/index.ts)|100.00|100.00|100.00|100.00
🟢|[src/providers/claude/permissions.ts](packages/agents/src/providers/claude/permissions.ts)|100.00|100.00|100.00|100.00
🟢|[src/providers/cursor/cli-json.ts](packages/agents/src/providers/cursor/cli-json.ts)|100.00|100.00|100.00|100.00
🟢|[src/providers/cursor/index.ts](packages/agents/src/providers/cursor/index.ts)|100.00|100.00|100.00|100.00
🟢|[src/providers/cursor/permissions.ts](packages/agents/src/providers/cursor/permissions.ts)|100.00|100.00|100.00|100.00
🟢|[src/providers/cursor/tool-calls.ts](packages/agents/src/providers/cursor/tool-calls.ts)|100.00|100.00|100.00|100.00
🟢|[src/providers/message-blocks.ts](packages/agents/src/providers/message-blocks.ts)|100.00|100.00|100.00|100.00
🟢|[src/providers/registry.ts](packages/agents/src/providers/registry.ts)|100.00|100.00|100.00|100.00
🟢|[src/providers/stream-json.ts](packages/agents/src/providers/stream-json.ts)|100.00|100.00|100.00|100.00
🟢|[src/runs/dry-run.ts](packages/agents/src/runs/dry-run.ts)|100.00|100.00|100.00|100.00
🟢|[src/runs/permissions.ts](packages/agents/src/runs/permissions.ts)|100.00|100.00|100.00|100.00
🟢|[src/runs/prompt.ts](packages/agents/src/runs/prompt.ts)|100.00|100.00|100.00|100.00
🟢|[src/runs/render.ts](packages/agents/src/runs/render.ts)|100.00|100.00|100.00|100.00
🟢|[src/runs/run-agent.ts](packages/agents/src/runs/run-agent.ts)|100.00|100.00|100.00|100.00
🟢|[src/runs/run-agents.ts](packages/agents/src/runs/run-agents.ts)|100.00|100.00|100.00|100.00
🟢|[src/runs/ticket-run.ts](packages/agents/src/runs/ticket-run.ts)|100.00|100.00|100.00|100.00
🟢|[src/runs/vars.ts](packages/agents/src/runs/vars.ts)|100.00|100.00|100.00|100.00
🟢|[src/shared/json.ts](packages/agents/src/shared/json.ts)|100.00|100.00|100.00|100.00
🟢|[src/skills/skills.ts](packages/agents/src/skills/skills.ts)|100.00|100.00|100.00|100.00
🟢|[src/steps/actions.ts](packages/agents/src/steps/actions.ts)|100.00|100.00|100.00|100.00
🟢|[src/steps/add-files.ts](packages/agents/src/steps/add-files.ts)|100.00|100.00|100.00|100.00
🟢|[src/steps/constants.ts](packages/agents/src/steps/constants.ts)|100.00|100.00|100.00|100.00
🟢|[src/steps/git-state.ts](packages/agents/src/steps/git-state.ts)|100.00|100.00|100.00|100.00
🟢|[src/steps/git-working-tree-diff.ts](packages/agents/src/steps/git-working-tree-diff.ts)|100.00|100.00|100.00|100.00
🟢|[src/steps/index-diff.ts](packages/agents/src/steps/index-diff.ts)|100.00|100.00|100.00|100.00
🟢|[src/steps/registry.ts](packages/agents/src/steps/registry.ts)|100.00|100.00|100.00|100.00
🟢|[src/steps/working-tree-diff.ts](packages/agents/src/steps/working-tree-diff.ts)|100.00|100.00|100.00|100.00

</details>

<details>
<summary>🟢 <b>packages/choliba</b> — 100.00% das linhas, 8 arquivos</summary>

Status|Arquivo|% Stmts|% Branch|% Funcs|% Lines
--|--|--|--|--|--
🟢|[src/check.ts](packages/choliba/src/check.ts)|100.00|100.00|100.00|100.00
🟢|[src/completion.ts](packages/choliba/src/completion.ts)|100.00|100.00|100.00|100.00
🟢|[src/eslint-config.ts](packages/choliba/src/eslint-config.ts)|100.00|100.00|100.00|100.00
🟢|[src/install-source.ts](packages/choliba/src/install-source.ts)|100.00|100.00|100.00|100.00
🟢|[src/install.ts](packages/choliba/src/install.ts)|100.00|100.00|100.00|100.00
🟢|[src/playwright-args.ts](packages/choliba/src/playwright-args.ts)|100.00|100.00|100.00|100.00
🟢|[src/route.ts](packages/choliba/src/route.ts)|100.00|100.00|100.00|100.00
🟢|[src/setup.ts](packages/choliba/src/setup.ts)|100.00|100.00|100.00|100.00

</details>

<details>
<summary>🟢 <b>packages/core</b> — 100.00% das linhas, 33 arquivos</summary>

Status|Arquivo|% Stmts|% Branch|% Funcs|% Lines
--|--|--|--|--|--
🟢|[src/cli/cli-command.ts](packages/core/src/cli/cli-command.ts)|100.00|100.00|100.00|100.00
🟢|[src/cli/cli-help.service.ts](packages/core/src/cli/cli-help.service.ts)|100.00|100.00|100.00|100.00
🟢|[src/cli/cli.module.ts](packages/core/src/cli/cli.module.ts)|100.00|100.00|100.00|100.00
🟢|[src/cli/command-io.ts](packages/core/src/cli/command-io.ts)|100.00|100.00|100.00|100.00
🟢|[src/cli/complete.ts](packages/core/src/cli/complete.ts)|100.00|100.00|100.00|100.00
🟢|[src/cli/help.ts](packages/core/src/cli/help.ts)|100.00|100.00|100.00|100.00
🟢|[src/cli/index.ts](packages/core/src/cli/index.ts)|100.00|100.00|100.00|100.00
🟢|[src/cli/message-of.ts](packages/core/src/cli/message-of.ts)|100.00|100.00|100.00|100.00
🟢|[src/cli/scripts-help.ts](packages/core/src/cli/scripts-help.ts)|100.00|100.00|100.00|100.00
🟢|[src/cli/wants-help.ts](packages/core/src/cli/wants-help.ts)|100.00|100.00|100.00|100.00
🟢|[src/config/config.module.ts](packages/core/src/config/config.module.ts)|100.00|100.00|100.00|100.00
🟢|[src/config/config.service.ts](packages/core/src/config/config.service.ts)|100.00|100.00|100.00|100.00
🟢|[src/config/files.ts](packages/core/src/config/files.ts)|100.00|100.00|100.00|100.00
🟢|[src/config/index.ts](packages/core/src/config/index.ts)|100.00|100.00|100.00|100.00
🟢|[src/config/layout.ts](packages/core/src/config/layout.ts)|100.00|100.00|100.00|100.00
🟢|[src/config/repo-config.ts](packages/core/src/config/repo-config.ts)|100.00|100.00|100.00|100.00
🟢|[src/config/resources.ts](packages/core/src/config/resources.ts)|100.00|100.00|100.00|100.00
🟢|[src/config/vars.ts](packages/core/src/config/vars.ts)|100.00|100.00|100.00|100.00
🟢|[src/config/workspace.ts](packages/core/src/config/workspace.ts)|100.00|100.00|100.00|100.00
🟢|[src/nest.ts](packages/core/src/nest.ts)|100.00|100.00|100.00|100.00
🟢|[src/platform/exit-status.ts](packages/core/src/platform/exit-status.ts)|100.00|100.00|100.00|100.00
🟢|[src/platform/git-run.ts](packages/core/src/platform/git-run.ts)|100.00|100.00|100.00|100.00
🟢|[src/platform/index.ts](packages/core/src/platform/index.ts)|100.00|100.00|100.00|100.00
🟢|[src/platform/platform.constants.ts](packages/core/src/platform/platform.constants.ts)|100.00|100.00|100.00|100.00
🟢|[src/platform/platform.module.ts](packages/core/src/platform/platform.module.ts)|100.00|100.00|100.00|100.00
🟢|[src/platform/raw-args.ts](packages/core/src/platform/raw-args.ts)|100.00|100.00|100.00|100.00
🟢|[src/testing/index.ts](packages/core/src/testing/index.ts)|100.00|100.00|100.00|100.00
🟢|[src/theme/ansi.ts](packages/core/src/theme/ansi.ts)|100.00|100.00|100.00|100.00
🟢|[src/theme/index.ts](packages/core/src/theme/index.ts)|100.00|100.00|100.00|100.00
🟢|[src/theme/resolve-theme.ts](packages/core/src/theme/resolve-theme.ts)|100.00|100.00|100.00|100.00
🟢|[src/theme/theme.defaults.ts](packages/core/src/theme/theme.defaults.ts)|100.00|100.00|100.00|100.00
🟢|[src/theme/theme.module.ts](packages/core/src/theme/theme.module.ts)|100.00|100.00|100.00|100.00
🟢|[src/theme/theme.service.ts](packages/core/src/theme/theme.service.ts)|100.00|100.00|100.00|100.00

</details>

<details>
<summary>🟢 <b>packages/projects</b> — 100.00% das linhas, 25 arquivos</summary>

Status|Arquivo|% Stmts|% Branch|% Funcs|% Lines
--|--|--|--|--|--
🟢|[src/index.ts](packages/projects/src/index.ts)|100.00|100.00|100.00|100.00
🟢|[src/locations/locations.module.ts](packages/projects/src/locations/locations.module.ts)|100.00|100.00|100.00|100.00
🟢|[src/locations/locations.service.ts](packages/projects/src/locations/locations.service.ts)|100.00|100.00|100.00|100.00
🟢|[src/locations/locations.ts](packages/projects/src/locations/locations.ts)|100.00|100.00|100.00|100.00
🟢|[src/locations/results.ts](packages/projects/src/locations/results.ts)|100.00|100.00|100.00|100.00
🟢|[src/nest.ts](packages/projects/src/nest.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/dto/create-project.dto.ts](packages/projects/src/projects/dto/create-project.dto.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/project.ts](packages/projects/src/projects/project.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/projects.command.ts](packages/projects/src/projects/projects.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/projects.constants.ts](packages/projects/src/projects/projects.constants.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/projects.help.ts](packages/projects/src/projects/projects.help.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/projects.module.ts](packages/projects/src/projects/projects.module.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/projects.service.ts](packages/projects/src/projects/projects.service.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/readme.ts](packages/projects/src/projects/readme.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/run-subcommand.ts](packages/projects/src/projects/run-subcommand.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/settings.ts](packages/projects/src/projects/settings.ts)|100.00|100.00|100.00|100.00
🟢|[src/shared/errors.ts](packages/projects/src/shared/errors.ts)|100.00|100.00|100.00|100.00
🟢|[src/shared/json-file.ts](packages/projects/src/shared/json-file.ts)|100.00|100.00|100.00|100.00
🟢|[src/tickets/dto/create-ticket.dto.ts](packages/projects/src/tickets/dto/create-ticket.dto.ts)|100.00|100.00|100.00|100.00
🟢|[src/tickets/ticket-criteria.ts](packages/projects/src/tickets/ticket-criteria.ts)|100.00|100.00|100.00|100.00
🟢|[src/tickets/ticket-template.ts](packages/projects/src/tickets/ticket-template.ts)|100.00|100.00|100.00|100.00
🟢|[src/tickets/ticket.ts](packages/projects/src/tickets/ticket.ts)|100.00|100.00|100.00|100.00
🟢|[src/tickets/tickets.command.ts](packages/projects/src/tickets/tickets.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/tickets/tickets.module.ts](packages/projects/src/tickets/tickets.module.ts)|100.00|100.00|100.00|100.00
🟢|[src/tickets/tickets.service.ts](packages/projects/src/tickets/tickets.service.ts)|100.00|100.00|100.00|100.00

</details>

<details>
<summary>🟢 <b>packages/runner</b> — 100.00% das linhas, 17 arquivos</summary>

Status|Arquivo|% Stmts|% Branch|% Funcs|% Lines
--|--|--|--|--|--
🟢|[src/index.ts](packages/runner/src/index.ts)|100.00|100.00|100.00|100.00
🟢|[src/nest.ts](packages/runner/src/nest.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/fill-ticket-tests.ts](packages/runner/src/tests/fill-ticket-tests.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/gate.ts](packages/runner/src/tests/gate.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/playwright-env.ts](packages/runner/src/tests/playwright-env.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/playwright-results.ts](packages/runner/src/tests/playwright-results.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/run-tests.ts](packages/runner/src/tests/run-tests.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/runner-root.ts](packages/runner/src/tests/runner-root.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/target.ts](packages/runner/src/tests/target.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/tests-error.ts](packages/runner/src/tests/tests-error.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/tests.command.ts](packages/runner/src/tests/tests.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/tests.constants.ts](packages/runner/src/tests/tests.constants.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/tests.help.ts](packages/runner/src/tests/tests.help.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/tests.module.ts](packages/runner/src/tests/tests.module.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/tests.service.ts](packages/runner/src/tests/tests.service.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/ticket-expand.ts](packages/runner/src/tests/ticket-expand.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/ticket-verdict.ts](packages/runner/src/tests/ticket-verdict.ts)|100.00|100.00|100.00|100.00

</details>

<details>
<summary>🟢 <b>packages/terminal</b> — 100.00% das linhas, 19 arquivos</summary>

Status|Arquivo|% Stmts|% Branch|% Funcs|% Lines
--|--|--|--|--|--
🟢|[src/index.ts](packages/terminal/src/index.ts)|100.00|100.00|100.00|100.00
🟢|[src/nest.ts](packages/terminal/src/nest.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/box.ts](packages/terminal/src/terminal/box.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/circular-buffer.ts](packages/terminal/src/terminal/circular-buffer.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/dto/run.dto.ts](packages/terminal/src/terminal/dto/run.dto.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/event-emitter.ts](packages/terminal/src/terminal/event-emitter.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/exit-code.ts](packages/terminal/src/terminal/exit-code.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/format-duration.ts](packages/terminal/src/terminal/format-duration.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/formatter.ts](packages/terminal/src/terminal/formatter.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/live-region.ts](packages/terminal/src/terminal/live-region.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/output.ts](packages/terminal/src/terminal/output.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/process-runner.service.ts](packages/terminal/src/terminal/process-runner.service.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/session.ts](packages/terminal/src/terminal/session.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/spawn.ts](packages/terminal/src/terminal/spawn.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/stream-lines.ts](packages/terminal/src/terminal/stream-lines.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/terminal.command.ts](packages/terminal/src/terminal/terminal.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/terminal.module.ts](packages/terminal/src/terminal/terminal.module.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/terminal.service.ts](packages/terminal/src/terminal/terminal.service.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/writable.ts](packages/terminal/src/terminal/writable.ts)|100.00|100.00|100.00|100.00

</details>
