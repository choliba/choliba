import type { CommandSpec } from '../help';
import { openOpenTuiPanel, type ArtPixels, type ChatPanel, type PanelOptions } from '../terminal';
import { token, type Container } from './container';
import { PLATFORM } from './create-shell';
import type { ShellCommand } from './interfaces/shell.interface';

/** Opens a panel, or gives nothing where it cannot (`openOpenTuiPanel`); a spec puts a fake one in its place. */
export const PANEL_OPENER = token<(options: PanelOptions) => Promise<ChatPanel | undefined>>('PanelOpener');

/** The icon an app shows in the header, by its pixels (`pixelMap`); without it, the header's lines alone. */
export const PANEL_ICON = token<ArtPixels>('PanelIcon');

/** The version an app shows in a corner of the welcome (`choliba 0.0.1-dev.62+1a2b3c4`); without it, none. */
export const PANEL_VERSION = token<string>('PanelVersion');

/** The image an app shows in the center of the empty panel, above the welcome; without it, the welcome alone. */
export const PANEL_LOGO = token<string>('PanelLogo');

const PANEL_HINT = 'Digite uma mensagem';

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
    'O painel abre com as boas-vindas: Enter mostra o campo, e o que você envia nele aparece na caixa; Esc sai. ' +
    'Depois do Enter, sai com Ctrl+C duas vezes. Precisa de um terminal interativo.',
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
    const panel =
      container.get(PLATFORM).stdout.isTTY === true
        ? await container.get(PANEL_OPENER)({
            title: version ?? 'choliba',
            titleColor: 'green',
            footer: () => ['\u001b[90m  Ctrl+C duas vezes sai\u001b[39m'],
            hint: PANEL_HINT,
            splash: {
              ...(logo === undefined ? {} : { image: logo }),
              lines: WELCOME,
              ...(version === undefined ? {} : { note: version }),
            },
            header: {
              ...(container.has(PANEL_ICON) ? { icon: container.get(PANEL_ICON) } : {}),
              lines: [
                `\u001b[1m\u001b[32m${version ?? 'choliba'}\u001b[39m\u001b[22m`,
                `\u001b[90m${shortPath(cwd, home)}\u001b[39m`,
              ],
            },
          })
        : undefined;
    if (panel === undefined) {
      io.fail('erro: o painel precisa de um terminal interativo.');
      return;
    }
    panel.onMessage((text) => {
      panel.say(text);
    });
    await new Promise<void>((resolve) => {
      panel.onInterrupt(() => {
        panel.close();
        resolve();
      });
    });
  },
};

/** The panel's opener, `openOpenTuiPanel`, built when `choliba panel` asks for it. */
export function providePanel(container: Container): void {
  container.provide(PANEL_OPENER, () => openOpenTuiPanel);
}
