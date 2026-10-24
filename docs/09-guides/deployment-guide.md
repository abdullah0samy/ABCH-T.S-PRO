# Deployment Guide

## Prerequisites

- **Node.js** 22+ (LTS)
- **Docker** 24+ with Docker Compose V2
- **npm** 10+
- Access to PostgreSQL and Redis on the ports specified below

## Architecture Overview

The ABCH Hospital Ticketing CRM runs four services:

| Service       | Image              | Internal Port | Host Port | Description                          |
|---------------|--------------------|---------------|-----------|--------------------------------------|
| PostgreSQL    | `postgres:15-alpine` | 5432          | 5445      | Primary relational database          |
| Redis         | `redis:7-alpine`   | 6379          | 9396      | Session cache + BullMQ job queue     |
| Backend       | `node:22-alpine`   | 4000          | 3007      | NestJS API + WebSocket gateway       |
| Frontend      | `nginx:alpine`     | 80            | 8080      | Vite-built React SPA served by Nginx |

Service ordering is enforced by health checks: `backend` waits for `postgres` and `redis` to be healthy before starting. `frontend` depends on `backend`.

## Environment Variables

Configure these in your deployment environment. See `docker-compose.yml` L39-45 and `backend/src/main.ts` L13-19.

| Variable              | Required | Description                                           | Example                                                                                   |
|-----------------------|----------|-------------------------------------------------------|-------------------------------------------------------------------------------------------|
| `DATABASE_URL`        | Yes      | PostgreSQL connection string with Prisma query params  | `postgresql://user:pass@postgres:5432/abch_db?schema=public&connection_limit=20&pool_timeout=30` |
| `REDIS_HOST`          | Yes      | Redis hostname (Docker service name)                  | `redis`                                                                                   |
| `REDIS_PORT`          | Yes      | Redis internal port                                   | `6379`                                                                                    |
| `JWT_ACCESS_SECRET`   | Yes      | Secret for short-lived access tokens (JWT)            | 64+ character hex string                                                                  |
| `JWT_REFRESH_SECRET`  | Yes      | Secret for refresh tokens (JWT)                       | 64+ character hex string                                                                  |
| `NEST_PORT`           | No       | Backend listen port (internal)                        | `4000`                                                                                    |
| `FRONTEND_URL`        | No       | Frontend origin for CORS + CSP headers                | `https://yourdomain.com`                                                                  |
| `NODE_ENV`            | No       | Runtime environment                                   | `production` or `development`                                                             |

The backend **will not start** if `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` are missing — it exits with code 1 (`backend/src/main.ts:16-19`).

## Local Development Setup

```sh
# 1. Install root-level dependencies
npm install

# 2. Start infrastructure services
docker-compose up -d postgres redis

# 3. Set environment variables (backend/.env required for local dev):
#    DATABASE_URL=postgresql://johndoe:password@localhost:5445/abch_db?schema=public
#    REDIS_HOST=localhost
#    REDIS_PORT=9396
#    JWT_ACCESS_SECRET=<your-secret>
#    JWT_REFRESH_SECRET=<your-secret>

# 4. Generate Prisma client and push schema
cd backend && npx prisma generate && npx prisma db push

# 5. Seed the database
npm run seed-full

# 6. Start backend in watch mode
npm run dev:backend    # from repo root

# 7. In another terminal, start frontend
npm run dev:frontend   # from repo root, Vite on :5173
```

## Docker Deployment

### Build and Start All Services

```sh
docker-compose up -d --build
```

This will:
1. Build `backend/Dockerfile` (multi-stage: builds with `nest build`, copies `dist/` + `node_modules` + `prisma/` to runtime)
2. Build `frontend/Dockerfile` (multi-stage: `vite build`, served by Nginx with `nginx.conf`)
3. Run `npx prisma db push --accept-data-loss` on backend container start (Dockerfile CMD, L28)

### Docker Image Details

**Backend** (`backend/Dockerfile`):
- Stage 1 (`builder`): installs deps, generates Prisma client, runs `nest build`
- Stage 2: copies `dist/`, `node_modules/`, `package.json`, `prisma/`; creates `uploads/avatars` and `uploads/exports`; starts with `npx prisma db push && node dist/main`

