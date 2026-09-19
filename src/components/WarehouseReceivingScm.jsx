import {
  Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControl, FormControlLabel, InputLabel,
  MenuItem, Paper, Select, Stack, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useScmActor } from '../context/ScmActorContext';
import { mensajeErrorScm } from '../services/scmEngineeringApi';
import {
  abrirSesionRecepcionScm,
  cerrarSesionRecepcionScm,
  confirmarRecepcionMangaScm,
  decidirCalidadMangaScm,
  listarRecepcionMangasScm,
  rechazarRecepcionMangaScm,
  resolverCodigoRecepcionScm,
  resolverEtiquetaRecepcionScm,
  resolverReversionRecepcionScm,
  solicitarReversionRecepcionScm,
} from '../services/scmWarehouseApi';
import PageHeader from './ui/PageHeader';

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

const emptyChecks = {
  presencia_confirmada: false,
  bolsa_cerrada: false,
  coincidencia_etiquetas: false,
};

const emptyReceivingPayload = {
  pendientes: [], existencias: [], rechazos: [], reversiones: [], ubicaciones: [],
};

const extractIdentity = (rawValue) => {
  const value = rawValue.trim();
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    const labelId = parsed.label_id || parsed.qr?.label_id;
    if (labelId && UUID_PATTERN.test(String(labelId))) {
      return { type: 'label', value: String(labelId).match(UUID_PATTERN)[0] };
    }
  } catch {
    // Los lectores tambien pueden entregar solo el UUID o el codigo visible.
  }
  const uuidMatch = value.match(UUID_PATTERN);
  if (uuidMatch) return { type: 'label', value: uuidMatch[0] };
  return { type: 'code', value: value.toUpperCase() };
};

const formatDate = (value) => (
  value ? new Date(value).toLocaleString('es-PE') : '—'
);

const qualityColor = (state) => ({
  PENDIENTE: 'warning',
  LIBERADA: 'success',
  BLOQUEADA: 'error',
  RECHAZADA: 'error',
}[state] || 'default');

const inventoryUnit = (item) => (
  item?.unidad_inventario
  || item?.unidad
  || item?.articulo?.unidad_inventario
  || item?.articulo?.unidad
  || 'UN'
);

const isKgItem = (item) => inventoryUnit(item) === 'KG';

const netKg = (item) => item?.peso_neto_snapshot_kg ?? item?.peso_neto_kg ?? item?.cantidad;

const makeIntentKey = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : ((random & 0x3) | 0x8);
    return value.toString(16);
  });
};

const expectedSource = (item) => item?.expected_weighing_source || item?.fuente_pesaje || null;

const errorCode = (requestError) => (
  requestError?.response?.data?.error?.code
  || requestError?.response?.data?.error?.error_code
  || requestError?.response?.data?.code
  || requestError?.response?.data?.error_code
  || requestError?.code
  || ''
);

