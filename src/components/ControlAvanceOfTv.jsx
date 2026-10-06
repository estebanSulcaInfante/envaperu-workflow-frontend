import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  IconButton, LinearProgress, Stack, TextField, Tooltip, Typography, Grid, MenuItem,
} from '@mui/material';
import FullscreenOutlinedIcon from '@mui/icons-material/FullscreenOutlined';
import FullscreenExitOutlinedIcon from '@mui/icons-material/FullscreenExitOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import { listarAvanceOfTvScm } from '../services/scmProductionObservabilityApi';
import { useScmActor } from '../context/ScmActorContext';

const REFRESH_MS = 60_000;
const PAGE_MS = 12_000;
const TV_PAGE_SIZE = 2;
const ACTIVE = new Set(['LIBERADA', 'PROGRAMADA', 'EN_EJECUCION', 'ABIERTA', 'EN_COBERTURA']);
const statusLabels = {
  EN_AVANCE: 'En avance', COMPLETADA: 'Completa', SOBREPRODUCCION: 'Sobreproducción', SOBRE_REFERENCIA: 'Sobre referencia estándar',
  SIN_META: 'Sin meta compatible', SIN_PESAJES: 'Sin pesajes vigentes',
  SIN_PERMISO_PESAJE: 'Pesajes no visibles', INCOMPLETO: 'Evidencia incompleta',
};

const number = (value, fraction = 0) => value == null
  ? '—'
  : new Intl.NumberFormat('es-PE', { maximumFractionDigits: fraction }).format(value);

function metricLabel(output) {
  if (output.unidad === 'KG') return output.tipo_meta === 'ESTANDAR' ? 'Meta estándar (kg)' : output.tipo_meta === 'NETA' ? 'Meta neta (kg)' : 'Meta (kg)';
  if (output.unidad === 'UN') return 'Meta (un)';
  return 'Meta no definida';
}

