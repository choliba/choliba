# Cobertura de testes

Gerado automaticamente por `bun run test:cov` em 23/11/2026 02:22:11: não edite à mão.

Limites (coverage-thresholds.json, só sobem): funções 92.49%, linhas 94.78%. O Bun mede funções e linhas; o total é a média por arquivo, como o "All files" dele.

## Resumo

Status|Módulo|% Funcs|% Lines
--|--|--|--
🟢|**Total**|92.49|94.79
🟢|[scripts](scripts)|100.00|98.61
🟢|[src/adapters](src/adapters)|90.84|97.80
🟢|[src/agent](src/agent)|96.70|95.59
🟢|[src/approval](src/approval)|84.96|87.88
🟢|[src/cli](src/cli)|100.00|100.00
🟢|[src/command](src/command)|94.44|99.64
🟢|[src/config](src/config)|99.24|97.61
🟢|[src/context](src/context)|100.00|100.00
🟢|[src](src)|93.33|93.33
🟢|[src/events](src/events)|100.00|100.00
🟢|[src/execute](src/execute)|91.23|90.38
🟢|[src/filesystem](src/filesystem)|97.83|94.05
🔴|[src/input](src/input)|0.00|6.93
🟢|[src/interaction](src/interaction)|97.22|99.47
🟢|[src/logger](src/logger)|95.71|96.50
🟢|[src/mcp](src/mcp)|76.61|93.74
🟢|[src/network](src/network)|94.03|97.39
🟡|[src/output](src/output)|52.94|54.87
🟢|[src/policy](src/policy)|99.55|99.28
🟢|[src/providers](src/providers)|94.67|98.98
🟢|[src/rounds](src/rounds)|93.94|96.71
🟢|[src/store](src/store)|95.71|94.09
🟢|[src/workspace](src/workspace)|97.06|96.61

## Por módulo

<details open>
<summary>🟢 <b>scripts</b>: 98.61% das linhas, 4 arquivos</summary>

Status|Arquivo|% Funcs|% Lines
--|--|--|--
🟢|[branches.ts](scripts/branches.ts)|100.00|94.44
🟢|[coverage-report.ts](scripts/coverage-report.ts)|100.00|100.00
🟢|[docs.ts](scripts/docs.ts)|100.00|100.00
🟢|[release.ts](scripts/release.ts)|100.00|100.00

</details>

<details open>
<summary>🟢 <b>src/adapters</b>: 97.80% das linhas, 9 arquivos</summary>

Status|Arquivo|% Funcs|% Lines
--|--|--|--
🟢|[constants.ts](src/adapters/constants.ts)|100.00|100.00
🟢|[jsonl/index.ts](src/adapters/jsonl/index.ts)|93.33|99.07
🟢|[stdio/index.ts](src/adapters/stdio/index.ts)|78.57|96.84
🟢|[stdio/keys.ts](src/adapters/stdio/keys.ts)|100.00|100.00
🟢|[stdio/line.ts](src/adapters/stdio/line.ts)|83.33|100.00
🟢|[stdio/records.ts](src/adapters/stdio/records.ts)|100.00|100.00
🟢|[stdio/typing.ts](src/adapters/stdio/typing.ts)|92.31|95.61
🟢|[tui/index.ts](src/adapters/tui/index.ts)|70.00|88.63
🟢|[tui/layout.ts](src/adapters/tui/layout.ts)|100.00|100.00

</details>

<details open>
<summary>🟢 <b>src/agent</b>: 95.59% das linhas, 11 arquivos</summary>

Status|Arquivo|% Funcs|% Lines
--|--|--|--
🟢|[abort.ts](src/agent/abort.ts)|100.00|97.44
🟢|[agent.ts](src/agent/agent.ts)|88.00|92.40
🟢|[constants.ts](src/agent/constants.ts)|100.00|100.00
🟡|[enforce.ts](src/agent/enforce.ts)|82.35|74.29
🟢|[events.ts](src/agent/events.ts)|100.00|100.00
🟢|[input.ts](src/agent/input.ts)|93.33|98.78
🟢|[lock.ts](src/agent/lock.ts)|100.00|100.00
🟢|[messages.ts](src/agent/messages.ts)|100.00|88.64
🟢|[output.ts](src/agent/output.ts)|100.00|100.00
🟢|[run-provider.ts](src/agent/run-provider.ts)|100.00|100.00
🟢|[thinking.ts](src/agent/thinking.ts)|100.00|100.00

