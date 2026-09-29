import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Writable } from '@choliba/terminal';

import { AgentConfigError } from '../../agent-loader';
import * as agentModule from '../../commands/agent';

const {
  collectAttributeFromMatch,
  collectSectionFromMatch,
  parseAttributePair,
  parseAttributes,
  parseInstructionSections,
  parseSectionTagMatch,
  printAgentDefinition,
  unwrapAgentRoot,
  validateAgentFiles,
  validateAgentYamlV1,
  validateSystemMd,
} = agentModule;

const FIXTURES = join(__dirname, '..', 'fixtures', 'agents');

function fakeWritable(): Writable & { chunks: string[] } {
  const chunks: string[] = [];
  return {
    chunks,
    write(chunk: string) {
      chunks.push(chunk);
    },
  };
}

describe('parseInstructionSections', () => {
  it('returns trimmed text as-is when there are no nested tags', () => {
    expect(parseInstructionSections('\n  hello world  \n')).toBe('hello world');
  });

  it('recursively nests tags into objects, arbitrarily deep', () => {
    const text = [
      '<outer>',
      '<inner_a>',
      'texto A',
      '</inner_a>',
      '',
      '<inner_b>',
      'texto B',
      '</inner_b>',
      '</outer>',
      '',
      '<flat>',
      'texto simples sem tags aninhadas',
      '</flat>',
    ].join('\n');

    expect(parseInstructionSections(text)).toEqual({
      outer: { inner_a: 'texto A', inner_b: 'texto B' },
      flat: 'texto simples sem tags aninhadas',
    });
  });

  it('groups repeated sibling tags into an array, in document order', () => {
    const text = ['<note>primeira</note>', '<note>segunda</note>', '<note>terceira</note>'].join('\n');

    expect(parseInstructionSections(text)).toEqual({
      note: ['primeira', 'segunda', 'terceira'],
    });
  });

  it('keeps a singular value when a tag name appears only once, even if pluralized', () => {
    const text = '<notes>única nota</notes>';

    expect(parseInstructionSections(text)).toEqual({ notes: 'única nota' });
  });

  it('mixes repeated and unique sibling tags in the same object', () => {
    const text = ['<intro>oi</intro>', '<note>primeira</note>', '<note>segunda</note>'].join('\n');

    expect(parseInstructionSections(text)).toEqual({
      intro: 'oi',
      note: ['primeira', 'segunda'],
    });
  });

  it('puts a single attribute under "@attributes", alongside the leaf text under "@text"', () => {
    expect(parseInstructionSections('<foo bar="1">hello</foo>')).toEqual({
      foo: { '@attributes': { bar: '1' }, '@text': 'hello' },
    });
  });

  it('parses multiple attributes on the same tag', () => {
    expect(parseInstructionSections('<foo a="1" b="2">x</foo>')).toEqual({
      foo: { '@attributes': { a: '1', b: '2' }, '@text': 'x' },
    });
  });

  it('merges "@attributes" alongside nested children, instead of wrapping them under "@text"', () => {
    const text = ['<allow action="write">', '<path>a</path>', '<path>b</path>', '</allow>'].join('\n');

    expect(parseInstructionSections(text)).toEqual({
      allow: { '@attributes': { action: 'write' }, path: ['a', 'b'] },
    });
  });

  it('a tag with no attributes behaves exactly as before (no "@attributes" key)', () => {
    expect(parseInstructionSections('<foo>hello</foo>')).toEqual({ foo: 'hello' });
  });

  it('ignores tags whose names do not match the section pattern', () => {
    expect(parseInstructionSections('<foo>hello</foo><bad tag>x</bad tag>')).toEqual({ foo: 'hello' });
  });
});

describe('parseSectionTagMatch', () => {
  it('returns undefined when capture groups are missing', () => {
    expect(
      parseSectionTagMatch(['<foo>', undefined, ' attrs', 'inner'] as unknown as RegExpMatchArray),
    ).toBeUndefined();
  });

  it('returns the groups when the match is complete', () => {
    expect(parseSectionTagMatch(['<foo a="1">', 'foo', ' a="1"', 'inner'])).toEqual({
      tagName: 'foo',
      rawAttributes: ' a="1"',
      inner: 'inner',
    });
  });
});

describe('parseAttributePair', () => {
  it('returns undefined when capture groups are missing', () => {
    expect(parseAttributePair(['bar="1"', undefined, '1'] as unknown as RegExpMatchArray)).toBeUndefined();
  });
});

describe('collectAttributeFromMatch', () => {
  it('returns false when capture groups are missing', () => {
    const target: Record<string, string> = {};
    expect(collectAttributeFromMatch(['bar="1"', undefined, '1'] as unknown as RegExpMatchArray, target)).toBe(false);
    expect(target).toEqual({});
  });

  it('writes the pair and returns true when capture groups are present', () => {
    const target: Record<string, string> = {};
    expect(collectAttributeFromMatch(['bar="1"', 'bar', '1'] as unknown as RegExpMatchArray, target)).toBe(true);
    expect(target).toEqual({ bar: '1' });
  });
});

