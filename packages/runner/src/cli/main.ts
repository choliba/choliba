#!/usr/bin/env bun
import path from 'node:path';

import { runTestsCli } from './run-tests';

const packageRoot = path.join(import.meta.dirname, '..', '..');
const monorepoRoot = path.join(packageRoot, '..', '..');

const result = await runTestsCli({
  argv: process.argv.slice(2),
  packageRoot,
  monorepoRoot,
});
process.exit(result.exitCode);
