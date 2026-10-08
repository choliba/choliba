import { Test } from '@nestjs/testing';

import { fakePlatform } from '@choliba/core/testing';

import { AppModule } from '../app.module';
import { AgentCommand } from '../agent/agent.command';
import { NewCommand } from '../new/nest';
import { fakeRuntime } from './helpers/runtime';

describe('AppModule', () => {
  it('puts every command of choliba-cli together, on the platform and runtime it is given', async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule.forRoot(fakePlatform(), fakeRuntime())],
    }).compile();

    expect(module.get(AgentCommand)).toBeInstanceOf(AgentCommand);
    expect(module.get(NewCommand)).toBeInstanceOf(NewCommand);
    await module.close();
  });
});
