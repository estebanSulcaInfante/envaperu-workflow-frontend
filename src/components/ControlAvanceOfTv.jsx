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
const TV_PART_SIZE = 4;
const ACTIVE = new Set(['LIBERADA', 'PROGRAMADA', 'EN_EJECUCION', 'ABIERTA', 'EN_COBERTURA']);
const statusLabels = {
  EN_AVANCE: 'En avance',
  COMPLETADA: 'Completa',
  SOBREPRODUCCION: 'Sobreproducción',
  SOBRE_REFERENCIA: 'Sobre referencia estándar',
  SIN_META: 'Sin meta compatible',
  SIN_PESAJES: 'Sin pesajes vigentes',
  SIN_PERMISO_PESAJE: 'Pesajes no visibles',
  INCOMPLETO: 'Evidencia incompleta',
};

const number = (value, fraction = 0) => value == null
  ? '-'
  : new Intl.NumberFormat('es-PE', { maximumFractionDigits: fraction }).format(value);

function metricLabel(output) {
  if (output.unidad === 'KG') {
    if (output.tipo_meta === 'ESTANDAR') return 'Meta estándar (kg)';
    if (output.tipo_meta === 'NETA') return 'Meta neta (kg)';
    return 'Meta (kg)';
  }
  if (output.unidad === 'UN') return 'Meta (un)';
  return 'Meta no definida';
}

function outputIdentity(output) {
  return `${output.corrida_id ?? 'sin-objetivo'}-${output.pieza_color_id ?? output.sku ?? 'sin-color'}`;
}

function groupByPiece(rows) {
  const groups = new Map();
  rows.forEach(({ output }, index) => {
    const key = output.pieza_id != null
      ? `pieza:${output.pieza_id}`
      : `sin-pieza:${output.corrida_id ?? index}:${output.pieza_color_id ?? output.sku ?? index}`;
    if (!groups.has(key)) {
      groups.set(key, {
        pieceId: output.pieza_id ?? null,
        name: output.pieza || 'Pieza sin identificar',
        outputs: [],
      });
    }
    groups.get(key).outputs.push(output);
  });
  return [...groups.values()];
}

function OutputRow({ output, compact = false }) {
  const swatch = output.color_hex && /^#[\da-f]{6}$/i.test(output.color_hex) ? output.color_hex : '#94A3B8';
  const statusTone = ['SOBREPRODUCCION', 'SOBRE_REFERENCIA'].includes(output.estado_avance)
    ? 'warning'
    : ['EN_AVANCE', 'COMPLETADA'].includes(output.estado_avance) ? 'success' : 'default';
  const barValue = output.porcentaje == null ? 0 : Math.max(0, Math.min(output.porcentaje, 100));
  return (
    <Box
      component="article"
      data-testid="output-progress-row"
      data-output-key={outputIdentity(output)}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.5,
        p: compact ? { xs: 1, md: 1.25 } : 1.5,
        minWidth: 0,
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={compact ? 1 : 1.5} alignItems={{ sm: 'center' }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 0.25, sm: 1 }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          sx={{ minWidth: compact ? { sm: 230, md: 290 } : { sm: 250 }, flex: '0 0 auto' }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Box
              aria-label={`Color ${output.color || 'sin especificar'}`}
              sx={{ width: compact ? { xs: 20, md: 24 } : 22, height: compact ? { xs: 20, md: 24 } : 22, flex: '0 0 auto', borderRadius: '50%', bgcolor: swatch, border: '2px solid', borderColor: 'text.secondary' }}
            />
            <Typography fontWeight={750} sx={{ overflowWrap: 'anywhere', fontSize: compact ? { xs: 18, md: 24 } : undefined }}>
              {output.color || 'Color sin nombre'}
            </Typography>
          </Stack>
          <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere', fontSize: compact ? { xs: 14, md: 16 } : undefined }}>
            Objetivo de color {output.corrida}
          </Typography>
        </Stack>
        <Chip
          size={compact ? 'small' : 'small'}
          color={statusTone}
          label={statusLabels[output.estado_avance] || output.estado_avance}
          sx={{ flex: '0 0 auto', fontSize: compact ? { xs: 13, md: 15 } : undefined }}
        />
        <Grid container spacing={compact ? 1 : 2} sx={{ flex: 1, minWidth: 0 }}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: compact ? { xs: 12, md: 16 } : undefined }}>{metricLabel(output)}</Typography>
            <Typography fontWeight={800} sx={{ fontSize: compact ? { xs: 20, md: 34 } : undefined }}>
              {number(output.meta, output.unidad === 'KG' ? 1 : 0)} {output.unidad || ''}
            </Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: compact ? { xs: 12, md: 16 } : undefined }}>Avance confirmado</Typography>
            <Typography fontWeight={800} sx={{ fontSize: compact ? { xs: 20, md: 34 } : undefined }}>
              {number(output.avance, output.unidad === 'KG' ? 1 : 0)} {output.unidad || ''}
            </Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: compact ? { xs: 12, md: 16 } : undefined }}>Pendiente</Typography>
            <Typography fontWeight={800} sx={{ fontSize: compact ? { xs: 20, md: 34 } : undefined }}>
              {number(output.pendiente, output.unidad === 'KG' ? 1 : 0)} {output.unidad || ''}
            </Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: compact ? { xs: 12, md: 16 } : undefined }}>Cumplimiento</Typography>
            <Typography fontWeight={800} sx={{ fontSize: compact ? { xs: 20, md: 34 } : undefined }}>
              {output.porcentaje == null ? '-' : `${number(output.porcentaje, 1)}%`}
            </Typography>
          </Grid>
        </Grid>
        {output.unidad !== 'KG' && output.peso_fisico_kg != null && (
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 95 }}>
            Peso físico neto: <strong>{number(output.peso_fisico_kg, 1)} kg</strong>
          </Typography>
        )}
      </Stack>
      {output.meta != null && output.porcentaje != null && (
        <LinearProgress
          variant="determinate"
          value={barValue}
          aria-label={`Avance ${number(output.porcentaje, 1)} por ciento`}
          sx={{
            mt: compact ? 0.75 : 1.25,
            height: compact ? 7 : 9,
            borderRadius: 8,
            border: '1px solid',
            borderColor: 'text.secondary',
            bgcolor: 'action.disabledBackground',
            '& .MuiLinearProgress-bar': { bgcolor: swatch },
          }}
        />
      )}
    </Box>
  );
}

