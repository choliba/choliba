import * as layout from '../../layout/workspace-layout';

describe('workspace layout', () => {
  it('names the folders and files at the workspace root', () => {
    expect(layout).toEqual({
      APP_DIR: 'app',
      LOGS_DIR: '.cache/logs',
      APP_LOGS_DIR: '.cache/app',
      ARTIFACTS_DIR: '.cache/choliba',
      ENV_FILE: '.env',
      PACKAGE_FILE: 'package.json',
      ENV_EXAMPLE_FILE: '.env.example',
      GITIGNORE_FILE: '.gitignore',
      BUNFIG_FILE: 'bunfig.toml',
      PRETTIERRC_FILE: '.prettierrc.json',
      PRETTIERIGNORE_FILE: '.prettierignore',
      ESLINT_CONFIG_FILE: 'eslint.config.mjs',
      EDITORCONFIG_FILE: '.editorconfig',
    });
  });
});
