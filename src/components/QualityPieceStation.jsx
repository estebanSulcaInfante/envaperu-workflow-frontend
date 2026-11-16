import IncidentDialog from './QualityIncidentDialog';
import { WEIGHT_OPTIONS, CYCLE_OPTIONS, COLOR_INCIDENT_OPTIONS, FUNCTIONAL_INCIDENT_OPTIONS, INJECTION_INCIDENT_OPTIONS } from './qualityIncidentOptions';
import QualityStationBreadcrumbs from './QualityStationBreadcrumbs';
import QualityWorkStation from './QualityWorkStation';
import { useInitialClosed } from './qualityInitialCutoff';
import { createUuid } from '../services/scmProductOnboardingApi';
import ProductionColorLabel from './ui/ProductionColorLabel';
import { QualityPieceIndex, QualityPieceControls, physicalName } from './QualityPieceNavigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormHelperText,
  Tooltip, IconButton, ClickAwayListener,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { VisitHeader } from './QualityWorkContext';
import { periodicTarget } from './qualityOtInspectionSummary.js';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useScmActor } from '../context/ScmActorContext';
import {
  CHECK_IDS,
  CHECK_LABELS,
  ensurePieceQuality,
  ensurePieceRecord,
  hasInitialObservation as hasInitialRecordObservation,
  isInitialClosed,
  workHasStarted,
  workVisitConfirmedCount,
  otInitialVisit,
  normalizeNumber,
  normalizePieceRows,
  weightResult,
} from './qualityPieceModel';

const idOf = (value) => value?.public_id || value?.id || value?.codigo || '';
const textOf = (value, fallback = 'No informado') => value == null || value === '' ? fallback : String(value).replaceAll('_', ' ');
const nowIso = () => new Date().toISOString();
const uniqueId = (prefix) => `${prefix}-${createUuid()}`;
const physicalPieceKey = (piece) => piece?.output?.pieza_id != null ? `pieza:${piece.output.pieza_id}` : `salida:${piece?.outputId || ''}`;
const localDateTime = (value) => value ? String(value).slice(0, 16) : new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 16);

function ControlHelp({ label, children }) {
  const [open, setOpen] = useState(false);
  return <ClickAwayListener onClickAway={() => setOpen(false)}>
    <Box component="span" sx={{ display: 'inline-flex' }}>
      <Tooltip arrow describeChild title={children} open={open} disableTouchListener
        onOpen={() => setOpen(true)} onClose={() => setOpen(false)}>
        <IconButton size="small" aria-label={label} onClick={() => setOpen(true)}
          sx={{ width: 36, height: 36 }}><InfoOutlinedIcon fontSize="small" /></IconButton>
      </Tooltip>
    </Box>
  </ClickAwayListener>;
}

function pieceDescription(piece) {
  return `${piece.workLabel} · ${physicalName(piece)}`;
}

function ContextHeader({ ot, otId, machineLabel, onHistory }) {
  const shiftLabel = { DIA: 'Día', NOCHE: 'Noche', EXTRA: 'Extra' }[ot?.turno] || textOf(ot?.turno);
  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: 'background.paper', borderColor: 'divider' }}>
      <Stack spacing={{ xs: 1.25, sm: 1.5 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h1" variant="h5" fontWeight={850} sx={{ lineHeight: 1.2 }}>Estación de Calidad</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {textOf(ot?.fecha_operativa)} · Turno {shiftLabel} · {ot?.codigo_ot || otId || 'OT'} · {machineLabel}
            </Typography>
          </Box>
          {onHistory && <Button size="small" startIcon={<HistoryOutlinedIcon />} onClick={onHistory} sx={{ flexShrink: 0, minHeight: 40 }}>Historial de visitas</Button>}
        </Stack>
      </Stack>
    </Paper>
  );
}