**Frontend** (`frontend/Dockerfile`):
- Stage 1 (`builder`): runs `vite build`
- Stage 2: Nginx alpine, copies `nginx.conf` to `/etc/nginx/conf.d/default.conf`, copies Vite `dist/` to `/usr/share/nginx/html`

### Useful Docker Commands

```sh
# View all service logs
docker-compose logs -f

# View backend logs only
docker-compose logs -f backend

# Rebuild after code changes
docker-compose up -d --build backend

# Exec into running container
docker-compose exec backend sh
docker-compose exec postgres psql -U johndoe -d abch_db

# Restart a single service
docker-compose restart backend

# Stop all services
docker-compose down

# Stop and destroy persistent volumes (WARNING: deletes all data)
docker-compose down -v
```

## Database Setup

### Prisma Schema

The schema lives at `backend/prisma/schema.prisma` and defines 22 models including `User`, `Ticket`, `Department`, `Role`, `Permission`, `AuditLog`, `KnowledgeArticle`, `Asset`, and `ExportHistory`.

### Initial Schema Push

```sh
# Apply schema to database (development / Docker)
npx prisma db push

# For production migrations:
npx prisma migrate dev --name init
```

### Seed Scripts

The project provides multiple seed scripts (`backend/prisma/`):

```sh
# Basic seed (departments, users, roles)
npm run db:seed

# Full seed (departments, users, ticket types, sample data)
npm run seed-full

# Knowledge Base seed (categories + sample articles)
npm run seed-kb
```

## Production Checklist

### Security

1. **JWT Secrets**: Generate cryptographically strong secrets (at least 64 hex characters):
   ```sh
   openssl rand -hex 64
   ```

2. **HTTPS**: Enable HSTS via `NODE_ENV=production`. The `helmet` middleware configures HSTS with `max-age: 31536000` when `NODE_ENV === 'production'` (`backend/src/main.ts:42-46`).

3. **CORS Origins**: Set `FRONTEND_URL` to your production domain. In production, CORS is restricted to this single origin (`backend/src/main.ts:54-63`).

4. **CSRF Protection**: Double-submit CSRF pattern is active via `x-csrf-token` cookie and header. Cookies are `secure: true` in production (`backend/src/main.ts:70-90`).

5. **Rate Limiting**: NestJS Throttler and `express-rate-limit` are configured. The WebSocket gateway enforces per-socket rate limits (`backend/src/gateways/ticket.gateway.ts:7-27`).

### Infrastructure

1. **PostgreSQL Backup**: Set up automated pg_dump to S3 or equivalent:
   ```sh
   pg_dump -h postgres -U johndoe -d abch_db > backup_$(date +%F).sql
   ```

2. **Redis Persistence**: The Redis container is configured with `--save 60 1` (snapshot every 60s if at least 1 key changed) and mounts `dump.rdb` to host (`docker-compose.yml:25-27`).

3. **File Uploads**: Mount `uploads/avatars` and `uploads/exports` to persistent volumes in production, as the containers currently create these directories in-memory.

4. **Health Checks**: PostgreSQL and Redis both have Docker health checks configured. Verify they report healthy:
   ```sh
   docker-compose ps
   ```

### Monitoring

- **Morgan HTTP Logger**: All HTTP requests are logged via `morgan('dev')` in development (`backend/src/main.ts:66`).
- **Audit Log**: The `AuditLog` table records all significant actions with `userId`, `action`, `entityType`, `entityId`, `oldData`, `newData`, `ipAddress`, and `userAgent`.
- **Swagger Docs**: Available at `/api/docs` in development; disabled in production (`backend/src/main.ts:93-102`).

## Frontend URL Routing

The Nginx configuration (`frontend/nginx.conf`) proxies API requests to the backend:
- `/api/*` → `http://backend:4000/api/*`
- `/uploads/*` → `http://backend:4000/uploads/*`
- `/socket.io/*` → `http://backend:4000/socket.io/*`
- All other routes → SPA fallback to `index.html`

## Scaling Considerations

- **WebSocket Sessions**: The gateway uses `socket.io-redis-adapter` for horizontal scaling across multiple backend instances.
- **Database Pool**: Connection pool is tuned via `DATABASE_URL` query parameters: `connection_limit=20&pool_timeout=30&connect_timeout=10` (`backend/prisma/schema.prisma:9`).
- **Body Size Limit**: Set to `10mb` for file uploads (`backend/src/main.ts:67`).