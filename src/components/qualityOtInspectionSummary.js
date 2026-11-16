import { inferVisitWorkId, isInitialClosed, normalizePieceRows, normalizeWorkRows, workHasStarted } from './qualityPieceModel';

const ACTIVE_STATES = new Set(['EN_EJECUCION', 'EN_PRODUCCION', 'ACTIVO', 'INICIADO']);
const QUEUED_STATES = new Set(['EN_COLA', 'COLA', 'PLANIFICADA', 'PLANIFICADO', 'PENDIENTE', 'PROGRAMADA']);

const text = (value) => value == null ? '' : String(value).trim();
const first = (...values) => values.find((value) => text(value) !== '');
const identity = (item) => item?.public_id || item?.id || item?.codigo || '';

const humanState = (state) => ({
  EN_EJECUCION: 'En ejecución',
  EN_PRODUCCION: 'En producción',
  ACTIVO: 'Activo',
  INICIADO: 'Iniciado',
  EN_COLA: 'En cola',
  COLA: 'En cola',
  PLANIFICADA: 'En cola',
  PLANIFICADO: 'En cola',
  PENDIENTE: 'Pendiente',
  PROGRAMADA: 'Programada',
  PAUSADO: 'Pausado',
  PAUSADA: 'Pausada',
  TERMINADO: 'Terminado',
  TERMINADA: 'Terminada',
  COMPLETADO: 'Completado',
  COMPLETADA: 'Completada',
  CERRADO: 'Cerrado',
  CERRADA: 'Cerrada',
  ANULADO: 'Anulado',
  ANULADA: 'Anulada',
  NO_INFORMADO: 'Estado no informado',
}[String(state || 'NO_INFORMADO').toUpperCase()] || text(state).replaceAll('_', ' ') || 'Estado no informado');

const catalogMatch = (raw, moldCatalog) => {
  const rawId = typeof raw === 'object' ? identity(raw) : raw;
  return moldCatalog.find((mold) => [mold?.public_id, mold?.id, mold?.codigo, mold?.code]
    .filter(Boolean).map(String).includes(String(rawId || '')));
};

const moldDetails = (work, moldCatalog = []) => {
  const source = first(work?.molde, work?.molde_nombre, work?.molde_codigo, work?.molde_id,
    work?.molde?.public_id, work?.molde?.id, work?.molde?.codigo);
  const catalog = catalogMatch(source, moldCatalog)
    || catalogMatch(work?.molde_id, moldCatalog)
    || catalogMatch(work?.molde_codigo, moldCatalog);
  const sourceObject = source && typeof source === 'object' ? source : null;
  const name = work?.moldLoadFailed ? 'Molde sin cargar' : first(
    work?.molde_nombre,
    sourceObject?.nombre,
    sourceObject?.name,
    sourceObject?.descripcion,
    catalog?.nombre,
    catalog?.name,
    catalog?.descripcion,
  );
  const code = first(
    work?.molde_codigo,
    sourceObject?.codigo,
    sourceObject?.code,
    catalog?.codigo,
    catalog?.code,
    typeof source === 'string' ? source : '',
  );
  return { name: name || 'Molde no informado', code: code || '' };
};

const colorDetails = (work) => {
  const source = work?.color;
  const object = source && typeof source === 'object' ? source : null;
  return {
    name: first(work?.color_nombre, work?.color_label, object?.nombre, object?.name,
      typeof source === 'string' ? source : '', work?.color_codigo) || 'Color no informado',
    hex: first(work?.color_hex, object?.hex, object?.color_hex, work?.color?.hex,
      work?.color_produccion?.hex_referencia, work?.color_referencia_hex) || '',
  };
};

const workCode = (work) => first(work?.codigo_trabajo, work?.trabajo_codigo,
  work?.codigo_color, work?.codigo, work?.trabajo_color_codigo, work?.public_id, work?.id) || '';

