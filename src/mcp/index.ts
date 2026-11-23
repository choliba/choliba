/**
 * The agents' own tools: functions of the project the model can call, like
 * LangChain's tools. A tool is registered once (`registerTool`) and then
 * named the same everywhere, `choliba/<nome>`: in the provider's `tools`
 * (what the model sees) and in the policy (what it may call). The CLI gets
 * them from an MCP server the Choliba runs for the agent; each call comes back
 * to the Choliba's process, where `run` executes (outside the sandbox).
 */

import { UsageError } from '../errors';
import { TOOL_NAME, TOOL_SERVER } from './constants';
import type { ToolInputSchema } from './schema';

export { TOOL_SERVER } from './constants';
export {
  inputProblem,
  isRecord,
  type JsonSchema,
  type ToolInputSchema,
} from './schema';
export { ToolBroker, type ToolServer } from './broker';

/** What a tool gives back: text for the model, or a value sent as JSON. */
export type ToolOutput = string | number | boolean | object | null;

export interface AgentTool {
  /** `consultar_ticket`: lowercase letters, digits and `_`. */
  readonly name: string;
  /** What it does and when to use it: what the model reads to choose it. */
  readonly description: string;
  /** Its input, in JSON Schema: an object and its fields. */
  readonly input: ToolInputSchema;
  /**
   * Does the work, in the Choliba's process (outside the sandbox), with the
   * input already checked against `input`. A thrown error goes back to the
   * model as the call's failure. Declare the input's own type here
   * (`run(input: { url: string })`): it is what `input` describes.
   */
  run(
    input: Readonly<Record<string, unknown>>,
  ): ToolOutput | Promise<ToolOutput>;
}

/** A registered tool's name, as the provider's tools and the policy write it. */
export type ToolKey = `choliba/${string}`;

/** Checks a tool's declaration and gives it back: the place to write one. */
export function tool(definition: AgentTool): AgentTool {
  if (!TOOL_NAME.test(definition.name)) {
    throw new UsageError(
      `O nome da ferramenta "${definition.name}" deve ter só letras minúsculas, números e _, começando por uma letra, como consultar_ticket.`,
    );
  }
  if (definition.description.trim().length === 0) {
    throw new UsageError(
      `A ferramenta ${definition.name} precisa de uma descrição: é o que o modelo lê para escolhê-la.`,
    );
  }
  // A plain JavaScript caller has no types to stop a wrong schema.
  const declared: unknown = Reflect.get(definition.input, 'type');
  if (declared !== 'object') {
    throw new UsageError(
      `A entrada da ferramenta ${definition.name} deve ser um JSON Schema de objeto: { type: 'object', properties: { … } }.`,
    );
  }
  return definition;
}

// The CLI and project tools may load separate Choliba package copies.
const registryKey = Symbol.for('choliba.agent-tools');
const existingRegistry: unknown = Reflect.get(globalThis, registryKey);
const registry: Map<unknown, unknown> =
  existingRegistry instanceof Map
    ? existingRegistry
    : new Map<unknown, unknown>();

if (!(existingRegistry instanceof Map)) {
  Object.defineProperty(globalThis, registryKey, { value: registry });
}

function isAgentTool(value: unknown): value is AgentTool {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string' &&
    'description' in value &&
    typeof value.description === 'string' &&
    'input' in value &&
    typeof value.input === 'object' &&
    value.input !== null &&
    'run' in value &&
    typeof value.run === 'function'
  );
}

/**
 * Makes a tool available by its name, `choliba/<nome>`: an agent sees it only
 * when its provider's `tools` names it, and calls it only when its policy
 * allows. A second tool with the same name is refused.
 */
export function registerTool(definition: AgentTool): ToolKey {
  const checked = tool(definition);
  if (registry.has(checked.name)) {
    throw new UsageError(
      `Já há uma ferramenta registrada com o nome ${checked.name}.`,
    );
  }
  registry.set(checked.name, checked);
  return toolKey(checked.name);
}

/** `choliba/<nome>`: how a tool is named in the provider's tools and the policy. */
export const toolKey = (name: string): ToolKey => `${TOOL_SERVER}/${name}`;

/** Whether a name of the provider's `tools` is a registered tool's (`choliba/…`). */
export const isOwnToolKey = (key: string): boolean =>
  key.startsWith(`${TOOL_SERVER}/`);

/** The registered tool named `choliba/<nome>`; a `UsageError` when there is none. */
export function registeredTool(key: string): AgentTool {
  const name = key.slice(TOOL_SERVER.length + 1);
  const found: unknown = registry.get(name);
  if (!isAgentTool(found)) {
    const known = [...registry.keys()]
      .filter(
        (registeredName): registeredName is string =>
          typeof registeredName === 'string',
      )
      .map(toolKey);
    throw new UsageError(
      `Não há a ferramenta ${key}: registre-a com registerTool antes de criar o agente. ${known.length === 0 ? 'Nenhuma está registrada.' : `As registradas: ${known.join(', ')}.`}`,
    );
  }
  return found;
}

/** Forgets every registered tool (tests). */
export function clearTools(): void {
  registry.clear();
}
