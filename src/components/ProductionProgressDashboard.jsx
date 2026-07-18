import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  LinearProgress,
  MenuItem,
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
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ExpandLessOutlinedIcon from '@mui/icons-material/ExpandLessOutlined';
import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import ScaleOutlinedIcon from '@mui/icons-material/ScaleOutlined';
import SensorsOutlinedIcon from '@mui/icons-material/SensorsOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { getProductionProgress } from '../services/productionProgress';


const statusConfig = {
  RECIENTE: { label: 'Reciente', color: 'success' },
  ATRASADA: { label: 'Atrasada', color: 'warning' },
  SIN_COMUNICACION: { label: 'Sin comunicación', color: 'error' },
  NUNCA_REPORTO: { label: 'Sin heartbeat', color: 'default' },
};

const kg = (value) => `${Number(value || 0).toFixed(3)} kg`;

const formatDateTime = (value) => {
  if (!value) return 'Sin reporte';
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const limaDate = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

function Metric({ icon, label, value, detail, accent, testId }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        minHeight: 96,
        p: 1.75,
        borderRadius: 1,
        borderTop: `3px solid ${accent}`,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ color: 'text.secondary' }}>
        {icon}
        <Typography variant="caption" sx={{ fontWeight: 700 }}>{label}</Typography>
      </Stack>
      <Typography
        data-testid={testId}
        variant="h6"
        sx={{ mt: 0.75, fontWeight: 800, lineHeight: 1.15, overflowWrap: 'anywhere' }}
      >
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">{detail}</Typography>
    </Paper>
  );
}

function MonthlyValue({ icon, label, value, detail, testId }) {
  return (
    <Box sx={{ minWidth: 0, py: 0.75 }}>
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ color: 'text.secondary' }}>
        {icon}
        <Typography variant="caption" sx={{ fontWeight: 750 }}>{label}</Typography>
      </Stack>
      <Typography
        data-testid={testId}
        variant="h6"
        sx={{ mt: 0.5, fontWeight: 850, lineHeight: 1.15, overflowWrap: 'anywhere' }}
      >
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">{detail}</Typography>
    </Box>
  );
}

function MonthlySummary({ summary }) {
  if (!summary) return null;
  const monthLabel = new Intl.DateTimeFormat('es-PE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${summary.month}-01T12:00:00Z`));
  return (
    <Paper variant="outlined" sx={{ p: 1.75, mb: 2, borderRadius: 1 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <CalendarMonthOutlinedIcon color="primary" fontSize="small" />
        <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 850 }}>
          Resumen mensual · {monthLabel}
        </Typography>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, minmax(0, 1fr))' },
          columnGap: 2,
          rowGap: 1,
        }}
      >
        <MonthlyValue
          detail="Peso neto reportado"
          icon={<ScaleOutlinedIcon fontSize="small" />}
          label="PESO DEL MES"
          testId="monthly-total-weight"
          value={kg(summary.weight_kg)}
        />
        <MonthlyValue
          detail="Capturas activas"
          icon={<Inventory2OutlinedIcon fontSize="small" />}
          label="BOLSAS DEL MES"
          testId="monthly-total-bags"
          value={summary.bags || 0}
        />
        <MonthlyValue
          detail="Órdenes distintas con pesajes"
          icon={<AssignmentOutlinedIcon fontSize="small" />}
          label="OP DEL MES"
          testId="monthly-production-orders"
          value={summary.production_orders || 0}
        />
        <MonthlyValue
          detail={`${summary.production_days || 0} días con producción`}
          icon={<TrendingUpOutlinedIcon fontSize="small" />}
          label="PROMEDIO DIARIO"
          testId="monthly-daily-average"
          value={kg(summary.average_daily_weight_kg)}
        />
      </Box>
    </Paper>
  );
}

function CommunicationChip({ status }) {
  const config = statusConfig[status] || statusConfig.NUNCA_REPORTO;
  return <Chip size="small" variant="outlined" color={config.color} label={config.label} />;
}

function ProgressValue({ item }) {
  if (item.progress_percent === null || item.progress_percent === undefined) {
    return (
      <Stack spacing={0.4}>
        <Chip size="small" variant="outlined" label="Sin meta" />
        <Typography variant="caption" color="text.secondary">
          {item.target_status === 'OP_NOT_FOUND' ? 'OP no encontrada en central' : 'Meta no configurada'}
        </Typography>
      </Stack>
    );
  }
  return (
    <Box sx={{ minWidth: 116 }}>
      <Stack direction="row" justifyContent="space-between" spacing={1}>
        <Typography variant="body2" sx={{ fontWeight: 800 }}>{item.progress_percent}%</Typography>
        <Typography variant="caption" color="text.secondary">de {kg(item.target_kg)}</Typography>
      </Stack>
      <LinearProgress
        aria-label={`Avance ${item.op || 'sin OP'}`}
        color={item.progress_percent >= 100 ? 'success' : 'primary'}
        variant="determinate"
        value={Math.min(100, item.progress_percent)}
        sx={{ mt: 0.65, height: 7, borderRadius: 1 }}
      />
    </Box>
  );
}

