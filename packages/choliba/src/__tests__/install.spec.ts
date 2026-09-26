import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { formatInstall, install, parseInstallArgs, planInstall, type InstallTargets } from '../install';

const FIXTURES = join(__dirname, '..', '..', '..', 'agents', 'src', '__tests__', 'fixtures');

/**
 * A source laid out like the choliba repo — `agents/echo` (declaring the skill `dummy-skill`, a skill
 * `ausente` that is not there and the MCP `with-var`), `agents/with-phases`, `.agents/skills/dummy-skill`
 * and `.agents/mcps/with-var.json` — and an empty workspace.
 */
function withSource(run: (source: string, workspace: string, targets: InstallTargets) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'install-'));
  const source = join(dir, 'src');
  cpSync(join(FIXTURES, 'agents', 'echo'), join(source, 'agents', 'echo'), { recursive: true });
  cpSync(join(FIXTURES, 'agents', 'with-phases'), join(source, 'agents', 'with-phases'), { recursive: true });
  cpSync(join(FIXTURES, 'skills', 'dummy-skill'), join(source, '.agents', 'skills', 'dummy-skill'), {
    recursive: true,
  });
  mkdirSync(join(source, '.agents', 'mcps'), { recursive: true });
  cpSync(join(FIXTURES, 'mcps', 'with-var.json'), join(source, '.agents', 'mcps', 'with-var.json'));
  const yaml = join(source, 'agents', 'echo', 'agent.yaml');
  writeFileSync(
    yaml,
    readFileSync(yaml, 'utf8').replace(
      '  - dummy-skill\n',
      '  - dummy-skill\n  - ausente\nmcps:\n  - with-var\n  - sem-json\n',
    ),
  );
  const workspace = join(dir, 'ws');
  mkdirSync(workspace);
  const targets = {
    agentsDir: join(workspace, 'app', 'agents'),
    skillsDir: join(workspace, 'app', '.agents', 'skills'),
    mcpsDir: join(workspace, 'app', '.agents', 'mcps'),
  };
  return run(source, workspace, targets).finally(() => {
    rmSync(dir, { recursive: true, force: true });
  });
}

describe('parseInstallArgs', () => {
  it('reads the source, --path in both forms and --dry-run', () => {
    expect(parseInstallArgs(['./x'])).toEqual({ spec: './x', dryRun: false });
    expect(parseInstallArgs(['repo', '--path', 'agents/dev', '--dry-run'])).toEqual({
      spec: 'repo',
      path: 'agents/dev',
      dryRun: true,
    });
    expect(parseInstallArgs(['--path=agents/dev', 'repo'])).toMatchObject({ spec: 'repo', path: 'agents/dev' });
  });

  it('refuses no source, two sources, --path without a value and an unknown flag', () => {
    expect(() => parseInstallArgs([])).toThrow('choliba install <origem>');
    expect(() => parseInstallArgs(['a', 'b'])).toThrow('uma origem só');
    expect(() => parseInstallArgs(['a', '--path'])).toThrow('--path precisa de um valor');
    expect(() => parseInstallArgs(['a', '--force'])).toThrow('--force');
  });
});

