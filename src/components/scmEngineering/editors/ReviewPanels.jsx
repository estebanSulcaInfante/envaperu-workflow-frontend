import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ApprovalOutlinedIcon from '@mui/icons-material/ApprovalOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';

const DOMAIN_CAPABILITIES = {
  ESTRUCTURA: {
    admin: 'ESTRUCTURA_ADMINISTRAR',
    approve: 'ESTRUCTURA_APROBAR',
    publish: 'ESTRUCTURA_PUBLICAR_DIRECTO',
  },
  RUTA: {
    admin: 'RUTA_ADMINISTRAR',
    approve: 'RUTA_APROBAR',
    publish: 'RUTA_PUBLICAR_DIRECTO',
  },
  EMPAQUE: {
    admin: 'EMPAQUE_ADMINISTRAR',
    approve: 'EMPAQUE_APROBAR',
    publish: 'EMPAQUE_PUBLICAR_DIRECTO',
  },
};

const STATUS_LABEL = {
  BORRADOR: 'Borrador',
  PENDIENTE: 'Pendiente de aprobación',
  PENDIENTE_APROBACION: 'Pendiente de aprobación',
  APROBADA: 'Aprobada',
  RETIRADA: 'Retirada',
  RECHAZADA: 'Rechazada',
  DESCARTADA: 'Descartada',
};

const READINESS = {
  READY: { label: 'Listo para planificar', severity: 'success' },
  PENDING_APPROVAL: { label: 'Pendiente de aprobación', severity: 'warning' },
  BLOCKED: { label: 'Bloqueado', severity: 'error' },
  NOT_CHECKED: { label: 'No validado', severity: 'info' },
};

const STEP_LABEL = {
  IDENTIDAD: 'Identidad',
  COMPONENTES: 'Componentes',
  COLORES: 'Colores',
  ESTRUCTURA: 'Estructura',
  RUTA_EMPAQUE: 'Ruta y empaque',
  REVISION: 'Revisión',
};

export function ApprovalActionPanel({
  domain,
  revision,
  actorId,
  capabilities = [],
  onAction,
  busy = false,
}) {
  const config = DOMAIN_CAPABILITIES[domain] || {};
  const available = new Set(capabilities);
  const state = revision?.estado || 'BORRADOR';
  const creator = Number(actorId) === Number(revision?.creada_por_id);
  const pending = ['PENDIENTE', 'PENDIENTE_APROBACION'].includes(state);
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <ApprovalOutlinedIcon color="action" aria-hidden="true" />
          <Chip size="small" variant="outlined" label={STATUS_LABEL[state] || state} />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          {state === 'BORRADOR' && available.has(config.publish) && (
            <Button
              variant="contained"
              disabled={busy}
              onClick={() => onAction('publish', revision)}
            >
              Publicar (queda aprobada)
            </Button>
          )}
          {state === 'BORRADOR'
            && domain === 'ESTRUCTURA'
            && available.has(config.admin)
            && !available.has(config.publish) && (
            <Button disabled={busy} onClick={() => onAction('submit', revision)}>
              Enviar a aprobación
            </Button>
          )}
          {state === 'BORRADOR'
            && domain !== 'ESTRUCTURA'
            && available.has(config.approve)
            && !available.has(config.publish) && (
            <Button
              variant="contained"
              disabled={busy || creator}
              onClick={() => onAction('approve', revision)}
            >
              {creator ? 'Requiere otro actor' : 'Aprobar'}
            </Button>
          )}
          {pending && available.has(config.approve) && (
            <>
              <Button
                variant="contained"
                disabled={busy || creator}
                onClick={() => onAction('approve', revision)}
              >
                {creator ? 'Requiere otro actor' : 'Aprobar'}
              </Button>
              <Button
                color="error"
                variant="outlined"
                disabled={busy || creator}
                onClick={() => onAction('reject', revision)}
              >
                Rechazar
              </Button>
            </>
          )}
          {state === 'APROBADA' && available.has(config.admin) && (
            <>
              <Button disabled={busy} onClick={() => onAction('clone', revision)}>
                Crear nueva revisión
              </Button>
              <Button
                color="warning"
                disabled={busy}
                onClick={() => onAction('retire', revision)}
              >
                Retirar
              </Button>
            </>
          )}
        </Stack>
      </Stack>
      {pending && creator && available.has(config.approve) && (
        <Alert severity="info" sx={{ mt: 1 }}>
          El creador no puede aprobar su propia revisión. Cambia al actor aprobador.
        </Alert>
      )}
    </Paper>
  );
}

export function ReadinessReviewPanel({
  readiness,
  onValidate,
  onOpenStep,
  busy = false,
}) {
  const state = READINESS[readiness?.status] || READINESS.NOT_CHECKED;
  const items = readiness?.items || [];
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          justifyContent="space-between"
          alignItems={{ sm: 'center' }}
        >
          <Box>
            <Typography component="h2" variant="h6">Revisión técnica</Typography>
            <Typography variant="body2" color="text.secondary">
              La validación consulta los maestros canónicos actuales; no confía sólo en
              el borrador guardado por el asistente.
            </Typography>
          </Box>
          <Chip label={state.label} color={state.severity} />
        </Stack>
        <Alert severity={state.severity}>
          {state.label}
          {readiness?.checked_at
            ? ` · validado ${new Date(readiness.checked_at).toLocaleString('es-PE')}`
            : ' · ejecuta la validación para obtener un resultado vigente.'}
        </Alert>
        {items.length > 0 && (
          <Stack component="ul" spacing={1} sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {items.map((item) => (
              <Paper
                component="li"
                variant="outlined"
                key={`${item.code}-${item.paso}-${item.message}`}
                aria-label={item.message}
                sx={{ p: 1.5 }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  justifyContent="space-between"
                  alignItems={{ sm: 'center' }}
                >
                  <Box>
                    <Typography variant="body2" fontWeight={800}>{item.message}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.code} · {STEP_LABEL[item.paso] || item.paso}
                    </Typography>
                  </Box>
                  {item.action === 'OPEN_STEP' && onOpenStep && (
                    <Button size="small" onClick={() => onOpenStep(item.paso)}>
                      Corregir en {STEP_LABEL[item.paso] || item.paso}
                    </Button>
                  )}
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
        {onValidate && (
          <Button
            variant="outlined"
            startIcon={busy ? <CircularProgress size={16} /> : <RefreshIcon />}
            disabled={busy}
            onClick={onValidate}
            sx={{ alignSelf: { sm: 'flex-end' } }}
          >
            Validar nuevamente
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
