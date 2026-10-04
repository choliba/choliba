import { isAbsolute, join } from 'node:path';

/** Where `playwright cli` writes the files it names itself, unless `CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR` says otherwise. */
export const DEFAULT_OUTPUT_DIR = '.cache/playwright-cli';

const FILENAME = '--filename';

function inside(outputDir: string, file: string): string {
  return isAbsolute(file) ? file : join(outputDir, file);
}

/**
 * `argv` of `playwright cli` with a relative `--filename` (`--filename=x` or `--filename x`) moved into
 * `outputDir`. The CLI only puts the files it names itself there: a name an agent chooses would land in
 * the workspace root, where the command runs.
 */
export function intoOutputDir(argv: readonly string[], outputDir: string): readonly string[] {
  return argv.map((arg, index) => {
    if (arg.startsWith(`${FILENAME}=`)) {
      return `${FILENAME}=${inside(outputDir, arg.slice(FILENAME.length + 1))}`;
    }
    return argv[index - 1] === FILENAME ? inside(outputDir, arg) : arg;
  });
}
