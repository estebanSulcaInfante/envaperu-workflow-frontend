import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useSearchParams } from 'react-router-dom';
import { useScmActor } from '../context/ScmActorContext';
import { listarAvanceOfScm } from '../services/scmProductionObservabilityApi';
import FabricationOrdersScm from './FabricationOrdersScm';
import FabricationProgressObjectivesTable from './FabricationProgressObjectivesTable';
import { filterObjectiveComparisonItems } from './fabricationOrdersModel';

function OtProgressWorkspace() {
  const { actorId, can } = useScmActor();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  const [items, setItems] = useState([]);
  const [appliedQuery, setAppliedQuery] = useState(() => searchParams.get('q') || '');
  const [loadedActorId, setLoadedActorId] = useState(null);
  const [visibility, setVisibility] = useState({});
  const [asOf, setAsOf] = useState(null);
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const requestRef = useRef(0);
  const actorRef = useRef(actorId);
  const queryRef = useRef(query);
  const controllerRef = useRef(null);
  const canViewOt = can('OT_VER');

  useEffect(() => { actorRef.current = actorId; }, [actorId]);
  useEffect(() => { queryRef.current = query; }, [query]);

  const load = useCallback(async () => {
    if (!canViewOt) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestId = ++requestRef.current;
    const requestedActor = actorId;
    setState('loading');
    setError('');
    setLoadedActorId(null);
    setAsOf(null);
    try {
      const payload = await listarAvanceOfScm({ signal: controller.signal });
      if (requestId !== requestRef.current || actorRef.current !== requestedActor) return;
      setItems(payload?.items || []);
      setVisibility(payload?.visibilidad || {});
      setAsOf(payload?.as_of || null);
      setAppliedQuery(queryRef.current.trim());
      setLoadedActorId(requestedActor);
      setState('ready');
    } catch (cause) {
      if (cause?.name === 'AbortError' || cause?.name === 'CanceledError') return;
      if (requestId !== requestRef.current || actorRef.current !== requestedActor) return;
      const status = cause?.response?.status || cause?.status;
      setItems([]);
      setLoadedActorId(null);
      setAsOf(null);
      setVisibility({ pesaje: false });
      if ([401, 403].includes(status)) {
        setError('No tienes permiso para consultar el avance de OF. Solicita OT_VER.');
        setState('restricted');
      } else {
        setError(cause?.response?.data?.error?.message || cause?.message || 'No se pudo cargar el avance de OF.');
        setState('error');
      }
    }
  }, [actorId, canViewOt]);

  useEffect(() => {
    // This effect starts the external API read when the active actor/query changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    return () => { requestRef.current += 1; controllerRef.current?.abort(); };
  }, [load]);

  if (!canViewOt) return <Alert severity="warning">No tienes permiso para consultar el avance de OF. Solicita OT_VER.</Alert>;
  const actorReady = loadedActorId === actorId;
  const visibleItems = actorReady ? filterObjectiveComparisonItems(items, appliedQuery) : [];
  const onSearch = () => {
    const next = new URLSearchParams(searchParams);
    if (query.trim()) next.set('q', query.trim());
    else next.delete('q');
    setSearchParams(next, { replace: true });
    if (state === 'ready') setAppliedQuery(query.trim());
    else load();
  };
  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
        <Box><Typography variant="h4" component="h1" fontWeight={800}>Avance de OF</Typography><Typography color="text.secondary">Comparación de objetivos por color y evidencia de kg</Typography></Box>
        <Stack direction="row" spacing={1}><Button variant="outlined" onClick={onSearch} disabled={state === 'loading'}>Buscar</Button><Button startIcon={<RefreshIcon />} variant="outlined" onClick={load} disabled={state === 'loading'}>Actualizar</Button></Stack>
      </Stack>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <TextField size="small" fullWidth label="Buscar OF, objetivo de color u OT" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onSearch(); }} />
      </Paper>
      {state === 'loading' && !visibleItems.length && <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}><CircularProgress aria-label="Cargando avance" /><Typography sx={{ mt: 1 }}>Cargando avance…</Typography></Paper>}
      <FabricationProgressObjectivesTable
        items={visibleItems}
        visibility={visibility}
        loading={state === 'loading'}
        error={error}
        onRetry={load}
        asOf={asOf}
      />
    </Stack>
  );
}

function FabricationWorkspaceScope({ canViewOf }) {
  return canViewOf ? <FabricationOrdersScm /> : <OtProgressWorkspace />;
}

export default function FabricationWorkspaceScm() {
  const { actorId, capabilities, can } = useScmActor();
  const capabilityScope = `${Array.from(capabilities || []).sort().join(',')}:${['OF_VER', 'OT_VER', 'MANGA_PESAJE_VER'].map((capability) => can(capability) ? '1' : '0').join('')}`;
  const scopeKey = `${actorId ?? 'unknown'}:${capabilityScope}`;
  return <FabricationWorkspaceScope key={scopeKey} canViewOf={can('OF_VER')} />;
}