describe('collectSectionFromMatch', () => {
  it('returns false when capture groups are missing', () => {
    const grouped = new Map<string, unknown[]>();
    expect(collectSectionFromMatch(['<foo>', undefined, '', ''] as unknown as RegExpMatchArray, grouped)).toBe(false);
    expect(grouped.size).toBe(0);
  });

  it('merges a complete match into grouped', () => {
    const grouped = new Map<string, unknown[]>();
    expect(collectSectionFromMatch(['<foo>', 'foo', '', 'inner'] as unknown as RegExpMatchArray, grouped)).toBe(true);
    expect(grouped.get('foo')).toEqual(['inner']);
  });
});

describe('parseAttributes', () => {
  it('parses valid attribute strings', () => {
    expect(parseAttributes(' bar="1"')).toEqual({ bar: '1' });
  });
});

describe('unwrapAgentRoot', () => {
  it('returns parsed sections unchanged when there is no agent root key', () => {
    const parsed = { note: 'only section' };
    expect(unwrapAgentRoot(parsed)).toBe(parsed);
  });

  it('unwraps the agent root object when present', () => {
    expect(unwrapAgentRoot({ agent: { note: 'inside' } })).toEqual({ note: 'inside' });
  });

  it('passes plain strings through unchanged', () => {
    expect(unwrapAgentRoot('plain text')).toBe('plain text');
  });
});

describe('printAgentDefinition', () => {
  // Deliberately not asserting the exact shape of `instructions` here — that's `system.md`
  // content, and pinning it in this test would mean every future edit to a fixture's sections
  // forces an unrelated test update. What's stable and worth checking: the yaml-derived fields
  // (straight from agent.yaml, field order yaml-first), and that instructions parsed into an
  // object at all (proving loadAgent's schema validation + unwrap actually ran).
  it('reads agent.yaml + system.md and writes the agent definition as JSON, yaml fields first', async () => {
    const stdout = fakeWritable();

    await printAgentDefinition(FIXTURES, 'echo', stdout);

    const raw = stdout.chunks.join('');
    const printed = JSON.parse(raw) as Record<string, unknown>;
    expect(printed).toMatchObject({
      id: 'echo',
      name: 'echo',
      displayName: 'Echo Agent',
      version: '1.0.0',
      description: 'Repete a tarefa recebida, usado nos testes deste pacote.',
      supportedModels: ['claude-3-5-sonnet', 'gpt-4o'],
      skills: ['dummy-skill'],
      dir: join(FIXTURES, 'echo'),
      systemPromptPath: join(FIXTURES, 'echo', 'system.md'),
    });
    expect(typeof printed['instructions']).toBe('object');
    // yaml-derived metadata comes first in the printed JSON, ahead of path info and instructions.
    expect(raw.indexOf('"id"')).toBeLessThan(raw.indexOf('"dir"'));
    expect(raw.indexOf('"skills"')).toBeLessThan(raw.indexOf('"instructions"'));
  });

  it('throws when the name does not exist under agentsDir', async () => {
    const stdout = fakeWritable();

    await expect(printAgentDefinition(FIXTURES, 'nao-existe', stdout)).rejects.toThrow(AgentConfigError);
    expect(stdout.chunks).toEqual([]);
  });

  it('throws for an empty name instead of silently doing nothing', async () => {
    const stdout = fakeWritable();

    await expect(printAgentDefinition(FIXTURES, '', stdout)).rejects.toThrow(AgentConfigError);
    expect(stdout.chunks).toEqual([]);
  });
});

describe('validateSystemMd', () => {
  it('accepts a well-formed system.md with a single <agent> root matching the XSD', async () => {
    const text = readFileSync(join(FIXTURES, 'with-prepare', 'system.md'), 'utf8');

    const result = await validateSystemMd(text);

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('rejects a document with more than one top-level element (no single root)', async () => {
    const result = await validateSystemMd('<foo>a</foo><bar>b</bar>');

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects unescaped "<" inside text content', async () => {
    const result = await validateSystemMd('<agent><system_role>a < b</system_role></agent>');

    expect(result.valid).toBe(false);
  });
});

describe('validateAgentYamlV1', () => {
  it('validates the agent.yaml of a fixture against its folder', () => {
    const text = readFileSync(join(FIXTURES, 'reviewer', 'agent.yaml'), 'utf8');

    expect(validateAgentYamlV1(text, 'reviewer')).toEqual({ valid: true, errors: [] });
    expect(validateAgentYamlV1(text, 'outro').valid).toBe(false);
  });
});

describe('validateAgentFiles', () => {
  it('validates the with-prepare fixture agent.yaml + system.md together', async () => {
    const result = await validateAgentFiles(FIXTURES, 'with-prepare');

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('reports missing files instead of throwing', async () => {
    const result = await validateAgentFiles(FIXTURES, 'nao-existe');

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
