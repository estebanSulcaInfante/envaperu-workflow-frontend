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

function displayColorName(value) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  return /^transparente(?:\s+transparente)+$/i.test(name) ? 'Transparente' : (name || 'Color sin nombre');
}

function isTransparentColor(value) {
  return /^transparente(?:\s+transparente)*$/i.test(String(value || '').trim().replace(/\s+/g, ' '));
}

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

function OutputRow({ output, compact = false, showColor = true }) {
  const swatch = output.color_hex && /^#[\da-f]{6}$/i.test(output.color_hex) ? output.color_hex : '#94A3B8';
  const colorName = displayColorName(output.color);
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
        p: compact ? { xs: 0.5, md: 0.75 } : 1,
        minWidth: 0,
      }}
    >
      <Stack direction={compact ? { xs: 'column', sm: 'row' } : 'column'} spacing={compact ? 0.75 : 1} alignItems={compact ? { sm: 'flex-start' } : 'stretch'}>
          <Stack direction={compact ? { xs: 'row', sm: 'column' } : 'row'} spacing={0.5} alignItems="center" sx={{ width: compact ? { xs: '100%', sm: 125, md: 145 } : '100%', flex: compact ? { sm: '0 0 auto' } : undefined, minWidth: 0, flexWrap: 'wrap' }}>
          {showColor && <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0, flexWrap: 'wrap' }}>
            <Box
              aria-label={`Color ${colorName}`}
              sx={{ width: compact ? 18 : 22, height: compact ? 18 : 22, flex: '0 0 auto', borderRadius: '50%', bgcolor: swatch, border: '2px solid', borderColor: 'text.secondary' }}
            />
            <Typography fontWeight={750} sx={{ minWidth: 0, overflowWrap: 'anywhere', fontSize: compact ? { xs: 14, md: 18 } : 16, lineHeight: 1.1 }}>
              {colorName}
            </Typography>
          </Stack>}
          <Chip
            size="small"
            color={statusTone}
            label={statusLabels[output.estado_avance] || output.estado_avance}
            sx={{ alignSelf: 'flex-start', maxWidth: '100%', height: 'auto', minHeight: compact ? 20 : 22, fontSize: 11, '& .MuiChip-label': { px: 0.75, py: 0.2, whiteSpace: 'normal', display: 'block', overflowWrap: 'anywhere', lineHeight: 1.1 } }}
          />
          {output.unidad !== 'KG' && output.peso_fisico_kg != null && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: compact ? 9 : 10, lineHeight: 1.1 }}>
              Peso neto: <strong>{number(output.peso_fisico_kg, 1)} kg</strong>
            </Typography>
          )}
        </Stack>
        <Grid container columnSpacing={compact ? 0.5 : 1} rowSpacing={0} sx={{ flex: 1, minWidth: 0, width: compact ? undefined : '100%' }}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 11, lineHeight: 1.1, overflowWrap: 'anywhere' }}>{metricLabel(output)}</Typography>
            <Typography fontWeight={800} sx={{ fontSize: compact ? { xs: 16, md: 22 } : 19, lineHeight: 1.15, whiteSpace: 'nowrap' }}>
              {number(output.meta, output.unidad === 'KG' ? 1 : 0)} {output.unidad || ''}
            </Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 11, lineHeight: 1.1 }}>Avance</Typography>
            <Typography fontWeight={800} sx={{ fontSize: compact ? { xs: 16, md: 22 } : 19, lineHeight: 1.15, whiteSpace: 'nowrap' }}>
              {number(output.avance, output.unidad === 'KG' ? 1 : 0)} {output.unidad || ''}
            </Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 11, lineHeight: 1.1 }}>Pendiente</Typography>
            <Typography fontWeight={800} sx={{ fontSize: compact ? { xs: 16, md: 22 } : 19, lineHeight: 1.15, whiteSpace: 'nowrap' }}>
              {number(output.pendiente, output.unidad === 'KG' ? 1 : 0)} {output.unidad || ''}
            </Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 11, lineHeight: 1.1 }}>Cumplimiento</Typography>
            <Typography fontWeight={800} sx={{ fontSize: compact ? { xs: 16, md: 22 } : 19, lineHeight: 1.15, whiteSpace: 'nowrap' }}>
              {output.porcentaje == null ? '-' : `${number(output.porcentaje, 1)}%`}
            </Typography>
          </Grid>
        </Grid>
      </Stack>
      {output.meta != null && output.porcentaje != null && (
        <LinearProgress
          variant="determinate"
          value={barValue}
          aria-label={`Avance ${number(output.porcentaje, 1)} por ciento`}
          sx={{
            mt: compact ? 0.5 : 0.75,
            height: compact ? 4 : 7,
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

function PieceGroups({ rows, compact = false, showColor = true }) {
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
            sx={{ mb: compact ? 0.15 : 0.75, fontSize: compact ? { xs: 16, md: 19 } : undefined, overflowWrap: 'anywhere', lineHeight: 1.1 }}
          >
            {group.name}
          </Typography>
          <Stack spacing={compact ? 0.35 : 0.75}>{group.outputs.map((output) => (
            <OutputRow key={outputIdentity(output)} output={output} compact={compact} showColor={showColor} />
          ))}</Stack>
        </Box>
      ))}
    </Stack>
  );
}

