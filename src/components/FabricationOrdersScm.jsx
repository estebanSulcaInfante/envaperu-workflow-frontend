import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, Checkbox, FormControl, FormControlLabel, InputLabel,
  MenuItem, Paper, Select, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography, LinearProgress, IconButton,
  ToggleButton, ToggleButtonGroup, Pagination,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import FactoryOutlinedIcon from '@mui/icons-material/FactoryOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { Link as RouterLink, useLocation, useSearchParams } from 'react-router-dom';
import {
  obtenerColores, obtenerMaquinas, obtenerMoldes, obtenerRecetasColorMaestras,
} from '../services/api';
import {
  cerrarOrdenFabricacionScm,
  anularOrdenFabricacionScm,
  reemplazarOrdenFabricacionScm,
  configurarOrdenFabricacionScm,
  liberarOrdenFabricacionScm,
  listarOrdenesFabricacionScm,
} from '../services/scmOtApi';
import {
  mensajeErrorScm,
} from '../services/scmEngineeringApi';
import * as scmEngineeringApi from '../services/scmEngineeringApi';
import PageHeader from './ui/PageHeader';
import ProcessJourney from './ui/ProcessJourney';
import EmptyState from './ui/EmptyState';
import OrderScheduleStrip from './ui/OrderScheduleStrip';
import { useScmActor } from '../context/ScmActorContext';
import ExceptionalFabricationOrderDialog from './ExceptionalFabricationOrderDialog';
import FabricationRecipeSelector from './FabricationRecipeSelector';
import FabricationContextualRecipePanel from './FabricationContextualRecipePanel';
import DraftOrderAnnulment from './DraftOrderAnnulment';
import FabricationOrderReplacement from './FabricationOrderReplacement';
import FabricationObjectivesTable from './FabricationObjectivesTable';
import { obtenerOrdenFabricacionScm } from '../services/scmOtApi';
import { listarAvanceOfScm } from '../services/scmProductionObservabilityApi';
import { defaultRecipeForRun } from './fabricationRecipeOptions';
import DataTableToolbar from './ui/DataTableToolbar';
import DocumentHeader, { DocumentStatus } from './ui/DocumentHeader';
import DocumentSection from './ui/DocumentSection';
import SearchableCatalogAutocomplete from './ui/SearchableCatalogAutocomplete';
import WeightInput from './ui/WeightInput';
import { formatKg as formatProgressKg } from '../utils/weightDisplay';
import {
  displayProvenance, filterAndSortOrders, paginateOrders, projectOrderProgress, statusLabel,
} from './fabricationOrdersModel';
import {
  fabricationProcessLabel, normalizeFabricationProcess, resolveFabricationProcess,
} from './fabricationRoutes';

const statusColor = {
  BORRADOR: 'default',
  LIBERADA: 'info',
  PROGRAMADA: 'info',
  EN_EJECUCION: 'primary',
  CERRADA: 'default',
  ANULADA: 'error',
};

const catalogLabels = {
  moldes: 'moldes',
  maquinas: 'máquinas',
  colores: 'colores',
  recetas: 'recetas',
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
  proceso: order?.snapshot_proceso
    || (order?.plan_produccion_id || order?.estado !== 'BORRADOR'
      ? order?.proceso_requerido || '' : ''),
  procesoOverride: order?.fuente_proceso === 'EXPLICITO',
  molde_id: order?.molde_id || '',
  maquina_prevista_id: order?.maquina_prevista_id || '',
  snapshot_tiempo_ciclo_seg: order?.snapshot_tiempo_ciclo_seg || '',
  snapshot_horas_turno: order?.snapshot_horas_turno || '8',
  snapshot_peso_colada_gr: order?.snapshot_peso_colada_gr ?? '',
  corridas: (order?.corridas || []).map((run) => ({
    id: run.id,
    color_produccion_id: run.color_produccion_id || '',
    receta_revision_id: run.receta_revision_id
      || (order?.origen_demanda !== 'REEMPLAZO_OF'
        ? defaultRecipeForRun(recipes, run, run.color_produccion_id)?.id
        : '')
      || '',
    ciclos_objetivo: run.ciclos_objetivo || '',
    objetivo_neto_kg: run.objetivo_neto_kg ?? '',
    operacion_ruta_revision_id: run.operacion_ruta_revision_id
      ?? run.operacion_ruta?.id
      ?? '',
    legacyWithoutNetTarget: (run.lote_color_legacy_id != null || run.meta_kg_legacy != null)
      && run.objetivo_neto_kg == null,
    salidas: run.salidas.map((output) => ({
      id: output.id,
      cantidad_por_ciclo: output.cantidad_por_ciclo_snapshot || '',
      peso_unitario_g: output.peso_unitario_snapshot_g || '',
    })),
  })),
});

const suggestedForm = (order, molds, recipes = []) => {
  const next = formFromOrder(order, recipes);
  if (!order || order.estado !== 'BORRADOR') return next;
  const compatibleMolds = compatibleMoldsForOrder(order, molds);
  if (!next.molde_id && compatibleMolds.length === 1) {
    const mold = compatibleMolds[0];
    next.molde_id = mold.codigo;
    next.snapshot_tiempo_ciclo_seg = mold.tiempo_ciclo_std ?? '';
    next.snapshot_peso_colada_gr = Math.max(Number(mold.peso_colada_gr || 0), 0);
  }
  return next;
};

const orderMoldLabel = (order, molds = []) => {
  const mold = molds.find((item) => item.codigo === order?.molde_id);
  return { name: mold?.nombre || order?.molde?.nombre || 'Molde sin descripción', code: mold?.codigo || order?.molde_id || '—' };
};

const firstColorLabel = (order) => {
  const labels = (order?.corridas || []).map((run) => (
    run?.color || run?.color_nombre || run?.color_produccion?.nombre
      || run?.salidas?.[0]?.articulo?.nombre || ''
  )).filter(Boolean);
  return labels.length ? labels.join(' · ') : '—';
};

const progressColor = (percentage) => {
  if (percentage >= 95) return 'success';
  if (percentage >= 80) return 'warning';
  return 'error';
};

function ProgressSummary({ progress }) {
  if (!progress || progress.state === 'restricted') {
    return <Typography variant="body2" color="text.secondary">Avance restringido</Typography>;
  }
  if (progress.state === 'error') {
    return <Typography variant="body2" color="error.main">Avance no disponible · Actualiza la bandeja</Typography>;
  }
  if (progress.state !== 'ready') {
    return (
      <Stack spacing={0.25}>
        <Typography variant="body2">{progress.label}</Typography>
        {progress.kgFinalizados != null && (
          <Typography variant="caption" color="text.secondary" title={`${progress.kgFinalizados} kg finalizados; ${progress.kgAbiertas ?? '—'} kg en abiertas (valores originales)`}>
            {formatProgressKg(progress.kgFinalizados)} kg finalizados · {formatProgressKg(progress.kgAbiertas)} kg en abiertas
          </Typography>
        )}
      </Stack>
    );
  }
  return (
    <Stack spacing={0.25} sx={{ minWidth: 150 }}>
      <Stack direction="row" justifyContent="space-between" spacing={1}>
        <Typography variant="body2" fontWeight={750} title={`${progress.kgFinalizados} / ${progress.metaTotal} kg (valores originales)`}>
          {formatProgressKg(progress.kgFinalizados)} / {formatProgressKg(progress.metaTotal)} kg
        </Typography>
        <Typography variant="caption" fontWeight={750}>{progress.percentage.toFixed(1)}%</Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={Math.min(100, Math.max(0, progress.percentage))}
        color={progressColor(progress.percentage)}
        aria-label="Cumplimiento del objetivo"
      />
      <Typography variant="caption" color="text.secondary" title={progress.kgAbiertas != null ? `${progress.kgAbiertas} kg (valor original)` : undefined}>
        {formatProgressKg(progress.kgAbiertas)} kg en abiertas
      </Typography>
    </Stack>
  );
}

