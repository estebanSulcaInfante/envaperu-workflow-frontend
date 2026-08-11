import { useState } from 'react';
import {
  Box, Button, Collapse, IconButton, Paper, Stack, Tooltip, Typography, useMediaQuery,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';

const STORAGE_KEY = 'envaperu_alta_producto_asistente_visible';

export default function OnboardingAssistant({ stepCode, invalidated = false }) {
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)', { noSsr: true });
  const [visible, setVisible] = useState(
    () => globalThis.localStorage?.getItem(STORAGE_KEY) !== 'false',
  );
  const messages = {
    IDENTIDAD: 'Empecemos por una identidad confiable. Si viene de un Excel, deja la hoja y fila para encontrarla luego.',
    COMPONENTES: 'Reúne el molde y todas sus piezas en un solo golpe. Cavidades y peso operativo quedan en cada relación MoldePieza.',
    COLORES: 'Distingue el aspecto visual, el Acabado y la receta. Si falta una fórmula, déjala Pendiente con un motivo verificable.',
    ESTRUCTURA: 'Aqu\u00ed se revisar\u00e1 qu\u00e9 se consume y qu\u00e9 queda como WIP antes de publicar una BOM.',
    RUTA_EMPAQUE: 'Ruta y empaque deben describir c\u00f3mo se fabrica y c\u00f3mo se mueve la unidad real.',
    REVISION: 'La revisi\u00f3n final mostrar\u00e1 bloqueos e invalidaciones; nunca publicar\u00e1 datos incompletos.',
  };

  const hide = () => {
    setVisible(false);
    globalThis.localStorage?.setItem(STORAGE_KEY, 'false');
  };

  if (!visible) {
    return (
      <Button
        size="small"
        startIcon={<SmartToyRoundedIcon />}
        onClick={() => {
          setVisible(true);
          globalThis.localStorage?.setItem(STORAGE_KEY, 'true');
        }}
      >
        Mostrar asistente
      </Button>
    );
  }

  return (
    <Collapse
      in
      appear={!reduceMotion}
      timeout={reduceMotion ? 0 : 210}
      data-motion={reduceMotion ? 'reduced' : 'standard'}
    >
      <Paper
        variant="outlined"
        role="note"
        aria-label="Consejo del asistente"
        sx={{
          p: 1.5,
          borderColor: invalidated ? 'warning.light' : 'primary.light',
          background: invalidated
            ? 'linear-gradient(135deg, #fff8e8 0%, #fff 100%)'
            : 'linear-gradient(135deg, #edf7ff 0%, #fff 100%)',
          transition: 'transform 200ms ease, box-shadow 200ms ease',
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        }}
      >
        <Stack direction="row" spacing={1.25} alignItems="flex-start">
          <Box
            aria-hidden="true"
            sx={{
              width: 38,
              height: 38,
              flex: '0 0 auto',
              display: 'grid',
              placeItems: 'center',
              borderRadius: '13px 13px 16px 16px',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              boxShadow: '0 8px 18px rgba(30,58,95,.22)',
              '&::after': { content: '""', width: 4, height: 4, borderRadius: '50%', bgcolor: '#7de2c8', boxShadow: '10px 0 #7de2c8' },
            }}
          >
            <SmartToyRoundedIcon sx={{ position: 'absolute', opacity: 0.24 }} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="caption" color="primary.main" sx={{ fontWeight: 850 }}>
              Luma · asistente opcional
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
              {invalidated ? 'Un cambio anterior afect\u00f3 esta fase. Rev\u00edsala antes de continuar. ' : ''}
              {messages[stepCode]}
            </Typography>
          </Box>
          <Tooltip title="Ocultar asistente">
            <IconButton size="small" aria-label="Ocultar asistente" onClick={hide}>
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>
    </Collapse>
  );
}
