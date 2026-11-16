import QualityStationBreadcrumbs from './QualityStationBreadcrumbs';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Divider, FormControl, IconButton, InputLabel,
  Link as MuiLink, Menu, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import MoreVertOutlinedIcon from '@mui/icons-material/MoreVertOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { obtenerMoldes } from '../services/api';
import { listarJornadasPlantaScm, obtenerOtScm } from '../services/scmOtApi';
import { qualityVisitApi } from '../services/qualityVisitApi';
import { todayInLima } from '../utils/limaDate';
import { sharedReportRows } from './qualitySharedReport';
import { ensurePieceQuality, ensurePieceRecord, normalizePieceRows, pieceCompletion } from './qualityPieceModel';
import { unavailableMachineIds } from '../hooks/useMachineShiftAvailability';
import { hydrateQualityJourneyMolds, hydrateQualityOt } from './qualityHydrateOt';
import { COLOR_INCIDENT_OPTIONS, FUNCTIONAL_INCIDENT_OPTIONS, INJECTION_INCIDENT_OPTIONS } from './qualityIncidentOptions';
import QualityOtInspectionSummary from './QualityOtInspectionSummary.jsx';

// The station owns data capture. Keeping it lazy leaves the report as a small,
// read-only surface and lets the station bundle load only on demand.
const QualityPieceStation = lazy(() => import('./QualityPieceStation'));

const DEFAULT_SHIFT = 'DIA';
const EMPTY_ARRAY = [];
const findings = { color: COLOR_INCIDENT_OPTIONS, inyeccion: INJECTION_INCIDENT_OPTIONS, funcional: FUNCTIONAL_INCIDENT_OPTIONS };
const STORAGE_VERSION = 1;
const today = todayInLima;
const label = (value, fallback = 'No informado') => value == null || value === '' ? fallback : String(value).replaceAll('_', ' ');
const idOf = (item) => item?.public_id || item?.id || item?.codigo || '';
const workRows = (ot) => (Array.isArray(ot?.trabajos_color) ? ot.trabajos_color
  : Array.isArray(ot?.trabajos_color_resumen) ? ot.trabajos_color_resumen : [])
  .concat(ot?.trabajo_color_contexto ? [ot.trabajo_color_contexto] : []);
const outputRows = (work) => work?.articulos_salida || work?.salidas || work?.salidas_produccion
  || work?.salidas_color || work?.salidas_pieza || [];
const outputId = (output, index) => idOf(output) || output?.pieza_id || output?.articulo_id || `salida-${index + 1}`;
const outputName = (output, index) => output?.pieza?.nombre || output?.articulo?.nombre || output?.nombre
  || output?.pieza?.codigo || output?.articulo?.codigo || `Salida ${index + 1}`;
const machineIdentity = (ot) => String(ot?.maquina_id || ot?.maquina?.id || ot?.maquina_codigo || ot?.maquina?.codigo || 'sin-maquina');
const machineName = (ot, machines = []) => {
  const machineId = ot?.maquina_id || ot?.maquina?.id;
  const catalog = machines.find((item) => (machineId && String(item.id) === String(machineId))
    || (ot?.maquina_codigo && String(item.codigo) === String(ot.maquina_codigo)));
  return catalog?.nombre || ot?.maquina_nombre
    || (typeof ot?.maquina === 'string' ? ot.maquina : ot?.maquina?.nombre)
    || 'Máquina sin nombre';
};
const machineCode = (ot, machines = []) => {
  const machineId = ot?.maquina_id || ot?.maquina?.id;
  const catalog = machines.find((item) => (machineId && String(item.id) === String(machineId))
    || (ot?.maquina_codigo && String(item.codigo) === String(ot.maquina_codigo)));
  return ot?.maquina_codigo || ot?.maquina?.codigo || catalog?.codigo || machineId || '';
};
const normalizeSearch = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const shiftLabel = (value) => ({ DIA: 'Día', NOCHE: 'Noche', EXTRA: 'Extra' }[String(value || '').toUpperCase()] || label(value));
const shiftFromSearch = (value) => {
  const query = normalizeSearch(value);
  if (query === 'dia' || query.includes(' dia ')) return 'DIA';
  if (query === 'noche' || query.includes(' noche ')) return 'NOCHE';
  if (query === 'extra' || query.includes(' extra ')) return 'EXTRA';
  return '';
};
const machineSearchText = (ot, machines = []) => [
  machineName(ot, machines), machineCode(ot, machines), machineIdentity(ot),
].map(normalizeSearch).join(' ');
const matchesOtCode = (ot, query) => {
  const code = normalizeSearch(ot.codigo_ot);
  if (!code || !query) return false;
  if (code.includes(query)) return true;
  const number = query.match(/^(?:ot[-\s]*)?(\d+)$/)?.[1];
  return Boolean(number && code.replace(/^ot[-\s]*0*/, '') === number.replace(/^0+(?=\d)/, ''));
};
const machineChoiceSearchText = (choice) => [choice.label, choice.code, choice.id].map(normalizeSearch).join(' ');
const detailForContext = (detail, { otId, date, shift }) => {
  if (!detail || String(idOf(detail)) !== String(otId)) throw new Error('OT inesperada');
  if (String(detail.fecha_operativa || '') !== String(date)
    || String(detail.turno || '').toUpperCase() !== String(shift || '').toUpperCase()) {
    throw new Error('La OT no pertenece a la fecha y turno consultados.');
  }
  return detail;
};
const payloadItems = (payload) => {
  if (Array.isArray(payload)) return payload;
  return payload?.ots_fabricacion || payload?.items || payload?.ots || payload?.all || [];
};
const payloadMachines = (payload) => (Array.isArray(payload?.maquinas) ? payload.maquinas : []);
const emptyLocalState = () => ({ controls: {}, visits: [], incidents: [], periodic: {}, activeWork: {} });
const readStorage = (key) => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || 'null');
    return parsed?.version === STORAGE_VERSION ? parsed : null;
  } catch { return null; }
};
const writeStorage = (key, state) => {
  try {
    window.localStorage.setItem(key, JSON.stringify({ version: STORAGE_VERSION, ...state }));
    return true;
  } catch {
    return false;
  }
};
const controlFor = (state, work, output, index) => state?.controls?.[`${idOf(work)}:${outputId(output, index)}`] || {};

