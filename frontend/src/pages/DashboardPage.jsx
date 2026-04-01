import { useEffect, useState } from 'react';
import { Users, ClipboardList, CheckCircle, CalendarDays, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import { fetchDashboardSummary } from '../services/dashboardService';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user, settings } = useAuth();
  const [summary, setSummary] = useState(null);
  const canViewOrgMetrics = !['employee', 'supervisor'].includes(user?.role);
  const canOpenEmployees = ['supervisor', 'admin', 'ceo'].includes(user?.role);
  const canOpenDocuments = ['employee', 'supervisor', 'admin', 'ceo'].includes(user?.role);
  const navigate = useNavigate();
  const roleLabel = user?.roleTitle || (user?.role ? user.role.toUpperCase() : '');
  const leaveSummaryTitle = user?.role === 'ceo' ? 'Leave Types' : 'My Leave Buckets';
  const leaveSummaryHelper = user?.role === 'ceo' ? 'Configured leave types available to the company' : 'Leave balances assigned to you';
  const documentSummaryTitle = user?.role === 'ceo' ? 'Documents' : 'My Documents';
  const documentSummaryHelper = user?.role === 'ceo' ? 'Company documents available to leadership' : 'Secure files available to you';

  useEffect(() => {
    fetchDashboardSummary().then(setSummary).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${settings?.branding?.organizationName || 'KEREA'} ${roleLabel || ''} ${settings?.labels?.dashboardTitleSuffix || 'Dashboard'}`.trim()}
        subtitle={settings?.interface?.dashboardHeroSubtitle}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {canViewOrgMetrics ? (
          <div className="relative">
            <StatCard title="Total Headcount" value={summary?.headcount ?? '--'} helper="Active non-deleted users" onClick={canOpenEmployees ? () => navigate('/employees') : undefined} />
            <div className="absolute right-3 top-3 rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-500 p-3 text-white shadow-sm"><Users size={18} /></div>
          </div>
        ) : null}
        {canViewOrgMetrics ? (
          <div className="relative">
            <StatCard title="Pending Leave Actions" value={summary?.pendingLeaves ?? '--'} helper="Awaiting executive review" accent="from-amber-600 to-orange-500" onClick={() => navigate('/leaves')} />
            <div className="absolute right-3 top-3 rounded-2xl bg-gradient-to-br from-amber-600 to-orange-500 p-3 text-white shadow-sm"><ClipboardList size={18} /></div>
          </div>
        ) : null}
        {canViewOrgMetrics ? (
          <div className="relative">
            <StatCard title="Approved Leave Requests" value={summary?.approvedLeaves ?? '--'} helper="Completed approvals" accent="from-blue-700 to-cyan-500" onClick={() => navigate('/leaves')} />
            <div className="absolute right-3 top-3 rounded-2xl bg-gradient-to-br from-blue-700 to-cyan-500 p-3 text-white shadow-sm"><CheckCircle size={18} /></div>
          </div>
        ) : null}
        <div className="relative">
          <StatCard title={leaveSummaryTitle} value={summary?.myLeaveBalanceTypes ?? '--'} helper={leaveSummaryHelper} accent="from-blue-700 to-cyan-500" onClick={() => navigate('/leaves')} />
          <div className="absolute right-3 top-3 rounded-2xl bg-gradient-to-br from-blue-700 to-cyan-500 p-3 text-white shadow-sm"><CalendarDays size={18} /></div>
        </div>
        <div className="relative">
          <StatCard title={documentSummaryTitle} value={summary?.myDocuments ?? '--'} helper={documentSummaryHelper} accent="from-violet-700 to-fuchsia-500" onClick={canOpenDocuments ? () => navigate('/documents') : undefined} />
          <div className="absolute right-3 top-3 rounded-2xl bg-gradient-to-br from-violet-700 to-fuchsia-500 p-3 text-white shadow-sm"><FileText size={18} /></div>
        </div>
      </div>

      <div>
        <SectionCard title={settings?.labels?.dashboardQuickActionsTitle || 'Quick actions'} subtitle={settings?.labels?.dashboardQuickActionsSubtitle || 'Jump straight into the areas you use most often.'}>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" className="rounded-2xl bg-brand-gradient px-4 py-4 text-left text-sm font-semibold text-white shadow-lg" onClick={() => navigate('/leaves')}>
              {settings?.labels?.dashboardOpenLeavesText || 'Open leave dashboard'}
            </button>
            <button type="button" className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left text-sm font-semibold text-slate-700" onClick={() => navigate('/profile')}>
              {settings?.labels?.dashboardOpenProfileText || 'Review my profile'}
            </button>
            {canOpenEmployees ? (
              <button type="button" className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left text-sm font-semibold text-slate-700" onClick={() => navigate('/employees')}>
                {settings?.labels?.dashboardOpenEmployeesText || 'Manage employees'}
              </button>
            ) : null}
            {canOpenDocuments ? (
              <button type="button" className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left text-sm font-semibold text-slate-700" onClick={() => navigate('/documents')}>
                {settings?.labels?.dashboardOpenDocumentsText || 'Open documents'}
              </button>
            ) : null}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
