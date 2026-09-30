import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, CircularProgress, Collapse, IconButton, LinearProgress,
  Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useScmActor } from '../context/ScmActorContext';
import { listarAvanceOfScm } from '../services/scmProductionObservabilityApi';
import { formatKg, getProgressState, progressTone } from './productionOrderProgressModel';

export default function ProductionOrderProgressScm() {
  const { actorId } = useScmActor();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  const [expanded, setExpanded] = useState({});
  const [visibility, setVisibility] = useState({});
  const [asOf, setAsOf] = useState(null);
  const [appliedQuery, setAppliedQuery] = useState(() => searchParams.get('q') || '');
  const [loadedActorId, setLoadedActorId] = useState(actorId);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const activeActorRef = useRef(actorId);
  const requestRef = useRef(0);
  useEffect(() => { activeActorRef.current = actorId; }, [actorId]);
  const load = useCallback(async () => {
    const requestedActorId = actorId;
    const requestId = ++requestRef.current;
    setState('loading'); setError('');
    try {
      setSearchParams(query ? { q: query } : {}, { replace: true });
      const payload = await listarAvanceOfScm({ q: query });
      if (requestRef.current !== requestId || activeActorRef.current !== requestedActorId) return;
      setItems(payload.items || []); setVisibility(payload.visibilidad || {}); setAsOf(payload.as_of || null); setAppliedQuery(query.trim()); setExpanded({}); setLoadedActorId(requestedActorId); setState('ready');
    } catch (cause) {
      if (requestRef.current !== requestId || activeActorRef.current !== requestedActorId) return;
      setError(cause?.response?.data?.error?.message || cause?.response?.data?.message || 'No se pudo cargar el avance de OF.'); setState('error');
    }
  }, [actorId, query, setSearchParams]);
  useEffect(() => {
    // This effect starts the external API read when the active actor changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [actorId]); // eslint-disable-line react-hooks/exhaustive-deps
  const actorReady = loadedActorId === actorId;
  const visibleItems = actorReady ? items : [];
  const visibleVisibility = actorReady ? visibility : {};
  const visibleAsOf = actorReady ? asOf : null;
  const visibleAppliedQuery = actorReady ? appliedQuery : '';
  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1500, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1} sx={{ mb: 2 }}>
        <Box><Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>Avance de OF</Typography><Typography color="text.secondary">OF → objetivo y color · evidencia de kg</Typography>{(visibleAsOf || visibleAppliedQuery) && <Typography variant="caption" color="text.secondary" display="block">Consulta aplicada: {visibleAsOf || '—'} · {visibleAppliedQuery ? `filtro «${visibleAppliedQuery}»` : 'sin filtro'}</Typography>}</Box>
        <Button startIcon={<RefreshIcon />} variant="outlined" onClick={load} disabled={state === 'loading'}>Buscar</Button>
      </Stack>
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}><TextField size="small" fullWidth label="Buscar OF, objetivo de color u OT" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') load(); }} /></Paper>
      {state === 'loading' && !visibleItems.length && <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}><CircularProgress aria-label="Cargando avance" /><Typography sx={{ mt: 1 }}>Cargando avance…</Typography></Paper>}
      {state === 'error' && <Alert severity="error" action={<Button color="inherit" onClick={load}>Reintentar</Button>} sx={{ mb: 2 }}>{error}</Alert>}
      {state === 'ready' && !visibleItems.length && <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}><Typography>No hay objetivos de producción para mostrar.</Typography></Paper>}
      {visibleItems.length > 0 && (
        <TableContainer component={Paper} variant="outlined" tabIndex={0} role="region" aria-label="Tabla de avance de órdenes de fabricación"><Table size="small" aria-label="Avance de órdenes de fabricación">
          <TableHead><TableRow><TableCell /><TableCell>OF</TableCell><TableCell>Objetivo de color</TableCell><TableCell>Color</TableCell><TableCell align="right">Objetivo neto (kg)</TableCell><TableCell align="right">Peso finalizado (kg)</TableCell><TableCell align="right">Avance</TableCell><TableCell>Estado del cálculo</TableCell></TableRow></TableHead>
          <TableBody>{visibleItems.map((item) => {
            const id = item.corrida_id || item.corrida;
            const open = expanded[id];
            const progressState = getProgressState(item, visibleVisibility);
            const progress = progressState.percent;
            const restricted = progressState.key === 'RESTRINGIDO';
            return <Fragment key={id}>
              <TableRow hover><TableCell><IconButton size="small" aria-label={`Expandir ${item.of}`} onClick={() => setExpanded((current) => ({ ...current, [id]: !current[id] }))}><ExpandMoreIcon sx={{ transform: open ? 'rotate(180deg)' : 'none' }} /></IconButton></TableCell><TableCell sx={{ fontWeight: 750 }}>{item.of || '—'}</TableCell><TableCell>{item.corrida || '—'}</TableCell><TableCell>{item.color || '—'}</TableCell><TableCell align="right">{restricted ? '—' : formatKg(progressState.target)}</TableCell><TableCell align="right">{restricted ? '—' : formatKg(progressState.final)}</TableCell><TableCell sx={{ minWidth: 130 }}>{progress === null ? '—' : <><Typography variant="caption">{progress.toFixed(1)}%</Typography><LinearProgress color={progressTone(progress)} variant="determinate" value={Math.min(100, Math.max(0, progress))} /></>}</TableCell><TableCell><Chip size="small" label={progressState.label} color={progressState.color} variant="outlined" /></TableCell></TableRow>
              <TableRow><TableCell colSpan={8} sx={{ p: 0, border: 0 }}><Collapse in={open} timeout="auto" unmountOnExit><Box sx={{ p: 2, bgcolor: 'action.hover' }}>{restricted ? <Typography variant="body2">Los pesos y su cobertura requieren permiso de pesaje.</Typography> : <><Stack direction={{ xs: 'column', md: 'row' }} spacing={2}><Typography variant="body2">Mangas: {item.mangas?.conocidas ?? '—'}/{item.mangas?.total ?? '—'} conocidas</Typography><Typography variant="body2">Abiertas: {formatKg(progressState.opened)}</Typography><Typography variant="body2">Restante: {formatKg(item.restante_kg)}</Typography><Typography variant="body2">Subtotal conocido: {formatKg(item.subtotal_conocido_kg)}</Typography></Stack>{progressState.evidenceLabel && <Typography variant="caption" color="text.secondary">Evidencia: {progressState.evidenceLabel}. </Typography>}<Typography variant="caption" color="text.secondary">{item.criterio_uniformidad || 'Criterio de uniformidad no definido'}</Typography></>}</Box></Collapse></TableCell></TableRow>
            </Fragment>;
          })}</TableBody>
        </Table></TableContainer>
      )}
    </Box>
  );
}
