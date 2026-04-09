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
import { uploadDocument } from '../services/documentService';
import { fetchLeaveRequests, deleteLeaveRequest } from '../services/leaveService';

const clone = (value) => JSON.parse(JSON.stringify(value));
const emptyLeaveTypeForm = { code: '', label: '', defaultDays: 0, requiresCeoApproval: false, isPaid: true, requiresDocument: false, canCarryForward: false };

const LOGIN_PAGE_KEYS = ['loginTitle', 'loginSubtitle', 'loginEmailLabel', 'loginPasswordLabel', 'loginEmailPlaceholder', 'loginPasswordPlaceholder', 'loginButtonText', 'loginFooterText'];
const PAGE_PRESENTATION_OPTIONS = [
  ['fade-up', 'Fade Up'],
  ['slide-left', 'Slide Left'],
  ['slide-right', 'Slide Right'],
  ['zoom-in', 'Zoom In'],
  ['soft-blur', 'Soft Blur']
];
const PAGE_PRESENTATION_KEYS = ['dashboard', 'login', 'employees', 'profile', 'documents', 'leave', 'kpi', 'performance'];
const isHexColor = (value) => /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(String(value || '').trim());

function SettingsInput({ label, value, onChange, colorPicker = false }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
      {colorPicker ? (
        <div className="flex items-center gap-3">
          <input value={value || ''} onChange={(event) => onChange(event.target.value)} />
          <input type="color" value={isHexColor(value) ? value : '#166534'} onChange={(event) => onChange(event.target.value)} className="h-11 w-16 rounded-xl border border-slate-200 bg-white p-1" />
        </div>
      ) : (
        <input value={value || ''} onChange={(event) => onChange(event.target.value)} />
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { settings, replaceSettings, user } = useAuth();
  const navigate = useNavigate();
  const isCeoOnly = user?.role === 'ceo';
  const isFinanceOnly = user?.role === 'finance';
  const availablePages = isCeoOnly
    ? [
        ['employees', 'Employees Page'],
        ['documents', 'Documents Page'],
        ['leave', 'Leave Page'],
        ['kpi', 'KPI Matrix Page'],
        ['performance', 'Performance Dashboard'],
        ['backgrounds', 'Backgrounds'],
        ['leaves_cleanup', 'Delete Leave Requests']
      ]
    : isFinanceOnly
      ? [
          ['kpi', 'KPI Matrix Page'],
          ['performance', 'Performance Dashboard'],
          ['backgrounds', 'Backgrounds']
        ]
      : [
        ['branding', 'Branding'],
        ['ui', 'UI Variant'],
        ['backgrounds', 'Backgrounds'],
        ['dashboard', 'Dashboard'],
        ['login', 'Login Page'],
        ['navigation', 'Navigation'],
        ['employees', 'Employees Page'],
        ['profile', 'Profile Page'],
        ['documents', 'Documents Page'],
        ['leave', 'Leave Page'],
        ['kpi', 'KPI Matrix Page'],
        ['performance', 'Performance Dashboard']
      ];
  const [draft, setDraft] = useState(() => clone(settings || {}));
  const [message, setMessage] = useState('');
  const [activePage, setActivePage] = useState(isCeoOnly ? 'employees' : isFinanceOnly ? 'kpi' : 'branding');
  const [leaveTypeEditor, setLeaveTypeEditor] = useState({ open: false, index: null, form: emptyLeaveTypeForm });
  const employeesSectionRef = useRef(null);
  const leaveSectionRef = useRef(null);
  const leaveTypeNameInputRef = useRef(null);
  const departmentInputRefs = useRef([]);
  const folderInputRefs = useRef([]);
  const faviconInputRef = useRef(null);
  const bgUploadInputRef = useRef(null);
  const bgOriginalDefaultRef = useRef(null);
  const bgRedesignedDefaultRef = useRef(null);
  const bgOriginalDefaultMobileRef = useRef(null);
  const bgRedesignedDefaultMobileRef = useRef(null);
  const bgPerPageUploadRef = useRef(null);
  const [bgPendingTarget, setBgPendingTarget] = useState({ variant: 'original', pageKey: '', device: 'desktop' });
  const docCategoryRefs = useRef([]);
  const [cleanupLeaves, setCleanupLeaves] = useState([]);
  const [cleanupLoading, setCleanupLoading] = useState(false);

  useEffect(() => {
    if (settings) {
      setDraft(clone(settings));
    }
  }, [settings]);

  useEffect(() => {
    if (isCeoOnly) {
      setActivePage('employees');
    } else if (isFinanceOnly) {
      setActivePage('kpi');
    }
  }, [isCeoOnly, isFinanceOnly]);

  useEffect(() => {
    if (!isCeoOnly || activePage !== 'leaves_cleanup') return;
    setCleanupLoading(true);
    fetchLeaveRequests()
      .then(setCleanupLeaves)
      .catch(() => setCleanupLeaves([]))
      .finally(() => setCleanupLoading(false));
  }, [activePage, isCeoOnly]);

  useEffect(() => {
    if (!leaveTypeEditor.open) {
      return;
    }

    window.setTimeout(() => leaveTypeNameInputRef.current?.focus(), 100);
  }, [leaveTypeEditor.open]);

  const departments = useMemo(() => (draft.departments || []).filter((department) => department?.name !== 'Human Resources'), [draft]);
  const roleTitles = useMemo(() => draft.roleTitles || [], [draft]);
  const folders = useMemo(() => draft.folders || [], [draft]);
  const documentCategories = useMemo(() => draft.documentCategories || [], [draft]);
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

  const handleUploadPerPageBackground = async (variant, pageKey, file, device = 'desktop') => {
    if (!file) return;
    try {
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(file.type)) {
        setMessage('Please upload a JPG, PNG, or WEBP image.');
        return;
      }
      const doc = await uploadDocument({ file, folderType: 'branding' });
      setBackgroundValue(variant, pageKey, (current) => {
        const next = (typeof current === 'object' && current)
          ? { ...current }
          : { desktop: String(current || ''), mobile: String(current || '') };
        next[device] = `document:${doc.id}`;
        return next;
      });
      setMessage('Background image uploaded. Click Save settings to apply.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to upload background image.');
    }
  };

  const handleUploadRedesignedBackground = async (event) => {
    const file = event.target.files?.[0];
    try {
      if (!file) return;
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(file.type)) {
        setMessage('Please upload a JPG, PNG, or WEBP image.');
        return;
      }
      const doc = await uploadDocument({ file, folderType: 'branding' });
      setRedesignedThemeField('backgroundImageUrl', `document:${doc.id}`);
      setMessage('Background image uploaded. Click Save settings to apply.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to upload background image.');
    } finally {
      if (bgUploadInputRef.current) {
        bgUploadInputRef.current.value = '';
      }
    }
  };

  const setUiVariantField = (key, value) => {
    setDraft((current) => ({
      ...current,
      interface: {
        ...current.interface,
        uiVariant: {
          ...(current.interface?.uiVariant || {}),
          [key]: value
        }
      }
    }));
  };

  const setRedesignedThemeField = (key, value) => {
    setDraft((current) => ({
      ...current,
      interface: {
        ...current.interface,
        uiVariant: {
          ...(current.interface?.uiVariant || {}),
          redesignedTheme: {
            ...(current.interface?.uiVariant?.redesignedTheme || {}),
            [key]: value
          }
        }
      }
    }));
  };

  const setPageExperienceField = (pageKey, key, value) => {
    setDraft((current) => ({
      ...current,
      interface: {
        ...current.interface,
        pageExperience: {
          ...(current.interface?.pageExperience || {}),
          [pageKey]: {
            ...(current.interface?.pageExperience?.[pageKey] || {}),
            [key]: value
          }
        }
      }
    }));
  };

  const currentPageExperience = useMemo(
    () => draft.interface?.pageExperience?.[activePage] || {},
    [activePage, draft.interface?.pageExperience]
  );

  const canEditPagePresentation = (!isCeoOnly && PAGE_PRESENTATION_KEYS.includes(activePage)) || (isCeoOnly && ['kpi','performance'].includes(activePage));

  const handleFaviconUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setBranding('faviconUrl', String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const clearFavicon = () => {
    setBranding('faviconUrl', '');
    if (faviconInputRef.current) {
      faviconInputRef.current.value = '';
    }
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

  const updateFolder = (index, key, value) => {
    setDraft((current) => ({
      ...current,
      folders: (current.folders || []).map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)
    }));
  };

  const setBackgrounds = (updater) => {
    setDraft((current) => ({
      ...current,
      interface: {
        ...current.interface,
        backgrounds: updater(current.interface?.backgrounds || {})
      }
    }));
  };

  const setBackgroundValue = (variant, pageKey, valueOrUpdater) => {
    setBackgrounds((bg) => {
      const prev = (bg?.[variant]?.perPage || {})[pageKey];
      const nextValue = typeof valueOrUpdater === 'function' ? valueOrUpdater(prev) : valueOrUpdater;
      return {
        ...bg,
        [variant]: {
          ...(bg?.[variant] || {}),
          perPage: { ...(bg?.[variant]?.perPage || {}), [pageKey]: nextValue }
        }
      };
    });
  };

  const handleUploadDefaultBackground = async (variant, file, device = 'desktop') => {
    if (!file) return;
    try {
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(file.type)) {
        setMessage('Please upload a JPG, PNG, or WEBP image.');
        return;
      }
      const doc = await uploadDocument({ file, folderType: 'branding' });
      setBackgrounds((bg) => ({
        ...bg,
        [variant]: { ...(bg?.[variant] || {}), [`default${device === 'mobile' ? 'Mobile' : 'Desktop'}Url`]: `document:${doc.id}` }
      }));
      setMessage('Background image uploaded. Click Save settings to apply.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to upload background image.');
    }
  };

  const addDocumentCategory = () => {
    const nextIndex = (draft.documentCategories || []).length;
    setDraft((current) => ({
      ...current,
      documentCategories: [...(current.documentCategories || []), { code: '', label: '', types: [] }]
    }));
    window.setTimeout(() => {
      const wrapper = docCategoryRefs.current[nextIndex];
      if (wrapper) {
        wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const firstInput = wrapper.querySelector('input');
        firstInput?.focus();
      }
    }, 150);
  };

  const removeDocumentCategory = (index) => {
    const name = (draft.documentCategories || [])[index]?.label || 'this folder type';
    if (!window.confirm(`Remove ${name}?`)) {
      return;
    }
    setDraft((current) => ({
      ...current,
      documentCategories: (current.documentCategories || []).filter((_, i) => i !== index)
    }));
  };

  const updateDocumentCategory = (index, key, value) => {
    setDraft((current) => ({
      ...current,
      documentCategories: (current.documentCategories || []).map((item, i) => i === index ? { ...item, [key]: value } : item)
    }));
  };

  const addDocumentType = (catIndex) => {
    setDraft((current) => ({
      ...current,
      documentCategories: (current.documentCategories || []).map((cat, i) => i === catIndex ? { ...cat, types: [...(cat.types || []), { code: '', label: '' }] } : cat)
    }));
  };

  const updateDocumentType = (catIndex, typeIndex, key, value) => {
    setDraft((current) => ({
      ...current,
      documentCategories: (current.documentCategories || []).map((cat, i) => i === catIndex ? { ...cat, types: (cat.types || []).map((t, j) => j === typeIndex ? { ...t, [key]: value } : t) } : cat)
    }));
  };

  const removeDocumentType = (catIndex, typeIndex) => {
    const typeName = (draft.documentCategories?.[catIndex]?.types?.[typeIndex]?.label) || 'this label';
    if (!window.confirm(`Remove ${typeName}?`)) {
      return;
    }
    setDraft((current) => ({
      ...current,
      documentCategories: (current.documentCategories || []).map((cat, i) => i === catIndex ? { ...cat, types: (cat.types || []).filter((_, j) => j !== typeIndex) } : cat)
    }));
  };

  const updateRoleTitle = (index, value) => {
    setDraft((current) => ({
      ...current,
      roleTitles: (current.roleTitles || []).map((item, itemIndex) => itemIndex === index ? { ...item, value } : item)
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

  const handleAddFolder = () => {
    const nextIndex = folders.length;
    setDraft((current) => ({ ...current, folders: [...(current.folders || []), { code: '', label: '' }] }));
    window.setTimeout(() => folderInputRefs.current[nextIndex]?.focus(), 150);
  };

  const handleAddRoleTitle = () => {
    setDraft((current) => ({ ...current, roleTitles: [...(current.roleTitles || []), { value: '' }] }));
  };

  const handleRemoveDepartment = (index) => {
    const departmentName = departments[index]?.name || 'this department';
    if (!window.confirm(`Remove ${departmentName}?`)) {
      return;
    }

    setDraft((current) => ({ ...current, departments: (current.departments || []).filter((_, itemIndex) => itemIndex !== index) }));
  };

  const handleRemoveFolder = (index) => {
    const folderLabel = folders[index]?.label || folders[index]?.code || 'this folder';
    if (!window.confirm(`Remove ${folderLabel}?`)) {
      return;
    }

    setDraft((current) => ({ ...current, folders: (current.folders || []).filter((_, itemIndex) => itemIndex !== index) }));
  };

  const handleRemoveRoleTitle = (index) => {
    const roleTitle = roleTitles[index]?.value || 'this title';
    if (!window.confirm(`Remove ${roleTitle}?`)) {
      return;
    }

    setDraft((current) => ({ ...current, roleTitles: (current.roleTitles || []).filter((_, itemIndex) => itemIndex !== index) }));
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
    if (!leaveTypeEditor.form.label.trim()) {
      setMessage('Leave type name is required.');
      return;
    }

    const derivedCode = (leaveTypeEditor.form.code?.trim() || leaveTypeEditor.form.label.trim())
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');

    setDraft((current) => {
      const nextLeaveType = {
        code: derivedCode,
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
    const normalizedRoleTitles = (draft.roleTitles || []).reduce((accumulator, roleTitle) => {
      const value = String(roleTitle?.value || '').trim();
      if (!value || ['ceo', 'admin', 'supervisor'].includes(value.toLowerCase()) || accumulator.some((item) => item.value.toLowerCase() === value.toLowerCase())) {
        return accumulator;
      }
      accumulator.push({ value });
      return accumulator;
    }, []);
    const normalizedFolders = (draft.folders || []).reduce((accumulator, folder) => {
      const label = String(folder?.label || '').trim();
      const rawCode = String(folder?.code || '').trim();
      const code = (rawCode || label).toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (!code || !label || accumulator.some((item) => item.code === code)) {
        return accumulator;
      }
      accumulator.push({ code, label });
      return accumulator;
    }, []);
    const normalizedCategories = (draft.documentCategories || []).reduce((acc, cat) => {
      const catLabel = String(cat?.label || '').trim();
      const catCodeRaw = String(cat?.code || '').trim();
      const catCode = (catCodeRaw || catLabel).toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (!catCode || !catLabel || acc.some((c) => c.code === catCode)) {
        return acc;
      }
      const types = (cat.types || []).reduce((tAcc, t) => {
        const tLabel = String(t?.label || '').trim();
        const tCodeRaw = String(t?.code || '').trim();
        const tCode = (tCodeRaw || tLabel).toLowerCase().replace(/[^a-z0-9_-]/g, '');
        if (!tCode || !tLabel || tAcc.some((x) => x.code === tCode)) {
          return tAcc;
        }
        tAcc.push({ code: tCode, label: tLabel });
        return tAcc;
      }, []);
      acc.push({ code: catCode, label: catLabel, types });
      return acc;
    }, []);
    const normalizedPageExperience = Object.entries(draft.interface?.pageExperience || {}).reduce((accumulator, [pageKey, config]) => {
      const base = {
        enabled: config?.enabled !== false,
        type: PAGE_PRESENTATION_OPTIONS.some(([value]) => value === config?.type) ? config.type : 'fade-up',
        delayMs: Math.max(0, Number(config?.delayMs || 0)),
        durationMs: Math.max(120, Number(config?.durationMs || 420)),
        cardBackgroundColor: String(config?.cardBackgroundColor || '#ffffff').trim() || '#ffffff',
        cardBackgroundOpacity: Math.min(1, Math.max(0, Number(config?.cardBackgroundOpacity ?? 1)))
      };
      if (pageKey === 'leave') {
        base.leaveCardsOpacity = Math.min(1, Math.max(0, Number(config?.leaveCardsOpacity ?? 1)));
      }
      accumulator[pageKey] = base;
      return accumulator;
    }, {});
    const normalizedInterface = {
      ...(draft.interface || {}),
      mobileMenuAnimationEnabled: draft.interface?.mobileMenuAnimationEnabled !== false,
      mobileMenuAnimationType: ['slide', 'fade', 'scale'].includes(draft.interface?.mobileMenuAnimationType) ? draft.interface.mobileMenuAnimationType : 'slide',
      mobileMenuAnimationDurationMs: Math.max(120, Number(draft.interface?.mobileMenuAnimationDurationMs || 260)),
      pageExperience: normalizedPageExperience,
      backgrounds: {
        original: {
          defaultDesktopUrl: String(draft.interface?.backgrounds?.original?.defaultDesktopUrl || draft.interface?.backgrounds?.original?.defaultImageUrl || ''),
          defaultMobileUrl: String(draft.interface?.backgrounds?.original?.defaultMobileUrl || draft.interface?.backgrounds?.original?.defaultImageUrl || ''),
          perPage: Object.fromEntries(['dashboard','employees','profile','documents','leave','settings','audit','kpi','performance'].map((k) => {
            const raw = (draft.interface?.backgrounds?.original?.perPage || {})[k];
            const asObj = typeof raw === 'object' && raw ? raw : { desktop: String(raw || '').trim(), mobile: String(raw || '').trim() };
            return [k, { desktop: String(asObj.desktop || '').trim(), mobile: String(asObj.mobile || '').trim() }];
          }))
        },
        redesigned: {
          defaultDesktopUrl: String(draft.interface?.backgrounds?.redesigned?.defaultDesktopUrl || draft.interface?.backgrounds?.redesigned?.defaultImageUrl || ''),
          defaultMobileUrl: String(draft.interface?.backgrounds?.redesigned?.defaultMobileUrl || draft.interface?.backgrounds?.redesigned?.defaultImageUrl || ''),
          perPage: Object.fromEntries(['dashboard','employees','profile','documents','leave','settings','audit','kpi','performance'].map((k) => {
            const raw = (draft.interface?.backgrounds?.redesigned?.perPage || {})[k];
            const asObj = typeof raw === 'object' && raw ? raw : { desktop: String(raw || '').trim(), mobile: String(raw || '').trim() };
            return [k, { desktop: String(asObj.desktop || '').trim(), mobile: String(asObj.mobile || '').trim() }];
          }))
        },
        imageOpacity: Math.min(1, Math.max(0, Number(draft.interface?.backgrounds?.imageOpacity ?? 1)))
      },
      navigationActiveColor: String(draft.interface?.navigationActiveColor || '#fef08a').trim() || '#fef08a',
      pageHeaderColors: Object.fromEntries(['dashboard','employees','profile','documents','leave','settings','audit','kpi','performance'].map((k) => {
        const v = (draft.interface?.pageHeaderColors || {})[k] || {};
        return [k, { title: String(v.title || '').trim(), subtitle: String(v.subtitle || '').trim() }];
      })),
      navigationBlur: {
        mobile: {
          enabled: Boolean(draft.interface?.navigationBlur?.mobile?.enabled),
          blurPx: Math.max(0, Math.min(40, Number(draft.interface?.navigationBlur?.mobile?.blurPx ?? 0)))
        },
        desktop: {
          enabled: Boolean(draft.interface?.navigationBlur?.desktop?.enabled),
          blurPx: Math.max(0, Math.min(40, Number(draft.interface?.navigationBlur?.desktop?.blurPx ?? 0)))
        }
      },
      uiVariant: {
        active: ['original', 'redesigned'].includes(draft.interface?.uiVariant?.active) ? draft.interface.uiVariant.active : 'original',
        applyTo: ['all', 'small_only', 'large_only'].includes(draft.interface?.uiVariant?.applyTo) ? draft.interface.uiVariant.applyTo : 'all',
        redesignedTheme: {
          backgroundImageUrl: String(draft.interface?.uiVariant?.redesignedTheme?.backgroundImageUrl || ''),
          overlayColor: draft.interface?.uiVariant?.redesignedTheme?.overlayColor || '#0b2e13',
          overlayOpacity: Math.max(0, Math.min(1, Number(draft.interface?.uiVariant?.redesignedTheme?.overlayOpacity ?? 0.45))),
          sidebarGradientFrom: draft.interface?.uiVariant?.redesignedTheme?.sidebarGradientFrom || '#14532d',
          sidebarGradientTo: draft.interface?.uiVariant?.redesignedTheme?.sidebarGradientTo || '#22c55e',
          glassCardColor: draft.interface?.uiVariant?.redesignedTheme?.glassCardColor || '#ffffff',
          glassCardOpacity: Math.max(0, Math.min(1, Number(draft.interface?.uiVariant?.redesignedTheme?.glassCardOpacity ?? 0.18))),
          glassBlurPx: Math.max(0, Number(draft.interface?.uiVariant?.redesignedTheme?.glassBlurPx ?? 14)),
          cardTextColor: draft.interface?.uiVariant?.redesignedTheme?.cardTextColor || '#0f172a'
        }
      }
    };
    const payload = isCeoOnly
      ? {
          departments: normalizedDepartments,
          roleTitles: normalizedRoleTitles,
          folders: normalizedFolders,
          documentCategories: normalizedCategories,
          leaveTypes: draft.leaveTypes,
          labels: {
            employeeDirectoryTitle: draft.labels?.employeeDirectoryTitle || '',
            employeeDirectorySubtitle: draft.labels?.employeeDirectorySubtitle || '',
            leaveModuleTitle: draft.labels?.leaveModuleTitle || '',
            documentsModuleTitle: draft.labels?.documentsModuleTitle || '',
            documentsSubtitle: draft.labels?.documentsSubtitle || ''
          }
        }
      : {
          ...draft,
          departments: normalizedDepartments,
          roleTitles: normalizedRoleTitles,
          folders: normalizedFolders,
          documentCategories: normalizedCategories,
          interface: normalizedInterface
        };

    const nextSettings = await updateSettings(payload);
    replaceSettings(nextSettings);
    setDraft(clone(nextSettings));
    setMessage('System settings updated successfully.');
    try { window.alert('Settings saved successfully.'); } catch (_) {}
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
        title={isCeoOnly ? 'CEO Settings' : 'IT Officer System Settings'}
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

      {canEditPagePresentation ? (
        <SectionCard title="Page load style" subtitle="Choose how this page loads, how long it waits, and the card background color/opacity used on that page.">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 md:col-span-2">
              <input type="checkbox" className="mt-1" checked={currentPageExperience.enabled !== false} onChange={(event) => setPageExperienceField(activePage, 'enabled', event.target.checked)} />
              <span>
                <span className="block font-semibold text-slate-900">Enable on-load style</span>
                <span className="mt-1 block text-xs text-slate-500">Turn this off if you want the page content to appear instantly.</span>
              </span>
            </label>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Style type</label>
              <select value={currentPageExperience.type || 'fade-up'} onChange={(event) => setPageExperienceField(activePage, 'type', event.target.value)}>
                {PAGE_PRESENTATION_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Start delay (ms)</label>
              <input type="number" min="0" max="3000" value={currentPageExperience.delayMs ?? 0} onChange={(event) => setPageExperienceField(activePage, 'delayMs', event.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Animation duration (ms)</label>
              <input type="number" min="120" max="2000" value={currentPageExperience.durationMs ?? 420} onChange={(event) => setPageExperienceField(activePage, 'durationMs', event.target.value)} />
            </div>
            <SettingsInput label="Card Background Color" value={currentPageExperience.cardBackgroundColor || '#ffffff'} onChange={(value) => setPageExperienceField(activePage, 'cardBackgroundColor', value)} colorPicker />
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Card background opacity</label>
              <input type="number" min="0" max="1" step="0.05" value={currentPageExperience.cardBackgroundOpacity ?? 1} onChange={(event) => setPageExperienceField(activePage, 'cardBackgroundOpacity', event.target.value)} />
            </div>
          </div>
        </SectionCard>
      ) : null}

      {!isCeoOnly && activePage === 'ui' ? (
        <div className="space-y-6">
          <SectionCard title="Redesigned UI - Activation" subtitle="Switch between the original UI and the Redesigned UI and choose where to apply it by screen size.">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Active UI</label>
                <select value={draft.interface?.uiVariant?.active || 'original'} onChange={(e) => setUiVariantField('active', e.target.value)}>
                  <option value="original">Original UI</option>
                  <option value="redesigned">Redesigned UI</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Apply To</label>
                <select value={draft.interface?.uiVariant?.applyTo || 'all'} onChange={(e) => setUiVariantField('applyTo', e.target.value)}>
                  <option value="all">All screens</option>
                  <option value="small_only">Small screens only</option>
                  <option value="large_only">Large screens only</option>
                </select>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Leave page options" subtitle="Adjust the opacity of the leave cards that show leave days and remaining days.">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Leave cards opacity</label>
                <input type="number" min="0" max="1" step="0.05" value={draft.interface?.pageExperience?.leave?.leaveCardsOpacity ?? 1} onChange={(e) => setPageExperienceField('leave', 'leaveCardsOpacity', e.target.value)} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Redesigned UI - Theme" subtitle="Customize the background, overlay, sidebar gradient, and glass card look. These settings do not affect the original UI.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">Background image URL</label>
                <div className="flex items-center gap-3">
                  <input value={draft.interface?.uiVariant?.redesignedTheme?.backgroundImageUrl || ''} onChange={(e) => setRedesignedThemeField('backgroundImageUrl', e.target.value)} />
                  <input ref={bgUploadInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadRedesignedBackground} />
                  <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700" onClick={() => bgUploadInputRef.current?.click()}>Upload from computer</button>
                </div>
              </div>
              <SettingsInput label="Overlay Color" value={draft.interface?.uiVariant?.redesignedTheme?.overlayColor || '#0b2e13'} onChange={(v) => setRedesignedThemeField('overlayColor', v)} colorPicker />
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Overlay Opacity</label>
                <input type="number" min="0" max="1" step="0.05" value={draft.interface?.uiVariant?.redesignedTheme?.overlayOpacity ?? 0.45} onChange={(e) => setRedesignedThemeField('overlayOpacity', e.target.value)} />
              </div>
              <SettingsInput label="Sidebar Gradient From" value={draft.interface?.uiVariant?.redesignedTheme?.sidebarGradientFrom || '#14532d'} onChange={(v) => setRedesignedThemeField('sidebarGradientFrom', v)} colorPicker />
              <SettingsInput label="Sidebar Gradient To" value={draft.interface?.uiVariant?.redesignedTheme?.sidebarGradientTo || '#22c55e'} onChange={(v) => setRedesignedThemeField('sidebarGradientTo', v)} colorPicker />
              <SettingsInput label="Glass Card Color" value={draft.interface?.uiVariant?.redesignedTheme?.glassCardColor || '#ffffff'} onChange={(v) => setRedesignedThemeField('glassCardColor', v)} colorPicker />
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Glass Card Opacity</label>
                <input type="number" min="0" max="1" step="0.05" value={draft.interface?.uiVariant?.redesignedTheme?.glassCardOpacity ?? 0.18} onChange={(e) => setRedesignedThemeField('glassCardOpacity', e.target.value)} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Glass Blur (px)</label>
                <input type="number" min="0" max="40" value={draft.interface?.uiVariant?.redesignedTheme?.glassBlurPx ?? 14} onChange={(e) => setRedesignedThemeField('glassBlurPx', e.target.value)} />
              </div>
              <SettingsInput label="Card Text Color" value={draft.interface?.uiVariant?.redesignedTheme?.cardTextColor || '#0f172a'} onChange={(v) => setRedesignedThemeField('cardTextColor', v)} colorPicker />
            </div>
          </SectionCard>

          
        </div>
      ) : null}

      {isCeoOnly && activePage === 'leaves_cleanup' ? (
        <div className="space-y-6">
          <SectionCard title="Delete Leave Requests" subtitle="As CEO, you can permanently delete any employee's leave request. This action cannot be undone.">
            {cleanupLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading leave requests…</div>
            ) : cleanupLeaves.length ? (
              <div className="space-y-3">
                {cleanupLeaves.map((req) => (
                  <div key={req.id} className="grid items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-[minmax(0,1.3fr),minmax(0,1fr),minmax(0,0.8fr),120px]">
                    <div>
                      <p className="font-medium text-slate-900">{req.employeeName}</p>
                      <p className="text-xs text-slate-500">{req.employeeEmail}</p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{req.leaveTypeLabel}</p>
                      <p className="text-xs text-slate-500">{req.startDate} – {req.endDate} · {req.daysRequested} day(s)</p>
                    </div>
                    <div>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : req.status.startsWith('pending') ? 'bg-amber-100 text-amber-700' : req.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{req.status}</span>
                    </div>
                    <div className="flex justify-end">
                      <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700" onClick={async () => {
                        if (!window.confirm('Delete this leave request permanently?')) return;
                        try {
                          await deleteLeaveRequest(req.id);
                          setCleanupLeaves((current) => current.filter((item) => item.id !== req.id));
                        } catch (error) {
                          window.alert(error.response?.data?.message || 'Unable to delete leave request.');
                        }
                      }}>
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">No leave requests found.</div>
            )}
          </SectionCard>
        </div>
      ) : null}

      {activePage === 'backgrounds' ? (
        <div className="space-y-6">
          <SectionCard title="Global background options" subtitle="Control general behavior that applies to both Original and Redesigned UIs.">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Background image opacity</label>
                <input type="number" min="0" max="1" step="0.05" value={draft.interface?.backgrounds?.imageOpacity ?? 1} onChange={(e) => setBackgrounds((bg) => ({ ...bg, imageOpacity: e.target.value }))} />
              </div>
              <SettingsInput label="Active menu color" value={draft.interface?.navigationActiveColor || '#fef08a'} onChange={(v) => setInterfaceField('navigationActiveColor', v)} colorPicker />
            </div>
          </SectionCard>

          <SectionCard title="Page header colors per page" subtitle="Set distinct title and subtitle colors for each page header.">
            <div className="grid gap-4 md:grid-cols-2">
              {(user?.role === 'finance' || user?.role === 'ceo' ? ['kpi','performance'] : ['dashboard','employees','profile','documents','leave','settings','audit','kpi','performance']).map((page) => (
                <div key={page} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h4 className="text-sm font-semibold text-slate-900">{page[0].toUpperCase()+page.slice(1)}</h4>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <SettingsInput label="Title color" value={draft.interface?.pageHeaderColors?.[page]?.title || ''} onChange={(v) => setDraft((cur) => ({
                      ...cur,
                      interface: {
                        ...cur.interface,
                        pageHeaderColors: { ...(cur.interface?.pageHeaderColors || {}), [page]: { ...(cur.interface?.pageHeaderColors?.[page] || {}), title: v } }
                      }
                    }))} colorPicker />
                    <SettingsInput label="Subtitle color" value={draft.interface?.pageHeaderColors?.[page]?.subtitle || ''} onChange={(v) => setDraft((cur) => ({
                      ...cur,
                      interface: {
                        ...cur.interface,
                        pageHeaderColors: { ...(cur.interface?.pageHeaderColors || {}), [page]: { ...(cur.interface?.pageHeaderColors?.[page] || {}), subtitle: v } }
                      }
                    }))} colorPicker />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Navigation menu blur" subtitle="Control the glass-like blur of the navigation menu background on phones and desktops.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="flex items-start gap-3 text-sm font-medium text-slate-700">
                  <input type="checkbox" className="mt-1" checked={Boolean(draft.interface?.navigationBlur?.mobile?.enabled)} onChange={(e) => setDraft((cur) => ({
                    ...cur,
                    interface: { ...cur.interface, navigationBlur: { ...(cur.interface?.navigationBlur || {}), mobile: { ...(cur.interface?.navigationBlur?.mobile || {}), enabled: e.target.checked } } }
                  }))} />
                  <span>
                    <span className="block font-semibold text-slate-900">Enable menu blur on phones</span>
                    <span className="mt-1 block text-xs text-slate-500">Adds a green-tinted glass blur to the mobile menu background.</span>
                  </span>
                </label>
                <div className="mt-3">
                  <label className="mb-2 block text-sm font-medium text-slate-700">Blur amount (px)</label>
                  <input type="number" min="0" max="40" value={Number(draft.interface?.navigationBlur?.mobile?.blurPx ?? 0)} onChange={(e) => setDraft((cur) => ({
                    ...cur,
                    interface: { ...cur.interface, navigationBlur: { ...(cur.interface?.navigationBlur || {}), mobile: { ...(cur.interface?.navigationBlur?.mobile || {}), blurPx: e.target.value } } }
                  }))} />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="flex items-start gap-3 text-sm font-medium text-slate-700">
                  <input type="checkbox" className="mt-1" checked={Boolean(draft.interface?.navigationBlur?.desktop?.enabled)} onChange={(e) => setDraft((cur) => ({
                    ...cur,
                    interface: { ...cur.interface, navigationBlur: { ...(cur.interface?.navigationBlur || {}), desktop: { ...(cur.interface?.navigationBlur?.desktop || {}), enabled: e.target.checked } } }
                  }))} />
                  <span>
                    <span className="block font-semibold text-slate-900">Enable menu blur on desktops</span>
                    <span className="mt-1 block text-xs text-slate-500">Adds a green-tinted glass blur to the desktop sidebar background.</span>
                  </span>
                </label>
                <div className="mt-3">
                  <label className="mb-2 block text-sm font-medium text-slate-700">Blur amount (px)</label>
                  <input type="number" min="0" max="40" value={Number(draft.interface?.navigationBlur?.desktop?.blurPx ?? 0)} onChange={(e) => setDraft((cur) => ({
                    ...cur,
                    interface: { ...cur.interface, navigationBlur: { ...(cur.interface?.navigationBlur || {}), desktop: { ...(cur.interface?.navigationBlur?.desktop || {}), blurPx: e.target.value } } }
                  }))} />
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Default background images" subtitle="Set separate defaults for the Original and Redesigned UIs. Provide both Desktop and Mobile backgrounds.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-1">
                <label className="mb-2 block text-sm font-medium text-slate-700">Original UI default - Desktop</label>
                <div className="flex items-center gap-3">
                  <input value={draft.interface?.backgrounds?.original?.defaultDesktopUrl || draft.interface?.backgrounds?.original?.defaultImageUrl || ''} onChange={(e) => setBackgrounds((bg) => ({ ...bg, original: { ...(bg?.original || {}), defaultDesktopUrl: e.target.value } }))} />
                  <input ref={bgOriginalDefaultRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadDefaultBackground('original', f, 'desktop'); e.target.value=''; }} />
                  <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700" onClick={() => bgOriginalDefaultRef.current?.click()}>Upload</button>
                </div>
                <label className="mt-3 mb-2 block text-sm font-medium text-slate-700">Original UI default - Mobile</label>
                <div className="flex items-center gap-3">
                  <input value={draft.interface?.backgrounds?.original?.defaultMobileUrl || draft.interface?.backgrounds?.original?.defaultImageUrl || ''} onChange={(e) => setBackgrounds((bg) => ({ ...bg, original: { ...(bg?.original || {}), defaultMobileUrl: e.target.value } }))} />
                  <input ref={bgOriginalDefaultMobileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadDefaultBackground('original', f, 'mobile'); e.target.value=''; }} />
                  <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700" onClick={() => bgOriginalDefaultMobileRef.current?.click()}>Upload</button>
                </div>
              </div>
              <div className="md:col-span-1">
                <label className="mb-2 block text-sm font-medium text-slate-700">Redesigned UI default - Desktop</label>
                <div className="flex items-center gap-3">
                  <input value={draft.interface?.backgrounds?.redesigned?.defaultDesktopUrl || draft.interface?.backgrounds?.redesigned?.defaultImageUrl || ''} onChange={(e) => setBackgrounds((bg) => ({ ...bg, redesigned: { ...(bg?.redesigned || {}), defaultDesktopUrl: e.target.value } }))} />
                  <input ref={bgRedesignedDefaultRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadDefaultBackground('redesigned', f, 'desktop'); e.target.value=''; }} />
                  <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700" onClick={() => bgRedesignedDefaultRef.current?.click()}>Upload</button>
                </div>
                <label className="mt-3 mb-2 block text-sm font-medium text-slate-700">Redesigned UI default - Mobile</label>
                <div className="flex items-center gap-3">
                  <input value={draft.interface?.backgrounds?.redesigned?.defaultMobileUrl || draft.interface?.backgrounds?.redesigned?.defaultImageUrl || ''} onChange={(e) => setBackgrounds((bg) => ({ ...bg, redesigned: { ...(bg?.redesigned || {}), defaultMobileUrl: e.target.value } }))} />
                  <input ref={bgRedesignedDefaultMobileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadDefaultBackground('redesigned', f, 'mobile'); e.target.value=''; }} />
                  <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700" onClick={() => bgRedesignedDefaultMobileRef.current?.click()}>Upload</button>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Per-page overrides" subtitle="Optionally set different Desktop and Mobile backgrounds per page for each UI.">
            <div className="space-y-4">
              <input ref={bgPerPageUploadRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadPerPageBackground(bgPendingTarget.variant, bgPendingTarget.pageKey, f, bgPendingTarget.device); e.target.value=''; }} />
              {(user?.role === 'finance' || user?.role === 'ceo' ? ['kpi','performance'] : ['dashboard','employees','profile','documents','leave','settings','audit','kpi','performance']).map((page) => (
                <div key={page} className="grid gap-3 md:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">{page[0].toUpperCase()+page.slice(1)} - Original UI (Desktop)</label>
                    <div className="flex items-center gap-2">
                      <input className="flex-1" value={(draft.interface?.backgrounds?.original?.perPage?.[page]?.desktop) ?? (typeof draft.interface?.backgrounds?.original?.perPage?.[page] === 'string' ? draft.interface?.backgrounds?.original?.perPage?.[page] : '')} onChange={(e) => setBackgroundValue('original', page, (prev) => ({ ...(typeof prev === 'object' && prev ? prev : { desktop: String(prev || ''), mobile: String(prev || '') }), desktop: e.target.value }))} />
                      <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700" onClick={() => { setBgPendingTarget({ variant: 'original', pageKey: page, device: 'desktop' }); bgPerPageUploadRef.current?.click(); }}>Upload</button>
                      <button type="button" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700" onClick={() => setBackgroundValue('original', page, (prev) => ({ ...(typeof prev === 'object' && prev ? prev : { desktop: String(prev || ''), mobile: String(prev || '') }), desktop: '' }))}>Clear</button>
                    </div>
                    <label className="mt-2 mb-2 block text-sm font-medium text-slate-700">{page[0].toUpperCase()+page.slice(1)} - Original UI (Mobile)</label>
                    <div className="flex items-center gap-2">
                      <input className="flex-1" value={(draft.interface?.backgrounds?.original?.perPage?.[page]?.mobile) ?? (typeof draft.interface?.backgrounds?.original?.perPage?.[page] === 'string' ? draft.interface?.backgrounds?.original?.perPage?.[page] : '')} onChange={(e) => setBackgroundValue('original', page, (prev) => ({ ...(typeof prev === 'object' && prev ? prev : { desktop: String(prev || ''), mobile: String(prev || '' ) }), mobile: e.target.value }))} />
                      <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700" onClick={() => { setBgPendingTarget({ variant: 'original', pageKey: page, device: 'mobile' }); bgPerPageUploadRef.current?.click(); }}>Upload</button>
                      <button type="button" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700" onClick={() => setBackgroundValue('original', page, (prev) => ({ ...(typeof prev === 'object' && prev ? prev : { desktop: String(prev || ''), mobile: String(prev || '') }), mobile: '' }))}>Clear</button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">{page[0].toUpperCase()+page.slice(1)} - Redesigned UI (Desktop)</label>
                    <div className="flex items-center gap-2">
                      <input className="flex-1" value={(draft.interface?.backgrounds?.redesigned?.perPage?.[page]?.desktop) ?? (typeof draft.interface?.backgrounds?.redesigned?.perPage?.[page] === 'string' ? draft.interface?.backgrounds?.redesigned?.perPage?.[page] : '')} onChange={(e) => setBackgroundValue('redesigned', page, (prev) => ({ ...(typeof prev === 'object' && prev ? prev : { desktop: String(prev || ''), mobile: String(prev || '') }), desktop: e.target.value }))} />
                      <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700" onClick={() => { setBgPendingTarget({ variant: 'redesigned', pageKey: page, device: 'desktop' }); bgPerPageUploadRef.current?.click(); }}>Upload</button>
                      <button type="button" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700" onClick={() => setBackgroundValue('redesigned', page, (prev) => ({ ...(typeof prev === 'object' && prev ? prev : { desktop: String(prev || ''), mobile: String(prev || '') }), desktop: '' }))}>Clear</button>
                    </div>
                    <label className="mt-2 mb-2 block text-sm font-medium text-slate-700">{page[0].toUpperCase()+page.slice(1)} - Redesigned UI (Mobile)</label>
                    <div className="flex items-center gap-2">
                      <input className="flex-1" value={(draft.interface?.backgrounds?.redesigned?.perPage?.[page]?.mobile) ?? (typeof draft.interface?.backgrounds?.redesigned?.perPage?.[page] === 'string' ? draft.interface?.backgrounds?.redesigned?.perPage?.[page] : '')} onChange={(e) => setBackgroundValue('redesigned', page, (prev) => ({ ...(typeof prev === 'object' && prev ? prev : { desktop: String(prev || ''), mobile: String(prev || '') }), mobile: e.target.value }))} />
                      <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700" onClick={() => { setBgPendingTarget({ variant: 'redesigned', pageKey: page, device: 'mobile' }); bgPerPageUploadRef.current?.click(); }}>Upload</button>
                      <button type="button" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700" onClick={() => setBackgroundValue('redesigned', page, (prev) => ({ ...(typeof prev === 'object' && prev ? prev : { desktop: String(prev || ''), mobile: String(prev || '') }), mobile: '' }))}>Clear</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      ) : null}

      {!isCeoOnly && activePage === 'branding' ? (
        <div className="space-y-6">
          <SectionCard title="Branding and theme - Desktop" subtitle="These values control logos, gradients, cards, buttons, and main theme colors on larger screens.">
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
                ['faviconUrl', 'Tab Logo URL'],
                ['primaryColor', 'Primary Color'],
                ['secondaryColor', 'Secondary Color'],
                ['accentColor', 'Accent Color'],
                ['backgroundColor', 'Background Color'],
                ['cardColor', 'Card Color'],
                ['textColor', 'Text Color'],
                ['gradientFrom', 'Gradient From'],
                ['gradientTo', 'Gradient To']
              ].map(([key, label]) => (
                <SettingsInput key={key} label={label} value={draft.branding?.[key] || ''} onChange={(value) => setBranding(key, value)} colorPicker={key.toLowerCase().includes('color') || key.toLowerCase().includes('gradient')} />
              ))}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Tab logo upload</h3>
                    <p className="mt-1 text-sm text-slate-500">Upload an image for the browser tab icon, or paste a direct image URL above.</p>
                  </div>
                  {draft.branding?.faviconUrl ? (
                    <img src={draft.branding.faviconUrl} alt="Tab logo preview" className="h-10 w-10 rounded-lg border border-slate-200 bg-white object-contain p-1" />
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <input ref={faviconInputRef} type="file" accept="image/*" onChange={handleFaviconUpload} className="max-w-full text-sm text-slate-600" />
                  <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700" onClick={clearFavicon}>
                    Clear Tab Logo
                  </button>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Branding and theme - Mobile phone" subtitle="These colors apply on smaller screens when desktop colors on phones is turned off.">
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
                <SettingsInput key={key} label={label} value={draft.branding?.[key] || ''} onChange={(value) => setBranding(key, value)} colorPicker />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Brand preview" subtitle="Quick visual preview of your current desktop and mobile theme settings.">
            <div className="space-y-4">
              <div className="rounded-[2rem] p-6 text-white shadow-soft" style={{ background: `linear-gradient(135deg, ${draft.branding?.gradientFrom || '#14532d'}, ${draft.branding?.gradientTo || '#22c55e'})` }}>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold">
                  {draft.branding?.logoText || 'KH'}
                </div>
                <h3 className="mt-5 text-2xl font-semibold">{draft.branding?.organizationName || 'KEREA'}</h3>
                <p className="mt-2 text-sm text-white/80">{draft.branding?.appName || 'KEREA HRMS'}</p>
              </div>

              <div className="max-w-xs rounded-[2rem] p-5 text-white shadow-soft" style={{ background: `linear-gradient(135deg, ${draft.branding?.mobileGradientFrom || draft.branding?.gradientFrom || '#14532d'}, ${draft.branding?.mobileGradientTo || draft.branding?.gradientTo || '#22c55e'})` }}>
                <p className="text-xs uppercase tracking-[0.3em] text-white/70">Mobile preview</p>
                <h3 className="mt-4 text-xl font-semibold">{draft.branding?.organizationName || 'KEREA'}</h3>
                <p className="mt-2 text-sm text-white/80">{draft.branding?.appName || 'KEREA HRMS'}</p>
              </div>
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
          <div className="space-y-6">
          <SectionCard title="Login page controls - Desktop" subtitle="Edit the login page text, button label, footer text, and desktop visual identity.">
            <div className="grid gap-4 md:grid-cols-2">
              {LOGIN_PAGE_KEYS.map((key) => (
                <SettingsInput key={key} label={key} value={draft.labels?.[key] || ''} onChange={(value) => setLabel(key, value)} />
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
                <SettingsInput key={key} label={label} value={draft.branding?.[key] || ''} onChange={(value) => setBranding(key, value)} colorPicker={key !== 'logoText' && key !== 'organizationName'} />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Login page controls - Mobile phone" subtitle="Edit the mobile login colors that apply when phone colors differ from desktop.">
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ['mobileBackgroundColor', 'Mobile Page Background'],
                ['mobileCardColor', 'Mobile Card Background'],
                ['mobileGradientFrom', 'Mobile Gradient From'],
                ['mobileGradientTo', 'Mobile Gradient To'],
                ['mobilePrimaryColor', 'Mobile Button Color'],
                ['mobileTextColor', 'Mobile Text Color']
              ].map(([key, label]) => (
                <SettingsInput key={key} label={label} value={draft.branding?.[key] || ''} onChange={(value) => setBranding(key, value)} colorPicker />
              ))}
            </div>
          </SectionCard>
          </div>

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
        <div className="space-y-6">
          <SectionCard title="Navigation and menu - Desktop" subtitle="Edit sidebar labels and menu gradients on larger screens.">
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ['gradientFrom', 'Menu Gradient From', 'branding', true],
                ['gradientTo', 'Menu Gradient To', 'branding', true],
                ['navigationDashboard', 'Dashboard Label', 'labels', false],
                ['navigationEmployees', 'Employees Label', 'labels', false],
                ['navigationLeaves', 'Leaves Label', 'labels', false],
                ['navigationDocuments', 'Documents Label', 'labels', false],
                ['navigationSettings', 'Settings Label', 'labels', false],
                ['navigationAudit', 'Audit Label', 'labels', false]
              ].map(([key, label, source, colorPicker]) => (
                <SettingsInput key={key} label={label} value={source === 'labels' ? draft.labels?.[key] || '' : draft.branding?.[key] || ''} onChange={(value) => (source === 'labels' ? setLabel(key, value) : setBranding(key, value))} colorPicker={colorPicker} />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Navigation and menu - Mobile phone" subtitle="Edit the mobile open and close menu button styles.">
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ['mobileMenuGradientFrom', 'Menu Gradient From', true],
                ['mobileMenuGradientTo', 'Menu Gradient To', true],
                ['mobileMenuOpenBackgroundColor', 'Hamburger Background', true],
                ['mobileMenuOpenTextColor', 'Hamburger Icon Color', true],
                ['mobileMenuOpenBorderColor', 'Hamburger Border Color', true],
                ['mobileMenuCloseBackgroundColor', 'Close Button Background', true],
                ['mobileMenuCloseTextColor', 'Close Icon Color', true],
                ['mobileMenuCloseBorderColor', 'Close Border Color', true]
              ].map(([key, label, colorPicker]) => (
                <SettingsInput key={key} label={label} value={draft.branding?.[key] || ''} onChange={(value) => setBranding(key, value)} colorPicker={colorPicker} />
              ))}
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 md:col-span-2">
                <input type="checkbox" className="mt-1" checked={draft.interface?.mobileMenuAnimationEnabled !== false} onChange={(event) => setInterfaceField('mobileMenuAnimationEnabled', event.target.checked)} />
                <span>
                  <span className="block font-semibold text-slate-900">Enable menu open and close animation</span>
                  <span className="mt-1 block text-xs text-slate-500">Turn it off for an instant mobile menu.</span>
                </span>
              </label>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Menu animation style</label>
                <select value={draft.interface?.mobileMenuAnimationType || 'slide'} onChange={(event) => setInterfaceField('mobileMenuAnimationType', event.target.value)}>
                  <option value="slide">Slide</option>
                  <option value="fade">Fade</option>
                  <option value="scale">Scale</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Menu animation duration (ms)</label>
                <input type="number" min="120" max="1200" value={draft.interface?.mobileMenuAnimationDurationMs ?? 260} onChange={(event) => setInterfaceField('mobileMenuAnimationDurationMs', event.target.value)} />
              </div>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activePage === 'employees' ? (
        <div className="space-y-6">
          <div ref={employeesSectionRef}>
          <SectionCard
            title="Employees page"
            subtitle="Manage department sections, custom role titles, employee page labels, and jump to employee management."
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
              </button>,
              <button key="save-emp" type="button" onClick={handleSave} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">Save changes</button>
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
                <div key={`dept-${index}`} className="rounded-2xl border border-slate-200 p-4">
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

              <div className="pt-2">
                <div className="mb-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">Role titles</h3>
                      <p className="mt-1 text-sm text-slate-500">Create extra employee titles that appear in the Role dropdown. CEO, IT Officer, and Supervisor remain the only permission-based system roles.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddRoleTitle}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                    >
                      Add Title
                    </button>
                  </div>
                </div>
                <div className="space-y-4">
                  {roleTitles.length ? roleTitles.map((roleTitle, index) => (
                    <div key={`role-${index}`} className="rounded-2xl border border-slate-200 p-4">
                      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr),120px]">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">Title</label>
                          <input value={roleTitle.value || ''} onChange={(event) => updateRoleTitle(index, event.target.value)} placeholder="e.g. Accounts Officer" />
                        </div>
                        <div className="flex items-end">
                          <button type="button" className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700" onClick={() => handleRemoveRoleTitle(index)}>
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  )) : <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">No extra role titles yet. Add titles like Receptionist, Driver, or Accountant here.</div>}
                </div>
              </div>
            </div>
          </SectionCard>
          </div>
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

      {activePage === 'documents' ? (
        <div className="space-y-6">
          <SectionCard title="Documents page" subtitle="Edit the documents page heading, helper text, and available folder types.">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <SettingsInput label="Documents title" value={draft.labels?.documentsModuleTitle || ''} onChange={(value) => setLabel('documentsModuleTitle', value)} />
                <div className="md:col-span-2">
                  <SettingsInput label="Documents subtitle" value={draft.labels?.documentsSubtitle || ''} onChange={(value) => setLabel('documentsSubtitle', value)} />
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Document categories" subtitle="Define folder types with nested labels (e.g., Folder Type: Personal; Labels: Passport, National ID). Codes are generated automatically from names." actions={[
            <button key="add-cat" type="button" onClick={addDocumentCategory} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">Add Category</button>,
            <button key="save-doc-cats" type="button" onClick={handleSave} className="rounded-xl bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-lg">Save changes</button>
          ]}>
            <div className="space-y-4">
              {documentCategories.map((cat, cIndex) => (
                <div key={`${cat.code}-${cIndex}`} ref={(el) => { docCategoryRefs.current[cIndex] = el; }} className="rounded-2xl border border-slate-200 p-4">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr),120px]">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Folder type name</label>
                      <input value={cat.label || ''} onChange={(e) => updateDocumentCategory(cIndex, 'label', e.target.value)} placeholder="e.g. Personal Documents" />
                    </div>
                    <div className="flex items-end">
                      <button type="button" className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700" onClick={() => removeDocumentCategory(cIndex)}>Remove</button>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-700">Labels under this folder type</p>
                      <button type="button" className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700" onClick={() => addDocumentType(cIndex)}>Add Label</button>
                    </div>
                    {(cat.types || []).map((t, tIndex) => (
                      <div key={`${t.code}-${tIndex}`} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[minmax(0,1fr),100px]">
                        <input value={t.label || ''} onChange={(e) => updateDocumentType(cIndex, tIndex, 'label', e.target.value)} placeholder="e.g. Passport" />
                        <button type="button" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700" onClick={() => removeDocumentType(cIndex, tIndex)}>Remove</button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
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
              </button>,
              <button key="save-leave" type="button" onClick={handleSave} className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">Save changes</button>
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

          <SectionCard title="Leave page options" subtitle="Adjust the opacity of the leave cards that show leave days and remaining days.">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Leave cards opacity</label>
                <input type="number" min="0" max="1" step="0.05" value={draft.interface?.pageExperience?.leave?.leaveCardsOpacity ?? 1} onChange={(e) => setPageExperienceField('leave', 'leaveCardsOpacity', e.target.value)} />
              </div>
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
