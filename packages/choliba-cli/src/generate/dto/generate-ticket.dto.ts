import { UsageError } from '../../common';

/** `generate ticket PROJECT TYPE`, validated. */
export class GenerateTicketDto {
  constructor(
    readonly project: string,
    readonly type: string,
  ) {}
}

export function parseGenerateTicketArgs(args: readonly string[]): GenerateTicketDto {
  const [project, type] = args;
  if (!project || !type) throw new UsageError('Missing project or type for generate ticket.');
  return new GenerateTicketDto(project, type);
}
