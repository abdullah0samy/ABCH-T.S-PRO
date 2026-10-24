FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --include=dev

COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine

WORKDIR /app

# نسخ الكود المبني والحزم الجاهزة مباشرة
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

RUN mkdir -p uploads/avatars uploads/exports && \
    addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app

USER appuser
HEALTHCHECK --interval=20s --timeout=5s --start-period=60s --retries=5 \
  CMD wget -q -O - http://127.0.0.1:4000/api/health || exit 1
EXPOSE 4000
ENV NODE_ENV=production
ENV PORT=4000
ENV NEST_PORT=4000

CMD ["node", "dist/main"]
