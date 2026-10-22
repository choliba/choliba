# Cobertura de testes

Gerado automaticamente por `bun run test:cov` em 22/10/2026 09:22:43 — não editar manualmente.

## Resumo

Status|Pacote|% Stmts|% Branch|% Funcs|% Lines
--|--|--|--|--|--
🟢|**Total**|100.00|100.00|100.00|100.00
🟢|[packages/agents](packages/agents)|100.00|100.00|100.00|100.00
🟢|[packages/choliba](packages/choliba)|100.00|100.00|100.00|100.00
🟢|[packages/config](packages/config)|100.00|100.00|100.00|100.00
🟢|[packages/core](packages/core)|100.00|100.00|100.00|100.00
🟢|[packages/domain](packages/domain)|100.00|100.00|100.00|100.00
🟢|[packages/engine](packages/engine)|100.00|100.00|100.00|100.00
🟢|[packages/kernel](packages/kernel)|100.00|100.00|100.00|100.00
🟢|[packages/projects](packages/projects)|100.00|100.00|100.00|100.00
🟢|[packages/runner](packages/runner)|100.00|100.00|100.00|100.00
🟢|[packages/sandbox](packages/sandbox)|100.00|100.00|100.00|100.00
🟢|[packages/shell](packages/shell)|100.00|100.00|100.00|100.00
🟢|[packages/tui](packages/tui)|100.00|100.00|100.00|100.00
🟢|[packages/workspace](packages/workspace)|100.00|100.00|100.00|100.00

## Por pacote

<details>
<summary>🟢 <b>packages/agents</b> — 100.00% das linhas, 72 arquivos</summary>

