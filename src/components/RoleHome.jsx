import {
  Box, Button, Chip, Grid, Paper, Stack, Typography,
} from '@mui/material';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { useScmActor } from '../context/ScmActorContext';
import Dashboard from './Dashboard';
import PageHeader from './ui/PageHeader';

const TASKS = [
  {
    capability: 'OP_APROBAR',
    title: 'Revisar demanda',
    description: 'Aprobar OP antes de comprometer fabricación o armado.',
    path: '/planificacion',
  },
  {
    capability: 'PLANIFICACION_CALCULAR',
    title: 'Planificar producción',
    description: 'Convertir demanda aprobada en propuestas OF y OA.',
    path: '/planificacion',
  },
  {
    capability: 'OF_LIBERAR',
    title: 'Preparar fabricación',
    description: 'Completar recursos técnicos y liberar órdenes fabricables.',
    path: '/produccion/ordenes-fabricacion',
  },
  {
    capability: 'OA_LIBERAR',
    title: 'Preparar armado',
    description: 'Liberar y ejecutar prearmado, armado o terminación.',
    path: '/produccion/ordenes-armado',
  },
  {
    capability: 'MANGA_PLANIFICAR',
    title: 'Preparar OT y mangas',
    description: 'Asignar jornada, maquinista y unidades logísticas.',
    path: '/produccion/ots-mangas',
  },
  {
    capability: 'MANGA_ETIQUETA_PRE_GENERAR',
    title: 'Generar preetiquetas',
    description: 'Dejar mangas identificadas antes de llegar a la balanza.',
    path: '/produccion/ots-mangas',
  },
  {
    capability: 'ESTRUCTURA_ADMINISTRAR',
    title: 'Completar ingeniería',
    description: 'Mantener BOM, rutas y reglas físicas aprobables.',
    path: '/datos-maestros/ingenieria-scm',
  },
  {
    capability: 'ARTICULO_ADMINISTRAR',
    title: 'Mantener maestros',
    description: 'Crear productos, piezas, variantes y clasificaciones confiables.',
    path: '/datos-maestros',
  },
  {
    capability: 'OC_CREAR',
    title: 'Preparar abastecimiento',
    description: 'Registrar órdenes y documentos de materias primas.',
    path: '/materiales/compras',
  },
  {
    capability: 'RECEPCION_CONFIRMAR',
    title: 'Recibir materiales',
    description: 'Identificar entregas, bolsas y trazabilidad de recepción.',
    path: '/materiales/recepciones',
  },
  {
    capability: 'RECEPCION_MANGA_CONFIRMAR',
    title: 'Recibir mangas de producción',
    description: 'Escanear bolsas pesadas y aceptar su custodia en Kardex.',
    path: '/produccion/recepcion-mangas',
  },
  {
    capability: 'CALIDAD_MANGA_VER',
    title: 'Resolver mangas recibidas',
    description: 'Liberar o bloquear existencias después de su recepción física.',
    path: '/produccion/recepcion-mangas',
  },
];

export default function RoleHome() {
  const { actor, can, experience } = useScmActor();
  const tasks = TASKS.filter((task) => can(task.capability));
  const showPlantOverview = can('WIP_VER') || can('OP_VER');

  return (
    <Stack spacing={3}>
      <PageHeader
        title={`Hola, ${actor?.nombre_corto || actor?.nombres || 'equipo'}`}
        description={experience.focus}
      />

      <Paper
        variant="outlined"
        sx={{ p: { xs: 2, md: 2.5 }, bgcolor: '#F7FAFD', borderColor: '#CAD9E8' }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.75 }}>
          <AssignmentTurnedInOutlinedIcon color="primary" />
          <Typography variant="h6" fontWeight={850}>Tu trabajo disponible</Typography>
          <Chip size="small" label={experience.label} color="primary" variant="outlined" />
        </Stack>
        <Grid container spacing={1.5}>
          {tasks.slice(0, 6).map((task) => (
            <Grid key={`${task.capability}-${task.title}`} size={{ xs: 12, sm: 6, lg: 4 }}>
              <Paper variant="outlined" sx={{ p: 2, height: '100%', bgcolor: 'background.paper' }}>
                <Typography fontWeight={800}>{task.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, minHeight: 40 }}>
                  {task.description}
                </Typography>
                <Button
                  component={RouterLink}
                  to={task.path}
                  size="small"
                  endIcon={<ArrowForwardOutlinedIcon />}
                  sx={{ mt: 1, px: 0 }}
                >
                  Ir a la tarea
                </Button>
              </Paper>
            </Grid>
          ))}
          {!tasks.length && (
            <Grid size={{ xs: 12 }}>
              <Typography color="text.secondary">
                Tu perfil es de consulta. Usa el menú para revisar la información disponible.
              </Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      {showPlantOverview && (
        <Box>
          <Typography variant="h6" fontWeight={850} sx={{ mb: 1.5 }}>Situación de planta</Typography>
          <Dashboard compact />
        </Box>
      )}
    </Stack>
  );
}
