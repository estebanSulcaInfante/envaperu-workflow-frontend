import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Alert, Box, Button, Card, CardActionArea, Checkbox, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl,
  FormControlLabel, InputLabel, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getTrabajadores, obtenerMaquinas } from '../services/api';
import {
  agregarMangasTrabajoColorScm,
  anularMangaScm,
  anularPesajeScm,
  aprobarMangaExtraScm,
  aprobarCorreccionPesajeScm,
  cambiarEstadoTrabajoColorScm,
  crearOtFabricacionScm,
  crearTrabajoColorScm,
  generarEtiquetasPrepesaje,
  listarOtScm,
  listarSolicitudesMangaExtraScm,
  listarOrdenesFabricacionScm,
  obtenerPesajeMangaScm,
  obtenerPlanMangas,
  recalcularPlanMangas,
  reasignarMangasTrabajoColorScm,
  reemplazarEtiquetaScm,
  solicitarMangaExtraScm,
  solicitarCorreccionPesajeScm,
} from '../services/scmOtApi';
import { mensajeErrorScm } from '../services/scmEngineeringApi';
import PageHeader from './ui/PageHeader';
import ProcessJourney from './ui/ProcessJourney';
import { useScmActor } from '../context/ScmActorContext';

const today = () => new Date().toISOString().slice(0, 10);
const stateLabel = (value) => String(value || '').replaceAll('_', ' ');
const compactQuantity = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? new Intl.NumberFormat('es-PE').format(parsed) : '0';
};

const legacyWork = (ot) => ({
  id: `legacy-${ot.public_id}`,
  codigo: `${ot.codigo_ot} · compatibilidad`,
  secuencia: 1,
  estado: ot.estado === 'CERRADA' ? 'COMPLETADO' : ot.estado,
  version: ot.version,
  orden_fabricacion_id: ot.orden_operacion_id,
  orden_fabricacion_codigo: ot.orden_fabricacion?.codigo || 'OF legacy',
  corrida_fabricacion_id: ot.corrida_fabricacion_id,
  corrida_codigo: 'Corrida legacy',
  color: ot.mangas?.[0]?.color || 'Contexto anterior',
  cantidad_objetivo_un: ot.mangas?.reduce(
    (total, item) => total + Number(item.cantidad_asignada_un || 0), 0,
  ) || 0,
  cantidad_confirmada_un: 0,
  asignaciones_personal: [],
  asignacion_activa: null,
  mangas: ot.mangas || [],
  legacy: true,
});

const normalizeOt = (ot) => ({
  ...ot,
  trabajos_color: Array.isArray(ot.trabajos_color)
    ? ot.trabajos_color
    : (ot.corrida_fabricacion_id ? [legacyWork(ot)] : []),
});

function ColorWorkQueue({ works, selectedWorkId, onSelect }) {
  if (!works.length) {
    return (
      <Alert severity="info">
        Esta OT todavía no tiene trabajos. Agrega el primer color desde la OF liberada.
      </Alert>
    );
  }
  return (
    <Stack spacing={1} data-testid="color-work-queue">
      {works.map((work) => {
        const selected = work.id === selectedWorkId;
        const running = work.estado === 'EN_EJECUCION';
        return (
          <Card
            key={work.id}
            variant="outlined"
            sx={{
              borderColor: selected ? 'primary.main' : (running ? 'success.main' : 'divider'),
              borderWidth: selected ? 2 : 1,
            }}
          >
            <CardActionArea
              aria-label={`Ver mangas de ${work.color || work.codigo}`}
              onClick={() => onSelect(work.id)}
              sx={{ p: 1.5 }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ sm: 'center' }}
              >
                <Box sx={{ minWidth: 38 }}>
                  <Typography variant="caption" color="text.secondary">
                    #{work.secuencia}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography fontWeight={850}>{work.color || 'Sin color informado'}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {work.orden_fabricacion_codigo || 'Sin OF'} · {work.corrida_codigo || 'Sin corrida'}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: { sm: 'right' } }}>
                  <Chip
                    size="small"
                    label={stateLabel(work.estado)}
                    color={running ? 'success' : (work.estado === 'PAUSADO' ? 'warning' : 'default')}
                  />
                  <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                    {compactQuantity(work.cantidad_confirmada_un)} / {compactQuantity(work.cantidad_objetivo_un)} un
                  </Typography>
                </Box>
              </Stack>
            </CardActionArea>
          </Card>
        );
      })}
    </Stack>
  );
}

function MangaTable({
  work,
  canPrelabel,
  canAnnulManga,
  canReplaceLabel,
  canViewWeighing,
  selectedLabels,
  selectedRelief,
  onToggleLabel,
  onToggleRelief,
  onAnnul,
  onReplace,
  onWeighing,
  weighingBusy,
}) {
  const mangas = work?.mangas || [];
  if (!mangas.length) return <Alert severity="info">Este trabajo todavía no tiene mangas.</Alert>;
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">Imprimir</TableCell>
            <TableCell>Manga</TableCell>
            <TableCell>Salida</TableCell>
            <TableCell>Responsable</TableCell>
            <TableCell align="right">Cantidad</TableCell>
            <TableCell>Estado</TableCell>
            <TableCell padding="checkbox">Relevo</TableCell>
            <TableCell>Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {mangas.map((manga) => {
            const labelChecked = selectedLabels.includes(manga.public_id);
            const reliefChecked = selectedRelief.includes(manga.public_id);
            const labelEligible = !manga.etiqueta_vigente && manga.estado === 'PLANIFICADA';
            const reliefEligible = ['PLANIFICADA', 'PREETIQUETADA'].includes(manga.estado);
            return (
              <TableRow key={manga.public_id} selected={labelChecked || reliefChecked}>
                <TableCell padding="checkbox">
                  <Checkbox
                    inputProps={{ 'aria-label': `Seleccionar manga ${manga.codigo}` }}
                    checked={labelChecked}
                    disabled={
                      !canPrelabel || !labelEligible
                      || (!labelChecked && selectedLabels.length >= 2)
                    }
                    onChange={() => onToggleLabel(manga.public_id)}
                  />
                </TableCell>
                <TableCell>
                  <Typography fontWeight={800}>{manga.codigo}</Typography>
                  <Typography variant="caption">{manga.tipo_manga || manga.tipo}</Typography>
                </TableCell>
                <TableCell>
                  {manga.articulo_nombre}
                  <Typography display="block" variant="caption">{manga.color}</Typography>
                </TableCell>
                <TableCell>{manga.maquinista || 'Por asignar'}</TableCell>
                <TableCell align="right">{compactQuantity(manga.cantidad_asignada_un)}</TableCell>
                <TableCell>
                  <Chip size="small" label={stateLabel(manga.estado)} />
                </TableCell>
                <TableCell padding="checkbox">
                  <Checkbox
                    inputProps={{ 'aria-label': `Incluir ${manga.codigo} en el relevo` }}
                    checked={reliefChecked}
                    disabled={!reliefEligible}
                    onChange={() => onToggleRelief(manga.public_id)}
                  />
                </TableCell>
                <TableCell>
                  <Stack direction={{ xs: 'column', xl: 'row' }} spacing={0.5}>
                    {canAnnulManga && (
                      <Button
                        size="small"
                        color="error"
                        disabled={!['PLANIFICADA', 'PREETIQUETADA'].includes(manga.estado)}
                        onClick={() => onAnnul(manga)}
                      >
                        Anular manga
                      </Button>
                    )}
                    {canReplaceLabel && (
                      <Button
                        size="small"
                        disabled={!manga.etiqueta_vigente || manga.estado === 'ANULADA'}
                        onClick={() => onReplace(manga)}
                      >
                        Reemplazar etiqueta
                      </Button>
                    )}
                    {canViewWeighing && (
                      <Button
                        size="small"
                        aria-label={`Ver pesaje de ${manga.codigo}`}
                        disabled={
                          weighingBusy || ![
                            'PESADA', 'ETIQUETADA_FINAL', 'PENDIENTE_RECEPCION_ALMACEN',
                            'ANULADA',
                          ].includes(manga.estado)
                        }
                        onClick={() => onWeighing(manga)}
                      >
                        Ver pesaje
                      </Button>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function OtMangasScm() {
  const { can, canAny, experience } = useScmActor();
  const canManagePlan = can('PLAN_MANGA_ADMINISTRAR');
  const canCreateOt = can('OT_CREAR');
  const canStartWork = can('OT_INICIAR');
  const canCloseWork = can('OT_CERRAR');
  const canPlanMangas = can('MANGA_PLANIFICAR');
  const canRequestExtra = can('MANGA_EXTRA_SOLICITAR');
  const canApproveExtra = can('MANGA_EXTRA_APROBAR');
  const canPrelabel = can('MANGA_ETIQUETA_PRE_GENERAR');
  const canAnnulManga = can('MANGA_ANULAR');
  const canReplaceLabel = can('MANGA_ETIQUETA_REEMPLAZAR_APROBAR');
  const canViewWeighing = can('MANGA_PESAJE_VER');
  const canRequestCorrection = can('PESAJE_CORRECCION_SOLICITAR');
  const canApproveCorrection = can('PESAJE_CORRECCION_APROBAR');
  const canAnnulWeighing = can('ANULAR_PESAJE');
  const hasOperationalActions = canAny([
    'PLAN_MANGA_ADMINISTRAR', 'OT_CREAR', 'OT_INICIAR', 'OT_CERRAR',
    'MANGA_PLANIFICAR', 'MANGA_EXTRA_SOLICITAR', 'MANGA_EXTRA_APROBAR',
    'MANGA_ETIQUETA_PRE_GENERAR', 'MANGA_ANULAR',
    'MANGA_ETIQUETA_REEMPLAZAR_APROBAR', 'PESAJE_CORRECCION_SOLICITAR',
    'PESAJE_CORRECCION_APROBAR', 'ANULAR_PESAJE',
  ]);

  const [catalogs, setCatalogs] = useState({ orders: [], machines: [], workers: [] });
  const [ots, setOts] = useState([]);
  const [selectedOtId, setSelectedOtId] = useState('');
  const [selectedWorkId, setSelectedWorkId] = useState('');
  const selectedWorkIdRef = useRef('');
  const [listFilters, setListFilters] = useState({
    fecha_operativa: today(), turno: 'DIA', maquina_id: '',
  });
  const [headerForm, setHeaderForm] = useState({
    fecha_operativa: today(), maquina_id: '', turno: 'DIA',
    maquinista_predeterminado_id: '',
  });
  const [workForm, setWorkForm] = useState({
    orderId: '', runId: '', workerId: '', quantities: {},
  });
  const [draftPlan, setDraftPlan] = useState(null);
  const [selectedWorkPlan, setSelectedWorkPlan] = useState(null);
  const [extraRequests, setExtraRequests] = useState([]);
  const [mangaAllocation, setMangaAllocation] = useState({
    plan_linea_id: '', cantidad_un: '', motivo: '',
  });
  const [selectedLabels, setSelectedLabels] = useState([]);
  const [selectedRelief, setSelectedRelief] = useState([]);
  const [reliefForm, setReliefForm] = useState({
    workerId: '', reason: '', openManga: false, boundaryCount: '',
  });
  const [busy, setBusy] = useState(true);
  const [planBusy, setPlanBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [printJob, setPrintJob] = useState(null);
  const [replacementPrintJobs, setReplacementPrintJobs] = useState([]);
  const [mangaActionDialog, setMangaActionDialog] = useState(null);
  const [mangaActionReason, setMangaActionReason] = useState('');
  const [workActionDialog, setWorkActionDialog] = useState(null);
  const [workActionReason, setWorkActionReason] = useState('');
  const [weighingDialog, setWeighingDialog] = useState(null);
  const [weighingBusy, setWeighingBusy] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({
    peso_bruto_kg: '', tara_kg: '', cantidad_confirmada: '', motivo: '',
  });
  const [annulmentForm, setAnnulmentForm] = useState({ motivo: '', evidencia: '' });

  const selectedOt = useMemo(
    () => ots.find((item) => item.public_id === selectedOtId) || null,
    [ots, selectedOtId],
  );
  const works = useMemo(() => selectedOt?.trabajos_color || [], [selectedOt]);
  const selectedWork = useMemo(
    () => works.find((item) => item.id === selectedWorkId) || null,
    [works, selectedWorkId],
  );
  const selectedOrder = useMemo(
    () => catalogs.orders.find((item) => item.id === workForm.orderId) || null,
    [catalogs.orders, workForm.orderId],
  );
  const selectedRun = useMemo(
    () => selectedOrder?.corridas?.find((item) => item.id === workForm.runId) || null,
    [selectedOrder, workForm.runId],
  );
  const draftRunLines = useMemo(
    () => (draftPlan?.lineas || []).filter(
      (line) => line.corrida_fabricacion_id === workForm.runId,
    ),
    [draftPlan, workForm.runId],
  );
  const selectedWorkLines = useMemo(
    () => (selectedWorkPlan?.lineas || []).filter(
      (line) => line.corrida_fabricacion_id === selectedWork?.corrida_fabricacion_id,
    ),
    [selectedWorkPlan, selectedWork?.corrida_fabricacion_id],
  );
  const runningWork = works.find((item) => item.estado === 'EN_EJECUCION') || null;
  const pendingWorkMangas = (selectedWork?.mangas || []).filter(
    (item) => ![
      'PESADA', 'ETIQUETADA_FINAL', 'PENDIENTE_RECEPCION_ALMACEN',
      'RECIBIDA', 'ANULADA',
    ].includes(item.estado),
  );
  const currentWorker = selectedWork?.asignacion_activa
    || [...(selectedWork?.asignaciones_personal || [])].reverse().find(
      (item) => ['ACTIVA', 'PREVISTA'].includes(item.estado),
    ) || null;

  const loadExtraRequests = useCallback(async (orderId, workId) => {
    if (!orderId || !workId) {
      setExtraRequests([]);
      return;
    }
    const payload = await listarSolicitudesMangaExtraScm(orderId, 'PENDIENTE');
    if (selectedWorkIdRef.current === workId) {
      setExtraRequests((payload.items || []).filter(
        (item) => item.trabajo_color_id === workId,
      ));
    }
  }, []);

  const applyOtPayload = useCallback((items, preferredOtId, preferredWorkId) => {
    const normalized = (items || []).map(normalizeOt);
    setOts(normalized);
    const nextOt = normalized.find((item) => item.public_id === preferredOtId)
      || normalized[0]
      || null;
    const nextWorks = nextOt?.trabajos_color || [];
    const nextWork = nextWorks.find((item) => item.id === preferredWorkId)
      || nextWorks[0]
      || null;
    setSelectedOtId(nextOt?.public_id || '');
    setSelectedWorkId(nextWork?.id || '');
  }, []);

  const loadOts = useCallback(async (
    preferredOtId, preferredWorkId, filters = listFilters,
  ) => {
    const payload = await listarOtScm(undefined, 'FABRICACION', filters);
    applyOtPayload(payload.items || [], preferredOtId, preferredWorkId);
  }, [applyOtPayload, listFilters]);

  useEffect(() => {
    setBusy(true);
    Promise.all([
      listarOrdenesFabricacionScm(), obtenerMaquinas(), getTrabajadores(),
    ])
      .then(async ([orderPayload, machines, workers]) => {
        const orders = (orderPayload.items || []).filter(
          (item) => ['LIBERADA', 'PROGRAMADA', 'EN_EJECUCION'].includes(item.estado),
        );
        const activeWorkers = (workers || []).filter(
          (item) => item.activo
            && item.roles?.some((role) => role.codigo === 'MAQUINISTA'),
        );
        setCatalogs({ orders, machines: machines || [], workers: activeWorkers });
        const firstOrder = orders[0];
        const firstRun = firstOrder?.corridas?.find(
          (item) => ['LIBERADA', 'EN_EJECUCION'].includes(item.estado),
        );
        setHeaderForm((current) => ({
          ...current,
          maquina_id: current.maquina_id || machines?.[0]?.id || '',
          maquinista_predeterminado_id:
            current.maquinista_predeterminado_id || activeWorkers[0]?.id || '',
        }));
        setWorkForm((current) => ({
          ...current,
          orderId: current.orderId || firstOrder?.id || '',
          runId: current.runId || firstRun?.id || '',
          workerId: current.workerId || activeWorkers[0]?.id || '',
        }));
        setReliefForm((current) => ({
          ...current, workerId: current.workerId || activeWorkers[0]?.id || '',
        }));
        const initialFilters = {
          fecha_operativa: today(),
          turno: 'DIA',
          maquina_id: machines?.[0]?.id || '',
        };
        setListFilters(initialFilters);
        const otPayload = initialFilters.maquina_id
          ? await listarOtScm(undefined, 'FABRICACION', initialFilters)
          : { items: [] };
        applyOtPayload(otPayload.items || []);
      })
      .catch((requestError) => setError(
        mensajeErrorScm(requestError, 'No se pudieron cargar OT, OF y recursos.'),
      ))
      .finally(() => setBusy(false));
  }, [applyOtPayload]);

  useEffect(() => {
    selectedWorkIdRef.current = selectedWorkId;
    setSelectedLabels([]);
    setSelectedRelief([]);
    setPrintJob(null);
    setReplacementPrintJobs([]);
  }, [selectedWorkId]);

  useEffect(() => {
    if (!workForm.orderId) {
      setDraftPlan(null);
      return undefined;
    }
    let active = true;
    setPlanBusy(true);
    obtenerPlanMangas(workForm.orderId)
      .then((payload) => {
        if (!active) return;
        setDraftPlan(payload.plan);
        setWorkForm((current) => ({
          ...current,
          quantities: Object.fromEntries(
            (payload.plan?.lineas || []).map((line) => [line.id, line.saldo_un]),
          ),
        }));
      })
      .catch((requestError) => {
        if (active) setError(mensajeErrorScm(
          requestError, 'La OF todavía no tiene un plan de mangas disponible.',
        ));
      })
      .finally(() => { if (active) setPlanBusy(false); });
    return () => { active = false; };
  }, [workForm.orderId]);

  const selectedWorkOrderId = selectedWork?.orden_fabricacion_id;
  const selectedWorkRunId = selectedWork?.corrida_fabricacion_id;
  const selectedWorkIsLegacy = Boolean(selectedWork?.legacy);

  useEffect(() => {
    if (!selectedWorkOrderId || selectedWorkIsLegacy) {
      setSelectedWorkPlan(null);
      setMangaAllocation({ plan_linea_id: '', cantidad_un: '', motivo: '' });
      return undefined;
    }
    let active = true;
    obtenerPlanMangas(selectedWorkOrderId)
      .then((payload) => {
        if (!active) return;
        setSelectedWorkPlan(payload.plan);
        const firstLine = (payload.plan?.lineas || []).find(
          (line) => line.corrida_fabricacion_id === selectedWorkRunId,
        );
        setMangaAllocation({
          plan_linea_id: String(firstLine?.id || ''), cantidad_un: '', motivo: '',
        });
      })
      .catch(() => { if (active) setSelectedWorkPlan(null); });
    return () => { active = false; };
  }, [selectedWorkOrderId, selectedWorkRunId, selectedWorkIsLegacy]);

  useEffect(() => {
    if (!selectedWorkOrderId || !selectedWorkId || selectedWorkIsLegacy) {
      setExtraRequests([]);
      return;
    }
    loadExtraRequests(selectedWorkOrderId, selectedWorkId)
      .catch(() => setExtraRequests([]));
  }, [
    loadExtraRequests, selectedWorkId, selectedWorkIsLegacy, selectedWorkOrderId,
  ]);

  const refresh = async () => {
    setBusy(true);
    setError('');
    try {
      await loadOts(selectedOtId, selectedWorkId);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo actualizar la jornada.'));
    } finally {
      setBusy(false);
    }
  };

  const applyListFilters = async (event) => {
    event?.preventDefault();
    if (!listFilters.fecha_operativa || !listFilters.turno || !listFilters.maquina_id) {
      setError('Selecciona fecha, turno y máquina para buscar OT.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await loadOts(selectedOtId, selectedWorkId, listFilters);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudieron buscar las OT.'));
    } finally {
      setBusy(false);
    }
  };

  const createHeader = async () => {
    if (!headerForm.maquina_id || !headerForm.fecha_operativa || !headerForm.turno) {
      setError('Selecciona máquina, fecha y turno.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = {
        fecha_operativa: headerForm.fecha_operativa,
        maquina_id: Number(headerForm.maquina_id),
        turno: headerForm.turno,
        ...(headerForm.maquinista_predeterminado_id ? {
          maquinista_predeterminado_id: Number(headerForm.maquinista_predeterminado_id),
        } : {}),
      };
      const result = await crearOtFabricacionScm(payload);
      setNotice(`${result.ot.codigo_ot} creada como jornada de máquina, todavía sin color.`);
      const creationFilters = {
        fecha_operativa: headerForm.fecha_operativa,
        turno: headerForm.turno,
        maquina_id: headerForm.maquina_id,
      };
      setListFilters(creationFilters);
      await loadOts(result.ot.public_id, undefined, creationFilters);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo crear la OT de máquina.'));
    } finally {
      setBusy(false);
    }
  };

  const createWork = async () => {
    const assignments = draftRunLines
      .filter((line) => Number(workForm.quantities[line.id]) > 0)
      .map((line) => ({
        plan_linea_id: Number(line.id),
        cantidad_un: Number(workForm.quantities[line.id]),
      }));
    if (!selectedOt || !selectedRun || !workForm.workerId || !assignments.length) {
      setError('Selecciona OT, corrida, maquinista y una cantidad positiva.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await crearTrabajoColorScm(selectedOt.public_id, {
        corrida_fabricacion_id: selectedRun.id,
        maquinista_id: Number(workForm.workerId),
        asignaciones: assignments,
      });
      setNotice(
        `${result.trabajo_color.color || result.trabajo_color.codigo} agregado a la cola de ${selectedOt.codigo_ot}.`,
      );
      await loadOts(selectedOt.public_id, result.trabajo_color.id);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo agregar el Trabajo de color.'));
    } finally {
      setBusy(false);
    }
  };

  const recalculateDraftPlan = async () => {
    if (!workForm.orderId) return;
    setPlanBusy(true);
    setError('');
    try {
      const result = await recalcularPlanMangas(workForm.orderId);
      setDraftPlan(result.plan);
      setWorkForm((current) => ({
        ...current,
        quantities: Object.fromEntries(
          result.plan.lineas.map((line) => [line.id, line.saldo_un]),
        ),
      }));
      setNotice(`Plan de ${selectedOrder?.codigo} recalculado. No se creó ninguna manga.`);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo recalcular el plan de la OF.'));
    } finally {
      setPlanBusy(false);
    }
  };

  const transitionWork = async (action, reason = '') => {
    if (!selectedWork || selectedWork.legacy) return;
    setBusy(true);
    setError('');
    try {
      const result = await cambiarEstadoTrabajoColorScm(
        selectedWork.id, action, selectedWork.version, reason,
      );
      setNotice(
        `${result.trabajo_color.color || result.trabajo_color.codigo}: ${stateLabel(result.trabajo_color.estado)}.`,
      );
      setWorkActionDialog(null);
      setWorkActionReason('');
      await loadOts(selectedOt.public_id, selectedWork.id);
    } catch (requestError) {
      const code = requestError.response?.data?.error?.code;
      setError(code === 'OT_WORK_ALREADY_RUNNING'
        ? `Pausa primero ${runningWork?.color || 'el trabajo en ejecución'} antes de iniciar otro color.`
        : mensajeErrorScm(requestError, 'No se pudo cambiar el estado del trabajo.'));
    } finally {
      setBusy(false);
    }
  };

  const submitWorkDialog = () => {
    if (workActionDialog?.action === 'anular' && !workActionReason.trim()) {
      setError('La anulación del trabajo requiere un motivo.');
      return;
    }
    transitionWork(workActionDialog.action, workActionReason);
  };

  const addMangas = async () => {
    if (
      !selectedWork || !mangaAllocation.plan_linea_id
      || Number(mangaAllocation.cantidad_un) <= 0
    ) {
      setError('Selecciona una salida y una cantidad positiva.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await agregarMangasTrabajoColorScm(selectedWork.id, {
        plan_linea_id: Number(mangaAllocation.plan_linea_id),
        cantidad_un: Number(mangaAllocation.cantidad_un),
      });
      setNotice(`${result.mangas.length} manga(s) agregadas a ${selectedWork.color}.`);
      setMangaAllocation((current) => ({ ...current, cantidad_un: '' }));
      await loadOts(selectedOt.public_id, selectedWork.id);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudieron agregar las mangas.'));
    } finally {
      setBusy(false);
    }
  };

  const requestExtraManga = async () => {
    if (
      !selectedOt || !selectedWork || !mangaAllocation.plan_linea_id
      || Number(mangaAllocation.cantidad_un) <= 0
      || !mangaAllocation.motivo.trim()
    ) {
      setError('La manga EXTRA requiere salida, cantidad y motivo.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await solicitarMangaExtraScm(selectedOt.public_id, {
        trabajo_color_id: selectedWork.id,
        plan_linea_id: Number(mangaAllocation.plan_linea_id),
        cantidad_un: Number(mangaAllocation.cantidad_un),
        motivo: mangaAllocation.motivo.trim(),
      });
      setNotice(`Solicitud EXTRA ${result.solicitud.id} enviada a aprobación.`);
      setMangaAllocation((current) => ({
        ...current, cantidad_un: '', motivo: '',
      }));
      await loadExtraRequests(selectedWorkOrderId, selectedWork.id);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo solicitar la manga EXTRA.'));
    } finally {
      setBusy(false);
    }
  };

  const approveExtraManga = async (requestId) => {
    setBusy(true);
    setError('');
    try {
      const result = await aprobarMangaExtraScm(requestId);
      setNotice(`Solicitud aprobada: ${result.mangas.length} manga(s) EXTRA creadas.`);
      await Promise.all([
        loadOts(selectedOt.public_id, selectedWork.id),
        loadExtraRequests(selectedWorkOrderId, selectedWork.id),
      ]);
    } catch (requestError) {
      setError(mensajeErrorScm(
        requestError,
        'No se aprobó la solicitud. Solicitante y aprobador deben ser personas distintas.',
      ));
    } finally {
      setBusy(false);
    }
  };

  const relieveWorker = async () => {
    if (!selectedWork || !reliefForm.workerId || !reliefForm.reason.trim()) {
      setError('El relevo requiere maquinista y motivo.');
      return;
    }
    if (reliefForm.openManga && selectedRelief.length !== 1) {
      setError('Una manga abierta se transfiere individualmente. Selecciona exactamente una.');
      return;
    }
    if (
      reliefForm.openManga
      && (!Number.isInteger(Number(reliefForm.boundaryCount))
        || Number(reliefForm.boundaryCount) < 0)
    ) {
      setError('Registra el conteo acumulado de frontera de la manga abierta.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await reasignarMangasTrabajoColorScm(selectedWork.id, {
        trabajador_id: Number(reliefForm.workerId),
        motivo: reliefForm.reason.trim(),
        version: selectedWork.version,
        ...(selectedRelief.length ? { manga_ids: selectedRelief } : {}),
        ...(reliefForm.openManga ? {
          manga_abierta: true,
          conteo_frontera: Number(reliefForm.boundaryCount),
        } : {}),
      });
      const replacementJobs = result.trabajos_impresion_reemplazo || [];
      setReplacementPrintJobs(replacementJobs);
      const replacementLabelCount = replacementJobs.reduce(
        (total, job) => total + (job.labels?.length || 0), 0,
      );
      setNotice(
        `${result.mangas.length} manga(s) reasignadas a ${result.asignacion.trabajador}.`
        + (replacementLabelCount
          ? ` Reimprime ${replacementLabelCount} preetiqueta(s) de reemplazo.`
          : ''),
      );
      setSelectedRelief([]);
      setReliefForm((current) => ({
        ...current, reason: '', openManga: false, boundaryCount: '',
      }));
      await loadOts(selectedOt.public_id, selectedWork.id);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo registrar el relevo.'));
    } finally {
      setBusy(false);
    }
  };

  const generateLabels = async () => {
    if (selectedLabels.length < 1 || selectedLabels.length > 2) {
      setError('Selecciona una o dos mangas del mismo Trabajo de color.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await generarEtiquetasPrepesaje(selectedLabels);
      setPrintJob(result);
      setNotice(`Trabajo de impresión ${result.print_job_id} listo para la balanza.`);
      setSelectedLabels([]);
      await loadOts(selectedOt.public_id, selectedWork.id);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se generaron las preetiquetas.'));
    } finally {
      setBusy(false);
    }
  };

  const submitMangaAction = async () => {
    if (!mangaActionDialog || !mangaActionReason.trim()) {
      setError('Indica el motivo de la acción.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (mangaActionDialog.type === 'annul') {
        await anularMangaScm(mangaActionDialog.manga.public_id, mangaActionReason.trim());
        setNotice(`${mangaActionDialog.manga.codigo} anulada; el cupo volvió al trabajo.`);
      } else {
        const result = await reemplazarEtiquetaScm(
          mangaActionDialog.manga.etiqueta_vigente.public_id,
          mangaActionReason.trim(),
        );
        setPrintJob({ ...result, labels: [result.label] });
        setNotice(`Nueva etiqueta generada en el trabajo ${result.print_job_id}.`);
      }
      setMangaActionDialog(null);
      setMangaActionReason('');
      await loadOts(selectedOt.public_id, selectedWork.id);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se completó la acción de manga.'));
    } finally {
      setBusy(false);
    }
  };

  const openWeighing = async (manga) => {
    setWeighingBusy(true);
    setError('');
    try {
      const detail = await obtenerPesajeMangaScm(manga.public_id);
      setWeighingDialog({ manga, detail });
      setCorrectionForm({
        peso_bruto_kg: detail.vigente?.peso_bruto_kg || '',
        tara_kg: detail.vigente?.tara_kg || '',
        cantidad_confirmada: detail.vigente?.cantidad_confirmada || '',
        motivo: '',
      });
      setAnnulmentForm({ motivo: '', evidencia: '' });
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo consultar el pesaje.'));
    } finally {
      setWeighingBusy(false);
    }
  };

  const refreshWeighing = async () => {
    if (!weighingDialog) return;
    const detail = await obtenerPesajeMangaScm(weighingDialog.manga.public_id);
    setWeighingDialog((current) => ({ ...current, detail }));
  };

  const requestWeighingCorrection = async () => {
    const original = weighingDialog?.detail?.original;
    if (!original || !correctionForm.motivo.trim()) {
      setError('La corrección requiere un motivo.');
      return;
    }
    setWeighingBusy(true);
    setError('');
    try {
      await solicitarCorreccionPesajeScm(original.public_id, {
        proposed: {
          peso_bruto_kg: correctionForm.peso_bruto_kg,
          tara_kg: correctionForm.tara_kg,
          cantidad_confirmada: correctionForm.cantidad_confirmada,
        },
        motivo: correctionForm.motivo.trim(),
      });
      await refreshWeighing();
      setCorrectionForm((current) => ({ ...current, motivo: '' }));
      setNotice('Corrección solicitada. Debe aprobarla otro actor autorizado.');
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo solicitar la corrección.'));
    } finally {
      setWeighingBusy(false);
    }
  };

  const approveWeighingCorrection = async (correctionId) => {
    setWeighingBusy(true);
    setError('');
    try {
      const result = await aprobarCorreccionPesajeScm(correctionId, {
        motivo_aprobacion: 'Validación de Jefe de Producción',
      });
      setPrintJob({ print_job_id: result.print_job_id, labels: [result.post_label] });
      await refreshWeighing();
      await loadOts(selectedOt.public_id, selectedWork.id);
      setNotice('Corrección aplicada; la nueva etiqueta final quedó lista para imprimir.');
    } catch (requestError) {
      setError(mensajeErrorScm(
        requestError, 'No se aprobó. Usa un actor autorizado distinto del solicitante.',
      ));
    } finally {
      setWeighingBusy(false);
    }
  };

  const annulWeighing = async () => {
    const original = weighingDialog?.detail?.original;
    if (!original || !annulmentForm.motivo.trim()) {
      setError('La anulación requiere un motivo.');
      return;
    }
    setWeighingBusy(true);
    setError('');
    try {
      await anularPesajeScm(original.public_id, {
        motivo: annulmentForm.motivo.trim(),
        evidencia: annulmentForm.evidencia.trim() || null,
      });
      await refreshWeighing();
      await loadOts(selectedOt.public_id, selectedWork.id);
      setNotice('Pesaje anulado; los QR quedaron invalidados y el cupo volvió al trabajo.');
    } catch (requestError) {
      const code = requestError.response?.data?.error?.code;
      setError(code === 'RECEIPT_REVERSAL_REQUIRED'
        ? 'La manga ya ingresó a Almacén. Aprueba primero la reversa de recepción.'
        : mensajeErrorScm(requestError, 'No se pudo anular el pesaje.'));
    } finally {
      setWeighingBusy(false);
    }
  };

  const selectOrder = (orderId) => {
    const order = catalogs.orders.find((item) => item.id === orderId);
    const run = order?.corridas?.find(
      (item) => ['LIBERADA', 'EN_EJECUCION'].includes(item.estado),
    );
    setWorkForm((current) => ({
      ...current, orderId, runId: run?.id || '', quantities: {},
    }));
  };

  const prelabelButtonText = selectedLabels.length
    ? `Generar ${selectedLabels.length} preetiqueta${selectedLabels.length > 1 ? 's' : ''}`
    : 'Selecciona hasta 2 mangas';

  return (
    <Stack spacing={2.5}>
      <PageHeader
        eyebrow="Fabricación / Ejecución SCM"
        title="OT de máquina y trabajos de color"
        description="La OT organiza la jornada de una máquina. Cada color conserva su OF, corrida, responsable, cupo y mangas."
        actions={(
          <Button startIcon={<RefreshIcon />} variant="outlined" onClick={refresh}>
            Actualizar
          </Button>
        )}
      />
      <ProcessJourney current="jornada" />
      {!hasOperationalActions && (
        <Alert severity="info">
          Vista de consulta para {experience.label}. Las acciones se muestran a los responsables de la jornada.
        </Alert>
      )}
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="overline" color="primary.main">1 · Jornada de máquina</Typography>
        <Typography variant="h6" fontWeight={850}>Crear una OT sin amarrarla a un color</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Define solamente dónde y cuándo se trabajará. Los colores se agregan después como una cola.
        </Typography>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5}>
          <TextField
            label="Fecha operativa"
            type="date"
            value={headerForm.fecha_operativa}
            InputLabelProps={{ shrink: true }}
            onChange={(event) => setHeaderForm({
              ...headerForm, fecha_operativa: event.target.value,
            })}
          />
          <FormControl sx={{ minWidth: 230 }}>
            <InputLabel>Máquina</InputLabel>
            <Select
              label="Máquina"
              value={headerForm.maquina_id}
              onChange={(event) => setHeaderForm({
                ...headerForm, maquina_id: event.target.value,
              })}
            >
              {catalogs.machines.map((item) => (
                <MenuItem key={item.id} value={item.id}>{item.codigo} · {item.nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 130 }}>
            <InputLabel>Turno</InputLabel>
            <Select
              label="Turno"
              value={headerForm.turno}
              onChange={(event) => setHeaderForm({ ...headerForm, turno: event.target.value })}
            >
              <MenuItem value="DIA">Día</MenuItem>
              <MenuItem value="NOCHE">Noche</MenuItem>
              <MenuItem value="EXTRA">Extra</MenuItem>
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 230 }}>
            <InputLabel>Maquinista predeterminado</InputLabel>
            <Select
              label="Maquinista predeterminado"
              value={headerForm.maquinista_predeterminado_id}
              onChange={(event) => setHeaderForm({
                ...headerForm, maquinista_predeterminado_id: event.target.value,
              })}
            >
              <MenuItem value=""><em>Asignar en cada trabajo</em></MenuItem>
              {catalogs.workers.map((item) => (
                <MenuItem key={item.id} value={item.id}>{item.nombre_completo}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {canCreateOt && (
            <Button variant="contained" disabled={busy} onClick={createHeader}>
              Crear OT de máquina
            </Button>
          )}
        </Stack>
      </Paper>

      {busy && <Box sx={{ display: 'grid', placeItems: 'center', py: 2 }}><CircularProgress /></Box>}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="overline" color="primary.main">2 · Cola de producción</Typography>
        <Paper
          component="form"
          onSubmit={applyListFilters}
          variant="outlined"
          sx={{ p: 1.5, my: 1.5, bgcolor: 'grey.50' }}
        >
          <Typography fontWeight={850}>Filtros de consulta</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Buscan jornadas existentes y no modifican el formulario de creación de arriba.
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField
              size="small"
              label="Fecha a consultar"
              type="date"
              value={listFilters.fecha_operativa}
              InputLabelProps={{ shrink: true }}
              onChange={(event) => setListFilters({
                ...listFilters, fecha_operativa: event.target.value,
              })}
            />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Turno a consultar</InputLabel>
              <Select
                label="Turno a consultar"
                value={listFilters.turno}
                onChange={(event) => setListFilters({
                  ...listFilters, turno: event.target.value,
                })}
              >
                <MenuItem value="DIA">Día</MenuItem>
                <MenuItem value="NOCHE">Noche</MenuItem>
                <MenuItem value="EXTRA">Extra</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 260 }}>
              <InputLabel>Máquina a consultar</InputLabel>
              <Select
                label="Máquina a consultar"
                value={listFilters.maquina_id}
                onChange={(event) => setListFilters({
                  ...listFilters, maquina_id: event.target.value,
                })}
              >
                {catalogs.machines.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.codigo} · {item.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              type="submit"
              variant="outlined"
              disabled={busy || !listFilters.fecha_operativa
                || !listFilters.turno || !listFilters.maquina_id}
            >
              Buscar OT
            </Button>
          </Stack>
        </Paper>
        {ots.length > 0 && (
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ md: 'center' }}
            sx={{ mb: 2 }}
          >
            <FormControl sx={{ minWidth: 310 }}>
              <InputLabel>OT de máquina</InputLabel>
              <Select
                label="OT de máquina"
                value={selectedOtId}
                onChange={(event) => {
                  setSelectedOtId(event.target.value);
                  const next = ots.find((item) => item.public_id === event.target.value);
                  setSelectedWorkId(next?.trabajos_color?.[0]?.id || '');
                }}
              >
                {ots.map((item) => (
                  <MenuItem key={item.public_id} value={item.public_id}>
                    {item.codigo_ot} · {item.maquina_codigo || item.maquina} · {item.fecha_operativa} · {stateLabel(item.turno)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {selectedOt && (
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight={850}>
                  {selectedOt.codigo_ot} · {selectedOt.maquina_codigo || selectedOt.maquina}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedOt.fecha_operativa} · turno {stateLabel(selectedOt.turno)} · {works.length} trabajos de color
                </Typography>
              </Box>
            )}
            {selectedOt && <Chip label={stateLabel(selectedOt.estado)} />}
          </Stack>
        )}
        {!selectedOt ? (
          <Alert severity="info">
            No hay OT para la fecha, turno y máquina seleccionados. Ajusta los filtros o crea la jornada arriba.
          </Alert>
        ) : (
          <ColorWorkQueue
            works={works}
            selectedWorkId={selectedWorkId}
            onSelect={setSelectedWorkId}
          />
        )}
      </Paper>

      {selectedOt && canCreateOt && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight={850}>Agregar Trabajo de color</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Selecciona la OF y su corrida. El color y las salidas se heredan; no se escriben manualmente.
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
            <FormControl sx={{ minWidth: 260 }}>
              <InputLabel>Orden de fabricación</InputLabel>
              <Select
                label="Orden de fabricación"
                value={workForm.orderId}
                onChange={(event) => selectOrder(event.target.value)}
              >
                {catalogs.orders.map((item) => (
                  <MenuItem key={item.id} value={item.id}>{item.codigo}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 260 }}>
              <InputLabel>Corrida y color</InputLabel>
              <Select
                label="Corrida y color"
                value={workForm.runId}
                onChange={(event) => setWorkForm({
                  ...workForm, runId: event.target.value,
                })}
              >
                {(selectedOrder?.corridas || [])
                  .filter((item) => ['LIBERADA', 'EN_EJECUCION'].includes(item.estado))
                  .map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      {item.codigo} · {item.color || item.color_nombre || 'color definido en la corrida'}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 240 }}>
              <InputLabel>Maquinista inicial</InputLabel>
              <Select
                label="Maquinista inicial"
                value={workForm.workerId}
                onChange={(event) => setWorkForm({ ...workForm, workerId: event.target.value })}
              >
                {catalogs.workers.map((item) => (
                  <MenuItem key={item.id} value={item.id}>{item.nombre_completo}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {canManagePlan && (
              <Button variant="outlined" disabled={planBusy} onClick={recalculateDraftPlan}>
                Recalcular plan de la OF
              </Button>
            )}
          </Stack>
          {planBusy && <CircularProgress size={24} />}
          {!planBusy && draftRunLines.length > 0 && (
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>Salida</TableCell>
                  <TableCell>Tipo de manga</TableCell>
                  <TableCell align="right">Saldo</TableCell>
                  <TableCell>Asignar al trabajo</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {draftRunLines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>{line.articulo.nombre}</TableCell>
                      <TableCell>{line.tipo_manga.nombre}</TableCell>
                      <TableCell align="right">{compactQuantity(line.saldo_un)} un</TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          label="Cantidad"
                          value={workForm.quantities[line.id] ?? ''}
                          inputProps={{ min: 0, max: Number(line.saldo_un), step: 1 }}
                          onChange={(event) => setWorkForm((current) => ({
                            ...current,
                            quantities: {
                              ...current.quantities, [line.id]: event.target.value,
                            },
                          }))}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <Button variant="contained" disabled={busy || !selectedRun} onClick={createWork}>
            Agregar a la cola de esta OT
          </Button>
        </Paper>
      )}

      {selectedWork && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="overline" color="primary.main">3 · Ejecución y mangas</Typography>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            alignItems={{ md: 'center' }}
            sx={{ mb: 2 }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" fontWeight={850}>{selectedWork.color}</Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedWork.orden_fabricacion_codigo} · {selectedWork.corrida_codigo} · responsable {currentWorker?.trabajador || 'por asignar'}
              </Typography>
            </Box>
            <Chip
              label={stateLabel(selectedWork.estado)}
              color={selectedWork.estado === 'EN_EJECUCION' ? 'success' : 'default'}
            />
            {!selectedWork.legacy && canStartWork && selectedWork.estado === 'PLANIFICADO' && (
              <Button
                variant="contained"
                disabled={busy || Boolean(runningWork && runningWork.id !== selectedWork.id)}
                onClick={() => transitionWork('iniciar')}
              >
                Iniciar este color
              </Button>
            )}
            {!selectedWork.legacy && canStartWork && selectedWork.estado === 'PAUSADO' && (
              <Button
                variant="contained"
                disabled={busy || Boolean(runningWork && runningWork.id !== selectedWork.id)}
                onClick={() => transitionWork('reanudar')}
              >
                Reanudar este color
              </Button>
            )}
            {!selectedWork.legacy && canStartWork && selectedWork.estado === 'EN_EJECUCION' && (
              <Button
                variant="outlined"
                color="warning"
                onClick={() => {
                  setWorkActionReason('');
                  setWorkActionDialog({ action: 'pausar' });
                }}
              >
                Pausar para cambiar de color
              </Button>
            )}
            {!selectedWork.legacy && canCloseWork && selectedWork.estado === 'EN_EJECUCION' && (
              <Button
                color="success"
                variant="outlined"
                disabled={busy || pendingWorkMangas.length > 0}
                onClick={() => transitionWork('completar')}
              >
                Completar trabajo
              </Button>
            )}
            {!selectedWork.legacy && canCloseWork
              && ['PLANIFICADO', 'PAUSADO'].includes(selectedWork.estado) && (
                <Button
                  color="error"
                  variant="text"
                  onClick={() => {
                    setWorkActionReason('');
                    setWorkActionDialog({ action: 'anular' });
                  }}
                >
                  Anular trabajo
                </Button>
            )}
          </Stack>
          {runningWork && runningWork.id !== selectedWork.id && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {runningWork.color} está en ejecución. Páusalo antes de iniciar o reanudar este color.
            </Alert>
          )}
          {selectedWork.estado === 'EN_EJECUCION' && pendingWorkMangas.length > 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              No se puede completar todavía: {pendingWorkMangas.length} manga(s) siguen sin pesar o anular.
            </Alert>
          )}

          {!selectedWork.legacy && canCreateOt && (
            <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: 'grey.50' }}>
              <Typography fontWeight={850}>Asignar o relevar maquinista</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Marca mangas en la columna “Relevo” para transferir solo ese subconjunto. Sin selección se transfieren todas las elegibles.
              </Typography>
              <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1}>
                <FormControl size="small" sx={{ minWidth: 240 }}>
                  <InputLabel>Nuevo maquinista</InputLabel>
                  <Select
                    label="Nuevo maquinista"
                    value={reliefForm.workerId}
                    onChange={(event) => setReliefForm({
                      ...reliefForm, workerId: event.target.value,
                    })}
                  >
                    {catalogs.workers.map((item) => (
                      <MenuItem key={item.id} value={item.id}>{item.nombre_completo}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  label="Motivo del relevo"
                  value={reliefForm.reason}
                  onChange={(event) => setReliefForm({
                    ...reliefForm, reason: event.target.value,
                  })}
                  sx={{ flex: 1 }}
                />
                <Button
                  variant="outlined"
                  disabled={busy || !reliefForm.reason.trim()}
                  onClick={relieveWorker}
                >
                  {selectedRelief.length
                    ? `Relevar ${selectedRelief.length} manga${selectedRelief.length > 1 ? 's' : ''}`
                    : 'Relevar mangas elegibles'}
                </Button>
              </Stack>
              <FormControlLabel
                sx={{ mt: 1 }}
                control={(
                  <Checkbox
                    checked={reliefForm.openManga}
                    onChange={(event) => setReliefForm({
                      ...reliefForm,
                      openManga: event.target.checked,
                      boundaryCount: event.target.checked ? reliefForm.boundaryCount : '',
                    })}
                  />
                )}
                label="La manga seleccionada está abierta e incompleta"
              />
              {reliefForm.openManga && (
                <Stack spacing={1}>
                  <TextField
                    size="small"
                    type="number"
                    label="Conteo acumulado al relevo (un)"
                    value={reliefForm.boundaryCount}
                    inputProps={{ min: 0, step: 1 }}
                    onChange={(event) => setReliefForm({
                      ...reliefForm, boundaryCount: event.target.value,
                    })}
                    helperText="El conteo separa la responsabilidad entre maquinistas; no crea un pesaje intermedio."
                    sx={{ maxWidth: 420 }}
                  />
                  <Alert severity="info">
                    El conteo de frontera es evidencia declarada por el supervisor, no una medición automática. Sin un conteo verificable o un contador físico, el sistema registra el relevo, pero no atribuye unidades exactas por trabajador.
                  </Alert>
                  <Alert severity="warning">
                    La manga conserva su identidad de manga, color y Trabajo de color; la preetiqueta anterior se invalida y debe reemplazarse. El relevo solo puede ocurrir dentro de esta misma OT.
                  </Alert>
                </Stack>
              )}
            </Paper>
          )}

          {!selectedWork.legacy
            && (canPlanMangas || canRequestExtra)
            && selectedWorkLines.length > 0 && (
            <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
              <Typography fontWeight={850}>Mangas adicionales para este color</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                La salida y la solicitud quedan vinculadas únicamente a {selectedWork.color}.
              </Typography>
              <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1}>
                <FormControl size="small" sx={{ minWidth: 280 }}>
                  <InputLabel>Salida de este trabajo</InputLabel>
                  <Select
                    label="Salida de este trabajo"
                    value={mangaAllocation.plan_linea_id}
                    onChange={(event) => setMangaAllocation({
                      ...mangaAllocation, plan_linea_id: event.target.value,
                    })}
                  >
                    {selectedWorkLines.map((line) => (
                      <MenuItem key={line.id} value={String(line.id)}>
                        {line.articulo.nombre} · saldo {compactQuantity(line.saldo_un)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  type="number"
                  label="Cantidad (un)"
                  value={mangaAllocation.cantidad_un}
                  inputProps={{ min: 1, step: 1 }}
                  onChange={(event) => setMangaAllocation({
                    ...mangaAllocation, cantidad_un: event.target.value,
                  })}
                />
                {canRequestExtra && (
                  <TextField
                    size="small"
                    label="Motivo para manga EXTRA"
                    value={mangaAllocation.motivo}
                    onChange={(event) => setMangaAllocation({
                      ...mangaAllocation, motivo: event.target.value,
                    })}
                    sx={{ flex: 1, minWidth: 230 }}
                  />
                )}
                {canPlanMangas && (
                  <Button variant="outlined" disabled={busy} onClick={addMangas}>
                    Agregar normales
                  </Button>
                )}
                {canRequestExtra && (
                  <Button
                    color="warning"
                    variant="contained"
                    disabled={busy || !mangaAllocation.motivo.trim()}
                    onClick={requestExtraManga}
                  >
                    Solicitar EXTRA
                  </Button>
                )}
              </Stack>
            </Paper>
          )}

          {canApproveExtra && extraRequests.length > 0 && (
            <Paper
              variant="outlined"
              sx={{ p: 1.5, mb: 2, borderColor: 'warning.light' }}
            >
              <Typography fontWeight={850}>Autorizaciones EXTRA de este color</Typography>
              <Stack spacing={1} sx={{ mt: 1 }}>
                {extraRequests.map((item) => (
                  <Stack
                    key={item.id}
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1}
                    alignItems={{ md: 'center' }}
                  >
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {compactQuantity(item.cantidad_solicitada_un)} un · {item.motivo}
                    </Typography>
                    <Button
                      size="small"
                      color="warning"
                      variant="outlined"
                      aria-label={`Aprobar solicitud ${item.id}`}
                      disabled={busy}
                      onClick={() => approveExtraManga(item.id)}
                    >
                      Aprobar EXTRA
                    </Button>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          )}

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            alignItems={{ md: 'center' }}
            sx={{ mb: 1.5 }}
          >
            <Typography fontWeight={850} sx={{ flex: 1 }}>
              Mangas de {selectedWork.color}
            </Typography>
            {canPrelabel && (
              <Button
                variant="contained"
                startIcon={<PrintOutlinedIcon />}
                disabled={!selectedLabels.length || selectedLabels.length > 2}
                onClick={generateLabels}
              >
                {prelabelButtonText}
              </Button>
            )}
          </Stack>
          <MangaTable
            work={selectedWork}
            canPrelabel={canPrelabel}
            canAnnulManga={canAnnulManga}
            canReplaceLabel={canReplaceLabel}
            canViewWeighing={canViewWeighing}
            selectedLabels={selectedLabels}
            selectedRelief={selectedRelief}
            onToggleLabel={(id) => setSelectedLabels((current) => (
              current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
            ))}
            onToggleRelief={(id) => setSelectedRelief((current) => (
              current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
            ))}
            onAnnul={(manga) => {
              setMangaActionReason('');
              setMangaActionDialog({ type: 'annul', manga });
            }}
            onReplace={(manga) => {
              setMangaActionReason('');
              setMangaActionDialog({ type: 'replace', manga });
            }}
            onWeighing={openWeighing}
            weighingBusy={weighingBusy}
          />
        </Paper>
      )}

      {printJob && (
        <Alert severity="info">
          Trabajo <strong>{printJob.print_job_id}</strong> generado con {printJob.labels.length} etiqueta(s).
          Ya puede abrirse desde la estación de pesaje.
        </Alert>
      )}

      {replacementPrintJobs.length > 0 && (
        <Alert severity="warning">
          <Typography fontWeight={850}>Reimpresión obligatoria por relevo</Typography>
          <Typography variant="body2">
            La preetiqueta anterior se invalida y debe reemplazarse. Abre todos estos trabajos en la estación de pesaje:
          </Typography>
          <Box component="ul" sx={{ my: 0.75, pl: 2.5 }}>
            {replacementPrintJobs.map((job) => {
              const labelCount = job.labels?.length || 0;
              return (
                <Typography component="li" key={job.print_job_id} variant="body2">
                  <strong>{job.print_job_id}</strong> · {labelCount} {labelCount === 1 ? 'etiqueta' : 'etiquetas'}
                </Typography>
              );
            })}
          </Box>
        </Alert>
      )}

      <Dialog open={Boolean(workActionDialog)} onClose={() => setWorkActionDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          {workActionDialog?.action === 'anular' ? 'Anular Trabajo de color' : 'Pausar Trabajo de color'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity={workActionDialog?.action === 'anular' ? 'warning' : 'info'}>
              {workActionDialog?.action === 'anular'
                ? 'La evidencia se conserva y las mangas sin pesar devolverán su cupo.'
                : 'Podrás iniciar otro color y reanudar este trabajo más adelante.'}
            </Alert>
            <TextField
              autoFocus
              multiline
              minRows={2}
              label={workActionDialog?.action === 'anular' ? 'Motivo obligatorio' : 'Motivo de pausa opcional'}
              value={workActionReason}
              onChange={(event) => setWorkActionReason(event.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWorkActionDialog(null)}>Cancelar</Button>
          <Button
            variant="contained"
            color={workActionDialog?.action === 'anular' ? 'error' : 'warning'}
            disabled={busy || (workActionDialog?.action === 'anular' && !workActionReason.trim())}
            onClick={submitWorkDialog}
          >
            {workActionDialog?.action === 'anular' ? 'Anular trabajo' : 'Pausar trabajo'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(mangaActionDialog)} onClose={() => setMangaActionDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          {mangaActionDialog?.type === 'annul' ? 'Anular manga' : 'Reemplazar etiqueta'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="warning">
              {mangaActionDialog?.type === 'annul'
                ? 'La manga y sus etiquetas quedarán anuladas; no se elimina la evidencia.'
                : 'La etiqueta actual será invalidada y se generará otra identidad imprimible.'}
            </Alert>
            <TextField
              autoFocus
              multiline
              minRows={3}
              label="Motivo obligatorio"
              value={mangaActionReason}
              onChange={(event) => setMangaActionReason(event.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMangaActionDialog(null)}>Cancelar</Button>
          <Button
            variant="contained"
            color={mangaActionDialog?.type === 'annul' ? 'error' : 'primary'}
            disabled={busy || !mangaActionReason.trim()}
            onClick={submitMangaAction}
          >
            Confirmar acción
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(weighingDialog)} onClose={() => setWeighingDialog(null)} fullWidth maxWidth="md">
        <DialogTitle>Pesaje de {weighingDialog?.manga?.codigo}</DialogTitle>
        <DialogContent>
          {weighingBusy && <CircularProgress size={24} />}
          {weighingDialog?.detail?.original && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              {weighingDialog.detail.anulacion && (
                <Alert severity="warning">
                  Pesaje anulado: {weighingDialog.detail.anulacion.motivo}. Los QR anteriores ya no son válidos.
                </Alert>
              )}
              <Alert severity="info">
                El original es inmutable. Una corrección aprobada crea una proyección vigente y otra etiqueta final.
              </Alert>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead><TableRow>
                    <TableCell>Versión</TableCell>
                    <TableCell align="right">Bruto kg</TableCell>
                    <TableCell align="right">Tara kg</TableCell>
                    <TableCell align="right">Neto físico kg</TableCell>
                    <TableCell align="right">Cantidad un</TableCell>
                    <TableCell align="right">Kg trabajo</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {[
                      ['Original', weighingDialog.detail.original],
                      ['Vigente', weighingDialog.detail.vigente],
                    ].filter(([, value]) => value).map(([label, value]) => (
                      <TableRow key={label}>
                        <TableCell>{label}</TableCell>
                        <TableCell align="right">{value.peso_bruto_kg}</TableCell>
                        <TableCell align="right">{value.tara_kg}</TableCell>
                        <TableCell align="right">{value.peso_fisico_neto_kg}</TableCell>
                        <TableCell align="right">{value.cantidad_confirmada}</TableCell>
                        <TableCell align="right">{value.kg_produccion_ot}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {canRequestCorrection && !weighingDialog.detail.anulacion && (
                <>
                  <Divider />
                  <Typography fontWeight={850}>Solicitar corrección</Typography>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                    <TextField
                      type="number"
                      label="Bruto kg"
                      size="small"
                      value={correctionForm.peso_bruto_kg}
                      onChange={(event) => setCorrectionForm({
                        ...correctionForm, peso_bruto_kg: event.target.value,
                      })}
                    />
                    <TextField
                      type="number"
                      label="Tara kg"
                      size="small"
                      value={correctionForm.tara_kg}
                      onChange={(event) => setCorrectionForm({
                        ...correctionForm, tara_kg: event.target.value,
                      })}
                    />
                    <TextField
                      type="number"
                      label="Cantidad un"
                      size="small"
                      value={correctionForm.cantidad_confirmada}
                      onChange={(event) => setCorrectionForm({
                        ...correctionForm, cantidad_confirmada: event.target.value,
                      })}
                    />
                  </Stack>
                  <TextField
                    label="Motivo obligatorio"
                    multiline
                    minRows={2}
                    value={correctionForm.motivo}
                    onChange={(event) => setCorrectionForm({
                      ...correctionForm, motivo: event.target.value,
                    })}
                  />
                  <Button
                    variant="outlined"
                    disabled={weighingBusy || !correctionForm.motivo.trim()}
                    onClick={requestWeighingCorrection}
                  >
                    Solicitar corrección
                  </Button>
                </>
              )}

              {canAnnulWeighing && !weighingDialog.detail.anulacion && (
                <Paper variant="outlined" sx={{ p: 1.5, borderColor: 'error.light' }}>
                  <Stack spacing={1}>
                    <Typography fontWeight={850} color="error">Anular pesaje</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Invalida ambas etiquetas, anula la manga y devuelve su cupo al Trabajo de color. Si ingresó a Almacén, exige primero la reversa.
                    </Typography>
                    <TextField
                      label="Motivo de anulación"
                      multiline
                      minRows={2}
                      value={annulmentForm.motivo}
                      onChange={(event) => setAnnulmentForm({
                        ...annulmentForm, motivo: event.target.value,
                      })}
                    />
                    <TextField
                      label="Evidencia opcional"
                      value={annulmentForm.evidencia}
                      onChange={(event) => setAnnulmentForm({
                        ...annulmentForm, evidencia: event.target.value,
                      })}
                    />
                    <Button
                      color="error"
                      variant="contained"
                      disabled={weighingBusy || !annulmentForm.motivo.trim()}
                      onClick={annulWeighing}
                    >
                      Anular pesaje definitivamente
                    </Button>
                  </Stack>
                </Paper>
              )}

              {weighingDialog.detail.correcciones?.map((correction) => (
                <Paper key={correction.id} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography fontWeight={800}>
                        {correction.estado} · solicitante #{correction.requested_by_id}
                      </Typography>
                      <Typography variant="body2">{correction.reason}</Typography>
                    </Box>
                    {canApproveCorrection && correction.estado === 'PENDIENTE' && (
                      <Button
                        variant="contained"
                        color="warning"
                        disabled={weighingBusy}
                        onClick={() => approveWeighingCorrection(correction.id)}
                      >
                        Aprobar corrección
                      </Button>
                    )}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setWeighingDialog(null)}>Cerrar</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}
