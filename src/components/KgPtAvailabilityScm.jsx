import {
  Alert, Box, Button, Chip, Divider, Paper, Stack, Tab, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs,
  TextField, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Fragment, useCallback, useEffect, useLayoutEffect, useState, useRef } from 'react';
import PageHeader from './ui/PageHeader';
import { useScmActor } from '../context/ScmActorContext';
import {
  consultarDisponibilidadPiezasKg,
  consultarDisponibilidadPt,
  descargarDisponibilidadPtExcel,
  listarKardexPtManual,
  listarMovimientosPtManual,
  registrarMovimientoPtManual,
} from '../services/scmKgPtAvailabilityApi';
import { listarAlmacenesScm } from '../services/scmWarehouseOperationsApi';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
const emptyManualForm = () => ({ articulo_scm_id: '', ubicacion_id: '', cantidad: '', tipo: 'ENTRADA', fecha_operativa: today(), motivo: '', referencia: '' });

function KgRows({ items }) {
  if (!items.length) return <Alert severity="info">No hay piezas medidas en las ubicaciones consultables.</Alert>;
  return <TableContainer><Table size="small" aria-label="Disponibilidad de piezas y WIP">
     <TableHead><TableRow><TableCell>Pieza / WIP</TableCell><TableCell>Estado productivo</TableCell><TableCell>Ubicación</TableCell><TableCell align="right">Medido KG</TableCell><TableCell align="right">Comprometido</TableCell><TableCell align="right">Entregas históricas</TableCell><TableCell align="right">Disponible</TableCell></TableRow></TableHead>
    <TableBody>{items.flatMap((item) => (item.ubicaciones || []).map((location) => <TableRow key={`${item.articulo.id}-${item.estado_produccion}-${location.id}`}>
      <TableCell><Typography fontWeight={700}>{item.articulo.codigo}</Typography><Typography variant="caption" color="text.secondary">{item.articulo.nombre}</Typography></TableCell>
      <TableCell><Chip size="small" label={item.estado_produccion === 'EN_PROCESO' ? 'En proceso' : item.estado_produccion === 'MIXTA' ? 'Mixta' : 'Terminada'} color={item.estado_produccion === 'EN_PROCESO' ? 'warning' : item.estado_produccion === 'MIXTA' ? 'default' : 'success'} /></TableCell>
      <TableCell>{location.nombre}<Typography variant="caption" display="block" color="text.secondary">{location.codigo}</Typography></TableCell>
      <TableCell align="right">{location.kg_medidos} KG</TableCell><TableCell align="right">{location.kg_comprometidos} KG</TableCell><TableCell align="right">{location.kg_retirados ?? "—"} KG</TableCell><TableCell align="right"><Chip size="small" color="success" label={`${location.kg_disponibles} KG`} /></TableCell>
    </TableRow>))}</TableBody>
  </Table></TableContainer>;
}

function potentialCause(reason) {
  return {
    SIN_BOM_APROBADA: 'Sin BOM aprobada',
    SIN_REFERENCIA_PESO: 'Sin referencia de peso',
    BOM_SIN_COMPONENTES: 'La BOM no tiene componentes',
  }[reason] || 'Potencial no calculable';
}

function pieceLabel(component) {
  const identity = component.identidad_pieza;
  if (!identity) return component.articulo.nombre || component.articulo.codigo;
  return `${identity.nombre || component.articulo.nombre || component.articulo.codigo}${identity.color_nombre ? ` · ${identity.color_nombre}` : ''}`;
}

function componentStatus(component) {
  if (component.estado !== 'CALCULABLE') return { label: 'Sin referencia de peso', color: 'default' };
  if (component.es_limitante) return { label: 'Limitante', color: 'warning' };
  if (Number(component.faltante_kg) > 0) return { label: 'Faltante', color: 'warning' };
  return { label: 'Disponible', color: 'success' };
}

function componentType(component) {
  return component.naturaleza === 'SUBENSAMBLE_WIP' ? 'WIP' : 'Pieza';
}

