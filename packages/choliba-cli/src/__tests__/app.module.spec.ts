import { Test } from '@nestjs/testing';

import { fakePlatform } from '@choliba/core/testing';

import { AddCommand } from '../add/add.command';
import { AppModule } from '../app.module';
import { GenerateCommand } from '../generate/generate.command';
import { NewCommand } from '../new/nest';
import { WorkspaceService } from '../workspace/workspace.service';
import { fakeRuntime } from './helpers/runtime';

describe('AppModule', () => {
  it('puts every command of choliba-cli together, on the platform and runtime it is given', async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule.forRoot(fakePlatform(), fakeRuntime())],
    }).compile();

    expect(module.get(NewCommand)).toBeInstanceOf(NewCommand);
    expect(module.get(GenerateCommand)).toBeInstanceOf(GenerateCommand);
    expect(module.get(AddCommand)).toBeInstanceOf(AddCommand);
    expect(module.get(WorkspaceService)).toBeInstanceOf(WorkspaceService);
    await module.close();
  });
});