function DetailRows({ item }) {
  const rowId = item.op || 'SIN-OP';
  return (
    <Box data-testid={`progress-detail-${rowId}`} sx={{ minWidth: 0 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr) minmax(0, 1fr)',
            lg: '100px minmax(130px, 1fr) minmax(120px, 1fr) 110px 100px 80px 105px',
          },
          gap: 1,
          px: 1.5,
          pb: 0.75,
          color: 'text.secondary',
        }}
      >
        {['OT', 'Molde', 'Color', 'Máquina', 'Turno', 'Bolsas', 'Peso'].map((label) => (
          <Typography key={label} variant="caption" sx={{ fontWeight: 800 }}>{label}</Typography>
        ))}
      </Box>
      {item.details.map((detail, index) => (
        <Box
          key={`${detail.station_id}-${detail.ot || 'sin-ot'}-${index}`}
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr) minmax(0, 1fr)',
              lg: '100px minmax(130px, 1fr) minmax(120px, 1fr) 110px 100px 80px 105px',
            },
            gap: 1,
            alignItems: 'center',
            px: 1.5,
            py: 1,
            borderTop: '1px solid #EEEEEE',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{detail.ot || 'Sin OT'}</Typography>
          <Typography variant="body2">{detail.mold || 'Sin molde'}</Typography>
          <Typography variant="body2">{detail.color || 'Sin color'}</Typography>
          <Typography variant="body2">{detail.machine_code || 'Sin máquina'}</Typography>
          <Typography variant="body2">{detail.shift || 'Sin turno'}</Typography>
          <Typography variant="body2">{detail.bags}</Typography>
          <Typography variant="body2" sx={{ fontWeight: 800 }}>{kg(detail.weight_kg)}</Typography>
        </Box>
      ))}
    </Box>
  );
}

