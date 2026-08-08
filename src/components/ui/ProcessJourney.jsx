import {
  Box, Chip, Paper, Stack, Typography,
} from '@mui/material';
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded';
import { Link as RouterLink } from 'react-router-dom';
import { useScmActor } from '../../context/ScmActorContext';

const steps = [
  {
    id: 'demanda',
    label: '1. Demanda',
    detail: 'Definir OP y cobertura',
    path: '/planificacion',
    requiredAny: ['OP_VER', 'OP_APROBAR'],
  },
  {
    id: 'trabajo',
    label: '2. Órdenes técnicas',
    detail: 'OF y OA',
    requiredAny: ['OF_VER', 'OA_VER'],
  },
  {
    id: 'jornada',
    label: '3. Jornada',
    detail: 'Programar OT y mangas',
    path: '/produccion/ots-mangas',
    requiredAny: ['OT_VER'],
  },
  {
    id: 'pesaje',
    label: '4. Pesaje',
    detail: 'Registrar en balanza',
    requiredAny: ['MANGA_PESAR', 'MANGA_PESAJE_VER'],
  },
  {
    id: 'almacen',
    label: '5. Almacén',
    detail: 'Recibir y controlar',
    path: '/produccion/recepcion-mangas',
    requiredAny: ['RECEPCION_MANGA_VER', 'CALIDAD_MANGA_VER'],
  },
];

export default function ProcessJourney({ current }) {
  const { canAny } = useScmActor();
  const normalizedCurrent = current === 'armado' || current === 'fabricacion'
    ? 'trabajo' : current;

  return (
    <Paper
      component="nav"
      aria-label="Recorrido operativo"
      variant="outlined"
      sx={{ px: 1.5, py: 1.25, overflowX: 'auto' }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 760 }}>
        <Box sx={{ minWidth: 112 }}>
          <Typography variant="caption" color="text.secondary">Navegación entre etapas</Typography>
          <Typography variant="subtitle2" fontWeight={850}>Recorrido operativo</Typography>
        </Box>
        {steps.map((step, index) => {
          const active = step.id === normalizedCurrent;
          const accessible = !step.future && canAny(step.requiredAny);
          const label = step.label;
          const detail = step.detail;
          const path = step.path;
          return (
            <Stack key={step.id} direction="row" alignItems="center" spacing={1} flex={1}>
              <Chip
                component={accessible && path ? RouterLink : 'div'}
                to={accessible && path ? path : undefined}
                clickable={Boolean(accessible && path)}
                aria-current={active ? 'step' : undefined}
                color={active ? 'primary' : 'default'}
                variant={active ? 'filled' : 'outlined'}
                label={(
                  <Box sx={{ textAlign: 'left', lineHeight: 1.15 }}>
                    <Typography component="span" variant="caption" fontWeight={800}>{label}</Typography>
                    <Typography component="span" variant="caption" display="block" color={active ? 'inherit' : 'text.secondary'}>
                      {detail}
                    </Typography>
                  </Box>
                )}
                sx={{ height: 42, flex: 1, justifyContent: 'flex-start', opacity: step.future ? 0.55 : 1 }}
              />
              {index < steps.length - 1 && <ArrowForwardIosRoundedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />}
            </Stack>
          );
        })}
      </Stack>
    </Paper>
  );
}
