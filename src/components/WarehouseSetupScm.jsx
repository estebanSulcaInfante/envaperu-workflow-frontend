import {
  Alert, Button, Checkbox, Chip, FormControl, FormControlLabel, InputLabel,
  MenuItem, Paper, Select, Stack, TextField, Typography,
} from '@mui/material';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import PageHeader from './ui/PageHeader';
import { mensajeErrorScm } from '../services/scmEngineeringApi';
import { listarTrabajadoresWorkspace } from '../services/workspaceAdminApi';
import {
  asignarTrabajadorAlmacenScm, crearAlmacenScm,
  crearUbicacionAlmacenScm, listarAlmacenesScm,
} from '../services/scmWarehouseOperationsApi';

const ARTICLE_CLASSES = [
  'PIEZA_COLOR', 'SUBENSAMBLE_WIP', 'PRODUCTO_TERMINADO',
  'MATERIA_PRIMA', 'COLORANTE', 'ADITIVO',
];
const WAREHOUSE_TYPES = ['PIEZAS_WIP', 'MATERIAS_PRIMAS', 'PRODUCTO_TERMINADO', 'GENERAL_CONTINGENCIA'];
const LOCATION_TYPES = ['RECEPCION', 'CUARENTENA', 'ZONA', 'POSICION', 'STAGING', 'PUNTO_PRODUCCION'];
const label = (value) => value.replaceAll('_', ' ');
const warehouseInitial = { codigo: '', nombre: '', tipo: 'PIEZAS_WIP' };
const locationInitial = {
  warehouseId: '', codigo: '', nombre: '', tipo: 'POSICION', parentId: '',
  clases: ['PIEZA_COLOR'], permiteSaldoLibre: true,
};
const scopeInitial = { warehouseId: '', workerId: '', clases: ['PIEZA_COLOR'] };

function ClassSelector({ labelText, value, onChange }) {
  const labelId = useId();
  return <FormControl sx={{ minWidth: 260 }}>
    <InputLabel id={labelId}>{labelText}</InputLabel>
    <Select
      multiple
      labelId={labelId}
      label={labelText}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      renderValue={(selected) => selected.map(label).join(', ')}
    >
      {ARTICLE_CLASSES.map((item) => <MenuItem key={item} value={item}>
        <Checkbox checked={value.includes(item)} />{label(item)}
      </MenuItem>)}
    </Select>
  </FormControl>;
}

