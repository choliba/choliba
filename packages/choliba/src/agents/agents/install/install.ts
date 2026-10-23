import { unknownWordMessage } from '@choliba/shell';
import {
  install as runInstall,
  InstallError,
  planInstall as planEngineInstall,
  type InstallArgs,
  type InstallDeps as EngineInstallDeps,
} from '@choliba/engine';

import { loadAgent } from '../agent-loader';

export { formatInstall, InstallError } from '@choliba/engine';
export type { InstallArgs, InstallTargets, InstalledItem, ItemKind, PlannedItem } from '@choliba/engine';

export type InstallDeps = Omit<EngineInstallDeps, 'loadAgent'>;

const USAGE = 'Uso: choliba add <origem> [--path <caminho na origem>] [--dry-run]';

/** `--path=x`, or `--path x` (the value taken from `queue`). */
function pathValue(arg: string, queue: string[]): string {
  if (arg.startsWith('--path=')) return arg.slice('--path='.length);
  const value = queue.shift();
  if (value === undefined || value.startsWith('-')) throw new InstallError(`--path precisa de um valor. ${USAGE}`);
  return value;
}

export function parseInstallArgs(argv: readonly string[]): InstallArgs {
  const specs: string[] = [];
  let path: string | undefined;
  let dryRun = false;
  const queue = [...argv];
  let arg: string | undefined;
  while ((arg = queue.shift()) !== undefined) {
    if (arg === '--path' || arg.startsWith('--path=')) {
      path = pathValue(arg, queue);
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg.startsWith('-')) {
      throw new InstallError(`${unknownWordMessage('opção desconhecida', arg, ['--path', '--dry-run'])} ${USAGE}`);
    } else {
      specs.push(arg);
    }
  }
  const [spec] = specs;
  if (spec === undefined) throw new InstallError(USAGE);
  if (specs.length > 1) throw new InstallError(`instale uma origem só por vez (recebi ${specs.join(', ')}). ${USAGE}`);
  return { spec, ...(path === undefined ? {} : { path }), dryRun };
}

export function planInstall(
  target: string,
  searchUpTo: string,
  shownAs: string = target,
): ReturnType<typeof planEngineInstall> {
  return planEngineInstall(target, searchUpTo, shownAs, loadAgent);
}

export function install(args: InstallArgs, deps: InstallDeps): string {
  return runInstall(args, { ...deps, loadAgent });
}
