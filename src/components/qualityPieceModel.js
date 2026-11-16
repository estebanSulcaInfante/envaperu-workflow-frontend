/**
 * Pure model for the in-process quality station.
 *
 * `localState.pieceQuality` is intentionally a projection of observations, not
 * a replacement for the OT, mould master, inventory or the weighing station.
 * A record is keyed by OT + colour work + piece output so similarly named
 * pieces from different works cannot be merged accidentally.
 */

export const PIECE_QUALITY_VERSION = 1;
export const WORK_QUALITY_VERSION = 1;

export const CHECK_IDS = ['peso', 'ciclo', 'color', 'inyeccion', 'funcional'];

export const CHECK_LABELS = {
  peso: 'Peso',
  ciclo: 'Ciclo',
  color: 'Color',
  inyeccion: 'Inyección',
  funcional: 'Funcional',
};

export const WORK_CHECK_IDS = ['ciclo', 'color', 'inyeccion', 'funcional'];

const outputRows = (work) => work?.articulos_salida || work?.salidas || work?.salidas_produccion
  || work?.salidas_color || work?.salidas_pieza || [];

const workIdentifiers = (work) => [work?.public_id, work?.id, work?.codigo, work?.trabajo_color_id, work?.trabajo_id]
  .filter((id) => id != null && id !== '').map(String);

const workRows = (ot) => {
  const listed = Array.isArray(ot?.trabajos_color) ? ot.trabajos_color
    : Array.isArray(ot?.trabajos_color_resumen) ? ot.trabajos_color_resumen : [];
  const context = ot?.trabajo_color_contexto;
  if (!context) return listed;
  const ids = new Set(workIdentifiers(context));
  const match = listed.findIndex((work) => workIdentifiers(work).some((id) => ids.has(id)));
  if (match < 0) return [...listed, context];
  return listed.map((work, index) => index !== match ? work : {
    ...context, ...work, articulos_salida: outputRows(work).length ? outputRows(work) : outputRows(context),
  });
};

export const identityOf = (item) => item?.public_id || item?.id || item?.codigo || '';

export const outputIdentity = (output, index = 0) => identityOf(output) || output?.pieza_id
  || output?.articulo_id || `salida-${index + 1}`;

export const workIdentity = (work, index = 0) => identityOf(work) || work?.trabajo_color_id
  || work?.trabajo_id || `trabajo-${index + 1}`;

export const otIdentity = (ot) => identityOf(ot) || ot?.codigo_ot || '';

export const pieceIdentity = (otId, workId, outputId) => [otId, workId, outputId]
  .map((part) => encodeURIComponent(String(part || 'sin-identidad'))).join(':');

export const displayOutputName = (output, index = 0) => output?.pieza?.nombre || output?.articulo?.nombre
  || output?.nombre || output?.pieza?.codigo || output?.articulo?.codigo || `Salida ${index + 1}`;

export const displayWorkName = (work) => work?.color?.nombre || work?.color || work?.nombre || 'Trabajo sin color';

export const mouldIdentity = (work, output, moldCatalog = []) => {
  const raw = work?.molde || work?.molde_codigo || work?.molde_id || output?.molde || output?.molde_codigo;
  if (raw && typeof raw === 'object') return identityOf(raw) || raw.codigo || raw.nombre || '';
  const catalogMatch = moldCatalog.find((mould) => String(identityOf(mould)) === String(raw)
    || String(mould.codigo || '') === String(raw));
  return identityOf(catalogMatch) || catalogMatch?.codigo || String(raw || '');
};

const explicitBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === 0) return Boolean(value);
  if (typeof value === 'string') {
    if (['true', '1', 'si', 'sí', 'aplica', 'aplicable'].includes(value.trim().toLowerCase())) return true;
    if (['false', '0', 'no', 'no aplica', 'no_aplica', 'inaplicable'].includes(value.trim().toLowerCase())) return false;
  }
  return null;
};

