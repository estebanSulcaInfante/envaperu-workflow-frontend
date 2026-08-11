import { Alert, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded';
import ConstructionRoundedIcon from '@mui/icons-material/ConstructionRounded';
import { Link as RouterLink } from 'react-router-dom';

const HANDOFFS = {
  COMPONENTES: {
    title: 'Componentes y moldes',
    summary: 'La sesi\u00f3n ya reserva este paso, pero el alta transaccional de piezas y moldes se conectar\u00e1 en el siguiente incremento.',
    path: '/datos-maestros/moldes',
    action: 'Abrir configuraci\u00f3n t\u00e9cnica',
    captures: ['Piezas requeridas', 'Molde y cavidades', 'Salidas por ciclo'],
  },
  COLORES: {
    title: 'Colores, recetas y SKU',
    summary: 'A\u00fan no crea colores ni recetas desde este asistente. El cat\u00e1logo actual sigue siendo la fuente operativa.',
    path: '/datos-maestros/colores',
    action: 'Abrir colores y recetas',
    captures: ['Color de producci\u00f3n', 'Receta versionada', 'SKU Pieza-Color'],
  },
  ESTRUCTURA: {
    title: 'BOM y WIP',
    summary: 'A\u00fan no publica estructuras. Esta fase mostrar\u00e1 revisiones y bloqueos antes de crear una BOM productiva.',
    path: '/datos-maestros/ingenieria-scm',
    action: 'Abrir Ingenier\u00eda SCM',
    captures: ['BOM multinivel', 'Art\u00edculos WIP', 'Cantidades y mermas'],
  },
  RUTA_EMPAQUE: {
    title: 'Ruta y empaque',
    summary: 'A\u00fan no publica rutas ni perfiles de empaque. La edici\u00f3n productiva permanece en Ingenier\u00eda SCM.',
    path: '/datos-maestros/ingenieria-scm',
    action: 'Abrir rutas y empaque',
    captures: ['Secuencia de operaciones', 'Recursos compatibles', 'Perfil empacable'],
  },
  REVISION: {
    title: 'Revisi\u00f3n integral',
    summary: 'La validaci\u00f3n final se habilitar\u00e1 cuando las fases productivas anteriores creen sus maestros desde este flujo.',
    path: '/catalogo/revision',
    action: 'Abrir revisi\u00f3n de datos',
    captures: ['Bloqueos', 'Datos invalidados', 'Resumen antes de publicar'],
  },
};

export default function FuturePhase({ stepCode, stepState }) {
  const handoff = HANDOFFS[stepCode];
  return (
    <Stack spacing={2}>
      <Alert severity="info" icon={<ConstructionRoundedIcon />}>
        <strong>{'Fase representada, integraci\u00f3n pendiente.'}</strong> {handoff.summary}
      </Alert>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderStyle: 'dashed' }}>
        <Stack spacing={2}>
          <Box>
            <Chip size="small" label={stepState?.estado === 'INVALIDADO' ? 'Debe revisarse' : 'Pr\u00f3ximo incremento'} color={stepState?.estado === 'INVALIDADO' ? 'warning' : 'default'} />
            <Typography component="h2" variant="h5" sx={{ mt: 1, fontWeight: 850 }}>
              {handoff.title}
            </Typography>
          </Box>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {handoff.captures.map((item) => (
              <Typography component="li" variant="body2" key={item} sx={{ mb: 0.75 }}>
                {item}
              </Typography>
            ))}
          </Box>
          <Button
            component={RouterLink}
            to={handoff.path}
            variant="outlined"
            endIcon={<ArrowOutwardRoundedIcon />}
            sx={{ alignSelf: 'flex-start' }}
          >
            {handoff.action}
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
