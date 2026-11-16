import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { buildQualityOtInspectionSummary } from './qualityOtInspectionSummary.js';

const swatchSx = (hex) => ({
  width: 18,
  height: 18,
  borderRadius: '50%',
  flexShrink: 0,
  bgcolor: hex || 'grey.300',
  border: 1,
  borderColor: hex ? 'rgba(0,0,0,.2)' : 'divider',
});

const inspectionLabel = (value) => `${value} ${value === 1 ? 'inspección' : 'inspecciones'}`;

export default function QualityOtInspectionSummary({
  ot,
  quality,
  localState,
  moldCatalog = [],
  compact = false,
  showDetails = true,
  showHeader = true,
  pendingOnly = false,
  onSelectWork,
  selectedWorkId = '',
  summary = buildQualityOtInspectionSummary({ ot, quality, localState, moldCatalog }),
  ariaLabel = 'Resumen de inspección de la OT',
}) {
  const { header, works, pendingWorks, hasQueuedWork, hasPausedWork, hasActiveWork } = summary;
  const displayedWorks = pendingOnly ? pendingWorks : works;
  const showStatusNotice = !pendingOnly && header.initialStatusLabel && header.initialStatus !== 'CONFIRMADO'
    && (!onSelectWork || !selectedWorkId || header.initialStatus === 'REVISAR_HISTORIAL');
  return (
    <Paper
      component="section"
      variant={pendingOnly ? undefined : 'outlined'}
      elevation={0}
      aria-label={ariaLabel}
      data-testid="quality-ot-inspection-summary"
      sx={{
        p: pendingOnly ? 0 : compact ? 1 : { xs: 1.25, md: 1.5 },
        ...(pendingOnly ? { border: 0, boxShadow: 'none' } : {}),
      }}
    >
      {showHeader && <>
        <Typography component="div" role="group" aria-label="Avance de inspección de la OT" variant="body2"
          color="text.secondary" sx={{ mt: 0.5, display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 1, fontSize: '0.8125rem' }}>
          <span title={pendingOnly ? header.initialStatusLabel || 'Sin arranque confirmado' : undefined}>
            Control de arranque: <strong>{header.initialConfirmed ? 'Sí' : 'No'}</strong>
          </span>
          <span title={header.periodicTarget == null ? 'Visitas confirmadas. Sin meta definida.' : 'Visitas confirmadas de las previstas para esta OT'}>
            Control periódico: <strong>{header.periodicConfirmed}{header.periodicTarget != null && `/${header.periodicTarget}`}</strong>
          </span>
        </Typography>
        {showStatusNotice && (
          <Chip size="small" sx={{ mt: 0.5 }} color={header.initialStatus === 'FUERA_VENTANA' ? 'warning' : 'default'} label={header.initialStatusLabel} />
        )}
      </>}
      {showDetails && (
        <Stack spacing={0.75} sx={{ mt: 1.25 }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>
            {pendingOnly ? 'Pendientes de inspección' : 'Trabajos de la OT'}
          </Typography>
          {displayedWorks.length === 0 && (pendingOnly
            ? <Stack spacing={0.25}>
              <Typography variant="body2" color="text.secondary">Sin trabajos pendientes de inspección</Typography>
              {!hasActiveWork && (hasQueuedWork || hasPausedWork) && <Typography variant="caption" color="text.secondary">{hasQueuedWork ? 'En cola; sin trabajo activo' : 'Pausa sin trabajo activo'}</Typography>}
            </Stack>
            : <Typography variant="body2" color="text.secondary">Sin trabajos informados.</Typography>)}
          {displayedWorks.length > 0 && <Stack component={pendingOnly ? 'ul' : 'div'} spacing={0.75} aria-label={pendingOnly ? 'Pendientes de inspección' : undefined} sx={{ ...(pendingOnly ? { listStyle: 'none', p: 0, m: 0 } : {}) }}>
          {displayedWorks.map((work, index) => (
            <Box
              component={pendingOnly ? 'li' : 'div'}
              key={work.key}
              data-testid={`quality-ot-work-row-${work.workId}`}
              title={`Arranque ${work.initialConfirmed} · Periódicas ${work.periodicConfirmed}`}
              role={onSelectWork ? 'button' : undefined}
              tabIndex={onSelectWork ? 0 : undefined}
              aria-pressed={onSelectWork ? String(selectedWorkId) === String(work.workId) : undefined}
              aria-label={onSelectWork ? `Seleccionar trabajo ${work.mouldName} · ${work.colorName}` : undefined}
              onClick={onSelectWork ? () => onSelectWork(work.workId, work) : undefined}
              onKeyDown={onSelectWork ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectWork(work.workId, work);
                }
              } : undefined}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'minmax(0,1fr) auto' },
                gap: 0.75,
                alignItems: 'center',
                px: pendingOnly ? 0.5 : 1,
                py: pendingOnly ? 0.35 : 0.75,
                minHeight: pendingOnly ? 36 : 44,
                borderRadius: pendingOnly ? 0 : 1,
                border: pendingOnly ? 0 : 1,
                borderBottom: pendingOnly && index < displayedWorks.length - 1 ? 1 : undefined,
                borderColor: 'divider',
                bgcolor: 'background.paper',
                ...(onSelectWork ? { cursor: 'pointer', outline: String(selectedWorkId) === String(work.workId) ? '2px solid' : undefined, outlineColor: 'primary.main' } : {}),
              }}
            >
              <Stack direction="row" spacing={0.8} alignItems="center" minWidth={0}>
                <Box aria-hidden="true" sx={swatchSx(work.colorHex)} />
                <Box minWidth={0}>
                  <Typography variant="body2" fontWeight={800} sx={{ overflowWrap: 'anywhere' }}>
                    {work.mouldName} · {work.colorName}
                  </Typography>
                  {work.disambiguation && <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{work.disambiguation}</Typography>}
                </Box>
              </Stack>
              <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="flex-end" flexWrap="wrap">
                {!pendingOnly && <Chip size="small" variant={work.needsInspection ? 'filled' : 'outlined'} color={work.needsInspection ? 'warning' : 'default'} label={work.stateLabel} />}
                {pendingOnly && work.pausedNeedsInspection && <Chip size="small" variant="outlined" label="Pausado" />}
                {!pendingOnly && work.queued ? (
                  <Typography variant="body2" color="text.secondary" aria-label="Inspecciones en cola">—</Typography>
                ) : !pendingOnly && (
                  <Box sx={{ textAlign: { sm: 'right' } }}>
                    <Typography variant="body2" fontWeight={800} aria-label={inspectionLabel(work.inspectionCount)}>
                      {inspectionLabel(work.inspectionCount)}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Box>
          ))}
          </Stack>}
        </Stack>
      )}
    </Paper>
  );
}


