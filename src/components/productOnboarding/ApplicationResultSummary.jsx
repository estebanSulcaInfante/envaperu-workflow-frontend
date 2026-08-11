import {
  Alert, Box, Chip, Paper, Stack, Typography,
} from '@mui/material';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';

const itemLabel = (item, index) => (
  item?.nombre
  || item?.codigo
  || item?.sku
  || item?.unit
  || item?.client_id
  || `Registro ${index + 1}`
);

export default function ApplicationResultSummary({ result, references, title = 'Resultado aplicado' }) {
  const created = result?.created || [];
  const reused = result?.reused || [];
  const pending = result?.pending || [];
  const hasReferences = references && Object.keys(references).length > 0;
  if (!result && !hasReferences) return null;

  return (
    <Paper
      variant="outlined"
      role="status"
      aria-live="polite"
      sx={{ p: 1.5, borderColor: 'success.light', bgcolor: 'success.50' }}
    >
      <Stack spacing={1.1}>
        <Stack direction="row" spacing={1} alignItems="center">
          <CheckCircleOutlineRoundedIcon color="success" />
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>{title}</Typography>
            <Typography variant="caption" color="text.secondary">
              Las referencias quedaron guardadas en la sesión y se reutilizan al reanudar.
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" gap={0.75} flexWrap="wrap">
          {created.map((item, index) => (
            <Chip key={`created-${itemLabel(item, index)}`} size="small" color="success" label={`Creado · ${itemLabel(item, index)}`} />
          ))}
          {reused.map((item, index) => (
            <Chip key={`reused-${itemLabel(item, index)}`} size="small" color="info" variant="outlined" label={`Reutilizado · ${itemLabel(item, index)}`} />
          ))}
          {!created.length && !reused.length && hasReferences && (
            <Chip size="small" color="success" variant="outlined" label="Referencias canónicas enlazadas" />
          )}
        </Stack>
        {pending.length > 0 && (
          <Alert severity="warning">
            {pending.length} pendiente(s) quedaron registrados sin inventar datos.
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
