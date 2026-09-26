#!/usr/bin/env bun
import path from 'node:path';

import { writeStderr, writeStdout } from '@choliba/terminal/output';

import { runProjectsCli } from './cli';
import { resolveLocations } from './locations';

const repoRoot = path.join(import.meta.dirname, '..', '..', '..');
const templatesDir = path.join(import.meta.dirname, '..', 'templates', 'project');

process.exitCode = runProjectsCli(process.argv, {
  loadConfig: () => resolveLocations(repoRoot),
  templatesDir,
  stdout: {
    write(chunk) {
      writeStdout(chunk);
    },
  },
  stderr: {
    write(chunk) {
      writeStderr(chunk);
    },
  },
});
