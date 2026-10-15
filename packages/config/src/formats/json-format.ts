import { ConfigError, type ConfigFormat } from '../common';
import { configTree } from './config-tree';

/** JSON, read by path. */
export const json: ConfigFormat = {
  name: 'json',
  extensions: ['.json'],
  layout: 'nested',
  parse: (text, file) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new ConfigError(`${file} não é um JSON válido: ${(error as Error).message}`, { cause: error });
    }
    return configTree(parsed, file);
  },
};