Status|Arquivo|% Stmts|% Branch|% Funcs|% Lines
--|--|--|--|--|--
🟢|[src/agents/agent-loader.ts](packages/agents/src/agents/agent-loader.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/agent-print.ts](packages/agents/src/agents/agent-print.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/agent-skills.ts](packages/agents/src/agents/agent-skills.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/agent-validation.ts](packages/agents/src/agents/agent-validation.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/agents-config.ts](packages/agents/src/agents/agents-config.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/agents-list.command.ts](packages/agents/src/agents/agents-list.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/agents-panel-card.ts](packages/agents/src/agents/agents-panel-card.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/agents-panel-run.ts](packages/agents/src/agents/agents-panel-run.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/agents-panel-state.ts](packages/agents/src/agents/agents-panel-state.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/agents-run.command.ts](packages/agents/src/agents/agents-run.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/agents-shell.ts](packages/agents/src/agents/agents-shell.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/agents.constants.ts](packages/agents/src/agents/agents.constants.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/agents.service.ts](packages/agents/src/agents/agents.service.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/defined-config.ts](packages/agents/src/agents/defined-config.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/install/install-source.ts](packages/agents/src/agents/install/install-source.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/install/install.ts](packages/agents/src/agents/install/install.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/invocation-registry.ts](packages/agents/src/agents/invocation-registry.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/invocation.ts](packages/agents/src/agents/invocation.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/agent-detail.ts](packages/agents/src/agents/runs/agent-detail.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/agents-flags.ts](packages/agents/src/agents/runs/agents-flags.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/agents-spec.ts](packages/agents/src/agents/runs/agents-spec.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/app-reach.ts](packages/agents/src/agents/runs/app-reach.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/ask-watcher.ts](packages/agents/src/agents/runs/ask-watcher.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/definition-snapshot.ts](packages/agents/src/agents/runs/definition-snapshot.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/dry-run.ts](packages/agents/src/agents/runs/dry-run.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/event-render.ts](packages/agents/src/agents/runs/event-render.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/plan-store.ts](packages/agents/src/agents/runs/plan-store.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/run-agent.ts](packages/agents/src/agents/runs/run-agent.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/run-agents.ts](packages/agents/src/agents/runs/run-agents.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/run-checks.ts](packages/agents/src/agents/runs/run-checks.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/run-choice.ts](packages/agents/src/agents/runs/run-choice.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/run-context.ts](packages/agents/src/agents/runs/run-context.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/run-log.ts](packages/agents/src/agents/runs/run-log.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/run-preparation.ts](packages/agents/src/agents/runs/run-preparation.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/run-screen.ts](packages/agents/src/agents/runs/run-screen.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/sandbox-launch.ts](packages/agents/src/agents/runs/sandbox-launch.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/session-input.ts](packages/agents/src/agents/runs/session-input.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/spec-context.ts](packages/agents/src/agents/runs/spec-context.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/ticket-run.ts](packages/agents/src/agents/runs/ticket-run.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/tool-failure.ts](packages/agents/src/agents/runs/tool-failure.ts)|100.00|100.00|100.00|100.00
🟢|[src/agents/runs/written-tool-call.ts](packages/agents/src/agents/runs/written-tool-call.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/agent-mcps.ts](packages/agents/src/common/agent-mcps.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/agent-permissions.ts](packages/agents/src/common/agent-permissions.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/agent-provider.ts](packages/agents/src/common/agent-provider.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/agent-vars.ts](packages/agents/src/common/agent-vars.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/cursor-tool-calls.ts](packages/agents/src/common/cursor-tool-calls.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/definition-denies.ts](packages/agents/src/common/definition-denies.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/json.ts](packages/agents/src/common/json.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/mcp-use.ts](packages/agents/src/common/mcp-use.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/message-blocks.ts](packages/agents/src/common/message-blocks.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/path-policy.ts](packages/agents/src/common/path-policy.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/prompt.ts](packages/agents/src/common/prompt.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/provider-registry.ts](packages/agents/src/common/provider-registry.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/run-project.ts](packages/agents/src/common/run-project.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/run-tools/ask-tool.ts](packages/agents/src/common/run-tools/ask-tool.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/run-tools/delete-tool.ts](packages/agents/src/common/run-tools/delete-tool.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/run-tools/playwright-tool.ts](packages/agents/src/common/run-tools/playwright-tool.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/run-tools/run-tool-path.ts](packages/agents/src/common/run-tools/run-tool-path.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/run-tools/run-tools.ts](packages/agents/src/common/run-tools/run-tools.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/stream-json.ts](packages/agents/src/common/stream-json.ts)|100.00|100.00|100.00|100.00
🟢|[src/providers/claude/claude-agent.provider.ts](packages/agents/src/providers/claude/claude-agent.provider.ts)|100.00|100.00|100.00|100.00
🟢|[src/providers/claude/claude-ollama-agent.provider.ts](packages/agents/src/providers/claude/claude-ollama-agent.provider.ts)|100.00|100.00|100.00|100.00
🟢|[src/providers/claude/claude-permissions.ts](packages/agents/src/providers/claude/claude-permissions.ts)|100.00|100.00|100.00|100.00
🟢|[src/providers/codex/codex-agent.provider.ts](packages/agents/src/providers/codex/codex-agent.provider.ts)|100.00|100.00|100.00|100.00
🟢|[src/providers/codex/codex-auth.ts](packages/agents/src/providers/codex/codex-auth.ts)|100.00|100.00|100.00|100.00
🟢|[src/providers/codex/codex-config.ts](packages/agents/src/providers/codex/codex-config.ts)|100.00|100.00|100.00|100.00
🟢|[src/providers/codex/codex-stream.ts](packages/agents/src/providers/codex/codex-stream.ts)|100.00|100.00|100.00|100.00
🟢|[src/providers/cursor/cursor-agent.provider.ts](packages/agents/src/providers/cursor/cursor-agent.provider.ts)|100.00|100.00|100.00|100.00
🟢|[src/providers/cursor/cursor-cli-json.ts](packages/agents/src/providers/cursor/cursor-cli-json.ts)|100.00|100.00|100.00|100.00
🟢|[src/providers/cursor/cursor-permissions.ts](packages/agents/src/providers/cursor/cursor-permissions.ts)|100.00|100.00|100.00|100.00
🟢|[src/providers/cursor/cursor-state.ts](packages/agents/src/providers/cursor/cursor-state.ts)|100.00|100.00|100.00|100.00
🟢|[src/providers/known-providers.ts](packages/agents/src/providers/known-providers.ts)|100.00|100.00|100.00|100.00

</details>

<details>
<summary>🟢 <b>packages/choliba</b> — 100.00% das linhas, 25 arquivos</summary>