function DesktopTable({ items, expanded, onToggle }) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
      <Table size="small" aria-label="Avance por orden de producción">
        <TableHead>
          <TableRow sx={{ bgcolor: '#F7F8FA' }}>
            <TableCell>Orden de producción</TableCell>
            <TableCell>Avance</TableCell>
            <TableCell>Peso reportado</TableCell>
            <TableCell align="right">Bolsas</TableCell>
            <TableCell>Estación</TableCell>
            <TableCell>Última captura</TableCell>
            <TableCell padding="checkbox" />
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => {
            const rowId = item.op || 'SIN-OP';
            const isExpanded = expanded === rowId;
            return (
              <Fragment key={rowId}>
                <TableRow data-testid={`progress-row-${rowId}`} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 850 }}>{item.op || 'Sin OP'}</Typography>
                    <Typography variant="caption" color="text.secondary">{item.product || 'Sin producto central'}</Typography>
                  </TableCell>
                  <TableCell><ProgressValue item={item} /></TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 800 }}>{kg(item.weight_kg)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.target_kg ? `Meta ${kg(item.target_kg)}` : 'Meta no disponible'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{item.bags}</TableCell>
                  <TableCell>
                    <Stack spacing={0.6} alignItems="flex-start">
                      <Typography variant="body2">{item.stations[0]?.code || 'Sin estación'}</Typography>
                      <CommunicationChip status={item.communication_status} />
                    </Stack>
                  </TableCell>
                  <TableCell>{formatDateTime(item.last_capture_at_utc)}</TableCell>
                  <TableCell padding="checkbox">
                    <Tooltip title={isExpanded ? 'Ocultar detalle' : 'Ver detalle'}>
                      <IconButton
                        aria-label={`${isExpanded ? 'Ocultar' : 'Ver'} detalle de ${item.op || 'pesajes sin OP'}`}
                        onClick={() => onToggle(rowId)}
                        size="small"
                      >
                        {isExpanded ? <ExpandLessOutlinedIcon /> : <ExpandMoreOutlinedIcon />}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={7} sx={{ p: 0, borderBottom: isExpanded ? undefined : 0 }}>
                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                      <Box sx={{ py: 1.25, bgcolor: '#FAFAFA' }}><DetailRows item={item} /></Box>
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

function MobileList({ items, expanded, onToggle }) {
  return (
    <Stack spacing={1}>
      {items.map((item) => {
        const rowId = item.op || 'SIN-OP';
        const isExpanded = expanded === rowId;
        return (
          <Paper key={rowId} data-testid={`progress-row-${rowId}`} variant="outlined" sx={{ borderRadius: 1, p: 1.5 }}>
            <Stack spacing={1.25}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>{item.op || 'Sin OP'}</Typography>
                  <Typography variant="caption" color="text.secondary">{item.product || 'Sin producto central'}</Typography>
                </Box>
                <CommunicationChip status={item.communication_status} />
              </Stack>
              <ProgressValue item={item} />
              <Stack direction="row" justifyContent="space-between" spacing={1}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Peso</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>{kg(item.weight_kg)}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Bolsas</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>{item.bags}</Typography>
                </Box>
              </Stack>
              <Divider />
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  {item.stations[0]?.code || 'Sin estación'} · {formatDateTime(item.last_capture_at_utc)}
                </Typography>
                <IconButton
                  aria-label={`${isExpanded ? 'Ocultar' : 'Ver'} detalle de ${item.op || 'pesajes sin OP'}`}
                  onClick={() => onToggle(rowId)}
                  size="small"
                >
                  {isExpanded ? <ExpandLessOutlinedIcon /> : <ExpandMoreOutlinedIcon />}
                </IconButton>
              </Stack>
              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                <DetailRows item={item} />
              </Collapse>
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}

function LoadingState() {
  return (
    <Box sx={{ minHeight: 280, display: 'grid', placeItems: 'center' }}>
      <Stack alignItems="center" spacing={1.5}>
        <CircularProgress size={30} />
        <Typography variant="body2" color="text.secondary">Consultando avance de producción...</Typography>
      </Stack>
    </Box>
  );
}

export default function ProductionProgressDashboard({ initialDate }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [date, setDate] = useState(initialDate || limaDate());
  const [op, setOp] = useState('');
  const [machine, setMachine] = useState('');
  const [shift, setShift] = useState('');
  const [data, setData] = useState(null);
  const [filterOptions, setFilterOptions] = useState({ ops: [], machines: [], shifts: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await getProductionProgress({
          date,
          ...(op ? { op } : {}),
          ...(machine ? { machine_code: machine } : {}),
          ...(shift ? { shift } : {}),
          signal: controller.signal,
        });
        setData(payload);
        const details = payload.items.flatMap((item) => item.details || []);
        setFilterOptions((current) => ({
          ops: [...new Set([...current.ops, ...payload.items.map((item) => item.op).filter(Boolean)])].sort(),
          machines: [...new Set([...current.machines, ...details.map((detail) => detail.machine_code).filter(Boolean)])].sort(),
          shifts: [...new Set([...current.shifts, ...details.map((detail) => detail.shift).filter(Boolean)])].sort(),
        }));
      } catch (requestError) {
        if (requestError?.name !== 'CanceledError' && requestError?.name !== 'AbortError') {
          setError('No se pudo consultar el avance de producción. La operación de la balanza no se ve afectada.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    load();
    const interval = window.setInterval(load, 30000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [date, op, machine, shift, refreshKey]);

  const hasDelayedData = data?.items.some((item) => item.communication_status !== 'RECIENTE');
  const itemCountLabel = useMemo(() => {
    const count = data?.summary.production_orders || 0;
    return `${count} ${count === 1 ? 'OP reportada' : 'OP reportadas'}`;
  }, [data]);

  const toggleDetail = (rowId) => setExpanded((current) => (current === rowId ? null : rowId));
  const changeDate = (event) => {
    setDate(event.target.value);
    setOp('');
    setMachine('');
    setShift('');
    setFilterOptions({ ops: [], machines: [], shifts: [] });
    setExpanded(null);
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 1600, mx: 'auto' }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'flex-start' }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
            <ScaleOutlinedIcon color="primary" />
            <Typography component="h1" variant="h4" sx={{ fontWeight: 800, fontSize: { xs: 24, md: 30 } }}>
              Avance de producción por pesajes
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Seguimiento de kilos embolsados por orden de producción y fecha operativa.
          </Typography>
        </Box>
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip color="warning" variant="outlined" label="Reporte local legacy" />
          <Tooltip title="Actualizar ahora">
            <span>
              <IconButton
                aria-label="Actualizar avance"
                disabled={loading}
                onClick={() => setRefreshKey((value) => value + 1)}
                sx={{ border: '1px solid', borderColor: 'divider' }}
              >
                <RefreshOutlinedIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      <Alert severity="info" sx={{ mb: 2, borderRadius: 1 }}>
        Este es un indicador operativo basado en la estación local; no confirma inventario SCM, consumo ni unidad logística.
      </Alert>

      <MonthlySummary summary={data?.monthly_summary} />

      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 1 }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.25} alignItems={{ lg: 'center' }}>
          <TextField
            label="Fecha operativa"
            onChange={changeDate}
            size="small"
            type="date"
            value={date}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: { xs: '100%', lg: 170 }, flexShrink: 0 }}
          />
          <TextField
            label="Orden de producción"
            onChange={(event) => setOp(event.target.value)}
            select
            size="small"
            value={op}
            sx={{ width: { xs: '100%', lg: 190 }, flexShrink: 0 }}
          >
            <MenuItem value="">Todas las OP</MenuItem>
            {filterOptions.ops.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </TextField>
          <TextField
            label="Máquina"
            onChange={(event) => setMachine(event.target.value)}
            select
            size="small"
            value={machine}
            sx={{ width: { xs: '100%', lg: 170 }, flexShrink: 0 }}
          >
            <MenuItem value="">Todas las máquinas</MenuItem>
            {filterOptions.machines.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </TextField>
          <TextField
            label="Turno"
            onChange={(event) => setShift(event.target.value)}
            select
            size="small"
            value={shift}
            sx={{ width: { xs: '100%', lg: 150 }, flexShrink: 0 }}
          >
            <MenuItem value="">Todos los turnos</MenuItem>
            {filterOptions.shifts.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </TextField>
          <Box sx={{ flexGrow: 1 }} />
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: 'text.secondary' }}>
            <AccessTimeOutlinedIcon fontSize="small" />
            <Typography variant="caption">
              {data?.generated_at_utc ? `Último reporte ${formatDateTime(data.generated_at_utc)}` : 'Aún sin reporte'}
            </Typography>
          </Stack>
        </Stack>
      </Paper>

      {loading && data && <LinearProgress sx={{ mb: 1 }} />}
      {error && (
        <Alert
          action={<Button color="inherit" onClick={() => setRefreshKey((value) => value + 1)}>Reintentar</Button>}
          severity="error"
          sx={{ mb: 2, borderRadius: 1 }}
        >
          {error}
        </Alert>
      )}

      {!data && loading ? <LoadingState /> : (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, minmax(0, 1fr))' },
              gap: 1.25,
              mb: 2,
            }}
          >
            <Metric
              accent="#1E3A5F"
              detail="Peso neto informado"
              icon={<ScaleOutlinedIcon fontSize="small" />}
              label="PESO DEL DÍA"
              testId="progress-total-weight"
              value={kg(data?.summary.weight_kg)}
            />
            <Metric
              accent="#2E7D32"
              detail="Capturas activas"
              icon={<Inventory2OutlinedIcon fontSize="small" />}
              label="BOLSAS DEL DÍA"
              testId="progress-total-bags"
              value={data?.summary.bags || 0}
            />
            <Metric
              accent="#D97706"
              detail={itemCountLabel}
              icon={<AssignmentOutlinedIcon fontSize="small" />}
              label="ÓRDENES DEL DÍA"
              value={data?.summary.production_orders || 0}
            />
            <Metric
              accent="#5F6368"
              detail="Con datos en la fecha"
              icon={<SensorsOutlinedIcon fontSize="small" />}
              label="ESTACIONES"
              value={data?.summary.stations_reporting || 0}
            />
          </Box>

          {hasDelayedData && (
            <Alert icon={<WarningAmberOutlinedIcon />} severity="warning" sx={{ mb: 2, borderRadius: 1 }}>
              Hay datos cuya estación no tiene comunicación reciente. Se conserva el último avance recibido sin afirmar que la balanza está apagada.
            </Alert>
          )}

          {data?.items.length ? (
            isMobile
              ? <MobileList expanded={expanded} items={data.items} onToggle={toggleDetail} />
              : <DesktopTable expanded={expanded} items={data.items} onToggle={toggleDetail} />
          ) : (
            <Paper variant="outlined" sx={{ minHeight: 260, display: 'grid', placeItems: 'center', p: 3, borderRadius: 1 }}>
              <Stack alignItems="center" spacing={1} sx={{ textAlign: 'center' }}>
                <ScaleOutlinedIcon sx={{ fontSize: 38, color: 'text.disabled' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 750 }}>Sin pesajes reportados</Typography>
                <Typography variant="body2" color="text.secondary">
                  No hay avance para la fecha y filtros seleccionados.
                </Typography>
              </Stack>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}
