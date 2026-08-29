import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, FormControl, InputLabel, MenuItem,
  Paper, Select, Stack, TextField, Typography,
} from '@mui/material';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import PageHeader from './ui/PageHeader';
import { listarTrabajosImpresionControlScm } from '../services/scmPrintJobsControlApi';
import { buildScmPrelabelPreviewUrl } from '../utils/scmPrintPreview';

const statusText = {
  PENDING: 'Pendiente', PARTIAL: 'Parcial', PRINTED: 'Impreso', FAILED: 'Con incidencia',
};
const statusColor = {
  PENDING: 'warning', PARTIAL: 'info', PRINTED: 'success', FAILED: 'error',
};
const typeText = {
  PREPESAJE: 'Preetiqueta con QR',
  CONTROL_PESO: 'Control de peso sin QR',
  POSTPESAJE: 'Peso final sin QR',
};
const displayDate = (value) => (value
  ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : 'Sin fecha');
const jobTypes = (job) => [...new Set((job.labels || []).map(
  (label) => typeText[label.tipo] || label.tipo,
))];
const mangaCodes = (job) => [...new Set((job.labels || [])
  .map((label) => label.manga_codigo).filter(Boolean))];

function JobCard({ job }) {
  const canOpen = job.status !== 'PRINTED' && (job.labels || []).length > 0;
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
          <Box>
            <Typography component="h2" variant="subtitle1" fontWeight={850}>
              {mangaCodes(job).join(', ') || 'Manga no informada'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {jobTypes(job).join(' + ') || 'Tipo no informado'} ? {job.labels?.length || 0} etiqueta(s)
            </Typography>
          </Box>
          <Chip
            size="small"
            color={statusColor[job.status] || 'default'}
            label={statusText[job.status] || job.status}
          />
        </Stack>
        <Typography variant="body2">
          Generado {displayDate(job.created_at)}
          {job.station_id ? ' ? Reservado por estación' : ' ? Sin estación asignada'}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
          Trabajo {job.print_job_id}
        </Typography>
        {canOpen && (
          <Button
            size="small"
            variant="outlined"
            endIcon={<OpenInNewOutlinedIcon />}
            onClick={() => window.open(
              buildScmPrelabelPreviewUrl(job.print_job_id),
              '_blank',
              'noopener,noreferrer',
            )}
          >
            Abrir vista previa en estación
          </Button>
        )}
      </Stack>
    </Paper>
  );
}

export default function PrintJobsControlScm() {
  const [filters, setFilters] = useState({ status: 'PENDING', tipo: 'ALL', q: '' });
  const [items, setItems] = useState([]);
  const [asOf, setAsOf] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (signal) => {
    setBusy(true);
    setError('');
    try {
      const response = await listarTrabajosImpresionControlScm({ ...filters, signal });
      setItems(response.items || []);
      setAsOf(response.as_of || '');
    } catch (requestError) {
      if (requestError.name !== 'CanceledError') {
        setError(requestError.response?.data?.error?.message
          || 'No se pudo consultar la cola central de impresión.');
      }
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }, [filters]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const totals = useMemo(() => ({
    jobs: items.length,
    labels: items.reduce((sum, item) => sum + (item.labels?.length || 0), 0),
    unassigned: items.filter((item) => !item.station_id).length,
  }), [items]);

  return (
    <Stack spacing={2.25}>
      <PageHeader
        title="Impresión y etiquetas"
        description="Supervisa la bandeja de salida de la central. La vista previa y la impresión física se realizan en el módulo de pesaje."
        actions={(
          <Button
            variant="outlined"
            startIcon={<RefreshOutlinedIcon />}
            disabled={busy}
            onClick={() => load()}
          >
            Actualizar
          </Button>
        )}
      />
      <Alert severity="info">
        Vista de solo lectura. Abrir un trabajo no lo imprime; preetiquetas y comprobantes de peso se revisan y confirman físicamente en la estación.
      </Alert>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.25}>
          <TextField
            size="small"
            label="Buscar manga o etiqueta"
            value={filters.q}
            onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
            sx={{ flex: 1 }}
          />
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel>Estado</InputLabel>
            <Select
              label="Estado"
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            >
              <MenuItem value="PENDING">Pendientes</MenuItem>
              <MenuItem value="PARTIAL">Parciales</MenuItem>
              <MenuItem value="FAILED">Con incidencia</MenuItem>
              <MenuItem value="PRINTED">Impresos</MenuItem>
              <MenuItem value="ALL">Todos</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel>Tipo</InputLabel>
            <Select
              label="Tipo"
              value={filters.tipo}
              onChange={(event) => setFilters((current) => ({ ...current, tipo: event.target.value }))}
            >
              <MenuItem value="ALL">Todos</MenuItem>
              <MenuItem value="PREPESAJE">Prepesaje</MenuItem>
              <MenuItem value="CONTROL_PESO">Control de peso</MenuItem>
              <MenuItem value="POSTPESAJE">Postpesaje</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" aria-live="polite">
        <Chip variant="outlined" label={'Trabajos ' + totals.jobs} />
        <Chip variant="outlined" label={'Etiquetas ' + totals.labels} />
        <Chip variant="outlined" color="warning" label={'Sin estación ' + totals.unassigned} />
        {asOf && <Chip variant="outlined" label={'Actualizado ' + displayDate(asOf)} />}
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {busy && <Box sx={{ py: 4, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>}
      {!busy && !error && !items.length && (
        <Alert severity="success">No hay trabajos que coincidan con los filtros actuales.</Alert>
      )}
      {!busy && items.length > 0 && (
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 330px), 1fr))',
          gap: 1.25,
        }}
        >
          {items.map((job) => <JobCard key={job.print_job_id} job={job} />)}
        </Box>
      )}
    </Stack>
  );
}