function CanonicalGroupCard({ group, compact = false, partLabel = null }) {
  const identity = group.identity || {};
  const colorName = displayColorName(group.color);
  const transparent = isTransparentColor(colorName);
  const swatch = group.color_hex && /^#[\da-f]{6}$/i.test(group.color_hex) ? group.color_hex : '#94A3B8';
  const swatchSx = transparent
    ? { background: 'repeating-linear-gradient(45deg, #FFFFFF 0 4px, #CBD5E1 4px 8px)' }
    : { bgcolor: swatch };
  const rows = (group.salidas || []).map((output, index) => ({ of: group, output, index }));
  return (
    <Card variant="outlined" data-testid="of-progress-card" data-group-id={group.group_id} data-of-id={group.of_id} sx={{ boxShadow: compact ? 2 : undefined, minHeight: 0 }}>
      <CardContent sx={{ p: compact ? { xs: 1, md: 1.25 } : { xs: 1.5, md: 2 }, '&:last-child': { pb: compact ? { xs: 1, md: 1.25 } : { xs: 1.5, md: 2 } } }}>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: compact ? 0.5 : 1, flexWrap: 'wrap' }}>
          <Typography variant={compact ? 'h4' : 'h5'} fontWeight={900} sx={compact ? { fontSize: { xs: 25, md: 32 }, lineHeight: 1.05 } : undefined}>{group.of || 'OF sin identificar'}</Typography>
          <Chip size="small" label={group.estado || 'Estado no disponible'} sx={compact ? { height: 22, fontSize: 11 } : undefined} />
          {group.ot && <Chip size="small" variant="outlined" label={`OT ${group.ot}`} />}
          {group.corrida && <Chip size="small" variant="outlined" label={`Corrida ${group.corrida}`} />}
          {group.molde_visible === true && (group.molde?.nombre || group.molde?.codigo
            ? <Chip size="small" variant="outlined" label={`Molde ${group.molde.nombre || group.molde.codigo}`} />
            : <Chip size="small" color="warning" variant="outlined" label="Molde sin identificar" />)}
          {partLabel && <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto !important', whiteSpace: 'nowrap' }}>{partLabel}</Typography>}
        </Stack>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: compact ? 0.75 : 1 }}>
          <Box aria-label={`Color ${colorName}`} data-color-kind={transparent ? 'transparent' : 'named'} data-testid="group-color-swatch" sx={{ width: compact ? 20 : 24, height: compact ? 20 : 24, borderRadius: '50%', border: '2px solid', borderColor: 'text.secondary', flex: '0 0 auto', ...swatchSx }} />
          <Typography fontWeight={800}>{colorName}</Typography>
          {!group.color_hex && !transparent && <Typography variant="caption" color="text.secondary">(muestra neutral)</Typography>}
        </Stack>
        {identity.identity_status !== 'COMPLETA' && (
          <Alert severity="warning" sx={{ mb: 1 }}>
            Identidad incompleta: avance y porcentaje no disponibles ({(identity.identity_issues || []).join(', ') || 'evidencia insuficiente'}).
          </Alert>
        )}
        <PieceGroups rows={rows} compact={compact} showColor={false} />
      </CardContent>
    </Card>
  );
}

