import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, InputLabel, MenuItem, Paper, Select,
  Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from './ui/PageHeader';
import InventoryOpeningScm from './InventoryOpeningScm';
import { useScmActor } from '../context/ScmActorContext';
import {
  listarArticulosScm,
  mensajeErrorScm,
} from '../services/scmEngineeringApi';
import {
  listarMovimientosInventarioScm,
  listarSaldosInventarioScm,
  registrarMovimientoInventarioScm,
} from '../services/scmInventoryApi';
import { listarMaterialesScm } from '../services/scmCatalogApi';
import { obtenerAlcanceAlmacenScm } from '../services/scmWarehouseOperationsApi';

const initialForm = {
  articulo_scm_id: '',
  cantidad: '',
  tipo: 'SALDO_INICIAL',
  ubicacion_codigo: 'ALMACEN_GENERAL',
  ubicacion_nombre: 'Almacén general',
  motivo: '',
};

const number = (value) => Number(value || 0);

export default function InventoryScm() {
  const { can } = useScmActor();
  const canAdjust = can('INVENTARIO_AJUSTAR');
  const [balances, setBalances] = useState([]);
  const [materialBalances, setMaterialBalances] = useState([]);
  const [movements, setMovements] = useState([]);
  const [articles, setArticles] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [query, setQuery] = useState('');
  const [warehouseScope, setWarehouseScope] = useState(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const [balancePayload, movementPayload, articleItems, materialItems, scopePayload] = await Promise.all([
        listarSaldosInventarioScm(),
        listarMovimientosInventarioScm(),
        listarArticulosScm(),
        listarMaterialesScm(),
        obtenerAlcanceAlmacenScm(),
      ]);
      setBalances(balancePayload.items || []);
      setMaterialBalances(balancePayload.materiales || []);
      setMovements(movementPayload.items || []);
      setArticles((articleItems || []).filter((item) => item.activo !== false));
      setMaterials((materialItems || []).filter((item) => item.activo !== false));
      setWarehouseScope(scopePayload);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo cargar el Kardex.'));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => balances.reduce((accumulator, item) => ({
    physical: accumulator.physical + number(item.cantidad_fisica),
    reserved: accumulator.reserved + number(item.cantidad_reservada),
    unavailable: accumulator.unavailable + number(item.cantidad_no_disponible),
    free: accumulator.free + number(item.cantidad_libre),
  }), {
    physical: 0, reserved: 0, unavailable: 0, free: 0,
  }), [balances]);
  const materialTotals = useMemo(() => materialBalances.reduce((accumulator, item) => ({
    physical: accumulator.physical + number(item.cantidad_fisica),
    reserved: accumulator.reserved + number(item.cantidad_reservada),
    unavailable: accumulator.unavailable + number(item.cantidad_no_disponible),
    free: accumulator.free + number(item.cantidad_libre),
  }), { physical: 0, reserved: 0, unavailable: 0, free: 0 }), [materialBalances]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return balances;
    return balances.filter((item) => (
      `${item.articulo.codigo} ${item.articulo.nombre} ${item.ubicacion.nombre}`
        .toLowerCase().includes(normalized)
    ));
  }, [balances, query]);

  const submit = async () => {
    if (!form.articulo_scm_id || number(form.cantidad) <= 0 || !form.motivo.trim()) {
      setError('Selecciona un artículo, indica una cantidad positiva y explica el motivo.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await registrarMovimientoInventarioScm({
        ...form,
        articulo_scm_id: Number(form.articulo_scm_id),
        cantidad: number(form.cantidad),
        motivo: form.motivo.trim(),
      });
      setOpen(false);
      setForm(initialForm);
      setNotice('Movimiento registrado. El saldo libre ya participa en nuevos cálculos.');
      await load();
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se registró el movimiento.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      <PageHeader
        title="Kardex de mi almacén"
        description="Consulta existencias, reservas y movimientos dentro de los almacenes y clases asignados a tu trabajo."
        actions={(
          <Stack direction="row" spacing={1}>
            <Button startIcon={<RefreshIcon />} variant="outlined" onClick={load}>
              Actualizar
            </Button>
            {canAdjust && (
              <Button
                startIcon={<AddIcon />}
                variant="contained"
                onClick={() => {
                  setForm({
                    ...initialForm,
                    tipo: 'AJUSTE_POSITIVO',
                  });
                  setOpen(true);
                }}
              >
                Registrar movimiento
              </Button>
            )}
          </Stack>
        )}
      />
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
      {warehouseScope?.configurado && warehouseScope.control_transversal && (
        <Alert severity="info"><strong>Control transversal:</strong> puedes consultar todos los almacenes. Las operaciones físicas conservan sus permisos propios.</Alert>
      )}
      {warehouseScope?.configurado && !warehouseScope.control_transversal && (warehouseScope.almacenes || []).length > 0 && (
        <Alert severity="success">
          <strong>Alcance activo:</strong> {(warehouseScope.almacenes || []).map((item) => `${item.codigo} (${(item.clases_articulo || []).map((value) => value.replaceAll('_', ' ')).join(', ')})`).join(' · ')}
        </Alert>
      )}
      {warehouseScope?.configurado && !warehouseScope.control_transversal && (warehouseScope.almacenes || []).length === 0 && (
        <Alert severity="warning">No tienes un almacén asignado. Administración debe asignarte almacén y clases antes de mostrar saldos.</Alert>
      )}
      <Alert severity="info">
        El saldo inicial no crea mangas ficticias. Las mangas nuevas ingresarán al Kardex
        cuando Almacén confirme su recepción; una reserva no equivale todavía a consumo.
      </Alert>

      <InventoryOpeningScm
        articles={articles}
        materials={materials}
        onApplied={load}
      />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        {[
          ['Existencia física', totals.physical, materialTotals.physical, 'Todo lo registrado'],
          ['No disponible', totals.unavailable, materialTotals.unavailable, 'Pendiente, bloqueado o rechazado'],
          ['Reservada', totals.reserved, materialTotals.reserved, 'Comprometida por planes'],
          ['Libre', totals.free, materialTotals.free, 'Disponible para nuevas OP'],
        ].map(([label, value, materialValue, help]) => (
          <Paper key={label} variant="outlined" sx={{ p: 2, flex: 1 }}>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            <Typography variant="h5" fontWeight={800}>{value.toLocaleString('es-PE')} UN</Typography>
            <Typography variant="body2" fontWeight={700}>{materialValue.toLocaleString('es-PE')} KG</Typography>
            <Typography variant="caption" color="text.secondary">{help}</Typography>
          </Paper>
        ))}
      </Stack>

      <Paper variant="outlined">
        <Box sx={{ p: 2 }}>
          <TextField
            fullWidth
            size="small"
            label="Buscar artículo o ubicación"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Artículo SCM</TableCell>
              <TableCell>Ubicación</TableCell>
              <TableCell align="right">Físico</TableCell>
              <TableCell align="right">Reservado</TableCell>
              <TableCell align="right">No disponible</TableCell>
              <TableCell align="right">Libre</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Typography fontWeight={700}>{item.articulo.nombre}</Typography>
                    <Typography variant="caption">
                      {item.articulo.codigo} · {item.articulo.clase}
                    </Typography>
                  </TableCell>
                  <TableCell>{item.ubicacion.nombre}</TableCell>
                  <TableCell align="right">{item.cantidad_fisica} {item.articulo.unidad}</TableCell>
                  <TableCell align="right">{item.cantidad_reservada}</TableCell>
                  <TableCell align="right">{item.cantidad_no_disponible}</TableCell>
                  <TableCell align="right">
                    <Chip size="small" color="success" label={item.cantidad_libre} />
                  </TableCell>
                </TableRow>
              ))}
              {!busy && filtered.length === 0 && (
                <TableRow><TableCell colSpan={6}>
                  <Alert severity="info">
                    Aún no hay saldos. Almacén puede registrar el inventario inicial sin
                    crear lotes o mangas artificiales.
                  </Alert>
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper variant="outlined">
        <Typography fontWeight={800} sx={{ p: 2 }}>Materia prima y colorantes</Typography>
        <TableContainer><Table size="small">
          <TableHead><TableRow><TableCell>Material</TableCell><TableCell>Ubicación</TableCell><TableCell align="right">Físico</TableCell><TableCell align="right">Reservado</TableCell><TableCell align="right">No disponible</TableCell><TableCell align="right">Libre</TableCell></TableRow></TableHead>
          <TableBody>
            {materialBalances.map((item) => <TableRow key={item.id}><TableCell><Typography fontWeight={700}>{item.articulo.nombre}</Typography><Typography variant="caption">{item.articulo.codigo} · {item.articulo.clase}</Typography></TableCell><TableCell>{item.ubicacion.nombre}</TableCell><TableCell align="right">{item.cantidad_fisica} KG</TableCell><TableCell align="right">{item.cantidad_reservada}</TableCell><TableCell align="right">{item.cantidad_no_disponible}</TableCell><TableCell align="right"><Chip size="small" color="success" label={`${item.cantidad_libre} KG`} /></TableCell></TableRow>)}
            {!busy && materialBalances.length === 0 && <TableRow><TableCell colSpan={6}><Alert severity="info">Sin saldos de materiales. Se incorporan mediante un lote de apertura aprobado.</Alert></TableCell></TableRow>}
          </TableBody>
        </Table></TableContainer>
      </Paper>

      <Paper variant="outlined">
        <Typography fontWeight={800} sx={{ p: 2 }}>Últimos movimientos</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Fecha</TableCell>
              <TableCell>Artículo</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell align="right">Variación</TableCell>
              <TableCell>Motivo</TableCell>
            </TableRow></TableHead>
            <TableBody>{movements.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.created_at ? new Date(item.created_at).toLocaleString('es-PE') : '—'}</TableCell>
                <TableCell>{item.articulo_codigo} · {item.articulo_nombre}</TableCell>
                <TableCell><Chip size="small" label={item.tipo.replaceAll('_', ' ')} /></TableCell>
                <TableCell align="right">{item.cantidad_delta}</TableCell>
                <TableCell>{item.motivo}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Registrar movimiento de inventario</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Tipo de movimiento</InputLabel>
              <Select
                label="Tipo de movimiento"
                value={form.tipo}
                onChange={(event) => setForm({ ...form, tipo: event.target.value })}
              >
                {canAdjust && <MenuItem value="AJUSTE_POSITIVO">Ajuste positivo</MenuItem>}
                {canAdjust && <MenuItem value="AJUSTE_NEGATIVO">Ajuste negativo</MenuItem>}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Artículo SCM</InputLabel>
              <Select
                label="Artículo SCM"
                value={form.articulo_scm_id}
                onChange={(event) => setForm({ ...form, articulo_scm_id: event.target.value })}
              >
                {articles.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.codigo} · {item.nombre} · {item.clase}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Cantidad"
              type="number"
              inputProps={{ min: 0.001, step: 0.001 }}
              value={form.cantidad}
              onChange={(event) => setForm({ ...form, cantidad: event.target.value })}
            />
            <TextField
              label="Ubicación"
              value={form.ubicacion_codigo}
              onChange={(event) => setForm({
                ...form,
                ubicacion_codigo: event.target.value.toUpperCase(),
              })}
              helperText="Para el arranque puede usarse ALMACEN_GENERAL."
            />
            <TextField
              label="Motivo o referencia de conteo"
              multiline
              minRows={2}
              value={form.motivo}
              onChange={(event) => setForm({ ...form, motivo: event.target.value })}
              helperText="Este texto queda en el Kardex y no puede borrarse."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="contained" disabled={busy} onClick={submit}>
            Registrar
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
