FROM oven/bun:1.2-alpine AS deps

WORKDIR /app/server

COPY server/package.json server/bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.2-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV CRAZOR_HOME=/data/crazor

COPY --from=deps /app/server/node_modules ./server/node_modules
COPY server ./server

WORKDIR /app/server

EXPOSE 3001

CMD ["bun", "run", "start"]
