import { writtenToolCall, writtenToolCallMessage } from '../../runs/written-tool-call';

const CALL = '{\n  "name": "Read",\n  "arguments": {\n    "file_path": "/w/projects/site/config.json"\n  }\n}';

describe('writtenToolCall', () => {
  it.each([
    ['bare', CALL],
    ['in a json fence', `\`\`\`json\n${CALL}\n\`\`\``],
    ['in a plain fence, with blank lines around', `\n\`\`\`\n${CALL}\n\`\`\`\n`],
    ['in tool_call tags', `<tool_call>\n${CALL}\n</tool_call>`],
    ['with parameters', '{"name": "Read", "parameters": {"file_path": "x"}}'],
    ['with input', '{"name": "Read", "input": {}}'],
  ])('finds the tool of a call written %s', (_, text) => {
    expect(writtenToolCall(text)).toBe('Read');
  });

  it.each([
    ['prose', 'Gravei o ticket site-2.'],
    ['prose around a JSON block', `Vou ler o arquivo:\n\`\`\`json\n${CALL}\n\`\`\``],
    ['JSON without a name', '{"arguments": {"file_path": "x"}}'],
    ['JSON without arguments', '{"name": "Read"}'],
    ['arguments that are not an object', '{"name": "Read", "arguments": "x"}'],
    ['a JSON array', `[${CALL}]`],
    ['invalid JSON', '{"name": "Read", "arguments": {'],
    ['nothing', ''],
  ])('finds none in %s', (_, text) => {
    expect(writtenToolCall(text)).toBeUndefined();
  });
});

describe('writtenToolCallMessage', () => {
  it('names the model when the provider reported it, and the tool', () => {
    expect(writtenToolCallMessage('qwen2.5-coder:7b', 'Read')).toBe(
      'O modelo qwen2.5-coder:7b escreveu a chamada da ferramenta Read como texto em vez de chamá-la, e a sessão ' +
        'terminou sem rodá-la. Use um modelo que faça tool calling.',
    );
    expect(writtenToolCallMessage(undefined, 'Read')).toMatch(/^O modelo escreveu a chamada da ferramenta Read/);
  });
});
