import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import { newRecipeComponent } from './technicalStepModel';

const FORMULATION_TYPES = [
  { value: 'EXISTENTE', label: 'Existente' },
  { value: 'NUEVA', label: 'Nueva' },
  { value: 'SIN_PIGMENTO', label: 'Sin pigmento' },
  { value: 'PENDIENTE', label: 'Pendiente' },
];

const itemLabel = (item) => `${item.codigo || `MAT-${item.id}`} · ${item.nombre}`;

export default function ColorFormulationEditor({
  color,
  formulation,
  recipes,
  ingredients,
  errors = {},
  showValidation,
  onChange,
  disabled = false,
}) {
  const error = (field) => (showValidation ? errors[field] : '');
  const availableRecipes = recipes.filter(
    (recipe) => String(recipe.color_produccion_id) === String(color.color_ref),
  );
  const isEditableRecipe = ['NUEVA', 'SIN_PIGMENTO'].includes(formulation.tipo);
  const filteredIngredients = formulation.tipo === 'SIN_PIGMENTO'
    ? ingredients.filter((item) => item.clase === 'MATERIA_PRIMA')
    : ingredients;
  const resinFraction = formulation.componentes
    .filter((component) => component.tipo_componente === 'MATERIA_PRIMA')
    .reduce((sum, component) => sum + Number(component.cantidad || 0), 0);

  const setType = (type) => onChange({
    ...formulation,
    tipo: type,
    receta_ref: null,
    componentes: type === 'SIN_PIGMENTO'
      ? formulation.componentes.filter((item) => item.tipo_componente === 'MATERIA_PRIMA')
      : formulation.componentes,
    motivo_pendiente: '',
  });

  const updateComponent = (index, field, fieldValue) => {
    onChange({
      ...formulation,
      componentes: formulation.componentes.map((component, componentIndex) => {
        if (componentIndex !== index) return component;
        const next = { ...component, [field]: fieldValue };
        if (field === 'material_id') {
          const material = ingredients.find((item) => String(item.id) === String(fieldValue));
          next.tipo_componente = material?.clase === 'MATERIA_PRIMA'
            ? 'MATERIA_PRIMA'
            : material?.tipo_colorante || (material?.clase === 'COLORANTE' ? 'COLORANTE' : 'ADITIVO');
          if (formulation.tipo === 'SIN_PIGMENTO') next.tipo_componente = 'MATERIA_PRIMA';
        }
        return next;
      }),
    });
  };

  return (
    <Paper component="section" variant="outlined" sx={{ p: { xs: 1.25, md: 1.75 }, borderRadius: 2.5 }}>
      <Box component="fieldset" disabled={disabled} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Box>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <ScienceOutlinedIcon color="primary" fontSize="small" />
              <Typography variant="subtitle1" sx={{ fontWeight: 850 }}>
                Formulación · {color.nombre || `Color ${color.client_id}`}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Elige una fuente verificable; cada ingrediente queda declarado por una persona.
            </Typography>
          </Box>
          {formulation.receta_ref && <Chip size="small" color="success" variant="outlined" label={`Receta ${formulation.receta_ref}`} />}
          {disabled && <Chip size="small" color="info" label="Aplicada" />}
        </Stack>

        <Stack direction="row" gap={0.75} flexWrap="wrap" role="group" aria-label={`Tipo de formulación para ${color.nombre || color.client_id}`}>
          {FORMULATION_TYPES.map((type) => (
            <Button
              key={type.value}
              size="small"
              variant={formulation.tipo === type.value ? 'contained' : 'outlined'}
              onClick={() => setType(type.value)}
            >
              {type.label}
            </Button>
          ))}
        </Stack>

        {formulation.tipo === 'EXISTENTE' && (
          <TextField
            select
            fullWidth
            required
            label="Receta existente"
            value={formulation.receta_ref || ''}
            onChange={(event) => onChange({ ...formulation, receta_ref: event.target.value })}
            error={Boolean(error('receta_ref'))}
            helperText={error('receta_ref') || (color.color_ref
              ? 'Solo se muestran recetas del ColorProducción seleccionado.'
              : 'Primero aplica el color nuevo o usa Nueva/Pendiente.')}
          >
            {availableRecipes.map((recipe) => (
              <MenuItem key={recipe.id} value={recipe.id}>
                {recipe.nombre_variante} · revisión {recipe.revision} · {recipe.estado}
              </MenuItem>
            ))}
          </TextField>
        )}

        {isEditableRecipe && (
          <Stack spacing={1.25}>
            <TextField
              type="number"
              label="Base virgen (kg)"
              value={formulation.base_virgen_kg}
              onChange={(event) => onChange({ ...formulation, base_virgen_kg: event.target.value })}
              error={Boolean(error('base_virgen_kg'))}
              helperText={error('base_virgen_kg') || 'Base explícita para la receta en borrador.'}
              slotProps={{ htmlInput: { min: 0.001, step: 0.001 } }}
              sx={{ maxWidth: 300 }}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Ingredientes declarados</Typography>
                <Typography variant="caption" color={error('componentes') ? 'error.main' : 'text.secondary'}>
                  Materias primas: {resinFraction.toFixed(4)} · cada dato proviene de una selección humana.
                </Typography>
              </Box>
              <Button
                size="small"
                startIcon={<AddRoundedIcon />}
                onClick={() => onChange({
                  ...formulation,
                  componentes: [...formulation.componentes, newRecipeComponent()],
                })}
              >
                Añadir ingrediente
              </Button>
            </Stack>
            {error('componentes') && <Alert severity="error">{error('componentes')}</Alert>}
            {formulation.componentes.map((component, index) => {
              const isRaw = component.tipo_componente === 'MATERIA_PRIMA';
              return (
                <Paper key={`${index}-${component.material_id}`} variant="outlined" sx={{ p: 1.25 }}>
                  <Grid container spacing={1} alignItems="center">
                    <Grid size={{ xs: 12, md: 5 }}>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="Material"
                        value={component.material_id}
                        onChange={(event) => updateComponent(index, 'material_id', event.target.value)}
                      >
                        {filteredIngredients.filter((item) => item.activo !== false).map((item) => (
                          <MenuItem key={item.id} value={item.id}>{itemLabel(item)}</MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 5, md: 2.5 }}>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="Rol"
                        value={component.tipo_componente}
                        disabled={formulation.tipo === 'SIN_PIGMENTO'}
                        onChange={(event) => updateComponent(index, 'tipo_componente', event.target.value)}
                      >
                        <MenuItem value="MATERIA_PRIMA">Materia prima</MenuItem>
                        {formulation.tipo !== 'SIN_PIGMENTO' && <MenuItem value="COLORANTE">Colorante</MenuItem>}
                        {formulation.tipo !== 'SIN_PIGMENTO' && <MenuItem value="ADITIVO">Aditivo</MenuItem>}
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 10, sm: 5, md: isRaw ? 3.5 : 2 }}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label={isRaw ? 'Fracción (0–1)' : 'Dosis (g)'}
                        value={component.cantidad}
                        onChange={(event) => updateComponent(index, 'cantidad', event.target.value)}
                        slotProps={{ htmlInput: { min: 0.0001, step: 0.0001 } }}
                      />
                    </Grid>
                    {!isRaw && (
                      <Grid size={{ xs: 10, sm: 5, md: 2 }}>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          label="Por kg virgen"
                          value={component.base_kg}
                          onChange={(event) => updateComponent(index, 'base_kg', event.target.value)}
                          slotProps={{ htmlInput: { min: 0.001, step: 0.001 } }}
                        />
                      </Grid>
                    )}
                    <Grid size={{ xs: 2, md: 1 }}>
                      <IconButton
                        aria-label={`Eliminar ingrediente ${index + 1}`}
                        color="error"
                        onClick={() => onChange({
                          ...formulation,
                          componentes: formulation.componentes.filter((_, itemIndex) => itemIndex !== index),
                        })}
                      >
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </Grid>
                  </Grid>
                </Paper>
              );
            })}
            {!formulation.componentes.length && (
              <Alert severity="warning">
                No hay ingredientes. Añádelos desde el catálogo o marca Pendiente; no se completarán automáticamente.
              </Alert>
            )}
          </Stack>
        )}

        {formulation.tipo === 'PENDIENTE' && (
          <TextField
            fullWidth
            required
            multiline
            minRows={2}
            label="Motivo pendiente"
            value={formulation.motivo_pendiente}
            onChange={(event) => onChange({ ...formulation, motivo_pendiente: event.target.value })}
            error={Boolean(error('motivo_pendiente'))}
            helperText={error('motivo_pendiente') || 'Ejemplo: falta confirmar la receta con el encargado de mezclas.'}
          />
        )}
      </Stack>
      </Box>
    </Paper>
  );
}
