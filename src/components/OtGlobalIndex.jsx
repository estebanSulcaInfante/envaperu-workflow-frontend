import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, FormControl, InputLabel, Link,
  MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TablePagination, TableRow, TextField, Typography,
} from '@mui/material';
import { Link as RouterLink, useLocation, useSearchParams } from 'react-router-dom';
import DataTableToolbar from './ui/DataTableToolbar';
import { matchesOmniSearch } from '../utils/tableSearch';
import { listarOtScm } from '../services/scmOtApi';
import { mensajeErrorScm } from '../services/scmEngineeringApi';

const GLOBAL_DEFAULTS = {
  q: '', estado: 'TODOS', tipo: 'TODOS', turno: 'TODOS', from: '', to: '', maquina: '',
};

const label = (value) => String(value || '').replaceAll('_', ' ');
const machineLabel = (ot) => ot?.maquina_nombre || ot?.maquina?.nombre
  || ot?.maquina_codigo || ot?.maquina?.codigo || ot?.maquina || ot?.maquina_id || 'Sin máquina';
const machineIdentityValues = (ot) => [
  ot?.maquina_nombre, ot?.maquina?.nombre,
  ot?.maquina_codigo, ot?.maquina?.codigo,
  ot?.maquina_id, ot?.maquina?.id,
].filter((value) => value != null && value !== '');
const centerLabel = (ot) => ot?.centro_trabajo?.nombre || ot?.orden_armado?.centro_trabajo?.nombre
  || ot?.centro_trabajo?.codigo || ot?.orden_armado?.centro_trabajo?.codigo || 'Centro no informado';
const centerIdentityValues = (ot) => [
  ot?.centro_trabajo?.nombre, ot?.orden_armado?.centro_trabajo?.nombre,
  ot?.centro_trabajo?.codigo, ot?.orden_armado?.centro_trabajo?.codigo,
  ot?.centro_trabajo?.id, ot?.orden_armado?.centro_trabajo?.id,
].filter((value) => value != null && value !== '');
const resourceLabel = (ot) => ot?.tipo_ot === 'ENSAMBLE' ? centerLabel(ot) : machineLabel(ot);
const resourceIdentity = (ot) => {
  const assembly = ot?.tipo_ot === 'ENSAMBLE';
  const values = assembly ? centerIdentityValues(ot) : machineIdentityValues(ot);
  const primary = values[0] || resourceLabel(ot);
  const code = values.find((value) => String(value) !== String(primary)) || '';
  const id = assembly
    ? (ot?.centro_trabajo?.id || ot?.orden_armado?.centro_trabajo?.id)
    : (ot?.maquina_id || ot?.maquina?.id);
  const type = assembly ? 'centro' : 'maquina';
  const key = id != null && id !== ''
    ? `${type}:id:${id}`
    : (code ? `${type}:code:${code}` : `${type}:label:${primary}`);
  return { key, label: primary, code, type };
};
const resourceFilterMatches = (ot, filter) => {
  if (!filter) return true;
  const identity = resourceIdentity(ot);
  return identity.key === filter || resourceLabel(ot) === filter;
};
const assemblyOrderId = (ot) => ot?.orden_armado?.id || ot?.orden_operacion_id || '';
const workRows = (ot) => [
  ...(Array.isArray(ot?.trabajos_color) ? ot.trabajos_color : []),
  ...(ot?.trabajo_color_contexto ? [ot.trabajo_color_contexto] : []),
];

const catalogValue = (value) => value == null ? '' : String(value);
const catalogAliases = (entry) => [entry?.id, entry?.codigo, entry?.nombre]
  .filter((value) => value != null)
  .map(catalogValue);
const catalogIdentityAliases = (entry) => [entry?.id, entry?.codigo]
  .filter((value) => value != null && value !== '')
  .map(catalogValue);
const mergeCatalogIdentity = (partial, resolved) => {
  if (!partial) return resolved;
  if (!resolved) return partial;
  const partialAliases = catalogIdentityAliases(partial);
  const resolvedAliases = new Set(catalogIdentityAliases(resolved));
  if (!partialAliases.length || !partialAliases.some((alias) => resolvedAliases.has(alias))) {
    return partial;
  }
  return { ...resolved, ...partial };
};
const workOrderId = (work) => work?.orden_fabricacion_id
  || work?.orden_fabricacion?.id || work?.fabricacion?.orden_fabricacion_id || '';
