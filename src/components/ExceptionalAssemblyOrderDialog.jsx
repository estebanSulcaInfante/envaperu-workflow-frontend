import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  listarArticulosScm,
  listarEstructurasScm,
  listarRutasArticuloScm,
  mensajeErrorScm,
} from '../services/scmEngineeringApi';
import { crearOrdenArmadoExcepcionalScm } from '../services/scmAssemblyApi';
import ScmArticleAutocomplete from './ui/ScmArticleAutocomplete';

const emptyForm = {
  articulo_salida_id: '',
  operacion: '',
  cantidad_objetivo: '',
  motivo: '',
};

const terminalOperations = (route) => {
  const outgoingIds = new Set((route.precedencias || []).map((edge) => Number(
    edge.anterior_id ?? edge.operacion_anterior_id,
  )));
  return (route.operaciones || []).filter((operation) => !outgoingIds.has(Number(operation.id)));
};

const eligibleRouteOperations = (routes, structures, targetArticleId) => {
  const approvedStructures = new Map(
    structures
      .filter((item) => (
        item.estado === 'APROBADA'
        && Number(item.articulo_resultado_id) === Number(targetArticleId)
      ))
      .map((item) => [Number(item.id), item]),
  );
  return routes
    .filter((route) => (
      route.estado === 'APROBADA'
      && Number(route.articulo_objetivo_id ?? route.articulo_objetivo?.id)
        === Number(targetArticleId)
    ))
    .flatMap((route) => terminalOperations(route).map((operation) => ({
      key: `${route.id}:${operation.id}`,
      route,
      operation,
      structure: approvedStructures.get(Number(operation.estructura_revision_id)),
    })))
    .filter(({ operation, structure }) => (
      operation.executor_kind === 'ORDEN_OPERACION'
      && Number(operation.articulo_salida_id ?? operation.articulo_salida?.id)
        === Number(targetArticleId)
      && Boolean(structure)
    ));
};

