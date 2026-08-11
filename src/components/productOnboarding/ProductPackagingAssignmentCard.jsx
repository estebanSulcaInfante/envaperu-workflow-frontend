import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import {
  PackagingProfileEditor,
  PackagingRuleEditor,
} from '../scmEngineering/editors';
import {
  PENDING_PROFILE_REF,
  buildProfilePayloadFromEditor,
  buildRulePayloadFromEditor,
  profileEditorValue,
  ruleEditorValue,
} from './engineeringStepModel';

const ModeSelector = ({ label, value, options, onChange, disabled }) => (
  <ToggleButtonGroup
    exclusive
    size="small"
    value={value}
    aria-label={label}
    disabled={disabled}
    onChange={(_, mode) => mode && onChange(mode)}
    sx={{ flexWrap: 'wrap' }}
  >
    {options.map((option) => (
      <ToggleButton key={option.value} value={option.value}>{option.label}</ToggleButton>
    ))}
  </ToggleButtonGroup>
);

const DraftAction = ({ id, value, onChange, canPublish, disabled }) => (
  <FormControl fullWidth size="small" disabled={disabled}>
    <InputLabel id={`${id}-label`}>Al aplicar</InputLabel>
    <Select
      labelId={`${id}-label`}
      label="Al aplicar"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <MenuItem value="GUARDAR_BORRADOR">Guardar como borrador</MenuItem>
      {canPublish && <MenuItem value="PUBLICAR">Publicar directamente</MenuItem>}
    </Select>
  </FormControl>
);

const profilePayloadFromRecord = (profile) => ({
  nombre: profile?.nombre || '',
  descripcion_fisica: profile?.descripcion_fisica || null,
});

const rulePayloadFromRevision = (revision) => ({
  perfil_empacable_id: revision?.perfil_empacable_id,
  tipo_contenedor_id: revision?.tipo_contenedor_id,
  medicion_fisica_probada: Boolean(revision?.medicion_fisica_probada),
  cantidad_objetivo_un: revision?.cantidad_objetivo_un,
  cantidad_maxima_probada_un: revision?.cantidad_maxima_probada_un,
  peso_neto_operativo_max_kg: revision?.peso_neto_operativo_max_kg,
  margen_seguridad_kg: revision?.margen_seguridad_kg ?? 0,
  tolerancia_peso_abs_g: revision?.tolerancia_peso_abs_g ?? 0,
  tolerancia_peso_pct: revision?.tolerancia_peso_pct ?? 0,
  notas: revision?.notas || null,
});

