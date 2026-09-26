// Presentation only: never use the returned text in calculations or payloads.
const weightFormatters = {
  kg: new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }),
  g: new Intl.NumberFormat('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false }),
};

function formatWeight(value, unit) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  const minimum = unit === 'kg' ? 0.01 : 0.1;
  if (numeric !== 0 && Math.abs(numeric) < minimum) {
    return numeric > 0
      ? `<${weightFormatters[unit].format(minimum)}`
      : `>-${weightFormatters[unit].format(minimum)}`;
  }
  return weightFormatters[unit].format(numeric === 0 ? 0 : numeric);
}

export const formatKg = (value) => formatWeight(value, 'kg');
export const formatGrams = (value) => formatWeight(value, 'g');