Status|Arquivo|% Stmts|% Branch|% Funcs|% Lines
--|--|--|--|--|--
🟢|[src/add/add.command.ts](packages/choliba/src/add/add.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/app-shell.ts](packages/choliba/src/app-shell.ts)|100.00|100.00|100.00|100.00
🟢|[src/check/check.command.ts](packages/choliba/src/check/check.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/check/check.ts](packages/choliba/src/check/check.ts)|100.00|100.00|100.00|100.00
🟢|[src/config/config-list.command.ts](packages/choliba/src/config/config-list.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/config/config-set.command.ts](packages/choliba/src/config/config-set.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/config/config-sources.ts](packages/choliba/src/config/config-sources.ts)|100.00|100.00|100.00|100.00
🟢|[src/config/workspace.ts](packages/choliba/src/config/workspace.ts)|100.00|100.00|100.00|100.00
🟢|[src/help/owl-icon.ts](packages/choliba/src/help/owl-icon.ts)|100.00|100.00|100.00|100.00
🟢|[src/help/root-spec.ts](packages/choliba/src/help/root-spec.ts)|100.00|100.00|100.00|100.00
🟢|[src/help/version.ts](packages/choliba/src/help/version.ts)|100.00|100.00|100.00|100.00
🟢|[src/library/choliba-library.ts](packages/choliba/src/library/choliba-library.ts)|100.00|100.00|100.00|100.00
🟢|[src/library/choliba-projects.ts](packages/choliba/src/library/choliba-projects.ts)|100.00|100.00|100.00|100.00
🟢|[src/library/choliba-providers.ts](packages/choliba/src/library/choliba-providers.ts)|100.00|100.00|100.00|100.00
🟢|[src/runtime/runtime.constants.ts](packages/choliba/src/runtime/runtime.constants.ts)|100.00|100.00|100.00|100.00
🟢|[src/setup/setup.command.ts](packages/choliba/src/setup/setup.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/setup/setup.ts](packages/choliba/src/setup/setup.ts)|100.00|100.00|100.00|100.00
🟢|[src/tooling/eslint-config.ts](packages/choliba/src/tooling/eslint-config.ts)|100.00|100.00|100.00|100.00
🟢|[src/tooling/format.command.ts](packages/choliba/src/tooling/format.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/tooling/lint.command.ts](packages/choliba/src/tooling/lint.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/tooling/tooling.constants.ts](packages/choliba/src/tooling/tooling.constants.ts)|100.00|100.00|100.00|100.00
🟢|[src/tooling/tools.service.ts](packages/choliba/src/tooling/tools.service.ts)|100.00|100.00|100.00|100.00
🟢|[src/update/release-notes.ts](packages/choliba/src/update/release-notes.ts)|100.00|100.00|100.00|100.00
🟢|[src/update/update.command.ts](packages/choliba/src/update/update.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/update/update.ts](packages/choliba/src/update/update.ts)|100.00|100.00|100.00|100.00

</details>

<details>
<summary>🟢 <b>packages/config</b> — 100.00% das linhas, 14 arquivos</summary>

Status|Arquivo|% Stmts|% Branch|% Funcs|% Lines
--|--|--|--|--|--
🟢|[src/common/config-error.ts](packages/config/src/common/config-error.ts)|100.00|100.00|100.00|100.00
🟢|[src/formats/config-tree.ts](packages/config/src/formats/config-tree.ts)|100.00|100.00|100.00|100.00
🟢|[src/formats/dotenv-format.ts](packages/config/src/formats/dotenv-format.ts)|100.00|100.00|100.00|100.00
🟢|[src/formats/format-for.ts](packages/config/src/formats/format-for.ts)|100.00|100.00|100.00|100.00
🟢|[src/formats/json-format.ts](packages/config/src/formats/json-format.ts)|100.00|100.00|100.00|100.00
🟢|[src/formats/yaml-format.ts](packages/config/src/formats/yaml-format.ts)|100.00|100.00|100.00|100.00
🟢|[src/groups/config-catalog.ts](packages/config/src/groups/config-catalog.ts)|100.00|100.00|100.00|100.00
🟢|[src/groups/config-settings.ts](packages/config/src/groups/config-settings.ts)|100.00|100.00|100.00|100.00
🟢|[src/groups/config-write.ts](packages/config/src/groups/config-write.ts)|100.00|100.00|100.00|100.00
🟢|[src/groups/define-config.ts](packages/config/src/groups/define-config.ts)|100.00|100.00|100.00|100.00
🟢|[src/groups/key-conversion.ts](packages/config/src/groups/key-conversion.ts)|100.00|100.00|100.00|100.00
🟢|[src/groups/key-reading.ts](packages/config/src/groups/key-reading.ts)|100.00|100.00|100.00|100.00
🟢|[src/sources/env-source.ts](packages/config/src/sources/env-source.ts)|100.00|100.00|100.00|100.00
🟢|[src/sources/file-source.ts](packages/config/src/sources/file-source.ts)|100.00|100.00|100.00|100.00

</details>

<details>
<summary>🟢 <b>packages/core</b> — 100.00% das linhas, 1 arquivo</summary>

Status|Arquivo|% Stmts|% Branch|% Funcs|% Lines
--|--|--|--|--|--
🟢|[src/shell/core-shell.ts](packages/core/src/shell/core-shell.ts)|100.00|100.00|100.00|100.00

</details>

<details>
<summary>🟢 <b>packages/domain</b> — 100.00% das linhas, 10 arquivos</summary>

