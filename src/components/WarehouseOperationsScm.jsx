import {
  Alert, Box, Button, Chip, FormControl, InputLabel, MenuItem, Paper,
  Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography,
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import PageHeader from './ui/PageHeader';
import { useScmActor } from '../context/ScmActorContext';
import { mensajeErrorScm } from '../services/scmEngineeringApi';
import { formatKg as formatKgDisplay } from '../utils/weightDisplay';
import {
  abrirSesionOperacionAlmacenScm,
  confirmarSesionOperacionAlmacenScm,
  escanearSesionOperacionAlmacenScm,
  listarAlmacenesScm,
  listarTransferenciasScm,
  obtenerAlcanceAlmacenScm,
  obtenerResumenInventarioScm,
  obtenerTrazabilidadUnidadScm,
  prepararRetornoTransferenciaScm,
  quitarItemSesionOperacionAlmacenScm,
} from '../services/scmWarehouseOperationsApi';

const EMPTY_WAREHOUSES = [];

export default function WarehouseOperationsScm({ control = false, transfersOnly = false }) {
  const { actor, actorId, can } = useScmActor();
  const canMove = can('INVENTARIO_MOVILIZAR') && !control;
  const [warehouses, setWarehouses] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [summary, setSummary] = useState({ items: [], materiales: [], as_of: null });
  const [reach, setReach] = useState(null);
  const [originId, setOriginId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [mode, setMode] = useState('PICKUP');
  const [session, setSession] = useState(null);
  const [scan, setScan] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [traceCode, setTraceCode] = useState('');
  const [trace, setTrace] = useState(null);
  const [loadedActorId, setLoadedActorId] = useState(actorId);
  const scanRef = useRef(null);
  const activeActorRef = useRef(actorId);
  const requestRef = useRef(0);
  const traceRequestRef = useRef(0);
  useEffect(() => { activeActorRef.current = actorId; }, [actorId]);

  const load = useCallback(async () => {
    const requestedActorId = actorId;
    const requestId = ++requestRef.current;
    setBusy(true);
    setError('');
    try {
      const [warehousePayload, reachPayload, transferPayload, summaryPayload] = await Promise.all([
        listarAlmacenesScm(), obtenerAlcanceAlmacenScm(),
        listarTransferenciasScm(), obtenerResumenInventarioScm(),
      ]);
      if (requestRef.current !== requestId || activeActorRef.current !== requestedActorId) return;
      setWarehouses(warehousePayload.items || []);
      setReach(reachPayload);
      setTransfers(transferPayload.items || []);
      setSummary(summaryPayload);
      setLoadedActorId(requestedActorId);
    } catch (requestError) {
      if (requestRef.current === requestId && activeActorRef.current === requestedActorId) {
        setError(mensajeErrorScm(requestError, 'No se pudo cargar el workspace de almacén.'));
        setLoadedActorId(requestedActorId);
      }
    } finally {
      if (requestRef.current === requestId && activeActorRef.current === requestedActorId) setBusy(false);
    }
  }, [actorId]);
  useEffect(() => {
    traceRequestRef.current += 1;
    setWarehouses([]);
    setSummary({ items: [], materiales: [], piezas_kg: [], as_of: null });
    setTransfers([]);
    setReach(null);
    setSession(null);
    setTrace(null);
    setNotice('');
    load();
  }, [actorId, load]);

  const actorReady = loadedActorId === actorId;
  const visibleWarehouses = actorReady ? warehouses : EMPTY_WAREHOUSES;
  const visibleTransfers = actorReady ? transfers : [];
  const visibleSummary = actorReady ? summary : { items: [], materiales: [], piezas_kg: [], as_of: null };
  const visibleReach = actorReady ? reach : null;
  const visibleSession = actorReady ? session : null;
  const visibleTrace = actorReady ? trace : null;
  const visibleError = actorReady ? error : '';
  const visibleNotice = actorReady ? notice : '';

  const locations = useMemo(() => visibleWarehouses.flatMap((warehouse) => (
    (warehouse.ubicaciones || []).map((location) => ({ ...location, warehouse }))
  )), [visibleWarehouses]);
  const warehousesById = useMemo(() => new Map(visibleWarehouses.map((warehouse) => [String(warehouse.id), warehouse])), [visibleWarehouses]);
  const openSession = async () => {
    if (!originId || !destinationId || originId === destinationId) {
      setError('Selecciona ubicaciones diferentes para origen y destino.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = await abrirSesionOperacionAlmacenScm({
        tipo: 'TRANSFERENCIA', modalidad: mode,
        origen_ubicacion_id: Number(originId),
        destino_ubicacion_id: Number(destinationId),
        contexto: { interfaz: 'WORKSPACE_ALMACEN' },
      });
      setSession(payload);
      requestAnimationFrame(() => scanRef.current?.focus());
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo iniciar la sesión QR.'));
    } finally { setBusy(false); }
  };

  const scanCode = async (explicitCode = scan) => {
    const code = explicitCode.trim();
    if (!code || !session) return;
    setBusy(true);
    setError('');
    try {
      setSession(await escanearSesionOperacionAlmacenScm(session.id, code));
      setScan('');
      requestAnimationFrame(() => scanRef.current?.focus());
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, `No se aceptó ${code}.`));
    } finally { setBusy(false); }
  };

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      const transfer = await confirmarSesionOperacionAlmacenScm(session.id, {
        version: session.version, custodio_id: actor?.id,
      });
      setNotice(`${transfer.codigo}: custodia transferida sin consumir inventario.`);
      setSession(null);
      await load();
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se confirmó la transferencia.'));
    } finally { setBusy(false); }
  };

  const removeScanned = async (itemId) => {
    setBusy(true);
    setError('');
    try {
      setSession(await quitarItemSesionOperacionAlmacenScm(session.id, itemId, session.version));
      requestAnimationFrame(() => scanRef.current?.focus());
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo quitar la unidad escaneada.'));
    } finally { setBusy(false); }
  };

  const searchTrace = async () => {
    if (!traceCode.trim()) return;
    const requestedActorId = actorId;
    const requestId = ++traceRequestRef.current;
    setBusy(true);
    setError('');
    try {
      const payload = await obtenerTrazabilidadUnidadScm(traceCode.trim());
      if (traceRequestRef.current !== requestId || activeActorRef.current !== requestedActorId) return;
      setTrace(payload);
    }
    catch (requestError) {
      if (traceRequestRef.current !== requestId || activeActorRef.current !== requestedActorId) return;
      setTrace(null);
      setError(mensajeErrorScm(requestError, 'No se encontró la unidad dentro de tu alcance.'));
    } finally {
      if (traceRequestRef.current === requestId && activeActorRef.current === requestedActorId) setBusy(false);
    }
  };

  const prepareReturn = async (transfer) => {
    setBusy(true);
    setError('');
    try {
      const returnSession = await prepararRetornoTransferenciaScm(transfer.id);
      setSession(returnSession);
      setMode('ENTREGA');
      setNotice(`Retorno preparado con ${returnSession.items.length} unidad(es). Confirma para enviarlas de vuelta.`);
      requestAnimationFrame(() => scanRef.current?.focus());
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo preparar el retorno.'));
    } finally { setBusy(false); }
  };

  const title = control ? 'Control de inventario' : transfersOnly
    ? 'Transferencias entre ubicaciones' : 'Operaciones de almacén';
  const kgItems = Array.isArray(visibleSummary.piezas_kg) ? visibleSummary.piezas_kg : [];
  const kgText = (value) => {
    const formatted = formatKgDisplay(value);
    return formatted === '—' ? '—' : `${formatted} KG`;
  };
  const kgWarehouse = (item) => (item.almacen_id ? warehousesById.get(String(item.almacen_id)) : null);

  return <Stack spacing={2.5}>
    <PageHeader
      title={title}
      description={control
        ? 'Observa posiciones, custodia y excepciones de todos los almacenes autorizados.'
        : 'Escanea unidades y confirma el cambio de custodia con origen y destino explícitos.'}
      actions={<Button startIcon={<RefreshIcon />} onClick={load} disabled={busy}>Actualizar</Button>}
    />
    {control && <Alert severity="info"><strong>Solo lectura.</strong> Control no concede capacidad para mover inventario.</Alert>}
    {visibleReach?.configurado && !visibleReach.control_transversal && (visibleReach.almacenes || []).length === 0 && (
      <Alert severity="warning">No tienes un almacén asignado. Solicita alcance antes de operar.</Alert>
    )}
    {visibleError && <Alert severity="error" onClose={() => setError('')}>{visibleError}</Alert>}
    {visibleNotice && <Alert severity="success" onClose={() => setNotice('')}>{visibleNotice}</Alert>}

    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
      {[...(visibleSummary.items || []), ...(visibleSummary.materiales || [])].map((item) => <Paper key={`${item.unidad}-${item.almacen_id || 'legacy'}`} variant="outlined" sx={{ p: 2, flex: 1 }}>
        <Typography variant="overline">{item.almacen_id ? 'Almacén configurado' : 'Ubicaciones por clasificar'}</Typography>
        <Typography variant="h5" fontWeight={800}>{item.fisico} {item.unidad}</Typography>
        <Typography variant="body2">Reservado {item.reservado} · No disponible {item.no_disponible}</Typography>
      </Paper>)}
      {visibleSummary.as_of && <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="caption">Datos a</Typography><Typography>{new Date(visibleSummary.as_of).toLocaleString('es-PE')}</Typography></Paper>}
    </Stack>

    {control && <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1}>
        <Box>
          <Typography variant="h6" fontWeight={800}>Piezas y WIP · stock medido en KG</Typography>
          <Typography variant="body2" color="text.secondary">Saldo físico, reservado, no disponible y libre en KG.</Typography>
        </Box>
        {can('INVENTARIO_VER') && <Button component={RouterLink} to="/almacen/kardex" variant="outlined" size="small" aria-label="Abrir Kardex de piezas y WIP">Abrir Kardex</Button>}
      </Stack>
      {(!actorReady || busy) && !visibleError && kgItems.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>Cargando saldos actuales en KG…</Alert>
      ) : actorReady && !busy && !visibleError && kgItems.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>No hay saldos de piezas/WIP en KG dentro del alcance consultado.</Alert>
      ) : visibleError && kgItems.length === 0 ? null : (
        <TableContainer sx={{ mt: 2, overflowX: 'auto' }}>
          <Table size="small" aria-label="Saldos de piezas y WIP en KG">
            <TableHead><TableRow><TableCell>Almacén</TableCell><TableCell align="right">Posiciones</TableCell><TableCell align="right">Físico</TableCell><TableCell align="right">Reservado</TableCell><TableCell align="right">No disponible</TableCell><TableCell align="right">Libre</TableCell></TableRow></TableHead>
            <TableBody>{kgItems.map((item, index) => { const warehouse = kgWarehouse(item); return <TableRow key={`${item.almacen_id || 'kg'}-${index}`}>
              <TableCell><Typography fontWeight={700}>{warehouse?.nombre || warehouse?.codigo || (item.almacen_id || 'Sin almacén asignado')}</Typography>{warehouse?.nombre && warehouse?.codigo && <Typography variant="caption" color="text.secondary">Código: {warehouse.codigo}</Typography>}</TableCell>
              <TableCell align="right">{item.posiciones ?? '—'}</TableCell>
              <TableCell align="right">{kgText(item.fisico ?? item.cantidad_fisica)}</TableCell>
              <TableCell align="right">{kgText(item.reservado ?? item.cantidad_reservada)}</TableCell>
              <TableCell align="right">{kgText(item.no_disponible ?? item.cantidad_no_disponible)}</TableCell>
              <TableCell align="right">{kgText(item.libre ?? item.cantidad_libre)}</TableCell>
            </TableRow>; })}</TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>}

    {canMove && <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Typography variant="h6" fontWeight={800}>Nueva sesión multi‑QR</Typography>
      {!visibleSession ? <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 2 }}>
        <FormControl fullWidth><InputLabel id="origin-label">Ubicación origen</InputLabel><Select labelId="origin-label" label="Ubicación origen" value={originId} onChange={(event) => setOriginId(event.target.value)}>
          {locations.map((item) => <MenuItem key={`o-${item.id}`} value={item.id}>{item.codigo} · {item.nombre}</MenuItem>)}
        </Select></FormControl>
        <FormControl fullWidth><InputLabel id="destination-label">Ubicación destino</InputLabel><Select labelId="destination-label" label="Ubicación destino" value={destinationId} onChange={(event) => setDestinationId(event.target.value)}>
          {locations.map((item) => <MenuItem key={`d-${item.id}`} value={item.id}>{item.codigo} · {item.nombre}</MenuItem>)}
        </Select></FormControl>
        <FormControl sx={{ minWidth: 160 }}><InputLabel>Modalidad</InputLabel><Select label="Modalidad" value={mode} onChange={(event) => setMode(event.target.value)}><MenuItem value="PICKUP">Pickup</MenuItem><MenuItem value="ENTREGA">Entrega</MenuItem></Select></FormControl>
        <Button variant="contained" startIcon={<QrCodeScannerIcon />} onClick={openSession} disabled={busy}>Iniciar sesión QR</Button>
      </Stack> : <Stack spacing={2} sx={{ mt: 2 }}>
        <Alert severity="info">Origen: <strong>{visibleSession.origen.nombre}</strong> → Destino: <strong>{visibleSession.destino.nombre}</strong>. Escanear todavía no mueve inventario.</Alert>
        <TextField inputRef={scanRef} label="Escanear QR o código" value={scan} onChange={(event) => setScan(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); scanCode(event.currentTarget.value); } }} disabled={busy} autoFocus />
        <Stack direction="row" spacing={1} flexWrap="wrap">{(visibleSession.items || []).map((item) => <Chip key={item.id} label={`${item.codigo} · ${item.cantidad}`} color="success" onDelete={() => removeScanned(item.id)} disabled={busy} />)}</Stack>
        <Button variant="contained" color="success" onClick={confirm} disabled={busy || !(visibleSession.items || []).length} sx={{ alignSelf: { xs: 'stretch', md: 'flex-end' } }}>
          Confirmar {mode.toLowerCase()} de {(visibleSession.items || []).length} unidad{(visibleSession.items || []).length === 1 ? '' : 'es'}
        </Button>
      </Stack>}
    </Paper>}

    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Typography variant="h6" fontWeight={800}>Buscar una manga o unidad logística</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1.5 }}>
        <TextField fullWidth label="Código o UUID del QR" value={traceCode} onChange={(event) => setTraceCode(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') searchTrace(); }} />
        <Button variant="outlined" onClick={searchTrace} disabled={busy || !traceCode.trim()}>Ver trazabilidad</Button>
      </Stack>
      {visibleTrace && <Stack spacing={1} sx={{ mt: 2 }}>
        <Typography fontWeight={800}>{visibleTrace.codigo} · {visibleTrace.estado_logistico.replaceAll('_', ' ')}</Typography>
        <Typography variant="body2">Custodia actual: {visibleTrace.ubicacion ? `${visibleTrace.ubicacion.codigo} · ${visibleTrace.ubicacion.nombre}` : 'Sin ubicación física'}</Typography>
        <Typography variant="body2">Cantidad: {visibleTrace.cantidad} UN · Transferencias: {visibleTrace.transferencias.length} · Movimientos: {visibleTrace.movimientos.length}</Typography>
      </Stack>}
    </Paper>

    <Paper variant="outlined">
      <Box sx={{ p: 2 }}><Typography variant="h6" fontWeight={800}>Custodia y transferencias recientes</Typography></Box>
      <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Código</TableCell><TableCell>Estado</TableCell><TableCell>Recorrido</TableCell><TableCell>Custodio</TableCell><TableCell>Unidades</TableCell><TableCell>Acción</TableCell></TableRow></TableHead><TableBody>
        {visibleTransfers.map((item) => <TableRow key={item.id}><TableCell>{item.codigo}</TableCell><TableCell><Chip size="small" label={item.estado.replaceAll('_', ' ')} /></TableCell><TableCell>{item.origen.codigo} → {item.destino.codigo}</TableCell><TableCell>{item.custodio_id || '—'}</TableCell><TableCell>{item.items.length}</TableCell><TableCell>{canMove && item.estado === 'CERRADA' && item.modalidad === 'PICKUP' ? <Button size="small" onClick={() => prepareReturn(item)}>Preparar retorno</Button> : '—'}</TableCell></TableRow>)}
        {actorReady && !busy && visibleTransfers.length === 0 && <TableRow><TableCell colSpan={6}><Alert severity="info">Aún no hay transferencias dentro de tu alcance.</Alert></TableCell></TableRow>}
      </TableBody></Table></TableContainer>
    </Paper>
  </Stack>;
}
