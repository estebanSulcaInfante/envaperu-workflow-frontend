import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControl, IconButton, InputLabel, MenuItem, Paper, Select,
  Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  buscarPiezasGlobales, crearMolde, habilitarColorMolde, obtenerMolde, obtenerMoldes,
} from '../services/api';
import * as scmEngineeringApi from '../services/scmEngineeringApi';
import { crearOrdenFabricacionExcepcionalScm } from '../services/scmOtApi';
import FabricationRecipeSelector from './FabricationRecipeSelector';
import { defaultRecipeForRun } from './fabricationRecipeOptions';
import SearchableCatalogAutocomplete from './ui/SearchableCatalogAutocomplete';
import WeightInput from './ui/WeightInput';
import PieceCompositionEditor from './productOnboarding/PieceCompositionEditor';
import FirstOfMasterPanel from './firstOf/FirstOfMasterPanel';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AddCircleOutlineOutlinedIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import {
  compatibleProcessMachines,
  fabricationProcessLabel,
  normalizeFabricationProcess,
  resolveFabricationProcess,
  routeOptionsForRun,
} from './fabricationRoutes';

const emptyRun = (key = 'run-1') => ({
  key,
  color_produccion_id: '',
  receta_revision_id: '',
  ciclos_objetivo: '',
  objetivo_neto_kg: '',
});

