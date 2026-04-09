import { usePagePresentation } from '../hooks/usePagePresentation';

export default function StatCard({ title, value, helper, accent = 'from-emerald-700 to-emerald-500', onClick, animationOrder = 0 }) {
  const { animationStyle, cardStyle } = usePagePresentation({ animationOrder });
  const classes = `min-w-0 rounded-3xl bg-white p-4 shadow-soft sm:p-5 ${onClick ? 'w-full text-left hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-200' : ''}`;
  const text = String(value ?? '');
  const tokens = text.split(/\s+/).filter(Boolean);
  const renderValue = () => (
    <span className="inline-flex max-w-full flex-wrap items-baseline gap-x-1" style={{ wordBreak: 'normal', overflowWrap: 'normal' }}>
      {tokens.length === 0 ? (
        <span>--</span>
      ) : (
        tokens.map((tok, idx) => (
          <span key={`${tok}-${idx}`} className={tok.length > 14 ? 'text-xl sm:text-2xl' : undefined}>{tok}{idx < tokens.length - 1 ? ' ' : ''}</span>
        ))
      )}
    </span>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes} style={{ ...cardStyle, ...animationStyle }}>
        <div className={`mb-4 h-2 w-20 rounded-full bg-gradient-to-r ${accent}`} />
        <p className="text-sm text-slate-500">{title}</p>
        <p className="mt-2 text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">{renderValue()}</p>
        {helper ? <p className="mt-2 text-sm text-slate-500">{helper}</p> : null}
      </button>
    );
  }

  return (
    <div className={classes} style={{ ...cardStyle, ...animationStyle }}>
      <div className={`mb-4 h-2 w-20 rounded-full bg-gradient-to-r ${accent}`} />
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">{renderValue()}</p>
      {helper ? <p className="mt-2 text-sm text-slate-500">{helper}</p> : null}
    </div>
  );
}
