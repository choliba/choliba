import { Test } from '@nestjs/testing';

import { AgentsService } from '@choliba/agents/nest';
import { complete } from '@choliba/core';
import { PlatformModule } from '@choliba/core/nest';
import { fakePlatform } from '@choliba/core/testing';

import { AppHelpService } from '../../help/app-help.service';
import { HelpModule } from '../../help/help.module';

describe('AppHelpService', () => {
  it('lists no agent shortcut when the agents spec lists no command', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PlatformModule.forRoot(fakePlatform()), HelpModule],
    })
      .overrideProvider(AgentsService)
      .useValue({ helpSpec: () => ({ usage: 'choliba agents' }) })
      .compile();

    expect(complete(moduleRef.get(AppHelpService).spec(), ['ag'])).toEqual({ kind: 'values', values: ['agents'] });
  });
});
