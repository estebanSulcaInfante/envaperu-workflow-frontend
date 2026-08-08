import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import {
  defaultWorkspaceRuntimeFlags,
  featureIsAvailable,
  getFeatureByKey,
} from '../config/workspaceRegistry';

function FeatureAvailabilityRoute({
  featureKey,
  runtimeFlags = defaultWorkspaceRuntimeFlags,
  children,
}) {
  const feature = getFeatureByKey(featureKey);

  if (feature && featureIsAvailable(feature, runtimeFlags)) return children;

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto', mt: 4 }}>
      <Stack spacing={2}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
          {feature?.label || 'Función no disponible'}
        </Typography>
        <Alert severity="info">
          Esta función no está habilitada en el piloto SCM. No se cargaron formularios ni datos
          operativos de este módulo.
        </Alert>
        <Box>
          <Button component={RouterLink} to="/guia/scm" variant="outlined">
            Consultar la guía del piloto
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}

export default FeatureAvailabilityRoute;
