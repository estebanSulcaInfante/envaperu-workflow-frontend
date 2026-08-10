import { Chip, Paper, Stack, Typography } from '@mui/material';

const formatDate = (value) => {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : String(value);
};

export default function OrderScheduleStrip({ order }) {
  if (!order) return null;
  const temporal = order.contexto_temporal || {};
  const needFrom = formatDate(
    temporal.fecha_necesidad_min ?? order.fecha_necesidad,
  );
  const needTo = formatDate(
    temporal.fecha_necesidad_max ?? order.fecha_necesidad,
  );
  const needLabel = needFrom === needTo || !needTo
    ? needFrom
    : `${needFrom} – ${needTo}`;
  const missingNeedLabel = temporal.fecha_necesidad_motivo === 'SIN_DEMANDA_FECHADA'
    ? 'Sin demanda fechada'
    : 'Sin fecha informada';
  const source = order.fecha_necesidad_fuente;
  const range = order.rango_fechas_ot || {};
  const count = Number(temporal.cantidad_ot ?? range.cantidad ?? 0);
  const from = formatDate(temporal.fecha_ot_primera ?? range.desde);
  const to = formatDate(temporal.fecha_ot_ultima ?? range.hasta);
  const rawScheduleState = temporal.programacion_estado
    || order.programacion_estado
    || (count ? 'PROGRAMADA' : 'SIN_JORNADA');
  const scheduleState = rawScheduleState === 'SIN_PROGRAMAR'
    ? 'SIN_JORNADA'
    : rawScheduleState;
  const scheduled = scheduleState !== 'SIN_JORNADA' && count > 0 && Boolean(from);
  const rangeLabel = from === to || !to ? from : `${from} – ${to}`;
  const statePresentation = {
    SIN_JORNADA: { label: 'Sin jornada', color: 'warning' },
    PROGRAMADA: { label: 'Programada', color: 'info' },
    EN_EJECUCION: { label: 'En ejecución', color: 'success' },
    CERRADA: { label: 'Cerrada', color: 'default' },
  }[scheduleState] || { label: String(scheduleState).replaceAll('_', ' '), color: 'default' };

  return (
    <Paper
      data-testid="order-schedule-strip"
      role="status"
      aria-label="Fechas de necesidad y programación de la orden"
      variant="outlined"
      sx={{ px: 1.5, py: 1, bgcolor: 'grey.50' }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 0.75, sm: 2 }}
        alignItems={{ sm: 'center' }}
        useFlexGap
        flexWrap="wrap"
      >
        <Typography variant="body2" sx={{ flex: 1, minWidth: 210 }}>
          <strong>Necesidad:</strong> {needLabel || missingNeedLabel}
          {source?.codigo ? ` · ${source.codigo}` : ''}
        </Typography>
        {scheduled ? (
          <>
            <Typography variant="body2">
              <strong>Jornadas OT:</strong> {rangeLabel}
            </Typography>
            <Chip
              size="small"
              color={statePresentation.color}
              variant="outlined"
              label={statePresentation.label}
            />
            <Chip size="small" color="info" variant="outlined" label={`${count} OT`} />
          </>
        ) : (
          <Chip
            size="small"
            color={statePresentation.color}
            variant="outlined"
            label={statePresentation.label}
          />
        )}
      </Stack>
    </Paper>
  );
}
