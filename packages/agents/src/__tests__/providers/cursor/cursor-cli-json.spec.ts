import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  applyCursorMcpServers,
  applyCursorPermissions,
  mergeCliJson,
  mergeMcpJson,
} from '../../../providers/cursor/cursor-cli-json';
import { makeTmpDir } from '../../helpers/tmp';

const PERMISSIONS = { allow: ['Write(/repo/docs/**)'], deny: ['Shell(prettier)'] };

describe('mergeCliJson', () => {
  it('keeps other keys and unions the permission lists', () => {
    const existing = {
      editor: { vim: true },
      permissions: { allow: ['Shell(ls)', 'Write(/repo/docs/**)', 1], ask: [] },
    };

    expect(mergeCliJson(existing, PERMISSIONS)).toEqual({
      editor: { vim: true },
      permissions: { ask: [], allow: ['Shell(ls)', 'Write(/repo/docs/**)'], deny: ['Shell(prettier)'] },
    });
  });

  it('starts from nothing when the document or its permissions are not objects', () => {
    const expected = { permissions: { allow: ['Write(/repo/docs/**)'], deny: ['Shell(prettier)'] } };
    expect(mergeCliJson([], PERMISSIONS)).toEqual(expected);
    expect(mergeCliJson({ permissions: 'x' }, PERMISSIONS)).toEqual(expected);
  });
});

describe('mergeMcpJson', () => {
  it('keeps other keys and servers, replacing a server of the same name', () => {
    const existing = { other: 1, mcpServers: { mine: { url: 'm' }, browser: { url: 'old' } } };

    expect(mergeMcpJson(existing, { browser: { command: 'npx' } })).toEqual({
      other: 1,
      mcpServers: { mine: { url: 'm' }, browser: { command: 'npx' } },
    });
  });

  it('starts from nothing when the document or its servers are not objects', () => {
    expect(mergeMcpJson('x', { a: { url: 'u' } })).toEqual({ mcpServers: { a: { url: 'u' } } });
    expect(mergeMcpJson({ mcpServers: [] }, { a: { url: 'u' } })).toEqual({ mcpServers: { a: { url: 'u' } } });
  });
});

describe('applyCursorMcpServers', () => {
  it('writes .cursor/mcp.json for the run and puts an existing one back byte for byte', () => {
    const tmp = makeTmpDir('cursor-mcp-json');
    try {
      mkdirSync(join(tmp.path, '.cursor'));
      const original = '{"mcpServers": {"mine": {"url": "m"}}}\n';
      writeFileSync(join(tmp.path, '.cursor/mcp.json'), original);

      const restore = applyCursorMcpServers(tmp.path, { browser: { command: 'npx' } });
      expect(readFileSync(join(tmp.path, '.cursor/mcp.json'), 'utf8')).toContain('"browser"');
      restore();
      expect(readFileSync(join(tmp.path, '.cursor/mcp.json'), 'utf8')).toBe(original);
    } finally {
      tmp.cleanup();
    }
  });
});

describe('applyCursorPermissions', () => {
  it('writes the permissions into the run dir and removes the file and the .cursor dir it created', () => {
    const tmp = makeTmpDir('cursor-cli-json-new');
    try {
      const runDir = join(tmp.path, 'run');
      mkdirSync(runDir);
      const restore = applyCursorPermissions(runDir, tmp.path, PERMISSIONS);
      const written: unknown = JSON.parse(readFileSync(join(runDir, '.cursor/cli.json'), 'utf8'));
      expect(written).toEqual({ permissions: PERMISSIONS });
      expect(existsSync(join(tmp.path, '.cursor'))).toBe(false);

      restore();
      restore();
      expect(existsSync(join(runDir, '.cursor'))).toBe(false);
    } finally {
      tmp.cleanup();
    }
  });

  it('keeps a .cursor dir in the run dir that already existed', () => {
    const tmp = makeTmpDir('cursor-cli-json-dir');
    try {
      const runDir = join(tmp.path, 'run');
      mkdirSync(join(runDir, '.cursor'), { recursive: true });
      applyCursorPermissions(runDir, tmp.path, PERMISSIONS)();
      expect(existsSync(join(runDir, '.cursor'))).toBe(true);
      expect(existsSync(join(runDir, '.cursor/cli.json'))).toBe(false);
    } finally {
      tmp.cleanup();
    }
  });

  it('unions the workspace cli.json into the run file and leaves the workspace file untouched', () => {
    const tmp = makeTmpDir('cursor-cli-json-existing');
    try {
      const runDir = join(tmp.path, 'run');
      mkdirSync(runDir);
      mkdirSync(join(tmp.path, '.cursor'));
      const original = '{ "editor": {"vim": true} }\n';
      writeFileSync(join(tmp.path, '.cursor/cli.json'), original);

      const restore = applyCursorPermissions(runDir, tmp.path, PERMISSIONS);
      const written = readFileSync(join(runDir, '.cursor/cli.json'), 'utf8');
      expect(written).toContain('Shell(prettier)');
      expect(written).toContain('"vim": true');
      expect(readFileSync(join(tmp.path, '.cursor/cli.json'), 'utf8')).toBe(original);
      restore();
      expect(readFileSync(join(tmp.path, '.cursor/cli.json'), 'utf8')).toBe(original);
      expect(existsSync(join(runDir, '.cursor/cli.json'))).toBe(false);
    } finally {
      tmp.cleanup();
    }
  });

  it('refuses to read an invalid workspace cli.json and writes nothing in the run dir', () => {
    const tmp = makeTmpDir('cursor-cli-json-invalid');
    try {
      const runDir = join(tmp.path, 'run');
      mkdirSync(runDir);
      mkdirSync(join(tmp.path, '.cursor'));
      writeFileSync(join(tmp.path, '.cursor/cli.json'), '{ nope');

      expect(() => applyCursorPermissions(runDir, tmp.path, PERMISSIONS)).toThrow('não é um JSON válido');
      expect(readFileSync(join(tmp.path, '.cursor/cli.json'), 'utf8')).toBe('{ nope');
      expect(existsSync(join(runDir, '.cursor'))).toBe(false);
    } finally {
      tmp.cleanup();
    }
  });
});
