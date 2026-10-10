# Cobertura de testes

Gerado automaticamente por `bun run test:cov` em 10/10/2026 06:49:15 — não editar manualmente.

## Resumo

Status|Pacote|% Stmts|% Branch|% Funcs|% Lines
--|--|--|--|--|--
🟢|**Total**|100.00|100.00|100.00|100.00
🟢|[packages/agents](packages/agents)|100.00|100.00|100.00|100.00
🟢|[packages/choliba](packages/choliba)|100.00|100.00|100.00|100.00
🟢|[packages/core](packages/core)|100.00|100.00|100.00|100.00
🟢|[packages/projects](packages/projects)|100.00|100.00|100.00|100.00
🟢|[packages/runner](packages/runner)|100.00|100.00|100.00|100.00

## Por pacote

<details>
<summary>🟢 <b>packages/agents</b> — 100.00% das linhas, 61 arquivos</summary>

Status|Arquivo|% Stmts|% Branch|% Funcs|% Lines
--|--|--|--|--|--
🟢|[src/agents/agent-dirs.ts](packages/agents/src/agents/agent-dirs.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/agent-loader.ts](packages/agents/src/agents/agent-loader.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/agent-print.ts](packages/agents/src/agents/agent-print.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/agent-skills.ts](packages/agents/src/agents/agent-skills.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/agent-validation.ts](packages/agents/src/agents/agent-validation.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/agents-shell.ts](packages/agents/src/agents/agents-shell.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/agents.command.ts](packages/agents/src/agents/agents.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/agents.constants.ts](packages/agents/src/agents/agents.constants.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/agents.service.ts](packages/agents/src/agents/agents.service.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/install/install-source.ts](packages/agents/src/agents/install/install-source.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/install/install.ts](packages/agents/src/agents/install/install.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/invocation-registry.ts](packages/agents/src/agents/invocation-registry.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/invocation.ts](packages/agents/src/agents/invocation.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/agent-detail.ts](packages/agents/src/agents/runs/agent-detail.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/agents-flags.ts](packages/agents/src/agents/runs/agents-flags.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/agents-spec.ts](packages/agents/src/agents/runs/agents-spec.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/delegation-guard.ts](packages/agents/src/agents/runs/delegation-guard.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/dry-run.ts](packages/agents/src/agents/runs/dry-run.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/event-render.ts](packages/agents/src/agents/runs/event-render.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/mcp-guard.ts](packages/agents/src/agents/runs/mcp-guard.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/plan-store.ts](packages/agents/src/agents/runs/plan-store.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/run-agent.ts](packages/agents/src/agents/runs/run-agent.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/run-agents.ts](packages/agents/src/agents/runs/run-agents.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/run-checks.ts](packages/agents/src/agents/runs/run-checks.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/run-context.ts](packages/agents/src/agents/runs/run-context.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/run-preparation.ts](packages/agents/src/agents/runs/run-preparation.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/spec-context.ts](packages/agents/src/agents/runs/spec-context.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/ticket-run.ts](packages/agents/src/agents/runs/ticket-run.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/tool-failure.ts](packages/agents/src/agents/runs/tool-failure.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/unenforced-tool-guard.ts](packages/agents/src/agents/runs/unenforced-tool-guard.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/steps/git-state.ts](packages/agents/src/agents/steps/git-state.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/steps/git-working-tree-diff.ts](packages/agents/src/agents/steps/git-working-tree-diff.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/steps/index-diff.ts](packages/agents/src/agents/steps/index-diff.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/steps/step-actions.ts](packages/agents/src/agents/steps/step-actions.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/steps/step-add-files.ts](packages/agents/src/agents/steps/step-add-files.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/steps/step-constants.ts](packages/agents/src/agents/steps/step-constants.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/steps/step-registry.ts](packages/agents/src/agents/steps/step-registry.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/steps/working-tree-diff.ts](packages/agents/src/agents/steps/working-tree-diff.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/agent-mcps.ts](packages/agents/src/common/agent-mcps.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/agent-permissions.ts](packages/agents/src/common/agent-permissions.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/agent-provider.ts](packages/agents/src/common/agent-provider.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/agent-vars.ts](packages/agents/src/common/agent-vars.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/cursor-tool-calls.ts](packages/agents/src/common/cursor-tool-calls.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/json.ts](packages/agents/src/common/json.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/mcp-use.ts](packages/agents/src/common/mcp-use.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/message-blocks.ts](packages/agents/src/common/message-blocks.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/prompt.ts](packages/agents/src/common/prompt.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/provider-registry.ts](packages/agents/src/common/provider-registry.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/resolve-denies.ts](packages/agents/src/common/resolve-denies.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/run-project.ts](packages/agents/src/common/run-project.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/run-tools/delete-tool.ts](packages/agents/src/common/run-tools/delete-tool.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/run-tools/playwright-tool.ts](packages/agents/src/common/run-tools/playwright-tool.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/run-tools/run-tool-path.ts](packages/agents/src/common/run-tools/run-tool-path.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/run-tools/run-tools.ts](packages/agents/src/common/run-tools/run-tools.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/stream-json.ts](packages/agents/src/common/stream-json.ts)|100.00|100.00|100.00|100.00
🟢|[src/providers/claude/claude-agent.provider.ts](packages/agents/src/providers/claude/claude-agent.provider.ts)|100.00|100.00|100.00|100.00
🟢|[src/providers/claude/claude-permissions.ts](packages/agents/src/providers/claude/claude-permissions.ts)|100.00|100.00|100.00|100.00
🟢|[src/providers/cursor/cursor-agent.provider.ts](packages/agents/src/providers/cursor/cursor-agent.provider.ts)|100.00|100.00|100.00|100.00
🟢|[src/providers/cursor/cursor-cli-json.ts](packages/agents/src/providers/cursor/cursor-cli-json.ts)|100.00|100.00|100.00|100.00
🟢|[src/providers/cursor/cursor-permissions.ts](packages/agents/src/providers/cursor/cursor-permissions.ts)|100.00|100.00|100.00|100.00
🟢|[src/providers/cursor/cursor-state.ts](packages/agents/src/providers/cursor/cursor-state.ts)|100.00|100.00|100.00|100.00