function CandidateCard({ candidate }) {
  if (!candidate) return null;
  const kg = isKgItem(candidate);
  const unit = inventoryUnit(candidate);
  const measuredKg = netKg(candidate);
  const estimate = candidate.estimacion;
  const hasEstimate = estimate
    && estimate.unidades !== undefined
    && estimate.fuente
    && estimate.fecha;
  const details = [
    ...(kg ? [] : [['Cantidad confirmada', `${candidate.cantidad_confirmada} ${unit}`]]),
    ['Peso bruto', `${candidate.peso_bruto_kg} kg`],
    ['Tara', `${candidate.tara_kg} kg`],
    ['Peso neto medido', `${measuredKg} kg`],
  ];
  return (
    <Paper variant="outlined" sx={{ p: 2, borderColor: 'primary.light', bgcolor: '#F8FBFF' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
        <Box>
          <Typography variant="overline" color="primary" fontWeight={800}>Manga identificada</Typography>
          <Typography variant="h6" fontWeight={850}>{candidate.manga_codigo}</Typography>
          <Typography fontWeight={700}>{candidate.articulo.nombre}</Typography>
          <Typography variant="body2" color="text.secondary">
            {candidate.articulo.codigo} · {candidate.color || 'Sin color'} · {candidate.ot.codigo}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="flex-start" flexWrap="wrap">
          <Chip size="small" color="success" label={kg ? 'NET vigente' : 'Pesaje final confirmado'} />
          <Chip size="small" variant="outlined" label={candidate.resuelta_por.replaceAll('_', ' ')} />
        </Stack>
      </Stack>
      {kg && (
        <Box sx={{ mt: 2, p: 1.5, borderRadius: 1.5, bgcolor: 'rgba(42, 130, 91, 0.09)' }}>
          <Typography variant="overline" color="success.dark" fontWeight={900}>Peso neto a recibir</Typography>
          <Typography variant="h4" fontWeight={900}>{measuredKg} kg NET</Typography>
          <Typography variant="body2" color="text.secondary">
            Al confirmar: físico {measuredKg} kg · no disponible {measuredKg} kg · libre 0.000 kg · Calidad PENDIENTE.
          </Typography>
          {hasEstimate && (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              ≈{estimate.unidades} UN <strong>(estimación; no es conteo ni saldo)</strong>
              <Typography component="span" variant="caption" color="text.secondary"> · {estimate.fuente} · {estimate.fecha}</Typography>
            </Typography>
          )}
        </Box>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2 }}>
        {details.map(([label, value]) => (
          <Box key={label} sx={{ flex: 1, minWidth: 130 }}>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <Typography fontWeight={800}>{value}</Typography>
          </Box>
        ))}
      </Stack>
      {kg && expectedSource(candidate) && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
          Fuente y fecha: pesaje vigente · {formatDate(candidate.pesada_at)}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
        OT productiva: {candidate.ot.fecha_operativa} · Pesada: {formatDate(candidate.pesada_at)}
      </Typography>
    </Paper>
  );
}

function ReceivedCard({ candidate }) {
  if (!candidate) return null;
  const existence = candidate.existencia || {};
  const quantity = existence.peso_neto_snapshot_kg ?? candidate.peso_neto_kg ?? '—';
  const location = existence.ubicacion?.nombre || existence.ubicacion?.codigo || 'Ubicación no informada';
  const quality = existence.estado_calidad || 'PENDIENTE';
  return (
    <Paper variant="outlined" sx={{ p: 2, borderColor: 'success.light', bgcolor: '#F8FBFF' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
        <Box>
          <Typography variant="overline" color="success.dark" fontWeight={800}>Manga ya recibida</Typography>
          <Typography variant="h6" fontWeight={850}>{candidate.manga_codigo}</Typography>
          <Typography fontWeight={700}>{candidate.articulo?.nombre}</Typography>
          <Typography variant="body2" color="text.secondary">
            {candidate.articulo?.codigo} · {candidate.ot?.codigo || 'OT no informada'}
          </Typography>
        </Box>
        <Chip size="small" color="success" label="Solo lectura" />
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary">Peso neto recibido</Typography>
          <Typography variant="h5" fontWeight={900}>{quantity} kg NET</Typography>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary">Ubicación</Typography>
          <Typography fontWeight={800}>{location}</Typography>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary">Calidad</Typography>
          <Typography fontWeight={800}>{quality}</Typography>
        </Box>
      </Stack>
      <Alert severity="info" sx={{ mt: 2 }}>
        Esta manga ya tiene una recepción KG autorizada. No se puede volver a confirmar desde este escaneo.
      </Alert>
    </Paper>
  );
}

export default function WarehouseReceivingScm() {
  const { can, actorId } = useScmActor();
  const canReceive = can('RECEPCION_MANGA_CONFIRMAR');
  const canReject = can('RECEPCION_MANGA_RECHAZAR');
  const canManual = can('RECEPCION_MANGA_BUSCAR_MANUAL');
  const canQuality = can('CALIDAD_MANGA_LIBERAR')
    || can('CALIDAD_MANGA_BLOQUEAR') || can('CALIDAD_MANGA_RECHAZAR');
  const canRequestReversal = can('RECEPCION_MANGA_REVERSION_SOLICITAR');
  const canApproveReversal = can('RECEPCION_MANGA_REVERSION_APROBAR');
  const [payload, setPayload] = useState({
    ...emptyReceivingPayload,
  });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState(0);
  const [scan, setScan] = useState('');
  const [candidate, setCandidate] = useState(null);
  const [receivedCandidate, setReceivedCandidate] = useState(null);
  const [locationCode, setLocationCode] = useState('');
  const [checks, setChecks] = useState(emptyChecks);
  const [session, setSession] = useState(null);
  const [entryPoint, setEntryPoint] = useState('PUERTA_ALMACEN');
  const [actionDialog, setActionDialog] = useState(null);
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [kgIntent, setKgIntent] = useState(null);
  const [interactionState, setInteractionState] = useState('ESPERANDO_QR');
  const scanRef = useRef(null);
  const actorIdRef = useRef(actorId);
  const loadRequestRef = useRef(0);

  useEffect(() => {
    actorIdRef.current = actorId;
    setPayload(emptyReceivingPayload);
    setCandidate(null);
    setReceivedCandidate(null);
    setNotice('');
    setError('');
    setKgIntent(null);
    setChecks(emptyChecks);
    setSession(null);
    setScan('');
    setInteractionState('ESPERANDO_QR');
  }, [actorId]);

  const load = useCallback(async () => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    const requestedActorId = actorId;
    setBusy(true);
    setError('');
    try {
      const nextPayload = await listarRecepcionMangasScm();
      if (loadRequestRef.current !== requestId || actorIdRef.current !== requestedActorId) return;
      setPayload(nextPayload);
    } catch (requestError) {
      if (loadRequestRef.current !== requestId || actorIdRef.current !== requestedActorId) return;
      setError(mensajeErrorScm(requestError, 'No se pudo cargar la recepción de mangas.'));
    } finally {
      if (loadRequestRef.current === requestId) setBusy(false);
    }
  }, [actorId]);

  useEffect(() => { load(); }, [load]);

  const compatibleLocations = useMemo(() => {
    if (!candidate) return [];
    return payload.ubicaciones.filter((location) => (
      !location.clases_articulo?.length
      || location.clases_articulo.includes(candidate.articulo.clase)
    ));
  }, [candidate, payload.ubicaciones]);

  const selectCandidate = useCallback((item) => {
    setReceivedCandidate(null);
    setCandidate(item);
    setChecks(emptyChecks);
    const expectedCode = item.articulo.clase === 'PRODUCTO_TERMINADO'
      ? 'RECEPCION_PT' : 'RECEPCION_PIEZAS_WIP';
    const expected = payload.ubicaciones.find((location) => location.codigo === expectedCode);
    const compatible = payload.ubicaciones.find((location) => (
      !location.clases_articulo?.length
      || location.clases_articulo.includes(item.articulo.clase)
    ));
    const nextLocation = (expected || compatible)?.codigo || '';
    setLocationCode(nextLocation);
    setKgIntent(isKgItem(item) ? {
      idempotencyKey: makeIntentKey(),
      mangaId: item.manga_id,
      source: expectedSource(item),
      locationCode: nextLocation,
      actorId,
      payload: null,
      uncertain: false,
    } : null);
    setInteractionState('LISTO');
  }, [actorId, payload.ubicaciones]);

  const resolveScan = async () => {
    setNotice('');
    const identity = extractIdentity(scan);
    if (!identity) {
      setError('Escanea el QR de cualquiera de las dos etiquetas de la manga.');
      scanRef.current?.focus();
      return;
    }
    if (identity.type === 'code' && !canManual) {
      setError('El ingreso manual del código requiere autorización. Usa el lector QR.');
      return;
    }
    const requestedActorId = actorId;
    setBusy(true);
    setError('');
    setReceivedCandidate(null);
    setInteractionState('RESOLVIENDO');
    try {
      const result = identity.type === 'label'
        ? await resolverEtiquetaRecepcionScm(identity.value)
        : await resolverCodigoRecepcionScm(identity.value);
      if (actorIdRef.current !== requestedActorId) return;
      setScan('');
      if (result.received === true) {
        setCandidate(null);
        setKgIntent(null);
        setChecks(emptyChecks);
        setReceivedCandidate(result);
        setInteractionState('REPLAY');
        setNotice('Esta manga ya fue recibida. Se muestra el resultado autorizado en solo lectura.');
      } else {
        selectCandidate(result);
      }
      if (result.received !== true) {
        setNotice('Manga identificada. Verifica físicamente antes de aceptar custodia.');
      }
    } catch (requestError) {
      if (actorIdRef.current !== requestedActorId) return;
      setCandidate(null);
      setReceivedCandidate(null);
      setNotice('');
      setKgIntent(null);
      setInteractionState('ERROR');
      setError(mensajeErrorScm(requestError, 'No se pudo identificar la manga.'));
    } finally {
      if (actorIdRef.current === requestedActorId) setBusy(false);
    }
  };

  const identityPayload = (item) => (
    item.resuelta_por === 'CODIGO_MANUAL'
      ? { manga_codigo: item.manga_codigo }
      : { label_id: item.etiqueta_id }
  );

  const confirmReceipt = async () => {
    if (!candidate) {
      setError('Escanea y verifica una manga antes de confirmar.');
      return;
    }
    const kg = isKgItem(candidate);
    const frozenPayload = kgIntent?.payload;
    if (!frozenPayload && (!locationCode || Object.values(checks).some((value) => !value))) {
      setError('Selecciona una ubicación y completa las tres verificaciones físicas.');
      return;
    }
    if (kg && (!expectedSource(candidate) || !kgIntent?.idempotencyKey || kgIntent.actorId !== actorId)) {
      setError('La intención KG perdió su fuente o clave. Actualiza el candidato antes de confirmar.');
      setInteractionState('ERROR');
      return;
    }
    const requestedActorId = actorId;
    setBusy(true);
    setError('');
    setInteractionState('CONFIRMANDO');
    try {
      const confirmPayload = frozenPayload || {
          ...identityPayload(candidate),
          ...(session ? { sesion_id: session.id } : {}),
          ubicacion_codigo: locationCode,
          ...checks,
          ...(kg ? { expected_weighing_source: expectedSource(candidate) } : {}),
        };
      if (kg) {
        setKgIntent((current) => (current ? {
          ...current,
          actorId,
          payload: confirmPayload,
          uncertain: true,
        } : current));
      }
      const result = kg
        ? await confirmarRecepcionMangaScm(confirmPayload, kgIntent?.idempotencyKey)
        : await confirmarRecepcionMangaScm(confirmPayload);
      if (actorIdRef.current !== requestedActorId) return;
      setCandidate(null);
      setChecks(emptyChecks);
      setKgIntent(null);
      setInteractionState(result?.idempotent_replay ? 'REPLAY' : 'EXITO');
      setNotice(result?.idempotent_replay
        ? 'Resultado recuperado: la recepción ya estaba registrada; no se creó un segundo ingreso.'
        : 'Custodia aceptada. La manga existe en Kardex, bloqueada hasta Calidad.');
      await load();
      scanRef.current?.focus();
    } catch (requestError) {
      if (actorIdRef.current !== requestedActorId) return;
      const code = errorCode(requestError);
      if (code === 'PESAJE_VERSION_CONFLICT') {
        setCandidate(null);
        setKgIntent(null);
        setInteractionState('CONFLICTO');
        setError('El pesaje cambió desde la lectura. Actualiza el QR y revisa el nuevo NET antes de confirmar.');
      } else if (code === 'MANGA_YA_RECIBIDA') {
        setCandidate(null);
        setKgIntent(null);
        setInteractionState('REPLAY');
        setNotice('Esta manga ya fue recibida. Se recuperará el único resultado autorizado al actualizar.');
        await load();
      } else if (code === 'INVENTORY_SCOPE_FORBIDDEN' || code === 'KG_OPERATION_NOT_ENABLED') {
        setKgIntent(null);
        setInteractionState('SIN_ALCANCE');
        setError('La operación KG ya no está autorizada para este actor o destino. Actualiza el candidato.');
      } else if (!requestError?.response) {
        setInteractionState('DESCONECTADO');
        setError(mensajeErrorScm(requestError, 'Central no disponible. Conserva la intención y reintenta con la misma clave.'));
      } else {
        setInteractionState('ERROR');
        setError(mensajeErrorScm(requestError, 'No se confirmó la recepción.'));
      }
    } finally {
      if (actorIdRef.current === requestedActorId) setBusy(false);
    }
  };

  const cancelCandidate = () => {
    setCandidate(null);
    setReceivedCandidate(null);
    setKgIntent(null);
    setChecks(emptyChecks);
    setInteractionState('ESPERANDO_QR');
    setError('');
    scanRef.current?.focus();
  };

  const changeLocation = (nextLocation) => {
    if (kgIntent?.payload || kgIntent?.uncertain) return;
    setLocationCode(nextLocation);
    if (candidate && isKgItem(candidate) && kgIntent?.locationCode !== nextLocation) {
      setKgIntent((current) => ({
        ...(current || {}),
        idempotencyKey: makeIntentKey(),
        locationCode: nextLocation,
      }));
      setNotice('Cambió el destino. Revisa el efecto en kg antes de confirmar.');
    }
  };

  const openAction = (type, item) => {
    setActionDialog({ type, item });
    setReason('');
    setEvidence('');
  };

  const submitAction = async () => {
    if (!reason.trim()) {
      setError('Registra el motivo de la decisión.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (actionDialog.type === 'RECHAZAR_RECEPCION') {
        await rechazarRecepcionMangaScm({
          ...identityPayload(actionDialog.item),
          motivo: reason.trim(),
          ...(evidence.trim() ? { evidencia: evidence.trim() } : {}),
        });
        setCandidate(null);
        setNotice('Recepción rechazada sin crear inventario. La evidencia quedó registrada.');
      } else if (actionDialog.type === 'SOLICITAR_REVERSION') {
        await solicitarReversionRecepcionScm(actionDialog.item.id, {
          motivo: reason.trim(),
          ...(evidence.trim() ? { evidencia: evidence.trim() } : {}),
        });
        setNotice('Reversa solicitada. El Kardex no cambia hasta que otro actor la apruebe.');
      } else if (actionDialog.type === 'APROBAR_REVERSION' || actionDialog.type === 'RECHAZAR_REVERSION') {
        await resolverReversionRecepcionScm(actionDialog.item.id, {
          aprobar: actionDialog.type === 'APROBAR_REVERSION',
          motivo: reason.trim(),
        });
        setNotice(actionDialog.type === 'APROBAR_REVERSION'
          ? 'Reversa aplicada con movimiento compensatorio.'
          : 'Solicitud de reversa rechazada.');
      } else {
        await decidirCalidadMangaScm(actionDialog.item.id, {
          decision: actionDialog.type,
          motivo: reason.trim(),
          ...(evidence.trim() ? { evidencia: evidence.trim() } : {}),
          version: actionDialog.item.version,
        });
        setNotice(`Decisión de Calidad registrada: ${actionDialog.type.toLowerCase()}.`);
      }
      setActionDialog(null);
      await load();
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo registrar la decisión.'));
    } finally {
      setBusy(false);
    }
  };

  const toggleSession = async () => {
    if (kgIntent?.payload || kgIntent?.uncertain) return;
    const requestedActorId = actorId;
    setBusy(true);
    setError('');
    try {
      if (session) {
        await cerrarSesionRecepcionScm(session.id);
        if (actorIdRef.current !== requestedActorId) return;
        setSession(null);
        setNotice('Sesión de recepción cerrada.');
      } else {
        const response = await abrirSesionRecepcionScm(entryPoint.trim() || 'PUERTA_ALMACEN');
        if (actorIdRef.current !== requestedActorId) return;
        setSession(response.sesion);
        setNotice(`Sesión ${response.sesion.codigo} abierta.`);
      }
    } catch (requestError) {
      if (actorIdRef.current !== requestedActorId) return;
      setError(mensajeErrorScm(requestError, 'No se pudo actualizar la sesión.'));
    } finally {
      if (actorIdRef.current === requestedActorId) setBusy(false);
    }
  };

  const contextLocked = Boolean(kgIntent?.payload || kgIntent?.uncertain || (kgIntent && kgIntent.actorId !== actorId));

  return (
    <Stack spacing={2.5}>
      <PageHeader
        title="Recepción de mangas"
        description="Acepta bolsas pesadas, conserva su identidad y separa existencia física de stock liberado."
        actions={<Button startIcon={<RefreshIcon />} variant="outlined" onClick={load}>Actualizar</Button>}
      />
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
      <Alert severity="info">
        Almacén no vuelve a contar ni pesar: compara la manga física con sus dos etiquetas.
        Al recibirla nace el Kardex, pero permanece no disponible hasta la decisión de Calidad.
      </Alert>
      <Paper variant="outlined">
        <Tabs value={tab} onChange={(_event, value) => setTab(value)} variant="scrollable">
          {canReceive && <Tab icon={<QrCodeScannerOutlinedIcon />} iconPosition="start" label={`Recibir (${payload.pendientes.length})`} />}
          <Tab icon={<FactCheckOutlinedIcon />} iconPosition="start" label="Custodia y Calidad" />
          <Tab icon={<Inventory2OutlinedIcon />} iconPosition="start" label="Rechazos" />
        </Tabs>
      </Paper>

      {canReceive && tab === 0 && (
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems={{ md: 'center' }}>
              <TextField
                inputRef={scanRef}
                autoFocus
                fullWidth
                label="Escanear QR de manga"
                placeholder="El lector escribe aquí y confirma con Enter"
                value={scan}
                onChange={(event) => setScan(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    resolveScan();
                  }
                }}
                disabled={busy || contextLocked}
                helperText={canManual ? 'Usa el QR único de la preetiqueta; el código visible queda como contingencia auditada.' : 'Usa el QR único de la preetiqueta.'}
              />
              <Button
                size="large"
                variant="contained"
                startIcon={<QrCodeScannerOutlinedIcon />}
                onClick={resolveScan}
                disabled={busy || contextLocked}
                sx={{ minWidth: 150 }}
              >
                Identificar
              </Button>
            </Stack>
          </Paper>

          <ReceivedCard candidate={receivedCandidate} />
          <CandidateCard candidate={candidate} />
          {candidate && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" fontWeight={850}>Verificación antes de recibir</Typography>
              <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} sx={{ mt: 1.5 }}>
                <FormControl sx={{ minWidth: 280 }}>
                  <InputLabel>Ubicación de recepción</InputLabel>
                  <Select
                    label="Ubicación de recepción"
                    value={locationCode}
                    onChange={(event) => changeLocation(event.target.value)}
                    disabled={busy || contextLocked}
                  >
                    {compatibleLocations.map((location) => (
                      <MenuItem key={location.codigo} value={location.codigo}>
                        {location.codigo} · {location.nombre}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Stack sx={{ flex: 1 }}>
                  <FormControlLabel
                    control={<Checkbox disabled={busy || contextLocked} checked={checks.presencia_confirmada} onChange={(event) => setChecks({ ...checks, presencia_confirmada: event.target.checked })} />}
                    label="La manga física está presente"
                  />
                  <FormControlLabel
                    control={<Checkbox disabled={busy || contextLocked} checked={checks.bolsa_cerrada} onChange={(event) => setChecks({ ...checks, bolsa_cerrada: event.target.checked })} />}
                    label="La bolsa está cerrada y sin daño visible"
                  />
                  <FormControlLabel
                    control={<Checkbox disabled={busy || contextLocked} checked={checks.coincidencia_etiquetas} onChange={(event) => setChecks({ ...checks, coincidencia_etiquetas: event.target.checked })} />}
                    label="Preetiqueta y etiqueta final corresponden a la misma manga"
                  />
                </Stack>
                <Stack justifyContent="flex-end" spacing={1} sx={{ minWidth: 190 }}>
                  <Button variant="contained" color="success" onClick={confirmReceipt} disabled={busy}>
                    {isKgItem(candidate)
                      ? (['ERROR', 'DESCONECTADO'].includes(interactionState)
                        ? 'Reintentar recepción KG' : 'Confirmar recepción KG')
                      : 'Aceptar custodia'}
                  </Button>
                  <Button color="inherit" onClick={cancelCandidate} disabled={busy}>Cancelar</Button>
                  {canReject && (
                    <Button color="error" onClick={() => openAction('RECHAZAR_RECEPCION', candidate)}>
                      Rechazar recepción
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Paper>
          )}

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems={{ md: 'center' }}>
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight={800}>Sesión de recepción</Typography>
                <Typography variant="body2" color="text.secondary">
                  {session ? `${session.codigo} · ${session.punto_ingreso}` : 'Opcional: agrupa las mangas de este turno o recorrido.'}
                </Typography>
              </Box>
              {!session && (
                <TextField
                  size="small"
                  label="Punto de ingreso"
                  value={entryPoint}
                  onChange={(event) => setEntryPoint(event.target.value.toUpperCase())}
                />
              )}
              <Button variant="outlined" color={session ? 'warning' : 'primary'} onClick={toggleSession} disabled={busy || contextLocked}>
                {session ? 'Cerrar sesión' : 'Abrir sesión'}
              </Button>
            </Stack>
          </Paper>

          <Paper variant="outlined">
            <Typography fontWeight={850} sx={{ p: 2 }}>Pendientes de ingreso</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>Manga</TableCell><TableCell>Artículo</TableCell>
                  <TableCell>OT / fecha productiva</TableCell><TableCell align="right">Cantidad</TableCell>
                  <TableCell align="right">Peso neto</TableCell><TableCell />
                </TableRow></TableHead>
                <TableBody>
                  {payload.pendientes.map((item) => (
                    <TableRow key={item.manga_id} hover>
                      <TableCell><Typography fontWeight={800}>{item.manga_codigo}</Typography></TableCell>
                      <TableCell>{item.articulo.nombre}<Typography variant="caption" display="block">{item.articulo.codigo}</Typography></TableCell>
                      <TableCell>{item.ot.codigo}<Typography variant="caption" display="block">{item.ot.fecha_operativa}</Typography></TableCell>
                      <TableCell align="right">
                        {isKgItem(item) ? `${item.peso_neto_kg} KG` : `${item.cantidad_confirmada} ${inventoryUnit(item)}`}
                        {isKgItem(item) && <Typography variant="caption" display="block">Plan {item.cantidad_confirmada} UN</Typography>}
                      </TableCell>
                      <TableCell align="right">{item.peso_neto_kg} kg</TableCell>
                      <TableCell align="right"><Button size="small" onClick={() => selectCandidate(item)}>Verificar</Button></TableCell>
                    </TableRow>
                  ))}
                  {!busy && !payload.pendientes.length && (
                    <TableRow><TableCell colSpan={6}><Alert severity="success">No hay mangas pesadas pendientes de recepción.</Alert></TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Stack>
      )}

      {tab === (canReceive ? 1 : 0) && (
        <Paper variant="outlined">
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" fontWeight={850}>Mangas bajo custodia</Typography>
            <Typography variant="body2" color="text.secondary">Calidad cambia disponibilidad; no altera la cantidad física recibida.</Typography>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>Manga / artículo</TableCell><TableCell>Ubicación</TableCell>
                <TableCell align="right">Físico</TableCell><TableCell>Calidad</TableCell>
                <TableCell>Recepción</TableCell><TableCell align="right">Acciones</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {payload.existencias.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell><Typography fontWeight={800}>{item.manga_codigo}</Typography><Typography variant="caption">{item.articulo.codigo} · {item.articulo.nombre}</Typography></TableCell>
                    <TableCell>{item.ubicacion.nombre}</TableCell>
                    <TableCell align="right">{item.cantidad_fisica} {inventoryUnit(item)}</TableCell>
                    <TableCell><Chip size="small" color={qualityColor(item.estado_calidad)} label={item.estado_calidad} /></TableCell>
                    <TableCell>{formatDate(item.recibida_at)}</TableCell>
                    <TableCell align="right">
                      {(canQuality || canRequestReversal) && (
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          {can('CALIDAD_MANGA_LIBERAR') && item.estado_calidad !== 'LIBERADA' && <Button size="small" color="success" onClick={() => openAction('LIBERADA', item)}>Liberar</Button>}
                          {can('CALIDAD_MANGA_BLOQUEAR') && item.estado_calidad !== 'BLOQUEADA' && <Button size="small" color="warning" onClick={() => openAction('BLOQUEADA', item)}>Bloquear</Button>}
                          {can('CALIDAD_MANGA_RECHAZAR') && item.estado_calidad !== 'RECHAZADA' && <Button size="small" color="error" onClick={() => openAction('RECHAZADA', item)}>Rechazar</Button>}
                          {!isKgItem(item) && canRequestReversal && item.estado_logistico === 'RECIBIDA_ALMACEN' && item.cantidad_reservada === '0.000' && (
                            <Button size="small" color="error" onClick={() => openAction('SOLICITAR_REVERSION', item)}>Solicitar reversa</Button>
                          )}
                        </Stack>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!busy && !payload.existencias.length && <TableRow><TableCell colSpan={6}><Alert severity="info">Todavía no hay mangas recibidas.</Alert></TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
          {canApproveReversal && payload.reversiones.some((item) => item.estado === 'PENDIENTE') && (
            <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography fontWeight={850} sx={{ mb: 1 }}>Reversiones pendientes de otro actor</Typography>
              <Stack spacing={1}>
                {payload.reversiones.filter((item) => item.estado === 'PENDIENTE' && !isKgItem(item)).map((item) => (
                  <Stack key={item.id} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                    <Box sx={{ flex: 1 }}><b>{item.manga_codigo}</b> · {item.motivo}</Box>
                    <Button size="small" color="error" onClick={() => openAction('RECHAZAR_REVERSION', item)}>Rechazar</Button>
                    <Button size="small" variant="contained" color="warning" onClick={() => openAction('APROBAR_REVERSION', item)}>Aprobar reversa</Button>
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}
        </Paper>
      )}

      {tab === (canReceive ? 2 : 1) && (
        <Paper variant="outlined">
          <Typography variant="h6" fontWeight={850} sx={{ p: 2 }}>Intentos rechazados antes de custodia</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow><TableCell>Fecha</TableCell><TableCell>Manga</TableCell><TableCell>Motivo</TableCell><TableCell>Evidencia</TableCell></TableRow></TableHead>
              <TableBody>
                {payload.rechazos.map((item) => <TableRow key={item.id}><TableCell>{formatDate(item.created_at)}</TableCell><TableCell>{item.manga_codigo}</TableCell><TableCell>{item.motivo}</TableCell><TableCell>{item.evidencia || '—'}</TableCell></TableRow>)}
                {!busy && !payload.rechazos.length && <TableRow><TableCell colSpan={4}><Alert severity="info">No hay rechazos registrados.</Alert></TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Dialog open={Boolean(actionDialog)} onClose={() => setActionDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>{actionDialog?.type?.includes('REVERSION')
          ? 'Control de reversa de recepción'
          : actionDialog?.type === 'RECHAZAR_RECEPCION' ? 'Rechazar recepción' : `Decisión de Calidad: ${actionDialog?.type?.toLowerCase()}`}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity={actionDialog?.type === 'LIBERADA' ? 'info' : 'warning'}>
              Esta decisión queda auditada y no elimina el pesaje ni la identidad de la manga.
            </Alert>
            <TextField label="Motivo" required multiline minRows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
            <TextField label="Evidencia o referencia (opcional)" value={evidence} onChange={(event) => setEvidence(event.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setActionDialog(null)}>Cancelar</Button><Button variant="contained" color={actionDialog?.type === 'LIBERADA' ? 'success' : 'warning'} onClick={submitAction} disabled={busy}>Confirmar decisión</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}