function WipNotice({ assemblyOts, otId }) {
  const items = (assemblyOts || []).filter((assembly) => {
    const related = assembly?.ot_fabricacion_contexto?.public_id || assembly?.ot_fabricacion_contexto?.id;
    return assembly?.modo_ejecucion_ensamble === 'CONCURRENTE' && String(related || '') === String(otId || '');
  });
  if (!items.length) return null;
  return (
    <Paper variant="outlined" sx={{ p: 1.25, borderColor: 'info.light', bgcolor: 'info.50' }} data-testid="concurrent-wip">
      <Typography variant="subtitle2" fontWeight={800}>Armado concurrente en máquina</Typography>
      <Typography variant="caption" color="text.secondary" display="block">Salida WIP de la misma máquina.</Typography>
      <Stack spacing={0.5} sx={{ mt: 0.75 }}>
        {items.map((assembly) => (
          <Box key={assembly.public_id || assembly.id || assembly.codigo_ot}>
            <Typography variant="body2" fontWeight={700}>{assembly?.orden_armado?.salida?.articulo?.nombre || assembly?.producto_sku || 'Salida WIP sin nombre'}</Typography>
            <Typography variant="caption" color="text.secondary">{assembly.codigo_ot || assembly.codigo || 'OT de armado'} · {textOf(assembly.estado)}</Typography>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}

function PieceCheckFields({ piece, draft, setDraft, onIncident, validation, onEdit }) {
  const fieldRefs = useRef({});
  const [dismissedValidation, setDismissedValidation] = useState(null);
  const currentValidation = validation?.nonce === dismissedValidation ? null : validation;
  const errorCheckId = currentValidation?.checkId || '';
  const refFor = (key) => (node) => { fieldRefs.current[key] = node; };
  useEffect(() => {
    if (!validation?.field) return undefined;
    const frame = requestAnimationFrame(() => fieldRefs.current[`${validation.checkId}:${validation.field}`]?.focus());
    return () => cancelAnimationFrame(frame);
  }, [validation]);
  const update = (checkId, field, value) => {
    if (errorCheckId === checkId && currentValidation.field === field) setDismissedValidation(validation.nonce);
    onEdit?.();
    setDraft((current) => ({ ...current, [checkId]: { ...(current[checkId] || {}), [field]: value } }));
  };
  const weight = draft.peso || {};
  const cycle = draft.ciclo || {};
  const functional = draft.funcional || {};
  const sectionStatus = (checkId) => {
    if (errorCheckId === checkId) return 'Revisar';
    if (draft[checkId]?.status === 'INCIDENCIA' && !(checkId === 'funcional' && functional.applicable === false)) return 'Con incidencia';
    if (checkId === 'peso') {
      if (weightResult(weight.netGrams, weight.quantity) == null) return 'Pendiente';
      return WEIGHT_OPTIONS.find(option => option.value === weight.classification)?.label || 'Pendiente';
    }
    if (checkId === 'ciclo') {
      if (!(normalizeNumber(cycle.seconds) > 0)) return 'Pendiente';
      return CYCLE_OPTIONS.find(option => option.value === cycle.classification)?.label || 'Medido';
    }
    if (['color', 'inyeccion', 'funcional'].includes(checkId) && draft[checkId]?.status === 'OK') return 'Conforme';
    if (checkId === 'funcional') return functional.applicable === false ? 'No aplica' : functional.applicable === true && functional.status === 'OK' ? 'Listo' : 'Pendiente';
    return draft[checkId]?.status === 'NA' ? 'No aplica' : draft[checkId]?.status === 'OK' ? 'Listo' : 'Pendiente';
  };
  const openIncident = (checkId) => onIncident(piece, checkId, draft[checkId] || {});
  const actionGridSx = {
    display: 'contents',
    '& > .MuiButton-root': { minWidth: 0, minHeight: 44, px: 0.5 },
  };
  const resultActions = (checkId) => {
    const markResult = (status) => {
      if (errorCheckId === checkId) setDismissedValidation(validation.nonce);
      onEdit?.();
      setDraft(current => ({
        ...current,
        [checkId]: { ...(checkId === 'funcional' ? { applicable: status !== 'NA' } : {}), status, incidentOptions: [], incidentSaved: false },
      }));
    };
    return <Box sx={actionGridSx}>
      <Button sx={{ gridArea: 'action' }} size="small" variant="outlined" onClick={() => markResult('OK')} ref={refFor(checkId + ':status')}>Dar conforme</Button>
      <Button sx={{ gridArea: 'incident' }} size="small" variant="outlined" onClick={() => openIncident(checkId)}>{draft[checkId]?.status === 'INCIDENCIA' ? 'Ver incidencia' : 'Reportar'}</Button>
      {checkId === 'funcional' && <Button sx={{ gridArea: 'na' }} variant="outlined" size="small" onClick={() => markResult('NA')}>No aplica</Button>}
      {errorCheckId === checkId && validation.field === 'status' && <FormHelperText error sx={{ gridColumn: '1 / -1' }}>{validation.message}</FormHelperText>}
    </Box>;
  };
  const measurementActions = (checkId) => <Box sx={actionGridSx}>
    <Button sx={{ gridArea: 'action' }} size="small" variant="outlined" onClick={() => {
      if (errorCheckId === checkId) setDismissedValidation(validation.nonce);
      onEdit?.();
      setDraft(current => ({ ...current, [checkId]: { ...current[checkId], classification: 'CORRECTO', status: 'MEDIDO', recordIncident: false, incidentSaved: false, description: '', incidentDetail: null } }));
    }} ref={checkId === 'peso' ? refFor('peso:classification') : undefined}>Dar conforme</Button>
    <Button sx={{ gridArea: 'incident' }} size="small" variant="outlined" onClick={() => openIncident(checkId)}>{draft[checkId]?.recordIncident ? 'Ver incidencia' : 'Reportar'}</Button>
  </Box>;
  const statusChip = (checkId) => {
    const status = sectionStatus(checkId);
    return <Chip size="small" label={status} color={['Listo', 'Conforme', 'Peso correcto', 'Ciclo correcto'].includes(status) ? 'success' : ['Revisar', 'Con incidencia', 'Peso alto', 'Peso bajo', 'Ciclo rápido', 'Ciclo lento'].includes(status) ? 'warning' : 'default'} variant={status === 'Pendiente' ? 'outlined' : 'filled'} sx={{ flexShrink: 0 }} />;
  };
  const family = (checkId, title, measurement, actions, sx = {}) => (
    <Box component="section" aria-labelledby={`${piece.key}-${checkId}-title`} sx={{
      py: 0.75,
      minWidth: 0,
      borderTop: checkId === 'peso' ? 0 : 1,
      borderColor: 'divider',
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto auto auto',
      gridTemplateAreas: checkId === 'peso' || checkId === 'ciclo'
        ? '"title title state state" "value value value value" ". action incident na"'
        : '"title title state state" ". action incident na"',
      '@container (min-width: 620px)': {
        gridTemplateColumns: 'minmax(0, 1fr) minmax(8rem, 12rem) 6.5rem 6rem 4.5rem minmax(6rem, 1fr)',
        gridTemplateAreas: '"title value action incident na state"',
      },
      alignItems: 'center',
      columnGap: 0.5, rowGap: 0.75,
      ...sx,
    }}>
      
        <Stack direction="row" alignItems="center" flexWrap="wrap" columnGap={1} minWidth={0} sx={{ gridArea: 'title', alignSelf: 'start' }}>
          <Typography id={`${piece.key}-${checkId}-title`} component="h4" fontWeight={800}>{title}</Typography>
          {checkId === 'color' && measurement}
        </Stack>
        <Box sx={{ gridArea: 'state', justifySelf: 'end', alignSelf: 'start' }}>{statusChip(checkId)}</Box>
      {measurement && checkId !== 'color' && <Box sx={{ gridArea: 'value', minWidth: 0, maxWidth: '12rem' }}>{measurement}</Box>}
      {actions}
    </Box>
  );
  return (
    <Stack spacing={0} sx={{ containerType: 'inline-size', '& .MuiButton-root': { minHeight: 44 } }}>
      <Typography component="h3" variant="subtitle1" fontWeight={850} sx={{ pb: 0.75 }}>{physicalName(piece)}</Typography>
      {family('peso', 'Peso', <Stack spacing={1}>
        <Stack direction="row" spacing={0.5}>
          <TextField size="small" label="Neto (g)" value={weight.netGrams ?? ''} onChange={(event) => update('peso', 'netGrams', event.target.value)} inputProps={{ 'aria-label': `Neto (g) · ${physicalName(piece)}`, inputMode: 'decimal' }} inputRef={refFor('peso:netGrams')} error={errorCheckId === 'peso' && validation?.field === 'netGrams'} helperText={errorCheckId === 'peso' && validation?.field === 'netGrams' ? validation.message : ''} fullWidth />
          <TextField size="small" label="Cantidad" value={weight.quantity ?? ''} onChange={(event) => update('peso', 'quantity', event.target.value)} inputProps={{ 'aria-label': `Cantidad · ${physicalName(piece)}`, inputMode: 'numeric' }} inputRef={refFor('peso:quantity')} error={errorCheckId === 'peso' && validation?.field === 'quantity'} helperText={errorCheckId === 'peso' && validation?.field === 'quantity' ? validation.message : ''} fullWidth />
        </Stack>
        <Typography variant="caption" color="text.secondary" display="block">
          {weightResult(weight.netGrams, weight.quantity) == null ? 'Completa ambos campos para calcular g/pieza.' : `${weightResult(weight.netGrams, weight.quantity).toLocaleString('es-PE', { maximumFractionDigits: 3 })} g/pieza · dato medido`}
        </Typography>
        {errorCheckId === 'peso' && validation?.field === 'classification' && <FormHelperText error>{validation.message}</FormHelperText>}
      </Stack>, measurementActions('peso'))}
      {family('ciclo', 'Ciclo', <Stack spacing={0.75}>
        <TextField sx={{ maxWidth: '7rem' }} size="small" label="Ciclo (s)" value={cycle.seconds ?? ''} onChange={(event) => update('ciclo', 'seconds', event.target.value)} inputProps={{ 'aria-label': `Ciclo (s) · ${physicalName(piece)}`, inputMode: 'decimal' }} inputRef={refFor('ciclo:seconds')} error={errorCheckId === 'ciclo'} helperText={errorCheckId === 'ciclo' ? validation.message : ''} fullWidth />
        {cycle.suggestion?.source && !cycle.seconds && <Button onClick={() => update('ciclo', 'seconds', cycle.suggestion.seconds)}>Usar {cycle.suggestion.seconds} s de {cycle.suggestion.source}</Button>}
      </Stack>, measurementActions('ciclo'))}
      {family('color', 'Color', <ProductionColorLabel compact name={piece.workLabel} hex={piece.work?.color_hex} />, resultActions('color'))}
      {family('inyeccion', 'Inyección', null, resultActions('inyeccion'))}
      {family('funcional', 'Funcional', null, resultActions('funcional'))}
    </Stack>
  );
}

const draftFor = (piece, quality, pieces = [], kind = 'INICIAL') => {
  void pieces;
  const record = ensurePieceRecord(quality, piece);
  const cycleSuggestion = null;
  // Periodic visits start from a blank observation. Initials may be resumed.
  const periodicDraft = record.periodic?.find(item => item.draft
    && !quality.visits.some(visit => visit.id === item.visitId && visit.status === 'CONFIRMED'))?.checks;
  const prior = kind === 'INICIAL' ? (record.initialChecks || record.checks || {}) : (periodicDraft || {});
  return {
    peso: { ...(prior.peso || {}) },
    ciclo: { ...(prior.ciclo || {}), suggestion: cycleSuggestion },
    color: { ...(prior.color || {}) },
    inyeccion: { ...(prior.inyeccion || {}) },
    funcional: { applicable: prior.funcional?.applicable ?? piece.functionalApplicable, ...(prior.funcional || {}) },
  };
};

const AUTOSAVE_DELAY_MS = 700;
const serializeDraft = (value) => {
  try { return JSON.stringify(value); } catch { return ''; }
};

function useDraftAutosave({ enabled, signature, payload, onSave, isConfirmed }) {
  const timerRef = useRef(null);
  const mountedRef = useRef(true);
  const baselineRef = useRef(signature);
  const pendingRef = useRef(false);
  const latestRef = useRef({ payload, onSave, isConfirmed });
  const saveNowRef = useRef(() => true);
  const [state, setState] = useState('idle');

  useEffect(() => {
    latestRef.current = { payload, onSave, isConfirmed };
  }, [isConfirmed, onSave, payload]);

  const saveNow = useCallback(() => {
    if (!pendingRef.current) return true;
    pendingRef.current = false;
    if (latestRef.current.isConfirmed?.()) {
      baselineRef.current = signature;
      if (mountedRef.current) setState('blocked');
      return true;
    }
    if (mountedRef.current) setState('saving');
    try {
      const result = latestRef.current.onSave({ ...latestRef.current.payload, draftOnly: true });
      if (result === false) {
        pendingRef.current = true;
        if (mountedRef.current) setState('error');
        return false;
      }
      baselineRef.current = signature;
      if (mountedRef.current) setState('saved');
      return true;
    } catch {
      pendingRef.current = true;
      if (mountedRef.current) setState('error');
      return false;
    }
  }, [signature]);
  useEffect(() => { saveNowRef.current = saveNow; }, [saveNow]);

  useEffect(() => {
    if (!enabled || !signature || signature === baselineRef.current) return undefined;
    if (latestRef.current.isConfirmed?.()) {
      pendingRef.current = false;
      const timer = window.setTimeout(() => setState('blocked'), 0);
      return () => window.clearTimeout(timer);
    }
    pendingRef.current = true;
    const pendingTimer = window.setTimeout(() => setState('pending'), 0);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(saveNow, AUTOSAVE_DELAY_MS);
    return () => {
      window.clearTimeout(pendingTimer);
      window.clearTimeout(timerRef.current);
    };
  }, [enabled, saveNow, signature]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      if (pendingRef.current) saveNowRef.current();
      mountedRef.current = false;
      window.clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const flushHidden = () => { if (document.visibilityState === 'hidden') saveNow(); };
    window.addEventListener('pagehide', saveNow);
    document.addEventListener('visibilitychange', flushHidden);
    return () => {
      window.removeEventListener('pagehide', saveNow);
      document.removeEventListener('visibilitychange', flushHidden);
    };
  }, [saveNow]);

  const flush = useCallback(() => {
    window.clearTimeout(timerRef.current);
    return saveNow();
  }, [saveNow]);
  const retry = useCallback(() => {
    pendingRef.current = true;
    return saveNow();
  }, [saveNow]);
  return { state, flush, retry };
}

function RegistrationView({ pieces, quality, target, initialKey, kind, otId = '', visitId = '', number = '', explicitWork, cutoffLabel = '08:00', onSave, onCancel, onReturnToWorkRows, onIncident }) {
  const initialPieceForVisit = pieces.find((piece) => piece.key === initialKey);
  const initialPhysicalKey = initialPieceForVisit && physicalPieceKey(initialPieceForVisit);
  const resumedDraft = !visitId
    ? [...quality.visits].reverse().find((visit) => visit.status === 'DRAFT'
      && visit.kind === kind
      && String(visit.otId || '') === String(otId || '')
      && (!number || String(visit.number || '') === String(number))
      && Boolean(initialPieceForVisit)
      && visit.pieceKeys?.some((key) => key === initialPieceForVisit.key
        || (!explicitWork && initialPhysicalKey && physicalPieceKey(pieces.find((piece) => piece.key === key)) === initialPhysicalKey)))
    : null;
  const [draftVisitId] = useState(() => visitId || resumedDraft?.id || uniqueId('piece-visit'));
  const effectiveVisitId = draftVisitId;
  const existingVisit = quality.visits.find((visit) => visit.id === effectiveVisitId) || null;
  const existingPieceKeys = existingVisit?.pieceKeys || [];
  const initialPiece = pieces.find((piece) => piece.key === initialKey) || pieces.find((piece) => existingPieceKeys.includes(piece.key));
  const existingWorkId = existingVisit
    ? (pieces.find((piece) => existingPieceKeys.includes(piece.key) && piece.workId === initialPiece?.workId)?.workId
      || pieces.find((piece) => existingPieceKeys.includes(piece.key))?.workId)
    : '';
  const existingRows = existingVisit
    ? pieces.filter((piece) => existingPieceKeys.includes(piece.key) && piece.workId === existingWorkId)
    : [];
  const siblingPieces = initialPiece
    ? pieces.filter((piece) => physicalPieceKey(piece) === physicalPieceKey(initialPiece))
    : [];
  const workOptions = [...new Map(siblingPieces.map((piece) => [piece.workId, piece])).values()];
  const activeWorkOptions = workOptions.filter((piece) => String(piece.work?.estado || piece.status || '').toUpperCase() === 'EN_EJECUCION');
  const automaticWork = workOptions.length === 1 ? workOptions[0] : activeWorkOptions.length === 1 ? activeWorkOptions[0] : null;
  const existingInitialChecks = initialPiece ? quality.records?.[initialPiece.key]?.initialChecks || quality.records?.[initialPiece.key]?.checks || {} : {};
  const hasInitialObservation = hasInitialRecordObservation({ initialChecks: existingInitialChecks });
  const defaultWorkId = existingVisit
    ? existingWorkId
    : explicitWork || (kind === 'INICIAL' && hasInitialObservation)
      ? initialPiece?.workId || ''
      : automaticWork?.workId || '';

  const targetForWork = (workId) => pieces.find((piece) => piece.workId === workId && physicalPieceKey(piece) === physicalPieceKey(initialPiece))
    || pieces.find((piece) => piece.workId === workId);
  const [selectedWorkId] = useState(defaultWorkId);
  const initialPieces = existingVisit?.status === 'CONFIRMED'
    ? existingRows
    : existingVisit?.status === 'DRAFT'
      ? pieces.filter((piece) => existingPieceKeys.includes(piece.key))
      : (targetForWork(selectedWorkId) ? [targetForWork(selectedWorkId)] : []);
  const [selectedKeys, setSelectedKeys] = useState(initialPieces.map((piece) => piece.key));
  const [drafts, setDrafts] = useState(() => Object.fromEntries(initialPieces.map((piece) => [piece.key, existingVisit?.checks?.[piece.key] || draftFor(piece, quality, pieces, kind)])));
  const [observedAt, setObservedAt] = useState(() => localDateTime(existingVisit?.observedAt));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [validationTarget, setValidationTarget] = useState(null);
  const validationNonce = useRef(0);
  const incidentScopeId = useRef(effectiveVisitId || uniqueId('piece-control')).current;

  const availablePieces = existingVisit?.status === 'CONFIRMED'
    ? existingRows
    : kind === 'INICIAL'
      ? siblingPieces.filter((piece) => piece.workId === selectedWorkId)
      : pieces.filter((piece) => piece.workId === selectedWorkId);
  const selectedPieces = availablePieces.filter((piece) => selectedKeys.includes(piece.key));
  const [showPieces, setShowPieces] = useState(false);
  const selectedWork = workOptions.find(piece => piece.workId === selectedWorkId) || existingRows[0];
  const canChoosePieces = kind === 'PERIODICA' && existingVisit?.status !== 'CONFIRMED' && availablePieces.length > 1;
  const controlNumber = number || existingVisit?.number || '';
  const toggle = (piece) => {
    if (kind === 'INICIAL') {
      setSelectedKeys([piece.key]);
      setDrafts((current) => ({ ...current, [piece.key]: current[piece.key] || draftFor(piece, quality, pieces, kind) }));
      return;
    }
    setSelectedKeys((current) => current.includes(piece.key) ? current.filter((key) => key !== piece.key) : [...current, piece.key]);
    setDrafts((current) => current[piece.key] ? current : ({ ...current, [piece.key]: draftFor(piece, quality, pieces, kind) }));
  };
  const updateDraft = (piece, updater) => setDrafts((current) => {
    const nextForPiece = updater(current[piece.key] || draftFor(piece, quality, pieces, kind));
    const next = { ...current, [piece.key]: nextForPiece };
    const cycleSeconds = nextForPiece?.ciclo?.seconds;
    const previous = current[piece.key]?.ciclo?.seconds;
    if (kind === 'PERIODICA' && piece.mouldId && cycleSeconds !== previous) {
      availablePieces.filter(other => other.key !== piece.key && other.mouldId === piece.mouldId).forEach(other => {
        const d = next[other.key] || draftFor(other, quality, pieces, kind);
        if (!d.ciclo?.seconds) next[other.key] = { ...d, ciclo: { ...d.ciclo,
          suggestion: normalizeNumber(cycleSeconds)>0 ? {seconds:cycleSeconds,source:piece.outputLabel} : null } };
      });
    }
    return next;
  });
  const invalidDraft = (piece) => {
    const draft = drafts[piece.key] || {};
    const grams = normalizeNumber(draft.peso?.netGrams);
    const count = normalizeNumber(draft.peso?.quantity);
    const cycle = normalizeNumber(draft.ciclo?.seconds);
    const incidentFor = (checkId) => draft[checkId]?.incidentSaved || (effectiveVisitId && quality.incidents.some((incident) => incident.pieceKey === piece.key && incident.checkId === checkId && incident.visitId === effectiveVisitId && incident.status !== 'CERRADA'));
    if (!(grams > 0)) return { checkId: 'peso', field: 'netGrams', message: 'Ingresa el neto en gramos.' };
    if (!(count > 0) || !Number.isSafeInteger(count)) return { checkId: 'peso', field: 'quantity', message: 'Ingresa una cantidad entera mayor que cero.' };
    const legacyWeight = existingVisit?.status === 'CONFIRMED' && !Object.prototype.hasOwnProperty.call(existingVisit.checks?.[piece.key]?.peso || {}, 'classification');
    if (!legacyWeight && !WEIGHT_OPTIONS.some((option) => option.value === draft.peso?.classification)) return { checkId: 'peso', field: 'classification', message: 'Selecciona la clasificación del peso.' };
    if (!(cycle > 0)) return { checkId: 'ciclo', field: 'seconds', message: 'Ingresa los segundos observados.' };
    if (!['OK', 'INCIDENCIA', 'NA'].includes(draft.color?.status)) return { checkId: 'color', field: 'status', message: 'Selecciona el resultado de color.' };
    if (draft.color.status === 'INCIDENCIA' && !incidentFor('color')) return { checkId: 'color', field: 'status', message: 'Guarda la incidencia de color antes de confirmar.' };
    if (!['OK', 'INCIDENCIA', 'NA'].includes(draft.inyeccion?.status)) return { checkId: 'inyeccion', field: 'status', message: 'Selecciona el resultado de inyección.' };
    if (draft.inyeccion.status === 'INCIDENCIA' && !incidentFor('inyeccion')) return { checkId: 'inyeccion', field: 'status', message: 'Guarda la incidencia de inyección antes de confirmar.' };
    if (draft.funcional?.applicable === null || draft.funcional?.applicable === undefined) return { checkId: 'funcional', field: 'status', message: 'Selecciona el resultado funcional.' };
    if (draft.funcional.applicable === true && !['OK', 'INCIDENCIA'].includes(draft.funcional?.status)) return { checkId: 'funcional', field: 'status', message: 'Selecciona el resultado funcional.' };
    if (draft.funcional.applicable === true && draft.funcional.status === 'INCIDENCIA' && !incidentFor('funcional')) return { checkId: 'funcional', field: 'status', message: 'Guarda la incidencia funcional antes de confirmar.' };
    return null;
  };
  const autosavePayload = useMemo(() => ({
    kind,
    selectedPieces,
    drafts: Object.fromEntries(selectedPieces.map((piece) => [piece.key, drafts[piece.key]])),
    observedAt,
    visitId: draftVisitId,
    number: controlNumber,
  }), [controlNumber, drafts, draftVisitId, kind, observedAt, selectedPieces]);
  const autosaveSignature = useMemo(() => serializeDraft({
    identity: draftVisitId,
    kind,
    selectedKeys: selectedPieces.map((piece) => piece.key),
    observedAt,
    drafts: autosavePayload.drafts,
  }), [autosavePayload, draftVisitId, kind, observedAt, selectedPieces]);
  const autoSave = useDraftAutosave({
    enabled: Boolean(selectedPieces.length),
    signature: autosaveSignature,
    payload: autosavePayload,
    onSave,
    isConfirmed: () => quality.visits.some((visit) => visit.id === draftVisitId && visit.status === 'CONFIRMED'),
  });
  const save = () => {
    if (saving) return;
    const flushed = autoSave.flush();
    if (!flushed) {
      setSaveError('No se pudo conservar el borrador automático. Reintenta antes de confirmar.');
      return;
    }
    setSubmitted(true);
    if (!selectedPieces.length) return;
    const firstInvalid = selectedPieces.map((piece) => ({ piece, error: invalidDraft(piece) })).find((item) => item.error);
    if (firstInvalid) {
      setValidationTarget({ pieceKey: firstInvalid.piece.key, ...firstInvalid.error, nonce: ++validationNonce.current });
      return;
    }
    setValidationTarget(null);
    setSaving(true);
    const saved = onSave({ kind, selectedPieces, drafts, observedAt, visitId: effectiveVisitId || draftVisitId, number });
    if (saved === false) {
      setSaving(false);
       setSaveError(kind === 'INICIAL'
         ? `El control de arranque cerró a las ${cutoffLabel} Lima. El borrador automático se conserva si fue posible; continúa con un periódico.`
         : 'No se pudo confirmar el control. Conserva el formulario y reintenta.');
    }
  };
  const handleCancel = () => {
    if (autoSave.state === 'blocked') {
      setSaveError('Hay cambios sin confirmar en una visita confirmada. Confírmalos explícitamente antes de volver.');
      return;
    }
    if (!autoSave.flush()) {
      setSaveError('No se pudo conservar el borrador automático. Reintenta antes de volver.');
      return;
    }
    onCancel();
  };
  const saveState = autoSave.state === 'idle' && existingVisit?.status === 'DRAFT' ? 'saved' : autoSave.state;
  return (
    <Stack spacing={1.5} data-testid="quality-registration">
      <VisitHeader title={kind === 'PERIODICA' && controlNumber ? `Control #${controlNumber}` : kind === 'PERIODICA' ? 'Registrar visita periódica' : 'Control de arranque'}
        help={<ControlHelp label="Información del control">{kind === 'PERIODICA' ? 'La meta de visitas se configura en la OT; una visita puede cubrir varias piezas.' : 'El control de arranque puede quedar parcial y retomarse sin perder lo observado.'}</ControlHelp>}
        confirmed={workVisitConfirmedCount(quality, otId)} target={target} saveState={saveState} onBack={handleCancel} />
      <TextField size="small" type="datetime-local" label="Momento observado" value={observedAt} onChange={(event) => setObservedAt(event.target.value)} InputLabelProps={{ shrink: true }} slotProps={{ input: { endAdornment: <ControlHelp label="Información sobre la hora">Hora de la observación; el registro conserva su propia hora.</ControlHelp> } }} sx={{ maxWidth: { sm: '20rem' } }} />
      <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
        {selectedWork && <Box data-testid="quality-selected-work" sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 40 }}>
          <ProductionColorLabel compact name={selectedWork.workLabel} hex={selectedWork.work.color_hex} />
        </Box>}
        {canChoosePieces && <Button size="small" aria-expanded={showPieces} onClick={() => setShowPieces(!showPieces)}>
          {showPieces ? 'Ocultar selección' : 'Elegir piezas de la visita'}
        </Button>}
      </Stack>
      {!selectedWork && <Alert severity="info" action={<Button size="small" color="inherit" onClick={onReturnToWorkRows}>Volver a la OT</Button>}>
        No se pudo identificar un único trabajo de color para esta ruta. Selecciona el trabajo observado en las filas de la OT.
      </Alert>}
      {canChoosePieces && showPieces && <Stack direction="row" flexWrap="wrap" gap={1}>
        {availablePieces.map(piece => <Button key={piece.key} size="small"
          variant={selectedKeys.includes(piece.key) ? 'contained' : 'outlined'}
          onClick={() => toggle(piece)} aria-pressed={selectedKeys.includes(piece.key)}>
          {physicalName(piece)}
        </Button>)}
      </Stack>}
      {submitted && !selectedPieces.length && <Alert severity="warning">Selecciona al menos una pieza.</Alert>}
      {selectedPieces.map((piece) => <Paper variant="outlined" key={piece.key} sx={{ p: 1.25 }}><PieceCheckFields piece={piece} draft={drafts[piece.key] || draftFor(piece, quality, pieces, kind)} validation={validationTarget?.pieceKey === piece.key ? validationTarget : null} setDraft={(updater) => updateDraft(piece, updater)} onIncident={(targetPiece, checkId, checkDraft) => onIncident(targetPiece, checkId, checkDraft, (result = {}) => setDrafts((current) => ({ ...current, [targetPiece.key]: { ...(current[targetPiece.key] || {}), [checkId]: { ...(current[targetPiece.key]?.[checkId] || {}), ...result, status: result.status || 'INCIDENCIA', incidentSaved: result.incidentSaved ?? true } } })), { scopeId: incidentScopeId, visitId, kind })} /></Paper>)}
      {saveError && <Alert severity="warning">{saveError}</Alert>}
      {saveState === 'error' && <Alert severity="warning" action={<Button size="small" onClick={autoSave.retry}>Reintentar guardado</Button>}>No se pudo guardar el borrador.</Alert>}
      {saveState === 'blocked' && <Alert severity="warning">Cambios sin confirmar. Este control ya fue confirmado.</Alert>}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><Button variant="contained" size="large" onClick={save} disabled={!selectedPieces.length || saving}>{saving ? 'Guardando…' : `Guardar ${kind === 'PERIODICA' ? 'visita' : 'control de arranque'}`}</Button></Stack>
    </Stack>
  );
}

function HistoryView({ visits, pieces }) {
  const labelFor = (key) => pieces.find((piece) => piece.key === key);
  return <Stack spacing={1.25} data-testid="quality-history"><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography component="h2" variant="h6" fontWeight={850}>Historial de visitas</Typography><Typography variant="body2" color="text.secondary">Cada visita conserva sus piezas y su momento de observación.</Typography></Box></Stack>{visits.length ? visits.slice().reverse().map((visit) => <Card variant="outlined" key={visit.id}><CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}><Box><Typography fontWeight={800}>{visit.kind === 'PERIODICA' ? 'Visita periódica' : 'Control de arranque'}</Typography><Typography variant="caption" color="text.secondary">Observada {visit.observedAt || 'sin fecha'} · registrada {visit.recordedAt || 'sin fecha'}</Typography></Box><Divider sx={{ my: 1 }} /><Stack spacing={0.5}>{(visit.pieceKeys || []).map((key) => <Typography variant="body2" key={key}>{labelFor(key) ? pieceDescription(labelFor(key)) : key}</Typography>)}</Stack></CardContent></Card>) : <Alert severity="info">Aún no hay visitas registradas para esta OT.</Alert>}</Stack>;
}

