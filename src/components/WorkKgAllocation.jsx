import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { formatPlanningKg } from '../utils/workKgAssignment';

export default function WorkKgAllocation({ line, model, onEdit, disabled }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography fontWeight={800}>{line.articulo.nombre}</Typography>
      <Typography variant="body2" color="text.secondary">{line.color} · <span>{line.tipo_manga.nombre}</span></Typography>
      <Stack direction="row" useFlexGap flexWrap="wrap" spacing={3} sx={{ my: 1.5 }}>
        <Box><Typography variant="caption">Pendiente de asignar</Typography>
          <Typography variant="h6">{formatPlanningKg(model.pendingKg)} kg</Typography>
          <Typography variant="caption">{line.saldo_un} un planificadas</Typography></Box>
        <Box><Typography variant="caption">Capacidad por manga</Typography>
          <Typography variant="h6">{formatPlanningKg(model.capacityKg)} kg</Typography>
          <Typography variant="caption">{line.capacidad_efectiva_un} un por manga</Typography></Box>
        <Box><Typography variant="caption">Mangas propuestas para la OF</Typography>
          <Typography variant="h6">{line.mangas_propuestas ?? '—'}</Typography></Box>
      </Stack>
      <TextField label="Kg teóricos a asignar" value={model.input} disabled={disabled}
        onChange={(event) => onEdit({ text: event.target.value })}
        error={Boolean(model.error)} inputProps={{ inputMode: 'decimal' }}
        helperText={model.error || 'Peso neto teórico de la salida: sin tara ni colada; no es peso real de balanza.'}
        fullWidth />
      {model.needsChoice && (
        <Alert severity="info" sx={{ mt: 1 }}>
          Los kg solicitados no equivalen a unidades enteras. Elige una cantidad realizable:
        </Alert>
      )}
      {model.options?.length > 0 && (
        <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1} sx={{ mt: 1 }}>
          {model.options.map((option) => (
            <Button key={option.choice} disabled={disabled || !option.allowed}
              variant={model.chosen === option.choice ? 'contained' : 'outlined'}
              aria-pressed={model.chosen === option.choice}
              onClick={() => onEdit({ text: model.input, choice: option.choice })}>
              Usar {formatPlanningKg(option.kg)} kg · {option.units} un
            </Button>
          ))}
        </Stack>
      )}
      {model.valid && (
        <Box role="status" sx={{ mt: 1.5 }}>
          <Typography fontWeight={800}>Se asignarán {formatPlanningKg(model.appliedKg)} kg teóricos · {model.units} un planificadas</Typography>
          <Typography variant="caption">Equivalencia calculada con {model.unitWeightG} g por unidad de la salida.</Typography>
          {model.chosen && <Typography variant="body2">Solicitaste {model.input} kg. Diferencia elegida: {formatPlanningKg(model.differenceKg)} kg; no se redondea automáticamente.</Typography>}
          <Typography variant="body2">{model.totalBags} {model.totalBags === 1 ? 'manga' : 'mangas'}: {model.fullBags} {model.fullBags === 1 ? 'completa' : 'completas'} de {formatPlanningKg(model.capacityKg)} kg{model.partialUnits > 0 ? ` y 1 parcial de ${formatPlanningKg(model.partialKg)} kg` : ''}.</Typography>
        </Box>
      )}
      {model.valid && model.partialUnits > 0 && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          Última manga parcial: {formatPlanningKg(model.partialKg)} kg teóricos ({model.partialUnits} un planificadas). Puedes continuar; este aviso no bloquea la asignación.
        </Alert>
      )}
    </Paper>
  );
}
