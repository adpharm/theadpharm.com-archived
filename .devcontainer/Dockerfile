###############################################################################
# Claude dev-container layer – Ubuntu 22.04 “Jammy” base image                #
###############################################################################
FROM mcr.microsoft.com/devcontainers/base:jammy

# ── Environment ──────────────────────────────────────────────────────────────
ARG TZ
ENV TZ="${TZ:-Etc/UTC}" \
    DEVCONTAINER=true \
    # NPM_CONFIG_PREFIX=/usr/local/share/npm-global \
    # PATH=$PATH:/usr/local/share/npm-global/bin \
    SHELL=/bin/zsh

# ── Root section ─────────────────────────────────────────────────────────────
USER root

# 1. Extra OS packages the base image + features don’t provide
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends \
      iptables ipset iproute2 dnsutils aggregate jq less man-db procps

# 2. Persist shell history across sessions
RUN install -d -m 0755 /commandhistory && \
    touch /commandhistory/.bash_history && \
    chown -R vscode:vscode /commandhistory && \
    printf "export PROMPT_COMMAND='history -a'\nexport HISTFILE=/commandhistory/.bash_history\n" \
      > /etc/profile.d/10-persist-history.sh

# 3. Global npm directory writable by the non-root user **(Node comes from feature)**
RUN install -d -o vscode -g vscode /usr/local/share/npm-global

# 4. Workspace & Claude config
RUN install -d -o vscode -g vscode /workspace /home/vscode/.claude
WORKDIR /workspace

# 5. git-delta (architecture-aware)
RUN ARCH=$(dpkg --print-architecture) && \
    curl -L -o delta.deb "https://github.com/dandavison/delta/releases/download/0.18.2/git-delta_0.18.2_${ARCH}.deb" && \
    dpkg -i delta.deb && rm delta.deb

# 6. Oh-My-Zsh + Powerline10k theme (same as before)
RUN sh -c "$(wget -O- https://github.com/deluan/zsh-in-docker/releases/download/v1.2.0/zsh-in-docker.sh)" -- \
       -p git -p fzf \
       -a "source /usr/share/doc/fzf/examples/key-bindings.zsh" \
       -a "source /usr/share/doc/fzf/examples/completion.zsh" \
       -a "export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
       -x

# 7. Firewall helper (vscode may call it via sudo)
COPY init-firewall.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/init-firewall.sh && \
    echo "vscode ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" \
      > /etc/sudoers.d/vscode-firewall && \
    chmod 0440 /etc/sudoers.d/vscode-firewall

# ── Drop privileges – everything else runs as the regular user ---------------
USER vscode
