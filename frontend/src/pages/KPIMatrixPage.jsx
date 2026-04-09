import { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import { useAuth } from '../context/AuthContext';
import { fetchUsers } from '../services/userService';
import { updateSettings } from '../services/settingsService';
import { usePagePresentation } from '../hooks/usePagePresentation';

const KPI_COUNT = 5;

export default function KPIMatrixPage() {
  const { user, settings, replaceSettings } = useAuth();
  const [users, setUsers] = useState([]);
  const [matrix, setMatrix] = useState(() => ({ ...(settings?.kpi?.matrix || {}) }));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const canEdit = user?.role === 'ceo' || user?.role === 'finance';
  const { cardStyle, animationStyle } = usePagePresentation();

  useEffect(() => {
    fetchUsers().then((list) => setUsers(list)).catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    setMatrix({ ...(settings?.kpi?.matrix || {}) });
  }, [settings?.kpi?.matrix]);

  const rows = useMemo(() => users.filter((u) => u.isActive && !u.isDeleted), [users]);

  const getEntry = (id) => {
    const entry = matrix[String(id)] || {};
    const values = Array.from({ length: KPI_COUNT }, (_, i) => {
      const v = Number(entry[`k${i + 1}`]);
      return Number.isFinite(v) ? v : null;
    });
    const valid = values.filter((v) => v !== null);
    const avg = valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
    return { values, avg };
  };

  const setValue = (id, index, raw) => {
    const v = raw === '' ? '' : Math.max(0, Math.min(100, Number(raw)));
    setMatrix((current) => {
      const next = { ...(current || {}) };
      const key = String(id);
      const prev = next[key] || {};
      next[key] = { ...prev, [`k${index + 1}`]: raw === '' ? '' : v };
      return next;
    });
  };

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    setMessage('');
    try {
      const payload = { ...(settings || {}), kpi: { ...(settings?.kpi || {}), matrix } };
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
      <PageHeader title="KPI Matrix" subtitle="Enter KPI scores (0-100). Average score is computed per employee." actions={canEdit ? [
        <button key="save" type="button" disabled={saving} onClick={handleSave} className="rounded-2xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-white shadow-lg">
          <span className="inline-flex items-center gap-2"><Save size={16} />{saving ? 'Saving…' : 'Save matrix'}</span>
        </button>
      ] : undefined} />

      {message ? <div className={`rounded-2xl px-4 py-3 text-sm ${message.includes('Unable') ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{message}</div> : null}

      <SectionCard title="KPI Inputs" subtitle="Fill in KPI 1 to KPI 5 for each active employee." style={{ ...cardStyle, ...animationStyle }}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-3 pr-4 font-medium">Name</th>
                <th className="pb-3 pr-4 font-medium">Designation</th>
                {Array.from({ length: KPI_COUNT }, (_, i) => (
                  <th key={`h-${i}`} className="pb-3 pr-4 font-medium">KPI {i + 1}</th>
                ))}
                <th className="pb-3 font-medium">Average Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((emp) => {
                const entry = getEntry(emp.id);
                return (
                  <tr key={emp.id}>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-slate-900">{emp.fullName}</p>
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{emp.positionTitle || emp.roleTitle || '—'}</td>
                    {Array.from({ length: KPI_COUNT }, (_, i) => (
                      <td key={`c-${emp.id}-${i}`} className="py-3 pr-4">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={100}
                          placeholder="—"
                          value={matrix[String(emp.id)]?.[`k${i + 1}`] ?? ''}
                          onChange={(e) => setValue(emp.id, i, e.target.value)}
                          className="w-24"
                          disabled={!canEdit}
                        />
                      </td>
                    ))}
                    <td className="py-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{entry.avg ?? '—'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