Status|Arquivo|% Stmts|% Branch|% Funcs|% Lines
--|--|--|--|--|--
🟢|[src/agent/agent-loader.ts](packages/domain/src/agent/agent-loader.ts)|100.00|100.00|100.00|100.00
🟢|[src/agent/agent-mcps.ts](packages/domain/src/agent/agent-mcps.ts)|100.00|100.00|100.00|100.00
🟢|[src/agent/agent-validation.ts](packages/domain/src/agent/agent-validation.ts)|100.00|100.00|100.00|100.00
🟢|[src/agent/agent-vars.ts](packages/domain/src/agent/agent-vars.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/execution.ts](packages/domain/src/common/execution.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/values.ts](packages/domain/src/common/values.ts)|100.00|100.00|100.00|100.00
🟢|[src/permissions/agent-permissions.ts](packages/domain/src/permissions/agent-permissions.ts)|100.00|100.00|100.00|100.00
🟢|[src/permissions/definition-denies.ts](packages/domain/src/permissions/definition-denies.ts)|100.00|100.00|100.00|100.00
🟢|[src/permissions/path-policy.ts](packages/domain/src/permissions/path-policy.ts)|100.00|100.00|100.00|100.00
🟢|[src/permissions/permission-paths.ts](packages/domain/src/permissions/permission-paths.ts)|100.00|100.00|100.00|100.00

</details>

<details>
<summary>🟢 <b>packages/engine</b> — 100.00% das linhas, 30 arquivos</summary>

Status|Arquivo|% Stmts|% Branch|% Funcs|% Lines
--|--|--|--|--|--
🟢|[src/common/run-tool-path.ts](packages/engine/src/common/run-tool-path.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/run-tools.ts](packages/engine/src/common/run-tools.ts)|100.00|100.00|100.00|100.00
🟢|[src/guards/command-guard.ts](packages/engine/src/guards/command-guard.ts)|100.00|100.00|100.00|100.00
🟢|[src/guards/delegation-guard.ts](packages/engine/src/guards/delegation-guard.ts)|100.00|100.00|100.00|100.00
🟢|[src/guards/mcp-guard.ts](packages/engine/src/guards/mcp-guard.ts)|100.00|100.00|100.00|100.00
🟢|[src/guards/tool-guard.ts](packages/engine/src/guards/tool-guard.ts)|100.00|100.00|100.00|100.00
🟢|[src/guards/tool-policy.ts](packages/engine/src/guards/tool-policy.ts)|100.00|100.00|100.00|100.00
🟢|[src/guards/tool-request.ts](packages/engine/src/guards/tool-request.ts)|100.00|100.00|100.00|100.00
🟢|[src/guards/unenforced-tool-guard.ts](packages/engine/src/guards/unenforced-tool-guard.ts)|100.00|100.00|100.00|100.00
🟢|[src/ports/agent-provider.ts](packages/engine/src/ports/agent-provider.ts)|100.00|100.00|100.00|100.00
🟢|[src/ports/run-place.ts](packages/engine/src/ports/run-place.ts)|100.00|100.00|100.00|100.00
🟢|[src/prompt/message-blocks.ts](packages/engine/src/prompt/message-blocks.ts)|100.00|100.00|100.00|100.00
🟢|[src/prompt/project.ts](packages/engine/src/prompt/project.ts)|100.00|100.00|100.00|100.00
🟢|[src/prompt/prompt.ts](packages/engine/src/prompt/prompt.ts)|100.00|100.00|100.00|100.00
🟢|[src/steps/git-state.ts](packages/engine/src/steps/git-state.ts)|100.00|100.00|100.00|100.00
🟢|[src/steps/git-working-tree-diff.ts](packages/engine/src/steps/git-working-tree-diff.ts)|100.00|100.00|100.00|100.00
🟢|[src/steps/index-diff.ts](packages/engine/src/steps/index-diff.ts)|100.00|100.00|100.00|100.00
🟢|[src/steps/step-actions.ts](packages/engine/src/steps/step-actions.ts)|100.00|100.00|100.00|100.00
🟢|[src/steps/step-constants.ts](packages/engine/src/steps/step-constants.ts)|100.00|100.00|100.00|100.00
🟢|[src/steps/step-fields.ts](packages/engine/src/steps/step-fields.ts)|100.00|100.00|100.00|100.00
🟢|[src/steps/step-listing.ts](packages/engine/src/steps/step-listing.ts)|100.00|100.00|100.00|100.00
🟢|[src/steps/step-read-files.ts](packages/engine/src/steps/step-read-files.ts)|100.00|100.00|100.00|100.00
🟢|[src/steps/step-registry.ts](packages/engine/src/steps/step-registry.ts)|100.00|100.00|100.00|100.00
🟢|[src/steps/step-search-files.ts](packages/engine/src/steps/step-search-files.ts)|100.00|100.00|100.00|100.00
🟢|[src/steps/step-search.ts](packages/engine/src/steps/step-search.ts)|100.00|100.00|100.00|100.00
🟢|[src/steps/step-size.ts](packages/engine/src/steps/step-size.ts)|100.00|100.00|100.00|100.00
🟢|[src/steps/step-spawn.ts](packages/engine/src/steps/step-spawn.ts)|100.00|100.00|100.00|100.00
🟢|[src/steps/step-write-config.ts](packages/engine/src/steps/step-write-config.ts)|100.00|100.00|100.00|100.00
🟢|[src/steps/step-write-files.ts](packages/engine/src/steps/step-write-files.ts)|100.00|100.00|100.00|100.00
🟢|[src/steps/working-tree-diff.ts](packages/engine/src/steps/working-tree-diff.ts)|100.00|100.00|100.00|100.00

