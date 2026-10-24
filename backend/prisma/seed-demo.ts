/**
 * DEMO data seed — LOCAL DEVELOPMENT ONLY.
 *
 * Generates realistic sample content (tickets across every status/priority, chat
 * messages, SLA breaches, ratings, knowledge base, team feed, assets, notifications)
 * so dashboards and analytics have something to show.
 *
 * Run:  npm run seed-demo
 * Safe to re-run: it clears only the demo-generated rows first.
 *
 * ⚠️ NEVER run this against a live/production database.
 */
import { PrismaClient, TicketStatus, TicketPriority } from '@prisma/client';

const prisma = new PrismaClient();

const HOURS = 60 * 60 * 1000;
const DAYS = 24 * HOURS;

/** Deterministic pseudo-random so re-runs look the same. */
let seedState = 20260727;
function rand(): number {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
}
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const ago = (ms: number) => new Date(Date.now() - ms);

const SUBJECTS: Array<[string, string]> = [
  ['جهاز الكمبيوتر لا يعمل', 'الجهاز لا يقلع نهائياً بعد انقطاع الكهرباء صباح اليوم.'],
  ['الطابعة لا تستجيب', 'طابعة الاستقبال تظهر خطأ ورق محشور رغم عدم وجود ورق.'],
  ['بطء شديد في الشبكة', 'الأنظمة تفتح ببطء شديد منذ الصباح في الطابق الثاني.'],
  ['طلب صلاحية دخول للنظام', 'موظف جديد يحتاج حساب على نظام السجلات الطبية.'],
  ['مشكلة في نظام الأشعة', 'لا يمكن رفع صور الأشعة إلى النظام المركزي.'],
  ['شاشة العرض تومض', 'الشاشة في غرفة 204 تومض بشكل متقطع.'],
  ['نسيان كلمة المرور', 'المستخدم لا يستطيع الدخول بعد عدة محاولات.'],
  ['تركيب برنامج جديد', 'مطلوب تثبيت برنامج إدارة المختبر على 3 أجهزة.'],
  ['عطل في جهاز البصمة', 'جهاز البصمة عند المدخل الرئيسي لا يسجل الحضور.'],
  ['انقطاع الإنترنت', 'لا يوجد اتصال بالإنترنت في قسم العيادات الخارجية.'],
  ['مشكلة في البريد الإلكتروني', 'الرسائل الصادرة تبقى في صندوق المسودات.'],
  ['طلب صيانة دورية', 'صيانة وقائية لأجهزة القسم حسب الجدول الربع سنوي.'],
];

const RESOLUTIONS = [
  'تم استبدال كابل الطاقة وإعادة تشغيل الجهاز، ويعمل بشكل طبيعي الآن.',
  'أعيد ضبط إعدادات الطابعة وتم تحديث التعريف.',
  'تم تحديث إعدادات الشبكة وحل التعارض في عناوين IP.',
  'تم إنشاء الحساب ومنح الصلاحيات المطلوبة.',
  'تمت إعادة تهيئة الاتصال بالخادم المركزي.',
];

const AGENT_REPLIES = [
  'تم استلام الطلب، وسنبدأ الفحص خلال ساعة.',
  'قمنا بزيارة الموقع وجارٍ تشخيص المشكلة.',
  'نحتاج قطعة غيار، تم طلبها من المخزن.',
  'هل ما زالت المشكلة قائمة بعد إعادة التشغيل؟',
];

async function clearDemo() {
  // Order matters (FKs). Only touches transactional/demo tables.
  await prisma.ticketStatusHistory.deleteMany();
  await prisma.ticketTransfer.deleteMany();
  await prisma.messageAttachment.deleteMany();
  await prisma.ticketMessage.deleteMany();
  await prisma.ticketAttachment.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.teamNoteLike.deleteMany();
  await prisma.teamNoteComment.deleteMany();
  await prisma.teamNoteAttachment.deleteMany();
  await prisma.teamNote.deleteMany();
  await prisma.knowledgeArticle.deleteMany();
  await prisma.knowledgeCategory.deleteMany();
  await prisma.asset.deleteMany();
}

