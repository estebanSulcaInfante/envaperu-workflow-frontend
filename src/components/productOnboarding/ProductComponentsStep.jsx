import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import PrecisionManufacturingOutlinedIcon from '@mui/icons-material/PrecisionManufacturingOutlined';
import {
  buscarPiezasGlobales,
  obtenerMoldes,
} from '../../services/api';
import ApplicationResultSummary from './ApplicationResultSummary';
import PieceCompositionEditor from './PieceCompositionEditor';
import {
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
  const selectedMold = catalogs.molds.find(
    (item) => String(item.codigo) === String(data.molde.ref),
  ) || null;
  const materializedMold = Boolean(
    resolvedReferences?.molde_ref || resolvedReferences?.COMPONENTES?.molde_ref,
  );
  const materializedPieceIds = new Set(
    (resolvedReferences?.piezas || resolvedReferences?.COMPONENTES?.piezas || [])
      .map((item) => String(item.client_id)),
  );

  useEffect(() => {
    let active = true;
    Promise.all([
      obtenerMoldes(),
      buscarPiezasGlobales('', 300),
    ])
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

  const setMoldMode = (mode) => {
    onChange({
      ...data,
      molde: mode === 'NUEVO'
        ? { ...data.molde, modo: 'NUEVO', ref: null, nombre: '' }
        : { ...data.molde, modo: 'REUTILIZAR', ref: null, nombre: '' },
      piezas: [],
    });
  };

  const selectMold = (mold) => {
    const forms = (mold?.formas || mold?.piezas || []).filter((item) => item.activo !== false);
    onChange({
      ...data,
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

  const updateMold = (field, fieldValue) => onChange({
    ...data,
    molde: { ...data.molde, [field]: fieldValue },
  });

  const addPiece = () => {
    onChange({ ...data, piezas: [...data.piezas, newPieceDraft()] });
  };

  const netWeight = data.piezas.reduce(
    (total, piece) => total + Number(piece.cavidades || 0) * Number(piece.peso_unitario_gr || 0),
    0,
  );
  const shotWeight = Number(data.molde.peso_tiro_gr || selectedMold?.peso_tiro_gr || 0);
  const runnerWeight = shotWeight ? shotWeight - netWeight : null;

  return (
    <Stack spacing={2.25}>
      <Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <PrecisionManufacturingOutlinedIcon color="primary" />
          <Typography component="h2" variant="h5" sx={{ fontWeight: 900 }}>
            Configurar molde y piezas
          </Typography>
        </Stack>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 900 }}>
          Define la herramienta y cada salida física. Las cavidades y el peso operativo viven en MoldePieza, no en el nombre del producto.
        </Typography>
      </Box>

      {catalogError && <Alert severity="warning">{catalogError}</Alert>}
      <ApplicationResultSummary
        result={applicationResult}
        references={resolvedReferences}
        title="Molde y componentes aplicados"
      />

      <Paper
        component="fieldset"
        disabled={materializedMold}
        variant="outlined"
        sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 2.5, m: 0, minWidth: 0 }}
      >
        <Stack spacing={1.75}>
          <Box>
            <Typography variant="overline" color="primary.main" sx={{ fontWeight: 850 }}>1 · Herramienta</Typography>
            <Typography variant="h6" sx={{ fontWeight: 850 }}>Molde de producción</Typography>
          </Box>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={data.molde.modo}
            aria-label="Origen del molde"
            onChange={(_, mode) => mode && setMoldMode(mode)}
            sx={{ alignSelf: 'flex-start' }}
          >
            <ToggleButton value="NUEVO" disabled={materializedMold}>Crear molde</ToggleButton>
            <ToggleButton value="REUTILIZAR">Reutilizar molde</ToggleButton>
          </ToggleButtonGroup>
          {materializedMold && (
            <Alert severity="info">
              El molde ya quedó vinculado a esta alta. Puedes ajustar su composición,
              pero no crear otro molde silenciosamente desde el mismo intento.
            </Alert>
          )}

          {data.molde.modo === 'REUTILIZAR' ? (
            <Autocomplete
              options={catalogs.molds}
              value={selectedMold}
              loading={loading}
              getOptionLabel={moldLabel}
              isOptionEqualToValue={(option, candidate) => option.codigo === candidate.codigo}
              onChange={(_, mold) => selectMold(mold)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  required
                  label="Molde existente"
                  error={showValidation && Boolean(errors.molde.ref)}
                  helperText={(showValidation && errors.molde.ref) || 'Al seleccionarlo se cargan sus relaciones activas sin duplicarlas.'}
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
                  fullWidth
                  required
                  label="Nombre del molde"
                  value={data.molde.nombre}
                  onChange={(event) => updateMold('nombre', event.target.value)}
                  error={showValidation && Boolean(errors.molde.nombre)}
                  helperText={(showValidation && errors.molde.nombre) || 'El código ML se asignará automáticamente.'}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3.5 }}>
                <TextField
                  fullWidth
                  required
                  type="number"
                  label="Peso de tiro (g)"
                  value={data.molde.peso_tiro_gr}
                  onChange={(event) => updateMold('peso_tiro_gr', event.target.value)}
                  error={showValidation && Boolean(errors.molde.peso_tiro_gr)}
                  helperText={(showValidation && errors.molde.peso_tiro_gr) || 'Peso total del golpe.'}
                  slotProps={{ htmlInput: { min: 0.001, step: 0.001 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3.5 }}>
                <TextField
                  fullWidth
                  required
                  type="number"
                  label="Ciclo estándar (s)"
                  value={data.molde.tiempo_ciclo_std}
                  onChange={(event) => updateMold('tiempo_ciclo_std', event.target.value)}
                  error={showValidation && Boolean(errors.molde.tiempo_ciclo_std)}
                  helperText={(showValidation && errors.molde.tiempo_ciclo_std) || 'Referencia técnica inicial.'}
                  slotProps={{ htmlInput: { min: 0.001, step: 0.001 } }}
                />
              </Grid>
            </Grid>
          )}
        </Stack>
      </Paper>

      <Box>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ sm: 'center' }}
          spacing={1}
        >
          <Box>
            <Typography variant="overline" color="primary.main" sx={{ fontWeight: 850 }}>2 · Composición</Typography>
            <Typography variant="h6" sx={{ fontWeight: 850 }}>Piezas por golpe</Typography>
          </Box>
          <Button startIcon={<AddRoundedIcon />} variant="outlined" onClick={addPiece}>
            Añadir pieza
          </Button>
        </Stack>
        {showValidation && errors.piezas.general && (
          <Alert severity="error" sx={{ mt: 1 }}>{errors.piezas.general}</Alert>
        )}
      </Box>

      <Stack spacing={1.25}>
        {data.piezas.map((piece, index) => (
          <PieceCompositionEditor
            key={piece.client_id}
            index={index}
            piece={piece}
            piecesCatalog={catalogs.pieces}
            errors={errors.piezas[piece.client_id] || {}}
            showValidation={showValidation}
            disabled={materializedPieceIds.has(String(piece.client_id))}
            onChange={(nextPiece) => onChange({
              ...data,
              piezas: data.piezas.map((item) => (item.client_id === piece.client_id ? nextPiece : item)),
            })}
            onRemove={() => onChange({
              ...data,
              piezas: data.piezas.filter((item) => item.client_id !== piece.client_id),
            })}
          />
        ))}
        {!data.piezas.length && (
          <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', borderStyle: 'dashed' }}>
            <Typography color="text.secondary">Añade la primera pieza para describir la salida del molde.</Typography>
          </Paper>
        )}
      </Stack>

      <Paper variant="outlined" sx={{ p: 1.75, bgcolor: 'grey.50' }}>
        <Stack spacing={1.25}>
          <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>Resumen antes de aplicar</Typography>
          <Stack direction="row" gap={0.75} flexWrap="wrap">
            <Chip label={`${data.piezas.length} pieza(s)`} />
            <Chip label={`${data.piezas.reduce((sum, piece) => sum + Number(piece.cavidades || 0), 0)} cavidad(es)`} />
            <Chip label={`Peso neto ${netWeight.toFixed(2)} g`} />
            {shotWeight > 0 && <Chip color={runnerWeight < 0 ? 'error' : 'default'} label={`Colada estimada ${runnerWeight.toFixed(2)} g`} />}
          </Stack>
          {runnerWeight < 0 && (
            <Alert severity="warning">El peso neto supera el peso de tiro. Revisa cavidades o pesos antes de aplicar.</Alert>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
