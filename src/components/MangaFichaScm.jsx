import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PageHeader from './ui/PageHeader';
import { useScmActor } from '../context/ScmActorContext';
import {
  cerrarMangaDesdeControlScm,
  reabrirMangaScm,
  resolverFichaMangaScm,
} from '../services/scmOtApi';
import { mensajeErrorScm } from '../services/scmEngineeringApi';

const clean = (value) => String(value ?? '').trim();
const keyFor = (kind, actorId, mangaId) => `scm-manga-ficha:${kind}:${actorId}:${mangaId}`;
const first = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');
const reopenByType = (action = {}) => {
  if (Array.isArray(action.por_tipo)) return Object.fromEntries(action.por_tipo.map((item) => [item.tipo || item.tipo_reapertura, item]));
  return action.por_tipo || {};
};
const uncertainFailure = (error) => {
  const status = error?.response?.status;
  const code = error?.response?.data?.error?.code;
  return !status || status >= 500 || [408, 425, 429].includes(status) || code === 'IDEMPOTENCY_OPERATION_INCOMPLETE';
};

// eslint-disable-next-line react-refresh/only-export-components
export function parseMangaQr(rawValue) {
  const raw = clean(rawValue);
  if (!raw) return { error: 'Escanea un QR o escribe el código visible de la manga.' };
  if (raw.startsWith('{')) {
    try {
      const payload = JSON.parse(raw);
      const code = first(payload.codigo, payload.codigo_manga, payload.manga_codigo, payload.m, payload.identidad?.m);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { error: 'La etiqueta no contiene datos válidos de manga.' };
      return { entrada: raw, code: code ? String(code) : '' };
    } catch {
      return { error: 'No se pudo leer la etiqueta. Vuelve a escanearla.' };
    }
  }
  return { entrada: raw, code: raw };
}

function errorMessage(error, fallback) {
  return error?.response?.data?.error?.message
    || error?.response?.data?.message
    || mensajeErrorScm(error, fallback);
}

