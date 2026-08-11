import { Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ExitToAppRoundedIcon from '@mui/icons-material/ExitToAppRounded';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';

export default function OnboardingActions({
  canGoBack,
  busy,
  saveState,
  onBack,
  onSave,
  onContinue,
  onExit,
  continueLabel = 'Guardar y continuar',
  continueDisabled = false,
  continueHint = '',
  saveDisabled = false,
  finalized = false,
}) {
  return (
    <Paper
      component="footer"
      elevation={6}
      sx={{
        position: 'sticky',
        bottom: 8,
        zIndex: 5,
        px: { xs: 1, sm: 1.5 },
        py: 1,
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 12px 34px rgba(24,45,74,.17)',
        backdropFilter: 'blur(14px)',
        bgcolor: 'rgba(255,255,255,.94)',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        spacing={1}
      >
        <Stack
          direction="row"
          spacing={0.75}
          justifyContent={{ xs: 'space-between', sm: 'flex-start' }}
        >
          <Button
            startIcon={<ArrowBackRoundedIcon />}
            disabled={!canGoBack || busy}
            onClick={onBack}
          >
            {'Atr\u00e1s'}
          </Button>
          <Button
            color="inherit"
            startIcon={<ExitToAppRoundedIcon />}
            disabled={busy}
            onClick={onExit}
          >
            {!finalized && (
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Guardar y</Box>
            )}
            {' '}salir
          </Button>
        </Stack>
        {!finalized && <Box sx={{ minWidth: 0, textAlign: { xs: 'left', sm: 'right' } }}>
          <Typography
            variant="caption"
            color={saveState === 'error' ? 'error.main' : 'text.secondary'}
            sx={{ display: { xs: 'none', md: 'block' }, mb: 0.25 }}
            aria-live="polite"
          >
            {saveState === 'saving' ? 'Guardando cambios\u2026'
              : saveState === 'saved' ? 'Cambios guardados en el servidor'
                : saveState === 'error' ? 'No se pudieron guardar los cambios'
                  : 'Borrador listo para guardar'}
          </Typography>
          {continueHint && (
            <Typography variant="caption" color="warning.main" sx={{ display: 'block', mb: 0.5 }}>
              {continueHint}
            </Typography>
          )}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={0.75}
            justifyContent="flex-end"
            data-mobile-layout="stacked-actions"
          >
            <Button
              variant="outlined"
              startIcon={busy && saveState === 'saving' ? <CircularProgress size={16} /> : <SaveOutlinedIcon />}
              disabled={busy || saveDisabled}
              onClick={onSave}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Guardar
            </Button>
            <Button
              variant="contained"
              endIcon={<ArrowForwardRoundedIcon />}
              disabled={busy || continueDisabled}
              onClick={onContinue}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              {continueLabel}
            </Button>
          </Stack>
        </Box>}
      </Stack>
    </Paper>
  );
}
