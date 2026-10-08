/** A command line the machine's choliba cannot run: the message says what is wrong. */
export class UsageError extends Error {}

/** A step of the assistant that could not be done: the message says which and what was left. */
export class WorkspaceError extends Error {}
