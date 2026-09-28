export const GROUP_OPTIONS = ['DIA', 'MES', 'OF', 'CORRIDA', 'COLOR', 'OT', 'RECURSO', 'RESPONSABLE', 'ARTICULO'];
export const MEASURE_OPTIONS = ['PESO_KG', 'MANGAS', 'P_UNITARIO_G', 'P_TEORICO_KG'];

export const GROUP_LABELS = {
  DIA: 'Día',
  MES: 'Mes',
  OF: 'OF',
  CORRIDA: 'Objetivo de color',
  COLOR: 'Color',
  OT: 'OT',
  RECURSO: 'Recurso',
  RESPONSABLE: 'Responsable',
  ARTICULO: 'Artículo',
};

export const MEASURE_LABELS = {
  PESO_KG: 'Peso efectivo (kg)',
  MANGAS: 'Mangas',
  P_UNITARIO_G: 'Peso unitario promedio (g)',
  P_TEORICO_KG: 'Peso teórico según unidades (kg)',
};

export const limaToday = () => {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${value.year}-${value.month}-${value.day}`;
};

export const createDefaultProductionHistoryFilters = (today = limaToday()) => ({
  desde: today,
  hasta: today,
  q: '',
  agrupaciones: ['DIA'],
  medidas: [...MEASURE_OPTIONS],
});

const splitParam = (value) => (value === '' || value == null
  ? []
  : String(value).split(',').map((item) => item.trim()));

export const parseProductionHistoryParams = (params) => {
  const next = createDefaultProductionHistoryFilters();
  ['desde', 'hasta', 'q'].forEach((key) => {
    if (params.get(key) !== null) next[key] = params.get(key);
  });
  if (params.get('agrupaciones') !== null) next.agrupaciones = splitParam(params.get('agrupaciones'));
  if (params.get('medidas') !== null) next.medidas = splitParam(params.get('medidas'));
  return next;
};

export const serializeProductionHistoryFilters = (filters) => ({
  desde: filters.desde,
  hasta: filters.hasta,
  q: filters.q,
  agrupaciones: (filters.agrupaciones || []).join(','),
  medidas: (filters.medidas || []).join(','),
});

export const hasMeasureSelection = (filters) => (filters.medidas || []).length > 0;

export const normalizeSearchText = (value) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();

const isIsoDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};

const validateOptions = (values, allowed, noun, { allowEmpty = false } = {}) => {
  if (allowEmpty && values.length === 0) return '';
  if (values.some((value) => !value)) return `La selección de ${noun} contiene una opción vacía.`;
  if (values.some((value) => !allowed.includes(value))) return `La selección de ${noun} contiene una opción inválida.`;
  if (new Set(values).size !== values.length) return `La selección de ${noun} contiene duplicados.`;
  return '';
};

export const validateProductionHistoryFilters = (filters) => {
  if (!isIsoDate(filters.desde) || !isIsoDate(filters.hasta)) return 'Las fechas deben usar YYYY-MM-DD y existir en el calendario.';
  if (filters.desde > filters.hasta) return 'Desde no puede ser posterior a Hasta.';
  return validateOptions(filters.agrupaciones || [], GROUP_OPTIONS, 'agrupaciones', { allowEmpty: true })
    || validateOptions(filters.medidas || [], MEASURE_OPTIONS, 'medidas');
};

export const sameProductionHistoryFilters = (left, right) => (
  ['desde', 'hasta', 'q'].every((key) => left[key] === right[key])
  && ['agrupaciones', 'medidas'].every((key) => JSON.stringify(left[key] || []) === JSON.stringify(right[key] || []))
);
