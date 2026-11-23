import { env } from '../src/config/index';

/**
 * The rounds' folders, from the .env (see .env.example). Each one unset stays
 * `undefined`: the config loads without them, and only the rounds' commands
 * ask for them (requireRounds), saying which are missing.
 */
export const roundsConfig = {
  dir: env.string('CHOLIBA_ROUNDS_DIR'),
  definitions: env.string('CHOLIBA_ROUNDS_DEFINITIONS'),
  fixtures: env.string('CHOLIBA_ROUNDS_FIXTURES'),
  data: env.string('CHOLIBA_ROUNDS_DATA'),
};
