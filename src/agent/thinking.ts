import { THINKING_TICK_MS } from './constants';

/**
 * The model's work in a turn, for the subscribers: `start` when the turn
 * begins (and again after a quiet `every` once it has spoken), a `tick` every
 * `every` while the CLI runs without speaking, and `end` when it speaks or
 * the turn ends. Paused (an approval waits for a person), it does not tick.
 * The timer never keeps the program alive.
 */
export function watchThinking(
  onPhase: (phase: 'start' | 'tick' | 'end', seconds: number) => void,
  {
    every = THINKING_TICK_MS,
    paused = (): boolean => false,
  }: { readonly every?: number; readonly paused?: () => boolean } = {},
): { spoke(): void; stop(): void } {
  let thinking = true;
  let since = Date.now();
  let spokeAt = since;
  const seconds = (): number => Math.round((Date.now() - since) / 1000);

  onPhase('start', 0);
  const timer = setInterval(() => {
    if (paused()) return;
    if (thinking) {
      onPhase('tick', seconds());
    } else if (Date.now() - spokeAt >= every) {
      thinking = true;
      since = Date.now();
      onPhase('start', 0);
    }
  }, every);
  timer.unref();

  const end = (): void => {
    if (!thinking) return;
    thinking = false;
    onPhase('end', seconds());
  };

  return {
    spoke: () => {
      end();
      spokeAt = Date.now();
    },
    stop: () => {
      clearInterval(timer);
      end();
    },
  };
}
