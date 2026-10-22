import { answers } from '@choliba/runner';
import { agentURL, CONTAINER_HOST_NAME, dockerHostAddress, type Sandbox } from '@choliba/sandbox';

/** How to find whether a container reaches the application: this machine's address for it, and a request to a URL. */
export interface AppReachDeps {
  /** The address a container reaches this machine by (`dockerHostAddress`); `undefined` where it is not known. */
  readonly dockerHost: () => string | undefined;
  /** Whether something answers at `url` (`answers` of `@choliba/runner`). */
  readonly reaches: (url: string) => Promise<boolean>;
}

/** This machine's own: the address of Docker's bridge, and a real request. */
const MACHINE_REACH: AppReachDeps = { dockerHost: () => dockerHostAddress(), reaches: answers };

/**
 * Why the agent, in a container on Docker's isolated network, would not reach the application at `baseURL`: up on this
 * machine's `localhost` only, it does not answer at the address the container has for this machine. `undefined` when
 * it does, and when there is nothing to check (no container, the host network, a `baseURL` of another host, an
 * address that is not known).
 */
export async function containerReachProblem(
  baseURL: string,
  sandbox: Sandbox,
  deps: AppReachDeps = MACHINE_REACH,
): Promise<string | undefined> {
  const inContainer = agentURL(baseURL, sandbox);
  if (inContainer === baseURL) return undefined;
  const host = deps.dockerHost();
  if (host === undefined) return undefined;
  const fromContainer = inContainer.replace(CONTAINER_HOST_NAME, host);
  if (await deps.reaches(fromContainer)) return undefined;
  return (
    `a aplicação responde em ${baseURL}, mas não pela interface do Docker (${fromContainer}), por onde o agente, no ` +
    `container, a acessa (${inContainer}). Suba-a ouvindo em todas as interfaces (no Vite, --host) ou use ` +
    'CHOL_NETWORK=host.'
  );
}