</details>

<details>
<summary>🟢 <b>packages/choliba</b> — 100.00% das linhas, 14 arquivos</summary>

Status|Arquivo|% Stmts|% Branch|% Funcs|% Lines
--|--|--|--|--|--
🟢|[src/add/add.command.ts](packages/choliba/src/add/add.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/app-shell.ts](packages/choliba/src/app-shell.ts)|100.00|100.00|100.00|100.00
🟢|[src/check/check.command.ts](packages/choliba/src/check/check.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/check/check.ts](packages/choliba/src/check/check.ts)|100.00|100.00|100.00|100.00
🟢|[src/help/root-spec.ts](packages/choliba/src/help/root-spec.ts)|100.00|100.00|100.00|100.00
🟢|[src/help/version.ts](packages/choliba/src/help/version.ts)|100.00|100.00|100.00|100.00
🟢|[src/runtime/runtime.constants.ts](packages/choliba/src/runtime/runtime.constants.ts)|100.00|100.00|100.00|100.00
🟢|[src/setup/setup.command.ts](packages/choliba/src/setup/setup.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/setup/setup.ts](packages/choliba/src/setup/setup.ts)|100.00|100.00|100.00|100.00
🟢|[src/tooling/eslint-config.ts](packages/choliba/src/tooling/eslint-config.ts)|100.00|100.00|100.00|100.00
🟢|[src/tooling/format.command.ts](packages/choliba/src/tooling/format.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/tooling/lint.command.ts](packages/choliba/src/tooling/lint.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/tooling/tooling.constants.ts](packages/choliba/src/tooling/tooling.constants.ts)|100.00|100.00|100.00|100.00
🟢|[src/tooling/tools.service.ts](packages/choliba/src/tooling/tools.service.ts)|100.00|100.00|100.00|100.00

</details>

<details>
<summary>🟢 <b>packages/core</b> — 100.00% das linhas, 50 arquivos</summary>