const workMoldId = (work, order) => work?.molde_id
  || work?.molde?.id || work?.fabricacion?.molde_id || order?.molde_id
  || order?.molde?.id || order?.molde?.codigo || '';
const colorSummary = (ot) => {
  const values = [...new Set(workRows(ot).map((work) => work?.color).filter(Boolean))];
  if (!values.length) {
    const mangaColors = [...new Set((ot?.mangas || []).map((manga) => manga?.color).filter(Boolean))];
    return mangaColors.join(', ') || 'Color no informado';
  }
  return values.join(', ');
};
const moldSummary = (ot) => {
  const values = [...new Set([
    ot?.molde?.nombre, ot?.molde_nombre, ot?.molde?.codigo, ot?.molde_codigo, ot?.molde?.id, ot?.molde_id,
    ...workRows(ot).flatMap((work) => [
      work?.molde?.nombre, work?.molde?.codigo, work?.molde?.id, work?.molde_id,
    ]),
  ].filter(Boolean))];
  return values.join(', ') || 'Molde no informado';
};
const moldPrimaryLabel = (ot) => ot?.molde?.nombre || ot?.molde_nombre
  || ot?.molde?.codigo || ot?.molde_codigo || ot?.molde?.id || ot?.molde_id || 'Molde no informado';
const moldSecondaryLabel = (ot) => ot?.molde?.codigo || ot?.molde_codigo
  || ot?.molde?.id || ot?.molde_id || '';
const centerSecondaryLabel = (ot) => ot?.centro_trabajo?.codigo
  || ot?.orden_armado?.centro_trabajo?.codigo || ot?.centro_trabajo?.id
  || ot?.orden_armado?.centro_trabajo?.id || '';
const ofSummary = (ot) => {
  const values = [...new Set([
    ot?.orden_fabricacion?.codigo, ot?.orden_fabricacion_codigo,
    ...workRows(ot).flatMap((work) => [work?.orden_fabricacion_codigo, work?.orden_fabricacion?.codigo]),
  ].filter(Boolean))];
  return values.join(', ') || 'OF no informada';
};

// eslint-disable-next-line react-refresh/only-export-components
export const globalOtSearchSelectors = [
  (ot) => ot?.codigo_ot,
  (ot) => ot?.public_id,
  (ot) => ot?.fecha_operativa,
  (ot) => ot?.turno,
  (ot) => resourceLabel(ot),
  (ot) => machineIdentityValues(ot),
  (ot) => centerLabel(ot),
  (ot) => centerIdentityValues(ot),
  (ot) => moldSummary(ot),
  (ot) => [ot?.molde?.nombre, ot?.molde?.codigo, ot?.molde?.id, ot?.molde_id, ot?.molde_codigo, ot?.molde_nombre],
  (ot) => ofSummary(ot),
  (ot) => colorSummary(ot),
  (ot) => ot?.tipo_ot,
  (ot) => ot?.estado,
  (ot) => ot?.trabajos_color,
  (ot) => ot?.mangas,
];

const readFilters = (params) => ({
  q: params.get('gq') || GLOBAL_DEFAULTS.q,
  estado: params.get('gestado') || GLOBAL_DEFAULTS.estado,
  tipo: params.get('gtipo') || GLOBAL_DEFAULTS.tipo,
  turno: params.get('gturno') || GLOBAL_DEFAULTS.turno,
  from: params.get('gfrom') || GLOBAL_DEFAULTS.from,
  to: params.get('gto') || GLOBAL_DEFAULTS.to,
  maquina: params.get('gmaquina') || GLOBAL_DEFAULTS.maquina,
});

const writeFilters = (current, next) => {
  const params = new URLSearchParams(current);
  const entries = [
    ['gq', next.q], ['gestado', next.estado, 'TODOS'], ['gtipo', next.tipo, 'TODOS'],
    ['gturno', next.turno, 'TODOS'], ['gfrom', next.from], ['gto', next.to], ['gmaquina', next.maquina],
  ];
  entries.forEach(([key, value, neutral]) => {
    if (!value || value === neutral) params.delete(key);
    else params.set(key, value);
  });
  return params;
};

const payloadItems = (payload) => Array.isArray(payload) ? payload : (payload?.items || payload?.all || []);

