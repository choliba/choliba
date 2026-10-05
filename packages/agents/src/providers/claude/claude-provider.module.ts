import { Module } from '@nestjs/common';

import { ClaudeAgentProvider } from './claude-agent.provider';

@Module({ providers: [ClaudeAgentProvider] })
export class ClaudeProviderModule {}
