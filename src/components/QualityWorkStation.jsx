import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ProductionColorLabel from './ui/ProductionColorLabel';
import { VisitHeader } from './QualityWorkContext';
import { buildQualityOtInspectionSummary } from './qualityOtInspectionSummary.js';
import { ControlRow } from './QualityPieceNavigation';
import QualityAffectedMangas from './QualityAffectedMangas';
import QualityReportAction from './QualityReportAction';
import QualityOtInspectionSummary from './QualityOtInspectionSummary.jsx';
import {
  CHECK_LABELS,
  ensureWorkQuality,
  ensureWorkRecord,
  normalizeNumber,
  normalizeWorkRows,
  normalizePieceRows,
  outputCheckScope,
  pieceIdentity,
  workIsActive,
  workHasStarted,
  otInitialVisit,
  weightResult,
  isInitialClosed,
} from './qualityPieceModel';
import { useInitialClosed } from './qualityInitialCutoff';
import { createUuid } from '../services/scmProductOnboardingApi';

const FAMILY_IDS = ['color', 'inyeccion', 'funcional'];
const nowIso = () => new Date().toISOString();
const uniqueId = (prefix) => `${prefix}-${createUuid()}`;
const localDateTime = (value) => {
  const date = value ? new Date(value) : new Date();
  if (value && !/[zZ]|[+-]\d\d:\d\d$/.test(String(value))) return String(value).slice(0, 16);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, hourCycle: 'h23' }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
};
const outputLabel = (work, id) => work.outputs.find((output) => output.id === id)?.label || id;

const blankChecks = (work) => ({
  outputChecks: Object.fromEntries(work.outputs.map((output) => [output.id, {}])),
  commonChecks: {
    ciclo: { seconds: '', classification: '', suggestedSeconds: '', source: 'OBSERVADO' },
    color: { status: '', scopeOutputIds: work.outputs.map(output => output.id), description: '' },
    inyeccion: { status: '', scopeOutputIds: work.outputs.map(output => output.id), description: '' },
    funcional: { status: '', scopeOutputIds: work.outputs.map(output => output.id), description: '' },
  },
});

const draftFromVisit = (work, visit) => {
  const base = blankChecks(work);
  const source = visit?.checks || {};
  return {
    ...(visitAffectedMangas(visit).length ? { legacyVisitMangas: visitAffectedMangas(visit) } : {}),
    outputChecks: { ...base.outputChecks, ...(source.outputChecks || {}) },
    commonChecks: {
      ...base.commonChecks,
      ...(source.commonChecks || {}),
      ciclo: { ...base.commonChecks.ciclo, ...(source.commonChecks?.ciclo || {}) },
      color: { ...base.commonChecks.color, ...(source.commonChecks?.color || {}) },
      inyeccion: { ...base.commonChecks.inyeccion, ...(source.commonChecks?.inyeccion || {}) },
      funcional: { ...base.commonChecks.funcional, ...(source.commonChecks?.funcional || {}) },
    },
  };
};

const scopeText = (work, ids) => {
  const labels = outputCheckScope(ids).map((id) => outputLabel(work, id));
  return labels.length ? labels.join(', ') : 'Sin salidas seleccionadas';
};
// Preserve previous pilot records for reading only; never infer an incident for these bags.
const visitAffectedMangas = (visit) => [visit?.checks?.legacyVisitMangas, visit?.affectedMangas, visit?.checks?.affectedMangas].find(list => Array.isArray(list) && list.length) || [];

// The central quality API deliberately speaks the same nested form shape that
// the worker edits.  Keep this adapter here so local drafts and the central
// copy can be merged without reviving the former pieceKeys/checks projection.
const centralVisit = (item, fallbackOtId = '') => {
  if (!item) return null;
  const payload = item.payload || {};
  return {
    id: item.id,
    otId: item.ot_id || item.otId || fallbackOtId,
    workId: item.trabajo_id || item.workId,
    kind: item.tipo || item.kind,
    number: item.numero ?? item.number ?? '',
    status: item.estado || item.status || 'DRAFT',
    version: item.version,
    observedAt: item.observed_at || item.observedAt || '',
    recordedAt: item.recorded_at || item.recordedAt || '',
    confirmedAt: item.confirmed_at || item.confirmedAt || '',
    outputIds: payload.outputIds || payload.output_ids || item.outputIds || [],
    checks: payload.checks || item.checks || {},
    syncStatus: 'synced',
  };
};

const limaObservedAt = (value) => {
  if (!value) return null;
  const text = String(value);
  if (text.endsWith('Z') || /[+-]\d\d:\d\d$/.test(text)) return text;
  return `${text.length === 16 ? `${text}:00` : text}-05:00`;
};

const centralPayload = (visit) => ({
  ...(visit.version != null ? { id: visit.id } : {}),
  trabajo_id: visit.workId,
  tipo: visit.kind,
  numero: visit.number ? Number(visit.number) : (visit.kind === 'INICIAL' ? 1 : undefined),
  ...(visit.version != null ? { version: visit.version } : {}),
  observed_at: limaObservedAt(visit.observedAt),
  payload: { outputIds: visit.outputIds || [], checks: visit.checks || {} },
});

const centralErrorStatus = (error) => error?.status || error?.response?.status || error?.statusCode;
const centralErrorText = (error) => {
  const status = centralErrorStatus(error);
  if (status === 409) {
    const code = error?.code || error?.response?.data?.code;
    return `Otra persona guardó cambios en este control.${code ? ` (${code})` : ''}`;
  }
  return error?.response?.data?.message || error?.message || 'No se pudo sincronizar el control central.';
};
const centralErrorVisit = (error, fallbackOtId) => {
  const candidate = error?.remote || error?.response?.data?.visit || error?.response?.data?.item;
  return candidate ? centralVisit(candidate, fallbackOtId) : null;
};
const cloneValue = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
const equalValue = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const applyLocalChanges = (base, shared, local) => {
  if (equalValue(local, base)) return cloneValue(shared);
  if (!local || typeof local !== 'object' || Array.isArray(local)
    || !shared || typeof shared !== 'object' || Array.isArray(shared)) return cloneValue(local);
  const keys = new Set([...Object.keys(shared), ...Object.keys(local)]);
  return [...keys].reduce((result, key) => {
    result[key] = applyLocalChanges(base?.[key], shared?.[key], local?.[key]);
    return result;
  }, {});
};
const mergeCentralVisits = (current, remoteItems, fallbackOtId = '') => {
  const quality = ensureWorkQuality(current?.pieceQuality);
  const local = quality.workVisits || [];
  const remote = remoteItems.map((item) => centralVisit(item, fallbackOtId)).filter(Boolean);
  const usedLocal = new Set();
  const merged = remote.map((remoteVisit) => {
    const localVisit = local.find((candidate) => (
      String(candidate.id) === String(remoteVisit.id)
      || (String(candidate.otId) === String(remoteVisit.otId)
        && String(candidate.workId) === String(remoteVisit.workId)
        && candidate.kind === remoteVisit.kind
        && String(candidate.number || '') === String(remoteVisit.number || ''))
    ));
    if (localVisit) usedLocal.add(localVisit.id);
    // A pending local draft is never discarded by a reconnect/read from a
    // second tablet.  Its version is refreshed so the next write can surface
    // the server conflict instead of silently overwriting the other actor.
    const localPending = localVisit?.status === 'DRAFT' && localVisit.syncStatus === 'pending';
    if (localPending) {
      return { ...localVisit, centralVersion: remoteVisit.version, centralStatus: remoteVisit.status };
    }
    return remoteVisit;
  });
  // The endpoint is scoped to this OT, but local storage can contain older
  // visits from other OTs (and an older central response may be incomplete).
  // Never erase those records while hydrating this detail.
  local.filter((visit) => !usedLocal.has(visit.id)).forEach((visit) => merged.push(visit));
  return { ...current, pieceQuality: { ...quality, workVisits: merged } };
};

const sameVisitIdentity = (item, visit, fallbackId = '') => (
  String(item?.id || '') === String(visit?.id || fallbackId)
  || (String(item?.otId || '') === String(visit?.otId || '')
    && String(item?.workId || '') === String(visit?.workId || '')
    && item?.kind === visit?.kind
    && String(item?.number || '') === String(visit?.number || ''))
);

