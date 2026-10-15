/**
 * A configuration that cannot be read or written as asked: a value that does not convert, an unknown key, two groups
 * claiming one variable. Its message is for the person running the program, in Portuguese.
 */
export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}
