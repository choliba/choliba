import { AgentProvider, type ProviderRequest, type StreamParser } from '../..';

class StubProvider extends AgentProvider {
  readonly id = 'stub';
  readonly binaries = [['stub']] as const;
  readonly autoPriority = 1;
  readonly credentials = ['STUB_KEY'] as const;
  readonly credentialHelp = 'set STUB_KEY';

  buildArgs(_request: ProviderRequest): readonly string[] {
    return ['--ok'];
  }

  createParser(): StreamParser {
    return { parseLine: () => [], sawInitWithModel: false };
  }
}

describe('@choliba/engine ports', () => {
  it('exposes the provider contract with restrictive defaults through its entry', () => {
    const provider = new StubProvider();

    expect(provider.unenforcedTools).toEqual([]);
    expect(provider.enforcesExecute).toBe(true);
    expect(provider.oneShotInput).toBe(false);
    expect(provider.inAuto).toBe(true);
    expect(provider.needsModel).toBe(false);
    expect(provider.declaredModel('gpt')).toBe('gpt');
    expect(provider.localReadOnly('/bin/stub')).toEqual(['/bin/stub']);
    expect(provider.createParser().parseLine('')).toBeDefined();
    expect(provider.createParser().parseLine('')).toEqual([]);
  });
});
