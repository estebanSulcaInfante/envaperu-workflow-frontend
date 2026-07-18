import { Fragment, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import ExpandLessOutlinedIcon from '@mui/icons-material/ExpandLessOutlined';
import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import ScaleOutlinedIcon from '@mui/icons-material/ScaleOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import {
  getLegacyProductionOrderDetail,
  getLegacyProductionOrders,
} from '../services/legacyProductionOrders';


const statusOptions = {
  ACTIVA_CENTRAL: { label: 'Activa central', color: 'success' },
  CERRADA_CENTRAL: { label: 'Cerrada central', color: 'default' },
  CERRADA_LEGACY: { label: 'Cerrada legacy', color: 'info' },
  SIN_CIERRE_LEGACY: { label: 'Sin cierre legacy', color: 'warning' },
  PENDIENTE_MAPEO: { label: 'Pendiente de mapeo', color: 'error' },
};

const kg = (value) => `${Number(value || 0).toFixed(3)} kg`;
const dateTime = (value) => value
  ? new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  : 'Sin fecha';

function StatusChip({ value }) {
  const config = statusOptions[value] || { label: value || 'Sin estado', color: 'default' };
  return <Chip color={config.color} label={config.label} size="small" variant="outlined" />;
}

function Metric({ icon, label, value }) {
  return (
    <Box sx={{ minWidth: 0, py: 1.25, px: 1.5, borderLeft: '3px solid', borderColor: 'primary.main' }}>
      <Stack direction="row" spacing={0.75} alignItems="center" color="text.secondary">
        {icon}
        <Typography variant="caption" sx={{ fontWeight: 800 }}>{label}</Typography>
      </Stack>
      <Typography variant="h6" sx={{ mt: 0.4, fontWeight: 850, overflowWrap: 'anywhere' }}>{value}</Typography>
    </Box>
  );
}

function OrderIdentity({ item }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" sx={{ fontWeight: 850 }}>{item.op_raw}</Typography>
      <Typography variant="caption" color="text.secondary">
        {item.molds.join(', ') || 'Sin molde'}
      </Typography>
    </Box>
  );
}

