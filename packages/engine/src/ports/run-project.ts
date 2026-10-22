/** The project a run works on (`--project`): its name and its active environment's application. */
export interface RunProject {
  readonly name: string;
  /** The application's address as this machine sees it: the active environment's `baseURL` of `config.json`. */
  readonly baseURL: string;
  /** The same address as the agent reaches it (`agentURL`): different only in a container on the isolated network. */
  readonly agentBaseURL: string;
  /** The application's code, absolute. */
  readonly appDir: string;
}
