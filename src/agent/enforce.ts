/**
 * Enforcing the policy for one run: the sandbox, Choliba's own gates
 * (execution, network, the tools' broker) and what each provider translates.
 * A category nobody enforces is refused before anything runs.
 */

import type { AgentProvider } from './types';
import { ApprovalBroker } from '../approval/broker';
import { registeredTool, TOOL_SERVER, ToolBroker } from '../mcp/index';
import type { CommandApprover } from '../approval/gate';
import type { ExecutionGate, TrafficEvent } from '../providers/types';
import type { Store } from '../store/index';
import { networkLedger, type StoreNetworkLedger } from '../store/index';
import {
  delegatedCategories,
  PolicyEngine,
  type AgentPolicy,
  type PolicyCategory,
} from '../policy/index';
import { UsageError } from '../errors';
import type { Workspace, WorkspaceNetworkOptions } from '../workspace/index';
import type { RequestRewriter, TrafficObserver } from '../network/index';
import { environment, userHome } from '../execute/process';
import { sandboxHost } from '../workspace/sandbox/host-access';

/**
 * Filesystem goes to the sandbox; execution to Choliba's own gate, the same for
 * every CLI (the provider only wires its CLI's hook to it). Returns the gate,
 * if there are execution rules.
 */
export function enforcePolicy({
  policy,
  provider,
  workspace,
  approve,
  store,
  onTraffic,
}: {
  readonly policy: AgentPolicy;
  readonly provider: AgentProvider;
  readonly workspace: Workspace;
  readonly approve: CommandApprover;
  readonly store: Store | undefined;
  readonly onTraffic: (event: TrafficEvent) => void;
}): {
  readonly broker: ApprovalBroker | undefined;
  readonly networkLedger: StoreNetworkLedger | undefined;
} {
  rejectUnenforced(policy);
  const ledger =
    store === undefined
      ? undefined
      : networkLedger(store, { root: workspace.root, provider: provider.id });
  workspace.applyPermissions(
    policy,
    networkOptions(provider, approve, ledger, onTraffic),
  );

  const broker = needsGate(policy, provider)
    ? new ApprovalBroker({
        policy,
        provider: provider.id,
        root: workspace.root,
        approve,
        ...(store === undefined ? {} : { store }),
      })
    : undefined;
  const gate: ExecutionGate | undefined =
    broker === undefined
      ? undefined
      : {
          hookCommand: broker.hookCommand(),
          root: workspace.root,
          home: workspace.home(),
          // `share` also uses the CLI's state on the host.
          ...(workspace.hostState === 'share'
            ? { sharedHome: userHome() }
            : {}),
        };
  const cliFiles = applyProviderPolicy(provider, policy, gate);

  // What enforces the policy stays read-only for the agent.
  workspace.protect([
    ...(broker === undefined ? [] : [broker.dir]),
    ...cliFiles,
  ]);
  return { broker, networkLedger: ledger };
}

/** Categories of `AgentPolicy` that Choliba does not enforce yet. */
export const UNENFORCED: readonly PolicyCategory[] = ['tools', 'agents'];

/**
 * What the agent hands the workspace for its network (the rules come from
 * the policy there): the provider's own API always gets through, its CLI's
 * background traffic never, and the approver is the same as for commands:
 * one prompt, one queue for the person.
 */
export function networkOptions(
  provider: AgentProvider,
  approve: CommandApprover,
  ledger: StoreNetworkLedger | undefined,
  onTraffic: (event: TrafficEvent) => void,
): WorkspaceNetworkOptions {
  return {
    ...trafficObservers(provider, onTraffic),
    ...requestRewriters(provider),
    alwaysAllow: provider.networkEndpoints?.() ?? [],
    alwaysDeny: provider.networkBlocked?.() ?? [],
    approve: (request) =>
      approve({
        command: `${request.hostname}:${String(request.port)}`,
        pattern: request.pattern,
        reason: request.reason,
        provider: provider.id,
        category: 'network',
      }),
    ...(ledger === undefined ? {} : { ledger }),
  };
}

/**
 * What the provider changes in its requests to its model (an option the
 * CLI does not send), at each of its endpoints. None for the others.
 */
export function requestRewriters(provider: AgentProvider): {
  readonly rewrite?: readonly RequestRewriter[];
} {
  const rewrite = provider.rewriteRequest?.bind(provider);
  if (rewrite === undefined) return {};
  return {
    rewrite: (provider.networkEndpoints?.() ?? []).map((destination) => ({
      destination,
      rewrite,
    })),
  };
}

