import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ScmArticleAutocomplete from '../../ui/ScmArticleAutocomplete';
import {
  buildRoutePayload,
  emptyRouteOperation,
  EXECUTOR_LABEL,
  executorKindForOperationType,
  nextOperationKey,
  normalizeRouteOutputs,
  OPERATION_TYPES,
  OPERATION_TYPE_LABEL,
  revisionEditPolicy,
  validateRouteValue,
} from './engineeringEditorModel';

const hasMeaningfulData = (operation) => Boolean(
  operation.nombre?.trim()
  || operation.centro_trabajo_id
  || operation.articulo_salida_id
  || operation.estructura_revision_id
  || operation.permite_concurrente
);

function RouteRevisionEditor({
  targetArticle,
  articles = [],
  centers = [],
  structures = [],
  revision = null,
  value,
  onChange,
  onSubmit,
  onCancel,
  onNavigateStructure,
  busy = false,
  readOnly = false,
  submitLabel = 'Guardar borrador',
  showHeading = true,
}) {
  const [deleteIndex, setDeleteIndex] = useState(null);
  const policy = revisionEditPolicy(revision);
  const disabled = busy || readOnly || !policy.editable;
  const normalizedOperations = normalizeRouteOutputs(
    value.operaciones || [],
    targetArticle,
    articles,
  );
  const errors = validateRouteValue(
    { ...value, operaciones: normalizedOperations },
    targetArticle,
    articles,
  );
  const activeCenters = centers.filter((center) => center.activo !== false);
  const articlesById = new Map(
    articles.map((article) => [Number(article.id), article]),
  );
  const intermediateArticles = articles.filter((article) => (
    article.clase === 'PIEZA_COLOR' || article.clase === 'SUBENSAMBLE_WIP'
  ));
  const approvedStructureByArticleId = new Map();
  structures
    .filter((item) => item.estado === 'APROBADA')
    .sort((left, right) => Number(right.numero_revision) - Number(left.numero_revision))
    .forEach((item) => {
      if (!approvedStructureByArticleId.has(Number(item.articulo_resultado_id))) {
        approvedStructureByArticleId.set(Number(item.articulo_resultado_id), item);
      }
    });

  const commitOperations = (operations) => onChange({
    ...value,
    operaciones: normalizeRouteOutputs(operations, targetArticle, articles),
  });

  const updateOperation = (index, patch) => {
    const next = [...normalizedOperations];
    next[index] = { ...next[index], ...patch };
    commitOperations(next);
  };

  const moveOperation = (from, to) => {
    if (to < 0 || to >= normalizedOperations.length || from === to) return;
    const next = [...normalizedOperations];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commitOperations(next);
  };

  const removeOperation = (index) => {
    commitOperations(normalizedOperations.filter((_, row) => row !== index));
    setDeleteIndex(null);
  };

  return (
    <Stack spacing={2}>
      {showHeading && (
        <Box>
          <Typography component="h2" variant="h6">
            Ruta de {targetArticle?.codigo || 'producto por resolver'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Ordena las transformaciones, centros de trabajo y salidas intermedias.
          </Typography>
        </Box>
      )}
      <Alert severity="info">
        Esta ruta siempre termina en el producto de la sesión:{' '}
        <strong>{targetArticle?.codigo || 'PT no resuelto'}</strong>. La salida terminal no
        se puede sustituir desde este editor.
      </Alert>
      {policy.guidance && <Alert severity="warning">{policy.guidance}</Alert>}
      <TextField
        label="Notas de revisión"
        value={value.notas || ''}
        disabled={disabled}
        onChange={(event) => onChange({ ...value, notas: event.target.value })}
      />
      {normalizedOperations.map((operation, index) => {
        const terminal = index === normalizedOperations.length - 1;
        const previousOutput = index > 0
          ? articlesById.get(Number(normalizedOperations[index - 1].articulo_salida_id))
          : null;
        const outputArticle = terminal
          ? targetArticle
          : articlesById.get(Number(operation.articulo_salida_id));
        const compatibleStructures = structures.filter((item) => (
          item.estado === 'APROBADA'
          && Number(item.articulo_resultado_id) === Number(outputArticle?.id)
        ));
        const inputLabel = index === 0
          ? 'Entradas definidas por la BOM'
          : previousOutput
            ? `${previousOutput.codigo} · ${previousOutput.nombre}`
            : `Salida pendiente del Paso ${index}`;
        const outputLabel = outputArticle
          ? `${outputArticle.codigo} · ${outputArticle.nombre}`
          : 'Salida pendiente';
        return (
          <Paper
            key={operation.clave}
            variant="outlined"
            data-route-operation-index={index}
            sx={{
              p: { xs: 1.5, sm: 2 },
              borderWidth: terminal ? 2 : 1,
              borderColor: terminal ? 'primary.main' : 'divider',
              bgcolor: terminal ? 'action.hover' : 'background.paper',
            }}
          >
            <Stack spacing={1.5}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1}
                justifyContent="space-between"
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <DragIndicatorIcon color="action" aria-hidden="true" />
                  <Typography variant="h6">Paso {index + 1}</Typography>
                  {terminal && <Chip size="small" color="primary" label="Paso terminal" />}
                </Stack>
                {!disabled && (
                  <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                    <Button
                      size="small"
                      startIcon={<ArrowUpwardIcon />}
                      aria-label={`Mover paso ${index + 1} antes`}
                      disabled={index === 0}
                      onClick={() => moveOperation(index, index - 1)}
                    >
                      Antes
                    </Button>
                    <Button
                      size="small"
                      startIcon={<ArrowDownwardIcon />}
                      aria-label={`Mover paso ${index + 1} después`}
                      disabled={terminal}
                      onClick={() => moveOperation(index, index + 1)}
                    >
                      Después
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteOutlineIcon />}
                      aria-label={`Eliminar paso ${index + 1}`}
                      disabled={normalizedOperations.length === 1}
                      onClick={() => hasMeaningfulData(operation)
                        ? setDeleteIndex(index)
                        : removeOperation(index)}
                    >
                      Eliminar
                    </Button>
                  </Stack>
                )}
              </Stack>
              <Box sx={{ px: 1.5, py: 1, borderRadius: 1, bgcolor: 'background.default' }}>
                <Typography variant="body2">
                  <strong>Entrada:</strong> {inputLabel}
                  {' → '}<strong>Transformación:</strong>{' '}
                  {OPERATION_TYPE_LABEL[operation.tipo] || operation.tipo || 'Por definir'}
                  {' → '}<strong>Salida:</strong> {outputLabel}
                </Typography>
              </Box>
              {!terminal && !operation.articulo_salida_id && (
                <Alert severity="warning">
                  El Paso {index + 1} ahora es intermedio. Selecciona una salida
                  Pieza-color o WIP.
                </Alert>
              )}
              <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1}>
                <TextField
                  label="Nombre de la operación"
                  size="small"
                  value={operation.nombre}
                  disabled={disabled}
                  onChange={(event) => updateOperation(index, { nombre: event.target.value })}
                  sx={{ flex: 1 }}
                />
                <FormControl size="small" sx={{ minWidth: { lg: 170 } }}>
                  <InputLabel id={`route-step-${index}-type-label`}>Tipo de operación</InputLabel>
                  <Select
                    labelId={`route-step-${index}-type-label`}
                    label="Tipo de operación"
                    value={operation.tipo}
                    disabled={disabled}
                    displayEmpty
                    renderValue={(selected) => (
                      selected ? OPERATION_TYPE_LABEL[selected] || selected : 'Selecciona'
                    )}
                    onChange={(event) => {
                      const type = event.target.value;
                      const executorKind = executorKindForOperationType(type);
                      const approved = executorKind === 'ORDEN_OPERACION'
                        ? approvedStructureByArticleId.get(Number(operation.articulo_salida_id))
                        : null;
                      updateOperation(index, {
                        tipo: type,
                        executor_kind: executorKind,
                        estructura_revision_id: approved ? String(approved.id) : '',
                        permite_concurrente: type === 'PREARMADO'
                          ? operation.permite_concurrente
                          : false,
                      });
                    }}
                  >
                    {OPERATION_TYPES.map((type) => (
                      <MenuItem key={type} value={type}>{OPERATION_TYPE_LABEL[type]}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: { lg: 280 } }}>
                  <InputLabel id={`route-step-${index}-executor-label`}>
                    Forma de ejecución
                  </InputLabel>
                  <Select
                    labelId={`route-step-${index}-executor-label`}
                    label="Forma de ejecución"
                    value={operation.executor_kind}
                    disabled={disabled}
                    displayEmpty
                    renderValue={(selected) => (
                      selected ? EXECUTOR_LABEL[selected] || selected : 'Selecciona'
                    )}
                    onChange={(event) => {
                      const approved = event.target.value === 'ORDEN_OPERACION'
                        ? approvedStructureByArticleId.get(Number(operation.articulo_salida_id))
                        : null;
                      updateOperation(index, {
                        executor_kind: event.target.value,
                        estructura_revision_id: approved ? String(approved.id) : '',
                      });
                    }}
                  >
                    <MenuItem value="OP_OT">{EXECUTOR_LABEL.OP_OT}</MenuItem>
                    <MenuItem value="ORDEN_OPERACION">{EXECUTOR_LABEL.ORDEN_OPERACION}</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                <FormControl fullWidth size="small">
                  <InputLabel id={`route-step-${index}-center-label`}>Centro de trabajo</InputLabel>
                  <Select
                    labelId={`route-step-${index}-center-label`}
                    label="Centro de trabajo"
                    value={operation.centro_trabajo_id}
                    disabled={disabled}
                    onChange={(event) => {
                      const selectedCenter = activeCenters.find(
                        (center) => String(center.id) === String(event.target.value),
                      );
                      const type = selectedCenter?.tipo || '';
                      const executorKind = executorKindForOperationType(type);
                      const approved = executorKind === 'ORDEN_OPERACION'
                        ? approvedStructureByArticleId.get(Number(operation.articulo_salida_id))
                        : null;
                      updateOperation(index, {
                        centro_trabajo_id: event.target.value,
                        tipo: type,
                        executor_kind: executorKind,
                        estructura_revision_id: approved ? String(approved.id) : '',
                        permite_concurrente: type === 'PREARMADO'
                          ? operation.permite_concurrente
                          : false,
                      });
                    }}
                  >
                    {activeCenters.map((center) => (
                      <MenuItem key={center.id} value={String(center.id)}>
                        {center.codigo} · {center.nombre}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {terminal ? (
                  <TextField
                    fullWidth
                    size="small"
                    label="Salida terminal (bloqueada)"
                    value={outputLabel}
                    slotProps={{ htmlInput: { readOnly: true } }}
                    helperText={`Esta operación termina la ruta y produce ${targetArticle?.codigo || 'el PT seleccionado'}.`}
                  />
                ) : (
                  <ScmArticleAutocomplete
                    label="Salida intermedia (Pieza-color o WIP)"
                    articles={intermediateArticles}
                    value={operation.articulo_salida_id}
                    disabled={disabled}
                    onChange={(articleId) => {
                      const approved = operation.executor_kind === 'ORDEN_OPERACION'
                        ? approvedStructureByArticleId.get(Number(articleId))
                        : null;
                      updateOperation(index, {
                        articulo_salida_id: articleId,
                        estructura_revision_id: approved ? String(approved.id) : '',
                      });
                    }}
                  />
                )}
                {operation.executor_kind === 'ORDEN_OPERACION' && (
                  <FormControl fullWidth size="small">
                    <InputLabel id={`route-step-${index}-structure-label`}>
                      Estructura aprobada
                    </InputLabel>
                    <Select
                      labelId={`route-step-${index}-structure-label`}
                      label="Estructura aprobada"
                      value={operation.estructura_revision_id}
                      disabled={disabled}
                      onChange={(event) => updateOperation(index, {
                        estructura_revision_id: event.target.value,
                      })}
                    >
                      {compatibleStructures.map((item) => (
                        <MenuItem key={item.id} value={String(item.id)}>
                          {item.articulo_resultado?.codigo} · rev. {item.numero_revision}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Stack>
              {operation.executor_kind === 'ORDEN_OPERACION'
                && outputArticle
                && compatibleStructures.length === 0 && (
                <Alert
                  severity="warning"
                  action={onNavigateStructure ? (
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => onNavigateStructure(outputArticle.id)}
                    >
                      Ir a Estructuras BOM
                    </Button>
                  ) : undefined}
                >
                  No existe una BOM aprobada cuyo resultado sea {outputArticle.codigo}.
                </Alert>
              )}
              {operation.tipo === 'PREARMADO' && (
                <FormControlLabel
                  control={(
                    <Checkbox
                      checked={Boolean(operation.permite_concurrente)}
                      disabled={disabled}
                      onChange={(event) => updateOperation(index, {
                        permite_concurrente: event.target.checked,
                      })}
                    />
                  )}
                  label="Permite ejecución concurrente"
                />
              )}
            </Stack>
          </Paper>
        );
      })}
      {!disabled && (
        <Button
          startIcon={<AddIcon />}
          onClick={() => commitOperations([
            ...normalizedOperations,
            {
              ...emptyRouteOperation(normalizedOperations.length + 1),
              clave: nextOperationKey(normalizedOperations),
            },
          ])}
          sx={{ alignSelf: 'flex-start' }}
        >
          Agregar operación
        </Button>
      )}
      {errors.length > 0 && !readOnly && (
        <Alert severity="info">
          <Typography variant="body2" fontWeight={800}>Completa la ruta:</Typography>
          <Box component="ul" sx={{ my: 0.5, pl: 2.5 }}>
            {errors.map((error) => (
              <Typography component="li" variant="body2" key={error}>{error}</Typography>
            ))}
          </Box>
        </Alert>
      )}
      {(onSubmit || onCancel) && (
        <Stack direction={{ xs: 'column-reverse', sm: 'row' }} justifyContent="flex-end" spacing={1}>
          {onCancel && <Button onClick={onCancel} disabled={busy}>Cancelar</Button>}
          {onSubmit && (
            <Button
              variant="contained"
              disabled={disabled || errors.length > 0}
              onClick={() => onSubmit(buildRoutePayload(value, targetArticle, articles))}
            >
              {submitLabel}
            </Button>
          )}
        </Stack>
      )}
      <Dialog open={deleteIndex !== null} onClose={() => setDeleteIndex(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Eliminar paso de la ruta</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 1 }}>
            El Paso {deleteIndex === null ? '' : deleteIndex + 1} contiene datos. Al
            eliminarlo se recalcularán la secuencia y la salida terminal.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteIndex(null)}>Conservar paso</Button>
          <Button color="error" variant="contained" onClick={() => removeOperation(deleteIndex)}>
            Confirmar eliminación
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export default RouteRevisionEditor;
