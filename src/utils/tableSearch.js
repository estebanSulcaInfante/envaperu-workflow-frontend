const normalizeText = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es-PE')
  .trim();

const flattenSearchValue = (value, seen = new WeakSet()) => {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '';
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => flattenSearchValue(item, seen)).join(' ');
  return Object.values(value).map((item) => flattenSearchValue(item, seen)).join(' ');
};

export const matchesOmniSearch = (row, query, selectors) => {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return true;
  const source = selectors?.length
    ? selectors.map((selector) => (typeof selector === 'function' ? selector(row) : row?.[selector]))
    : row;
  return normalizeText(flattenSearchValue(source)).includes(normalizedQuery);
};

export const uniqueOptions = (rows, selector) => [...new Set(rows
  .map((row) => (typeof selector === 'function' ? selector(row) : row?.[selector]))
  .filter((value) => value !== null && value !== undefined && value !== ''))]
  .sort((left, right) => String(left).localeCompare(String(right), 'es'));
