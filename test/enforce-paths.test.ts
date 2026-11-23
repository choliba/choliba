import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, expect, test } from 'bun:test';

import { enforcePolicy, ownToolBroker } from '../src/agent/enforce';
import type { ProgramCommand, ProgramOutput } from '../src/execute/types';
import { clearTools, registerTool, type ToolServer } from '../src/mcp/index';
import type { AgentPolicy } from '../src/policy/index';
import type {
  ExecutionGate,
  Provider,
  ProviderEvent,
} from '../src/providers/types';
import { Workspace } from '../src/workspace/index';

afterEach(() => clearTools());

/** Keeps what Choliba hands it: the gate's hook and the tools' server. */
class RecordingProvider implements Provider<string, string> {
  public readonly id = 'gravador';
  public gate: ExecutionGate | undefined;
  public server: ToolServer | undefined;

  public describe() {
    return { name: 'gravador', model: 'm', cli: 'sh' };
  }

  public createCommand(): ProgramCommand {
    return { executable: 'true' };
  }

  public async *parseOutput(
    output: AsyncIterable<ProgramOutput>,
  ): AsyncIterable<ProviderEvent<string>> {
    for await (const { chunk } of output)
      yield { type: 'output', value: chunk };
  }

  public applyPolicy(
    _policy: AgentPolicy,
    gate: ExecutionGate | undefined,
  ): readonly string[] {
    this.gate = gate;
    return [];
  }

  public ownTools(): readonly string[] {
    return ['choliba/ecoar'];
  }

  public applyTools(server: ToolServer): void {
    this.server = server;
  }
}

test('o hook do gate e o servidor de ferramentas chegam ao CLI com os caminhos de dentro da sandbox', async () => {
  const root = mkdtempSync(join(tmpdir(), 'choliba-enforce-'));
  const workspace = new Workspace({ type: 'bubblewrap', root });
  const provider = new RecordingProvider();
  registerTool({
    name: 'ecoar',
    description: 'Devolve o texto.',
    input: { type: 'object', properties: {}, additionalProperties: false },
    run: () => 'eco',
  });

  const { broker } = enforcePolicy({
    policy: {
      default: 'deny',
      allow: {
        filesystem: [{ operations: ['read'], paths: ['/workspace/**'] }],
        execution: [{ commands: ['ls'] }],
      },
    },
    provider,
    workspace,
    approve: () => Promise.resolve('deny'),
    store: undefined,
    onTraffic: () => undefined,
  });
  const tools = ownToolBroker(provider, workspace, undefined);

  try {
    const hook = provider.gate?.hookCommand ?? [];
    const server = provider.server?.command ?? [];
    expect(broker).toBeDefined();
    expect(hook).toEqual(
      (broker?.hookCommand() ?? []).map((argument) =>
        workspace.paths.insideValue(argument),
      ),
    );
    expect(server).toEqual(
      (tools?.serverCommand().command ?? []).map((argument) =>
        workspace.paths.insideValue(argument),
      ),
    );
    // Nothing points to the host's homes, which the sandbox does not have.
    for (const argument of [...hook, ...server]) {
      expect(argument.startsWith('/home/')).toBe(false);
    }
    // Where to write the CLI's files stays the host's; `inside` translates.
    expect(provider.gate?.root).toBe(root);
    expect(provider.gate?.inside?.(join(root, 'a'))).toBe('/home/choliba/a');
  } finally {
    await broker?.close();
    await tools?.close();
    await workspace.close();
    rmSync(root, { recursive: true, force: true });
  }
});
