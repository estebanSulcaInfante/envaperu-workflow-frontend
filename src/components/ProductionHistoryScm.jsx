import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, CircularProgress, Checkbox, FormControl, InputLabel, ListItemText,
  MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import { exportarProduccionHistoricaScm, listarProduccionHistoricaScm } from '../services/scmProductionObservabilityApi';
import { useScmActor } from '../context/ScmActorContext';

const groups = ['DIA', 'MES', 'OF', 'CORRIDA', 'COLOR', 'OT', 'RECURSO', 'RESPONSABLE', 'ARTICULO'];
const measures = ['PESO_KG', 'MANGAS', 'P_UNITARIO_G', 'P_TEORICO_KG'];
const limaToday = () => {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${value.year}-${value.month}-${value.day}`;
};
const defaults = () => ({ desde: limaToday(), hasta: limaToday(), q: '', agrupaciones: ['DIA'], medidas: measures });

const parseParams = (params) => {
  const base = defaults();
  const next = { ...base };
  ['desde', 'hasta', 'q'].forEach((key) => { if (params.get(key) !== null) next[key] = params.get(key); });
  const parsedGroups = params.get('agrupaciones')?.split(',').filter(Boolean);
  const parsedMeasures = params.get('medidas')?.split(',').filter(Boolean);
  if (parsedGroups?.length) next.agrupaciones = parsedGroups;
  if (parsedMeasures?.length) next.medidas = parsedMeasures;
  return next;
};

export default function ProductionHistoryScm() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => parseParams(searchParams));
  const [items, setItems] = useState([]);
  const [visibility, setVisibility] = useState(null);
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const { can } = useScmActor();
  const canExport = can('OT_VER') && can('MANGA_PESAJE_VER');

  const share = (next) => {
    const params = new URLSearchParams();
    Object.entries(next).forEach(([key, value]) => { if (value && (!Array.isArray(value) || value.length)) params.set(key, Array.isArray(value) ? value.join(',') : value); });
    setSearchParams(params, { replace: true });
  };
  const load = async (nextFilters = filters) => {
    setState('loading'); setError(''); share(nextFilters);
    try { const payload = await listarProduccionHistoricaScm({ ...nextFilters, agrupaciones: nextFilters.agrupaciones.join(','), medidas: nextFilters.medidas.join(',') }); setItems(payload.items || []); setVisibility(payload.visibilidad || null); setState('ready'); }
    catch (cause) { setError(cause?.response?.data?.error?.message || cause?.response?.data?.message || 'No se pudo cargar el histórico.'); setState('error'); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const update = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  const exportFile = async () => {
    try { const response = await exportarProduccionHistoricaScm({ ...filters, agrupaciones: filters.agrupaciones.join(','), medidas: filters.medidas.join(',') }); const url = URL.createObjectURL(response.data); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'produccion-historica.xlsx'; anchor.click(); URL.revokeObjectURL(url); }
    catch (cause) { setError(cause?.response?.data?.error?.message || cause?.response?.data?.message || 'No se pudo exportar el histórico.'); setState('error'); }
  };
  const removeChip = (key, value) => setFilters((current) => ({ ...current, [key]: Array.isArray(current[key]) ? current[key].filter((item) => item !== value) : '' }));
  const selectedMeasures = useMemo(() => filters.medidas || [], [filters.medidas]);
  return <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1500, mx: 'auto' }}>
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1} sx={{ mb: 2 }}><Box><Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>Histórico de producción</Typography><Typography color="text.secondary">Rango operativo America/Lima · atribución trazable por tramo</Typography></Box><Stack direction="row" spacing={1}><Button startIcon={<RefreshIcon />} variant="outlined" onClick={() => load()}>Buscar</Button><Button startIcon={<DownloadIcon />} variant="contained" onClick={exportFile} disabled={!canExport || state === 'loading' || visibility?.pesaje === false}>Exportar</Button></Stack></Stack>
    {visibility?.pesaje === false && <Alert severity="info" sx={{ mb: 2 }}>Visibilidad de pesos restringida: se requiere MANGA_PESAJE_VER. La estructura y los objetivos pueden permanecer disponibles.</Alert>}
    <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField size="small" type="date" label="Desde" InputLabelProps={{ shrink: true }} value={filters.desde} onChange={update('desde')} /><TextField size="small" type="date" label="Hasta" InputLabelProps={{ shrink: true }} value={filters.hasta} onChange={update('hasta')} /><TextField size="small" label="Buscar" value={filters.q} onChange={update('q')} /><FormControl size="small" sx={{ minWidth: 190 }}><InputLabel>Agrupar</InputLabel><Select multiple label="Agrupar" value={filters.agrupaciones} onChange={update('agrupaciones')} renderValue={(selected) => selected.join(', ')}>{groups.map((group) => <MenuItem key={group} value={group}><Checkbox checked={filters.agrupaciones.includes(group)} /><ListItemText primary={group} /></MenuItem>)}</Select></FormControl><FormControl size="small" sx={{ minWidth: 190 }}><InputLabel>Medidas</InputLabel><Select multiple label="Medidas" value={selectedMeasures} onChange={update('medidas')} renderValue={(selected) => selected.join(', ')}>{measures.map((measure) => <MenuItem key={measure} value={measure}><Checkbox checked={selectedMeasures.includes(measure)} /><ListItemText primary={measure} /></MenuItem>)}</Select></FormControl></Stack><Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>{filters.q && <Chip label={`Buscar: ${filters.q}`} onDelete={() => removeChip('q')} />}{filters.agrupaciones.map((value) => <Chip key={`g-${value}`} label={`Agrupar: ${value}`} onDelete={() => removeChip('agrupaciones', value)} />)}{filters.medidas.map((value) => <Chip key={`m-${value}`} label={`Medida: ${value}`} onDelete={() => removeChip('medidas', value)} />)}</Stack></Paper>
    {error && <Alert severity="error" action={<Button color="inherit" onClick={() => load()}>Reintentar</Button>} sx={{ mb: 2 }}>{error}</Alert>}
    {state === 'loading' && !items.length && <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}><CircularProgress aria-label="Cargando histórico" /></Paper>}
    {state !== 'loading' && !items.length && visibility?.pesaje !== false && <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>No hay producción en el rango seleccionado.</Paper>}
    {items.length > 0 && <TableContainer component={Paper} variant="outlined"><Table size="small"><TableHead><TableRow>{filters.agrupaciones.map((group) => <TableCell key={group}>{group}</TableCell>)}{selectedMeasures.includes('PESO_KG') && <TableCell align="right">Peso efectivo (kg)</TableCell>}{selectedMeasures.includes('MANGAS') && <TableCell align="right">Mangas</TableCell>}{selectedMeasures.includes('P_UNITARIO_G') && <TableCell align="right">P. unitario prom. (g)</TableCell>}{selectedMeasures.includes('P_TEORICO_KG') && <TableCell align="right">Peso teórico según unidades (kg)</TableCell>}<TableCell>Cobertura</TableCell></TableRow></TableHead><TableBody>{items.map((item, index) => <TableRow key={`${index}-${filters.agrupaciones.map((group) => item[group]).join('-')}`}>{filters.agrupaciones.map((group) => <TableCell key={group}>{item[group] || '—'}</TableCell>)}{selectedMeasures.includes('PESO_KG') && <TableCell align="right">{item.PESO_KG == null ? '—' : Number(item.PESO_KG).toFixed(3)}</TableCell>}{selectedMeasures.includes('MANGAS') && <TableCell align="right">{item.MANGAS ?? '—'}</TableCell>}{selectedMeasures.includes('P_UNITARIO_G') && <TableCell align="right">{item.P_UNITARIO_G == null ? '—' : Number(item.P_UNITARIO_G).toFixed(1)}</TableCell>}{selectedMeasures.includes('P_TEORICO_KG') && <TableCell align="right">{item.P_TEORICO_KG == null ? '—' : Number(item.P_TEORICO_KG).toFixed(3)}</TableCell>}<TableCell><Chip size="small" variant="outlined" label={item.coverage || 'INCOMPLETA'} color={item.coverage === 'COMPLETA' ? 'success' : 'warning'} /></TableCell></TableRow>)}</TableBody></Table></TableContainer>}
  </Box>;
}