function ScopePicker({ work, value, onChange, disabled = false }) {
  const ids = outputCheckScope(value);
  const allSelected = ids.length === work.outputs.length && work.outputs.length > 0;
  return <Box component="fieldset" sx={{ border: 0, p: 0, m: 0 }}>
    <Typography component="legend" variant="caption" fontWeight={800}>Salidas realmente revisadas</Typography>
    <Stack direction="row" flexWrap="wrap" gap={0.25} sx={{ mt: 0.25 }}>
      {work.outputs.map((output) => <FormControlLabel key={output.id} sx={{ mr: 1, '& .MuiFormControlLabel-label': { fontSize: '0.8rem' } }}
        control={<Checkbox size="small" checked={ids.includes(output.id)} disabled={disabled} onChange={() => onChange(ids.includes(output.id) ? ids.filter((id) => id !== output.id) : [...ids, output.id])} />}
        label={output.label} />)}
      <Button size="small" onClick={() => onChange(allSelected ? [] : work.outputs.map((output) => output.id))} disabled={disabled}>
        {allSelected ? 'Quitar todas' : 'Seleccionar todas'}
      </Button>
    </Stack>
  </Box>;
}

const measuredLabel = (family, value) => {
  if (family === 'peso') return { CORRECTO: 'Peso correcto', ALTO: 'Peso alto', BAJO: 'Peso bajo' }[value] || 'Pendiente';
  return { CORRECTO: 'Ciclo correcto', LENTO: 'Ciclo lento', RAPIDO: 'Ciclo rápido' }[value] || 'Pendiente';
};

function StatusChip({ label }) {
  const good = ['Conforme', 'Peso correcto', 'Ciclo correcto', 'No aplica'].includes(label);
  const warning = ['Con incidencia', 'Peso alto', 'Peso bajo', 'Ciclo lento', 'Ciclo rápido', 'Revisar'].includes(label);
  return <Chip size="small" label={label} color={good ? 'success' : warning ? 'warning' : 'default'} variant={label === 'Pendiente' ? 'outlined' : 'filled'} sx={{ flexShrink: 0 }} />;
}

function CheckRow({ family, title, status, measurement, actions, children, labelledBy, sx = {} }) {
  return <Box component="section" aria-labelledby={labelledBy} sx={{
    py: 1.25, minWidth: 0, borderTop: 1, borderColor: 'divider', display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto', gridTemplateAreas: '"title state" "body body" "actions actions"',
    alignItems: 'center', columnGap: 1, rowGap: 0.75,
    '@media (min-width: 620px)': {
      gridTemplateColumns: 'minmax(8rem, 1fr) minmax(12rem, 15rem) minmax(14rem, 18rem) 7rem',
      gridTemplateAreas: '"title body actions state"', rowGap: 0.5,
    },
    ...sx,
  }} data-family={family}>
    <Stack direction="row" alignItems="center" flexWrap="wrap" columnGap={1} minWidth={0} sx={{ gridArea: 'title' }}>
      <Typography id={labelledBy} component="h3" fontWeight={800} sx={{ minWidth: 0 }}>{title}</Typography>
      {family === 'color' && measurement}
    </Stack>
    <Box sx={{ gridArea: 'state', justifySelf: 'end', alignSelf: 'start' }}><StatusChip label={status} /></Box>
    <Box sx={{ gridArea: 'body', minWidth: 0 }}>{family !== 'color' && measurement && <Box sx={{ mb: 0.75 }}>{measurement}</Box>}{children}</Box>
    <Box sx={{ gridArea: 'actions', display: { xs: 'block', sm: 'contents' } }}>{actions}</Box>
  </Box>;
}

function WeightRows({ ot, work, checks, onChange, disabled = false }) {
  return <Stack component="section" aria-labelledby="quality-work-weight-title" data-testid="quality-work-weight-rows" spacing={0}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1.25 }}>
      <Typography id="quality-work-weight-title" component="h3" variant="subtitle1" fontWeight={850}>Peso</Typography>
      <Chip size="small" variant="outlined" label={`${work.outputs.length} ${work.outputs.length === 1 ? 'salida' : 'salidas'}`} />
    </Stack>
    {work.outputs.map((output) => {
      const row = checks[output.id] || {};
      const result = weightResult(row.netGrams, row.quantity);
      const status = result == null ? 'Pendiente' : measuredLabel('peso', row.classification);
      const measurement = <Stack direction="row" spacing={0.75} sx={{ width: '100%' }}>
        <TextField size="small" type="number" label="Neto (g)" value={row.netGrams ?? ''} disabled={disabled} onChange={(event) => onChange(output.id, { netGrams: event.target.value })} inputProps={{ 'aria-label': `Neto (g) · ${output.label}`, min: 0, step: 'any', inputMode: 'decimal' }} sx={{ minWidth: 0, flex: 1 }} />
        <TextField size="small" type="number" label="Cantidad" value={row.quantity ?? ''} disabled={disabled} onChange={(event) => onChange(output.id, { quantity: event.target.value })} inputProps={{ 'aria-label': `Cantidad · ${output.label}`, min: 1, step: 1, inputMode: 'numeric' }} sx={{ minWidth: 0, flex: 1 }} />
      </Stack>;
      const actions = <Stack spacing={0.5} sx={{ minWidth: 0 }}>
        <QualityReportAction family="peso" work={work} label={output.label} value={row} onChange={(patch) => onChange(output.id, patch)} disabled={disabled} />
        {result != null && <Typography variant="caption" color="text.secondary">{result.toLocaleString('es-PE', { maximumFractionDigits: 3 })} g/pieza · dato medido</Typography>}
        {['ALTO', 'BAJO'].includes(row.classification) && <QualityAffectedMangas ot={ot} work={work.work || work} allowedOutputIds={[output.id]} value={row.affectedMangas || []} onChange={(affectedMangas) => onChange(output.id, { affectedMangas })} disabled={disabled} />}
      </Stack>;
      return <CheckRow key={output.id} family="peso" title={output.label} status={status} measurement={measurement} actions={actions} labelledBy={`quality-work-weight-${output.id}-title`} sx={{ borderTop: 1, borderColor: 'divider' }} />;
    })}
  </Stack>;
}

function CommonFamily({ ot, work, family, title, check, onChange, disabled = false }) {
  const selected = outputCheckScope(check.scopeOutputIds);
  const applicable = (value) => outputCheckScope(value.scopeOutputIds).filter(id =>
    (value.statusByOutput?.[id] || value.status) === 'INCIDENCIA');
  const affected = applicable(check);
  const update = (patch) => {
    const next = { ...check, ...patch };
    const allowed = new Set(applicable(next).map(String));
    onChange({ ...patch, affectedMangas: (next.affectedMangas || []).filter(manga => allowed.has(String(manga.outputId))) });
  };
  const commonResult = (patch) => update({ ...patch, statusByOutput: {} });
  const hasIncident = affected.length > 0;
  const badge = hasIncident ? 'Con incidencia' : { OK: 'Conforme', NA: 'No aplica' }[check.status] || 'Pendiente';
  const actions = <Stack spacing={0.5} sx={{ minWidth: 0 }}>
    <QualityReportAction family={family} work={work} value={check} onChange={commonResult} disabled={disabled} />
    <Box component="details">
      <Typography component="summary" variant="caption" sx={{ cursor: 'pointer', py: 0.5 }}>
        Salidas revisadas ({selected.length}/{work.outputs.length})
      </Typography>
      <ScopePicker work={work} value={selected} onChange={(scopeOutputIds) => update({
        scopeOutputIds, statusByOutput: Object.fromEntries(scopeOutputIds.filter(id => check.statusByOutput?.[id]).map(id => [id,check.statusByOutput[id]])),
      })} disabled={disabled} />
      {check.status === 'INCIDENCIA' && selected.length > 1 && <Stack spacing={1} sx={{ mt: 1 }}>
        <Typography variant="caption">Salidas afectadas por la incidencia</Typography>
        {selected.map(id => <FormControlLabel key={id} label={outputLabel(work,id)} sx={{ mx: 0, '& .MuiTypography-root': { minWidth: 0, overflowWrap: 'anywhere' } }} control={
          <Checkbox size="small" checked={affected.includes(id)} disabled={disabled}
            onChange={(_,checked) => update({ statusByOutput: { ...check.statusByOutput, [id]: checked ? 'INCIDENCIA' : 'OK' } })} />
        } />)}
      </Stack>}
    </Box>
    {hasIncident && <QualityAffectedMangas ot={ot} work={work.work || work} allowedOutputIds={affected}
      value={check.affectedMangas || []} onChange={affectedMangas => update({ affectedMangas })} disabled={disabled} />}
  </Stack>;
  return <CheckRow family={family} title={title} status={badge} measurement={family === 'color' ? <ProductionColorLabel compact name={work.label} hex={work.work?.color_hex} /> : null} actions={actions} labelledBy={`quality-work-${family}-title`} />;
}

