FROM node:24-bookworm

WORKDIR /app

RUN corepack enable \
  && groupmod -g 1000 node \
  && usermod -u 1000 -g 1000 node \
  && mkdir -p /app \
  && chown -R node:node /app

USER node

COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Source is bind-mounted at runtime. Keep the image's node_modules via the
# named volume (populated from this layer on first create).
EXPOSE 3000

CMD ["pnpm", "dev", "--hostname", "0.0.0.0", "--port", "3000"]