function ExceptionalAssemblyOrderDialog({ open, onClose, onCreated }) {
  const [form, setForm] = useState(emptyForm);
  const [wips, setWips] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [structures, setStructures] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [engineeringLoading, setEngineeringLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadWips = async () => {
    setCatalogLoading(true);
    setError('');
    try {
      const items = await listarArticulosScm();
      setWips(items.filter((item) => (
        item.activo !== false && item.clase === 'SUBENSAMBLE_WIP'
      )));
    } catch (requestError) {
      setError(mensajeErrorScm(
        requestError,
        'No se pudieron cargar los WIP habilitados.',
      ));
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm);
    setRoutes([]);
    setStructures([]);
    setError('');
    loadWips();
  }, [open]);

  useEffect(() => {
    let active = true;
    if (!open || !form.articulo_salida_id) {
      setRoutes([]);
      setStructures([]);
      setEngineeringLoading(false);
      return undefined;
    }
    setEngineeringLoading(true);
    setError('');
    Promise.all([
      listarRutasArticuloScm(Number(form.articulo_salida_id)),
      listarEstructurasScm(Number(form.articulo_salida_id)),
    ])
      .then(([routeItems, structureItems]) => {
        if (!active) return;
        setRoutes(routeItems);
        setStructures(structureItems);
      })
      .catch((requestError) => {
        if (active) {
          setRoutes([]);
          setStructures([]);
          setError(mensajeErrorScm(
            requestError,
            'No se pudo validar la ingeniería aprobada del WIP.',
          ));
        }
      })
      .finally(() => {
        if (active) setEngineeringLoading(false);
      });
    return () => { active = false; };
  }, [form.articulo_salida_id, open]);

  const selectedWip = wips.find(
    (item) => String(item.id) === String(form.articulo_salida_id),
  );
  const eligibleOperations = useMemo(
    () => eligibleRouteOperations(routes, structures, form.articulo_salida_id),
    [form.articulo_salida_id, routes, structures],
  );
  const selectedOperation = eligibleOperations.find((item) => item.key === form.operacion);
  const quantity = Number(form.cantidad_objetivo);
  const validQuantity = Number.isInteger(quantity) && quantity > 0;
  const canSubmit = Boolean(
    selectedWip
    && selectedOperation
    && validQuantity
    && form.motivo.trim(),
  );

  const createDraft = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    setError('');
    try {
      const created = await crearOrdenArmadoExcepcionalScm({
        origen_demanda: 'REPOSICION_WIP',
        motivo: form.motivo.trim(),
        articulo_salida_id: Number(selectedWip.id),
        operacion_ruta_revision_id: Number(selectedOperation.operation.id),
        estructura_revision_id: Number(selectedOperation.structure.id),
        cantidad_objetivo: form.cantidad_objetivo,
        versiones: {
          ruta: Number(selectedOperation.route.version),
          estructura: Number(selectedOperation.structure.version),
        },
      });
      onCreated(created);
      onClose();
    } catch (requestError) {
      setError(mensajeErrorScm(
        requestError,
        'No se pudo crear el borrador de OA excepcional.',
      ));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>Nueva OA de reposición WIP</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="info">
            Crea una OA en borrador para reponer WIP sin inventar una OP ni un producto
            terminado. La liberación se realiza por separado.
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}
          {catalogLoading ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={20} />
              <Typography variant="body2">Cargando WIP habilitados…</Typography>
            </Stack>
          ) : (
            <ScmArticleAutocomplete
              label="WIP de salida"
              articles={wips}
              value={form.articulo_salida_id}
              required
              disabled={saving}
              onChange={(articleId) => setForm((current) => ({
                ...current,
                articulo_salida_id: articleId,
                operacion: '',
              }))}
              helperText="Selecciona explícitamente el WIP que esta OA acreditará."
            />
          )}

          {engineeringLoading && (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={20} />
              <Typography variant="body2">Validando ruta y BOM aprobadas…</Typography>
            </Stack>
          )}

          {selectedWip && !engineeringLoading && eligibleOperations.length === 0 && (
            <Alert
              severity="warning"
              action={(
                <Button
                  color="inherit"
                  size="small"
                  component="a"
                  href={`/datos-maestros/ingenieria-scm?tab=rutas&articulo=${selectedWip.id}`}
                >
                  Abrir Ingeniería SCM
                </Button>
              )}
            >
              Este WIP no tiene una operación terminal de OA con ruta y BOM aprobadas.
            </Alert>
          )}

          {selectedWip && !engineeringLoading && eligibleOperations.length > 0 && (
            <Stack spacing={1.25}>
              {eligibleOperations.map(({ key, route, operation, structure }) => (
                <Paper key={key} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ sm: 'center' }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight={800}>
                        Ingeniería aprobada · Ruta rev. {route.numero_revision}
                        {' · '}BOM rev. {structure.numero_revision}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {operation.nombre} · salida {selectedWip.codigo}
                      </Typography>
                    </Box>
                    {operation.permite_concurrente && (
                      <Chip size="small" color="info" label="Concurrente entre ciclos" />
                    )}
                  </Stack>
                </Paper>
              ))}
              <FormControl fullWidth required size="small">
                <InputLabel id="exceptional-oa-operation-label">Operación aprobada</InputLabel>
                <Select
                  labelId="exceptional-oa-operation-label"
                  label="Operación aprobada"
                  value={form.operacion}
                  disabled={saving}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    operacion: event.target.value,
                  }))}
                >
                  {eligibleOperations.map(({ key, route, operation }) => (
                    <MenuItem key={key} value={key}>
                      Ruta rev. {route.numero_revision} · {operation.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          )}

          <TextField
            label="Cantidad objetivo"
            type="number"
            required
            value={form.cantidad_objetivo}
            disabled={saving}
            error={Boolean(form.cantidad_objetivo) && !validQuantity}
            helperText="Unidades discretas; debe ser un entero mayor que cero."
            onChange={(event) => setForm((current) => ({
              ...current,
              cantidad_objetivo: event.target.value,
            }))}
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
          />
          <TextField
            label="Motivo de reposición"
            required
            multiline
            minRows={2}
            value={form.motivo}
            disabled={saving}
            onChange={(event) => setForm((current) => ({
              ...current,
              motivo: event.target.value,
            }))}
            helperText="El motivo queda auditado y no reemplaza la autorización server-side."
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button variant="contained" onClick={createDraft} disabled={!canSubmit || saving}>
          {saving ? 'Creando…' : 'Crear borrador'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ExceptionalAssemblyOrderDialog;

