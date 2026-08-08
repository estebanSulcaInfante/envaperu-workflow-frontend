import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Divider, FormControlLabel,
  Grid, List, ListItemButton, ListItemText, MenuItem, Paper, Stack, Switch,
  TextField, Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import {
  actualizarRolWorkspace,
  crearRolWorkspace,
  definirRolPrincipalWorkspace,
  listarCapacidadesWorkspace,
  listarRolesWorkspace,
  listarTrabajadoresWorkspace,
} from '../services/workspaceAdminApi';
import { buildActorWorkspace } from '../services/workspaceProjection';
import { workspaceAreas, workspaceFeatures } from '../config/workspaceRegistry';
import PageHeader from './ui/PageHeader';

const EMPTY_ROLE = {
  id: null,
  codigo: '',
  nombre: '',
  activo: true,
  capacidad_codigos: [],
  workspace_focus: '',
  workspace_start_feature: '',
  workspace_preferencias: [],
  version: null,
};

const capabilityCodes = (role = {}) => (
  role.capacidad_codigos
  || (role.capacidades || []).map((item) => (typeof item === 'string' ? item : item.codigo))
).filter(Boolean);

const normalizeRole = (role = EMPTY_ROLE) => ({
  ...EMPTY_ROLE,
  ...role,
  capacidad_codigos: capabilityCodes(role),
  workspace_preferencias: (role.workspace_preferencias || []).map((item) => ({
    feature_key: item.feature_key || item.featureKey,
    prioridad: Number(item.prioridad ?? item.priority ?? 100),
    fijada: Boolean(item.fijada ?? item.pinned),
  })),
});

const areaOrder = new Map(workspaceAreas.map((area) => [area.key, area.order]));
const capabilityAreaOverrides = {
  AUTORIZACION_SCM_ADMINISTRAR: 'admin',
};
const capabilityArea = (code = '') => {
  const override = capabilityAreaOverrides[code];
  if (override) return workspaceAreas.find((area) => area.key === override)?.label;
  const areaKeys = workspaceFeatures
    .filter((item) => (item.requiredAny || []).includes(code))
    .map((item) => item.areaKey)
    .sort((left, right) => (areaOrder.get(left) ?? 999) - (areaOrder.get(right) ?? 999));
  return workspaceAreas.find((area) => area.key === areaKeys[0])?.label || 'Otras capacidades';
};

const apiMessage = (error, fallback) => {
  const payload = error?.response?.data;
  const code = payload?.code || payload?.error?.code;
  if (code === 'VERSION_CONFLICT') return 'El rol cambió en otra sesión. Recarga antes de volver a guardar.';
  if (code === 'INVALID_CAPABILITY') return 'Una capacidad seleccionada ya no está activa. Revisa la selección.';
  return payload?.message || payload?.error?.message || fallback;
};

function WorkspacePreview({ workspace, roleActive }) {
  return (
    <Paper component="section" aria-label="Así verá este rol" variant="outlined" sx={{ p: 2, bgcolor: '#F7FAFD' }}>
      <Typography variant="subtitle1" component="h2" fontWeight={850}>
        Así verá este rol
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {workspace.experience.focus}
      </Typography>
      {!roleActive && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          Un rol inactivo no aporta capacidades, foco ni preferencias a ninguna persona.
        </Alert>
      )}
      {workspace.startFeature ? (
        <Alert severity="success" sx={{ mb: 1.5 }}>
          Acceso principal: <strong>{workspace.startFeature.label}</strong>
        </Alert>
      ) : (
        <Alert severity="warning" sx={{ mb: 1.5 }}>El rol no tiene una función compatible.</Alert>
      )}
      <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75}>
        {workspace.homeFeatures.map((item) => (
          <Chip
            key={item.key}
            size="small"
            color={item.pinned ? 'primary' : 'default'}
            variant={item.pinned ? 'filled' : 'outlined'}
            label={item.label}
          />
        ))}
      </Stack>
      {workspace.configurationWarnings.map((item) => (
        <Alert key={`${item.code}-${item.featureKey || ''}`} severity={item.severity || 'info'} sx={{ mt: 1 }}>
          {item.message}
        </Alert>
      ))}
    </Paper>
  );
}

