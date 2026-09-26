import { contentBlocks, summarize, toolResultText } from '../../providers/message-blocks';

describe('contentBlocks', () => {
  it('extracts the content array from a message', () => {
    const message = {
      content: [
        { type: 'text', text: 'hi' },
        { type: 'tool_use', id: '1', name: 'Bash' },
      ],
    };

    expect(contentBlocks(message)).toEqual([
      { type: 'text', text: 'hi' },
      { type: 'tool_use', id: '1', name: 'Bash' },
    ]);
  });

  it('returns an empty array when the message is not a record', () => {
    expect(contentBlocks(undefined)).toEqual([]);
    expect(contentBlocks('nope')).toEqual([]);
    expect(contentBlocks(null)).toEqual([]);
  });

  it('returns an empty array when content is missing or not an array', () => {
    expect(contentBlocks({})).toEqual([]);
    expect(contentBlocks({ content: 'not an array' })).toEqual([]);
  });

  it('drops non-object entries from content', () => {
    expect(contentBlocks({ content: [{ type: 'text', text: 'ok' }, 'bad', 42] })).toEqual([
      { type: 'text', text: 'ok' },
    ]);
  });
});

describe('toolResultText', () => {
  it('returns the content string as-is', () => {
    expect(toolResultText({ content: 'plain text' })).toBe('plain text');
  });

  it('joins an array of text parts', () => {
    expect(toolResultText({ content: [{ text: 'a' }, { text: 'b' }] })).toBe('a\nb');
  });

  it('treats a missing text part as empty', () => {
    expect(toolResultText({ content: [{ text: 'a' }, {}] })).toBe('a\n');
  });

  it('returns an empty string when content is absent', () => {
    expect(toolResultText({})).toBe('');
  });
});

describe('summarize', () => {
  it('prefers command, then file_path, then pattern', () => {
    expect(summarize({ command: 'git status' })).toBe('git status');
    expect(summarize({ file_path: '/a.ts' })).toBe('/a.ts');
    expect(summarize({ pattern: '*.ts' })).toBe('*.ts');
    expect(summarize({ command: 'c', file_path: 'f' })).toBe('c');
  });

  it('is empty when input is absent or has none of the known fields', () => {
    expect(summarize(undefined)).toBe('');
    expect(summarize({})).toBe('');
  });
});
