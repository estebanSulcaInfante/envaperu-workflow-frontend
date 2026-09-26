import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControl, IconButton, InputLabel, MenuItem, Paper, Select,
  Stack, TextField, Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { obtenerMolde } from '../services/api';
import * as scmEngineeringApi from '../services/scmEngineeringApi';
import { crearOrdenFabricacionExcepcionalScm } from '../services/scmOtApi';
import FabricationRecipeSelector from './FabricationRecipeSelector';
import { defaultRecipeForRun } from './fabricationRecipeOptions';
import SearchableCatalogAutocomplete from './ui/SearchableCatalogAutocomplete';
import WeightInput from './ui/WeightInput';
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
  const [routesByArticle, setRoutesByArticle] = useState({});
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [process, setProcess] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingMold, setLoadingMold] = useState(false);
  const [error, setError] = useState('');
  const [uncertainAttempt, setUncertainAttempt] = useState(null);
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
    moldGenerationRef.current += 1;
    setError('');
    setUncertainAttempt(null);
    idempotencyRef.current = { fingerprint: '', key: '' };
    scmEngineeringApi.listarArticulosScm()
      .then((items) => { if (active) setArticles(items); })
      .catch((requestError) => {
        if (active) setError(scmEngineeringApi.mensajeErrorScm(requestError, 'No se pudieron cargar los artículos SCM.'));
      });
    return () => { active = false; };
  }, [open]);

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

  const chooseMold = async (nextMoldId) => {
    const generation = ++moldGenerationRef.current;
    setMoldId(nextMoldId);
    setMold(null);
    setMachineId('');
    setRuns((current) => current.map((run) => ({ ...run, operacion_ruta_revision_id: '' })));
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
      setCycleSeconds(String(detail.tiempo_ciclo_std ?? ''));
      setRunnerWeight(String(Math.max(Number(detail.peso_colada_gr || 0), 0)));
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

  const updateRun = (index, changes) => setRuns((current) => current.map((run, runIndex) => {
    if (index !== runIndex) return run;
    const next = { ...run, ...changes };
    if (Object.prototype.hasOwnProperty.call(changes, 'color_produccion_id')) {
      next.operacion_ruta_revision_id = '';
    }
    return next;
  }));

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
    <Dialog open={open} onClose={busy || uncertainAttempt ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>Nueva OF de reposición</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="info">
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
          <TextField
            required
            fullWidth
            multiline
            minRows={2}
            label="Motivo de reposición"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={busy || Boolean(uncertainAttempt)}
            helperText="Ej.: reposición autorizada de asas para futuros prearmados de balde."
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <FormControl fullWidth required={!processResolution.complete}>
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
            <SearchableCatalogAutocomplete
              id="exceptional-of-mold"
              label="Molde"
              options={molds}
              value={molds.find((item) => item.codigo === moldId) || (moldId ? { codigo: moldId, nombre: mold?.nombre || 'Molde seleccionado' } : null)}
              onChange={(option) => chooseMold(option?.codigo || '')}
              getOptionKey={(option) => option?.codigo}
              getSearchText={(option) => [option?.nombre, option?.codigo, option?.revision].filter(Boolean).join(' ')}
              disabled={busy || Boolean(uncertainAttempt)}
              required
              noOptionsText="No hay moldes"
            />
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
            />
            <Alert severity={processResolution.valid ? 'info' : 'warning'} sx={{ gridColumn: '1 / -1' }}>
              {processConflict
                ? `Las rutas seleccionadas son ${linkedProcesses.map(fabricationProcessLabel).join(' y ')} y no coinciden con ${fabricationProcessLabel(processResolution.explicit)}. Cambia el proceso explícito o retira las referencias incompatibles.`
                : processResolution.valid
                ? `Proceso resuelto: ${fabricationProcessLabel(processResolution.process)}. La máquina sugerida es opcional; la máquina real se elige en la OT.`
                : 'Selecciona Inyección o Soplado. Si vinculas rutas, todas deben corresponder al mismo proceso.'}
            </Alert>
            {routeError && (
              <Alert severity="warning" sx={{ gridColumn: '1 / -1' }}>
                {routeError} Puedes continuar con proceso explícito o reintentar al cambiar el molde/color.
              </Alert>
            )}
            <TextField required type="number" label="Tiempo de ciclo (s)" value={cycleSeconds} onChange={(event) => setCycleSeconds(event.target.value)} disabled={busy || Boolean(uncertainAttempt)} slotProps={{ htmlInput: { min: 0.001, step: 'any' } }} />
            <TextField required type="number" label="Horas de turno" value={shiftHours} onChange={(event) => setShiftHours(event.target.value)} disabled={busy || Boolean(uncertainAttempt)} slotProps={{ htmlInput: { min: 0.1, step: 'any' } }} />
            <TextField type="number" label="Peso de colada (g)" value={runnerWeight} onChange={(event) => setRunnerWeight(event.target.value)} disabled={busy || Boolean(uncertainAttempt)} slotProps={{ htmlInput: { min: 0, step: 'any' } }} />
          </Box>

          <Divider />
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
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

          {runs.map((run, runIndex) => (
            <Paper key={run.key} variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                  <FormControl fullWidth required>
                    <InputLabel id={`exceptional-of-run-${run.key}-color-label`}>
                      {`Color del objetivo ${runIndex + 1}`}
                    </InputLabel>
                    <Select
                      id={`exceptional-of-run-${run.key}-color`}
                      labelId={`exceptional-of-run-${run.key}-color-label`}
                      label={`Color del objetivo ${runIndex + 1}`}
                      value={run.color_produccion_id}
                      onChange={(event) => updateRun(runIndex, {
                        color_produccion_id: event.target.value,
                        receta_revision_id: defaultRecipeForRun(
                          recipes,
                          { salidas: [] },
                          event.target.value,
                        )?.id || '',
                      })}
                      disabled={busy || Boolean(uncertainAttempt)}
                    >
                      {colors.map((color) => (
                        <MenuItem key={color.id} value={color.id}>{colorLabel(color)}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
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
                    recipes={recipes}
                    value={run.receta_revision_id}
                    editable={!busy && !uncertainAttempt}
                    onChange={(recipeId) => updateRun(runIndex, {
                      receta_revision_id: recipeId,
                    })}
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
              </Stack>
            </Paper>
          ))}
          {duplicateColors && <Alert severity="warning">No repitas el mismo color en dos objetivos.</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy || Boolean(uncertainAttempt)}>Cancelar</Button>
        <Button variant="contained" onClick={submit} disabled={!canSubmit}>
          {busy ? 'Creando...' : 'Crear OF en borrador'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