</details>

<details open>
<summary>🟢 <b>src/approval</b>: 87.88% das linhas, 6 arquivos</summary>

Status|Arquivo|% Funcs|% Lines
--|--|--|--
🟢|[broker.ts](src/approval/broker.ts)|96.43|100.00
🟢|[constants.ts](src/approval/constants.ts)|100.00|100.00
🟢|[gate.ts](src/approval/gate.ts)|91.67|100.00
🔴|[human.ts](src/approval/human.ts)|25.00|27.27
🟢|[review.ts](src/approval/review.ts)|96.67|100.00
🟢|[selection.ts](src/approval/selection.ts)|100.00|100.00

</details>

<details>
<summary>🟢 <b>src/cli</b>: 100.00% das linhas, 1 arquivo</summary>

Status|Arquivo|% Funcs|% Lines
--|--|--|--
🟢|[clear.ts](src/cli/clear.ts)|100.00|100.00

</details>

<details open>
<summary>🟢 <b>src/command</b>: 99.64% das linhas, 3 arquivos</summary>

Status|Arquivo|% Funcs|% Lines
--|--|--|--
🟢|[help.ts](src/command/help.ts)|100.00|100.00
🟢|[index.ts](src/command/index.ts)|83.33|100.00
🟢|[parse.ts](src/command/parse.ts)|100.00|98.91

</details>

<details open>
<summary>🟢 <b>src/config</b>: 97.61% das linhas, 3 arquivos</summary>

Status|Arquivo|% Funcs|% Lines
--|--|--|--
🟢|[constants.ts](src/config/constants.ts)|100.00|100.00
🟢|[env.ts](src/config/env.ts)|100.00|100.00
🟢|[index.ts](src/config/index.ts)|97.73|92.84

</details>

<details>
<summary>🟢 <b>src/context</b>: 100.00% das linhas, 1 arquivo</summary>

Status|Arquivo|% Funcs|% Lines
--|--|--|--
🟢|[index.ts](src/context/index.ts)|100.00|100.00

</details>

<details open>
<summary>🟢 <b>src</b>: 93.33% das linhas, 3 arquivos</summary>

Status|Arquivo|% Funcs|% Lines
--|--|--|--
🟢|[errors.ts](src/errors.ts)|100.00|100.00
🟢|[index.ts](src/index.ts)|100.00|100.00
🟢|[usage.ts](src/usage.ts)|80.00|80.00

</details>

<details>
<summary>🟢 <b>src/events</b>: 100.00% das linhas, 1 arquivo</summary>

Status|Arquivo|% Funcs|% Lines
--|--|--|--
🟢|[index.ts](src/events/index.ts)|100.00|100.00

</details>

<details open>
<summary>🟢 <b>src/execute</b>: 90.38% das linhas, 5 arquivos</summary>

Status|Arquivo|% Funcs|% Lines
--|--|--|--
🟢|[constants.ts](src/execute/constants.ts)|100.00|100.00
🟢|[index.ts](src/execute/index.ts)|95.65|100.00
🟢|[interrupt.ts](src/execute/interrupt.ts)|100.00|93.75
🟡|[process.ts](src/execute/process.ts)|65.52|58.17
🟢|[stream.ts](src/execute/stream.ts)|95.00|100.00

</details>

<details open>
<summary>🟢 <b>src/filesystem</b>: 94.05% das linhas, 2 arquivos</summary>

Status|Arquivo|% Funcs|% Lines
--|--|--|--
🟢|[index.ts](src/filesystem/index.ts)|95.65|97.40
🟢|[proc.ts](src/filesystem/proc.ts)|100.00|90.70

</details>

<details open>
<summary>🔴 <b>src/input</b>: 6.93% das linhas, 1 arquivo</summary>

Status|Arquivo|% Funcs|% Lines
--|--|--|--
🔴|[index.ts](src/input/index.ts)|0.00|6.93

</details>

<details open>
<summary>🟢 <b>src/interaction</b>: 99.47% das linhas, 3 arquivos</summary>

Status|Arquivo|% Funcs|% Lines
--|--|--|--
🟢|[constants.ts](src/interaction/constants.ts)|100.00|100.00
🟢|[conversation.ts](src/interaction/conversation.ts)|91.67|98.40
🟢|[index.ts](src/interaction/index.ts)|100.00|100.00

</details>

<details open>
<summary>🟢 <b>src/logger</b>: 96.50% das linhas, 8 arquivos</summary>