function principalRestriction(item, components) {
  return components.find((component) => component.es_limitante)
    || (item.potencial_estado === 'CALCULABLE'
      ? components.find((component) => Number(component.faltante_kg) > 0)
      : components.find((component) => component.estado !== 'CALCULABLE'));
}

function PtRows({ items }) {
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down('md'));
  const [expanded, setExpanded] = useState(() => new Set());
  if (!items.length) return <Alert severity="info">No hay PT de catálogo ni saldos manuales para este alcance.</Alert>;
  const toggle = (id) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  if (narrow) return <>
    <Alert severity="info" sx={{ mb: 1 }}>Stock compartido: las alternativas PT compiten por el mismo saldo; los potenciales no se suman.</Alert>
    <Stack spacing={1.5} aria-label="Disponibilidad por producto terminado">{items.map((item) => {
      const id = String(item.pt.id);
      const components = item.componentes || [];
      const limiting = principalRestriction(item, components);
      const detailId = `pt-components-mobile-${id}`;
      const isExpanded = expanded.has(id);
      return <Paper key={id} variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.25}>
          <Box>
            <Typography fontWeight={700}>{item.pt.nombre}</Typography>
            <Typography variant="caption" color="text.secondary">{item.pt.codigo}{item.revision_bom ? ` · BOM revisión ${item.revision_bom.numero}` : ''}</Typography>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <Box><Typography variant="caption" color="text.secondary">Saldo PT</Typography><Typography>{item.saldo_manual_un} UN</Typography></Box>
            <Box><Typography variant="caption" color="text.secondary">Potencial estimado</Typography><Typography>{item.potencial_estado === 'CALCULABLE' ? `${item.potencial_un_estimado} UN` : potentialCause(item.potencial_motivo)}</Typography></Box>
          </Box>
          <Divider />
          <Box>
            <Typography variant="caption" color="text.secondary">Restricción principal</Typography>
            {limiting ? <Stack spacing={0.25} sx={{ mt: 0.25 }}>
              <Typography>{pieceLabel(limiting)}</Typography>
              <Typography variant="caption" color="text.secondary">{limiting.articulo.codigo}</Typography>
              {limiting.es_limitante && <Chip size="small" label="Limitante" color="warning" sx={{ width: 'fit-content' }} />}
              {Number(limiting.faltante_kg) > 0 && <Typography variant="caption">Faltante para 1 PT: {limiting.faltante_kg} KG</Typography>}
            </Stack> : <Typography>{components.length ? 'Sin restricción de stock' : potentialCause(item.potencial_motivo || 'SIN_BOM_APROBADA')}</Typography>}
          </Box>
          {components.length > 0 && <Button variant="outlined" onClick={() => toggle(id)} aria-expanded={isExpanded} aria-controls={detailId} aria-label={`${isExpanded ? 'Ocultar' : 'Ver'} componentes de ${item.pt.nombre}`}>{isExpanded ? 'Ocultar' : 'Ver'} {components.length} componentes</Button>}
          {isExpanded && <Stack id={detailId} spacing={1}>{components.map((component) => {
            const status = componentStatus(component);
            return <Paper key={component.articulo.id} variant="outlined" sx={{ p: 1.5 }}>
              <Stack spacing={0.75}>
                <Box><Typography fontWeight={600}>{pieceLabel(component)}</Typography><Typography variant="caption" color="text.secondary">{component.articulo.codigo} · {componentType(component)}</Typography></Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                  <Box><Typography variant="caption" color="text.secondary">Disponible</Typography><Typography variant="body2">{component.kg_disponibles} KG</Typography></Box>
                  <Box><Typography variant="caption" color="text.secondary">Requerido por 1 PT</Typography><Typography variant="body2">{component.kg_requeridos_por_un_pt ?? '—'} KG</Typography></Box>
                  <Box><Typography variant="caption" color="text.secondary">Cobertura estimada</Typography><Typography variant="body2">{component.cobertura_un ?? '—'} UN</Typography></Box>
                  <Box><Typography variant="caption" color="text.secondary">Estado</Typography><Chip size="small" label={status.label} color={status.color} /></Box>
                </Box>
                {Number(component.faltante_kg) > 0 && <Typography variant="caption">Faltante para 1 PT: {component.faltante_kg} KG</Typography>}
              </Stack>
            </Paper>;
          })}</Stack>}
        </Stack>
      </Paper>;
    })}</Stack>
  </>;
  return <>
    <Alert severity="info" sx={{ mb: 1 }}>Stock compartido: las alternativas PT compiten por el mismo saldo; los potenciales no se suman.</Alert>
    <TableContainer sx={{ overflowX: 'auto' }}><Table size="small" aria-label="Disponibilidad por producto terminado" sx={{ minWidth: { xs: 680, md: 'auto' } }}>
      <TableHead><TableRow><TableCell>Producto terminado</TableCell><TableCell>Saldo</TableCell><TableCell>Potencial estimado</TableCell><TableCell>Restricción principal</TableCell></TableRow></TableHead>
      <TableBody>{items.map((item) => {
        const id = String(item.pt.id);
        const components = item.componentes || [];
        const limiting = principalRestriction(item, components);
        const detailId = `pt-components-${id}`;
        const isExpanded = expanded.has(id);
        return <Fragment key={id}>
          <TableRow>
            <TableCell>
              <Typography fontWeight={700}>{item.pt.nombre}</Typography>
              <Typography variant="caption" color="text.secondary" display="block">{item.pt.codigo}{item.revision_bom ? ` · BOM revisión ${item.revision_bom.numero}` : ''}</Typography>
              {components.length > 0 && <Button size="small" sx={{ mt: 0.5, px: 0 }} onClick={() => toggle(id)} aria-expanded={isExpanded} aria-controls={detailId} aria-label={`${isExpanded ? 'Ocultar' : 'Ver'} componentes de ${item.pt.nombre}`}>{isExpanded ? 'Ocultar' : 'Ver'} {components.length} componentes</Button>}
            </TableCell>
            <TableCell><Typography variant="body2">Saldo PT: {item.saldo_manual_un} UN</Typography></TableCell>
            <TableCell>
              {item.potencial_estado === 'CALCULABLE' ? <Typography variant="body2">{item.potencial_un_estimado} UN estimadas</Typography> : <Typography variant="body2">{potentialCause(item.potencial_motivo)}</Typography>}
            </TableCell>
            <TableCell>
              {limiting ? <Stack spacing={0.25}>
                <Typography variant="body2">{pieceLabel(limiting)}</Typography>
                <Typography variant="caption" color="text.secondary">{limiting.articulo.codigo}</Typography>
                {limiting.es_limitante && <Chip size="small" label="Limitante" color="warning" sx={{ width: 'fit-content' }} />}
                {Number(limiting.faltante_kg) > 0 && <Typography variant="caption">Faltante para 1 PT: {limiting.faltante_kg} KG</Typography>}
              </Stack> : <Typography variant="body2">{components.length ? 'Sin restricción de stock' : potentialCause(item.potencial_motivo || 'SIN_BOM_APROBADA')}</Typography>}
            </TableCell>
          </TableRow>
          {isExpanded && <TableRow id={detailId}>
            <TableCell colSpan={4} sx={{ p: 0 }}>
              <TableContainer sx={{ overflowX: 'auto' }}><Table size="small" aria-label={`Componentes de ${item.pt.nombre}`}><TableHead><TableRow><TableCell>Componente</TableCell><TableCell>Código / tipo</TableCell><TableCell align="right">Disponible</TableCell><TableCell align="right">Requerido por 1 PT</TableCell><TableCell align="right">Cobertura</TableCell><TableCell>Estado / faltante</TableCell></TableRow></TableHead>
                <TableBody>{components.map((component) => {
                  const status = componentStatus(component);
                  return <TableRow key={component.articulo.id} aria-label={pieceLabel(component)}>
                  <TableCell>{pieceLabel(component)}</TableCell>
                  <TableCell><Typography variant="caption">{component.articulo.codigo}</Typography><Typography variant="caption" display="block" color="text.secondary">{componentType(component)}</Typography></TableCell>
                  <TableCell align="right">Disponible: {component.kg_disponibles} KG</TableCell>
                  <TableCell align="right">Requerido por 1 PT: {component.kg_requeridos_por_un_pt ?? '—'} KG</TableCell>
                  <TableCell align="right">Cobertura estimada: {component.cobertura_un ?? '—'} UN</TableCell>
                  <TableCell><Chip size="small" label={status.label} color={status.color} />{Number(component.faltante_kg) > 0 && <Typography variant="caption" display="block">Faltante para 1 PT: {component.faltante_kg} KG</Typography>}</TableCell>
                </TableRow>;
                })}</TableBody>
              </Table></TableContainer>
            </TableCell>
          </TableRow>}
        </Fragment>;
      })}</TableBody>
    </Table></TableContainer>
  </>;
}

