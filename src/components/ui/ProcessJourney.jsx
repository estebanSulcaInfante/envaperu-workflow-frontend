import { useState } from 'react';
import {
  Box, Button, Chip, Collapse, Divider, Paper, Stack, Typography,
} from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
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
    path: '/produccion/ots-planta',
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
  const [expanded, setExpanded] = useState(normalizedCurrent === 'demanda');
  const activeStep = steps.find((step) => step.id === normalizedCurrent) || steps[0];

  return (
    <Paper
      component="section"
      aria-label="Recorrido operativo"
      variant="outlined"
      sx={{ px: 1.5, py: 1 }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">Recorrido operativo</Typography>
          <Typography variant="body2" fontWeight={800} noWrap>
            Etapa actual: {activeStep.label} · {activeStep.detail}
          </Typography>
        </Box>
        <Button
          size="small"
          variant="text"
          aria-expanded={expanded}
          aria-controls="process-journey-steps"
          endIcon={(
            <ExpandMoreRoundedIcon
              sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }}
            />
          )}
          onClick={() => setExpanded((value) => !value)}
          sx={{ flexShrink: 0 }}
        >
          {expanded ? 'Ocultar etapas' : 'Ver etapas'}
        </Button>
      </Stack>
      <Collapse in={expanded} unmountOnExit>
        <Divider sx={{ my: 1 }} />
        <Box
          id="process-journey-steps"
          data-testid="process-journey-steps"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(5, minmax(0, 1fr))' },
            gap: 1,
          }}
        >
          {steps.map((step) => {
            const active = step.id === normalizedCurrent;
            const accessible = canAny(step.requiredAny);
            const path = step.path;
            return (
              <Chip
                key={step.id}
                component={accessible && path ? RouterLink : 'div'}
                to={accessible && path ? path : undefined}
                clickable={Boolean(accessible && path)}
                aria-current={active ? 'step' : undefined}
                color={active ? 'primary' : 'default'}
                variant={active ? 'filled' : 'outlined'}
                label={(
                  <Box sx={{ textAlign: 'left', lineHeight: 1.15, py: 0.25 }}>
                    <Typography component="span" variant="caption" fontWeight={800}>{step.label}</Typography>
                    <Typography component="span" variant="caption" display="block" color={active ? 'inherit' : 'text.secondary'}>
                      {step.detail}
                    </Typography>
                  </Box>
                )}
                sx={{ height: 'auto', minHeight: 44, width: '100%', justifyContent: 'flex-start' }}
              />
            );
          })}
        </Box>
      </Collapse>
    </Paper>
  );
}