function formatKg(value) {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(3)} kg` : String(value);
}

function statusLabel(value) {
  return clean(value).replaceAll('_', ' ') || 'Sin estado';
}

function logisticsLabel(value) {
  const normalized = clean(value).toUpperCase();
  if (normalized === 'RETIRADA_ARMADO') return 'Salida a Armado';
  if (normalized === 'RETIRADA_CLIENTE_MN31') return 'Despachada a cliente';
  if (normalized === 'DISPONIBLE_PRODUCCION') return 'Disponible en Producción';
  if (normalized === 'EN_PRODUCCION') return 'En Producción';
  return statusLabel(value);
}

function operationalReason(value, fallback = '') {
  const code = clean(value).toUpperCase();
  const messages = {
    KG_REOPEN_DOWNSTREAM_REQUIRED: 'Hay un movimiento o una reserva posterior. Revisa la custodia de la manga antes de reabrirla.',
    KG_CLOSE_DOWNSTREAM_REQUIRED: 'La manga tiene un movimiento o una reserva posterior. Revisa su custodia antes de cerrar el llenado.',
    KG_CONTROL_SEGMENT_MISMATCH: 'Falta un peso de este llenado. Lleva la manga a la primera estación de pesaje.',
    KG_CONTROL_REQUIRED: 'Falta un peso registrado. Lleva la manga a la primera estación de pesaje y escanea su etiqueta.',
    KG_CLOSE_NOT_ELIGIBLE: 'El estado actual no permite cerrar la manga desde el último control.',
    MANGA_CLOSE_FROM_CONTROL_NOT_ALLOWED: 'El estado actual no permite cerrar la manga desde el último control.',
    KG_ARTICLE_REQUIRED: 'Falta el artículo KG requerido para continuar; solicita completar la identidad de la manga.',
    KG_CONTROL_SEGMENT_REQUIRED: 'Falta un tramo con control KG elegible; captura el control en Pesaje 1.',
    CONTROL_WEIGHT_NOT_MONOTONIC: 'El último control no conserva la progresión de peso esperada; solicita revisión en Pesaje 1.',
    WEIGHING_NOT_ACTIVE: 'No hay un pesaje activo para esta manga; vuelve a resolverla en Pesaje 1.',
    MANGA_REOPEN_NOT_AVAILABLE: 'La manga no es elegible para reapertura en su estado actual.',
  };
  return messages[code] || (value && !String(value).includes('_') ? String(value) : fallback);
}

function actionEligibility({ ficha, actor, mangaState }) {
  const state = clean(mangaState).toUpperCase();
  const reopenAction = ficha?.acciones?.reabrir || {};
  const closeAction = ficha?.acciones?.cerrar_desde_control || ficha?.acciones?.cerrar || {};
  const reopenTypes = reopenByType(reopenAction);
  const canClose = actor('MANGA_FINALIZAR_PARCIAL')
    && state === 'EN_LLENADO'
    && closeAction.elegible === true;
  const canReopen = actor('MANGA_REABRIR')
    && reopenAction.permitida_por_capacidad === true
    && reopenAction.elegible === true
    && (!reopenAction.por_tipo || reopenTypes.CONTINUAR_LLENADO?.elegible === true);
  return {
    canClose,
    canReopen,
    closeReason: operationalReason(closeAction.motivo || closeAction.razon || closeAction.codigo),
    reopenReason: operationalReason(reopenTypes.CONTINUAR_LLENADO?.razon || reopenAction.razon),
  };
}

export default function MangaFichaScm() {
  const { actorId, can } = useScmActor();
  const [rawCode, setRawCode] = useState('');
  const [scannedCode, setScannedCode] = useState('');
  const [detail, setDetail] = useState(null);
  const [weighing, setWeighing] = useState(null);
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [actionBusy, setActionBusy] = useState('');
  const [reopenOpen, setReopenOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reopening, setReopening] = useState({ tipo_reapertura: 'CONTINUAR_LLENADO', motivo: '', evidencia: '' });
  const [intent, setIntent] = useState(null);
  const [closeIntent, setCloseIntent] = useState(null);
  const [lastEntrada, setLastEntrada] = useState('');
  const scanRef = useRef(null);
  const flight = useRef(false);

  useEffect(() => {
    // El shell enfoca el contenido al navegar. El lector debe recibir el primer escaneo.
    const frame = window.requestAnimationFrame(() => {
      const focused = document.activeElement;
      if (focused === document.body || focused?.id === 'workspace-main') {
        scanRef.current?.focus({ preventScroll: true });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const mangaId = clean(weighing?.manga_id || detail?.manga?.id || detail?.manga?.public_id || detail?.id || detail?.secciones?.identidad?.item?.public_id);
  const identity = detail?.manga || detail?.secciones?.identidad?.item || {};
  const article = identity.articulo || { nombre: identity.articulo_nombre, codigo: identity.articulo_codigo || identity.pieza_color_sku };
  const mangaVersion = first(detail?.acciones?.reabrir?.version, detail?.manga?.version, weighing?.manga_version);
  const mangaState = first(detail?.estado_produccion?.estado_manga, weighing?.estado_manga, identity.estado, detail?.secciones?.identidad?.item?.estado);

  const logisticsState = detail?.inventario_kg?.unidad_estado_logistico || detail?.inventario_kg?.estado_logistico;
  const latestControl = weighing?.ultimo_control
    || weighing?.controles_acumulados?.[weighing.controles_acumulados.length - 1]
    || (weighing?.ultimo_control_neto_kg !== undefined ? { peso_neto_kg: weighing.ultimo_control_neto_kg } : null)
    || null;
  const eligibility = useMemo(
    () => actionEligibility({ ficha: detail, actor: can, mangaState }),
    [can, detail, mangaState],
  );
  const loadManga = useCallback(async ({ entrada, code = '' }) => {
    setState('loading');
    setError('');
    setFeedback(null);
    try {
      const ficha = await resolverFichaMangaScm(entrada);
      setIntent(null);
      setCloseIntent(null);
      setReopenOpen(false);
      setCloseOpen(false);
      setReason('');
      setReopening({ tipo_reapertura: 'CONTINUAR_LLENADO', motivo: '', evidencia: '' });
      setDetail(ficha);
      setWeighing(ficha?.pesaje || null);
      setScannedCode(ficha?.manga?.codigo || ficha?.entrada?.codigo || code || entrada);
      setState('ready');
      scanRef.current?.focus();
    } catch (requestError) {
      setState('error');
      setError(errorMessage(requestError, 'No se pudo cargar la ficha de manga.'));
    }
  }, []);

  const submitScan = async (event) => {
    event.preventDefault();
    if (state === 'loading') return;
    const parsed = parseMangaQr(rawCode);
    if (parsed.error) {
      setDetail(null);
      setWeighing(null);
      setScannedCode('');
      setLastEntrada('');
      setError('');
      setState('idle');
      setFeedback({ severity: 'warning', text: parsed.error });
      return;
    }
    setRawCode('');
    setLastEntrada(parsed.entrada);
    setDetail(null);
    setWeighing(null);
    setScannedCode('');
    try {
      await loadManga({ entrada: parsed.entrada, code: parsed.code });
    } catch (requestError) {
      setState('error');
      setError(errorMessage(requestError, 'No se pudo resolver la manga escaneada.'));
    }
  };

  const refresh = async () => {
    if (!mangaId) return;
    await loadManga({ entrada: scannedCode, code: scannedCode });
  };

  const retryLast = async () => {
    if (!lastEntrada || state === 'loading') return;
    await loadManga({ entrada: lastEntrada, code: scannedCode });
  };

  useEffect(() => {
    const storageKey = mangaId ? keyFor('reopen', actorId, mangaId) : '';
    if (!storageKey) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      if (saved) {
        setIntent(saved);
        setReopening((current) => ({ ...current, ...saved.payload }));
        setReopenOpen(true);
      }
    } catch {
      setFeedback({ severity: 'warning', text: 'No se pudo recuperar la reapertura pendiente. Actualiza la ficha antes de repetirla.' });
    }
  }, [actorId, mangaId]);

  useEffect(() => {
    const storageKey = mangaId ? keyFor('close', actorId, mangaId) : '';
    if (!storageKey) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      if (saved) {
        setCloseIntent(saved);
        setReason(saved.payload?.motivo || '');
        setCloseOpen(true);
      }
    } catch {
      setFeedback({ severity: 'warning', text: 'No se pudo recuperar el cierre pendiente. Actualiza la ficha antes de repetirlo.' });
    }
  }, [actorId, mangaId]);

  const submitReopen = async () => {
    if (!mangaId || flight.current || !reopening.motivo.trim()) return;
    const request = intent || {
      key: crypto.randomUUID(),
      payload: {
        version: mangaVersion,
        tipo_reapertura: 'CONTINUAR_LLENADO',
        motivo: reopening.motivo.trim(),
        evidencia: reopening.evidencia.trim() || null,
      },
    };
    flight.current = true;
    setActionBusy('reopen');
    setError('');
    setIntent(request);
    const storageKey = keyFor('reopen', actorId, mangaId);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ ...request, sent: true }));
      await reabrirMangaScm(mangaId, request.payload, request.key);
      sessionStorage.removeItem(storageKey);
      setIntent(null);
      setReopenOpen(false);
      setReopening({ tipo_reapertura: 'CONTINUAR_LLENADO', motivo: '', evidencia: '' });
      await refresh();
      setFeedback({ severity: 'success', text: 'Manga reabierta. Usa la misma etiqueta en la estación para continuar el pesaje.' });
    } catch (requestError) {
      if (!uncertainFailure(requestError)) {
        sessionStorage.removeItem(storageKey);
        setIntent(null);
      }
      setError(errorMessage(requestError, 'No se pudo reabrir la manga. Reintenta con la misma solicitud.'));
    } finally {
      flight.current = false;
      setActionBusy('');
    }
  };

  const submitClose = async () => {
    if (!mangaId || flight.current || !reason.trim()) return;
    const request = closeIntent || {
      key: crypto.randomUUID(),
      payload: { version: mangaVersion, motivo: reason.trim() },
    };
    flight.current = true;
    setActionBusy('close');
    setError('');
    const storageKey = keyFor('close', actorId, mangaId);
    try {
      setCloseIntent(request);
      sessionStorage.setItem(storageKey, JSON.stringify({ ...request, sent: true }));
      await cerrarMangaDesdeControlScm(mangaId, request.payload, request.key);
      sessionStorage.removeItem(storageKey);
      setCloseIntent(null);
      setCloseOpen(false);
      setReason('');
      await refresh();
      setFeedback({ severity: 'success', text: 'Manga cerrada desde el último control registrado.' });
    } catch (requestError) {
      if (!uncertainFailure(requestError)) {
        sessionStorage.removeItem(storageKey);
        setCloseIntent(null);
      }
      setError(errorMessage(requestError, 'No se pudo cerrar desde el último control. Revisa la versión y reintenta.'));
    } finally {
      flight.current = false;
      setActionBusy('');
    }
  };

  return (
    <Stack spacing={{ xs: 2, md: 2.5 }} sx={{ maxWidth: 1180, mx: 'auto' }}>
      <PageHeader
        title="Ficha de manga"

        actions={<Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={refresh} disabled={!mangaId || state === 'loading' || Boolean(actionBusy)}>Actualizar ficha</Button>}
      />

      <Paper component="section" variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack spacing={1.5}>
          <Box component="form" onSubmit={submitScan}>
            <TextField
              inputRef={scanRef}
              autoFocus
              fullWidth
              label="Etiqueta o código OF–OT–M"
              value={rawCode}
              onChange={(event) => setRawCode(event.target.value)}

              autoComplete="off"
              helperText="Escanea el sticker o escribe el código y pulsa Enter."
              slotProps={{ input: { startAdornment: <QrCodeScannerRoundedIcon color="action" sx={{ mr: 1 }} />, readOnly: state === 'loading' } }}
            />
          </Box>
          {feedback && <Alert severity={feedback.severity} onClose={() => setFeedback(null)}>{feedback.text}</Alert>}
          {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={mangaId ? refresh : retryLast}>Reintentar</Button>}>{error}</Alert>}
        </Stack>
      </Paper>

      {state === 'loading' && <Paper variant="outlined" sx={{ p: 3 }}><Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={20} aria-label="Cargando ficha" /><Typography>Consultando manga…</Typography></Stack></Paper>}

      {state === 'ready' && detail && weighing && (
        <Stack spacing={2}>
          <Paper component="section" variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack spacing={1.5}>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
                <Box>
                  <Typography component="h2" variant="h5" fontWeight={850}>{article.nombre || 'Manga'}</Typography>
                  <Typography variant="body1" fontWeight={750}>{identity.codigo || scannedCode}</Typography>
                </Box>
                <Stack alignItems={{ xs: 'flex-start', md: 'flex-end' }} spacing={.5}>
                  <Typography variant="overline" color="text.secondary">Pesaje</Typography>
                  <Typography variant="h6" fontWeight={850}>{detail.estado_produccion?.cerrada || weighing.final_vigente ? 'Cerrado' : mangaState === 'EN_LLENADO' ? 'En llenado' : statusLabel(mangaState)}</Typography>
                  <Typography variant="overline" color="text.secondary">Custodia</Typography>
                  <Typography variant="body2" fontWeight={750}>{logisticsLabel(logisticsState)}</Typography>
                </Stack>
              </Stack>
              <Divider />
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' }, gap: 1.5 }}>
                <Box><Typography variant="caption" color="text.secondary">Artículo</Typography><Typography variant="body2" fontWeight={750}>{article.codigo || article.nombre || '—'}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Color</Typography><Typography variant="body2" fontWeight={750}>{identity.color_identidad?.nombre || identity.color || '—'}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Peso neto</Typography><Typography variant="body2" fontWeight={750}>{formatKg(weighing.vigente?.peso_fisico_neto_kg ?? weighing.peso_neto_kg)}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Último control</Typography><Typography variant="body2" fontWeight={750}>{formatKg(latestControl?.peso_neto_kg || latestControl?.peso_neto)}</Typography></Box>
              </Box>
              {weighing.origen && <Typography variant="caption" color="text.secondary">Origen del peso · {statusLabel(weighing.origen).toLocaleLowerCase('es-PE')}</Typography>}
            </Stack>
          </Paper>

          <Paper component="section" variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack spacing={1.5}>
              <Typography component="h2" variant="h6" fontWeight={850}>Acciones de pesaje</Typography>
              {!can('MANGA_REABRIR') && !can('MANGA_FINALIZAR_PARCIAL') && <Typography variant="body2">Tu cuenta tiene acceso de consulta.</Typography>}
              {eligibility.canReopen && <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
                <Button variant="outlined" color="warning" startIcon={<LockOpenRoundedIcon />} onClick={() => setReopenOpen(true)} disabled={Boolean(actionBusy)}>Reabrir manga</Button>
                <Typography variant="body2" color="text.secondary">Permite agregar peso en la primera estación con la misma etiqueta.</Typography>
              </Stack>}
              {eligibility.canClose && <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
                <Button variant="contained" startIcon={<LockRoundedIcon />} onClick={() => setCloseOpen(true)} disabled={Boolean(actionBusy)}>Cerrar manga desde control</Button>
                <Typography variant="body2" color="text.secondary">Usa el último peso registrado en la estación.</Typography>
              </Stack>}
              {can('MANGA_FINALIZAR_PARCIAL') && clean(mangaState).toUpperCase() === 'EN_LLENADO' && !eligibility.canClose && <Alert severity="info">{eligibility.closeReason || 'Lleva la manga a la primera estación de pesaje y escanea su etiqueta para registrar el peso.'}</Alert>}
              {can('MANGA_REABRIR') && (detail.estado_produccion?.cerrada || weighing.final_vigente) && eligibility.reopenReason && !eligibility.canReopen && <Alert severity="warning">{eligibility.reopenReason}</Alert>}
              {(can('MANGA_REABRIR') || can('MANGA_FINALIZAR_PARCIAL')) && !eligibility.canReopen && !eligibility.canClose && !eligibility.reopenReason && clean(mangaState).toUpperCase() !== 'EN_LLENADO' && <Typography variant="body2" color="text.secondary">No hay una acción de manga disponible para este estado o perfil.</Typography>}
            </Stack>
          </Paper>

        </Stack>
      )}

      <Dialog open={reopenOpen} onClose={() => !actionBusy && !intent && setReopenOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Reabrir {weighing?.manga_codigo || scannedCode}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2">Se habilita la misma manga para continuar el llenado y conservar su identidad.</Typography>
          <Typography variant="body2">Peso de referencia · <strong>{formatKg(weighing?.peso_neto_kg)}</strong></Typography>
          <Typography variant="caption" color="text.secondary">El siguiente pesaje partirá de los kilos ya registrados.</Typography>
          <TextField label="Motivo" value={reopening.motivo} onChange={(event) => setReopening((current) => ({ ...current, motivo: event.target.value }))} required multiline minRows={3} disabled={Boolean(intent) || Boolean(actionBusy)} />
          <TextField label="Evidencia (opcional)" value={reopening.evidencia} onChange={(event) => setReopening((current) => ({ ...current, evidencia: event.target.value }))} disabled={Boolean(intent) || Boolean(actionBusy)} />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setReopenOpen(false)} disabled={Boolean(actionBusy) || Boolean(intent)}>Cancelar</Button><Button variant="contained" color="warning" onClick={submitReopen} disabled={Boolean(actionBusy) || !reopening.motivo.trim()}>{actionBusy === 'reopen' ? 'Reabriendo…' : intent ? 'Reintentar reapertura' : 'Confirmar reapertura'}</Button></DialogActions>
      </Dialog>

      <Dialog open={closeOpen} onClose={() => !actionBusy && !closeIntent && setCloseOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Cerrar manga desde control · {weighing?.manga_codigo || scannedCode}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="warning">La manga quedará cerrada en Producción con <strong>{formatKg(latestControl?.peso_neto_kg)}</strong>, el último peso registrado en la estación.</Alert>
          <TextField label="Motivo del cierre" value={reason} onChange={(event) => setReason(event.target.value)} required multiline minRows={3} disabled={Boolean(actionBusy) || Boolean(closeIntent)} />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setCloseOpen(false)} disabled={Boolean(actionBusy) || Boolean(closeIntent)}>Cancelar</Button><Button variant="contained" onClick={submitClose} disabled={Boolean(actionBusy) || !reason.trim()}>{actionBusy === 'close' ? 'Cerrando…' : closeIntent ? 'Reintentar cierre' : 'Confirmar cierre'}</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}
