import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Paper,
  Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddTaskOutlinedIcon from '@mui/icons-material/AddTaskOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  listarOrdenesArmadoScm,
  transicionarOrdenArmadoScm,
} from '../services/scmAssemblyApi';
import {
  mensajeErrorScm,
  listarCentrosTrabajoScm,
} from '../services/scmEngineeringApi';
import { getTrabajadores } from '../services/api';
import {
  crearOtArmadoScm,
  crearSolicitudAbastecimientoScm,
  asignarMangasSalidaArmadoScm,
  aprobarCorreccionMangaArmadoScm,
  cerrarMangaArmadoScm,
  listarOtArmadoScm,
  listarSolicitudesAbastecimientoScm,
  obtenerGenealogiaMangaScm,
  obtenerPlanMangasArmadoScm,
  recalcularPlanMangasArmadoScm,
  solicitarCorreccionMangaArmadoScm,
} from '../services/scmInternalSupplyApi';
import {
  cambiarEstadoOtScm,
  generarEtiquetasPrepesaje,
  listarOtScm,
} from '../services/scmOtApi';
import PageHeader from './ui/PageHeader';
import ProcessJourney from './ui/ProcessJourney';
import EmptyState from './ui/EmptyState';
import OrderScheduleStrip from './ui/OrderScheduleStrip';
import ExceptionalAssemblyOrderDialog from './ExceptionalAssemblyOrderDialog';
import { useScmActor } from '../context/ScmActorContext';
import { todayInLima } from '../utils/limaDate';

const actions = {
  BORRADOR: { action: 'liberar', label: 'Liberar OA', color: 'success' },
  LIBERADA: { action: 'iniciar', label: 'Iniciar armado', color: 'primary' },
  EN_EJECUCION: { action: 'cerrar', label: 'Cerrar armado', color: 'success' },
};
const OPERATION_TYPE_LABEL = {
  ENSAMBLE: 'ARMADO',
};
const assemblyModeLabel = (value) => (
  value === 'CONCURRENTE' ? 'Concurrente con fabricación' : 'En mesa de armado'
);
const colorWorkOutputsLabel = (work) => (work?.articulos_salida || [])
  .map((article) => `${article.codigo} · ${article.nombre}`)
  .join(', ');