const ofCode = (work) => first(work?.orden_fabricacion_codigo, work?.of_codigo,
  work?.orden_fabricacion?.codigo, work?.orden_fabricacion_id) || '';

const visitKey = (visit, index) => first(visit?.id,
  `${visit?.kind || 'VISITA'}:${visit?.otId || visit?.ot_id || ''}:${visit?.workId || visit?.work_id || ''}:${visit?.number || ''}:${visit?.observedAt || visit?.recordedAt || index}`);

const stateInput = (quality, localState) => {
  if (quality?.pieceQuality) return quality;
  if (quality?.localState) return quality.localState;
  return quality || localState || {};
};

export const periodicTarget = (ot, state, otId) => {
  const value = first(
    state?.pieceQuality?.periodicQuotaByOt?.[otId],
    state?.periodicQuotaByOt?.[otId],
    state?.periodic?.[otId]?.quota,
    ot?.periodic_quota,
    ot?.periodicQuota,
    ot?.meta_periodicas,
    ot?.meta_visitas_periodicas,
    ot?.calidad?.meta_periodicas,
  );
  return value === '' || value == null ? null : value;
};

const startEvidence = (ot, works = []) => {
  const sources = [ot, ...works];
  for (const source of sources) {
    const direct = first(
      source?.iniciada_at,
      source?.inicio_real,
      source?.inicio_real_at,
      source?.inicio_produccion,
      source?.inicio_produccion_at,
      source?.iniciado_en,
      source?.iniciado_at,
      source?.started_at,
      source?.startedAt,
      source?.fecha_hora_inicio_real,
      source?.fecha_hora_inicio,
      source?.start_time,
    );
    if (direct && /\d{1,2}:\d{2}/.test(String(direct))) return direct;
    const date = first(source?.fecha_inicio, source?.fechaInicio, source?.fecha_operativa_inicio);
    const time = first(source?.hora_inicio, source?.horaInicio, source?.hora_inicio_real);
    if (date && time) return `${date}T${time}-05:00`;
  }
  return '';
};

const limaParts = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  const dateLabel = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
  return Number.isFinite(hour) && Number.isFinite(minute) ? { date: dateLabel, minutes: hour * 60 + minute } : null;
};

const initialWindowStatus = (ot, initialConfirmed, works = []) => {
  if (initialConfirmed) return 'CONFIRMADO';
  const evidence = startEvidence(ot, works);
  if (!evidence) return 'SIN_EVIDENCIA';
  const parts = limaParts(evidence);
  if (parts == null) return 'SIN_EVIDENCIA';
  const shift = String(ot?.turno || '').toUpperCase();
  const cutoff = shift === 'NOCHE' ? 20 * 60 : shift === 'DIA' ? 8 * 60 : null;
  if (cutoff == null) return 'SIN_EVIDENCIA';
  const operationalDate = text(ot?.fecha_operativa || ot?.fecha || '').slice(0, 10);
  if (operationalDate && parts.date > operationalDate) return 'FUERA_VENTANA';
  if (parts.minutes >= cutoff) return 'FUERA_VENTANA';
  return operationalDate && isInitialClosed({ fechaOperativa: operationalDate, turno: shift }) ? 'SIN_REGISTRAR' : 'PENDIENTE';
};

const initialStatusLabel = (status) => ({
  CONFIRMADO: 'Arranque confirmado',
  FUERA_VENTANA: 'Arranque fuera de ventana',
  SIN_REGISTRAR: 'Arranque sin registrar',
  PENDIENTE: 'Arranque pendiente',
  REVISAR_HISTORIAL: 'Revisar historial',
}[status] || '');

const legacyInitialForWork = (row, state) => {
  const record = state?.pieceQuality?.workRecords?.[row.key]
    || state?.pieceQuality?.workRecords?.[row.workId]
    || state?.workRecords?.[row.key]
    || state?.workRecords?.[row.workId];
  return record?.initialStatus === 'CONFIRMED';
};