describe('planInstall', () => {
  it('takes an agent with the skills and MCPs it declares that the source has, warning about the rest', async () => {
    await withSource(async (source) => {
      const plan = await planInstall(join(source, 'agents', 'echo'), '/');

      expect(plan.items.map((item) => `${item.kind} ${item.name}`)).toEqual([
        'agente echo',
        'skill dummy-skill',
        'MCP with-var',
      ]);
      expect(plan.warnings).toEqual([
        'a skill "ausente", que o agente echo declara, não está na origem: instale à parte.',
        'o MCP "sem-json", que o agente echo declara, não está na origem: instale à parte.',
      ]);
    });
  });

  it('takes an agent with phases, and a skill or an MCP alone', async () => {
    await withSource(async (source) => {
      expect((await planInstall(join(source, 'agents', 'with-phases'), source)).items).toHaveLength(1);
      expect((await planInstall(join(source, '.agents', 'skills', 'dummy-skill'), source)).items[0]).toMatchObject({
        kind: 'skill',
        name: 'dummy-skill',
      });
      expect((await planInstall(join(source, '.agents', 'mcps', 'with-var.json'), source)).items[0]).toMatchObject({
        kind: 'MCP',
        name: 'with-var',
      });
    });
  });

  it('refuses what is not an item, listing what the source has for --path', async () => {
    await withSource(async (source) => {
      await expect(planInstall(source, source)).rejects.toThrow(
        [
          `${source} não é um agente (agent.yaml), uma skill (SKILL.md) nem um MCP (.json). Escolha um com --path:`,
          '  agents/echo',
          '  agents/with-phases',
          '  .agents/skills/dummy-skill',
          '  .agents/mcps/with-var.json',
        ].join('\n'),
      );
      await expect(planInstall(join(source, 'nada'), source)).rejects.toThrow('nenhum item no formato do choliba');
    });
  });

  it('refuses an item that breaks its format, naming the file', async () => {
    await withSource(async (source) => {
      writeFileSync(join(source, 'agents', 'echo', 'agent.yaml'), 'id: x\n');
      writeFileSync(join(source, '.agents', 'skills', 'dummy-skill', 'SKILL.md'), '# sem frontmatter\n');
      writeFileSync(join(source, '.agents', 'mcps', 'with-var.json'), '{}');

      await expect(planInstall(join(source, 'agents', 'echo'), source)).rejects.toThrow('agent.yaml');
      await expect(planInstall(join(source, '.agents', 'skills', 'dummy-skill'), source)).rejects.toThrow('SKILL.md');
      await expect(planInstall(join(source, '.agents', 'mcps', 'with-var.json'), source)).rejects.toThrow(
        'falta "command" ou "url"',
      );
    });
  });

  it('refuses an item whose name is not a valid agent, skill or MCP name', async () => {
    await withSource(async (source) => {
      cpSync(join(source, 'agents', 'echo'), join(source, 'agents', 'Echo'), { recursive: true });

      await expect(planInstall(join(source, 'agents', 'Echo'), source)).rejects.toThrow('nome inválido "Echo"');
    });
  });
});

describe('install', () => {
  const noSource = {
    cwd: '/',
    git: { run: () => ({ status: 1, stdout: '', stderr: '' }) },
    bunAdd: () => ({ status: 1, stderr: '' }),
  };

  it('copies the agent and what it brings into the workspace, replacing what was there, and reports it', async () => {
    await withSource(async (source, workspace, targets) => {
      mkdirSync(join(targets.agentsDir, 'echo'), { recursive: true });
      writeFileSync(join(targets.agentsDir, 'echo', 'velho.md'), 'x');

      const text = await install(
        { spec: join(source, 'agents', 'echo'), dryRun: false },
        { workspaceRoot: workspace, targets, config: { SERVER_DIR: undefined }, source: noSource },
      );

      expect(existsSync(join(targets.agentsDir, 'echo', 'agent.yaml'))).toBe(true);
      expect(existsSync(join(targets.agentsDir, 'echo', 'velho.md'))).toBe(false);
      expect(existsSync(join(targets.skillsDir, 'dummy-skill', 'SKILL.md'))).toBe(true);
      expect(existsSync(join(targets.mcpsDir, 'with-var.json'))).toBe(true);
      expect(text).toContain('  agente echo → app/agents/echo');
      expect(text).toContain('  MCP with-var → app/.agents/mcps/with-var.json');
      expect(text).toContain('o MCP with-var usa ${SERVER_DIR}, sem valor no .env: defina antes de rodar o agente.');
      expect(text).toContain('Confira com: choliba check');
    });
  });

  it('writes nothing on --dry-run, and cleans the fetched source up even when the install fails', async () => {
    await withSource(async (source, workspace, targets) => {
      const dry = await install(
        { spec: source, path: 'agents/echo', dryRun: true },
        { workspaceRoot: workspace, targets, config: { SERVER_DIR: '/s' }, source: noSource },
      );
      expect(dry).toContain('Instalaria (--dry-run, nada foi gravado)');
      expect(dry).not.toContain('SERVER_DIR');
      expect(existsSync(targets.agentsDir)).toBe(false);

      const cleaned: string[] = [];
      const fetch = (): { root: string; searchUpTo: string; cleanup: () => void } => ({
        root: source,
        searchUpTo: source,
        cleanup: () => cleaned.push('ok'),
      });
      await expect(
        install(
          { spec: 'x', dryRun: false },
          { workspaceRoot: workspace, targets, config: {}, source: noSource, fetch },
        ),
      ).rejects.toThrow(/^x não é um agente .* Escolha um com --path:/);
      expect(cleaned).toEqual(['ok']);
    });
  });

  it('formats a plan with no warnings', () => {
    expect(
      formatInstall('/w', [{ kind: 'skill', name: 's', from: '/o/s', to: '/w/app/.agents/skills/s' }], [], false),
    ).toBe(['Instalado:', '  skill s → app/.agents/skills/s', '', 'Confira com: choliba check'].join('\n'));
  });
});
