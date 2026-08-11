import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';

const pieceLabel = (piece) => (
  `${piece.codigo ? `${piece.codigo} · ` : ''}${piece.nombre || 'Pieza sin nombre'}`
);

export default function PieceCompositionEditor({
  index,
  piece,
  piecesCatalog,
  errors = {},
  showValidation,
  onChange,
  onRemove,
  disabled = false,
}) {
  const selectedPiece = piecesCatalog.find((item) => String(item.id) === String(piece.ref)) || null;
  const lockedAssociation = Boolean(piece.molde_pieza_ref);
  const error = (field) => (showValidation ? errors[field] : '');
  const update = (field, value) => onChange({ ...piece, [field]: value });

  const selectExisting = (selected) => {
    onChange({
      ...piece,
      modo: 'REUTILIZAR',
      ref: selected?.id || null,
      nombre: selected?.nombre || '',
      peso_unitario_gr: selected?.peso_nominal_gr != null
        ? String(selected.peso_nominal_gr)
        : piece.peso_unitario_gr,
    });
  };

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-label={`Pieza ${index + 1}`}
      sx={{ p: { xs: 1.25, md: 1.75 }, borderRadius: 2.5 }}
    >
      <Box component="fieldset" disabled={disabled} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
              <Typography variant="subtitle1" sx={{ fontWeight: 850 }}>Pieza {index + 1}</Typography>
              {piece.molde_pieza_ref && (
                <Chip size="small" color="success" variant="outlined" label={`Asociación ${piece.molde_pieza_ref}`} />
              )}
              {disabled && <Chip size="small" color="info" label="Aplicada" />}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              La cavidad y el peso son propios de esta relación MoldePieza.
            </Typography>
          </Box>
          <IconButton aria-label={`Eliminar pieza ${index + 1}`} color="error" onClick={onRemove}>
            <DeleteOutlineRoundedIcon />
          </IconButton>
        </Stack>

        <Stack direction="row" spacing={0.75} role="group" aria-label={`Origen de pieza ${index + 1}`}>
          <Button
            size="small"
            variant={piece.modo === 'NUEVA' ? 'contained' : 'outlined'}
            onClick={() => onChange({
              ...piece, modo: 'NUEVA', ref: null, nombre: '', molde_pieza_ref: null,
            })}
            disabled={lockedAssociation}
          >
            Nueva pieza
          </Button>
          <Button
            size="small"
            variant={piece.modo === 'REUTILIZAR' ? 'contained' : 'outlined'}
            onClick={() => onChange({
              ...piece, modo: 'REUTILIZAR', ref: null, nombre: '', molde_pieza_ref: null,
            })}
          >
            Reutilizar pieza
          </Button>
        </Stack>

        {piece.modo === 'REUTILIZAR' ? (
          <Autocomplete
            options={piecesCatalog}
            value={selectedPiece}
            getOptionLabel={pieceLabel}
            isOptionEqualToValue={(option, candidate) => option.id === candidate.id}
            onChange={(_, selected) => selectExisting(selected)}
            disabled={lockedAssociation}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Pieza existente"
                required
                error={Boolean(error('ref'))}
                helperText={error('ref') || (lockedAssociation ? 'Ya pertenece al molde seleccionado.' : 'Busca por código o nombre.')}
              />
            )}
          />
        ) : (
          <Grid container spacing={1.25}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                required
                label="Nombre de la pieza"
                value={piece.nombre}
                onChange={(event) => update('nombre', event.target.value)}
                error={Boolean(error('nombre'))}
                helperText={error('nombre') || 'El SKU se asignará automáticamente.'}
              />
            </Grid>
          </Grid>
        )}

        <Grid container spacing={1.25}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              required
              type="number"
              label="Cavidades"
              value={piece.cavidades}
              onChange={(event) => update('cavidades', event.target.value)}
              error={Boolean(error('cavidades'))}
              helperText={error('cavidades') || 'Salidas de esta pieza por golpe.'}
              slotProps={{ htmlInput: { min: 1, step: 1 } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              required
              type="number"
              label="Peso unitario operativo (g)"
              value={piece.peso_unitario_gr}
              onChange={(event) => update('peso_unitario_gr', event.target.value)}
              error={Boolean(error('peso_unitario_gr'))}
              helperText={error('peso_unitario_gr') || 'Peso de una unidad en este molde.'}
              slotProps={{ htmlInput: { min: 0.001, step: 0.001 } }}
            />
          </Grid>
        </Grid>
      </Stack>
      </Box>
    </Paper>
  );
}