</details>

<details>
<summary>🟢 <b>packages/kernel</b> — 100.00% das linhas, 14 arquivos</summary>

Status|Arquivo|% Stmts|% Branch|% Funcs|% Lines
--|--|--|--|--|--
🟢|[src/common/expected-error.ts](packages/kernel/src/common/expected-error.ts)|100.00|100.00|100.00|100.00
🟢|[src/config/package-version.ts](packages/kernel/src/config/package-version.ts)|100.00|100.00|100.00|100.00
🟢|[src/config/resources.ts](packages/kernel/src/config/resources.ts)|100.00|100.00|100.00|100.00
🟢|[src/container/container.ts](packages/kernel/src/container/container.ts)|100.00|100.00|100.00|100.00
🟢|[src/paths/path-pattern.ts](packages/kernel/src/paths/path-pattern.ts)|100.00|100.00|100.00|100.00
🟢|[src/platform/command-on-path.ts](packages/kernel/src/platform/command-on-path.ts)|100.00|100.00|100.00|100.00
🟢|[src/platform/git-run.ts](packages/kernel/src/platform/git-run.ts)|100.00|100.00|100.00|100.00
🟢|[src/platform/global-flags.ts](packages/kernel/src/platform/global-flags.ts)|100.00|100.00|100.00|100.00
🟢|[src/platform/platform.constants.ts](packages/kernel/src/platform/platform.constants.ts)|100.00|100.00|100.00|100.00
🟢|[src/platform/raw-args.ts](packages/kernel/src/platform/raw-args.ts)|100.00|100.00|100.00|100.00
🟢|[src/runtime/runtime.constants.ts](packages/kernel/src/runtime/runtime.constants.ts)|100.00|100.00|100.00|100.00
🟢|[src/testing/buffer-writable.ts](packages/kernel/src/testing/buffer-writable.ts)|100.00|100.00|100.00|100.00
🟢|[src/testing/fake-platform.ts](packages/kernel/src/testing/fake-platform.ts)|100.00|100.00|100.00|100.00
🟢|[src/testing/fake-signals.ts](packages/kernel/src/testing/fake-signals.ts)|100.00|100.00|100.00|100.00

</details>

<details>
<summary>🟢 <b>packages/projects</b> — 100.00% das linhas, 31 arquivos</summary>