/**
 * Functional applicability comes only from an explicit source field. Null is
 * shown as “definir” in the UI; it is never guessed from the piece name.
 */
export const functionalApplicability = (piece, work) => {
  const candidates = [
    piece?.funcional_aplica,
    piece?.functional_applicable,
    piece?.aplica_funcional,
    piece?.funcional?.aplica,
    work?.funcional_aplica,
    work?.functional_applicable,
    work?.aplica_funcional,
  ];
  return candidates.map(explicitBoolean).find((value) => value !== null) ?? null;
};

export const normalizePieceRows = (ot, moldCatalog = []) => {
  const otId = otIdentity(ot);
  return workRows(ot).flatMap((work, workIndex) => {
    const workId = workIdentity(work, workIndex);
    return outputRows(work).map((output, outputIndex) => ({
      key: pieceIdentity(otId, workId, outputIdentity(output, outputIndex)),
      otId,
      workId,
      outputId: outputIdentity(output, outputIndex),
      workIndex,
      outputIndex,
      work,
      output,
      workLabel: displayWorkName(work),
      outputLabel: displayOutputName(output, outputIndex),
      mouldId: mouldIdentity(work, output, moldCatalog),
      functionalApplicable: functionalApplicability(output, work),
      status: work?.estado || 'NO_INFORMADO',
    }));
  });
};

/**
 * Work-first projection used by the OT station. A work is the unit selected
 * before any output is inspected; output rows are deliberately kept attached
 * to that work so two equal piece names from different colour works cannot be
 * merged.
 */
export const normalizeWorkRows = (ot, moldCatalog = []) => workRows(ot).map((work, index) => {
  const workId = workIdentity(work, index);
  const outputs = outputRows(work).map((output, outputIndex) => ({
    id: outputIdentity(output, outputIndex),
    label: displayOutputName(output, outputIndex),
    output,
    index: outputIndex,
    functionalApplicable: functionalApplicability(output, work),
  }));
  return {
    key: `${otIdentity(ot)}:${workId}`,
    otId: otIdentity(ot),
    workId,
    work,
    label: displayWorkName(work),
    ofLabel: work?.orden_fabricacion_codigo || work?.of_codigo || work?.orden_fabricacion?.codigo || '',
    mouldId: mouldIdentity(work, outputs[0]?.output, moldCatalog),
    mouldLabel: work?.molde_nombre || work?.molde?.nombre || (() => {
      const identity = mouldIdentity(work, outputs[0]?.output, moldCatalog);
      const catalogMould = moldCatalog.find((mould) => [mould?.public_id, mould?.id, mould?.codigo, mould?.code].filter(Boolean).map(String).includes(String(identity)));
      return catalogMould?.nombre || catalogMould?.name || catalogMould?.descripcion || identity;
    })(),
    cycleReferenceSeconds: work?.snapshot_tiempo_ciclo_seg || work?.tiempo_ciclo_seg || work?.snapshot?.tiempo_ciclo_seg || work?.molde?.tiempo_ciclo_seg || '',
    status: work?.estado || 'NO_INFORMADO',
    outputs,
  };
});

export const workIsActive = (work) => ['EN_EJECUCION', 'EN_PRODUCCION', 'ACTIVO', 'INICIADO'].includes(
  String(work?.status || work?.estado || work?.work?.estado || '').toUpperCase(),
);

// A queued work is a planned row, not an observation target. Paused and
// completed rows may still have historical quality visits, while a missing
// status remains conservative and cannot open a new visit from normal entry.
export const workHasStarted = (work) => {
  const source = work?.work || work || {};
  const status = String(work?.status || source?.estado || '').toUpperCase();
  if (workIsActive(work) || ['PAUSADO', 'COMPLETADO', 'CERRADO'].includes(status)) return true;
  return [source?.inicio_at, source?.iniciada_at, source?.iniciado_at, source?.fecha_inicio, source?.startedAt,
    source?.started_at, source?.hora_inicio].some(value => value != null && String(value).trim() !== '');
};

