const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const outputNetSpec = (output, mold) => {
  const shape = (mold?.formas || []).find((item) => (
    item.activo !== false && item.pieza_id === output.articulo?.pieza_id
  ));
  const quantity = Number(output.cantidad_por_ciclo_snapshot ?? output.cantidad_por_ciclo ?? shape?.cavidades);
  const unitWeight = Number(output.peso_unitario_snapshot_g ?? output.peso_unitario_g ?? shape?.peso_unitario_gr);
  if (!(quantity > 0) || !(unitWeight > 0)) return null;
  return { quantity, unitWeight };
};

const ceilDecimalRatio = (numerator, denominator) => {
  const ratio = Number(numerator) / Number(denominator);
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  const nearestInteger = Math.round(ratio);
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(ratio)) * 32;
  return Math.abs(ratio - nearestInteger) <= tolerance ? nearestInteger : Math.ceil(ratio);
};

export const runNetMetrics = (run, draftRun, mold) => {
  const outputs = run?.salidas || [];
  const specs = outputs.map((output) => outputNetSpec(output, mold));
  const kgPerCycle = specs.every(Boolean)
    ? specs.reduce((total, spec) => total + (spec.quantity * spec.unitWeight) / 1000, 0)
    : null;
  const minimumCycles = outputs.reduce((minimum, output, index) => {
    const spec = specs[index];
    const required = Number(output.cantidad_objetivo || 0) - Number(output.excedente_objetivo || 0);
    if (!spec || !(required > 0)) return minimum;
    return Math.max(minimum, ceilDecimalRatio(required, spec.quantity));
  }, 1);
  const objective = Number(draftRun?.objetivo_neto_kg ?? '');
  const hasObjective = objective > 0;
  const legacyCycles = Number(draftRun?.ciclos_objetivo || run?.ciclos_objetivo || 0);
  const cyclesFromKg = hasObjective && kgPerCycle > 0 ? ceilDecimalRatio(objective, kgPerCycle) : null;
  const cycles = hasObjective ? Math.max(minimumCycles, cyclesFromKg || 0) : Math.max(minimumCycles, legacyCycles);
  const reachableKg = kgPerCycle > 0 && cycles > 0 ? cycles * kgPerCycle : null;
  const roundingKg = hasObjective && reachableKg != null ? reachableKg - objective : null;
  return { hasObjective, objective, kgPerCycle, minimumCycles, cycles, cyclesFromKg, reachableKg, roundingKg };
};

export const normalizeSearchText = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleUpperCase();

export const displayProvenance = (value) => {
  if (!value || typeof value !== 'object') return value ? String(value) : '';
  return [value.op_codigo, value.codigo, value.propuesta_clave, value.tipo, value.op_id, value.plan_id]
    .filter(Boolean).join(' · ');
};

export const orderSearchText = (order) => [
  order?.codigo,
  order?.molde_id,
  order?.molde?.codigo,
  order?.molde?.nombre,
  displayProvenance(order?.procedencia),
  order?.origen_demanda,
  order?.propuesta_clave,
  order?.motivo,
  ...(order?.corridas || []).flatMap((run) => [
    run?.codigo,
    run?.color,
    run?.color_nombre,
    run?.color_produccion?.nombre,
    ...(run?.salidas || []).flatMap((output) => [
      output?.articulo?.codigo,
      output?.articulo?.nombre,
      output?.color,
      output?.color_nombre,
    ]),
  ]),
].filter(Boolean).join(' ');

export const compareOrders = (left, right, order = 'reciente') => {
  if (order === 'codigo') {
    return String(left?.codigo || '').localeCompare(String(right?.codigo || ''), 'es', { numeric: true });
  }
  const leftDate = left?.created_at ? Date.parse(left.created_at) : Number.NEGATIVE_INFINITY;
  const rightDate = right?.created_at ? Date.parse(right.created_at) : Number.NEGATIVE_INFINITY;
  if (leftDate !== rightDate) return rightDate - leftDate;
  return String(left?.id || '').localeCompare(String(right?.id || ''));
};

export const filterAndSortOrders = (
  orders = [], { query = '', status = 'SIN_ANULADAS', order = 'reciente' } = {},
) => {
  const normalizedQuery = normalizeSearchText(query).trim();
  return orders
    .filter((item) => status === 'TODOS' || (
      status === 'SIN_ANULADAS' ? item.estado !== 'ANULADA' : item.estado === status
    ))
    .filter((item) => !normalizedQuery || normalizeSearchText(orderSearchText(item)).includes(normalizedQuery))
    .sort((left, right) => compareOrders(left, right, order));
};

export const paginateOrders = (orders = [], page = 1, pageSize = 25) => {
  const size = [25, 50, 100].includes(Number(pageSize)) ? Number(pageSize) : 25;
  const totalPages = Math.max(1, Math.ceil(orders.length / size));
  const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  return {
    items: orders.slice((currentPage - 1) * size, currentPage * size),
    page: currentPage,
    pageSize: size,
    totalPages,
    total: orders.length,
  };
};

const coverageState = (item) => String(
  item?.coverage?.estado || item?.cobertura?.estado || item?.coverage_status || '',
).toUpperCase();

const progressId = (item) => item?.corrida_id || item?.corrida?.id || item?.corrida;