function PieceGroups({ rows, compact = false }) {
  return (
    <Stack spacing={compact ? 1 : 1.5}>
      {groupByPiece(rows).map((group, index) => (
        <Box
          key={group.pieceId == null ? `missing-${index}` : String(group.pieceId)}
          component="section"
          data-testid="piece-progress-group"
          data-piece-id={group.pieceId ?? undefined}
          sx={{ minWidth: 0 }}
        >
          <Typography
            variant={compact ? 'h6' : 'subtitle1'}
            fontWeight={850}
            sx={{ mb: compact ? 0.5 : 0.75, fontSize: compact ? { xs: 20, md: 28 } : undefined, overflowWrap: 'anywhere' }}
          >
            {group.name}
          </Typography>
          <Stack spacing={compact ? 0.75 : 1}>{group.outputs.map((output) => (
            <OutputRow key={outputIdentity(output)} output={output} compact={compact} />
          ))}</Stack>
        </Box>
      ))}
    </Stack>
  );
}

function chunkRows(rows, size) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size));
  return chunks;
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
    setSlide(0);
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
    .flatMap((of) => (of.salidas || []).map((output, index) => ({ of, output, index })))
    .filter(({ of, output }) => `${of.of} ${output.pieza || ''} ${output.color || ''} ${output.corrida || ''} ${output.sku || ''}`.toLowerCase().includes(search.toLowerCase()))
    .sort((left, right) => {
      const order = left.of.of.localeCompare(right.of.of, 'es', { numeric: true });
      const inner = `${left.output.pieza_id ?? ''}-${left.output.corrida ?? ''}-${left.output.pieza_color_id ?? ''}`
        .localeCompare(`${right.output.pieza_id ?? ''}-${right.output.corrida ?? ''}-${right.output.pieza_color_id ?? ''}`, 'es', { numeric: true });
      return (order || inner) * (orderDirection === 'asc' ? 1 : -1);
    }), [activePayload, search, orderDirection]);

  const orderedGroups = flatRows.reduce((groups, row) => {
    const id = row.of.of_id;
    if (!groups.has(id)) groups.set(id, { of: row.of, outputs: [] });
    groups.get(id).outputs.push(row);
    return groups;
  }, new Map());

  const tvParts = [...orderedGroups.values()].flatMap(({ of, outputs }) => {
    const chunks = chunkRows(outputs, TV_PART_SIZE);
    return chunks.map((rows, index) => ({
      of,
      rows,
      part: index + 1,
      partCount: chunks.length,
    }));
  });
  const visibleSlide = slide % Math.max(1, tvParts.length);
  const currentPart = tvParts[visibleSlide];

  useEffect(() => {
    if (!tvMode || tvParts.length < 2) return undefined;
    const timer = window.setInterval(() => {
      if (!paused) setSlide((current) => (current + 1) % tvParts.length);
    }, PAGE_MS);
    return () => window.clearInterval(timer);
  }, [tvMode, tvParts.length, paused]);

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
    <Box
      ref={rootRef}
      data-testid="control-avance-of-tv"
      sx={{ maxWidth: tvMode ? 'none' : 1500, mx: 'auto', p: tvMode ? { xs: 1.5, md: 2 } : 0, bgcolor: 'background.default', minHeight: tvMode ? '100vh' : undefined, '&:fullscreen': { overflow: 'auto', bgcolor: 'background.default' } }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} sx={{ mb: tvMode ? 1 : 2 }}>
        <Box>
          <Typography component="h1" variant={tvMode ? 'h4' : 'h4'} fontWeight={850}>Avance OF</Typography>
          {!tvMode && <Typography color="text.secondary">Pesajes vigentes por OF, objetivo de color y pieza-color.</Typography>}
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" color="text.secondary">Última consulta exitosa: {lastSuccessLabel}</Typography>
          <Tooltip title="Actualizar ahora"><IconButton aria-label="Actualizar ahora" onClick={() => refresh()}><RefreshOutlinedIcon /></IconButton></Tooltip>
          <Button variant="contained" startIcon={tvMode ? <FullscreenExitOutlinedIcon /> : <FullscreenOutlinedIcon />} onClick={setFullscreen}>{tvMode ? 'Salir de TV' : 'Modo TV'}</Button>
        </Stack>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {!tvMode && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
          <TextField fullWidth size="small" label="Filtrar OF, pieza o objetivo de color" value={search} onChange={(event) => { setSearch(event.target.value); setSlide(0); }} />
          <TextField select size="small" label="Orden de OF" value={orderDirection} onChange={(event) => { setOrderDirection(event.target.value); setSlide(0); }} sx={{ minWidth: 180 }}>
            <MenuItem value="asc">Ascendente</MenuItem><MenuItem value="desc">Descendente</MenuItem>
          </TextField>
          <Chip label="Solo OF activas" color="primary" variant="outlined" />
        </Stack>
      )}
      {fullscreenWarning && <Alert severity="warning" sx={{ mb: 1 }}>{fullscreenWarning}</Alert>}
      {loading && !payload && <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /><Typography sx={{ mt: 1 }}>Consultando avance.</Typography></Stack>}
      {!loading && !tvParts.length && <Alert severity="info">No hay salidas de OF activas para mostrar.</Alert>}
      {tvMode && currentPart && (
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
            <Typography variant="subtitle1" color="text.secondary" aria-live="polite" sx={{ fontSize: { xs: 14, md: 18 } }}>
              {currentPart.of.of} · Parte {currentPart.part} de {currentPart.partCount}{currentPart.part < currentPart.partCount ? ' · Continúa' : ''}
            </Typography>
            <Stack direction="row" spacing={0.5}>
              <Button size="small" onClick={() => setSlide((current) => (current - 1 + tvParts.length) % tvParts.length)}>Anterior</Button>
              <Button size="small" onClick={() => setPaused((value) => !value)}>{paused ? 'Reanudar' : 'Pausar'}</Button>
              <Button size="small" onClick={() => setSlide((current) => (current + 1) % tvParts.length)}>Siguiente</Button>
            </Stack>
          </Stack>
          <Card variant="outlined" data-testid="of-progress-card" data-of-id={currentPart.of.of_id} sx={{ boxShadow: 2, minHeight: 0 }}>
            <CardContent sx={{ p: { xs: 1, md: 1.5 }, '&:last-child': { pb: { xs: 1, md: 1.5 } } }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <Typography variant="h4" fontWeight={900} sx={{ fontSize: { xs: 28, md: 42 }, lineHeight: 1.1 }}>{currentPart.of.of}</Typography>
                <Chip size="small" label={currentPart.of.estado} />
              </Stack>
              <PieceGroups rows={currentPart.rows} compact />
            </CardContent>
          </Card>
        </Stack>
      )}
      {!tvMode && [...orderedGroups.values()].length > 0 && (
        <Stack spacing={2}>
          {[...orderedGroups.values()].map(({ of, outputs }) => (
            <Card key={of.of_id} variant="outlined" data-testid="of-progress-card" data-of-id={of.of_id}>
              <CardContent sx={{ p: { xs: 1.5, md: 2.5 } }}>
                <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1.5 }}>
                  <Typography variant="h5" fontWeight={900}>{of.of}</Typography>
                  <Chip size="small" label={of.estado} />
                </Stack>
                <PieceGroups rows={outputs} />
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
      {activePayload?.visibilidad?.pesaje === false && <Alert severity="warning" sx={{ mt: 2 }}>Tu permiso permite ver OF, pero no los datos de pesaje.</Alert>}
    </Box>
  );
}
