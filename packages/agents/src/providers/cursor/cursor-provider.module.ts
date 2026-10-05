import { Module } from '@nestjs/common';

import { CursorAgentProvider } from './cursor-agent.provider';

@Module({ providers: [CursorAgentProvider] })
export class CursorProviderModule {}
