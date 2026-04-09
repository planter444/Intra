import { Link, NavLink, useLocation } from 'react-router-dom';
import { ClipboardList, FileText, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, User, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import BrandLogo from '../components/BrandLogo';
import { useAuth } from '../context/AuthContext';
import { fetchDocuments, getDocumentUrl } from '../services/documentService';
import { fetchLeaveRequests } from '../services/leaveService';
import { getPendingReviewCount } from '../utils/leave';
import { getRedesignedTheme, isRedesignedActive, withOpacity } from '../hooks/usePagePresentation';

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
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();
  const redesignedActive = isRedesignedActive(settings);
  const redesignedTheme = redesignedActive ? getRedesignedTheme(settings) : null;
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
          setDocumentNotificationCount(
            documents.filter((document) => document.folderType !== 'branding' && document.folderType !== 'profile')
              .filter((document) => String(document.uploadedBy) !== String(user?.id) && !seenDocumentIds.has(String(document.id))).length
          );
        })
        .catch(() => setDocumentNotificationCount(0));
    };

    refreshDocumentNotifications();
    window.addEventListener('documents-seen-updated', refreshDocumentNotifications);
    return () => window.removeEventListener('documents-seen-updated', refreshDocumentNotifications);
  }, [user?.id, user?.role]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setProfilePhotoUrl('');
      return;
    }

    const load = () => {
      fetchDocuments({ userId: user.id })
        .then((documents) => {
          const photo = documents.find((doc) => doc.folderType === 'profile');
          setProfilePhotoUrl(photo ? getDocumentUrl(photo.id, true) : '');
        })
        .catch(() => setProfilePhotoUrl(''));
    };

    load();
    window.addEventListener('documents-seen-updated', load);
    return () => window.removeEventListener('documents-seen-updated', load);
  }, [user?.id]);

  const pageKey = useMemo(() => {
    const path = location.pathname || '';
    const entries = Object.entries(routeMap);
    const found = entries.find(([key, value]) => path.startsWith(value));
    return found ? found[0] : 'dashboard';
  }, [location.pathname]);

  const backgroundUrl = useMemo(() => {
    const bgs = settings?.interface?.backgrounds || {};
    const variantKey = redesignedActive ? 'redesigned' : 'original';
    const cfg = bgs?.[variantKey] || {};
    const perPage = cfg?.perPage || {};
    const pageValue = perPage?.[pageKey];

    const pick = (value) => {
      if (!value && value !== '') return '';
      if (value === '') return '';
      if (typeof value === 'object' && value) {
        const chosen = isMobile ? value.mobile : value.desktop;
        return chosen || '';
      }
      return value || '';
    };

    let src = pick(pageValue);
    if (!src && src !== '') {
      const defDesktop = cfg.defaultDesktopUrl || cfg.defaultImageUrl || (redesignedActive ? (settings?.interface?.uiVariant?.redesignedTheme?.backgroundImageUrl || '') : '');
      const defMobile = cfg.defaultMobileUrl || cfg.defaultImageUrl || defDesktop;
      src = isMobile ? defMobile : defDesktop;
    }

    if (src === '') return '';
    const match = String(src || '').match(/^document:(\d+)$/i);
    if (match) {
      return getDocumentUrl(match[1], true);
    }
    return src || '';
  }, [settings?.interface?.backgrounds, settings?.interface?.uiVariant?.redesignedTheme?.backgroundImageUrl, redesignedActive, pageKey, isMobile]);

  const backgroundImageOpacity = useMemo(() => {
    const value = Number(settings?.interface?.backgrounds?.imageOpacity ?? 1);
    if (Number.isNaN(value)) return 1;
    return Math.min(1, Math.max(0, value));
  }, [settings?.interface?.backgrounds?.imageOpacity]);

  const navigationActiveColor = settings?.interface?.navigationActiveColor || '#fef08a';

  // Navigation (menu) blur settings per device
  const navBlurDesktopEnabled = Boolean(settings?.interface?.navigationBlur?.desktop?.enabled);
  const navBlurDesktopPx = Math.max(0, Math.min(40, Number(settings?.interface?.navigationBlur?.desktop?.blurPx ?? 0)));
  const navBlurMobileEnabled = Boolean(settings?.interface?.navigationBlur?.mobile?.enabled);
  const navBlurMobilePx = Math.max(0, Math.min(40, Number(settings?.interface?.navigationBlur?.mobile?.blurPx ?? 0)));
  const menuBlurEnabled = isMobile ? navBlurMobileEnabled : navBlurDesktopEnabled;
  const menuBlurPx = isMobile ? navBlurMobilePx : navBlurDesktopPx;

  // Compute sidebar (menu) background style: green-tinted, semi-transparent when blur is on
  const gradientFrom = redesignedActive ? (redesignedTheme?.sidebarGradientFrom || '#14532d') : (settings?.branding?.gradientFrom || '#14532d');
  const gradientTo = redesignedActive ? (redesignedTheme?.sidebarGradientTo || '#22c55e') : (settings?.branding?.gradientTo || '#22c55e');
  const sidebarBackgroundImage = `linear-gradient(135deg, ${withOpacity(gradientFrom, menuBlurEnabled ? 0.78 : 1)}, ${withOpacity(gradientTo, menuBlurEnabled ? 0.78 : 1)})`;
  const sidebarBackdrop = menuBlurEnabled && menuBlurPx > 0 ? { backdropFilter: `saturate(160%) blur(${menuBlurPx}px)`, WebkitBackdropFilter: `saturate(160%) blur(${menuBlurPx}px)` } : {};

  // Reverted: mobile header remains sticky without scroll-based show/hide

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="relative min-h-screen text-text-primary app-non-card-text" style={{
      backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : undefined,
      backgroundAttachment: backgroundUrl ? 'fixed' : undefined,
      backgroundSize: backgroundUrl ? 'cover' : undefined,
      backgroundPosition: backgroundUrl ? 'center center' : undefined,
      backgroundRepeat: backgroundUrl ? 'no-repeat' : undefined,
      backgroundColor: !backgroundUrl ? 'var(--surface-page)' : undefined,
      '--card-text-color': redesignedTheme?.cardTextColor || '#0f172a'
    }}>
      
      {backgroundUrl ? (
        <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: withOpacity('#ffffff', 1 - backgroundImageOpacity) }} />
      ) : null}
      {redesignedActive ? (
        <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: withOpacity(redesignedTheme?.overlayColor || '#0b2e13', redesignedTheme?.overlayOpacity ?? 0.45) }} />
      ) : null}
      <div className="relative flex min-h-screen overflow-x-hidden">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-72 max-w-[88vw] transform px-5 py-6 text-white shadow-2xl transition md:flex md:h-screen md:flex-col md:translate-x-0 md:overflow-hidden md:rounded-r-[2.5rem] overflow-hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
          style={{ backgroundImage: sidebarBackgroundImage, ...sidebarBackdrop }}
        >
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
                  className={({ isActive }) => `group rounded-2xl text-sm font-medium transition ${isActive ? '' : 'text-white/90 hover:bg-white/12 hover:text-white hover:shadow-[0_0_12px_rgba(255,255,255,0.12)]'}`}
                  style={({ isActive }) => isActive ? { color: navigationActiveColor, backgroundColor: withOpacity(navigationActiveColor, 0.18), boxShadow: `0 0 16px ${withOpacity(navigationActiveColor, 0.26)}` } : undefined}
                >
                  {({ isActive }) => (
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={`grid h-7 w-7 place-items-center rounded-xl border ${isActive ? 'border-white/60 bg-white/20 text-current' : 'border-white/20 bg-white/10 text-white/90 group-hover:border-white/40 group-hover:bg-white/15'} backdrop-blur-sm`}>
                          <Icon size={16} />
                        </span>
                        <span className="truncate">{item.label}</span>
                      </span>

                      <span className="relative flex items-center gap-2">
                        {item.key === 'leaves' && pendingReviewCount > 0 ? (
                          <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white">+{pendingReviewCount}</span>
                        ) : item.key === 'documents' && documentNotificationCount > 0 ? (
                          <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white">+{documentNotificationCount}</span>
                        ) : null}
                        {redesignedActive ? (
                          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border backdrop-blur-sm ${isActive ? 'border-white/70 bg-white/80 text-emerald-900' : 'border-white/20 bg-white/15 text-white group-hover:border-white/40 group-hover:bg-white/20'}`}>
                            <Icon size={14} />
                          </span>
                        ) : null}
                      </span>
                    </div>
                  )}
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

        <div className="app-layout-desktop-offset flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden">
          <header className={`sticky top-0 z-30 ${redesignedActive ? 'border-white/30 bg-white/25 backdrop-blur-xl' : 'border-b border-slate-200 bg-white/90 backdrop-blur'} px-4 py-4 md:px-8`}>
            <div className="flex min-w-0 items-center justify-between gap-3 sm:gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  className="rounded-2xl border p-2.5 shadow-md md:hidden"
                  style={mobileMenuOpenStyle}
                  onClick={() => setMobileOpen((current) => !current)}
                >
                  <Menu size={20} />
                </button>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">KEREA intranet</p>
                  <h2 className="break-words text-[15px] font-semibold leading-tight text-slate-900 sm:truncate sm:text-lg">
                    {settings?.labels?.dashboardWelcome || 'Welcome back'}, {user?.firstName}
                  </h2>
                </div>
              </div>
              <Link to="/profile" className="flex shrink-0 items-center gap-3 rounded-2xl bg-brand-gradient px-3 py-2 text-white shadow-lg sm:px-4">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-white/10 text-white shadow">
                  {profilePhotoUrl ? (
                    <img src={profilePhotoUrl} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <User size={16} />
                  )}
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
