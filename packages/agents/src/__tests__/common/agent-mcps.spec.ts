import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expandMcpConfig, mcpConfig, mcpServersMap, resolveMcps } from '../../common/agent-mcps';
import { makeTmpDir } from '../helpers/tmp';

const MCPS = join(__dirname, '..', 'fixtures', 'mcps');

describe('mcpConfig', () => {
  it('accepts a server started by command or reached by url', () => {
    expect(mcpConfig('{"command":"npx","args":["x"]}', 'x.json')).toEqual({ command: 'npx', args: ['x'] });
    expect(mcpConfig('{"type":"http","url":"https://mcp.example"}', 'x.json')).toEqual({
      type: 'http',
      url: 'https://mcp.example',
    });
  });

  it('rejects invalid JSON, a non-object, or a server with neither command nor url', () => {
    expect(() => mcpConfig('{', 'x.json')).toThrow('x.json: JSON inválido');
    expect(() => mcpConfig('[]', 'x.json')).toThrow('x.json: esperado um objeto JSON.');
    expect(() => mcpConfig('{"args":[]}', 'x.json')).toThrow('x.json: falta "command" ou "url".');
  });
});

describe('resolveMcps', () => {
  it('finds each listed server as <mcpsDir>/<name>.json', () => {
    expect(resolveMcps(MCPS, [{ name: 'dummy-mcp' }], {})).toEqual([
      { name: 'dummy-mcp', config: { command: 'npx', args: ['dummy-mcp-server'] }, path: join(MCPS, 'dummy-mcp.json') },
    ]);
    expect(resolveMcps(MCPS, [], {})).toEqual([]);
  });

  it('keeps the tools the declaration restricts the server to', () => {
    expect(resolveMcps(MCPS, [{ name: 'dummy-mcp', tools: ['a', 'b'] }], {})[0]?.tools).toEqual(['a', 'b']);
  });

  it('fails naming the missing file', () => {
    expect(() => resolveMcps(MCPS, [{ name: 'nope' }], {})).toThrow(
      `mcp "nope" não encontrado: ${join(MCPS, 'nope.json')} não existe.`,
    );
  });
});

describe('expandMcpConfig', () => {
  it('fills ${NAME} in every string, however deep, leaving other values alone', () => {
    const config = { command: 'node', args: ['${APP}/main.js', 1], env: { LOG_DIR: '${APP}/logs', DEBUG: true } };

    expect(expandMcpConfig(config, { APP: '/opt/app' }, 'x.json')).toEqual({
      command: 'node',
      args: ['/opt/app/main.js', 1],
      env: { LOG_DIR: '/opt/app/logs', DEBUG: true },
    });
  });

  it('fails naming each variable with no value, without listing the available ones', () => {
    expect(() => expandMcpConfig({ command: '${A}', args: ['${B}', '${A}'] }, { SECRET: 's' }, 'x.json')).toThrow(
      'x.json usa ${A}, ${B}, sem valor: defina no .env ou no ambiente.',
    );
  });

  it('is applied by resolveMcps', () => {
    const tmp = makeTmpDir('mcp-server');
    try {
      writeFileSync(join(tmp.path, 'main.js'), '');
      expect(resolveMcps(MCPS, [{ name: 'with-var' }], { SERVER_DIR: tmp.path })[0]?.config).toEqual({
        command: 'node',
        args: [join(tmp.path, 'main.js')],
      });
    } finally {
      tmp.cleanup();
    }
  });
});

describe('resolveMcps, when the server is not there', () => {
  it('fails naming the missing file and the variable it came from, before any session starts', () => {
    expect(() => resolveMcps(MCPS, [{ name: 'with-var' }], { SERVER_DIR: '/nowhere' })).toThrow(
      'o servidor do MCP with-var não existe: /nowhere/main.js (veja SERVER_DIR no .env).',
    );
  });

  it('checks an absolute command written as is too, and leaves relative paths and urls alone', () => {
    const tmp = makeTmpDir('mcp-servers');
    try {
      mkdirSync(join(tmp.path, 'mcps'));
      writeFileSync(join(tmp.path, 'mcps', 'abs.json'), JSON.stringify({ command: '/nowhere/server', args: ['x'] }));
      writeFileSync(join(tmp.path, 'mcps', 'rel.json'), JSON.stringify({ command: 'node', args: ['dist/main.js', 1] }));
      writeFileSync(join(tmp.path, 'mcps', 'url.json'), JSON.stringify({ url: 'http://localhost:9/mcp' }));
      const dir = join(tmp.path, 'mcps');

      expect(() => resolveMcps(dir, [{ name: 'abs' }], {})).toThrow(
        'o servidor do MCP abs não existe: /nowhere/server.',
      );
      expect(resolveMcps(dir, [{ name: 'rel' }, { name: 'url' }], {}).map((server) => server.name)).toEqual([
        'rel',
        'url',
      ]);
    } finally {
      tmp.cleanup();
    }
  });
});

describe('mcpServersMap', () => {
  it('keys each server config by its name', () => {
    expect(mcpServersMap([{ name: 'a', config: { url: 'u' }, path: '/a.json' }])).toEqual({ a: { url: 'u' } });
  });
});