const visitWorkIds = (visit, rows, pieces, otId) => {
  const explicit = first(visit?.workId, visit?.work_id);
  if (explicit) return [String(explicit)];
  const inferred = inferVisitWorkId(visit, pieces);
  if (inferred) return [String(inferred)];
  const pieceKeys = Array.isArray(visit?.pieceKeys) ? visit.pieceKeys : [];
  const owners = pieceKeys.map(key => rows.find(row =>
    String(key) === String(row.key) ||
    String(key).startsWith(`${encodeURIComponent(String(otId))}:${encodeURIComponent(String(row.workId))}:`)
  )?.workId);
  if (!owners.length || owners.some(owner => !owner)) return [];
  const distinct = [...new Set(owners.map(String))];
  return distinct.length === 1 ? distinct : [];
};

// Older visits may predate the stored control number. Fill only their gaps,
// reserving the numbers that inspectors already saw on recorded visits.
const numberedPeriodics = (visits) => {
  const periodic = visits.filter(visit => String(visit.kind || '').toUpperCase() === 'PERIODICA');
  const hasNumber = visit => Number.isSafeInteger(Number(visit.number)) && Number(visit.number) >= 2;
  const occupied = new Set(periodic.filter(hasNumber).map(visit => Number(visit.number)));
  let available = 2;
  return periodic.slice().sort((a, b) => text(a.recordedAt).localeCompare(text(b.recordedAt)))
    .map((visit, index) => {
      let number = Number(visit.number);
      if (!hasNumber(visit)) {
        while (occupied.has(available)) available++;
        number = available++;
      }
      return { ...visit, number, key: visitKey(visit, index) };
    })
    .sort((a, b) => a.number - b.number);
};

