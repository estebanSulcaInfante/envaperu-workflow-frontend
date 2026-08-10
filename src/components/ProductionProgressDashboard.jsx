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
  ToggleButton,
  ToggleButtonGroup,
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
import TodayOutlinedIcon from '@mui/icons-material/TodayOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { getProductionProgress } from '../services/productionProgress';
import DataTableToolbar from './ui/DataTableToolbar';
import { matchesOmniSearch } from '../utils/tableSearch';


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

function DetailCell({ label, children }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: { xs: 'block', lg: 'none' }, mb: 0.25, fontWeight: 750 }}
      >
        {label}
      </Typography>
      {children}
    </Box>
  );
}

function DimensionValues({ values, value, emptyLabel }) {
  const entries = values?.length ? values : value ? [value] : [];
  if (!entries.length) return <Typography variant="body2">{emptyLabel}</Typography>;
  if (entries.length === 1) return <Typography variant="body2">{entries[0]}</Typography>;
  return (
    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
      {entries.map((entry) => (
        <Chip key={entry} label={entry} size="small" variant="outlined" />
      ))}
    </Stack>
  );
}

function DetailRows({ item }) {
  const rowId = item.op || 'SIN-OP';
  return (
    <Box data-testid={`progress-detail-${rowId}`} sx={{ minWidth: 0 }}>
      <Box
        sx={{
          display: { xs: 'none', lg: 'grid' },
          gridTemplateColumns: 'minmax(130px, 1.1fr) 100px minmax(130px, 1fr) 110px minmax(150px, 1fr) 70px 105px',
          gap: 1,
          px: 1.5,
          pb: 0.75,
          color: 'text.secondary',
        }}
      >
        {['Color', 'OT', 'Molde', 'Máquina', 'Turnos', 'Bolsas', 'Peso'].map((label) => (
          <Typography key={label} variant="caption" sx={{ fontWeight: 800 }}>{label}</Typography>
        ))}
      </Box>
      {item.details.map((detail, index) => {
        const shifts = detail.shifts?.length
          ? detail.shifts
          : detail.shift
            ? [detail.shift]
            : [];
        return (
          <Box
            data-testid={`color-group-${detail.color || 'SIN-COLOR'}`}
            key={`${detail.color || 'sin-color'}-${index}`}
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'minmax(130px, 1.1fr) 100px minmax(130px, 1fr) 110px minmax(150px, 1fr) 70px 105px',
              },
              gap: 1,
              alignItems: 'center',
              px: 1.5,
              py: 1,
              borderTop: '1px solid #EEEEEE',
            }}
          >
            <DetailCell label="Color">
              <Typography variant="body2" sx={{ fontWeight: 800 }}>{detail.color || 'Sin color'}</Typography>
            </DetailCell>
            <DetailCell label="OT">
              <DimensionValues emptyLabel="Sin OT" value={detail.ot} values={detail.ots} />
            </DetailCell>
            <DetailCell label="Molde">
              <DimensionValues emptyLabel="Sin molde" value={detail.mold} values={detail.molds} />
            </DetailCell>
            <DetailCell label="Máquina">
              <DimensionValues
                emptyLabel="Sin máquina"
                value={detail.machine_code}
                values={detail.machine_codes}
              />
            </DetailCell>
            <DetailCell label="Turnos">
              <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                {shifts.length
                  ? shifts.map((value) => <Chip key={value} label={value} size="small" variant="outlined" />)
                  : <Typography variant="body2">Sin turno</Typography>}
              </Stack>
            </DetailCell>
            <DetailCell label="Bolsas">
              <Typography variant="body2">{detail.bags}</Typography>
            </DetailCell>
            <DetailCell label="Peso">
              <Typography variant="body2" sx={{ fontWeight: 800 }}>{kg(detail.weight_kg)}</Typography>
            </DetailCell>
          </Box>
        );
      })}
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

