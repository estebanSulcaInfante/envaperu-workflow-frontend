import {
  Alert, Button, FormControl, InputLabel, MenuItem, Paper, Select,
  Stack, TextField, Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import PageHeader from './ui/PageHeader';
import { mensajeErrorScm } from '../services/scmEngineeringApi';
import { listarTrabajadoresWorkspace } from '../services/workspaceAdminApi';
import {
  asignarTrabajadorAlmacenScm, crearAlmacenScm,
  crearUbicacionAlmacenScm, listarAlmacenesScm,
} from '../services/scmWarehouseOperationsApi';

const warehouseInitial = { codigo: '', nombre: '', tipo: 'PIEZAS_WIP' };
const locationInitial = { warehouseId: '', codigo: '', nombre: '', tipo: 'POSICION', clase: 'PIEZA_COLOR' };
const scopeInitial = { warehouseId: '', workerId: '', clase: 'PIEZA_COLOR' };

export default function WarehouseSetupScm() {
  const [warehouses, setWarehouses] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [warehouse, setWarehouse] = useState(warehouseInitial);
  const [location, setLocation] = useState(locationInitial);
  const [scope, setScope] = useState(scopeInitial);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [warehousePayload, workerPayload] = await Promise.all([
      listarAlmacenesScm(), listarTrabajadoresWorkspace(),
    ]);
    setWarehouses(warehousePayload.items || []);
    setWorkers((workerPayload.items || workerPayload || []).filter((item) => item.activo !== false));
  }, []);
  useEffect(() => { load().catch((requestError) => setError(mensajeErrorScm(requestError))); }, [load]);
  const run = async (action, success) => {
    setBusy(true); setError('');
    try { await action(); setNotice(success); await load(); } catch (requestError) { setError(mensajeErrorScm(requestError, 'No se guardó la configuración.')); } finally { setBusy(false); }
  };
  return <Stack spacing={2.5}>
    <PageHeader title="Almacenes, ubicaciones y alcance" description="Configura la jerarquía real. El sistema no crea códigos físicos inventados." />
    {error && <Alert severity="error">{error}</Alert>}{notice && <Alert severity="success">{notice}</Alert>}
    <Alert severity="warning">Cuando se crea el primer almacén activo, el Kardex pasa a filtrar por asignación y clase.</Alert>
    <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="h6" fontWeight={800}>1. Crear almacén</Typography><Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 2 }}>
      <TextField label="Código" value={warehouse.codigo} onChange={(event) => setWarehouse({ ...warehouse, codigo: event.target.value.toUpperCase() })} />
      <TextField label="Nombre" value={warehouse.nombre} onChange={(event) => setWarehouse({ ...warehouse, nombre: event.target.value })} fullWidth />
      <FormControl sx={{ minWidth: 220 }}><InputLabel>Tipo</InputLabel><Select label="Tipo" value={warehouse.tipo} onChange={(event) => setWarehouse({ ...warehouse, tipo: event.target.value })}>{['PIEZAS_WIP', 'MATERIAS_PRIMAS', 'PRODUCTO_TERMINADO', 'GENERAL_CONTINGENCIA'].map((item) => <MenuItem key={item} value={item}>{item.replaceAll('_', ' ')}</MenuItem>)}</Select></FormControl>
      <Button variant="contained" disabled={busy || !warehouse.codigo || !warehouse.nombre} onClick={() => run(() => crearAlmacenScm(warehouse), 'Almacén creado. Ahora define sus ubicaciones.')}>Crear</Button>
    </Stack></Paper>
    <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="h6" fontWeight={800}>2. Añadir ubicación</Typography><Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 2 }}>
      <FormControl sx={{ minWidth: 230 }}><InputLabel>Almacén</InputLabel><Select label="Almacén" value={location.warehouseId} onChange={(event) => setLocation({ ...location, warehouseId: event.target.value })}>{warehouses.map((item) => <MenuItem key={item.id} value={item.id}>{item.codigo} · {item.nombre}</MenuItem>)}</Select></FormControl>
      <TextField label="Código" value={location.codigo} onChange={(event) => setLocation({ ...location, codigo: event.target.value.toUpperCase() })} />
      <TextField label="Nombre" value={location.nombre} onChange={(event) => setLocation({ ...location, nombre: event.target.value })} />
      <FormControl sx={{ minWidth: 200 }}><InputLabel>Tipo</InputLabel><Select label="Tipo" value={location.tipo} onChange={(event) => setLocation({ ...location, tipo: event.target.value })}>{['RECEPCION', 'CUARENTENA', 'ZONA', 'POSICION', 'STAGING', 'PUNTO_PRODUCCION'].map((item) => <MenuItem key={item} value={item}>{item.replaceAll('_', ' ')}</MenuItem>)}</Select></FormControl>
      <Button variant="contained" disabled={busy || !location.warehouseId || !location.codigo || !location.nombre} onClick={() => run(() => crearUbicacionAlmacenScm(location.warehouseId, { codigo: location.codigo, nombre: location.nombre, tipo: location.tipo, clases_articulo: [location.clase] }), 'Ubicación creada.')}>Añadir</Button>
    </Stack></Paper>
    <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="h6" fontWeight={800}>3. Asignar trabajador y clase</Typography><Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 2 }}>
      <FormControl sx={{ minWidth: 230 }}><InputLabel>Almacén</InputLabel><Select label="Almacén" value={scope.warehouseId} onChange={(event) => setScope({ ...scope, warehouseId: event.target.value })}>{warehouses.map((item) => <MenuItem key={item.id} value={item.id}>{item.codigo} · {item.nombre}</MenuItem>)}</Select></FormControl>
      <FormControl fullWidth><InputLabel>Trabajador</InputLabel><Select label="Trabajador" value={scope.workerId} onChange={(event) => setScope({ ...scope, workerId: event.target.value })}>{workers.map((item) => <MenuItem key={item.id} value={item.id}>{item.codigo} · {item.nombre_corto || `${item.nombres} ${item.apellidos}`}</MenuItem>)}</Select></FormControl>
      <FormControl sx={{ minWidth: 230 }}><InputLabel>Clase</InputLabel><Select label="Clase" value={scope.clase} onChange={(event) => setScope({ ...scope, clase: event.target.value })}>{['PIEZA_COLOR', 'SUBENSAMBLE_WIP', 'PRODUCTO_TERMINADO', 'MATERIA_PRIMA', 'COLORANTE', 'ADITIVO'].map((item) => <MenuItem key={item} value={item}>{item.replaceAll('_', ' ')}</MenuItem>)}</Select></FormControl>
      <Button variant="contained" disabled={busy || !scope.warehouseId || !scope.workerId} onClick={() => run(() => asignarTrabajadorAlmacenScm(scope.warehouseId, { trabajador_id: Number(scope.workerId), clases_articulo: [scope.clase] }), 'Alcance asignado.')}>Asignar</Button>
    </Stack></Paper>
  </Stack>;
}
