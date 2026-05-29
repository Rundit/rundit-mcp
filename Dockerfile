# syntax=docker/dockerfile:1.7

FROM node:24-alpine
WORKDIR /app
ENV RUNDIT_SDK_DIST_TAG=latest

# Install everything except the SDK; the entrypoint installs the SDK at the
# requested dist-tag on each start so a container always picks up the latest
# published @rundit-sdk/client (or the latest -rc for test environments).
# Dev deps stay in the image because the entrypoint runs `tsc` at startup
# (`--include=dev` overrides npm's default of skipping devDeps in production).
COPY package.json package-lock.json* ./
RUN npm pkg delete dependencies.@rundit-sdk/client \
 && npm install --include=dev --no-audit --no-fund \
 && npm cache clean --force

ENV NODE_ENV=production

COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src

RUN chmod +x scripts/docker-entrypoint.sh

# stdio transport: stdin/stdout speak MCP JSON-RPC, stderr is for logs.
ENTRYPOINT ["scripts/docker-entrypoint.sh"]
