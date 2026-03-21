export default function StatCard({ title, value, helper, accent = 'from-emerald-700 to-emerald-500' }) {
  return (
    <div className="min-w-0 rounded-3xl bg-white p-4 sm:p-5 shadow-soft">
      <div className={`mb-4 h-2 w-20 rounded-full bg-gradient-to-r ${accent}`} />
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 break-words text-2xl font-semibold text-slate-900 sm:text-3xl">{value}</p>
      {helper ? <p className="mt-2 text-sm text-slate-500">{helper}</p> : null}
    </div>
  );
}