export default function FabricationOrdersScm() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const requestedOrderId = searchParams.get('of') || '';
  const query = searchParams.get('q') || '';
  const queryStatus = ['SIN_ANULADAS', 'TODOS', ...Object.keys(statusColor)].includes(searchParams.get('estado'))
    ? (searchParams.get('estado') || 'SIN_ANULADAS') : 'SIN_ANULADAS';
  const queryView = searchParams.get('vista') === 'kanban' ? 'kanban' : 'tabla';
  const queryPageSize = [25, 50, 100].includes(Number(searchParams.get('tamano')))
    ? Number(searchParams.get('tamano')) : 25;
  const queryPage = Math.max(1, Number(searchParams.get('pagina')) || 1);
  const queryOrder = searchParams.get('orden') === 'codigo' ? 'codigo' : 'reciente';
  const { can, experience } = useScmActor();
  const canEdit = can('OF_EDITAR_BORRADOR');
  const canRelease = can('OF_LIBERAR');
  const canClose = can('OF_CERRAR');
  const canCreateExceptional = can('OF_EXCEPCIONAL_CREAR');
  const canViewOt = can('OT_VER');
  const canViewWeights = can('MANGA_PESAJE_VER');
  const [orders, setOrders] = useState([]);
  const ordersRef = useRef([]);
  const [staleData, setStaleData] = useState(false);
  const [detailOrder, setDetailOrder] = useState(null);
  const [progressItems, setProgressItems] = useState([]);
  const [progressState, setProgressState] = useState('idle');
  const [molds, setMolds] = useState([]);
  const [machines, setMachines] = useState([]);
  const [colors, setColors] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [catalogStatus, setCatalogStatus] = useState({
    moldes: { loading: false, error: '' },
    maquinas: { loading: false, error: '' },
    colores: { loading: false, error: '' },
    recetas: { loading: false, error: '' },
  });
  const [form, setForm] = useState(formFromOrder(null));
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [exceptionalOpen, setExceptionalOpen] = useState(false);
  const [formulaRunIndex, setFormulaRunIndex] = useState(null);
  const [formulaDirty, setFormulaDirty] = useState(false);
  const [formulaBusy, setFormulaBusy] = useState(false);
  const [draftDirty, setDraftDirty] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [discardRequest, setDiscardRequest] = useState(null);
  const [expandedRuns, setExpandedRuns] = useState({});
  const focusedOrderRef = useRef(null);
  const inboxRef = useRef(null);
  const loadGenerationRef = useRef(0);
  const acceptedHistoryIndexRef = useRef(window.history.state?.idx ?? null);
  const restoringHistoryRef = useRef(false);
  const pendingPopTargetRef = useRef(null);
  const allowNextPopRef = useRef(false);
  const navigationStateRef = useRef({ busy: true, formulaBusy: false, draftDirty: false, formulaDirty: false });
  const catalogGenerationRef = useRef({});
  const routeGenerationRef = useRef(0);
  const [detailRoutesByArticle, setDetailRoutesByArticle] = useState({});
  const [detailRoutesLoading, setDetailRoutesLoading] = useState(false);
  const [detailRoutesError, setDetailRoutesError] = useState('');

  const loadCatalog = useCallback((key) => {
    const requests = {
      moldes: () => obtenerMoldes(),
      maquinas: () => obtenerMaquinas(),
      colores: () => obtenerColores(),
      recetas: () => obtenerRecetasColorMaestras(),
    };
    const apply = {
      moldes: (value) => setMolds((value || []).filter((item) => item.activo)),
      maquinas: (value) => setMachines((value || []).filter((item) => item.activo)),
      colores: (value) => setColors((value || []).filter((item) => item.activo !== false)),
      recetas: (value) => setRecipes(value?.items || []),
    };
    const request = requests[key];
    if (!request) return Promise.resolve();
    const generation = (catalogGenerationRef.current[key] || 0) + 1;
    catalogGenerationRef.current[key] = generation;
    setCatalogStatus((current) => ({
      ...current,
      [key]: { loading: true, error: '' },
    }));
    return request()
      .then((value) => {
        if (catalogGenerationRef.current[key] !== generation) return;
        apply[key](value);
        setCatalogStatus((current) => ({
          ...current,
          [key]: { loading: false, error: '' },
        }));
      })
      .catch((requestError) => {
        if (catalogGenerationRef.current[key] !== generation) return;
        setCatalogStatus((current) => ({
          ...current,
          [key]: {
            loading: false,
            error: mensajeErrorScm(requestError, `No se pudieron cargar ${catalogLabels[key]}.`),
          },
        }));
      });
  }, []);

  const selected = useMemo(
    () => requestedOrderId ? detailOrder : null,
    [detailOrder, requestedOrderId],
  );
  const compatibleMolds = useMemo(
    () => compatibleMoldsForOrder(selected, molds),
    [selected, molds],
  );
  const processResolution = useMemo(() => resolveFabricationProcess(
    form.procesoOverride ? form.proceso : '',
    (selected?.corridas || []).map((run, runIndex) => ({
      ...run,
      ...form.corridas?.[runIndex],
      salidas: run.salidas,
    })),
    detailRoutesByArticle,
  ), [detailRoutesByArticle, form.corridas, form.proceso, form.procesoOverride, selected?.corridas]);
  const routeProcesses = [...new Set(processResolution.linked.map((option) => option.proceso).filter(Boolean))];
  const derivableRouteProcess = routeProcesses.length === 1 ? routeProcesses[0] : '';
  const liveProcess = processResolution.process || selected?.proceso_requerido || '';
  const processSelectValue = form.procesoOverride
    ? form.proceso
    : (processResolution.complete && derivableRouteProcess
      ? `DERIVADO_${derivableRouteProcess}`
      : '');
  const compatibleMachines = useMemo(
    () => compatibleMachinesForOrder({ ...selected, proceso_requerido: liveProcess }, machines),
    [liveProcess, machines, selected],
  );
  const selectedMold = useMemo(
    () => molds.find((item) => item.codigo === form.molde_id) || null,
    [form.molde_id, molds],
  );
  const moldSelectorOptions = useMemo(() => {
    if (!form.molde_id || compatibleMolds.some((item) => item.codigo === form.molde_id)) return compatibleMolds;
    return [{ codigo: form.molde_id, nombre: selected?.molde?.nombre || 'Molde seleccionado', activo: false }, ...compatibleMolds];
  }, [compatibleMolds, form.molde_id, selected?.molde?.nombre]);
  const machineSelectorOptions = useMemo(() => {
    if (!form.maquina_prevista_id || compatibleMachines.some((item) => String(item.id) === String(form.maquina_prevista_id))) return compatibleMachines;
    return [{ id: form.maquina_prevista_id, codigo: String(form.maquina_prevista_id), nombre: 'Máquina seleccionada', activo: false }, ...compatibleMachines];
  }, [compatibleMachines, form.maquina_prevista_id]);

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    setStaleData(false);
    let active = true;
    const generation = ++loadGenerationRef.current;
    const current = () => active && generation === loadGenerationRef.current;
    const listPromise = listarOrdenesFabricacionScm()
      .then((value) => ({ status: 'fulfilled', value }))
      .catch((reason) => ({ status: 'rejected', reason }));
    const detailPromise = requestedOrderId
      ? obtenerOrdenFabricacionScm(requestedOrderId)
        .then((value) => ({ status: 'fulfilled', value }))
        .catch((reason) => ({ status: 'rejected', reason }))
      : null;
    const [listResult, detailResult] = await Promise.all([
      listPromise,
      detailPromise || Promise.resolve(null),
    ]);
    if (current()) {
      const listAccessDenied = listResult.status === 'rejected'
        && [401, 403].includes(listResult.reason?.response?.status || listResult.reason?.status);
      const detailAccessDenied = detailResult?.status === 'rejected'
        && [401, 403].includes(detailResult.reason?.response?.status || detailResult.reason?.status);
      if (listAccessDenied || detailAccessDenied) {
        ordersRef.current = [];
        setOrders([]);
        setStaleData(false);
        setProgressItems([]);
        setProgressState('restricted');
        setDetailOrder(null);
        setForm(formFromOrder(null));
        setDraftDirty(false);
        setError('No tienes permiso para consultar la bandeja de OF. Verifica tu sesión o solicita OF_VER.');
      } else {
        if (listResult.status === 'fulfilled') {
          const nextOrders = listResult.value.items || [];
          ordersRef.current = nextOrders;
          setOrders(nextOrders);
        } else if (ordersRef.current.length) {
          setStaleData(true);
          const detail = mensajeErrorScm(listResult.reason, '');
          setError(`No se pudo actualizar la bandeja. Se muestran datos anteriores.${detail ? ` ${detail}` : ''}`);
        }
        if (requestedOrderId) {
          if (detailResult.status === 'fulfilled') {
            setDetailOrder(detailResult.value);
            setForm(suggestedForm(detailResult.value, [], []));
            setDraftDirty(false);
          } else {
            setDetailOrder(null);
            setError(mensajeErrorScm(detailResult.reason, 'La OF no está disponible.'));
          }
        } else if (listResult.status === 'rejected' && !ordersRef.current.length) {
          setError(mensajeErrorScm(listResult.reason, 'No se pudieron cargar las OF.'));
        }
      }
      setBusy(false);
    }
    loadCatalog('moldes');
    loadCatalog('maquinas');
    loadCatalog('colores');
    loadCatalog('recetas');
    return () => { active = false; };
  }, [loadCatalog, requestedOrderId]);

  useEffect(() => {
    const state = navigationStateRef.current;
    if (state.draftDirty || state.formulaDirty || state.formulaBusy || (state.busy && loadGenerationRef.current > 0)) return;
    load();
  }, [load]);

  useEffect(() => {
    if (!selected || draftDirty) return undefined;
    setForm(suggestedForm(selected, molds, recipes));
    return undefined;
  }, [selected, molds, recipes, draftDirty]);

  useEffect(() => {
    const articleIds = selected?.corridas?.flatMap((run) => (run.salidas || [])
      .map((output) => output.articulo?.id
        ?? output.articulo_salida?.id
        ?? output.articulo_scm_id
        ?? output.articulo_id
        ?? output.articulo_salida_id)
      .filter((id) => id != null)
      .map(String)) || [];
    const uniqueIds = [...new Set(articleIds)];
    if (!selected || !uniqueIds.length) {
      setDetailRoutesByArticle({});
      setDetailRoutesLoading(false);
      setDetailRoutesError('');
      return undefined;
    }
    const generation = ++routeGenerationRef.current;
    let active = true;
    setDetailRoutesLoading(true);
    setDetailRoutesError('');
    let listRoutes;
    try {
      listRoutes = scmEngineeringApi.listarRutasArticuloScm;
    } catch {
      listRoutes = null;
    }
    listRoutes ||= (() => Promise.resolve([]));
    Promise.all(uniqueIds.map((articleId) => listRoutes(articleId).then((items) => [articleId, items || []])))
      .then((entries) => {
        if (active && routeGenerationRef.current === generation) setDetailRoutesByArticle(Object.fromEntries(entries));
      })
      .catch((requestError) => {
        if (active && routeGenerationRef.current === generation) {
          setDetailRoutesByArticle({});
          setDetailRoutesError(mensajeErrorScm(requestError, 'No se pudieron cargar las rutas del objetivo.'));
        }
      })
      .finally(() => {
        if (active && routeGenerationRef.current === generation) setDetailRoutesLoading(false);
      });
    return () => { active = false; };
  }, [selected]);

  useEffect(() => {
    if (!busy && !formulaBusy && !draftDirty && !formulaDirty) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [busy, formulaBusy, draftDirty, formulaDirty]);

  useLayoutEffect(() => {
    navigationStateRef.current = { busy, formulaBusy, draftDirty, formulaDirty };
    if (!busy && !formulaBusy && !draftDirty && !formulaDirty) {
      acceptedHistoryIndexRef.current = window.history.state?.idx ?? null;
    }
  }, [location.key, busy, formulaBusy, draftDirty, formulaDirty]);

  useEffect(() => {
    const onPopState = (event) => {
      const { busy, formulaBusy, draftDirty, formulaDirty } = navigationStateRef.current;
      if (allowNextPopRef.current) {
        allowNextPopRef.current = false;
        acceptedHistoryIndexRef.current = window.history.state?.idx ?? null;
        return;
      }
      if (restoringHistoryRef.current) {
        event.stopImmediatePropagation();
        const expectedIndex = acceptedHistoryIndexRef.current;
        const observedIndex = window.history.state?.idx;
        if (Number.isInteger(expectedIndex) && Number.isInteger(observedIndex) && observedIndex !== expectedIndex) {
          window.history.go(expectedIndex - observedIndex);
          return;
        }
        restoringHistoryRef.current = false;
        acceptedHistoryIndexRef.current = window.history.state?.idx ?? null;
        const targetIndex = pendingPopTargetRef.current;
        pendingPopTargetRef.current = null;
        if (targetIndex != null) {
          setDiscardRequest(() => () => {
            setDraftDirty(false);
            setFormulaDirty(false);
            allowNextPopRef.current = true;
            const currentIndex = window.history.state?.idx;
            acceptedHistoryIndexRef.current = targetIndex;
            if (Number.isInteger(currentIndex) && Number.isInteger(targetIndex)) {
              window.history.go(targetIndex - currentIndex);
            }
          });
        }
        return;
      }
      if (!busy && !formulaBusy && !draftDirty && !formulaDirty) {
        acceptedHistoryIndexRef.current = window.history.state?.idx ?? null;
        return;
      }
      if (busy || formulaBusy) {
        event.stopImmediatePropagation();
        const currentIndex = acceptedHistoryIndexRef.current;
        const nextIndex = window.history.state?.idx;
        if (Number.isInteger(currentIndex) && Number.isInteger(nextIndex) && currentIndex !== nextIndex) {
          restoringHistoryRef.current = true;
          window.history.go(currentIndex - nextIndex);
        }
        return;
      }
      event.stopImmediatePropagation();
      const currentIndex = acceptedHistoryIndexRef.current;
      const nextIndex = window.history.state?.idx;
      if (Number.isInteger(currentIndex) && Number.isInteger(nextIndex) && currentIndex !== nextIndex) {
        restoringHistoryRef.current = true;
        pendingPopTargetRef.current = nextIndex;
        window.history.go(currentIndex - nextIndex);
      } else {
        setDiscardRequest(() => () => {
          setDraftDirty(false);
          setFormulaDirty(false);
        });
      }
    };
    window.addEventListener('popstate', onPopState, true);
    return () => window.removeEventListener('popstate', onPopState, true);
  }, []);

  useEffect(() => {
    if (!canViewOt) {
      setProgressItems([]);
      setProgressState('restricted');
      return undefined;
    }
    const controller = new AbortController();
    setProgressState('loading');
    listarAvanceOfScm({ signal: controller.signal })
      .then((payload) => {
        setProgressItems(payload?.items || []);
        setProgressState('ready');
      })
      .catch((requestError) => {
        if (requestError?.name === 'CanceledError' || requestError?.name === 'AbortError') return;
        if ([401, 403].includes(requestError?.response?.status)) {
          setProgressItems([]);
          setProgressState('restricted');
        } else {
          setProgressState('error');
        }
      });
    return () => controller.abort();
  }, [canViewOt, requestedOrderId, orders]);

  const updateQuery = (changes, { replace = false } = {}) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace });
  };

  const leaveDetail = (callback) => {
    if (busy || formulaBusy) {
      setError('Hay una operación en curso. Espera a que termine antes de salir.');
      return false;
    }
    if (draftDirty || formulaDirty) {
      setDiscardRequest(() => () => {
        setDraftDirty(false);
        setFormulaDirty(false);
        callback();
      });
      return false;
    }
    callback();
    return true;
  };

  const chooseMold = (moldId) => {
    const mold = molds.find((item) => item.codigo === moldId);
    setForm((current) => ({
      ...current,
      molde_id: moldId,
      snapshot_tiempo_ciclo_seg: mold?.tiempo_ciclo_std ?? '',
      snapshot_peso_colada_gr: Math.max(Number(mold?.peso_colada_gr || 0), 0),
    }));
    setDraftDirty(true);
  };

  const changeRun = (runIndex, values) => {
    setForm((current) => ({
      ...current,
      ...(Object.prototype.hasOwnProperty.call(values, 'operacion_ruta_revision_id')
        ? { maquina_prevista_id: '' }
        : {}),
      corridas: current.corridas.map((run, index) => (
        index === runIndex ? { ...run, ...values } : run
      )),
    }));
    setDraftDirty(true);
  };

  const recipeSavedInWorkspace = async (result) => {
    const draftSnapshot = form;
    const preserveDraft = draftDirty;
    await load();
    setForm((current) => ({
      ...current,
      ...(preserveDraft ? draftSnapshot : {}),
      corridas: current.corridas.map((run, index) => (
        index === formulaRunIndex
          ? {
            ...run,
            ...(preserveDraft ? draftSnapshot.corridas[index] : {}),
            ...(result?.seleccionada && result?.receta?.id
              ? { receta_revision_id: result.receta.id }
              : {}),
          }
          : (preserveDraft ? draftSnapshot.corridas[index] : run) || run
      )),
    }));
    setDraftDirty(preserveDraft);
    setNotice(result?.receta?.estado === 'APROBADA'
      ? 'Formulación aprobada y seleccionada en la OF. Revisa la configuración antes de liberarla.'
      : 'Formulación guardada en borrador. Debe aprobarse antes de seleccionarla en la OF.');
    setFormulaRunIndex(null);
  };

  const closeFormulaWorkspace = () => {
    if (formulaBusy) return;
    if (formulaDirty) {
      setDiscardRequest(() => () => {
        setFormulaRunIndex(null);
        setFormulaDirty(false);
      });
      return;
    }
    setFormulaRunIndex(null);
  };

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
    setDraftDirty(true);
  };

  const configure = async () => {
    if (busy || formulaBusy || !canEdit) return;
    if (!selected || !form.molde_id) {
      setError('Selecciona un molde.');
      return;
    }
    if (selected.fuente_proceso === 'RUTA_OBJETIVOS' && !processResolution.valid) {
      setError('Las rutas seleccionadas no resuelven un único proceso compatible. Selecciona Inyección o Soplado explícitamente, o corrige los vínculos de ruta antes de guardar.');
      return;
    }
    if (selected.origen_demanda !== 'REEMPLAZO_OF'
      && selected.plan_produccion_id == null
      && !normalizeFabricationProcess(form.proceso)
      && !processResolution.process) {
      setError('Este borrador excepcional necesita un proceso explícito: selecciona Inyección o Soplado antes de guardar.');
      return;
    }
    if (selected.origen_demanda !== 'REEMPLAZO_OF' && selected.estado === 'BORRADOR') {
      const missingObjective = form.corridas.some((run) => (
        !run.legacyWithoutNetTarget && (!Number.isFinite(Number(run.objetivo_neto_kg)) || !(Number(run.objetivo_neto_kg) > 0))
      ));
      if (missingObjective) {
        setError('Completa el objetivo neto en kg de cada objetivo de color nuevo para calcular sus ciclos antes de guardar.');
        return;
      }
    }
    const invalidOutput = selected.corridas.some((run, runIndex) => (
      run.salidas.some((output, outputIndex) => {
        if (output.articulo?.pieza_id != null) return false;
        const draftOutput = form.corridas?.[runIndex]?.salidas?.[outputIndex] || {};
        return !Number.isFinite(Number(draftOutput.cantidad_por_ciclo)) || !Number.isFinite(Number(draftOutput.peso_unitario_g))
          || !(Number(draftOutput.cantidad_por_ciclo) > 0) || !(Number(draftOutput.peso_unitario_g) > 0);
      })
    ));
    if (invalidOutput) {
      setError('Corrige las salidas editables: cantidad por ciclo y peso unitario deben ser positivos.');
      return;
    }
    if (selected.origen_demanda !== 'REEMPLAZO_OF' && (form.snapshot_peso_colada_gr === '' || !Number.isFinite(Number(form.snapshot_peso_colada_gr)) || Number(form.snapshot_peso_colada_gr) < 0
      || Number(form.snapshot_peso_colada_gr) > 99999)) {
      setError('Indica el material no neto por ciclo entre 0 y 99999 g; usa 0 si no corresponde.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = selected.origen_demanda === 'REEMPLAZO_OF'
        ? {
          version: selected.version,
          corridas: form.corridas.map((run) => ({
            id: run.id,
            receta_revision_id: run.receta_revision_id
              ? Number(run.receta_revision_id) : null,
          })),
        }
        : {
          version: selected.version,
          ...(form.procesoOverride && form.proceso
            ? { proceso: normalizeFabricationProcess(form.proceso) }
            : (!form.procesoOverride && selected.fuente_proceso === 'EXPLICITO' && processResolution.valid
              ? { proceso: null }
              : {})),
          molde_id: form.molde_id,
          maquina_prevista_id: form.maquina_prevista_id ? Number(form.maquina_prevista_id) : null,
          snapshot_tiempo_ciclo_seg: Number(form.snapshot_tiempo_ciclo_seg),
          snapshot_horas_turno: Number(form.snapshot_horas_turno),
          snapshot_peso_colada_gr: Number(form.snapshot_peso_colada_gr),
          corridas: form.corridas.map((run, runIndex) => ({
            id: run.id,
            color_produccion_id: run.color_produccion_id
              ? Number(run.color_produccion_id) : null,
            receta_revision_id: run.receta_revision_id
              ? Number(run.receta_revision_id) : null,
            ...(selected.plan_produccion_id ? {} : (() => {
              const persistedRouteId = selected.corridas[runIndex]?.operacion_ruta_revision_id
                ?? selected.corridas[runIndex]?.operacion_ruta?.id
                ?? '';
              const currentRouteId = run.operacion_ruta_revision_id || '';
              if (String(currentRouteId) === String(persistedRouteId)) return {};
              return {
                operacion_ruta_revision_id: currentRouteId ? Number(currentRouteId) : null,
              };
            })()),
            ...(Number(run.objetivo_neto_kg) > 0
              ? { objetivo_neto_kg: Number(run.objetivo_neto_kg) }
              : Number(run.ciclos_objetivo) > 0
                ? { ciclos_objetivo: Number(run.ciclos_objetivo) }
                : {}),
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
      setNotice(selected.origen_demanda === 'REEMPLAZO_OF'
        ? `${result.codigo}: receta guardada; cantidades y parámetros originales conservados.`
        : `${result.codigo} configurada. Revisa los ciclos calculados antes de liberarla.`);
      setDraftDirty(false);
      await load();
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo configurar la OF.'));
    } finally {
      setBusy(false);
    }
  };

  const release = async () => {
    if (!selected) return;
    if (draftDirty || formulaDirty || formulaBusy) {
      setError('Guarda los cambios pendientes de la OF o de la formulación antes de liberar.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await liberarOrdenFabricacionScm(selected.id, selected.version);
      setNotice(`${result.codigo} liberada; ya puede generar su plan de mangas y OT.`);
      await load();
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo liberar la OF.'));
    } finally {
      setBusy(false);
    }
  };

  const closeOrder = async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const result = await cerrarOrdenFabricacionScm(selected.id, {
        version: selected.version,
        ...(closeReason.trim() ? { motivo: closeReason.trim() } : {}),
      });
      const projected = result.cierre?.ordenes_produccion || [];
      const opSummary = projected.length
        ? ` OP: ${projected.map((item) => `${item.codigo} ${item.estado}`).join(', ')}.`
        : '';
      setNotice(result.un_confirmadas === false
        ? `${selected.codigo} cerrada: ${formatProgressKg(result.kg_medido)} kg medidos, sin movimiento de stock por el cierre.`
        : `${result.codigo} cerrada y producción acreditada.${opSummary}`);
      setCloseReason('');
      await load();
    } catch (requestError) {
      setError(mensajeErrorScm(
        requestError,
        'No se pudo cerrar la OF. Revisa trabajos, mangas y diferencias de cantidad.',
      ));
    } finally {
      setBusy(false);
    }
  };

  const filteredOrders = useMemo(() => filterAndSortOrders(orders, {
    query,
    status: queryStatus,
    order: queryOrder,
  }), [orders, query, queryOrder, queryStatus]);
  const pagedOrders = useMemo(
    () => paginateOrders(filteredOrders, queryPage, queryPageSize),
    [filteredOrders, queryPage, queryPageSize],
  );
  const progressByOrder = useMemo(() => new Map(
    filteredOrders.map((order) => [
      order.id,
      projectOrderProgress(order, progressItems, {
        canViewOt: canViewOt && progressState !== 'restricted',
        canViewWeights,
        error: progressState === 'error',
        loading: progressState === 'loading',
      }),
    ]),
  ), [canViewOt, canViewWeights, filteredOrders, progressItems, progressState]);
  const selectedProgress = useMemo(() => (selected ? projectOrderProgress(selected, progressItems, {
    canViewOt: canViewOt && progressState !== 'restricted',
    canViewWeights,
    error: progressState === 'error',
    loading: progressState === 'loading',
  }) : null), [canViewOt, canViewWeights, progressItems, progressState, selected]);
  const detailHref = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set('of', id);
    return `/produccion/ordenes-fabricacion?${next.toString()}`;
  };
  const handleOrderLinkClick = (event, id) => {
    if (busy) { event.preventDefault(); setError('Hay una operación en curso. Espera a que termine antes de salir.'); return; }
    if (draftDirty || formulaDirty) {
      event.preventDefault();
      setDiscardRequest(() => () => {
        setDraftDirty(false);
        setFormulaDirty(false);
        focusedOrderRef.current = id;
        updateQuery({ of: id });
      });
      return;
    }
    focusedOrderRef.current = id;
    setDraftDirty(false);
    setFormulaDirty(false);
  };
  const setQuery = (changes) => updateQuery({ ...changes, pagina: '1' });
  const renderOrderIdentity = (order) => {
    const mold = orderMoldLabel(order, molds);
    return (
      <Stack spacing={0.1} sx={{ minWidth: 0 }}>
        <Button
          component={RouterLink}
          to={detailHref(order.id)}
          onClick={(event) => handleOrderLinkClick(event, order.id)}
          data-of-id={order.id}
          sx={{ justifyContent: 'flex-start', p: 0, minWidth: 0, textTransform: 'none', fontWeight: 800 }}
          aria-label={`Abrir ${order.codigo}`}
        >
          {order.codigo}
        </Button>
        <Typography variant="caption" color="text.secondary" noWrap>{mold.name}</Typography>
        <Typography variant="caption" color="text.secondary" noWrap>{mold.code}</Typography>
      </Stack>
    );
  };
  const statusColumns = Object.keys(statusColor);

  useEffect(() => {
    if (requestedOrderId || !focusedOrderRef.current) return undefined;
    const targetId = focusedOrderRef.current;
    const timer = window.setTimeout(() => {
      const target = [...document.querySelectorAll('[data-of-id]')]
        .find((item) => item.dataset.ofId === targetId);
      if (target) {
        target.focus();
      } else {
        inboxRef.current?.focus();
      }
      focusedOrderRef.current = null;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pagedOrders.items, requestedOrderId]);

  return (
    <Stack spacing={2.5}>
      {!requestedOrderId && <PageHeader
        title="Órdenes de fabricación"
        description="Configura el molde, los objetivos por color y los parámetros físicos de cada OF antes de liberarla hacia OT y mangas."
        actions={(
          <Stack direction="row" spacing={1}>
            {canCreateExceptional && !requestedOrderId && (
              <Button
                startIcon={<AddOutlinedIcon />}
                variant="contained"
                onClick={() => setExceptionalOpen(true)}
              >
              Nueva OF de reposición
              </Button>
            )}
            <Button
              startIcon={<RefreshIcon />}
              variant="outlined"
              disabled={busy}
              onClick={() => leaveDetail(() => load())}
            >
              Actualizar
            </Button>
          </Stack>
        )}
      />}
      {!requestedOrderId && <ProcessJourney current="fabricacion" />}
      {!canEdit && !canRelease && (
        <Alert severity="info">
          Vista de consulta para {experience.label}. La configuración técnica y la liberación
          corresponden al responsable de producción.
        </Alert>
      )}
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {Object.entries(catalogStatus)
        .filter(([, status]) => status.error)
        .map(([key, status]) => (
          <Alert
            key={key}
            severity="warning"
            action={(
              <Button color="inherit" onClick={() => loadCatalog(key)} disabled={status.loading}>
                {status.loading ? `Reintentando ${catalogLabels[key]}…` : `Reintentar ${catalogLabels[key]}`}
              </Button>
            )}
          >
            No se pudo cargar {catalogLabels[key]}: {status.error}. La bandeja sigue disponible.
          </Alert>
        ))}
      {requestedOrderId && !busy && !selected && (
        <Button
          variant="outlined"
          onClick={() => leaveDetail(() => updateQuery({ of: null }))}
        >
          Volver a bandeja
        </Button>
      )}
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
      {selected && !requestedOrderId && <Alert severity="info">
        {selected?.origen_demanda === 'REEMPLAZO_OF'
          ? 'Este reemplazo conserva cantidades, colores y parámetros originales. Solo se modifica la receta; debes guardarla antes de liberar.'
          : 'La cantidad requerida viene del plan. Para Pieza-Color y PT monopieza, la salida por ciclo y el peso neto se derivan de MoldePieza; el sistema calcula los ciclos mínimos y el excedente técnico.'}
      </Alert>}

      {!requestedOrderId && !busy && (!error || staleData) && (
        <Stack
          spacing={2}
          data-testid="of-inbox"
          ref={inboxRef}
          tabIndex={-1}
          aria-label="Bandeja de OF"
        >
          <DataTableToolbar
            searchValue={query}
            onSearchChange={(value) => setQuery({ q: value })}
            searchPlaceholder="Buscar OF, molde, color o procedencia"
            resultCount={pagedOrders.items.length}
            totalCount={filteredOrders.length}
            filters={[{
              id: 'estado', label: 'Estado', value: queryStatus, allValue: 'TODOS',
              options: [
                { value: 'SIN_ANULADAS', label: 'Sin anuladas' },
                { value: 'TODOS', label: 'Todos los estados' },
                ...statusColumns.map((value) => ({ value, label: statusLabel(value) })),
              ],
              onChange: (value) => setQuery({ estado: value }),
            }, {
              id: 'orden', label: 'Ordenar', value: queryOrder,
              options: [{ value: 'reciente', label: 'Más recientes' }, { value: 'codigo', label: 'Código' }],
              onChange: (value) => setQuery({ orden: value }),
            }]}
            onClear={() => setQuery({ q: '', estado: 'SIN_ANULADAS', orden: 'reciente', vista: 'tabla', tamano: '25' })}
            actions={(
              <ToggleButtonGroup
                size="small"
                exclusive
                value={queryView}
                onChange={(_, value) => value && updateQuery({ vista: value })}
                aria-label="Representación de la bandeja"
              >
                <ToggleButton value="tabla" aria-label="Vista tabla">Tabla</ToggleButton>
                <ToggleButton value="kanban" aria-label="Vista kanban">Kanban</ToggleButton>
              </ToggleButtonGroup>
            )}
          />
          <Typography variant="caption" color="text.secondary">
            {pagedOrders.items.length} de {filteredOrders.length} OF · página {pagedOrders.page} de {pagedOrders.totalPages}
          </Typography>
          {filteredOrders.length === 0 ? (
            <EmptyState
              icon={<FactoryOutlinedIcon />}
              title={orders.length ? 'Sin coincidencias en la consulta' : 'Aún no hay órdenes de fabricación'}
              description={orders.length ? 'Prueba otra búsqueda o restablece la consulta.' : 'Las OF aparecerán aquí cuando una OP aprobada confirme su plan.'}
              action={orders.length ? <Button onClick={() => setQuery({ q: '', estado: 'SIN_ANULADAS' })}>Restablecer consulta</Button> : null}
            />
          ) : queryView === 'tabla' ? (
            <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
              <Table size="small" aria-label="Bandeja de órdenes de fabricación">
                <TableHead><TableRow>
                  <TableCell>OF / molde</TableCell><TableCell>Color / procedencia</TableCell>
                  <TableCell>Estado</TableCell><TableCell>Avance</TableCell>
                </TableRow></TableHead>
                <TableBody>{pagedOrders.items.map((order) => (
                  <TableRow key={order.id} hover>
                    <TableCell>{renderOrderIdentity(order)}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{firstColorLabel(order)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {displayProvenance(order.procedencia) || order.origen_demanda || order.motivo || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell><Chip size="small" label={statusLabel(order.estado)} color={statusColor[order.estado] || 'default'} /></TableCell>
                    <TableCell>
                      <ProgressSummary progress={progressByOrder.get(order.id)} />
                    </TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>
              {statusColumns.map((status) => {
                const cards = pagedOrders.items.filter((item) => item.estado === status);
                return (
                  <Paper key={status} variant="outlined" sx={{ p: 1.5, minHeight: 140 }}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Typography fontWeight={800}>{statusLabel(status)}</Typography>
                      <Typography variant="caption" color="text.secondary">{cards.length} OF en página</Typography>
                    </Stack>
                    <Stack spacing={1}>
                      {cards.map((order) => (
                        <Paper key={order.id} variant="outlined" sx={{ p: 1 }}>
                          {renderOrderIdentity(order)}
                          <Chip size="small" sx={{ mt: 0.75 }} label={firstColorLabel(order)} variant="outlined" />
                          <Box sx={{ mt: 0.75 }}><ProgressSummary progress={progressByOrder.get(order.id)} /></Box>
                        </Paper>
                      ))}
                      {!cards.length && <Typography variant="caption" color="text.secondary">Sin OF en esta página</Typography>}
                    </Stack>
                  </Paper>
                );
              })}
            </Box>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between">
            <TextField
              select size="small" label="OF por página" value={queryPageSize}
              onChange={(event) => setQuery({ tamano: event.target.value })}
              sx={{ width: 160 }}
            >
              {[25, 50, 100].map((size) => <MenuItem key={size} value={size}>{size}</MenuItem>)}
            </TextField>
            <Pagination
              count={pagedOrders.totalPages}
              page={pagedOrders.page}
              onChange={(_, page) => updateQuery({ pagina: page })}
              color="primary"
              aria-label="Paginación de OF"
            />
          </Stack>
        </Stack>
      )}

      {selected && (
        <Stack spacing={1.5}>
        <DocumentHeader
          eyebrow="Orden de fabricación"
          title={selected.codigo}
          subtitle={(
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.25, sm: 1.5 }} divider={<Typography color="text.disabled">·</Typography>}>
              <Typography variant="body2" fontWeight={750}>{orderMoldLabel(selected, molds).name}</Typography>
              <Typography variant="caption" color="text.secondary">{orderMoldLabel(selected, molds).code}</Typography>
              <Typography variant="caption" color="text.secondary">
                {selected.plan_produccion_id
                  ? `Generada por plan · propuesta ${selected.propuesta_clave}`
                  : `Origen ${selected.origen_demanda || '—'}`}
              </Typography>
            </Stack>
          )}
          status={<DocumentStatus label={statusLabel(selected.estado)} color={statusColor[selected.estado] || 'default'} />}
          backAction={(
            <Button onClick={() => leaveDetail(() => updateQuery({ of: null }))} sx={{ px: 0, justifyContent: 'flex-start' }}>
              Volver a bandeja
            </Button>
          )}
          actions={(
            <>
              <Button startIcon={<RefreshIcon />} variant="outlined" disabled={busy} onClick={() => leaveDetail(() => load())}>
                Actualizar
              </Button>
              {canEdit && selected.estado === 'BORRADOR' && (
                <Button
                  variant={draftDirty || formulaDirty ? 'contained' : 'outlined'}
                  disabled={busy || formulaBusy}
                  onClick={configure}
                >
                  Guardar configuración técnica
                </Button>
              )}
              {canRelease && (
                <Button
                  color="success"
                  variant={draftDirty || formulaDirty ? 'outlined' : 'contained'}
                  startIcon={<PlayArrowOutlinedIcon />}
                  disabled={busy || formulaBusy || draftDirty || formulaDirty || selected.estado !== 'BORRADOR' || !selected.molde_id
                    || (selected.origen_demanda === 'REEMPLAZO_OF'
                      && selected.corridas.some((run) => !run.receta_revision_id))}
                  onClick={release}
                >
                  Liberar OF
                </Button>
              )}
              {canClose && selected.estado === 'EN_EJECUCION' && (
                <Button color="success" variant="contained" startIcon={<TaskAltOutlinedIcon />} disabled={busy} onClick={closeOrder}>
                  Cerrar OF
                </Button>
              )}
              {canRelease && selected.estado === 'BORRADOR' && (draftDirty || formulaDirty) && (
                <Typography variant="caption" color="text.secondary">
                  Guarda los cambios pendientes antes de liberar.
                </Typography>
              )}
              {can('OF_ANULAR') && (
              <Button
                size="small"
                aria-expanded={moreActionsOpen}
                aria-controls="of-secondary-actions"
                onClick={() => setMoreActionsOpen((current) => !current)}
                endIcon={<ExpandMoreRoundedIcon sx={{ transform: moreActionsOpen ? 'rotate(180deg)' : 'none' }} />}
              >
                {moreActionsOpen ? 'Ocultar acciones' : 'Mostrar acciones'}
              </Button>
              )}
            </>
          )}
        />
        {(can('OF_ANULAR') || (can('OF_ANULAR') && can('OF_EDITAR_BORRADOR'))) && (
            <Collapse id="of-secondary-actions" in={moreActionsOpen}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <DraftOrderAnnulment key={selected.id} order={selected} allowed={can('OF_ANULAR')} disabled={busy}
                onSubmit={anularOrdenFabricacionScm} onSuccess={async () => {
                  setNotice(`${selected.codigo} anulada. Se conserva el historial.`);
                  updateQuery({ estado: 'TODOS' });
                  await load();
                }} />
              <FabricationOrderReplacement
                key={`replace-${selected.id}`}
                order={selected}
                allowed={can('OF_ANULAR') && can('OF_EDITAR_BORRADOR')}
                disabled={busy || draftDirty || formulaDirty}
                onSubmit={reemplazarOrdenFabricacionScm}
                onReview={obtenerOrdenFabricacionScm}
                onSuccess={async (result) => {
                  setNotice(`${result.sucesora.codigo} preparada en borrador. Selecciona una receta aprobada antes de liberarla.`);
                  updateQuery({ of: result.sucesora.id, estado: 'TODOS' });
                }}
              />
            </Stack>
            </Collapse>
        )}
        <OrderScheduleStrip order={selected} />
        {selected.cierre_kg && <Alert severity="info" title={`Peso medido original: ${selected.cierre_kg.kg_medido} kg; aporte estimado original: ${selected.cierre_kg.kg_fabricacion_estimado ?? '—'} kg`}>
          Cierre documental: {formatProgressKg(selected.cierre_kg.kg_medido)} kg pesados directamente.
          {selected.cierre_kg.kg_fabricacion_estimado != null && ` Aporte de fabricación estimado: ${formatProgressKg(selected.cierre_kg.kg_fabricacion_estimado)} kg.`}
          {' '}El stock medido del piloto está disponible desde el pesaje; medición y estimación no se suman como stock.
        </Alert>}
        </Stack>
      )}

      {busy && <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}><CircularProgress /></Box>}
      {!busy && selected && (
        <Stack spacing={2}>
          <DocumentSection
            title="Objetivos de fabricación"
            description="Todos los colores permanecen visibles. Edita metas en conjunto y expande composición o salidas de cada objetivo sin ocultar los demás."
          >
            <FabricationObjectivesTable
              order={selected}
              form={form}
              selectedMold={selectedMold}
              recipes={recipes}
              canEdit={canEdit}
              progress={selectedProgress}
              onChangeRun={changeRun}
              onChangeOutput={changeOutput}
              onOpenRecipe={can('ARTICULO_ADMINISTRAR') ? (runIndex) => {
                setFormulaDirty(false);
                setFormulaBusy(false);
                setFormulaRunIndex(runIndex);
              } : undefined}
              expandedRuns={expandedRuns}
              onToggleRun={(runId) => setExpandedRuns((current) => ({ ...current, [runId]: !current[runId] }))}
              routeOptionsByArticle={detailRoutesByArticle}
              routeLoading={detailRoutesLoading}
              routeReadOnly={Boolean(selected.plan_produccion_id)}
            />
          </DocumentSection>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography fontWeight={800} sx={{ mb: 2 }}>Configuración del recurso</Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              <strong>Proceso:</strong> {fabricationProcessLabel(selected.snapshot_proceso || selected.proceso_requerido)}
              {' · '}
              <strong>Fuente:</strong> {selected.fuente_proceso || 'pendiente de resolver'}
              {selected.compatibilidad_proceso && ` · Compatibilidad: ${selected.compatibilidad_proceso}`}
            </Alert>
            {detailRoutesError && selected.estado === 'BORRADOR' && selected.origen_demanda !== 'REEMPLAZO_OF' && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                No se pudieron cargar las rutas opcionales: {detailRoutesError} Puedes guardar con proceso explícito si el borrador no tiene referencias.
              </Alert>
            )}
            {selected.estado === 'BORRADOR' && (
              compatibleMolds.length ? (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Se muestran moldes compatibles con {selected.proceso_requerido || 'la operación'}. La máquina sugerida es opcional; la máquina real se elige y valida al agregar el Trabajo de color a una OT.
                </Typography>
              ) : (
                <Alert severity="error" sx={{ mb: 2 }}>
                  No existe un molde compatible. Corrige el maestro antes de configurar la OF.
                </Alert>
              )
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
              <FormControl fullWidth required={!selected.plan_produccion_id && selected.estado === 'BORRADOR'}>
                <InputLabel id="of-process-label">Proceso de fabricación</InputLabel>
                <Select
                  id="of-process"
                  labelId="of-process-label"
                  label="Proceso de fabricación"
                  value={processSelectValue}
                  disabled={!canEdit || selected.estado !== 'BORRADOR' || Boolean(selected.plan_produccion_id) || selected.origen_demanda === 'REEMPLAZO_OF'}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    const derived = nextValue.startsWith('DERIVADO_');
                    setForm((current) => ({
                      ...current,
                      proceso: derived || !nextValue ? '' : normalizeFabricationProcess(nextValue),
                      procesoOverride: !derived && Boolean(nextValue),
                      maquina_prevista_id: '',
                    }));
                    setDraftDirty(true);
                  }}
                >
                  {processResolution.complete && derivableRouteProcess && (
                    <MenuItem value={`DERIVADO_${derivableRouteProcess}`}>
                      {`Derivar de rutas — ${fabricationProcessLabel(derivableRouteProcess)}`}
                    </MenuItem>
                  )}
                  <MenuItem value="">Sin selección</MenuItem>
                  <MenuItem value="INYECCION">Inyección</MenuItem>
                  <MenuItem value="SOPLADO">Soplado</MenuItem>
                </Select>
              </FormControl>
              <SearchableCatalogAutocomplete
                id="of-mold"
                label="Molde"
                options={moldSelectorOptions}
                value={moldSelectorOptions.find((item) => item.codigo === form.molde_id) || null}
                onChange={(option) => chooseMold(option?.codigo || '')}
                getOptionKey={(option) => option?.codigo}
                getOptionDisabled={(option) => !compatibleMolds.some((item) => item.codigo === option.codigo)}
                getSearchText={(option) => [option?.nombre, option?.codigo, option?.revision].filter(Boolean).join(' ')}
                disabled={!canEdit || selected.estado !== 'BORRADOR' || selected.origen_demanda === 'REEMPLAZO_OF'}
                loading={catalogStatus.moldes.loading}
                required
                noOptionsText="No hay moldes compatibles"
              />
              <SearchableCatalogAutocomplete
                id="of-machine"
                label="Máquina sugerida (opcional)"
                options={machineSelectorOptions}
                value={machineSelectorOptions.find((item) => String(item.id) === String(form.maquina_prevista_id)) || null}
                onChange={(option) => {
                  setForm((current) => ({ ...current, maquina_prevista_id: option?.id || '' }));
                  setDraftDirty(true);
                }}
                getOptionKey={(option) => option?.id}
                getOptionDisabled={(option) => !compatibleMachines.some((item) => String(item.id) === String(option.id))}
                placeholder="Sin sugerencia"
                helperText={!form.maquina_prevista_id ? 'Sin sugerencia' : undefined}
                getSearchText={(option) => [option?.nombre, option?.codigo, option?.revision].filter(Boolean).join(' ')}
                disabled={!canEdit || selected.estado !== 'BORRADOR' || selected.origen_demanda === 'REEMPLAZO_OF'}
                loading={catalogStatus.maquinas.loading}
                noOptionsText="No hay máquinas compatibles"
              />
                  <TextField
                type="number"
                label="Ciclo estándar (s)"
                value={form.snapshot_tiempo_ciclo_seg}
                slotProps={{ htmlInput: { min: 0.001, max: 9999, step: 0.001 } }}
                disabled={!canEdit || selected.estado !== 'BORRADOR' || selected.origen_demanda === 'REEMPLAZO_OF'}
                onChange={(event) => {
                  setForm((current) => ({ ...current, snapshot_tiempo_ciclo_seg: event.target.value }));
                  setDraftDirty(true);
                }}
              />
              <TextField
                type="number"
                label="Horas efectivas"
                value={form.snapshot_horas_turno}
                slotProps={{ htmlInput: { min: 0.001, max: 24, step: 0.001 } }}
                disabled={!canEdit || selected.estado !== 'BORRADOR' || selected.origen_demanda === 'REEMPLAZO_OF'}
                onChange={(event) => {
                  setForm((current) => ({ ...current, snapshot_horas_turno: event.target.value }));
                  setDraftDirty(true);
                }}
              />
              <WeightInput
                unit="g"
                required
                label="Material no neto/ciclo (g)"
                value={form.snapshot_peso_colada_gr}
                helperText="Canal, bebedero y rebaba; no incluye las piezas."
                slotProps={{ htmlInput: { min: 0, max: 99999, step: 0.1 } }}
                disabled={!canEdit || selected.estado !== 'BORRADOR' || selected.origen_demanda === 'REEMPLAZO_OF'}
                onChange={(event) => {
                  setForm((current) => ({ ...current, snapshot_peso_colada_gr: event.target.value }));
                  setDraftDirty(true);
                }}
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

        {canClose && selected.estado === 'EN_EJECUCION' && (
          <DocumentSection title="Cierre documental" description="Registra la diferencia solo si la cantidad real no coincide.">
            <TextField
              fullWidth
              label="Motivo de diferencia (si la cantidad real no coincide)"
              value={closeReason}
              onChange={(event) => setCloseReason(event.target.value)}
              helperText={(selected.corridas || []).some((run) => run.salidas?.some((output) => output.articulo?.unidad_inventario === 'KG'))
                ? 'El cierre consolida los kg medidos. El plan en unidades es una referencia; no confirma conteos ni mueve stock.'
                : 'El cierre usa las unidades confirmadas por pesaje. No crea ni duplica movimientos de Kardex.'}
              inputProps={{ maxLength: 500 }}
            />
          </DocumentSection>
        )}
        {selected.estado !== 'BORRADOR' && (
          <Alert
            severity="info"
            action={(
              <Button
                component={RouterLink}
                to="/materiales/preparaciones"
                color="inherit"
                onClick={(event) => {
                  if (!leaveDetail(() => {})) event.preventDefault();
                }}
              >
                Abrir preparaciones
              </Button>
            )}
          >
            OF liberada: continúa en Preparaciones para generar o revisar la necesidad de material.
          </Alert>
        )}
          <DocumentSection
            title="Ayuda para preparar y liberar"
            description="Explicación general; las incidencias activas se muestran arriba."
            actions={(
              <Button
                size="small"
                aria-expanded={helpOpen}
                aria-controls="of-detail-help"
                onClick={() => setHelpOpen((current) => !current)}
                endIcon={<ExpandMoreRoundedIcon sx={{ transform: helpOpen ? 'rotate(180deg)' : 'none' }} />}
              >
                {helpOpen ? 'Ocultar ayuda' : 'Ver ayuda'}
              </Button>
            )}
          >
            <Collapse id="of-detail-help" in={helpOpen}>
              <Typography variant="body2" color="text.secondary">
                Edita las metas de todos los colores en la tabla, guarda la configuración y revisa las recetas aprobadas antes de liberar.
                Los kg medidos y las mangas abiertas pertenecen al avance de producción; no se inventan al cambiar una meta.
              </Typography>
              {selected.estado === 'BORRADOR' && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  La OPM todavía no debe existir. Primero guarda y libera esta OF; luego cada objetivo de fabricación aparecerá en Materiales → Preparaciones para generar su necesidad.
                </Typography>
              )}
            </Collapse>
          </DocumentSection>

        </Stack>
      )}

      <Dialog
        open={Boolean(discardRequest)}
        onClose={() => setDiscardRequest(null)}
        aria-labelledby="of-discard-dialog-title"
      >
        <DialogTitle id="of-discard-dialog-title">Cambios sin guardar</DialogTitle>
        <DialogContent>
          <Typography>Conserva este borrador para seguir editando o descarta los cambios para continuar.</Typography>
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={() => setDiscardRequest(null)}>Seguir editando</Button>
          <Button color="error" variant="contained" disabled={busy || formulaBusy} onClick={() => {
            const continueAction = discardRequest;
            setDiscardRequest(null);
            continueAction?.();
          }}>
            Descartar cambios
          </Button>
        </DialogActions>
      </Dialog>

      <Drawer
        anchor="right"
        open={formulaRunIndex !== null}
        onClose={closeFormulaWorkspace}
        PaperProps={{ sx: { width: { xs: '100%', md: 'min(1120px, 90vw)' }, p: 2, overflowY: 'auto' } }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h6" fontWeight={800}>
            {selected?.codigo} · {selected?.corridas?.[formulaRunIndex]?.codigo} · formulación
          </Typography>
          <Button onClick={closeFormulaWorkspace} disabled={formulaBusy}>Volver a la OF</Button>
        </Stack>
        <Alert severity="info" sx={{ mb: 2 }}>
          Las altas de color, materiales y receta se confirman juntas. Guarda antes cualquier otro cambio pendiente en la OF.
        </Alert>
        {formulaRunIndex !== null && selected?.corridas?.[formulaRunIndex] && (
          <FabricationContextualRecipePanel
            order={selected}
            run={selected.corridas[formulaRunIndex]}
            colorId={form.corridas?.[formulaRunIndex]?.color_produccion_id}
            colors={colors}
            onSaved={recipeSavedInWorkspace}
            onDirtyChange={setFormulaDirty}
            onBusyChange={setFormulaBusy}
          />
        )}
      </Drawer>

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
          updateQuery({ of: created.id });
        }}
      />
    </Stack>
  );
}