Status|Arquivo|% Stmts|% Branch|% Funcs|% Lines
--|--|--|--|--|--
🟢|[src/cli/message-of.ts](packages/core/src/cli/message-of.ts)|100.00|100.00|100.00|100.00
🟢|[src/config/config.service.ts](packages/core/src/config/config.service.ts)|100.00|100.00|100.00|100.00
🟢|[src/config/files.ts](packages/core/src/config/files.ts)|100.00|100.00|100.00|100.00
🟢|[src/config/layout.ts](packages/core/src/config/layout.ts)|100.00|100.00|100.00|100.00
🟢|[src/config/package-version.ts](packages/core/src/config/package-version.ts)|100.00|100.00|100.00|100.00
🟢|[src/config/repo-config.ts](packages/core/src/config/repo-config.ts)|100.00|100.00|100.00|100.00
🟢|[src/config/resources.ts](packages/core/src/config/resources.ts)|100.00|100.00|100.00|100.00
🟢|[src/config/vars.ts](packages/core/src/config/vars.ts)|100.00|100.00|100.00|100.00
🟢|[src/config/workspace.ts](packages/core/src/config/workspace.ts)|100.00|100.00|100.00|100.00
🟢|[src/help/complete.ts](packages/core/src/help/complete.ts)|100.00|100.00|100.00|100.00
🟢|[src/help/completion-bash.ts](packages/core/src/help/completion-bash.ts)|100.00|100.00|100.00|100.00
🟢|[src/help/entry-help.ts](packages/core/src/help/entry-help.ts)|100.00|100.00|100.00|100.00
🟢|[src/help/format-help.ts](packages/core/src/help/format-help.ts)|100.00|100.00|100.00|100.00
🟢|[src/help/scripts-help.ts](packages/core/src/help/scripts-help.ts)|100.00|100.00|100.00|100.00
🟢|[src/help/shell-completion.ts](packages/core/src/help/shell-completion.ts)|100.00|100.00|100.00|100.00
🟢|[src/help/wants-help.ts](packages/core/src/help/wants-help.ts)|100.00|100.00|100.00|100.00
🟢|[src/platform/git-run.ts](packages/core/src/platform/git-run.ts)|100.00|100.00|100.00|100.00
🟢|[src/platform/global-flags.ts](packages/core/src/platform/global-flags.ts)|100.00|100.00|100.00|100.00
🟢|[src/platform/platform.constants.ts](packages/core/src/platform/platform.constants.ts)|100.00|100.00|100.00|100.00
🟢|[src/platform/raw-args.ts](packages/core/src/platform/raw-args.ts)|100.00|100.00|100.00|100.00
🟢|[src/runtime/runtime.constants.ts](packages/core/src/runtime/runtime.constants.ts)|100.00|100.00|100.00|100.00
🟢|[src/shell/container.ts](packages/core/src/shell/container.ts)|100.00|100.00|100.00|100.00
🟢|[src/shell/core-shell.ts](packages/core/src/shell/core-shell.ts)|100.00|100.00|100.00|100.00
🟢|[src/shell/create-shell.ts](packages/core/src/shell/create-shell.ts)|100.00|100.00|100.00|100.00
🟢|[src/shell/root-run.ts](packages/core/src/shell/root-run.ts)|100.00|100.00|100.00|100.00
🟢|[src/shell/shell-io.ts](packages/core/src/shell/shell-io.ts)|100.00|100.00|100.00|100.00
🟢|[src/shell/shell.constants.ts](packages/core/src/shell/shell.constants.ts)|100.00|100.00|100.00|100.00
🟢|[src/shell/terminal.command.ts](packages/core/src/shell/terminal.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/box.ts](packages/core/src/terminal/box.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/circular-buffer.ts](packages/core/src/terminal/circular-buffer.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/dto/run.dto.ts](packages/core/src/terminal/dto/run.dto.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/event-emitter.ts](packages/core/src/terminal/event-emitter.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/exit-code.ts](packages/core/src/terminal/exit-code.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/format-duration.ts](packages/core/src/terminal/format-duration.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/formatter.ts](packages/core/src/terminal/formatter.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/live-region.ts](packages/core/src/terminal/live-region.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/process-runner.service.ts](packages/core/src/terminal/process-runner.service.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/session.ts](packages/core/src/terminal/session.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/spawn.ts](packages/core/src/terminal/spawn.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/stream-lines.ts](packages/core/src/terminal/stream-lines.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/terminal.service.ts](packages/core/src/terminal/terminal.service.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/writable.ts](packages/core/src/terminal/writable.ts)|100.00|100.00|100.00|100.00
🟢|[src/testing/buffer-writable.ts](packages/core/src/testing/buffer-writable.ts)|100.00|100.00|100.00|100.00
🟢|[src/testing/fake-platform.ts](packages/core/src/testing/fake-platform.ts)|100.00|100.00|100.00|100.00
🟢|[src/testing/fake-signals.ts](packages/core/src/testing/fake-signals.ts)|100.00|100.00|100.00|100.00
🟢|[src/testing/run-shell.ts](packages/core/src/testing/run-shell.ts)|100.00|100.00|100.00|100.00
🟢|[src/theme/ansi.ts](packages/core/src/theme/ansi.ts)|100.00|100.00|100.00|100.00
🟢|[src/theme/resolve-theme.ts](packages/core/src/theme/resolve-theme.ts)|100.00|100.00|100.00|100.00
🟢|[src/theme/theme-defaults.ts](packages/core/src/theme/theme-defaults.ts)|100.00|100.00|100.00|100.00
🟢|[src/theme/theme.service.ts](packages/core/src/theme/theme.service.ts)|100.00|100.00|100.00|100.00

