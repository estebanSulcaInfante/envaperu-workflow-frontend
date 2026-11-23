import { useOperationMessage } from "../utils/operationFeedbackState";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import SendIcon from '@mui/icons-material/Send';
import RestoreIcon from '@mui/icons-material/Restore';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useScmActor } from '../context/ScmActorContext';
import { listarTrabajadoresWorkspace } from '../services/workspaceAdminApi';
import { mensajeErrorScm } from '../services/scmEngineeringApi';
import * as kgApi from '../services/scmKgCustodyApi';
import { activateScanAudio, getScanAudioStatus, playScanFeedback, subscribeScanAudio } from '../services/scmScanAudio';
import { API_BASE_URL } from '../services/api';

const PREPARE_CAPABILITY = 'PICKING_PREPARAR';
const DISPATCH_CAPABILITY = 'PICKING_DESPACHAR';
const ELIGIBLE_STATES = new Set([
  'RECIBIDA_ALMACEN',
  'ALMACENADA_CONTROLADA',
  'DISPONIBLE_PRODUCCION',
]);
const ELIGIBLE_QUALITY = new Set(['LIBERADA', 'SIN_CONTROL']);
const SCAN_QUEUE_LIMIT = 32;
const REVALIDATION_CHUNK_SIZE = 8;

