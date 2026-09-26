import { isRecord } from '../json';

/**
 * Shared by both provider parsers: claude and cursor-agent parse `assistant` events identically
 * — `event.message.content[]`, blocks of `type: 'text' | 'tool_use'` with `text`/`name`/`input`
 * — so this shape lives once instead of twice.
 */
export interface ContentBlock {
  readonly type?: string;
  readonly id?: string;
  readonly name?: string;
  readonly text?: string;
  readonly input?: {
    readonly plan?: string;
    readonly command?: string;
    readonly file_path?: string;
    readonly pattern?: string;
  };
  readonly tool_use_id?: string;
  readonly is_error?: boolean;
  readonly content?: string | readonly { readonly text?: string }[];
}

export function contentBlocks(message: unknown): readonly ContentBlock[] {
  if (!isRecord(message)) {
    return [];
  }
  const content = message['content'];
  if (!Array.isArray(content)) {
    return [];
  }
  const blocks: ContentBlock[] = [];
  for (const item of content) {
    if (isRecord(item)) {
      blocks.push(item);
    }
  }
  return blocks;
}

export function toolResultText(block: ContentBlock): string {
  const { content } = block;
  if (content === undefined) {
    return '';
  }
  return typeof content === 'string' ? content : content.map((part) => part.text ?? '').join('\n');
}

export function summarize(input: ContentBlock['input']): string {
  return input?.command ?? input?.file_path ?? input?.pattern ?? '';
}
