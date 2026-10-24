import React, { useState } from 'react';
import ErrorBanner from '../../components/ErrorBanner.tsx';
import {
  Shield,
  Check,
  X,
  Building2,
  UserCheck,
  Save,
  RefreshCw,
} from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore.ts';
import { translations } from '../../core/translations.ts';
import { apiFetch } from '../../core/api.ts';
import { useAdminList } from '../../core/hooks/useAdmin.ts';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';

interface DeptPermissions {
  id: number;
  canReceiveTickets: boolean;
  canSendTickets: boolean;
  canViewAllDeptTickets: boolean;
  canAssignTickets: boolean;
  canChangeStatus: boolean;
  canTransferTickets: boolean;
  canArchiveTickets: boolean;
  canExportData: boolean;
  canViewAnalytics: boolean;
  canManageTeamNotes: boolean;
  canManageDeptUsers: boolean;
  canViewAuditLogs: boolean;
  canManageKnowledgeBase: boolean;
}

interface Department {
  id: number;
  nameAr: string;
  nameEn: string;
  deptType: string;
  isActive: boolean;
  defaultPermissions: DeptPermissions;
  _count?: { users: number };
}

const PERMISSION_KEYS: Array<{
  key: keyof Omit<DeptPermissions, 'id'>;
  labelAr: string;
  labelEn: string;
}> = [
  { key: 'canReceiveTickets', labelAr: 'استقبال التذاكر', labelEn: 'Receive Tickets' },
  { key: 'canSendTickets', labelAr: 'إرسال التذاكر', labelEn: 'Send Tickets' },
  { key: 'canViewAllDeptTickets', labelAr: 'عرض جميع تذاكر القسم', labelEn: 'View All Dept Tickets' },
  { key: 'canAssignTickets', labelAr: 'تعيين التذاكر للموظفين', labelEn: 'Assign Tickets' },
  { key: 'canChangeStatus', labelAr: 'تغيير حالة التذكرة', labelEn: 'Change Status' },
  { key: 'canTransferTickets', labelAr: 'تحويل التذاكر لأقسام أخرى', labelEn: 'Transfer Tickets' },
  { key: 'canArchiveTickets', labelAr: 'أرشفة التذاكر المغلقة', labelEn: 'Archive Tickets' },
  { key: 'canExportData', labelAr: 'تصدير التقارير والبيانات', labelEn: 'Export Data' },
  { key: 'canViewAnalytics', labelAr: 'عرض التحليلات والإحصائيات', labelEn: 'View Analytics' },
  { key: 'canManageTeamNotes', labelAr: 'إدارة ملاحظات الفريق', labelEn: 'Manage Team Notes' },
  { key: 'canManageDeptUsers', labelAr: 'إدارة مستخدمي القسم', labelEn: 'Manage Dept Users' },
  { key: 'canViewAuditLogs', labelAr: 'عرض سجلات التدقيق', labelEn: 'View Audit Logs' },
  { key: 'canManageKnowledgeBase', labelAr: 'إدارة المركز المعرفي', labelEn: 'Manage Knowledge Base' },
];

const SYSTEM_ROLES = [
  {
    code: 'super_admin',
    nameAr: 'مدير النظام العام (Super Admin)',
    nameEn: 'Super Admin',
    descAr: 'صلاحية كاملة على جميع الأقسام، التذاكر، المستخدمين، التحليلات، وسجلات التدقيق بدون قيود.',
    descEn: 'Unrestricted access across all departments, tickets, users, analytics, and audit logs.',
    badgeClass: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  },
  {
    code: 'supervisor',
    nameAr: 'مشرف قسم (Supervisor)',
    nameEn: 'Department Supervisor',
    descAr: 'إدارة تذاكر القسم، تعيين الموظفين، الأرشفة، ومتابعة تقارير الأداء والالتزام بـ SLA داخل القسم.',
    descEn: 'Manages department tickets, agent assignments, archiving, and department SLA analytics.',
    badgeClass: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  },
  {
    code: 'agent',
    nameAr: 'موظف دعم فني (Agent)',
    nameEn: 'Support Agent',
    descAr: 'معالجة التذاكر المسندة إليه أو لقسمه، الرد على المستخدمين، وتحديث حالة التذاكر حسب مصفوفة القسم.',
    descEn: 'Handles assigned/department tickets, replies to users, and updates status per department defaults.',
    badgeClass: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  {
    code: 'end_user',
    nameAr: 'مستخدم نهائي / طالب خدمة (End User)',
    nameEn: 'End User / Requester',
    descAr: 'إنشاء تذاكر جديدة، متابعة تذاكره الخاصة، إرفاق ملفات/تسجيلات صوتية، وتأكيد الحل مع التقييم.',
    descEn: 'Creates tickets, tracks own requests, uploads attachments/voice notes, and confirms resolution.',
    badgeClass: 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]',
  },
];

