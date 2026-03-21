export default function LoadingScreen({ label = 'Loading KEREA HRMS...' }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page px-4">
      <div className="rounded-3xl bg-white px-8 py-10 text-center shadow-soft">
        <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-2xl bg-brand-gradient" />
        <p className="text-sm font-medium text-slate-600">{label}</p>
      </div>
    </div>
  );
}
