#!/usr/bin/env bash
set -e

# Se o Bun não estiver no PATH, instala
if ! command -v bun &>/dev/null; then
  echo "→ Bun não encontrado. Instalando Bun..."
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi

# Passa o controle para o TypeScript!
bun run scripts/setup.ts