function chunkRows(rows, size) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size));
  return chunks;
}

function pairDistinctOrders(parts) {
  const remaining = [...parts];
  const pages = [];
  while (remaining.length) {
    const first = remaining.shift();
    const differentOrderIndex = remaining.findIndex((part) => part.of.of_id !== first.of.of_id);
    pages.push(differentOrderIndex < 0
      ? [first]
      : [first, ...remaining.splice(differentOrderIndex, 1)]);
  }
  return pages;
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
  const [wideViewport, setWideViewport] = useState(() => window.innerWidth >= 900);
  const [fullscreenWarning, setFullscreenWarning] = useState('');
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const rootRef = useRef(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    const updateViewport = () => setWideViewport(window.innerWidth >= 900);
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

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
  const canonicalGroups = useMemo(() => (activePayload?.items || [])
    .filter((group) => group.group_id)
    .filter((group) => ACTIVE.has(String(group.estado || '').toUpperCase()))
    .filter((group) => `${group.of || ''} ${group.ot || ''} ${group.corrida || ''} ${group.molde?.nombre || ''} ${group.color || ''} ${(group.salidas || []).map((output) => `${output.pieza || ''} ${output.sku || ''}`).join(' ')}`.toLowerCase().includes(search.toLowerCase()))
    .sort((left, right) => {
      const order = String(left.of || '').localeCompare(String(right.of || ''), 'es', { numeric: true });
      const inner = String(left.group_id).localeCompare(String(right.group_id), 'es', { numeric: true });
      return (order || inner) * (orderDirection === 'asc' ? 1 : -1);
    }), [activePayload, search, orderDirection]);
  const hasCanonicalGroups = canonicalGroups.length > 0 || Boolean((activePayload?.items || []).some((group) => group.group_id));
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

  const orderedGroups = hasCanonicalGroups
    ? new Map(canonicalGroups.map((group) => [group.group_id, { of: group, outputs: (group.salidas || []).map((output, index) => ({ of: group, output, index })) }]))
    : flatRows.reduce((groups, row) => {
      const id = row.of.of_id;
      if (!groups.has(id)) groups.set(id, { of: row.of, outputs: [] });
      groups.get(id).outputs.push(row);
      return groups;
    }, new Map());

  const legacyTvParts = [...orderedGroups.values()].flatMap(({ of, outputs }) => {
    const pieceIds = new Set(outputs.map(({ output }) => output.pieza_id).filter((id) => id != null));
    const hasOneStablePiece = outputs.length > 0
      && pieceIds.size === 1
      && outputs.every(({ output }) => output.pieza_id != null);
    const chunks = chunkRows(outputs, hasOneStablePiece ? 7 : TV_PART_SIZE);
    return chunks.map((rows, index) => ({
      of,
      rows,
      part: index + 1,
      partCount: chunks.length,
    }));
  });
  const tvParts = hasCanonicalGroups
    ? chunkRows([...orderedGroups.values()], wideViewport ? 2 : 1).map((groups, index, pages) => ({
      canonical: true,
      groups,
      part: index + 1,
      partCount: pages.length,
    }))
    : legacyTvParts;
  const tvSlides = useMemo(() => hasCanonicalGroups
    ? tvParts.map((part) => part.groups)
    : wideViewport ? pairDistinctOrders(tvParts) : tvParts.map((part) => [part]), [tvParts, wideViewport, hasCanonicalGroups]);
  const visibleSlide = slide % Math.max(1, tvSlides.length);
  const currentPage = tvSlides[visibleSlide] || [];

  useEffect(() => {
    if (!tvMode || tvSlides.length < 2) return undefined;
    const timer = window.setInterval(() => {
      if (!paused) setSlide((current) => (current + 1) % tvSlides.length);
    }, PAGE_MS);
    return () => window.clearInterval(timer);
  }, [tvMode, tvSlides.length, paused]);

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
      {tvMode && currentPage.length > 0 && (
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
            <Typography variant="subtitle1" color="text.secondary" aria-live="polite" sx={{ fontSize: { xs: 14, md: 18 } }}>
              Pantalla {visibleSlide + 1} de {tvSlides.length}
            </Typography>
            <Stack direction="row" spacing={0.5}>
              <Button size="small" onClick={() => setSlide((current) => (current - 1 + tvSlides.length) % tvSlides.length)}>Anterior</Button>
              <Button size="small" onClick={() => setPaused((value) => !value)}>{paused ? 'Reanudar' : 'Pausar'}</Button>
              <Button size="small" onClick={() => setSlide((current) => (current + 1) % tvSlides.length)}>Siguiente</Button>
            </Stack>
          </Stack>
          <Grid container spacing={1} data-testid="of-progress-layout" data-columns={wideViewport ? '2' : '1'}>
            {hasCanonicalGroups
              ? currentPage.map(({ of: group }) => (
                <Grid key={group.group_id} size={{ xs: 12, md: 6 }}>
                  <CanonicalGroupCard group={group} compact />
                </Grid>
              ))
              : currentPage.map((part) => (
                <Grid key={`${part.of.of_id}-${part.part}`} size={{ xs: 12, md: 6 }}>
                  <Card variant="outlined" data-testid="of-progress-card" data-of-id={part.of.of_id} sx={{ boxShadow: 2, minHeight: 0 }}>
                    <CardContent sx={{ p: { xs: 1, md: 1.25 }, '&:last-child': { pb: { xs: 1, md: 1.25 } } }}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5, flexWrap: 'wrap' }}>
                        <Typography variant="h4" fontWeight={900} sx={{ fontSize: { xs: 25, md: 32 }, lineHeight: 1.05 }}>{part.of.of}</Typography>
                        <Chip size="small" label={part.of.estado} sx={{ height: 22, fontSize: 11 }} />
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto !important', fontSize: { xs: 11, md: 12 }, whiteSpace: 'nowrap' }}>
                          Parte {part.part} de {part.partCount}{part.part < part.partCount ? ' · Continúa' : ''}
                        </Typography>
                      </Stack>
                      <PieceGroups rows={part.rows} compact />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
          </Grid>
        </Stack>
      )}
      {!tvMode && [...orderedGroups.values()].length > 0 && (
        <Grid container spacing={2} data-testid="of-progress-layout" data-columns={wideViewport ? '2' : '1'}>
          {[...orderedGroups.values()].map(({ of, outputs }) => (
            <Grid key={hasCanonicalGroups ? of.group_id : of.of_id} size={{ xs: 12, md: 6 }}>
              {hasCanonicalGroups
                ? <CanonicalGroupCard group={of} />
                : <Card variant="outlined" data-testid="of-progress-card" data-of-id={of.of_id}>
                  <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
                    <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1 }}>
                      <Typography variant="h5" fontWeight={900}>{of.of}</Typography>
                      <Chip size="small" label={of.estado} />
                    </Stack>
                    <PieceGroups rows={outputs} />
                  </CardContent>
                </Card>}
            </Grid>
          ))}
        </Grid>
      )}
      {activePayload?.visibilidad?.pesaje === false && <Alert severity="warning" sx={{ mt: 2 }}>Tu permiso permite ver OF, pero no los datos de pesaje.</Alert>}
    </Box>
  );
}
