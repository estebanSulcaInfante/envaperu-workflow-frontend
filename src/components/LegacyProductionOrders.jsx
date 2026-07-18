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
  Snackbar,
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
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import ExpandLessOutlinedIcon from '@mui/icons-material/ExpandLessOutlined';
import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import ScaleOutlinedIcon from '@mui/icons-material/ScaleOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import {
  createPilotCommand,
  getLegacyProductionOrderDetail,
  getLegacyProductionOrders,
} from '../services/legacyProductionOrders';


const statusOptions = {
  ABIERTA_PILOTO: { label: 'Abierta', color: 'success' },
  CERRADA_LEGACY: { label: 'Cerrada', color: 'default' },
  CIERRE_PENDIENTE: { label: 'Cierre pendiente', color: 'warning' },
  REAPERTURA_PENDIENTE: { label: 'Reapertura pendiente', color: 'warning' },
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
      {item.mapping_status === 'PENDIENTE_MAPEO' && (
        <Typography variant="caption" color="error.main" sx={{ display: 'block' }}>
          Código pendiente de mapeo
        </Typography>
      )}
    </Box>
  );
}

function Detail({ item, state, onRequestCommand }) {
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
            <TableCell padding="checkbox" />
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
                  color={capture.is_deleted ? 'default' : capture.pending_command ? 'warning' : 'success'}
                  label={capture.is_deleted ? 'Anulado' : capture.pending_command ? 'Anulación pendiente' : 'Activo'}
                  size="small"
                  variant="outlined"
                />
              </TableCell>
              <TableCell padding="checkbox">
                <IconButton
                  aria-label={`Anular pesaje ${capture.legacy_id}`}
                  color="error"
                  disabled={capture.is_deleted || Boolean(capture.pending_command)}
                  onClick={() => onRequestCommand({ action: 'VOID_CAPTURE', item, capture })}
                  size="small"
                  title="Anular pesaje"
                >
                  <DeleteOutlineOutlinedIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function DesktopOrders({ items, expanded, details, onRequestCommand, onToggle }) {
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
                    <Stack direction="row">
                      <Button
                        aria-label={`${item.status === 'CERRADA_LEGACY' ? 'Reabrir' : 'Cerrar'} ${item.op_raw}`}
                        disabled={Boolean(item.pending_command)}
                        startIcon={item.status === 'CERRADA_LEGACY' ? <LockOpenOutlinedIcon /> : <LockOutlinedIcon />}
                        onClick={() => onRequestCommand({
                          action: item.status === 'CERRADA_LEGACY' ? 'REOPEN_OP' : 'CLOSE_OP',
                          item,
                        })}
                        size="small"
                      >
                        {item.status === 'CERRADA_LEGACY' ? 'Reabrir' : 'Cerrar'}
                      </Button>
                      <Tooltip title={open ? 'Ocultar pesajes' : 'Ver pesajes'}>
                        <IconButton aria-label={`${open ? 'Ocultar' : 'Ver'} pesajes de ${item.op_raw}`} size="small" onClick={() => onToggle(item)}>
                          {open ? <ExpandLessOutlinedIcon /> : <ExpandMoreOutlinedIcon />}
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={8} sx={{ p: 0, borderBottom: open ? undefined : 0 }}>
                    <Collapse in={open} timeout="auto" unmountOnExit>
                      <Box sx={{ p: 1.25, bgcolor: '#FAFAFA' }}><Detail item={item} state={details[key]} onRequestCommand={onRequestCommand} /></Box>
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

function MobileOrders({ items, expanded, details, onRequestCommand, onToggle }) {
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
                <Stack direction="row">
                  <IconButton
                    aria-label={`${item.status === 'CERRADA_LEGACY' ? 'Reabrir' : 'Cerrar'} ${item.op_raw}`}
                    disabled={Boolean(item.pending_command)}
                    onClick={() => onRequestCommand({
                      action: item.status === 'CERRADA_LEGACY' ? 'REOPEN_OP' : 'CLOSE_OP',
                      item,
                    })}
                    size="small"
                  >
                    {item.status === 'CERRADA_LEGACY' ? <LockOpenOutlinedIcon /> : <LockOutlinedIcon />}
                  </IconButton>
                  <IconButton aria-label={`${open ? 'Ocultar' : 'Ver'} pesajes de ${item.op_raw}`} size="small" onClick={() => onToggle(item)}>
                    {open ? <ExpandLessOutlinedIcon /> : <ExpandMoreOutlinedIcon />}
                  </IconButton>
                </Stack>
              </Stack>
              <Collapse in={open} timeout="auto" unmountOnExit><Detail item={item} state={details[key]} onRequestCommand={onRequestCommand} /></Collapse>
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
  const [command, setCommand] = useState(null);
  const [requestedBy, setRequestedBy] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

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
  const openCommand = (target) => {
    setRequestedBy('');
    setReason('');
    setCommand(target);
  };
  const closeCommand = () => {
    if (!submitting) {
      setCommand(null);
      setRequestedBy('');
      setReason('');
    }
  };
  const submitCommand = async () => {
    if (!command || !requestedBy.trim() || !reason.trim()) return;
    setSubmitting(true);
    try {
      await createPilotCommand({
        stationId: command.item.station_id,
        action: command.action,
        legacyPesajeId: command.capture?.legacy_id,
        op: command.item.op_raw,
        requestedBy: requestedBy.trim(),
        reason: reason.trim(),
      });
      setNotice('Comando registrado. La estación lo aplicará al conectarse.');
      setCommand(null);
      setRequestedBy('');
      setReason('');
      setDetails({});
      setExpanded(null);
      setLoading(true);
      setRefresh((value) => value + 1);
    } catch (requestError) {
      setNotice(requestError?.response?.data?.message || 'No se pudo registrar el comando.');
    } finally {
      setSubmitting(false);
    }
  };

  const commandTitle = command?.action === 'VOID_CAPTURE'
    ? `Anular pesaje ${command.capture?.legacy_id}`
    : command?.action === 'CLOSE_OP'
      ? `Cerrar ${command.item?.op_raw}`
      : `Reabrir ${command?.item?.op_raw}`;

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
        ? <MobileOrders items={data.items} expanded={expanded} details={details} onRequestCommand={openCommand} onToggle={toggle} />
        : <DesktopOrders items={data.items} expanded={expanded} details={details} onRequestCommand={openCommand} onToggle={toggle} />)}
      {data && data.items.length === 0 && !loading && <Paper variant="outlined" sx={{ py: 8, textAlign: 'center', borderRadius: 1 }}><Typography color="text.secondary">No hay OP legacy para los filtros seleccionados.</Typography></Paper>}
      {(data?.pagination.pages || 0) > 1 && <Stack alignItems="center" sx={{ mt: 2 }}><Pagination count={data.pagination.pages} page={page} onChange={(_event, value) => { setLoading(true); setPage(value); setExpanded(null); }} color="primary" /></Stack>}

      {command && (
        <Box
          aria-labelledby="pilot-command-title"
          aria-modal="true"
          role="dialog"
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: (themeValue) => themeValue.zIndex.modal,
            bgcolor: 'rgba(0, 0, 0, 0.48)',
            display: 'grid',
            placeItems: 'center',
            p: 2,
          }}
        >
          <Paper sx={{ width: '100%', maxWidth: 560, p: 2.5, borderRadius: 1 }}>
            <Typography component="h2" id="pilot-command-title" variant="h6" sx={{ fontWeight: 800, mb: 2 }}>{commandTitle}</Typography>
            <Alert severity={command.action === 'VOID_CAPTURE' ? 'warning' : 'info'} sx={{ mb: 2 }}>
              La acción se enviará a la estación y conservará su auditoría. Si está desconectada quedará pendiente.
            </Alert>
            <Stack spacing={2}>
              <TextField
                autoFocus
                label="Responsable"
                value={requestedBy}
                onChange={(event) => setRequestedBy(event.target.value)}
                inputProps={{ maxLength: 120 }}
                required
              />
              <TextField
                label="Motivo"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                inputProps={{ maxLength: 500 }}
                minRows={3}
                multiline
                required
              />
              <Stack direction="row" justifyContent="flex-end" spacing={1}>
                <Button onClick={closeCommand} disabled={submitting}>Cancelar</Button>
                <Button
                  color={command.action === 'VOID_CAPTURE' ? 'error' : 'primary'}
                  disabled={submitting || !requestedBy.trim() || !reason.trim()}
                  onClick={submitCommand}
                  variant="contained"
                >
                  {submitting ? 'Registrando...' : 'Confirmar'}
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Box>
      )}
      <Snackbar
        autoHideDuration={5000}
        message={notice}
        onClose={() => setNotice('')}
        open={Boolean(notice)}
      />
    </Box>
  );
}
