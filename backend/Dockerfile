# Sakhtar CRM API — multi-stage
FROM node:20-alpine AS base
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
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
RUN addgroup -g 1001 -S nodejs && adduser -S nest -u 1001
USER nest
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
