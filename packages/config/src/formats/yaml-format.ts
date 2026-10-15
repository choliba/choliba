import { parse } from 'yaml';

import { ConfigError, type ConfigFormat } from '../common';
import { configTree } from './config-tree';

/** YAML, read by path. */
export const yaml: ConfigFormat = {
  name: 'yaml',
  extensions: ['.yaml', '.yml'],
  layout: 'nested',
  parse: (text, file) => {
    let parsed: unknown;
    try {
      parsed = parse(text);
    } catch (error) {
      throw new ConfigError(`${file} não é um YAML válido: ${(error as Error).message}`, { cause: error });
    }
    return configTree(parsed, file);
  },
};
