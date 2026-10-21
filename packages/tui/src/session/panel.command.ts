import { token, type Container } from '@choliba/kernel';
import {
  PANEL_COMMANDS,
  PANEL_STARTS,
  PLATFORM,
  visibleWidth,
  WORKSPACE_ROOT,
  type ArtPixels,
  type ChatPanel,
  type CommandSpec,
  type PanelCommand,
  type PanelOptions,
  type ShellCommand,
} from '@choliba/shell';

import { openOpenTuiPanel } from '../panel';
import { loggedPanel, openPanelLog } from './panel-log';
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

export const PANEL_SPEC: CommandSpec = {
  usage: 'choliba panel',
  description:
    'Abre o painel interativo do choliba no terminal: as boas-vindas com o logo e, depois do Enter, um campo cujo ' +
    'texto aparece na caixa.',
  examples: [{ description: 'Abre o painel', command: 'choliba panel' }],
  details: [
    'O painel abre com as boas-vindas: Enter mostra o campo, e Esc sai. No campo, `/` lista os comandos do painel. ' +
      'Um comando não se repete na conversa: o que ele escolhe, ele diz (`Projeto loja selecionado.`, ' +
      '`Agente test-writer adicionado.`). `/projects` escolhe o projeto e já pergunta o ticket, e `/tickets` troca o ' +
      'ticket.',
    'O que os comandos escolhem aparece no cabeçalho, em quadros que entram recolhidos e que o Ctrl+P (projeto) ou um ' +
      'clique abrem, por cima da conversa, e recolhem. Cada agente da sequência tem o seu quadro, ligado ao anterior ' +
      'por uma seta, com a borda esquerda na cor do agente: a primeira linha diz `aguardando`, `concluído` ou ' +
      '`falhou` com o tempo, e enquanto ele roda, uma barra e há quanto tempo; as outras, o provider e o modelo que ' +
      'ele usa e o ticket. Arrastar o quadro de um agente com o mouse e soltar sobre o de outro o põe no lugar dele, ' +
      'menos enquanto os agentes rodam. Sem espaço no cabeçalho, os quadros dos agentes estreitam.',
    '`/agents` acrescenta um agente ao fim da sequência: ele escolhe o provider, entre os que o agente declara, e ' +
      'depois o modelo, entre os que ele declara para esse provider; Esc em qualquer dos dois usa o do painel, e um ' +
      'agente que não pode rodar com eles não entra, e o painel diz por quê. Depois, `/agents` pergunta pelo ' +
      'próximo. Escolher um agente que já está na sequência troca só o provider e o modelo dele, menos o que roda ' +
      'agora. `/agents` nunca recomeça a sequência (`/clear` recomeça) e funciona enquanto ela roda: um agente ' +
      'acrescentado roda no fim, e um que espera roda com o que foi escolhido para ele.',
    'A coluna do cabeçalho mostra o provider e o modelo do painel, os dos agentes que não escolheram os seus: ' +
      '`/provider` os escolhe entre `auto` e todos os providers, e `/model` entre os modelos que os agentes declaram ' +
      'para ele e o padrão, em que cada agente roda o primeiro modelo que declara. A linha de status mostra o modo, que o Shift+Tab alterna e `/mode` escolhe ' +
      'entre os que o primeiro agente aceita, o sandbox onde o provider roda (o de CHOL_SANDBOX), que `/sandbox` ' +
      'troca para a sessão, e, enquanto um agente roda, há quanto tempo.',
    'Uma mensagem sem `/` é a tarefa do primeiro agente. Os seguintes rodam com a sua tarefa padrão, ou com a ' +
      'mensagem quando não têm uma, e o ticket que um deixa é o do próximo (sem ticket, um agente de tickets pergunta ' +
      'o tipo do ticket novo que a execução cria). Entre dois agentes, o painel pergunta se segue: Enter segue, e Esc ' +
      'para a sequência. Ela também para quando um agente falha, quando o Ctrl+C o interrompe e quando uma execução em ' +
      '`execute` deixa intacto o ticket que criou. `/resume` volta a qualquer agente da sequência, parada ou já ' +
      'terminada: escolhido o agente, o que se digita é dito a ele (vazio ou Esc repete a tarefa dele), e a sequência ' +
      'roda de novo a partir dele, com o ticket da sessão.',
    'Enquanto um agente roda, o que se envia vai para ele, e as perguntas dele aparecem no campo. As linhas de cada ' +
      'agente aparecem num bloco com a borda na cor dele e o nome no começo; as do choliba, com `●`. Ctrl+C duas ' +
      'vezes para a execução; sem nada rodando, sai do painel. `/quit` sai do painel depois de parar a execução e ' +
      'esperar que ela termine, para nenhum processo ficar rodando. `/clear` para o que roda e limpa o contexto ' +
      '(projeto, ticket e agentes) e a conversa.',
    'Cada sessão grava `.cache/logs/painel/<data e hora>.log`, sem cores: o que se envia, os comandos, as escolhas, as ' +
      'perguntas e respostas, o que o choliba responde e as linhas de cada agente, que tem também o seu log de ' +
      'execução em `.cache/logs/<agente>/`. Precisa de um terminal interativo.',
  ].join('\n\n'),
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
