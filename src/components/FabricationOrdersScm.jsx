import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, FormControl, InputLabel, Checkbox, FormControlLabel,
  MenuItem, Paper, Select, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import FactoryOutlinedIcon from '@mui/icons-material/FactoryOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  obtenerColores, obtenerMaquinas, obtenerMoldes, obtenerRecetasColorMaestras,
} from '../services/api';
import {
  anularOrdenFabricacionScm,
  configurarOrdenFabricacionScm,
  liberarOrdenFabricacionScm,
  listarOrdenesFabricacionScm,
} from '../services/scmOtApi';
import {
  mensajeErrorScm,
} from '../services/scmEngineeringApi';
import PageHeader from './ui/PageHeader';
import ProcessJourney from './ui/ProcessJourney';
import EmptyState from './ui/EmptyState';
import OrderScheduleStrip from './ui/OrderScheduleStrip';
import { useScmActor } from '../context/ScmActorContext';
import ExceptionalFabricationOrderDialog from './ExceptionalFabricationOrderDialog';
import FabricationRecipeSelector from './FabricationRecipeSelector';
import DraftOrderAnnulment from './DraftOrderAnnulment';
import { defaultRecipeForRun } from './fabricationRecipeOptions';

const statusColor = {
  BORRADOR: 'warning',
  LIBERADA: 'success',
  PROGRAMADA: 'info',
  EN_EJECUCION: 'primary',
  COMPLETADA: 'success',
  CANCELADA: 'error',
};

const normalizeProcess = (value) => String(value || '').trim().toUpperCase();

const requiredPieceIds = (order) => new Set(
  (order?.corridas || []).flatMap((run) => (
    (run.salidas || [])
      .map((output) => output.articulo?.pieza_id)
      .filter((value) => value != null)
  )),
);

const compatibleMoldsForOrder = (order, molds) => {
  const pieceIds = requiredPieceIds(order);
  if (!pieceIds.size) return molds;
  return molds.filter((mold) => {
    const moldPieceIds = new Set(
      (mold.formas || [])
        .filter((shape) => shape.activo !== false)
        .map((shape) => shape.pieza_id),
    );
    return [...pieceIds].every((pieceId) => moldPieceIds.has(pieceId));
  });
};

const compatibleMachinesForOrder = (order, machines) => {
  const requiredProcess = normalizeProcess(order?.proceso_requerido);
  return machines.filter((machine) => {
    if (machine.estado !== 'OPERATIVA') return false;
    if (!requiredProcess) return true;
    const type = machine.tipo_maquina || {};
    const supported = [type.proceso, type.codigo, type.nombre, machine.tipo_legacy]
      .map(normalizeProcess);
    return supported.includes(requiredProcess);
  });
};

const formFromOrder = (order, recipes = []) => ({
  molde_id: order?.molde_id || '',
  maquina_prevista_id: order?.maquina_prevista_id || '',
  snapshot_tiempo_ciclo_seg: order?.snapshot_tiempo_ciclo_seg || '',
  snapshot_horas_turno: order?.snapshot_horas_turno || '8',
  snapshot_peso_colada_gr: order?.snapshot_peso_colada_gr ?? '',
  corridas: (order?.corridas || []).map((run) => ({
    id: run.id,
    color_produccion_id: run.color_produccion_id || '',
    receta_revision_id: run.receta_revision_id
      || defaultRecipeForRun(recipes, run, run.color_produccion_id)?.id
      || '',
    ciclos_objetivo: run.ciclos_objetivo || '',
    salidas: run.salidas.map((output) => ({
      id: output.id,
      cantidad_por_ciclo: output.cantidad_por_ciclo_snapshot || '',
      peso_unitario_g: output.peso_unitario_snapshot_g || '',
    })),
  })),
});

const suggestedForm = (order, molds, machines, recipes = []) => {
  const next = formFromOrder(order, recipes);
  if (!order || order.estado !== 'BORRADOR') return next;
  const compatibleMolds = compatibleMoldsForOrder(order, molds);
  const compatibleMachines = compatibleMachinesForOrder(order, machines);
  if (!next.molde_id && compatibleMolds.length === 1) {
    const mold = compatibleMolds[0];
    next.molde_id = mold.codigo;
    next.snapshot_tiempo_ciclo_seg = mold.tiempo_ciclo_std ?? '';
    next.snapshot_peso_colada_gr = Math.max(Number(mold.peso_colada_gr || 0), 0);
  }
  if (!next.maquina_prevista_id && compatibleMachines.length === 1) {
    next.maquina_prevista_id = compatibleMachines[0].id;
  }
  return next;
};