export const workIsQueued = (work) => !workHasStarted(work);

/**
 * Initial/arranque is an OT-level control. Legacy rows remain in history, but
 * a new confirmation must never create a second initial after changing work.
 * Drafts are included so an open capture can be resumed after a cutoff.
 */
export const inferVisitWorkId = (visit, pieces = []) => {
  const explicit = visit?.workId || visit?.work_id;
  if (explicit != null && String(explicit) !== '') return String(explicit);
  const keys = [
    ...(Array.isArray(visit?.pieceKeys) ? visit.pieceKeys : []),
    ...Object.keys(visit?.checksByPiece || {}),
    ...Object.keys(visit?.checks || {}),
  ];
  if (!keys.length) return '';
  const owners = keys.map(key => pieces.find(piece => piece.key === key)?.workId);
  if (owners.some(owner => !owner)) return '';
  const workIds = new Set(owners.map(String));
  return workIds.size === 1 ? [...workIds][0] : '';
};

export const otInitialVisits = (pieceQuality, otId, pieces = []) => {
  const quality = ensureWorkQuality(pieceQuality);
  const visits = [...quality.workVisits, ...quality.visits];
  const seen = new Set();
  return visits.filter((visit) => {
    if (visit?.kind !== 'INICIAL' || String(visit.otId) !== String(otId) || !visit.id || seen.has(visit.id)) return false;
    seen.add(visit.id);
    return true;
  }).map((visit) => ({ ...visit, workId: inferVisitWorkId(visit, pieces) || visit.workId || visit.work_id || '' }));
};

export const otInitialVisit = (pieceQuality, otId, pieces = []) => {
  const visits = otInitialVisits(pieceQuality, otId, pieces);
  return visits.find((visit) => visit.status === 'CONFIRMED') || visits.find((visit) => visit.status === 'DRAFT') || null;
};

export const workObservationKey = (otId, workId) => [otId, workId]
  .map((part) => encodeURIComponent(String(part || 'sin-identidad'))).join(':');

export const emptyWorkQualityState = () => ({
  version: PIECE_QUALITY_VERSION,
  records: {},
  visits: [],
  incidents: [],
  workRecords: {},
  workVisits: [],
});

export const ensureWorkQuality = (pieceQuality) => ({
  ...emptyWorkQualityState(),
  ...(pieceQuality || {}),
  version: PIECE_QUALITY_VERSION,
  records: pieceQuality?.records || {},
  visits: Array.isArray(pieceQuality?.visits) ? pieceQuality.visits : [],
  incidents: Array.isArray(pieceQuality?.incidents) ? pieceQuality.incidents : [],
  periodicQuotaByOt: pieceQuality?.periodicQuotaByOt || {},
  workRecords: pieceQuality?.workRecords || {},
  workVisits: Array.isArray(pieceQuality?.workVisits) ? pieceQuality.workVisits : [],
});

export const ensureWorkRecord = (pieceQuality, work) => {
  const current = ensureWorkQuality(pieceQuality).workRecords?.[work.key];
  if (current) return {
    ...current,
    outputChecks: current.outputChecks || {},
    commonChecks: current.commonChecks || {},
  };
  return {
    key: work.key,
    otId: work.otId,
    workId: work.workId,
    mouldId: work.mouldId,
    outputChecks: {},
    commonChecks: {},
  };
};

export const outputCheckScope = (outputIds = []) => [...new Set(outputIds.filter(Boolean))];

export const workVisitConfirmedCount = (pieceQuality, otId) => {
  const quality = ensureWorkQuality(pieceQuality);
  const periodic = [...quality.visits, ...quality.workVisits].filter(visit =>
    visit.status === 'CONFIRMED' && visit.kind === 'PERIODICA' && String(visit.otId) === String(otId));
  return new Set(periodic.map(visit => visit.id)).size;
};

