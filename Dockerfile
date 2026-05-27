# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist

# stdio transport: stdin/stdout speak MCP JSON-RPC, stderr is for logs.
ENTRYPOINT ["node", "dist/main.js"]