function Detail({ state }) {
  if (state?.loading) return <Box sx={{ py: 3, display: 'grid', placeItems: 'center' }}><CircularProgress size={24} /></Box>;
  if (state?.error) return <Alert severity="error">No se pudo cargar el detalle de pesajes.</Alert>;
  if (!state?.data) return null;
  return (
    <TableContainer sx={{ maxHeight: 360 }}>
      <Table size="small" stickyHeader aria-label="Detalle de pesajes legacy">
        <TableHead>
          <TableRow>
            <TableCell>Fecha</TableCell><TableCell>OT</TableCell><TableCell>Color</TableCell>
            <TableCell>Máquina</TableCell><TableCell>Turno</TableCell>
            <TableCell align="right">Peso</TableCell><TableCell>Registro</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {state.data.captures.map((capture) => (
            <TableRow key={capture.legacy_id} sx={{ opacity: capture.is_deleted ? 0.62 : 1 }}>
              <TableCell>{dateTime(capture.captured_at_utc)}</TableCell>
              <TableCell>{capture.ot || 'Sin OT'}</TableCell>
              <TableCell>{capture.color || 'Sin color'}</TableCell>
              <TableCell>{capture.machine_code || 'Sin máquina'}</TableCell>
              <TableCell>{capture.shift || 'Sin turno'}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 750 }}>{kg(capture.weight_kg)}</TableCell>
              <TableCell>
                <Chip
                  color={capture.is_deleted ? 'default' : 'success'}
                  label={capture.is_deleted ? 'Eliminado legacy' : 'Activo'}
                  size="small"
                  variant="outlined"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function DesktopOrders({ items, expanded, details, onToggle }) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
      <Table size="small" aria-label="Todas las órdenes de producción legacy">
        <TableHead>
          <TableRow sx={{ bgcolor: '#F7F8FA' }}>
            <TableCell>Orden / molde</TableCell><TableCell>Estado</TableCell>
            <TableCell>Colores</TableCell><TableCell>Máquinas</TableCell>
            <TableCell align="right">Bolsas</TableCell><TableCell align="right">Peso activo</TableCell>
            <TableCell>Última captura</TableCell><TableCell padding="checkbox" />
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => {
            const key = `${item.station_id}:${item.op_raw}`;
            const open = expanded === key;
            return (
              <Fragment key={key}>
                <TableRow hover data-testid={`legacy-order-${item.op_raw}`}>
                  <TableCell><OrderIdentity item={item} /></TableCell>
                  <TableCell><StatusChip value={item.status} /></TableCell>
                  <TableCell>{item.colors.join(', ') || 'Sin color'}</TableCell>
                  <TableCell>{item.machines.join(', ') || 'Sin máquina'}</TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 800 }}>{item.active_bags}</Typography>
                    {item.deleted_bags > 0 && <Typography variant="caption" color="text.secondary">{item.deleted_bags} eliminadas</Typography>}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>{kg(item.active_weight_kg)}</TableCell>
                  <TableCell>{dateTime(item.last_capture_at_utc)}</TableCell>
                  <TableCell padding="checkbox">
                    <Tooltip title={open ? 'Ocultar pesajes' : 'Ver pesajes'}>
                      <IconButton aria-label={`${open ? 'Ocultar' : 'Ver'} pesajes de ${item.op_raw}`} size="small" onClick={() => onToggle(item)}>
                        {open ? <ExpandLessOutlinedIcon /> : <ExpandMoreOutlinedIcon />}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={8} sx={{ p: 0, borderBottom: open ? undefined : 0 }}>
                    <Collapse in={open} timeout="auto" unmountOnExit>
                      <Box sx={{ p: 1.25, bgcolor: '#FAFAFA' }}><Detail state={details[key]} /></Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function MobileOrders({ items, expanded, details, onToggle }) {
  return (
    <Stack spacing={1}>
      {items.map((item) => {
        const key = `${item.station_id}:${item.op_raw}`;
        const open = expanded === key;
        return (
          <Paper key={key} variant="outlined" sx={{ p: 1.5, borderRadius: 1 }} data-testid={`legacy-order-${item.op_raw}`}>
            <Stack spacing={1.25}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                <OrderIdentity item={item} /><StatusChip value={item.status} />
              </Stack>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
                <Box><Typography variant="caption" color="text.secondary">Peso activo</Typography><Typography variant="body2" sx={{ fontWeight: 800 }}>{kg(item.active_weight_kg)}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Bolsas</Typography><Typography variant="body2" sx={{ fontWeight: 800 }}>{item.active_bags} activas · {item.deleted_bags} eliminadas</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Colores</Typography><Typography variant="body2">{item.colors.join(', ') || 'Sin color'}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Máquinas</Typography><Typography variant="body2">{item.machines.join(', ') || 'Sin máquina'}</Typography></Box>
              </Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" color="text.secondary">{dateTime(item.last_capture_at_utc)}</Typography>
                <IconButton aria-label={`${open ? 'Ocultar' : 'Ver'} pesajes de ${item.op_raw}`} size="small" onClick={() => onToggle(item)}>
                  {open ? <ExpandLessOutlinedIcon /> : <ExpandMoreOutlinedIcon />}
                </IconButton>
              </Stack>
              <Collapse in={open} timeout="auto" unmountOnExit><Detail state={details[key]} /></Collapse>
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}

export default function LegacyProductionOrders() {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const [queryDraft, setQueryDraft] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [details, setDetails] = useState({});

  useEffect(() => {
    const controller = new AbortController();
    getLegacyProductionOrders({ page, query, status, signal: controller.signal })
      .then((payload) => {
        setData(payload);
        setError(false);
      })
      .catch((requestError) => {
        if (requestError?.name !== 'CanceledError' && requestError?.name !== 'AbortError') setError(true);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, query, status, refresh]);

  const submitSearch = (event) => {
    event.preventDefault();
    setLoading(true);
    setPage(1);
    setQuery(queryDraft.trim());
    setRefresh((value) => value + 1);
    setExpanded(null);
  };
  const toggle = async (item) => {
    const key = `${item.station_id}:${item.op_raw}`;
    if (expanded === key) return setExpanded(null);
    setExpanded(key);
    if (details[key]) return;
    setDetails((current) => ({ ...current, [key]: { loading: true } }));
    try {
      const detail = await getLegacyProductionOrderDetail({ stationId: item.station_id, op: item.op_raw });
      setDetails((current) => ({ ...current, [key]: { data: detail } }));
    } catch {
      setDetails((current) => ({ ...current, [key]: { error: true } }));
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 1600, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <HistoryOutlinedIcon color="primary" />
            <Typography component="h1" variant="h4" sx={{ fontWeight: 800, fontSize: { xs: 24, md: 30 } }}>Historial de OP por pesajes</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">Registro acumulado reportado por las estaciones de pesaje.</Typography>
        </Box>
        <Tooltip title="Actualizar"><span><IconButton disabled={loading} aria-label="Actualizar historial" onClick={() => { setLoading(true); setRefresh((value) => value + 1); }} sx={{ border: '1px solid', borderColor: 'divider' }}><RefreshOutlinedIcon /></IconButton></span></Tooltip>
      </Stack>

      <Alert severity="info" sx={{ mb: 2, borderRadius: 1 }}>Fuente legacy de consulta: no confirma inventario SCM ni corrige automáticamente códigos, colores o cierres.</Alert>

      <Paper variant="outlined" sx={{ mb: 2, borderRadius: 1 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(5, minmax(0, 1fr))' } }}>
          <Metric icon={<AssignmentOutlinedIcon fontSize="small" />} label="OP REGISTRADAS" value={data?.summary.raw_orders || 0} />
          <Metric icon={<ScaleOutlinedIcon fontSize="small" />} label="PESO ACTIVO" value={kg(data?.summary.active_weight_kg)} />
          <Metric icon={<HistoryOutlinedIcon fontSize="small" />} label="BOLSAS ACTIVAS" value={data?.summary.active_bags || 0} />
          <Metric icon={<HistoryOutlinedIcon fontSize="small" />} label="OP CERRADAS" value={data?.summary.closed_orders || 0} />
          <Metric icon={<WarningAmberOutlinedIcon fontSize="small" />} label="PENDIENTES" value={data?.summary.pending_mapping_orders || 0} />
        </Box>
      </Paper>

      <Paper component="form" onSubmit={submitSearch} variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 1 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
          <TextField label="OP o molde" value={queryDraft} onChange={(event) => setQueryDraft(event.target.value)} size="small" sx={{ flex: 1, maxWidth: { sm: 420 } }} />
          <TextField select label="Estado" value={status} onChange={(event) => { setLoading(true); setStatus(event.target.value); setPage(1); setExpanded(null); }} size="small" sx={{ minWidth: 210 }}>
            <MenuItem value="">Todos los estados</MenuItem>
            {Object.entries(statusOptions).map(([value, config]) => <MenuItem key={value} value={value}>{config.label}</MenuItem>)}
          </TextField>
          <Button type="submit" variant="contained" startIcon={<SearchOutlinedIcon />}>Buscar</Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>No se pudo consultar el historial de pesajes.</Alert>}
      {loading && !data && <Box sx={{ minHeight: 280, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>}
      {data?.items.length > 0 && (mobile
        ? <MobileOrders items={data.items} expanded={expanded} details={details} onToggle={toggle} />
        : <DesktopOrders items={data.items} expanded={expanded} details={details} onToggle={toggle} />)}
      {data && data.items.length === 0 && !loading && <Paper variant="outlined" sx={{ py: 8, textAlign: 'center', borderRadius: 1 }}><Typography color="text.secondary">No hay OP legacy para los filtros seleccionados.</Typography></Paper>}
      {(data?.pagination.pages || 0) > 1 && <Stack alignItems="center" sx={{ mt: 2 }}><Pagination count={data.pagination.pages} page={page} onChange={(_event, value) => { setLoading(true); setPage(value); setExpanded(null); }} color="primary" /></Stack>}
    </Box>
  );
}
