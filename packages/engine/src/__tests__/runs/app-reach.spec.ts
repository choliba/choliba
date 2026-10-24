import type { Sandbox } from '@choliba/sandbox';

import { containerReachProblem, type AppReachDeps } from '../../runs/app-reach';

const ISOLATED: Sandbox = { kind: 'docker', image: 'choliba-agent:local', network: 'isolated' };

function reach(answers: boolean, host?: string): AppReachDeps & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    dockerHost: () => host,
    reaches: (url) => {
      asked.push(url);
      return Promise.resolve(answers);
    },
  };
}

describe('containerReachProblem', () => {
  it('says why the container would not reach an application up on localhost only, and how to fix it', async () => {
    const deps = reach(false, '172.17.0.1');

    expect(await containerReachProblem('http://localhost:5173/login', ISOLATED, deps)).toBe(
      'a aplicação responde em http://localhost:5173/login, mas não pela interface do Docker ' +
        '(http://172.17.0.1:5173/login), por onde o agente, no container, a acessa ' +
        '(http://host.docker.internal:5173/login). Suba-a ouvindo em todas as interfaces (no Vite, --host) ou use ' +
        'CHOL_NETWORK=host.',
    );
    expect(deps.asked).toEqual(['http://172.17.0.1:5173/login']);
  });

  it('is nothing when the application answers at the address the container has for this machine', async () => {
    expect(await containerReachProblem('http://127.0.0.1:3000', ISOLATED, reach(true, '172.17.0.1'))).toBeUndefined();
  });

  it('checks nothing without a container, on the host network, for another host or an unknown address', async () => {
    const deps = reach(false, '172.17.0.1');

    expect(await containerReachProblem('http://localhost:3000', { kind: 'local' }, deps)).toBeUndefined();
    expect(
      await containerReachProblem('http://localhost:3000', { ...ISOLATED, network: 'host' }, deps),
    ).toBeUndefined();
    expect(await containerReachProblem('https://staging.example.com', ISOLATED, deps)).toBeUndefined();
    expect(deps.asked).toEqual([]);
    expect(await containerReachProblem('http://localhost:3000', ISOLATED, reach(false))).toBeUndefined();
  });

  it("uses this machine's own by default: Docker's bridge and a real request", async () => {
    const problem = await containerReachProblem('http://localhost:1', ISOLATED);

    // Nothing listens on port 1: where there is a docker0, the check says so; where there is none, nothing to check.
    expect(problem === undefined || problem.startsWith('a aplicação responde em http://localhost:1,')).toBe(true);
  });
});
