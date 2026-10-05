const USAGE = 'Usage: choliba terminal run --label <name> [--timestamps] -- <command...>';

/** `terminal run`, validated: what to run and how to label its lines. */
export class RunDto {
  constructor(
    readonly label: string,
    readonly command: readonly string[],
    readonly withTimestamp: boolean,
  ) {}
}

export function parseRunArgs(argv: readonly string[]): RunDto {
  const [subcommand, ...rest] = argv;
  if (subcommand !== 'run') {
    throw new Error(USAGE);
  }

  let label: string | undefined;
  let withTimestamp = false;
  let i = 0;
  while (i < rest.length && rest[i] !== '--') {
    const arg = rest[i];
    if (arg === '--label') {
      i += 1;
      label = rest[i];
    } else if (arg === '--timestamps') {
      withTimestamp = true;
    } else {
      throw new Error(`Unknown argument "${String(arg)}". ${USAGE}`);
    }
    i += 1;
  }

  if (label === undefined || label === '') {
    throw new Error(`Missing required --label <name>. ${USAGE}`);
  }
  if (rest[i] !== '--') {
    throw new Error(`Missing "--" separator before the command to run. ${USAGE}`);
  }

  const command = rest.slice(i + 1);
  if (command.length === 0) {
    throw new Error(`Missing command to run after "--". ${USAGE}`);
  }

  return new RunDto(label, command, withTimestamp);
}