export const buildQualityOtInspectionSummary = ({ ot, quality, localState, moldCatalog = [] } = {}) => {
  const state = stateInput(quality, localState);
  const pieceQuality = state?.pieceQuality || state || {};
  const otId = identity(ot) || ot?.codigo_ot || '';
  const workRows = normalizeWorkRows(ot, moldCatalog);
  const pieces = normalizePieceRows(ot, moldCatalog);
  const localVisits = [...(Array.isArray(state?.visits) ? state.visits : []),
    ...(Array.isArray(pieceQuality?.visits) ? pieceQuality.visits : []),
    ...(Array.isArray(pieceQuality?.workVisits) ? pieceQuality.workVisits : [])]
    .filter((visit) => visit?.status === 'CONFIRMED' && String(visit?.otId || visit?.ot_id || '') === String(otId));
  const sharedVisits = (ot?.visitas_calidad_confirmadas ?? ot?.visitas_calidad?.filter(v => v.estado === 'CONFIRMED') ?? [])
    .map(v => ({
      id: v.visita_id ?? v.id, workId: v.trabajo_id, otId, kind: v.tipo, number: v.numero,
      status: 'CONFIRMED', recordedAt: v.confirmado_at ?? v.confirmed_at ?? v.recorded_at,
    }));
  const rawVisits = [...sharedVisits, ...localVisits];
  const uniqueVisits = [...new Map(rawVisits.map((visit, index) => [visitKey(visit, index), visit])).values()];
  const attributedVisits = uniqueVisits.map((visit) => ({ ...visit, workIds: visitWorkIds(visit, workRows, pieces, otId) }));
  const rowModels = workRows.map((row) => {
    const work = row.work || {};
    const stateValue = String(row.status || work.estado || 'NO_INFORMADO').toUpperCase();
    const visits = attributedVisits.filter((visit) => visit.workIds.includes(String(row.workId)));
    const initialConfirmed = visits.some((visit) => String(visit.kind || '').toUpperCase() === 'INICIAL')
      || legacyInitialForWork(row, state);
    const periodicConfirmed = new Set(visits
      .filter((visit) => String(visit.kind || '').toUpperCase() === 'PERIODICA')
      .map((visit, index) => visitKey(visit, index))).size;
    const mold = moldDetails(work, moldCatalog);
    const color = colorDetails(work);
    return {
      key: row.key,
      workId: row.workId,
      mouldName: mold.name,
      mouldCode: mold.code,
      colorName: color.name,
      colorHex: color.hex,
      ofLabel: ofCode(work),
      workCode: workCode(work),
      state: stateValue,
      stateLabel: humanState(stateValue),
      initialConfirmed: initialConfirmed ? 1 : 0,
      periodicConfirmed,
      inspectionCount: (initialConfirmed ? 1 : 0) + periodicConfirmed,
      queued: !initialConfirmed && periodicConfirmed === 0 && (QUEUED_STATES.has(stateValue) || !workHasStarted(row)),
      active: ACTIVE_STATES.has(stateValue),
      paused: stateValue === 'PAUSADO' || stateValue === 'PAUSADA',
      needsInspection: ACTIVE_STATES.has(stateValue) && !initialConfirmed && periodicConfirmed === 0,
      pausedNeedsInspection: (stateValue === 'PAUSADO' || stateValue === 'PAUSADA')
        && workHasStarted(row) && !initialConfirmed && periodicConfirmed === 0,
      outputs: row.outputs,
    };
  });
  const initialVisits = attributedVisits.filter((visit) => String(visit.kind || '').toUpperCase() === 'INICIAL');
  const initialWorkIds = new Set(initialVisits.flatMap((visit) => visit.workIds.length ? visit.workIds : ['__UNATTRIBUTED__']));
  const hasUnattributedInitialVisit = initialVisits.some((visit) => !visit.workIds.length);
  const initialHistoryReview = initialWorkIds.size > 1 || hasUnattributedInitialVisit;
  const initialConfirmed = rowModels.some((row) => row.initialConfirmed > 0);
  const periodicVisits = numberedPeriodics(attributedVisits);
  const hasUnattributedVisit = attributedVisits.some((visit) => !visit.workIds.length);
  const status = initialHistoryReview || hasUnattributedVisit ? 'REVISAR_HISTORIAL' : initialWindowStatus(ot, initialConfirmed, workRows.map((row) => row.work));
  const duplicateLabels = new Map();
  rowModels.forEach((row) => {
    const key = `${row.mouldName.toLowerCase()}|${row.colorName.toLowerCase()}`;
    duplicateLabels.set(key, (duplicateLabels.get(key) || 0) + 1);
  });
  rowModels.forEach((row) => {
    const key = `${row.mouldName.toLowerCase()}|${row.colorName.toLowerCase()}`;
    row.disambiguation = duplicateLabels.get(key) > 1
      ? [row.ofLabel, row.workCode && row.workCode !== row.ofLabel ? row.workCode : ''].filter(Boolean).join(' · ')
      : '';
  });
  const pendingWorks = rowModels
    .filter((row) => row.needsInspection || row.pausedNeedsInspection)
    .sort((a, b) => Number(b.needsInspection) - Number(a.needsInspection));
  return {
    otId,
    header: {
      initialConfirmed: initialHistoryReview ? 0 : (initialConfirmed ? 1 : 0),
      initialTarget: 1,
      periodicConfirmed: periodicVisits.length,
      periodicTarget: periodicTarget(ot, state, otId),
      initialStatus: status,
      initialStatusLabel: initialStatusLabel(status),
      unattributedConfirmedVisits: attributedVisits.filter((visit) => !visit.workIds.length).length,
    },
    periodicVisits,
    works: rowModels,
    pendingWorks,
    hasQueuedWork: rowModels.some((row) => row.queued),
    hasPausedWork: rowModels.some((row) => row.paused),
    hasActiveWork: rowModels.some((row) => row.active),
  };
};

export const getQualityOtInspectionSummary = buildQualityOtInspectionSummary;
export { humanState, initialWindowStatus };