async function main() {
  console.log('🎬 Seeding DEMO data (local only)...');
  await clearDemo();

  const users = await prisma.user.findMany({ include: { department: true } });
  if (users.length === 0) throw new Error('No users found — run `npm run seed-local` first.');

  const admin = users.find((u) => u.role === 'super_admin')!;
  const supervisor = users.find((u) => u.role === 'supervisor') ?? admin;
  const agents = users.filter((u) => u.role === 'agent');
  const endUsers = users.filter((u) => u.role === 'end_user');
  const creators = endUsers.length ? endUsers : users;

  const depts = await prisma.department.findMany();
  const itDept = depts.find((d) => d.nameEn.toLowerCase().includes('information')) ?? depts[0];
  const types = await prisma.ticketType.findMany();
  const buildings = await prisma.building.findMany();
  const floors = await prisma.floor.findMany();

  // ---------- Assets ----------
  const assetData = [
    ['جهاز أشعة رقمي', 'RAD-2201', 'Medical Device', 'قسم الأشعة', 'active'],
    ['جهاز تخطيط قلب', 'ECG-1180', 'Medical Device', 'العناية المركزة', 'active'],
    ['خادم قاعدة البيانات', 'SRV-0042', 'IT Hardware', 'غرفة الخوادم', 'active'],
    ['طابعة ليزر', 'PRN-3310', 'IT Hardware', 'الاستقبال', 'maintenance'],
    ['جهاز كمبيوتر مكتبي', 'PC-7781', 'IT Hardware', 'العيادات', 'active'],
    ['جهاز بصمة', 'FP-0091', 'IT Hardware', 'المدخل الرئيسي', 'active'],
    ['شاشة عرض طبية', 'MON-5540', 'Medical Device', 'غرفة العمليات', 'retired'],
    ['موزع شبكة', 'SW-2280', 'Network', 'غرفة الاتصالات', 'active'],
  ];
  const assets = [];
  for (const [name, serial, type, location, status] of assetData) {
    assets.push(
      await prisma.asset.create({
        data: {
          name, serialNumber: serial, type, location, status,
          departmentId: itDept.id,
          purchaseDate: ago(int(200, 1200) * DAYS),
          warrantyExpiry: new Date(Date.now() + int(30, 900) * DAYS),
        },
      }),
    );
  }
  console.log(`  assets: ${assets.length}`);

  // ---------- Knowledge base ----------
  const kbCats = [];
  for (const [ar, en] of [
    ['مشاكل الأجهزة', 'Hardware Issues'],
    ['البرمجيات والأنظمة', 'Software & Systems'],
    ['الشبكة والاتصال', 'Network & Connectivity'],
    ['الحسابات والصلاحيات', 'Accounts & Access'],
  ]) {
    kbCats.push(await prisma.knowledgeCategory.create({ data: { nameAr: ar, nameEn: en } }));
  }

  const kbArticles: Array<[string, string, string, string, number]> = [
    ['كيف أعيد تشغيل جهازي بأمان', 'How to safely restart your PC', 'أغلق كل البرامج المفتوحة، ثم اختر «إعادة التشغيل» من قائمة ابدأ. لا تفصل الكهرباء مباشرة.', 'Close all open applications, then choose Restart from the Start menu. Never cut power directly.', 0],
    ['حل مشكلة الطابعة المحشورة', 'Fixing a paper jam', 'افتح الغطاء الخلفي، اسحب الورق برفق في اتجاه مسار الطباعة، ثم أعد تشغيل الطابعة.', 'Open the rear cover, gently pull the paper along the feed direction, then power-cycle the printer.', 0],
    ['خطوات الاتصال بشبكة المستشفى', 'Connecting to the hospital network', 'اختر شبكة ABC-Staff وأدخل بيانات حسابك الوظيفي. لا تستخدم شبكة الزوار للأنظمة الطبية.', 'Select ABC-Staff and sign in with your staff account. Do not use the guest network for clinical systems.', 2],
    ['طلب صلاحية جديدة', 'Requesting new access', 'قدّم تذكرة من نوع «طلب صلاحية» مرفقاً بها موافقة رئيس القسم.', 'Submit an Access Request ticket with your department head approval attached.', 3],
    ['ماذا تفعل عند بطء النظام', 'What to do when the system is slow', 'أغلق التبويبات غير المستخدمة، ثم أعد تشغيل المتصفح. إن استمرت المشكلة افتح تذكرة.', 'Close unused tabs and restart the browser. If it persists, open a ticket.', 1],
  ];
  for (const [tAr, tEn, cAr, cEn, catIdx] of kbArticles) {
    await prisma.knowledgeArticle.create({
      data: {
        titleAr: tAr, titleEn: tEn, contentAr: cAr, contentEn: cEn,
        categoryId: kbCats[catIdx].id, authorId: admin.id, views: int(5, 240),
      },
    });
  }
  console.log(`  knowledge: ${kbCats.length} categories, ${kbArticles.length} articles`);

  // ---------- Tickets ----------
  const STATUSES: TicketStatus[] = ['pending', 'open', 'in_progress', 'on_hold', 'resolved', 'closed'];
  const PRIORITIES: TicketPriority[] = ['low', 'normal', 'high', 'critical'];
  const DISTRIBUTION: TicketStatus[] = [
    ...Array(6).fill('pending'), ...Array(7).fill('open'), ...Array(8).fill('in_progress'),
    ...Array(3).fill('on_hold'), ...Array(9).fill('resolved'), ...Array(12).fill('closed'),
  ];

  let created = 0, messages = 0;
  for (let i = 0; i < DISTRIBUTION.length; i++) {
    const status = DISTRIBUTION[i];
    const [subject, description] = SUBJECTS[i % SUBJECTS.length];
    const creator = pick(creators);
    const assignee = ['pending'].includes(status) ? null : pick(agents.length ? agents : [supervisor]);
    const priority = pick(PRIORITIES);
    const building = buildings.length ? pick(buildings) : null;
    const floor = floors.length ? pick(floors) : null;
    const type = types.length ? pick(types) : null;

    const createdAt = ago(int(1, 45) * DAYS + int(0, 23) * HOURS);
    const slaHours = type?.slaHours ?? 24;
    const slaDeadline = new Date(createdAt.getTime() + slaHours * HOURS);

    const isDone = status === 'resolved' || status === 'closed';
    // ~25% of finished tickets breached SLA, so the dashboard shows a realistic mix.
    const breached = isDone && rand() < 0.25;
    const completedAt = isDone
      ? new Date(createdAt.getTime() + (breached ? slaHours * 1.6 : slaHours * 0.5) * HOURS)
      : null;

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-${String(1000 + i)}`,
        subject,
        description,
        createdById: creator.id,
        creatorName: creator.fullNameAr,
        creatorPhone: `0100${int(1000000, 9999999)}`,
        creatorExtension: String(int(1000, 9999)),
        creatorDeptId: creator.departmentId,
        creatorDeptName: creator.department?.nameAr ?? null,
        buildingId: building?.id ?? null,
        buildingName: building?.nameAr ?? null,
        floorId: floor?.id ?? null,
        floorName: floor?.nameAr ?? null,
        roomExtension: String(int(100, 599)),
        departmentId: itDept.id,
        assignedToId: assignee?.id ?? null,
        ticketTypeId: type?.id ?? null,
        status,
        priority,
        slaDeadline,
        dueDate: slaDeadline,
        assetId: rand() < 0.4 ? pick(assets).id : null,
        createdAt,
        currentQueueEntryAt: createdAt,
        firstResponseAt: status === 'pending' ? null : new Date(createdAt.getTime() + int(10, 240) * 60 * 1000),
        completedAt,
        closedAt: status === 'closed' ? completedAt : null,
        rating: status === 'closed' ? int(3, 5) : null,
        feedback: status === 'closed' && rand() < 0.5 ? 'خدمة سريعة ومحترفة، شكراً للفريق.' : null,
        slaWarningSent: breached,
        slaBreachSent: breached,
        requiresExternalResource: rand() < 0.15,
      },
    });
    created++;

    // conversation
    const replies = int(1, 3);
    for (let m = 0; m < replies; m++) {
      await prisma.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          senderId: m % 2 === 0 ? (assignee?.id ?? admin.id) : creator.id,
          messageType: rand() < 0.2 ? 'internal' : 'public',
          body: m % 2 === 0 ? pick(AGENT_REPLIES) : 'شكراً، في انتظار الحل.',
          createdAt: new Date(createdAt.getTime() + (m + 1) * int(1, 6) * HOURS),
        },
      });
      messages++;
    }
    if (isDone) {
      await prisma.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          senderId: assignee?.id ?? admin.id,
          messageType: 'public',
          body: pick(RESOLUTIONS),
          createdAt: completedAt!,
        },
      });
      messages++;
    }

    // status history
    await prisma.ticketStatusHistory.create({
      data: {
        ticketId: ticket.id,
        oldStatus: 'pending',
        newStatus: status,
        changedById: assignee?.id ?? admin.id,
        createdAt: new Date(createdAt.getTime() + 2 * HOURS),
      },
    });
  }
  console.log(`  tickets: ${created} (with ${messages} messages)`);

  // ---------- Team feed ----------
  const notes = [
    'تذكير: الصيانة الدورية لخوادم القسم يوم الخميس بعد الساعة 5 مساءً.',
    'تم تحديث دليل استخدام نظام السجلات الطبية — راجعوا المركز المعرفي.',
    'أهلاً بالزميل الجديد في فريق الدعم الفني 👋',
    'رجاءً إغلاق التذاكر المكتملة أولاً بأول لتحسين مؤشرات القسم.',
  ];
  for (const body of notes) {
    const note = await prisma.teamNote.create({
      data: { departmentId: itDept.id, authorId: pick([admin, supervisor]).id, body, createdAt: ago(int(1, 20) * DAYS) },
    });
    for (const u of users.slice(0, int(1, 3))) {
      await prisma.teamNoteLike.create({ data: { noteId: note.id, userId: u.id } }).catch(() => {});
    }
    if (rand() < 0.6) {
      await prisma.teamNoteComment.create({
        data: { noteId: note.id, authorId: pick(users).id, body: 'تمام، شكراً للتنبيه.' },
      });
    }
  }
  console.log(`  team notes: ${notes.length}`);

  // ---------- Notifications ----------
  const recent = await prisma.ticket.findMany({ take: 8, orderBy: { createdAt: 'desc' } });
  for (const t of recent) {
    await prisma.notification.create({
      data: {
        userId: t.assignedToId ?? admin.id,
        ticketId: t.id,
        eventType: 'ticket_assigned',
        titleAr: 'تذكرة جديدة',
        titleEn: 'New ticket',
        bodyAr: `تم إسناد التذكرة ${t.ticketNumber} إليك`,
        bodyEn: `Ticket ${t.ticketNumber} was assigned to you`,
        isRead: rand() < 0.5,
        createdAt: t.createdAt,
      },
    }).catch(() => {});
  }

  const total = await prisma.ticket.count();
  console.log(`\n✅ Demo data ready — ${total} tickets in the database.`);
}

main()
  .catch((e) => { console.error('❌ Demo seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
