export const KPI_COUNT = 5;

const normalizeScore = (value) => {
  if (value === '' || value === null || value === undefined) {
    return '';
  }

  const nextValue = Number(value);
  if (!Number.isFinite(nextValue)) {
    return '';
  }

  return Math.max(0, Math.min(100, nextValue));
};

export const getEmptyKpiEntry = () => ({
  coreRoles: Array.from({ length: KPI_COUNT }, () => ''),
  indicators: Array.from({ length: KPI_COUNT }, () => ({ label: '', score: '' }))
});

export const getNormalizedKpiEntry = (entry = {}) => {
  const base = getEmptyKpiEntry();
  const normalizedIndicators = base.indicators.map((indicator, index) => {
    const rawIndicator = Array.isArray(entry?.indicators) ? entry.indicators[index] : null;
    const legacyScore = entry?.[`k${index + 1}`];

    return {
      label: String(rawIndicator?.label || '').trim(),
      score: normalizeScore(rawIndicator?.score ?? legacyScore)
    };
  });

  return {
    coreRoles: base.coreRoles.map((role, index) => String(Array.isArray(entry?.coreRoles) ? entry.coreRoles[index] || '' : '').trim()),
    indicators: normalizedIndicators
  };
};

export const serializeKpiEntry = (entry = {}) => {
  const normalized = getNormalizedKpiEntry(entry);

  return normalized.indicators.reduce((accumulator, indicator, index) => {
    accumulator[`k${index + 1}`] = indicator.score;
    return accumulator;
  }, {
    coreRoles: normalized.coreRoles,
    indicators: normalized.indicators
  });
};

export const getAverageKpiScore = (entry = {}) => {
  const normalized = getNormalizedKpiEntry(entry);
  const scores = normalized.indicators
    .map((indicator) => Number(indicator.score))
    .filter((score) => Number.isFinite(score));

  if (!scores.length) {
    return null;
  }

  return Math.round(scores.reduce((total, score) => total + score, 0) / scores.length);
};
