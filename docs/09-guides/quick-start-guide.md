# Quick Start Guide

This guide walks a new system administrator through setting up, configuring, and performing the first administrative tasks in the ABCH Hospital Ticketing CRM.

## Step 1: Prerequisites

Ensure your environment has:

- **Node.js 22+**: `node -v`
- **npm 10+**: `npm -v`
- **Docker 24+**: `docker --version`
- **Docker Compose V2**: `docker compose version`

## Step 2: Initial Deployment

### Option A: Docker Compose (Recommended for Quick Start)

```sh
# Clone the repository
git clone <repo-url>
cd Ticket-crm-main

# Generate secure JWT secrets
openssl rand -hex 64   # Copy this as JWT_ACCESS_SECRET
openssl rand -hex 64   # Copy this as JWT_REFRESH_SECRET

# Update docker-compose.yml with your secrets (lines 43-44)

# Start all services
docker-compose up -d --build

# Wait for services to be healthy (60-90 seconds)
docker-compose ps
```

### Option B: Local Development

```sh
# Install dependencies
npm install

# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Create backend/.env with:
# DATABASE_URL=postgresql://johndoe:password@localhost:5445/abch_db?schema=public
# REDIS_HOST=localhost
# REDIS_PORT=9396
# JWT_ACCESS_SECRET=<your-64-char-hex-secret>
# JWT_REFRESH_SECRET=<your-64-char-hex-secret>
# FRONTEND_URL=http://localhost:5173

# Generate Prisma client and push schema
cd backend
npx prisma generate
npx prisma db push

# Seed the database
npm run seed-full
```

## Step 3: Verify Installation

### Check Services

```sh
# All containers should show "healthy"
docker-compose ps

# Test backend API (unauthenticated endpoint)
curl http://localhost:3007/api/tickets/form-data

# If running locally, test both:
# Backend: http://localhost:4000/api/tickets/form-data
# Frontend: http://localhost:5173
```

### Check Swagger API Docs (Development Only)

Open `http://localhost:3007/api/docs` to explore the full API documentation. This is disabled in production (`backend/src/main.ts:93-102`).

## Step 4: First Login

### Default Credentials

The seed scripts create default users. Check your seed file for the super admin credentials:

```sql
-- Find super admin user
SELECT id, badge_number, username, role FROM users WHERE role = 'super_admin' LIMIT 1;
```

If no super admin exists, create one:

```sql
-- Use bcrypt to hash the password first (from backend):
cd backend
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('YourPassword123!', 10));"

-- Then insert:
INSERT INTO users (badge_number, username, email, password_hash, full_name_ar, full_name_en, role, is_active)
VALUES ('ADMIN001', 'superadmin', 'admin@abch.com', '<hashed_password>', 'المدير العام', 'Super Admin', 'super_admin', true);
```

### Login Page

1. Open `http://localhost:8080` (Docker) or `http://localhost:5173` (dev)
2. Enter badge number or username
3. Enter password
4. If `forcePasswordChange` is set, you'll be prompted to set a new password

**Note**: Login identifier format only accepts `a-zA-Z0-9_.-` characters (`backend/src/modules/auth/auth.service.ts:21`).

## Step 5: Essential Setup Tasks

### 1. Create Your First Department

Department is the core organizational unit. Navigate to **Admin > Departments**:

1. Click "Create Department"
2. Set:
   - Name (Ar): e.g., "الصيانة" (Maintenance)
   - Name (En): e.g., "Maintenance"
   - Type: `BOTH` (can send and receive tickets)
   - SLA Hours: 24 (default)
3. The system auto-creates a `DeptPermissions` record with sensible defaults
4. Save

### 2. Create Buildings and Floors

Tickets can be scoped to physical locations. Navigate to **Admin > Buildings**:

1. Click "Create Building"
2. Add: Name (Ar/En), mark active
3. Go to **Admin > Floors**
4. Add floors under each building (e.g., "Floor 1", "Floor 2", etc.)

### 3. Create Ticket Types

Ticket types categorize incoming requests. Navigate to **Admin > Ticket Types**:

Examples:
- **IT Support** — global type for IT-related tickets
- **HVAC Repair** — scoped to Facilities department
- **Medical Equipment** — scoped to Biomedical department

Each type can override the department's SLA hours and has a color for visual identification.

### 4. Create Transfer Allowlists

If departments need to transfer tickets between each other, configure allowlists:

Navigate to **Admin > Departments** > Select department > **Transfer Allowlist**:
1. Add an entry: source department → target department
2. Activate it

**Example**: IT Support → Facilities (for tickets requiring facility intervention).

### 5. Create Supervisor and Agent Accounts

Navigate to **Admin > Users**:

1. Create a supervisor:
   - Badge: `SUP001`
   - Username: `supervisor01`
   - Role: `supervisor`
   - Department: select the department they manage

2. Create agents:
   - Badge: `AGT001`
   - Username: `agent01`
   - Role: `agent`
   - Department: same department as supervisor

## Step 6: Seed Knowledge Base

Populate the Knowledge Base with initial articles so end users can find self-service solutions:

```sh
# From the backend directory
npm run seed-kb
```

Or manually:
1. Navigate to **Knowledge Base**
2. Create categories (e.g., "IT Support", "Facilities", "Medical Equipment")
3. Add articles to each category with bilingual content

## Step 7: Configure Cron Jobs

The system has three scheduled jobs managed by BullMQ:

| Job             | Schedule      | Purpose                              |
|-----------------|---------------|--------------------------------------|
| sla-check       | Every 5 min   | Check SLA warnings and breaches      |
| cleanup-exports | Daily 3:00 AM | Remove expired export files           |
| auto-archive    | Daily 4:00 AM | Archive resolved tickets >30 days old |

These are triggered via the jobs module (`backend/src/modules/jobs/jobs.module.ts`). Verify they're running:

```sql
-- Check recent SLA notifications
SELECT * FROM notifications WHERE event_type IN ('SLA_BREACH', 'SLA_WARNING') ORDER BY created_at DESC LIMIT 5;

-- Check auto-archive activity
SELECT * FROM audit_logs WHERE action = 'AUTO_ARCHIVED' ORDER BY created_at DESC LIMIT 5;
```

## Step 8: Production Readiness

### Checklist

- [ ] Replace default JWT secrets with production-grade secrets
- [ ] Set `NODE_ENV=production`
- [ ] Set `FRONTEND_URL` to your production domain
- [ ] Configure HTTPS (CSP HSTS is auto-enabled in production)
- [ ] Set up PostgreSQL backup schedule
- [ ] Mount `uploads/avatars` and `uploads/exports` to persistent volumes
- [ ] Configure Redis with appropriate persistence settings
- [ ] Review and set CORS origins to your production frontend URL
- [ ] Disable Swagger docs (automatic when `NODE_ENV=production`)
- [ ] Set up monitoring and log aggregation
- [ ] Test account lockout recovery procedures
- [ ] Create at least one backup and verify restore process

### Production Deployment Command

```sh
# Set environment in docker-compose.yml or via .env file
NODE_ENV=production
FRONTEND_URL=https://tickets.yourhospital.com

# Build and deploy
docker-compose up -d --build

# Verify all healthy
docker-compose ps

# Run migrations if applying to existing database
docker-compose exec backend npx prisma db push
```

## Step 9: Day 1 Operations

### As a Super Admin

1. **Review Audit Log**: Navigate to **Audit Logs** to see all system activity since setup
2. **Check Analytics**: Navigate to **Analytics** to verify dashboard loads with default data
3. **Browse Knowledge Base**: Verify articles are discoverable
4. **Test Ticket Flow**:
   - Log in as an end user → create a test ticket
   - Log in as an agent → accept, work, and resolve it
   - Log in as the end user → confirm resolution with a rating

### Useful Daily Commands

```sh
# Check service health
docker-compose ps

# View recent logs
docker-compose logs --tail 100 backend

# Database backup
pg_dump -h localhost -p 5445 -U johndoe -d abch_db | gzip > abch_$(date +%F).sql.gz

# Redis memory usage
docker-compose exec redis redis-cli INFO memory | grep "used_memory_human"
```

## Next Steps

After completing this quick start:

1. Read the **Deployment Guide** for detailed infrastructure configuration
2. Read the **Super Admin Guide** for detailed operational procedures
3. Read the **Operations Manual** for daily maintenance and monitoring
4. Read the **Administrator Guide** for overview of admin capabilities
5. Review the **Troubleshooting Guide** for known issues and resolutions

## Support Resources

- Swagger API docs (dev): `http://localhost:3007/api/docs`
- Prisma Studio (DB browser): `npx prisma studio` (runs on `localhost:5555`)
- Source code: `backend/src/` for backend modules, `frontend/src/` for frontend pages
- Database schema: `backend/prisma/schema.prisma` (22 models)