const eligibleWork = (work) => !['PLANIFICADA', 'ANULADA', 'CANCELADA', 'CANCELADO'].includes(String(work?.estado || '').toUpperCase());
const hasPieceQuality = (state) => state?.pieceQuality?.version === 1;
const qualityProjection = (state, ot, moldCatalog = []) => {
  const pieceQuality = ensurePieceQuality(state);
  const shared = sharedReportRows(idOf(ot), ot?.visitas_calidad);
  const pieces = normalizePieceRows(ot, moldCatalog).filter((piece) => {
    const work = workRows(ot).find((candidate) => String(idOf(candidate)) === String(piece.workId));
    return eligibleWork(work);
  });
  const records = Object.fromEntries(pieces.map((piece) => [piece.key, ensurePieceRecord(pieceQuality, piece)]));
  Object.assign(records, shared.records);
  const legacy = !hasPieceQuality(state) && !shared.rows.length;
  const visits = [...new Map([...(state?.visits || []), ...pieceQuality.visits, ...shared.rows].map((visit, index) => [visit.id || `${visit.otId}:${visit.recordedAt || index}`, visit])).values()]
    .sort((left, right) => (Date.parse(left.recordedAt) || 0) - (Date.parse(right.recordedAt) || 0));
  const incidents = [...new Map([...shared.incidents, ...(state?.incidents || []), ...pieceQuality.incidents].map((incident, index) => [incident.id || `${incident.otId}:${incident.createdAt || index}`, incident])).values()];
  const quota = legacy ? state?.periodic?.[idOf(ot)]?.quota : pieceQuality.periodicQuotaByOt?.[idOf(ot)];
  return { pieceQuality, pieces, records, visits, incidents, quota: quota ?? '', legacy, legacyControls: state?.controls || {} };
};
const pieceForOutput = (projection, work, output, index) => projection.pieces.find((piece) => (
  String(piece.workId) === String(idOf(work)) && String(piece.outputId) === String(outputId(output, index))
));
const pieceRecord = (projection, work, output, index) => {
  const piece = pieceForOutput(projection, work, output, index);
  if (projection.legacy) return { piece: null, record: controlFor({ controls: projection?.legacyControls || {} }, work, output, index) };
  if (piece) {
    const record = projection.records[piece.key];
    const legacy = controlFor({ controls: projection?.legacyControls || {} }, work, output, index);
    return { piece, record: record?.checks && Object.values(record.checks).some((check) => check?.status && check.status !== 'PENDIENTE') ? record : { ...record, ...legacy, checks: record.checks } };
  }
  return { piece: null, record: controlFor({ controls: {} }, work, output, index) };
};
const latestResultFor = (visits, piece, output, index, fallback) => {
  const latest = [...visits].reverse().find((visit) => visitHasPiece(visit, piece, output, index));
  const pieceResult = latest?.checks?.[piece?.key]?.peso?.result;
  const legacyResult = (latest?.samples || []).find((sample) => String(sample.outputId) === String(outputId(output, index)))?.result;
  return pieceResult ?? legacyResult ?? fallback;
};
const visitHasPiece = (visit, piece, output, index) => {
  if (piece && Array.isArray(visit?.pieceKeys)) return visit.pieceKeys.includes(piece.key);
  return (visit?.samples || []).some((sample) => String(sample.outputId) === String(outputId(output, index)));
};
function Metric({ value, label: metricLabel, tone = 'default' }) {
  return <Box sx={{ minWidth: 76 }}><Typography variant="h6" fontWeight={800} color={tone === 'warning' ? 'warning.dark' : 'text.primary'}>{value}</Typography><Typography variant="caption" color="text.secondary">{metricLabel}</Typography></Box>;
}

function ActionsMenu({ ot, onOpenStation, search = '' }) {
  const [anchor, setAnchor] = useState(null);
  const otId = encodeURIComponent(idOf(ot));
  const stationPath = `/calidad/estacion/ots/${otId}${search}`;
  return <>
    <IconButton size="small" aria-label={`Más acciones de ${ot?.codigo_ot || 'OT'}`} aria-haspopup="menu" aria-expanded={Boolean(anchor)} onClick={(event) => setAnchor(event.currentTarget)}><MoreVertOutlinedIcon /></IconButton>
    <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
      <MenuItem component={RouterLink} to={stationPath} onClick={() => { setAnchor(null); onOpenStation?.(idOf(ot)); }}>Abrir estación de Calidad</MenuItem>
      <MenuItem component={RouterLink} to={`/calidad/reporte/ots/${otId}${search}`} onClick={() => setAnchor(null)}>Abrir informe de OT</MenuItem>
    </Menu>
  </>;
}

const machineGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 18rem), 1fr))', gap: 1.25 };

function SummaryCard({ summary, onOpenOt, onOpenStation, stationEntry = false, search = '', localState, moldCatalog = [] }) {
  const { ot, machines } = summary;
  const otId = idOf(ot);
  return <Card variant="outlined" data-testid={`calidad-report-ot-${otId}`} sx={{ height: '100%' }}><CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}><Box sx={{ minWidth: 0 }}>
      <Typography variant="subtitle1" fontWeight={850} noWrap>{machineName(ot, machines)}</Typography>
      <MuiLink component={RouterLink}
        to={`/calidad/${stationEntry ? 'estacion' : 'reporte'}/ots/${encodeURIComponent(otId)}${search}`}
        onClick={e => { if (!stationEntry && onOpenOt && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); onOpenOt(otId); } }}
        underline="hover" variant={stationEntry ? 'body2' : 'inherit'} fontWeight={stationEntry ? 500 : 750}>
        {ot?.codigo_ot || otId || 'OT no informada'}
      </MuiLink>
      {(!stationEntry || ot?.estado !== 'EN_EJECUCION') && <Typography variant="caption" color="text.secondary" display="block">{label(ot?.estado)}</Typography>}
    </Box><ActionsMenu ot={ot} onOpenStation={onOpenStation} search={search} /></Stack>
    <QualityOtInspectionSummary
      ot={ot}
      quality={localState}
      moldCatalog={moldCatalog}
      compact
      pendingOnly
      showDetails
      ariaLabel="Inspecciones de la OT"
    />
    {stationEntry && <Button size="small" variant="outlined" onClick={() => onOpenStation?.(otId)} sx={{ mt: 1.25 }}>Seleccionar OT</Button>}
  </CardContent></Card>;
}

function OtReport({ ot, assemblyOts, moldCatalog, localState, setLocalState, machines, date, shift, search = '', onBack, onOpenStation, onRefresh, loading, optionalCoverage = false }) {
  const otId = idOf(ot);
  const works = workRows(ot);
  const projection = qualityProjection(localState, ot, moldCatalog);
  const visits = projection.visits.filter((visit) => visit.status === 'CONFIRMED' && String(visit.otId) === String(otId));
  const incidents = projection.incidents.filter((incident) => String(incident.otId) === String(otId) && incident.status !== 'CERRADA');
  const eligibleWorks = works.filter(eligibleWork);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const stationPath = `/calidad/estacion/ots/${encodeURIComponent(otId)}${search}`;
  const goStation = () => { setMenuAnchor(null); onOpenStation?.(otId); };
  // The report is a read model. The station receives the setter; this view never calls it.
  void assemblyOts; void moldCatalog; void setLocalState;
  return <Stack spacing={1.5} sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 1, md: 2 } }} data-testid="calidad-ot-report">
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}><Box><Typography component="h1" variant="h5" fontWeight={850}>Informe de OT</Typography><Typography variant="body2" color="text.secondary">{ot?.codigo_ot || otId} · {machineName(ot, machines)} · {date} · {label(shift)}</Typography></Box>
      <Stack direction="row" spacing={0.5} alignItems="center"><Button size="small" variant="outlined" onClick={() => onBack?.({ date, shift, machine: machineIdentity(ot) })}>Volver al reporte</Button><IconButton aria-label={`Más acciones de ${ot?.codigo_ot || 'OT'}`} onClick={(event) => setMenuAnchor(event.currentTarget)}><MoreVertOutlinedIcon /></IconButton><Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}><MenuItem component={RouterLink} to={stationPath} onClick={goStation}>Abrir estación de Calidad</MenuItem><MenuItem component={RouterLink} to={`/calidad/reporte/ots/${encodeURIComponent(otId)}${search}`} onClick={() => setMenuAnchor(null)}>Copiar contexto del informe</MenuItem></Menu><Button size="small" variant="outlined" startIcon={<RefreshOutlinedIcon />} onClick={onRefresh} disabled={loading}>Actualizar</Button></Stack>
    </Stack>
    <Alert severity="info">Informe de solo lectura. Los controles se registran únicamente desde Estación de Calidad.</Alert>
    <Paper variant="outlined" sx={{ p: 1.5 }}><Stack direction="row" flexWrap="wrap" gap={2}><Metric value={incidents.length} label="incidencias abiertas" tone={incidents.length ? 'warning' : 'default'} /><MuiLink component={RouterLink} to={stationPath} sx={{ alignSelf: 'center' }}>Abrir OT en estación <OpenInNewOutlinedIcon fontSize="inherit" sx={{ verticalAlign: 'middle' }} /></MuiLink></Stack>{optionalCoverage && <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>Noche: registro voluntario; sin cuota predeterminada ni alerta por falta de cobertura.</Typography>}</Paper>
    <QualityOtInspectionSummary ot={ot} quality={localState} moldCatalog={moldCatalog} />
     <Paper variant="outlined" sx={{ p: { xs: 1, md: 1.5 }, overflowX: 'auto' }}><Typography component="h2" variant="h6" fontWeight={800} sx={{ mb: 1 }}>Controles anteriores</Typography>{eligibleWorks.length === 0 ? <Alert severity="warning">Esta OT no tiene trabajos informados.</Alert> : <Table size="small" aria-label="Controles anteriores de la OT"><TableHead><TableRow><TableCell>Trabajo</TableCell><TableCell>Salida</TableCell><TableCell>Control de arranque</TableCell><TableCell>Muestras</TableCell><TableCell>Último resultado</TableCell></TableRow></TableHead><TableBody>{eligibleWorks.flatMap((work) => outputRows(work).map((output, index) => { const { piece, record } = pieceRecord(projection, work, output, index); const legacyControl = record?.done ? { complete: true, completed: 1, total: 1 } : pieceCompletion(record); const completion = piece ? pieceCompletion(record) : legacyControl; const pieceVisits = visits.filter((visit) => visit.workId === idOf(work) && visitHasPiece(visit, piece, output, index)); const result = latestResultFor(visits.filter((visit) => visit.workId === idOf(work)), piece, output, index, record?.checks?.peso?.result); const status = completion.complete ? 'Realizado' : completion.completed > 0 ? 'Parcial' : 'Pendiente'; return <TableRow key={`${idOf(work)}:${outputId(output, index)}`}><TableCell>{work?.color || work?.nombre || 'Trabajo sin color'}</TableCell><TableCell>{outputName(output, index)}</TableCell><TableCell><Chip size="small" label={status} color={completion.complete ? 'success' : completion.completed > 0 ? 'warning' : 'default'} /></TableCell><TableCell>{pieceVisits.length}</TableCell><TableCell>{result != null ? `${result} g/pieza` : 'Sin muestra'}</TableCell></TableRow>; }))}</TableBody></Table>}</Paper>
    {incidents.length > 0 && <Paper component="section" aria-labelledby="quality-open-incidents" variant="outlined" sx={{ p: 1.5 }}>
      <Typography id="quality-open-incidents" component="h2" variant="h6" fontWeight={800}>Incidencias abiertas</Typography>
      <Stack divider={<Divider flexItem />} spacing={1} sx={{ mt: 1 }}>
        {incidents.map((incident) => {
          const ids = new Set((incident.scopeOutputIds || incident.outputIds || [incident.outputId]).map(String));
          const affected = projection.pieces.filter((piece) => String(piece.workId) === String(incident.workId)
            && (piece.key === incident.pieceKey || ids.has(String(piece.outputId))));
          return <Box key={incident.id}>
            <Typography fontWeight={750}>{incident.type || 'Incidencia'}</Typography>
            {incident.incidentOptions?.length > 0 && <Typography variant="body2">{incident.incidentOptions.map(code =>
              code === 'OTROS' && incident.otherText ? incident.otherText : (findings[incident.checkId]?.find(option => option.value === code)?.label || code)
            ).join(' · ')}</Typography>}
            {affected.length > 0 && <Typography variant="body2">{affected.map((piece) => piece.outputLabel).join(' · ')}</Typography>}
            {incident.affectedMangas?.length > 0 && <Typography variant="body2">Mangas afectadas: {incident.affectedMangas.map((manga) => manga.code).join(' · ')}</Typography>}
            {incident.description && <Typography variant="body2" color="text.secondary">{incident.description}</Typography>}
          </Box>;
        })}
      </Stack>
    </Paper>}
  </Stack>;
}

