import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { Inject, Injectable } from '@nestjs/common';

import { locateResource, WHICH, type Which, RUNTIME } from '@choliba/core';
import { ConfigService } from '@choliba/core/nest';

import type { Runtime } from '../runtime/interfaces/runtime.interface';

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The Node tools choliba ships (ESLint, Prettier), run in the workspace with the terminal attached. */
@Injectable()
export class ToolsService {
  constructor(
    @Inject(RUNTIME) private readonly runtime: Runtime,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(WHICH) private readonly which: Which,
  ) {}

  /** `choliba lint`: ESLint, with the workspace's own eslint.config.* or, without one, the config shipped here. */
  lint(args: readonly string[]): number {
    const root = this.config.workspaceRoot();
    const hasConfig = readdirSync(root).some((file) => /^eslint\.config\.[cm]?[jt]s$/.test(file));
    const shipped = locateResource('eslint.js', this.runtime.entryDir);
    const config = hasConfig || shipped === undefined ? [] : ['--config', shipped];
    return this.runBin('eslint', 'eslint', [...config, ...(args.length === 0 ? ['.'] : args)], root);
  }

  /** `choliba format [--write] [paths…]`: Prettier checks the workspace, or fixes it with --write. */
  format(args: readonly string[]): number {
    const write = args.includes('--write');
    const paths = args.filter((arg) => arg !== '--write');
    const mode = write ? '--write' : '--check';
    return this.runBin(
      'prettier',
      'prettier',
      [mode, ...(paths.length === 0 ? ['.'] : paths)],
      this.config.workspaceRoot(),
    );
  }

  private node(): string {
    return this.which('node') ?? this.runtime.execPath;
  }

  private runBin(dependency: string, bin: string, args: readonly string[], cwd: string): number {
    return this.runtime.run(this.node(), [this.binOf(dependency, bin), ...args], cwd);
  }

  /** The executable a dependency of this package declares as `bin` (resolved from its package.json). */
  private binOf(dependency: string, bin: string): string {
    const manifest = this.runtime.resolve(`${dependency}/package.json`);
    const declared: unknown = JSON.parse(readFileSync(manifest, 'utf8'));
    const bins = isRecord(declared) ? declared['bin'] : undefined;
    const relative = typeof bins === 'string' ? bins : isRecord(bins) ? bins[bin] : undefined;
    if (typeof relative !== 'string') throw new Error(`${dependency} não declara o executável ${bin}.`);
    return join(dirname(manifest), relative);
  }
}
