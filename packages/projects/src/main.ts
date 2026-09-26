#!/usr/bin/env bun
import { findWorkspaceRoot } from '@choliba/core/config';
import { writeStderr, writeStdout } from '@choliba/terminal/output';

import { runProjectsCli } from './cli';
import { resolveLocations } from './locations';
import { projectTemplatesDir } from './ticket-template';

const workspaceRoot = findWorkspaceRoot(process.cwd());

process.exitCode = runProjectsCli(process.argv, {
  loadConfig: () => resolveLocations(workspaceRoot),
  templatesDir: projectTemplatesDir(),
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
