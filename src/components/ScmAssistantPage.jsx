import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import ExpandLessOutlinedIcon from '@mui/icons-material/ExpandLessOutlined';
import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import ScaleOutlinedIcon from '@mui/icons-material/ScaleOutlined';
import PageHeader from './ui/PageHeader';
import { consultarScmAssistant, getScmAssistantStatus } from '../services/scmAssistantApi';
import { yesterdayInLima } from '../utils/limaDate';

const PRESET_QUERY = '¿Qué tal fue el avance de producción ayer?';

const numberFormatter = new Intl.NumberFormat('es-PE', {
  maximumFractionDigits: 0,
});

const kgFormatter = new Intl.NumberFormat('es-PE', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

const displayCount = (value) => (
  value === null || value === undefined ? 'No informado' : numberFormatter.format(value)
);

const displayKg = (value) => (
  value === null || value === undefined ? 'No informado' : `${kgFormatter.format(value)} kg`
);

const displayText = (value, fallback = 'No informado') => value || fallback;

const providerStatusLabel = (status) => ({
  AUTH_PENDING: 'Pendiente de conexión',
  READY: 'Conectado',
  PROVIDER_NOT_LINKED: 'Proveedor no vinculado',
  CONFIGURED_NOT_VERIFIED: 'Configuración pendiente',
  UNAVAILABLE: 'No disponible',
  NOT_AVAILABLE: 'No disponible',
}[status] || 'Estado no informado');

const formatUtc = (value) => {
  if (!value) return 'No informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

function SourceDisclosure({ group }) {
  const weighingIds = Array.isArray(group.weighing_ids) ? group.weighing_ids : [];
  const mangaIds = Array.isArray(group.manga_ids) ? group.manga_ids : [];
  const cancelledWeighingIds = Array.isArray(group.cancelled_weighing_ids)
    ? group.cancelled_weighing_ids : [];
  const cancelledMangaIds = Array.isArray(group.cancelled_manga_ids)
    ? group.cancelled_manga_ids : [];
  const hasSources = weighingIds.length > 0 || mangaIds.length > 0
    || cancelledWeighingIds.length > 0 || cancelledMangaIds.length > 0;
  const label = `Ver fuentes de ${displayText(group.of, 'este grupo')}`;

  return (
    <Box component="details" sx={{ mt: 1 }}>
      <Box component="summary" sx={{ cursor: 'pointer', color: 'primary.main', fontSize: 13 }}>
        {label}
      </Box>
      <Stack spacing={0.5} sx={{ mt: 0.75, pl: 1.5 }}>
        <Typography variant="caption" color="text.secondary">
          Pesajes ({weighingIds.length}): {hasSources ? weighingIds.join(', ') || 'Sin IDs' : 'Sin IDs'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Mangas ({mangaIds.length}): {hasSources ? mangaIds.join(', ') || 'Sin IDs' : 'Sin IDs'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Pesajes anulados ({cancelledWeighingIds.length}): {cancelledWeighingIds.join(', ') || 'Sin IDs'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Mangas anuladas ({cancelledMangaIds.length}): {cancelledMangaIds.join(', ') || 'Sin IDs'}
        </Typography>
      </Stack>
    </Box>
  );
}

function GroupDetails({ group }) {
  const [open, setOpen] = useState(false);
  const label = `${open ? 'Ocultar' : 'Ver'} detalle de ${displayText(group.of, 'este grupo')}`;
  return (
    <Box>
      <Button
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        size="small"
        startIcon={open ? <ExpandLessOutlinedIcon /> : <ExpandMoreOutlinedIcon />}
        sx={{ px: 0, minWidth: 0 }}
      >
        {open ? 'Ocultar detalle' : 'Ver detalle'}
      </Button>
      <Collapse in={open} unmountOnExit>
        <SourceDisclosure group={group} />
      </Collapse>
    </Box>
  );
}

function ResultTable({ result }) {
  const groups = Array.isArray(result?.groups) ? result.groups : [];
  if (!groups.length) {
    return (
      <Paper variant="outlined" sx={{ p: 3, minHeight: 180, display: 'grid', placeItems: 'center' }}>
        <Stack spacing={0.75} alignItems="center" sx={{ textAlign: 'center' }}>
          <ScaleOutlinedIcon color="disabled" />
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>No hay pesajes para esa fecha</Typography>
          <Typography variant="body2" color="text.secondary">
            La respuesta autoritativa no contiene grupos efectivos ni anulados para el corte solicitado.
          </Typography>
        </Stack>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: '100%', overflowX: 'auto' }}>
      <Table size="small" aria-label="Avance de producción por grupo" sx={{ minWidth: 860 }}>
        <TableHead>
          <TableRow>
            <TableCell>OF</TableCell>
            <TableCell>Color</TableCell>
            <TableCell align="right">Pesajes efectivos</TableCell>
            <TableCell align="right">Neto efectivo</TableCell>
            <TableCell align="right">Pesajes anulados</TableCell>
            <TableCell align="right">Kg anulados</TableCell>
            <TableCell>Fuentes</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {groups.map((group, index) => (
            <TableRow key={`${group.of || 'sin-of'}-${group.color || 'sin-color'}-${index}`} hover>
              <TableCell sx={{ fontWeight: 800 }}>{displayText(group.of, 'Sin OF')}</TableCell>
              <TableCell>{displayText(group.color, 'Sin color')}</TableCell>
              <TableCell align="right">{displayCount(group.weighings)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>{displayKg(group.net_kg)}</TableCell>
              <TableCell align="right">{displayCount(group.cancelled_weighings)}</TableCell>
              <TableCell align="right">{displayKg(group.cancelled_kg)}</TableCell>
              <TableCell><GroupDetails group={group} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function Totals({ totals }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, mt: 2 }}>
      <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 850, mb: 1.25 }}>
        Totales del corte
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' },
          gap: 1.5,
        }}
      >
        <Box><Typography variant="caption" color="text.secondary">Pesajes efectivos</Typography><Typography sx={{ fontWeight: 800 }}>{displayCount(totals?.effective_weighings)}</Typography></Box>
        <Box><Typography variant="caption" color="text.secondary">Kg efectivos</Typography><Typography sx={{ fontWeight: 800 }}>{displayKg(totals?.effective_kg)}</Typography></Box>
        <Box><Typography variant="caption" color="text.secondary">Pesajes anulados</Typography><Typography sx={{ fontWeight: 800 }}>{displayCount(totals?.cancelled_weighings)}</Typography></Box>
        <Box><Typography variant="caption" color="text.secondary">Kg anulados</Typography><Typography sx={{ fontWeight: 800 }}>{displayKg(totals?.cancelled_kg)}</Typography></Box>
      </Box>
    </Paper>
  );
}

function ProviderNarration({ provider }) {
  if (!provider?.text) return null;
  return (
    <Paper variant="outlined" sx={{ p: 1.75, mt: 2, bgcolor: '#F8FAFC' }}>
      <Stack spacing={0.75}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography component="h2" variant="subtitle2" sx={{ fontWeight: 850 }}>Narración generada</Typography>
          {provider.mode && <Chip size="small" variant="outlined" label={provider.mode} />}
        </Stack>
        <Typography variant="body2">{provider.text}</Typography>
        <Typography variant="caption" color="text.secondary">
          Esta narración es opcional y no sustituye la tabla numérica autoritativa.
        </Typography>
      </Stack>
    </Paper>
  );
}

export default function ScmAssistantPage() {
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [statusRefreshKey, setStatusRefreshKey] = useState(0);
  const [query, setQuery] = useState(PRESET_QUERY);
  const [dateLima, setDateLima] = useState(yesterdayInLima);
  const [result, setResult] = useState(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    setStatusLoading(true);
    setStatusError('');
    getScmAssistantStatus()
      .then((payload) => {
        if (active) setStatus(payload);
      })
      .catch(() => {
        if (active) setStatusError('No se pudo verificar la disponibilidad del asistente.');
      })
      .finally(() => {
        if (active) setStatusLoading(false);
      });
    return () => { active = false; };
  }, [statusRefreshKey]);

  const ready = Boolean(
    !statusLoading && !statusError && status?.available && status?.auth_state === 'READY',
  );
  const disabledReason = useMemo(() => {
    if (statusLoading) return 'Verificando disponibilidad...';
    if (statusError) return statusError;
    if (status?.auth_state === 'AUTH_PENDING') return 'Pendiente de conexión';
    if (status && !status.available) return status.message || 'El asistente no está disponible en este entorno.';
    return '';
  }, [status, statusError, statusLoading]);

  const submit = async (forceRefresh = false) => {
    if (!ready || !query.trim() || !dateLima) return;
    setQueryLoading(true);
    setRefreshing(forceRefresh);
    setQueryError('');
    try {
      const payload = await consultarScmAssistant({ query: query.trim(), dateLima, refresh: forceRefresh });
      setResult(payload);
    } catch {
      setQueryError('No se pudo consultar el avance. La lectura no modificó datos.');
    } finally {
      setQueryLoading(false);
      setRefreshing(false);
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 1500, minWidth: 0, mx: 'auto', overflowX: 'hidden', '& .MuiAlert-message': { minWidth: 0, overflowWrap: 'anywhere' } }}>
      <PageHeader
        title="Asistente de producción"
        description="Consulta de solo lectura para el avance diario respaldado por pesajes del SCM."
        actions={(
          <Chip icon={<ScaleOutlinedIcon />} color="info" variant="outlined" label="Lectura de Control" />
        )}
      />

      <Alert severity="info" sx={{ mt: 2, minWidth: 0, overflowWrap: 'anywhere' }}>
        <Typography component="span" sx={{ fontWeight: 800 }}>Alcance del piloto: </Typography>
        pesajes efectivos y anulados agrupados por OF y color. Los pesajes no equivalen a toda la producción fabricada. No se muestra una meta diaria en esta lectura.
      </Alert>

      {statusLoading && (
        <Paper variant="outlined" sx={{ p: 2, mt: 2 }} role="status" aria-label="Verificando disponibilidad">
          <Stack direction="row" spacing={1.25} alignItems="center"><CircularProgress size={20} /><Typography variant="body2">Verificando disponibilidad del asistente...</Typography></Stack>
        </Paper>
      )}

      {!statusLoading && statusError && (
        <Alert
          severity="error"
          sx={{ mt: 2 }}
          action={<Button color="inherit" onClick={() => setStatusRefreshKey((value) => value + 1)}>Reintentar</Button>}
        >
          {statusError}
        </Alert>
      )}

      {!statusLoading && !statusError && !ready && (
        <Alert severity={status?.auth_state === 'AUTH_PENDING' ? 'warning' : 'info'} sx={{ mt: 2 }}>
          {disabledReason}
        </Alert>
      )}

      {!statusLoading && !statusError && ready && status?.provider_state === 'AUTH_PENDING' && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {status.message || 'El proveedor OpenClaw todavía está pendiente de autenticación.'}
          {' '}La consulta determinística disponible sigue siendo de solo lectura.
        </Alert>
      )}

      {!statusLoading && !statusError && ready && status?.provider_state === 'PROVIDER_NOT_LINKED' && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Acceso al asistente habilitado por tu rol. El proveedor narrativo no está vinculado a esta identidad;
          {' '}el resumen determinístico sigue disponible en modo de solo lectura.
        </Alert>
      )}

      {!statusLoading && !statusError && ready && status?.provider_state === 'CONFIGURED_NOT_VERIFIED' && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {status.message ? `${status.message} ` : ''}
          El proveedor narrativo no está verificado; se conserva la consulta determinística y la tabla autoritativa.
        </Alert>
      )}

      <Paper component="form" variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, mt: 2, minWidth: 0 }} onSubmit={(event) => { event.preventDefault(); void submit(false); }}>
        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
          <TextField
            fullWidth
            label="Pregunta"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={!ready || queryLoading}
            inputProps={{ maxLength: 240 }}
            helperText="Este piloto solo consulta el resumen diario de producción."
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ sm: 'flex-start' }} sx={{ minWidth: 0 }}>
            <TextField
              label="Fecha Lima"
              type="date"
              value={dateLima}
              onChange={(event) => setDateLima(event.target.value)}
              disabled={!ready || queryLoading}
              InputLabelProps={{ shrink: true }}
              sx={{ width: { xs: '100%', sm: 190 } }}
            />
            <Button
              onClick={() => { setQuery(PRESET_QUERY); setDateLima(yesterdayInLima()); }}
              disabled={!ready || queryLoading}
              variant="outlined"
              sx={{ minHeight: 40 }}
            >
              Usar fecha de ayer
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: 0 }}>
              <Button
                type="submit"
                variant="contained"
                disabled={!ready || queryLoading || !query.trim() || !dateLima}
                startIcon={queryLoading && !refreshing ? <CircularProgress size={16} color="inherit" /> : undefined}
                sx={{ minHeight: 40 }}
              >
                Consultar avance
              </Button>
              <Button
                type="button"
                variant="outlined"
                disabled={!ready || queryLoading || !query.trim() || !dateLima}
                onClick={() => void submit(true)}
                startIcon={queryLoading && refreshing ? <CircularProgress size={16} color="inherit" /> : <RefreshOutlinedIcon />}
                sx={{ minHeight: 40 }}
              >
                Actualizar lectura
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Paper>

      {queryError && (
        <Alert
          severity="error"
          sx={{ mt: 2 }}
          action={<Button color="inherit" onClick={() => void submit(false)}>Reintentar</Button>}
        >
          {queryError}
        </Alert>
      )}

      {queryLoading && !result && (
        <Paper variant="outlined" sx={{ mt: 2, p: 2 }} role="status" aria-label="Consultando avance">
          <Stack direction="row" spacing={1.25} alignItems="center"><CircularProgress size={20} /><Typography variant="body2">Consultando avance autoritativo...</Typography></Stack>
        </Paper>
      )}

      {result && (
        <Box sx={{ mt: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1, minWidth: 0 }}>
            <Box>
              <Typography component="h2" variant="h6" sx={{ fontWeight: 850 }}>Resultado para {result.date_lima || dateLima}</Typography>
              <Typography variant="caption" color="text.secondary">Zona horaria: {result.timezone || 'America/Lima'}</Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              {result.provider?.mode && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Proveedor: ${result.provider.mode}${result.provider.status ? ` · ${providerStatusLabel(result.provider.status)}` : ''}`}
                />
              )}
              {result.cache && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={result.cache.hit ? 'Lectura reutilizada' : 'Lectura actualizada'}
                />
              )}
            </Stack>
          </Stack>
          <ResultTable result={result} />
          <Totals totals={result.totals} />
          <ProviderNarration provider={result.provider} />
          {result.excluded?.count > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Se excluyeron {displayCount(result.excluded.count)} registros del resumen.
              {Array.isArray(result.excluded.reasons) && result.excluded.reasons.length > 0
                ? ` Motivos: ${result.excluded.reasons.join('; ')}.` : ''}
            </Alert>
          )}
          <Box component="details" sx={{ mt: 2, minWidth: 0 }}>
            <Box component="summary" sx={{ cursor: 'pointer', color: 'primary.main', fontSize: 13 }}>
              Ver trazabilidad y limitaciones
            </Box>
            <Paper variant="outlined" sx={{ p: 1.5, mt: 1 }}>
              <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary"><AccessTimeOutlinedIcon sx={{ fontSize: 15, verticalAlign: 'middle', mr: 0.5 }} />Corte de lectura: {formatUtc(result.as_of_utc)}</Typography>
                {result.trace_id && <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>Trace ID: {result.trace_id}</Typography>}
                {result.cache?.ttl_seconds !== undefined && <Typography variant="caption" color="text.secondary">Retención de lectura: {result.cache.ttl_seconds} s</Typography>}
                {Array.isArray(result.limitations) && result.limitations.length > 0 && (
                  <>
                    <Divider sx={{ my: 0.5 }} />
                    <Typography variant="caption" sx={{ fontWeight: 800 }}>Limitaciones conocidas</Typography>
                    {result.limitations.map((limitation, index) => <Typography variant="caption" color="text.secondary" key={`${limitation}-${index}`} sx={{ overflowWrap: 'anywhere' }}>• {limitation}</Typography>)}
                  </>
                )}
              </Stack>
            </Paper>
          </Box>
        </Box>
      )}

    </Box>
  );
}
