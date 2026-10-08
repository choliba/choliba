import { UsageError } from '../../common';

/** `create-ticket PROJECT TYPE`, validated. */
export class CreateTicketDto {
  constructor(
    readonly project: string,
    readonly type: string,
  ) {}
}

export function parseCreateTicketArgs(args: readonly string[]): CreateTicketDto {
  const [project, type] = args;
  if (!project || !type) throw new UsageError('Missing project or type for create-ticket.');
  return new CreateTicketDto(project, type);
}
