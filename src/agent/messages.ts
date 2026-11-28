/**
 * What the agent writes on screen besides the model's answer: waiting for
 * approvals, the approvals given, and the short status lines.
 */

import type { StoredApproval } from '../store/index';

export const CONTINUE = 'Continue a tarefa de onde parou.';

export function waitingMessage(count: number): string {
  return `⏸ Aguardando aprovação de ${String(count)} comando(s) negado(s): aperte Ctrl+A (ou rode \`bun run approvals\` em outro terminal). O agente continua sozinho quando aprovar (Ctrl+C para sair).`;
}

/** An approval, with what was asked when it approves a denial. */
export interface Notice {
  readonly approval: StoredApproval;
  readonly asked: string | undefined;
}

export function describeNotices(notices: readonly Notice[]): string[] {
  const commands = notices.filter(
    ({ approval }) => approval.category === 'execution',
  );
  const destinations = notices.filter(
    ({ approval }) => approval.category === 'network',
  );

  return [
    ...(commands.length === 0
      ? []
      : [
          'Permissões atualizadas: estes comandos, que foram bloqueados, agora estão permitidos.',
          'Execute-os de novo, exatamente como estão, antes de seguir:',
          ...commands.map(describeNotice),
        ]),
    ...(destinations.length === 0
      ? []
      : [
          'Rede liberada: estes destinos, que foram bloqueados, agora estão permitidos.',
          'Repita o que precisava deles antes de seguir:',
          ...destinations.map(describeNotice),
        ]),
  ];
}

/**
 * What to run again: the command that was denied, never a pattern (`curl *`
 * would be run as is). The pattern only says what else is now allowed.
 */
export function describeNotice({
  approval: { kind, pattern },
  asked,
}: Notice): string {
  if (kind === 'once') return `- (uma vez) ${asked ?? pattern}`;
  if (asked === undefined || asked === pattern) {
    return `- (neste workspace) ${pattern}`;
  }
  return `- (neste workspace) ${asked} — liberado pelo padrão \`${pattern}\``;
}

export const THINKING_MESSAGE = '⏳ pensando…';

export const FORGOTTEN_SESSION_MESSAGE =
  'A conversa anterior não existe mais na CLI: começando uma nova.';

export const BACKGROUND_MESSAGE = '⏳ rodando em background…';

/** A message typed during a turn, given to the CLI that is running. */
export const LIVE_DELIVERED_MESSAGE =
  'Mensagem entregue: o agente responde quando terminar o que está fazendo.';

/** A message typed during a turn, kept for the next one. */
export const LIVE_KEPT_MESSAGE =
  'Mensagem guardada: vai para o agente quando ele terminar o passo atual.';
