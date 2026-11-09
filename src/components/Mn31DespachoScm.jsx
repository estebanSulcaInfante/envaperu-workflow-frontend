import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
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
  revertirDespachoMn31Scm,
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
  const versionToken = first(value.version_token, manga.version_token);
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
    unitId: first(value.unit_id, unidad.id, value.unidad_id) ? String(first(value.unit_id, unidad.id, value.unidad_id)) : '',
    version: first(value.version, unidad.version, manga.version, versionToken?.manga, 0),
    versionToken: versionToken && typeof versionToken === 'object' ? versionToken : null,
    requiresIngresoKg004: Boolean(first(value.requiere_ingreso_kg004, manga.requiere_ingreso_kg004, false)),
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
      first(value.requiere_ingreso_kg004, manga.requiere_ingreso_kg004, false)
        ? 'Registra ingreso KG004, concilia el delta y registra salida'
        : 'Se revalidará al confirmar',
    )),
    lot: String(first(value.lote?.codigo, manga.lote?.codigo, value.lote_codigo, '—')),
    lotCode: String(first(value.lote?.codigo, manga.lote?.codigo, value.lote_codigo, '')),
    productiveChange: Boolean(value.hubo_cambio_productivo || manga.hubo_cambio_productivo),
  };
};

const responseError = (error, fallback) => mensajeErrorScm(error, fallback);
const errorData = (error) => error?.response?.data?.error || error?.response?.data || {};
const lotSelectionError = (error) => ['MN31_LOT_SELECTION_REQUIRED', 'MN31_LOT_SELECTION_INVALID'].includes(errorData(error).code);
const conflictError = (error) => error?.response?.status === 409 || ['VERSION_CONFLICT', 'INVENTORY_CONFLICT', 'MN31_STOCK_NOT_AVAILABLE'].includes(errorData(error).code);
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