const emptyChecks = () => Object.fromEntries(CHECK_IDS.map((id) => [id, {
  status: 'PENDIENTE',
  applicable: id === 'funcional' ? null : true,
}]));

export const emptyPieceQualityState = () => ({
  version: PIECE_QUALITY_VERSION,
  records: {},
  visits: [],
  incidents: [],
  periodicQuotaByOt: {},
});

export const ensurePieceQuality = (localState) => {
  const pieceQuality = localState?.pieceQuality?.version === PIECE_QUALITY_VERSION
    ? localState.pieceQuality : emptyPieceQualityState();
  const legacyQuotas = Object.fromEntries(Object.entries(localState?.periodic || {})
    .filter(([, entry]) => entry?.quota != null)
    .map(([otId, entry]) => [otId, entry.quota]));
  const visits = Array.isArray(pieceQuality.visits) ? pieceQuality.visits : [];
  const currentIds = new Set(visits.map(visit => visit.id));
  const confirmedLegacy = (localState?.visits || [])
    .filter(visit => visit.status === 'CONFIRMED' && visit.kind === 'PERIODICA' && visit.id && !currentIds.has(visit.id));
  return {
    ...emptyPieceQualityState(),
    ...pieceQuality,
    records: pieceQuality.records || {},
    visits: confirmedLegacy.length ? [...confirmedLegacy, ...visits] : visits,
    incidents: Array.isArray(pieceQuality.incidents) ? pieceQuality.incidents : [],
    periodicQuotaByOt: { ...legacyQuotas, ...pieceQuality.periodicQuotaByOt },
  };
};

export const ensurePieceRecord = (pieceQuality, piece) => {
  const current = pieceQuality?.records?.[piece.key];
  if (current) {
    const initialChecks = current.initialChecks || current.checks || emptyChecks();
    return {
      ...current,
      initialChecks: { ...Object.fromEntries(CHECK_IDS.map((id) => [id, {}])), ...initialChecks },
      checks: { ...Object.fromEntries(CHECK_IDS.map((id) => [id, {}])), ...initialChecks },
      periodic: Array.isArray(current.periodic) ? current.periodic : [],
    };
  }
  const checks = emptyChecks();
  checks.funcional.applicable = piece.functionalApplicable;
  return { key: piece.key, otId: piece.otId, workId: piece.workId, outputId: piece.outputId, mouldId: piece.mouldId, checks, initialChecks: checks, periodic: [] };
};

export const normalizeNumber = (value) => {
  const number = Number(String(value ?? '').trim().replace(',', '.'));
  return Number.isFinite(number) ? number : null;
};

export const weightResult = (netGrams, quantity) => {
  const grams = normalizeNumber(netGrams);
  const count = normalizeNumber(quantity);
  if (!(grams > 0) || !(count > 0) || !Number.isSafeInteger(count)) return null;
  return grams / count;
};

const limaParts = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const read = (type) => parts.find((part) => part.type === type)?.value || '';
  return { date: `${read('year')}-${read('month')}-${read('day')}`, minutes: Number(read('hour')) * 60 + Number(read('minute')) };
};

/**
 * An initial is available only before the cutoff of its own operational date.
 * The comparison is deliberately based on Lima wall-clock time, so a night
 * OT never inherits the state of the previous shift or of the browser date.
 * EXTRA has no cutoff here and keeps its existing behavior.
 */
export const isInitialClosed = ({ fechaOperativa, turno, now = new Date() } = {}) => {
  const normalizedShift = String(turno || '').toUpperCase();
  if (!['DIA', 'NOCHE'].includes(normalizedShift) || !fechaOperativa) return false;
  const current = limaParts(now);
  const operationalDate = String(fechaOperativa).slice(0, 10);
  const cutoffMinutes = normalizedShift === 'NOCHE' ? 20 * 60 : 8 * 60;
  return Boolean(current && operationalDate <= current.date
    && (operationalDate < current.date || current.minutes >= cutoffMinutes));
};

