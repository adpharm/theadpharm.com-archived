#!/bin/bash
set -e

# install psql (postgresql-client)
sudo apt-get update && sudo apt-get install -y postgresql-client xdg-utils

echo "Installing Bun"
curl -fsSL https://bun.sh/install | bash

# echo "Installing Claude CLI"
# ~/.bun/bin/bun add -g @anthropic-ai/claude-code

# Try to trust the package, but don't fail if it's already trusted or has no scripts
# echo "Trusting Claude CLI package (if needed)..."
# ~/.bun/bin/bun pm -g trust @anthropic-ai/claude-code 2>/dev/null || true

# Install Claude CLI
curl -fsSL https://claude.ai/install.sh | bash

# echo "Running init-firewall.sh..."
# sudo /usr/local/bin/init-firewall.sh
