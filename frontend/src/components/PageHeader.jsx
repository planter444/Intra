import { usePagePresentation } from '../hooks/usePagePresentation';

export default function PageHeader({ title, subtitle, actions, animationOrder = 0 }) {
  const { animationStyle } = usePagePresentation({ animationOrder });

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between" style={animationStyle}>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-3xl text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">{actions}</div> : null}
    </div>
  );
}
