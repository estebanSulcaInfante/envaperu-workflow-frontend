import {
  Alert,
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ScmArticleAutocomplete from '../../ui/ScmArticleAutocomplete';
import {
  buildStructurePayload,
  compactDecimal,
  emptyStructureLine,
  revisionEditPolicy,
  validateStructureValue,
} from './engineeringEditorModel';

function StructureRevisionEditor({
  targetArticle,
  componentArticles = [],
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
  const policy = revisionEditPolicy(revision);
  const disabled = busy || readOnly || !policy.editable;
  const errors = validateStructureValue(value);
  const approvedByArticle = new Map();
  structures
    .filter((item) => item.estado === 'APROBADA')
    .sort((left, right) => Number(right.numero_revision) - Number(left.numero_revision))
    .forEach((item) => {
      if (!approvedByArticle.has(Number(item.articulo_resultado_id))) {
        approvedByArticle.set(Number(item.articulo_resultado_id), item);
      }
    });

  const updateLine = (index, patch) => {
    const next = [...(value.componentes || [])];
    next[index] = { ...next[index], ...patch };
    onChange({ ...value, componentes: next });
  };

  return (
    <Stack spacing={2}>
      {showHeading && (
        <Box>
          <Typography component="h2" variant="h6">
            Estructura de {targetArticle?.codigo || 'producto por resolver'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Define qué piezas-color o WIP se consumen para producir una unidad.
          </Typography>
        </Box>
      )}
      <TextField
        label="Artículo resultado"
        value={targetArticle
          ? `${targetArticle.codigo} · ${targetArticle.nombre}`
          : 'Producto no resuelto'}
        slotProps={{ htmlInput: { readOnly: true } }}
        helperText="El resultado está fijado por el contexto y no se cambia dentro de la revisión."
      />
      {policy.guidance && <Alert severity="warning">{policy.guidance}</Alert>}
      <TextField
        label="Notas de revisión"
        value={value.notas || ''}
        disabled={disabled}
        onChange={(event) => onChange({ ...value, notas: event.target.value })}
      />
      {(value.componentes || []).map((line, index) => {
        const selected = componentArticles.find(
          (article) => String(article.id) === String(line.articulo_id),
        );
        const approvedWip = selected?.clase === 'SUBENSAMBLE_WIP'
          ? approvedByArticle.get(Number(selected.id))
          : null;
        return (
          <Box key={`${line.articulo_id || 'new'}-${index}`}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
              <ScmArticleAutocomplete
                label="Artículo componente"
                articles={componentArticles}
                value={line.articulo_id}
                placeholder="Buscar pieza-color o WIP"
                disabled={disabled}
                onChange={(articleId) => updateLine(index, { articulo_id: articleId })}
              />
              <TextField
                label="Cantidad UN"
                type="number"
                size="small"
                value={line.cantidad}
                disabled={disabled}
                inputProps={{ min: 0, step: 'any' }}
                helperText="Unidades necesarias para 1 unidad del resultado."
                onChange={(event) => updateLine(index, { cantidad: event.target.value })}
                sx={{ width: { xs: '100%', md: 160 }, flexShrink: 0 }}
              />
              <TextField
                label="Pérdida esperada del componente (%)"
                type="number"
                size="small"
                value={line.merma_tecnica_pct}
                disabled={disabled}
                inputProps={{ min: 0, step: 'any' }}
                helperText="Pérdida adicional durante esta transformación."
                onChange={(event) => updateLine(index, {
                  merma_tecnica_pct: event.target.value,
                })}
                sx={{ width: { xs: '100%', md: 280 }, flexShrink: 0 }}
              />
              {!disabled && (
                <IconButton
                  aria-label={`Quitar componente ${index + 1}`}
                  disabled={(value.componentes || []).length === 1}
                  onClick={() => onChange({
                    ...value,
                    componentes: value.componentes.filter((_, row) => row !== index),
                  })}
                >
                  <DeleteOutlineIcon />
                </IconButton>
              )}
            </Stack>
            {selected?.clase === 'SUBENSAMBLE_WIP' && approvedWip && (
              <Alert severity="info" sx={{ mt: 1 }}>
                <Typography variant="body2" fontWeight={800}>
                  Composición vigente de {selected.codigo} · revisión {approvedWip.numero_revision}
                </Typography>
                <Typography variant="body2">
                  {approvedWip.componentes.map((component) => (
                    `${compactDecimal(component.cantidad)} × ${component.articulo?.codigo} · ${component.articulo?.nombre}`
                  )).join(' + ')}
                </Typography>
              </Alert>
            )}
            {selected?.clase === 'SUBENSAMBLE_WIP' && !approvedWip && (
              <Alert
                severity="warning"
                sx={{ mt: 1 }}
                action={onNavigateStructure ? (
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => onNavigateStructure(selected.id)}
                  >
                    Abrir estructura WIP
                  </Button>
                ) : undefined}
              >
                {selected.codigo} no tiene una estructura aprobada. No publiques esta BOM
                hasta definir la composición del WIP.
              </Alert>
            )}
          </Box>
        );
      })}
      {!disabled && (
        <Button
          startIcon={<AddIcon />}
          onClick={() => onChange({
            ...value,
            componentes: [...(value.componentes || []), emptyStructureLine()],
          })}
          sx={{ alignSelf: 'flex-start' }}
        >
          Agregar componente
        </Button>
      )}
      {errors.length > 0 && !readOnly && (
        <Alert severity="info">
          <Typography variant="body2" fontWeight={800}>Completa la estructura:</Typography>
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
              onClick={() => onSubmit(buildStructurePayload(value))}
            >
              {submitLabel}
            </Button>
          )}
        </Stack>
      )}
    </Stack>
  );
}

export default StructureRevisionEditor;
