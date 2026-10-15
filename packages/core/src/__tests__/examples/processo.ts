import { ProcessRunnerService, type ProcessSpawner, type SessionExitEvent } from '../../index';

/** Roda `comando`, escreve cada linha da saída com o rótulo `app` e devolve o código de saída. */
export async function rodar(
  spawner: ProcessSpawner,
  comando: readonly string[],
  escrever: (texto: string) => void,
): Promise<number | null> {
  const runner = new ProcessRunnerService({ spawner });
  const sessao = runner.start({ label: 'app', command: comando, colorize: false });
  sessao.subscribe((linha) => {
    escrever(`${linha.formatted}\n`);
  });
  const fim = await new Promise<SessionExitEvent>((resolve) => {
    sessao.onExit(resolve);
  });
  return fim.exitCode;
}