export default function RolesCapabilitiesAdmin() {
  const [roles, setRoles] = useState([]);
  const [capabilities, setCapabilities] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [form, setForm] = useState(EMPTY_ROLE);
  const [search, setSearch] = useState('');
  const [principalSelections, setPrincipalSelections] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async (preferredId = null) => {
    setLoading(true);
    setError('');
    try {
      const [roleItems, capabilityItems, workerItems] = await Promise.all([
        listarRolesWorkspace(),
        listarCapacidadesWorkspace(),
        listarTrabajadoresWorkspace(),
      ]);
      setRoles(roleItems);
      setCapabilities(capabilityItems);
      setWorkers(workerItems);
      const selected = roleItems.find((item) => Number(item.id) === Number(preferredId))
        || roleItems[0]
        || EMPTY_ROLE;
      setForm(normalizeRole(selected));
    } catch (requestError) {
      setError(apiMessage(requestError, 'No pudimos cargar la administración de roles.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const preview = useMemo(() => buildActorWorkspace({
    actor: {
      capacidades_efectivas: form.activo ? form.capacidad_codigos : [],
      rol_principal: {
        id: form.id || 'preview',
        codigo: form.codigo || 'ROL_NUEVO',
        nombre: form.nombre || 'Rol sin nombre',
        workspace_focus: form.workspace_focus,
        workspace_start_feature: form.workspace_start_feature || null,
        workspace_preferencias: form.workspace_preferencias,
        activo: form.activo,
      },
    },
  }), [form]);

  const compatibleFeatures = preview.features.filter(
    (item) => item.navigation !== false && item.key !== 'home.workspace',
  );
  const homeCompatibleFeatures = compatibleFeatures.filter((item) => item.task === true);
  const unavailablePreferences = form.workspace_preferencias.filter((preference) => (
    !homeCompatibleFeatures.some((item) => item.key === preference.feature_key)
  ));
  const capabilityCatalog = useMemo(() => {
    const known = new Set(capabilities.map((item) => item.codigo));
    return [
      ...capabilities,
      ...form.capacidad_codigos
        .filter((code) => !known.has(code))
        .map((code) => ({ codigo: code, nombre: code, activo: false, missing: true })),
    ];
  }, [capabilities, form.capacidad_codigos]);
  const visibleCapabilities = capabilityCatalog.filter((item) => {
    const term = search.trim().toLocaleLowerCase('es');
    if (!term) return true;
    return [item.codigo, item.nombre, item.descripcion]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase('es').includes(term));
  });
  const capabilityGroups = [...new Set(visibleCapabilities.map((item) => capabilityArea(item.codigo)))];
  const inactiveSelected = capabilityCatalog.filter((item) => (
    item.activo === false && form.capacidad_codigos.includes(item.codigo)
  ));
  const workersWithoutPrimary = workers.filter((item) => (
    item.activo !== false
    && (item.roles || []).length > 0
    && !item.rol_principal
  ));

  const toggleCapability = (code) => setForm((current) => ({
    ...current,
    capacidad_codigos: current.capacidad_codigos.includes(code)
      ? current.capacidad_codigos.filter((item) => item !== code)
      : [...current.capacidad_codigos, code],
  }));

  const updatePreference = (featureKey, changes) => setForm((current) => {
    const existing = current.workspace_preferencias.find((item) => item.feature_key === featureKey);
    const next = existing
      ? current.workspace_preferencias.map((item) => (
        item.feature_key === featureKey ? { ...item, ...changes } : item
      ))
      : [...current.workspace_preferencias, {
        feature_key: featureKey,
        prioridad: 100,
        fijada: false,
        ...changes,
      }];
    return { ...current, workspace_preferencias: next };
  });

  const removePreference = (featureKey) => setForm((current) => ({
    ...current,
    workspace_preferencias: current.workspace_preferencias
      .filter((item) => item.feature_key !== featureKey),
  }));

  const save = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    const payload = {
      codigo: form.codigo.trim().toUpperCase(),
      nombre: form.nombre.trim(),
      activo: form.activo,
      capacidad_codigos: form.capacidad_codigos,
      workspace_focus: form.workspace_focus.trim() || null,
      workspace_start_feature: form.workspace_start_feature || null,
      workspace_preferencias: form.workspace_preferencias,
      ...(form.id ? { expected_version: form.version } : {}),
    };
    try {
      const saved = form.id
        ? await actualizarRolWorkspace(form.id, payload)
        : await crearRolWorkspace(payload);
      setNotice('Rol y experiencia actualizados. Las sesiones activas aplicarán el cambio al refrescar su identidad.');
      await load(saved.id || form.id);
    } catch (requestError) {
      setError(apiMessage(requestError, 'No pudimos guardar el rol.'));
    } finally {
      setSaving(false);
    }
  };

  const assignPrimary = async (worker) => {
    const roleId = Number(principalSelections[worker.id]);
    if (!roleId) return;
    setError('');
    try {
      await definirRolPrincipalWorkspace(worker.id, roleId);
      setNotice(`Rol principal definido para ${worker.nombre_corto || worker.nombre_completo}.`);
      await load(form.id);
    } catch (requestError) {
      setError(apiMessage(requestError, 'No pudimos definir el rol principal.'));
    }
  };

  if (loading && !roles.length) {
    return (
      <Stack role="status" aria-label="Cargando roles y capacidades" alignItems="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <Stack spacing={2.5}>
      <PageHeader
        title="Roles y capacidades"
        description="Configura permisos efectivos y la experiencia inicial sin crear menús ni accesos paralelos."
        actions={(
          <Button startIcon={<AddOutlinedIcon />} variant="outlined" onClick={() => setForm(EMPTY_ROLE)}>
            Nuevo rol
          </Button>
        )}
      />
      {error && <Alert severity="error" action={<Button onClick={() => load(form.id)}>Reintentar</Button>}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}

      <Grid container spacing={2} alignItems="flex-start">
        <Grid size={{ xs: 12, lg: 3 }}>
          <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
            <Box sx={{ p: 1.5, bgcolor: '#F7FAFD' }}>
              <Typography fontWeight={850}>Roles operativos</Typography>
              <Typography variant="caption" color="text.secondary">{roles.length} configurados</Typography>
            </Box>
            <List disablePadding aria-label="Roles operativos" sx={{ maxHeight: { xs: 240, lg: 560 }, overflowY: 'auto' }}>
              {roles.map((role) => (
                <ListItemButton
                  key={role.id}
                  selected={Number(form.id) === Number(role.id)}
                  aria-current={Number(form.id) === Number(role.id) ? 'true' : undefined}
                  onClick={() => setForm(normalizeRole(role))}
                >
                  <ListItemText
                    primary={role.nombre}
                    secondary={role.codigo}
                    primaryTypographyProps={{ fontWeight: 750 }}
                  />
                  <Chip size="small" label={role.activo === false ? 'Inactivo' : 'Activo'} />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 9 }}>
          <Stack spacing={2}>
            <Paper component="form" onSubmit={(event) => { event.preventDefault(); save(); }} variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" component="h2" fontWeight={850} sx={{ mb: 2 }}>
                {form.id ? 'Configuración del rol' : 'Nuevo rol operativo'}
              </Typography>
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, md: 5 }}>
                  <TextField fullWidth required label="Nombre" value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, md: 5 }}>
                  <TextField fullWidth required label="Código estable" value={form.codigo} disabled={Boolean(form.id)} onChange={(event) => setForm({ ...form, codigo: event.target.value.toUpperCase() })} />
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <FormControlLabel control={<Switch checked={form.activo} onChange={(event) => setForm({ ...form, activo: event.target.checked })} />} label="Activo" />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField fullWidth multiline minRows={2} label="Foco del rol" value={form.workspace_focus} onChange={(event) => setForm({ ...form, workspace_focus: event.target.value })} helperText="Describe el propósito de trabajo; no promete cantidades ni acciones no autorizadas." />
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" component="h3" fontWeight={850}>Capacidades</Typography>
              <TextField fullWidth size="small" label="Buscar capacidad" value={search} onChange={(event) => setSearch(event.target.value)} sx={{ my: 1.5 }} />
              {inactiveSelected.length > 0 && (
                <Alert severity="warning" sx={{ mb: 1.5 }}>
                  Retira las capacidades inactivas antes de guardar: {inactiveSelected.map((item) => item.codigo).join(', ')}.
                </Alert>
              )}
              <Stack spacing={1.5} sx={{ maxHeight: 320, overflowY: 'auto', pr: 1 }}>
                {capabilityGroups.map((group) => (
                  <Box key={group}>
                    <Typography variant="caption" color="text.secondary" fontWeight={850}>{group}</Typography>
                    <Grid container>
                      {visibleCapabilities.filter((item) => capabilityArea(item.codigo) === group).map((item) => (
                        <Grid key={item.codigo} size={{ xs: 12, md: 6 }}>
                          <FormControlLabel
                            control={<Checkbox checked={form.capacidad_codigos.includes(item.codigo)} disabled={item.activo === false && !form.capacidad_codigos.includes(item.codigo)} onChange={() => toggleCapability(item.codigo)} />}
                            label={<Box><Typography variant="body2" fontWeight={700}>{item.nombre || item.codigo}{item.activo === false ? ' · Inactiva' : ''}</Typography><Typography variant="caption" color="text.secondary">{item.codigo}</Typography></Box>}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                ))}
              </Stack>

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" component="h3" fontWeight={850}>Experiencia de Inicio</Typography>
              <TextField
                select
                fullWidth
                label="Acceso principal"
                value={form.workspace_start_feature}
                onChange={(event) => setForm({ ...form, workspace_start_feature: event.target.value })}
                sx={{ my: 1.5 }}
              >
                <MenuItem value="">Usar primer acceso compatible</MenuItem>
                {form.workspace_start_feature
                  && !compatibleFeatures.some((item) => item.key === form.workspace_start_feature)
                  && <MenuItem value={form.workspace_start_feature} disabled>No disponible: {form.workspace_start_feature}</MenuItem>}
                {compatibleFeatures.map((item) => <MenuItem key={item.key} value={item.key}>{item.areaLabel} · {item.label}</MenuItem>)}
              </TextField>
              <Stack spacing={1}>
                {homeCompatibleFeatures.map((item) => {
                  const preference = form.workspace_preferencias.find((value) => value.feature_key === item.key);
                  return (
                    <Stack key={item.key} direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={1}>
                      <FormControlLabel
                        sx={{ flexGrow: 1 }}
                        control={<Checkbox checked={Boolean(preference?.fijada)} onChange={(event) => updatePreference(item.key, { fijada: event.target.checked })} />}
                        label={`Fijar ${item.label}`}
                      />
                      <TextField
                        size="small"
                        type="number"
                        label="Prioridad"
                        value={preference?.prioridad ?? 100}
                        onChange={(event) => updatePreference(item.key, { prioridad: Number(event.target.value) })}
                        slotProps={{ htmlInput: { min: 0, max: 999, 'aria-label': `Prioridad de ${item.label}` } }}
                        sx={{ width: { xs: '100%', sm: 130 } }}
                      />
                    </Stack>
                  );
                })}
              </Stack>
              {unavailablePreferences.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" component="h4" fontWeight={850}>
                    Preferencias no disponibles
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    No conceden acceso. Retíralas si ya no forman parte de la configuración del rol.
                  </Typography>
                  <Stack spacing={1}>
                    {unavailablePreferences.map((preference) => {
                      const registered = workspaceFeatures.find((item) => item.key === preference.feature_key);
                      const label = registered?.label || preference.feature_key;
                      const preferenceWarning = preview.configurationWarnings.find((item) => (
                        item.featureKey === preference.feature_key
                        && ['PREFERENCE_UNKNOWN', 'PREFERENCE_INELIGIBLE'].includes(item.code)
                      ));
                      return (
                        <Paper key={preference.feature_key} variant="outlined" sx={{ p: 1.25 }}>
                          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={1}>
                            <Box sx={{ flexGrow: 1 }}>
                              <Typography variant="body2" fontWeight={750}>{label}</Typography>
                              <Typography variant="caption" color="text.secondary">{preference.feature_key}</Typography>
                              {preferenceWarning && (
                                <Typography variant="caption" color="warning.dark" display="block">
                                  {preferenceWarning.message}
                                </Typography>
                              )}
                            </Box>
                            <Button
                              size="small"
                              color="error"
                              onClick={() => removePreference(preference.feature_key)}
                              aria-label={`Retirar preferencia ${label}`}
                            >
                              Retirar preferencia
                            </Button>
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                </Box>
              )}
              <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
                <Button type="submit" variant="contained" startIcon={<SaveOutlinedIcon />} disabled={saving || inactiveSelected.length > 0 || !form.nombre.trim() || !form.codigo.trim()}>
                  {saving ? 'Guardando…' : 'Guardar rol'}
                </Button>
              </Stack>
            </Paper>

            <WorkspacePreview workspace={preview} roleActive={form.activo} />
          </Stack>
        </Grid>
      </Grid>

      <Paper component="section" aria-labelledby="principal-pending-title" variant="outlined" sx={{ p: 2 }}>
        <Typography id="principal-pending-title" variant="h6" component="h2" fontWeight={850}>
          Personas sin rol principal
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          El principal define foco y orden visual; todos los roles activos continúan aportando capacidades.
        </Typography>
        {workersWithoutPrimary.length === 0 ? (
          <Alert severity="success">No hay personas pendientes de rol principal.</Alert>
        ) : (
          <Stack spacing={1}>
            {workersWithoutPrimary.map((worker) => (
              <Stack key={worker.id} direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography fontWeight={750}>{worker.nombre_completo || worker.nombre_corto}</Typography>
                  <Typography variant="caption" color="text.secondary">{(worker.roles || []).map((role) => role.nombre).join(' · ')}</Typography>
                </Box>
                <TextField
                  select
                  size="small"
                  label="Rol principal"
                  value={principalSelections[worker.id] || ''}
                  onChange={(event) => setPrincipalSelections((current) => ({ ...current, [worker.id]: event.target.value }))}
                  sx={{ width: { xs: '100%', md: 220 } }}
                  SelectProps={{ inputProps: { 'aria-label': `Rol principal de ${worker.nombre_completo || worker.nombre_corto}` } }}
                >
                  {(worker.roles || []).filter((role) => role.activo !== false).map((role) => (
                    <MenuItem key={role.id} value={role.id}>{role.nombre}</MenuItem>
                  ))}
                </TextField>
                <Button
                  variant="outlined"
                  disabled={!principalSelections[worker.id]}
                  onClick={() => assignPrimary(worker)}
                  aria-label={`Definir principal de ${worker.nombre_completo || worker.nombre_corto}`}
                >
                  Definir principal
                </Button>
              </Stack>
            ))}
          </Stack>
        )}
      </Paper>
    </Stack>
  );
}
