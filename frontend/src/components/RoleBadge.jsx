import { useAuth } from '../context/AuthContext';

const styles = {
  employee: 'bg-emerald-50 text-emerald-700',
  supervisor: 'bg-cyan-50 text-cyan-700',
  hr: 'bg-blue-50 text-blue-700',
  admin: 'bg-purple-50 text-purple-700',
  ceo: 'bg-amber-50 text-amber-700'
};

export default function RoleBadge({ role, showActingLabel = false }) {
  const { settings } = useAuth();
  const actingHrLabel = settings?.labels?.actingHrLabel || 'CEO';
  const configuredRoleLabel = settings?.roles?.find((item) => item.key === role)?.label;
  const labels = {
    employee: configuredRoleLabel || 'employee',
    supervisor: configuredRoleLabel || 'supervisor',
    hr: showActingLabel ? actingHrLabel : (configuredRoleLabel || actingHrLabel),
    admin: configuredRoleLabel || 'admin',
    ceo: configuredRoleLabel || 'CEO'
  };

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${styles[role] || 'bg-slate-100 text-slate-700'}`}>
      {labels[role] || role}
    </span>
  );
}
