/**
 * Local development seed — matches the CURRENT schema (enum-based RBAC).
 * The repo's seed.ts / seed-full.ts reference removed Role/Permission models and are broken.
 * Run:  npm run seed-local   (added to package.json)  — or  tsx prisma/seed-local.ts
 *
 * Login credentials (all users): password = Admin@123
 *   admin       → super_admin
 *   supervisor  → supervisor  (IT dept)
 *   agent       → agent       (IT dept)
 *   user        → end_user    (Reception dept)
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function cleanup() {
  // FK-safe order; ignore errors on a fresh DB
  const ops = [
    () => prisma.ticketStatusHistory.deleteMany(),
    () => prisma.ticketTransfer.deleteMany(),
    () => prisma.ticketMessage.deleteMany(),
    () => prisma.ticketAttachment.deleteMany(),
    () => prisma.ticket.deleteMany(),
    () => prisma.ticketType.deleteMany(),
    () => prisma.userPermissionOverride.deleteMany(),
    () => prisma.user.deleteMany(),
    () => prisma.deptTransferAllowlist.deleteMany(),
    () => prisma.department.deleteMany(),
    () => prisma.floor.deleteMany(),
    () => prisma.building.deleteMany(),
    () => prisma.deptPermissions.deleteMany(),
  ];
  for (const op of ops) {
    try { await op(); } catch { /* table may be empty */ }
  }
}

async function main() {
  console.log('🌱 Local seed (schema-accurate) starting...');
  await cleanup();

  const passwordHash = await bcrypt.hash('Admin@123', 12);

  // Department permission profiles
  const adminPerms = await prisma.deptPermissions.create({
    data: {
      canSendTickets: true,
      canArchiveTickets: true,
      canExportData: true,
      canViewAnalytics: true,
      canManageDeptUsers: true,
      canViewAuditLogs: true,
      canManageKnowledgeBase: true,
    },
  });
  const basePerms = await prisma.deptPermissions.create({ data: { canSendTickets: true } });

  // Location hierarchy
  const building = await prisma.building.create({
    data: { nameAr: 'المبنى الرئيسي', nameEn: 'Main Building' },
  });
  await prisma.floor.create({
    data: { nameAr: 'الطابق الأول', nameEn: 'First Floor', buildingId: building.id },
  });
  await prisma.floor.create({
    data: { nameAr: 'الطابق الثاني', nameEn: 'Second Floor', buildingId: building.id },
  });

  // Departments
  const itDept = await prisma.department.create({
    data: {
      nameAr: 'تقنية المعلومات',
      nameEn: 'Information Technology',
      descriptionAr: 'قسم الدعم الفني وتقنية المعلومات',
      descriptionEn: 'IT support and services',
      deptType: 'BOTH',
      defaultPermissionsId: adminPerms.id,
      slaHours: 8,
    },
  });
  const receptionDept = await prisma.department.create({
    data: {
      nameAr: 'الاستقبال',
      nameEn: 'Reception',
      deptType: 'SENDER_ONLY',
      defaultPermissionsId: basePerms.id,
      slaHours: 24,
    },
  });

  // Users
  await prisma.user.create({
    data: { badgeNumber: 'admin', username: 'admin', email: 'admin@nuzultech.local', passwordHash, fullNameAr: 'المدير العام', fullNameEn: 'Super Admin', role: 'super_admin', departmentId: itDept.id },
  });
  await prisma.user.create({
    data: { badgeNumber: 'supervisor', username: 'supervisor', email: 'supervisor@nuzultech.local', passwordHash, fullNameAr: 'مشرف تقنية المعلومات', fullNameEn: 'IT Supervisor', role: 'supervisor', departmentId: itDept.id },
  });
  await prisma.user.create({
    data: { badgeNumber: 'agent', username: 'agent', email: 'agent@nuzultech.local', passwordHash, fullNameAr: 'فني الدعم الفني', fullNameEn: 'Support Agent', role: 'agent', departmentId: itDept.id },
  });
  await prisma.user.create({
    data: { badgeNumber: 'user', username: 'user', email: 'user@nuzultech.local', passwordHash, fullNameAr: 'مستخدم عام', fullNameEn: 'End User', role: 'end_user', departmentId: receptionDept.id },
  });

  // Ticket types (IT department)
  await prisma.ticketType.createMany({
    data: [
      { nameAr: 'عطل في الجهاز', nameEn: 'Hardware Issue', departmentId: itDept.id, color: '#EF4444', slaHours: 8, displayOrder: 1 },
      { nameAr: 'مشكلة برمجية', nameEn: 'Software Issue', departmentId: itDept.id, color: '#3B82F6', slaHours: 12, displayOrder: 2 },
      { nameAr: 'طلب صلاحية دخول', nameEn: 'Access Request', departmentId: itDept.id, color: '#10B981', slaHours: 24, displayOrder: 3 },
      { nameAr: 'مشكلة في الشبكة', nameEn: 'Network Issue', departmentId: itDept.id, color: '#F59E0B', slaHours: 6, displayOrder: 4 },
    ],
  });

  console.log('✅ Local seed complete.');
  console.log('   Departments: IT, Reception | Users: admin, supervisor, agent, user');
  console.log('   Login → badge/username: admin  password: Admin@123');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