function ManualRows({ items, history, onHistory }) {
  if (!items.length) return <Alert severity="info">Todavía no hay movimientos manuales PT.</Alert>;
  return <TableContainer><Table size="small" aria-label="Kardex PT manual"><TableHead><TableRow><TableCell>Artículo</TableCell><TableCell>Ubicación</TableCell><TableCell align="right">Saldo UN</TableCell><TableCell>Última actualización</TableCell><TableCell>Historial</TableCell></TableRow></TableHead><TableBody>{items.map((item) => <TableRow key={item.id}><TableCell>{item.articulo.codigo} · {item.articulo.nombre}</TableCell><TableCell>{item.ubicacion.nombre}</TableCell><TableCell align="right">{item.saldo_un} UN</TableCell><TableCell>{item.updated_at ? new Date(item.updated_at).toLocaleString('es-PE') : '—'}</TableCell><TableCell><Button size="small" onClick={() => onHistory(item.id)} aria-label={`Ver historial ${item.articulo.codigo}`}>Ver movimientos</Button>{history[item.id] && <Box sx={{ mt: 1 }}>{history[item.id].map((movement) => <Typography variant="caption" display="block" key={movement.id}>{movement.fecha_operativa} · {movement.tipo} · {movement.cantidad_delta} UN · {movement.motivo}</Typography>)}</Box>}</TableCell></TableRow>)}</TableBody></Table></TableContainer>;
}