export default function ProductionProgressDashboard({ initialDate, initialPeriod = 'month' }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const initialOperationalDate = initialDate || limaDate();
  const [period, setPeriod] = useState(initialPeriod);
  const [date, setDate] = useState(initialOperationalDate);
  const [month, setMonth] = useState(initialOperationalDate.slice(0, 7));
  const [op, setOp] = useState('');
  const [machine, setMachine] = useState('');
  const [shift, setShift] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [filterOptions, setFilterOptions] = useState({ ops: [], machines: [], shifts: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    let requestInFlight = false;
    const load = async () => {
      if (requestInFlight || document.visibilityState === 'hidden') return;
      requestInFlight = true;
      setLoading(true);
      setError(null);
      try {
        const payload = await getProductionProgress({
          period,
          ...(period === 'month' ? { month } : { date }),
          ...(op ? { op } : {}),
          ...(machine ? { machine_code: machine } : {}),
          ...(shift ? { shift } : {}),
          signal: controller.signal,
        });
        setData(payload);
        const details = payload.items.flatMap((item) => item.details || []);
        const reportedShifts = details.flatMap((detail) => (
          detail.shifts?.length ? detail.shifts : [detail.shift]
        )).filter(Boolean);
        const reportedMachines = details.flatMap((detail) => (
          detail.machine_codes?.length ? detail.machine_codes : [detail.machine_code]
        )).filter(Boolean);
        setFilterOptions((current) => ({
          ops: [...new Set([...current.ops, ...payload.items.map((item) => item.op).filter(Boolean)])].sort(),
          machines: [...new Set([...current.machines, ...reportedMachines])].sort(),
          shifts: [...new Set([...current.shifts, ...reportedShifts])].sort(),
        }));
      } catch (requestError) {
        if (requestError?.name !== 'CanceledError' && requestError?.name !== 'AbortError') {
          setError('No se pudo consultar el avance de producción. La operación de la balanza no se ve afectada.');
        }
      } finally {
        requestInFlight = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    load();
    const interval = window.setInterval(load, period === 'month' ? 300000 : 30000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [period, month, date, op, machine, shift, refreshKey]);

  const hasDelayedData = data?.items.some((item) => item.communication_status !== 'RECIENTE');
  const visibleItems = useMemo(
    () => (data?.items || []).filter((item) => matchesOmniSearch(item, search)),
    [data, search],
  );
  const itemCountLabel = useMemo(() => {
    const count = data?.summary.production_orders || 0;
    return `${count} ${count === 1 ? 'OP reportada' : 'OP reportadas'}`;
  }, [data]);

  const toggleDetail = (rowId) => setExpanded((current) => (current === rowId ? null : rowId));
  const resetTemporalScope = () => {
    setOp('');
    setMachine('');
    setShift('');
    setSearch('');
    setFilterOptions({ ops: [], machines: [], shifts: [] });
    setExpanded(null);
    setData(null);
  };
  const changePeriod = (_event, value) => {
    if (!value || value === period) return;
    setPeriod(value);
    resetTemporalScope();
  };
  const changeDate = (event) => {
    setDate(event.target.value);
    resetTemporalScope();
  };
  const changeMonth = (event) => {
    setMonth(event.target.value);
    resetTemporalScope();
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
            Seguimiento de kilos embolsados por orden de producción y periodo operativo.
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

      <Box sx={{ mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems={{ md: 'center' }} sx={{ mb: 1.25 }}>
          <ToggleButtonGroup
            aria-label="Periodo del avance"
            color="primary"
            exclusive
            onChange={changePeriod}
            size="small"
            value={period}
            sx={{ alignSelf: { xs: 'stretch', md: 'auto' } }}
          >
            <ToggleButton value="month" sx={{ flex: { xs: 1, md: 'initial' }, gap: 0.75 }}>
              <CalendarMonthOutlinedIcon fontSize="small" />
              Mes
            </ToggleButton>
            <ToggleButton value="day" sx={{ flex: { xs: 1, md: 'initial' }, gap: 0.75 }}>
              <TodayOutlinedIcon fontSize="small" />
              Día
            </ToggleButton>
          </ToggleButtonGroup>
          {period === 'month' ? (
            <TextField
              label="Mes operativo"
              onChange={changeMonth}
              size="small"
              type="month"
              value={month}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ width: { xs: '100%', md: 180 }, flexShrink: 0 }}
            />
          ) : (
            <TextField
              label="Fecha operativa"
              onChange={changeDate}
              size="small"
              type="date"
              value={date}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ width: { xs: '100%', md: 180 }, flexShrink: 0 }}
            />
          )}
          <Box sx={{ flexGrow: 1 }} />
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: 'text.secondary' }}>
            <AccessTimeOutlinedIcon fontSize="small" />
            <Typography variant="caption">
              {data?.generated_at_utc ? `Último reporte ${formatDateTime(data.generated_at_utc)}` : 'Aún sin reporte'}
            </Typography>
          </Stack>
        </Stack>
        <DataTableToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar OP, OT, molde, color, máquina o estación"
          resultCount={visibleItems.length}
          totalCount={data?.items.length}
          filters={[
            {
              id: 'op',
              label: 'Orden de producción',
              value: op,
              allValue: '',
              onChange: (value) => setOp(value),
              options: [
                { value: '', label: 'Todas las OP' },
                ...filterOptions.ops.map((value) => ({ value, label: value })),
              ],
            },
            {
              id: 'machine',
              label: 'Máquina',
              value: machine,
              allValue: '',
              onChange: (value) => setMachine(value),
              options: [
                { value: '', label: 'Todas las máquinas' },
                ...filterOptions.machines.map((value) => ({ value, label: value })),
              ],
            },
            {
              id: 'shift',
              label: 'Turno',
              value: shift,
              allValue: '',
              onChange: (value) => setShift(value),
              options: [
                { value: '', label: 'Todos los turnos' },
                ...filterOptions.shifts.map((value) => ({ value, label: value })),
              ],
            },
          ]}
          onClear={() => {
            setSearch('');
            setOp('');
            setMachine('');
            setShift('');
            setExpanded(null);
          }}
        />
      </Box>

      {period === 'day' && <MonthlySummary summary={data?.monthly_summary} />}

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
              detail={period === 'month' ? 'Peso neto del periodo' : 'Peso neto informado'}
              icon={<ScaleOutlinedIcon fontSize="small" />}
              label={period === 'month' ? 'PESO DEL MES' : 'PESO DEL DÍA'}
              testId="progress-total-weight"
              value={kg(data?.summary.weight_kg)}
            />
            <Metric
              accent="#2E7D32"
              detail="Capturas activas"
              icon={<Inventory2OutlinedIcon fontSize="small" />}
              label={period === 'month' ? 'BOLSAS DEL MES' : 'BOLSAS DEL DÍA'}
              testId="progress-total-bags"
              value={data?.summary.bags || 0}
            />
            <Metric
              accent="#D97706"
              detail={itemCountLabel}
              icon={<AssignmentOutlinedIcon fontSize="small" />}
              label={period === 'month' ? 'ÓRDENES DEL MES' : 'ÓRDENES DEL DÍA'}
              value={data?.summary.production_orders || 0}
            />
            <Metric
              accent="#5F6368"
              detail={period === 'month'
                ? `${data?.monthly_summary?.production_days || 0} días con producción`
                : 'Con datos en la fecha'}
              icon={period === 'month'
                ? <TrendingUpOutlinedIcon fontSize="small" />
                : <SensorsOutlinedIcon fontSize="small" />}
              label={period === 'month' ? 'PROMEDIO DIARIO' : 'ESTACIONES'}
              value={period === 'month'
                ? kg(data?.monthly_summary?.average_daily_weight_kg)
                : data?.summary.stations_reporting || 0}
            />
          </Box>

          {hasDelayedData && (
            <Alert icon={<WarningAmberOutlinedIcon />} severity="warning" sx={{ mb: 2, borderRadius: 1 }}>
              Hay datos cuya estación no tiene comunicación reciente. Se conserva el último avance recibido sin afirmar que la balanza está apagada.
            </Alert>
          )}

          {visibleItems.length ? (
            isMobile
              ? <MobileList expanded={expanded} items={visibleItems} onToggle={toggleDetail} />
              : <DesktopTable expanded={expanded} items={visibleItems} onToggle={toggleDetail} />
          ) : (
            <Paper variant="outlined" sx={{ minHeight: 260, display: 'grid', placeItems: 'center', p: 3, borderRadius: 1 }}>
              <Stack alignItems="center" spacing={1} sx={{ textAlign: 'center' }}>
                <ScaleOutlinedIcon sx={{ fontSize: 38, color: 'text.disabled' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 750 }}>Sin pesajes reportados</Typography>
                <Typography variant="body2" color="text.secondary">
                  No hay avance para el periodo y filtros seleccionados.
                </Typography>
              </Stack>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}
