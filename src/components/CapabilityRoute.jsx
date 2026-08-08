import {
  Alert, Box, Button, Paper, Skeleton, Stack, Typography,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { useScmActor } from '../context/ScmActorContext';

export default function CapabilityRoute({ any = [], children }) {
  const {
    actor, canAny, error, loading, refreshActors,
  } = useScmActor();

  if (loading) {
    return (
      <Stack
        role="status"
        aria-label="Cargando permisos"
        spacing={1.25}
        sx={{ maxWidth: 960, py: 2 }}
      >
        <Skeleton variant="rounded" height={44} width="55%" />
        <Skeleton variant="rounded" height={120} />
      </Stack>
    );
  }

  if (error || !actor) {
    return (
      <Box sx={{ maxWidth: 760, mx: 'auto', py: 6 }}>
        <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 4 } }}>
          <Typography variant="h5" fontWeight={850}>
            No pudimos verificar tu acceso
          </Typography>
          <Alert severity="error" sx={{ my: 2 }}>
            {error || 'La sesión no devolvió una identidad operativa válida.'}
          </Alert>
          <Button variant="contained" onClick={refreshActors}>
            Reintentar
          </Button>
        </Paper>
      </Box>
    );
  }

  if (canAny(any)) return children;

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto', py: 6 }}>
      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 4 }, textAlign: 'center' }}>
        <LockOutlinedIcon color="disabled" sx={{ fontSize: 48, mb: 1.5 }} />
        <Typography variant="h5" fontWeight={850}>Esta vista no corresponde a tu función</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 2.5 }}>
          {actor?.nombre_corto || 'Tu perfil'} puede continuar desde las opciones visibles en el menú.
          La API también protege cada acción.
        </Typography>
        <Alert severity="info" sx={{ mb: 2.5, textAlign: 'left' }}>
          Si esta tarea forma parte de tu trabajo habitual, solicita la asignación del rol correspondiente;
          no es necesario compartir otra identidad.
        </Alert>
        <Stack direction="row" justifyContent="center">
          <Button
            component={RouterLink}
            to="/"
            variant="contained"
            startIcon={<ArrowBackOutlinedIcon />}
          >
            Volver a mi inicio
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