export default function WarehouseSetupScm() {
  const warehouseTypeLabelId = useId();
  const locationWarehouseLabelId = useId();
  const locationTypeLabelId = useId();
  const locationParentLabelId = useId();
  const scopeWarehouseLabelId = useId();
  const scopeWorkerLabelId = useId();
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

  const selectedWarehouse = useMemo(
    () => warehouses.find((item) => item.id === location.warehouseId),
    [warehouses, location.warehouseId],
  );
  const run = async (action, success) => {
    setBusy(true); setError(''); setNotice('');
    try { await action(); setNotice(success); await load(); }
    catch (requestError) { setError(mensajeErrorScm(requestError, 'No se guardó la configuración.')); }
    finally { setBusy(false); }
  };

  return <Stack spacing={2.5}>
    <PageHeader title="Almacenes, ubicaciones y alcance" description="Configura la jerarquía real. El sistema no crea códigos físicos inventados." />
    {error && <Alert severity="error">{error}</Alert>}{notice && <Alert severity="success">{notice}</Alert>}
    <Alert severity="warning">Cuando se crea el primer almacén activo, el Kardex pasa a filtrar por asignación y clase.</Alert>

    {warehouses.length > 0 && <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6" fontWeight={800}>Configuración actual</Typography>
      <Stack spacing={1.5} sx={{ mt: 1.5 }}>
        {warehouses.map((item) => <Stack key={item.id} direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
          <Typography fontWeight={800}>{item.codigo} · {item.nombre}</Typography>
          <Chip size="small" label={label(item.tipo)} />
          <Typography variant="body2" color="text.secondary">
            {(item.ubicaciones || []).length} ubicación(es): {(item.ubicaciones || []).map((entry) => entry.codigo).join(', ') || 'ninguna'}
          </Typography>
        </Stack>)}
      </Stack>
    </Paper>}

    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6" fontWeight={800}>1. Crear almacén</Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 2 }}>
        <TextField label="Código de almacén" value={warehouse.codigo} onChange={(event) => setWarehouse({ ...warehouse, codigo: event.target.value.toUpperCase() })} />
        <TextField label="Nombre de almacén" value={warehouse.nombre} onChange={(event) => setWarehouse({ ...warehouse, nombre: event.target.value })} fullWidth />
        <FormControl sx={{ minWidth: 220 }}><InputLabel id={warehouseTypeLabelId}>Tipo de almacén</InputLabel><Select labelId={warehouseTypeLabelId} label="Tipo de almacén" value={warehouse.tipo} onChange={(event) => setWarehouse({ ...warehouse, tipo: event.target.value })}>{WAREHOUSE_TYPES.map((item) => <MenuItem key={item} value={item}>{label(item)}</MenuItem>)}</Select></FormControl>
        <Button variant="contained" disabled={busy || !warehouse.codigo || !warehouse.nombre} onClick={() => run(async () => { await crearAlmacenScm(warehouse); setWarehouse(warehouseInitial); }, 'Almacén creado. Ahora define sus ubicaciones.')}>Crear almacén</Button>
      </Stack>
    </Paper>

    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6" fontWeight={800}>2. Añadir ubicación</Typography>
      <Typography variant="body2" color="text.secondary">Define dónde queda la custodia, qué clases admite y si el saldo puede quedar libre.</Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
        <FormControl sx={{ minWidth: 230 }}><InputLabel id={locationWarehouseLabelId}>Almacén de la ubicación</InputLabel><Select labelId={locationWarehouseLabelId} label="Almacén de la ubicación" value={location.warehouseId} onChange={(event) => setLocation({ ...location, warehouseId: event.target.value, parentId: '' })}>{warehouses.map((item) => <MenuItem key={item.id} value={item.id}>{item.codigo} · {item.nombre}</MenuItem>)}</Select></FormControl>
        <TextField label="Código de ubicación" value={location.codigo} onChange={(event) => setLocation({ ...location, codigo: event.target.value.toUpperCase() })} />
        <TextField label="Nombre de ubicación" value={location.nombre} onChange={(event) => setLocation({ ...location, nombre: event.target.value })} />
        <FormControl sx={{ minWidth: 210 }}><InputLabel id={locationTypeLabelId}>Tipo de ubicación</InputLabel><Select labelId={locationTypeLabelId} label="Tipo de ubicación" value={location.tipo} onChange={(event) => setLocation({ ...location, tipo: event.target.value })}>{LOCATION_TYPES.map((item) => <MenuItem key={item} value={item}>{label(item)}</MenuItem>)}</Select></FormControl>
        <FormControl sx={{ minWidth: 230 }}><InputLabel id={locationParentLabelId}>Ubicación padre</InputLabel><Select labelId={locationParentLabelId} label="Ubicación padre" value={location.parentId} onChange={(event) => setLocation({ ...location, parentId: event.target.value })}><MenuItem value="">Sin ubicación padre</MenuItem>{(selectedWarehouse?.ubicaciones || []).map((item) => <MenuItem key={item.id} value={item.id}>{item.codigo} · {item.nombre}</MenuItem>)}</Select></FormControl>
        <ClassSelector labelText="Clases admitidas por la ubicación" value={location.clases} onChange={(clases) => setLocation({ ...location, clases })} />
        <FormControlLabel control={<Checkbox checked={location.permiteSaldoLibre} onChange={(event) => setLocation({ ...location, permiteSaldoLibre: event.target.checked })} />} label="Permite saldo libre" />
        <Button variant="contained" disabled={busy || !location.warehouseId || !location.codigo || !location.nombre || location.clases.length === 0} onClick={() => run(async () => {
          await crearUbicacionAlmacenScm(location.warehouseId, {
            codigo: location.codigo, nombre: location.nombre, tipo: location.tipo,
            parent_id: location.parentId || null, clases_articulo: location.clases,
            permite_saldo_libre: location.permiteSaldoLibre,
          });
          setLocation({ ...locationInitial, warehouseId: location.warehouseId, clases: location.clases });
        }, 'Ubicación creada.')}>Añadir ubicación</Button>
      </Stack>
    </Paper>

    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6" fontWeight={800}>3. Asignar trabajador y clases</Typography>
      <Typography variant="body2" color="text.secondary">El trabajador solo consulta y opera los almacenes y clases asignados.</Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
        <FormControl sx={{ minWidth: 230 }}><InputLabel id={scopeWarehouseLabelId}>Almacén del trabajador</InputLabel><Select labelId={scopeWarehouseLabelId} label="Almacén del trabajador" value={scope.warehouseId} onChange={(event) => setScope({ ...scope, warehouseId: event.target.value })}>{warehouses.map((item) => <MenuItem key={item.id} value={item.id}>{item.codigo} · {item.nombre}</MenuItem>)}</Select></FormControl>
        <FormControl sx={{ minWidth: 300 }}><InputLabel id={scopeWorkerLabelId}>Trabajador</InputLabel><Select labelId={scopeWorkerLabelId} label="Trabajador" value={scope.workerId} onChange={(event) => setScope({ ...scope, workerId: event.target.value })}>{workers.map((item) => <MenuItem key={item.id} value={item.id}>{item.codigo} · {item.nombre_corto || `${item.nombres} ${item.apellidos}`}</MenuItem>)}</Select></FormControl>
        <ClassSelector labelText="Clases asignadas" value={scope.clases} onChange={(clases) => setScope({ ...scope, clases })} />
        <Button variant="contained" disabled={busy || !scope.warehouseId || !scope.workerId || scope.clases.length === 0} onClick={() => run(() => asignarTrabajadorAlmacenScm(scope.warehouseId, { trabajador_id: Number(scope.workerId), clases_articulo: scope.clases }), 'Alcance asignado.')}>Asignar alcance</Button>
      </Stack>
    </Paper>
  </Stack>;
}
