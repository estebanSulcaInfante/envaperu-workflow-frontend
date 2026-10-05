import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
import { API_BASE_URL } from '../services/api';

const PREPARE_CAPABILITY = 'PICKING_PREPARAR';
const DISPATCH_CAPABILITY = 'PICKING_DESPACHAR';
const ELIGIBLE_STATES = new Set([
  'RECIBIDA_ALMACEN',
  'ALMACENADA_CONTROLADA',
  'DISPONIBLE_PRODUCCION',
]);
const ELIGIBLE_QUALITY = new Set(['LIBERADA', 'SIN_CONTROL']);

const emptyDraft = { context: 'ARMADO', reason: '', holderId: '', holderName: '', documentType: '', documentId: '' };
const asWorkerName = (worker) => worker.nombre_corto || worker.nombre || [worker.nombres, worker.apellidos].filter(Boolean).join(' ') || `Trabajador ${worker.id}`;
const unitState = (unit) => unit?.estado_logistico || unit?.estado || '';
const unitKg = (unit) => unit?.kg_verificados ?? unit?.kg ?? unit?.peso_kg ?? null;
const unitVersion = (unit) => Number(unit?.version);
const isDefinitive4xx = (error) => {
  const status = error?.response?.status;
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
};

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

const candidateLabel = (candidate) => candidate.unit?.codigo || candidate.code;

/**
 * Outgoing direct batch flow. Scanning only resolves identities and builds a
 * draft. The only mutation is the explicit, single final confirmation.
 */
