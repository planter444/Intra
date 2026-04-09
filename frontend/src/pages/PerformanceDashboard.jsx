import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import { useAuth } from '../context/AuthContext';
import { fetchUsers } from '../services/userService';
import { usePagePresentation } from '../hooks/usePagePresentation';

const KPI_COUNT = 5;

export default function PerformanceDashboard() {
  const { settings, user } = useAuth();
  const [users, setUsers] = useState([]);
  const { cardStyle, animationStyle } = usePagePresentation();
  const canView = user?.role === 'ceo' || user?.role === 'finance';

  useEffect(() => {
    fetchUsers().then((list) => setUsers(list)).catch(() => setUsers([]));
  }, []);

  const rows = useMemo(() => users.filter((u) => u.isActive && !u.isDeleted), [users]);

  const getAverage = (id) => {
    const entry = settings?.kpi?.matrix?.[String(id)] || {};
    const values = Array.from({ length: KPI_COUNT }, (_, i) => {
      const v = Number(entry[`k${i + 1}`]);
      return Number.isFinite(v) ? v : null;
    }).filter((v) => v !== null);
    return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
  };

  const data = rows.map((emp) => ({ id: emp.id, name: emp.fullName, avg: getAverage(emp.id) }));

  return (
    <div className="space-y-6">
      <PageHeader title="KPI Performance Dashboard" subtitle="Average KPI score per employee." />
      <SectionCard style={{ ...cardStyle, ...animationStyle }}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-3 pr-4 font-medium">Name</th>
                <th className="pb-3 font-medium">Average Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((row) => (
                <tr key={row.id}>
                  <td className="py-3 pr-4">
                    <p className="font-medium text-slate-900">{row.name}</p>
                  </td>
                  <td className="py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${row.avg === null ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>{row.avg ?? '—'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
