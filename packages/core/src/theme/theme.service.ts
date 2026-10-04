import { Inject, Injectable } from '@nestjs/common';

import { ConfigService } from '../config/config.service';
import type { Environment, WritableWithColumns } from '../platform/interfaces/platform.interface';
import { ENV, NO_COLOR_FLAG, STDOUT } from '../platform/platform.constants';
import type { AnsiColor } from './ansi';
import type { Theme, ThemeRole } from './interfaces/theme.interface';
import { resolveTheme } from './resolve-theme';

/**
 * The one place that decides whether choliba colors its output and with which colors. Read once, on first
 * use, so a command that never paints never reads the workspace's `.env`.
 */
@Injectable()
export class ThemeService {
  private theme: Theme | undefined;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(ENV) private readonly env: Environment,
    @Inject(STDOUT) private readonly stdout: WritableWithColumns,
    @Inject(NO_COLOR_FLAG) private readonly noColorFlag: boolean,
  ) {}

  private resolved(): Theme {
    const root = this.config.workspaceRootOrNothing();
    this.theme ??= resolveTheme(root === undefined ? this.env : this.config.load(root), {
      env: this.env,
      isTTY: this.stdout.isTTY === true,
      noColorFlag: this.noColorFlag,
    });
    return this.theme;
  }

  enabled(): boolean {
    return this.resolved().enabled;
  }

  paint(role: ThemeRole, name: string, text: string, declared?: AnsiColor): string {
    return this.resolved().paint(role, name, text, declared);
  }

  colorOf(role: ThemeRole, name: string, declared?: AnsiColor): AnsiColor {
    return this.resolved().colorOf(role, name, declared);
  }
}
