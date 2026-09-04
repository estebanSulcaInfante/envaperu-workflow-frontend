import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControl, IconButton, InputLabel, MenuItem, Paper, Select,
  Stack, TextField, Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { obtenerMolde } from '../services/api';
import { listarArticulosScm, mensajeErrorScm } from '../services/scmEngineeringApi';
import { crearOrdenFabricacionExcepcionalScm } from '../services/scmOtApi';
import FabricationRecipeSelector from './FabricationRecipeSelector';
import { defaultRecipeForRun } from './fabricationRecipeOptions';

const emptyRun = (key = 'run-1') => ({
  key,
  color_produccion_id: '',
  receta_revision_id: '',
  ciclos_objetivo: '',
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
  const [busy, setBusy] = useState(false);
  const [loadingMold, setLoadingMold] = useState(false);
  const [error, setError] = useState('');

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
    setMold(null);
    setError('');
    listarArticulosScm()
      .then((items) => { if (active) setArticles(items); })
      .catch((requestError) => {
        if (active) setError(mensajeErrorScm(requestError, 'No se pudieron cargar los artículos SCM.'));
      });
    return () => { active = false; };
  }, [open]);

  const chooseMold = async (nextMoldId) => {
    setMoldId(nextMoldId);
    setMold(null);
    setError('');
    if (!nextMoldId) return;
    setLoadingMold(true);
    try {
      const detail = await obtenerMolde(nextMoldId);
      setMold(detail);
      setCycleSeconds(String(detail.tiempo_ciclo_std ?? ''));
      setRunnerWeight(String(Math.max(Number(detail.peso_colada_gr || 0), 0)));
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo cargar el molde y sus variantes.'));
    } finally {
      setLoadingMold(false);
    }
  };

  const outputGroups = useMemo(() => runs.map((run) => (
    exceptionalOutputsForRun(mold, articles, run.color_produccion_id)
  )), [articles, mold, runs]);

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
    && Number(machineId) > 0
    && Number(cycleSeconds) > 0
    && Number(shiftHours) > 0
    && Number(runnerWeight) >= 0
    && runs.length > 0
    && runs.every((run) => Number(run.color_produccion_id) > 0 && Number(run.ciclos_objetivo) > 0)
    && !duplicateColors
    && outputsComplete
    && !busy
    && !loadingMold
  );

  const updateRun = (index, changes) => setRuns((current) => current.map((run, runIndex) => (
    index === runIndex ? { ...run, ...changes } : run
  )));

  const submit = async () => {
    if (!canSubmit) {
      setError('Completa el motivo, recurso, corridas y variantes PiezaColor antes de crear la OF.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const created = await crearOrdenFabricacionExcepcionalScm({
        motivo: reason.trim(),
        molde_id: moldId,
        maquina_prevista_id: Number(machineId),
        snapshot_tiempo_ciclo_seg: Number(cycleSeconds),
        snapshot_horas_turno: Number(shiftHours),
        snapshot_peso_colada_gr: Number(runnerWeight),
        corridas: runs.map((run, runIndex) => ({
          color_produccion_id: Number(run.color_produccion_id),
          ...(run.receta_revision_id
            ? { receta_revision_id: Number(run.receta_revision_id) }
            : {}),
          ciclos_objetivo: Number(run.ciclos_objetivo),
          salidas: outputGroups[runIndex].map((output) => ({
            articulo_scm_id: output.article.id,
            cantidad_por_ciclo: output.cantidad_por_ciclo,
            peso_unitario_g: output.peso_unitario_g,
          })),
        })),
      });
      onCreated(created);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo crear la OF de reposición.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>Nueva OF de reposición</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="info">
            Produce PiezaColor para stock sin inventar una OP ni un Producto Terminado. La OF queda
            en borrador y debe liberarse antes de crear OT y mangas.
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            required
            fullWidth
            multiline
            minRows={2}
            label="Motivo de reposición"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            helperText="Ej.: reposición autorizada de asas para futuros prearmados de balde."
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <FormControl fullWidth required>
              <InputLabel id="exceptional-of-mold-label">Molde</InputLabel>
              <Select
                id="exceptional-of-mold"
                labelId="exceptional-of-mold-label"
                label="Molde"
                value={moldId}
                onChange={(event) => chooseMold(event.target.value)}
              >
                {molds.map((item) => (
                  <MenuItem key={item.codigo} value={item.codigo}>{item.codigo} - {item.nombre}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth required>
              <InputLabel id="exceptional-of-machine-label">Máquina prevista</InputLabel>
              <Select
                id="exceptional-of-machine"
                labelId="exceptional-of-machine-label"
                label="Máquina prevista"
                value={machineId}
                onChange={(event) => setMachineId(event.target.value)}
              >
                {machines.map((item) => (
                  <MenuItem key={item.id} value={item.id}>{item.codigo} - {item.nombre}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField required type="number" label="Tiempo de ciclo (s)" value={cycleSeconds} onChange={(event) => setCycleSeconds(event.target.value)} slotProps={{ htmlInput: { min: 0.001, step: 'any' } }} />
            <TextField required type="number" label="Horas de turno" value={shiftHours} onChange={(event) => setShiftHours(event.target.value)} slotProps={{ htmlInput: { min: 0.1, step: 'any' } }} />
            <TextField type="number" label="Peso de colada (g)" value={runnerWeight} onChange={(event) => setRunnerWeight(event.target.value)} slotProps={{ htmlInput: { min: 0, step: 'any' } }} />
          </Box>

          <Divider />
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
            <Box>
              <Typography variant="h6" component="h3" fontWeight={800}>Corridas de color</Typography>
              <Typography variant="body2" color="text.secondary">Cada corrida produce todas las formas activas del molde en ese color.</Typography>
            </Box>
            <Button
              startIcon={<AddOutlinedIcon />}
              onClick={() => setRuns((current) => [...current, emptyRun(`run-${Date.now()}`)])}
              disabled={!mold}
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
                      {`Color corrida ${runIndex + 1}`}
                    </InputLabel>
                    <Select
                      id={`exceptional-of-run-${run.key}-color`}
                      labelId={`exceptional-of-run-${run.key}-color-label`}
                      label={`Color corrida ${runIndex + 1}`}
                      value={run.color_produccion_id}
                      onChange={(event) => updateRun(runIndex, {
                        color_produccion_id: event.target.value,
                        receta_revision_id: defaultRecipeForRun(
                          recipes,
                          { salidas: [] },
                          event.target.value,
                        )?.id || '',
                      })}
                    >
                      {colors.map((color) => (
                        <MenuItem key={color.id} value={color.id}>{colorLabel(color)}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    fullWidth
                    required
                    type="number"
                    label={`Ciclos objetivo corrida ${runIndex + 1}`}
                    value={run.ciclos_objetivo}
                    onChange={(event) => updateRun(runIndex, { ciclos_objetivo: event.target.value })}
                    slotProps={{ htmlInput: { min: 1, step: 1 } }}
                  />
                  <IconButton
                    aria-label={`Eliminar corrida ${runIndex + 1}`}
                    disabled={runs.length === 1}
                    onClick={() => setRuns((current) => current.filter((_, index) => index !== runIndex))}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Stack>
                {run.color_produccion_id && (
                  <FabricationRecipeSelector
                    idPrefix={`exceptional-run-${run.key}`}
                    run={{ salidas: [] }}
                    colorId={run.color_produccion_id}
                    recipes={recipes}
                    value={run.receta_revision_id}
                    editable
                    onChange={(recipeId) => updateRun(runIndex, {
                      receta_revision_id: recipeId,
                    })}
                  />
                )}
                {run.color_produccion_id && outputGroups[runIndex].map((output) => (
                  <Alert
                    key={output.pieza_id}
                    severity={output.variant && output.article ? 'success' : 'warning'}
                  >
                    {output.pieza_codigo || output.pieza_nombre || `Pieza ${output.pieza_id}`}:
                    {' '}{output.variant && output.article
                      ? `${output.article.codigo} - ${output.cantidad_por_ciclo} un/ciclo - ${output.peso_unitario_g} g`
                      : 'falta habilitar este color en el molde o sincronizar su articulo SCM.'}
                  </Alert>
                ))}
              </Stack>
            </Paper>
          ))}
          {duplicateColors && <Alert severity="warning">No repitas el mismo color en dos corridas.</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button variant="contained" onClick={submit} disabled={!canSubmit}>
          {busy ? 'Creando...' : 'Crear OF en borrador'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
