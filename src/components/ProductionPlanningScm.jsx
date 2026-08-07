import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Paper,
  Select, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import {
  ajustarMetasPlanOpScm, aprobarOpDemandaScm, calcularPlanOpScm, confirmarPlanOpScm,
  crearOpDemandaScm, listarOpDemandaScm, obtenerPlanOpScm,
} from '../services/scmPlanningApi';
import {
  mensajeErrorScm,
} from '../services/scmEngineeringApi';
import PageHeader from './ui/PageHeader';
import ProcessJourney from './ui/ProcessJourney';
import { buscarProductos } from '../services/api';
import { listarPresentacionesComercialesScm } from '../services/scmCatalogApi';
import { useScmActor } from '../context/ScmActorContext';

const stateColor = {
  BORRADOR: 'default',
  APROBADA: 'info',
  PLANIFICADA: 'primary',
  EN_COBERTURA: 'warning',
  COMPLETADA: 'success',
  CANCELADA: 'error',
};

export default function ProductionPlanningScm() {
  const { can, experience } = useScmActor();
  const canCreate = can('OP_CREAR');
  const canApprove = can('OP_APROBAR');
  const canCalculate = can('PLANIFICACION_CALCULAR');
  const canConfirm = can('PLANIFICACION_CONFIRMAR');
  const isReadOnly = !canCreate && !canApprove && !canCalculate && !canConfirm;
  const [orders, setOrders] = useState([]);
  const [orderId, setOrderId] = useState('');
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [products, setProducts] = useState([]);
  const [presentations, setPresentations] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [targetDraft, setTargetDraft] = useState({});
  const [targetReason, setTargetReason] = useState('');
  const [createForm, setCreateForm] = useState({
    referencia_origen: '',
    fecha_necesidad: new Date().toISOString().slice(0, 10),
    prioridad: 'NORMAL',
    producto_terminado_id: '',
    presentacion_comercial_id: '',
    cantidad_presentaciones: '',
  });

  const selected = useMemo(
    () => orders.find((item) => item.id === orderId) || orders[0] || null,
    [orderId, orders],
  );

  const loadPlan = useCallback(async (id) => {
    if (!id) {
      setPlan(null);
      return;
    }
    const payload = await obtenerPlanOpScm(id);
    setPlan(payload.plan);
  }, []);

  const load = useCallback(async (preferredId) => {
    setBusy(true);
    setError('');
    try {
      const [payload, productItems, presentationItems] = await Promise.all([
        listarOpDemandaScm(),
        buscarProductos(),
        listarPresentacionesComercialesScm({ activo: true }),
      ]);
      setProducts(productItems || []);
      setPresentations(presentationItems || []);
      const items = payload.items || [];
      const nextId = items.some((item) => item.id === preferredId)
        ? preferredId : items[0]?.id || '';
      setOrders(items);
      setOrderId(nextId);
      await loadPlan(nextId);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se cargaron las OP de demanda.'));
    } finally {
      setBusy(false);
    }
  }, [loadPlan]);

  useEffect(() => { load(''); }, [load]);

  const run = async (action) => {
    if (!selected) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      let result;
      if (action === 'approve') result = await aprobarOpDemandaScm(selected);
      if (action === 'calculate') result = await calcularPlanOpScm(selected);
      if (action === 'confirm') result = await confirmarPlanOpScm(selected, plan);
      const nextOrder = result.orden || result;
      setNotice(
        action === 'approve'
          ? `${nextOrder.codigo} aprobada.`
          : action === 'calculate'
            ? `Plan revisión ${result.plan.revision} calculado sin crear documentos.`
            : `${result.documentos.length} OF/OE creadas en borrador.`,
      );
      await load(selected.id);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se completó la planificación.'));
    } finally {
      setBusy(false);
    }
  };

  const createOrder = async () => {
    if (
      !createForm.producto_terminado_id
      || !createForm.presentacion_comercial_id
      || Number(createForm.cantidad_presentaciones) <= 0
    ) {
      setError('Selecciona producto, presentación y una cantidad positiva.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const created = await crearOpDemandaScm({
        origen: 'PLANIFICACION',
        referencia_origen: createForm.referencia_origen.trim() || undefined,
        fecha_necesidad: createForm.fecha_necesidad,
        prioridad: createForm.prioridad,
        lineas: [{
          producto_terminado_id: createForm.producto_terminado_id,
          presentacion_comercial_id: Number(createForm.presentacion_comercial_id),
          cantidad_presentaciones: Number(createForm.cantidad_presentaciones),
        }],
      });
      setCreateOpen(false);
      setNotice(`${created.codigo} creada en borrador.`);
      await load(created.id);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se creó la OP de demanda.'));
    } finally {
      setBusy(false);
    }
  };

  const documents = plan?.propuesta?.documentos || [];
  const selectedPresentations = presentations.filter(
    (item) => item.producto_terminado_id === createForm.producto_terminado_id,
  );
  const selectedPresentation = selectedPresentations.find(
    (item) => item.id === Number(createForm.presentacion_comercial_id),
  );
  const blockers = plan?.propuesta?.bloqueos || [];
  const stockReservations = plan?.propuesta?.reservas_stock || [];
  const targetDirty = documents.some(
    (item) => String(targetDraft[item.clave] ?? item.cantidad_objetivo)
      !== String(item.cantidad_objetivo),
  );

  useEffect(() => {
    setTargetDraft(Object.fromEntries(
      documents.map((item) => [item.clave, item.cantidad_objetivo]),
    ));
    setTargetReason('');
  }, [plan?.id]);

  const saveTargets = async () => {
    if (!selected || !plan || !targetDirty) return;
    if (!targetReason.trim()) {
      setError('Indica el motivo del ajuste para conservar la trazabilidad.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const ajustes = documents
        .filter(
          (item) => String(targetDraft[item.clave]) !== String(item.cantidad_objetivo),
        )
        .map((item) => ({
          clave: item.clave,
          cantidad_objetivo: Number(targetDraft[item.clave]),
        }));
      const result = await ajustarMetasPlanOpScm(
        selected,
        plan,
        ajustes,
        targetReason.trim(),
      );
      setPlan(result.plan);
      setNotice(`Metas guardadas en la revisión ${result.plan.revision}.`);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se guardaron las metas del plan.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      <PageHeader
        eyebrow="Planificación / Demanda"
        title="Planificación de OP"
        description="Calcula cobertura documental y confirma propuestas OF/OE sin consumir inventario ni liberar producción."
        actions={(
          <Stack direction="row" spacing={1}>
            <Button startIcon={<RefreshIcon />} variant="outlined" onClick={() => load(selected?.id)}>
              Actualizar
            </Button>
            {canCreate && (
              <Button startIcon={<AddIcon />} variant="contained" onClick={() => setCreateOpen(true)}>
                Nueva OP
              </Button>
            )}
          </Stack>
        )}
      />
      <ProcessJourney current="demanda" />
      {isReadOnly && (
        <Alert severity="info">
          Vista de consulta para {experience.label}. Las acciones de creación, cálculo y
          confirmación se muestran únicamente a los responsables de planificación.
        </Alert>
      )}
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
      <Alert severity="info">
        El cálculo propone metas según la demanda y el Kardex. Antes de confirmar puedes
        ajustar fabricación o armado; el sistema conservará el valor sugerido, el motivo
        y una nueva revisión auditable.
      </Alert>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <FormControl sx={{ minWidth: 300 }}>
            <InputLabel>OP de demanda</InputLabel>
            <Select
              label="OP de demanda"
              value={selected?.id || ''}
              onChange={async (event) => {
                setOrderId(event.target.value);
                setBusy(true);
                try { await loadPlan(event.target.value); } finally { setBusy(false); }
              }}
            >
              {orders.map((order) => (
                <MenuItem key={order.id} value={order.id}>
                  {order.codigo} · {order.estado} · {order.referencia_origen || 'Sin referencia'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {selected && (
            <>
              <Chip label={selected.estado} color={stateColor[selected.estado] || 'default'} />
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                Necesidad {selected.fecha_necesidad} · versión {selected.version}
              </Typography>
              {canApprove && (
                <Button
                  variant="outlined"
                  disabled={busy || selected.estado !== 'BORRADOR'}
                  onClick={() => run('approve')}
                >
                  Aprobar OP
                </Button>
              )}
              {canCalculate && (
                <Button
                  variant="contained"
                  disabled={busy || selected.estado !== 'APROBADA'}
                  onClick={() => run('calculate')}
                >
                  {plan?.estado === 'CALCULADO' ? 'Recalcular' : 'Calcular plan'}
                </Button>
              )}
              {canConfirm && (
                <Button
                  color="success"
                  variant="contained"
                  disabled={busy || selected.estado !== 'APROBADA' || plan?.estado !== 'CALCULADO' || blockers.length > 0}
                  onClick={() => run('confirm')}
                >
                  Confirmar plan
                </Button>
              )}
            </>
          )}
        </Stack>
      </Paper>

      {busy && <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}><CircularProgress /></Box>}
      {!busy && !selected && <Alert severity="info">Todavía no existen OP de demanda.</Alert>}

      {!busy && selected && (
        <Paper variant="outlined">
          <Typography fontWeight={800} sx={{ p: 2 }}>Demanda y cobertura</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>Producto terminado</TableCell>
                <TableCell align="right">Solicitado</TableCell>
                <TableCell align="right">Planificado</TableCell>
                <TableCell align="right">Comprometido</TableCell>
                <TableCell align="right">Satisfecho</TableCell>
              </TableRow></TableHead>
              <TableBody>{selected.lineas.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{line.producto}<br /><Typography variant="caption">{line.producto_terminado_id}</Typography></TableCell>
                  <TableCell align="right">
                    {line.presentacion_comercial
                      ? `${line.presentacion_comercial.cantidad} ${line.presentacion_comercial.nombre} = ${line.cantidad_solicitada} UN`
                      : `${line.cantidad_solicitada} UN`}
                  </TableCell>
                  <TableCell align="right">{line.cobertura.planificada}</TableCell>
                  <TableCell align="right">{line.cobertura.comprometida}</TableCell>
                  <TableCell align="right">{line.cobertura.satisfecha}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {plan && (
        <Paper variant="outlined">
          <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 2 }}>
            <Typography fontWeight={800} sx={{ flex: 1 }}>
              Propuesta revisión {plan.revision}
            </Typography>
            <Chip label={plan.estado} color={plan.estado === 'CONFIRMADO' ? 'success' : 'info'} />
            <Chip label={plan.propuesta.politica_stock} variant="outlined" />
          </Stack>
          {blockers.length > 0 && (
            <Alert severity="error" sx={{ mx: 2, mb: 2 }}>
              Hay {blockers.length} artículo(s) requeridos sin una operación de ruta. El plan no puede confirmarse.
            </Alert>
          )}
          {stockReservations.length > 0 && (
            <Alert severity="success" sx={{ mx: 2, mb: 2 }}>
              Kardex cubre {stockReservations.reduce(
                (total, item) => total + Number(item.cantidad || 0),
                0,
              ).toLocaleString('es-PE')} unidades en esta propuesta. Al confirmar
              quedarán reservadas; la existencia física no se consumirá todavía.
            </Alert>
          )}
          {plan.estado === 'CALCULADO' && canCalculate && (
            <Alert severity="info" sx={{ mx: 2, mb: 2 }}>
              Puedes reducir las metas hasta 0 cuando exista cobertura externa al plan.
              Para producir más, aumenta la demanda o recalcula. Explica el motivo antes
              de guardar.
            </Alert>
          )}
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>Documento propuesto</TableCell>
                <TableCell>Operación</TableCell>
                <TableCell>Salida</TableCell>
                <TableCell align="right">Sugerido</TableCell>
                <TableCell align="right">Meta confirmable</TableCell>
                <TableCell>Configuración</TableCell>
              </TableRow></TableHead>
              <TableBody>{documents.map((item) => (
                <TableRow key={item.clave}>
                  <TableCell><Chip size="small" label={item.tipo === 'FABRICACION' ? 'OF' : 'OE'} /></TableCell>
                  <TableCell>{item.operacion}</TableCell>
                  <TableCell>{item.articulo.nombre}<br /><Typography variant="caption">{item.articulo.codigo}</Typography></TableCell>
                  <TableCell align="right">
                    {item.cantidad_calculada ?? item.cantidad_objetivo} un
                  </TableCell>
                  <TableCell align="right" sx={{ minWidth: 170 }}>
                    {plan.estado === 'CALCULADO' && canCalculate ? (
                      <TextField
                        size="small"
                        type="number"
                        value={targetDraft[item.clave] ?? item.cantidad_objetivo}
                        inputProps={{
                          min: 0,
                          max: Number(item.cantidad_calculada ?? item.cantidad_objetivo),
                          step: 1,
                        }}
                        onChange={(event) => setTargetDraft((current) => ({
                          ...current,
                          [item.clave]: event.target.value,
                        }))}
                        error={
                          Number(targetDraft[item.clave]) < 0
                          || Number(targetDraft[item.clave])
                            > Number(item.cantidad_calculada ?? item.cantidad_objetivo)
                        }
                        sx={{ width: 130 }}
                      />
                    ) : `${item.cantidad_objetivo} un`}
                  </TableCell>
                  <TableCell>{item.requiere_configuracion_tecnica ? 'Pendiente técnica' : 'Lista para revisión'}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </TableContainer>
          {plan.estado === 'CALCULADO' && canCalculate && (
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.5}
              alignItems={{ md: 'center' }}
              sx={{ p: 2 }}
            >
              <TextField
                fullWidth
                label="Motivo del ajuste"
                placeholder="Ej.: cubrir parte con inventario inicial pendiente de cargar"
                value={targetReason}
                onChange={(event) => setTargetReason(event.target.value)}
                disabled={!targetDirty}
              />
              <Button
                variant="contained"
                onClick={saveTargets}
                disabled={busy || !targetDirty || !targetReason.trim()}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Guardar metas
              </Button>
            </Stack>
          )}
        </Paper>
      )}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nueva OP de demanda</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel id="op-product-label">Producto terminado</InputLabel>
              <Select
                labelId="op-product-label"
                id="op-product"
                label="Producto terminado"
                value={createForm.producto_terminado_id}
                onChange={(event) => {
                  const productId = event.target.value;
                  const options = presentations.filter(
                    (item) => item.producto_terminado_id === productId,
                  );
                  const defaultPresentation = options.find((item) => item.predeterminada)
                    || options[0];
                  setCreateForm({
                    ...createForm,
                    producto_terminado_id: productId,
                    presentacion_comercial_id: defaultPresentation?.id || '',
                    cantidad_presentaciones: '',
                  });
                }}
              >
                {products.map((product) => (
                  <MenuItem key={product.cod_sku_pt} value={product.cod_sku_pt}>
                    {product.cod_sku_pt} · {product.producto}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth disabled={!createForm.producto_terminado_id}>
              <InputLabel id="op-presentation-label">Presentación comercial</InputLabel>
              <Select
                labelId="op-presentation-label"
                id="op-presentation"
                label="Presentación comercial"
                value={createForm.presentacion_comercial_id}
                onChange={(event) => setCreateForm({
                  ...createForm,
                  presentacion_comercial_id: event.target.value,
                })}
              >
                {selectedPresentations.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.nombre} · {item.unidades_base} UN
                    {item.predeterminada ? ' · Predeterminada' : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Cantidad de presentaciones"
              type="number"
              value={createForm.cantidad_presentaciones}
              inputProps={{ min: 1, step: 1 }}
              onChange={(event) => setCreateForm({
                ...createForm,
                cantidad_presentaciones: event.target.value,
              })}
              helperText={selectedPresentation && Number(createForm.cantidad_presentaciones) > 0
                ? `${createForm.cantidad_presentaciones} ${selectedPresentation.nombre} = ${Number(createForm.cantidad_presentaciones) * selectedPresentation.unidades_base} UN`
                : 'La planificación convierte este valor a unidades del PT.'}
            />
            <TextField
              label="Fecha de necesidad"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={createForm.fecha_necesidad}
              onChange={(event) => setCreateForm({
                ...createForm,
                fecha_necesidad: event.target.value,
              })}
            />
            <FormControl fullWidth>
              <InputLabel>Prioridad</InputLabel>
              <Select
                label="Prioridad"
                value={createForm.prioridad}
                onChange={(event) => setCreateForm({
                  ...createForm,
                  prioridad: event.target.value,
                })}
              >
                <MenuItem value="NORMAL">Normal</MenuItem>
                <MenuItem value="ALTA">Alta</MenuItem>
                <MenuItem value="URGENTE">Urgente</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Referencia (opcional)"
              value={createForm.referencia_origen}
              onChange={(event) => setCreateForm({
                ...createForm,
                referencia_origen: event.target.value,
              })}
            />
            <Alert severity="info">
              Al guardar se congelan las revisiones BOM y ruta aprobadas disponibles.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={createOrder} disabled={busy}>
            Crear borrador
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
