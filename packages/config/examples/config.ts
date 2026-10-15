import { defineConfig, fileSource } from 'choliba/config';

const applicationConfig = defineConfig('application', {
  name: {
    env: 'EXAMPLE_NAME',
    type: 'string',
    description: 'Name shown by the application',
  },
  port: {
    env: 'EXAMPLE_PORT',
    path: ['server', 'port'],
    type: 'number',
    description: 'Port listened on by the application',
    default: 3000,
  },
});

const config = applicationConfig.read([fileSource('.env'), fileSource('settings.yaml')]);

process.stdout.write(`${JSON.stringify(config)}\n`);
