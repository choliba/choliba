import { environment } from '../../execute/process';
import { homeOf, join, xdgDir } from '../../filesystem/index';

/**
 * Directories where host CLIs keep credentials, cache and policy files.
 * The sandbox filesystem is otherwise read-only.
 */
export function hostStateDirs(
  env: NodeJS.ProcessEnv = environment(),
): readonly string[] {
  const home = homeOf(env);

  return [
    xdgDir(env, 'XDG_CONFIG_HOME'),
    xdgDir(env, 'XDG_CACHE_HOME'),
    xdgDir(env, 'XDG_DATA_HOME'),
    join(home, '.cursor'),
    join(home, '.codex'),
    join(home, '.claude'),
    join(home, '.claude.json'),
  ];
}
