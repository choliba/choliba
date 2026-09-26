#!/usr/bin/env bun
import { findWorkspaceRoot } from '@choliba/core/config';

import { findRunnerRoot } from '../runner-root';
import { runTestsCli } from './run-tests';

const result = await runTestsCli({
  argv: process.argv.slice(2),
  packageRoot: findRunnerRoot(),
  monorepoRoot: findWorkspaceRoot(process.cwd()),
});
process.exit(result.exitCode);