Status|Arquivo|% Stmts|% Branch|% Funcs|% Lines
--|--|--|--|--|--
🟢|[src/common/errors.ts](packages/projects/src/common/errors.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/json-file.ts](packages/projects/src/common/json-file.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/placeholder.ts](packages/projects/src/common/placeholder.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/projects-cli.ts](packages/projects/src/common/projects-cli.ts)|100.00|100.00|100.00|100.00
🟢|[src/locations/locations.service.ts](packages/projects/src/locations/locations.service.ts)|100.00|100.00|100.00|100.00
🟢|[src/paths/project-paths.ts](packages/projects/src/paths/project-paths.ts)|100.00|100.00|100.00|100.00
🟢|[src/paths/results.ts](packages/projects/src/paths/results.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/new-project.ts](packages/projects/src/projects/new-project.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/project-app-ensure.ts](packages/projects/src/projects/project-app-ensure.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/project-app-launch.ts](packages/projects/src/projects/project-app-launch.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/project-app-log.ts](packages/projects/src/projects/project-app-log.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/project-app-prepare.ts](packages/projects/src/projects/project-app-prepare.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/project-app-share.ts](packages/projects/src/projects/project-app-share.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/project-devices.ts](packages/projects/src/projects/project-devices.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/project-readme.ts](packages/projects/src/projects/project-readme.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/project-settings.ts](packages/projects/src/projects/project-settings.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/project-stack.ts](packages/projects/src/projects/project-stack.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/project.ts](packages/projects/src/projects/project.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/projects-list.command.ts](packages/projects/src/projects/projects-list.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/projects-new.command.ts](packages/projects/src/projects/projects-new.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/projects-shell.ts](packages/projects/src/projects/projects-shell.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/projects-spec.ts](packages/projects/src/projects/projects-spec.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/projects.constants.ts](packages/projects/src/projects/projects.constants.ts)|100.00|100.00|100.00|100.00
🟢|[src/projects/projects.service.ts](packages/projects/src/projects/projects.service.ts)|100.00|100.00|100.00|100.00
🟢|[src/tickets/ticket-criteria.ts](packages/projects/src/tickets/ticket-criteria.ts)|100.00|100.00|100.00|100.00
🟢|[src/tickets/ticket-info.ts](packages/projects/src/tickets/ticket-info.ts)|100.00|100.00|100.00|100.00
🟢|[src/tickets/ticket-shape.ts](packages/projects/src/tickets/ticket-shape.ts)|100.00|100.00|100.00|100.00
🟢|[src/tickets/ticket-superseded.ts](packages/projects/src/tickets/ticket-superseded.ts)|100.00|100.00|100.00|100.00
🟢|[src/tickets/ticket-template.ts](packages/projects/src/tickets/ticket-template.ts)|100.00|100.00|100.00|100.00
🟢|[src/tickets/ticket.ts](packages/projects/src/tickets/ticket.ts)|100.00|100.00|100.00|100.00
🟢|[src/tickets/tickets-spec.ts](packages/projects/src/tickets/tickets-spec.ts)|100.00|100.00|100.00|100.00

</details>

<details>
<summary>🟢 <b>packages/runner</b> — 100.00% das linhas, 17 arquivos</summary>

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
🟢|[src/tests/ticket-results.ts](packages/runner/src/tests/ticket-results.ts)|100.00|100.00|100.00|100.00
🟢|[src/tests/ticket-verdict.ts](packages/runner/src/tests/ticket-verdict.ts)|100.00|100.00|100.00|100.00

</details>

<details>
<summary>🟢 <b>packages/sandbox</b> — 100.00% das linhas, 14 arquivos</summary>

Status|Arquivo|% Stmts|% Branch|% Funcs|% Lines
--|--|--|--|--|--
🟢|[src/common/decide.ts](packages/sandbox/src/common/decide.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/paths.ts](packages/sandbox/src/common/paths.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/resolve-denies.ts](packages/sandbox/src/common/resolve-denies.ts)|100.00|100.00|100.00|100.00
🟢|[src/common/rule-effect.ts](packages/sandbox/src/common/rule-effect.ts)|100.00|100.00|100.00|100.00
🟢|[src/sandbox/docker/docker-host.ts](packages/sandbox/src/sandbox/docker/docker-host.ts)|100.00|100.00|100.00|100.00
🟢|[src/sandbox/docker/docker-run.ts](packages/sandbox/src/sandbox/docker/docker-run.ts)|100.00|100.00|100.00|100.00
🟢|[src/sandbox/docker/docker-sandbox.ts](packages/sandbox/src/sandbox/docker/docker-sandbox.ts)|100.00|100.00|100.00|100.00
🟢|[src/sandbox/local/bwrap-command.ts](packages/sandbox/src/sandbox/local/bwrap-command.ts)|100.00|100.00|100.00|100.00
🟢|[src/sandbox/local/bwrap-on-path.ts](packages/sandbox/src/sandbox/local/bwrap-on-path.ts)|100.00|100.00|100.00|100.00
🟢|[src/sandbox/local/local-sandbox.ts](packages/sandbox/src/sandbox/local/local-sandbox.ts)|100.00|100.00|100.00|100.00
🟢|[src/sandbox/local/resolver-folder.ts](packages/sandbox/src/sandbox/local/resolver-folder.ts)|100.00|100.00|100.00|100.00
🟢|[src/sandbox/mounts/container-mounts.ts](packages/sandbox/src/sandbox/mounts/container-mounts.ts)|100.00|100.00|100.00|100.00
🟢|[src/sandbox/sandbox-config.ts](packages/sandbox/src/sandbox/sandbox-config.ts)|100.00|100.00|100.00|100.00
🟢|[src/sandbox/sandbox.ts](packages/sandbox/src/sandbox/sandbox.ts)|100.00|100.00|100.00|100.00