const emptyMoldPiece = () => ({
  client_id: `of-piece-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  modo: 'NUEVA',
  ref: null,
  nombre: '',
  cavidades: '1',
  peso_unitario_gr: '',
});

const emptyMoldDraft = () => ({
  nombre: '',
  peso_tiro_gr: '',
  tiempo_ciclo_std: '30',
  piezas: [emptyMoldPiece()],
});

const colorLabel = (color) => color.nombre
  || [color.color_base?.nombre, color.familia_color?.nombre].filter(Boolean).join(' ')
  || `Color ${color.id}`;
const exceptionalOutputsForRun = (mold, articles, colorId) => {
  const articlesBySku = new Map(
    articles
      .filter((article) => article.clase === 'PIEZA_COLOR')
      .map((article) => [article.subtipo?.pieza_color_sku, article]),
  );
  return (mold?.formas || []).filter((shape) => shape.activo !== false).map((shape) => {
    const variant = (shape.variantes || []).find(
      (item) => Number(item.color_produccion_id) === Number(colorId),
    );
    const article = variant ? articlesBySku.get(variant.sku) : null;
    return {
      pieza_id: shape.pieza_id,
      pieza_codigo: shape.pieza_codigo,
      pieza_nombre: shape.nombre,
      variant,
      article,
      cantidad_por_ciclo: Number(shape.cavidades || 0),
      peso_unitario_g: Number(shape.peso_unitario_gr || 0),
    };
  });
};

const outputGroupsForRoutes = (mold, articles, runs) => (
  (runs || []).map((run) => exceptionalOutputsForRun(mold, articles, run.color_produccion_id))
);

const formatKg = (value) => {
  if (!Number.isFinite(Number(value))) return '—';
  return Number(Number(value).toFixed(3)).toString();
};

const formatGrams = (value) => {
  if (!Number.isFinite(Number(value))) return '—';
  return Number(Number(value).toFixed(1)).toFixed(1);
};

const ceilDecimalRatio = (numerator, denominator) => {
  const ratio = Number(numerator) / Number(denominator);
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  const nearestInteger = Math.round(ratio);
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(ratio)) * 32;
  return Math.abs(ratio - nearestInteger) <= tolerance
    ? nearestInteger
    : Math.ceil(ratio);
};

export default function ExceptionalFabricationOrderDialog({
  open,
  molds,
  machines,
  colors,
  recipes = [],
  onClose,
  onCreated,
}) {
  const [reason, setReason] = useState('');
  const [moldId, setMoldId] = useState('');
  const [machineId, setMachineId] = useState('');
  const [cycleSeconds, setCycleSeconds] = useState('');
  const [shiftHours, setShiftHours] = useState('8');
  const [runnerWeight, setRunnerWeight] = useState('0');
  const [runs, setRuns] = useState([emptyRun()]);
  const [mold, setMold] = useState(null);
  const [articles, setArticles] = useState([]);
  const [localColors, setLocalColors] = useState(colors || []);
  const [localRecipes, setLocalRecipes] = useState(recipes || []);
  const [moldWorkspace, setMoldWorkspace] = useState('select');
  const [moldCatalog, setMoldCatalog] = useState(molds || []);
  const [moldCatalogQuery, setMoldCatalogQuery] = useState('');
  const [moldCatalogPage, setMoldCatalogPage] = useState(0);
  const [moldDraft, setMoldDraft] = useState(emptyMoldDraft);
  const [pieceCatalog, setPieceCatalog] = useState([]);
  const [moldMutationBusy, setMoldMutationBusy] = useState(false);
  const [moldMutationError, setMoldMutationError] = useState('');
  const [colorMutationBusy, setColorMutationBusy] = useState(false);
  const [masterPanel, setMasterPanel] = useState(null);
  const [masterBusy, setMasterBusy] = useState(false);
  const [masterDirty, setMasterDirty] = useState(false);
  const [routesByArticle, setRoutesByArticle] = useState({});
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [process, setProcess] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingMold, setLoadingMold] = useState(false);
  const [error, setError] = useState('');
  const [uncertainAttempt, setUncertainAttempt] = useState(null);
  const [moldUncertainAttempt, setMoldUncertainAttempt] = useState(null);
  const idempotencyRef = useRef({ fingerprint: '', key: '' });
  const routeGenerationRef = useRef(0);
  const moldGenerationRef = useRef(0);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setReason('');
    setMoldId('');
    setMachineId('');
    setCycleSeconds('');
    setShiftHours('8');
    setRunnerWeight('0');
    setRuns([emptyRun()]);
    setLoadingMold(false);
    setProcess('');
    setRoutesByArticle({});
    setRouteLoading(false);
    setRouteError('');
    setMold(null);
    setMoldWorkspace('select');
    setMoldCatalog(molds || []);
    setMoldCatalogQuery('');
    setMoldCatalogPage(0);
    setMoldDraft(emptyMoldDraft());
    setPieceCatalog([]);
    setMoldMutationBusy(false);
    setMoldMutationError('');
    setColorMutationBusy(false);
    setMasterPanel(null);
    setMasterBusy(false);
    setMasterDirty(false);
    moldGenerationRef.current += 1;
    setError('');
    setUncertainAttempt(null);
    setMoldUncertainAttempt(null);
    idempotencyRef.current = { fingerprint: '', key: '' };
    scmEngineeringApi.listarArticulosScm()
      .then((items) => { if (active) setArticles(items); })
      .catch((requestError) => {
        if (active) setError(scmEngineeringApi.mensajeErrorScm(requestError, 'No se pudieron cargar los artículos SCM.'));
      });
    return () => { active = false; };
  }, [molds, open]);

  useEffect(() => { setLocalColors(colors || []); }, [colors]);
  useEffect(() => { setLocalRecipes(recipes || []); }, [recipes]);
  useEffect(() => {
    if (open) setMoldCatalog((current) => current.length ? current : (molds || []));
  }, [molds, open]);


  const routeArticleIds = useMemo(() => [...new Set(
    outputGroupsForRoutes(mold, articles, runs).flatMap((outputs) => outputs
      .map((output) => output.article?.id)
      .filter((id) => id != null)
      .map(String)),
  )], [articles, mold, runs]);

  useEffect(() => {
    if (!open || !routeArticleIds.length) {
      setRoutesByArticle({});
      setRouteLoading(false);
      return undefined;
    }
    const generation = ++routeGenerationRef.current;
    let active = true;
    setRouteLoading(true);
    setRouteError('');
    let listRoutes;
    try {
      listRoutes = scmEngineeringApi.listarRutasArticuloScm;
    } catch {
      listRoutes = null;
    }
    listRoutes ||= (() => Promise.resolve([]));
    Promise.all(routeArticleIds.map((articleId) => listRoutes(articleId)
      .then((items) => [articleId, items || []])))
      .then((entries) => {
        if (!active || routeGenerationRef.current !== generation) return;
        setRoutesByArticle(Object.fromEntries(entries));
      })
      .catch((requestError) => {
        if (!active || routeGenerationRef.current !== generation) return;
        setRoutesByArticle({});
        setRouteError(scmEngineeringApi.mensajeErrorScm(requestError, 'No se pudieron cargar las rutas compatibles.'));
      })
      .finally(() => {
        if (active && routeGenerationRef.current === generation) setRouteLoading(false);
      });
    return () => { active = false; };
  }, [open, routeArticleIds]);

  const chooseMold = async (nextMoldId, { preserveMetrics = false } = {}) => {
    const previousCycleSeconds = cycleSeconds;
    const previousRunnerWeight = runnerWeight;
    const previousMachineId = machineId;
    const previousRouteIds = runs.map((run) => run.operacion_ruta_revision_id || '');
    const generation = ++moldGenerationRef.current;
    setMoldId(nextMoldId);
    setMold(null);
    setMachineId(preserveMetrics ? previousMachineId : '');
    setRuns((current) => current.map((run, index) => ({
      ...run,
      operacion_ruta_revision_id: preserveMetrics ? (previousRouteIds[index] || '') : '',
    })));
    setError('');
    if (!nextMoldId) {
      setLoadingMold(false);
      return;
    }
    setLoadingMold(true);
    try {
      const detail = await obtenerMolde(nextMoldId);
      if (moldGenerationRef.current !== generation) return;
      setMold(detail);
      if (!preserveMetrics) {
        setCycleSeconds(String(detail.tiempo_ciclo_std ?? ''));
        setRunnerWeight(String(Math.max(Number(detail.peso_colada_gr || 0), 0)));
      } else {
        setCycleSeconds(previousCycleSeconds);
        setRunnerWeight(previousRunnerWeight);
      }
    } catch (requestError) {
      if (moldGenerationRef.current !== generation) return;
      setError(scmEngineeringApi.mensajeErrorScm(requestError, 'No se pudo cargar el molde y sus variantes.'));
    } finally {
      if (moldGenerationRef.current === generation) setLoadingMold(false);
    }
  };

  const outputGroups = useMemo(() => runs.map((run) => (
    exceptionalOutputsForRun(mold, articles, run.color_produccion_id)
  )), [articles, mold, runs]);
  const runMetrics = useMemo(() => outputGroups.map((outputs, index) => {
    const kgPerCycle = outputs.every((output) => (
      output.cantidad_por_ciclo > 0 && output.peso_unitario_g > 0
    ))
      ? outputs.reduce((total, output) => total
        + (output.cantidad_por_ciclo * output.peso_unitario_g) / 1000, 0)
      : null;
    const objective = Number(runs[index]?.objetivo_neto_kg || 0);
    const cyclesFromKg = objective > 0 && kgPerCycle > 0
      ? ceilDecimalRatio(objective, kgPerCycle)
      : null;
    const cycles = objective > 0 ? Math.max(1, cyclesFromKg || 0) : 0;
    const reachableKg = kgPerCycle > 0 && cycles > 0 ? cycles * kgPerCycle : null;
    return {
      objective,
      kgPerCycle,
      cycles,
      reachableKg,
      roundingKg: reachableKg != null && objective > 0 ? reachableKg - objective : null,
    };
  }), [outputGroups, runs]);
  const processResolution = useMemo(
    () => resolveFabricationProcess(
      process,
      runs.map((run, index) => ({
        ...run,
        salidas: outputGroups[index].map((output) => ({ articulo: output.article })),
      })),
      routesByArticle,
    ),
    [outputGroups, process, routesByArticle, runs],
  );
  const suggestedMachines = useMemo(
    () => compatibleProcessMachines(machines, processResolution.process),
    [machines, processResolution.process],
  );
  const selectedMachineCompatible = !machineId
    || suggestedMachines.some((machine) => String(machine.id) === String(machineId));
  const processSelectValue = process || (processResolution.complete && processResolution.process
    ? `DERIVADO_${processResolution.process}` : '');
  const linkedProcesses = [...new Set(processResolution.linked.map((option) => option.proceso).filter(Boolean))];
  const derivedProcess = linkedProcesses.length === 1 ? linkedProcesses[0] : processResolution.process;
  const processConflict = processResolution.explicit
    && linkedProcesses.length > 0
    && linkedProcesses.some((value) => value !== processResolution.explicit);

  const selectedColorIds = runs.map((run) => Number(run.color_produccion_id)).filter(Boolean);
  const duplicateColors = new Set(selectedColorIds).size !== selectedColorIds.length;
  const outputsComplete = Boolean(mold) && outputGroups.every((outputs) => (
    outputs.length > 0
    && outputs.every((output) => (
      output.variant
      && output.article
      && output.cantidad_por_ciclo > 0
      && output.peso_unitario_g > 0
    ))
  ));
  const canSubmit = (
    reason.trim().length >= 5
    && moldId
    && Number(cycleSeconds) > 0
    && Number(shiftHours) > 0
    && Number(runnerWeight) >= 0
    && runs.length > 0
    && runs.every((run) => Number(run.color_produccion_id) > 0
      && Number(run.objetivo_neto_kg) > 0)
    && processResolution.valid
    && selectedMachineCompatible
    && !duplicateColors
    && outputsComplete
    && !uncertainAttempt
    && !busy
    && !loadingMold
  );
  const allBusy = busy || loadingMold || moldMutationBusy || colorMutationBusy
    || masterBusy || Boolean(uncertainAttempt) || Boolean(moldUncertainAttempt);
  const moldNetWeight = (moldDraft.piezas || []).reduce(
    (sum, piece) => sum + Number(piece.cavidades || 0) * Number(piece.peso_unitario_gr || 0),
    0,
  );
  const parentFormVisible = moldWorkspace === 'select' && !masterPanel;
  const colorOptions = useMemo(() => {
    const byId = new Map((colors || []).map((item) => [String(item.id), item]));
    (localColors || []).forEach((item) => byId.set(String(item.id), item));
    return [...byId.values()];
  }, [colors, localColors]);
  const recipeOptions = useMemo(() => {
    const byId = new Map((recipes || []).map((item) => [String(item.id), item]));
    (localRecipes || []).forEach((item) => byId.set(String(item.id), item));
    return [...byId.values()];
  }, [localRecipes, recipes]);

  const buildPayload = () => ({
    motivo: reason.trim(),
    // A process inferred from linked route operations is response context,
    // not an explicit input. Only the user's explicit selection belongs in
    // the create payload; the backend persists the derived source.
    ...(process ? { proceso: process } : {}),
    molde_id: moldId,
    maquina_prevista_id: machineId ? Number(machineId) : null,
    snapshot_tiempo_ciclo_seg: Number(cycleSeconds),
    snapshot_horas_turno: Number(shiftHours),
    snapshot_peso_colada_gr: Number(runnerWeight),
    corridas: runs.map((run, runIndex) => ({
      color_produccion_id: Number(run.color_produccion_id),
      ...(run.receta_revision_id
        ? { receta_revision_id: Number(run.receta_revision_id) }
        : {}),
      ...(run.operacion_ruta_revision_id
        ? { operacion_ruta_revision_id: Number(run.operacion_ruta_revision_id) }
        : {}),
      ...(Number(run.objetivo_neto_kg) > 0 ? { objetivo_neto_kg: Number(run.objetivo_neto_kg) } : {}),
      salidas: outputGroups[runIndex].map((output) => ({
        articulo_scm_id: output.article.id,
        cantidad_por_ciclo: output.cantidad_por_ciclo,
        peso_unitario_g: output.peso_unitario_g,
      })),
    })),
  });

  const handleCreateError = (requestError, payload, key) => {
    const status = requestError?.response?.status || requestError?.status;
    const definitive = Number.isInteger(status) && status >= 400 && status < 500;
    if (!definitive) {
      setUncertainAttempt({ payload, key });
      setError('No se pudo confirmar la creación. Verifica la bandeja antes de cambiar datos; puedes reintentar el mismo intento.');
      return;
    }
    idempotencyRef.current = { fingerprint: '', key: '' };
    setUncertainAttempt(null);
    setError(scmEngineeringApi.mensajeErrorScm(requestError, 'No se pudo crear la OF de reposición. Puedes corregir los datos e intentar de nuevo.'));
  };

  const openMoldCreator = async () => {
    setMoldWorkspace('create');
    setMoldMutationError('');
    if (typeof buscarPiezasGlobales !== 'function' || pieceCatalog.length) return;
    try {
      const rows = await buscarPiezasGlobales('', 300);
      setPieceCatalog((Array.isArray(rows) ? rows : rows?.items || [])
        .filter((item) => item?.activo !== false));
    } catch (requestError) {
      setMoldMutationError(scmEngineeringApi.mensajeErrorScm(
        requestError,
        'No se pudieron cargar las piezas reutilizables. Puedes crear piezas nuevas.',
      ));
    }
  };

  const openMoldCatalog = async () => {
    setMoldWorkspace('catalog');
    setMoldCatalogQuery('');
    setMoldCatalogPage(0);
    if (typeof obtenerMoldes !== 'function') return;
    try {
      const rows = await obtenerMoldes();
      const items = Array.isArray(rows) ? rows : rows?.items || rows?.data || [];
      if (items.length) setMoldCatalog(items.filter((item) => item?.activo !== false));
    } catch (requestError) {
      setMoldMutationError(scmEngineeringApi.mensajeErrorScm(
        requestError,
        'No se pudo actualizar el catálogo de moldes. Revisa los moldes cargados e intenta de nuevo.',
      ));
    }
  };

  const moldCatalogRows = useMemo(() => {
    const query = moldCatalogQuery.trim().toLocaleUpperCase();
    const rows = (moldCatalog || []).filter((item) => !query || [item.nombre, item.codigo, item.revision]
      .filter(Boolean).join(' ').toLocaleUpperCase().includes(query));
    return rows;
  }, [moldCatalog, moldCatalogQuery]);
  const moldCatalogPageSize = 6;
  const moldCatalogPageCount = Math.max(1, Math.ceil(moldCatalogRows.length / moldCatalogPageSize));
  const visibleMoldCatalogRows = moldCatalogRows.slice(
    moldCatalogPage * moldCatalogPageSize,
    (moldCatalogPage + 1) * moldCatalogPageSize,
  );

  const createContextualMold = async () => {
    const name = moldDraft.nombre.trim();
    const shotWeight = Number(moldDraft.peso_tiro_gr);
    const cycle = Number(moldDraft.tiempo_ciclo_std);
    const pieces = moldDraft.piezas || [];
    const netWeight = pieces.reduce((sum, piece) => (
      sum + Number(piece.cavidades || 0) * Number(piece.peso_unitario_gr || 0)
    ), 0);
    if (!name || !(shotWeight > 0) || !(cycle > 0) || !pieces.length
      || pieces.some((piece) => !(Number.isInteger(Number(piece.cavidades)) && Number(piece.cavidades) > 0)
        || !(Number(piece.peso_unitario_gr) > 0)
        || (piece.modo === 'REUTILIZAR' ? !piece.ref : !piece.nombre.trim()))
      || shotWeight < netWeight) {
      setMoldMutationError('Completa nombre, peso de tiro, ciclo y piezas válidas; el peso de tiro debe cubrir el peso neto.');
      return;
    }
    if (typeof crearMolde !== 'function') {
      setMoldMutationError('El alta de moldes no está disponible en este entorno.');
      return;
    }
    setMoldMutationBusy(true);
    setMoldMutationError('');
    const payload = {
      nombre: name,
      peso_tiro_gr: shotWeight,
      tiempo_ciclo_std: cycle,
      piezas: pieces.map((piece) => ({
        ...(piece.modo === 'REUTILIZAR'
          ? { pieza_id: Number(piece.ref) }
          : { nombre: piece.nombre.trim(), peso_nominal_gr: Number(piece.peso_unitario_gr) }),
        cavidades: Number(piece.cavidades),
        peso_unitario_gr: Number(piece.peso_unitario_gr),
      })),
    };
    try {
      const created = await crearMolde(payload);
      const createdCode = created?.codigo || created?.molde?.codigo;
      if (!createdCode) {
        const missingCode = new Error('El servidor confirmó una respuesta sin código automático del molde.');
        missingCode.uncertainCreation = true;
        throw missingCode;
      }
      setMoldCatalog((current) => [...current.filter((item) => String(item.codigo) !== String(createdCode)), {
        ...(created.molde || created), codigo: createdCode,
      }]);
      setMoldWorkspace('select');
      setMoldDraft(emptyMoldDraft());
      await chooseMold(createdCode);
    } catch (requestError) {
      const status = requestError?.response?.status || requestError?.status;
      const definitive = Number.isInteger(status) && status >= 400 && status < 500;
      if (!definitive || requestError?.uncertainCreation) {
        setMoldMutationError('No se pudo confirmar el alta del molde. El borrador quedó bloqueado para evitar un segundo molde; revisa el catálogo o reconcilia antes de continuar.');
        setMoldUncertainAttempt((current) => current || { payload });
      } else {
        setMoldMutationError(scmEngineeringApi.mensajeErrorScm(
          requestError,
          'No se pudo crear el molde. Corrige los datos e intenta de nuevo.',
        ));
      }
    } finally {
      setMoldMutationBusy(false);
    }
  };

  const enableColorForMold = async (colorId) => {
    if (!moldId || !colorId || typeof habilitarColorMolde !== 'function') {
      setError('No se puede habilitar el color hasta seleccionar un molde y un color.');
      return;
    }
    setColorMutationBusy(true);
    setError('');
    try {
      await habilitarColorMolde(moldId, Number(colorId));
      if (typeof scmEngineeringApi.listarArticulosScm === 'function') {
        const items = await scmEngineeringApi.listarArticulosScm();
        setArticles(items || []);
      }
      await chooseMold(moldId, { preserveMetrics: true });
    } catch (requestError) {
      setError(scmEngineeringApi.mensajeErrorScm(
        requestError,
        'No se pudo habilitar el color en todas las piezas del molde.',
      ));
    } finally {
      setColorMutationBusy(false);
    }
  };

  const updateRun = (index, changes) => setRuns((current) => current.map((run, runIndex) => {
    if (index !== runIndex) return run;
    const next = { ...run, ...changes };
    if (Object.prototype.hasOwnProperty.call(changes, 'color_produccion_id')) {
      next.operacion_ruta_revision_id = '';
    }
    return next;
  }));

  const openMasterPanel = (kind, runIndex, mode = 'catalog') => {
    const run = runs[runIndex] || {};
    setMasterPanel({
      kind,
      runIndex,
      mode,
      colorId: run.color_produccion_id || null,
      selectedId: kind === 'recipe' ? (run.receta_revision_id || null) : (run.color_produccion_id || null),
    });
  };

  const closeMasterPanel = () => {
    if (masterBusy) return;
    setMasterPanel(null);
    setMasterDirty(false);
  };
  const selectMasterEntity = (entity) => {
    if (!masterPanel || !entity) return;
    if (masterPanel.kind === 'color') updateRun(masterPanel.runIndex, { color_produccion_id: entity.id, receta_revision_id: '' });
    if (masterPanel.kind === 'recipe' && entity.estado === 'APROBADA') {
      setLocalRecipes((current) => [...current.filter((item) => String(item.id) !== String(entity.id)), entity]);
      updateRun(masterPanel.runIndex, { receta_revision_id: entity.id });
      setError('');
    }
    setMasterPanel(null);
  };

  const submit = async () => {
    if (!canSubmit) {
      setError('Completa el motivo, molde, color, objetivo neto en kg y sus variantes PiezaColor antes de crear la OF.');
      return;
    }
    setBusy(true);
    setError('');
    const payload = buildPayload();
    try {
      const fingerprint = JSON.stringify(payload);
      if (idempotencyRef.current.fingerprint !== fingerprint) {
        idempotencyRef.current = { fingerprint, key: crypto.randomUUID() };
      }
      const created = await crearOrdenFabricacionExcepcionalScm(payload, idempotencyRef.current.key);
      setUncertainAttempt(null);
      onCreated(created);
    } catch (requestError) {
      handleCreateError(requestError, payload, idempotencyRef.current.key);
    } finally {
      setBusy(false);
    }
  };

  const retryUncertainAttempt = async () => {
    if (!uncertainAttempt || busy) return;
    setBusy(true);
    setError('');
    try {
      const created = await crearOrdenFabricacionExcepcionalScm(
        uncertainAttempt.payload,
        uncertainAttempt.key,
      );
      setUncertainAttempt(null);
      onCreated(created);
    } catch (requestError) {
      handleCreateError(requestError, uncertainAttempt.payload, uncertainAttempt.key);
    } finally {
      setBusy(false);
    }
  };

  const closeUncertainAttempt = () => {
    if (!window.confirm('Verifica primero la bandeja. ¿Cerrar este formulario y dejar el intento sin reintentar?')) return;
    setUncertainAttempt(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={allBusy || masterDirty ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {masterPanel
          ? (masterPanel.kind === 'color' ? 'Administrar color de producción' : 'Administrar receta de color')
          : moldWorkspace === 'create'
            ? 'Crear molde para esta OF'
            : moldWorkspace === 'catalog' ? 'Catálogo de moldes'
            : moldWorkspace === 'detail' ? 'Ficha del molde' : 'Nueva OF de reposición'}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="info" sx={{ display: parentFormVisible ? undefined : 'none' }}>
            Produce PiezaColor para stock sin inventar una OP ni un Producto Terminado. La OF queda
            en borrador y debe liberarse antes de crear OT y mangas.
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}
          {uncertainAttempt && (
            <Alert
              severity="warning"
              action={(
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Button color="inherit" onClick={retryUncertainAttempt} disabled={busy}>
                    Reintentar mismo intento
                  </Button>
                  <Button color="inherit" onClick={closeUncertainAttempt} disabled={busy}>
                    Cerrar y verificar bandeja
                  </Button>
                </Stack>
              )}
            >
              El formulario está bloqueado para conservar el payload y la clave de este intento.
              Verifica la bandeja antes de continuar.
            </Alert>
          )}
          {masterPanel && (
            <FirstOfMasterPanel
              kind={masterPanel.kind}
              mode={masterPanel.mode}
              colorId={masterPanel.colorId}
              selectedId={masterPanel.selectedId}
              onBack={closeMasterPanel}
              onSelect={selectMasterEntity}
              onSaved={(entity, outcome = {}) => {
                if (outcome.pending && masterPanel.kind === 'recipe' && entity?.id) {
                  setLocalRecipes((current) => [...current.filter((item) => String(item.id) !== String(entity.id)), entity]);
                  setError('Aún no puede usarse en la OF; falta aprobarla.');
                  setMasterPanel({ ...masterPanel, mode: 'detail', selectedId: entity.id });
                  setMasterDirty(false);
                  return;
                }
                if (entity?.id && outcome.selectable === false && !outcome.pending) {
                  setError('La formulación se guardó, pero todavía no es compatible con este color y objetivo. Revisa su ficha antes de seleccionarla.');
                  setMasterPanel({ ...masterPanel, mode: 'detail', selectedId: entity.id });
                  setMasterDirty(false);
                  return;
                }
                if (outcome.selectable && entity?.id) {
                  if (masterPanel.kind === 'color') {
                    setLocalColors((current) => [
                      ...current.filter((item) => String(item.id) !== String(entity.id)),
                      entity,
                    ]);
                  }
                  if (masterPanel.kind === 'color') updateRun(masterPanel.runIndex, { color_produccion_id: entity.id, receta_revision_id: '' });
                  if (masterPanel.kind === 'recipe') {
                    setLocalRecipes((current) => [...current.filter((item) => String(item.id) !== String(entity.id)), entity]);
                    updateRun(masterPanel.runIndex, { receta_revision_id: entity.id });
                    setError('');
                  }
                }
                setMasterPanel(null);
                setMasterDirty(false);
              }}
              onBusyChange={setMasterBusy}
              onDirtyChange={setMasterDirty}
            />
          )}
          <TextField
            required
            fullWidth
            multiline
            minRows={2}
            label="Motivo de reposición"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={busy || Boolean(uncertainAttempt)}
            sx={{ display: parentFormVisible ? undefined : 'none' }}
            helperText="Ej.: reposición autorizada de asas para futuros prearmados de balde."
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <FormControl fullWidth required={!processResolution.complete} sx={{ display: parentFormVisible ? undefined : 'none' }}>
              <InputLabel id="exceptional-of-process-label">Proceso de fabricación</InputLabel>
              <Select
                id="exceptional-of-process"
                labelId="exceptional-of-process-label"
                label="Proceso de fabricación"
                value={processSelectValue}
                onChange={(event) => {
                  const nextValue = String(event.target.value);
                  setProcess(nextValue.startsWith('DERIVADO_') ? '' : normalizeFabricationProcess(nextValue));
                  setMachineId('');
                }}
                disabled={busy || Boolean(uncertainAttempt)}
              >
                {processResolution.complete && derivedProcess && (
                  <MenuItem value={`DERIVADO_${derivedProcess}`}>
                    {`Derivar de rutas — ${fabricationProcessLabel(derivedProcess)}`}
                  </MenuItem>
                )}
                {!processResolution.complete && (
                  <MenuItem value="">Sin selección (requiere proceso)</MenuItem>
                )}
                <MenuItem value="INYECCION">Inyección</MenuItem>
                <MenuItem value="SOPLADO">Soplado</MenuItem>
              </Select>
            </FormControl>
            <Box sx={{ gridColumn: '1 / -1' }}>
              {moldWorkspace === 'select' && !masterPanel && (
                <Stack spacing={1}>
                  <SearchableCatalogAutocomplete
                    id="exceptional-of-mold"
                    label="Molde"
                    options={moldCatalog}
                    value={moldCatalog.find((item) => item.codigo === moldId) || (moldId ? { codigo: moldId, nombre: mold?.nombre || 'Molde seleccionado' } : null)}
                    onChange={(option) => chooseMold(option?.codigo || '')}
                    getOptionKey={(option) => option?.codigo}
                    getSearchText={(option) => [option?.nombre, option?.codigo, option?.revision].filter(Boolean).join(' ')}
                    disabled={busy || Boolean(uncertainAttempt) || moldMutationBusy || masterBusy || Boolean(moldUncertainAttempt) || Boolean(masterPanel)}
                    required
                    noOptionsText="No hay moldes"
                    actions={[
                      { label: 'Buscar en catálogo', icon: <SearchOutlinedIcon fontSize="small" />, onClick: openMoldCatalog },
                      { label: 'Crear molde', icon: <AddCircleOutlineOutlinedIcon fontSize="small" />, onClick: openMoldCreator },
                      { label: 'Ver ficha', icon: <InfoOutlinedIcon fontSize="small" />, onClick: () => setMoldWorkspace('detail'), disabled: !mold, ariaLabel: 'Ver ficha del molde' },
                    ]}
                  />
                </Stack>
              )}
              {moldWorkspace === 'catalog' && !masterPanel && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <Box>
                        <Typography component="h3" variant="h6" fontWeight={800}>Buscar molde en catálogo</Typography>
                        <Typography variant="body2" color="text.secondary">Selecciona un molde existente para conservar el borrador de la OF.</Typography>
                      </Box>
                      <Button size="small" onClick={() => setMoldWorkspace('select')} disabled={allBusy}>Volver a OF</Button>
                    </Stack>
                    <TextField
                      label="Buscar moldes"
                      value={moldCatalogQuery}
                      onChange={(event) => { setMoldCatalogQuery(event.target.value); setMoldCatalogPage(0); }}
                      placeholder="Nombre o código"
                      autoFocus
                    />
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small" aria-label="Catálogo de moldes">
                        <TableHead><TableRow><TableCell>Molde</TableCell><TableCell>Código</TableCell><TableCell>Ciclo (s)</TableCell><TableCell>Composición</TableCell><TableCell align="right">Acción</TableCell></TableRow></TableHead>
                        <TableBody>
                          {visibleMoldCatalogRows.map((item) => (
                            <TableRow key={item.codigo || item.id}>
                              <TableCell><Typography fontWeight={750}>{item.nombre || 'Molde sin nombre'}</Typography></TableCell>
                              <TableCell>{item.codigo || 'Sin código'}</TableCell>
                              <TableCell>{item.tiempo_ciclo_std ?? '—'}</TableCell>
                              <TableCell>
                                {(item.formas || []).filter((shape) => shape.activo !== false).length
                                  ? (item.formas || []).filter((shape) => shape.activo !== false).map((shape) => (
                                  <Box key={shape.pieza_id || shape.id} sx={{ mb: 0.5 }}>
                                    <Typography variant="body2" fontWeight={700}>{shape.nombre || 'Pieza sin nombre'}</Typography>
                                    <Typography variant="caption" color="text.secondary">{shape.pieza_codigo || shape.pieza_id || 'Sin código'} · {shape.cavidades || 0} cavidades</Typography>
                                  </Box>
                                )) : '—'}
                              </TableCell>
                              <TableCell align="right"><Button size="small" variant="outlined" disabled={loadingMold || moldMutationBusy} onClick={() => { setMoldUncertainAttempt(null); setMoldMutationError(''); setMoldWorkspace('select'); chooseMold(item.codigo); }}>Seleccionar</Button></TableCell>
                            </TableRow>
                          ))}
                          {!visibleMoldCatalogRows.length && <TableRow><TableCell colSpan={5}>No hay moldes que coincidan con la búsqueda.</TableCell></TableRow>}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color="text.secondary">{moldCatalogRows.length} moldes</Typography>
                      <Stack direction="row" spacing={1}>
                        <Button size="small" disabled={moldCatalogPage <= 0} onClick={() => setMoldCatalogPage((page) => page - 1)}>Anterior</Button>
                        <Typography variant="caption" sx={{ alignSelf: 'center' }}>Página {moldCatalogPage + 1} de {moldCatalogPageCount}</Typography>
                        <Button size="small" disabled={moldCatalogPage >= moldCatalogPageCount - 1} onClick={() => setMoldCatalogPage((page) => page + 1)}>Siguiente</Button>
                      </Stack>
                    </Stack>
                  </Stack>
                </Paper>
              )}
              {moldWorkspace === 'create' && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Configura las piezas, cavidades y pesos del molde.</Typography>
                        <Typography variant="body2" color="text.secondary">El código y los SKU se asignan automáticamente al guardar.</Typography>
                      </Box>
                      <Button size="small" onClick={() => setMoldWorkspace('select')} disabled={moldMutationBusy || Boolean(moldUncertainAttempt)}>Volver a OF</Button>
                    </Stack>
                    {moldMutationError && <Alert severity="error">{moldMutationError}</Alert>}
                    {moldUncertainAttempt && (
                      <Alert severity="warning" action={<Button color="inherit" onClick={openMoldCatalog} disabled={moldMutationBusy}>Revisar catálogo</Button>}>
                        Alta incierta: el borrador está conservado y no se enviará otro POST. Revisa el catálogo para reconciliar el molde antes de continuar.
                      </Alert>
                    )}
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1.5fr 1fr 1fr' }, gap: 1.5 }}>
                      <TextField label="Nombre del molde" required value={moldDraft.nombre} onChange={(event) => setMoldDraft((current) => ({ ...current, nombre: event.target.value }))} disabled={moldMutationBusy || Boolean(moldUncertainAttempt)} />
                      <TextField label="Peso de tiro (g)" required type="number" value={moldDraft.peso_tiro_gr} onChange={(event) => setMoldDraft((current) => ({ ...current, peso_tiro_gr: event.target.value }))} disabled={moldMutationBusy || Boolean(moldUncertainAttempt)} slotProps={{ htmlInput: { min: 0.001, step: 'any' } }} />
                      <TextField label="Ciclo estándar (s)" required type="number" value={moldDraft.tiempo_ciclo_std} onChange={(event) => setMoldDraft((current) => ({ ...current, tiempo_ciclo_std: event.target.value }))} disabled={moldMutationBusy || Boolean(moldUncertainAttempt)} slotProps={{ htmlInput: { min: 0.001, step: 'any' } }} />
                    </Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box><Typography fontWeight={750}>Piezas del molde</Typography><Typography variant="caption" color="text.secondary">Cavidades y peso pertenecen a este molde.</Typography></Box>
                      <Button startIcon={<AddOutlinedIcon />} size="small" onClick={() => setMoldDraft((current) => ({ ...current, piezas: [...current.piezas, emptyMoldPiece()] }))} disabled={moldMutationBusy || Boolean(moldUncertainAttempt)}>Añadir pieza</Button>
                    </Stack>
                    {(moldDraft.piezas || []).map((piece, index) => (
                      <PieceCompositionEditor
                        key={piece.client_id}
                        index={index}
                        piece={piece}
                        piecesCatalog={pieceCatalog}
                        onChange={(nextPiece) => setMoldDraft((current) => ({ ...current, piezas: current.piezas.map((item) => item.client_id === piece.client_id ? nextPiece : item) }))}
                        onRemove={() => setMoldDraft((current) => ({ ...current, piezas: current.piezas.filter((item) => item.client_id !== piece.client_id) }))}
                        disabled={moldMutationBusy}
                        weightLabel="Peso neto por pieza (g)"
                        weightHelperText="Peso neto de una unidad; el servidor asigna los códigos automáticamente."
                      />
                    ))}
                    <Alert severity={Number(moldDraft.peso_tiro_gr) >= moldNetWeight ? 'info' : 'warning'}>
                      Peso neto calculado: {moldNetWeight.toFixed(1)} g. El tiro debe ser igual o mayor.
                    </Alert>
                    <Button variant="contained" onClick={createContextualMold} disabled={moldMutationBusy || Boolean(moldUncertainAttempt)}>
                      {moldMutationBusy ? 'Creando molde…' : 'Crear y usar este molde'}
                    </Button>
                  </Stack>
                </Paper>
              )}
              {moldWorkspace === 'detail' && mold && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography component="h3" variant="h6" fontWeight={800}>{mold.nombre || moldId}</Typography><Typography variant="body2" color="text.secondary">Código {mold.codigo || moldId}</Typography></Box><Button size="small" onClick={() => setMoldWorkspace('select')}>Volver a OF</Button></Stack>
                    <Typography variant="body2">Ciclo: {mold.tiempo_ciclo_std ?? '—'} s · Peso de tiro: {mold.peso_tiro_gr ?? mold.peso_colada_gr ?? '—'} g</Typography>
                    {(mold.formas || []).filter((shape) => shape.activo !== false).map((shape) => (
                      <Box key={shape.pieza_id || shape.id}>
                        <Typography variant="body2" fontWeight={700}>{shape.nombre || 'Pieza sin nombre'}</Typography>
                        <Typography variant="caption" color="text.secondary">{shape.pieza_codigo || shape.pieza_id || 'Sin código'} · {shape.cavidades || 0} cavidades · {formatGrams(shape.peso_unitario_gr)} g</Typography>
                      </Box>
                    ))}
                  </Stack>
                </Paper>
              )}
            </Box>
            <SearchableCatalogAutocomplete
              id="exceptional-of-machine"
              label="Máquina sugerida (opcional)"
              options={suggestedMachines}
              value={suggestedMachines.find((item) => String(item.id) === String(machineId)) || null}
              onChange={(option) => setMachineId(option?.id || '')}
              getOptionKey={(option) => option?.id}
              getSearchText={(option) => [option?.nombre, option?.codigo, option?.revision].filter(Boolean).join(' ')}
              disabled={busy || Boolean(uncertainAttempt)}
              noOptionsText="No hay máquinas compatibles"
              sx={{ display: parentFormVisible ? undefined : 'none' }}
            />
            <Alert severity={processResolution.valid ? 'info' : 'warning'} sx={{ gridColumn: '1 / -1', display: parentFormVisible ? undefined : 'none' }}>
              {processConflict
                ? `Las rutas seleccionadas son ${linkedProcesses.map(fabricationProcessLabel).join(' y ')} y no coinciden con ${fabricationProcessLabel(processResolution.explicit)}. Cambia el proceso explícito o retira las referencias incompatibles.`
                : processResolution.valid
                ? `Proceso resuelto: ${fabricationProcessLabel(processResolution.process)}. La máquina sugerida es opcional; la máquina real se elige en la OT.`
                : 'Selecciona Inyección o Soplado. Si vinculas rutas, todas deben corresponder al mismo proceso.'}
            </Alert>
            {routeError && (
              <Alert severity="warning" sx={{ gridColumn: '1 / -1', display: parentFormVisible ? undefined : 'none' }}>
                {routeError} Puedes continuar con proceso explícito o reintentar al cambiar el molde/color.
              </Alert>
            )}
            <TextField required type="number" label="Tiempo de ciclo (s)" value={cycleSeconds} onChange={(event) => setCycleSeconds(event.target.value)} disabled={busy || Boolean(uncertainAttempt)} sx={{ display: parentFormVisible ? undefined : 'none' }} slotProps={{ htmlInput: { min: 0.001, step: 'any' } }} />
            <TextField required type="number" label="Horas de turno" value={shiftHours} onChange={(event) => setShiftHours(event.target.value)} disabled={busy || Boolean(uncertainAttempt)} sx={{ display: parentFormVisible ? undefined : 'none' }} slotProps={{ htmlInput: { min: 0.1, step: 'any' } }} />
            <TextField type="number" label="Peso de colada (g)" value={runnerWeight} onChange={(event) => setRunnerWeight(event.target.value)} disabled={busy || Boolean(uncertainAttempt)} sx={{ display: parentFormVisible ? undefined : 'none' }} slotProps={{ htmlInput: { min: 0, step: 'any' } }} />
          </Box>

          <Divider sx={{ display: parentFormVisible ? undefined : 'none' }} />
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} sx={{ display: parentFormVisible ? undefined : 'none' }}>
            <Box>
              <Typography variant="h6" component="h3" fontWeight={800}>Objetivos por color</Typography>
              <Typography variant="body2" color="text.secondary">Cada objetivo produce todas las formas activas del molde en el color seleccionado.</Typography>
            </Box>
            <Button
              startIcon={<AddOutlinedIcon />}
                    onClick={() => {
                      setRuns((current) => [...current, emptyRun(`run-${Date.now()}`)]);
                      setMachineId('');
                    }}
              disabled={!mold || busy || Boolean(uncertainAttempt)}
            >
              Agregar color
            </Button>
          </Stack>

          {parentFormVisible && runs.map((run, runIndex) => (
            <Paper key={run.key} variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                  <SearchableCatalogAutocomplete
                    id={`exceptional-of-run-${run.key}-color`}
                    label={`Color del objetivo ${runIndex + 1}`}
                    options={colorOptions}
                    value={colorOptions.find((color) => String(color.id) === String(run.color_produccion_id)) || null}
                    onChange={(option) => updateRun(runIndex, {
                      color_produccion_id: option?.id || '',
                      receta_revision_id: defaultRecipeForRun(recipeOptions, { salidas: [] }, option?.id)?.id || '',
                    })}
                    getOptionKey={(option) => option?.id}
                    getPrimary={colorLabel}
                    getSecondary={(option) => [option?.codigo || option?.code, option?.hex_referencia || option?.color_hex].filter(Boolean).join(' · ')}
                    getSearchText={(option) => [colorLabel(option), option?.codigo, option?.hex_referencia, option?.familia_color?.nombre].filter(Boolean).join(' ')}
                    getColorHex={(option) => option?.hex_referencia || option?.color_hex}
                    disabled={allBusy}
                    required
                    noOptionsText="No hay colores"
                    actions={[
                      { label: 'Buscar en catálogo', icon: <SearchOutlinedIcon fontSize="small" />, onClick: () => openMasterPanel('color', runIndex, 'catalog') },
                      { label: 'Crear color', icon: <AddCircleOutlineOutlinedIcon fontSize="small" />, onClick: () => openMasterPanel('color', runIndex, 'create') },
                      { label: 'Ver ficha', icon: <InfoOutlinedIcon fontSize="small" />, onClick: () => openMasterPanel('color', runIndex, 'detail'), disabled: !run.color_produccion_id },
                    ]}
                  />
                  <WeightInput
                    fullWidth
                    unit="kg"
                    positive
                    label={`Objetivo ${runIndex + 1} (kg netos)`}
                    required
                    value={run.objetivo_neto_kg}
                    onChange={(event) => updateRun(runIndex, { objetivo_neto_kg: event.target.value })}
                    disabled={busy || Boolean(uncertainAttempt)}
                    slotProps={{ htmlInput: { min: 0, step: 0.001 } }}
                    helperText="Obligatorio: indica kg netos para calcular ciclos completos; los kg reales vienen del pesaje."
                  />
                  <Box sx={{ alignSelf: 'center', minWidth: 180 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Ciclos calculados
                    </Typography>
                    <Typography fontWeight={800}>
                      {runMetrics[runIndex]?.cycles > 0
                        ? `${runMetrics[runIndex].cycles} ciclos calculados`
                        : 'Se calculará al indicar kg'}
                    </Typography>
                  </Box>
                  <IconButton
                    aria-label={`Eliminar objetivo de color ${runIndex + 1}`}
                    disabled={runs.length === 1 || busy || Boolean(uncertainAttempt)}
                    onClick={() => {
                      setRuns((current) => current.filter((_, index) => index !== runIndex));
                      setMachineId('');
                    }}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Stack>
                {runMetrics[runIndex]?.cycles > 0 && (
                  <Alert severity="info">
                    {`Objetivo ${formatKg(runMetrics[runIndex].objective)} kg netos · `
                      + `${runMetrics[runIndex].cycles} ciclos calculados · `
                      + `${formatKg(runMetrics[runIndex].reachableKg)} kg alcanzables · `
                      + `redondeo de ${formatKg(runMetrics[runIndex].roundingKg)} kg.`}
                    {' '}La producción real se registra con pesajes.
                  </Alert>
                )}
                {run.color_produccion_id && (
                  <FabricationRecipeSelector
                    idPrefix={`exceptional-run-${run.key}`}
                    run={{ salidas: [] }}
                    colorId={run.color_produccion_id}
                    recipes={recipeOptions}
                    value={run.receta_revision_id}
                    editable={!busy && !uncertainAttempt}
                    onChange={(recipeId) => updateRun(runIndex, {
                      receta_revision_id: recipeId,
                    })}
                    onOpenWorkspace={() => openMasterPanel('recipe', runIndex, 'catalog')}
                  />
                )}
                {run.color_produccion_id && (
                  <SearchableCatalogAutocomplete
                    id={`exceptional-of-run-${run.key}-route`}
                    label="Operación de ruta (opcional)"
                    options={routeOptionsForRun(
                      { ...run, salidas: outputGroups[runIndex].map((output) => ({ articulo: output.article })) },
                      routesByArticle,
                    )}
                    value={routeOptionsForRun(
                      { ...run, salidas: outputGroups[runIndex].map((output) => ({ articulo: output.article })) },
                      routesByArticle,
                    ).find((option) => String(option.operacion_ruta_revision_id) === String(run.operacion_ruta_revision_id)) || null}
                    onChange={(option) => {
                      updateRun(runIndex, {
                        operacion_ruta_revision_id: option?.operacion_ruta_revision_id || '',
                      });
                      setMachineId('');
                    }}
                    getOptionKey={(option) => option?.operacion_ruta_revision_id}
                    getSearchText={(option) => [
                      option?.nombre,
                      option?.route_codigo,
                      option?.proceso,
                      option?.articulo_salida?.nombre,
                      option?.articulo_salida?.codigo,
                    ].filter(Boolean).join(' ')}
                    getPrimary={(option) => `${option.nombre} · ${fabricationProcessLabel(option.proceso)}`}
                    getSecondary={(option) => option.articulo_salida?.nombre || option.articulo_salida?.codigo || option.route_codigo}
                    loading={routeLoading}
                    disabled={busy || Boolean(uncertainAttempt)}
                    noOptionsText={routeLoading ? 'Cargando rutas compatibles…' : 'Sin ruta aprobada para estas salidas'}
                    helperText="Sólo se muestran revisiones APROBADA / OP_OT con salida exacta del objetivo."
                  />
                )}
                {run.color_produccion_id && outputGroups[runIndex].map((output) => (
                  <Alert
                    key={output.pieza_id}
                    severity={output.variant && output.article ? 'success' : 'warning'}
                  >
                    <Typography component="span" fontWeight={750}>
                      {output.pieza_nombre || `Pieza ${output.pieza_id}`}
                    </Typography>
                    {output.pieza_codigo && (
                      <Typography component="span" variant="caption" color="text.secondary"> · {output.pieza_codigo}</Typography>
                    )}
                    {output.variant && output.article ? (
                      <Typography component="span">{` · ${output.article.codigo || output.article.nombre} · ${output.cantidad_por_ciclo} un/ciclo · ${output.peso_unitario_g} g`}</Typography>
                    ) : (
                      <Typography component="span"> · falta habilitar este color en el molde o sincronizar su artículo SCM.</Typography>
                    )}
                  </Alert>
                ))}
                {run.color_produccion_id
                  && outputGroups[runIndex].length > 0
                  && outputGroups[runIndex].some((output) => !output.variant || !output.article)
                  && (
                    <Button
                      variant="outlined"
                      onClick={() => enableColorForMold(run.color_produccion_id)}
                      disabled={busy || colorMutationBusy || Boolean(uncertainAttempt) || loadingMold}
                    >
                      {colorMutationBusy ? 'Habilitando color…' : 'Habilitar color en todo el molde'}
                    </Button>
                  )}
              </Stack>
            </Paper>
          ))}
          {parentFormVisible && duplicateColors && <Alert severity="warning">No repitas el mismo color en dos objetivos.</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={allBusy || masterDirty} sx={{ display: parentFormVisible || moldWorkspace === 'create' ? undefined : 'none' }}>Cancelar</Button>
        <Button variant="contained" onClick={submit} disabled={!canSubmit} sx={{ display: parentFormVisible ? undefined : 'none' }}>
          {busy ? 'Creando...' : 'Crear OF en borrador'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
