import '../src/load-env';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Starting idempotent legacy database schema upgrade...');

  // 1. Ensure all native PostgreSQL enum types exist
  const enumStatements = [
    `DO $$ BEGIN
      CREATE TYPE "ticket_status" AS ENUM ('pending', 'open', 'in_progress', 'on_hold', 'resolved', 'closed');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      CREATE TYPE "ticket_priority" AS ENUM ('low', 'normal', 'high', 'critical');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      CREATE TYPE "user_role" AS ENUM ('super_admin', 'supervisor', 'agent', 'end_user');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      CREATE TYPE "dept_type_enum" AS ENUM ('SENDER_ONLY', 'RECEIVER_ONLY', 'BOTH');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      CREATE TYPE "holding_status_enum" AS ENUM ('internal', 'external');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'suspended', 'cancelled', 'expired');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      CREATE TYPE "BillingCycle" AS ENUM ('monthly', 'yearly');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'issued', 'paid', 'void');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  ];

  for (const sql of enumStatements) {
    await prisma.$executeRawUnsafe(sql);
  }
  console.log('✅ Verified PostgreSQL enum types.');

  // 2. Upgrade users.role from text/varchar to user_role enum if needed
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
          AND data_type IN ('text', 'character varying')
      ) THEN
        UPDATE "users" SET "role" = 'super_admin' WHERE "role" IN ('admin', 'superadmin', 'SUPER_ADMIN');
        UPDATE "users" SET "role" = 'supervisor' WHERE "role" IN ('dept_manager', 'manager', 'SUPERVISOR');
        UPDATE "users" SET "role" = 'agent' WHERE "role" IN ('staff', 'technician', 'AGENT');
        UPDATE "users" SET "role" = 'end_user' WHERE "role" NOT IN ('super_admin', 'supervisor', 'agent', 'end_user') OR "role" IS NULL;
        ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
        ALTER TABLE "users" ALTER COLUMN "role" TYPE "user_role" USING "role"::"user_role";
        ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'end_user'::"user_role";
      END IF;
    END $$;
  `);

  // 3. Upgrade tickets.status, tickets.priority, tickets.holding_status to enums if needed
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'status'
          AND data_type IN ('text', 'character varying')
      ) THEN
        UPDATE "tickets" SET "status" = 'pending' WHERE "status" NOT IN ('pending', 'open', 'in_progress', 'on_hold', 'resolved', 'closed') OR "status" IS NULL;
        ALTER TABLE "tickets" ALTER COLUMN "status" DROP DEFAULT;
        ALTER TABLE "tickets" ALTER COLUMN "status" TYPE "ticket_status" USING "status"::"ticket_status";
        ALTER TABLE "tickets" ALTER COLUMN "status" SET DEFAULT 'pending'::"ticket_status";
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'priority'
          AND data_type IN ('text', 'character varying')
      ) THEN
        UPDATE "tickets" SET "priority" = 'normal' WHERE "priority" IN ('medium', 'MID', 'NORMAL');
        UPDATE "tickets" SET "priority" = 'normal' WHERE "priority" NOT IN ('low', 'normal', 'high', 'critical') OR "priority" IS NULL;
        ALTER TABLE "tickets" ALTER COLUMN "priority" DROP DEFAULT;
        ALTER TABLE "tickets" ALTER COLUMN "priority" TYPE "ticket_priority" USING "priority"::"ticket_priority";
        ALTER TABLE "tickets" ALTER COLUMN "priority" SET DEFAULT 'normal'::"ticket_priority";
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'holding_status'
          AND data_type IN ('text', 'character varying')
      ) THEN
        UPDATE "tickets" SET "holding_status" = 'internal' WHERE "holding_status" NOT IN ('internal', 'external') OR "holding_status" IS NULL;
        ALTER TABLE "tickets" ALTER COLUMN "holding_status" DROP DEFAULT;
        ALTER TABLE "tickets" ALTER COLUMN "holding_status" TYPE "holding_status_enum" USING "holding_status"::"holding_status_enum";
        ALTER TABLE "tickets" ALTER COLUMN "holding_status" SET DEFAULT 'internal'::"holding_status_enum";
      END IF;
    END $$;
  `);

  // 4. Upgrade departments.dept_type to dept_type_enum if needed
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'departments' AND column_name = 'dept_type'
          AND data_type IN ('text', 'character varying')
      ) THEN
        UPDATE "departments" SET "dept_type" = 'RECEIVER_ONLY' WHERE "dept_type" NOT IN ('SENDER_ONLY', 'RECEIVER_ONLY', 'BOTH') OR "dept_type" IS NULL;
        ALTER TABLE "departments" ALTER COLUMN "dept_type" DROP DEFAULT;
        ALTER TABLE "departments" ALTER COLUMN "dept_type" TYPE "dept_type_enum" USING "dept_type"::"dept_type_enum";
        ALTER TABLE "departments" ALTER COLUMN "dept_type" SET DEFAULT 'RECEIVER_ONLY'::"dept_type_enum";
      END IF;
    END $$;
  `);
  console.log('✅ Verified enum columns on users, tickets, and departments.');

  // 5. Upgrade tickets.related_tickets and user_permission_overrides.allowed_transfer_dept_ids from text to jsonb
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'related_tickets'
          AND data_type IN ('text', 'character varying')
      ) THEN
        ALTER TABLE "tickets" ALTER COLUMN "related_tickets" DROP DEFAULT;
        ALTER TABLE "tickets" ALTER COLUMN "related_tickets" TYPE jsonb
          USING CASE
            WHEN "related_tickets" IS NULL OR btrim("related_tickets") = '' THEN '[]'::jsonb
            ELSE "related_tickets"::jsonb
          END;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_permission_overrides' AND column_name = 'allowed_transfer_dept_ids'
          AND data_type IN ('text', 'character varying')
      ) THEN
        ALTER TABLE "user_permission_overrides" ALTER COLUMN "allowed_transfer_dept_ids" DROP DEFAULT;
        ALTER TABLE "user_permission_overrides" ALTER COLUMN "allowed_transfer_dept_ids" TYPE jsonb
          USING CASE
            WHEN "allowed_transfer_dept_ids" IS NULL OR btrim("allowed_transfer_dept_ids") = '' THEN '[]'::jsonb
            ELSE "allowed_transfer_dept_ids"::jsonb
          END;
      END IF;
    END $$;
  `);
  console.log('✅ Verified JSONB columns on tickets and user_permission_overrides.');

  // 6. Reset any expired account lockouts and ensure active accounts with badge_number/username can sign in
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
      ) THEN
        UPDATE "users"
        SET "lock_until" = NULL, "failed_login_attempts" = 0
        WHERE "lock_until" IS NOT NULL AND "lock_until" < NOW();

        UPDATE "users"
        SET "is_active" = true
        WHERE "deleted_at" IS NULL AND "badge_number" IS NOT NULL AND "username" IS NOT NULL AND "is_active" IS NULL;
      END IF;
    END $$;
  `);
  console.log('✅ Verified user account lockouts and active flags.');
  console.log('🎉 Legacy database upgrade completed successfully.');
}

main()
  .catch((err) => {
    console.error('❌ Legacy DB upgrade failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
