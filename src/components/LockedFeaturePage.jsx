import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

function LockedFeaturePage({ feature }) {
  const title = feature?.label || 'Función fuera del piloto';
  const placeholder = feature?.placeholder || {};
  const areaLabel = placeholder.areaLabel || feature?.areaLabel || 'Workspace';
  const contextLabel = placeholder.contextLabel || 'función informativa';
  const returnPath = placeholder.returnPath || '/';
  const returnLabel = placeholder.returnLabel || 'Volver a mi inicio';
  const guidePath = placeholder.guidePath || '/guia/scm';
  const guideLabel = placeholder.guideLabel || 'Consultar la guía';

  return (
    <Box sx={{ maxWidth: 880, mx: 'auto', py: { xs: 3, md: 6 } }}>
      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 4 } }}>
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <LockOutlinedIcon color="action" aria-hidden="true" sx={{ mt: 0.5 }} />
            <Box>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 850 }}>
                {title}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                {areaLabel} · {contextLabel}
              </Typography>
            </Box>
          </Stack>
          <Alert severity="info" role="status">
            <Typography component="span" fontWeight={800}>Fuera del piloto</Typography>
            {` · ${placeholder.reason || 'Esta pantalla comunica la madurez de la función.'}`}
          </Alert>
          <Typography>
            {placeholder.summary || 'La función está reservada para una etapa posterior del piloto.'}
          </Typography>
          {placeholder.limitations && <Typography color="text.secondary">{placeholder.limitations}</Typography>}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button
              component={RouterLink}
              to={returnPath}
              variant="contained"
              startIcon={<ArrowBackOutlinedIcon />}
            >
              {returnLabel}
            </Button>
            <Button component={RouterLink} to={guidePath} variant="outlined">
              {guideLabel}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}

export default LockedFeaturePage;
