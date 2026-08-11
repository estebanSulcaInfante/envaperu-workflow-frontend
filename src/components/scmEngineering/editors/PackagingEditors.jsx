import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  buildPackagingProfilePayload,
  buildPackagingRulePayload,
  revisionEditPolicy,
  validatePackagingProfileValue,
  validatePackagingRuleValue,
} from './engineeringEditorModel';

const EditorActions = ({ busy, disabled, onCancel, onSubmit, label }) => (
  <Stack direction={{ xs: 'column-reverse', sm: 'row' }} justifyContent="flex-end" spacing={1}>
    {onCancel && <Button onClick={onCancel} disabled={busy}>Cancelar</Button>}
    {onSubmit && (
      <Button variant="contained" disabled={disabled} onClick={onSubmit}>{label}</Button>
    )}
  </Stack>
);

export function PackagingProfileEditor({
  value,
  onChange,
  onSubmit,
  onCancel,
  revision = null,
  busy = false,
  readOnly = false,
  submitLabel = 'Guardar perfil',
  showHeading = true,
}) {
  const policy = revisionEditPolicy(revision);
  const disabled = busy || readOnly || !policy.editable;
  const errors = validatePackagingProfileValue(value);
  return (
    <Stack spacing={2}>
      {showHeading && (
        <Box>
          <Typography component="h2" variant="h6">Perfil empacable</Typography>
          <Typography variant="body2" color="text.secondary">
            Describe el comportamiento físico compartido por artículos equivalentes.
          </Typography>
        </Box>
      )}
      {policy.guidance && <Alert severity="warning">{policy.guidance}</Alert>}
      <TextField
        label="Nombre"
        value={value.nombre || ''}
        disabled={disabled}
        onChange={(event) => onChange({ ...value, nombre: event.target.value })}
      />
      <TextField
        multiline
        minRows={3}
        label="Descripción física"
        value={value.descripcion_fisica || ''}
        disabled={disabled}
        onChange={(event) => onChange({ ...value, descripcion_fisica: event.target.value })}
      />
      <EditorActions
        busy={busy}
        disabled={disabled || errors.length > 0}
        onCancel={onCancel}
        label={submitLabel}
        onSubmit={onSubmit ? () => onSubmit(buildPackagingProfilePayload(value)) : null}
      />
    </Stack>
  );
}

export function PackagingRuleEditor({
  value,
  profiles = [],
  containers = [],
  onChange,
  onSubmit,
  onCancel,
  revision = null,
  busy = false,
  readOnly = false,
  lockIdentity = Boolean(revision),
  submitLabel = 'Guardar regla como borrador',
  showHeading = true,
  idPrefix = 'packaging-rule',
}) {
  const policy = revisionEditPolicy(revision);
  const disabled = busy || readOnly || !policy.editable;
  const errors = validatePackagingRuleValue(value);
  return (
    <Stack spacing={2}>
      {showHeading && (
        <Box>
          <Typography component="h2" variant="h6">Regla de empaque</Typography>
          <Typography variant="body2" color="text.secondary">
            La regla nace como borrador; una prueba física y las capacidades canónicas
            determinan cuándo puede publicarse.
          </Typography>
        </Box>
      )}
      {policy.guidance && <Alert severity="warning">{policy.guidance}</Alert>}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
        <FormControl fullWidth>
          <InputLabel id={`${idPrefix}-profile-label`}>Perfil empacable</InputLabel>
          <Select
            labelId={`${idPrefix}-profile-label`}
            label="Perfil empacable"
            value={value.perfil_empacable_id || ''}
            disabled={disabled || lockIdentity}
            onChange={(event) => onChange({
              ...value,
              perfil_empacable_id: event.target.value,
            })}
          >
            {profiles.map((profile) => (
              <MenuItem key={profile.id} value={String(profile.id)}>
                {profile.codigo} · {profile.nombre}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel id={`${idPrefix}-container-label`}>Tipo de contenedor</InputLabel>
          <Select
            labelId={`${idPrefix}-container-label`}
            label="Tipo de contenedor"
            value={value.tipo_contenedor_id || ''}
            disabled={disabled || lockIdentity}
            onChange={(event) => onChange({
              ...value,
              tipo_contenedor_id: event.target.value,
            })}
          >
            {containers.map((container) => (
              <MenuItem key={container.id} value={String(container.id)}>
                {container.codigo} · {container.nombre}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
      <FormControlLabel
        control={(
          <Checkbox
            checked={Boolean(value.medicion_fisica_probada)}
            disabled={disabled}
            onChange={(event) => onChange({
              ...value,
              medicion_fisica_probada: event.target.checked,
            })}
          />
        )}
        label="Acomodo máximo validado mediante prueba física"
      />
      {!value.medicion_fisica_probada && (
        <Alert severity="warning">
          La medición física sigue pendiente. Puedes guardar el borrador, pero no
          presentarlo como regla aprobada.
        </Alert>
      )}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
        <TextField
          fullWidth
          label="Cantidad operativa objetivo (un)"
          helperText="Carga recomendada; la capacidad final puede ser menor."
          type="number"
          value={value.cantidad_objetivo_un || ''}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, cantidad_objetivo_un: event.target.value })}
        />
        <TextField
          fullWidth
          label="Máximo físico por acomodo (un)"
          helperText="Techo por geometría, volumen y manipulación."
          type="number"
          value={value.cantidad_maxima_probada_un || ''}
          disabled={disabled}
          onChange={(event) => onChange({
            ...value,
            cantidad_maxima_probada_un: event.target.value,
          })}
        />
        <TextField
          fullWidth
          label="Límite neto operativo (kg)"
          helperText="El peso unitario determina el techo por peso."
          type="number"
          value={value.peso_neto_operativo_max_kg || ''}
          disabled={disabled}
          onChange={(event) => onChange({
            ...value,
            peso_neto_operativo_max_kg: event.target.value,
          })}
        />
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
        <TextField
          fullWidth
          label="Margen seguridad (kg)"
          type="number"
          value={value.margen_seguridad_kg ?? '0'}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, margen_seguridad_kg: event.target.value })}
        />
        <TextField
          fullWidth
          label="Tolerancia absoluta (g)"
          type="number"
          value={value.tolerancia_peso_abs_g ?? '0'}
          disabled={disabled}
          onChange={(event) => onChange({
            ...value,
            tolerancia_peso_abs_g: event.target.value,
          })}
        />
        <TextField
          fullWidth
          label="Tolerancia (%)"
          type="number"
          value={value.tolerancia_peso_pct ?? '0'}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, tolerancia_peso_pct: event.target.value })}
        />
      </Stack>
      <TextField
        multiline
        minRows={2}
        label="Notas"
        value={value.notas || ''}
        disabled={disabled}
        onChange={(event) => onChange({ ...value, notas: event.target.value })}
      />
      {errors.length > 0 && !readOnly && (
        <Alert severity="info">
          <Typography variant="body2" fontWeight={800}>Completa la regla:</Typography>
          <Box component="ul" sx={{ my: 0.5, pl: 2.5 }}>
            {errors.map((error) => (
              <Typography component="li" variant="body2" key={error}>{error}</Typography>
            ))}
          </Box>
        </Alert>
      )}
      <EditorActions
        busy={busy}
        disabled={disabled || errors.length > 0}
        onCancel={onCancel}
        label={submitLabel}
        onSubmit={onSubmit ? () => onSubmit(buildPackagingRulePayload(value)) : null}
      />
    </Stack>
  );
}
