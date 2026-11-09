import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import RemoveCircleOutlineOutlinedIcon from '@mui/icons-material/RemoveCircleOutlineOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import { useScmActor } from '../context/ScmActorContext';
import { mensajeErrorScm } from '../services/scmEngineeringApi';
import {
  confirmarDespachoMn31Scm,
  listarClientesDespachoMn31Scm,
  obtenerOperacionDespachoMn31Scm,
  resolverMangaDespachoMn31Scm,
} from '../services/scmMn31DispatchApi';

const dateText = (value) => {
  if (!value) return '—';
  const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) return `${Number(dateOnly[3])}/${Number(dateOnly[2])}/${dateOnly[1]}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString('es-PE', { timeZone: 'America/Lima' });
};
const kgText = (value) => Number(value || 0).toLocaleString('es-PE', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});
const keyFor = () => (globalThis.crypto?.randomUUID?.() || `mn31-${Date.now()}-${Math.random().toString(16).slice(2)}`);
const MN31_DISPATCH_MOTIVE = 'Despacho directo de mangas MN-31 a cliente';
const first = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');

const normalizeClient = (value, index) => ({
  id: String(first(value.id, value.cliente_id, value.codigo, value.ruc, index)),
  name: String(first(value.nombre, value.name, value.razon_social, value.nombre_comercial, value.codigo, 'Cliente sin nombre')),
  ruc: first(value.ruc, value.documento, ''),
});

const normalizeItem = (value, selectedClient) => {
  const identity = value.identidad || value.identidad_humana || value.manga?.identidad || {};
  const manga = value.manga || {};
  const ot = manga.ot || value.ot || {};
  const unidad = value.unidad || {};
  const scanCode = String(first(value.codigo, manga.codigo, value.code, value.manga_codigo, ''));
  const humanId = String(first(
    value.human_id,
    value.identidad_humana_id,
    identity.m,
    value.m,
    value.manga_codigo,
    manga.id_humano,
    value.codigo,
    manga.codigo,
    'Manga sin identidad',
  ));
  const humanParts = humanId.match(/^(.*?)-OT-?([^ -]+)-M-?(\d+)$/i);
  return {
    id: String(first(value.id, value.item_id, value.manga_id, value.existencia_id, unidad.id, humanId)),
    scanCode,
    unitId: String(first(value.unit_id, unidad.id, value.unidad_id, '')),
    version: first(value.version, unidad.version, 0),
    humanId,
    of: String(first(value.of, identity.of, value.orden_fabricacion, value.numero_of, manga.of, ot.of, humanParts?.[1], '—')),
    ot: String(first(identity.ot, value.orden_trabajo, value.numero_ot, manga.ot?.codigo, ot.codigo, humanParts?.[2], '—')),
    m: String(first(value.m, identity.m, value.manga_codigo, value.codigo_manga, humanParts?.[3] && `M-${humanParts[3]}`, manga.codigo, humanId)),
    clientName: String(first(value.cliente_nombre, value.cliente?.nombre, manga.cliente?.nombre, selectedClient?.name, '—')),
    otDate: first(value.fecha_ot, value.ot_fecha, value.fecha_operativa, value.fecha, manga.fecha_ot, ot.fecha),
    shift: String(first(value.turno, value.turno_codigo, value.jornada, manga.turno, manga.turno_origen, ot.turno, '—')),
    netKg: Number(first(value.net_kg, value.peso_neto_kg, value.kg_neto, value.kg, value.cantidad_kg, manga.peso_autoritativo_kg, 0)),
    confirmationEffect: String(first(
      value.efecto_confirmacion,
      value.confirmation_effect,
      value.efecto_despacho,
      value.estado_abierta_con_avance,
      manga.efecto_confirmacion,
      manga.confirmation_effect,
      'Se revalidará al confirmar',
    )),
    lot: String(first(value.lote?.codigo, manga.lote?.codigo, value.lote_codigo, '—')),
  };
};

const responseError = (error, fallback) => mensajeErrorScm(error, fallback);
const uncertain = (error) => {
  const status = error?.response?.status;
  const code = error?.response?.data?.error?.code || error?.response?.data?.code;
  return !error?.response || [408, 429, 500, 502, 503, 504].includes(status)
    || code === 'IDEMPOTENCY_OPERATION_INCOMPLETE';
};

function ClientPicker({ clients, selected, disabled, query, onQuery, onSelect }) {
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('es');
    if (!needle) return clients;
    return clients.filter((client) => `${client.name} ${client.ruc}`.toLocaleLowerCase('es').includes(needle));
  }, [clients, query]);
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
      <Stack spacing={1.5}>
        <Box>
          <Typography variant="h6" fontWeight={800}>Cliente de despacho</Typography>
          <Typography variant="body2" color="text.secondary">Selecciona el cliente antes de leer la primera manga.</Typography>
        </Box>
        <TextField
          label="Buscar cliente"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          disabled={disabled}
          placeholder="Nombre o RUC"
          size="small"
          fullWidth
        />
        <Stack component="ul" spacing={0.75} aria-label="Clientes autorizados para despacho MN-31" sx={{ p: 0, m: 0, listStyle: 'none' }}>
          {filtered.map((client) => (
            <Paper component="li" key={client.id} variant="outlined" sx={{ px: 1.25, py: 0.75 }}>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ minWidth: 0 }}>
                <Box sx={{ minWidth: 0 }}><Typography fontWeight={750} noWrap>{client.name}</Typography><Typography variant="caption" color="text.secondary">RUC {client.ruc || '—'}</Typography></Box>
                <Button size="small" onClick={() => onSelect(client)} disabled={disabled} sx={{ flexShrink: 0 }}>{selected?.id === client.id ? 'Seleccionado' : 'Elegir'}</Button>
              </Stack>
            </Paper>
          ))}
        </Stack>
        {!filtered.length && <Alert severity="info">No hay clientes en la búsqueda.</Alert>}
      </Stack>
    </Paper>
  );
}

function MangaCard({ item, disabled, onRemove }) {
  return (
    <Paper
      component="li"
      variant="outlined"
      data-testid="mn31-manga-card"
      sx={{ listStyle: 'none', p: 1.75, borderRadius: 2 }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ sm: 'center' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography fontWeight={850} sx={{ overflowWrap: 'anywhere' }}>{item.humanId}</Typography>
          <Typography variant="body2" color="text.secondary">{item.clientName}</Typography>
          <Typography variant="body2" color="text.secondary">OT {dateText(item.otDate)} · Turno {item.shift}</Typography>
        </Box>
        <Button
          color="error"
          size="small"
          startIcon={<RemoveCircleOutlineOutlinedIcon />}
          onClick={() => onRemove(item)}
          disabled={disabled}
          aria-label={`Retirar ${item.humanId}`}
          sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, flexShrink: 0 }}
        >
          Retirar
        </Button>
      </Stack>
    </Paper>
  );
}

function ReviewRow({ item }) {
  return (
    <Paper component="li" variant="outlined" sx={{ listStyle: 'none', p: 1.25 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', md: 'minmax(180px, 1.5fr) 110px 90px 150px minmax(220px, 2fr) 90px' }, gap: 1, alignItems: 'center' }}>
        <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' }, minWidth: 0 }}><Typography variant="caption" color="text.secondary">ID humano</Typography><Typography fontWeight={800} sx={{ overflowWrap: 'anywhere' }}>{item.humanId}</Typography></Box>
        <Box><Typography variant="caption" color="text.secondary">Fecha OT</Typography><Typography variant="body2">{dateText(item.otDate)}</Typography></Box>
        <Box><Typography variant="caption" color="text.secondary">Turno</Typography><Typography variant="body2">{item.shift}</Typography></Box>
        <Box><Typography variant="caption" color="text.secondary">Lote</Typography><Typography variant="body2" fontWeight={750} sx={{ overflowWrap: 'anywhere' }}>{item.lot}</Typography></Box>
        <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}><Typography variant="caption" color="text.secondary">Efecto al confirmar</Typography><Typography variant="body2">{item.confirmationEffect}</Typography></Box>
        <Box sx={{ textAlign: { xs: 'right', md: 'right' } }}><Typography variant="caption" color="text.secondary">Neto kg</Typography><Typography variant="body2" fontWeight={850}>{kgText(item.netKg)}</Typography></Box>
      </Box>
    </Paper>
  );
}

export default function Mn31DespachoScm() {
  const { actorId, can } = useScmActor();
  const [clients, setClients] = useState([]);
  const [client, setClient] = useState(null);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [scan, setScan] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [documento, setDocumento] = useState('');
  const [changeClientOpen, setChangeClientOpen] = useState(false);
  const [success, setSuccess] = useState(null);
  const [pending, setPending] = useState(null);
  const scanRef = useRef(null);
  const operationRef = useRef(false);
  const draftKey = `scm-mn31-dispatch:${actorId}:pending`;

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await listarClientesDespachoMn31Scm();
      const values = Array.isArray(payload) ? payload : (payload?.items || payload?.clientes || []);
      setClients(values.map(normalizeClient));
    } catch (error) {
      setNotice({ severity: 'error', message: responseError(error, 'No se pudo cargar el catálogo de clientes. Reintenta sin perder el contexto.') });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadClients();
    try { setPending(JSON.parse(sessionStorage.getItem(draftKey) || 'null')); } catch { setPending(null); }
  }, [draftKey, loadClients]);

  const clearPending = useCallback(() => { sessionStorage.removeItem(draftKey); setPending(null); }, [draftKey]);
  useEffect(() => {
    if (!pending?.operationId) return;
    obtenerOperacionDespachoMn31Scm(pending.operationId)
      .then((payload) => { clearPending(); setSuccess(payload); setNotice({ severity: 'success', message: 'Operación recuperada desde Central sin repetir el despacho.' }); })
      .catch(() => {});
  }, [pending?.operationId, clearPending]);

  const resetDraft = () => {
    clearPending(); setClient(null); setItems([]); setScan(''); setDocumento(''); setNotice(null); setSuccess(null); setReviewOpen(false);
    setTimeout(() => scanRef.current?.focus(), 0);
  };
  const selectClient = async (nextClient) => {
    if (client?.id === nextClient.id) return;
    if (items.length) { setChangeClientOpen(true); return; }
    setClient(nextClient); setSuccess(null); setNotice({ severity: 'success', message: `${nextClient.name} seleccionado. Escanea una manga MN-31.` });
    setTimeout(() => scanRef.current?.focus(), 0);
  };
  const confirmClientChange = async () => {
    setChangeClientOpen(false); setClient(null); setItems([]); setSuccess(null); setNotice({ severity: 'info', message: 'Selección retirada. Elige el nuevo cliente y vuelve a escanear.' });
  };

  const scanManga = async () => {
    const code = scan.trim();
    if (!code || busy || !client || !can('DESPACHO_MN31_CONFIRMAR') || operationRef.current) return;
    operationRef.current = true; setBusy(true); setNotice({ severity: 'info', message: 'Validando manga…' });
    try {
      const payload = await resolverMangaDespachoMn31Scm(code, client.id);
      const resolved = normalizeItem(payload, client);
      if (items.some((item) => item.unitId && item.unitId === resolved.unitId) || items.some((item) => item.humanId === resolved.humanId)) {
        setNotice({ severity: 'warning', message: 'La manga ya está en la revisión; no se duplicó.' });
      } else {
        setItems((current) => [...current, resolved]); setNotice({ severity: 'success', message: 'Manga elegible agregada a la revisión.' });
      }
      setScan('');
      setTimeout(() => scanRef.current?.focus(), 0);
    } catch (error) {
      setNotice({ severity: error?.response?.status === 409 ? 'warning' : 'error', message: responseError(error, 'La manga no pudo agregarse. Revisa peso, anulación o alcance y reintenta.') });
    } finally { operationRef.current = false; setBusy(false); }
  };

  const removeManga = async (item) => {
    if (busy) return;
    setItems((current) => current.filter((candidate) => candidate.id !== item.id));
    setNotice({ severity: 'info', message: 'Manga retirada de la revisión; no se movió Kardex.' });
  };

  const confirmDispatch = async () => {
    if (!items.length || !client || busy) return;
    const operationId = pending?.operationId || keyFor();
    const payload = { cliente_id: Number(client.id), documento: documento.trim() || undefined, motivo: MN31_DISPATCH_MOTIVE, items: items.map((item) => ({ codigo: item.scanCode || item.humanId, unit_id: item.unitId || undefined, version: item.version })) };
    const intent = { operationId, payload };
    setBusy(true); setNotice({ severity: 'info', message: 'Confirmando despacho…' });
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(intent)); setPending(intent);
      const result = await confirmarDespachoMn31Scm(payload, operationId);
      clearPending(); setReviewOpen(false); setSuccess(result); setNotice({ severity: 'success', message: 'Despacho confirmado y registrado por la sesión SCM.' });
    } catch (error) {
      if (!uncertain(error)) { clearPending(); setReviewOpen(false); setItems([]); setNotice({ severity: 'error', message: responseError(error, 'La identidad cambió. Vuelve a escanear las mangas para revalidar antes de confirmar.') }); }
      else { setReviewOpen(false); setNotice({ severity: 'warning', message: 'Respuesta incierta: conserva la selección y recupera la misma operación.' }); }
    } finally { setBusy(false); }
  };
  const recoverDispatch = async () => {
    if (!pending || busy) return;
    setBusy(true); setNotice({ severity: 'info', message: 'Recuperando la misma operación…' });
    try {
      const result = await confirmarDespachoMn31Scm(pending.payload, pending.operationId);
      clearPending(); setSuccess(result); setReviewOpen(false); setNotice({ severity: 'success', message: 'Operación recuperada sin enviar un segundo despacho.' });
    } catch (error) { setNotice({ severity: 'warning', message: responseError(error, 'No se pudo recuperar todavía. Conserva la selección y vuelve a intentarlo.') }); }
    finally { setBusy(false); }
  };

  const totalKg = items.reduce((total, item) => total + (Number.isFinite(item.netKg) ? item.netKg : 0), 0);
  const canConfirm = can('DESPACHO_MN31_CONFIRMAR') && items.length > 0 && !busy && !pending;
  const confirmed = success?.resultado || success?.result || success;
  const confirmedTotalKg = first(confirmed?.total_kg, confirmed?.peso_total_kg, confirmed?.resumen?.total_kg);
  const confirmedCount = first(confirmed?.cantidad_mangas, confirmed?.mangas_count, confirmed?.resumen?.cantidad_mangas);
  const confirmedClient = first(confirmed?.cliente?.nombre, confirmed?.cliente_nombre, client?.name);

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', pt: { xs: 8, md: 2 }, pb: { xs: 2, md: 2 } }}>
      <Stack spacing={2.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} alignItems={{ sm: 'flex-start' }}>
          <Box>
            <Typography variant="h4" component="h1" fontWeight={850}>Despacho MN-31</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>Selecciona cliente, escanea mangas elegibles y confirma una salida trazable.</Typography>
          </Box>
          <Button variant="outlined" startIcon={<RefreshOutlinedIcon />} onClick={loadClients} disabled={busy}>Actualizar clientes</Button>
        </Stack>
        {loading && <LinearProgress aria-label="Cargando clientes" />}
        <Snackbar open={Boolean(notice)} autoHideDuration={7000} onClose={() => setNotice(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}><Alert onClose={() => setNotice(null)} severity={notice?.severity || 'info'} role="alert" variant="filled" sx={{ width: '100%' }}>{notice?.message}</Alert></Snackbar>
        {pending && <Alert severity="warning" action={<Button color="inherit" size="small" onClick={recoverDispatch} disabled={busy}>Recuperar</Button>}>Respuesta incierta: la operación quedó guardada. Recupera la misma operación antes de continuar.</Alert>}
        {success && <Paper variant="outlined" sx={{ p: 2, borderColor: 'success.main', bgcolor: 'success.50' }} role="status"><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between"><Box><Typography variant="h6" fontWeight={800}><CheckCircleOutlineOutlinedIcon color="success" sx={{ mr: 0.75, verticalAlign: 'middle' }} />Despacho confirmado</Typography><Typography variant="body2" color="text.secondary">Operación {success.operation_id || success.id || 'registrada'} · Cliente {confirmedClient} · {confirmedCount ?? '—'} mangas · {confirmedTotalKg == null ? '—' : kgText(confirmedTotalKg)} kg</Typography></Box><Button variant="outlined" onClick={resetDraft}>Nuevo despacho</Button></Stack></Paper>}
        {!client && <ClientPicker clients={clients} selected={client} disabled={busy || Boolean(success)} query={query} onQuery={setQuery} onSelect={selectClient} />}
        {client && !success && <>
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.paper' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ sm: 'center' }}>
              <Box><Typography variant="overline" color="text.secondary">Cliente seleccionado</Typography><Typography variant="h6" fontWeight={850}>{client.name}</Typography>{client.ruc && <Typography variant="body2" color="text.secondary">RUC {client.ruc}</Typography>}</Box>
              <Button variant="text" onClick={() => (items.length ? setChangeClientOpen(true) : confirmClientChange())} disabled={busy}>Cambiar cliente</Button>
            </Stack>
          </Paper>
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack spacing={1.5}>
              <Box><Typography variant="h6" fontWeight={800}>Escanear mangas</Typography><Typography variant="body2" color="text.secondary">El lector envía el código con Enter. La validación rechaza anuladas o sin peso y conserva la sesión si falla.</Typography></Box>
              <Stack component="form" direction={{ xs: 'column', sm: 'row' }} spacing={1} onSubmit={(event) => { event.preventDefault(); scanManga(); }}>
                <TextField inputRef={scanRef} fullWidth autoFocus label="Escanear código de manga" value={scan} onChange={(event) => setScan(event.target.value)} disabled={busy || Boolean(pending)} placeholder="OF…-OT…-M…" slotProps={{ input: { startAdornment: <QrCodeScannerOutlinedIcon color="action" sx={{ mr: 1 }} /> } }} />
                <Button type="submit" variant="contained" disabled={!scan.trim() || busy || Boolean(pending)} sx={{ minWidth: { sm: 150 } }}>Agregar manga</Button>
              </Stack>
            </Stack>
          </Paper>
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack spacing={1.5}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                <Box><Typography variant="h6" fontWeight={800}>Mangas seleccionadas</Typography><Typography variant="body2" color="text.secondary">Cada tarjeta conserva únicamente la identidad operativa y la acción Retirar.</Typography></Box>
                <Typography variant="body2" fontWeight={800}>{items.length} manga{items.length === 1 ? '' : 's'} · {kgText(totalKg)} kg</Typography>
              </Stack>
              {items.length ? <Stack component="ul" aria-label="Mangas seleccionadas para despacho" spacing={1} sx={{ p: 0, m: 0 }}>{items.map((item) => <MangaCard key={item.id} item={item} disabled={busy || Boolean(pending)} onRemove={removeManga} />)}</Stack> : <Alert severity="info">Aún no hay mangas. Escanea una identidad para revisar.</Alert>}
              <Divider />
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5} alignItems={{ sm: 'center' }}>
                <Box><Typography variant="body2" fontWeight={800}>Revisión antes de confirmar</Typography><Typography variant="body2" color="text.secondary">El despacho debita el peso neto de las mangas aceptadas.</Typography></Box>
                <Button variant="contained" disabled={!canConfirm} onClick={() => setReviewOpen(true)}>Revisar y confirmar</Button>
              </Stack>
            </Stack>
          </Paper>
        </>}
      </Stack>
      <Dialog open={reviewOpen} onClose={() => !busy && setReviewOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Revisión de despacho MN-31</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Alert severity="info">Cliente: <strong>{client?.name}</strong>. Verifica la selección antes de registrar la salida. Las mangas abiertas con avance se cierran y registran delta, ingreso y salida en la misma operación.</Alert>
            <TextField label="Referencia comercial (opcional)" value={documento} onChange={(event) => setDocumento(event.target.value)} fullWidth helperText="Guía u orden del cliente; el comprobante SCM será la causa del despacho." />
            <Stack component="ul" spacing={1} aria-label="Revisión de mangas MN-31" sx={{ p: 0, m: 0 }}>{items.map((item) => <ReviewRow key={item.id} item={item} />)}</Stack>
            <Typography variant="h6" align="right">Total: {kgText(totalKg)} kg</Typography>
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setReviewOpen(false)} disabled={busy}>Seguir revisando</Button><Button variant="contained" onClick={confirmDispatch} disabled={!canConfirm}>Confirmar despacho</Button></DialogActions>
      </Dialog>
      <Dialog open={changeClientOpen} onClose={() => !busy && setChangeClientOpen(false)}>
        <DialogTitle>Cambiar cliente</DialogTitle>
        <DialogContent><Typography>Se retirarán las mangas de esta sesión para evitar mezclar clientes. Elige el nuevo cliente y vuelve a escanear.</Typography></DialogContent>
        <DialogActions><Button onClick={() => setChangeClientOpen(false)}>Cancelar</Button><Button color="warning" variant="contained" onClick={confirmClientChange}>Retirar selección</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

