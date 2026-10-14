import { asString, isRecord, parseJsonLine } from '../../common';

/** A fence around the whole text (```json … ```), or the `<tool_call>` tags of the Qwen and Hermes templates. */
const WRAPPERS: readonly RegExp[] = [/^```[a-z]*\n([\s\S]*)\n```$/, /^<tool_call>([\s\S]*)<\/tool_call>$/];

/** Where a written call keeps its arguments, by the convention the model learned. */
const ARGUMENT_KEYS: readonly string[] = ['arguments', 'parameters', 'input'];

/** The text inside its wrapper, when one wraps all of it. */
function unwrapped(text: string): string {
  for (const wrapper of WRAPPERS) {
    const inner = wrapper.exec(text)?.[1];
    if (inner !== undefined) return inner.trim();
  }
  return text;
}

/**
 * The tool a model called by writing the call as its answer (`{"name": "Read", "arguments": {…}}`), instead of
 * through the API's tool calling, so nothing ran; `undefined` for any other answer, prose quoting JSON included.
 */
export function writtenToolCall(text: string): string | undefined {
  const call = parseJsonLine(unwrapped(text.trim()));
  if (!isRecord(call)) return undefined;
  const name = asString(call['name']);
  if (name === undefined || !ARGUMENT_KEYS.some((key) => isRecord(call[key]))) return undefined;
  return name;
}

/** Why the run failed when the model wrote `tool` as text; `model` is the one the provider reported, if any. */
export function writtenToolCallMessage(model: string | undefined, tool: string): string {
  const who = model === undefined ? 'O modelo' : `O modelo ${model}`;
  return (
    `${who} escreveu a chamada da ferramenta ${tool} como texto em vez de chamá-la, e a sessão terminou sem rodá-la. ` +
    'Use um modelo que faça tool calling.'
  );
}
