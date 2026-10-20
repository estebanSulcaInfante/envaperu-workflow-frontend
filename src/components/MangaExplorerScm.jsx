import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import PageHeader from './ui/PageHeader';
import ProductionColorLabel from './ui/ProductionColorLabel';
import MangaHistoryDetailScm from './MangaHistoryDetailScm';
import { useScmActor } from '../context/ScmActorContext';
import {
  exportarExploradorMangasScm,
  listarExploradorMangasScm,
} from '../services/scmProductionObservabilityApi';
import { formatKg } from '../utils/weightDisplay';

const initialFilters = { q: '', desde: '', hasta: '', estado: '', cursor: '', page: 0 };
const errorMessage = (cause) => cause?.response?.data?.error?.message || 'No se pudo cargar el explorador de mangas.';

const statusLabel = {
  PLANIFICADA: 'Planificada', PREETIQUETADA: 'Preetiquetada', EN_ARMADO: 'En armado',
  CONTINUIDAD_PENDIENTE: 'Continuidad pendiente', EN_LLENADO: 'En llenado',
  CERRADA_ARMADO_PENDIENTE_PESAJE: 'Cerrada · pendiente de pesaje', PESADA: 'Pesada',
  ETIQUETADA_FINAL: 'Etiquetada final', PENDIENTE_RECEPCION_ALMACEN: 'Pendiente de almacén',
  RECIBIDA: 'Recibida', ANULADA: 'Anulada',
};

const parseFilters = (params) => ({
  q: params.get('q') || '', desde: params.get('desde') || '', hasta: params.get('hasta') || '',
  estado: params.get('estado') || '', cursor: params.get('cursor') || '', page: Number(params.get('pagina') || 0) || 0,
});

const rowWeight = (item) => {
  if (!item?.visibilidad?.pesaje) return 'Restringido';
  if (!item?.manga?.pesaje) return '—';
  const value = item.manga.pesaje.peso_fisico_neto_kg;
  return value == null ? '—' : `${formatKg(value)} kg`;
};

function CursorPaginationActions({ page, onPageChange, canPrevious, hasMore }) {
  return (
    <Stack direction="row" alignItems="center">
      <IconButton aria-label="Página anterior" onClick={(event) => onPageChange(event, page - 1)} disabled={!canPrevious} size="small">
        <KeyboardArrowLeftIcon />
      </IconButton>
      <IconButton aria-label="Página siguiente" onClick={(event) => onPageChange(event, page + 1)} disabled={!hasMore} size="small">
        <KeyboardArrowRightIcon />
      </IconButton>
    </Stack>
  );
}

