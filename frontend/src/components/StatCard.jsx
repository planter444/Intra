import { usePagePresentation } from '../hooks/usePagePresentation';

export default function StatCard({ title, value, helper, accent = 'from-emerald-700 to-emerald-500', onClick, animationOrder = 0 }) {
  const { animationStyle, cardStyle } = usePagePresentation({ animationOrder });
  const classes = `min-w-0 rounded-3xl bg-white p-4 shadow-soft sm:p-5 ${onClick ? 'w-full text-left hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-200' : ''}`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes} style={{ ...cardStyle, ...animationStyle }}>
        <div className={`mb-4 h-2 w-20 rounded-full bg-gradient-to-r ${accent}`} />
        <p className="text-sm text-slate-500">{title}</p>
        <p className="mt-2 break-words text-2xl font-semibold text-slate-900 sm:text-3xl">{value}</p>
        {helper ? <p className="mt-2 text-sm text-slate-500">{helper}</p> : null}
      </button>
    );
  }

  return (
    <div className={classes} style={{ ...cardStyle, ...animationStyle }}>
      <div className={`mb-4 h-2 w-20 rounded-full bg-gradient-to-r ${accent}`} />
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 break-words text-2xl font-semibold text-slate-900 sm:text-3xl">{value}</p>
      {helper ? <p className="mt-2 text-sm text-slate-500">{helper}</p> : null}
    </div>
  );
}