function StationView({ ot, assemblyOts, moldCatalog, localState, setLocalState, machines, onBack, centralQuality = false }) {
  const concurrentAssemblyOts = Array.isArray(ot?.ots_armado) ? ot.ots_armado : assemblyOts;
  return <Suspense fallback={<Paper variant="outlined" sx={{ m: 2, p: 3 }}><Typography color="text.secondary">Cargando estación de Calidad…</Typography></Paper>}>
    <QualityPieceStation ot={ot} assemblyOts={concurrentAssemblyOts} moldCatalog={moldCatalog}
      localState={localState} setLocalState={setLocalState} onBack={onBack} machineLabel={machineName(ot, machines)}
      qualityVisitApi={centralQuality || Array.isArray(ot?.visitas_calidad) ? qualityVisitApi : undefined}
      centralQuality={centralQuality} />
  </Suspense>;
}

export default function CalidadProcesoScm({
  ots: providedOts, machines: providedMachines = EMPTY_ARRAY, initialDate = '', initialShift = DEFAULT_SHIFT,
  initialMachine = 'TODAS', view = 'board', otId = '', restorePosition = 0, onOpenOt, onOpenStation,
  onBack, onFiltersChange, readOts, initialOt = null, storagePrefix = 'enva-calidad-proceso', localState: controlledLocalState,
  setLocalState: controlledSetLocalState, centralQuality = false,
}) {
  const [date, setDate] = useState(initialDate || today());
  const [shift, setShift] = useState(initialShift || DEFAULT_SHIFT);
  const [machineFilter, setMachineFilter] = useState(initialMachine || 'TODAS');
  const [machineSearch, setMachineSearch] = useState('');
  const [debouncedMachineSearch, setDebouncedMachineSearch] = useState('');
  const [ots, setOts] = useState(Array.isArray(providedOts) ? providedOts : []);
  const [assemblyOts, setAssemblyOts] = useState([]);
  const [machines, setMachines] = useState(providedMachines);
  const [loading, setLoading] = useState(!Array.isArray(providedOts));
  const [loaded, setLoaded] = useState(Array.isArray(providedOts));
  const [error, setError] = useState('');
  const [localState, setLocalState] = useState(() => (centralQuality ? emptyLocalState() : readStorage(storagePrefix) || emptyLocalState()));
  const [moldCatalog, setMoldCatalog] = useState([]);
  const [stationOt, setStationOt] = useState(() => initialOt
    && String(idOf(initialOt)) === String(otId)
    && String(initialOt.fecha_operativa) === String(initialDate || today())
    && String(initialOt.turno).toUpperCase() === String(initialShift || DEFAULT_SHIFT).toUpperCase()
    ? initialOt : null);
  const [stationError, setStationError] = useState('');
  const [stationRetry, setStationRetry] = useState(0);
  // Injected/local callers historically passed a complete OT. Keep that
  // read-only path immediately renderable; live routes start empty and read
  // only the requested OT below.
  const [reportOt, setReportOt] = useState(() => initialOt
    && String(idOf(initialOt)) === String(otId)
    && String(initialOt.fecha_operativa) === String(initialDate || today())
    && String(initialOt.turno).toUpperCase() === String(initialShift || DEFAULT_SHIFT).toUpperCase()
    ? initialOt
    : Array.isArray(providedOts)
      ? providedOts.find((candidate) => String(idOf(candidate)) === String(otId)) || null
    : null);
  const [reportError, setReportError] = useState('');
  const [reportRetry, setReportRetry] = useState(0);
  const machineFilterSourceRef = useRef(initialMachine && initialMachine !== 'TODAS' ? 'link' : 'none');
  const requestRef = useRef(0);
  const journeyAbortRef = useRef(null);
  const journeyLoadKeyRef = useRef('');
  const journeyOrderCacheRef = useRef(new Map());
  const journeyOrderPendingRef = useRef(new Map());
  const moldCatalogRef = useRef([]);
  const currentLocalState = controlledLocalState || localState;
  const localStateRef = useRef(currentLocalState);
  const persistLocalState = useCallback((next) => centralQuality || writeStorage(storagePrefix, next), [centralQuality, storagePrefix]);
  useEffect(() => { localStateRef.current = currentLocalState; }, [currentLocalState]);
  const updateLocalState = useCallback((updater) => {
    if (controlledSetLocalState || controlledLocalState) return controlledSetLocalState?.(updater);
    const next = typeof updater === 'function' ? updater(localStateRef.current) : updater;
    if (!persistLocalState(next)) return false;
    localStateRef.current = next;
    setLocalState(next);
    return true;
  }, [controlledLocalState, controlledSetLocalState, persistLocalState]);
  useEffect(() => { moldCatalogRef.current = moldCatalog; }, [moldCatalog]);
  const isStation = view === 'station';
  const isStationLanding = view === 'station-board';
  const isSheet = view === 'sheet';
  // Availability belongs to the jornada board. A detail sheet must stay scoped
  // to its OT and must not start the 3 s polling stream.
  const [unavailableIds, setUnavailableIds] = useState([]);
  const isOff = useCallback((id) => unavailableIds.includes(String(id)), [unavailableIds]);
  const load = useCallback(async ({ force = false } = {}) => {
    if (isStation || isSheet) return;
    const loadKey = [date, shift, readOts ? 'reader' : 'api', Array.isArray(providedOts) ? 'provided' : 'remote'].join('|');
    // React StrictMode mounts effects twice in development. Reuse the active
    // read for the same board scope; explicit refresh passes force=true.
    if (!force && journeyLoadKeyRef.current === loadKey && journeyAbortRef.current && !journeyAbortRef.current.signal.aborted) return;
    journeyLoadKeyRef.current = loadKey;
    const requestId = ++requestRef.current;
    journeyAbortRef.current?.abort();
    const controller = new AbortController();
    journeyAbortRef.current = controller;
    setError('');
    try {
      if (Array.isArray(providedOts)) {
        setOts(providedOts); setMachines(providedMachines); setLoaded(true); setLoading(false);
        const hydrated = await hydrateQualityJourneyMolds(providedOts, {
          cache: journeyOrderCacheRef.current,
          pending: journeyOrderPendingRef.current,
          moldCatalog: moldCatalogRef.current,
          signal: controller.signal,
        });
        if (requestId !== requestRef.current) return;
        setOts(hydrated); setError('');
        return;
      }
      setLoading(true);
      const payload = readOts
        ? await readOts({ fecha_operativa: date, turno: shift, vista: 'calidad', signal: controller.signal })
        : await listarJornadasPlantaScm({ fecha_operativa: date, turno: shift, vista: 'calidad', signal: controller.signal });
      if (requestId !== requestRef.current) return;
      const nextOts = payloadItems(payload);
      if (requestId !== requestRef.current) return;
      setOts(nextOts); setAssemblyOts(payload?.ots_armado || []); setMachines(payloadMachines(payload).length ? payloadMachines(payload) : providedMachines); setUnavailableIds(unavailableMachineIds(payload)); setLoaded(true);
    } catch (loadError) { if (requestId !== requestRef.current) return; setOts([]); setMachines([]); setAssemblyOts([]); setLoaded(false); setError(loadError?.message || 'No se pudo cargar el reporte de Calidad.'); } finally { if (requestId === requestRef.current) setLoading(false); }
  }, [date, isSheet, isStation, providedMachines, providedOts, readOts, shift]);
  useEffect(() => {
    if (isStation || isSheet) {
      setLoaded(true);
      setLoading(false);
      return undefined;
    }
    load();
    return undefined;
  }, [isSheet, isStation, load]);
  useEffect(() => { setMachineFilter(initialMachine || 'TODAS'); }, [initialMachine]);
  // The calidad endpoints already return the mold references needed by this
  // surface. Keep the catalog read only for injected/local fixtures that still
  // exercise the legacy hydration helper.
  useEffect(() => {
    if (Array.isArray(providedOts) || readOts) {
      Promise.resolve(obtenerMoldes()).then((value) => setMoldCatalog(Array.isArray(value) ? value : [])).catch(() => {});
    }
  }, [providedOts, readOts]);
  useEffect(() => { if (!isStation && !isSheet && !isStationLanding && loaded && Number(restorePosition) > 0) { const timer = window.setTimeout(() => window.scrollTo(0, Number(restorePosition)), 0); return () => window.clearTimeout(timer); } return undefined; }, [isSheet, isStation, isStationLanding, loaded, restorePosition]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedMachineSearch(machineSearch), 300);
    return () => window.clearTimeout(timer);
  }, [machineSearch]);
  const machineChoices = useMemo(() => {
    const fromOts = ots.map((ot) => ({ id: machineIdentity(ot), label: machineName(ot, machines), code: machineCode(ot, machines) }));
    const fromCatalog = machines.map((item) => ({ id: String(item.id || item.codigo), label: item.nombre || 'Máquina sin nombre', code: item.codigo || '' }));
    return [...new Map([...fromCatalog, ...fromOts].map((item) => [item.id, item])).values()].sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [machines, ots]);
  const searchShift = shiftFromSearch(debouncedMachineSearch);
  const machineQuery = useMemo(() => normalizeSearch(debouncedMachineSearch)
    .replace(/\b(dia|noche|extra)\b/g, '').replace(/\s+/g, ' ').trim(), [debouncedMachineSearch]);
  const machineSearchMatches = useCallback((ot) => {
    const shiftMatches = !searchShift || String(ot?.turno || shift).toUpperCase() === searchShift;
    const machineMatches = !machineQuery || machineSearchText(ot, machines).includes(machineQuery);
    return shiftMatches && (machineMatches || matchesOtCode(ot, machineQuery));
  }, [machineQuery, machines, searchShift, shift]);
  const updateFilters = useCallback((next) => {
    if (next.date != null) setDate(next.date);
    if (next.shift != null) setShift(next.shift);
    if (next.machine != null) setMachineFilter(next.machine);
    onFiltersChange?.({ date: next.date ?? date, shift: next.shift ?? shift, machine: next.machine ?? machineFilter });
  }, [date, machineFilter, onFiltersChange, shift]);
  useEffect(() => {
    if (!machineQuery && !searchShift) {
      if (machineFilterSourceRef.current === 'search' && machineFilter !== 'TODAS') {
        machineFilterSourceRef.current = 'none';
        setMachineFilter('TODAS');
        onFiltersChange?.({ date, shift, machine: 'TODAS' });
      }
      return;
    }
    const otMachines = new Set(ots.filter(ot => matchesOtCode(ot, machineQuery)).map(machineIdentity));
    const matches = machineChoices.filter(choice => machineChoiceSearchText(choice).includes(machineQuery) || otMachines.has(choice.id));
    const nextShift = searchShift || shift;
    let nextMachine = machineFilter;
    if (machineQuery && machineFilterSourceRef.current !== 'link') {
      if (matches.length === 1) {
        nextMachine = matches[0].id;
        machineFilterSourceRef.current = 'search';
      } else if (machineFilterSourceRef.current === 'search') {
        nextMachine = 'TODAS';
        machineFilterSourceRef.current = 'none';
      }
    }
    const shiftChanged = nextShift !== shift;
    const machineChanged = nextMachine !== machineFilter;
    if (!shiftChanged && !machineChanged) return;
    if (shiftChanged) setShift(nextShift);
    if (machineChanged) setMachineFilter(nextMachine);
    onFiltersChange?.({ date, shift: nextShift, machine: nextMachine });
  }, [date, machineFilter, machineQuery, machineChoices, ots, onFiltersChange, searchShift, shift]);
  const scopedOts = useMemo(() => ots.filter((ot) => {
    const sameDate = !ot?.fecha_operativa || String(ot.fecha_operativa) === String(date);
    const sameShift = !ot?.turno || String(ot.turno).toUpperCase() === String(shift).toUpperCase();
    return sameDate && sameShift;
  }), [date, ots, shift]);
  const visibleOts = useMemo(() => scopedOts.filter((ot) => (machineFilter === 'TODAS' || machineIdentity(ot) === machineFilter) && machineSearchMatches(ot)), [machineFilter, machineSearchMatches, scopedOts]);
  const selectedOt = (isSheet || isStation) ? (isStation ? stationOt : reportOt) : null;
  useEffect(() => {
    if (!isStation) { setStationOt(null); setStationError(''); return undefined; }
    let active = true;
    const controller = new AbortController();
    setStationError('');
    if (!initialOt) setStationOt(null);
    const options = { signal: controller.signal, vista: 'calidad' };
    async function loadStationOt() {
      if (Array.isArray(providedOts) && !readOts) {
        return detailForContext(providedOts.find((candidate) => String(idOf(candidate)) === String(otId)), { otId, date, shift });
      }
      if (initialOt && String(idOf(initialOt)) === String(otId)) return detailForContext(initialOt, { otId, date, shift });
      const response = await obtenerOtScm(otId, options);
      const detail = detailForContext(response?.ot || response || providedOts?.find((candidate) => String(idOf(candidate)) === String(otId)), { otId, date, shift });
      // Explicit fixture readers may still provide the pre-quality contract;
      // the live endpoint is already enriched and must not fan out to OFs.
      return (Array.isArray(providedOts) || readOts)
        ? hydrateQualityOt({ ...detail }, options)
        : detail;
    }
    loadStationOt().then((enriched) => {
      if (active) setStationOt(enriched);
    }).catch((loadError) => {
      if (active) setStationError(loadError?.message || 'No se pudo leer el detalle de la OF.');
    });
    return () => { active = false; controller.abort(); };
  }, [date, initialOt, isStation, otId, providedOts, readOts, shift, stationRetry]);
  const loadCentralReportOt = useCallback(async (detail, signal) => {
    if (!centralQuality || !detail || !qualityVisitApi?.loadVisits) return detail;
    const response = await qualityVisitApi.loadVisits(idOf(detail) || otId, { signal });
    if (signal.aborted) return detail;
    const items = Array.isArray(response) ? response : response?.items || [];
    return { ...detail, visitas_calidad: items };
  }, [centralQuality, otId, qualityVisitApi]);
  useEffect(() => {
    if (!isSheet) { setReportOt(null); setReportError(''); return undefined; }
    let active = true;
    const controller = new AbortController();
    if (!initialOt && !Array.isArray(providedOts)) setReportOt(null);
    setReportError('');
    async function loadReportOt() {
      const options = { signal: controller.signal, vista: 'calidad' };
      if (Array.isArray(providedOts) && !readOts) {
        return detailForContext(providedOts.find((candidate) => String(idOf(candidate)) === String(otId)), { otId, date, shift });
      }
      if (initialOt && String(idOf(initialOt)) === String(otId)) return detailForContext(initialOt, { otId, date, shift });
      const response = await obtenerOtScm(otId, options);
      const detail = detailForContext(response?.ot || response || providedOts?.find((candidate) => String(idOf(candidate)) === String(otId)), { otId, date, shift });
      const hydrated = (Array.isArray(providedOts) || readOts)
        ? await hydrateQualityOt({ ...detail }, options)
        : detail;
      return loadCentralReportOt(hydrated, controller.signal);
    }
    loadReportOt().then((enriched) => {
      if (active) setReportOt(enriched);
    }).catch((loadError) => {
      if (active && loadError?.name !== 'AbortError') setReportError(loadError?.message || 'No se pudo hidratar el detalle de la OT.');
    });
    return () => { active = false; controller.abort(); };
  }, [date, initialOt, isSheet, loadCentralReportOt, otId, providedOts, readOts, reportRetry, shift]);
  const refreshDetail = useCallback(() => {
    if (isStation) setStationRetry((attempt) => attempt + 1);
    if (isSheet) setReportRetry((attempt) => attempt + 1);
  }, [isSheet, isStation]);
  const filterSearch = `?${new URLSearchParams({ fecha: date, turno: shift, ...(machineFilter !== 'TODAS' ? { maquina: machineFilter } : {}) }).toString()}`;
  const optionalCoverage = String(shift).toUpperCase() === 'NOCHE';
  const summaryCards = visibleOts.map((ot) => {
    return {
      ot,
      machines,
    };
  });
  const partialMoldRead = ots.some((ot) => workRows(ot).some((work) => work?.moldLoadFailed));
  const emptyMachineChoices = machineChoices.filter((machine) => (machineFilter === 'TODAS' || machine.id === machineFilter) && (!machineQuery || machineChoiceSearchText(machine).includes(machineQuery))).filter((machine) => !scopedOts.some((ot) => machineIdentity(ot) === machine.id));
  if (isStation) {
    if (selectedOt && stationOt && String(idOf(stationOt)) === String(otId)) return <StationView ot={stationOt} assemblyOts={assemblyOts} moldCatalog={moldCatalog} localState={currentLocalState} setLocalState={updateLocalState} machines={machines} onBack={onBack} centralQuality={centralQuality} />;
    const missingOt = (Array.isArray(providedOts) && !providedOts.some((candidate) => String(idOf(candidate)) === String(otId))) || (!otId && loaded && !loading);
    return <Stack spacing={1.5} sx={{ p: { xs: 1, md: 2 } }}>
      <QualityStationBreadcrumbs trail={[[ 'Control de Calidad', { pathname: '/calidad/estacion', search: filterSearch } ], [selectedOt?.codigo_ot || 'OT']]} />
      {error || stationError ? <Alert severity="error" action={<Button color="inherit" size="small" onClick={stationError ? () => setStationRetry((attempt) => attempt + 1) : () => load({ force: true })}>Reintentar lectura</Button>}>
        {stationError ? `No se pudo verificar el detalle del trabajo y sus salidas. ${stationError}` : 'No se pudo leer la OT.'}
      </Alert> : missingOt ? <Alert severity="warning">No se encontró la OT solicitada para la estación.</Alert>
        : <Typography color="text.secondary">Cargando OT…</Typography>}
    </Stack>;
  }
  if (isSheet) {
    if ((Array.isArray(providedOts) && !providedOts.some((candidate) => String(idOf(candidate)) === String(otId))) || (!otId && loaded && !loading)) return <Stack spacing={1.5} sx={{ p: { xs: 1, md: 2 } }}><Alert severity="warning">No se encontró la OT solicitada para este filtro.</Alert><Button variant="outlined" onClick={() => onBack?.({ date, shift, machine: machineFilter })}>Volver al reporte</Button></Stack>;
    if (reportError) return <Stack spacing={1.5} sx={{ p: { xs: 1, md: 2 } }}><Alert severity="error">No se pudo hidratar el detalle de la OT. {reportError}</Alert><Button variant="outlined" onClick={() => setReportRetry((attempt) => attempt + 1)}>Reintentar lectura</Button></Stack>;
    const reportReadyOt = reportOt;
    return reportReadyOt ? <OtReport ot={reportReadyOt} assemblyOts={assemblyOts} moldCatalog={moldCatalog} localState={currentLocalState} setLocalState={updateLocalState} machines={machines} date={date} shift={shift} search={filterSearch} onBack={onBack} onOpenStation={onOpenStation} onRefresh={refreshDetail} loading={loading} optionalCoverage={optionalCoverage} /> : <Paper variant="outlined" sx={{ m: 2, p: 3 }}><Typography color="text.secondary">Cargando informe de OT…</Typography></Paper>;
  }
  return <Stack spacing={1.5} sx={{ maxWidth: 1360, mx: 'auto', p: { xs: 1, md: 2 } }} data-testid="calidad-proceso">
    {isStationLanding && <QualityStationBreadcrumbs />}
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}><Box><Typography component="h1" variant="h5" fontWeight={850}>{isStationLanding ? 'Estación de Calidad' : 'Reporte de Calidad'}</Typography>{!isStationLanding && <Typography variant="body2" color="text.secondary">Ronda de máquinas por fecha y turno · solo lectura</Typography>}</Box><Button size="small" variant="outlined" startIcon={<RefreshOutlinedIcon />} onClick={() => load({ force: true })} disabled={loading}>Actualizar lectura</Button></Stack>
      <Paper variant="outlined" sx={{ p: 1.25 }}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}><TextField size="small" type="date" label="Fecha operativa" value={date} onChange={(event) => updateFilters({ date: event.target.value })} InputLabelProps={{ shrink: true }} inputProps={{ 'data-testid': 'calidad-date-input' }} /><FormControl size="small" sx={{ minWidth: 140 }}><InputLabel id="calidad-turno-label">Turno</InputLabel><Select labelId="calidad-turno-label" label="Turno" value={shift} onChange={(event) => { setMachineSearch(''); setDebouncedMachineSearch(''); updateFilters({ shift: event.target.value }); }}><MenuItem value="DIA">Día</MenuItem><MenuItem value="NOCHE">Noche</MenuItem><MenuItem value="EXTRA">Extra</MenuItem></Select></FormControl><TextField size="small" value={machineFilterSourceRef.current === 'link' ? (machineChoices.find(item => item.id === machineFilter)?.label || machineFilter) : machineSearch} onChange={(event) => {
       if (machineFilterSourceRef.current === 'link') machineFilterSourceRef.current = 'search';
       if (!event.target.value && machineFilter !== 'TODAS') {
         machineFilterSourceRef.current = 'none';
         updateFilters({ machine: 'TODAS' });
       }
       setMachineSearch(event.target.value);
     }} label="Buscar máquina u OT" inputProps={{ 'data-testid': 'calidad-machine-search' }} InputProps={{ startAdornment: <SearchOutlinedIcon fontSize="small" sx={{ mr: 0.75, color: 'text.secondary' }} /> }} sx={{ minWidth: { sm: 260 }, flex: 1 }} /></Stack></Paper>
     {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => load({ force: true })}>Reintentar</Button>}>{error}</Alert>}{loading && <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}><Typography color="text.secondary">Cargando {isStationLanding ? 'estación' : 'reporte'}…</Typography></Paper>}{!loading && loaded && partialMoldRead && <Alert severity="warning" action={<Button color="inherit" size="small" onClick={() => load({ force: true })}>Actualizar lectura</Button>}>Lectura parcial: no se pudo cargar el nombre de uno o más moldes.</Alert>}{!loading && loaded && optionalCoverage && <Alert severity="info">Noche habilitada: registro voluntario y consulta histórica; sin cuota predeterminada.</Alert>}{!loading && loaded && !summaryCards.length && !emptyMachineChoices.length && <Alert severity="warning">No hay OT de fabricación para esta fecha, turno o máquina.</Alert>}{!loading && loaded && summaryCards.length > 0 && <Box sx={machineGrid}>{summaryCards.map((summary) => <SummaryCard key={idOf(summary.ot)} summary={{ ...summary, optionalCoverage }} localState={currentLocalState} moldCatalog={moldCatalog} stationEntry={isStationLanding} search={filterSearch} onOpenOt={(nextId) => onOpenOt?.(nextId, { date, shift, machine: machineFilter, position: window.scrollY })} onOpenStation={(nextId) => onOpenStation?.(nextId, { date, shift, machine: machineFilter })} />)}</Box>}{!loading && loaded && emptyMachineChoices.length > 0 && <Box sx={machineGrid}>{emptyMachineChoices.map((machine) => { const machineOff = isOff(machine.id); return <Card key={machine.id} data-testid={`calidad-machine-card-${machine.id}`} variant="outlined" sx={{ bgcolor: machineOff ? 'grey.100' : 'background.paper', borderColor: machineOff ? 'grey.400' : 'divider' }}><CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}><Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}><Box><Typography variant="subtitle1" fontWeight={800}>{machine.label}</Typography><Typography variant="caption" color="text.secondary">Sin OT para {date} · {shiftLabel(shift)}</Typography></Box><Chip size="small" label={machineOff ? 'No trabajará' : 'Sin OT'} /></Stack></CardContent></Card>; })}</Box>}
  </Stack>;
}