function CycleFamily({ ot, work, check, onChange, disabled = false }) {
  const status = !normalizeNumber(check?.seconds) ? 'Pendiente' : measuredLabel('ciclo', check?.classification);
  const measurement = <Stack spacing={0.5} sx={{ maxWidth: { xs: '100%', sm: '16rem' } }}>
    <TextField size="small" type="number" label="Ciclo observado (s)" value={check?.seconds || ''} disabled={disabled} onChange={(event) => onChange({ seconds: event.target.value, source: 'OBSERVADO' })} inputProps={{ min: 0, step: 'any', inputMode: 'decimal' }} helperText={check?.source === 'SUGERENCIA_TECNICA' ? 'Precarga técnica usada; confirma que coincide con lo observado.' : 'Dato observado en esta visita'} fullWidth />
    {check?.suggestedSeconds && !check?.seconds && <Button size="small" onClick={() => onChange({ seconds: check.suggestedSeconds, source: check.suggestionSource || 'SUGERENCIA_TECNICA' })}>{check.suggestionSource === 'MEDICION_ANTERIOR' ? 'Usar medición anterior' : 'Usar precarga técnica'} ({check.suggestedSeconds} s)</Button>}
  </Stack>;
  const actions = <Stack spacing={0.5} sx={{ minWidth: 0 }}>
    <QualityReportAction family="ciclo" work={work} value={check} onChange={onChange} disabled={disabled} />
    {['LENTO', 'RAPIDO'].includes(check?.classification) && <QualityAffectedMangas ot={ot} work={work.work || work} value={check?.affectedMangas || []} onChange={(affectedMangas) => onChange({ affectedMangas })} disabled={disabled} />}
  </Stack>;
  return <CheckRow family="ciclo" title="Ciclo" status={status} measurement={measurement} actions={actions} labelledBy="quality-work-cycle-title" />;
}

