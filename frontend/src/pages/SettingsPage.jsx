import { useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import useUnsavedChangesGuard from '../hooks/useUnsavedChangesGuard';
import { restoreSettings, updateSettings } from '../services/settingsService';

const clone = (value) => JSON.parse(JSON.stringify(value));
const emptyLeaveTypeForm = { code: '', label: '', defaultDays: 0, requiresCeoApproval: false, isPaid: true, requiresDocument: false, canCarryForward: false };

const LOGIN_PAGE_KEYS = ['loginTitle', 'loginSubtitle', 'loginEmailLabel', 'loginPasswordLabel', 'loginEmailPlaceholder', 'loginPasswordPlaceholder', 'loginButtonText', 'loginFooterText'];

export default function SettingsPage() {
  const { settings, replaceSettings, user } = useAuth();
  const navigate = useNavigate();
  const isCeoOnly = user?.role === 'ceo';
  const availablePages = isCeoOnly
    ? [['employees', 'Employees Page'], ['leave', 'Leave Page']]
    : [
        ['branding', 'Branding'],
        ['dashboard', 'Dashboard'],
        ['login', 'Login Page'],
        ['navigation', 'Navigation'],
        ['employees', 'Employees Page'],
        ['profile', 'Profile Page'],
        ['documents', 'Documents Page'],
        ['leave', 'Leave Page']
      ];
  const [draft, setDraft] = useState(() => clone(settings || {}));
  const [message, setMessage] = useState('');
  const [activePage, setActivePage] = useState(isCeoOnly ? 'employees' : 'branding');
  const [leaveTypeEditor, setLeaveTypeEditor] = useState({ open: false, index: null, form: emptyLeaveTypeForm });
  const employeesSectionRef = useRef(null);
  const leaveSectionRef = useRef(null);
  const leaveTypeNameInputRef = useRef(null);
  const departmentInputRefs = useRef([]);

  useEffect(() => {
    if (settings) {
      setDraft(clone(settings));
    }
  }, [settings]);

  useEffect(() => {
    if (isCeoOnly) {
      setActivePage('employees');
    }
  }, [isCeoOnly]);

  useEffect(() => {
    if (!leaveTypeEditor.open) {
      return;
    }

    window.setTimeout(() => leaveTypeNameInputRef.current?.focus(), 100);
  }, [leaveTypeEditor.open]);

  const departments = useMemo(() => (draft.departments || []).filter((department) => department?.name !== 'Human Resources'), [draft]);
  const leaveTypes = useMemo(() => draft.leaveTypes || [], [draft]);
  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(draft || {}) !== JSON.stringify(settings || {}),
    [draft, settings]
  );

  useUnsavedChangesGuard(hasUnsavedChanges);

  const setBranding = (key, value) => {
    setDraft((current) => ({
      ...current,
      branding: {
        ...current.branding,
        [key]: value
      }
    }));
  };

  const setBrandingBoolean = (key, value) => {
    setDraft((current) => ({
      ...current,
      branding: {
        ...current.branding,
        [key]: value
      }
    }));
  };

  const setLabel = (key, value) => {
    setDraft((current) => ({
      ...current,
      labels: {
        ...current.labels,
        [key]: value
      }
    }));
  };

  const setInterfaceField = (key, value) => {
    setDraft((current) => ({
      ...current,
      interface: {
        ...current.interface,
        [key]: value
      }
    }));
  };

  const updateDepartment = (index, key, value) => {
    setDraft((current) => ({
      ...current,
      departments: current.departments.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)
    }));
  };

  const handleAddDepartment = () => {
    const nextIndex = departments.length;
    setDraft((current) => ({ ...current, departments: [...(current.departments || []), { name: '', description: '' }] }));
    window.setTimeout(() => {
      employeesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      departmentInputRefs.current[nextIndex]?.focus();
    }, 150);
  };

  const handleRemoveDepartment = (index) => {
    const departmentName = departments[index]?.name || 'this department';
    if (!window.confirm(`Remove ${departmentName}?`)) {
      return;
    }

    setDraft((current) => ({ ...current, departments: (current.departments || []).filter((_, itemIndex) => itemIndex !== index) }));
  };

  const openLeaveTypeEditor = (index = null) => {
    const leaveType = index === null
      ? emptyLeaveTypeForm
      : {
          code: leaveTypes[index]?.code || '',
          label: leaveTypes[index]?.label || '',
          defaultDays: leaveTypes[index]?.defaultDays || 0,
          requiresCeoApproval: Boolean(leaveTypes[index]?.requiresCeoApproval),
          isPaid: leaveTypes[index]?.isPaid !== false,
          requiresDocument: Boolean(leaveTypes[index]?.requiresDocument),
          canCarryForward: Boolean(leaveTypes[index]?.canCarryForward)
        };

    leaveSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setLeaveTypeEditor({ open: true, index, form: leaveType });
  };

  const closeLeaveTypeEditor = () => {
    setLeaveTypeEditor({ open: false, index: null, form: emptyLeaveTypeForm });
  };

  const saveLeaveTypeEditor = () => {
    if (!leaveTypeEditor.form.label.trim() || !leaveTypeEditor.form.code.trim()) {
      setMessage('Leave type name and code are required.');
      return;
    }

    setDraft((current) => {
      const nextLeaveType = {
        code: leaveTypeEditor.form.code.trim().toLowerCase(),
        label: leaveTypeEditor.form.label.trim(),
        defaultDays: Number(leaveTypeEditor.form.defaultDays || 0),
        requiresCeoApproval: Boolean(leaveTypeEditor.form.requiresCeoApproval),
        isPaid: leaveTypeEditor.form.isPaid !== false,
        requiresDocument: Boolean(leaveTypeEditor.form.requiresDocument),
        canCarryForward: Boolean(leaveTypeEditor.form.canCarryForward)
      };

      return {
        ...current,
        leaveTypes: leaveTypeEditor.index === null
          ? [...(current.leaveTypes || []), nextLeaveType]
          : current.leaveTypes.map((item, itemIndex) => itemIndex === leaveTypeEditor.index ? nextLeaveType : item)
      };
    });

    setMessage(leaveTypeEditor.index === null ? 'Leave type added successfully.' : 'Leave type updated successfully.');
    closeLeaveTypeEditor();
  };

  const handleRemoveLeaveType = (index) => {
    const leaveTypeLabel = leaveTypes[index]?.label || 'this leave type';
    if (!window.confirm(`Remove ${leaveTypeLabel}?`)) {
      return;
    }

    setDraft((current) => ({ ...current, leaveTypes: current.leaveTypes.filter((_, itemIndex) => itemIndex !== index) }));
  };

  const handleSave = async () => {
    const normalizedDepartments = (draft.departments || []).filter((department) => department?.name !== 'Human Resources');
    const payload = isCeoOnly
      ? {
          departments: normalizedDepartments,
          leaveTypes: draft.leaveTypes,
          labels: {
            employeeDirectoryTitle: draft.labels?.employeeDirectoryTitle || '',
            employeeDirectorySubtitle: draft.labels?.employeeDirectorySubtitle || '',
            leaveModuleTitle: draft.labels?.leaveModuleTitle || ''
          }
        }
      : { ...draft, departments: normalizedDepartments };

    const nextSettings = await updateSettings(payload);
    replaceSettings(nextSettings);
    setDraft(clone(nextSettings));
    setMessage('System settings updated successfully.');
  };

  const handleRestore = async () => {
    if (!window.confirm('Restore KEREA to Default?')) {
      return;
    }

    const nextSettings = await restoreSettings();
    replaceSettings(nextSettings);
    setDraft(clone(nextSettings));
    setMessage('Default settings restored successfully.');
  };

  if (!draft?.branding) {
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isCeoOnly ? 'CEO Settings' : 'Admin System Settings'}
        subtitle={isCeoOnly ? 'Manage employee-page settings, departments, and leave settings.' : 'Edit major page content, colors, labels, and core HRMS settings from one place.'}
        actions={[
          !isCeoOnly ? (
            <button key="restore" type="button" onClick={handleRestore} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700">
              Restore KEREA to Default
            </button>
          ) : null,
          <button key="save" type="button" onClick={handleSave} className="rounded-2xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-white shadow-lg">
            Save settings
          </button>
        ].filter(Boolean)}
      />

      {message ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

      <SectionCard title="Settings pages" subtitle="Select a page to edit its text, colors, and visible structure.">
        <div className="flex flex-wrap gap-3">
          {availablePages.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActivePage(key)}
              className={`rounded-2xl px-4 py-2 text-sm font-medium ${activePage === key ? 'bg-brand-gradient text-white shadow-lg' : 'border border-slate-200 bg-white text-slate-700'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </SectionCard>

      {!isCeoOnly && activePage === 'branding' ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <SectionCard title="Branding and theme" subtitle="These values control logos, gradients, cards, buttons, and main theme colors.">
            <div className="space-y-5">
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                <input type="checkbox" className="mt-1" checked={draft.branding?.useDesktopColorsOnMobile !== false} onChange={(event) => setBrandingBoolean('useDesktopColorsOnMobile', event.target.checked)} />
                <span>
                  <span className="block font-semibold text-slate-900">Use desktop colors on phones</span>
                  <span className="mt-1 block text-xs text-slate-500">Turn this off if you want a different mobile color palette.</span>
                </span>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
              {[
                ['organizationName', 'Organization Name'],
                ['appName', 'Application Name'],
                ['logoText', 'Logo Text'],
                ['primaryColor', 'Primary Color'],
                ['secondaryColor', 'Secondary Color'],
                ['accentColor', 'Accent Color'],
                ['backgroundColor', 'Background Color'],
                ['cardColor', 'Card Color'],
                ['textColor', 'Text Color'],
                ['gradientFrom', 'Gradient From'],
                ['gradientTo', 'Gradient To']
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
                  <input value={draft.branding?.[key] || ''} onChange={(event) => setBranding(key, event.target.value)} />
                </div>
              ))}
              </div>

              {draft.branding?.useDesktopColorsOnMobile === false ? (
                <div>
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-slate-900">Mobile colors</h3>
                    <p className="mt-1 text-xs text-slate-500">These colors apply on smaller screens while desktop colors stay unchanged.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {[
                      ['mobilePrimaryColor', 'Mobile Primary Color'],
                      ['mobileSecondaryColor', 'Mobile Secondary Color'],
                      ['mobileAccentColor', 'Mobile Accent Color'],
                      ['mobileBackgroundColor', 'Mobile Background Color'],
                      ['mobileCardColor', 'Mobile Card Color'],
                      ['mobileTextColor', 'Mobile Text Color'],
                      ['mobileGradientFrom', 'Mobile Gradient From'],
                      ['mobileGradientTo', 'Mobile Gradient To']
                    ].map(([key, label]) => (
                      <div key={key}>
                        <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
                        <input value={draft.branding?.[key] || ''} onChange={(event) => setBranding(key, event.target.value)} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard title="Brand preview" subtitle="Quick visual preview of your current logo and theme settings.">
            <div className="space-y-4">
              <div className="rounded-[2rem] p-6 text-white shadow-soft" style={{ background: `linear-gradient(135deg, ${draft.branding?.gradientFrom || '#14532d'}, ${draft.branding?.gradientTo || '#22c55e'})` }}>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold">
                  {draft.branding?.logoText || 'KH'}
                </div>
                <h3 className="mt-5 text-2xl font-semibold">{draft.branding?.organizationName || 'KEREA'}</h3>
                <p className="mt-2 text-sm text-white/80">{draft.branding?.appName || 'KEREA HRMS'}</p>
              </div>

              {draft.branding?.useDesktopColorsOnMobile === false ? (
                <div className="max-w-xs rounded-[2rem] p-5 text-white shadow-soft" style={{ background: `linear-gradient(135deg, ${draft.branding?.mobileGradientFrom || draft.branding?.gradientFrom || '#14532d'}, ${draft.branding?.mobileGradientTo || draft.branding?.gradientTo || '#22c55e'})` }}>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/70">Mobile preview</p>
                  <h3 className="mt-4 text-xl font-semibold">{draft.branding?.organizationName || 'KEREA'}</h3>
                  <p className="mt-2 text-sm text-white/80">{draft.branding?.appName || 'KEREA HRMS'}</p>
                </div>
              ) : null}
            </div>
          </SectionCard>
        </div>
      ) : null}

      {!isCeoOnly && activePage === 'dashboard' ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr),minmax(340px,0.95fr)]">
          <SectionCard title="Dashboard page" subtitle="Edit the dashboard heading, hero subtitle, and quick-action copy.">
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ['dashboardTitleSuffix', 'Dashboard title suffix'],
                ['dashboardQuickActionsTitle', 'Quick actions title'],
                ['dashboardQuickActionsSubtitle', 'Quick actions subtitle'],
                ['dashboardOpenLeavesText', 'Leaves action text'],
                ['dashboardOpenProfileText', 'Profile action text'],
                ['dashboardOpenEmployeesText', 'Employees action text'],
                ['dashboardOpenDocumentsText', 'Documents action text']
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
                  <input value={draft.labels?.[key] || ''} onChange={(event) => setLabel(key, event.target.value)} />
                </div>
              ))}
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">Dashboard hero subtitle</label>
                <input value={draft.interface?.dashboardHeroSubtitle || ''} onChange={(event) => setInterfaceField('dashboardHeroSubtitle', event.target.value)} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Dashboard preview" subtitle="Quick preview of the editable dashboard text.">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
              <h3 className="text-xl font-semibold text-slate-900">{draft.branding?.organizationName || 'KEREA'} CEO {draft.labels?.dashboardTitleSuffix || 'Dashboard'}</h3>
              <p className="mt-2 text-sm text-slate-500">{draft.interface?.dashboardHeroSubtitle || 'Secure intranet experience for employees, supervisors, executives, and administrators.'}</p>
              <div className="mt-5 grid gap-3">
                {[draft.labels?.dashboardOpenLeavesText || 'Open leave dashboard', draft.labels?.dashboardOpenProfileText || 'Review my profile', draft.labels?.dashboardOpenEmployeesText || 'Manage employees', draft.labels?.dashboardOpenDocumentsText || 'Open documents'].map((item) => (
                  <div key={item} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">{item}</div>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {!isCeoOnly && activePage === 'login' ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr),minmax(360px,0.9fr)]">
          <SectionCard title="Login page controls" subtitle="Edit the login page text, button label, footer text, and core visual identity.">
            <div className="grid gap-4 md:grid-cols-2">
              {LOGIN_PAGE_KEYS.map((key) => (
                <div key={key}>
                  <label className="mb-2 block text-sm font-medium capitalize text-slate-700">{key}</label>
                  <input value={draft.labels?.[key] || ''} onChange={(event) => setLabel(key, event.target.value)} />
                </div>
              ))}
              {[
                ['logoText', 'Logo initials'],
                ['organizationName', 'Organization name'],
                ['backgroundColor', 'Page background'],
                ['cardColor', 'Card background'],
                ['gradientFrom', 'Gradient from'],
                ['gradientTo', 'Gradient to'],
                ['primaryColor', 'Button color'],
                ['textColor', 'Text color']
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
                  <input value={draft.branding?.[key] || ''} onChange={(event) => setBranding(key, event.target.value)} />
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Login preview" subtitle="Preview the editable login content for KH, email, password, button, and footer.">
            <div className="rounded-[2rem] p-6 shadow-soft" style={{ background: draft.branding?.cardColor || '#ffffff' }}>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white" style={{ background: `linear-gradient(135deg, ${draft.branding?.gradientFrom || '#14532d'}, ${draft.branding?.gradientTo || '#22c55e'})` }}>
                {draft.branding?.logoText || 'KH'}
              </div>
              <h3 className="mt-5 text-center text-2xl font-semibold text-slate-900">{draft.labels?.loginTitle || `${draft.branding?.organizationName || 'KEREA'} HRMS`}</h3>
              <p className="mt-2 text-center text-sm text-slate-500">{draft.labels?.loginSubtitle || 'Sign in to your account'}</p>
              <div className="mt-6 space-y-3">
                <input value={draft.labels?.loginEmailLabel || 'Email'} readOnly />
                <input value={draft.labels?.loginPasswordLabel || 'Password'} readOnly />
                <button type="button" className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white" style={{ background: draft.branding?.primaryColor || '#166534' }}>
                  {draft.labels?.loginButtonText || 'Login'}
                </button>
              </div>
              <p className="mt-4 text-center text-xs text-slate-400">{draft.labels?.loginFooterText || '2026 KEREA. All rights reserved.'}</p>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {!isCeoOnly && activePage === 'navigation' ? (
        <SectionCard title="Navigation and menu" subtitle="Edit sidebar labels and menu gradients.">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ['gradientFrom', 'Menu Gradient From', 'branding'],
              ['gradientTo', 'Menu Gradient To', 'branding'],
              ['navigationDashboard', 'Dashboard Label', 'labels'],
              ['navigationEmployees', 'Employees Label', 'labels'],
              ['navigationLeaves', 'Leaves Label', 'labels'],
              ['navigationDocuments', 'Documents Label', 'labels'],
              ['navigationSettings', 'Settings Label', 'labels'],
              ['navigationAudit', 'Audit Label', 'labels']
            ].map(([key, label, source]) => (
              <div key={key}>
                <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
                <input value={source === 'labels' ? draft.labels?.[key] || '' : draft.branding?.[key] || ''} onChange={(event) => (source === 'labels' ? setLabel(key, event.target.value) : setBranding(key, event.target.value))} />
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {activePage === 'employees' ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr),minmax(360px,0.95fr)]">
          <div ref={employeesSectionRef}>
          <SectionCard
            title="Employees page"
            subtitle="Manage department sections, employee page labels, and jump to employee management."
            actions={[
              <button
                key="open-users"
                type="button"
                onClick={() => navigate('/employees', { state: { openCreateForm: true } })}
                className="rounded-xl bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-lg"
              >
                Add Employee
              </button>,
              <button
                key="add-department"
                type="button"
                onClick={handleAddDepartment}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Add Department
              </button>
            ]}
          >
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Employees title</label>
                  <input value={draft.labels?.employeeDirectoryTitle || ''} onChange={(event) => setLabel('employeeDirectoryTitle', event.target.value)} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Employees subtitle</label>
                  <input value={draft.labels?.employeeDirectorySubtitle || ''} onChange={(event) => setLabel('employeeDirectorySubtitle', event.target.value)} />
                </div>
              </div>
              {departments.map((department, index) => (
                <div key={`${department.name}-${index}`} className="rounded-2xl border border-slate-200 p-4">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr),minmax(0,1fr),120px]">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Name</label>
                      <input ref={(element) => { departmentInputRefs.current[index] = element; }} value={department.name} onChange={(event) => updateDepartment(index, 'name', event.target.value)} />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Description</label>
                      <input value={department.description || ''} onChange={(event) => updateDepartment(index, 'description', event.target.value)} />
                    </div>
                    <div className="flex items-end">
                      <button type="button" className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700" onClick={() => handleRemoveDepartment(index)}>
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
          </div>

          <SectionCard title="Employees page preview" subtitle="Visual direction for the customized superior and admin employee screens.">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-soft">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">{draft.labels?.employeeDirectoryTitle || 'Employees'}</h3>
                  <p className="text-sm text-slate-500">{draft.labels?.employeeDirectorySubtitle || 'Manage employee records and staff.'}</p>
                </div>
                <button type="button" className="rounded-2xl bg-brand-gradient px-4 py-2 text-sm font-semibold text-white">Add Employee</button>
              </div>
              <div className="grid gap-3">
                {departments.slice(0, 3).map((department) => (
                  <div key={department.name} className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="font-medium text-slate-900">{department.name}</p>
                    <p className="text-sm text-slate-500">{department.description || 'Department description'}</p>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {!isCeoOnly && activePage === 'profile' ? (
        <SectionCard title="Profile page" subtitle="Edit the title and helper text shown above the personal profile page.">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Profile title</label>
              <input value={draft.labels?.profileModuleTitle || ''} onChange={(event) => setLabel('profileModuleTitle', event.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">Profile subtitle</label>
              <input value={draft.labels?.profileSubtitle || ''} onChange={(event) => setLabel('profileSubtitle', event.target.value)} />
            </div>
          </div>
        </SectionCard>
      ) : null}

      {!isCeoOnly && activePage === 'documents' ? (
        <SectionCard title="Documents page" subtitle="Edit the documents page heading and helper text.">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Documents title</label>
              <input value={draft.labels?.documentsModuleTitle || ''} onChange={(event) => setLabel('documentsModuleTitle', event.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">Documents subtitle</label>
              <input value={draft.labels?.documentsSubtitle || ''} onChange={(event) => setLabel('documentsSubtitle', event.target.value)} />
            </div>
          </div>
        </SectionCard>
      ) : null}

      {activePage === 'leave' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard title="Active Leave Types" value={leaveTypes.length} helper="Policies currently available" />
            <StatCard title="CEO Escalations" value={leaveTypes.filter((item) => item.requiresCeoApproval).length} helper="Types requiring CEO review" accent="from-amber-500 to-orange-500" />
            <StatCard title="Standard Policies" value={leaveTypes.filter((item) => !item.requiresCeoApproval).length} helper="Handled before CEO stage" accent="from-blue-700 to-cyan-500" />
            <StatCard title="Configured in Settings" value={leaveTypes.length ? 'Ready' : 'Empty'} helper="Save after editing or adding" accent="from-violet-700 to-fuchsia-500" />
          </div>

          <SectionCard
            title="Leave types and limits"
            subtitle="Customize leave types in a cleaner table layout inspired by your screenshot."
            actions={[
              <button
                key="add-leave-type"
                type="button"
                onClick={() => openLeaveTypeEditor(null)}
                className="inline-flex items-center gap-2 rounded-2xl bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-lg"
              >
                <Plus size={16} />Add Leave Type
              </button>
            ]}
          >
            <div ref={leaveSectionRef} className="space-y-3">
              <div className="hidden grid-cols-[minmax(0,1.9fr),150px,200px,120px] gap-4 border-b border-slate-200 px-4 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 md:grid">
                <span>Name</span>
                <span>Days Allowed</span>
                <span>Properties</span>
                <span>Actions</span>
              </div>
              {leaveTypes.map((leaveType, index) => (
                <div key={`${leaveType.code}-${index}`} className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-soft">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1.9fr),150px,200px,120px] md:items-center">
                    <div>
                      <p className="font-semibold text-slate-900">{leaveType.label}</p>
                      <p className="mt-1 text-sm text-slate-500">{leaveType.code || 'leave code'}</p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{leaveType.defaultDays} days</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${leaveType.isPaid === false ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>{leaveType.isPaid === false ? 'Unpaid Leave' : 'Paid Leave'}</span>
                      {leaveType.requiresDocument ? (
                        <span className="inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">Requires Document</span>
                      ) : null}
                      {leaveType.canCarryForward ? (
                        <span className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">Can Carry Forward</span>
                      ) : null}
                      {leaveType.requiresCeoApproval ? (
                        <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Pending CEO</span>
                      ) : (
                        <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">Standard</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 md:justify-end">
                      <button type="button" className="rounded-xl p-2 text-blue-600 transition hover:bg-blue-50" onClick={() => openLeaveTypeEditor(index)} aria-label={`Edit ${leaveType.label}`}>
                        <Pencil size={16} />
                      </button>
                      <button type="button" className="rounded-xl p-2 text-rose-600 transition hover:bg-rose-50" onClick={() => handleRemoveLeaveType(index)} aria-label={`Remove ${leaveType.label}`}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <Modal
            open={leaveTypeEditor.open}
            title={leaveTypeEditor.index === null ? 'Add Leave Type' : 'Edit Leave Type'}
            description="Set the leave type details and save them back to the leave types list."
            onClose={closeLeaveTypeEditor}
            actions={[
              <button key="cancel" type="button" className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700" onClick={closeLeaveTypeEditor}>
                Cancel
              </button>,
              <button key="save" type="button" className="rounded-2xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-white" onClick={saveLeaveTypeEditor}>
                {leaveTypeEditor.index === null ? 'Create' : 'Save Changes'}
              </button>
            ]}
          >
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Name</label>
                <input ref={leaveTypeNameInputRef} value={leaveTypeEditor.form.label} onChange={(event) => setLeaveTypeEditor((current) => ({ ...current, form: { ...current.form, label: event.target.value } }))} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Code</label>
                <input value={leaveTypeEditor.form.code} onChange={(event) => setLeaveTypeEditor((current) => ({ ...current, form: { ...current.form, code: event.target.value } }))} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Days Allowed</label>
                <input type="number" min="0" value={leaveTypeEditor.form.defaultDays} onChange={(event) => setLeaveTypeEditor((current) => ({ ...current, form: { ...current.form, defaultDays: Number(event.target.value) } }))} />
              </div>
              <div>
                <p className="mb-3 text-sm font-medium text-slate-700">Leave properties</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['requiresCeoApproval', 'Requires CEO approval', 'Send this leave type for CEO approval before completion.'],
                    ['isPaid', 'Paid Leave', 'Mark this leave type as paid instead of unpaid.'],
                    ['requiresDocument', 'Requires Document', 'Users must attach a supporting document before submission.'],
                    ['canCarryForward', 'Can Carry Forward', 'Unused balance can be carried into the next period.']
                  ].map(([key, label, helper]) => (
                    <label key={key} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <input type="checkbox" className="mt-1" checked={Boolean(leaveTypeEditor.form[key])} onChange={(event) => setLeaveTypeEditor((current) => ({ ...current, form: { ...current.form, [key]: event.target.checked } }))} />
                      <span>
                        <span className="block font-medium text-slate-900">{label}</span>
                        <span className="mt-1 block text-xs text-slate-500">{helper}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </Modal>
        </div>
      ) : null}
    </div>
  );
}
