import { Test } from '@nestjs/testing';

import { fakePlatform } from '@choliba/core/testing';

import { AppModule } from '../app.module';
import { CholibaCliRootCommand } from '../help/root.command';
import { NewCommand } from '../new/new.command';
import { fakeRuntime } from './helpers/runtime';

describe('AppModule', () => {
  it('puts every command of choliba-cli together, on the platform and runtime it is given', async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule.forRoot(fakePlatform(), fakeRuntime())],
    }).compile();

    expect(module.get(CholibaCliRootCommand)).toBeInstanceOf(CholibaCliRootCommand);
    expect(module.get(NewCommand)).toBeInstanceOf(NewCommand);
    await module.close();
  });
});