export default function KgPtAvailabilityScm() {
  const { can, actorId } = useScmActor();
  const canView = can('INVENTARIO_VER');
  const canRoutine = can('INVENTARIO_PT_MOVIMIENTO');
  const canAdjust = can('INVENTARIO_AJUSTAR');
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [pieces, setPieces] = useState({ items: [] });
  const [pt, setPt] = useState({ items: [] });
  const [manual, setManual] = useState({ items: [] });
  const [warehouses, setWarehouses] = useState({ items: [] });
  const [form, setForm] = useState(emptyManualForm);
  const [adjustment, setAdjustment] = useState(false);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [history, setHistory] = useState({});
  const [consultedAt, setConsultedAt] = useState(null);
  const [exportState, setExportState] = useState('ready');
  const [confirmation, setConfirmation] = useState(null);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  const flight = useRef(false);
  const activeActor = useRef(actorId);
  activeActor.current = actorId;
  const storageKey = `scm-pt-manual-intent:${actorId}`;

  useLayoutEffect(() => {
    sequence.current += 1;
    setPieces({ items: [] });
    setPt({ items: [] });
    setManual({ items: [] });
    setWarehouses({ items: [] });
    setConsultedAt(null);
    setExportState('ready');
    setHistory({});
    setForm(emptyManualForm());
    setAdjustment(false);
    setPending(null);
    setConfirmation(null);
    setState('loading');
  }, [actorId]);

  useEffect(() => {
    try { setPending(JSON.parse(sessionStorage.getItem(storageKey) || 'null')); }
    catch { setError('No se pudo recuperar la solicitud guardada. Revisa el historial antes de continuar.'); }
    setConfirmation(null);
  }, [storageKey]);

  const refresh = useCallback(async () => {
    if (!canView) return false;
    const requestedActor = actorId;
    const requestSequence = ++sequence.current;
    setState('loading');
    try {
      const [kgPayload, ptPayload, manualPayload, warehousePayload] = await Promise.all([
        consultarDisponibilidadPiezasKg({ q: query || undefined }),
        consultarDisponibilidadPt({ q: query || undefined }),
        listarKardexPtManual(), listarAlmacenesScm(),
      ]);
      if (requestSequence !== sequence.current || activeActor.current !== requestedActor) return false;
      setPieces(kgPayload); setPt(ptPayload); setManual(manualPayload); setWarehouses(warehousePayload);
      setExportState((ptPayload.items || []).length ? 'ready' : 'empty');
      setConsultedAt(kgPayload.as_of ? new Date(kgPayload.as_of) : null); setState('ready');
      return true;
    } catch {
      if (requestSequence === sequence.current) setState('error');
      return false;
    }
  }, [actorId, canView, query]);
  useEffect(() => { refresh(); return () => { sequence.current += 1; }; }, [refresh]);

  const locations = (warehouses.items || []).flatMap((warehouse) => warehouse.ubicaciones || [])
    .filter((location) => location.activo !== false && (!location.clases_articulo?.length || location.clases_articulo.includes('PRODUCTO_TERMINADO')));
  const selectedBalance = (manual.items || []).find((item) => String(item.articulo.id) === String(form.articulo_scm_id) && String(item.ubicacion.id) === String(form.ubicacion_id));
  const selectedProduct = (pt.items || []).find((item) => String(item.pt.id) === String(form.articulo_scm_id))?.pt;
  const selectedLocation = locations.find((item) => String(item.id) === String(form.ubicacion_id));
  const locked = busy || !!pending || state !== 'ready';
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const review = (event) => {
    event.preventDefault();
    if (locked || !selectedProduct || !selectedLocation || !(Number(form.cantidad) > 0) || !form.referencia.trim()) return;
    if (!(adjustment ? canAdjust : canRoutine)) return;
    setConfirmation({
      key: crypto.randomUUID(),
      payload: { ...form, articulo_scm_id: Number(form.articulo_scm_id), ubicacion_id: Number(form.ubicacion_id), version: selectedBalance?.version || 1 },
      product: `${selectedProduct.codigo} · ${selectedProduct.nombre}`,
      location: `${selectedLocation.codigo} · ${selectedLocation.nombre}`,
      balance: selectedBalance?.saldo_un || '0.000',
    });
  };

  const send = async (intent) => {
    if (!intent || flight.current) return;
    const requestedActor = actorId;
    flight.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const sentIntent = { ...intent, sent: true };
      sessionStorage.setItem(storageKey, JSON.stringify(sentIntent));
      setPending(sentIntent); setConfirmation(null);
      await registrarMovimientoPtManual(intent.payload, intent.key);
      sessionStorage.removeItem(storageKey);
      if (activeActor.current !== requestedActor) return;
      setPending(null); setNotice('Movimiento PT registrado.'); setHistory({});
      setForm((current) => ({ ...current, cantidad: '', motivo: '', referencia: '' }));
      if (!await refresh()) setError('La operación quedó confirmada. Actualiza la consulta para ver el saldo; no repitas el movimiento.');
    } catch (requestError) {
      if (activeActor.current !== requestedActor) return;
      const status = requestError.response?.status;
      const code = requestError.response?.data?.error?.code;
      const definitive = status >= 400 && status < 500 && ![408, 429].includes(status) && code !== 'IDEMPOTENCY_OPERATION_INCOMPLETE';
      if (definitive && !intent.sent) {
        sessionStorage.removeItem(storageKey); setPending(null);
        await refresh();
        setError(requestError.response?.data?.error?.message || 'El movimiento fue rechazado. Revisa el saldo actualizado y corrige los datos.');
      } else {
        setError('No se confirmó el resultado. Recupera el mismo movimiento antes de registrar otro.');
      }
    } finally { flight.current = false; setBusy(false); }
  };

  const loadHistory = async (balanceId) => {
    try {
      const payload = await listarMovimientosPtManual(balanceId);
      setHistory((current) => ({ ...current, [balanceId]: payload.items || [] }));
    } catch { setError('No se pudo consultar el historial. Vuelve a intentarlo.'); }
  };

  const exportPt = async () => {
    if (exportState === 'generating') return;
    if (!(pt.items || []).length) {
      setExportState('empty');
      return;
    }
    const requestedActor = actorId;
    setExportState('generating');
    setNotice('');
    try {
      const workbook = await descargarDisponibilidadPtExcel({ q: query || undefined });
      if (activeActor.current !== requestedActor) return;
      const url = window.URL.createObjectURL(workbook.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = workbook.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setExportState('ready');
      setNotice('Excel de disponibilidad PT descargado. El archivo indica cuándo se generó la consulta.');
    } catch {
      if (activeActor.current === requestedActor) setExportState('error');
    }
  };

  if (!canView) return <Alert severity="warning">Tu perfil no tiene acceso a disponibilidad de inventario.</Alert>;
  const typeLabels = { ENTRADA: 'Entrada', SALIDA: 'Salida', AJUSTE_POSITIVO: 'Ajuste positivo', AJUSTE_NEGATIVO: 'Ajuste negativo' };
  return <Stack spacing={2.5}>
    <PageHeader title="Disponibilidad de piezas y PT" description="Piezas medidas, cobertura estimada y movimientos de producto terminado." actions={<Button startIcon={<RefreshIcon />} variant="outlined" onClick={refresh} disabled={state === 'loading'}>Actualizar</Button>} />
    {notice && <Alert severity="success">{notice}</Alert>}
    {error && <Alert severity="error">{error}</Alert>}
    {pending && <Alert severity="warning" action={<Button disabled={busy} onClick={() => send(pending)}>Recuperar movimiento</Button>}>Hay un movimiento sin respuesta confirmada: {typeLabels[pending.payload.tipo]} de {pending.payload.cantidad} UN, {pending.product}. Conserva esta solicitud hasta conocer el resultado.</Alert>}
    <Alert severity="info">Los kg medidos están disponibles desde el pesaje, incluso con mangas en proceso. La cobertura de PT es estimada; los productos que comparten piezas compiten por el mismo stock y sus potenciales no se suman.</Alert>
    <Stack component="form" direction="row" spacing={1} onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()); }}>
      <TextField fullWidth label="Buscar pieza o PT" value={search} onChange={(event) => setSearch(event.target.value)} />
      <Button type="submit" variant="outlined">Buscar</Button>
    </Stack>
    {consultedAt && <Typography variant="caption">Consultado: {consultedAt.toLocaleString('es-PE', { timeZone: 'America/Lima' })}. El material añadido después del último pesaje todavía no está medido.</Typography>}
    {state === 'loading' && <Alert severity="info">Actualizando saldos…</Alert>}
    {state === 'error' && <Alert severity="warning">Datos sin actualizar. Revisa la conexión y pulsa Actualizar antes de registrar movimientos.</Alert>}
    <Paper variant="outlined">
      <Tabs value={tab} onChange={(_event, value) => setTab(value)} variant="scrollable" aria-label="Vistas de disponibilidad"><Tab label="Piezas y WIP" /><Tab label="Por PT" /><Tab label="Kardex PT manual" /></Tabs>
      <Divider />
      <Box sx={{ p: 2 }}>
        {tab === 0 && <KgRows items={pieces.items || []} />}
        {tab === 1 && <Stack spacing={1.5}>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={1}>
            <Typography variant="body2" color="text.secondary">Exporta la consulta actual con el detalle de componentes de la BOM.</Typography>
            <Button variant="outlined" onClick={exportPt} disabled={exportState === 'generating' || exportState === 'empty'}>
              {exportState === 'generating' ? 'Generando Excel…' : 'Exportar a Excel'}
            </Button>
          </Stack>
          {exportState === 'error' && <Alert severity="error" action={<Button color="inherit" size="small" onClick={exportPt}>Reintentar</Button>}>No se pudo generar el Excel. La tabla sigue disponible para consulta.</Alert>}
          {exportState === 'empty' && <Alert severity="info">No hay PT en la consulta actual para exportar.</Alert>}
          <PtRows items={pt.items || []} />
        </Stack>}
        {tab === 2 && <Stack spacing={2}>
          <ManualRows items={manual.items || []} history={history} onHistory={loadHistory} />
          {canAdjust && <Button variant="text" disabled={locked} onClick={() => { const next = !adjustment; setAdjustment(next); setForm((current) => ({ ...current, tipo: next ? 'AJUSTE_POSITIVO' : 'ENTRADA' })); }}>{adjustment ? 'Volver a entradas y salidas' : 'Registrar ajuste excepcional'}</Button>}
          {(adjustment ? canAdjust : canRoutine) && <Box component="form" onSubmit={review}>
            <Typography variant="h6" gutterBottom>{adjustment ? 'Ajuste excepcional de PT' : 'Entrada o salida de PT'}</Typography>
            {adjustment && <Alert severity="warning" sx={{ mb: 2 }}>El ajuste corrige una diferencia de inventario. Registra el motivo; no sustituye el procedimiento de apertura.</Alert>}
            <Box component="fieldset" disabled={locked} sx={{ border: 0, m: 0, p: 0, display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              <TextField required select SelectProps={{ native: true }} slotProps={{ inputLabel: { shrink: true } }} label="Producto terminado" value={form.articulo_scm_id} onChange={update('articulo_scm_id')}><option value="">Selecciona un PT</option>{(pt.items || []).map((item) => <option key={item.pt.id} value={item.pt.id}>{item.pt.codigo} · {item.pt.nombre}</option>)}</TextField>
              <TextField required select SelectProps={{ native: true }} slotProps={{ inputLabel: { shrink: true } }} label="Ubicación autorizada" value={form.ubicacion_id} onChange={update('ubicacion_id')}><option value="">Selecciona una ubicación</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.codigo} · {location.nombre}</option>)}</TextField>
              <TextField required select SelectProps={{ native: true }} label="Movimiento" value={form.tipo} onChange={update('tipo')}>{(adjustment ? ['AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'] : ['ENTRADA', 'SALIDA']).map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</TextField>
              <TextField required type="number" inputProps={{ min: 0.001, step: 0.001 }} label="Cantidad UN" value={form.cantidad} onChange={update('cantidad')} />
              <TextField required type="date" label="Fecha operativa" InputLabelProps={{ shrink: true }} value={form.fecha_operativa} onChange={update('fecha_operativa')} />
              <TextField required label="Referencia" value={form.referencia} onChange={update('referencia')} inputProps={{ maxLength: 120 }} helperText="Documento o sustento del movimiento (máximo 120 caracteres)." />
              <TextField required label="Motivo" value={form.motivo} onChange={update('motivo')} inputProps={{ maxLength: 500 }} sx={{ gridColumn: '1 / -1' }} />
              <Typography>Saldo actual: {selectedBalance?.saldo_un || '0.000'} UN. Registrar PT no descuenta automáticamente las piezas.</Typography>
              <Button type="submit" variant="contained" disabled={locked || !selectedProduct || !selectedLocation || !form.referencia.trim()}>Revisar movimiento</Button>
            </Box>
          </Box>}
        </Stack>}
      </Box>
    </Paper>
    <Dialog open={!!confirmation} onClose={() => !busy && setConfirmation(null)} fullWidth maxWidth="sm">
      <DialogTitle>Revisar movimiento de PT</DialogTitle>
      <DialogContent><Stack spacing={1}>
        <Typography>{typeLabels[confirmation?.payload.tipo]} · {confirmation?.payload.cantidad} UN</Typography>
        <Typography>{confirmation?.product}</Typography><Typography>{confirmation?.location}</Typography>
        <Typography>Saldo consultado: {confirmation?.balance} UN</Typography>
        <Typography>Fecha: {confirmation?.payload.fecha_operativa}</Typography>
        <Typography>Motivo: {confirmation?.payload.motivo}</Typography>
        <Typography>Referencia: {confirmation?.payload.referencia || 'Sin referencia'}</Typography>
      </Stack></DialogContent>
      <DialogActions><Button disabled={busy} onClick={() => setConfirmation(null)}>Volver</Button><Button variant="contained" disabled={busy} onClick={() => send(confirmation)}>Confirmar movimiento</Button></DialogActions>
    </Dialog>
  </Stack>;
}