export default function AssemblyOrdersScm() {
  const { can, experience } = useScmActor();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedOrderId = searchParams.get('oa') || '';
  const requestedOtId = searchParams.get('ot') || '';
  const requestedJourneyDate = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('fecha') || '')
    ? searchParams.get('fecha')
    : todayInLima();
  const requestedJourneyShift = ['DIA', 'NOCHE', 'EXTRA'].includes(
    String(searchParams.get('turno') || '').toUpperCase(),
  ) ? String(searchParams.get('turno')).toUpperCase() : 'DIA';
  const canRelease = can('OA_LIBERAR');
  const canExecute = can('OA_EJECUTAR');
  const canCreateOt = can('OT_CREAR');
  const canViewOt = can('OT_VER');
  const canCreateExceptionalOrder = can('OA_EXCEPCIONAL_CREAR');
  const [orders, setOrders] = useState([]);
  const [orderId, setOrderId] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [closeOpen, setCloseOpen] = useState(false);
  const [otOpen, setOtOpen] = useState(false);
  const [exceptionalOrderOpen, setExceptionalOrderOpen] = useState(false);
  const [ots, setOts] = useState([]);
  const [fabricationOts, setFabricationOts] = useState([]);
  const [centers, setCenters] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [supplyRequests, setSupplyRequests] = useState([]);
  const [outputPlan, setOutputPlan] = useState(null);
  const [mangaCloseOpen, setMangaCloseOpen] = useState(false);
  const [mangaToClose, setMangaToClose] = useState(null);
  const [mangaCloseForm, setMangaCloseForm] = useState({
    cantidad_real: '', motivo_diferencia: '',
  });
  const [genealogyOpen, setGenealogyOpen] = useState(false);
  const [genealogy, setGenealogy] = useState(null);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionManga, setCorrectionManga] = useState(null);
  const [correctionForm, setCorrectionForm] = useState({ cantidad_propuesta: '', motivo: '' });
  const [approvalReason, setApprovalReason] = useState('');
  const [otForm, setOtForm] = useState({
    fecha_operativa: requestedJourneyDate,
    turno: requestedJourneyShift,
    centro_trabajo_id: '',
    responsable_id: '',
    cantidad_objetivo: '',
    modo_ejecucion: 'MESA',
    ot_fabricacion_contexto_id: '',
    trabajo_color_contexto_id: '',
  });
  const [closeForm, setCloseForm] = useState({
    cantidad_real: '', cantidad_rechazada: '0', motivo: '',
  });

  const selected = useMemo(
    () => orders.find((item) => item.id === orderId) || orders[0] || null,
    [orderId, orders],
  );
  const journeysReturnPath = useMemo(() => {
    const params = new URLSearchParams();
    ['fecha', 'turno', 'modo', 'ot'].forEach((key) => {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    });
    if (!params.has('modo')) params.set('modo', 'armado');
    const query = params.toString();
    return `/produccion/ots-planta${query ? `?${query}` : ''}`;
  }, [searchParams]);

  const load = useCallback(async (preferredId = '') => {
    setBusy(true);
    setError('');
    try {
      const payload = await listarOrdenesArmadoScm();
      const items = payload.items || [];
      const nextId = items.some((item) => item.id === preferredId)
        ? preferredId : items[0]?.id || '';
      setOrders(items);
      setOrderId(nextId);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudieron cargar las OA.'));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { load(requestedOrderId); }, [load, requestedOrderId]);

  const chooseOrder = (nextOrderId) => {
    setOrderId(nextOrderId);
    setFabricationOts([]);
    setOtForm((current) => ({
      ...current,
      modo_ejecucion: 'MESA',
      ot_fabricacion_contexto_id: '',
      trabajo_color_contexto_id: '',
      centro_trabajo_id: '',
      responsable_id: '',
      cantidad_objetivo: '',
    }));
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('oa', nextOrderId);
      next.delete('ot');
      return next;
    }, { replace: true });
  };

  const refreshOts = useCallback(async (order = selected) => {
    if (!order) return;
    const [otPayload, requestPayload, planPayload] = await Promise.all([
      canViewOt ? listarOtArmadoScm(order.id) : Promise.resolve({ items: [] }),
      can('ABASTECIMIENTO_VER')
        ? listarSolicitudesAbastecimientoScm()
        : Promise.resolve({ items: [] }),
      can('PLAN_MANGA_VER')
        ? obtenerPlanMangasArmadoScm(order.id)
        : Promise.resolve({ plan: null }),
    ]);
    setOts(otPayload.items || []);
    setSupplyRequests(requestPayload.items || []);
    setOutputPlan(planPayload.plan || null);
  }, [can, canViewOt, selected]);

  useEffect(() => {
    if (!selected?.id) {
      setOts([]);
      setOutputPlan(null);
      return undefined;
    }
    let active = true;
    Promise.all([
      canViewOt ? listarOtArmadoScm(selected.id) : Promise.resolve({ items: [] }),
      canCreateOt ? listarCentrosTrabajoScm() : Promise.resolve([]),
      canCreateOt
        ? getTrabajadores({ incluir_inactivos: false })
        : Promise.resolve([]),
      can('ABASTECIMIENTO_VER')
        ? listarSolicitudesAbastecimientoScm()
        : Promise.resolve({ items: [] }),
      can('PLAN_MANGA_VER')
        ? obtenerPlanMangasArmadoScm(selected.id)
        : Promise.resolve({ plan: null }),
    ]).then(([
      otPayload, centerItems, workerItems, requestPayload, planPayload,
    ]) => {
      if (!active) return;
      const validCenters = centerItems.filter((center) => (
        center.activo && ['PREARMADO', 'ENSAMBLE', 'ACABADO', 'EMPAQUE'].includes(center.tipo)
      ));
      setOts(otPayload.items || []);
      setCenters(validCenters);
      setWorkers((workerItems || []).filter((worker) => worker.activo));
      setSupplyRequests(requestPayload.items || []);
      setOutputPlan(planPayload.plan || null);
      setOtForm((current) => ({
        ...current,
        centro_trabajo_id: current.centro_trabajo_id
          || selected.operacion.centro_trabajo_id || validCenters[0]?.id || '',
        responsable_id: current.responsable_id || workerItems?.[0]?.id || '',
        cantidad_objetivo: current.cantidad_objetivo || selected.salida.cantidad_objetivo,
      }));
    }).catch((requestError) => {
      if (active) setError(mensajeErrorScm(requestError, 'No se pudieron cargar las OT de Armado.'));
    });
    return () => { active = false; };
  }, [can, canCreateOt, canViewOt, selected]);

  useEffect(() => {
    if (!otOpen || !otForm.fecha_operativa) return undefined;
    let active = true;
    listarOtScm(undefined, 'FABRICACION', {
      fecha_operativa: otForm.fecha_operativa,
    }).then((payload) => {
      if (!active) return;
      setFabricationOts((payload.items || []).filter((item) => (
        ['PLANIFICADA', 'EN_EJECUCION'].includes(item.estado)
      )));
    }).catch((requestError) => {
      if (!active) return;
      setFabricationOts([]);
      setError(mensajeErrorScm(
        requestError,
        'No se pudieron consultar las OT de fabricación de la fecha seleccionada.',
      ));
    });
    return () => { active = false; };
  }, [otForm.fecha_operativa, otOpen]);

  const createOt = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await crearOtArmadoScm(selected.id, {
        ...otForm,
        ot_fabricacion_contexto_id: otForm.modo_ejecucion === 'CONCURRENTE'
          ? otForm.ot_fabricacion_contexto_id : null,
        trabajo_color_contexto_id: otForm.modo_ejecucion === 'CONCURRENTE'
          ? otForm.trabajo_color_contexto_id || null : null,
        centro_trabajo_id: Number(otForm.centro_trabajo_id),
        responsable_id: Number(otForm.responsable_id),
        cantidad_objetivo: Number(otForm.cantidad_objetivo),
      });
      setNotice(`${result.ot.codigo_ot} creada para ${result.ot.fecha_operativa}.`);
      setOtOpen(false);
      await refreshOts();
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo crear la OT de Armado.'));
    } finally {
      setBusy(false);
    }
  };

  const requestSupply = async (ot) => {
    setBusy(true);
    setError('');
    try {
      const result = await crearSolicitudAbastecimientoScm(ot.public_id);
      setNotice(`${result.solicitud.codigo} creada desde la BOM y la cuota diaria.`);
      await refreshOts();
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo solicitar el abastecimiento.'));
    } finally {
      setBusy(false);
    }
  };

  const planOutputMangas = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await recalcularPlanMangasArmadoScm(selected.id);
      setOutputPlan(result.plan);
      setNotice(`Plan de mangas de salida revisión ${result.plan.revision} calculado.`);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo calcular el plan de mangas de salida.'));
    } finally {
      setBusy(false);
    }
  };

  const assignOutputMangas = async (ot) => {
    setBusy(true);
    setError('');
    try {
      const result = await asignarMangasSalidaArmadoScm(ot);
      const outputLabel = selected?.salida?.clase === 'SUBENSAMBLE_WIP'
        ? 'WIP'
        : 'producto terminado';
      setNotice(`${result.mangas.length} manga(s) de ${outputLabel} asignada(s) a ${ot.codigo_ot}.`);
      await refreshOts();
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudieron asignar las mangas de salida.'));
    } finally {
      setBusy(false);
    }
  };

  const prelabelManga = async (manga) => {
    setBusy(true);
    setError('');
    try {
      await generarEtiquetasPrepesaje([manga.public_id]);
      setNotice(`${manga.codigo}: preetiqueta enviada a la estación de pesaje.`);
      await refreshOts();
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo preparar la preetiqueta.'));
    } finally {
      setBusy(false);
    }
  };

  const startOt = async (ot) => {
    setBusy(true);
    setError('');
    try {
      const result = await cambiarEstadoOtScm(ot.public_id, 'iniciar', ot.version);
      setNotice(`${result.ot?.codigo_ot || ot.codigo_ot} iniciada.`);
      await refreshOts();
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo iniciar la OT de Armado.'));
    } finally {
      setBusy(false);
    }
  };

  const openMangaClose = (manga) => {
    setMangaToClose(manga);
    setMangaCloseForm({
      cantidad_real: manga.cantidad_planificada_un,
      motivo_diferencia: '',
    });
    setMangaCloseOpen(true);
  };

  const closeManga = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await cerrarMangaArmadoScm(mangaToClose, {
        cantidad_real: Number(mangaCloseForm.cantidad_real),
        motivo_diferencia: mangaCloseForm.motivo_diferencia || null,
      });
      setNotice(`${result.manga.codigo}: Armado cerrado; queda pendiente de pesaje.`);
      setMangaCloseOpen(false);
      await refreshOts();
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo cerrar la manga de Armado.'));
    } finally {
      setBusy(false);
    }
  };

  const showGenealogy = async (manga) => {
    setBusy(true);
    setError('');
    try {
      setGenealogy(await obtenerGenealogiaMangaScm(manga.public_id));
      setGenealogyOpen(true);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo consultar la genealogía de la manga.'));
    } finally {
      setBusy(false);
    }
  };

  const requestCorrection = async () => {
    setBusy(true);
    setError('');
    try {
      await solicitarCorreccionMangaArmadoScm(correctionManga.public_id, {
        cantidad_propuesta: Number(correctionForm.cantidad_propuesta),
        motivo: correctionForm.motivo,
      });
      setCorrectionOpen(false);
      setNotice('Corrección solicitada. Debe aprobarla otro actor autorizado antes del pesaje.');
      await load(selected?.id);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo solicitar la corrección.'));
      setBusy(false);
    }
  };

  const approveCorrection = async (correction) => {
    if (!approvalReason.trim()) {
      setError('Escribe qué evidencia revisaste antes de aprobar la corrección.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await aprobarCorreccionMangaArmadoScm(correction.id, {
        motivo_aprobacion: approvalReason.trim(),
      });
      setApprovalReason('');
      setNotice('Corrección compensatoria aplicada. La confirmación original se conservó.');
      setGenealogy(await obtenerGenealogiaMangaScm(result.manga.public_id));
      await load(selected?.id);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo aprobar la corrección.'));
      setBusy(false);
    }
  };

  const run = async (action, extra = {}) => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const result = await transicionarOrdenArmadoScm(selected, action, extra);
      setNotice(`${result.codigo}: ${result.estado}.`);
      setCloseOpen(false);
      await load(selected.id);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo actualizar la OA.'));
    } finally {
      setBusy(false);
    }
  };

  const currentAction = actions[selected?.estado];
  const canRunCurrentAction = currentAction?.action === 'liberar' ? canRelease : canExecute;
  const assignedQuota = ots.reduce(
    (total, ot) => total + (ot.estado === 'ANULADA' ? 0 : Number(ot.cantidad_objetivo || 0)),
    0,
  );
  const pendingQuota = Math.max(
    0,
    Number(selected?.salida?.cantidad_objetivo || 0) - assignedQuota,
  );
  const outputPlanLine = outputPlan?.lineas?.[0] || null;
  const outputIsWip = selected?.salida?.clase === 'SUBENSAMBLE_WIP';
  const outputTypeLabel = outputIsWip ? 'WIP' : 'producto terminado';
  const outputTypeShortLabel = outputIsWip ? 'WIP' : 'PT';
  const selectedFabricationContext = fabricationOts.find(
    (item) => item.public_id === otForm.ot_fabricacion_contexto_id,
  ) || null;
  const activeContextWorks = (selectedFabricationContext?.trabajos_color || []).filter(
    (item) => ['PLANIFICADO', 'EN_EJECUCION', 'PAUSADO'].includes(item.estado),
  );

  const openOtDialog = () => {
    setOtForm((current) => ({
      ...current,
      fecha_operativa: requestedJourneyDate,
      turno: requestedJourneyShift,
      cantidad_objetivo: pendingQuota || '',
    }));
    setOtOpen(true);
  };

  const handleExceptionalOrderCreated = (created) => {
    setNotice(`${created.codigo} creada como borrador de reposición WIP, sin OP.`);
    load(created.id);
  };

  return (
    <Stack spacing={2.5}>
      <PageHeader
        title="Órdenes de armado"
        description="Libera y ejecuta operaciones de prearmado, armado, acabado o empaque contra la BOM congelada por planificación."
        actions={(
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            {canCreateExceptionalOrder && (
              <Button
                startIcon={<AddTaskOutlinedIcon />}
                variant="contained"
                onClick={() => setExceptionalOrderOpen(true)}
              >
                Nueva OA de reposición WIP
              </Button>
            )}
            <Button component={RouterLink} to={journeysReturnPath} variant="text">
              Volver a Jornadas
            </Button>
            <Button startIcon={<RefreshIcon />} variant="outlined" onClick={() => load(selected?.id)}>
              Actualizar
            </Button>
          </Stack>
        )}
      />
      <ProcessJourney current="armado" />
      {!canRelease && !canExecute && (
        <Alert severity="info">
          Vista de consulta para {experience.label}. La liberación y el registro de ejecución
          se muestran únicamente a los responsables de producción.
        </Alert>
      )}
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
      <Alert severity="info">
        La OA define el total. Las OT reparten ese total por fecha, mesa, turno y responsable;
        cada OT genera su propia solicitud de componentes desde la BOM congelada.
      </Alert>
      {!canViewOt && (
        <Alert severity="info">
          Puedes consultar la OA, pero las jornadas requieren el permiso de consulta de OT.
        </Alert>
      )}

      {selected && (
        <Stack spacing={1.25}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            <FormControl sx={{ width: { xs: '100%', md: 360 }, minWidth: 0 }}>
              <InputLabel id="assembly-order-selector-label">Orden de armado</InputLabel>
              <Select
                labelId="assembly-order-selector-label"
                label="Orden de armado"
                value={selected.id}
                onChange={(event) => chooseOrder(event.target.value)}
              >
                {orders.map((order) => (
                  <MenuItem key={order.id} value={order.id}>
                    {order.codigo} · {order.estado} · {order.salida.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <>
              <Chip label={selected.estado} />
              {selected.origen_demanda === 'REPOSICION_WIP' && (
                <Chip color="info" variant="outlined" label="Reposición WIP · sin OP" />
              )}
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                {OPERATION_TYPE_LABEL[selected.operacion.tipo] || selected.operacion.tipo}
                {' · '}
                {selected.operacion.centro_trabajo}
              </Typography>
              {currentAction && canRunCurrentAction && (
                <Button
                  variant="contained"
                  color={currentAction.color}
                  disabled={busy || (currentAction.action === 'cerrar' && ots.length > 0)}
                  onClick={() => (
                    currentAction.action === 'cerrar'
                      ? setCloseOpen(true)
                      : run(currentAction.action)
                  )}
                >
                  {currentAction.label}
                </Button>
              )}
            </>
          </Stack>
        </Paper>
        <OrderScheduleStrip order={selected} />
        </Stack>
      )}

      {busy && <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}><CircularProgress /></Box>}
      {!busy && !error && !selected && (
        <EmptyState
          icon={<AccountTreeOutlinedIcon />}
          title="Aún no hay órdenes de armado"
          description="Las OA aparecen cuando la planificación confirma una necesidad o una jefatura crea una reposición WIP gobernada."
          action={can('OP_VER') ? (
            <Button component={RouterLink} to="/planificacion" variant="contained">
              Ir a Planificación
            </Button>
          ) : null}
        />
      )}

      {!busy && selected && (
        <>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="overline" color="text.secondary">Salida objetivo</Typography>
                <Typography variant="h6">{selected.salida.nombre}</Typography>
                <Typography color="text.secondary">{selected.salida.codigo}</Typography>
              </Box>
              <Box>
                <Typography variant="overline" color="text.secondary">Plan</Typography>
                <Typography fontWeight={800}>{selected.salida.cantidad_objetivo} un</Typography>
              </Box>
              <Box>
                <Typography variant="overline" color="text.secondary">Conforme</Typography>
                <Typography fontWeight={800}>{selected.salida.cantidad_real ?? '—'}</Typography>
              </Box>
              <Box>
                <Typography variant="overline" color="text.secondary">Rechazado</Typography>
                <Typography fontWeight={800}>{selected.salida.cantidad_rechazada ?? '—'}</Typography>
              </Box>
            </Stack>
          </Paper>

          <Paper variant="outlined">
            <Typography fontWeight={800} sx={{ p: 2 }}>Entradas teóricas de la BOM</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>Artículo componente</TableCell>
                  <TableCell>Clase</TableCell>
                  <TableCell align="right">Por salida</TableCell>
                  <TableCell align="right">Merma</TableCell>
                  <TableCell align="right">Requerido</TableCell>
                </TableRow></TableHead>
                <TableBody>{selected.entradas_planificadas.map((input) => (
                  <TableRow key={input.articulo_scm_id}>
                    <TableCell>{input.articulo.nombre}<br /><Typography variant="caption">{input.articulo.codigo}</Typography></TableCell>
                    <TableCell>{input.articulo.clase}</TableCell>
                    <TableCell align="right">{input.cantidad_por_salida}</TableCell>
                    <TableCell align="right">{input.merma_tecnica_pct}%</TableCell>
                    <TableCell align="right">{input.cantidad_planificada} un</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              alignItems={{ md: 'center' }}
              justifyContent="space-between"
            >
              <Box>
                <Typography fontWeight={800}>Mangas de {outputTypeLabel}</Typography>
                {outputPlanLine ? (
                  <Typography variant="body2" color="text.secondary">
                    Revisión {outputPlan.revision} · {outputPlanLine.mangas_propuestas} manga(s)
                    {' · '}capacidad {outputPlanLine.capacidad_efectiva_un} un
                    {' · '}saldo sin asignar {outputPlanLine.saldo_un} un
                  </Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Calcula cuántas bolsas {outputTypeShortLabel} necesita la OA antes de
                    repartirlas entre las jornadas.
                  </Typography>
                )}
              </Box>
              {can('ENSAMBLE_PLANIFICAR') && ['LIBERADA', 'EN_EJECUCION'].includes(selected.estado) && (
                <Button
                  variant={outputPlanLine ? 'outlined' : 'contained'}
                  startIcon={<Inventory2OutlinedIcon />}
                  disabled={busy || Boolean(outputPlanLine && Number(outputPlanLine.cantidad_asignada_un) > 0)}
                  onClick={planOutputMangas}
                >
                  {outputPlanLine ? 'Recalcular plan' : 'Planificar mangas de salida'}
                </Button>
              )}
            </Stack>
            {!outputPlanLine && (
              <Alert
                severity="warning"
                sx={{ mt: 2 }}
                action={can('EMPAQUE_VER') ? (
                  <Button
                    size="small"
                    component={RouterLink}
                    to="/datos-maestros/ingenieria-scm?tab=empaque"
                  >
                    Configurar empaque
                  </Button>
                ) : null}
              >
                Aún no existe un plan activo. Si el cálculo informa que falta un perfil de
                empaque, configúralo antes de crear o preimprimir mangas {outputTypeShortLabel}.
              </Alert>
            )}
          </Paper>

          <Paper variant="outlined">
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.5}
              alignItems={{ md: 'center' }}
              justifyContent="space-between"
              sx={{ p: 2 }}
            >
              <Box>
                <Typography fontWeight={800}>OT diarias de Armado</Typography>
                <Typography variant="body2" color="text.secondary">
                  {assignedQuota.toFixed(3)} de {selected.salida.cantidad_objetivo} un asignadas
                  {' · '}{pendingQuota.toFixed(3)} un pendientes
                </Typography>
              </Box>
              {canCreateOt && ['LIBERADA', 'EN_EJECUCION'].includes(selected.estado) && (
                <Button
                  variant="contained"
                  startIcon={<AddTaskOutlinedIcon />}
                  disabled={busy || pendingQuota <= 0}
                  onClick={openOtDialog}
                >
                  Crear OT diaria
                </Button>
              )}
            </Stack>
            {!ots.length ? (
              <Alert severity="info" sx={{ m: 2, mt: 0 }}>
                Aún no se distribuyó el trabajo de esta OA. Crea la primera OT diaria para
                solicitar las mangas que llegarán a la mesa.
              </Alert>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead><TableRow>
                    <TableCell>OT / jornada</TableCell>
                    <TableCell>Centro, modalidad y responsable</TableCell>
                    <TableCell align="right">Cuota</TableCell>
                    <TableCell>Abastecimiento</TableCell>
                    <TableCell align="right">Siguiente acción</TableCell>
                  </TableRow></TableHead>
                  <TableBody>{ots.map((ot) => {
                    const request = supplyRequests.find(
                      (item) => item.orden_trabajo?.public_id === ot.public_id,
                    );
                    const mangas = ot.mangas || [];
                    return (
                      <Fragment key={ot.public_id}>
                        <TableRow
                          data-testid={`assembly-ot-${ot.public_id}`}
                          aria-current={requestedOtId === ot.public_id ? 'true' : undefined}
                          sx={requestedOtId === ot.public_id ? { bgcolor: 'action.selected' } : undefined}
                        >
                          <TableCell>
                            <Typography fontWeight={750}>{ot.codigo_ot}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {ot.fecha_operativa} · {ot.turno} · {ot.estado}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {ot.centro_trabajo?.nombre || 'Sin mesa'}<br />
                            <Typography variant="caption" display="block">
                              {assemblyModeLabel(ot.modo_ejecucion_armado || ot.modo_ejecucion_ensamble)}
                            </Typography>
                            {ot.ot_fabricacion_contexto && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                {ot.ot_fabricacion_contexto.codigo_ot}
                                {ot.ot_fabricacion_contexto.maquina
                                  ? ` · ${ot.ot_fabricacion_contexto.maquina}` : ''}
                                {ot.trabajo_color_contexto?.color
                                  ? ` · ${ot.trabajo_color_contexto.color}` : ''}
                              </Typography>
                            )}
                            <Typography variant="caption">
                              Responsable: {ot.responsable || 'Sin responsable'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            {ot.cantidad_confirmada || 0} / {ot.cantidad_objetivo} un
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              color={request?.estado === 'RECIBIDA' ? 'success' : 'default'}
                              label={request ? `${request.codigo} · ${request.estado}` : 'Sin solicitar'}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
                              {!request && can('ABASTECIMIENTO_SOLICITAR') && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<LocalShippingOutlinedIcon />}
                                  disabled={busy}
                                  onClick={() => requestSupply(ot)}
                                >
                                  Solicitar componentes
                                </Button>
                              )}
                              {request && can('ABASTECIMIENTO_VER') && request.estado !== 'RECIBIDA' && (
                                <Button
                                  size="small"
                                  component={RouterLink}
                                  to={`/produccion/abastecimiento?solicitud=${request.id}`}
                                >
                                  Seguir abastecimiento
                                </Button>
                              )}
                              {!mangas.length && outputPlanLine && can('ENSAMBLE_PLANIFICAR') && (
                                <Button
                                  size="small"
                                  variant="contained"
                                  startIcon={<Inventory2OutlinedIcon />}
                                  disabled={busy}
                                  onClick={() => assignOutputMangas(ot)}
                                >
                                  Asignar mangas {outputTypeShortLabel}
                                </Button>
                              )}
                            </Stack>
                          </TableCell>
                        </TableRow>
                        {mangas.length > 0 && (
                          <TableRow>
                            <TableCell colSpan={5} sx={{ bgcolor: 'grey.50', py: 1.5 }}>
                              <Stack spacing={1}>
                                {mangas.map((manga) => {
                                  const readyToClose = (
                                    ot.estado === 'EN_EJECUCION'
                                    && request?.estado === 'RECIBIDA'
                                    && ['PREETIQUETADA', 'EN_ARMADO'].includes(manga.estado)
                                  );
                                  return (
                                    <Stack
                                      key={manga.public_id}
                                      direction={{ xs: 'column', lg: 'row' }}
                                      spacing={1}
                                      alignItems={{ lg: 'center' }}
                                      justifyContent="space-between"
                                      sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, p: 1.25, bgcolor: 'background.paper' }}
                                    >
                                      <Box>
                                        <Typography fontWeight={750}>{manga.codigo}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                          {manga.cantidad_confirmada_un ?? manga.cantidad_planificada_un} un
                                          {' · '}{manga.estado}
                                        </Typography>
                                      </Box>
                                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                        {manga.estado === 'PLANIFICADA' && can('MANGA_ETIQUETA_PRE_GENERAR') && (
                                          <Button
                                            size="small"
                                            startIcon={<PrintOutlinedIcon />}
                                            disabled={busy}
                                            onClick={() => prelabelManga(manga)}
                                          >
                                            Preparar sticker
                                          </Button>
                                        )}
                                        {ot.estado === 'PLANIFICADA' && manga.estado === 'PREETIQUETADA' && can('OT_INICIAR') && (
                                          <Button size="small" variant="outlined" disabled={busy} onClick={() => startOt(ot)}>
                                            Iniciar jornada
                                          </Button>
                                        )}
                                        {readyToClose && can('ENSAMBLE_MANGA_CERRAR') && (
                                          <Button size="small" variant="contained" disabled={busy} onClick={() => openMangaClose(manga)}>
                                            Confirmar armado
                                          </Button>
                                        )}
                                        {manga.estado === 'CERRADA_ARMADO_PENDIENTE_PESAJE' && (
                                          <>
                                            <Chip size="small" color="warning" label="Pendiente de pesaje" />
                                            {can('ENSAMBLE_CORREGIR_SOLICITAR') && (
                                              <Button
                                                size="small"
                                                onClick={() => {
                                                  setCorrectionManga(manga);
                                                  setCorrectionForm({
                                                    cantidad_propuesta: manga.cantidad_confirmada_un,
                                                    motivo: '',
                                                  });
                                                  setCorrectionOpen(true);
                                                }}
                                              >
                                                Solicitar corrección
                                              </Button>
                                            )}
                                          </>
                                        )}
                                        {manga.estado === 'PESADA' && <Chip size="small" color="success" label="Pesada" />}
                                        {manga.cantidad_confirmada_un != null && can('GENEALOGIA_VER') && (
                                          <Button
                                            size="small"
                                            startIcon={<AccountTreeOutlinedIcon />}
                                            onClick={() => showGenealogy(manga)}
                                          >
                                            Genealogía
                                          </Button>
                                        )}
                                      </Stack>
                                    </Stack>
                                  );
                                })}
                              </Stack>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}</TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>

          {ots.length > 0 && selected.estado === 'EN_EJECUCION' && (
            <Alert severity="warning">
              El cierre anterior de la OA está bloqueado en esta experiencia: el cierre
              trazable debe consumir las mangas asignadas y acreditar las mangas de salida
              en una sola operación de Armado.
            </Alert>
          )}

          {selected.lote_salida && (
            <Alert severity="success">
              Lote acreditado: {selected.lote_salida.codigo} · {selected.lote_salida.cantidad_acreditada} un ·
              calidad {selected.lote_salida.estado_calidad}
            </Alert>
          )}
        </>
      )}

      <Dialog open={closeOpen} onClose={() => setCloseOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Cerrar orden de armado</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="warning">
              El cierre acredita la salida; no descuenta componentes del Kardex.
            </Alert>
            <TextField
              type="number"
              label="Unidades conformes"
              value={closeForm.cantidad_real}
              onChange={(event) => setCloseForm({
                ...closeForm, cantidad_real: event.target.value,
              })}
            />
            <TextField
              type="number"
              label="Unidades rechazadas"
              value={closeForm.cantidad_rechazada}
              onChange={(event) => setCloseForm({
                ...closeForm, cantidad_rechazada: event.target.value,
              })}
            />
            <TextField
              label="Observación"
              multiline
              minRows={2}
              value={closeForm.motivo}
              onChange={(event) => setCloseForm({
                ...closeForm, motivo: event.target.value,
              })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => run('cerrar', {
              cantidad_real: Number(closeForm.cantidad_real),
              cantidad_rechazada: Number(closeForm.cantidad_rechazada || 0),
              motivo: closeForm.motivo || null,
            })}
          >
            Confirmar cierre
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={mangaCloseOpen} onClose={() => setMangaCloseOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Confirmar manga terminada</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              El responsable confirma unidades, no procedencias. El sistema consume las mangas
              recibidas en la mesa según la BOM congelada y conserva la genealogía exacta.
            </Alert>
            <Box>
              <Typography fontWeight={800}>{mangaToClose?.codigo}</Typography>
              <Typography variant="body2" color="text.secondary">
                Plan: {mangaToClose?.cantidad_planificada_un || 0} un · después quedará pendiente de pesaje
              </Typography>
            </Box>
            <TextField
              type="number"
              label="Unidades realmente armadas"
              inputProps={{ min: 0.001, step: 0.001 }}
              value={mangaCloseForm.cantidad_real}
              onChange={(event) => setMangaCloseForm({
                ...mangaCloseForm, cantidad_real: event.target.value,
              })}
              required
            />
            <TextField
              label="Motivo de diferencia"
              multiline
              minRows={2}
              helperText="Obligatorio solo si la cantidad real difiere del plan."
              value={mangaCloseForm.motivo_diferencia}
              onChange={(event) => setMangaCloseForm({
                ...mangaCloseForm, motivo_diferencia: event.target.value,
              })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMangaCloseOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={
              busy
              || Number(mangaCloseForm.cantidad_real) <= 0
              || (
                Number(mangaCloseForm.cantidad_real) !== Number(mangaToClose?.cantidad_planificada_un)
                && !mangaCloseForm.motivo_diferencia.trim()
              )
            }
            onClick={closeManga}
          >
            Cerrar armado
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={correctionOpen} onClose={() => setCorrectionOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Solicitar corrección de cantidad</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="warning">
              No se editará el cierre original. Otro actor deberá aprobar el movimiento compensatorio
              antes de que la manga sea pesada.
            </Alert>
            <Typography fontWeight={800}>{correctionManga?.codigo}</Typography>
            <TextField
              type="number" label="Cantidad correcta" required
              value={correctionForm.cantidad_propuesta}
              onChange={(event) => setCorrectionForm({ ...correctionForm, cantidad_propuesta: event.target.value })}
            />
            <TextField
              label="Qué ocurrió y cómo se verificó" multiline minRows={3} required
              value={correctionForm.motivo}
              onChange={(event) => setCorrectionForm({ ...correctionForm, motivo: event.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCorrectionOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={busy || !correctionForm.motivo.trim() || Number(correctionForm.cantidad_propuesta) <= 0}
            onClick={requestCorrection}
          >
            Enviar a aprobación
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={genealogyOpen} onClose={() => setGenealogyOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Genealogía de {genealogy?.manga?.codigo || 'manga'}</DialogTitle>
        <DialogContent>
          {!genealogy?.confirmacion ? (
            <Alert severity="info">La manga todavía no tiene un cierre de Armado confirmado.</Alert>
          ) : (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Alert severity="success">
                {genealogy.manga.cantidad_confirmada_un} un vigentes · cierre original {genealogy.confirmacion.cantidad_real} un
              </Alert>
              <Typography variant="body2" color="text.secondary">
                BOM congelada: revisión {genealogy.confirmacion.estructura_revision_id}
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead><TableRow>
                    <TableCell>Componente incorporado</TableCell>
                    <TableCell>Manga de origen</TableCell>
                    <TableCell align="right">Cantidad</TableCell>
                  </TableRow></TableHead>
                  <TableBody>{genealogy.confirmacion.consumos.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.articulo.codigo} · {item.articulo.nombre}</TableCell>
                      <TableCell>
                        {item.nivel_genealogia === 'EXACTA'
                          ? item.manga_origen_codigo
                          : `${item.nivel_genealogia} · ${(item.candidatos || []).map((value) => value.codigo).join(', ') || 'sin origen individual'}`}
                      </TableCell>
                      <TableCell align="right">{item.cantidad_incorporada} un</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </TableContainer>
              {genealogy.correcciones?.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography fontWeight={800} gutterBottom>Correcciones compensatorias</Typography>
                  <Stack spacing={1.25}>
                    {genealogy.correcciones.map((correction) => (
                      <Box key={correction.id} sx={{ p: 1.25, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Stack direction={{ xs: 'column', md: 'row' }} gap={1} justifyContent="space-between">
                          <Box>
                            <Chip size="small" label={correction.estado} color={correction.estado === 'APLICADA' ? 'success' : 'warning'} />
                            <Typography variant="body2" sx={{ mt: 0.75 }}>
                              {correction.cantidad_anterior} → {correction.cantidad_propuesta} un · {correction.motivo}
                            </Typography>
                          </Box>
                          {correction.estado === 'PENDIENTE' && can('ENSAMBLE_CORREGIR_APROBAR') && (
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                              <TextField
                                size="small" label="Evidencia revisada"
                                value={approvalReason}
                                onChange={(event) => setApprovalReason(event.target.value)}
                              />
                              <Button variant="contained" onClick={() => approveCorrection(correction)}>Aprobar</Button>
                            </Stack>
                          )}
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                </Paper>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setGenealogyOpen(false)}>Cerrar</Button></DialogActions>
      </Dialog>

      <Dialog open={otOpen} onClose={() => setOtOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Crear OT diaria de Armado</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              Esta cuota organiza una jornada; no duplica ni aumenta el objetivo de la OA.
            </Alert>
            <TextField
              type="date"
              label="Fecha operativa"
              InputLabelProps={{ shrink: true }}
              value={otForm.fecha_operativa}
              onChange={(event) => setOtForm({
                ...otForm,
                fecha_operativa: event.target.value,
                ot_fabricacion_contexto_id: '',
                trabajo_color_contexto_id: '',
              })}
            />
            <FormControl fullWidth>
              <InputLabel id="assembly-execution-mode-label">Modalidad de ejecución</InputLabel>
              <Select
                labelId="assembly-execution-mode-label"
                label="Modalidad de ejecución"
                value={otForm.modo_ejecucion}
                onChange={(event) => setOtForm({
                  ...otForm,
                  modo_ejecucion: event.target.value,
                  ot_fabricacion_contexto_id: '',
                  trabajo_color_contexto_id: '',
                })}
              >
                <MenuItem value="MESA">En mesa de armado</MenuItem>
                {selected?.operacion?.permite_concurrente && (
                  <MenuItem value="CONCURRENTE">Concurrente con fabricación</MenuItem>
                )}
              </Select>
            </FormControl>
            {otForm.modo_ejecucion === 'CONCURRENTE' && (
              <>
                <Alert severity="info">
                  El prearmado se vincula a la fabricación para conservar su contexto,
                  pero el peso del componente incorporado no se acredita como producción de máquina.
                </Alert>
                <FormControl fullWidth>
                  <InputLabel id="assembly-fabrication-context-label">
                    OT de fabricación de contexto
                  </InputLabel>
                  <Select
                    labelId="assembly-fabrication-context-label"
                    label="OT de fabricación de contexto"
                    value={otForm.ot_fabricacion_contexto_id}
                    onChange={(event) => setOtForm({
                      ...otForm,
                      ot_fabricacion_contexto_id: event.target.value,
                      trabajo_color_contexto_id: (() => {
                        const context = fabricationOts.find(
                          (item) => item.public_id === event.target.value,
                        );
                        const contextWorks = (context?.trabajos_color || []).filter(
                          (item) => ['PLANIFICADO', 'EN_EJECUCION', 'PAUSADO'].includes(item.estado),
                        );
                        return contextWorks.length === 1 ? contextWorks[0].id : '';
                      })(),
                    })}
                  >
                    {fabricationOts.filter((item) => (
                      item.fecha_operativa === otForm.fecha_operativa
                    )).map((item) => (
                      <MenuItem key={item.public_id} value={item.public_id}>
                        {item.codigo_ot} · {item.maquina || 'Máquina sin nombre'} · {item.turno}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {!fabricationOts.some((item) => (
                  item.fecha_operativa === otForm.fecha_operativa
                )) && (
                  <Alert severity="warning">
                    No hay una OT de fabricación activa para esta fecha.
                  </Alert>
                )}
                {activeContextWorks.length === 1 && (
                  <Paper variant="outlined" sx={{ px: 1.5, py: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Trabajo de color concurrente
                    </Typography>
                    <Typography fontWeight={800}>
                      {activeContextWorks[0].color || 'Color no informado'}
                      {' · '}{activeContextWorks[0].orden_fabricacion_codigo || 'OF no informada'}
                    </Typography>
                    {colorWorkOutputsLabel(activeContextWorks[0]) && (
                      <Typography variant="body2" color="text.secondary">
                        {colorWorkOutputsLabel(activeContextWorks[0])}
                      </Typography>
                    )}
                  </Paper>
                )}
                {selectedFabricationContext && activeContextWorks.length === 0 && (
                  <Alert severity="error">
                    Esta OT de fabricación no tiene un Trabajo de color activo. Selecciona otra
                    OT o crea primero su Trabajo de color.
                  </Alert>
                )}
                {activeContextWorks.length > 1 && (
                  <FormControl fullWidth required>
                    <InputLabel id="assembly-color-work-context-label">
                      Trabajo de color concurrente
                    </InputLabel>
                    <Select
                      labelId="assembly-color-work-context-label"
                      label="Trabajo de color concurrente"
                      value={otForm.trabajo_color_contexto_id}
                      onChange={(event) => setOtForm({
                        ...otForm, trabajo_color_contexto_id: event.target.value,
                      })}
                    >
                      {activeContextWorks.map((work) => (
                        <MenuItem key={work.id} value={work.id}>
                          {work.color || 'Color no informado'}
                          {' · '}{work.orden_fabricacion_codigo || 'OF no informada'}
                          {colorWorkOutputsLabel(work)
                            ? ` · ${colorWorkOutputsLabel(work)}` : ''}
                          {' · '}{String(work.estado || '').replaceAll('_', ' ')}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </>
            )}
            <FormControl fullWidth>
              <InputLabel id="assembly-work-center-label">Mesa o centro de Armado</InputLabel>
              <Select
                labelId="assembly-work-center-label"
                label="Mesa o centro de Armado"
                value={otForm.centro_trabajo_id}
                onChange={(event) => setOtForm({ ...otForm, centro_trabajo_id: event.target.value })}
              >
                {centers.map((center) => (
                  <MenuItem key={center.id} value={center.id}>
                    {center.codigo} · {center.nombre} ({center.tipo})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="assembly-responsible-label">Responsable de Armado</InputLabel>
              <Select
                labelId="assembly-responsible-label"
                label="Responsable de Armado"
                value={otForm.responsable_id}
                onChange={(event) => setOtForm({ ...otForm, responsable_id: event.target.value })}
              >
                {workers.map((worker) => (
                  <MenuItem key={worker.id} value={worker.id}>
                    {worker.codigo} · {worker.nombre_completo}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="assembly-shift-label">Turno</InputLabel>
              <Select
                labelId="assembly-shift-label"
                label="Turno"
                value={otForm.turno}
                onChange={(event) => setOtForm({ ...otForm, turno: event.target.value })}
              >
                <MenuItem value="DIA">Día</MenuItem>
                <MenuItem value="NOCHE">Noche</MenuItem>
                <MenuItem value="EXTRA">Extra</MenuItem>
              </Select>
            </FormControl>
            <TextField
              type="number"
              label="Cuota objetivo (un)"
              inputProps={{ min: 0.001, max: pendingQuota, step: 0.001 }}
              helperText={`Saldo disponible de la OA: ${pendingQuota.toFixed(3)} un`}
              value={otForm.cantidad_objetivo}
              onChange={(event) => setOtForm({ ...otForm, cantidad_objetivo: event.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOtOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={
              busy
              || !otForm.fecha_operativa
              || !otForm.centro_trabajo_id
              || !otForm.responsable_id
              || (otForm.modo_ejecucion === 'CONCURRENTE'
                && !otForm.ot_fabricacion_contexto_id)
              || (otForm.modo_ejecucion === 'CONCURRENTE'
                && !otForm.trabajo_color_contexto_id)
              || Number(otForm.cantidad_objetivo) <= 0
              || Number(otForm.cantidad_objetivo) > pendingQuota
            }
            onClick={createOt}
          >
            Crear OT y continuar
          </Button>
        </DialogActions>
      </Dialog>
      <ExceptionalAssemblyOrderDialog
        open={exceptionalOrderOpen}
        onClose={() => setExceptionalOrderOpen(false)}
        onCreated={handleExceptionalOrderCreated}
      />
    </Stack>
  );
}
