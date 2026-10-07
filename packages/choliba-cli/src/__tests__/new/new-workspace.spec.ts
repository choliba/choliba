import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { AGENTS_SOURCE, CHOLIBA_PACKAGE, type NewOptions, WorkspaceError } from '../../new/new-options';
import { formatSummary, type NewDeps, newWorkspace } from '../../new/new-workspace';
import { defaultsPrompter, type Prompter } from '../../new/prompter';

const ENV_TEMPLATE = 'CHOL_GLOBAL_DIR=\n# CHOL_AGENTS_PROVIDER=auto\n# CHOL_MCP_APP_DIR=\n# CHOL_MCP_APP_LOG_DIR=\n';

interface Scene {
  readonly root: string;
  readonly calls: string[];
  readonly said: string[];
  readonly deps: NewDeps;
}

/** A scratch folder; `bun add` writes the `.env` the choliba setup would; `failOn` makes that command fail. */
function scene(prompter: Prompter = defaultsPrompter, failOn?: string, checkCode = 0): Scene {
  const root = mkdtempSync(path.join(tmpdir(), 'choliba-cli-'));
  const calls: string[] = [];
  const said: string[] = [];
  const deps: NewDeps = {
    cwd: root,
    prompter,
    say: (line) => said.push(line),
    run: (command, args, cwd) => {
      const line = [command, ...args].join(' ');
      calls.push(`${path.relative(root, cwd)}$ ${line}`);
      if (failOn !== undefined && line.includes(failOn)) return 2;
      if (line.startsWith('bun add')) writeFileSync(path.join(cwd, '.env'), ENV_TEMPLATE);
      return line.endsWith('choliba check') ? checkCode : 0;
    },
  };
  return { root, calls, said, deps };
}

const BASE: NewOptions = { choliba: CHOLIBA_PACKAGE, agentsFrom: AGENTS_SOURCE, noInput: true };