const emptyDraft = { context: 'ARMADO', reason: '', holderId: '', holderName: '', documentType: '', documentId: '' };
const asWorkerName = (worker) => worker.nombre_corto || worker.nombre || [worker.nombres, worker.apellidos].filter(Boolean).join(' ') || `Trabajador ${worker.id}`;
const unitState = (unit) => unit?.estado_logistico || unit?.estado || '';
const unitKg = (unit) => unit?.kg_verificados ?? unit?.kg ?? unit?.peso_kg ?? null;
const unitVersion = (unit) => Number(unit?.version);
const isRawQrPayload = (value) => {
  const text = String(value || '').trim();
  if (!text.startsWith('{') && !text.startsWith('[')) return false;
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};
const isUuid = (value) => /^[\da-f]{8}-[\da-f]{4}-[1-5][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(String(value || '').trim());
const scanLabel = (value) => {
  const text = String(value || '').trim();
  return text && !isRawQrPayload(text) && !isUuid(text) ? text : 'Manga escaneada';
};
const unitHumanLabel = (unit, fallback) => {
  const identity = String(unit?.identidad?.m || '').trim();
  return identity || scanLabel(unit?.codigo || fallback);
};
const outgoingEligibilityError = (unit, label) => {
  const humanLabel = unitHumanLabel(unit, label);
  if (!unit?.id) return `${humanLabel} no tiene una identidad KG válida.`;
  const state = unitState(unit);
  if (!ELIGIBLE_STATES.has(state)) return state === 'RETIRADA_ARMADO'
    ? `Ya salió a Armado: ${humanLabel}.`
    : `${humanLabel} ya no está disponible para salida.`;
  if (!Number.isInteger(unitVersion(unit)) || unitVersion(unit) <= 0) return `${humanLabel} no tiene una versión válida.`;
  if (!String(unit?.identidad?.m || '').trim()) return `${humanLabel} no tiene una identidad humana OF-OT-M.`;
  if (unit.estado && unit.estado !== 'ACTIVA') return `${humanLabel} no está activa para salida.`;
  const kg = Number(unitKg(unit));
  if (!Number.isFinite(kg) || kg <= 0) return `${humanLabel} no tiene KG verificados disponibles.`;
  if (unit.estado_calidad && !ELIGIBLE_QUALITY.has(unit.estado_calidad)) return `${humanLabel} no está liberada para salida.`;
  return '';
};
const isDefinitive4xx = (error) => {
  const status = error?.response?.status;
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
};

const isTransientNetworkError = (error) => {
  const status = error?.response?.status;
  const code = String(error?.code || error?.response?.data?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  return status === 0 || status === 408 || status === 429 || status >= 500
    || code.includes('NETWORK') || code.includes('TIMEOUT')
    || message.includes('network error') || message.includes('failed to fetch')
    || message.includes('timeout') || message.includes('offline');
};

const isTransportFailure = (error) => {
  const status = error?.response?.status;
  const code = String(error?.code || error?.response?.data?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  return status === 0 || status === 408
    || code.includes('NETWORK') || code.includes('TIMEOUT')
    || message.includes('network error') || message.includes('failed to fetch')
    || message.includes('timeout') || message.includes('offline');
};

const conciseRequestError = (error, fallback = 'No se pudo validar la manga.') => {
  if (isTransportFailure(error)) return 'Error de internet. Revisa la conexión y reintenta.';
  const status = error?.response?.status;
  if (status === 401) return 'La sesión venció. Vuelve a identificarte.';
  if (status === 403) return 'No tienes permiso para validar esta manga.';
  if (status === 429) return 'Servicio ocupado. Reintenta en unos segundos.';
  if (status >= 500) return 'El servidor no pudo validar la manga. Reintenta.';
  const payload = error?.response?.data || {};
  const code = String(payload?.error?.code || payload?.code || '').toUpperCase();
  if (['KG_LABEL_VERSION_CONFLICT', 'ETIQUETA_VERSION_CONFLICT', 'ETIQUETA_INVALIDADA', 'KG_LABEL_NOT_PRINTABLE'].some((labelCode) => code.includes(labelCode))) {
    return 'Etiqueta sin vigencia. Escanea la actual.';
  }
  if (code.includes('NOT_FOUND') || code.includes('UNKNOWN')) return 'Manga no encontrada.';
  if (code.includes('VERSION') || code.includes('STALE') || code.includes('CONFLICT')) return 'La manga cambió. Escanéala de nuevo.';
  if (code.includes('QUALITY') || code.includes('BLOCKED')) return 'La manga no está liberada para salida.';
  const message = String(error?.message || '').trim();
  if (!error?.response && message && !message.startsWith('{') && !message.startsWith('[')) return message;
  return fallback;
};

const conciseStoredError = (value) => {
  const text = String(value || '').trim();
  if (!text) return 'No se pudo validar la manga.';
  if (/network error|failed to fetch|timeout|offline/i.test(text)) return 'Error de internet. Revisa la conexión y reintenta.';
  if (/KG_LABEL_VERSION_CONFLICT|ETIQUETA_VERSION_CONFLICT|ETIQUETA_INVALIDADA|KG_LABEL_NOT_PRINTABLE/i.test(text)) return 'Etiqueta sin vigencia. Escanea la actual.';
  if (text.startsWith('{') || text.startsWith('[') || /^\d{3}\b/.test(text)) return 'No se pudo validar la manga.';
  return text.length > 140 ? `${text.slice(0, 137)}…` : text;
};

const normalizeRestoredCandidateStatus = (candidate) => {
  if (candidate?.status === 'withdrawn') return 'withdrawn';
  if (candidate?.status === 'needs_revalidation') return 'needs_revalidation';
  if (candidate?.status === 'conflict') {
    if (/ya fue retirada para armado|ya salió a armado/i.test(String(candidate.error || ''))) return 'withdrawn';
    return isTransientNetworkError(new Error(candidate.error || '')) ? 'needs_revalidation' : 'conflict';
  }
  return candidate?.unit?.id || isTransientNetworkError(new Error(candidate?.error || ''))
    ? 'needs_revalidation'
    : 'conflict';
};

const isAlreadyWithdrawn = (unit, error) => {
  const status = unitState(unit).toUpperCase();
  const code = String(error?.response?.data?.error?.code || error?.response?.data?.code || '').toUpperCase();
  return status === 'RETIRADA_ARMADO' || code.includes('ALREADY_WITHDRAWN') || code.includes('ALREADY_RETIRED');
};

const chunkItems = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
};

const reviewFingerprint = (draft, candidates) => JSON.stringify({
  context: draft.context,
  reason: draft.reason.trim(),
  holderId: String(draft.holderId || ''),
  documentType: draft.documentType.trim(),
  documentId: draft.documentId.trim(),
  items: candidates
    .filter((candidate) => candidate.status === 'ready')
    .map((candidate) => ({ id: String(candidate.unit?.id || ''), version: unitVersion(candidate.unit), kg: Number(unitKg(candidate.unit)), code: candidate.code }))
    .sort((left, right) => left.id.localeCompare(right.id)),
});

const isUncertainOperationError = (error) => {
  const status = error?.response?.status;
  const payload = error?.response?.data || {};
  const code = String(payload?.error?.code || payload?.code || payload?.error || '').toUpperCase();
  return status === 403 || status === 404 || code.includes('IDEMPOTENCY') || code.includes('OPERATION_INCOMPLETE');
};

const isCompletedOperation = (payload) => (
  payload
  && payload.estado !== 'PENDIENTE'
  && Array.isArray(payload.retiros)
  && payload.cantidad_unidades !== undefined
  && payload.total_kg !== undefined
);

const parseStorage = (key) => {
  try {
    const value = globalThis.localStorage?.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

function storageWrite(key, value) {
  try {
    if (!globalThis.localStorage) return false;
    const serialized = JSON.stringify(value);
    globalThis.localStorage.setItem(key, serialized);
    return globalThis.localStorage.getItem(key) === serialized;
  } catch {
    return false;
  }
}

function storageRemove(key) {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // A failed cleanup does not make a completed operation unsafe. The next
    // visit can still use the immutable pending record to recover it.
  }
}

const normalizeWorkers = (payload) => (payload?.items || payload || [])
  .filter((worker) => worker?.activo !== false && worker?.id != null);

const candidateLabel = (candidate) => unitHumanLabel(candidate.unit, candidate.code);
const publicScanError = (rawCode, message, unit = null) => {
  const raw = String(rawCode || '').trim();
  const detail = String(message || 'No se pudo validar la manga.');
  const label = unitHumanLabel(unit, rawCode);
  const safeDetail = isRawQrPayload(detail) || detail === raw
    ? 'No se pudo validar la manga escaneada.'
    : detail.includes(raw) ? detail.split(raw).join(label) : detail;
  if (safeDetail.startsWith(`${label} `) || safeDetail.startsWith(`${label}:`)) return safeDetail;
  return `${label}: ${safeDetail}`;
};
const validColorHex = (value) => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value.trim());
const normalizeColorName = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const isTransparentColor = (value) => /^transparente(?:\s+transparente)*$/i.test(normalizeColorName(value));
const outgoingIdentity = (unit) => {
  const identity = unit?.identidad || {};
  const piece = identity.pieza || {};
  const color = identity.color || {};
  return {
    // `m` is the human-facing OF-OT-M identifier supplied by the resolver.
    // Never synthesize it from technical fields: an absent identity must be
    // visible as incomplete rather than silently displaying the KG code.
    m: identity.m || null,
    pieceName: piece.nombre || unit?.articulo?.nombre || '',
    colorName: color.nombre || unit?.color || unit?.color_nombre || 'Color no informado',
    colorHex: color.hex || unit?.color_hex || null,
  };
};

const colorPresentation = (unit) => {
  const identity = outgoingIdentity(unit);
  const transparent = isTransparentColor(identity.colorName);
  const hasHex = validColorHex(identity.colorHex);
  return {
    ...identity,
    colorName: transparent ? 'Transparente' : identity.colorName,
    transparent,
    hasHex,
  };
};

const ColorDot = ({ colorName, colorHex, transparent, hasHex }) => (
  <Box
    aria-label={`Color ${colorName}`}
    sx={{
      width: 22,
      height: 22,
      flex: '0 0 auto',
      borderRadius: '50%',
      border: '1px solid',
      borderColor: 'divider',
      bgcolor: transparent || !hasHex ? 'grey.300' : colorHex,
      ...(transparent ? { backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,.25) 0 2px, transparent 2px 5px)' } : {}),
    }}
  />
);

const ProgressChip = ({ label }) => (
  <Chip
    size="small"
    color="info"
    icon={<CircularProgress size={14} thickness={5} color="inherit" disableShrink aria-hidden="true" />}
    label={label}
    role="status"
    aria-live="polite"
  />
);

/**
 * Outgoing direct batch flow. Scanning only resolves identities and builds a
 * draft. The only mutation is the explicit, single final confirmation.
 */
export default function DirectKgBatchWithdrawals({ readOnly = false }) {
  const { actorId, can } = useScmActor();
  const [draft, setDraft] = useState(emptyDraft);
  const [workers, setWorkers] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [scanReads, setScanReads] = useState([]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [error, setError, feedbackFallback_error] = useOperationMessage("components/DirectKgBatchWithdrawals.jsx:error", { severity: "error", initialValue: '' });
  const [notice, setNotice, feedbackFallback_notice, noticeSeverity] = useOperationMessage("components/DirectKgBatchWithdrawals.jsx:notice", { severity: "success", initialValue: '' });
  const [storageError, setStorageError] = useOperationMessage("components/DirectKgBatchWithdrawals.jsx:storageError", { severity: "error", initialValue: '' });
  const [pending, setPending] = useState(null);
  const [complete, setComplete] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewSnapshot, setReviewSnapshot] = useState(null);
  const [revalidating, setRevalidating] = useState(false);
  const [revalidationTrigger, setRevalidationTrigger] = useState(0);
  const [audioStatus, setAudioStatus] = useState('unavailable');
  const [audioError, setAudioError] = useState('');
  const activeActorRef = useRef(actorId);
  const candidatesRef = useRef([]);
  const sessionGenerationRef = useRef(0);
  const requestRef = useRef(0);
  const confirmLockRef = useRef(false);
  const queueGenerationRef = useRef(0);
  const scanQueueRef = useRef([]);
  const scanReadsRef = useRef([]);
  const scanPendingCodesRef = useRef(new Set());
  const scanReadSeqRef = useRef(0);
  const scanWorkerRef = useRef(false);
  const codeRef = useRef(null);
  const revalidationInFlightRef = useRef(false);
  const reviewSummaryRef = useRef(null);

  const namespace = useMemo(() => `scm-kg-direct-batch:${API_BASE_URL}:${String(actorId)}`, [actorId]);
  const draftKey = `${namespace}:draft`;
  const pendingKey = `${namespace}:pending`;
  const hasCapabilities = !readOnly && can(PREPARE_CAPABILITY) && can(DISPATCH_CAPABILITY);

  const safePlayFeedback = useCallback((kind) => {
    try {
      const played = playScanFeedback(kind);
      if (!played) {
        setAudioStatus('error');
        setAudioError('No se pudo reproducir el feedback sonoro. Continúa con la señal visual o prueba el sonido de nuevo.');
      } else {
        setAudioError('');
      }
      return played;
    } catch {
      setAudioStatus('error');
      setAudioError('No se pudo reproducir el feedback sonoro. Continúa con la señal visual o prueba el sonido de nuevo.');
      return false;
    }
  }, []);

  useEffect(() => subscribeScanAudio(setAudioStatus), []);

  useEffect(() => {
    activeActorRef.current = actorId;
    sessionGenerationRef.current += 1;
    confirmLockRef.current = false;
    setBusy(false);
    setConfirming(false);
    setReviewing(false);
    setReviewSnapshot(null);
    setStorageError('');
  }, [actorId, setStorageError]);

  useEffect(() => {
    requestRef.current += 1;
    queueGenerationRef.current += 1;
    scanQueueRef.current = [];
    scanWorkerRef.current = false;
    scanReadsRef.current = [];
    scanPendingCodesRef.current = new Set();
    setScanReads([]);
    const savedDraft = parseStorage(draftKey);
    const savedPending = parseStorage(pendingKey);
    const restoredCandidates = (savedDraft?.candidates || []).map((candidate) => ({
      ...candidate,
      status: normalizeRestoredCandidateStatus(candidate),
    }));
    setDraft({ ...emptyDraft, ...savedDraft });
    setCandidates(restoredCandidates);
    setRevalidationTrigger(!savedPending && restoredCandidates.some((candidate) => candidate.status === 'needs_revalidation') ? 1 : 0);
    setCode('');
    setWorkers([]);
    setLoadingWorkers(false);
    setError('');
    setNotice('');
    setComplete(null);
    setPending(savedPending);
    setReviewing(false);
    setReviewSnapshot(null);
  }, [actorId, draftKey, pendingKey, setError, setNotice]);

  useEffect(() => {
    const handleOnline = () => {
      if (candidatesRef.current.some((candidate) => candidate.status === 'needs_revalidation')) {
        setRevalidationTrigger((value) => value + 1);
        setNotice('Conexión recuperada. El sistema revalidará la selección antes de permitir confirmar.', { severity: 'info', persistent: true });
      }
    };
    globalThis.addEventListener?.('online', handleOnline);
    return () => globalThis.removeEventListener?.('online', handleOnline);
  }, [setNotice]);

  useEffect(() => {
    candidatesRef.current = candidates;
  }, [candidates]);

  useEffect(() => {
    if (!reviewing) return;
    requestAnimationFrame(() => {
      reviewSummaryRef.current?.scrollIntoView?.({ behavior: 'auto', block: 'start' });
      reviewSummaryRef.current?.focus?.();
    });
  }, [reviewing]);

  const persistDraft = useCallback((nextDraft, nextCandidates) => {
    const payload = {
      ...nextDraft,
      candidates: nextCandidates.map((candidate) => ({
        code: candidate.code,
        unit: candidate.unit,
        status: candidate.status,
        error: candidate.error,
        resolvedAt: candidate.resolvedAt,
      })),
      savedAt: new Date().toISOString(),
    };
    if (!storageWrite(draftKey, payload)) {
      setStorageError('No se pudo guardar el borrador local. Libera espacio o habilita almacenamiento antes de confirmar.');
      return false;
    }
    setStorageError('');
    return true;
  }, [draftKey, setStorageError]);

  const updateDraft = (patch) => {
    setDraft((current) => {
      const next = { ...current, ...patch };
      persistDraft(next, candidates);
      return next;
    });
  };

  const activateAudio = useCallback(async ({ playTest = true } = {}) => {
    setAudioError('');
    const ready = await activateScanAudio();
    setAudioStatus(ready ? 'ready' : getScanAudioStatus());
    if (!ready) {
      setAudioError('No se pudo activar el sonido. Revisa el permiso del navegador y vuelve a probar.');
      return false;
    }
    if (!playTest) return true;
    return safePlayFeedback('accepted');
  }, [safePlayFeedback]);

  useEffect(() => {
    const recoverAudio = () => {
      if (audioStatus !== 'ready' || getScanAudioStatus() !== 'ready') void activateAudio({ playTest: false });
    };
    const onVisibilityChange = () => {
      if (globalThis.document?.visibilityState === 'visible') recoverAudio();
    };
    globalThis.addEventListener?.('focus', recoverAudio);
    globalThis.document?.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      globalThis.removeEventListener?.('focus', recoverAudio);
      globalThis.document?.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [activateAudio, audioStatus]);

  const loadWorkers = useCallback(async () => {
    if (workers.length || loadingWorkers) return;
    const requestedActor = actorId;
    const requestedGeneration = sessionGenerationRef.current;
    setLoadingWorkers(true);
    try {
      const payload = await listarTrabajadoresWorkspace();
      if (activeActorRef.current === requestedActor && sessionGenerationRef.current === requestedGeneration) setWorkers(normalizeWorkers(payload));
    } catch (requestError) {
      if (activeActorRef.current === requestedActor && sessionGenerationRef.current === requestedGeneration) {
        setError(mensajeErrorScm(requestError, 'No se pudo cargar el catálogo de tenedores físicos.'));
      }
    } finally {
      if (activeActorRef.current === requestedActor && sessionGenerationRef.current === requestedGeneration) setLoadingWorkers(false);
    }
  }, [actorId, loadingWorkers, workers.length, setError]);

  const patchScanRead = useCallback((readId, patch) => {
    const next = scanReadsRef.current.map((read) => (read.id === readId ? { ...read, ...patch } : read));
    scanReadsRef.current = next;
    setScanReads(next);
  }, []);

  const removeScanRead = useCallback((readId) => {
    const next = scanReadsRef.current.filter((read) => read.id !== readId);
    scanReadsRef.current = next;
    setScanReads(next);
  }, []);

  const clearScanReads = useCallback(() => {
    scanReadsRef.current = [];
    scanPendingCodesRef.current = new Set();
    setScanReads([]);
  }, []);

  const resolveCode = useCallback(async (rawCode, readId) => {
    const value = rawCode.trim();
    if (!value) return;
    patchScanRead(readId, { status: 'validating' });
    const requestedActor = actorId;
    const requestedGeneration = sessionGenerationRef.current;
    const requestId = ++requestRef.current;
    let resolvedUnit = null;
    try {
      const result = await kgApi.resolveKgOutgoingUnit(value);
      if (activeActorRef.current !== requestedActor || sessionGenerationRef.current !== requestedGeneration || requestRef.current < requestId) return;
      const unit = result?.unit || result?.unidad || result;
      resolvedUnit = unit;
      if (!unit?.id) throw new Error('La respuesta no contiene una identidad KG.');
      const eligibilityError = outgoingEligibilityError(unit, value);
      if (eligibilityError) throw new Error(eligibilityError);
      const duplicateRead = scanReadsRef.current.find((read) => read.status === 'accepted' && String(read.unit?.id) === String(unit.id));
      if (duplicateRead) {
        setNotice(`${unitHumanLabel(unit, value)} ya está aceptada.`);
        setError('');
        safePlayFeedback('duplicate');
        removeScanRead(readId);
        return;
      }
      const duplicateCandidate = candidatesRef.current.some((candidate) => String(candidate.unit?.id) === String(unit.id));
      if (duplicateCandidate) {
        setNotice(`${unitHumanLabel(unit, value)} ya está aceptada.`);
        setError('');
        safePlayFeedback('duplicate');
        removeScanRead(readId);
        return;
      }
      setCandidates((current) => {
        if (current.some((candidate) => String(candidate.unit?.id) === String(unit.id))) {
          return current;
        }
        const next = [...current, {
          code: value,
          unit,
          scanId: readId,
          status: 'ready',
          resolvedAt: new Date().toISOString(),
        }];
        persistDraft(draft, next);
        candidatesRef.current = next;
        return next;
      });
      patchScanRead(readId, { status: 'accepted', unit });
      safePlayFeedback('accepted');
      setError('');
    } catch (requestError) {
      if (activeActorRef.current !== requestedActor || sessionGenerationRef.current !== requestedGeneration) return;
      const message = conciseRequestError(requestError, mensajeErrorScm(requestError, `No se pudo validar ${value}.`));
      const publicMessage = publicScanError(value, message, resolvedUnit);
      setError(publicMessage);
      safePlayFeedback('rejected');
      const persistedMessage = isRawQrPayload(value) ? publicMessage : message;
      const transient = isTransientNetworkError(requestError);
      patchScanRead(readId, { status: 'conflict', error: persistedMessage, unit: resolvedUnit });
      setCandidates((current) => {
        if (current.some((candidate) => candidate.code === value && candidate.status === (transient ? 'needs_revalidation' : 'conflict'))) return current;
        const next = [...current, { code: value, scanId: readId, status: transient ? 'needs_revalidation' : 'conflict', error: persistedMessage, unit: resolvedUnit }];
        persistDraft(draft, next);
        return next;
      });
    }
  }, [actorId, draft, patchScanRead, persistDraft, removeScanRead, safePlayFeedback, setNotice, setError]);

  const runScanQueue = useCallback(async () => {
    if (scanWorkerRef.current) return;
    scanWorkerRef.current = true;
    setBusy(true);
    const generation = queueGenerationRef.current;
    const queue = scanQueueRef.current;
    while (queue.length && generation === queueGenerationRef.current) {
      const nextRead = queue.shift();
      patchScanRead(nextRead.id, { status: 'validating' });
      // Sequential resolution preserves every scanner input without dropping
      // characters while the previous identity request is in flight.
      await resolveCode(nextRead.code, nextRead.id);
      scanPendingCodesRef.current.delete(nextRead.code);
    }
    if (generation === queueGenerationRef.current) {
      scanWorkerRef.current = false;
      setBusy(false);
      requestAnimationFrame(() => codeRef.current?.focus());
    }
  }, [patchScanRead, resolveCode]);

  const enqueueScan = (rawCode) => {
    const value = rawCode.trim();
    if (!value || pending || complete || confirming || confirmLockRef.current) return;
    const duplicateRead = scanReadsRef.current.some((read) => read.code === value);
    if (duplicateRead) {
      const existingRead = scanReadsRef.current.find((read) => read.code === value);
      if (existingRead?.status === 'conflict') {
        setError(`${scanLabel(value)} ya tiene un error pendiente. Usa Reintentar o Retirar.`);
        setNotice('');
      } else if (existingRead?.status === 'accepted') {
        setNotice(`${scanLabel(value)} ya está aceptada.`);
        setError('');
      } else {
        setNotice(`${scanLabel(value)} está pendiente de validación.`, { severity: 'info', persistent: true });
        setError('');
      }
      safePlayFeedback('duplicate');
      setCode('');
      return;
    }
    const pendingReads = scanReadsRef.current.filter((read) => read.status === 'waiting' || read.status === 'validating').length;
    if (scanPendingCodesRef.current.has(value)) {
      setNotice(`${scanLabel(value)} está pendiente de validación.`, { severity: 'info', persistent: true });
      setError('');
      safePlayFeedback('duplicate');
      setCode('');
      return;
    }
    if (pendingReads >= SCAN_QUEUE_LIMIT) {
      setNotice(`La cola esta llena (${SCAN_QUEUE_LIMIT}). Conserva la lectura en el campo y reintenta cuando avance.`, { severity: 'warning', persistent: true });
      setCode(value);
      requestAnimationFrame(() => codeRef.current?.focus());
      return;
    }
    const read = { id: `scan-${++scanReadSeqRef.current}`, code: value, status: 'waiting' };
    const nextReads = [...scanReadsRef.current, read];
    scanReadsRef.current = nextReads;
    setScanReads(nextReads);
    scanPendingCodesRef.current.add(value);
    setCode('');
    setNotice('');
    scanQueueRef.current.push(read);
    runScanQueue();
  };

  const retryScanRead = (read) => {
    if (!scanReadsRef.current.some((item) => item.id === read.id)) return;
    removeReadCandidate(read);
    enqueueScan(read.code);
  };

  const removeReadCandidate = (read) => {
    removeScanRead(read.id);
    scanPendingCodesRef.current.delete(read.code);
    const next = candidatesRef.current.filter((candidate) => candidate.scanId !== read.id && candidate.code !== read.code);
    candidatesRef.current = next;
    setCandidates(next);
    persistDraft(draft, next);
    requestAnimationFrame(() => codeRef.current?.focus());
  };

  const removeCandidate = (candidate) => {
    if (candidate.scanId) removeScanRead(candidate.scanId);
    const next = candidatesRef.current.filter((item) => item !== candidate);
    candidatesRef.current = next;
    setCandidates(next);
    persistDraft(draft, next);
    requestAnimationFrame(() => codeRef.current?.focus());
  };

  const buildBody = (items) => ({
    items: items.map((candidate) => ({ unit_id: candidate.unit.id, version: unitVersion(candidate.unit) })),
    motivo_operativo: draft.reason.trim(),
    tenedor_fisico_id: Number(draft.holderId),
    ...(draft.documentType.trim() ? { documento_destino_tipo: draft.documentType.trim() } : {}),
    ...(draft.documentId.trim() ? { documento_destino_id: draft.documentId.trim() } : {}),
  });

  const revalidateCandidates = useCallback(async ({ automatic = false, onlyPending = false } = {}) => {
    if (revalidationInFlightRef.current) return null;
    revalidationInFlightRef.current = true;
    setRevalidating(true);
    setBusy(true);
    const requestedActor = actorId;
    const requestedGeneration = sessionGenerationRef.current;
    const checked = [];
    try {
      // Keep the network work bounded while retaining FIFO GETs. There is no
      // bulk endpoint and, critically, this path never creates a withdrawal.
      for (const chunk of chunkItems(candidates, REVALIDATION_CHUNK_SIZE)) {
        for (const candidate of chunk) {
          if (candidate.status === 'conflict' || candidate.status === 'withdrawn') {
            checked.push(candidate);
            continue;
          }
          if (onlyPending && candidate.status === 'ready') {
            checked.push(candidate);
            continue;
          }
          let currentUnit = candidate.unit;
          try {
            const result = await kgApi.resolveKgOutgoingUnit(candidate.code);
            if (activeActorRef.current !== requestedActor || sessionGenerationRef.current !== requestedGeneration) throw new Error('La identidad activa cambió.');
            currentUnit = result?.unit || result?.unidad || result;
            if (candidate.unit?.id && (String(currentUnit?.id) !== String(candidate.unit.id)
              || unitVersion(currentUnit) !== unitVersion(candidate.unit))) {
              throw new Error(`${candidateLabel(candidate)} cambió mientras se revisaba. Retíralo y escanéalo de nuevo.`);
            }
            const eligibilityError = outgoingEligibilityError(currentUnit, candidateLabel(candidate));
            if (eligibilityError) throw new Error(eligibilityError);
            if (!ELIGIBLE_STATES.has(unitState(currentUnit))) {
              throw new Error(`${candidateLabel(candidate)} ya no está disponible para salida.`);
            }
            if (unitKg(currentUnit) == null) throw new Error(`${candidateLabel(candidate)} no tiene KG verificados.`);
            if (currentUnit.estado_calidad && !ELIGIBLE_QUALITY.has(currentUnit.estado_calidad)) {
              throw new Error(`${candidateLabel(candidate)} no está liberada para salida.`);
            }
            const canonicalDuplicate = checked.find((item) => (
              item.status === 'ready' && String(item.unit?.id) === String(currentUnit.id)
            ));
            if (canonicalDuplicate) {
              if (candidate.scanId) removeScanRead(candidate.scanId);
              continue;
            }
            checked.push({ ...candidate, unit: currentUnit, status: 'ready', error: '' });
            if (candidate.scanId) patchScanRead(candidate.scanId, { status: 'accepted', unit: currentUnit, error: '' });
          } catch (candidateError) {
            if (activeActorRef.current !== requestedActor || sessionGenerationRef.current !== requestedGeneration) throw candidateError;
            const status = isAlreadyWithdrawn(currentUnit, candidateError)
              ? 'withdrawn'
              : isTransientNetworkError(candidateError) ? 'needs_revalidation' : 'conflict';
            const displayUnit = status === 'withdrawn' ? (currentUnit || candidate.unit) : candidate.unit;
            const failed = {
              ...candidate,
              unit: displayUnit,
              status,
              error: publicScanError(candidate.code, conciseRequestError(candidateError, 'No se pudo revalidar.'), displayUnit),
            };
            checked.push(failed);
            if (status !== 'needs_revalidation') safePlayFeedback('rejected');
            if (candidate.scanId) patchScanRead(candidate.scanId, { status: 'conflict', unit: displayUnit, error: failed.error });
          }
        }
      }
      if (activeActorRef.current !== requestedActor || sessionGenerationRef.current !== requestedGeneration) return null;
      candidatesRef.current = checked;
      setCandidates(checked);
      persistDraft(draft, checked);
      if (checked.some((candidate) => candidate.status === 'needs_revalidation')) {
        setNotice(automatic
          ? 'No se pudo completar la revalidación por conectividad. Puedes reintentar; la salida sigue sin enviarse.'
          : 'La revalidación sigue pendiente. Revisa la conexión y reintenta antes de confirmar.', { severity: 'warning', persistent: true });
      }
      return checked;
    } finally {
      revalidationInFlightRef.current = false;
      setRevalidating(false);
      if (!confirmLockRef.current) setBusy(false);
    }
  }, [actorId, candidates, draft, patchScanRead, persistDraft, removeScanRead, safePlayFeedback, setNotice]);

  useEffect(() => {
    if (!revalidationTrigger || revalidating || !candidates.some((candidate) => candidate.status === 'needs_revalidation')) return;
    setRevalidationTrigger(0);
    void revalidateCandidates({ automatic: true }).catch(() => {});
  }, [candidates, revalidationTrigger, revalidating, revalidateCandidates]);

  const ensureHolderIsCurrent = async ({ refresh = false } = {}) => {
    const known = workers.find((worker) => String(worker.id) === String(draft.holderId));
    if (known && !refresh) return true;
    const requestedActor = actorId;
    const requestedGeneration = sessionGenerationRef.current;
    const payload = await listarTrabajadoresWorkspace();
    if (activeActorRef.current !== requestedActor || sessionGenerationRef.current !== requestedGeneration) return false;
    const nextWorkers = normalizeWorkers(payload);
    setWorkers(nextWorkers);
    return nextWorkers.some((worker) => String(worker.id) === String(draft.holderId));
  };

  const sendPending = async (intent, recovery = false) => {
    if (readOnly) {
      setError('Esta vista es de solo lectura.');
      return;
    }
    if (!hasCapabilities) {
      setError('Se requieren las capacidades PICKING_PREPARAR y PICKING_DESPACHAR para confirmar.');
      return;
    }
    const requestedActor = actorId;
    const requestedGeneration = sessionGenerationRef.current;
    if (globalThis.navigator && globalThis.navigator.onLine === false) {
      setError('Sin conexión. La salida sigue sin confirmar y no se enviará automáticamente.');
      return;
    }
    setBusy(true);
    setError('');
    let recoveryLookup = false;
    try {
      if (recovery && intent.operation_id) {
        recoveryLookup = true;
        try {
          const recovered = await kgApi.obtenerOperacionRetiroArmadoKgLote(intent.operation_id);
          if (activeActorRef.current !== requestedActor || sessionGenerationRef.current !== requestedGeneration) return;
          if (!isCompletedOperation(recovered)) {
            throw new Error('La operación recuperada aún no está completa. Conserva la misma solicitud.');
          }
          storageRemove(pendingKey);
          setPending(null);
          setComplete(recovered);
          safePlayFeedback('confirmed');
          setCandidates([]);
          clearScanReads();
          storageRemove(draftKey);
          setNotice('');
          return;
        } catch (recoveryError) {
          if (recoveryError?.response?.status !== 404) throw recoveryError;
          recoveryLookup = false;
          // 404 means the operation id is unknown; replay the immutable body
          // with the same key instead of creating a new intent.
        }
      }
      if (activeActorRef.current !== requestedActor || sessionGenerationRef.current !== requestedGeneration) return;
      const response = await kgApi.crearRetiroArmadoKgLote(intent.body, intent.key);
      if (activeActorRef.current !== requestedActor || sessionGenerationRef.current !== requestedGeneration) return;
      if (!isCompletedOperation(response)) throw new Error('La respuesta no confirma la salida completa. Conserva la misma solicitud.');
      storageRemove(pendingKey);
      setPending(null);
      setComplete(response);
      safePlayFeedback('confirmed');
      setCandidates([]);
      clearScanReads();
      storageRemove(draftKey);
      setNotice('');
    } catch (requestError) {
      if (activeActorRef.current !== requestedActor || sessionGenerationRef.current !== requestedGeneration) return;
      const operationId = requestError?.response?.data?.operation_id;
      const nextIntent = operationId ? { ...intent, operation_id: operationId } : intent;
      if (storageWrite(pendingKey, nextIntent)) setPending(nextIntent);
      else setStorageError('No se pudo conservar la solicitud pendiente. No se puede continuar sin recuperación local.');
      setError(mensajeErrorScm(requestError, 'No se confirmó la salida. Conserve la misma solicitud y recupérela.'));
      if (isDefinitive4xx(requestError) && !recoveryLookup && !isUncertainOperationError(requestError)) {
        storageRemove(pendingKey);
        setPending(null);
      }
    } finally {
      if (activeActorRef.current === requestedActor && sessionGenerationRef.current === requestedGeneration) setBusy(false);
    }
  };

  const confirm = async () => {
    if (readOnly || confirmLockRef.current) return;
    confirmLockRef.current = true;
    setConfirming(true);
    setBusy(true);
    const requestedActor = actorId;
    const requestedGeneration = sessionGenerationRef.current;
    try {
    if ((!reviewing && busy) || pending || complete || scanReadsRef.current.some((read) => read.status === 'waiting' || read.status === 'validating')) return;
    if (!draft.reason.trim() || !draft.holderId) {
      setError('Completa motivo operativo y tenedor físico antes de revisar.');
      return;
    }
    if ((draft.documentType.trim() && !draft.documentId.trim())
      || (!draft.documentType.trim() && draft.documentId.trim())) {
      setError('Completa tipo e ID del documento destino, o deja ambos vacíos.');
      return;
    }
    if (!hasCapabilities) {
      setError('Se requieren las capacidades PICKING_PREPARAR y PICKING_DESPACHAR para confirmar.');
      return;
    }
    if (globalThis.navigator && globalThis.navigator.onLine === false) {
      setError('Sin conexión. La selección queda en revisión; reconecta antes de confirmar.');
      return;
    }
    if (candidates.length === 0 || candidates.some((candidate) => candidate.status === 'conflict' || candidate.status === 'withdrawn')) {
      setError('Retira cada candidato en conflicto o ya retirado antes de confirmar.');
      return;
    }
    if (reviewing) {
      const holderIsCurrent = await ensureHolderIsCurrent({ refresh: true }).catch((requestError) => {
        setError(mensajeErrorScm(requestError, 'No se pudo comprobar el tenedor. Revisa la conexión y reintenta.'));
        return null;
      });
      if (activeActorRef.current !== requestedActor || sessionGenerationRef.current !== requestedGeneration) return;
      if (holderIsCurrent === null) {
        requestAnimationFrame(() => codeRef.current?.focus());
        return;
      }
      if (!holderIsCurrent) {
        setReviewing(false);
        setReviewSnapshot(null);
        setError('Selecciona un tenedor físico vigente para Armado.');
        requestAnimationFrame(() => codeRef.current?.focus());
        return;
      }
    }
    const checked = await revalidateCandidates({ onlyPending: !reviewing }).catch((requestError) => {
      if (activeActorRef.current !== requestedActor || sessionGenerationRef.current !== requestedGeneration) return null;
      setError(requestError.message || 'La selección cambió. Revisa la lista antes de confirmar.');
      setCandidates((current) => {
        const next = current.map((candidate) => ({
          ...candidate,
          status: candidate.unit ? (isAlreadyWithdrawn(candidate.unit, requestError) ? 'withdrawn' : 'conflict') : candidate.status,
          error: candidate.unit ? requestError.message : candidate.error,
        }));
        persistDraft(draft, next);
        return next;
      });
      return null;
    });
    if (activeActorRef.current !== requestedActor || sessionGenerationRef.current !== requestedGeneration) return;
    if (!checked?.length || checked.length !== candidates.length) return;
    if (checked.some((candidate) => candidate.status !== 'ready')) {
      setReviewing(false);
      setReviewSnapshot(null);
      setCandidates(checked);
      persistDraft(draft, checked);
      setError('Retira o resuelve los candidatos bloqueados antes de confirmar.');
      requestAnimationFrame(() => codeRef.current?.focus());
      return;
    }
    if (!reviewing) {
      setReviewSnapshot({
        actorId,
        generation: requestedGeneration,
        fingerprint: reviewFingerprint(draft, checked),
        candidates: checked.map((candidate) => ({
          code: candidate.code,
          id: String(candidate.unit.id),
          version: unitVersion(candidate.unit),
          kg: Number(unitKg(candidate.unit)),
          label: unitHumanLabel(candidate.unit, candidate.code),
        })),
      });
      setReviewing(true);
      return;
    }
    if (!reviewSnapshot
      || reviewSnapshot.actorId !== actorId
      || reviewSnapshot.generation !== requestedGeneration
      || reviewSnapshot.fingerprint !== reviewFingerprint(draft, checked)) {
      setReviewing(false);
      setReviewSnapshot(null);
      setError('La revisión quedó obsoleta. Revisa nuevamente la selección antes de confirmar.');
      requestAnimationFrame(() => codeRef.current?.focus());
      return;
    }
    const body = buildBody(checked);
    const key = crypto.randomUUID();
    const intent = { key, operation_id: key, body, actorId, createdAt: new Date().toISOString() };
    if (!storageWrite(pendingKey, intent)) {
      setStorageError('No se pudo guardar la solicitud pendiente. La salida está bloqueada hasta recuperar almacenamiento local.');
      return;
    }
    setPending(intent);
    await sendPending(intent);
    } finally {
      if (activeActorRef.current === requestedActor && sessionGenerationRef.current === requestedGeneration) {
        confirmLockRef.current = false;
        setConfirming(false);
        if (!pending) setBusy(false);
      }
    }
  };

  const selectedKg = candidates
    .filter((candidate) => candidate.status === 'ready')
    .reduce((sum, candidate) => sum + Number(unitKg(candidate.unit) || 0), 0);
  const hasConflict = candidates.some((candidate) => candidate.status === 'conflict');
  const hasWithdrawn = candidates.some((candidate) => candidate.status === 'withdrawn');
  const hasNeedsRevalidation = candidates.some((candidate) => candidate.status === 'needs_revalidation');
  const pendingScanCount = scanReads.filter((read) => read.status === 'waiting' || read.status === 'validating').length;
  const acceptedScanCount = scanReads.filter((read) => read.status === 'accepted').length;
  const rejectedScanCount = scanReads.filter((read) => read.status === 'conflict'
    && !candidates.some((candidate) => candidate.scanId === read.id && candidate.status === 'needs_revalidation')).length;
  const conflictCount = candidates.filter((candidate) => candidate.status === 'conflict').length;
  const withdrawnCount = candidates.filter((candidate) => candidate.status === 'withdrawn').length;
  const needsRevalidationCount = candidates.filter((candidate) => candidate.status === 'needs_revalidation').length;
  const displayedCandidates = candidates.filter((candidate) => !candidate.scanId);
  const startNew = () => {
    setComplete(null);
    setPending(null);
    setReviewing(false);
    setReviewSnapshot(null);
    setDraft(emptyDraft);
    setCandidates([]);
    clearScanReads();
    setCode('');
    setError('');
    setNotice('');
    setStorageError('');
    storageRemove(draftKey);
    requestAnimationFrame(() => codeRef.current?.focus());
  };

  return <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }} aria-label="Salida directa de KG a Armado">
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5" fontWeight={850}>Salida directa a Armado</Typography>
        <Typography color="text.secondary">Elige el destino una vez, escanea cada manga y confirma la salida del lote.</Typography>
      </Box>
      {!hasCapabilities && <Alert severity="warning">Para confirmar se necesitan PICKING_PREPARAR y PICKING_DESPACHAR. Puedes revisar la selección mientras se habilitan ambas capacidades.</Alert>}
      {storageError && (
        <Alert severity="error" role="alert" data-testid="storage-error-inline">
          {storageError} La confirmación permanece bloqueada hasta recuperar el almacenamiento local.
        </Alert>
      )}
      {error && <>{feedbackFallback_error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}</>}
      {notice && <>{feedbackFallback_notice && <Alert severity={noticeSeverity} onClose={() => setNotice('')}>{notice}</Alert>}</>}
      {complete && <Alert severity="success" action={<Button sx={{ minWidth: 44, minHeight: 44 }} onClick={startNew} disabled={readOnly}>Nueva salida</Button>}>Salida <strong>{complete.operation_id}</strong> confirmada: {complete.cantidad_unidades ?? complete.retiros?.length ?? 0} unidad(es), {complete.total_kg ?? '-'} KG.</Alert>}
      {pending && <Alert severity="warning" action={<Button sx={{ minWidth: 44, minHeight: 44 }} startIcon={<RestoreIcon />} onClick={() => sendPending(pending, true)} disabled={busy}>Recuperar</Button>}>
        Hay una solicitud sin resultado confirmado. Puedes reintentar la misma salida desde aquí.
      </Alert>}
      {revalidating && <Alert severity="info" role="status">Revalidando selección en segundo plano. Es una tarea del sistema; no se enviará la salida hasta completar todos los GET.</Alert>}
      {reviewing && reviewSnapshot && <Paper ref={reviewSummaryRef} tabIndex={-1} component="section" role="region" aria-label="Resumen de salida" variant="outlined" sx={{ p: 1.5 }}>
        <Stack spacing={1.25}>
          <Typography variant="h6">Revisa la salida</Typography>
          <Typography variant="body1" fontWeight={750}>Total: {reviewSnapshot.candidates.reduce((sum, item) => sum + item.kg, 0).toLocaleString('es-PE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KG</Typography>
          <Typography variant="body2"><strong>Destinatario:</strong> {draft.holderName || `Tenedor seleccionado #${draft.holderId}`}</Typography>
          <Typography variant="body2"><strong>Motivo:</strong> {draft.reason}</Typography>
          <Typography variant="subtitle2">Mangas ({reviewSnapshot.candidates.length})</Typography>
          <Stack component="ul" role="list" aria-label="Mangas del resumen" tabIndex={0} spacing={0.5} sx={{ m: 0, pl: 2, maxHeight: 240, overflowY: 'auto', pr: 1 }}>
            {reviewSnapshot.candidates.map((item) => <Typography component="li" key={`${item.id}-${item.version}`} variant="body2">{item.label} · {item.kg.toLocaleString('es-PE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KG</Typography>)}
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant="outlined" onClick={() => { setReviewing(false); setReviewSnapshot(null); setNotice(''); requestAnimationFrame(() => codeRef.current?.focus()); }} disabled={busy || confirming}>Volver a editar</Button>
            <Button variant="contained" color="success" onClick={() => void confirm()} disabled={readOnly || confirming || revalidating || !!pending || !!complete || !!storageError || !hasCapabilities}>Confirmar salida a Armado</Button>
          </Stack>
        </Stack>
      </Paper>}
      {!revalidating && hasNeedsRevalidation && <Alert severity="warning" role="status" action={<Button sx={{ minWidth: 44, minHeight: 44 }} onClick={() => void revalidateCandidates()} disabled={busy || !!pending || !!complete}>Reintentar validación</Button>}>
        {needsRevalidationCount} manga(s) necesitan revalidación. Las mangas siguen en la selección; se revisarán al recuperar la conexión. La salida permanece bloqueada y no se envía parcialmente.
      </Alert>}
      {hasWithdrawn && <Alert severity="error" role="alert">
        {withdrawnCount === 1 ? '1 manga ya salió a Armado.' : `${withdrawnCount} mangas ya salieron a Armado.`} Usa “Quitar del lote” en las mangas que ya salieron; esa acción no mueve stock.
      </Alert>}
      {audioStatus === 'suspended' && <Alert severity="warning" role="status" action={<Button sx={{ minWidth: 44, minHeight: 44 }} onClick={() => activateAudio()}>Activar y probar sonido</Button>}>El sonido de lectura está suspendido. Puedes activarlo para recibir feedback.</Alert>}
      {audioStatus === 'unavailable' && <Alert severity="info" role="status">Sonido no disponible; puedes continuar con feedback visual.</Alert>}
      {audioStatus === 'error' && <Alert severity="warning" role="status" action={<Button sx={{ minWidth: 44, minHeight: 44 }} onClick={() => activateAudio()}>Activar y probar sonido</Button>}>{audioError || 'No se pudo reproducir el feedback sonoro.'}</Alert>}

      <Box sx={{ display: reviewing ? 'none' : 'block' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <FormControl fullWidth>
          <InputLabel id="direct-kg-context-label">Destino operativo</InputLabel>
          <Select labelId="direct-kg-context-label" label="Destino operativo" value={draft.context} disabled={readOnly || busy || reviewing || !!pending || !!complete} onChange={(event) => updateDraft({ context: event.target.value })}>
            <MenuItem value="ARMADO">Armado</MenuItem>
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel id="direct-kg-holder-label">Quién recibe en Armado</InputLabel>
          <Select labelId="direct-kg-holder-label" label="Quién recibe en Armado" value={draft.holderId} disabled={readOnly || busy || reviewing || !!pending || !!complete || loadingWorkers} onOpen={loadWorkers} onChange={(event) => {
            const worker = workers.find((item) => String(item.id) === String(event.target.value));
            updateDraft({ holderId: event.target.value, holderName: worker ? asWorkerName(worker) : draft.holderName });
          }}>
            {draft.holderId && !workers.some((worker) => String(worker.id) === String(draft.holderId)) && <MenuItem value={draft.holderId}>{draft.holderName || `Tenedor seleccionado #${draft.holderId}`}</MenuItem>}
            {workers.map((worker) => <MenuItem key={worker.id} value={worker.id}>{asWorkerName(worker)}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField fullWidth label="Motivo operativo" value={draft.reason} disabled={readOnly || busy || reviewing || !!pending || !!complete} onChange={(event) => updateDraft({ reason: event.target.value })} />
      </Stack>
      <details>
        <summary>Agregar documento destino (opcional)</summary>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 1.5 }}>
          <TextField fullWidth label="Documento destino (tipo)" value={draft.documentType} disabled={readOnly || busy || reviewing || !!pending || !!complete} onChange={(event) => updateDraft({ documentType: event.target.value })} />
          <TextField fullWidth label="Documento destino (ID)" value={draft.documentId} disabled={readOnly || busy || reviewing || !!pending || !!complete} onChange={(event) => updateDraft({ documentId: event.target.value })} />
        </Stack>
      </details>

      <Divider />
      <Stack component="form" direction={{ xs: 'column', sm: 'row' }} spacing={1.5} onSubmit={(event) => { event.preventDefault(); enqueueScan(code); }}>
        <TextField
          inputRef={codeRef}
          fullWidth
          autoFocus
          label="Escanear QR de manga KG"
          helperText="Presiona Enter para agregar; el escaneo no cambia stock."
          value={code}
          disabled={readOnly || reviewing || confirming || revalidating || !!pending || !!complete}
          onChange={(event) => setCode(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              if (audioStatus !== 'ready') void activateAudio({ playTest: false });
              enqueueScan(event.target.value || code);
            }
          }}
        />
        <Button type="submit" variant="outlined" startIcon={<QrCodeScannerIcon />} sx={{ minWidth: 44, minHeight: 44 }} disabled={readOnly || reviewing || confirming || revalidating || !!pending || !!complete || !code.trim()}>Agregar manga</Button>
      </Stack>

      {scanReads.length > 0 && <Stack component="ul" role="list" aria-label="Lecturas pendientes" spacing={1} sx={{ p: 0, m: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: '1fr', '@media (min-width:600px)': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }, gap: 1 }}>
        {scanReads.map((read) => <Paper component="li" role="listitem" key={read.id} variant="outlined" sx={{ p: 1.25, minWidth: 0 }}>
          {read.status === 'waiting' && <Stack direction="row" justifyContent="space-between" flexWrap="wrap" sx={{ minWidth: 0 }}><Typography sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{scanLabel(read.code)}</Typography><ProgressChip label="En espera" /></Stack>}
          {read.status === 'validating' && <Stack direction="row" justifyContent="space-between" flexWrap="wrap" sx={{ minWidth: 0 }}><Typography sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{scanLabel(read.code)}</Typography><ProgressChip label="Validando" /></Stack>}
          {read.status === 'accepted' && (() => {
            const identity = colorPresentation(read.unit);
            const label = identity.m || 'Identidad incompleta';
            const pieceName = identity.pieceName || 'Pieza no informada';
            return <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} sx={{ minWidth: 0, flexWrap: 'wrap' }}>
              <Box sx={{ minWidth: 0, flex: '1 1 0', overflowWrap: 'anywhere' }}>
                <Typography fontWeight={750} sx={{ overflowWrap: 'anywhere' }}>{label}</Typography>
                <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{pieceName}</Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                  <ColorDot {...identity} />
                  <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{identity.colorName}</Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary" display="block">{unitKg(read.unit) ?? '-'} KG verificados</Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ minWidth: 0 }}><Chip size="small" label="Lista para enviar" color="success" role="status" aria-live="polite" /><Button size="small" color="error" sx={{ minWidth: 44, minHeight: 44 }} disabled={readOnly || busy || confirming || !!pending || !!complete} onClick={() => removeReadCandidate(read)} aria-label={`Quitar del lote ${identity.m || scanLabel(read.code)}`}>Quitar del lote</Button></Stack>
            </Stack>;
          })()}
          {read.status === 'conflict' && <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} sx={{ minWidth: 0, flexWrap: 'wrap' }}>
            <Box sx={{ minWidth: 0, flex: '1 1 0', overflowWrap: 'anywhere' }}><Typography fontWeight={750} sx={{ overflowWrap: 'anywhere' }}>{unitHumanLabel(read.unit, read.code)}</Typography><Typography variant="body2" color="error" sx={{ overflowWrap: 'anywhere' }}>{conciseStoredError(read.error || 'No se pudo validar.')}</Typography></Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ minWidth: 0 }}><Button size="small" sx={{ minWidth: 44, minHeight: 44 }} disabled={readOnly || busy || confirming || !!pending || !!complete} onClick={() => retryScanRead(read)} aria-label={`Reintentar ${unitHumanLabel(read.unit, read.code)}`}>Reintentar</Button><Button size="small" color="error" sx={{ minWidth: 44, minHeight: 44 }} disabled={readOnly || busy || confirming || !!pending || !!complete} onClick={() => removeReadCandidate(read)} aria-label={`Quitar del lote ${unitHumanLabel(read.unit, read.code)}`}>Quitar del lote</Button></Stack>
          </Stack>}
        </Paper>)}
      </Stack>}

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip label={`${pendingScanCount} pendientes`} color="info" variant={pendingScanCount ? 'filled' : 'outlined'} />
        <Chip label={`${acceptedScanCount} aceptadas`} color="success" variant="outlined" />
        <Chip label={`${rejectedScanCount} rechazadas nuevas`} color={rejectedScanCount ? 'error' : 'default'} variant="outlined" />
        <Chip label={`${candidates.filter((candidate) => candidate.status === 'ready').length} válidas`} color="success" />
        {hasConflict && <Chip label={`${conflictCount} en conflicto`} color="error" />}
        {hasNeedsRevalidation && <Chip label={`${needsRevalidationCount} por revalidar`} color="warning" />}
        {hasWithdrawn && <Chip label={`${withdrawnCount} ya retiradas`} color="error" variant="outlined" />}
        <Chip label={`${selectedKg.toLocaleString('es-PE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KG`} variant="outlined" />
      </Stack>
      {displayedCandidates.length > 0 && <Stack component="ul" role="list" aria-label="Mangas seleccionadas para salida directa" spacing={1} sx={{ p: 0, m: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: '1fr', '@media (min-width:600px)': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }, gap: 1 }}>
        {displayedCandidates.map((candidate) => {
          const identity = colorPresentation(candidate.unit);
          // A restored conflict may not have a resolver unit yet. Keep the
          // original selector visible so the worker can identify the row.
          const label = identity.m || candidateLabel(candidate);
          const pieceName = identity.pieceName || 'Pieza no informada';
          const actionLabel = identity.m || candidateLabel(candidate);
          return <Paper component="li" role="listitem" key={`${candidate.unit?.id || 'conflict'}-${candidate.code}`} variant="outlined" sx={{ p: 1.5, minWidth: 0 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'flex-start' }} spacing={1} sx={{ minWidth: 0 }}>
              <Box sx={{ minWidth: 0, flex: '1 1 0', overflowWrap: 'anywhere' }}>
                <Typography fontWeight={750} sx={{ overflowWrap: 'anywhere' }}>{label}</Typography>
                <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{pieceName}</Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                  <ColorDot {...identity} />
                  <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{identity.colorName}</Typography>
                </Stack>
                <Typography variant="body2">{unitKg(candidate.unit) == null ? 'KG no disponibles' : `${unitKg(candidate.unit)} KG`}</Typography>
              </Box>
              <Button aria-label={`Quitar del lote ${actionLabel}`} size="small" color="error" startIcon={<DeleteOutlineIcon />} sx={{ minWidth: 44, minHeight: 44, alignSelf: { xs: 'stretch', sm: 'auto' } }} onClick={() => removeCandidate(candidate)} disabled={readOnly || busy || !!pending || !!complete}>Quitar del lote</Button>
            </Stack>
            <Box sx={{ mt: 1 }}>{candidate.status === 'ready'
              ? <Chip size="small" label="Lista para enviar" color="success" role="status" aria-live="polite" />
              : candidate.status === 'needs_revalidation'
                ? revalidating
                  ? <ProgressChip label="Validando" />
                  : candidate.error
                    ? <Chip size="small" label={conciseStoredError(candidate.error)} color="error" />
                    : pending
                      ? <Chip size="small" label="Envío por verificar" color="info" />
                      : <ProgressChip label="En espera" />
                : candidate.status === 'withdrawn'
                  ? <Chip size="small" label="Ya salió a Armado" color="error" />
                  : <Chip size="small" label={conciseStoredError(candidate.error || 'Conflicto')} color="error" />}</Box>
          </Paper>;
        })}
      </Stack>}
      {!reviewing && <Button variant="contained" color="success" size="large" startIcon={<SendIcon />} sx={{ minWidth: 44, minHeight: 44 }} onClick={confirm} disabled={readOnly || busy || revalidating || pendingScanCount > 0 || !!pending || !!complete || !!storageError || !candidates.length || hasConflict || hasWithdrawn || !draft.reason.trim() || !draft.holderId || !hasCapabilities}>
        {confirming ? 'Validando lecturas…' : pendingScanCount > 0 ? 'Validando lecturas…' : `Revisar lote (${candidates.filter((candidate) => candidate.status === 'ready').length})`}
      </Button>}
      </Box>
      {!candidates.length && <Alert severity="info">Aún no hay mangas seleccionadas. Escanea la primera manga para comenzar.</Alert>}
    </Stack>
  </Paper>;
}