export const RoleManagementPage: React.FC = () => {
  const { language } = useSettingsStore();
  const t = translations[language];
  const queryClient = useQueryClient();

  const { data: departments = [], isLoading: loading, error: queryError, refetch } = useAdminList<Department>(
    '/api/admin/departments',
    ['admin', 'departments'],
  );

  const [savingDeptId, setSavingDeptId] = useState<number | null>(null);
  const [localEdits, setLocalEdits] = useState<Record<number, Partial<DeptPermissions>>>({});
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const getPermValue = (dept: Department, key: keyof Omit<DeptPermissions, 'id'>): boolean => {
    if (localEdits[dept.id] && localEdits[dept.id][key] !== undefined) {
      return Boolean(localEdits[dept.id][key]);
    }
    return Boolean(dept.defaultPermissions?.[key]);
  };

  const toggleDeptPerm = (dept: Department, key: keyof Omit<DeptPermissions, 'id'>) => {
    const currentVal = getPermValue(dept, key);
    setLocalEdits((prev) => ({
      ...prev,
      [dept.id]: {
        ...(prev[dept.id] || {}),
        [key]: !currentVal,
      },
    }));
  };

  const saveDeptPermissions = async (dept: Department) => {
    const changes = localEdits[dept.id];
    if (!changes || Object.keys(changes).length === 0) return;

    setSavingDeptId(dept.id);
    setError(null);
    try {
      await apiFetch(`/api/admin/departments/${dept.id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({
          ...dept.defaultPermissions,
          ...changes,
        }),
      });
      setLocalEdits((prev) => {
        const next = { ...prev };
        delete next[dept.id];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'departments'] });
      setSuccessMsg(
        language === 'ar'
          ? `تم حفظ صلاحيات قسم "${dept.nameAr}" بنجاح`
          : `Saved permissions for "${dept.nameEn}"`,
      );
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to update department permissions');
    } finally {
      setSavingDeptId(null);
    }
  };

  return (
    <div className="p-6 space-y-8">
      <ErrorBanner error={error || queryError?.message || null} onDismiss={() => setError(null)} />

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-sm font-bold flex items-center gap-2">
          <Check size={18} />
          {successMsg}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-main)] flex items-center gap-3">
            <Shield className="text-primary-blue" />
            {t.rolesPermissions}
          </h1>
          <p className="text-[var(--text-secondary)] mt-1">
            {language === 'ar'
              ? 'إدارة الأدوار الأساسية في النظام وضبط مصفوفة الصلاحيات الافتراضية لكل قسم (مع إمكانية تخصيص استثناءات لكل مستخدم من صفحة المستخدمين).'
              : 'View core system roles and configure default permission matrices per department (individual user overrides can be set in User Management).'}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 rounded-xl border border-[var(--border-main)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] flex items-center gap-2 text-sm font-bold transition-all"
        >
          <RefreshCw size={16} />
          {language === 'ar' ? 'تحديث' : 'Refresh'}
        </button>
      </div>

      {/* System Roles Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {SYSTEM_ROLES.map((role) => (
          <motion.div
            key={role.code}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border-main)] shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${role.badgeClass}`}>
                  {role.code}
                </span>
                <UserCheck size={18} className="text-[var(--text-muted)]" />
              </div>
              <h3 className="text-base font-bold text-[var(--text-main)] mb-1">
                {language === 'ar' ? role.nameAr : role.nameEn}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {language === 'ar' ? role.descAr : role.descEn}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Department Default Permission Matrix */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="text-primary-blue" size={20} />
          <h2 className="text-lg font-bold text-[var(--text-main)]">
            {language === 'ar' ? 'مصفوفة الصلاحيات الافتراضية للأقسام' : 'Department Default Permission Matrix'}
          </h2>
        </div>

        {loading ? (
          <div className="text-center py-12 text-[var(--text-muted)]">{t.loading}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {departments.map((dept) => {
              const hasUnsaved = Boolean(localEdits[dept.id] && Object.keys(localEdits[dept.id]).length > 0);
              return (
                <div
                  key={dept.id}
                  className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-main)] p-6 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-[var(--border-dim)] pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-[var(--text-main)]">
                        {language === 'ar' ? dept.nameAr : dept.nameEn}
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {dept.deptType} • {dept._count?.users || 0} {t.employees}
                      </p>
                    </div>
                    {hasUnsaved && (
                      <button
                        onClick={() => saveDeptPermissions(dept)}
                        disabled={savingDeptId === dept.id}
                        className="bg-primary-blue hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
                      >
                        <Save size={14} />
                        {savingDeptId === dept.id
                          ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...')
                          : (language === 'ar' ? 'حفظ التغييرات' : 'Save Changes')}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {PERMISSION_KEYS.map((perm) => {
                      const enabled = getPermValue(dept, perm.key);
                      return (
                        <button
                          key={perm.key}
                          type="button"
                          onClick={() => toggleDeptPerm(dept, perm.key)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                            enabled
                              ? 'bg-primary-blue/5 border-primary-blue/30 text-[var(--text-main)]'
                              : 'bg-[var(--bg-main)] border-[var(--border-dim)] text-[var(--text-muted)]'
                          }`}
                        >
                          <span className="text-xs font-semibold">
                            {language === 'ar' ? perm.labelAr : perm.labelEn}
                          </span>
                          <span
                            className={`w-5 h-5 rounded-md flex items-center justify-center ${
                              enabled ? 'bg-primary-blue text-white' : 'bg-[var(--border-dim)] text-[var(--text-muted)]'
                            }`}
                          >
                            {enabled ? <Check size={12} /> : <X size={12} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default RoleManagementPage;
