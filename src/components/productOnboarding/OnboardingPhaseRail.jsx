import {
  Box, ButtonBase, Chip, Stack, Typography,
} from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import {
  ONBOARDING_STEPS, prerequisiteBlocker, statusColor, statusLabel,
} from './onboardingModel';

export default function OnboardingPhaseRail({ session, activeCode, onSelect }) {
  const statuses = Object.fromEntries((session?.pasos || []).map((step) => [step.codigo, step]));

  return (
    <Box
      component="nav"
      aria-label="Fases del alta de producto"
      data-desktop-layout="grid-3x2"
      sx={{
        display: { xs: 'flex', md: 'grid', xl: 'block' },
        gridTemplateColumns: { md: 'repeat(3, minmax(0, 1fr))' },
        gap: { md: 0.75, xl: 0 },
        overflowX: { xs: 'auto', md: 'visible' },
        scrollSnapType: { xs: 'x mandatory', md: 'none' },
        pb: { xs: 0.5, md: 0 },
      }}
    >
      {ONBOARDING_STEPS.map((step, index) => {
        const state = statuses[step.code]?.estado || 'PENDIENTE';
        const active = activeCode === step.code;
        const blocker = prerequisiteBlocker(session, step.code);
        return (
          <ButtonBase
            key={step.code}
            aria-current={active ? 'step' : undefined}
            aria-label={`${step.label}${blocker ? ` · bloqueado por ${blocker.label}` : ''}`}
            onClick={() => onSelect(step)}
            sx={{
              position: 'relative',
              width: { xs: 220, md: '100%' },
              minWidth: { xs: 220, md: 0 },
              minHeight: 78,
              justifyContent: 'flex-start',
              alignItems: 'stretch',
              textAlign: 'left',
              borderRadius: 2.5,
              p: 1.25,
              mb: { xs: 0, md: 0, xl: 0.75 },
              mr: { xs: 0.75, md: 0 },
              scrollSnapAlign: 'start',
              border: '1px solid',
              borderColor: active ? 'primary.main' : 'divider',
              bgcolor: active ? 'primary.50' : 'background.paper',
              boxShadow: active ? '0 9px 24px rgba(30,58,95,.10)' : 'none',
              transition: 'border-color 180ms ease, background-color 180ms ease, transform 180ms ease',
              '&:hover': { transform: 'translateY(-1px)', borderColor: 'primary.light' },
              '&:focus-visible': { outline: '3px solid', outlineColor: 'info.light', outlineOffset: 2 },
              '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:hover': { transform: 'none' } },
            }}
          >
            <Stack direction="row" spacing={1.1} sx={{ width: '100%' }}>
              <Box
                sx={{
                  mt: 0.125,
                  width: 28,
                  height: 28,
                  flex: '0 0 auto',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '9px',
                  bgcolor: state === 'COMPLETADO' ? 'success.main'
                    : state === 'INVALIDADO' ? 'warning.main'
                      : active ? 'primary.main' : 'grey.200',
                  color: state === 'PENDIENTE' && !active ? 'text.secondary' : 'common.white',
                  fontSize: 13,
                  fontWeight: 900,
                }}
              >
                {state === 'COMPLETADO' ? <CheckRoundedIcon sx={{ fontSize: 18 }} />
                  : state === 'INVALIDADO' ? <ErrorOutlineRoundedIcon sx={{ fontSize: 17 }} />
                    : index + 1}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 850, lineHeight: 1.25 }}>
                  {step.label}
                </Typography>
                <Chip
                  size="small"
                  label={blocker && state !== 'INVALIDADO'
                    ? `Primero: ${blocker.label}`
                    : statusLabel(state)}
                  color={statusColor(state)}
                  variant={active ? 'filled' : 'outlined'}
                  sx={{ height: 21, mt: 0.75, '& .MuiChip-label': { px: 0.8, fontSize: 10.5 } }}
                />
              </Box>
            </Stack>
          </ButtonBase>
        );
      })}
    </Box>
  );
}
