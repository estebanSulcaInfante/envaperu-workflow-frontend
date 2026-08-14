import {
  Box, Button, Chip, Paper, Stack, Typography,
} from '@mui/material';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import { Link as RouterLink, useLocation } from 'react-router-dom';

export default function PortfolioDemoBar() {
  const location = useLocation();

  return (
    <Paper
      component="aside"
      aria-label="Contexto de la demo pública"
      variant="outlined"
      sx={{
        mb: 1.25,
        px: 1.5,
        py: 1,
        borderColor: '#9BB8CF',
        bgcolor: '#EDF5FA',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        spacing={1}
      >
        <Stack direction="row" alignItems="center" spacing={1} minWidth={0}>
          <ScienceOutlinedIcon color="primary" fontSize="small" />
          <Box minWidth={0}>
            <Typography variant="body2" fontWeight={800}>
              Demo pública del primer piloto
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Datos sintéticos · balanza e impresora TSC simuladas
            </Typography>
          </Box>
          <Chip
            label="Reiniciable"
            color="success"
            size="small"
            variant="outlined"
            sx={{ display: { xs: 'none', lg: 'inline-flex' } }}
          />
        </Stack>
        {location.pathname !== '/' && (
          <Button
            component={RouterLink}
            to="/"
            size="small"
            startIcon={<RouteOutlinedIcon />}
          >
            Ver recorrido
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
