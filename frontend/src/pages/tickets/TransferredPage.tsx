import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore.ts';
import { useSettingsStore } from '../../store/settingsStore.ts';
import { translations } from '../../core/translations.ts';
import { useTicketList } from '../../core/hooks/useTickets.ts';
import ErrorBanner from '../../components/ErrorBanner.tsx';
import { Search, RefreshCw, ArrowUpDown } from 'lucide-react';

interface Ticket {
  id: number;
  ticketNumber: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  creatorName: string;
  ticketType?: { nameAr: string; nameEn: string; color: string };
  assignedTo?: { fullNameAr: string; fullNameEn: string };
  transfers?: {
    fromDepartment: { nameAr: string; nameEn: string };
    toDepartment: { nameAr: string; nameEn: string };
    transferredBy: { fullNameEn: string; fullNameAr: string };
    createdAt: string;
  }[];
}

export default function TransferredPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading: loading, error: queryError, refetch } = useTicketList(
    { page: currentPage, limit: 20, search: searchTerm },
    '/api/tickets/transferred'
  );

  const tickets = data?.tickets || [];
  const pagination = data?.pagination || { total: 0, page: 1, limit: 20, pages: 1 };
  const error = queryError?.message || null;

  const { user } = useAuthStore();
  const { language } = useSettingsStore();
  const t = translations[language];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig?.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const sortedTickets = [...tickets].sort((a: any, b: any) => {
    if (!sortConfig) return 0;
    if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
    if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const statusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-warning-amber/10 text-warning-amber',
      open: 'bg-primary-blue/10 text-primary-blue',
      in_progress: 'bg-indigo-500/10 text-indigo-500',
      resolved: 'bg-success-green/10 text-success-green',
      closed: 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]',
    };
    return colors[status] || 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]';
  };

  const priorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]',
      normal: 'bg-primary-blue/10 text-primary-blue',
      high: 'bg-orange-500/10 text-orange-500',
      critical: 'bg-danger-red/10 text-danger-red',
    };
    return colors[priority] || 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]';
  };

  return (
    <div className="space-y-6">
      <ErrorBanner error={error} onRetry={() => refetch()} onDismiss={() => {}} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RefreshCw size={26} className="text-primary-blue" />
          <h1 className="text-2xl font-bold text-[var(--text-main)]">
            {t.transferredTickets}
          </h1>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2 rounded-xl hover:bg-[var(--bg-elevated)] transition-colors"
        >
          <RefreshCw size={20} className="text-[var(--text-secondary)]" />
        </button>
      </div>

      <form onSubmit={handleSearch}>
        <div className="relative">
          <Search size={18} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t.searchTransferred}
            className="input-surface w-full ps-10 pe-4 py-2.5"
          />
        </div>
      </form>

      <div className="premium-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start">
            <thead>
              <tr className="border-b border-[var(--border-dim)] bg-[var(--border-dim)]/30">
                <th className="text-start px-6 py-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest cursor-pointer" onClick={() => handleSort('ticketNumber')}>
                  <span className="flex items-center gap-1">{t.ticketNumber} <ArrowUpDown size={12} /></span>
                </th>
                <th className="text-start px-6 py-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest cursor-pointer" onClick={() => handleSort('subject')}>
                  <span className="flex items-center gap-1">{t.subject} <ArrowUpDown size={12} /></span>
                </th>
                <th className="text-start px-6 py-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{t.fromDept}</th>
                <th className="text-start px-6 py-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{t.status}</th>
                <th className="text-start px-6 py-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{t.priority}</th>
                <th className="text-start px-6 py-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{t.transferredAt}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-dim)]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[var(--text-muted)]">
                    {t.loading}
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[var(--text-muted)]">
                    {t.noTransferredTickets}
                  </td>
                </tr>
              ) : (
                sortedTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className="hover:bg-[var(--bg-main)] cursor-pointer transition-colors"
                    onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: `/tickets/${ticket.id}` }))}
                  >
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-bold text-primary-blue bg-primary-blue/5 px-2 py-1 rounded-lg">
                        {ticket.ticketNumber}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-[var(--text-main)] max-w-xs truncate">
                      {ticket.subject || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">
                      {ticket.transfers?.[0]
                        ? (language === 'ar' ? ticket.transfers[0].fromDepartment.nameAr : ticket.transfers[0].fromDepartment.nameEn)
                        : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${statusColor(ticket.status)}`}>
                        {t[ticket.status as keyof typeof t] || ticket.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${priorityColor(ticket.priority)}`}>
                        {t[ticket.priority as keyof typeof t] || ticket.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-[var(--text-secondary)]">
                      {ticket.transfers?.[0]
                        ? new Date(ticket.transfers[0].createdAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-GB')
                        : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setCurrentPage(p)}
              className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-colors ${
                p === currentPage
                  ? 'bg-primary-blue text-white shadow-md shadow-primary-blue/20'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--border-dim)]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