export default function OtGlobalIndex({
  reloadSignal = 0, actorId = '', orders = [], molds = [], machines = [], catalogWarning = '',
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(() => readFilters(searchParams));
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const requestRef = useRef(0);
  const loadedRef = useRef(false);
  const actorScopeRef = useRef(actorId);
  actorScopeRef.current = actorId;
  const previousActorRef = useRef(actorId);

  const load = useCallback(async () => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setBusy(true);
    setError('');
    try {
      const payload = await listarOtScm(undefined, undefined, {});
      if (requestId !== requestRef.current || actorId !== actorScopeRef.current) return;
      setItems(payloadItems(payload));
      setLoaded(true);
      loadedRef.current = true;
      setStale(false);
    } catch (requestError) {
      if (requestId !== requestRef.current || actorId !== actorScopeRef.current) return;
      setError(mensajeErrorScm(requestError, 'No se pudieron cargar todas las OT.'));
      setStale(loadedRef.current);
    } finally {
      if (requestId === requestRef.current && actorId === actorScopeRef.current) setBusy(false);
    }
  }, [actorId]);

  useEffect(() => {
    const actorChanged = previousActorRef.current !== actorId;
    previousActorRef.current = actorId;
    if (actorChanged) {
      setItems([]);
      setLoaded(false);
      setStale(false);
      loadedRef.current = false;
    }
    setError('');
    setPage(0);
    load();
  }, [actorId, load, reloadSignal]);
  useEffect(() => () => { requestRef.current += 1; }, []);
  useEffect(() => {
    const next = readFilters(searchParams);
    setFilters((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
  }, [searchParams]);

  const updateFilters = (next) => {
    setFilters(next);
    setPage(0);
    setSearchParams(writeFilters(searchParams, next), { replace: true });
  };
  const clearFilters = () => updateFilters(GLOBAL_DEFAULTS);

  const enrichedItems = useMemo(() => {
    const orderByAlias = new Map();
    orders.forEach((order) => catalogAliases(order).forEach((alias) => orderByAlias.set(alias, order)));
    const moldByAlias = new Map();
    molds.forEach((mold) => catalogAliases(mold).forEach((alias) => moldByAlias.set(alias, mold)));
    const machineByAlias = new Map();
    machines.forEach((machine) => catalogAliases(machine).forEach((alias) => machineByAlias.set(alias, machine)));
    return items.map((item) => {
      const enrichWork = (work) => {
        const order = orderByAlias.get(catalogValue(workOrderId(work)))
          || orderByAlias.get(catalogValue(work?.orden_fabricacion_codigo));
        const mold = moldByAlias.get(catalogValue(workMoldId(work, order)));
        const resolvedMold = mold || order?.molde;
        return {
          ...work,
          orden_fabricacion: work?.orden_fabricacion || order,
          orden_fabricacion_codigo: work?.orden_fabricacion_codigo || order?.codigo,
          molde: mergeCatalogIdentity(work?.molde, resolvedMold),
        };
      };
      const enrichedWorks = workRows(item).map(enrichWork);
      const order = orderByAlias.get(catalogValue(item.orden_fabricacion_id || item.orden_operacion_id))
        || enrichedWorks.map((work) => work.orden_fabricacion).find(Boolean);
      const mold = moldByAlias.get(catalogValue(item.molde_id || item.molde?.id || item.molde?.codigo
        || order?.molde_id || order?.molde?.id || order?.molde?.codigo))
        || enrichedWorks.map((work) => work.molde).find(Boolean);
      const machine = machineByAlias.get(catalogValue(item.maquina_id || item.maquina?.id));
      return {
        ...item,
        trabajos_color: enrichedWorks,
        orden_fabricacion: item.orden_fabricacion || order,
        molde: mergeCatalogIdentity(item.molde, mold || order?.molde),
        maquina_codigo: item.maquina_codigo || machine?.codigo,
        maquina_nombre: item.maquina_nombre || machine?.nombre,
        maquina_id: item.maquina_id || machine?.id,
      };
    });
  }, [items, machines, molds, orders]);
  const choices = useMemo(() => ({
    states: [...new Set(enrichedItems.map((item) => item.estado).filter(Boolean))].sort(),
    machines: [...new Map(enrichedItems
      .filter((item) => !['Sin máquina', 'Centro no informado'].includes(resourceLabel(item)))
      .map((item) => {
        const identity = resourceIdentity(item);
        return [identity.key, identity];
      }))].map(([, identity]) => identity)
      .sort((left, right) => left.label.localeCompare(right.label, 'es')
        || left.key.localeCompare(right.key)),
  }), [enrichedItems]);
  const filtered = useMemo(() => enrichedItems.filter((item) => (
    (filters.estado === 'TODOS' || item.estado === filters.estado)
      && (filters.tipo === 'TODOS' || item.tipo_ot === filters.tipo)
      && (filters.turno === 'TODOS' || item.turno === filters.turno)
      && (!filters.from || String(item.fecha_operativa || '') >= filters.from)
      && (!filters.to || String(item.fecha_operativa || '') <= filters.to)
      && resourceFilterMatches(item, filters.maquina)
      && matchesOmniSearch(item, filters.q, globalOtSearchSelectors)
  )), [enrichedItems, filters]);
  const pageRows = filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  useEffect(() => {
    if (page > 0 && page * rowsPerPage >= filtered.length) setPage(0);
  }, [filtered.length, page, rowsPerPage]);

  const goToRow = (ot) => {
    const returnTo = `${location.pathname}${location.search}`;
    if (ot.tipo_ot === 'ENSAMBLE') {
      const params = new URLSearchParams({
        ...(assemblyOrderId(ot) ? { oa: assemblyOrderId(ot) } : {}),
        ...(ot.public_id ? { ot: ot.public_id } : {}),
        ...(ot.fecha_operativa ? { fecha: ot.fecha_operativa } : {}),
        ...(ot.turno ? { turno: ot.turno } : {}),
        return_to: returnTo,
      });
      return `/produccion/ordenes-armado?${params.toString()}`;
    }
    const params = new URLSearchParams({
      ...(ot.fecha_operativa ? { fecha: ot.fecha_operativa } : {}),
      ...(ot.turno ? { turno: ot.turno } : {}),
      modo: 'fabricacion',
      ...(ot.public_id ? { ot: ot.public_id } : {}),
      retorno: returnTo,
    });
    return `/produccion/ots-planta/trabajo?${params.toString()}`;
  };

  return (
    <Stack spacing={1.5} data-testid="ot-global-index">
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
        <Box>
          <Typography component="h2" variant="h6" fontWeight={850}>Todas las OT</Typography>
          <Typography variant="body2" color="text.secondary">Consulta histórica independiente del turno consultado.</Typography>
        </Box>
      </Stack>
      <DataTableToolbar
        searchValue={filters.q}
        onSearchChange={(q) => updateFilters({ ...filters, q })}
        searchPlaceholder="Buscar OT, OF, molde, máquina o color"
        filters={[
          { id: 'estado', label: 'Estado', value: filters.estado, allValue: 'TODOS', options: [{ value: 'TODOS', label: 'Todos los estados' }, ...choices.states.map((value) => ({ value, label: label(value) }))], onChange: (estado) => updateFilters({ ...filters, estado }) },
          { id: 'tipo', label: 'Tipo', value: filters.tipo, allValue: 'TODOS', options: [{ value: 'TODOS', label: 'Todos los tipos' }, { value: 'FABRICACION', label: 'Fabricación' }, { value: 'ENSAMBLE', label: 'Armado' }], onChange: (tipo) => updateFilters({ ...filters, tipo }) },
          { id: 'turno', label: 'Turno', value: filters.turno, allValue: 'TODOS', options: [{ value: 'TODOS', label: 'Todos los turnos' }, ...['DIA', 'NOCHE', 'EXTRA'].map((value) => ({ value, label: label(value) }))], onChange: (turno) => updateFilters({ ...filters, turno }) },
          { id: 'maquina', label: 'Máquina / centro', value: filters.maquina, allValue: '', options: [{ value: '', label: 'Todos los recursos' }, ...choices.machines.map((item) => ({ value: item.key, label: item.code ? `${item.label} · ${item.code}` : item.label }))], onChange: (maquina) => updateFilters({ ...filters, maquina }) },
        ]}
        onClear={clearFilters}
        resultCount={filtered.length}
        totalCount={items.length}
      />
      {catalogWarning && <Alert severity="warning">{catalogWarning}</Alert>}
      {stale && <Alert severity="warning">La última carga válida sigue visible; esta actualización no se pudo completar.</Alert>}
      <Paper variant="outlined">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ p: 1.25 }}>
          <TextField size="small" label="Desde" type="date" value={filters.from} InputLabelProps={{ shrink: true }} onChange={(event) => updateFilters({ ...filters, from: event.target.value })} />
          <TextField size="small" label="Hasta" type="date" value={filters.to} InputLabelProps={{ shrink: true }} onChange={(event) => updateFilters({ ...filters, to: event.target.value })} />
          <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>{filtered.length} visibles de {items.length} OT cargadas</Typography>
        </Stack>
        {busy && !loaded && <Box sx={{ display: 'grid', placeItems: 'center', py: 5 }}><CircularProgress /></Box>}
        {error && <Alert severity="error" sx={{ m: 1.25 }} action={<Button color="inherit" size="small" onClick={load}>Reintentar</Button>}>{error}</Alert>}
        {!busy && !error && loaded && !filtered.length && <Alert severity="info" sx={{ m: 1.25 }}>{items.length ? 'No hay OT que coincida con los filtros.' : 'No hay OT registradas.'}</Alert>}
        {loaded && filtered.length > 0 && <TableContainer sx={{ maxHeight: { xs: 460, md: 620 } }}><Table size="small" stickyHeader aria-label="Todas las OT"><TableHead><TableRow><TableCell>OT vinculada</TableCell><TableCell>Fecha / turno</TableCell><TableCell>Máquina / centro</TableCell><TableCell>Molde · OF · colores</TableCell><TableCell>Estado / tipo</TableCell></TableRow></TableHead><TableBody>{pageRows.map((ot) => { const canOpen = ot.tipo_ot !== 'ENSAMBLE' || Boolean(assemblyOrderId(ot)); const hasChildren = workRows(ot).length > 0 || (ot.mangas || []).length > 0; const moldSecondary = moldSecondaryLabel(ot); return <TableRow key={ot.public_id || ot.id} hover><TableCell>{canOpen ? <Link component={RouterLink} to={goToRow(ot)} target="_blank" rel="noreferrer" underline="hover" fontWeight={800}>{ot.codigo_ot || ot.public_id || 'OT sin código'}</Link> : <Typography fontWeight={800}>{ot.codigo_ot || ot.public_id || 'OT sin código'}</Typography>}{!canOpen && <Typography variant="caption" color="text.secondary" display="block">OA sin identidad para abrir</Typography>}</TableCell><TableCell>{ot.fecha_operativa || 'Fecha no informada'}<Typography variant="caption" color="text.secondary" display="block">{label(ot.turno) || 'Turno no informado'}</Typography></TableCell><TableCell>{ot.tipo_ot === 'ENSAMBLE' ? <><Typography variant="body2">{centerLabel(ot)}</Typography><Typography variant="caption" color="text.secondary" display="block">{centerSecondaryLabel(ot) || 'Centro no informado'}</Typography></> : <><Typography variant="body2">{machineLabel(ot)}</Typography>{(ot.maquina_codigo || ot.maquina?.codigo || ot.maquina_id || ot.maquina?.id) && <Typography variant="caption" color="text.secondary" display="block">{ot.maquina_codigo || ot.maquina?.codigo || `ID: ${ot.maquina_id || ot.maquina.id}`}</Typography>}</>}</TableCell><TableCell>{hasChildren ? <><Typography variant="body2" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{moldPrimaryLabel(ot)}</Typography>{moldSecondary && <Typography variant="caption" color="text.secondary" display="block" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{moldSecondary}</Typography>}<Typography variant="caption" color="text.secondary" display="block" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ofSummary(ot)} · {colorSummary(ot)}</Typography></> : <><Typography variant="body2">Sin trabajos</Typography><Typography variant="caption" color="text.secondary">—</Typography></>}</TableCell><TableCell><Chip size="small" label={label(ot.estado)} color={ot.estado === 'EN_EJECUCION' ? 'success' : 'default'} /><Typography variant="caption" color="text.secondary" display="block">{ot.tipo_ot === 'ENSAMBLE' ? 'Armado' : 'Fabricación'}</Typography></TableCell></TableRow>; })}</TableBody></Table></TableContainer>}
        <TablePagination component="div" count={filtered.length} page={page} onPageChange={(_event, next) => setPage(next)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={[25, 50, 100]} labelRowsPerPage="Filas por página" labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`} />
      </Paper>
    </Stack>
  );
}
