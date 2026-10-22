import type { Container } from '@choliba/kernel';
import {
  PANEL_COMMANDS,
  PANEL_STARTS,
  PLATFORM,
  visibleWidth,
  WORKSPACE_ROOT,
  type PanelCommand,
  type ShellCommand,
} from '@choliba/shell';

import { openOpenTuiPanel, PANEL_ICON, PANEL_LOGO, PANEL_OPENER, PANEL_SPEC, PANEL_VERSION } from '../panel';
import { loggedPanel, openPanelLog } from './panel-log';
import { panelSession, type PanelSession } from './panel-session';

const PANEL_HINT = 'Digite uma mensagem ou / para os comandos';

/** How to leave the panel, on the right of the footer. */
const LEAVE = '\u001b[90mCtrl+C duas vezes sair\u001b[39m';

/** What goes between two parts of the footer. */
const FOOTER_SEPARATOR = '\u001b[90m · \u001b[39m';

/** The footer's margin on each side, in columns. */
const FOOTER_MARGIN = 2;

/**
 * The footer's line in `width` columns: what the session's commands put in it on the left, how to leave on the right;
 * one after the other when they do not fit apart.
 */
function footerLine(parts: readonly string[], width: number): string {
  const margin = ' '.repeat(FOOTER_MARGIN);
  const left = parts.join(FOOTER_SEPARATOR);
  const gap = width - 2 * FOOTER_MARGIN - visibleWidth(left) - visibleWidth(LEAVE);
  if (gap < FOOTER_MARGIN) return `${margin}${[...parts, LEAVE].join(FOOTER_SEPARATOR)}`;
  return `${margin}${left}${' '.repeat(gap)}${LEAVE}`;
}

/** `path` with the home folder as `~`, as a prompt shows it. */
function shortPath(path: string, home: string | undefined): string {
  return home !== undefined && home !== '' && (path === home || path.startsWith(`${home}/`))
    ? `~${path.slice(home.length)}`
    : path;
}

/** The welcome under the logo, in the center of the panel, until Enter. */
const WELCOME = [
  '\u001b[1m\u001b[32mBem-vindo ao choliba\u001b[39m\u001b[22m',
  '',
  'Tecle Enter para começar ou Esc para sair.',
];

const PANEL_DESCRIPTION = 'Abre o painel interativo do choliba no terminal.';

/** `choliba panel`: opens the panel on its own, empty, until Ctrl+C. */
export const panelCommand: ShellCommand = {
  name: 'panel',
  help: () => [{ name: 'panel', description: PANEL_DESCRIPTION, group: 'Commands', spec: PANEL_SPEC }],
  async run(container, io) {
    const args = io.args('panel');
    if (io.wantsHelp(args)) {
      io.printHelp(PANEL_SPEC);
      return;
    }
    if (args.length > 0) {
      io.usageError(`argumento a mais: ${args.join(' ')}.`, 'choliba panel');
      return;
    }
    // The box's title, once the welcome closes, and the welcome's corner say the version the app gives.
    const version = container.has(PANEL_VERSION) ? container.get(PANEL_VERSION) : undefined;
    const logo = container.has(PANEL_LOGO) ? container.get(PANEL_LOGO) : undefined;
    const { cwd, env } = container.get(PLATFORM);
    const home = env['HOME'];
    // The footer says what the session's commands put in it, once there is a session, and how to leave.
    const session: { current?: PanelSession } = {};
    const heading = [
      `\u001b[1m\u001b[32m${version ?? 'choliba'}\u001b[39m\u001b[22m`,
      `\u001b[90m${shortPath(cwd, home)}\u001b[39m`,
    ];
    const opened =
      container.get(PLATFORM).stdout.isTTY === true
        ? await container.get(PANEL_OPENER)({
            title: version ?? 'choliba',
            titleColor: 'green',
            footer: (width) => [footerLine(session.current?.status() ?? [], width)],
            hint: PANEL_HINT,
            splash: {
              ...(logo === undefined ? {} : { image: logo }),
              lines: WELCOME,
              ...(version === undefined ? {} : { note: version }),
            },
            header: {
              ...(container.has(PANEL_ICON) ? { icon: container.get(PANEL_ICON) } : {}),
              lines: heading,
            },
          })
        : undefined;
    if (opened === undefined) {
      io.fail('erro: o painel precisa de um terminal interativo.');
      return;
    }
    // The session's log, in the workspace's .cache/logs/painel: all that goes through the panel, as it goes.
    const panel = loggedPanel(
      opened,
      openPanelLog(
        container.get(WORKSPACE_ROOT),
        [`choliba painel ${version ?? ''}`.trimEnd(), `pasta: ${cwd}`],
        container.get(PLATFORM).clock,
      ),
    );
    await new Promise<void>((resolve) => {
      const leave = (): void => {
        panel.close();
        resolve();
      };
      session.current = panelSession(
        container,
        panel,
        container.get(PANEL_COMMANDS),
        heading,
        container.get(PANEL_STARTS),
        leave,
      );
      // What the modules' starts put in the status line came before the session was here to give it: draw it now.
      panel.refresh();
      // Ctrl+C twice stops what runs first (a run of an agent); with nothing running, it closes the panel. So does /quit.
      panel.onInterrupt(() => {
        if (session.current?.stop() === true) return;
        leave();
      });
    });
  },
};

/** `/clear`: stops what runs, forgets the session's context, and empties the conversation. */
export const clearPanelCommand: PanelCommand = {
  name: 'clear',
  description: 'Para o que roda e limpa o contexto e a conversa',
  run: ({ panel, context }) => {
    context.clear();
    panel.clear();
    return Promise.resolve();
  },
};

/** `/quit`: closes the panel, once what runs (a run of an agent, the steps after it) has stopped and ended. */
export const quitPanelCommand: PanelCommand = {
  name: 'quit',
  description: 'Sai do painel, depois de parar e esperar o que roda',
  run: ({ context }) => context.quit(),
};

/** The panel's opener, `openOpenTuiPanel`, built when `choliba panel` asks for it. */
export function providePanel(container: Container): void {
  container.provide(PANEL_OPENER, () => openOpenTuiPanel);
}