export default function FabricationOrdersScm() {
  const [searchParams] = useSearchParams();
  const requestedOrderId = searchParams.get('of') || '';
  const { can, experience } = useScmActor();
  const canEdit = can('OF_EDITAR_BORRADOR');
  const canRelease = can('OF_LIBERAR');
  const canCreateExceptional = can('OF_EXCEPCIONAL_CREAR');
  const [orders, setOrders] = useState([]);
  const [showAnnulled, setShowAnnulled] = useState(false);
  const [molds, setMolds] = useState([]);
  const [machines, setMachines] = useState([]);
  const [colors, setColors] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [orderId, setOrderId] = useState('');
  const [form, setForm] = useState(formFromOrder(null));
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [exceptionalOpen, setExceptionalOpen] = useState(false);

  const selected = useMemo(
    () => orders.find((item) => item.id === orderId) || orders[0] || null,
    [orderId, orders],
  );
  const compatibleMolds = useMemo(
    () => compatibleMoldsForOrder(selected, molds),
    [selected, molds],
  );
  const compatibleMachines = useMemo(
    () => compatibleMachinesForOrder(selected, machines),
    [selected, machines],
  );
  const selectedMold = useMemo(
    () => molds.find((item) => item.codigo === form.molde_id) || null,
    [form.molde_id, molds],
  );

  const load = useCallback(async (preferredId = '', includeAnnulled = showAnnulled) => {
    setBusy(true);
    setError('');
    try {
      const [
        orderPayload, moldPayload, machinePayload, colorPayload, recipePayload,
      ] = await Promise.all([
        listarOrdenesFabricacionScm(), obtenerMoldes(), obtenerMaquinas(), obtenerColores(),
        obtenerRecetasColorMaestras(),
      ]);
      const nextOrders = (orderPayload.items || []).filter((item) => includeAnnulled || item.estado !== 'ANULADA');
      const nextId = nextOrders.some((item) => item.id === preferredId)
        ? preferredId : nextOrders[0]?.id || '';
      const nextOrder = nextOrders.find((item) => item.id === nextId) || null;
      const nextMolds = (moldPayload || []).filter((item) => item.activo);
      const nextMachines = (machinePayload || []).filter((item) => item.activo);
      setOrders(nextOrders);
      setMolds(nextMolds);
      setMachines(nextMachines);
      setColors((colorPayload || []).filter((item) => item.activo !== false));
      const nextRecipes = recipePayload?.items || [];
      setRecipes(nextRecipes);
      setOrderId(nextId);
      setForm(suggestedForm(nextOrder, nextMolds, nextMachines, nextRecipes));
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudieron cargar las OF.'));
    } finally {
      setBusy(false);
    }
  }, [showAnnulled]);

  useEffect(() => { load(requestedOrderId); }, [load, requestedOrderId]);

  const chooseOrder = (nextId) => {
    const nextOrder = orders.find((item) => item.id === nextId);
    setOrderId(nextId);
    setForm(suggestedForm(nextOrder, molds, machines, recipes));
    setError('');
    setNotice('');
  };

  const chooseMold = (moldId) => {
    const mold = molds.find((item) => item.codigo === moldId);
    setForm((current) => ({
      ...current,
      molde_id: moldId,
      snapshot_tiempo_ciclo_seg: mold?.tiempo_ciclo_std ?? '',
      snapshot_peso_colada_gr: Math.max(Number(mold?.peso_colada_gr || 0), 0),
    }));
  };

  const changeRun = (runIndex, values) => setForm((current) => ({
    ...current,
    corridas: current.corridas.map((run, index) => (
      index === runIndex ? { ...run, ...values } : run
    )),
  }));

  const changeOutput = (runIndex, outputIndex, field, value) => {
    setForm((current) => ({
      ...current,
      corridas: current.corridas.map((run, currentRunIndex) => (
        currentRunIndex !== runIndex ? run : {
          ...run,
          salidas: run.salidas.map((output, currentOutputIndex) => (
            currentOutputIndex !== outputIndex ? output : { ...output, [field]: value }
          )),
        }
      )),
    }));
  };

  const configure = async () => {
    if (!selected || !form.molde_id || !form.maquina_prevista_id) {
      setError('Selecciona molde y máquina prevista.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = {
        version: selected.version,
        molde_id: form.molde_id,
        maquina_prevista_id: Number(form.maquina_prevista_id),
        snapshot_tiempo_ciclo_seg: Number(form.snapshot_tiempo_ciclo_seg),
        snapshot_horas_turno: Number(form.snapshot_horas_turno),
        snapshot_peso_colada_gr: Number(form.snapshot_peso_colada_gr),
        corridas: form.corridas.map((run, runIndex) => ({
          id: run.id,
          color_produccion_id: run.color_produccion_id
            ? Number(run.color_produccion_id) : null,
          receta_revision_id: run.receta_revision_id
            ? Number(run.receta_revision_id) : null,
          ...(Number(run.ciclos_objetivo) > 0
            ? { ciclos_objetivo: Number(run.ciclos_objetivo) } : {}),
          salidas: run.salidas.map((output, outputIndex) => {
            const source = selected.corridas[runIndex].salidas[outputIndex];
            return {
              id: output.id,
              ...(source.articulo?.pieza_id != null ? {} : {
                cantidad_por_ciclo: Number(output.cantidad_por_ciclo),
                peso_unitario_g: Number(output.peso_unitario_g),
              }),
            };
          }),
        })),
      };
      const result = await configurarOrdenFabricacionScm(selected.id, payload);
      setNotice(`${result.codigo} configurada. Revisa los ciclos calculados antes de liberarla.`);
      await load(selected.id);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo configurar la OF.'));
    } finally {
      setBusy(false);
    }
  };

  const release = async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const result = await liberarOrdenFabricacionScm(selected.id, selected.version);
      setNotice(`${result.codigo} liberada; ya puede generar su plan de mangas y OT.`);
      await load(selected.id);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo liberar la OF.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      <PageHeader
        title="Órdenes de fabricación"
        description="Completa molde, máquina y parámetros físicos de las OF planificadas antes de liberarlas hacia OT y mangas."
        actions={(
          <Stack direction="row" spacing={1}>
            {canCreateExceptional && (
              <Button
                startIcon={<AddOutlinedIcon />}
                variant="contained"
                onClick={() => setExceptionalOpen(true)}
              >
              Nueva OF de reposición
              </Button>
            )}
            <Button startIcon={<RefreshIcon />} variant="outlined" onClick={() => load(selected?.id)}>
              Actualizar
            </Button>
          </Stack>
        )}
      />
      <ProcessJourney current="fabricacion" />
      <FormControlLabel control={<Checkbox checked={showAnnulled} disabled={busy} onChange={(event) => setShowAnnulled(event.target.checked)} />} label="Mostrar anuladas" />
      {!canEdit && !canRelease && (
        <Alert severity="info">
          Vista de consulta para {experience.label}. La configuración técnica y la liberación
          corresponden al responsable de producción.
        </Alert>
      )}
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
      <Alert severity="info">
        La cantidad requerida viene del plan. Para Pieza-Color y PT monopieza, la salida por
        ciclo y el peso neto se derivan de MoldePieza; el sistema calcula los ciclos mínimos
        y el excedente técnico.
      </Alert>

      {selected && (
        <Stack spacing={1.25}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            <FormControl sx={{ width: { xs: '100%', md: 340 }, minWidth: 0 }}>
              <InputLabel>Orden de fabricación</InputLabel>
              <Select
                label="Orden de fabricación"
                value={selected.id}
                onChange={(event) => chooseOrder(event.target.value)}
              >
                {orders.map((order) => (
                  <MenuItem key={order.id} value={order.id}>
                    {order.codigo} · {order.estado} · {order.corridas?.[0]?.salidas?.[0]?.articulo?.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <>
              <Chip label={selected.estado} color={statusColor[selected.estado] || 'default'} />
              <DraftOrderAnnulment key={selected.id} order={selected} allowed={can('OF_ANULAR')} disabled={busy}
                onSubmit={anularOrdenFabricacionScm} onSuccess={async () => {
                  setShowAnnulled(true);
                  setNotice(`${selected.codigo} anulada. Se conserva el historial.`);
                  await load(selected.id, true);
                }} />
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                {selected.plan_produccion_id
                  ? `Generada por plan · propuesta ${selected.propuesta_clave}`
                  : `Origen ${selected.origen_demanda}`}
              </Typography>
              {canRelease && (
                <Button
                  color="success"
                  variant="contained"
                  startIcon={<PlayArrowOutlinedIcon />}
                  disabled={busy || selected.estado !== 'BORRADOR' || !selected.molde_id}
                  onClick={release}
                >
                  Liberar OF
                </Button>
              )}
            </>
          </Stack>
        </Paper>
        <OrderScheduleStrip order={selected} />
        {selected.estado === 'BORRADOR' ? (
          <Alert severity="warning">
            La OPM todavía no debe existir. Primero guarda y libera esta OF; luego la corrida
            aparecerá en Materiales → Preparaciones para generar su necesidad.
          </Alert>
        ) : (
          <Alert
            severity="info"
            action={(
              <Button component={RouterLink} to="/materiales/preparaciones" color="inherit">
                Abrir preparaciones
              </Button>
            )}
          >
            OF liberada: continúa en Preparaciones para generar o revisar la necesidad de material.
          </Alert>
        )}
        </Stack>
      )}

      {busy && <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}><CircularProgress /></Box>}
      {!busy && !error && !selected && (
        <EmptyState
          icon={<FactoryOutlinedIcon />}
          title="Aún no hay órdenes de fabricación"
          description="Las OF aparecen aquí cuando una OP aprobada confirma su plan y requiere fabricación. Empieza revisando la demanda y la cobertura."
          action={(can('OP_VER') || can('PLANIFICACION_CALCULAR')) ? (
            <Button
              component={RouterLink}
              to="/planificacion"
              variant="contained"
              endIcon={<ArrowForwardOutlinedIcon />}
            >
              Ir a Planificación
            </Button>
          ) : null}
        />
      )}

      {!busy && selected && (
        <>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography fontWeight={800} sx={{ mb: 2 }}>Configuración del recurso</Typography>
            {selected.estado === 'BORRADOR' && (
              <Alert
                severity={compatibleMolds.length && compatibleMachines.length ? 'info' : 'error'}
                sx={{ mb: 2 }}
              >
                {compatibleMolds.length && compatibleMachines.length
                  ? `Solo se muestran recursos operativos compatibles con ${selected.proceso_requerido || 'la operación'}. Cuando existe una sola alternativa, se propone sin guardar ni liberar automáticamente la OF.`
                  : 'No existe un molde y una máquina operativa compatibles. Corrige los maestros antes de configurar la OF.'}
              </Alert>
            )}
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'minmax(220px, 2.2fr) minmax(200px, 2fr) minmax(105px, .8fr) minmax(105px, .8fr) minmax(185px, 1.3fr)',
              },
              gap: 2,
            }}>
              <FormControl>
                <InputLabel>Molde</InputLabel>
                <Select
                  label="Molde"
                  value={form.molde_id}
                  disabled={!canEdit || selected.estado !== 'BORRADOR'}
                  onChange={(event) => chooseMold(event.target.value)}
                  renderValue={(value) => {
                    const mold = compatibleMolds.find((item) => item.codigo === value);
                    return mold ? (
                      <Box title={`${mold.codigo} · ${mold.nombre}`} sx={{ minWidth: 0 }}>
                        <Typography noWrap fontWeight={750}>{mold.codigo}</Typography>
                        <Typography noWrap variant="caption" color="text.secondary">
                          {mold.nombre}
                        </Typography>
                      </Box>
                    ) : value;
                  }}
                  sx={{ '& .MuiSelect-select': { py: 1 } }}
                >
                  {compatibleMolds.map((mold) => (
                    <MenuItem key={mold.codigo} value={mold.codigo}>
                      {mold.codigo} · {mold.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <InputLabel>Máquina prevista</InputLabel>
                <Select
                  label="Máquina prevista"
                  value={form.maquina_prevista_id}
                  disabled={!canEdit || selected.estado !== 'BORRADOR'}
                  onChange={(event) => setForm({
                    ...form, maquina_prevista_id: event.target.value,
                  })}
                  renderValue={(value) => {
                    const machine = compatibleMachines.find((item) => item.id === value);
                    return machine ? (
                      <Box title={`${machine.codigo} · ${machine.nombre}`} sx={{ minWidth: 0 }}>
                        <Typography noWrap fontWeight={750}>{machine.codigo}</Typography>
                        <Typography noWrap variant="caption" color="text.secondary">
                          {machine.nombre}
                        </Typography>
                      </Box>
                    ) : value;
                  }}
                  sx={{ '& .MuiSelect-select': { py: 1 } }}
                >
                  {compatibleMachines.map((machine) => (
                    <MenuItem key={machine.id} value={machine.id}>
                      {machine.codigo} · {machine.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                type="number"
                label="Ciclo estándar (s)"
                value={form.snapshot_tiempo_ciclo_seg}
                slotProps={{ htmlInput: { min: 0.001, max: 9999, step: 0.001 } }}
                disabled={!canEdit || selected.estado !== 'BORRADOR'}
                onChange={(event) => setForm({
                  ...form, snapshot_tiempo_ciclo_seg: event.target.value,
                })}
              />
              <TextField
                type="number"
                label="Horas efectivas"
                value={form.snapshot_horas_turno}
                slotProps={{ htmlInput: { min: 0.001, max: 24, step: 0.25 } }}
                disabled={!canEdit || selected.estado !== 'BORRADOR'}
                onChange={(event) => setForm({
                  ...form, snapshot_horas_turno: event.target.value,
                })}
              />
              <TextField
                type="number"
                label="Material no neto/ciclo (g)"
                value={form.snapshot_peso_colada_gr}
                helperText="Canal, bebedero y rebaba; no incluye las piezas."
                slotProps={{ htmlInput: { min: 0, max: 99999, step: 0.1 } }}
                disabled={!canEdit || selected.estado !== 'BORRADOR'}
                onChange={(event) => setForm({
                  ...form, snapshot_peso_colada_gr: event.target.value,
                })}
              />
              {selectedMold && (
                <Alert severity="info" sx={{ gridColumn: '1 / -1' }}>
                  Maestro {selectedMold.codigo}: {selectedMold.cavidades_totales || 0} cavidad(es),{' '}
                  {Number(selectedMold.peso_neto_gr || 0).toFixed(1)} g netos/ciclo y{' '}
                  {Number(selectedMold.peso_tiro_gr || 0).toFixed(1)} g totales/ciclo. La diferencia de{' '}
                  {Math.max(
                    Number(selectedMold.peso_tiro_gr || 0)
                    - Number(selectedMold.peso_neto_gr || 0), 0,
                  ).toFixed(1)} g es material no neto.
                </Alert>
              )}
            </Box>
          </Paper>

          {selected.corridas.map((run, runIndex) => (
            <Paper key={run.id} variant="outlined">
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1}
                alignItems={{ md: 'center' }}
                sx={{ p: 2 }}
              >
                <Typography fontWeight={800} sx={{ flex: 1 }}>
                  {run.codigo}
                </Typography>
                <FormControl size="small" sx={{ minWidth: 230 }}>
                  <InputLabel>Color de producción</InputLabel>
                  <Select
                    label="Color de producción"
                    value={form.corridas[runIndex]?.color_produccion_id || ''}
                    disabled={
                      !canEdit
                      || selected.estado !== 'BORRADOR'
                      || run.salidas.some((output) => output.articulo?.clase === 'PIEZA_COLOR')
                    }
                    onChange={(event) => changeRun(runIndex, {
                      color_produccion_id: event.target.value,
                      receta_revision_id: defaultRecipeForRun(
                        recipes,
                        run,
                        event.target.value,
                      )?.id || '',
                    })}
                  >
                    {colors.map((color) => (
                      <MenuItem key={color.id} value={color.id}>
                        {color.nombre || color.color_base_nombre || `Color ${color.id}`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  type="number"
                  label="Ciclos (vacío = mínimo)"
                  value={form.corridas[runIndex]?.ciclos_objetivo || ''}
                  disabled={!canEdit || selected.estado !== 'BORRADOR'}
                  onChange={(event) => changeRun(runIndex, {
                    ciclos_objetivo: event.target.value,
                  })}
                  sx={{ width: 210 }}
                />
              </Stack>
              <FabricationRecipeSelector
                idPrefix={`of-${selected.id}-run-${run.id}`}
                run={run}
                colorId={form.corridas[runIndex]?.color_produccion_id}
                recipes={recipes}
                value={form.corridas[runIndex]?.receta_revision_id}
                frozenRecipe={run.receta}
                editable={canEdit && selected.estado === 'BORRADOR'}
                onChange={(recipeId) => changeRun(runIndex, {
                  receta_revision_id: recipeId,
                })}
              />
              <TableContainer>
                <Table size="small">
                  <TableHead><TableRow>
                    <TableCell>Salida</TableCell>
                    <TableCell>Clase</TableCell>
                    <TableCell align="right">Demanda / objetivo</TableCell>
                    <TableCell align="right">Salida por ciclo</TableCell>
                    <TableCell align="right">Peso neto por unidad (g)</TableCell>
                    <TableCell align="right">Excedente</TableCell>
                  </TableRow></TableHead>
                  <TableBody>{run.salidas.map((output, outputIndex) => {
                    const derived = output.articulo?.pieza_id != null;
                    const moldShape = (selectedMold?.formas || []).find(
                      (shape) => shape.activo !== false
                        && shape.pieza_id === output.articulo?.pieza_id,
                    );
                    const derivedPerCycle = output.cantidad_por_ciclo_snapshot
                      || moldShape?.cavidades;
                    const derivedUnitWeight = output.peso_unitario_snapshot_g
                      || moldShape?.peso_unitario_gr;
                    const outputForm = form.corridas[runIndex]?.salidas[outputIndex] || {};
                    return (
                      <TableRow key={output.id}>
                        <TableCell>
                          {output.articulo?.nombre}
                          <br /><Typography variant="caption">{output.articulo?.codigo}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={derived
                              ? `${output.articulo?.clase === 'PRODUCTO_TERMINADO' ? 'PT monopieza' : 'Pieza-Color'} · derivado`
                              : output.articulo?.clase}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">{output.cantidad_objetivo} un</TableCell>
                        <TableCell align="right">
                          {derived ? (
                            <Stack spacing={0} alignItems="flex-end">
                              <Typography fontWeight={800}>{derivedPerCycle || 'Del molde'}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {output.articulo?.derivacion_molde === 'PT_MONOPIEZA'
                                  ? 'Componente único del PT' : 'Cavidades activas'}
                              </Typography>
                            </Stack>
                          ) : (
                            <TextField
                              size="small"
                              type="number"
                              value={outputForm.cantidad_por_ciclo}
                              disabled={!canEdit || selected.estado !== 'BORRADOR'}
                              onChange={(event) => changeOutput(
                                runIndex, outputIndex, 'cantidad_por_ciclo', event.target.value,
                              )}
                              sx={{ width: 110 }}
                            />
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {derived ? (
                            <Stack spacing={0} alignItems="flex-end">
                              <Typography fontWeight={800}>{derivedUnitWeight || 'Del molde'}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                Neto de una unidad
                              </Typography>
                            </Stack>
                          ) : (
                            <TextField
                              size="small"
                              type="number"
                              value={outputForm.peso_unitario_g}
                              disabled={!canEdit || selected.estado !== 'BORRADOR'}
                              onChange={(event) => changeOutput(
                                runIndex, outputIndex, 'peso_unitario_g', event.target.value,
                              )}
                              sx={{ width: 110 }}
                            />
                          )}
                        </TableCell>
                        <TableCell align="right">{output.excedente_objetivo} un</TableCell>
                      </TableRow>
                    );
                  })}</TableBody>
                </Table>
              </TableContainer>
            </Paper>
          ))}

          {canEdit && selected.estado === 'BORRADOR' && (
            <Stack direction="row" justifyContent="flex-end">
              <Button variant="contained" disabled={busy} onClick={configure}>
                Guardar configuración técnica
              </Button>
            </Stack>
          )}
        </>
      )}

      <ExceptionalFabricationOrderDialog
        open={exceptionalOpen}
        molds={molds}
        machines={machines.filter((machine) => machine.estado === 'OPERATIVA')}
        colors={colors}
        recipes={recipes}
        onClose={() => setExceptionalOpen(false)}
        onCreated={async (created) => {
          setExceptionalOpen(false);
            setNotice(`${created.codigo} creada como reposición en borrador. Revísala y libérala para continuar con OT y mangas.`);
          await load(created.id);
        }}
      />
    </Stack>
  );
}
