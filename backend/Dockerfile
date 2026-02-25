# Sakhtar CRM API — multi-stage
FROM node:20-bookworm-slim AS base
WORKDIR /app

# Dependencies (npm install tolerates lockfile drift; run npm install locally and commit lock for reproducible ci)
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Production
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DEMO_SEED=0
RUN set -eux; \
  apt_retry() { \
    for i in 1 2 3 4 5; do \
      apt-get update && apt-get install -y --no-install-recommends openssl && return 0; \
      echo "apt-get failed, retrying ($i/5)..." >&2; \
      sleep 5; \
    done; \
    return 1; \
  }; \
  apt_retry; \
  rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY docker-entrypoint.sh ./docker-entrypoint.sh
EXPOSE 3000
RUN chmod +x /app/docker-entrypoint.sh
CMD ["./docker-entrypoint.sh"]
