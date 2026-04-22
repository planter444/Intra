import { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import { fetchUsers } from '../services/userService';
import { updateSettings } from '../services/settingsService';
import { usePagePresentation } from '../hooks/usePagePresentation';
import { KPI_COUNT, getAverageKpiScore, getNormalizedKpiEntry, serializeKpiEntry } from '../utils/kpi';

const normalizeKpiScore = (value) => {
  if (value === '') {
    return '';
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return '';
  }

  return Math.max(0, Math.min(100, numericValue));
};

export default function KPIMatrixPage() {
  const { user, settings, replaceSettings } = useAuth();
  const [users, setUsers] = useState([]);
  const [records, setRecords] = useState(() => ({ ...(settings?.kpi?.matrix || {}), ...(settings?.kpi?.records || {}) }));
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const canEdit = ['admin', 'ceo', 'finance'].includes(user?.role);
  const { cardStyle, animationStyle } = usePagePresentation();

  useEffect(() => {
    fetchUsers().then((list) => setUsers(list)).catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    setRecords({ ...(settings?.kpi?.matrix || {}), ...(settings?.kpi?.records || {}) });
  }, [settings?.kpi?.matrix, settings?.kpi?.records]);

  const rows = useMemo(
    () => users.filter((u) => u.isActive && !u.isDeleted && u.role !== 'ceo').sort((left, right) => left.fullName.localeCompare(right.fullName)),
    [users]
  );

  const selectedEmployee = useMemo(
    () => rows.find((employee) => String(employee.id) === String(selectedEmployeeId)) || rows[0] || null,
    [rows, selectedEmployeeId]
  );

  useEffect(() => {
    if (!rows.length) {
      setSelectedEmployeeId('');
      return;
    }

    if (!rows.some((employee) => String(employee.id) === String(selectedEmployeeId))) {
      setSelectedEmployeeId(String(rows[0].id));
    }
  }, [rows, selectedEmployeeId]);

  const getEntry = (id) => getNormalizedKpiEntry(records[String(id)] || settings?.kpi?.matrix?.[String(id)] || {});

  const updateEntry = (id, updater) => {
    setRecords((current) => {
      const next = { ...(current || {}) };
      const key = String(id);
      const prev = getNormalizedKpiEntry(next[key] || settings?.kpi?.matrix?.[key] || {});
      next[key] = serializeKpiEntry(typeof updater === 'function' ? updater(prev) : updater);
      return next;
    });
  };

  const setCoreRole = (index, value) => {
    if (!selectedEmployee || !canEdit) {
      return;
    }

    updateEntry(selectedEmployee.id, (current) => ({
      ...current,
      coreRoles: current.coreRoles.map((role, roleIndex) => roleIndex === index ? value : role)
    }));
  };

  const setIndicator = (index, key, value) => {
    if (!selectedEmployee || !canEdit) {
      return;
    }

    updateEntry(selectedEmployee.id, (current) => ({
      ...current,
      indicators: current.indicators.map((indicator, indicatorIndex) => indicatorIndex === index ? {
        ...indicator,
        [key]: key === 'score' ? normalizeKpiScore(value) : value
      } : indicator)
    }));
  };

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    setMessage('');
    try {
      const matrix = Object.entries(records || {}).reduce((accumulator, [employeeId, entry]) => {
        accumulator[employeeId] = Array.from({ length: KPI_COUNT }, (_, index) => ({
          [`k${index + 1}`]: entry?.indicators?.[index]?.score ?? entry?.[`k${index + 1}`] ?? ''
        })).reduce((scores, item) => ({ ...scores, ...item }), {});
        return accumulator;
      }, {});
      const payload = { kpi: { ...(settings?.kpi || {}), records, matrix } };
      const updated = await updateSettings(payload);
      replaceSettings(updated);
      setMessage('KPI matrix saved successfully.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to save KPI matrix right now.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="KPI Matrix" subtitle="Select an employee to view or update their core roles, five KPI wordings, individual scores, and average score." actions={canEdit ? [
        <button key="save" type="button" disabled={saving} onClick={handleSave} className="rounded-2xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-white shadow-lg">
          <span className="inline-flex items-center gap-2"><Save size={16} />{saving ? 'Saving…' : 'Save matrix'}</span>
        </button>
      ] : undefined} />

      {message ? <div className={`rounded-2xl px-4 py-3 text-sm ${message.includes('Unable') ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[320px,minmax(0,1fr)]">
        <SectionCard title="Employees" subtitle="Click an employee to view their KPI details." style={{ ...cardStyle, ...animationStyle }}>
          <div className="space-y-3">
            {rows.map((employee) => {
              const entry = getEntry(employee.id);
              const average = getAverageKpiScore(entry);
              const isSelected = String(employee.id) === String(selectedEmployee?.id);

              return (
                <button
                  key={employee.id}
                  type="button"
                  onClick={() => setSelectedEmployeeId(String(employee.id))}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${isSelected ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{employee.fullName}</p>
                      <p className="mt-1 text-sm text-slate-500">{employee.positionTitle || employee.roleTitle || 'No designation'}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${average === null ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>{average ?? '—'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title={selectedEmployee ? selectedEmployee.fullName : 'Employee KPI details'}
          subtitle={selectedEmployee ? `${selectedEmployee.positionTitle || selectedEmployee.roleTitle || 'No designation'} · Average score ${getAverageKpiScore(getEntry(selectedEmployee.id)) ?? '—'}` : 'Select an employee to see their KPI details.'}
          style={{ ...cardStyle, ...animationStyle }}
        >
          {!selectedEmployee ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-sm text-slate-500">No employee selected.</div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <StatCard title="Employee" value={selectedEmployee.fullName} helper="Selected employee" accent="from-emerald-700 to-green-500" />
                <StatCard title="Designation" value={selectedEmployee.positionTitle || selectedEmployee.roleTitle || 'Not set'} helper="Displayed across KPI views" accent="from-sky-700 to-cyan-500" />
                <StatCard title="Average Score" value={getAverageKpiScore(getEntry(selectedEmployee.id)) ?? '--'} helper="Based on all entered KPI scores" accent="from-violet-700 to-fuchsia-500" />
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <h3 className="text-base font-semibold text-slate-900">Core roles</h3>
                <p className="mt-1 text-sm text-slate-500">These appear as the employee’s main responsibilities.</p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {getEntry(selectedEmployee.id).coreRoles.map((role, index) => (
                    <div key={`role-${index}`}>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Core role {index + 1}</label>
                      <input value={role || ''} onChange={(event) => setCoreRole(index, event.target.value)} placeholder="Enter core role" disabled={!canEdit} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <h3 className="text-base font-semibold text-slate-900">Five KPIs</h3>
                <p className="mt-1 text-sm text-slate-500">Set the wording and score for each KPI.</p>
                <div className="mt-4 space-y-4">
                  {getEntry(selectedEmployee.id).indicators.map((indicator, index) => (
                    <div key={`indicator-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr),140px]">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">KPI {index + 1} wording</label>
                          <input value={indicator.label || ''} onChange={(event) => setIndicator(index, 'label', event.target.value)} placeholder="Enter KPI wording" disabled={!canEdit} />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">Score</label>
                          <input type="number" min="0" max="100" value={indicator.score ?? ''} onChange={(event) => setIndicator(index, 'score', event.target.value)} placeholder="0-100" disabled={!canEdit} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