</details>

<details>
<summary>🟢 <b>packages/shell</b> — 100.00% das linhas, 46 arquivos</summary>

Status|Arquivo|% Stmts|% Branch|% Funcs|% Lines
--|--|--|--|--|--
🟢|[src/cli/message-of.ts](packages/shell/src/cli/message-of.ts)|100.00|100.00|100.00|100.00
🟢|[src/help/command-page.ts](packages/shell/src/help/command-page.ts)|100.00|100.00|100.00|100.00
🟢|[src/help/complete.ts](packages/shell/src/help/complete.ts)|100.00|100.00|100.00|100.00
🟢|[src/help/completion-bash.ts](packages/shell/src/help/completion-bash.ts)|100.00|100.00|100.00|100.00
🟢|[src/help/entry-help.ts](packages/shell/src/help/entry-help.ts)|100.00|100.00|100.00|100.00
🟢|[src/help/format-help.ts](packages/shell/src/help/format-help.ts)|100.00|100.00|100.00|100.00
🟢|[src/help/scripts-help.ts](packages/shell/src/help/scripts-help.ts)|100.00|100.00|100.00|100.00
🟢|[src/help/shell-completion.ts](packages/shell/src/help/shell-completion.ts)|100.00|100.00|100.00|100.00
🟢|[src/help/suggest.ts](packages/shell/src/help/suggest.ts)|100.00|100.00|100.00|100.00
🟢|[src/help/wants-help.ts](packages/shell/src/help/wants-help.ts)|100.00|100.00|100.00|100.00
🟢|[src/panel/card.ts](packages/shell/src/panel/card.ts)|100.00|100.00|100.00|100.00
🟢|[src/shell/base-shell.ts](packages/shell/src/shell/base-shell.ts)|100.00|100.00|100.00|100.00
🟢|[src/shell/create-shell.ts](packages/shell/src/shell/create-shell.ts)|100.00|100.00|100.00|100.00
🟢|[src/shell/root-run.ts](packages/shell/src/shell/root-run.ts)|100.00|100.00|100.00|100.00
🟢|[src/shell/shell-io.ts](packages/shell/src/shell/shell-io.ts)|100.00|100.00|100.00|100.00
🟢|[src/shell/shell.constants.ts](packages/shell/src/shell/shell.constants.ts)|100.00|100.00|100.00|100.00
🟢|[src/shell/terminal.command.ts](packages/shell/src/shell/terminal.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/box.ts](packages/shell/src/terminal/box.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/circular-buffer.ts](packages/shell/src/terminal/circular-buffer.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/dto/run.dto.ts](packages/shell/src/terminal/dto/run.dto.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/event-emitter.ts](packages/shell/src/terminal/event-emitter.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/exit-code.ts](packages/shell/src/terminal/exit-code.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/format-duration.ts](packages/shell/src/terminal/format-duration.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/formatter.ts](packages/shell/src/terminal/formatter.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/frame/ansi-chunks.ts](packages/shell/src/terminal/frame/ansi-chunks.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/frame/ansi-text.ts](packages/shell/src/terminal/frame/ansi-text.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/frame/frame.ts](packages/shell/src/terminal/frame/frame.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/live-region.ts](packages/shell/src/terminal/live-region.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/log-file.ts](packages/shell/src/terminal/log-file.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/process-runner.service.ts](packages/shell/src/terminal/process-runner.service.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/run-footer.ts](packages/shell/src/terminal/run-footer.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/run-line-screen.ts](packages/shell/src/terminal/run-line-screen.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/session.ts](packages/shell/src/terminal/session.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/spawn.ts](packages/shell/src/terminal/spawn.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/status-footer.ts](packages/shell/src/terminal/status-footer.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/stream-lines.ts](packages/shell/src/terminal/stream-lines.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/table/table-cell.ts](packages/shell/src/terminal/table/table-cell.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/table/table-layout.ts](packages/shell/src/terminal/table/table-layout.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/table/table.ts](packages/shell/src/terminal/table/table.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/terminal.service.ts](packages/shell/src/terminal/terminal.service.ts)|100.00|100.00|100.00|100.00
🟢|[src/terminal/writable.ts](packages/shell/src/terminal/writable.ts)|100.00|100.00|100.00|100.00
🟢|[src/testing/run-shell.ts](packages/shell/src/testing/run-shell.ts)|100.00|100.00|100.00|100.00
🟢|[src/theme/ansi.ts](packages/shell/src/theme/ansi.ts)|100.00|100.00|100.00|100.00
🟢|[src/theme/resolve-theme.ts](packages/shell/src/theme/resolve-theme.ts)|100.00|100.00|100.00|100.00
🟢|[src/theme/theme-defaults.ts](packages/shell/src/theme/theme-defaults.ts)|100.00|100.00|100.00|100.00
🟢|[src/theme/theme.service.ts](packages/shell/src/theme/theme.service.ts)|100.00|100.00|100.00|100.00