export default function ProductPackagingAssignmentCard({
  assignment,
  article,
  profiles = [],
  rules = [],
  containers = [],
  canView = true,
  canAdmin = true,
  canPublish = false,
  onChange,
  onCopyToOthers,
}) {
  const profile = assignment.perfil_empacable;
  const rule = assignment.regla_empaque;
  const profileValue = profileEditorValue(profile.payload);
  const ruleValue = ruleEditorValue(rule.payload, profile.modo);
  const ruleRevision = rules.find(
    (item) => Number(item.revision_id) === Number(rule.revision_ref),
  ) || null;
  const idPrefix = `packaging-${assignment.client_id}`.replace(/[^a-zA-Z0-9_-]/g, '-');
  const canSelectMode = canView || canAdmin;
  const canUseProfile = canAdmin && (profile.modo !== 'REUTILIZAR' || canView);
  const canUseRule = canAdmin && (rule.modo !== 'REUTILIZAR' || canView);
  const canUseAssignment = canUseProfile
    && canUseRule
    && (rule.accion !== 'PUBLICAR' || canPublish);
  const permissionMessage = !canAdmin
    ? 'Para asignar el perfil predeterminado se requiere Empaque · administrar.'
    : ((profile.modo === 'REUTILIZAR' || rule.modo === 'REUTILIZAR') && !canView)
      ? 'Para reutilizar perfiles o reglas se requiere además Empaque · ver.'
      : rule.accion === 'PUBLICAR' && !canPublish
        ? 'Publicar la regla requiere Empaque · publicación directa. Guarda un borrador o solicita el handoff al actor autorizado.'
        : '';
  const profilesForRule = profile.modo === 'NUEVO'
    ? [{ id: PENDING_PROFILE_REF, codigo: 'NUEVO', nombre: profileValue.nombre || 'Perfil de esta salida' }, ...profiles]
    : profiles;
  const update = (section, patch) => onChange({
    ...assignment,
    [section]: { ...assignment[section], ...patch },
  });

  return (
    <Paper
      variant="outlined"
      component="section"
      aria-labelledby={`${idPrefix}-title`}
      sx={{ p: { xs: 1.5, md: 2 }, borderWidth: 2 }}
    >
      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ sm: 'center' }}
          spacing={1}
        >
          <Box>
            <Typography id={`${idPrefix}-title`} component="h3" variant="h6" fontWeight={850}>
              {article?.codigo || `Artículo #${assignment.articulo_ref}`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {article?.nombre || 'Salida de ruta por resolver'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip size="small" color="primary" variant="outlined" label="Salida con manga" />
            {onCopyToOthers && (
              <Button
                size="small"
                startIcon={<ContentCopyRoundedIcon />}
                onClick={onCopyToOthers}
                disabled={!canUseAssignment}
              >
                Copiar configuración a otras salidas
              </Button>
            )}
          </Stack>
        </Stack>

        {!canUseAssignment && (
          <Alert severity="info">
            {permissionMessage}
          </Alert>
        )}

        <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
          <Stack spacing={2.25}>
            <Box>
              <Typography component="h4" variant="subtitle1" fontWeight={850} gutterBottom>
                Perfil empacable
              </Typography>
              <ModeSelector
                label={`Origen del perfil de ${article?.codigo || assignment.articulo_ref}`}
                value={profile.modo}
                disabled={!canSelectMode}
                options={[
                  { value: 'NUEVO', label: 'Crear perfil' },
                  { value: 'REUTILIZAR', label: 'Reutilizar perfil' },
                  ...(profile.ref ? [{ value: 'EDITAR', label: 'Editar borrador' }] : []),
                ]}
                onChange={(mode) => update('perfil_empacable', {
                  modo: mode,
                  ref: mode === 'NUEVO' ? null : profile.ref,
                  expected_version: mode === 'NUEVO' ? null : profile.expected_version,
                })}
              />
            </Box>
            {profile.modo === 'REUTILIZAR' && (
              <FormControl fullWidth size="small" disabled={!canView}>
                <InputLabel id={`${idPrefix}-profile-existing-label`}>Perfil existente</InputLabel>
                <Select
                  labelId={`${idPrefix}-profile-existing-label`}
                  label="Perfil existente"
                  value={profile.ref || ''}
                  onChange={(event) => {
                    const selected = profiles.find(
                      (item) => Number(item.id) === Number(event.target.value),
                    );
                    onChange({
                      ...assignment,
                      perfil_empacable: {
                        ...profile,
                        ref: event.target.value,
                        expected_version: selected?.version || null,
                        payload: selected ? profilePayloadFromRecord(selected) : profile.payload,
                      },
                      regla_empaque: {
                        ...rule,
                        payload: {
                          ...(rule.payload || {}),
                          perfil_empacable_id: Number(event.target.value),
                        },
                      },
                    });
                  }}
                >
                  {profiles.filter((item) => item.activo !== false).map((item) => (
                    <MenuItem key={item.id} value={item.id}>{item.codigo} · {item.nombre}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <PackagingProfileEditor
              showHeading={false}
              value={profileValue}
              onChange={(next) => update('perfil_empacable', {
                payload: buildProfilePayloadFromEditor(next),
              })}
              readOnly={!canUseProfile || profile.modo === 'REUTILIZAR'}
            />

            <Box sx={{ pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography component="h4" variant="subtitle1" fontWeight={850} gutterBottom>
                Regla de empaque
              </Typography>
              <ModeSelector
                label={`Origen de la regla de ${article?.codigo || assignment.articulo_ref}`}
                value={rule.modo}
                disabled={!canSelectMode}
                options={[
                  { value: 'NUEVA', label: 'Nueva regla' },
                  { value: 'REUTILIZAR', label: 'Vincular existente' },
                  ...(rule.revision_ref ? [{ value: 'EDITAR', label: 'Editar borrador' }] : []),
                ]}
                onChange={(mode) => update('regla_empaque', {
                  modo: mode,
                  revision_ref: mode === 'NUEVA' ? null : rule.revision_ref,
                  expected_version: mode === 'NUEVA' ? null : rule.expected_version,
                  accion: mode === 'REUTILIZAR' ? 'VINCULAR' : 'GUARDAR_BORRADOR',
                })}
              />
            </Box>
            {rule.modo === 'REUTILIZAR' && (
              <FormControl fullWidth size="small" disabled={!canView}>
                <InputLabel id={`${idPrefix}-rule-existing-label`}>Regla existente</InputLabel>
                <Select
                  labelId={`${idPrefix}-rule-existing-label`}
                  label="Regla existente"
                  value={rule.revision_ref || ''}
                  onChange={(event) => {
                    const selected = rules.find(
                      (item) => Number(item.revision_id) === Number(event.target.value),
                    );
                    update('regla_empaque', {
                      revision_ref: event.target.value,
                      expected_version: selected?.version || null,
                      accion: 'VINCULAR',
                      payload: selected ? rulePayloadFromRevision(selected) : rule.payload,
                    });
                  }}
                >
                  {rules.map((item) => (
                    <MenuItem key={item.revision_id} value={item.revision_id}>
                      {item.perfil_empacable?.nombre || 'Perfil'} · rev. {item.numero_revision} · {item.estado}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {rule.modo !== 'REUTILIZAR' && (
              <DraftAction
                id={`${idPrefix}-rule-action`}
                value={rule.accion}
                disabled={!canAdmin}
                canPublish={canPublish}
                onChange={(accion) => update('regla_empaque', { accion })}
              />
            )}
            <PackagingRuleEditor
              showHeading={false}
              idPrefix={`${idPrefix}-rule`}
              value={ruleValue}
              profiles={profilesForRule}
              containers={containers}
              revision={rule.modo === 'EDITAR' ? ruleRevision : null}
              onChange={(next) => update('regla_empaque', {
                payload: buildRulePayloadFromEditor(next, profile.modo),
              })}
              readOnly={!canUseRule || rule.modo === 'REUTILIZAR'}
              lockProfileIdentity={profile.modo === 'NUEVO' || Boolean(ruleRevision)}
              lockContainerIdentity={Boolean(ruleRevision)}
            />
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}
