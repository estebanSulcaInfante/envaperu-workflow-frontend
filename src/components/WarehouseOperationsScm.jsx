import {
  Alert, Box, Button, Chip, FormControl, InputLabel, MenuItem, Paper,
  Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography,
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from './ui/PageHeader';
import { useScmActor } from '../context/ScmActorContext';
import { mensajeErrorScm } from '../services/scmEngineeringApi';
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

export default function WarehouseOperationsScm({ control = false, transfersOnly = false }) {
  const { actor, can } = useScmActor();
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
  const scanRef = useRef(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const [warehousePayload, reachPayload, transferPayload, summaryPayload] = await Promise.all([
        listarAlmacenesScm(), obtenerAlcanceAlmacenScm(),
        listarTransferenciasScm(), obtenerResumenInventarioScm(),
      ]);
      setWarehouses(warehousePayload.items || []);
      setReach(reachPayload);
      setTransfers(transferPayload.items || []);
      setSummary(summaryPayload);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo cargar el workspace de almacén.'));
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const locations = useMemo(() => warehouses.flatMap((warehouse) => (
    (warehouse.ubicaciones || []).map((location) => ({ ...location, warehouse }))
  )), [warehouses]);
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
    setBusy(true);
    setError('');
    try { setTrace(await obtenerTrazabilidadUnidadScm(traceCode.trim())); }
    catch (requestError) {
      setTrace(null);
      setError(mensajeErrorScm(requestError, 'No se encontró la unidad dentro de tu alcance.'));
    } finally { setBusy(false); }
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
    ? 'Transferencias y pickup' : 'Operaciones de almacén';

  return <Stack spacing={2.5}>
    <PageHeader
      title={title}
      description={control
        ? 'Observa posiciones, custodia y excepciones de todos los almacenes autorizados.'
        : 'Escanea unidades y confirma el cambio de custodia con origen y destino explícitos.'}
      actions={<Button startIcon={<RefreshIcon />} onClick={load} disabled={busy}>Actualizar</Button>}
    />
    {control && <Alert severity="info"><strong>Solo lectura.</strong> Control no concede capacidad para mover inventario.</Alert>}
    {reach?.configurado && !reach.control_transversal && (reach.almacenes || []).length === 0 && (
      <Alert severity="warning">No tienes un almacén asignado. Solicita alcance antes de operar.</Alert>
    )}
    {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
    {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}

    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
      {[...(summary.items || []), ...(summary.materiales || [])].map((item) => <Paper key={`${item.unidad}-${item.almacen_id || 'legacy'}`} variant="outlined" sx={{ p: 2, flex: 1 }}>
        <Typography variant="overline">{item.almacen_id ? 'Almacén configurado' : 'Ubicaciones por clasificar'}</Typography>
        <Typography variant="h5" fontWeight={800}>{item.fisico} {item.unidad}</Typography>
        <Typography variant="body2">Reservado {item.reservado} · No disponible {item.no_disponible}</Typography>
      </Paper>)}
      {summary.as_of && <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="caption">Datos a</Typography><Typography>{new Date(summary.as_of).toLocaleString('es-PE')}</Typography></Paper>}
    </Stack>

    {canMove && !transfersOnly && <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Typography variant="h6" fontWeight={800}>Nueva sesión multi‑QR</Typography>
      {!session ? <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 2 }}>
        <FormControl fullWidth><InputLabel id="origin-label">Ubicación origen</InputLabel><Select labelId="origin-label" label="Ubicación origen" value={originId} onChange={(event) => setOriginId(event.target.value)}>
          {locations.map((item) => <MenuItem key={`o-${item.id}`} value={item.id}>{item.codigo} · {item.nombre}</MenuItem>)}
        </Select></FormControl>
        <FormControl fullWidth><InputLabel id="destination-label">Ubicación destino</InputLabel><Select labelId="destination-label" label="Ubicación destino" value={destinationId} onChange={(event) => setDestinationId(event.target.value)}>
          {locations.map((item) => <MenuItem key={`d-${item.id}`} value={item.id}>{item.codigo} · {item.nombre}</MenuItem>)}
        </Select></FormControl>
        <FormControl sx={{ minWidth: 160 }}><InputLabel>Modalidad</InputLabel><Select label="Modalidad" value={mode} onChange={(event) => setMode(event.target.value)}><MenuItem value="PICKUP">Pickup</MenuItem><MenuItem value="ENTREGA">Entrega</MenuItem></Select></FormControl>
        <Button variant="contained" startIcon={<QrCodeScannerIcon />} onClick={openSession} disabled={busy}>Iniciar sesión QR</Button>
      </Stack> : <Stack spacing={2} sx={{ mt: 2 }}>
        <Alert severity="info">Origen: <strong>{session.origen.nombre}</strong> → Destino: <strong>{session.destino.nombre}</strong>. Escanear todavía no mueve inventario.</Alert>
        <TextField inputRef={scanRef} label="Escanear QR o código" value={scan} onChange={(event) => setScan(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); scanCode(event.currentTarget.value); } }} disabled={busy} autoFocus />
        <Stack direction="row" spacing={1} flexWrap="wrap">{(session.items || []).map((item) => <Chip key={item.id} label={`${item.codigo} · ${item.cantidad}`} color="success" onDelete={() => removeScanned(item.id)} disabled={busy} />)}</Stack>
        <Button variant="contained" color="success" onClick={confirm} disabled={busy || !(session.items || []).length} sx={{ alignSelf: { xs: 'stretch', md: 'flex-end' } }}>
          Confirmar {mode.toLowerCase()} de {(session.items || []).length} unidad{(session.items || []).length === 1 ? '' : 'es'}
        </Button>
      </Stack>}
    </Paper>}

    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Typography variant="h6" fontWeight={800}>Buscar una manga o unidad logística</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1.5 }}>
        <TextField fullWidth label="Código o UUID del QR" value={traceCode} onChange={(event) => setTraceCode(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') searchTrace(); }} />
        <Button variant="outlined" onClick={searchTrace} disabled={busy || !traceCode.trim()}>Ver trazabilidad</Button>
      </Stack>
      {trace && <Stack spacing={1} sx={{ mt: 2 }}>
        <Typography fontWeight={800}>{trace.codigo} · {trace.estado_logistico.replaceAll('_', ' ')}</Typography>
        <Typography variant="body2">Custodia actual: {trace.ubicacion ? `${trace.ubicacion.codigo} · ${trace.ubicacion.nombre}` : 'Sin ubicación física'}</Typography>
        <Typography variant="body2">Cantidad: {trace.cantidad} UN · Transferencias: {trace.transferencias.length} · Movimientos: {trace.movimientos.length}</Typography>
      </Stack>}
    </Paper>

    <Paper variant="outlined">
      <Box sx={{ p: 2 }}><Typography variant="h6" fontWeight={800}>Custodia y transferencias recientes</Typography></Box>
      <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Código</TableCell><TableCell>Estado</TableCell><TableCell>Recorrido</TableCell><TableCell>Custodio</TableCell><TableCell>Unidades</TableCell><TableCell>Acción</TableCell></TableRow></TableHead><TableBody>
        {transfers.map((item) => <TableRow key={item.id}><TableCell>{item.codigo}</TableCell><TableCell><Chip size="small" label={item.estado.replaceAll('_', ' ')} /></TableCell><TableCell>{item.origen.codigo} → {item.destino.codigo}</TableCell><TableCell>{item.custodio_id || '—'}</TableCell><TableCell>{item.items.length}</TableCell><TableCell>{canMove && !transfersOnly && item.estado === 'CERRADA' && item.modalidad === 'PICKUP' ? <Button size="small" onClick={() => prepareReturn(item)}>Preparar retorno</Button> : '—'}</TableCell></TableRow>)}
        {!busy && transfers.length === 0 && <TableRow><TableCell colSpan={6}><Alert severity="info">Aún no hay transferencias dentro de tu alcance.</Alert></TableCell></TableRow>}
      </TableBody></Table></TableContainer>
    </Paper>
  </Stack>;
}
