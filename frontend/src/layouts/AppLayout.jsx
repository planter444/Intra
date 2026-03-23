import { Link, NavLink, useLocation } from 'react-router-dom';
import { ClipboardList, FileText, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, User, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import BrandLogo from '../components/BrandLogo';
import { useAuth } from '../context/AuthContext';
import { fetchDocuments } from '../services/documentService';
import { fetchLeaveRequests } from '../services/leaveService';
import { getPendingReviewCount } from '../utils/leave';

const SEEN_DOCUMENT_IDS_KEY = 'kerea_hrms_seen_document_ids';
const getSeenDocumentIdsStorageKey = (userId) => `${SEEN_DOCUMENT_IDS_KEY}_${userId}`;

const routeMap = {
  dashboard: '/dashboard',
  profile: '/profile',
  employees: '/employees',
  leaves: '/leaves',
  documents: '/documents',
  settings: '/settings',
  audit: '/audit-logs'
};

const labelKeyMap = {
  dashboard: 'navigationDashboard',
  employees: 'navigationEmployees',
  leaves: 'navigationLeaves',
  documents: 'navigationDocuments',
  settings: 'navigationSettings',
  audit: 'navigationAudit'
};

const iconMap = {
  dashboard: LayoutDashboard,
  profile: User,
  employees: Users,
  leaves: ClipboardList,
  documents: FileText,
  settings: Settings,
  audit: ShieldCheck
};

const defaultNavigationByRole = {
  employee: ['dashboard', 'profile', 'leaves', 'documents'],
  supervisor: ['dashboard', 'employees', 'profile', 'leaves', 'documents'],
  hr: ['dashboard', 'employees', 'profile', 'leaves', 'documents'],
  admin: ['dashboard', 'employees', 'profile', 'leaves', 'documents', 'settings', 'audit'],
  ceo: ['dashboard', 'employees', 'profile', 'leaves', 'documents', 'settings']
};

export default function AppLayout({ children }) {
  const { user, settings, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [documentNotificationCount, setDocumentNotificationCount] = useState(0);
  const location = useLocation();
  const roleDisplay = user?.role === 'hr' || user?.role === 'ceo'
    ? 'CEO'
    : user?.role?.toUpperCase();
  const mobileMenuOpenStyle = {
    backgroundColor: settings?.branding?.mobileMenuOpenBackgroundColor || '#ffffff',
    color: settings?.branding?.mobileMenuOpenTextColor || '#475569',
    borderColor: settings?.branding?.mobileMenuOpenBorderColor || '#e2e8f0'
  };
  const mobileMenuCloseStyle = {
    backgroundColor: settings?.branding?.mobileMenuCloseBackgroundColor || '#166534',
    color: settings?.branding?.mobileMenuCloseTextColor || '#ffffff',
    borderColor: settings?.branding?.mobileMenuCloseBorderColor || '#22c55e'
  };

  const navigation = useMemo(() => {
    const fallbackItems = defaultNavigationByRole[user?.role] || ['dashboard'];
    const configuredItems = settings?.navigation?.[user?.role] || [];
    const navItems = [...new Set([...fallbackItems, ...configuredItems])];
    return navItems.map((key) => ({
      key,
      label: user?.role === 'supervisor' && key === 'employees'
        ? 'My Team'
        : settings?.labels?.[labelKeyMap[key]] || key.charAt(0).toUpperCase() + key.slice(1),
      path: routeMap[key]
    }));
  }, [settings, user]);

  useEffect(() => {
    if (!['supervisor', 'hr', 'ceo'].includes(user?.role)) {
      setPendingReviewCount(0);
      return;
    }

    const refreshPendingReviewCount = () => {
      fetchLeaveRequests()
        .then((requests) => setPendingReviewCount(getPendingReviewCount(requests, user)))
        .catch(() => setPendingReviewCount(0));
    };

    refreshPendingReviewCount();
    window.addEventListener('leave-requests-updated', refreshPendingReviewCount);
    return () => window.removeEventListener('leave-requests-updated', refreshPendingReviewCount);
  }, [user]);

  useEffect(() => {
    if (user?.role !== 'ceo') {
      setDocumentNotificationCount(0);
      return;
    }

    const refreshDocumentNotifications = () => {
      fetchDocuments()
        .then((documents) => {
          const scopedSeenIds = JSON.parse(localStorage.getItem(getSeenDocumentIdsStorageKey(user?.id)) || 'null');
          const legacySeenIds = JSON.parse(localStorage.getItem(SEEN_DOCUMENT_IDS_KEY) || '[]');
          const seenDocumentIds = new Set((Array.isArray(scopedSeenIds) ? scopedSeenIds : legacySeenIds).map(String));
          setDocumentNotificationCount(documents.filter((document) => String(document.uploadedBy) !== String(user?.id) && !seenDocumentIds.has(String(document.id))).length);
        })
        .catch(() => setDocumentNotificationCount(0));
    };

    refreshDocumentNotifications();
    window.addEventListener('documents-seen-updated', refreshDocumentNotifications);
    return () => window.removeEventListener('documents-seen-updated', refreshDocumentNotifications);
  }, [user?.id, user?.role]);

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="min-h-screen bg-surface-page text-text-primary">
      <div className="flex min-h-screen overflow-x-hidden">
        <aside className={`fixed inset-y-0 left-0 z-40 w-72 max-w-[88vw] transform bg-brand-gradient px-5 py-6 text-white shadow-2xl transition md:static md:flex md:h-screen md:flex-col md:translate-x-0 md:overflow-hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between">
            <Link to="/dashboard" className="flex items-center gap-3" onClick={closeMobile}>
              <BrandLogo
                logoUrl={settings?.branding?.faviconUrl}
                fallbackText={settings?.branding?.logoText || 'KH'}
                alt={`${settings?.branding?.organizationName || 'KEREA'} logo`}
                className="h-12 w-12"
                imageClassName="h-full w-full object-contain p-2"
                surfaceClassName="bg-white/12 backdrop-blur-sm"
              />
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">{settings?.branding?.organizationName || 'KEREA'}</p>
                <h1 className="truncate text-lg font-semibold">{settings?.branding?.appName || 'HRMS'}</h1>
              </div>
            </Link>
            <button className="rounded-xl border p-2 shadow-md md:hidden" style={mobileMenuCloseStyle} onClick={closeMobile}>
              <X size={18} />
            </button>
          </div>

          <div className="mt-8 rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wide text-white/50">Signed in as</p>
            <p className="mt-2 text-lg font-semibold">{user?.fullName}</p>
            <p className="text-sm text-white/70">{roleDisplay} · {user?.departmentName || 'KEREA'}</p>
          </div>

          <nav className="mt-8 space-y-2 md:min-h-0 md:flex-1 md:overflow-y-auto md:pr-1">
            {navigation.map((item) => {
              const Icon = iconMap[item.key] || User;

              return (
                <NavLink
                  key={item.key}
                  to={item.path}
                  onClick={closeMobile}
                  className={({ isActive }) => `flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${isActive ? 'bg-white text-emerald-900 shadow-lg' : 'text-white/90 hover:bg-white/15 hover:text-white'}`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="w-4 text-center"><Icon size={16} /></span>
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.key === 'leaves' && pendingReviewCount > 0 ? (
                    <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white">
                      +{pendingReviewCount}
                    </span>
                  ) : item.key === 'documents' && documentNotificationCount > 0 ? (
                    <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white">
                      +{documentNotificationCount}
                    </span>
                  ) : null}
                </NavLink>
              );
            })}
          </nav>

          <button
            onClick={logout}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-medium text-white hover:bg-white/15 md:shrink-0"
          >
            <LogOut size={16} />
            Logout
          </button>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur md:px-8">
            <div className="flex min-w-0 items-center justify-between gap-3 sm:gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  className="rounded-2xl border p-2 shadow-md md:hidden"
                  style={mobileMenuOpenStyle}
                  onClick={() => setMobileOpen((current) => !current)}
                >
                  <Menu size={18} />
                </button>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">KEREA intranet</p>
                  <h2 className="break-words text-[15px] font-semibold leading-tight text-slate-900 sm:truncate sm:text-lg">
                    {settings?.labels?.dashboardWelcome || 'Welcome back'}, {user?.firstName}
                  </h2>
                </div>
              </div>
              <Link to="/profile" className="flex shrink-0 items-center gap-3 rounded-2xl bg-brand-gradient px-3 py-2 text-white shadow-lg sm:px-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow">
                  <User size={16} />
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold text-white">{user?.fullName}</p>
                  <p className="text-xs uppercase tracking-wide text-white/80">{location.pathname}</p>
                </div>
              </Link>
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 md:px-8">{children}</main>
        </div>
      </div>
      {mobileOpen ? <div className="fixed inset-0 z-30 bg-slate-950/40 md:hidden" onClick={closeMobile} /> : null}
    </div>
  );
}
