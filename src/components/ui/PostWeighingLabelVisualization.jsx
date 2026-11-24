import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Paper,
  Select, Stack, TextField, Typography,
} from '@mui/material';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { obtenerActorScm } from '../../services/scmEngineeringApi';
import {
  confirmPostWeighingReprint,
  getPostWeighingReprintRequest,
  listWeighingStations,
  previewPostWeighingReprint,
} from '../../services/scmPostWeighingReprintApi';
import {
  buildPostWeighingReprintItem,
  isPostWeighingLabel,
} from './postWeighingReprintModel';
import { useFeedback } from '../../context/FeedbackContext';

const randomOperationId = () => (
  globalThis.crypto.randomUUID()
);
const errorMessage = (cause, fallback) => (
  cause?.response?.data?.error?.message
  || cause?.response?.data?.message
  || fallback
);
const requestStatusLabel = (value) => ({
  QUEUED: 'En cola',
  PENDIENTE: 'Pendiente',
  RESERVADO: 'Reservado',
  EMITIENDO: 'Enviando al spooler',
  ACEPTADO_SPOOLER: 'Aceptado por spooler',
  ACK_ACCEPTED: 'Aceptado por spooler',
  COMPLETED: 'Procesada',
  NO_EMITIDO: 'No emitido',
  EMISION_INCIERTA: 'Emisión incierta',
}[String(value || '').toUpperCase()] || value || 'En cola');
const destinationId = (value) => String(value ?? '').trim();
const storagePrefix = 'scm-postpesaje-reprint:';
const readDraft = (key) => {
  try { return JSON.parse(globalThis.sessionStorage?.getItem(key) || 'null'); } catch { return null; }
};
const writeDraft = (key, value) => {
  try {
    if (!globalThis.sessionStorage) return false;
    globalThis.sessionStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch { return false; }
};
const stationValue = (station) => destinationId(station?.station_id || station?.id || station?.public_id);
const stationLabel = (station) => (
  station?.codigo || station?.station_code || station?.nombre || station?.name || stationValue(station)
);
const stationList = (response) => (
  Array.isArray(response?.items) ? response.items : Array.isArray(response) ? response : []
);
const queueStates = new Set(['QUEUED', 'PENDIENTE', 'RESERVADO', 'EMITIENDO', 'ACEPTADO_SPOOLER', 'COMPLETED']);
const isKnownQueuedResponse = (response) => (
  Boolean(response?.request_id && queueStates.has(String(response?.estado || '').toUpperCase()))
);
const projectionValue = (row) => {
  const source = row?.source_snapshot?.effective_projection || row?.source_payload || {};
  return source.peso_fisico_neto_kg
    ?? source.peso_neto_kg
    ?? source.peso_neto_real_kg
    ?? source.kg_fisico
    ?? source.cantidad_fisica_kg
    ?? source.peso_kg;
};

export default function PostWeighingLabelVisualization(props) {
  if (!props.regularizedManga?.regularizado && !isPostWeighingLabel(props.label)) return null;
  const actorId = props.actorId ?? obtenerActorScm();
  const source = props.regularizedManga
    ? `historical:${props.regularizedManga.public_id}`
    : `${props.pesaje?.public_id || props.pesaje?.id}:${props.label?.public_id || props.label?.id}:${props.label?.estado}:${props.pesaje?.estado}`;
  const key = `${actorId}:${source}:${props.canReprint}`;
  return <PostWeighingLabelContent key={key} {...props} actorId={actorId} />;
}

function PostWeighingLabelContent({
  label,
  pesaje,
  regularizedManga,
  stationId = '',
  canReprint = false,
  actorId,
}) {
  const { notify } = useFeedback();
  const isRegularized = Boolean(regularizedManga);
  const defaultCopies = regularizedManga ? '2' : '1';
  const requestLabel = isRegularized ? 'Reimprimir' : 'Solicitar reimpresión';
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [copias, setCopias] = useState(defaultCopies);
  const [destination, setDestination] = useState('');
  const [stations, setStations] = useState([]);
  const [stationsState, setStationsState] = useState('idle');
  const [state, setState] = useState('idle');
  const [preview, setPreview] = useState(null);
  const [frozenPayload, setFrozenPayload] = useState(null);
  const [result, setResult] = useState(null);
  const [requestId, setRequestId] = useState('');
  const [error, setError] = useState('');
  const operationIdRef = useRef('');
  const requestIdRef = useRef('');
  const loadedSourceRef = useRef('');
  const sourceKeyRef = useRef('');
  const restoringRef = useRef(false);
  const confirmBusyRef = useRef(false);
  const regularizedBusyRef = useRef(false);
  const reportError = useCallback((message, severity = 'error', key = 'post-reprint') => {
    setError(message);
    notify({ message, severity, key });
  }, [notify]);

  const item = useMemo(
    () => buildPostWeighingReprintItem({ pesaje, label, copias: Number(copias), regularizedManga }),
    [copias, label, pesaje, regularizedManga],
  );
  const sourceKey = item?.manga_historica_id
    ? `${actorId}:historical:${item.manga_historica_id}`
    : `${actorId}:${item?.pesaje_id || ''}:${item?.source_label_id || ''}`;
  const draftKey = `${storagePrefix}${sourceKey}`;
  const actionable = Boolean(item && canReprint);
  const locked = ['previewing', 'confirming', 'status', 'queued', 'uncertain'].includes(state);
  sourceKeyRef.current = sourceKey;

  useEffect(() => {
    if (!sourceKey || loadedSourceRef.current === sourceKey) return;
    restoringRef.current = true;
    loadedSourceRef.current = sourceKey;
    setMotivo('');
    setCopias(defaultCopies);
    setDestination('');
    setPreview(null);
    setFrozenPayload(null);
    setResult(null);
    setRequestId('');
    setError('');
    setState('idle');
    operationIdRef.current = '';
    requestIdRef.current = '';
    const draft = readDraft(draftKey);
    if (!draft) return;
    setMotivo(draft.motivo || '');
    setCopias(String(draft.copias || defaultCopies));
    setDestination(destinationId(draft.destination));
    setPreview(draft.preview || null);
    setFrozenPayload(draft.frozenPayload || null);
    setResult(draft.result || null);
    setRequestId(draft.requestId || '');
    requestIdRef.current = draft.requestId || '';
    operationIdRef.current = draft.operationId || '';
    const restoredState = ['confirming', 'status'].includes(draft.state)
      ? 'uncertain'
      : draft.state === 'previewing' ? 'idle'
      : (draft.state || 'idle');
    setState(restoredState);
    if (restoredState === 'uncertain') setError('La solicitud quedó abierta antes de cerrar. Consulta su estado; no se reenvía automáticamente.');
  }, [defaultCopies, draftKey, sourceKey]);

  useEffect(() => {
    if (restoringRef.current) {
      restoringRef.current = false;
      return;
    }
    if (!sourceKey || (!preview && !frozenPayload && !result && !operationIdRef.current)) return;
    writeDraft(draftKey, {
      motivo, copias, destination, preview, frozenPayload, result, requestId,
      operationId: operationIdRef.current, state,
    });
  }, [copias, destination, draftKey, frozenPayload, motivo, preview, requestId, result, sourceKey, state]);

  useEffect(() => {
    if (!open || isRegularized) return undefined;
    let active = true;
    setStationsState('loading');
    listWeighingStations()
      .then((response) => {
        if (!active) return;
        const next = stationList(response).filter((station) => stationValue(station));
        setStations(next);
        setStationsState('ready');
        const requested = destinationId(stationId);
        const initial = next.find((station) => stationValue(station) === requested);
        if (initial) setDestination((current) => current || stationValue(initial));
      })
      .catch((cause) => {
        if (!active) return;
        setStationsState('error');
      reportError(errorMessage(cause, 'No se pudo cargar el catálogo de estaciones.'), 'error', 'post-reprint-stations');
      });
    return () => { active = false; };
  }, [isRegularized, open, reportError, stationId]);

  const invalidatePreview = () => {
    if (locked) return;
    setPreview(null);
    setFrozenPayload(null);
    operationIdRef.current = '';
    setState('idle');
    setError('');
  };
  const close = () => {
    if (!['confirming', 'previewing', 'status'].includes(state)) setOpen(false);
  };
  const openDialog = () => {
    setError('');
    setOpen(true);
  };
  const startNewRequest = () => {
    if (state !== 'queued' || !requestId) return;
    globalThis.sessionStorage?.removeItem(draftKey);
    operationIdRef.current = '';
    requestIdRef.current = '';
    setPreview(null);
    setFrozenPayload(null);
    setResult(null);
    setRequestId('');
    setMotivo('');
    setCopias(defaultCopies);
    setError('');
    setState('idle');
    if (isRegularized) setOpen(false);
  };
  const previewRequest = async () => {
    const copies = Number(copias);
    const target = destinationId(destination);
    if (!item || !stations.some((station) => stationValue(station) === target)
        || !Number.isInteger(copies) || copies < 1 || copies > 50) {
      setError('Selecciona una estación y entre 1 y 50 copias.');
      return;
    }
    if (!motivo.trim()) {
      setError('Indica el motivo de la reimpresión.');
      return;
    }
    const payload = { items: [{ ...item, copias: Number(copies) }], station_id: target };
    setState('previewing');
    setError('');
    try {
      const response = await previewPostWeighingReprint(payload);
      if (sourceKeyRef.current !== sourceKey) return;
      setFrozenPayload(payload);
      setPreview(response);
      setState('preview-ready');
    } catch (cause) {
      if (sourceKeyRef.current !== sourceKey) return;
      setPreview(null);
      setFrozenPayload(null);
      setState('idle');
      reportError(errorMessage(cause, 'No se pudo validar la vista previa. La selección puede haber cambiado.'), 'error', 'post-reprint-preview');
    }
  };
  const confirmRequest = async (selectedPreview = preview, selectedPayload = frozenPayload, reason = motivo) => {
    if (!selectedPreview?.preview_digest || !selectedPayload || confirmBusyRef.current) return;
    confirmBusyRef.current = true;
    const requestSourceKey = sourceKey;
    const operationId = operationIdRef.current || randomOperationId();
    operationIdRef.current = operationId;
    const payload = {
      ...selectedPayload, operation_id: operationId, motivo: reason.trim(),
      preview_digest: selectedPreview.preview_digest,
    };
    if (!writeDraft(draftKey, {
      motivo: reason, copias, destination: selectedPayload.station_id,
      preview: selectedPreview, frozenPayload: selectedPayload, result, requestId,
      operationId, state: 'confirming',
    })) {
      confirmBusyRef.current = false;
      if (isRegularized) setState('idle');
      reportError('No se puede conservar esta operación en el navegador. No se envió la solicitud.', 'error', 'post-reprint-storage');
      return;
    }
    setState('confirming');
    setError('');
    try {
      const response = await confirmPostWeighingReprint(payload, operationId);
      if (sourceKeyRef.current !== requestSourceKey) return;
      requestIdRef.current = response?.request_id || '';
      setRequestId(requestIdRef.current);
      setResult(response);
      if (isKnownQueuedResponse(response)) {
        setState('queued');
      } else {
        setState('uncertain');
        reportError('La respuesta no confirmó una solicitud en cola. Conservamos la misma operación; consulta el estado si existe un request_id.', 'warning', 'post-reprint-uncertain');
      }
    } catch (cause) {
      if (sourceKeyRef.current !== requestSourceKey) return;
      const statusCode = cause?.response?.status;
      const uncertain = !cause?.response || statusCode === 408 || statusCode >= 500;
      if (statusCode === 409) {
        setPreview(null);
        setFrozenPayload(null);
      }
      setState(uncertain ? 'uncertain' : ((statusCode === 409 || isRegularized) ? 'idle' : 'preview-ready'));
      reportError(uncertain
        ? `No sabemos si la operación ${operationId} llegó al servidor. Conservamos la misma operación; consulta el estado antes de repetir.`
        : errorMessage(cause, 'No se pudo confirmar la reimpresión. Revisa la selección y la vista previa.'), uncertain ? 'warning' : 'error', 'post-reprint-confirm');
    } finally {
      confirmBusyRef.current = false;
    }
  };
  const reprintRegularized = async () => {
    if (regularizedBusyRef.current || ['previewing', 'confirming', 'status'].includes(state)) return;
    if (['queued', 'uncertain'].includes(state)) {
      setOpen(true);
      return;
    }
    const reason = 'Reimpresión de etiqueta de pesaje regularizado desde Trabajo de color';
    regularizedBusyRef.current = true;
    setOpen(true);
    setState('previewing');
    setError('');
    try {
      const response = await listWeighingStations({ historical: true });
      const activeStations = stationList(response).filter((station) => stationValue(station));
      const target = activeStations.find((station) => station.codigo === 'PESAJE-PLANTA-01')
        || (activeStations.length === 1 ? activeStations[0] : null);
      if (!target) throw new Error('Destino de reimpresión no disponible.');
      const payload = { items: [item], station_id: stationValue(target) };
      const checked = await previewPostWeighingReprint(payload);
      if (!checked?.preview_digest) throw new Error('Vista previa incompleta.');
      if (sourceKeyRef.current !== sourceKey) return;
      setStations(activeStations);
      setDestination(payload.station_id);
      setMotivo(reason);
      setFrozenPayload(payload);
      setPreview(checked);
      await confirmRequest(checked, payload, reason);
    } catch (cause) {
      if (sourceKeyRef.current !== sourceKey) return;
      setState('idle');
      reportError(errorMessage(cause, 'No se pudo enviar a Estación 1. Puedes volver a intentarlo.'), 'error', 'post-reprint-regularized');
    } finally {
      regularizedBusyRef.current = false;
    }
  };
  const queryStatus = async () => {
    if (!requestIdRef.current) return;
    setState('status');
    setError('');
    try {
      const response = await getPostWeighingReprintRequest(requestIdRef.current);
      setResult(response);
      setState('queued');
    } catch (cause) {
      setState('uncertain');
      reportError(errorMessage(cause, 'No se pudo consultar el estado. No reenvíes bytes ni abras otra solicitud.'), 'warning', 'post-reprint-status');
    }
  };

  const status = result?.estado || result?.status;
  const previewItems = preview?.items || frozenPayload?.items || [];
  return (
    <>
      <Paper variant="outlined" sx={{ p: 1.25 }} data-testid="post-weighing-label">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2">{regularizedManga ? 'Comprobante de pesaje final' : 'Etiqueta POSTPESAJE'}</Typography>
            {!regularizedManga && (
              <Typography variant="body2" color="text.secondary">
                {label.codigo || label.public_id || label.id || 'Fuente identificada'}
                {label.estado ? ` · ${label.estado}` : ''}
              </Typography>
            )}
          </Box>
          {canReprint && (
            <Button size="small" variant="outlined" startIcon={<PrintOutlinedIcon />}
              onClick={isRegularized ? reprintRegularized : openDialog}
              disabled={!actionable || (isRegularized && ['previewing', 'confirming', 'status'].includes(state))}
              aria-label={requestLabel}>
              {requestLabel}
            </Button>
          )}
          {canReprint && !item && (
            <Typography variant="caption" color="warning.dark">
              Pesaje de origen no disponible; actualiza la ficha antes de solicitar.
            </Typography>
          )}
        </Stack>
      </Paper>
      <Dialog open={open} onClose={close} fullWidth maxWidth="sm" aria-labelledby="post-reprint-title">
        <DialogTitle id="post-reprint-title">
          {regularizedManga ? requestLabel : 'Solicitar reimpresión POSTPESAJE'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            {!isRegularized && (
              <Alert severity="info">Se crea una copia nueva. El pesaje y la etiqueta original permanecen inmutables.</Alert>
            )}
            {isRegularized && ['previewing', 'confirming'].includes(state) && (
              <Typography role="status">Enviando a Estación 1…</Typography>
            )}
            {!isRegularized && <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField fullWidth type="number" label="Copias" value={copias} disabled={locked}
                inputProps={{ min: 1, max: 50, step: 1 }}
                onChange={(event) => { setCopias(event.target.value); invalidatePreview(); }} />
              <FormControl fullWidth disabled={locked || stationsState !== 'ready'}>
                <InputLabel id="post-reprint-station-label">Estación destino</InputLabel>
                <Select labelId="post-reprint-station-label" label="Estación destino"
                  value={destination}
                  onChange={(event) => { setDestination(event.target.value); invalidatePreview(); }}>
                  {stations.map((station) => (
                    <MenuItem key={stationValue(station)} value={stationValue(station)}>{stationLabel(station)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>}
            {stationsState === 'loading' && <Typography variant="caption">Cargando estaciones autorizadas…</Typography>}
            {stationsState === 'ready' && !stations.length && (
              <Alert severity="warning">
                {isRegularized
                  ? 'Aún no hay una estación habilitada para estos comprobantes.'
                  : 'No hay estaciones disponibles para seleccionar.'}
              </Alert>
            )}
            {!isRegularized && <TextField label="Motivo obligatorio" multiline minRows={2} value={motivo} disabled={locked}
              onChange={(event) => { setMotivo(event.target.value); invalidatePreview(); }} />}
            {error && <Alert severity={state === 'uncertain' ? 'warning' : 'error'}>{error}</Alert>}
            {preview && (
              <Paper variant="outlined" sx={{ p: 1.25 }} data-testid="post-reprint-preview">
                <Stack spacing={0.75}>
                  <Typography variant="subtitle2">Vista previa validada</Typography>
                  {previewItems.map((row, index) => (
                    <Box key={row.source_historical_manga_id || row.source_label_id || row.item_id || index} sx={{ borderLeft: 2, borderColor: 'primary.main', pl: 1 }}>
                      <Typography variant="body2" fontWeight={700}>{row.manga_codigo || 'Manga de origen'}</Typography>
                      {row.source_payload?.pieza_color && <Typography variant="body2">{row.source_payload.pieza_color}</Typography>}
                      <Typography variant="body2">Peso neto (kg): {projectionValue(row) ?? '-'} · {row.copias || 0} copia(s)</Typography>
                      {regularizedManga && row.source_payload?.fecha_local_pesaje && (
                        <Typography variant="body2">
                          Fecha de pesaje {row.source_payload.fecha_local_pesaje.split('-').reverse().join('/')}
                        </Typography>
                      )}
                    </Box>
                  ))}
                  <Typography variant="body2">Total: {preview.total_copias ?? previewItems.reduce((sum, row) => sum + Number(row.copias || 0), 0)} copia(s)</Typography>
                  <Typography variant="caption">Destino: {stationLabel(stations.find((station) => stationValue(station) === destination)) || destination}</Typography>
                  <details>
                    <summary>Detalle técnico</summary>
                    {preview.renderer_version && <Typography variant="caption" display="block">Renderer: {preview.renderer_version}</Typography>}
                    <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>Digest: {preview.preview_digest}</Typography>
                  </details>
                </Stack>
              </Paper>
            )}
            {result && state === 'queued' && (
              <Alert severity="success" data-testid="post-reprint-queued">
                <Stack spacing={0.5}>
                  <Typography fontWeight={700}>Solicitud registrada: {requestStatusLabel(status)}</Typography>
                  <Typography variant="body2">
                    {status === 'COMPLETED'
                      ? 'Puedes consultar el resultado informado por la estación.'
                      : 'El trabajo está en cola. La estación confirma el resultado al procesarlo.'}
                  </Typography>
                  {result.request_id && <Typography variant="caption">Solicitud: {result.request_id}</Typography>}
                  {(result.jobs || []).map((job) => <Chip key={job.job_id || job.id || JSON.stringify(job)} size="small" label={`${job.job_id || job.id || 'Trabajo'} · ${requestStatusLabel(job.estado || job.status)}`} />)}
                </Stack>
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={['confirming', 'previewing', 'status'].includes(state)}>Cerrar</Button>
          {!isRegularized && !preview && !locked && <Button onClick={previewRequest} variant="outlined" disabled={state === 'previewing' || stationsState !== 'ready' || !stations.length || !destination}>{state === 'previewing' ? <CircularProgress size={18} /> : 'Validar vista previa'}</Button>}
          {!isRegularized && preview && state !== 'queued' && state !== 'uncertain' && (
            <Button onClick={() => confirmRequest()} variant="contained" disabled={state === 'confirming' || state === 'status'}>
              {state === 'confirming' ? <CircularProgress size={18} /> : 'Confirmar reimpresión'}
            </Button>
          )}
          {isRegularized && state === 'idle' && error && <Button onClick={reprintRegularized}>Reintentar</Button>}
          {(state === 'queued' || state === 'uncertain') && requestId && <Button onClick={queryStatus} disabled={state === 'status'}>Consultar estado</Button>}
          {state === 'queued' && requestId && <Button onClick={startNewRequest}>Nueva solicitud</Button>}
          {state === 'uncertain' && !requestId && preview && frozenPayload && (
            <Button onClick={() => confirmRequest()}>Recuperar solicitud</Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