</details>

<details>
<summary>🟢 <b>packages/projects</b> — 100.00% das linhas, 30 arquivos</summary>

Status|Arquivo|% Stmts|% Branch|% Funcs|% Lines
--|--|--|--|--|--
🟢|[src/common/errors.ts](packages/projects/src/common/errors.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/json-file.ts](packages/projects/src/common/json-file.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/placeholder.ts](packages/projects/src/common/placeholder.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/projects-cli.ts](packages/projects/src/common/projects-cli.ts)|100.00|100.00|100.00|100.00
🟢|[src/locations/locations.service.ts](packages/projects/src/locations/locations.service.ts)|100.00|100.00|100.00|100.00
🟢|[src/paths/locations.ts](packages/projects/src/paths/locations.ts)|100.00|100.00|100.00|100.00
🟢|[src/paths/project-paths.ts](packages/projects/src/paths/project-paths.ts)|100.00|100.00|100.00|100.00
🟢|[src/paths/results.ts](packages/projects/src/paths/results.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/project-app-ensure.ts](packages/projects/src/projects/project-app-ensure.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/project-app-launch.ts](packages/projects/src/projects/project-app-launch.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/project-app-prepare.ts](packages/projects/src/projects/project-app-prepare.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/project-readme.ts](packages/projects/src/projects/project-readme.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/project-settings.ts](packages/projects/src/projects/project-settings.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/project.ts](packages/projects/src/projects/project.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/projects-check.command.ts](packages/projects/src/projects/projects-check.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/projects-list.command.ts](packages/projects/src/projects/projects-list.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/projects-shell.ts](packages/projects/src/projects/projects-shell.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/projects-spec.ts](packages/projects/src/projects/projects-spec.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/projects.command.ts](packages/projects/src/projects/projects.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/projects.constants.ts](packages/projects/src/projects/projects.constants.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/projects.service.ts](packages/projects/src/projects/projects.service.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/report-folder.command.ts](packages/projects/src/projects/report-folder.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/tickets/ticket-criteria.ts](packages/projects/src/tickets/ticket-criteria.ts)|100.00|100.00|100.00|100.00
🟢|[src/tickets/ticket-specs.command.ts](packages/projects/src/tickets/ticket-specs.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/tickets/ticket-superseded.ts](packages/projects/src/tickets/ticket-superseded.ts)|100.00|100.00|100.00|100.00
🟢|[src/tickets/ticket-template.ts](packages/projects/src/tickets/ticket-template.ts)|100.00|100.00|100.00|100.00
🟢|[src/tickets/ticket.ts](packages/projects/src/tickets/ticket.ts)|100.00|100.00|100.00|100.00
🟢|[src/tickets/tickets-folder.command.ts](packages/projects/src/tickets/tickets-folder.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/tickets/tickets-spec.ts](packages/projects/src/tickets/tickets-spec.ts)|100.00|100.00|100.00|100.00
🟢|[src/tickets/tickets.service.ts](packages/projects/src/tickets/tickets.service.ts)|100.00|100.00|100.00|100.00

</details>

<details>
<summary>🟢 <b>packages/runner</b> — 100.00% das linhas, 16 arquivos</summary>

Status|Arquivo|% Stmts|% Branch|% Funcs|% Lines
--|--|--|--|--|--
🟢|[src/tests/fill-ticket-tests.ts](packages/runner/src/tests/fill-ticket-tests.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/playwright-env.ts](packages/runner/src/tests/playwright-env.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/playwright-results.ts](packages/runner/src/tests/playwright-results.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/run-tests.ts](packages/runner/src/tests/run-tests.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/runner-root.ts](packages/runner/src/tests/runner-root.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/tests-error.ts](packages/runner/src/tests/tests-error.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/tests-gate.ts](packages/runner/src/tests/tests-gate.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/tests-retired.ts](packages/runner/src/tests/tests-retired.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/tests-shell.ts](packages/runner/src/tests/tests-shell.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/tests-spec.ts](packages/runner/src/tests/tests-spec.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/tests-target.ts](packages/runner/src/tests/tests-target.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/tests.command.ts](packages/runner/src/tests/tests.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/tests.constants.ts](packages/runner/src/tests/tests.constants.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/tests.service.ts](packages/runner/src/tests/tests.service.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/ticket-expand.ts](packages/runner/src/tests/ticket-expand.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/ticket-verdict.ts](packages/runner/src/tests/ticket-verdict.ts)|100.00|100.00|100.00|100.00

</details>