Status|Arquivo|% Funcs|% Lines
--|--|--|--
🟢|[adapt.ts](src/logger/adapt.ts)|80.00|100.00
🟢|[constants.ts](src/logger/constants.ts)|100.00|100.00
🟢|[index.ts](src/logger/index.ts)|100.00|91.61
🟢|[jsonl.ts](src/logger/jsonl.ts)|100.00|91.89
🟢|[mask.ts](src/logger/mask.ts)|100.00|100.00
🟢|[record.ts](src/logger/record.ts)|85.71|88.52
🟢|[rotate.ts](src/logger/rotate.ts)|100.00|100.00
🟢|[size.ts](src/logger/size.ts)|100.00|100.00

</details>

<details open>
<summary>🟢 <b>src/mcp</b>: 93.74% das linhas, 4 arquivos</summary>

Status|Arquivo|% Funcs|% Lines
--|--|--|--
🟢|[broker.ts](src/mcp/broker.ts)|93.94|100.00
🟢|[constants.ts](src/mcp/constants.ts)|100.00|100.00
🟡|[index.ts](src/mcp/index.ts)|62.50|77.46
🟢|[schema.ts](src/mcp/schema.ts)|50.00|97.50

</details>

<details open>
<summary>🟢 <b>src/network</b>: 97.39% das linhas, 8 arquivos</summary>

Status|Arquivo|% Funcs|% Lines
--|--|--|--
🟢|[constants.ts](src/network/constants.ts)|100.00|100.00
🟢|[gate.ts](src/network/gate.ts)|90.48|100.00
🟢|[index.ts](src/network/index.ts)|89.66|96.15
🟢|[proxy.ts](src/network/proxy.ts)|72.09|88.40
🟢|[publish.ts](src/network/publish.ts)|100.00|100.00
🟢|[rewrite.ts](src/network/rewrite.ts)|100.00|100.00
🟢|[rules.ts](src/network/rules.ts)|100.00|94.57
🟢|[types.ts](src/network/types.ts)|100.00|100.00

</details>

<details open>
<summary>🟡 <b>src/output</b>: 54.87% das linhas, 3 arquivos</summary>

Status|Arquivo|% Funcs|% Lines
--|--|--|--
🟢|[constants.ts](src/output/constants.ts)|100.00|100.00
🟡|[index.ts](src/output/index.ts)|58.82|63.46
🔴|[stdio.ts](src/output/stdio.ts)|0.00|1.15

</details>

<details open>
<summary>🟢 <b>src/policy</b>: 99.28% das linhas, 4 arquivos</summary>

Status|Arquivo|% Funcs|% Lines
--|--|--|--
🟢|[command.ts](src/policy/command.ts)|100.00|100.00
🟢|[index.ts](src/policy/index.ts)|98.18|100.00
🟢|[policy.interface.ts](src/policy/policy.interface.ts)|100.00|100.00
🟢|[wildmatch.ts](src/policy/wildmatch.ts)|100.00|97.10

</details>

<details open>
<summary>🟢 <b>src/providers</b>: 98.98% das linhas, 11 arquivos</summary>

Status|Arquivo|% Funcs|% Lines
--|--|--|--
🟢|[claude/claude-provider.ts](src/providers/claude/claude-provider.ts)|88.89|98.23
🟢|[claude/policy.ts](src/providers/claude/policy.ts)|89.66|98.05
🟢|[codex/codex-provider.ts](src/providers/codex/codex-provider.ts)|85.71|95.55
🟢|[codex/policy.ts](src/providers/codex/policy.ts)|97.30|100.00
🟢|[constants.ts](src/providers/constants.ts)|100.00|100.00
🟢|[cursor/cursor-provider.ts](src/providers/cursor/cursor-provider.ts)|87.50|98.05
🟢|[cursor/policy.ts](src/providers/cursor/policy.ts)|100.00|100.00
🟢|[ollama/ollama-provider.ts](src/providers/ollama/ollama-provider.ts)|96.67|98.90
🟢|[ollama/ollama-traffic.ts](src/providers/ollama/ollama-traffic.ts)|95.65|100.00
🟢|[tool-detail.ts](src/providers/tool-detail.ts)|100.00|100.00
🟢|[tools.ts](src/providers/tools.ts)|100.00|100.00

</details>

<details open>
<summary>🟢 <b>src/rounds</b>: 96.71% das linhas, 32 arquivos</summary>