// Kept as a compatibility helper for callers that only model the day shift.
export const isDayInitialClosed = ({ fechaOperativa, turno, now = new Date() } = {}) => (
  String(turno || '').toUpperCase() === 'DIA'
    && isInitialClosed({ fechaOperativa, turno, now })
);

const isConfirmed = (visit) => visit?.status === 'CONFIRMED';

/**
 * Returns the last cycle confirmed in a visit that has the same mould. The
 * visit-level cycle is deliberately shared by selected pieces in that visit;
 * it is not copied from another mould or silently made up from a reference.
 */
export const latestCycleSuggestion = (piece, visits = [], pieces = []) => {
  // A blank mould is not an identity. Never suggest across an unknown mould.
  if (!piece?.mouldId) return null;
  const candidates = [...visits].reverse().flatMap((visit) => {
    if (!isConfirmed(visit) || String(visit.mouldId || '') !== String(piece.mouldId || '')) return [];
    // Prefer the per-piece observation. The fallback supports legacy visit
    // rows, but only when this visit explicitly contains the piece identity.
    const sameMouldKeys = (visit.pieceKeys || []).filter((key) => {
      const candidate = pieces.find((item) => item.key === key);
      return candidate ? String(candidate.mouldId || '') === String(piece.mouldId) : key === piece.key;
    });
    const sourceKey = sameMouldKeys.find((key) => normalizeNumber(visit?.checks?.[key]?.ciclo?.seconds) > 0);
    const pieceCycle = sourceKey ? visit?.checks?.[sourceKey]?.ciclo?.seconds : null;
    const fallbackCycle = sourceKey === piece.key ? (visit.cycleSeconds ?? visit.ciclo?.seconds) : null;
    const seconds = normalizeNumber(pieceCycle ?? fallbackCycle);
    return seconds > 0 ? [{ seconds, visitId: visit.id, observedAt: visit.observedAt, mouldId: visit.mouldId, pieceKey: sourceKey }] : [];
  });
  return candidates[0] || null;
};

const checkComplete = (check) => check?.applicable === false || check?.status === 'OK' || check?.status === 'INCIDENCIA' || check?.status === 'NA' || check?.status === 'MEDIDO';

export const hasInitialObservation = (record) => Object.values(record?.initialChecks || {}).some((check) => check && (
  (check.status && check.status !== 'PENDIENTE')
  || Object.entries(check).some(([field, value]) => !['status', 'applicable'].includes(field) && value !== '' && value != null)
));

export const pieceCompletion = (record) => {
  const checks = record?.initialStatus === 'DRAFT'
    ? (record?.initialConfirmedChecks || {})
    : (record?.initialConfirmedChecks || record?.initialChecks || record?.checks || {});
  const applicable = CHECK_IDS.filter((id) => checks[id]?.applicable !== false);
  const defined = applicable.filter((id) => checks[id]?.applicable !== null);
  const complete = Object.keys(checks).length > 0 && defined.length === applicable.length && applicable.every((id) => checkComplete(checks[id]));
  const completed = applicable.filter((id) => checkComplete(checks[id])).length;
  return { complete, completed, total: applicable.length, hasUndefinedApplicability: defined.length !== applicable.length };
};

export const visitPieceKeys = (visit) => Array.isArray(visit?.pieceKeys) ? visit.pieceKeys : [];

export const incidentIdentity = ({ otId, workId, outputId, checkId = '' }) => [otId, workId, outputId, checkId]
  .map((part) => encodeURIComponent(String(part || ''))).join(':');

export const checksForReport = (pieceQuality, pieces = []) => pieces.map((piece) => {
  const record = ensurePieceRecord(pieceQuality, piece);
  return {
    pieceKey: piece.key,
    otId: piece.otId,
    workId: piece.workId,
    outputId: piece.outputId,
    mouldId: piece.mouldId,
    checks: record.checks,
    completion: pieceCompletion(record),
  };
});

export { outputRows, workRows };