function OtQualitySettings({ quality, otId, saveQuality, expanded = false, readOnly = false, centralQuality = false, initialQuota = null, otVersion = null, qualityVisitApi = null }) {
  const [quotaDraft, setQuotaDraft] = useState(() => {
    const value = centralQuality ? initialQuota : quality?.periodicQuotaByOt?.[otId];
    return value === undefined || value === null ? '' : String(value);
  });
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [configVersion, setConfigVersion] = useState(otVersion);
  useEffect(() => {
    const value = centralQuality ? initialQuota : quality?.periodicQuotaByOt?.[otId];
    setQuotaDraft(value === undefined || value === null ? '' : String(value));
    setSaveError('');
    setConfigVersion(otVersion);
  }, [centralQuality, initialQuota, otId, otVersion, quality?.periodicQuotaByOt?.[otId]]);
  const save = async () => {
    const value = quotaDraft.trim();
    if (value !== '' && (!/^\d+$/.test(value) || Number(value) < 0)) return;
    setSaveError('');
    if (centralQuality) {
      if (readOnly || !qualityVisitApi?.updateConfiguration || configVersion == null) {
        setSaveError('Tu perfil no puede editar la cuota central de esta OT.');
        return;
      }
      setSaving(true);
      try {
        const response = await qualityVisitApi.updateConfiguration(otId, {
          version: configVersion,
          periodic_quota: value === '' ? null : Number(value),
        }, { idempotencyKey: crypto.randomUUID() });
        const nextQuota = response?.periodic_quota ?? response?.ot?.calidad_visitas_periodicas_previstas;
        const nextVersion = response?.ot?.version ?? configVersion;
        setConfigVersion(nextVersion);
        setQuotaDraft(nextQuota == null ? '' : String(nextQuota));
        saveQuality((current) => ({
          ...current,
          periodicQuotaByOt: { ...current.periodicQuotaByOt, [otId]: nextQuota ?? '' },
          centralPeriodicQuotaByOt: { ...current.centralPeriodicQuotaByOt, [otId]: nextQuota },
          centralPeriodicQuotaVersionByOt: { ...current.centralPeriodicQuotaVersionByOt, [otId]: nextVersion },
        }));
        setSaved(true);
      } catch (error) {
        setSaved(false);
        setSaveError(error?.response?.data?.message || error?.message || 'No se pudo guardar la cuota central. Actualiza la OT y reintenta.');
      } finally {
        setSaving(false);
      }
      return;
    }
    const persisted = saveQuality((current) => ({
      ...current,
      periodicQuotaByOt: {
        ...current.periodicQuotaByOt,
        [otId]: value === '' ? '' : Number(value),
      },
    }));
    if (persisted === false) {
      setSaved(false);
      setSaveError('No se pudo guardar la configuración. Reintenta sin perder el valor editado.');
      return;
    }
    setSaved(true);
  };
  const hasConfiguredValue = quotaDraft !== '';
  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.25, sm: 1.5 }, borderColor: expanded ? 'primary.light' : 'divider' }} data-testid="quality-ot-settings">
      <Stack spacing={1}>
        <Box>
          <Typography variant="subtitle1" fontWeight={800}>Configuración de la OT</Typography>
          <Typography variant="body2" color="text.secondary">{readOnly ? 'Tu perfil puede consultar la meta, pero no editar la configuración central.' : centralQuality ? 'La cuota se guarda en la API central como meta; las visitas actualizan el avance confirmado y pueden continuar.' : 'Define aquí la meta de visitas periódicas. Las visitas solo actualizan el avance confirmado; no cambian esta meta.'}</Typography>
        </Box>
        {readOnly && <Alert severity="info">Solicita a un supervisor o planificador la actualización de la cuota de esta OT.</Alert>}
        {!readOnly && <>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
          <TextField
            size="small"
            type="number"
            label="Visitas periódicas previstas"
            value={quotaDraft}
            onChange={(event) => { setQuotaDraft(event.target.value); setSaved(false); }}
            inputProps={{ min: 0, step: 1, inputMode: 'numeric' }}
            helperText={hasConfiguredValue ? '0 significa que no se esperan visitas periódicas.' : 'Vacío significa que la meta aún no está configurada.'}
            sx={{ minWidth: { sm: 250 } }}
          />
          <Button variant="contained" onClick={save} disabled={saving || (quotaDraft !== '' && (!/^\d+$/.test(quotaDraft) || Number(quotaDraft) < 0))}>{saving ? 'Guardando…' : 'Guardar configuración'}</Button>
          {saved && <Typography role="status" variant="body2" color="success.main">Configuración guardada</Typography>}
        </Stack>
        {saveError && <Alert severity="error" action={<Button color="inherit" size="small" onClick={save}>Reintentar</Button>}>{saveError}</Alert>}
        </>}
      </Stack>
    </Paper>
  );
}