export default function MangaExplorerScm() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => ({ ...initialFilters, ...parseFilters(searchParams) }));
  const [draftFilters, setDraftFilters] = useState(() => ({ ...initialFilters, ...parseFilters(searchParams) }));
  const [items, setItems] = useState([]);
  const [page, setPage] = useState({ next_cursor: null, has_more: false, limit: 25 });
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const [exportState, setExportState] = useState('idle');
  const [exportError, setExportError] = useState('');
  const [exportMode, setExportMode] = useState('AMBOS');
  const [exportAnchor, setExportAnchor] = useState(null);
  const [cursorStack, setCursorStack] = useState(['']);
  const listSequence = useRef(0);
  const exportSequence = useRef(0);
  const controller = useRef(null);
  const exportController = useRef(null);
  const { actorId, can } = useScmActor();
  const actorRef = useRef(actorId);
  const draftIsApplied = useMemo(() => JSON.stringify(draftFilters) === JSON.stringify(filters), [draftFilters, filters]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    actorRef.current = actorId;
  }, [actorId]);

  const load = useCallback(async (nextFilters, { resetPage = false } = {}) => {
    const query = { ...nextFilters, ...(resetPage ? { cursor: '', page: 0 } : {}) };
    const current = ++listSequence.current;
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    setState('loading');
    setError('');
    try {
      const payload = await listarExploradorMangasScm({ ...query, limit: 25, signal: nextController.signal });
      if (nextController.signal.aborted || current !== listSequence.current || actorRef.current !== actorId) return;
      setItems(Array.isArray(payload?.items) ? payload.items : []);
      setPage(payload?.page || { next_cursor: null, has_more: false, limit: 25 });
      setState('ready');
      setFilters(query);
      setDraftFilters(query);
      if (resetPage) setCursorStack(['']);
      const params = Object.fromEntries(Object.entries(query).filter(([key, value]) => value && !['cursor', 'page'].includes(key)));
      if (query.cursor) params.cursor = query.cursor;
      if (query.page) params.pagina = query.page;
      setSearchParams(params, { replace: true });
    } catch (cause) {
      if (nextController.signal.aborted || current !== listSequence.current) return;
      setState('error');
      setError(errorMessage(cause));
    }
  }, [actorId, setSearchParams]);

  useEffect(() => {
    const parsed = { ...initialFilters, ...parseFilters(searchParams) };
    setItems([]);
    setState('idle');
    setExportState('idle');
    setExportError('');
    setFilters(parsed);
    setDraftFilters(parsed);
    load(parsed);
    return () => {
      controller.current?.abort();
      exportController.current?.abort();
    };
  }, [actorId, load, searchParams]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const submit = (event) => {
    event.preventDefault();
    load(draftFilters, { resetPage: true });
  };

  const updateFilter = (name) => (event) => setDraftFilters((current) => ({ ...current, [name]: event.target.value }));
  const nextPage = () => {
    if (!page.next_cursor) return;
    setCursorStack((current) => [...current, page.next_cursor]);
    load({ ...filters, cursor: page.next_cursor, page: filters.page + 1 });
  };
  const previousPage = () => {
    if (cursorStack.length <= 1) return;
    const nextStack = cursorStack.slice(0, -1);
    setCursorStack(nextStack);
    load({ ...filters, cursor: nextStack[nextStack.length - 1] || '', page: Math.max(0, filters.page - 1) });
  };
  const exportFile = async (vista) => {
    setExportAnchor(null);
    setExportMode(vista);
    setExportState('loading');
    setExportError('');
    const current = ++exportSequence.current;
    exportController.current?.abort();
    const nextController = new AbortController();
    exportController.current = nextController;
    try {
      const response = await exportarExploradorMangasScm({ ...filters, cursor: '', page: 0, signal: nextController.signal }, vista);
      if (nextController.signal.aborted || current !== exportSequence.current || actorRef.current !== actorId) return;
      const blob = response.data;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `mangas-fabricacion-${vista.toLowerCase()}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
      setExportState('success');
    } catch {
      if (nextController.signal.aborted || current !== exportSequence.current) return;
      setExportState('error');
      setExportError('No se pudo generar el Excel. Puedes reintentar sin perder los filtros.');
    }
  };

  const headerActions = (
    <Stack direction="row" spacing={1}>
      <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => load(filters)} disabled={state === 'loading'}>
        Actualizar
      </Button>
      <Button variant="contained" startIcon={<DownloadIcon />} onClick={(event) => setExportAnchor(event.currentTarget)} disabled={state === 'idle' || state === 'loading' || state === 'error' || exportState === 'loading' || exportState === 'error' || !draftIsApplied || !can('MANGA_PESAJE_VER')}>
        Exportar Excel
      </Button>
      <Menu anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}>
        <MenuItem onClick={() => exportFile('RESUMIDO')}>Resumido</MenuItem>
        <MenuItem onClick={() => exportFile('DETALLADO')}>Detallado</MenuItem>
        <MenuItem onClick={() => exportFile('AMBOS')}>Ambos</MenuItem>
      </Menu>
    </Stack>
  );

  return (
    <Stack spacing={2} sx={{ minWidth: 0 }}>
      <PageHeader title="Mangas de producción" description="Fabricación · fecha operativa de la jornada de origen. La continuidad entre jornadas se consulta en el detalle." actions={headerActions} />
      <Paper component="form" onSubmit={submit} variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems={{ md: 'center' }}>
          <TextField label="Buscar manga, pieza, color, molde, OF u OT" value={draftFilters.q} onChange={updateFilter('q')} size="small" fullWidth inputProps={{ 'aria-label': 'Buscar manga, pieza, color, molde, OF u OT' }} />
          <TextField label="Desde" type="date" value={draftFilters.desde} onChange={updateFilter('desde')} size="small" InputLabelProps={{ shrink: true }} sx={{ minWidth: { md: 160 } }} />
          <TextField label="Hasta" type="date" value={draftFilters.hasta} onChange={updateFilter('hasta')} size="small" InputLabelProps={{ shrink: true }} sx={{ minWidth: { md: 160 } }} />
          <TextField select label="Estado" value={draftFilters.estado} onChange={updateFilter('estado')} size="small" sx={{ minWidth: { md: 190 } }}>
            <MenuItem value="">Todas</MenuItem>
            {Object.entries(statusLabel).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
          </TextField>
          <Button type="submit" variant="contained" sx={{ minHeight: 40 }}>Buscar</Button>
          {(draftFilters.q || draftFilters.desde || draftFilters.hasta || draftFilters.estado) && (
            <Button type="button" onClick={() => {
              setDraftFilters(initialFilters);
              load(initialFilters, { resetPage: true });
            }} sx={{ minHeight: 40 }}>Limpiar</Button>
          )}
        </Stack>
      </Paper>
      <Typography variant="body2" color="text.secondary">{filters.desde || filters.hasta ? `Rango operativo: ${filters.desde || 'inicio'} – ${filters.hasta || 'hoy'}` : 'Todas las fechas operativas · Estado: Todas'}{items.length ? ` · ${items.length} mangas en esta página` : ''}</Typography>
      {exportState === 'loading' && <Alert severity="info">Generando Excel con el conjunto completo…</Alert>}
      {exportState === 'success' && <Alert severity="success" onClose={() => setExportState('idle')}>Excel descargado.</Alert>}
      {exportError && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => exportFile(exportMode)}>Reintentar</Button>}>{exportError}</Alert>}
      {state === 'loading' && (
        <Paper variant="outlined" aria-label="Cargando mangas" aria-busy="true" sx={{ overflow: 'hidden' }}>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small" aria-label="Filas de mangas en carga">
              <TableBody>{Array.from({ length: 4 }, (_, index) => (
                <TableRow key={index}>{Array.from({ length: 8 }, (_unused, cellIndex) => <TableCell key={cellIndex}><Skeleton variant="text" width={cellIndex === 0 ? 100 : 76} /></TableCell>)}</TableRow>
              ))}</TableBody>
            </Table>
          </TableContainer>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1.5, py: 1 }}><CircularProgress size={16} /><Typography variant="caption">Cargando mangas…</Typography></Stack>
        </Paper>
      )}
      {state === 'error' && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => load(filters)}>Reintentar</Button>}>{error}</Alert>}
      {state === 'ready' && items.length === 0 && <Alert severity="info">No hay mangas para estos filtros. Prueba otra búsqueda o limpia el rango.</Alert>}
      {state === 'ready' && items.length > 0 && (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'block', md: 'none' }, px: 1.5, pt: 1 }}>
            Desplázate horizontalmente para ver OF/OT, peso y estado.
          </Typography>
          <TableContainer component="div" role="region" tabIndex={0} aria-label="Tabla de mangas; desplázate horizontalmente para ver todas las columnas" sx={{ maxHeight: 'calc(100vh - 330px)', overflowX: 'auto' }}>
            <Table size="small" stickyHeader aria-label="Mangas de producción">
              <TableHead><TableRow>
                <TableCell>Manga</TableCell><TableCell>Artículo / pieza</TableCell><TableCell>Color</TableCell><TableCell>N°OF / N°OT</TableCell><TableCell>Máquina</TableCell><TableCell>Fecha operativa / turno</TableCell><TableCell align="right">Kg final</TableCell><TableCell>Estado</TableCell>
              </TableRow></TableHead>
              <TableBody>{items.map((item) => {
                const manga = item.manga || {}; const article = manga.articulo || {}; const resource = item.recurso || {};
                return <TableRow hover key={manga.public_id}>
                  <TableCell><Button component={Link} to={`/control/mangas/${manga.public_id}`} state={{ returnFilters: filters }} size="small" sx={{ p: 0, minWidth: 0, display: 'block', textAlign: 'left', fontWeight: 700 }}>{manga.codigo || 'Sin código'}</Button></TableCell>
                  <TableCell><Typography variant="body2" fontWeight={700}>{article.nombre || 'Artículo sin nombre'}</Typography><Typography variant="caption" color="text.secondary">{article.codigo || article.sku_pieza_color || 'Sin código'}</Typography></TableCell>
                  <TableCell><ProductionColorLabel name={manga.color || 'Color no indicado'} hex={manga.color_hex} /></TableCell>
                  <TableCell><Link to={`/produccion/ordenes-fabricacion?of=${encodeURIComponent(item.upstream?.orden?.id || '')}`}>{item.upstream?.orden?.codigo || '—'}</Link><Typography variant="caption" color="text.secondary" display="block"><Link to={`/produccion/ots-planta/trabajo?fecha=${encodeURIComponent(item.ot?.fecha_operativa || '')}&turno=${encodeURIComponent(item.ot?.turno || '')}&modo=fabricacion&ot=${encodeURIComponent(item.ot?.public_id || '')}`}>{item.ot?.codigo || '—'}</Link></Typography></TableCell>
                  <TableCell><Typography variant="body2">{resource.nombre || '—'}</Typography><Typography variant="caption" color="text.secondary">{resource.codigo || '—'}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{item.ot?.fecha_operativa || '—'}</Typography><Typography variant="caption" color="text.secondary">{item.ot?.turno || '—'}</Typography></TableCell>
                  <TableCell align="right">{rowWeight(item)}</TableCell>
                  <TableCell><Chip size="small" label={statusLabel[manga.estado_operativo] || manga.estado_operativo || '—'} /></TableCell>
                </TableRow>;
              })}</TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={-1}
            page={filters.page}
            rowsPerPage={25}
            rowsPerPageOptions={[25]}
            onPageChange={(_, next) => (next > filters.page ? nextPage() : previousPage())}
            ActionsComponent={(props) => <CursorPaginationActions {...props} canPrevious={cursorStack.length > 1} hasMore={page.has_more} />}
            labelDisplayedRows={({ from }) => {
              const end = items.length ? from + items.length - 1 : 0;
              return `${from}–${end}${page.has_more ? '' : ' · última página'}`;
            }}
          />
        </Paper>
      )}
    </Stack>
  );
}

export function MangaExplorerDetailRoute() {
  const { publicId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { actorId } = useScmActor();
  const returnFilters = useMemo(() => location.state?.returnFilters || {}, [location.state?.returnFilters]);
  const directItem = useMemo(() => ({ id: publicId, codigo: publicId }), [publicId]);
  const params = new URLSearchParams();
  Object.entries(returnFilters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key === 'page' ? 'pagina' : key, String(value));
  });
  const backPath = `/control/mangas${params.toString() ? `?${params.toString()}` : ''}`;
  return (
    <MangaHistoryDetailScm
      open
      directItem={directItem}
      onClose={() => navigate(backPath, { replace: true })}
      filters={returnFilters}
      actorId={actorId}
    />
  );
}