function AvanceCard({ of, output, compact = false, showOfHeading = true }) {
  const color = output.color_hex && /^#[\da-f]{6}$/i.test(output.color_hex) ? output.color_hex : '#94A3B8';
  const percent = output.porcentaje == null ? 0 : Math.max(0, Math.min(output.porcentaje, 100));
  const goodState = ['EN_AVANCE', 'COMPLETADA'].includes(output.estado_avance);
  return (
    <Card
      variant="outlined"
      data-testid="of-progress-card"
      sx={{ height: '100%', borderColor: ['SOBREPRODUCCION', 'SOBRE_REFERENCIA'].includes(output.estado_avance) ? 'warning.main' : 'divider', boxShadow: compact ? 3 : 0 }}
    >
      <CardContent sx={{ p: compact ? { xs: 2, sm: 3 } : 2, '&:last-child': { pb: compact ? { xs: 2, sm: 3 } : 2 } }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {output.imagen_url && <Box component="img" src={output.imagen_url} alt="" sx={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 1 }} />}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            {showOfHeading && <Typography variant={compact ? 'h3' : 'h6'} fontWeight={850} noWrap sx={compact ? { fontSize: { xs: 32, md: 42 } } : undefined}>{of.of}</Typography>}
            <Typography variant={compact ? 'h5' : 'body2'} fontWeight={750} color="text.secondary" sx={compact ? { fontSize: { xs: 18, md: 24 }, overflowWrap: 'anywhere' } : { overflowWrap: 'anywhere' }}>{output.sku}</Typography>
            <Typography variant={compact ? 'h3' : 'h6'} fontWeight={700} sx={compact ? { fontSize: { xs: 30, md: 40 }, lineHeight: 1.12, overflowWrap: 'anywhere' } : { overflowWrap: 'anywhere' }}>{output.nombre}</Typography>
          </Box>
          <Box aria-label={`Color ${output.color || 'sin especificar'}`} sx={{ width: compact ? 30 : 20, height: compact ? 30 : 20, flex: '0 0 auto', borderRadius: '50%', bgcolor: color, border: '1px solid rgba(0,0,0,.25)' }} />
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.25, flexWrap: 'wrap' }}>
          <Chip size={compact ? 'medium' : 'small'} label={output.color || 'Color sin nombre'} sx={compact ? { fontSize: 18, height: 36 } : undefined} />
          <Typography variant={compact ? 'h6' : 'body2'} color="text.secondary" sx={compact ? { fontSize: 22 } : undefined}>Objetivo de color {output.corrida}</Typography>
          <Chip size={compact ? 'medium' : 'small'} color={['SOBREPRODUCCION', 'SOBRE_REFERENCIA'].includes(output.estado_avance) ? 'warning' : goodState ? 'success' : 'default'} label={statusLabels[output.estado_avance] || output.estado_avance} sx={compact ? { fontSize: 18, height: 36 } : undefined} />
        </Stack>
        <Stack direction="row" spacing={compact ? 3 : 2} sx={{ mt: compact ? 2.5 : 2, flexWrap: 'wrap' }}>
          <Box><Typography variant={compact ? 'h6' : 'caption'} color="text.secondary" sx={compact ? { fontSize: 20 } : undefined}>{metricLabel(output)}</Typography><Typography variant={compact ? 'h2' : 'h6'} fontWeight={800} sx={compact ? { fontSize: { xs: 42, md: 56 } } : undefined}>{number(output.meta, output.unidad === 'KG' ? 1 : 0)} {output.unidad || ''}</Typography></Box>
          <Box><Typography variant={compact ? 'h6' : 'caption'} color="text.secondary" sx={compact ? { fontSize: 20 } : undefined}>Avance confirmado</Typography><Typography variant={compact ? 'h2' : 'h6'} fontWeight={800} sx={compact ? { fontSize: { xs: 42, md: 56 } } : undefined}>{number(output.avance, output.unidad === 'KG' ? 1 : 0)} {output.unidad || ''}</Typography></Box>
          <Box><Typography variant={compact ? 'h6' : 'caption'} color="text.secondary" sx={compact ? { fontSize: 20 } : undefined}>Pendiente</Typography><Typography variant={compact ? 'h2' : 'h6'} fontWeight={800} sx={compact ? { fontSize: { xs: 42, md: 56 } } : undefined}>{number(output.pendiente, output.unidad === 'KG' ? 1 : 0)} {output.unidad || ''}</Typography></Box>
          <Box><Typography variant={compact ? 'h6' : 'caption'} color="text.secondary" sx={compact ? { fontSize: 20 } : undefined}>Cumplimiento</Typography><Typography variant={compact ? 'h2' : 'h6'} fontWeight={800} sx={compact ? { fontSize: { xs: 42, md: 56 } } : undefined}>{output.porcentaje == null ? '—' : `${number(output.porcentaje, 1)}%`}</Typography></Box>
          {output.unidad !== 'KG' && output.peso_fisico_kg != null && <Box><Typography variant="caption" color="text.secondary">Peso físico neto</Typography><Typography variant="body1" fontWeight={700}>{number(output.peso_fisico_kg, 1)} kg</Typography></Box>}
        </Stack>
        {output.meta != null && output.porcentaje != null && <LinearProgress variant="determinate" value={percent} sx={{ mt: compact ? 2 : 1.5, height: 10, borderRadius: 8 }} aria-label={`Avance ${number(output.porcentaje, 1)} por ciento`} />}
      </CardContent>
    </Card>
  );
}

