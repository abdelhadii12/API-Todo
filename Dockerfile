# Stage 1 — BUILDER
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY src/ ./src/

RUN npm prune --omit=dev

# Stage 2 — RUNTIME
FROM node:20-alpine AS runtime

RUN apk add --no-cache wget

WORKDIR /app

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/src ./src
COPY --chown=node:node package.json ./

RUN mkdir -p /var/lib/todo-api && chown node:node /var/lib/todo-api

USER node

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/var/lib/todo-api/todos.db

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]