/**
 * Where the provider reads its model's traffic (a local model): the text
 * as it is written and each request's usage, from the model's own answers.
 * None for any other.
 */
export function trafficObservers(
  provider: AgentProvider,
  onTraffic: (event: TrafficEvent) => void,
): { readonly observe?: readonly TrafficObserver[] } {
  if (provider.readTraffic === undefined) return {};
  return {
    observe: (provider.networkEndpoints?.() ?? []).map((destination) => ({
      destination,
      observe: ({ responses }) => {
        const events = provider.readTraffic?.(responses);
        if (events === undefined) return;
        void (async () => {
          for await (const event of events) onTraffic(event);
        })().catch(() => undefined);
      },
    })),
  };
}

/**
 * Only the provider's share of the host reaches the sandbox: a home of its
 * own (or, with `hostState: 'share'`, its state on the host), its own
 * credentials and the variables `secrets` allows; every other secret (other
 * logins, tokens in the environment) is not there at all. Applies with or
 * without a policy, and to any provider (one that declares nothing gets a
 * home and nothing else).
 */
export function shareHost(
  workspace: Workspace,
  provider: AgentProvider,
  policy: AgentPolicy | undefined,
): void {
  const access = provider.hostAccess?.() ?? {
    credentialFiles: [],
    credentialEnv: [],
    sharedState: [],
  };

  const engine = policy === undefined ? undefined : new PolicyEngine(policy);
  // `requireApproval` cannot ask when the variable is read: not let in.
  const allowSecret = (name: string): boolean =>
    engine?.check({ category: 'secrets', operation: 'read', secret: name })
      .policy === 'allow';
  workspace.useHost(
    sandboxHost(access, environment(), allowSecret, {
      hostState: workspace.hostState,
      provider: provider.id,
      home: workspace.home(),
      homesDir: workspace.homes,
      root: workspace.root,
    }),
  );
}

/**
 * Rules Choliba cannot enforce would be ignored silently: refuse to start
 * instead, as for a category the provider does not apply.
 */
export function rejectUnenforced(policy: AgentPolicy): void {
  const category = UNENFORCED.find((name) =>
    (['allow', 'requireApproval', 'deny'] as const).some((source) =>
      name === 'tools'
        ? // The agent's own tools (choliba/…) are checked by the Choliba's
          // server; other MCP servers' are not enforced yet.
          (policy[source]?.tools ?? []).some((rule) =>
            [...rule.tools, ...(rule.ignores?.tools ?? [])].some(
              (pattern) => !pattern.startsWith(`${TOOL_SERVER}/`),
            ),
          )
        : (policy[source]?.[name]?.length ?? 0) > 0,
    ),
  );

  if (category !== undefined) {
    throw new UsageError(
      `O Choliba ainda não aplica a categoria ${category}: tire essas regras do agente.`,
    );
  }
}

/**
 * The server of the registered tools the provider's `tools` names
 * (`choliba/<nome>`), handed to its CLI and kept read-only in the sandbox;
 * `undefined` without any. A provider that cannot take them refuses.
 */
export function ownToolBroker(
  provider: AgentProvider,
  workspace: Workspace,
  policy: AgentPolicy | undefined,
): ToolBroker | undefined {
  const names = provider.ownTools?.() ?? [];
  if (names.length === 0) return undefined;
  if (provider.applyTools === undefined) {
    throw new UsageError(
      `O provider ${provider.id} ainda não aceita ferramentas registradas: tire ${names.join(', ')} do tools dele.`,
    );
  }
  const broker = new ToolBroker({ tools: names.map(registeredTool), policy });
  provider.applyTools(broker.serverCommand());
  workspace.protect([broker.dir]);
  return broker;
}

export function needsGate(
  policy: AgentPolicy,
  provider: AgentProvider,
): boolean {
  return (
    delegatedCategories(policy).includes('execution') &&
    provider.applyPolicy !== undefined
  );
}

export function applyProviderPolicy(
  provider: AgentProvider,
  policy: AgentPolicy,
  gate: ExecutionGate | undefined,
): readonly string[] {
  if (provider.applyPolicy !== undefined) {
    return provider.applyPolicy(policy, gate);
  }

  const category = delegatedCategories(policy).at(0);

  if (category !== undefined) {
    throw new UsageError(
      `O provider ${provider.id} não aplica a categoria ${category}.`,
    );
  }

  return [];
}
