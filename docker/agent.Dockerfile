# The image `CHOL_SANDBOX=docker` runs an agent's provider in: Node and the browsers of the Playwright version choliba
# uses, Bun, Claude Code and the Cursor CLI. Nothing of the workspace is in it; choliba mounts what the agent may
# reach at each run. Build it from the repository root:
#
#   docker build -f docker/agent.Dockerfile -t choliba-agent .
ARG BUN_VERSION=1.4.2
FROM oven/bun:${BUN_VERSION} AS bun

FROM mcr.microsoft.com/playwright:v1.63.0-noble

# Bun, for the run tools and `bunx choliba`.
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx

# Claude Code (`claude`).
RUN npm install -g @anthropic-ai/claude-code && npm cache clean --force

# The Cursor CLI (`agent`, also `cursor-agent`), installed outside any home: the container runs as the workspace's
# owner, with an empty home.
RUN curl -fsSL https://cursor.com/install | HOME=/opt/cursor bash \
  && ln -s "$(readlink -f /opt/cursor/.local/bin/agent)" /usr/local/bin/agent \
  && ln -s /usr/local/bin/agent /usr/local/bin/cursor-agent \
  && chmod -R a+rX /opt/cursor