Status|Arquivo|% Funcs|% Lines
--|--|--|--
🟢|[capture.ts](src/rounds/capture.ts)|94.74|95.97
🟢|[constants.ts](src/rounds/constants.ts)|100.00|100.00
🟢|[criteria.ts](src/rounds/criteria.ts)|96.43|91.09
🟢|[define.ts](src/rounds/define.ts)|100.00|90.95
🟢|[definitions.ts](src/rounds/definitions.ts)|100.00|100.00
🟡|[dir.ts](src/rounds/dir.ts)|0.00|66.67
🟢|[git.ts](src/rounds/git.ts)|88.24|84.82
🟢|[index.ts](src/rounds/index.ts)|100.00|100.00
🟢|[measures.ts](src/rounds/measures.ts)|95.65|100.00
🟢|[pages.ts](src/rounds/pages.ts)|100.00|100.00
🟢|[payload.ts](src/rounds/payload.ts)|100.00|100.00
🟢|[permissions.ts](src/rounds/permissions.ts)|100.00|100.00
🟢|[record.ts](src/rounds/record.ts)|100.00|100.00
🟢|[references.ts](src/rounds/references.ts)|100.00|100.00
🟢|[resources.ts](src/rounds/resources.ts)|100.00|97.91
🟢|[rules.ts](src/rounds/rules.ts)|100.00|97.50
🟢|[run.ts](src/rounds/run.ts)|84.62|92.74
🟢|[same-choliba.ts](src/rounds/same-choliba.ts)|100.00|95.79
🟢|[score.ts](src/rounds/score.ts)|86.79|96.51
🟢|[snapshot.ts](src/rounds/snapshot.ts)|100.00|100.00
🟢|[totals.ts](src/rounds/totals.ts)|100.00|100.00
🟢|[types.ts](src/rounds/types.ts)|100.00|100.00
🟢|[validate.ts](src/rounds/validate.ts)|95.45|95.95
🟢|[web/src/declaration.ts](src/rounds/web/src/declaration.ts)|93.55|88.85
🟢|[web/src/filters.ts](src/rounds/web/src/filters.ts)|96.30|100.00
🟢|[web/src/format.ts](src/rounds/web/src/format.ts)|100.00|100.00
🟢|[web/src/load-definition.ts](src/rounds/web/src/load-definition.ts)|90.28|100.00
🟢|[web/src/project-tools.ts](src/rounds/web/src/project-tools.ts)|100.00|100.00
🟢|[web/src/round-filters.ts](src/rounds/web/src/round-filters.ts)|84.00|100.00
🟢|[web/src/source.ts](src/rounds/web/src/source.ts)|100.00|100.00
🟢|[web/src/summary.ts](src/rounds/web/src/summary.ts)|100.00|100.00
🟢|[web/src/timeline.ts](src/rounds/web/src/timeline.ts)|100.00|100.00

</details>

<details open>
<summary>🟢 <b>src/store</b>: 94.09% das linhas, 2 arquivos</summary>

Status|Arquivo|% Funcs|% Lines
--|--|--|--
🟢|[index.ts](src/store/index.ts)|91.43|92.63
🟢|[network-ledger.ts](src/store/network-ledger.ts)|100.00|95.56

</details>

<details open>
<summary>🟢 <b>src/workspace</b>: 96.61% das linhas, 10 arquivos</summary>

Status|Arquivo|% Funcs|% Lines
--|--|--|--
🟢|[constants.ts](src/workspace/constants.ts)|100.00|100.00
🟢|[index.ts](src/workspace/index.ts)|100.00|100.00
🟢|[sandbox/bubblewrap.ts](src/workspace/sandbox/bubblewrap.ts)|100.00|100.00
🟢|[sandbox/debug.ts](src/workspace/sandbox/debug.ts)|100.00|100.00
🟡|[sandbox/docker.ts](src/workspace/sandbox/docker.ts)|70.59|66.11
🟢|[sandbox/host-access.ts](src/workspace/sandbox/host-access.ts)|100.00|100.00
🟢|[sandbox/host-state.ts](src/workspace/sandbox/host-state.ts)|100.00|100.00
🟢|[sandbox/index.ts](src/workspace/sandbox/index.ts)|100.00|100.00
🟢|[sandbox/protect.ts](src/workspace/sandbox/protect.ts)|100.00|100.00
🟢|[sandbox/wrap-command.ts](src/workspace/sandbox/wrap-command.ts)|100.00|100.00

</details>