function ReviewRow({ item, issue, onChangeProductive, onRevalidate, disabled }) {
  return (
    <Paper component="li" variant="outlined" sx={{ listStyle: 'none', p: { xs: 1, md: 1.25 } }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', md: 'minmax(180px, 1.5fr) 110px 90px 150px minmax(220px, 2fr) 90px' }, gap: 1, alignItems: 'center' }}>
        <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' }, minWidth: 0 }}><Typography variant="caption" color="text.secondary">ID humano</Typography><Typography fontWeight={800} sx={{ overflowWrap: 'anywhere' }}>{item.humanId}</Typography></Box>
        <Box><Typography variant="caption" color="text.secondary">Fecha OT</Typography><Typography variant="body2">{dateText(item.otDate)}</Typography></Box>
        <Box><Typography variant="caption" color="text.secondary">Turno</Typography><Typography variant="body2">{item.shift}</Typography></Box>
        <Box><Typography variant="caption" color="text.secondary">Lote</Typography><Typography variant="body2" fontWeight={750} sx={{ overflowWrap: 'anywhere' }}>{item.lot}</Typography></Box>
        <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}><Typography variant="caption" color="text.secondary">Efecto al confirmar</Typography><Typography variant="body2">{item.confirmationEffect}</Typography></Box>
        <Box sx={{ textAlign: { xs: 'right', md: 'right' } }}><Typography variant="caption" color="text.secondary">Neto kg</Typography><Typography variant="body2" fontWeight={850}>{kgText(item.netKg)}</Typography></Box>
        <FormControlLabel sx={{ gridColumn: '1 / -1', m: 0 }} control={<Checkbox size="small" checked={item.productiveChange} onChange={(event) => onChangeProductive(item.id, event.target.checked)} disabled={disabled} />} label="Hubo cambio productivo" />
        {issue && <Alert severity="warning" sx={{ gridColumn: '1 / -1', py: 0.25 }} action={<Button color="inherit" size="small" onClick={() => onRevalidate(item)} disabled={disabled}>Revalidar manga</Button>}>{issue.message}</Alert>}
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
  const [itemIssues, setItemIssues] = useState({});
  const [scan, setScan] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [documento, setDocumento] = useState('');
  const [changeClientOpen, setChangeClientOpen] = useState(false);
  const [lotDialog, setLotDialog] = useState(null);
  const [lotChoice, setLotChoice] = useState('');
  const [lotProductiveChange, setLotProductiveChange] = useState(false);
  const [success, setSuccess] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [reverseOpen, setReverseOpen] = useState(false);
  const [reverseReason, setReverseReason] = useState('');
  const [reverseResult, setReverseResult] = useState(null);
  const [reverseBusy, setReverseBusy] = useState(false);
  const [pending, setPending] = useState(null);
  const [pendingReverse, setPendingReverse] = useState(null);
  const [lastOperationId, setLastOperationId] = useState('');
  const [lookupId, setLookupId] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const scanRef = useRef(null);
  const operationRef = useRef(false);
  const restoredLastOperationRef = useRef('');
  const draftKey = `scm-mn31-dispatch:${actorId}:pending`;
  const reverseKey = `scm-mn31-dispatch:${actorId}:reverse-pending`;
  const lastOperationKey = `scm-mn31-dispatch:${actorId}:last-operation`;

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
    try { setPendingReverse(JSON.parse(sessionStorage.getItem(reverseKey) || 'null')); } catch { setPendingReverse(null); }
    try {
      const storedOperationId = JSON.parse(sessionStorage.getItem(lastOperationKey) || 'null')?.operationId || '';
      setLastOperationId(storedOperationId);
      setLookupId(storedOperationId);
    } catch { setLastOperationId(''); setLookupId(''); }
  }, [draftKey, lastOperationKey, loadClients, reverseKey]);

  const clearPending = useCallback(() => { sessionStorage.removeItem(draftKey); setPending(null); }, [draftKey]);
  const clearPendingReverse = useCallback(() => { sessionStorage.removeItem(reverseKey); setPendingReverse(null); }, [reverseKey]);
  useEffect(() => {
    if (!pending?.operationId) return;
    obtenerOperacionDespachoMn31Scm(pending.operationId)
      .then((payload) => { if (!payload?.operation_id && !payload?.id && !payload?.estado) return; clearPending(); setSuccess(payload); setNotice({ severity: 'success', message: 'Operación recuperada desde Central sin repetir el despacho.' }); })
      .catch(() => {});
  }, [pending?.operationId, clearPending]);

  useEffect(() => {
    if (!lastOperationId || pending?.operationId || success || restoredLastOperationRef.current === lastOperationId) return;
    restoredLastOperationRef.current = lastOperationId;
    obtenerOperacionDespachoMn31Scm(lastOperationId)
      .then((payload) => setSuccess(payload))
      .catch(() => setLastOperationId(''));
  }, [lastOperationId, pending?.operationId, success]);

  const consultReceipt = async (requestedId = lookupId) => {
    const operationId = String(requestedId || '').trim();
    if (!operationId || lookupBusy || busy) return;
    setLookupBusy(true); setNotice({ severity: 'info', message: 'Consultando comprobante…' });
    try {
      const payload = await obtenerOperacionDespachoMn31Scm(operationId);
      if (!payload?.operation_id && !payload?.id && !payload?.estado) throw new Error('El comprobante no está disponible todavía.');
      sessionStorage.setItem(lastOperationKey, JSON.stringify({ operationId }));
      setLastOperationId(operationId); setLookupId(operationId); setSuccess(payload); setNotice({ severity: 'success', message: 'Comprobante consultado; puedes revisar o revertir con tu permiso.' });
    } catch (error) {
      setNotice({ severity: 'error', message: responseError(error, 'No se encontró un comprobante MN-31 con ese ID.') });
    } finally { setLookupBusy(false); }
  };

  const resetDraft = () => {
    if (pendingReverse) {
      setNotice({ severity: 'warning', message: 'Recupera la reversa pendiente antes de iniciar otro despacho.' });
      return;
    }
    clearPending(); sessionStorage.removeItem(reverseKey); setPendingReverse(null); setClient(null); setItems([]); setItemIssues({}); setScan(''); setDocumento(''); setNotice(null); setSuccess(null); setReverseResult(null); setReceiptOpen(false); setReverseOpen(false); setLookupId(lastOperationId);
    setTimeout(() => scanRef.current?.focus(), 0);
  };
  const selectClient = async (nextClient) => {
    if (client?.id === nextClient.id) return;
    if (items.length) { setChangeClientOpen(true); return; }
    setClient(nextClient); setSuccess(null); setNotice({ severity: 'success', message: `${nextClient.name} seleccionado. Escanea una manga MN-31.` });
    setTimeout(() => scanRef.current?.focus(), 0);
  };
  const confirmClientChange = async () => {
    setChangeClientOpen(false); setClient(null); setItems([]); setItemIssues({}); setSuccess(null); setNotice({ severity: 'info', message: 'Selección retirada. Elige el nuevo cliente y vuelve a escanear.' });
  };

  const appendResolved = (payload, scannedCode, options = {}) => {
    const normalized = normalizeItem(payload, client);
    const resolved = {
      ...normalized,
      scanCode: scannedCode,
      lotCode: options.loteCodigo || normalized.lotCode,
      productiveChange: Boolean(options.huboCambioProductivo),
    };
    if (items.some((item) => item.unitId && item.unitId === resolved.unitId) || items.some((item) => item.humanId === resolved.humanId)) {
      setNotice({ severity: 'warning', message: 'La manga ya está en la revisión; no se duplicó.' });
      return;
    }
    setItems((current) => [...current, resolved]); setNotice({ severity: 'success', message: 'Manga elegible agregada a la revisión.' });
  };

  const replaceResolved = (itemId, payload, scannedCode, options = {}) => {
    const normalized = normalizeItem(payload, client);
    const resolved = {
      ...normalized,
      id: itemId,
      scanCode: scannedCode,
      lotCode: options.loteCodigo || normalized.lotCode,
      productiveChange: Boolean(options.huboCambioProductivo),
    };
    setItems((current) => current.map((item) => (item.id === itemId ? resolved : item)));
    setItemIssues((current) => { const next = { ...current }; delete next[itemId]; return next; });
    setNotice({ severity: 'success', message: 'Manga revalidada con el cambio productivo declarado.' });
  };

  const resolveLotSelection = async () => {
    if (!lotDialog?.scanCode || !lotChoice || busy || !client) return;
    setBusy(true); setNotice({ severity: 'info', message: 'Revalidando manga con el lote elegido…' });
    try {
      const payload = await resolverMangaDespachoMn31Scm(lotDialog.scanCode, client.id, { loteCodigo: lotChoice, huboCambioProductivo: lotProductiveChange });
      if (lotDialog.itemId) replaceResolved(lotDialog.itemId, payload, lotDialog.scanCode, { loteCodigo: lotChoice, huboCambioProductivo: lotProductiveChange });
      else appendResolved(payload, lotDialog.scanCode, { loteCodigo: lotChoice, huboCambioProductivo: lotProductiveChange });
      setLotDialog(null); setLotChoice(''); setLotProductiveChange(false); setScan('');
      setTimeout(() => scanRef.current?.focus(), 0);
    } catch (error) {
      setNotice({ severity: 'warning', message: responseError(error, 'El lote elegido ya no es válido. Selecciona otro candidato.') });
    } finally { setBusy(false); }
  };

  const scanManga = async () => {
    const code = scan.trim();
    if (!code || busy || !client || !can('DESPACHO_MN31_CONFIRMAR') || operationRef.current) return;
    operationRef.current = true; setBusy(true); setNotice({ severity: 'info', message: 'Validando manga…' });
    try {
      const payload = await resolverMangaDespachoMn31Scm(code, client.id);
      appendResolved(payload, code);
      setScan('');
      setTimeout(() => scanRef.current?.focus(), 0);
    } catch (error) {
      if (lotSelectionError(error)) {
        const details = errorData(error).details || errorData(error);
        const candidates = Array.isArray(details.candidatos) ? details.candidatos : [];
        const suggested = details.candidato_sugerido || '';
        setLotDialog({ scanCode: code, candidates, suggested });
        setLotChoice(''); setLotProductiveChange(false);
        setNotice({ severity: 'warning', message: 'La manga requiere elegir explícitamente un lote candidato.' });
      } else setNotice({ severity: error?.response?.status === 409 ? 'warning' : 'error', message: responseError(error, 'La manga no pudo agregarse. Revisa peso, anulación o alcance y reintenta.') });
    } finally { operationRef.current = false; setBusy(false); }
  };

  const removeManga = async (item) => {
    if (busy) return;
    setItems((current) => current.filter((candidate) => candidate.id !== item.id));
    setItemIssues((current) => { const next = { ...current }; delete next[item.id]; return next; });
    setNotice({ severity: 'info', message: 'Manga retirada de la revisión; no se movió Kardex.' });
  };

  const revalidateItem = async (item) => {
    if (!item || busy || !client) return;
    setBusy(true); setNotice({ severity: 'info', message: `Revalidando ${item.humanId}…` });
    try {
      const payload = await resolverMangaDespachoMn31Scm(item.scanCode, client.id, { loteCodigo: item.lotCode, huboCambioProductivo: item.productiveChange });
      replaceResolved(item.id, payload, item.scanCode, { loteCodigo: item.lotCode, huboCambioProductivo: item.productiveChange });
      setItemIssues((current) => { const next = { ...current }; delete next[item.id]; return next; });
    } catch (error) {
      if (lotSelectionError(error)) {
        const details = errorData(error).details || errorData(error);
        setLotDialog({ scanCode: item.scanCode, itemId: item.id, candidates: Array.isArray(details.candidatos) ? details.candidatos : [], suggested: details.candidato_sugerido || '' });
        setLotChoice(''); setLotProductiveChange(Boolean(item.productiveChange));
      }
      setItemIssues((current) => ({ ...current, [item.id]: { message: responseError(error, 'La manga no pudo revalidarse; corrige el lote o retírala antes de confirmar.') } }));
      setNotice({ severity: 'warning', message: 'La manga afectada quedó visible en la revisión para corregirla o retirarla.' });
    } finally { setBusy(false); }
  };

  const revalidateItems = async (sourceItems) => {
    const issues = {};
    for (const item of sourceItems) {
      try {
        const payload = await resolverMangaDespachoMn31Scm(item.scanCode, client.id, { loteCodigo: item.lotCode, huboCambioProductivo: item.productiveChange });
        replaceResolved(item.id, payload, item.scanCode, { loteCodigo: item.lotCode, huboCambioProductivo: item.productiveChange });
      } catch (error) {
        issues[item.id] = { message: responseError(error, 'La manga no pudo revalidarse; corrige el lote o retírala antes de confirmar.') };
      }
    }
    setItemIssues(issues);
    const affected = Object.keys(issues).length;
    setNotice({ severity: affected ? 'warning' : 'info', message: affected ? `${affected} manga(s) afectada(s) quedó(aron) visible(s) para corregir o retirar.` : 'Las mangas fueron revalidadas; revisa y confirma nuevamente.' });
  };

  const setProductiveChange = async (itemId, value) => {
    const item = items.find((candidate) => candidate.id === itemId);
    if (!item || busy || !value) {
      if (item && !value) setItems((current) => current.map((candidate) => (candidate.id === itemId ? { ...candidate, productiveChange: false } : candidate)));
      return;
    }
    setBusy(true); setNotice({ severity: 'info', message: 'Revalidando cambio productivo y lote…' });
    try {
      const payload = await resolverMangaDespachoMn31Scm(item.scanCode, client.id, { loteCodigo: item.lotCode, huboCambioProductivo: true });
      replaceResolved(item.id, payload, item.scanCode, { loteCodigo: item.lotCode, huboCambioProductivo: true });
      setItemIssues((current) => { const next = { ...current }; delete next[item.id]; return next; });
    } catch (error) {
      if (lotSelectionError(error)) {
        const details = errorData(error).details || errorData(error);
        const candidates = Array.isArray(details.candidatos) ? details.candidatos : [];
        const suggested = details.candidato_sugerido || '';
        setLotDialog({ scanCode: item.scanCode, itemId: item.id, candidates, suggested });
        setLotChoice(''); setLotProductiveChange(true);
        setNotice({ severity: 'warning', message: 'El cambio productivo requiere elegir el nuevo lote candidato.' });
      } else setNotice({ severity: 'warning', message: responseError(error, 'No se pudo revalidar el cambio productivo; la manga conserva su selección.') });
    } finally { setBusy(false); }
  };

  const confirmDispatch = async () => {
    if (!items.length || !client || busy) return;
    const operationId = pending?.operationId || keyFor();
    const payload = {
      cliente_id: Number(client.id),
      documento: documento.trim() || undefined,
      motivo: MN31_DISPATCH_MOTIVE,
      items: items.map((item) => ({
        codigo: item.scanCode || item.humanId,
        unit_id: item.unitId || undefined,
        version: item.version,
        lote_codigo: item.lotCode || undefined,
        hubo_cambio_productivo: Boolean(item.productiveChange),
        ...(item.versionToken ? { version_token: item.versionToken } : {}),
      })),
    };
    const intent = { operationId, payload };
    setBusy(true); setNotice({ severity: 'info', message: 'Confirmando despacho…' });
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(intent)); setPending(intent);
      const result = await confirmarDespachoMn31Scm(payload, operationId);
      clearPending(); sessionStorage.setItem(lastOperationKey, JSON.stringify({ operationId: result.operation_id || result.id })); setLastOperationId(result.operation_id || result.id || ''); setReviewOpen(false); setSuccess(result); setNotice({ severity: 'success', message: 'Despacho confirmado y registrado por la sesión SCM.' });
    } catch (error) {
      if (!uncertain(error)) {
        clearPending();
        if (conflictError(error)) {
          setNotice({ severity: 'warning', message: 'La identidad o el saldo cambió. Revalidando las mangas sin perder la selección…' });
          await revalidateItems(items);
        } else setNotice({ severity: 'error', message: responseError(error, 'La confirmación fue rechazada; conserva la selección y corrige o reintenta.') });
      }
      else { setReviewOpen(false); setNotice({ severity: 'warning', message: 'Respuesta incierta: conserva la selección y recupera la misma operación.' }); }
    } finally { setBusy(false); }
  };
  const recoverDispatch = async () => {
    if (!pending || busy) return;
    setBusy(true); setNotice({ severity: 'info', message: 'Recuperando la misma operación…' });
    try {
      const result = await confirmarDespachoMn31Scm(pending.payload, pending.operationId);
      clearPending(); sessionStorage.setItem(lastOperationKey, JSON.stringify({ operationId: result.operation_id || result.id })); setLastOperationId(result.operation_id || result.id || ''); setSuccess(result); setReviewOpen(false); setNotice({ severity: 'success', message: 'Operación recuperada sin enviar un segundo despacho.' });
    } catch (error) { setNotice({ severity: 'warning', message: responseError(error, 'No se pudo recuperar todavía. Conserva la selección y vuelve a intentarlo.') }); }
    finally { setBusy(false); }
  };

  const submitReverse = async (intent = null) => {
    const dispatchOperationId = intent?.dispatchOperationId || success?.operation_id || success?.id;
    const operationId = intent?.operationId || keyFor();
    const payload = intent?.payload || { motivo: reverseReason.trim() };
    if (!dispatchOperationId || !payload.motivo || reverseBusy) return;
    const nextIntent = { dispatchOperationId, operationId, payload, receipt: success };
    setReverseBusy(true); setNotice({ severity: 'info', message: 'Registrando reversa compensatoria…' });
    try {
      sessionStorage.setItem(reverseKey, JSON.stringify(nextIntent)); setPendingReverse(nextIntent);
      const result = await revertirDespachoMn31Scm(dispatchOperationId, payload, operationId);
      clearPendingReverse(); setReverseResult(result); setReverseOpen(false); setReceiptOpen(false); setNotice({ severity: 'success', message: 'Reversa registrada con compensación de Kardex.' });
    } catch (error) {
      if (uncertain(error)) { setReverseOpen(false); setReceiptOpen(false); setNotice({ severity: 'warning', message: 'Respuesta incierta: conserva la reversa y recupérala con la misma operación.' }); }
      else { clearPendingReverse(); setNotice({ severity: 'error', message: responseError(error, 'La reversa fue rechazada; el despacho original permanece vigente.') }); }
    } finally { setReverseBusy(false); }
  };

  const recoverReverse = async () => {
    if (!pendingReverse || reverseBusy) return;
    await submitReverse(pendingReverse);
  };

  const totalKg = items.reduce((total, item) => total + (Number.isFinite(item.netKg) ? item.netKg : 0), 0);
  const canConfirm = can('DESPACHO_MN31_CONFIRMAR') && items.length > 0 && !busy && !pending && !Object.keys(itemIssues).length;
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
        {pendingReverse && <Alert severity="warning" action={<Button color="inherit" size="small" onClick={recoverReverse} disabled={reverseBusy}>Recuperar reversa</Button>}>La reversa quedó pendiente. Recupera la misma operación antes de iniciar otra.</Alert>}
        {!client && !success && <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack spacing={1.25}>
            <Box><Typography variant="h6" fontWeight={800}>Consultar comprobante</Typography><Typography variant="body2" color="text.secondary">Recupera un despacho MN-31 confirmado en este u otro dispositivo para revisar su trazabilidad o solicitar una reversa.</Typography></Box>
            <Stack component="form" direction={{ xs: 'column', sm: 'row' }} spacing={1} onSubmit={(event) => { event.preventDefault(); consultReceipt(); }}>
              <TextField label="ID del comprobante" value={lookupId} onChange={(event) => setLookupId(event.target.value)} placeholder="UUID de operación" fullWidth size="small" disabled={lookupBusy || Boolean(pending)} />
              <Button type="submit" variant="outlined" disabled={!lookupId.trim() || lookupBusy || Boolean(pending)} sx={{ minWidth: { sm: 190 } }}>{lookupBusy ? 'Consultando…' : 'Consultar comprobante'}</Button>
            </Stack>
            {lastOperationId && <Button variant="text" size="small" onClick={() => consultReceipt(lastOperationId)} disabled={lookupBusy || Boolean(pending)} sx={{ alignSelf: 'flex-start' }}>Consultar último comprobante local</Button>}
          </Stack>
        </Paper>}
        {success && <Paper variant="outlined" sx={{ p: 2, borderColor: reverseResult ? 'warning.main' : 'success.main', bgcolor: reverseResult ? 'warning.50' : 'success.50' }} role="status"><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between"><Box><Typography variant="h6" fontWeight={800}><CheckCircleOutlineOutlinedIcon color={reverseResult ? 'warning' : 'success'} sx={{ mr: 0.75, verticalAlign: 'middle' }} />{reverseResult ? 'Despacho revertido' : 'Despacho confirmado'}</Typography><Typography variant="body2" color="text.secondary">Operación {success.operation_id || success.id || 'registrada'} · Cliente {confirmedClient} · {confirmedCount ?? '—'} mangas · {confirmedTotalKg == null ? '—' : kgText(confirmedTotalKg)} kg</Typography></Box><Stack direction="row" spacing={1}><Button variant="outlined" onClick={() => setReceiptOpen(true)}>Ver comprobante</Button><Button variant="outlined" onClick={resetDraft} disabled={Boolean(pendingReverse)}>Nuevo despacho</Button></Stack></Stack></Paper>}
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
        <DialogTitle sx={{ py: { xs: 1, sm: 2 }, fontSize: { xs: '1.15rem', sm: '1.25rem' } }}>Revisión de despacho MN-31</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={{ xs: 1, sm: 1.5 }}>
            <Alert severity="info" sx={{ py: { xs: 0.25, sm: 1 }, px: { xs: 1, sm: 2 }, '& .MuiAlert-message': { py: { xs: 0.35, sm: 0.5 }, fontSize: { xs: '0.78rem', sm: '0.875rem' } } }}>Cliente: <strong>{client?.name}</strong>. Verifica la selección antes de registrar la salida. Las mangas abiertas con avance se cierran y registran delta, ingreso y salida en la misma operación.</Alert>
            <TextField label="Referencia comercial (opcional)" value={documento} onChange={(event) => setDocumento(event.target.value)} fullWidth size="small" helperText="Guía u orden del cliente; el comprobante SCM será la causa del despacho." sx={{ '& .MuiFormHelperText-root': { display: { xs: 'none', sm: 'block' } } }} />
            <Stack component="ul" spacing={1} aria-label="Revisión de mangas MN-31" sx={{ p: 0, m: 0 }}>{items.map((item) => <ReviewRow key={item.id} item={item} issue={itemIssues[item.id]} onChangeProductive={setProductiveChange} onRevalidate={revalidateItem} disabled={busy} />)}</Stack>
            <Typography variant="h6" align="right">Total: {kgText(totalKg)} kg</Typography>
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setReviewOpen(false)} disabled={busy}>Seguir revisando</Button><Button variant="contained" onClick={confirmDispatch} disabled={!canConfirm}>Confirmar despacho</Button></DialogActions>
      </Dialog>
      <Dialog open={Boolean(lotDialog)} onClose={() => !busy && setLotDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>Selecciona lote para esta manga</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Alert severity="warning">La manga no puede continuar sin una elección explícita: hay cambio productivo o más de un lote candidato.</Alert>
            <Typography variant="body2" color="text.secondary">Código leído: <strong>{lotDialog?.scanCode}</strong></Typography>
            <Stack spacing={0.75} role="radiogroup" aria-label="Lotes candidatos">
              {[...new Set([...(lotDialog?.candidates || []), ...(lotDialog?.suggested ? [lotDialog.suggested] : [])])].map((candidate) => <Button key={candidate} variant={lotChoice === candidate ? 'contained' : 'outlined'} onClick={() => setLotChoice(candidate)} role="radio" aria-checked={lotChoice === candidate} fullWidth sx={{ justifyContent: 'flex-start' }}>{candidate}{candidate === lotDialog?.suggested ? ' · sugerido' : ''}</Button>)}
            </Stack>
            {!lotDialog?.candidates?.length && !lotDialog?.suggested && <Alert severity="error">Central no entregó candidatos; reintenta la lectura o solicita revisión del lote.</Alert>}
            <FormControlLabel control={<Checkbox checked={lotProductiveChange} onChange={(event) => setLotProductiveChange(event.target.checked)} />} label="Hubo cambio productivo desde la lectura" />
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setLotDialog(null)} disabled={busy}>Cancelar</Button><Button variant="contained" onClick={resolveLotSelection} disabled={!lotChoice || busy}>Revalidar manga</Button></DialogActions>
      </Dialog>
      <Dialog open={receiptOpen} onClose={() => !reverseBusy && setReceiptOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Comprobante de despacho MN-31</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.25}>
            {reverseResult ? <Alert severity="success">Reversa confirmada: {reverseResult.operation_id}. Kardex fue compensado sin reabrir el pesaje.</Alert> : <Alert severity="info">Operación {success?.operation_id || success?.id}. Cliente {confirmedClient}. El comprobante conserva mangas, lotes y kilos autoritativos.</Alert>}
            <Typography variant="body2">Mangas: {confirmedCount ?? '—'} · Total neto: {confirmedTotalKg == null ? '—' : kgText(confirmedTotalKg)} kg</Typography>
            {!reverseResult && <Button color="warning" variant="outlined" onClick={() => { setReverseReason(''); setReverseOpen(true); }} disabled={Boolean(pendingReverse) || reverseBusy}>Revertir despacho</Button>}
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setReceiptOpen(false)}>Cerrar</Button></DialogActions>
      </Dialog>
      <Dialog open={reverseOpen} onClose={() => !reverseBusy && setReverseOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Revertir despacho por cliente equivocado</DialogTitle>
        <DialogContent dividers><Stack spacing={1.25}><Alert severity="warning">Se registrará una compensación de Kardex y quedará trazabilidad append-only. No se reabre el pesaje.</Alert><TextField label="Motivo de reversa" value={reverseReason} onChange={(event) => setReverseReason(event.target.value)} required fullWidth helperText="Explica por qué el comprobante debe revertirse." /></Stack></DialogContent>
        <DialogActions><Button onClick={() => setReverseOpen(false)} disabled={reverseBusy}>Cancelar</Button><Button color="warning" variant="contained" onClick={() => submitReverse()} disabled={!reverseReason.trim() || reverseBusy}>Confirmar reversa</Button></DialogActions>
      </Dialog>
      <Dialog open={changeClientOpen} onClose={() => !busy && setChangeClientOpen(false)}>
        <DialogTitle>Cambiar cliente</DialogTitle>
        <DialogContent><Typography>Se retirarán las mangas de esta sesión para evitar mezclar clientes. Elige el nuevo cliente y vuelve a escanear.</Typography></DialogContent>
        <DialogActions><Button onClick={() => setChangeClientOpen(false)}>Cancelar</Button><Button color="warning" variant="contained" onClick={confirmClientChange}>Retirar selección</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

