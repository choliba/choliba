import { env } from '../src/config/index';

/** CHOLIBA_DEBUG=1 (or true) turns on debug and the log at debug level. */
export const appConfig = {
  debug: env.boolean('CHOLIBA_DEBUG', { default: false }),
};