function CompletedPeriodics({ summary }) {
  if (!summary.periodicVisits.length) return null;
  return <Stack component="ul" aria-label="Controles periódicos completados" spacing={0.75} sx={{ m: 0, p: 0, listStyle: 'none' }}>
    {summary.periodicVisits.map(visit => {
      const work = summary.works.find(row => visit.workIds.includes(String(row.workId)));
      return <Paper component="li" variant="outlined" key={visit.key} sx={{ px: { xs: 1.5, sm: 2 }, py: 1, minHeight: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Stack direction="row" alignItems="baseline" flexWrap="wrap" columnGap={1.25}>
          <Typography component="span" fontWeight={750}>Control #{visit.number}</Typography>
          <Typography component="span" variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {work ? [work.mouldName, work.colorName, work.disambiguation].filter(Boolean).join(' · ') : 'Trabajo sin identificar'}
          </Typography>
        </Stack>
        <Chip size="small" color="success" variant="outlined" label="Completado" />
      </Paper>;
    })}
  </Stack>;
}

function WorkHistory({ visits, works, incidents }) {
  return <Stack spacing={1.25} data-testid="quality-work-history"><Box><Typography component="h2" variant="h6" fontWeight={850}>Historial de controles por trabajo</Typography><Typography variant="body2" color="text.secondary">Cada visita conserva el trabajo observado y las salidas realmente cubiertas. Los controles confirmados son de consulta; los borradores se pueden retomar.</Typography></Box>{visits.length ? visits.slice().reverse().map((visit) => <Card variant="outlined" key={visit.id}><CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}><Box><Typography fontWeight={800}>{visit.kind === 'PERIODICA' ? `Visita periódica${visit.number ? ` #${visit.number}` : ''}` : 'Control de arranque'} · {works.find((work) => work.workId === visit.workId)?.label || 'Trabajo'}</Typography><Typography variant="caption" color="text.secondary">{visit.status === 'DRAFT' ? 'Borrador' : 'Confirmado'} · Observada {visit.observedAt || 'sin fecha'} · registrada {visit.recordedAt || 'sin fecha'}</Typography></Box></Stack><Divider sx={{ my: 1 }} /><Typography variant="body2">Salidas: {scopeText(works.find((work) => work.workId === visit.workId) || { outputs: [] }, visit.outputIds)}</Typography>{incidents.filter(i => i.visitId === visit.id && i.affectedMangas?.length).map(i => <Typography key={i.id} variant="body2">{i.type}: {i.affectedMangas.map(m => m.code || m.id).join(', ')}</Typography>)}{visitAffectedMangas(visit).length > 0 && <Typography variant="caption" color="text.secondary">Registro anterior · mangas sin incidencia identificada: {visitAffectedMangas(visit).map((manga) => manga.code || manga.id).join(', ')}</Typography>}</CardContent></Card>) : <Alert severity="info">Aún no hay controles de trabajo para esta OT.</Alert>}</Stack>;
}

export default function QualityWorkStation({ ot, moldCatalog = [], localState, setLocalState, historyOnly = false, readOnly = false, routeWorkVisit = null, onWorkVisitRoute, beforeLeaveRef, qualityVisitApi = null }) {
  const works = useMemo(() => normalizeWorkRows(ot, moldCatalog), [moldCatalog, ot]);
  const pieces = useMemo(() => normalizePieceRows(ot, moldCatalog), [moldCatalog, ot]);
  const otId = ot?.public_id || ot?.id || ot?.codigo_ot || '';
  const pieceQuality = localState?.pieceQuality || {};
  const quality = ensureWorkQuality(pieceQuality);
  const activeWorks = works.filter(workIsActive);
  const [selectedWorkId, setSelectedWorkId] = useState(() => routeWorkVisit?.workId || (works.length === 1 ? works[0].workId : activeWorks.length === 1 ? activeWorks[0].workId : ''));
  const [kind, setKind] = useState(() => routeWorkVisit?.kind || 'INICIAL');
  const [controlNumber, setControlNumber] = useState(() => routeWorkVisit?.number || '');
  const [visitId, setVisitId] = useState('');
  const [observedAt, setObservedAt] = useState('');
  const [draft, setDraft] = useState(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [dirty, setDirty] = useState(false);
  const [centralConflict, setCentralConflict] = useState(null);
  const [centralSaving, setCentralSaving] = useState(false);
  const [centralHydrated, setCentralHydrated] = useState(() => !(qualityVisitApi?.loadVisits || Array.isArray(ot?.visitas_calidad)));
  const [confirming, setConfirming] = useState(false);
  const autosaveTimer = useRef(null);
  const routeOpenedRef = useRef('');
  const justConfirmedRoute = useRef('');
  const latestSaveDraftRef = useRef(() => true);
  const draftSyncRef = useRef({ pending: null, running: false });
  const draftFlushRef = useRef(Promise.resolve());
  const centralServerVisitsRef = useRef(new Map());
  const draftOperationKeysRef = useRef(new Map());
  const confirmOperationKeysRef = useRef(new Map());
  const autosavePausedRef = useRef(false);
  const conflictBaseRef = useRef(new Map());
  const failedDraftRef = useRef(null);
  const centralLoadAbortRef = useRef(null);
  const embeddedVisitsKeyRef = useRef('');
  const confirmingRef = useRef(false);
  const routeTransitionRef = useRef(false);
  const routeTransitionTimerRef = useRef(null);
  const selectedWork = works.find((work) => String(work.workId) === String(selectedWorkId));
  // The parent hydrates the OT with its manga list. Supplying an empty list when
  // it is absent keeps the selector local and avoids an implicit network write
  // or an unbounded request while the OT detail is still being hydrated.
  const mangaOt = useMemo(() => {
    const hasMangaList = Array.isArray(ot?.mangas) || Array.isArray(ot?.mangas_resumen)
      || Array.isArray(selectedWork?.work?.mangas) || Array.isArray(selectedWork?.work?.mangas_resumen);
    return hasMangaList ? ot : { ...(ot || {}), mangas: [] };
  }, [ot, selectedWork]);
  const visits = quality.workVisits.filter((visit) => String(visit.otId) === String(otId));
  const initialOtVisit = otInitialVisit(pieceQuality, otId, pieces);
  const selectedRecord = selectedWork ? ensureWorkRecord(pieceQuality, selectedWork) : null;
  const cycleSuggestion = selectedWork && [...quality.workVisits].reverse().find((visit) => visit.status === 'CONFIRMED'
    && String(visit.workId) === String(selectedWork.workId) && normalizeNumber(visit.checks?.commonChecks?.ciclo?.seconds) > 0)?.checks?.commonChecks?.ciclo?.seconds;
  const summary = useMemo(() => buildQualityOtInspectionSummary({ ot, localState, moldCatalog }), [ot, localState, moldCatalog]);
  const lastConfirmedNumber = summary.periodicVisits.at(-1)?.number ?? 1;
  const nextAvailable = String(lastConfirmedNumber + 1);
  const draftsFor = (workId, type) => visits.filter(v => String(v.workId) === String(workId) && v.kind === type && v.status === 'DRAFT');
  const pendingNumber = (workId) => String(draftsFor(workId, 'PERIODICA').at(-1)?.number || nextAvailable);
  const nextNumber = controlNumber || pendingNumber(selectedWorkId);
  const initialClosed = useInitialClosed({ fechaOperativa: ot?.fecha_operativa, turno: ot?.turno });
  const initialDraftAvailable = Boolean(selectedWork && draftsFor(selectedWork.workId, 'INICIAL').length);
  const periodicDraftAvailable = Boolean(selectedWork && draftsFor(selectedWork.workId, 'PERIODICA').length);
  const workStarted = workHasStarted(selectedWork);
  const initialBelongsToSelected = Boolean(initialOtVisit && String(initialOtVisit.workId) === String(selectedWork?.workId));
  const initialBlockedByOt = Boolean(initialOtVisit && !initialBelongsToSelected);
  const initialDraftByOtherWork = Boolean(initialOtVisit?.status === 'DRAFT' && initialBlockedByOt);
  const initialDoneHere = selectedRecord?.initialStatus === 'CONFIRMED'
    || (initialBelongsToSelected && initialOtVisit.status === 'CONFIRMED');
  const initialTakenMessage = initialOtVisit?.status === 'DRAFT'
    ? 'Hay un borrador de arranque pendiente en otro trabajo. Retómalo antes de iniciar otro.'
    : 'El arranque de esta OT ya fue registrado en otro trabajo.';
  const initialBlocked = initialDoneHere || initialBlockedByOt || ((initialClosed || !workStarted) && !initialDraftAvailable);
  const periodicBlockedByQueue = !workStarted && !periodicDraftAvailable;
  const initialCutoffLabel = String(ot?.turno || '').toUpperCase() === 'NOCHE' ? '20:00' : '08:00';
  function startActionDetail() {
    if (initialDoneHere) return 'Realizado';
    if (initialDraftByOtherWork) return 'Borrador de arranque pendiente';
    if (initialBlockedByOt) return 'Arranque registrado en otra producción';
    if (initialDraftAvailable) return 'Continuar borrador';
    if (initialClosed) return `Plazo cerrado a las ${initialCutoffLabel} (Lima)`;
    return workStarted ? 'Registrar' : 'Trabajo en cola';
  }

  const persist = useCallback((updater) => {
    if (!setLocalState) return false;
    return setLocalState(updater) !== false;
  }, [setLocalState]);

  const embeddedVisits = Array.isArray(ot?.visitas_calidad) ? ot.visitas_calidad : null;
  const loadCentralVisits = useCallback(async () => {
    if (!otId) return;
    if (historyOnly && !embeddedVisits) return;
    if (embeddedVisits) {
      const key = `${otId}:${embeddedVisits.map((item) => `${item.id}:${item.version}:${item.estado}`).join('|')}`;
      if (embeddedVisitsKeyRef.current === key) return;
      embeddedVisitsKeyRef.current = key;
      persist((current) => mergeCentralVisits(current, embeddedVisits, otId));
      setCentralHydrated(true);
      return;
    }
    if (!qualityVisitApi?.loadVisits) return;
    centralLoadAbortRef.current?.abort();
    const controller = new AbortController();
    centralLoadAbortRef.current = controller;
    try {
      const response = await qualityVisitApi.loadVisits(otId, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const items = Array.isArray(response) ? response : response?.items || [];
      persist((current) => mergeCentralVisits(current, items, otId));
      setCentralHydrated(true);
    } catch (error) {
      if (error?.name !== 'AbortError' && centralErrorStatus(error) !== 'ERR_CANCELED') {
        setSaveMessage(centralErrorText(error));
      }
      setCentralHydrated(true);
    }
  }, [embeddedVisits, historyOnly, otId, persist, qualityVisitApi]);

  useEffect(() => {
    if ((!qualityVisitApi?.loadVisits && !embeddedVisits) || (historyOnly && !embeddedVisits)) return undefined;
    loadCentralVisits();
    const onOnline = () => loadCentralVisits();
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
      centralLoadAbortRef.current?.abort();
    };
  }, [embeddedVisits, historyOnly, loadCentralVisits, qualityVisitApi]);

  const syncDraftCentral = useCallback((visit) => {
    if (!qualityVisitApi?.saveDraft) return Promise.resolve(null);
    if (autosavePausedRef.current) return Promise.resolve(false);
    draftSyncRef.current.pending = visit;
    if (draftSyncRef.current.running) return draftFlushRef.current;
    draftSyncRef.current.running = true;
    const drain = async () => {
      let drainOk = true;
      while (draftSyncRef.current.pending) {
        const pending = draftSyncRef.current.pending;
        draftSyncRef.current.pending = null;
        setCentralSaving(true);
        const payload = centralPayload(pending);
        const signature = JSON.stringify(payload);
        let idempotencyKey = draftOperationKeysRef.current.get(signature);
        if (!idempotencyKey) {
          // Idempotency-Key is an RFC UUID, not a UI-labelled local id.
          idempotencyKey = createUuid();
          draftOperationKeysRef.current.set(signature, idempotencyKey);
        }
        try {
          const response = await qualityVisitApi.saveDraft(otId, payload, { idempotencyKey });
          const serverVisit = centralVisit(response?.item || response);
          if (serverVisit) {
            centralServerVisitsRef.current.set(pending.id, serverVisit);
            const serverChecksSnapshot = cloneValue(serverVisit.checks || pending.checks || {});
            conflictBaseRef.current.set(pending.id, serverChecksSnapshot);
            if (serverVisit.id) conflictBaseRef.current.set(serverVisit.id, cloneValue(serverChecksSnapshot));
            persist((current) => {
              const qualityState = ensureWorkQuality(current?.pieceQuality);
              const same = qualityState.workVisits.find((item) => item.id === pending.id)
                || qualityState.workVisits.find((item) => String(item.workId) === String(pending.workId) && item.kind === pending.kind && String(item.number || '') === String(pending.number || ''));
              return { ...current, pieceQuality: { ...qualityState, workVisits: [...qualityState.workVisits.filter((item) => item.id !== same?.id), { ...pending, ...serverVisit, status: 'DRAFT', syncStatus: 'synced' }] } };
            });
            if (visitId === pending.id) {
              setVisitId(serverVisit.id || pending.id);
              if (serverVisit.number != null) {
                setControlNumber(String(serverVisit.number));
                if (pending.kind === 'PERIODICA') onWorkVisitRoute?.({ workId: pending.workId, kind: pending.kind, number: String(serverVisit.number) });
              }
            }
          }
          setCentralConflict(null);
          setSaveMessage('Borrador guardado');
          setCentralSaving(false);
          failedDraftRef.current = null;
          draftOperationKeysRef.current.delete(signature);
        } catch (error) {
          drainOk = false;
          setCentralSaving(false);
          if (centralErrorStatus(error) === 409) {
            autosavePausedRef.current = true;
            draftSyncRef.current.pending = null;
            setCentralConflict({ local: pending, remote: centralErrorVisit(error, otId), message: centralErrorText(error) });
            setSaveMessage(centralErrorText(error));
          } else {
            failedDraftRef.current = pending;
            setSaveMessage(centralErrorText(error));
          }
        }
      }
      draftSyncRef.current.running = false;
      setCentralSaving(false);
      return drainOk;
    };
    draftFlushRef.current = drain();
    return draftFlushRef.current;
  }, [onWorkVisitRoute, otId, persist, qualityVisitApi, visitId]);

  const fetchConflictRemote = useCallback(async () => {
    if (!centralConflict || (!qualityVisitApi?.loadVisits && !centralConflict.remote)) return null;
    const response = centralConflict.remote || await qualityVisitApi.loadVisits(otId, {});
    const items = centralConflict.remote ? [response] : (Array.isArray(response) ? response : response?.items || []);
    const localNumber = centralConflict.local.number || (centralConflict.local.kind === 'INICIAL' ? 1 : '');
    return items.map((item) => centralVisit(item, otId)).find((item) => (
      String(item.workId) === String(centralConflict.local.workId)
      && item.kind === centralConflict.local.kind
      && String(item.number || (item.kind === 'INICIAL' ? 1 : '')) === String(localNumber)
    )) || null;
  }, [centralConflict, otId, qualityVisitApi]);

  const applyConflictChoice = useCallback((sharedVisit, checks, message, dirtyAfterChoice) => {
    if (!sharedVisit) {
      setSaveMessage('La versión nueva ya no está disponible. Conserva el borrador local y reintenta.');
      return;
    }
    const chosen = { ...sharedVisit, status: sharedVisit.status || 'DRAFT', syncStatus: 'synced', checks };
    persist((current) => {
      const qualityState = ensureWorkQuality(current?.pieceQuality);
      const same = qualityState.workVisits.find((item) => item.id === centralConflict.local.id)
        || qualityState.workVisits.find((item) => String(item.workId) === String(chosen.workId) && item.kind === chosen.kind && String(item.number || '') === String(chosen.number || ''));
      return { ...current, pieceQuality: { ...qualityState, workVisits: [...qualityState.workVisits.filter((item) => item.id !== same?.id), chosen] } };
    });
    setVisitId(chosen.id || centralConflict.local.id);
    setControlNumber(chosen.number || '');
    setObservedAt(chosen.observedAt || '');
    setDraft(draftFromVisit(selectedWork, chosen));
    setDirty(dirtyAfterChoice);
    autosavePausedRef.current = false;
    failedDraftRef.current = null;
    setCentralConflict(null);
    setCentralSaving(false);
    setSaveMessage(message);
  }, [centralConflict, persist, selectedWork]);

  const useSharedVersion = useCallback(async () => {
    try {
      const remote = await fetchConflictRemote();
      applyConflictChoice(remote, remote?.checks || {}, 'Usaste la versión compartida; la edición pendiente local se descartó.', false);
    } catch (error) {
      setSaveMessage(centralErrorText(error));
    }
  }, [applyConflictChoice, fetchConflictRemote]);

  const keepMyEdition = useCallback(async () => {
    if (centralConflict?.remote?.status === 'CONFIRMED') {
      setSaveMessage('La versión compartida ya está confirmada y no admite reaplicar esta edición. Descártala para consultar el control confirmado.');
      return;
    }
    try {
      const remote = await fetchConflictRemote();
      // The 409 body may omit the conflicting visit. Re-read it before
      // merging so a remote confirmation can never be treated as a draft.
      if (remote?.status === 'CONFIRMED') {
        setCentralConflict((current) => current ? { ...current, remote } : current);
        setSaveMessage('La versión compartida ya está confirmada y no admite reaplicar esta edición. Descártala para consultar el control confirmado.');
        return;
      }
      const local = centralConflict?.local;
      const base = conflictBaseRef.current.get(local?.id) || {};
      const checks = applyLocalChanges(base || {}, remote?.checks || {}, local?.checks || {});
      applyConflictChoice(remote, checks, 'Conservaste tus cambios; los campos nuevos de la versión compartida se incorporaron.', true);
    } catch (error) {
      setSaveMessage(centralErrorText(error));
    }
  }, [applyConflictChoice, centralConflict, fetchConflictRemote]);
  const updateDraft = (updater) => { setDraft((current) => updater(current)); setDirty(true); setSaveMessage(''); };
  const retryDraft = useCallback(() => {
    if (!failedDraftRef.current) return;
    autosavePausedRef.current = false;
    syncDraftCentral(failedDraftRef.current);
  }, [syncDraftCentral]);
  const begin = (nextKind = 'INICIAL', requestedNumber = '', fromRoute = false) => {
    if (!selectedWork) return;
    const existingDraft = draftsFor(selectedWork.workId, nextKind).length > 0;
    if (!workHasStarted(selectedWork) && !existingDraft) {
      setSaveMessage('El trabajo sigue en cola; espera a que comience para registrar un control.');
      return;
    }
    if (nextKind === 'INICIAL' && initialOtVisit
      && String(initialOtVisit.workId) !== String(selectedWork.workId)) {
      setSaveMessage(initialTakenMessage);
      return;
    }
    setKind(nextKind);
    const number = nextKind === 'PERIODICA' ? String(requestedNumber || pendingNumber(selectedWork.workId)) : '1';
    setControlNumber(nextKind === 'PERIODICA' ? number : '');
    if (!fromRoute && onWorkVisitRoute) {
      routeTransitionRef.current = true;
      window.clearTimeout(routeTransitionTimerRef.current);
      routeTransitionTimerRef.current = window.setTimeout(() => { routeTransitionRef.current = false; }, 500);
      routeOpenedRef.current = [selectedWork.workId, nextKind, number].join(':');
      onWorkVisitRoute({ workId: selectedWork.workId, kind: nextKind, number });
    }
    const resumable = draftsFor(selectedWork.workId, nextKind).reverse().find(v => nextKind === 'INICIAL' || String(v.number || nextAvailable) === number);
    const nextVisitId = resumable?.id || uniqueId('work-visit');
    setVisitId(nextVisitId);
    setObservedAt(localDateTime(resumable?.observedAt));
    const nextDraft = draftFromVisit(selectedWork, resumable);
    conflictBaseRef.current.set(nextVisitId, cloneValue(nextDraft));
    if (!resumable) {
      if (selectedWork.cycleReferenceSeconds) {
        nextDraft.commonChecks.ciclo.suggestedSeconds = selectedWork.cycleReferenceSeconds;
        nextDraft.commonChecks.ciclo.suggestionSource = 'SUGERENCIA_TECNICA';
      } else if (nextKind === 'PERIODICA' && cycleSuggestion) {
        nextDraft.commonChecks.ciclo.suggestedSeconds = cycleSuggestion;
        nextDraft.commonChecks.ciclo.suggestionSource = 'MEDICION_ANTERIOR';
      }
    }
    setDraft(nextDraft);
    setDirty(false);
    setSaveMessage('');
  };
  const saveDraft = useCallback(() => {
    if (!dirty || !selectedWork || !draft || !visitId || readOnly || historyOnly) return true;
    let alreadyConfirmed = false;
    let nextVisit = null;
    const ok = persist(current => {
      const q = ensureWorkQuality(current?.pieceQuality);
      const existing = q.workVisits.find(visit => visit.id === visitId);
      if (existing?.status === 'CONFIRMED') { alreadyConfirmed = true; return current; }
      const next = { id: visitId, otId, workId: selectedWork.workId, kind, status: 'DRAFT', syncStatus: 'pending', version: existing?.version,
        number: kind === 'PERIODICA' ? (controlNumber || nextNumber) : '', outputIds: selectedWork.outputs.map(output => output.id),
        observedAt, recordedAt: existing?.recordedAt || nowIso(), checks: draft };
      nextVisit = next;
      return { ...current, pieceQuality: { ...q, workVisits: [...q.workVisits.filter(v => v.id !== visitId), next] } };
    });
    if (ok) {
      setDirty(false);
      if (nextVisit) syncDraftCentral(nextVisit);
    }
    setSaveMessage(alreadyConfirmed ? 'Este control ya fue confirmado.' : ok ? (qualityVisitApi?.saveDraft ? 'Guardando borrador…' : 'Borrador guardado') : 'No se pudo guardar el borrador. Reintenta sin perder lo capturado.');
    return ok && !alreadyConfirmed;
  }, [dirty, selectedWork, draft, visitId, readOnly, historyOnly, persist, otId, kind, controlNumber, nextNumber, observedAt, qualityVisitApi?.saveDraft, syncDraftCentral]);
  useEffect(() => {
    if (!dirty || centralConflict) return undefined;
    autosaveTimer.current = window.setTimeout(saveDraft, 700);
    const flushHidden = () => { if (document.visibilityState === 'hidden') saveDraft(); };
    document.addEventListener('visibilitychange', flushHidden);
    return () => {
      window.clearTimeout(autosaveTimer.current);
      document.removeEventListener('visibilitychange', flushHidden);
    };
  }, [centralConflict, dirty, saveDraft]);
  useEffect(() => {
    latestSaveDraftRef.current = saveDraft;
  }, [saveDraft]);
  useEffect(() => () => {
    // A route transition can unmount the station before the debounce fires.
    // Keep the latest closure so the final keystroke is included.
    latestSaveDraftRef.current();
  }, []);
  useEffect(() => {
    if (!beforeLeaveRef) return undefined;
    const flush = () => saveDraft();
    beforeLeaveRef.current = flush;
    return () => {
      if (beforeLeaveRef.current === flush) beforeLeaveRef.current = null;
    };
  }, [beforeLeaveRef, saveDraft]);
  useEffect(() => {
    const hasVisitRoute = routeWorkVisit && ['INICIAL', 'PERIODICA'].includes(routeWorkVisit.kind);
    const routeKey = hasVisitRoute ? `${routeWorkVisit.workId}:${routeWorkVisit.kind}:${routeWorkVisit.number || ''}` : '';
    if (!routeKey) { justConfirmedRoute.current = ''; return; }
    if (!centralHydrated) return;
    if (justConfirmedRoute.current === routeKey) return;
    const target = works.find((work) => String(work.workId) === String(routeWorkVisit.workId));
    const n = String(routeWorkVisit.number || '');
    const pending = draftsFor(target?.workId, 'PERIODICA');
    const invalidPeriodicNumber = routeWorkVisit.kind === 'PERIODICA' &&
      (!/^[1-9]\d*$/.test(n) || (pending.length ? !pending.some(v => String(v.number || nextAvailable) === n) : n !== nextAvailable));
    const hasInitialDraft = target && draftsFor(target.workId, 'INICIAL').length > 0;
    const blockedInitial = routeWorkVisit.kind === 'INICIAL'
      && ((initialClosed && !hasInitialDraft) || (n && n !== '1')
        || initialOtVisit?.status === 'CONFIRMED'
        || (target && ensureWorkRecord(pieceQuality, target).initialStatus === 'CONFIRMED'));
    if (!target || invalidPeriodicNumber || blockedInitial) {
      if (draft && !saveDraft()) return;
      routeOpenedRef.current = '';
      setDraft(null);
      setVisitId('');
      setControlNumber('');
      setDirty(false);
      setSaveMessage('El enlace no corresponde a un control disponible. Selecciona el trabajo observado.');
      setSelectedWorkId(target && !invalidPeriodicNumber && !blockedInitial ? target.workId : '');
      return;
    }
    if (String(selectedWorkId) !== String(target.workId)) {
      if (!saveDraft()) return;
      routeOpenedRef.current = '';
      setDraft(null);
      setVisitId('');
      setSaveMessage('');
      setDirty(false);
      setSelectedWorkId(target.workId);
      return;
    }
    if (routeOpenedRef.current === routeKey) {
      routeTransitionRef.current = false;
      window.clearTimeout(routeTransitionTimerRef.current);
      return;
    }
    if (draft && !saveDraft()) return;
    routeOpenedRef.current = routeKey;
    begin(routeWorkVisit.kind || 'INICIAL', routeWorkVisit.number || '', true);
    // The parent owns the URL; this effect only mirrors its selected work.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centralHydrated, routeWorkVisit?.workId, routeWorkVisit?.kind, routeWorkVisit?.number, selectedWorkId, works, initialClosed, draft, saveDraft]);
  useEffect(() => {
    // A work-only URL is the OT detail selection state, not a visit. Keep the
    // summary row and the read-only form identity synchronized when SPA
    // navigation changes `trabajo` without unmounting this station.
    // Standalone renders (including unit tests) own their selection locally;
    // only the routed station may mirror the URL into its selected row.
    if (!onWorkVisitRoute || routeWorkVisit?.kind) return;
    const requestedWork = routeWorkVisit?.workId
      ? works.find((work) => String(work.workId) === String(routeWorkVisit.workId))
      : null;
    // Keep the immediate row selection while the router commits the URL. The
    // empty work-only route is not permission to clear a freshly selected row.
    if (!routeWorkVisit?.workId && selectedWorkId) return;
    // An explicit but stale work id must not silently switch the inspector to
    // the active work. Automatic fallback is only valid when the URL omits
    // `trabajo` entirely.
    const fallback = routeWorkVisit?.workId
      ? (requestedWork?.workId || '')
      : (works.length === 1 ? works[0].workId : activeWorks.length === 1 ? activeWorks[0].workId : '');
    if (String(selectedWorkId) === String(fallback)) return;
    if (draft && !saveDraft()) return;
    routeOpenedRef.current = '';
    setDraft(null);
    setVisitId('');
    setControlNumber('');
    setDirty(false);
    setSaveMessage('');
    setSelectedWorkId(fallback);
  }, [activeWorks, onWorkVisitRoute, routeWorkVisit?.workId, routeWorkVisit?.kind, selectedWorkId, works, draft, saveDraft]);
  useEffect(() => {
    const hasVisitRoute = routeWorkVisit && ['INICIAL', 'PERIODICA'].includes(routeWorkVisit.kind);
    if (!routeOpenedRef.current || hasVisitRoute || !draft) return;
    // The router may commit the navigation on the next tick. Keep the form
    // open during that transition instead of autosaving/clearing it under the
    // previously selected work.
    if (onWorkVisitRoute && routeTransitionRef.current) return;
    if (saveDraft()) {
      setDraft(null);
      setVisitId('');
      setControlNumber('');
      setDirty(false);
      setSaveMessage('');
    }
    routeOpenedRef.current = '';
  }, [draft, onWorkVisitRoute, routeWorkVisit, saveDraft]);
  if (historyOnly) return <WorkHistory visits={visits.filter(visit => visit.status === 'CONFIRMED')} works={works} incidents={quality.incidents || []} />;
  if (!works.length) return <><QualityOtInspectionSummary summary={summary} /><CompletedPeriodics summary={summary} /></>;
  if (readOnly) return <Alert severity="info">Esta estación está en modo consulta y no permite crear controles.</Alert>;

  const validate = () => {
    if (!selectedWork || !draft) return 'Selecciona primero el trabajo observado.';
    if (!observedAt) return 'Indica el momento observado.';
    if (!selectedWork.outputs.length) return 'Este trabajo carece de salidas para inspeccionar.';
    if (kind === 'INICIAL' && isInitialClosed({ fechaOperativa: ot?.fecha_operativa, turno: ot?.turno })) return 'La ventana del control de arranque ya cerró.';
    if (kind === 'INICIAL' && initialOtVisit && String(initialOtVisit.workId) !== String(selectedWork.workId)) return initialTakenMessage;
    if (kind === 'PERIODICA' && periodicBlockedByQueue && !draftsFor(selectedWork.workId, 'PERIODICA').some(v => v.id === visitId)) return 'El trabajo sigue en cola; no se puede registrar un periódico nuevo.';
    for (const output of selectedWork.outputs) {
      const row = draft.outputChecks[output.id] || {};
      if (!(normalizeNumber(row.netGrams) > 0)) return `Ingresa el neto de ${output.label}.`;
      if (!(normalizeNumber(row.quantity) > 0) || !Number.isSafeInteger(normalizeNumber(row.quantity))) return `Ingresa una cantidad entera para ${output.label}.`;
      if (!['CORRECTO', 'ALTO', 'BAJO'].includes(row.classification)) return `Selecciona el resultado de peso de ${output.label}.`;
    }
    const cycle = draft.commonChecks.ciclo || {};
    if (!(normalizeNumber(cycle.seconds) > 0)) return 'Ingresa los segundos del ciclo observado.';
    if (!['CORRECTO', 'LENTO', 'RAPIDO'].includes(cycle.classification)) return 'Selecciona el resultado del ciclo observado.';
    for (const family of FAMILY_IDS) {
      const check = draft.commonChecks[family] || {};
      if (!check.scopeOutputIds?.length) return `Selecciona las salidas revisadas en ${CHECK_LABELS[family]}.`;
      if (!['OK', 'INCIDENCIA', 'NA'].includes(check.status) || (family !== 'funcional' && check.status === 'NA')) return `Resuelve la familia ${CHECK_LABELS[family]}.`;
      if (check.status === 'INCIDENCIA' && !check.scopeOutputIds.some(id => (check.statusByOutput?.[id] || check.status) === 'INCIDENCIA')) return `Indica qué salida presentó la incidencia de ${CHECK_LABELS[family]} o marca Dar conforme.`;
    }
    return '';
  };
  const save = () => {
    const error = validate();
    if (error) { setSaveMessage(error); return; }
    window.clearTimeout(autosaveTimer.current);
    const id = visitId || uniqueId('work-visit');
    const number = kind === 'PERIODICA' ? (controlNumber || nextNumber) : '';
    const visit = { id, otId, workId: selectedWork.workId, kind, status: 'CONFIRMED', number, outputIds: selectedWork.outputs.map((output) => output.id), observedAt: observedAt || nowIso(), recordedAt: nowIso(), fechaOperativa: ot?.fecha_operativa || '', turno: ot?.turno || '', machineId: ot?.maquina_id || ot?.maquina?.id || '', checks: draft };
    const commonIncidentRows = FAMILY_IDS.flatMap((family) => {
      const check = draft.commonChecks[family] || {};
      const scoped = outputCheckScope(check.scopeOutputIds);
      const byOutput = check.statusByOutput || {};
      const outputIds = scoped.filter(outputId => (byOutput[outputId] || check.status) === 'INCIDENCIA');
      return outputIds.length ? [{ id: `${id}:${family}`, otId, workId: selectedWork.workId, outputIds, scopeOutputIds: outputIds, affectedMangas: (check.affectedMangas || []).filter(m => outputIds.map(String).includes(String(m.outputId))), checkId: family, type: `${CHECK_LABELS[family]} · incidencia`, incidentOptions: check.incidentOptions || [], otherText: check.otherText || '', description: check.description || '', evidence: check.evidence || '', owner: check.owner || '', action: check.action || '', status: 'ABIERTA', visitId: id, createdAt: nowIso() }] : [];
    });
    const weightIncidents = selectedWork.outputs.flatMap((output) => {
      const row = draft.outputChecks[output.id] || {};
      return ['ALTO', 'BAJO'].includes(row.classification) ? [{ id: `${id}:peso:${output.id}`, otId, workId: selectedWork.workId, outputIds: [output.id], scopeOutputIds: [output.id], affectedMangas: row.affectedMangas || [], checkId: 'peso', type: row.classification === 'ALTO' ? 'Peso alto' : 'Peso bajo', incidentOptions: row.incidentOptions || [], otherText: row.otherText || '', description: row.description || '', evidence: row.evidence || '', owner: row.owner || '', action: row.action || '', netGrams: row.netGrams, quantity: row.quantity, result: weightResult(row.netGrams, row.quantity), status: 'ABIERTA', visitId: id, createdAt: nowIso() }] : [];
    });
    const cycleCheck = draft.commonChecks.ciclo || {};
    const cycleIncidents = ['LENTO', 'RAPIDO'].includes(cycleCheck.classification) ? [{ id: `${id}:ciclo`, otId, workId: selectedWork.workId, outputIds: [], scopeOutputIds: [], affectedMangas: cycleCheck.affectedMangas || [], checkId: 'ciclo', type: cycleCheck.classification === 'LENTO' ? 'Ciclo lento' : 'Ciclo rápido', incidentOptions: cycleCheck.incidentOptions || [], otherText: cycleCheck.otherText || '', description: cycleCheck.description || '', evidence: cycleCheck.evidence || '', owner: cycleCheck.owner || '', action: cycleCheck.action || '', seconds: cycleCheck.seconds, status: 'ABIERTA', visitId: id, createdAt: nowIso() }] : [];
    const incidentRows = [...commonIncidentRows, ...weightIncidents, ...cycleIncidents];
    const commitLocal = (confirmedVisit = visit) => {
      const persisted = persist((current) => {
      const currentPieceQuality = ensureWorkQuality(current?.pieceQuality);
      if (currentPieceQuality.workVisits.some(item => item.id === id && item.status === 'CONFIRMED')) return current;
      if (kind === 'INICIAL') {
        const existingInitial = otInitialVisit(currentPieceQuality, otId);
        if (existingInitial?.status === 'CONFIRMED' && existingInitial.id !== id) {
          return current;
        }
      }
      const records = { ...currentPieceQuality.workRecords };
      const previous = ensureWorkRecord(currentPieceQuality, selectedWork);
      records[selectedWork.key] = { ...previous, key: selectedWork.key, otId, workId: selectedWork.workId, outputChecks: draft.outputChecks, commonChecks: draft.commonChecks, ...(kind === 'INICIAL' ? { initialChecks: draft, initialStatus: FAMILY_IDS.every(family => draft.commonChecks[family].scopeOutputIds.length === selectedWork.outputs.length) ? 'CONFIRMED' : 'PARTIAL' } : {}) };
      const legacyVisits = Array.isArray(currentPieceQuality.visits) ? currentPieceQuality.visits : [];
      const legacyRecords = { ...(currentPieceQuality.records || {}) };
      const checksByPiece = {};
      const pieceResults = [];
      selectedWork.outputs.forEach((output) => {
        const pieceKey = pieceIdentity(otId, selectedWork.workId, output.id);
        const weight = draft.outputChecks[output.id] || {};
        const cycle = draft.commonChecks.ciclo || {};
        const common = (family) => {
          const source = draft.commonChecks[family] || {};
          const scoped = outputCheckScope(source.scopeOutputIds);
          const status = scoped.includes(output.id) ? (source.statusByOutput?.[output.id] || source.status) : 'PENDIENTE';
          return { ...source, status };
        };
        const checks = {
          peso: { ...weight, result: weightResult(weight.netGrams, weight.quantity), status: 'MEDIDO', applicable: true },
          ciclo: { ...cycle, status: cycle.classification ? 'MEDIDO' : 'PENDIENTE', applicable: true },
          color: common('color'), inyeccion: common('inyeccion'), funcional: common('funcional'),
        };
        checksByPiece[pieceKey] = checks;
        pieceResults.push({ pieceKey, outputId: output.id, outputLabel: output.label, result: checks.peso.result, classification: weight.classification, scope: { color: checks.color.status, inyeccion: checks.inyeccion.status, funcional: checks.funcional.status } });
        const old = legacyRecords[pieceKey] || { key: pieceKey, otId, workId: selectedWork.workId, outputId: output.id, periodic: [] };
        const initialChecks = kind === 'INICIAL' ? checks : (old.initialChecks || old.checks || {});
        legacyRecords[pieceKey] = { ...old, checks: initialChecks, initialChecks, initialStatus: kind === 'INICIAL' ? (FAMILY_IDS.every(family => checks[family].status !== 'PENDIENTE') ? 'CONFIRMED' : 'PARTIAL') : old.initialStatus, periodic: kind === 'PERIODICA' ? [...(old.periodic || []).filter((row) => row.visitId !== id), { visitId: id, draft: false, checks }] : old.periodic };
      });
      const legacyVisit = { ...confirmedVisit, pieceKeys: Object.keys(checksByPiece), checks: checksByPiece, checksByPiece, pieceResults };
      const nextVisits = [...legacyVisits.filter((item) => !sameVisitIdentity(item, confirmedVisit, id)), legacyVisit];
      return { ...current, pieceQuality: { ...currentPieceQuality, workRecords: records, workVisits: [...currentPieceQuality.workVisits.filter((item) => !sameVisitIdentity(item, confirmedVisit, id)), confirmedVisit], visits: nextVisits, records: legacyRecords, incidents: [...(currentPieceQuality.incidents || []), ...incidentRows.filter((incident) => !(currentPieceQuality.incidents || []).some((previousIncident) => previousIncident.id === incident.id))] } };
      });
      return persisted;
    };
    const finishConfirmation = () => {
      justConfirmedRoute.current = routeOpenedRef.current;
      setDraft(null); setVisitId(''); setControlNumber(''); setDirty(false); setSaveMessage('Control confirmado. Las salidas cubiertas quedan visibles en el historial.');
      // Keep the explicitly observed work selected on the OT detail so a reload
      // or breadcrumb return cannot silently fall back to another color.
      onWorkVisitRoute?.({ workId: selectedWork.workId });
    };
    if (qualityVisitApi?.confirmVisit) {
      if (confirmingRef.current) return;
      confirmingRef.current = true;
      setConfirming(true);
      setSaveMessage('Guardando visita central…');
      const existing = visits.find((item) => item.id === id);
      // A direct click can beat the 700 ms draft debounce.  Flush that draft
      // first so the confirmation always targets the server's current visit.
      const flush = dirty ? syncDraftCentral({ ...visit, status: 'DRAFT', syncStatus: 'pending', version: existing?.version }) : draftFlushRef.current;
      Promise.resolve(flush).then((flushed) => {
        if (flushed === false) throw new Error('No se pudo guardar el borrador antes de confirmar.');
        const serverDraft = centralServerVisitsRef.current.get(id);
        const centralId = serverDraft?.id || id;
        const centralVersion = serverDraft?.version ?? existing?.version;
        const operationSignature = `${centralId}:${centralVersion ?? 'new'}`;
        let operationKey = confirmOperationKeysRef.current.get(operationSignature);
        if (!operationKey) {
          operationKey = createUuid();
          confirmOperationKeysRef.current.set(operationSignature, operationKey);
        }
        return qualityVisitApi.confirmVisit(otId, centralId, { version: centralVersion }, { idempotencyKey: operationKey });
      })
        .then((response) => {
          const remote = centralVisit(response?.item || response);
          const confirmedVisit = { ...visit, ...(remote || {}), id: remote?.id || id, status: 'CONFIRMED', syncStatus: 'synced' };
          const persisted = commitLocal(confirmedVisit);
          if (persisted === false) setSaveMessage('No se pudo confirmar el control local. Conserva el formulario y reintenta.');
          else finishConfirmation();
        })
        .catch((error) => {
          if (centralErrorStatus(error) === 409) setCentralConflict({ local: visit, remote: centralErrorVisit(error, otId), message: centralErrorText(error) });
          setSaveMessage(centralErrorText(error));
        })
        .finally(() => { confirmingRef.current = false; setConfirming(false); });
      return;
    }
    const persisted = commitLocal();
    if (persisted === false) { setSaveMessage('No se pudo confirmar el control. Conserva el formulario y reintenta.'); return; }
    finishConfirmation();
  };

  const selectWork = (work) => {
    if (!saveDraft()) return;
    const continueInForm = draft && onWorkVisitRoute && !(kind === 'INICIAL' && ensureWorkRecord(pieceQuality, work).initialStatus === 'CONFIRMED');
    routeOpenedRef.current = '';
    // Update the working row before navigating. The URL remains authoritative
    // after the route effect, but a fast “Registrar” click must not reuse the
    // previously active color during that transition.
    setSelectedWorkId(work.workId);
    setDraft(null); setVisitId(''); setControlNumber(''); setSaveMessage('');
    onWorkVisitRoute?.(continueInForm
      ? { workId: work.workId, kind, number: kind === 'PERIODICA' ? pendingNumber(work.workId) : 1 }
      : { workId: work.workId });
  };
  const cancelDraft = () => { if (saveDraft()) { setDraft(null); setVisitId(''); setControlNumber(''); setSaveMessage(''); onWorkVisitRoute?.({ workId: selectedWork?.workId }); } };
  const draftSaveFailed = Boolean(failedDraftRef.current) || saveMessage.startsWith('No se pudo guardar el borrador');
  const hasSavedDraft = saveMessage === 'Borrador guardado' || visits.some(v => v.id === visitId && v.status === 'DRAFT' && (!qualityVisitApi || v.syncStatus === 'synced'));
  const saveState = draftSaveFailed ? 'error' : dirty || centralSaving ? 'pending' : hasSavedDraft ? 'saved' : 'idle';
  const editorDisabled = Boolean(centralConflict) || confirming;
  const hasPeriodicDraft = visits.some(v => v.kind === 'PERIODICA' && v.workId === selectedWork?.workId && v.status === 'DRAFT');
  const workCaption = [selectedWork?.mouldLabel, selectedWork?.ofLabel].filter(Boolean).join(' · ');
  return <Stack spacing={1.5} data-testid="quality-work-station">
    {!draft && <>
      <QualityOtInspectionSummary
        summary={summary}
        selectedWorkId={selectedWorkId}
        onSelectWork={(workId) => {
          const work = works.find((candidate) => String(candidate.workId) === String(workId));
          if (work) selectWork(work);
        }}
      />
      {!selectedWork && <Alert severity="info">{activeWorks.length ? 'No hay un único trabajo activo. Elige el trabajo observado antes de registrar.' : 'No hay un único trabajo activo: ninguno está en ejecución. Elige el trabajo que observaste.'}</Alert>}
      {selectedWork && <>
        <ControlRow title="Control de arranque" ariaLabel="Registrar control de arranque" detail={startActionDetail()} disabled={initialBlocked} onOpen={() => begin('INICIAL')} />
        {initialDraftByOtherWork && works.find((work) => String(work.workId) === String(initialOtVisit.workId)) && <Button size="small" variant="text" onClick={() => selectWork(works.find((work) => String(work.workId) === String(initialOtVisit.workId)))}>
          Retomar arranque de {works.find((work) => String(work.workId) === String(initialOtVisit.workId))?.label}
        </Button>}
      </>}
      <CompletedPeriodics summary={summary} />
      {selectedWork && <ControlRow title={'Control #' + nextNumber} ariaLabel={(hasPeriodicDraft ? 'Continuar visita periódica #' : 'Registrar visita periódica #') + nextNumber} detail={periodicBlockedByQueue ? 'Trabajo en cola' : hasPeriodicDraft ? 'Continuar borrador' : 'Registrar'} disabled={periodicBlockedByQueue} onOpen={() => begin('PERIODICA')} />}
    </>}
    {centralConflict && <Alert severity="warning" action={<Stack direction="row" spacing={0.5}>
      {centralConflict.remote?.status !== 'CONFIRMED' && <Button size="small" onClick={keepMyEdition}>Conservar mi edición</Button>}
      <Button size="small" onClick={useSharedVersion}>{centralConflict.remote?.status === 'CONFIRMED' ? 'Descartar edición y ver confirmada' : 'Usar versión compartida'}</Button>
    </Stack>}>{saveMessage}<Typography component="span" display="block" variant="body2" sx={{ mt: 0.5 }}>{centralConflict.remote?.status === 'CONFIRMED' ? 'La versión confirmada es inmutable. Tu edición local queda visible solo para comparar y se descarta al consultar la confirmada.' : 'La edición local queda visible y bloqueada mientras decides. “Usar versión compartida” descarta esta edición pendiente. “Conservar mi edición” reaplica solo tus campos modificados.'}</Typography></Alert>}
    {selectedWork && draft && <Stack component="section" aria-label="Registro del trabajo" data-testid="quality-work-checks-panel" spacing={1.5}>
      <VisitHeader title={kind === 'PERIODICA' ? 'Control #' + nextNumber : 'Control de arranque'}
        confirmed={summary.header.periodicConfirmed} target={summary.header.periodicTarget} saveState={saveState} onBack={cancelDraft} />
      <TextField size="small" type="datetime-local" label="Momento observado" value={observedAt} disabled={editorDisabled} onChange={e => { setObservedAt(e.target.value); setSaveMessage(''); setDirty(true); }} slotProps={{ inputLabel: { shrink: true } }} sx={{ maxWidth: { sm: '20rem' } }} />
      <Stack direction="row" alignItems="center" data-testid="quality-selected-work" sx={{ minHeight: 40 }}>
        <ProductionColorLabel compact name={selectedWork.label} hex={selectedWork.work?.color_hex} />
      </Stack>
      <Paper variant="outlined" sx={{ p: 1.25, containerType: 'inline-size' }}>
        <Typography component="h2" variant="subtitle1" fontWeight={850}>{workCaption || selectedWork.label}</Typography>
        <WeightRows ot={mangaOt} work={selectedWork} checks={draft.outputChecks} disabled={editorDisabled} onChange={(id, patch) => updateDraft(cur => ({ ...cur, outputChecks: { ...cur.outputChecks, [id]: { ...cur.outputChecks[id], ...patch } } }))} />
        <CycleFamily ot={mangaOt} work={selectedWork} check={draft.commonChecks.ciclo} disabled={editorDisabled} onChange={(value) => updateDraft(cur => ({ ...cur, commonChecks: { ...cur.commonChecks, ciclo: { ...cur.commonChecks.ciclo, ...value } } }))} />
        {FAMILY_IDS.map(family => <CommonFamily key={family} ot={mangaOt} work={selectedWork} family={family} title={CHECK_LABELS[family]} check={draft.commonChecks[family]} disabled={editorDisabled} onChange={value => updateDraft(cur => ({ ...cur, commonChecks: { ...cur.commonChecks, [family]: { ...cur.commonChecks[family], ...value } } }))} />)}
      </Paper>
      <Button variant="contained" onClick={save} disabled={confirming || Boolean(centralConflict)} sx={{ alignSelf: 'flex-start', minHeight: 44 }}>{confirming ? 'Guardando visita…' : 'Guardar visita'}</Button>
    </Stack>}
    {saveMessage && saveMessage !== 'Borrador guardado' && !centralConflict && <Alert severity={saveMessage.startsWith('Control confirmado') ? 'success' : 'warning'}
      action={centralConflict
        ? <Stack direction="row" spacing={0.5}>
          <Button size="small" onClick={keepMyEdition}>Conservar mi edición</Button>
          <Button size="small" onClick={useSharedVersion}>Usar versión compartida</Button>
        </Stack>
        : draftSaveFailed && <Button size="small" onClick={retryDraft}>Reintentar guardado</Button>}>{saveMessage}{centralConflict && <Typography component="span" display="block" variant="body2" sx={{ mt: 0.5 }}>Tus datos locales siguen visibles. “Usar versión compartida” descarta esta edición pendiente. “Conservar mi edición” reaplica solo tus campos modificados.</Typography>}</Alert>}
  </Stack>;
}

export { mergeCentralVisits };