export default function ControlAvanceOfTv() {
  const { actorId } = useScmActor();
  const [payload, setPayload] = useState(null);
  const [payloadActorId, setPayloadActorId] = useState(null);
  const [lastSuccess, setLastSuccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [orderDirection, setOrderDirection] = useState('asc');
  const [tvMode, setTvMode] = useState(false);
  const [fullscreenWarning, setFullscreenWarning] = useState('');
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const rootRef = useRef(null);
  const requestSeq = useRef(0);

  const refresh = useCallback(async (signal) => {
    const requestId = ++requestSeq.current;
    try {
      const result = await listarAvanceOfTvScm({ signal });
      if (signal?.aborted || requestId !== requestSeq.current) return;
      setPayload(result);
      setPayloadActorId(actorId);
      setLastSuccess(result.as_of || 'unknown');
      setError('');
    } catch (requestError) {
      if (signal?.aborted || requestId !== requestSeq.current || requestError?.name === 'CanceledError' || requestError?.name === 'AbortError') return;
      setError('No se pudo actualizar. Los datos visibles pertenecen a la última consulta exitosa.');
    } finally {
      if (!signal?.aborted && requestId === requestSeq.current) setLoading(false);
    }
  }, [actorId]);

  useEffect(() => {
    requestSeq.current += 1;
    setPayload(null);
    setPayloadActorId(null);
    setLastSuccess(null);
    setError('');
    setLoading(true);
    const controller = new AbortController();
    refresh(controller.signal);
    const timer = window.setInterval(() => refresh(controller.signal), REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(controller.signal); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const activePayload = payloadActorId === actorId ? payload : null;
  const flatRows = useMemo(() => (activePayload?.items || [])
    .filter((of) => ACTIVE.has(String(of.estado || '').toUpperCase()))
    .flatMap((of) => (of.salidas || []).map((output) => ({ of, output })))
    .sort((left, right) => {
      const order = left.of.of.localeCompare(right.of.of, 'es', { numeric: true });
      const inner = `${left.output.corrida}-${left.output.sku}`.localeCompare(`${right.output.corrida}-${right.output.sku}`, 'es', { numeric: true });
      return (order || inner) * (orderDirection === 'asc' ? 1 : -1);
    })
    .filter(({ of, output }) => `${of.of} ${output.sku} ${output.nombre} ${output.color} ${output.corrida}`.toLowerCase().includes(search.toLowerCase())), [activePayload, search, orderDirection]);

  const pageCount = Math.max(1, Math.ceil(flatRows.length / TV_PAGE_SIZE));
  const visibleSlide = slide % pageCount;
  const tvRows = flatRows.slice(visibleSlide * TV_PAGE_SIZE, (visibleSlide + 1) * TV_PAGE_SIZE);
  const tvGroups = tvRows.reduce((groups, row) => {
    const id = row.of.of_id;
    if (!groups.has(id)) groups.set(id, { of: row.of, outputs: [] });
    groups.get(id).outputs.push(row.output);
    return groups;
  }, new Map());
  const orderedGroups = flatRows.reduce((groups, row) => {
    const id = row.of.of_id;
    if (!groups.has(id)) groups.set(id, { of: row.of, outputs: [] });
    groups.get(id).outputs.push(row.output);
    return groups;
  }, new Map());

  useEffect(() => {
    if (!tvMode || pageCount < 2) return undefined;
    const timer = window.setInterval(() => { if (!paused) setSlide((current) => (current + 1) % pageCount); }, PAGE_MS);
    return () => window.clearInterval(timer);
  }, [tvMode, pageCount, paused]);

  const setFullscreen = async () => {
    if (tvMode) {
      try { await document.exitFullscreen?.(); } catch { /* keep the TV view dismissible */ }
      setTvMode(false);
      setFullscreenWarning('');
      return;
    }
    setTvMode(true);
    try {
      if (!rootRef.current?.requestFullscreen) setFullscreenWarning('Pantalla completa no está disponible; el modo TV sigue activo.');
      else { await rootRef.current.requestFullscreen(); setFullscreenWarning(''); }
    } catch {
      setFullscreenWarning('No se pudo activar pantalla completa; el modo TV sigue activo.');
    }
  };

  useEffect(() => {
    const handler = () => { if (!document.fullscreenElement) setTvMode(false); };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const lastSuccessLabel = lastSuccess === 'unknown'
    ? 'Hora fuente no disponible'
    : lastSuccess
      ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(lastSuccess))
      : 'Sin consulta exitosa';

  return (
    <Box ref={rootRef} data-testid="control-avance-of-tv" sx={{ maxWidth: tvMode ? 'none' : 1500, mx: 'auto', p: tvMode ? { xs: 2, md: 4 } : 0, bgcolor: 'background.default', minHeight: tvMode ? '100vh' : undefined, '&:fullscreen': { overflow: 'auto', bgcolor: 'background.default' } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} sx={{ mb: 2 }}>
      <Box><Typography component="h1" variant={tvMode ? 'h3' : 'h4'} fontWeight={850}>Avance OF · TV</Typography><Typography color="text.secondary">Pesajes vigentes por OF, objetivo de color y pieza-color.</Typography></Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" color="text.secondary">Última consulta exitosa: {lastSuccessLabel}</Typography>
          <Tooltip title="Actualizar ahora"><IconButton aria-label="Actualizar ahora" onClick={() => refresh()}><RefreshOutlinedIcon /></IconButton></Tooltip>
          <Button variant="contained" startIcon={tvMode ? <FullscreenExitOutlinedIcon /> : <FullscreenOutlinedIcon />} onClick={setFullscreen}>{tvMode ? 'Salir de TV' : 'Modo TV'}</Button>
        </Stack>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!tvMode && <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
        <TextField fullWidth size="small" label="Filtrar OF, pieza-color o objetivo de color" value={search} onChange={(event) => { setSearch(event.target.value); setSlide(0); }} />
        <TextField select size="small" label="Orden de OF" value={orderDirection} onChange={(event) => { setOrderDirection(event.target.value); setSlide(0); }} sx={{ minWidth: 180 }}>
          <MenuItem value="asc">Ascendente</MenuItem><MenuItem value="desc">Descendente</MenuItem>
        </TextField>
        <Chip label="Solo OF activas" color="primary" variant="outlined" />
      </Stack>}
      {fullscreenWarning && <Alert severity="warning" sx={{ mb: 2 }}>{fullscreenWarning}</Alert>}
      {loading && !payload && <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress /><Typography sx={{ mt: 1 }}>Consultando avance…</Typography></Stack>}
      {!loading && !flatRows.length && <Alert severity="info">No hay salidas de OF activas para mostrar.</Alert>}
      {tvMode && tvRows.length > 0 && <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Typography variant="h6" color="text.secondary" aria-live="polite">Página {visibleSlide + 1} de {pageCount} · muestra {tvRows.length} pieza-color por página</Typography>
          <Stack direction="row" spacing={1}>
            <Button onClick={() => setSlide((current) => (current - 1 + pageCount) % pageCount)}>Anterior</Button>
            <Button onClick={() => setPaused((value) => !value)}>{paused ? 'Reanudar rotación' : 'Pausar rotación'}</Button>
            <Button onClick={() => setSlide((current) => (current + 1) % pageCount)}>Siguiente</Button>
          </Stack>
        </Stack>
        <Stack spacing={2}>{[...tvGroups.values()].map(({ of, outputs }) => <Box component="section" aria-label={`Orden ${of.of}`} key={of.of_id}>
          <Typography variant="h3" fontWeight={900} sx={{ mb: 1.25, fontSize: { xs: 34, md: 46 } }}>{of.of}</Typography>
          <Grid container spacing={2}>{outputs.map((output) => <Grid size={{ xs: 12, lg: 6 }} key={`${of.of_id}-${output.corrida_id}-${output.sku}`}><AvanceCard of={of} output={output} compact showOfHeading={false} /></Grid>)}</Grid>
        </Box>)}</Stack>
      </Stack>}
      {!tvMode && flatRows.length > 0 && <Stack spacing={2.5}>{[...orderedGroups.values()].map(({ of, outputs }) => {
        return <Box key={of.of_id} component="section" aria-label={`Orden ${of.of}`}>
          <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1 }}><Typography variant="h5" fontWeight={850}>{of.of}</Typography><Chip size="small" label={of.estado} /></Stack>
          <Grid container spacing={1.5}>{outputs.map((output) => <Grid size={{ xs: 12, md: 6, xl: 4 }} key={`${of.of_id}-${output.corrida_id}-${output.sku}`}><AvanceCard of={of} output={output} showOfHeading={false} /></Grid>)}</Grid>
        </Box>;
      })}</Stack>}
      {activePayload?.visibilidad?.pesaje === false && <Alert severity="warning" sx={{ mt: 2 }}>Tu permiso permite ver OF, pero no los datos de pesaje.</Alert>}
    </Box>
  );
}