describe('newWorkspace', () => {
  it('makes the folder, installs the choliba and the agents, sets the provider and checks it all', async () => {
    const s = scene();
    try {
      const result = await newWorkspace({ ...BASE, dir: 'ws', provider: 'claude', mcpAppDir: '' }, s.deps);

      const ws = path.join(s.root, 'ws');
      expect(result).toEqual({
        dir: ws,
        provider: 'claude',
        agents: ['product-owner', 'test-writer', 'implementer'],
        newAgent: undefined,
        checked: true,
      });
      expect(JSON.parse(readFileSync(path.join(ws, 'package.json'), 'utf8'))).toEqual({ name: 'ws', private: true });
      expect(s.calls).toEqual([
        `ws$ bun add --trust ${CHOLIBA_PACKAGE}`,
        `ws$ bunx choliba install ${AGENTS_SOURCE} --path .choliba/agents/product-owner`,
        `ws$ bunx choliba install ${AGENTS_SOURCE} --path .choliba/agents/test-writer`,
        `ws$ bunx choliba install ${AGENTS_SOURCE} --path .choliba/agents/implementer`,
        'ws$ bunx choliba check',
      ]);
      expect(readFileSync(path.join(ws, '.env'), 'utf8')).toContain('\nCHOL_AGENTS_PROVIDER=claude\n');
      expect(s.said).toContain(
        'mcp-app: defina CHOL_MCP_APP_DIR e CHOL_MCP_APP_LOG_DIR no .env antes de rodar o product-owner.',
      );
    } finally {
      rmSync(s.root, { recursive: true, force: true });
    }
  });

  it('writes where the mcp-app is, and says when it is not built yet', async () => {
    const s = scene();
    try {
      await newWorkspace({ ...BASE, dir: 'ws', agents: ['product-owner'], mcpAppDir: 'mcp-app' }, s.deps);

      const mcp = path.join(s.root, 'mcp-app');
      const env = readFileSync(path.join(s.root, 'ws', '.env'), 'utf8');
      expect(env).toContain(`\nCHOL_MCP_APP_DIR=${mcp}\nCHOL_MCP_APP_LOG_DIR=${path.join(mcp, 'logs')}\n`);
      expect(s.said).toContain(
        `mcp-app: ${path.join(mcp, 'dist', 'main.js')} não existe; compile o mcp-app antes de rodar o product-owner.`,
      );

      mkdirSync(path.join(mcp, 'dist'), { recursive: true });
      writeFileSync(path.join(mcp, 'dist', 'main.js'), '');
      const again = scene();
      await newWorkspace(
        { ...BASE, dir: path.join(s.root, 'ws2'), agents: ['product-owner'], mcpAppDir: mcp },
        again.deps,
      );
      expect(again.said.some((line) => line.includes('não existe'))).toBe(false);
      rmSync(again.root, { recursive: true, force: true });
    } finally {
      rmSync(s.root, { recursive: true, force: true });
    }
  });

  it('asks what the options do not say, and installs no agent when none is chosen', async () => {
    const asked: string[] = [];
    const prompter: Prompter = {
      text: (question) => {
        asked.push(question);
        return Promise.resolve('perguntada');
      },
      select: (question, choices) => {
        asked.push(`${question} ${choices.map((choice) => choice.label).join('|')}`);
        const choice = choices[2] ?? choices[0];
        if (choice === undefined) throw new Error('escolhas esperadas');
        return Promise.resolve(choice.value);
      },
      multiselect: (question) => {
        asked.push(question);
        return Promise.resolve([]);
      },
    };
    const s = scene(prompter);
    try {
      const result = await newWorkspace(BASE, s.deps);

      expect(result).toMatchObject({ dir: path.join(s.root, 'perguntada'), provider: 'cursor', agents: [] });
      expect(asked).toEqual([
        'Em que pasta criar a pasta de trabalho?',
        'Com que provider os agentes rodam? auto (o primeiro instalado)|claude|cursor',
        'Quais agentes do choliba instalar?',
        'Criar um agente seu agora? não (depois: choliba-cli agent new)|sim',
      ]);
      expect(s.calls).toEqual([`perguntada$ bun add --trust ${CHOLIBA_PACKAGE}`, 'perguntada$ bunx choliba check']);
    } finally {
      rmSync(s.root, { recursive: true, force: true });
    }
  });

  it('creates an agent of its own along the way, when asked to, before the check', async () => {
    const prompter: Prompter = {
      ...defaultsPrompter,
      text: (_question, flag) => Promise.resolve(flag === 'NOME' ? 'revisor' : 'Texto.'),
      select: (_question, choices, fallback) => {
        const yes = choices.find((choice) => choice.value === 'sim');
        return Promise.resolve(yes === undefined ? fallback : yes.value);
      },
    };
    const s = scene(prompter);
    try {
      const result = await newWorkspace({ ...BASE, dir: 'ws', agents: [] }, s.deps);

      expect(result.newAgent).toBe('revisor');
      expect(readFileSync(path.join(s.root, 'ws', '.choliba', 'agents', 'revisor', 'agent.yaml'), 'utf8')).toContain(
        'CHANGE_ME',
      );
      expect(s.calls.at(-1)).toBe('ws$ bunx choliba check');
      expect(formatSummary(result)).toContain('Agente novo: revisor (troque os CHANGE_ME do agent.yaml dele).');
    } finally {
      rmSync(s.root, { recursive: true, force: true });
    }
  });

  it('never mixes with a folder that already has something', async () => {
    const s = scene();
    try {
      mkdirSync(path.join(s.root, 'ws'));
      writeFileSync(path.join(s.root, 'ws', 'x'), '');
      await expect(newWorkspace({ ...BASE, dir: 'ws' }, s.deps)).rejects.toThrow(
        `a pasta ${path.join(s.root, 'ws')} já existe e não está vazia; escolha outra.`,
      );
      expect(s.calls).toEqual([]);

      mkdirSync(path.join(s.root, 'vazia'));
      await expect(newWorkspace({ ...BASE, dir: 'vazia', agents: [] }, s.deps)).resolves.toMatchObject({
        checked: true,
      });
    } finally {
      rmSync(s.root, { recursive: true, force: true });
    }
  });

  it('stops at a step that fails, naming it, and reports a check that found problems', async () => {
    const failing = scene(defaultsPrompter, 'install');
    const unchecked = scene(defaultsPrompter, undefined, 1);
    try {
      const error = newWorkspace({ ...BASE, dir: 'ws', agents: ['test-writer'] }, failing.deps);
      await expect(error).rejects.toThrow(WorkspaceError);
      await expect(newWorkspace({ ...BASE, dir: 'ws2', agents: ['test-writer'] }, failing.deps)).rejects.toThrow(
        `instalando o test-writer falhou (código 2). A pasta ${path.join(failing.root, 'ws2')} ficou como está.`,
      );
      const result = await newWorkspace({ ...BASE, dir: 'ws', agents: [] }, unchecked.deps);
      expect(result.checked).toBe(false);
    } finally {
      rmSync(failing.root, { recursive: true, force: true });
      rmSync(unchecked.root, { recursive: true, force: true });
    }
  });

  it('starts from an empty .env when the setup did not write one', async () => {
    const s = scene();
    try {
      const deps: NewDeps = { ...s.deps, run: () => 0 };
      await newWorkspace({ ...BASE, dir: 'ws', agents: [] }, deps);
      expect(readFileSync(path.join(s.root, 'ws', '.env'), 'utf8')).toBe('CHOL_AGENTS_PROVIDER=auto\n');
    } finally {
      rmSync(s.root, { recursive: true, force: true });
    }
  });
});

describe('formatSummary', () => {
  it('says where the workspace is and what to run next', () => {
    const ready = formatSummary({
      dir: '/ws',
      provider: 'auto',
      agents: ['product-owner'],
      newAgent: undefined,
      checked: true,
    });
    expect(ready).toContain('Pasta de trabalho pronta: /ws\nProvider: auto. Agentes: product-owner.');
    expect(ready).toContain('bunx choliba product-owner --project minha-app');
    expect(ready).not.toContain('Agente novo');

    const bare = formatSummary({ dir: '/ws', provider: 'claude', agents: [], newAgent: undefined, checked: false });
    expect(bare).toContain('criada, mas o `choliba check` apontou o que corrigir');
    expect(bare).toContain('Agentes: nenhum.');
    expect(bare).toContain('bunx choliba --help');
  });
});
