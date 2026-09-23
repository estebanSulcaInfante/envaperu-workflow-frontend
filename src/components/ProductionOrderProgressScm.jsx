import { Fragment, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, CircularProgress, Collapse, IconButton, LinearProgress,
  Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import { listarAvanceOfScm } from '../services/scmProductionObservabilityApi';

const number = (value, suffix = '') => value === null || value === undefined ? '—' : `${Number(value).toFixed(3)}${suffix}`;

export default function ProductionOrderProgressScm() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  const [expanded, setExpanded] = useState({});
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const load = async () => {
    setState('loading'); setError('');
    try { setSearchParams(query ? { q: query } : {}, { replace: true }); const payload = await listarAvanceOfScm({ q: query }); setItems(payload.items || []); setState('ready'); }
    catch (cause) { setError(cause?.response?.data?.error?.message || cause?.response?.data?.message || 'No se pudo cargar el avance de OF.'); setState('error'); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1500, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1} sx={{ mb: 2 }}>
        <Box><Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>Avance de OF</Typography><Typography color="text.secondary">OF → objetivo y color · evidencia de kg</Typography></Box>
        <Button startIcon={<RefreshIcon />} variant="outlined" onClick={load} disabled={state === 'loading'}>Buscar</Button>
      </Stack>
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}><TextField size="small" fullWidth label="Buscar OF, corrida, color u OT" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') load(); }} /></Paper>
      {state === 'loading' && !items.length && <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}><CircularProgress aria-label="Cargando avance" /><Typography sx={{ mt: 1 }}>Cargando avance…</Typography></Paper>}
      {state === 'error' && <Alert severity="error" action={<Button color="inherit" onClick={load}>Reintentar</Button>} sx={{ mb: 2 }}>{error}</Alert>}
      {state !== 'loading' && !items.length && <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}><Typography>No hay objetivos de producción para mostrar.</Typography></Paper>}
      {items.length > 0 && (
        <TableContainer component={Paper} variant="outlined"><Table size="small" aria-label="Avance de órdenes de fabricación">
          <TableHead><TableRow><TableCell /><TableCell>OF</TableCell><TableCell>Corrida</TableCell><TableCell>Color</TableCell><TableCell align="right">Objetivo neto (kg)</TableCell><TableCell align="right">Peso efectivo (kg)</TableCell><TableCell align="right">Avance</TableCell><TableCell>Cobertura</TableCell></TableRow></TableHead>
          <TableBody>{items.map((item) => { const id = item.corrida_id || item.corrida; const open = expanded[id]; const progress = item.porcentaje; return <Fragment key={id}>
            <TableRow hover><TableCell><IconButton size="small" aria-label={`Expandir ${item.of}`} onClick={() => setExpanded((current) => ({ ...current, [id]: !current[id] }))}><ExpandMoreIcon sx={{ transform: open ? 'rotate(180deg)' : 'none' }} /></IconButton></TableCell><TableCell sx={{ fontWeight: 750 }}>{item.of || '—'}</TableCell><TableCell>{item.corrida || '—'}</TableCell><TableCell>{item.color || '—'}</TableCell><TableCell align="right">{number(item.objetivo_neto_kg)}</TableCell><TableCell align="right">{number(item.kg_finalizados_efectivos)}</TableCell><TableCell sx={{ minWidth: 130 }}>{progress === null || progress === undefined ? '—' : <><Typography variant="caption">{progress.toFixed(1)}%</Typography><LinearProgress variant="determinate" value={Math.min(100, Math.max(0, progress))} /></>}</TableCell><TableCell><Chip size="small" label={item.coverage?.estado || 'INCOMPLETA'} color={item.coverage?.estado === 'COMPLETA' ? 'success' : 'warning'} variant="outlined" /></TableCell></TableRow>
            <TableRow><TableCell colSpan={8} sx={{ p: 0, border: 0 }}><Collapse in={open} timeout="auto" unmountOnExit><Box sx={{ p: 2, bgcolor: 'action.hover' }}><Stack direction={{ xs: 'column', md: 'row' }} spacing={2}><Typography variant="body2">Mangas: {item.mangas?.conocidas ?? 0}/{item.mangas?.total ?? 0} conocidas</Typography><Typography variant="body2">Abiertas: {number(item.kg_medidos_en_abiertas)} kg</Typography><Typography variant="body2">Restante: {number(item.restante_kg)} kg</Typography><Typography variant="body2">Subtotal conocido: {number(item.subtotal_conocido_kg)} kg</Typography></Stack><Typography variant="caption" color="text.secondary">{item.criterio_uniformidad || 'Criterio de uniformidad no definido'}</Typography></Box></Collapse></TableCell></TableRow>
          </Fragment>; })}</TableBody>
        </Table></TableContainer>
      )}
    </Box>
  );
}
