import { defineConfig } from '@choliba/config';

/** The sandbox group's keys: where providers run and how a container reaches the host. */
export const sandboxConfig = defineConfig('sandbox', {
  mode: {
    env: 'CHOL_SANDBOX',
    type: 'string',
    description: 'onde o provider roda',
    values: ['local', 'docker'],
    default: 'local',
  },
  image: {
    env: 'CHOL_SANDBOX_IMAGE',
    type: 'string',
    description: 'imagem do sandbox docker',
    default: 'choliba-agent',
  },
  network: {
    env: 'CHOL_NETWORK',
    type: 'string',
    description: 'a rede do container',
    values: ['isolated', 'host'],
    default: 'isolated',
  },
});
