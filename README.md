<div align="center">
  <img src="./ABC-Logo.svg" alt="ABCH Ticketing CRM" width="120" style="margin-bottom: 1em;" />
  <h1>ABCH Ticketing CRM</h1>
  <p><strong>Enterprise IT Service Management Platform</strong></p>
</div>

---

## Overview

ABCH Ticketing CRM is an enterprise IT service management and helpdesk platform built for ABCH. It provides real-time ticketing, SLA tracking, department routing, analytics, and collaboration tools for internal IT operations.

**Stack:** NestJS (Backend) · React 19 (Frontend) · PostgreSQL · Redis · Socket.IO

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 18 (LTS)
- **Docker & Docker Compose** (for PostgreSQL + Redis)

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env  # if available, or create .env manually
   ```
   Required variables:
   - `DATABASE_URL` — PostgreSQL connection string
   - `REDIS_HOST` / `REDIS_PORT` — Redis connection
   - `JWT_ACCESS_SECRET` — Strong random secret (32+ chars)
   - `JWT_REFRESH_SECRET` — Strong random secret (32+ chars)
   - `NEST_PORT` — Backend port (default: `4000`)

3. **Start infrastructure:**
   ```bash
   docker-compose up -d postgres redis
   ```

4. **Push database schema:**
   ```bash
   cd backend && npx prisma db push
   ```

5. **Seed database:**
   ```bash
   cd backend && npm run seed-full
   ```

6. **Run the application:**
   ```bash
   npm run dev:backend &
   npm run dev:frontend
   ```

### Production Build

```bash
npm run build:backend
npm run build:frontend
```

---

## Project Structure

```
├── backend/             # NestJS API
│   ├── src/
│   │   ├── modules/     # Feature modules (auth, tickets, admin, etc.)
│   │   ├── common/      # Guards, interceptors, filters, pipes
│   │   ├── core/        # Shared utilities
│   │   ├── gateways/    # Socket.IO gateway
│   │   └── prisma/      # Database service
│   └── prisma/
│       └── schema.prisma
├── frontend/            # React SPA (Vite)
│   ├── src/
│   │   ├── pages/       # Page components
│   │   ├── components/  # Shared UI components
│   │   ├── core/        # API wrapper, translations, notification provider
│   │   └── store/       # Zustand stores
│   └── index.html
├── tests/               # Vitest test suite
├── docs/                # System documentation
└── docker-compose.yml   # Infrastructure services
```

---

## Key Features

- **Ticket Management:** Full lifecycle (create → pending → open → in progress → resolved → closed)
- **SLA Tracking:** Configurable per department/ticket type with automated breach alerts
- **Real-time Updates:** Socket.IO notifications for ticket events
- **RBAC:** 4 roles (end user, agent, supervisor, super admin) with granular permissions
- **Bilingual:** Arabic (RTL, default) + English (LTR)
- **Knowledge Base:** Bilingual articles with search and autocomplete
- **Team Feed:** Department-scoped collaboration
- **Asset Tracking:** Equipment lifecycle management
- **Audit Logging:** Full audit trail for all mutations
- **Analytics:** Department performance, agent KPIs, AHT tracking, XLSX export

---

## Testing

```bash
npm run test            # Run all tests
npm run test:watch      # Watch mode
```

---

## Documentation

Complete system documentation lives in [`/docs`](docs/):

- [`docs/00-overview/`](docs/00-overview/) — Architecture, system overview, module documentation
- [`docs/04-api/`](docs/04-api/) — Full API reference (54 endpoints)
- [`docs/05-database/`](docs/05-database/) — Database schemas, ER diagram
- [`docs/09-guides/`](docs/09-guides/) — Deployment, operations, role-specific guides
- [`docs/10-reports/`](docs/10-reports/) — Audit reports, security review, gap analysis
