import { install, parseInstallArgs, resolveAgentsDir, resolveMcpsDir, resolveSkillsDir } from '@choliba/agents';
import { CONFIG, entryHelp, PLATFORM, type CommandEntry, type ShellCommand, type Suggestions } from '@choliba/core';

import { RUNTIME } from '../runtime';

/** Completes file names. */
const FILES = (): Suggestions => ({ kind: 'files' });

/** How `choliba --help` lists `add`, and its own `--help`. */
const ENTRY: CommandEntry = {
  name: 'add',
  description:
    'Instala um agente (com suas skills e MCPs), uma skill ou um MCP de uma pasta, repositório git ou pacote npm',
  group: 'Commands',
  spec: {
    usage: 'choliba add <origem> [OPTIONS]',
    positionals: FILES,
    flags: [
      {
        name: '--path',
        value: { name: 'caminho', suggest: FILES },
        description: 'Item dentro da origem (ex.: .choliba/agents/test-writer)',
      },
      { name: '--dry-run', description: 'Mostra o que instalaria, sem gravar' },
    ],
  },
};

/**
 * `choliba add <origem> [--path P] [--dry-run]`: an agent (with its skills and MCPs), a skill or an MCP, into the
 * workspace the command runs in. A relative local origin counts from where the command runs; an npm package is
 * fetched with `bun add`.
 */
export const addCommand: ShellCommand = {
  name: 'add',
  help: () => [ENTRY],
  run: (container, io) => {
    const args = io.args('add');
    if (io.wantsHelp(args)) {
      io.printHelp(entryHelp(ENTRY));
      return Promise.resolve();
    }
    const parsed = parseInstallArgs(args);
    const config = container.get(CONFIG);
    const runtime = container.get(RUNTIME);
    const root = config.workspaceRoot();
    const values = config.load(root);
    const report = install(parsed, {
      workspaceRoot: root,
      config: values,
      targets: {
        agentsDir: resolveAgentsDir(undefined, values, root),
        skillsDir: resolveSkillsDir(values, root),
        mcpsDir: resolveMcpsDir(values, root),
      },
      source: {
        cwd: config.startDir(),
        git: container.get(PLATFORM).git,
        bunAdd: (project, spec) => runtime.capture('bun', ['add', spec], project),
      },
    });
    io.write(`${report}\n`);
    return Promise.resolve();
  },
};
