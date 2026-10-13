// Where a provider runs: on this machine inside bwrap, or in a Docker container. Both mount only what it may reach. Plain
// functions and types over @choliba/core, so anything can plan a sandboxed command without an agent.
export * from './common';
export * from './sandbox';