export const projectOrderProgress = (
  order,
  progressItems = [],
  { canViewOt = true, canViewWeights = true, error = false, loading = false } = {},
) => {
  if (!canViewOt || !canViewWeights) return { state: 'restricted', label: 'Avance restringido' };
  if (error) return { state: 'error', label: 'Avance no disponible · Reintentar' };
  const runs = order?.corridas || [];
  if (!runs.length) return { state: 'incomplete', label: 'No calculable · meta incompleta' };
  const byId = new Map();
  let duplicate = false;
  const expectedIds = new Set(runs.map((run) => run.id));
  const duplicateExpectedIds = expectedIds.size !== runs.length;
  progressItems.forEach((item) => {
    const id = progressId(item);
    if (!id || !expectedIds.has(id)) return;
    if (byId.has(id)) duplicate = true;
    byId.set(id, item);
  });
  const rows = runs.map((run) => ({ run, progress: byId.get(run.id) || null }));
  const metas = rows.map(({ run }) => toFiniteNumber(run.objetivo_neto_kg));
  const hasValidMeta = metas.every((value) => value !== null && value > 0);
  const hasAllRows = rows.every(({ progress }) => progress);
  const completeCoverage = rows.every(({ progress }) => coverageState(progress) === 'COMPLETA');
  const progressTargetsPresent = rows.every(({ progress }) => (
    toFiniteNumber(progress?.objetivo_neto_kg) !== null
  ));
  const measuredValuesPresent = rows.every(({ progress }) => {
    const value = toFiniteNumber(progress?.kg_medidos_efectivos);
    return value !== null && value >= 0;
  });
  const openFieldPresent = rows.every(({ progress }) => (
    ['kg_medidos_en_abiertas', 'kg_abiertas', 'kg_en_proceso']
      .some((key) => Object.prototype.hasOwnProperty.call(progress || {}, key))
  ));
  const openValuesValid = rows.every(({ progress }) => {
    const hasOpenField = ['kg_medidos_en_abiertas', 'kg_abiertas', 'kg_en_proceso']
      .some((key) => Object.prototype.hasOwnProperty.call(progress || {}, key));
    if (!hasOpenField) return true;
    const value = toFiniteNumber(
      progress?.kg_medidos_en_abiertas ?? progress?.kg_abiertas ?? progress?.kg_en_proceso,
    );
    return value !== null && value >= 0;
  });
  const progressMetasMatch = rows.every(({ run, progress }) => {
    const reported = toFiniteNumber(progress?.objetivo_neto_kg);
    return reported !== null && reported === toFiniteNumber(run.objetivo_neto_kg);
  });
  const finalizedValuesValid = rows.every(({ progress }) => {
    const value = toFiniteNumber(progress?.kg_finalizados_efectivos);
    return value !== null && value >= 0;
  });
  const knownFinalized = rows.reduce((sum, { progress }) => {
    const value = toFiniteNumber(progress?.kg_finalizados_efectivos);
    return value === null || value < 0 ? sum : sum + value;
  }, 0);
  const openKg = rows.reduce((sum, { progress }) => {
    const value = toFiniteNumber(
      progress?.kg_medidos_en_abiertas ?? progress?.kg_abiertas ?? progress?.kg_en_proceso,
    );
    return value === null ? sum : sum + value;
  }, 0);
  if (duplicate || duplicateExpectedIds || !hasValidMeta || !hasAllRows || !completeCoverage
    || !measuredValuesPresent || !openFieldPresent || !openValuesValid || !progressTargetsPresent || !progressMetasMatch || !finalizedValuesValid) {
    const noWeighingEvidence = hasAllRows && rows.every(({ progress }) => (
      toFiniteNumber(progress?.kg_medidos_efectivos) === null
      && (coverageState(progress) === 'COMPLETA' || Number(progress?.mangas?.total || 0) === 0)
    ));
    return {
      state: 'incomplete',
      label: loading ? 'Consultando avance' : (noWeighingEvidence ? 'Sin pesajes' : 'Avance parcial'),
      kgFinalizados: knownFinalized,
      kgAbiertas: openKg,
      rows,
    };
  }
  const kgFinalizados = rows.reduce((sum, { progress }) => {
    const value = toFiniteNumber(progress?.kg_finalizados_efectivos);
    return value === null || value < 0 ? sum : sum + value;
  }, 0);
  const metaTotal = metas.reduce((sum, value) => sum + value, 0);
  const percentage = metaTotal > 0 ? (kgFinalizados / metaTotal) * 100 : null;
  if (!Number.isFinite(percentage)) {
    return { state: 'incomplete', label: 'No calculable · meta incompleta', kgFinalizados, kgAbiertas: openKg, rows };
  }
  return {
    state: 'ready',
    label: 'Avance disponible',
    kgFinalizados,
    kgAbiertas: openKg,
    metaTotal,
    percentage,
    rows,
  };
};

export const statusLabel = (status) => ({
  BORRADOR: 'Borrador',
  LIBERADA: 'Liberada',
  PROGRAMADA: 'Programada',
  EN_EJECUCION: 'En ejecución',
  CERRADA: 'Cerrada',
  ANULADA: 'Anulada',
}[status] || status || 'Sin estado');

export { toFiniteNumber };