export default function QualityPieceStation({ ot, assemblyOts = [], moldCatalog = [], localState, setLocalState, onBack, machineLabel = ot?.maquina_nombre || (typeof ot?.maquina === 'string' ? ot.maquina : ot?.maquina?.nombre) || 'Máquina sin nombre', qualityVisitApi = null, centralQuality = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { otId: routeOtId } = useParams();
  const otId = routeOtId || idOf(ot);
  const quality = ensurePieceQuality(localState);
  const pieces = useMemo(() => normalizePieceRows(ot, moldCatalog), [moldCatalog, ot]);
  const basePath = location.pathname.replace(/\/(?:pieza|historial|registrar)(?:\/.*)?$/, '') || location.pathname;
  const search = new URLSearchParams(location.search);
  const requestedPieceKey = search.get('pieza') || '';
  const requestedVisitId = search.get('visitId') || '';
  const requestedNumber = search.get('number') || '';
  const workParam = search.get('trabajo');
  const kindParam = search.get('control');
  // Keep the selected work in the OT detail URL even when no visit is open.
  // A visit route still requires a valid control kind; the work-only route is
  // used solely to restore the explicit row selection after reload/breadcrumbs.
  const routeWorkVisit = useMemo(() => workParam
    ? { workId: workParam, kind: ['INICIAL', 'PERIODICA'].includes(kindParam) ? kindParam : '', number: requestedNumber }
    : null, [workParam, kindParam, requestedNumber]);
  const beforeLeaveRef = useRef(null);
  const canLeaveWorkVisit = () => beforeLeaveRef.current?.() !== false;
  const activePiece = pieces.find((piece) => piece.key === requestedPieceKey) || null;
  const registrationDataKey = pieces.map((piece) => `${piece.key}:${physicalPieceKey(piece)}:${piece.work?.estado || piece.status || ''}:${piece.mouldId || ''}`).join('|');
  const segment = location.pathname.slice(basePath.length).split('/').filter(Boolean)[0] || '';
  const registrationKind = search.get('modo') === 'PERIODICA' ? 'PERIODICA' : 'INICIAL';
  const shift = String(ot?.turno || '').toUpperCase();
  const initialClosed = useInitialClosed({ fechaOperativa: ot?.fecha_operativa, turno: shift });
  const { actor, can, error: actorError, loading: actorLoading } = useScmActor();
  // Standalone component fixtures have no identity provider; preserve their
  // historical local behavior. A real provider gates writes until its actor is
  // known and the capability is explicit.
  const canRegisterQuality = !actor && !actorLoading && !actorError
    ? true
    : can('CALIDAD_CONTROL_REGISTRAR');
  const canConfigureQuality = !actor && !actorLoading && !actorError
    ? true
    : can('OT_CREAR') || can('OPERACION_PLANIFICAR');

  const [incidentContext, setIncidentContext] = useState(null);
  const [incidentDraft, setIncidentDraft] = useState({ type: '', description: '', evidence: '', owner: '', action: '' });
  const [incidentCommittedDraft, setIncidentCommittedDraft] = useState({ type: '', description: '', evidence: '', owner: '', action: '' });
  const [lastIncidentKey, setLastIncidentKey] = useState('');

  const records = useMemo(() => Object.fromEntries(pieces.map((piece) => [piece.key, ensurePieceRecord(quality, piece)])), [pieces, quality]);
  const hasInitialObservation = activePiece ? hasInitialRecordObservation(records[activePiece.key]) : false;
  const otVisits = quality.visits.filter((visit) => String(visit.otId) === String(otId));
  const initialOtVisit = otInitialVisit(quality, otId, pieces);
  const activeWorkStarted = workHasStarted(activePiece?.work || activePiece);
  const anotherWorkStarted = activePiece
    ? pieces.some((piece) => physicalPieceKey(piece) === physicalPieceKey(activePiece)
      && String(piece.workId) !== String(activePiece.workId) && workHasStarted(piece.work))
    : false;
  const activePeriodicDraft = activePiece && otVisits.some((visit) => visit.status === 'DRAFT'
    && visit.kind === 'PERIODICA' && visit.pieceKeys?.includes(activePiece.key));
  const initialDraftWorkPiece = initialOtVisit?.status === 'DRAFT'
    ? pieces.find((piece) => String(piece.workId) === String(initialOtVisit.workId))
    : null;
  const saveQuality = (updater) => setLocalState((current) => ({ ...current, pieceQuality: updater(ensurePieceQuality(current)) }));
  const configView = search.get('config') === 'visitas';
  const destination = (target, params = {}) => {
    const next = new URLSearchParams(location.search);
    next.delete('pieza');
    next.delete('modo');
    next.delete('visitId');
    next.delete('number');
    next.delete('config');
    next.delete('colorElegido');
    next.delete('trabajo');
    next.delete('control');
    Object.entries(params).forEach(([key, value]) => { if (value) next.set(key, value); });
    return { pathname: basePath + target, search: next.toString() };
  };
  const go = (target, params) => navigate(destination(target, params));
  const boardSearch = destination('').search;
  const trail = [
    ['Control de Calidad', { pathname: '/calidad/estacion', search: boardSearch }],
    [ot?.codigo_ot || 'OT', destination('', routeWorkVisit?.workId ? { trabajo: routeWorkVisit.workId } : {})],
  ];
  if (activePiece && ['pieza', 'registrar'].includes(segment)) {
    trail.push([physicalName(activePiece), destination('/pieza/' + encodeURIComponent(activePiece.key), { pieza: activePiece.key })]);
  }
  if (segment === 'registrar') trail.push([registrationKind === 'INICIAL' ? 'Control de arranque' : requestedNumber ? 'Control #' + requestedNumber : 'Control periódico']);
  if (segment === 'historial') trail.push(['Historial']);
  if (!segment && routeWorkVisit?.kind) {
    const work = pieces.find(piece => String(piece.workId) === routeWorkVisit.workId);
    if (work) trail.push([routeWorkVisit.kind === 'INICIAL' ? 'Control de arranque' : requestedNumber ? 'Control #' + requestedNumber : 'Control periódico']);
  }
  const routeToWorkVisit = (visit) => {
    const params = visit ? {
      trabajo: visit.workId,
      ...(visit.kind && ['INICIAL', 'PERIODICA'].includes(visit.kind) ? { control: visit.kind, number: visit.number } : {}),
    } : {};
    const target = destination('', params);
    const cameFromWorkRow = Boolean(location.state?.qualityReturn?.fromWorkRow);
    if (!visit?.kind && cameFromWorkRow) {
      // The row was pushed immediately before the visit. Returning by -1
      // removes the visit entry and restores that exact row (no duplicate row
      // is left in history, so Back remains meaningful).
      navigate(-1);
      return;
    }
    // Opening a visit from the work-only row must remain in browser history so
    // Back returns to the exact selected row. A direct deep link has no safe
    // row entry, so leaving it replaces the current URL with the row.
    const openingFromWorkRow = Boolean(visit?.kind && routeWorkVisit && !routeWorkVisit.kind);
    navigate(target, {
      replace: !visit?.kind,
      ...(openingFromWorkRow ? { state: { qualityReturn: { fromWorkRow: true } } } : {}),
    });
  };
  const openIncident = (piece, checkId = '', kind = 'INICIAL', checkDraft = {}, onSaved, scope = {}) => {
    const scopeId = scope.scopeId || scope.visitId || `${piece.key}:${kind}`;
    const contextKey = `${scopeId}:${piece.key}:${checkId}`;
    if (lastIncidentKey !== contextKey || ['peso', 'ciclo', 'color', 'inyeccion', 'funcional'].includes(checkId)) {
      const stableId = `piece-quality:${scopeId}:${piece.key}:${checkId}`;
      const existing = checkDraft?.incidentOptions || checkDraft?.classification ? undefined : quality.incidents.slice().reverse().find((incident) => (incident.id === stableId || (scope.visitId && incident.visitId === scope.visitId && incident.pieceKey === piece.key && incident.checkId === checkId)) && incident.status !== 'CERRADA');
      const prior = checkDraft || {};
      const priorDetail = prior.incidentDetail || {};
      const nextDraft = {
        ...priorDetail,
        type: existing?.type || prior.type || priorDetail.type || '',
        description: existing?.description ?? prior.description ?? priorDetail.description ?? '',
        evidence: existing?.evidence || prior.evidence || priorDetail.evidence || '',
        owner: existing?.owner || prior.owner || priorDetail.owner || '',
        action: existing?.action || prior.action || priorDetail.action || '',
        classification: prior.classification === 'CORRECTO' ? '' : prior.classification || existing?.classification || priorDetail.classification || '',
        netGrams: prior.netGrams ?? existing?.netGrams ?? priorDetail.netGrams ?? '',
        quantity: prior.quantity ?? existing?.quantity ?? priorDetail.quantity ?? '',
        result: weightResult(prior.netGrams ?? existing?.netGrams ?? priorDetail.netGrams, prior.quantity ?? existing?.quantity ?? priorDetail.quantity),
        seconds: prior.seconds ?? existing?.seconds ?? priorDetail.seconds ?? '',
        colorOptions: (existing?.colorOptions || prior.colorOptions || prior.incidentOptions || priorDetail.colorOptions || []).filter(value => !value.startsWith('SIN_INCIDENCIAS')),
        incidentOptions: (existing?.incidentOptions || prior.incidentOptions || priorDetail.incidentOptions || []).filter(value => !value.startsWith('SIN_INCIDENCIAS')),
        otherText: existing?.otherText || prior.otherText || priorDetail.otherText || '',
        ...(checkId === 'peso' ? { netGrams: prior.netGrams, quantity: prior.quantity, result: weightResult(prior.netGrams, prior.quantity) } : {}),
        ...(checkId === 'ciclo' ? { seconds: prior.seconds } : {}),
      };
      setIncidentDraft(nextDraft);
      setIncidentCommittedDraft(nextDraft);
    }
    setLastIncidentKey(contextKey);
    setIncidentContext({ piece, checkId, kind, onSaved, scopeId, visitId: scope.visitId || '' });
  };
  const saveIncident = () => {
    const context = incidentContext;
    if (!context) return;
    const isWeight = context.checkId === 'peso';
    const isCycle = context.checkId === 'ciclo';
    const isColor = context.checkId === 'color';
    const isInjection = context.checkId === 'inyeccion';
    const isFunctional = context.checkId === 'funcional';
    if (isWeight || isCycle || isColor || isInjection || isFunctional) {
      const shouldRecord = isWeight ? ['ALTO', 'BAJO'].includes(incidentDraft.classification)
        : isCycle ? ['LENTO', 'RAPIDO'].includes(incidentDraft.classification)
          : isColor ? !incidentDraft.colorOptions?.includes('SIN_INCIDENCIAS')
            : !incidentDraft.incidentOptions?.some((value) => value.startsWith('SIN_INCIDENCIAS_'));
      const description = String(incidentDraft.description || '').trim();
      const result = isWeight
        ? { classification: incidentDraft.classification, description, recordIncident: shouldRecord, status: 'MEDIDO' }
        : isCycle
          ? { classification: incidentDraft.classification, seconds: incidentDraft.seconds, description, recordIncident: shouldRecord, status: 'MEDIDO' }
          : isColor
            ? { status: shouldRecord ? 'INCIDENCIA' : 'OK', incidentOptions: incidentDraft.colorOptions }
            : { status: shouldRecord ? 'INCIDENCIA' : 'OK', incidentOptions: incidentDraft.incidentOptions };
      context.onSaved?.({ ...result, ...(isFunctional ? { applicable: true } : {}), incidentDetail: { ...incidentDraft }, incidentSaved: shouldRecord });
      setIncidentContext(null);
      return;
    }
    const stableId = `piece-quality:${context.scopeId}:${context.piece.key}:${context.checkId}`;
    saveQuality((current) => {
      const existingIndex = current.incidents.findIndex((incident) => incident.id === stableId);
      const nextIncidents = [...current.incidents];
      const previous = nextIncidents[existingIndex];
      const incident = {
        ...previous, ...incidentDraft,
        id: stableId, otId, workId: context.piece.workId, outputId: context.piece.outputId,
        pieceKey: context.piece.key, color: context.piece.workLabel, colorHex: context.piece.work?.color_hex || '',
        checkId: context.checkId, status: previous?.status || 'ABIERTA', createdAt: previous?.createdAt || nowIso(),
        visitId: context.visitId || previous?.visitId || '',
      };
      if (previous) nextIncidents[existingIndex] = incident;
      else nextIncidents.push(incident);
      const records = context.checkId && context.kind === 'INICIAL' ? {
        ...current.records,
        [context.piece.key]: {
          ...ensurePieceRecord(current, context.piece),
          initialChecks: {
            ...ensurePieceRecord(current, context.piece).initialChecks,
            [context.checkId]: { ...ensurePieceRecord(current, context.piece).initialChecks[context.checkId], status: 'INCIDENCIA' },
          },
          checks: {
            ...ensurePieceRecord(current, context.piece).checks,
            [context.checkId]: { ...ensurePieceRecord(current, context.piece).checks[context.checkId], status: 'INCIDENCIA' },
          },
        },
      } : current.records;
      return { ...current, incidents: nextIncidents, records };
    });
    setIncidentCommittedDraft(incidentDraft);
    context.onSaved?.({ status: 'INCIDENCIA', incidentSaved: true, incidentId: stableId });
    setIncidentContext(null);
  };
  const closeIncident = () => {
    setIncidentDraft(incidentCommittedDraft);
    setIncidentContext(null);
  };
  const mergePieceRecords = (current, selectedPieces, drafts, kind, visitId = '', draftOnly = false) => selectedPieces.reduce((recordsForPieces, piece) => {
    const previous = ensurePieceRecord(current, piece);
    const draft = drafts[piece.key] || {};
    const blankChecks = Object.fromEntries(CHECK_IDS.map((checkId) => [checkId, { applicable: checkId === 'funcional' ? null : true }]));
    const mergedChecks = CHECK_IDS.reduce((checks, checkId) => {
      const incoming = draft[checkId] || {};
      const retained = Object.fromEntries(Object.entries(incoming).filter(([, value]) => value !== '' && value !== undefined));
      const next = { ...checks, [checkId]: { ...checks[checkId], ...retained } };
      if (checkId === 'peso' && weightResult(incoming.netGrams, incoming.quantity) != null) next[checkId] = { ...next[checkId], status: 'MEDIDO', result: weightResult(incoming.netGrams, incoming.quantity), applicable: true };
      if (checkId === 'ciclo' && normalizeNumber(incoming.seconds) > 0) next[checkId] = { ...next[checkId], status: 'MEDIDO', applicable: true };
      if (checkId === 'funcional' && incoming.applicable !== undefined && incoming.applicable !== null) next[checkId] = { ...next[checkId], applicable: incoming.applicable, status: incoming.applicable === false ? 'NA' : incoming.status };
      return next;
    }, previous.initialChecks || previous.checks);
    const initialChecks = kind === 'INICIAL' ? mergedChecks : (previous.initialChecks || previous.checks);
    const previousConfirmedChecks = previous.initialConfirmedChecks
      || (previous.initialStatus === 'CONFIRMED' ? (previous.initialChecks || previous.checks) : {});
    const initialConfirmedChecks = kind === 'INICIAL' && !draftOnly ? mergedChecks : previousConfirmedChecks;
    const initialStatus = kind === 'INICIAL'
      ? (draftOnly ? (Object.keys(previousConfirmedChecks).length ? 'CONFIRMED' : 'DRAFT') : 'CONFIRMED')
      : previous.initialStatus;
    const nextInitialChecks = kind === 'INICIAL' && draftOnly && Object.keys(previousConfirmedChecks).length
      ? (previous.initialChecks || previous.checks)
      : initialChecks;
    const periodicChecks = CHECK_IDS.reduce((checks, checkId) => {
      const incoming = draft[checkId] || {};
      const retained = Object.fromEntries(Object.entries(incoming).filter(([, value]) => value !== '' && value !== undefined));
      const next = { ...checks, [checkId]: { ...checks[checkId], ...retained } };
      if (checkId === 'peso' && weightResult(incoming.netGrams, incoming.quantity) != null) next[checkId] = { ...next[checkId], status: 'MEDIDO', result: weightResult(incoming.netGrams, incoming.quantity), applicable: true };
      if (checkId === 'ciclo' && normalizeNumber(incoming.seconds) > 0) next[checkId] = { ...next[checkId], status: 'MEDIDO', applicable: true };
      if (checkId === 'funcional' && incoming.applicable !== undefined && incoming.applicable !== null) next[checkId] = { ...next[checkId], applicable: incoming.applicable, status: incoming.applicable === false ? 'NA' : incoming.status };
      return next;
    }, blankChecks);
    return {
      ...recordsForPieces,
      [piece.key]: {
        ...previous,
        initialChecks: nextInitialChecks,
        initialConfirmedChecks,
        initialStatus,
        initialDraftChecks: kind === 'INICIAL' && draftOnly ? mergedChecks : previous.initialDraftChecks,
        checks: nextInitialChecks,
        periodic: kind === 'PERIODICA'
          ? [...(previous.periodic || []).filter(item => item.visitId !== visitId), { visitId, draft: draftOnly, checks: periodicChecks }]
          : (previous.periodic || []),
      },
    };
  }, current.records);
  const saveVisit = ({ kind, selectedPieces, drafts, observedAt, visitId: requestedVisitId = '', number = '', draftOnly = false }) => {
    if (!selectedPieces?.length) return true;
    if (kind === 'INICIAL' && !draftOnly && isInitialClosed({ fechaOperativa: ot?.fecha_operativa, turno: ot?.turno })) return false;
    if (kind === 'INICIAL' && !draftOnly && initialOtVisit
      && String(initialOtVisit.workId || '') !== String(selectedPieces[0]?.workId || '')) return false;
    const selectedWorkStarted = selectedPieces.some((piece) => workHasStarted(piece.work || piece));
    const selectedPeriodicDraft = selectedPieces.some((piece) => quality.visits.some((visit) => visit.status === 'DRAFT'
      && visit.kind === 'PERIODICA' && visit.pieceKeys?.includes(piece.key)));
    if (kind === 'PERIODICA' && !draftOnly && !selectedWorkStarted && !selectedPeriodicDraft) return false;
    if (draftOnly && requestedVisitId && quality.visits.some((item) => item.id === requestedVisitId && item.status === 'CONFIRMED')) return false;
    const visitId = requestedVisitId || uniqueId('piece-visit');
    const previousVisit = quality.visits.find((item) => item.id === visitId);
    const visit = {
      id: visitId, otId, workId: selectedPieces[0]?.workId || '', kind, status: draftOnly && previousVisit?.status === 'CONFIRMED' ? 'CONFIRMED' : (draftOnly ? 'DRAFT' : 'CONFIRMED'), number,
      fechaOperativa: ot?.fecha_operativa || '', turno: ot?.turno || '', machineId: ot?.maquina_id || ot?.maquina?.id || '',
      pieceKeys: selectedPieces.map((piece) => piece.key),
      mouldId: selectedPieces[0]?.mouldId || '',
      cycleSeconds: normalizeNumber(drafts[selectedPieces[0].key]?.ciclo?.seconds),
      observedAt: observedAt || nowIso(),
      recordedAt: nowIso(),
      checks: Object.fromEntries(selectedPieces.map((piece) => [piece.key, drafts[piece.key]])),
    };
    const persisted = saveQuality((current) => {
      const nextIncidents = [...current.incidents];
      const currentVisit = current.visits.find((item) => item.id === visitId);
      if (draftOnly && currentVisit?.status === 'CONFIRMED') return current;
      if (!draftOnly) selectedPieces.forEach((piece) => {
        for (const family of ['peso', 'ciclo', 'color', 'inyeccion', 'funcional']) {
          const check = drafts[piece.key]?.[family];
          if (!check) continue;
          const isWeight = family === 'peso';
          const detail = check.incidentDetail || {};
          const id = `piece-quality:${visitId}:${piece.key}:${family}`;
          const index = nextIncidents.findIndex(item => item.id === id ||
            (item.visitId === visitId && item.pieceKey === piece.key && item.checkId === family));
          const previous = nextIncidents[index];
          const record = isWeight
            ? check.recordIncident && ['ALTO', 'BAJO'].includes(check.classification)
            : family === 'ciclo'
              ? check.recordIncident && ['LENTO', 'RAPIDO'].includes(check.classification)
              : family === 'funcional' && check.applicable === false
                ? false
              : check.status === 'INCIDENCIA' && check.incidentOptions?.some(value => !value.startsWith('SIN_INCIDENCIAS'));
          if (!record) {
            if (previous && previous.status !== 'CERRADA') {
              nextIncidents[index] = { ...previous, status: 'CERRADA', closedAt: nowIso(), closureReason: 'RECTIFICACION_SIN_INCIDENCIA' };
            }
            continue;
          }
          const options = check.incidentOptions || [];
          const optionSet = family === 'color' ? COLOR_INCIDENT_OPTIONS : family === 'inyeccion' ? INJECTION_INCIDENT_OPTIONS : FUNCTIONAL_INCIDENT_OPTIONS;
          const labels = family === 'ciclo'
            ? CYCLE_OPTIONS.filter(option => option.value === check.classification).map(option => option.label)
            : options.map(value => optionSet.find(option => option.value === value)?.label || value);
          const incident = {
            ...previous, ...detail, id: previous?.id || id, otId, workId: piece.workId, outputId: piece.outputId,
            pieceKey: piece.key, checkId: family, visitId, color: piece.workLabel, colorHex: piece.work?.color_hex || '',
            status: previous?.closureReason === 'RECTIFICACION_SIN_INCIDENCIA' ? 'ABIERTA' : previous?.status || 'ABIERTA',
            createdAt: previous?.createdAt || nowIso(),
            type: isWeight ? (check.classification === 'ALTO' ? 'Peso alto' : 'Peso bajo') : labels.join(' · '),
            description: isWeight || family === 'ciclo' ? check.description || '' : [detail.description, options.includes('OTROS') && detail.otherText].filter(Boolean).join(' · '),
            ...(isWeight ? { classification: check.classification, netGrams: check.netGrams, quantity: check.quantity,
              result: weightResult(check.netGrams, check.quantity) } : family === 'ciclo' ? { classification: check.classification, seconds: check.seconds } : { incidentOptions: options }),
          };
          if (incident.status === 'ABIERTA') { delete incident.closedAt; delete incident.closureReason; }
          if (previous) nextIncidents[index] = incident;
          else nextIncidents.push(incident);
        }
        Object.entries(drafts[piece.key] || {}).forEach(([family, check]) => {
          if (['peso', 'ciclo', 'color', 'inyeccion', 'funcional'].includes(family)) return;
          const savedIncidentId = check?.incidentId;
          if (!savedIncidentId) return;
          const incidentIndex = nextIncidents.findIndex((incident) => incident.id === savedIncidentId);
          if (incidentIndex >= 0) nextIncidents[incidentIndex] = { ...nextIncidents[incidentIndex], visitId };
        });
      });
      return {
        ...current,
        incidents: nextIncidents,
        visits: (() => {
          const previous = current.visits.find((item) => item.id === visitId);
          const retainConfirmed = previous?.status === 'CONFIRMED';
          const mergedPieceKeys = retainConfirmed ? [...new Set([...previous.pieceKeys, ...visit.pieceKeys])] : visit.pieceKeys;
          const mergedChecks = retainConfirmed ? { ...previous.checks, ...visit.checks } : visit.checks;
          const nextVisit = {
            ...previous,
            ...visit,
            number: number || previous?.number || (kind === 'PERIODICA' ? String(current.visits.filter((item) => item.kind === 'PERIODICA' && item.status === 'CONFIRMED' && String(item.otId || '') === String(otId || '')).length + 2) : ''),
            pieceKeys: mergedPieceKeys,
            checks: mergedChecks,
            mouldId: previous?.mouldId || visit.mouldId,
            observedAt: previous?.observedAt && !observedAt ? previous.observedAt : visit.observedAt,
          };
          return previous ? current.visits.map((item) => item.id === visitId ? nextVisit : item) : [...current.visits, nextVisit];
        })(),
        periodicQuotaByOt: current.periodicQuotaByOt,
        records: (() => {
          const records = mergePieceRecords(current, selectedPieces, drafts, kind, visitId, draftOnly);
          if (currentVisit?.status !== 'DRAFT') return records;
          for (const key of currentVisit.pieceKeys.filter(key => !visit.pieceKeys.includes(key))) {
            const prior = records[key];
            if (!prior) continue;
            if (kind === 'PERIODICA') {
              records[key] = { ...prior, periodic: (prior.periodic || []).filter(item => !(item.draft && item.visitId === visitId)) };
            } else if (!current.visits.some(other => other.id !== visitId && other.kind === 'INICIAL' && other.pieceKeys?.includes(key))) {
              const base = prior.initialConfirmedChecks || {};
              records[key] = { ...prior, initialChecks: base, checks: base, initialDraftChecks: {}, initialStatus: Object.keys(base).length ? 'CONFIRMED' : undefined };
            }
          }
          return records;
        })(),
      };
    });
    if (!draftOnly && persisted !== false) go(`/pieza/${encodeURIComponent(selectedPieces[0].key)}`, { pieza: selectedPieces[0].key });
    return persisted === false ? false : true;
  };
  const board = () => {
    if (onBack) return onBack();
    const filters = new URLSearchParams(location.search);
    for (const key of ['pieza', 'modo', 'visitId', 'number']) filters.delete(key);
    navigate({ pathname: '/calidad/estacion', search: filters.toString() });
  };
  if (!ot) return <Stack spacing={1.5} sx={{ p: { xs: 1, md: 2 } }}><Alert severity="warning">No se encontró la OT solicitada. Vuelve al tablero para elegir una OT disponible.</Alert><Button onClick={board}>Ir al tablero</Button></Stack>;
  if (segment === 'registrar' && !canRegisterQuality) return <Stack spacing={1.5} sx={{ width: '100%', maxWidth: 1360, mx: 'auto', p: { xs: 1, md: 2 } }} data-testid="quality-piece-station">
    <QualityStationBreadcrumbs trail={trail} beforeNavigate={canLeaveWorkVisit} />
    <ContextHeader machineLabel={machineLabel} ot={ot} otId={otId} onHistory={() => { if (canLeaveWorkVisit()) go('/historial'); }} />
    <WipNotice assemblyOts={assemblyOts} otId={otId} />
    <Alert severity="info" data-testid="quality-station-read-only">Tu perfil puede consultar el historial, pero no tiene CALIDAD_CONTROL_REGISTRAR para editar controles.</Alert>
    <Button variant="outlined" onClick={() => go('/historial')}>Ver historial de visitas</Button>
  </Stack>;
  return (
    <Stack spacing={1.5} sx={{ width: '100%', maxWidth: 1360, mx: 'auto', p: { xs: 1, md: 2 } }} data-testid="quality-piece-station">
      <QualityStationBreadcrumbs trail={trail} beforeNavigate={canLeaveWorkVisit} />
      <ContextHeader machineLabel={machineLabel} ot={ot} otId={otId} onHistory={segment === 'historial' ? null : () => { if (canLeaveWorkVisit()) go('/historial'); }} />
      <WipNotice assemblyOts={assemblyOts} otId={otId} />
      {segment === 'historial' && <Stack spacing={2}><HistoryView visits={otVisits.filter(visit => visit.status !== 'DRAFT' && !(visit.workId && Array.isArray(visit.outputIds)))} pieces={pieces} /><QualityWorkStation ot={ot} moldCatalog={moldCatalog} localState={localState} setLocalState={setLocalState} historyOnly readOnly qualityVisitApi={qualityVisitApi} /></Stack>}
      {segment === 'registrar' && (initialClosed && registrationKind === 'INICIAL' && !initialOtVisit && !hasInitialObservation ? <Stack spacing={1}><Alert severity="info">El control de arranque de este turno cerró a las {shift === 'NOCHE' ? '20:00' : '08:00'} Lima. Continúa con un control periódico; los borradores abiertos se pueden retomar.</Alert><Button variant="outlined" onClick={() => go('/registrar', { pieza: requestedPieceKey, modo: 'PERIODICA', number: 2 })}>Abrir control periódico</Button></Stack> : segment === 'registrar' && registrationKind === 'INICIAL' && initialOtVisit && String(initialOtVisit.workId || '') !== String(activePiece?.workId || '') ? <Stack spacing={1}><Alert severity="info">{initialOtVisit.status === 'DRAFT' ? 'Borrador de arranque pendiente en otro trabajo.' : 'El arranque de esta OT ya fue registrado; conserva el historial y continúa con un control periódico.'}</Alert>{initialDraftWorkPiece && <Button variant="outlined" onClick={() => go('/registrar', { pieza: initialDraftWorkPiece.key, modo: 'INICIAL', visitId: initialOtVisit.id })}>Retomar borrador de {initialDraftWorkPiece.workLabel}</Button>}</Stack> : segment === 'registrar' && registrationKind === 'PERIODICA' && !activeWorkStarted && !anotherWorkStarted && !activePeriodicDraft ? <Stack spacing={1}><Alert severity="info" action={<Button size="small" color="inherit" onClick={() => go('', {})}>Volver a la OT</Button>}>El trabajo sigue en cola y aún no comenzó. No se puede registrar un periódico nuevo desde este ingreso.</Alert></Stack> : <RegistrationView key={`${registrationKind}:${requestedPieceKey}:${requestedVisitId}:${requestedNumber}:${search.get('colorElegido')}:${registrationDataKey}`} pieces={pieces} quality={quality} target={periodicTarget(ot, localState, otId)} otId={otId} initialKey={requestedPieceKey} explicitWork={search.get('colorElegido') === '1'} cutoffLabel={shift === 'NOCHE' ? '20:00' : '08:00'} kind={registrationKind} visitId={requestedVisitId} number={requestedNumber} onSave={saveVisit} onIncident={(piece, checkId, checkDraft, onSaved, scope) => openIncident(piece, checkId, registrationKind, checkDraft, onSaved, scope)} onCancel={() => go(`/pieza/${encodeURIComponent(requestedPieceKey)}`, { pieza: requestedPieceKey })} onReturnToWorkRows={() => go('', {})} />)}
      {segment === 'pieza' && activePiece && <QualityPieceControls piece={activePiece} pieces={pieces} records={records} visits={otVisits} initialClosed={initialClosed} cutoffLabel={shift === 'NOCHE' ? '20:00' : '08:00'} onRegister={(p, kind, visitId, number)=>go('/registrar', {pieza:p.key,modo:kind,visitId,number})} />}
      {!segment && <>
        {configView && <OtQualitySettings
          quality={quality}
          otId={otId}
          saveQuality={saveQuality}
          expanded
          centralQuality={centralQuality}
          qualityVisitApi={qualityVisitApi}
          otVersion={ot?.version}
          initialQuota={ot?.calidad_visitas_periodicas_previstas ?? ot?.periodic_quota ?? ot?.periodicQuota}
          readOnly={centralQuality && !canConfigureQuality}
        />}
        <QualityWorkStation ot={ot} moldCatalog={moldCatalog} localState={localState} setLocalState={setLocalState} routeWorkVisit={routeWorkVisit} onWorkVisitRoute={routeToWorkVisit} beforeLeaveRef={beforeLeaveRef} qualityVisitApi={qualityVisitApi} readOnly={!canRegisterQuality} />
      </>}
      <IncidentDialog key={incidentContext ? `${incidentContext.scopeId}:${incidentContext.piece.key}:${incidentContext.checkId}` : 'incident-closed'} context={incidentContext} draft={incidentDraft} setDraft={setIncidentDraft} onClose={closeIncident} onSave={saveIncident} />
    </Stack>
  );
}