export default function DirectKgBatchWithdrawals({ readOnly = false }) {
  const { actorId, can } = useScmActor();
  const [draft, setDraft] = useState(emptyDraft);
  const [workers, setWorkers] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [storageError, setStorageError] = useState('');
  const [pending, setPending] = useState(null);
  const [complete, setComplete] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const activeActorRef = useRef(actorId);
  const sessionGenerationRef = useRef(0);
  const requestRef = useRef(0);
  const confirmLockRef = useRef(false);
  const queueGenerationRef = useRef(0);
  const scanQueueRef = useRef([]);
  const scanWorkerRef = useRef(false);
  const codeRef = useRef(null);

  const namespace = useMemo(() => `scm-kg-direct-batch:${API_BASE_URL}:${String(actorId)}`, [actorId]);
  const draftKey = `${namespace}:draft`;
  const pendingKey = `${namespace}:pending`;
  const hasCapabilities = !readOnly && can(PREPARE_CAPABILITY) && can(DISPATCH_CAPABILITY);

  useEffect(() => {
    activeActorRef.current = actorId;
    sessionGenerationRef.current += 1;
    confirmLockRef.current = false;
    setBusy(false);
    setConfirming(false);
    setStorageError('');
  }, [actorId]);

  useEffect(() => {
    requestRef.current += 1;
    queueGenerationRef.current += 1;
    scanQueueRef.current = [];
    scanWorkerRef.current = false;
    const savedDraft = parseStorage(draftKey);
    setDraft({ ...emptyDraft, ...savedDraft });
    setCandidates((savedDraft?.candidates || []).map((candidate) => ({
      ...candidate,
      status: candidate.status === 'conflict' ? 'conflict' : candidate.unit?.id ? 'needs_revalidation' : 'conflict',
    })));
    setCode('');
    setWorkers([]);
    setLoadingWorkers(false);
    setError('');
    setNotice('');
    setComplete(null);
    setPending(parseStorage(pendingKey));
  }, [actorId, draftKey, pendingKey]);

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
  }, [draftKey]);

  const updateDraft = (patch) => {
    setDraft((current) => {
      const next = { ...current, ...patch };
      persistDraft(next, candidates);
      return next;
    });
  };

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
  }, [actorId, loadingWorkers, workers.length]);

  const resolveCode = useCallback(async (rawCode) => {
    const value = rawCode.trim();
    if (!value) return;
    const requestedActor = actorId;
    const requestedGeneration = sessionGenerationRef.current;
    const requestId = ++requestRef.current;
    try {
      const result = await kgApi.resolveKgOutgoingUnit(value);
      if (activeActorRef.current !== requestedActor || sessionGenerationRef.current !== requestedGeneration || requestRef.current < requestId) return;
      const unit = result?.unit || result?.unidad || result;
      if (!unit?.id) throw new Error('La respuesta no contiene una identidad KG.');
      setCandidates((current) => {
        if (current.some((candidate) => String(candidate.unit?.id) === String(unit.id))) {
          setNotice(`${unit.codigo || value} ya está incluida.`);
          return current;
        }
        const next = [...current, {
          code: value,
          unit,
          status: 'ready',
          resolvedAt: new Date().toISOString(),
        }];
        persistDraft(draft, next);
        return next;
      });
      setError('');
    } catch (requestError) {
      if (activeActorRef.current !== requestedActor || sessionGenerationRef.current !== requestedGeneration) return;
      const message = mensajeErrorScm(requestError, `No se pudo validar ${value}.`);
      setError(`${value}: ${message}`);
      setCandidates((current) => {
        if (current.some((candidate) => candidate.code === value)) return current;
        const next = [...current, { code: value, status: 'conflict', error: message, unit: null }];
        persistDraft(draft, next);
        return next;
      });
    }
  }, [actorId, draft, persistDraft]);

  const runScanQueue = useCallback(async () => {
    if (scanWorkerRef.current) return;
    scanWorkerRef.current = true;
    setBusy(true);
    const generation = queueGenerationRef.current;
    const queue = scanQueueRef.current;
    while (queue.length && generation === queueGenerationRef.current) {
      const nextCode = queue.shift();
      // Sequential resolution preserves every scanner input without dropping
      // characters while the previous identity request is in flight.
      await resolveCode(nextCode);
    }
    if (generation === queueGenerationRef.current) {
      scanWorkerRef.current = false;
      setBusy(false);
      requestAnimationFrame(() => codeRef.current?.focus());
    }
  }, [resolveCode]);

  const enqueueScan = (rawCode) => {
    const value = rawCode.trim();
    if (!value || pending || complete || confirming || confirmLockRef.current) return;
    setCode('');
    setNotice('');
    scanQueueRef.current.push(value);
    runScanQueue();
  };

  const removeCandidate = (candidate) => {
    setCandidates((current) => {
      const next = current.filter((item) => item !== candidate);
      persistDraft(draft, next);
      return next;
    });
  };

  const buildBody = (items) => ({
    items: items.map((candidate) => ({ unit_id: candidate.unit.id, version: unitVersion(candidate.unit) })),
    motivo_operativo: draft.reason.trim(),
    tenedor_fisico_id: Number(draft.holderId),
    ...(draft.documentType.trim() ? { documento_destino_tipo: draft.documentType.trim() } : {}),
    ...(draft.documentId.trim() ? { documento_destino_id: draft.documentId.trim() } : {}),
  });

  const revalidateCandidates = async () => {
    const requestedActor = actorId;
    const requestedGeneration = sessionGenerationRef.current;
    const checked = [];
    for (const candidate of candidates) {
      if (!candidate.unit || candidate.status === 'conflict') {
        checked.push(candidate);
        continue;
      }
      try {
      const result = await kgApi.resolveKgOutgoingUnit(candidate.code);
      if (activeActorRef.current !== requestedActor || sessionGenerationRef.current !== requestedGeneration) throw new Error('La identidad activa cambió.');
      const currentUnit = result?.unit || result?.unidad || result;
      if (String(currentUnit?.id) !== String(candidate.unit.id)
        || unitVersion(currentUnit) !== unitVersion(candidate.unit)) {
        throw new Error(`${candidateLabel(candidate)} cambió mientras se revisaba. Retíralo y escanéalo de nuevo.`);
      }
      if (!ELIGIBLE_STATES.has(unitState(currentUnit))) {
        throw new Error(`${candidateLabel(candidate)} ya no está disponible para salida.`);
      }
        if (unitKg(currentUnit) == null) {
          throw new Error(`${candidateLabel(candidate)} no tiene KG verificados.`);
        }
        if (currentUnit.estado_calidad && !ELIGIBLE_QUALITY.has(currentUnit.estado_calidad)) {
          throw new Error(`${candidateLabel(candidate)} no está liberada para salida.`);
        }
        checked.push({ ...candidate, unit: currentUnit, status: 'ready', error: '' });
      } catch (candidateError) {
        if (activeActorRef.current !== requestedActor || sessionGenerationRef.current !== requestedGeneration) throw candidateError;
        checked.push({ ...candidate, status: 'conflict', error: candidateError.message || 'No se pudo revalidar.' });
      }
    }
    return checked;
  };

  const ensureHolderIsCurrent = async () => {
    const known = workers.find((worker) => String(worker.id) === String(draft.holderId));
    if (known) return true;
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
          setCandidates([]);
          storageRemove(draftKey);
          setNotice('Salida recuperada correctamente.');
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
      storageRemove(pendingKey);
      setPending(null);
      setComplete(response);
      setCandidates([]);
      storageRemove(draftKey);
      setNotice('Salida confirmada.');
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
    if (busy || pending || complete) return;
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
    if (candidates.length === 0 || candidates.some((candidate) => candidate.status === 'conflict')) {
      setError('Resuelve o retira cada candidato con conflicto antes de confirmar.');
      return;
    }
    const holderIsCurrent = await ensureHolderIsCurrent().catch(() => false);
    if (activeActorRef.current !== requestedActor || sessionGenerationRef.current !== requestedGeneration) return;
    if (!holderIsCurrent) {
      setError('Selecciona un tenedor físico vigente para Armado.');
      return;
    }
    const checked = await revalidateCandidates().catch((requestError) => {
      if (activeActorRef.current !== requestedActor || sessionGenerationRef.current !== requestedGeneration) return null;
      setError(requestError.message || 'La selección cambió. Revisa la lista antes de confirmar.');
      setCandidates((current) => {
        const next = current.map((candidate) => ({
          ...candidate,
          status: candidate.unit ? 'conflict' : candidate.status,
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
      setCandidates(checked);
      persistDraft(draft, checked);
      setError('Retira o resuelve los candidatos en conflicto antes de confirmar.');
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

  const selectedKg = candidates.reduce((sum, candidate) => sum + Number(unitKg(candidate.unit) || 0), 0);
  const hasConflict = candidates.some((candidate) => candidate.status === 'conflict');
  const startNew = () => {
    setComplete(null);
    setPending(null);
    setDraft(emptyDraft);
    setCandidates([]);
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
      {storageError && <Alert severity="error">{storageError}</Alert>}
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
      {pending && <Alert severity="warning" action={<Button startIcon={<RestoreIcon />} onClick={() => sendPending(pending, true)} disabled={busy}>Recuperar</Button>}>
        Hay una solicitud sin resultado confirmado. Puedes reintentar la misma salida desde aquí.
      </Alert>}
      {complete && <Alert severity="success" action={<Button onClick={startNew} disabled={readOnly}>Nueva salida</Button>}>Salida <strong>{complete.operation_id}</strong> confirmada: {complete.cantidad_unidades ?? complete.retiros?.length ?? 0} unidad(es), {complete.total_kg ?? '-'} KG.</Alert>}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <FormControl fullWidth>
          <InputLabel id="direct-kg-context-label">Destino operativo</InputLabel>
          <Select labelId="direct-kg-context-label" label="Destino operativo" value={draft.context} disabled={readOnly || busy || !!pending || !!complete} onChange={(event) => updateDraft({ context: event.target.value })}>
            <MenuItem value="ARMADO">Armado</MenuItem>
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel id="direct-kg-holder-label">Quién recibe en Armado</InputLabel>
          <Select labelId="direct-kg-holder-label" label="Quién recibe en Armado" value={draft.holderId} disabled={readOnly || busy || !!pending || !!complete || loadingWorkers} onOpen={loadWorkers} onChange={(event) => {
            const worker = workers.find((item) => String(item.id) === String(event.target.value));
            updateDraft({ holderId: event.target.value, holderName: worker ? asWorkerName(worker) : draft.holderName });
          }}>
            {draft.holderId && !workers.some((worker) => String(worker.id) === String(draft.holderId)) && <MenuItem value={draft.holderId}>{draft.holderName || `Tenedor seleccionado #${draft.holderId}`}</MenuItem>}
            {workers.map((worker) => <MenuItem key={worker.id} value={worker.id}>{asWorkerName(worker)}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField fullWidth label="Motivo operativo" value={draft.reason} disabled={readOnly || busy || !!pending || !!complete} onChange={(event) => updateDraft({ reason: event.target.value })} />
      </Stack>
      <details>
        <summary>Agregar documento destino (opcional)</summary>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 1.5 }}>
          <TextField fullWidth label="Documento destino (tipo)" value={draft.documentType} disabled={readOnly || busy || !!pending || !!complete} onChange={(event) => updateDraft({ documentType: event.target.value })} />
          <TextField fullWidth label="Documento destino (ID)" value={draft.documentId} disabled={readOnly || busy || !!pending || !!complete} onChange={(event) => updateDraft({ documentId: event.target.value })} />
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
          disabled={readOnly || confirming || !!pending || !!complete}
          onChange={(event) => setCode(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              enqueueScan(event.target.value || code);
            }
          }}
        />
        <Button type="submit" variant="outlined" startIcon={<QrCodeScannerIcon />} disabled={readOnly || confirming || !!pending || !!complete || !code.trim()}>Agregar manga</Button>
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip label={`${candidates.filter((candidate) => candidate.status === 'ready').length} válidas`} color="success" />
        {hasConflict && <Chip label={`${candidates.filter((candidate) => candidate.status === 'conflict').length} en conflicto`} color="error" />}
        <Chip label={`${selectedKg.toLocaleString('es-PE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KG`} variant="outlined" />
      </Stack>
      {candidates.length > 0 && <>
        <Stack spacing={1} sx={{ display: { xs: 'flex', md: 'none' } }} aria-label="Mangas seleccionadas para salida directa">
          {candidates.map((candidate) => <Paper key={`mobile-${candidate.unit?.id || 'conflict'}-${candidate.code}`} variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
              <Box>
                <Typography fontWeight={750}>{candidateLabel(candidate)}</Typography>
                {candidate.unit?.articulo?.codigo && <Typography variant="caption" color="text.secondary" display="block">{candidate.unit.articulo.codigo}</Typography>}
                <Typography variant="body2">{unitKg(candidate.unit) == null ? 'KG no disponibles' : `${unitKg(candidate.unit)} KG`}</Typography>
              </Box>
              <Button aria-label={`Retirar ${candidateLabel(candidate)}`} size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => removeCandidate(candidate)} disabled={readOnly || busy || !!pending || !!complete}>Retirar</Button>
            </Stack>
            <Box sx={{ mt: 1 }}>{candidate.status === 'ready' ? <Chip size="small" label="Lista para revisar" color="success" /> : candidate.status === 'needs_revalidation' ? <Chip size="small" label="Revalidar antes de confirmar" color="warning" /> : <Chip size="small" label={candidate.error || 'Conflicto'} color="error" />}</Box>
          </Paper>)}
        </Stack>
        <TableContainer component={Paper} variant="outlined" sx={{ display: { xs: 'none', md: 'block' } }}>
        <Table size="small" aria-label="Mangas seleccionadas para salida directa">
          <TableHead><TableRow><TableCell>Manga</TableCell><TableCell>Estado</TableCell><TableCell align="right">KG verificados</TableCell><TableCell align="right">Acción</TableCell></TableRow></TableHead>
          <TableBody>{candidates.map((candidate) => <TableRow key={`${candidate.unit?.id || 'conflict'}-${candidate.code}`}>
            <TableCell><Typography fontWeight={750}>{candidateLabel(candidate)}</Typography>{candidate.unit?.articulo?.codigo && <Typography variant="caption" color="text.secondary" display="block">{candidate.unit.articulo.codigo}</Typography>}</TableCell>
            <TableCell>{candidate.status === 'ready' ? <Chip size="small" label="Lista para revisar" color="success" /> : candidate.status === 'needs_revalidation' ? <Chip size="small" label="Revalidar antes de confirmar" color="warning" /> : <Chip size="small" label={candidate.error || 'Conflicto'} color="error" />}</TableCell>
            <TableCell align="right">{unitKg(candidate.unit) == null ? '-' : `${unitKg(candidate.unit)} KG`}</TableCell>
            <TableCell align="right"><Button aria-label={`Retirar ${candidateLabel(candidate)}`} size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => removeCandidate(candidate)} disabled={readOnly || busy || !!pending || !!complete}>Retirar</Button></TableCell>
          </TableRow>)}</TableBody>
        </Table>
        </TableContainer>
      </>}
      <Button variant="contained" color="success" size="large" startIcon={<SendIcon />} onClick={confirm} disabled={readOnly || busy || !!pending || !!complete || !!storageError || !candidates.length || hasConflict || !draft.reason.trim() || !draft.holderId || !hasCapabilities}>
        {busy ? 'Validando y confirmando…' : `Revisar y confirmar salida (${candidates.filter((candidate) => candidate.status === 'ready').length})`}
      </Button>
      {!candidates.length && <Alert severity="info">Aún no hay mangas seleccionadas. Escanea la primera manga para comenzar.</Alert>}
    </Stack>
  </Paper>;
}
