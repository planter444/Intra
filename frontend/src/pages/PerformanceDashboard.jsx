import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import { fetchUsers } from '../services/userService';
import { usePagePresentation } from '../hooks/usePagePresentation';
import { getAverageKpiScore, getNormalizedKpiEntry } from '../utils/kpi';

export default function PerformanceDashboard() {
  const { settings, user } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const { cardStyle, animationStyle } = usePagePresentation();
  const canView = ['admin', 'ceo', 'finance'].includes(user?.role);

  useEffect(() => {
    fetchUsers().then((list) => setUsers(list)).catch(() => setUsers([]));
  }, []);

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

  const getEntry = (id) => getNormalizedKpiEntry(settings?.kpi?.records?.[String(id)] || settings?.kpi?.matrix?.[String(id)] || {});

  return (
    <div className="space-y-6">
      <PageHeader title="Performance Dashboard" subtitle="Review each employee’s saved KPI wording, scores, core roles, and overall average performance." />

      <div className="grid gap-6 xl:grid-cols-[320px,minmax(0,1fr)]">
        <SectionCard title="Employees" subtitle="Select an employee to review their performance snapshot." style={{ ...cardStyle, ...animationStyle }}>
          <div className="space-y-3">
            {rows.map((employee) => {
              const average = getAverageKpiScore(getEntry(employee.id));
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
          title={selectedEmployee ? selectedEmployee.fullName : 'Employee performance'}
          subtitle={selectedEmployee ? `${selectedEmployee.positionTitle || selectedEmployee.roleTitle || 'No designation'} · Average score ${getAverageKpiScore(getEntry(selectedEmployee.id)) ?? '—'}` : 'Select an employee to view details.'}
          style={{ ...cardStyle, ...animationStyle }}
        >
          {!canView || !selectedEmployee ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-sm text-slate-500">No employee performance selected.</div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <StatCard title="Employee" value={selectedEmployee.fullName} helper="Performance profile" accent="from-emerald-700 to-green-500" />
                <StatCard title="Designation" value={selectedEmployee.positionTitle || selectedEmployee.roleTitle || 'Not set'} helper="Role/designation saved for the employee" accent="from-sky-700 to-cyan-500" />
                <StatCard title="Average score" value={getAverageKpiScore(getEntry(selectedEmployee.id)) ?? '--'} helper="Average based on the scored KPIs" accent="from-violet-700 to-fuchsia-500" />
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <h3 className="text-base font-semibold text-slate-900">Core roles</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {getEntry(selectedEmployee.id).coreRoles.some((role) => role) ? getEntry(selectedEmployee.id).coreRoles.map((role, index) => (
                    role ? <div key={`role-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{role}</div> : null
                  )) : <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 md:col-span-2">No core roles have been configured for this employee yet.</div>}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <h3 className="text-base font-semibold text-slate-900">KPI breakdown</h3>
                <div className="mt-4 space-y-4">
                  {getEntry(selectedEmployee.id).indicators.map((indicator, index) => (
                    <div key={`indicator-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">KPI {index + 1}</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{indicator.label || 'No KPI wording set yet.'}</p>
                        </div>
                        <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${indicator.score === '' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>{indicator.score === '' ? 'No score' : `${indicator.score}%`}</span>
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
