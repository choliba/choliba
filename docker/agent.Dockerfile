# The image `CHOL_SANDBOX=docker` runs an agent's provider in: Node and the browsers of the Playwright version choliba
# uses, Bun, Claude Code, Codex and the Cursor CLI. Nothing of the workspace is in it; choliba mounts what the agent may
# reach at each run. Build it from the repository root:
#
#   docker build -f docker/agent.Dockerfile -t choliba-agent .
ARG BUN_VERSION=1.4.2
# The @playwright/test choliba pins (packages/*/package.json): the browsers here are the ones that version expects.
ARG PLAYWRIGHT_VERSION=1.63.0
FROM oven/bun:${BUN_VERSION} AS bun

FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble
ARG PLAYWRIGHT_VERSION

# Bun, for the run tools and `bunx choliba`.
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx

# Google Chrome, the browser playwright-cli opens by default, as on the machine outside the container.
RUN npx -y "playwright@${PLAYWRIGHT_VERSION}" install --with-deps chrome && npm cache clean --force

# Claude Code (`claude`).
RUN npm install -g @anthropic-ai/claude-code && npm cache clean --force

# Codex CLI (`codex`), pinned to the version whose JSONL stream the provider fixtures cover.
ARG CODEX_VERSION=0.163.0
RUN npm install -g "@openai/codex@${CODEX_VERSION}" && npm cache clean --force

# The Cursor CLI (`agent`, also `cursor-agent`), pinned by version and checksum: the package of that version, checked
# against its sha256 before it is unpacked, never the install script. Cursor publishes no checksum, so each one is the
# `sha256sum` of that architecture's package; to update, take the version from the download URL in
# https://cursor.com/install and hash both packages. Installed outside any home: the container runs as the workspace's
# owner, with an empty home.
ARG CURSOR_VERSION=2026.10.01-e373342
ARG CURSOR_SHA256_X64=a79726c6e644520e993970be4c45775a6889802b67abe461a677a53219ae28e8
ARG CURSOR_SHA256_ARM64=785c5f6bf2a60eb1121e27ed8c14f5ee07ed1b5b6692324f2d9a997238245eb5
RUN case "$(dpkg --print-architecture)" in \
      amd64) arch=x64 sha256="${CURSOR_SHA256_X64}" ;; \
      arm64) arch=arm64 sha256="${CURSOR_SHA256_ARM64}" ;; \
      *) echo "no Cursor CLI package for $(dpkg --print-architecture)" >&2; exit 1 ;; \
    esac \
  && curl -fsSL -o /tmp/cursor.tar.gz \
    "https://downloads.cursor.com/lab/${CURSOR_VERSION}/linux/${arch}/agent-cli-package.tar.gz" \
  && echo "${sha256}  /tmp/cursor.tar.gz" | sha256sum -c - \
  && mkdir -p /opt/cursor \
  && tar --strip-components=1 -xzf /tmp/cursor.tar.gz -C /opt/cursor \
  && rm /tmp/cursor.tar.gz \
  && ln -s /opt/cursor/cursor-agent /usr/local/bin/agent \
  && ln -s /opt/cursor/cursor-agent /usr/local/bin/cursor-agent \
  && chmod -R a+rX /opt/cursor
