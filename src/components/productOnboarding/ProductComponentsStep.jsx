import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import PrecisionManufacturingOutlinedIcon from '@mui/icons-material/PrecisionManufacturingOutlined';
import { buscarPiezasGlobales, obtenerMoldes } from '../../services/api';
import ApplicationResultSummary from './ApplicationResultSummary';
import PieceCompositionEditor from './PieceCompositionEditor';
import {
  newMoldGroupDraft,
  newPieceDraft,
  normalizeComponentsData,
  validateComponents,
} from './technicalStepModel';

const asItems = (payload) => (Array.isArray(payload) ? payload : payload?.items || []);
const moldLabel = (mold) => `${mold.codigo} · ${mold.nombre}`;

export default function ProductComponentsStep({
  value,
  onChange,
  resolvedReferences,
  applicationResult,
  showValidation,
}) {
  const data = normalizeComponentsData(value, resolvedReferences);
  const [catalogs, setCatalogs] = useState({ molds: [], pieces: [] });
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const errors = useMemo(() => validateComponents(data), [data]);
  const resolved = resolvedReferences?.COMPONENTES || resolvedReferences || {};
  const resolvedGroups = Array.isArray(resolved.moldes) && resolved.moldes.length
    ? resolved.moldes
    : resolved.molde_ref ? [{
      client_id: data.moldes[0]?.client_id,
      molde_ref: resolved.molde_ref,
      piezas: resolved.piezas || [],
    }] : [];
  const resolvedByGroup = new Map(resolvedGroups.map((group) => [String(group.client_id), group]));

  useEffect(() => {
    let active = true;
    Promise.all([obtenerMoldes(), buscarPiezasGlobales('', 300)])
      .then(([molds, pieces]) => {
        if (!active) return;
        setCatalogs({
          molds: asItems(molds).filter((item) => item.activo !== false),
          pieces: asItems(pieces).filter((item) => item.activo !== false),
        });
      })
      .catch(() => {
        if (active) setCatalogError('No se pudieron cargar los moldes y piezas disponibles. Puedes guardar el borrador y reintentar.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const updateGroup = (groupId, updater) => onChange({
    ...data,
    moldes: data.moldes.map((group) => (
      group.client_id === groupId
        ? (typeof updater === 'function' ? updater(group) : updater)
        : group
    )),
  });

  const setMoldMode = (group, mode) => updateGroup(group.client_id, {
    ...group,
    molde: mode === 'NUEVO'
      ? { ...group.molde, modo: 'NUEVO', ref: null, nombre: '' }
      : { ...group.molde, modo: 'REUTILIZAR', ref: null, nombre: '' },
    piezas: [],
  });

  const selectMold = (group, mold) => {
    const forms = (mold?.formas || mold?.piezas || []).filter((item) => item.activo !== false);
    updateGroup(group.client_id, {
      ...group,
      molde: {
        modo: 'REUTILIZAR',
        ref: mold?.codigo || null,
        nombre: mold?.nombre || '',
        peso_tiro_gr: mold?.peso_tiro_gr != null ? String(mold.peso_tiro_gr) : '',
        tiempo_ciclo_std: mold?.tiempo_ciclo_std != null ? String(mold.tiempo_ciclo_std) : '30',
      },
      piezas: forms.map((form, index) => ({
        client_id: `existente-${mold.codigo}-${form.pieza_id || index}`,
        modo: 'REUTILIZAR',
        ref: form.pieza_id,
        nombre: form.pieza_nombre || form.nombre || '',
        cavidades: String(form.cavidades || 1),
        peso_unitario_gr: String(form.peso_unitario_gr || form.peso_nominal_gr || ''),
        molde_pieza_ref: form.molde_pieza_id || form.id || null,
      })),
    });
  };

  const addMold = () => onChange({ ...data, moldes: [...data.moldes, newMoldGroupDraft()] });
  const removeMold = (groupId) => onChange({
    ...data,
    moldes: data.moldes.filter((group) => group.client_id !== groupId),
  });

  return (
    <Stack spacing={2.25}>
      <Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <PrecisionManufacturingOutlinedIcon color="primary" />
          <Typography component="h2" variant="h5" sx={{ fontWeight: 900 }}>
            Configurar moldes y piezas
          </Typography>
        </Stack>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 900 }}>
          Añade una herramienta por cada grupo de piezas que se fabrica en un molde distinto.
          Un molde multicavidad puede contener varias piezas, pero un PT armado puede requerir varios moldes.
        </Typography>
      </Box>

      {catalogError && <Alert severity="warning">{catalogError}</Alert>}
      <ApplicationResultSummary
        result={applicationResult}
        references={resolvedReferences}
        title="Moldes y componentes aplicados"
      />

      {data.moldes.map((group, groupIndex) => {
        const groupErrors = errors.moldes[group.client_id] || { molde: {}, piezas: {} };
        const groupResolved = resolvedByGroup.get(String(group.client_id)) || {};
        const materializedMold = Boolean(groupResolved.molde_ref);
        const materializedPieceIds = new Set((groupResolved.piezas || []).map((item) => String(item.client_id)));
        const selectedMold = catalogs.molds.find(
          (item) => String(item.codigo) === String(group.molde.ref),
        ) || null;
        const netWeight = group.piezas.reduce(
          (total, piece) => total + Number(piece.cavidades || 0) * Number(piece.peso_unitario_gr || 0),
          0,
        );
        const shotWeight = Number(group.molde.peso_tiro_gr || selectedMold?.peso_tiro_gr || 0);
        const runnerWeight = shotWeight ? shotWeight - netWeight : null;
        return (
          <Paper key={group.client_id} variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 2.5 }}>
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Box>
                  <Typography variant="overline" color="primary.main" sx={{ fontWeight: 850 }}>
                    Grupo de fabricación {groupIndex + 1}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 850 }}>
                    {group.molde.nombre || group.molde.ref || 'Molde por definir'}
                  </Typography>
                </Box>
                <Tooltip title={materializedMold ? 'Este molde ya quedó aplicado y no se elimina silenciosamente.' : 'Quitar grupo'}>
                  <span>
                    <IconButton
                      aria-label={`Quitar molde ${groupIndex + 1}`}
                      disabled={data.moldes.length === 1 || materializedMold}
                      onClick={() => removeMold(group.client_id)}
                    >
                      <DeleteOutlineRoundedIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>

              <Box component="fieldset" disabled={materializedMold} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
                <Stack spacing={1.5}>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={group.molde.modo}
                    aria-label={`Origen del molde ${groupIndex + 1}`}
                    onChange={(_, mode) => mode && setMoldMode(group, mode)}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    <ToggleButton value="NUEVO">Crear molde</ToggleButton>
                    <ToggleButton value="REUTILIZAR">Reutilizar molde</ToggleButton>
                  </ToggleButtonGroup>
                  {materializedMold && (
                    <Alert severity="info">
                      Este molde ya quedó enlazado. Puedes añadir otro grupo para incorporar otra herramienta del PT.
                    </Alert>
                  )}
                  {group.molde.modo === 'REUTILIZAR' ? (
                    <Autocomplete
                      options={catalogs.molds}
                      value={selectedMold}
                      loading={loading}
                      getOptionLabel={moldLabel}
                      isOptionEqualToValue={(option, candidate) => option.codigo === candidate.codigo}
                      onChange={(_, mold) => selectMold(group, mold)}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          required
                          label={`Molde existente ${groupIndex + 1}`}
                          error={showValidation && Boolean(groupErrors.molde.ref)}
                          helperText={(showValidation && groupErrors.molde.ref) || 'Carga las piezas activas vinculadas a esta herramienta.'}
                          slotProps={{
                            input: {
                              ...params.InputProps,
                              endAdornment: <>{loading ? <CircularProgress size={18} /> : null}{params.InputProps.endAdornment}</>,
                            },
                          }}
                        />
                      )}
                    />
                  ) : (
                    <Grid container spacing={1.25}>
                      <Grid size={{ xs: 12, md: 5 }}>
                        <TextField
                          fullWidth required label={`Nombre del molde ${groupIndex + 1}`}
                          value={group.molde.nombre}
                          onChange={(event) => updateGroup(group.client_id, {
                            ...group, molde: { ...group.molde, nombre: event.target.value },
                          })}
                          error={showValidation && Boolean(groupErrors.molde.nombre)}
                          helperText={(showValidation && groupErrors.molde.nombre) || 'El código ML se asignará automáticamente.'}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6, md: 3.5 }}>
                        <TextField
                          fullWidth required type="number" label="Peso de tiro (g)"
                          value={group.molde.peso_tiro_gr}
                          onChange={(event) => updateGroup(group.client_id, {
                            ...group, molde: { ...group.molde, peso_tiro_gr: event.target.value },
                          })}
                          error={showValidation && Boolean(groupErrors.molde.peso_tiro_gr)}
                          helperText={(showValidation && groupErrors.molde.peso_tiro_gr) || 'Peso total del golpe.'}
                          slotProps={{ htmlInput: { min: 0.001, step: 0.001 } }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6, md: 3.5 }}>
                        <TextField
                          fullWidth required type="number" label="Ciclo estándar (s)"
                          value={group.molde.tiempo_ciclo_std}
                          onChange={(event) => updateGroup(group.client_id, {
                            ...group, molde: { ...group.molde, tiempo_ciclo_std: event.target.value },
                          })}
                          error={showValidation && Boolean(groupErrors.molde.tiempo_ciclo_std)}
                          helperText={(showValidation && groupErrors.molde.tiempo_ciclo_std) || 'Referencia técnica inicial.'}
                          slotProps={{ htmlInput: { min: 0.001, step: 0.001 } }}
                        />
                      </Grid>
                    </Grid>
                  )}
                </Stack>
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 850 }}>Piezas producidas por este molde</Typography>
                  <Typography variant="body2" color="text.secondary">Cavidades y peso pertenecen a la relación MoldePieza.</Typography>
                </Box>
                <Button
                  startIcon={<AddRoundedIcon />}
                  variant="outlined"
                  onClick={() => updateGroup(group.client_id, { ...group, piezas: [...group.piezas, newPieceDraft()] })}
                >
                  Añadir pieza
                </Button>
              </Stack>
              {showValidation && groupErrors.piezas.general && <Alert severity="error">{groupErrors.piezas.general}</Alert>}
              <Stack spacing={1.25}>
                {group.piezas.map((piece, pieceIndex) => (
                  <PieceCompositionEditor
                    key={piece.client_id}
                    index={pieceIndex}
                    piece={piece}
                    piecesCatalog={catalogs.pieces}
                    errors={groupErrors.piezas[piece.client_id] || {}}
                    showValidation={showValidation}
                    disabled={materializedPieceIds.has(String(piece.client_id))}
                    onChange={(nextPiece) => updateGroup(group.client_id, {
                      ...group,
                      piezas: group.piezas.map((item) => (item.client_id === piece.client_id ? nextPiece : item)),
                    })}
                    onRemove={() => updateGroup(group.client_id, {
                      ...group,
                      piezas: group.piezas.filter((item) => item.client_id !== piece.client_id),
                    })}
                  />
                ))}
                {!group.piezas.length && (
                  <Alert severity="info">Añade al menos una pieza producida por este molde.</Alert>
                )}
              </Stack>
              <Stack direction="row" gap={0.75} flexWrap="wrap">
                <Chip label={`${group.piezas.length} pieza(s)`} />
                <Chip label={`${group.piezas.reduce((sum, piece) => sum + Number(piece.cavidades || 0), 0)} cavidad(es)`} />
                <Chip label={`Peso neto ${netWeight.toFixed(2)} g`} />
                {shotWeight > 0 && <Chip color={runnerWeight < 0 ? 'error' : 'default'} label={`Colada estimada ${runnerWeight.toFixed(2)} g`} />}
              </Stack>
              {runnerWeight < 0 && <Alert severity="warning">El peso neto supera el peso de tiro de este molde.</Alert>}
            </Stack>
          </Paper>
        );
      })}

      <Button startIcon={<AddRoundedIcon />} variant="contained" onClick={addMold} sx={{ alignSelf: 'flex-start' }}>
        Añadir otro molde
      </Button>
      <Paper variant="outlined" sx={{ p: 1.75, bgcolor: 'grey.50' }}>
        <Stack direction="row" gap={0.75} flexWrap="wrap" alignItems="center">
          <Typography variant="subtitle2" sx={{ fontWeight: 850, mr: 1 }}>Resumen del PT</Typography>
          <Chip label={`${data.moldes.length} molde(s)`} color="primary" />
          <Chip label={`${data.piezas.length} pieza(s)`} />
        </Stack>
      </Paper>
    </Stack>
  );
}
