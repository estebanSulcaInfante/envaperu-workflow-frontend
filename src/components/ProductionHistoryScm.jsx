import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, FormControl, InputLabel, MenuItem, Paper,
  Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import { exportarProduccionHistoricaScm, listarProduccionHistoricaScm } from '../services/scmProductionObservabilityApi';

const today = new Date().toISOString().slice(0, 10);
const initial = { desde: today, hasta: today, q: '', agrupaciones: 'DIA' };

export default function ProductionHistoryScm() {
  const [filters, setFilters] = useState(initial); const [items, setItems] = useState([]); const [state, setState] = useState('idle'); const [error, setError] = useState('');
  const load = async () => { setState('loading'); setError(''); try { const payload = await listarProduccionHistoricaScm(filters); setItems(payload.items || []); setState('ready'); } catch (cause) { setError(cause?.response?.data?.message || 'No se pudo cargar el histórico.'); setState('error'); } };
  useEffect(() => { const timer = setTimeout(load, 0); return () => clearTimeout(timer); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const update = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  const exportFile = async () => { try { const response = await exportarProduccionHistoricaScm(filters); const url = URL.createObjectURL(response.data); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'produccion-historica.xlsx'; anchor.click(); URL.revokeObjectURL(url); } catch { setError('No se pudo exportar el histórico.'); setState('error'); } };
  return <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1500, mx: 'auto' }}>
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1} sx={{ mb: 2 }}><Box><Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>Histórico de producción</Typography><Typography color="text.secondary">Rango operativo America/Lima · atribución trazable por tramo</Typography></Box><Stack direction="row" spacing={1}><Button startIcon={<RefreshIcon />} variant="outlined" onClick={load}>Buscar</Button><Button startIcon={<DownloadIcon />} variant="contained" onClick={exportFile} disabled={state === 'loading'}>Exportar</Button></Stack></Stack>
    <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField size="small" type="date" label="Desde" InputLabelProps={{ shrink: true }} value={filters.desde} onChange={update('desde')} /><TextField size="small" type="date" label="Hasta" InputLabelProps={{ shrink: true }} value={filters.hasta} onChange={update('hasta')} /><TextField size="small" label="Buscar" value={filters.q} onChange={update('q')} /><FormControl size="small" sx={{ minWidth: 150 }}><InputLabel>Agrupar</InputLabel><Select label="Agrupar" value={filters.agrupaciones} onChange={update('agrupaciones')}><MenuItem value="DIA">Día</MenuItem><MenuItem value="MES">Mes</MenuItem><MenuItem value="OF">OF</MenuItem><MenuItem value="CORRIDA">Corrida</MenuItem><MenuItem value="COLOR">Color</MenuItem></Select></FormControl></Stack>{filters.q && <Chip sx={{ mt: 1 }} label={`Buscar: ${filters.q}`} onDelete={() => setFilters((current) => ({ ...current, q: '' }))} />}</Paper>
    {error && <Alert severity="error" action={<Button color="inherit" onClick={load}>Reintentar</Button>} sx={{ mb: 2 }}>{error}</Alert>}
    {state === 'loading' && <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}><CircularProgress aria-label="Cargando histórico" /></Paper>}
    {state === 'ready' && !items.length && <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>No hay producción en el rango seleccionado.</Paper>}
    {state === 'ready' && items.length > 0 && <TableContainer component={Paper} variant="outlined"><Table size="small"><TableHead><TableRow><TableCell>{filters.agrupaciones}</TableCell><TableCell align="right">Peso efectivo (kg)</TableCell><TableCell align="right">Mangas</TableCell><TableCell align="right">P. unitario prom. (g)</TableCell><TableCell align="right">Peso teórico según unidades (kg)</TableCell><TableCell>Cobertura</TableCell></TableRow></TableHead><TableBody>{items.map((item, index) => <TableRow key={`${item[filters.agrupaciones]}-${index}`}><TableCell>{item[filters.agrupaciones] || '—'}</TableCell><TableCell align="right">{item.PESO_KG == null ? '—' : Number(item.PESO_KG).toFixed(3)}</TableCell><TableCell align="right">{item.MANGAS}</TableCell><TableCell align="right">{item.P_UNITARIO_G == null ? '—' : Number(item.P_UNITARIO_G).toFixed(1)}</TableCell><TableCell align="right">{item.P_TEORICO_KG == null ? '—' : Number(item.P_TEORICO_KG).toFixed(3)}</TableCell><TableCell><Chip size="small" variant="outlined" label={item.coverage || 'INCOMPLETA'} color={item.coverage === 'COMPLETA' ? 'success' : 'warning'} /></TableCell></TableRow>)}</TableBody></Table></TableContainer>}
  </Box>;
}
