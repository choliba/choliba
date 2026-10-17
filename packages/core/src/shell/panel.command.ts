import type { CommandSpec } from '../help';
import { openOpenTuiPanel, visibleWidth, type ArtPixels, type ChatPanel, type PanelOptions } from '../terminal';
import { token, type Container } from './container';
import { PANEL_COMMANDS, PANEL_STARTS, PLATFORM } from './create-shell';
import type { PanelCommand, ShellCommand } from './interfaces/shell.interface';
import { panelSession, type PanelSession } from './panel-session';

/** Opens a panel, or gives nothing where it cannot (`openOpenTuiPanel`); a spec puts a fake one in its place. */
export const PANEL_OPENER = token<(options: PanelOptions) => Promise<ChatPanel | undefined>>('PanelOpener');

/** The icon an app shows in the header, by its pixels (`pixelMap`); without it, the header's lines alone. */
export const PANEL_ICON = token<ArtPixels>('PanelIcon');

/** The version an app shows in a corner of the welcome (`choliba 0.0.1-dev.62+1a2b3c4`); without it, none. */
export const PANEL_VERSION = token<string>('PanelVersion');

/** The image an app shows in the center of the empty panel, above the welcome; without it, the welcome alone. */
export const PANEL_LOGO = token<string>('PanelLogo');

const PANEL_HINT = 'Digite uma mensagem ou / para os comandos';

/** How to leave the panel, on the right of the footer. */
const LEAVE = '\u001b[90mCtrl+C duas vezes sai\u001b[39m';

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

export const PANEL_SPEC: CommandSpec = {
  usage: 'choliba panel',
  description:
    'Abre o painel interativo do choliba no terminal: as boas-vindas com o logo e, depois do Enter, um campo cujo ' +
    'texto aparece na caixa.',
  examples: [{ description: 'Abre o painel', command: 'choliba panel' }],
  details:
    'O painel abre com as boas-vindas: Enter mostra o campo, e Esc sai. No campo, `/` lista os comandos do painel ' +
    '(`/projects` escolhe o projeto e já pergunta o ticket, `/tickets` troca o ticket, `/agents` o agente), e o que eles escolhem aparece no ' +
    'cabeçalho, em quadros que o Ctrl+P (projeto), o Ctrl+A (agente) ou um clique recolhem. Com o agente, o ' +
    'cabeçalho mostra o provider e o modelo que uma execução usaria, e a linha de status o modo; `/provider`, ' +
    '`/model` e `/mode` os escolhem para a sessão, e o Shift+Tab alterna o modo. Desde o início, o quadro do sandbox ' +
    '(Ctrl+S) mostra onde o provider roda (o de CHOL_SANDBOX) e o que a execução do agente monta, e `/sandbox` o ' +
    'troca para a sessão. Uma mensagem sem `/` é a tarefa ' +
    'do agente: ele roda no painel com essas escolhas (sem ticket, um agente de tickets pergunta o tipo do ticket ' +
    'novo que a execução cria), o que se envia enquanto roda vai para ele, e as perguntas ' +
    'dele aparecem no campo. Ctrl+C duas vezes para a execução; sem nada rodando, sai do painel. `/clear` para o ' +
    'que roda e limpa o contexto (projeto, ticket e agente) e a conversa. ' +
    'Precisa de um terminal interativo.',
  flags: [{ name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true }],
};

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
    const panel =
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
    if (panel === undefined) {
      io.fail('erro: o painel precisa de um terminal interativo.');
      return;
    }
    session.current = panelSession(
      container,
      panel,
      container.get(PANEL_COMMANDS),
      heading,
      container.get(PANEL_STARTS),
    );
    await new Promise<void>((resolve) => {
      // Ctrl+C twice stops what runs first (a run of an agent); with nothing running, it closes the panel.
      panel.onInterrupt(() => {
        if (session.current?.stop() === true) return;
        panel.close();
        resolve();
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

/** The panel's opener, `openOpenTuiPanel`, built when `choliba panel` asks for it. */
export function providePanel(container: Container): void {
  container.provide(PANEL_OPENER, () => openOpenTuiPanel);
}