</details>

<details>
<summary>🟢 <b>packages/tui</b> — 100.00% das linhas, 21 arquivos</summary>

Status|Arquivo|% Stmts|% Branch|% Funcs|% Lines
--|--|--|--|--|--
🟢|[src/panel/panel-art.ts](packages/tui/src/panel/panel-art.ts)|100.00|100.00|100.00|100.00
🟢|[src/panel/panel-choose.ts](packages/tui/src/panel/panel-choose.ts)|100.00|100.00|100.00|100.00
🟢|[src/panel/panel-history.ts](packages/tui/src/panel/panel-history.ts)|100.00|100.00|100.00|100.00
🟢|[src/panel/panel-keys.ts](packages/tui/src/panel/panel-keys.ts)|100.00|100.00|100.00|100.00
🟢|[src/panel/panel-palette.ts](packages/tui/src/panel/panel-palette.ts)|100.00|100.00|100.00|100.00
🟢|[src/panel/panel-question.ts](packages/tui/src/panel/panel-question.ts)|100.00|100.00|100.00|100.00
🟢|[src/panel/panel-text.ts](packages/tui/src/panel/panel-text.ts)|100.00|100.00|100.00|100.00
🟢|[src/panel/panel-toolkit.ts](packages/tui/src/panel/panel-toolkit.ts)|100.00|100.00|100.00|100.00
🟢|[src/panel/panel-welcome.ts](packages/tui/src/panel/panel-welcome.ts)|100.00|100.00|100.00|100.00
🟢|[src/panel/panel.ts](packages/tui/src/panel/panel.ts)|100.00|100.00|100.00|100.00
🟢|[src/panel/run-screen.ts](packages/tui/src/panel/run-screen.ts)|100.00|100.00|100.00|100.00
🟢|[src/session/agents-panel-choices.ts](packages/tui/src/session/agents-panel-choices.ts)|100.00|100.00|100.00|100.00
🟢|[src/session/agents-panel-watch.ts](packages/tui/src/session/agents-panel-watch.ts)|100.00|100.00|100.00|100.00
🟢|[src/session/agents-panel.ts](packages/tui/src/session/agents-panel.ts)|100.00|100.00|100.00|100.00
🟢|[src/session/panel-log.ts](packages/tui/src/session/panel-log.ts)|100.00|100.00|100.00|100.00
🟢|[src/session/panel-session.ts](packages/tui/src/session/panel-session.ts)|100.00|100.00|100.00|100.00
🟢|[src/session/panel.command.ts](packages/tui/src/session/panel.command.ts)|100.00|100.00|100.00|100.00
🟢|[src/session/projects-panel.ts](packages/tui/src/session/projects-panel.ts)|100.00|100.00|100.00|100.00
🟢|[src/session/tui-shell.ts](packages/tui/src/session/tui-shell.ts)|100.00|100.00|100.00|100.00
🟢|[src/testing/fake-chat-panel.ts](packages/tui/src/testing/fake-chat-panel.ts)|100.00|100.00|100.00|100.00
🟢|[src/testing/fake-panel-context.ts](packages/tui/src/testing/fake-panel-context.ts)|100.00|100.00|100.00|100.00

</details>

<details>
<summary>🟢 <b>packages/workspace</b> — 100.00% das linhas, 6 arquivos</summary>

Status|Arquivo|% Stmts|% Branch|% Funcs|% Lines
--|--|--|--|--|--
🟢|[src/layout/agent-layout.ts](packages/workspace/src/layout/agent-layout.ts)|100.00|100.00|100.00|100.00
🟢|[src/layout/project-layout.ts](packages/workspace/src/layout/project-layout.ts)|100.00|100.00|100.00|100.00
🟢|[src/layout/workspace-layout.ts](packages/workspace/src/layout/workspace-layout.ts)|100.00|100.00|100.00|100.00
🟢|[src/locations/agent-dirs.ts](packages/workspace/src/locations/agent-dirs.ts)|100.00|100.00|100.00|100.00
🟢|[src/locations/project-locations.ts](packages/workspace/src/locations/project-locations.ts)|100.00|100.00|100.00|100.00
🟢|[src/locations/projects-config.ts](packages/workspace/src/locations/projects-config.ts)|100.00|100.00|100.00|100.00

</details>
