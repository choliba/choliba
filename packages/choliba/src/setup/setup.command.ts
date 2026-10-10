import { CONFIG, entryHelp, PLATFORM, type CommandEntry, type ShellCommand } from '@choliba/core';

import { RUNTIME } from '../runtime';
import { setup, setupWorkspace, updatePackageWhenListed } from './setup';

/** How `choliba --help` lists `setup`, and its own `--help`. */
const ENTRY: CommandEntry = {
  name: 'setup',
  description: 'Liga o autocomplete no bash (roda sozinho ao instalar com --trust)',
  group: 'Commands',
  spec: { usage: 'choliba setup' },
};

/**
 * `choliba setup`, also the postinstall: the workspace structure, bash completion and what to do next.
 * `--deferred` is its second half, run in the background once `bun add` has written package.json.
 */
export const setupCommand: ShellCommand = {
  name: 'setup',
  help: () => [ENTRY],
  run: async (container, io) => {
    const args = io.args('setup');
    if (io.wantsHelp(args)) {
      io.printHelp(entryHelp(ENTRY));
      return;
    }
    const runtime = container.get(RUNTIME);
    const cwd = container.get(CONFIG).startDir();
    if (args.includes('--deferred')) {
      await updatePackageWhenListed(cwd, (ms) => runtime.sleep(ms));
      return;
    }
    const message = `${setup(runtime.home, cwd, () => {
      // Outlives the postinstall: finishes once `bun add` has written package.json.
      runtime.spawnDetached([runtime.execPath, runtime.script, 'setup', '--deferred'], setupWorkspace(cwd));
    })}\n`;
    // Bun hides a postinstall's output; the terminal itself still shows what is written to it.
    if (container.get(PLATFORM).env['npm_lifecycle_event'] === 'postinstall' && runtime.writeTerminal(message)) return;
    io.write(message);
  },
};
