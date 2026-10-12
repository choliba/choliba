import { ExpectedError } from '@choliba/core';

export class ProjectsError extends ExpectedError {}

/** A command line the command cannot run: what is wrong, said to the person. */
export class UsageError extends ExpectedError {}
