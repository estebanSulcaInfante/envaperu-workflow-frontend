import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import ScaleOutlinedIcon from '@mui/icons-material/ScaleOutlined';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import ApiPendingButton from './ApiPendingButton';
import DataTableToolbar from './ui/DataTableToolbar';
import PageHeader from './ui/PageHeader';
import { obtenerPreparacionMateriales } from '../services/preparacionMateriales';
import { matchesOmniSearch, uniqueOptions } from '../utils/tableSearch';

const stages = ['Plan', 'Reserva', 'Emisión', 'Premezcla', 'Máquina'];

const formatKg = (value) => `${Number(value || 0).toFixed(3)} kg`;

const formatDateTime = (value) => new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'short',
  timeStyle: 'short',
}).format(new Date(value));

const getRequirementStatus = (item) => {
  if (item.consumidoMaquinaKg > 0) return { label: 'En máquina', color: 'success' };
  if (item.consumidoPreparacionKg >= item.planKg) return { label: 'Preparado', color: 'info' };
  if (item.emitidoKg > 0) return { label: 'Emitido', color: 'warning' };
  if (item.reservadoKg >= item.planKg) return { label: 'Reservado', color: 'primary' };
  if (item.reservadoKg > 0) return { label: 'Reserva parcial', color: 'warning' };
  return { label: 'Pendiente', color: 'default' };
};

function Metric({ label, value, detail, accent = '#1E3A5F' }) {
  return (
    <Box sx={{ minHeight: 72, borderLeft: `3px solid ${accent}`, pl: 1.5, py: 0.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="h6" sx={{ fontSize: 19, fontWeight: 700, mt: 0.25 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {detail}
      </Typography>
    </Box>
  );
}

function RequirementsTable({ items }) {
  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small" sx={{ minWidth: 940 }}>
        <TableHead>
          <TableRow sx={{ bgcolor: '#F4F6F8' }}>
            <TableCell>Material</TableCell>
            <TableCell>Tipo</TableCell>
            <TableCell align="right">Plan</TableCell>
            <TableCell align="right">Reservado</TableCell>
            <TableCell align="right">Emitido</TableCell>
            <TableCell align="right">Preparación</TableCell>
            <TableCell align="right">Máquina</TableCell>
            <TableCell>Estado</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => {
            const status = getRequirementStatus(item);
            return (
              <TableRow key={item.id} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.material}</Typography>
                  <Typography variant="caption" color="text.secondary">{item.codigo}</Typography>
                </TableCell>
                <TableCell><Chip size="small" variant="outlined" label={item.tipo} /></TableCell>
                <TableCell align="right">{formatKg(item.planKg)}</TableCell>
                <TableCell align="right">{formatKg(item.reservadoKg)}</TableCell>
                <TableCell align="right">{formatKg(item.emitidoKg)}</TableCell>
                <TableCell align="right">{formatKg(item.consumidoPreparacionKg)}</TableCell>
                <TableCell align="right">{formatKg(item.consumidoMaquinaKg)}</TableCell>
                <TableCell><Chip size="small" color={status.color} label={status.label} /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function PreparationQueue({ workspace, onOpen }) {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('TODAS');
  const rows = useMemo(() => workspace.ordenes.flatMap((order) => order.lotes.map((lote) => {
    const plannedKg = lote.requerimientos.reduce((sum, item) => sum + item.planKg, 0);
    const reservedKg = lote.requerimientos.reduce((sum, item) => sum + item.reservadoKg, 0);
    return {
      numeroOp: order.numeroOp,
      producto: order.producto,
      maquina: order.maquina,
      estadoOp: order.estado,
      loteId: lote.id,
      color: lote.color,
      etapa: lote.etapa,
      plannedKg,
      reservedKg,
      pendingKg: Math.max(0, plannedKg - reservedKg),
    };
  })), [workspace]);
  const stagesAvailable = useMemo(() => uniqueOptions(rows, 'etapa'), [rows]);
  const visibleRows = useMemo(() => rows.filter((row) => (
    (stageFilter === 'TODAS' || row.etapa === stageFilter)
    && matchesOmniSearch(row, search)
  )), [rows, search, stageFilter]);

  return (
    <Stack spacing={2.25} sx={{ maxWidth: 1480, mx: 'auto' }}>
      <PageHeader
        eyebrow="Materias primas"
        title="Reservas y entregas a producción"
        description="Órdenes liberadas con requerimientos de material pendientes de reservar, emitir o preparar."
        actions={<Chip data-testid="data-source" icon={<ScienceOutlinedIcon />} label="Datos mock" color="info" variant="outlined" />}
      />
      <DataTableToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar OP, lote, producto, color o máquina"
        filters={[{
          id: 'etapa',
          label: 'Etapa',
          value: stageFilter,
          onChange: setStageFilter,
          options: [{ value: 'TODAS', label: 'Todas las etapas' }, ...stagesAvailable.map((value) => ({ value, label: value.replaceAll('_', ' ') }))],
        }]}
        resultCount={visibleRows.length}
        totalCount={rows.length}
        onClear={() => { setSearch(''); setStageFilter('TODAS'); }}
      />
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label="Órdenes pendientes de preparación de materiales" sx={{ minWidth: 1080 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 155 }}>OP</TableCell>
              <TableCell>Lote de producción</TableCell>
              <TableCell>Producto / color</TableCell>
              <TableCell>Máquina</TableCell>
              <TableCell align="right">Plan</TableCell>
              <TableCell align="right">Reservado</TableCell>
              <TableCell align="right">Faltante</TableCell>
              <TableCell>Etapa</TableCell>
              <TableCell align="right">Abrir</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleRows.map((row) => (
              <TableRow key={`${row.numeroOp}-${row.loteId}`} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}><Typography variant="body2" sx={{ fontWeight: 800 }}>{row.numeroOp}</Typography><Typography variant="caption">{row.estadoOp}</Typography></TableCell>
                <TableCell>{row.loteId}</TableCell>
                <TableCell><Typography variant="body2">{row.producto}</Typography><Typography variant="caption" color="text.secondary">{row.color}</Typography></TableCell>
                <TableCell>{row.maquina}</TableCell>
                <TableCell align="right">{formatKg(row.plannedKg)}</TableCell>
                <TableCell align="right">{formatKg(row.reservedKg)}</TableCell>
                <TableCell align="right" sx={{ color: row.pendingKg > 0 ? 'warning.dark' : 'success.dark', fontWeight: 750 }}>{formatKg(row.pendingKg)}</TableCell>
                <TableCell><Chip size="small" variant="outlined" label={row.etapa.replaceAll('_', ' ')} /></TableCell>
                <TableCell align="right"><Button aria-label={`Atender ${row.numeroOp}`} size="small" endIcon={<ArrowForwardOutlinedIcon />} onClick={() => onOpen(row.numeroOp)}>Atender</Button></TableCell>
              </TableRow>
            ))}
            {visibleRows.length === 0 && <TableRow><TableCell colSpan={9} align="center" sx={{ py: 6 }}>No hay órdenes para los filtros seleccionados.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

function PlanPanel({ lote }) {
  const dose = lote.dosisColorante;

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Requerimientos congelados</Typography>
        <Typography variant="body2" color="text.secondary">Revisión {lote.receta}</Typography>
      </Box>

      <Box sx={{ bgcolor: '#EFF7F4', border: '1px solid #B8D8CB', borderRadius: 1, p: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 4 }}>
            <Typography variant="caption" color="text.secondary">Base de colorante</Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {dose.dosisGr} g / {dose.baseKg} kg virgen
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Typography variant="caption" color="text.secondary">Cálculo trazable</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{dose.formula}</Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Typography variant="caption" color="text.secondary">Colorante planificado</Typography>
            <Typography data-testid="colorant-plan-kg" variant="h6" sx={{ fontSize: 20, fontWeight: 800, color: '#176B52' }}>
              {formatKg(dose.planKg)}
            </Typography>
          </Grid>
        </Grid>
      </Box>

      <RequirementsTable items={lote.requerimientos} />
    </Stack>
  );
}

function ReservationPanel({ lote }) {
  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Asignación de lotes físicos</Typography>
          <Typography variant="body2" color="text.secondary">Identidad, Calidad, ubicación y saldo reservable</Typography>
        </Box>
      </Box>
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 900 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#F4F6F8' }}>
              <TableCell>Lote interno</TableCell>
              <TableCell>Lote proveedor</TableCell>
              <TableCell>Material</TableCell>
              <TableCell>Ubicación MP</TableCell>
              <TableCell>Calidad</TableCell>
              <TableCell align="right">Disponible</TableCell>
              <TableCell align="right">Asignado</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lote.asignaciones.map((item) => (
              <TableRow key={item.id} hover sx={item.incidencia ? { bgcolor: '#FFF8E7' } : undefined}>
                <TableCell sx={{ fontWeight: 700 }}>{item.loteInterno}</TableCell>
                <TableCell>{item.loteProveedor}</TableCell>
                <TableCell>{item.material}</TableCell>
                <TableCell>{item.ubicacion}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={item.incidencia ? 'warning' : 'success'}
                    icon={item.incidencia ? <WarningAmberOutlinedIcon /> : <CheckCircleOutlineIcon />}
                    label={item.incidencia || item.calidad}
                  />
                </TableCell>
                <TableCell align="right">{formatKg(item.disponibleKg)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>{formatKg(item.asignadoKg)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

function EmissionPanel({ lote, capabilities }) {
  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Movimientos hacia preparación</Typography>
          <Typography variant="body2" color="text.secondary">La emisión todavía no demuestra consumo</Typography>
        </Box>
        <ApiPendingButton label="Registrar devolución" capability={capabilities.devolver} />
      </Box>
      {lote.emisiones.length === 0 ? (
        <Alert severity="info">No existen emisiones para este lote de producción.</Alert>
      ) : (
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 850 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: '#F4F6F8' }}>
                <TableCell>Emisión</TableCell>
                <TableCell>Lote origen</TableCell>
                <TableCell>Material</TableCell>
                <TableCell align="right">Cantidad</TableCell>
                <TableCell>Destino</TableCell>
                <TableCell>Balanza</TableCell>
                <TableCell>Trabajador</TableCell>
                <TableCell>Estado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lote.emisiones.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell sx={{ fontWeight: 700 }}>{item.id}</TableCell>
                  <TableCell>{item.lote}</TableCell>
                  <TableCell>{item.material}</TableCell>
                  <TableCell align="right">{formatKg(item.cantidadKg)}</TableCell>
                  <TableCell>{item.destino}</TableCell>
                  <TableCell>{item.balanza}</TableCell>
                  <TableCell>{item.trabajador}</TableCell>
                  <TableCell><Chip size="small" color="info" label={item.estado} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}

function PremixPanel({ lote }) {
  const premix = lote.premezcla;

  if (!premix) {
    return (
      <Alert severity="warning">La premezcla todavía no fue preparada en este escenario.</Alert>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
            <Typography data-testid="premix-lot-id" variant="h6" sx={{ fontSize: 20, fontWeight: 800 }}>{premix.id}</Typography>
            <Chip size="small" color="success" label="Lista para máquina" />
          </Stack>
          <Typography variant="body2" color="text.secondary">Transformación {premix.preparacionId}</Typography>
        </Box>
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 3 }}><Metric label="Cantidad WIP" value={formatKg(premix.cantidadKg)} detail={premix.metodoCantidad} accent="#176B52" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Metric label="Ubicación" value={premix.ubicacion} detail="Materias primas / WIP" accent="#A55C16" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Metric label="Responsable" value={premix.trabajador} detail={formatDateTime(premix.fecha)} accent="#385A7C" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Metric label="Genealogía" value={`${premix.inputs.length} aportes`} detail="Lotes de origen identificados" accent="#6B4F83" /></Grid>
      </Grid>

      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Inputs consumidos en preparación</Typography>
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 680 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: '#F4F6F8' }}>
                <TableCell>Emisión</TableCell>
                <TableCell>Lote de origen</TableCell>
                <TableCell>Material</TableCell>
                <TableCell align="right">Cantidad incorporada</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {premix.inputs.map((item) => (
                <TableRow key={item.emisionId} hover>
                  <TableCell>{item.emisionId}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{item.lote}</TableCell>
                  <TableCell>{item.material}</TableCell>
                  <TableCell align="right">{formatKg(item.cantidadKg)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Stack>
  );
}

function TracePanel({ lote }) {
  return (
    <Stack spacing={0} divider={<Divider flexItem />}>
      {lote.eventos.map((event, index) => (
        <Box key={event.id} sx={{ display: 'grid', gridTemplateColumns: '36px minmax(0, 1fr)', gap: 1.5, py: 1.75 }}>
          <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
            <Box sx={{ mt: 0.5, width: 12, height: 12, borderRadius: '50%', bgcolor: index === lote.eventos.length - 1 ? '#176B52' : '#385A7C' }} />
          </Box>
          <Box>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
              <Typography variant="body2" sx={{ fontWeight: 800 }}>{event.tipo}</Typography>
              <Typography variant="caption" color="text.secondary">{event.id}</Typography>
            </Stack>
            <Typography variant="body2" sx={{ mt: 0.25 }}>{event.detalle}</Typography>
            <Typography variant="caption" color="text.secondary">{event.actor} · {formatDateTime(event.fecha)}</Typography>
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

function PreparacionMateriales() {
  const { numeroOp } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
  const [workspace, setWorkspace] = useState(null);
  const [selectedOp, setSelectedOp] = useState('');
  const [selectedLot, setSelectedLot] = useState('');
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await obtenerPreparacionMateriales();
      const initialOrder = data.ordenes.find((item) => item.numeroOp === numeroOp) || data.ordenes[0];
      setWorkspace(data);
      setSelectedOp(initialOrder?.numeroOp || '');
      setSelectedLot(initialOrder?.lotes[0]?.id || '');
    } catch (loadError) {
      console.error(loadError);
      setError('No fue posible cargar la preparación de materiales.');
    } finally {
      setLoading(false);
    }
  }, [numeroOp]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  if (loading) {
    return <Box sx={{ minHeight: 320, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  }

  if (error || !workspace) {
    return <Alert severity="error">{error || 'No existen datos de preparación.'}</Alert>;
  }

  if (!numeroOp) {
    return <PreparationQueue workspace={workspace} onOpen={(op) => navigate(`/materiales/preparaciones/${op}`)} />;
  }

  const order = workspace.ordenes.find((item) => item.numeroOp === selectedOp) || workspace.ordenes[0];
  const lote = order.lotes.find((item) => item.id === selectedLot) || order.lotes[0];
  const completedRequirements = lote.requerimientos.filter((item) => item.reservadoKg >= item.planKg).length;
  const issuedRequirements = lote.requerimientos.filter((item) => item.emitidoKg >= item.planKg).length;
  const pendingCommandCount = ['reservar', 'emitir', 'devolver', 'confirmarPremezcla']
    .filter((key) => !workspace.capabilities[key].apiReady).length;

  const handleOrderChange = (event) => {
    const nextOrder = workspace.ordenes.find((item) => item.numeroOp === event.target.value);
    setSelectedOp(event.target.value);
    setSelectedLot(nextOrder?.lotes[0]?.id || '');
    setTab(0);
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 1560, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 2.5 }}>
        <Box>
          <Typography component="h1" variant="h4" sx={{ fontSize: 28, fontWeight: 800, color: '#172B3A' }}>
            Preparación de materiales
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {order.numeroOp} · {order.producto} · {order.maquina}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            data-testid="data-source"
            icon={<ScienceOutlinedIcon />}
            label="Datos mock"
            color="info"
            variant="outlined"
          />
          <Tooltip title="Los comandos de inventario están pendientes de API" arrow>
            <Chip icon={<CloudOffOutlinedIcon />} label={`${pendingCommandCount} APIs pendientes`} variant="outlined" />
          </Tooltip>
          <Tooltip title="Restablecer fixture">
            <IconButton aria-label="Restablecer datos mock" onClick={loadWorkspace} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 1 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 3 }}>
            <FormControl size="small" fullWidth>
              <InputLabel id="op-material-label">Orden de producción</InputLabel>
              <Select labelId="op-material-label" label="Orden de producción" value={selectedOp} onChange={handleOrderChange}>
                {workspace.ordenes.map((item) => <MenuItem key={item.numeroOp} value={item.numeroOp}>{item.numeroOp}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <FormControl size="small" fullWidth>
              <InputLabel id="lot-material-label">Lote de producción</InputLabel>
              <Select
                labelId="lot-material-label"
                label="Lote de producción"
                value={lote.id}
                onChange={(event) => { setSelectedLot(event.target.value); setTab(0); }}
              >
                {order.lotes.map((item) => <MenuItem key={item.id} value={item.id}>{item.id} · {item.color}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack direction="row" spacing={1} justifyContent={{ xs: 'flex-start', md: 'flex-end' }} useFlexGap flexWrap="wrap">
              <ApiPendingButton label="Confirmar reserva" capability={workspace.capabilities.reservar} />
              <ApiPendingButton label="Emitir material" capability={workspace.capabilities.emitir} />
              <ApiPendingButton label="Confirmar premezcla" capability={workspace.capabilities.confirmarPremezcla} />
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ mb: 2, borderRadius: 1, overflow: 'hidden' }}>
        <Grid container spacing={0} sx={{ p: 2 }}>
          <Grid size={{ xs: 6, md: 3 }} sx={{ mb: { xs: 2, md: 0 } }}><Metric label="Meta de producción" value={formatKg(lote.metaKg)} detail={lote.color} /></Grid>
          <Grid size={{ xs: 6, md: 3 }} sx={{ mb: { xs: 2, md: 0 } }}><Metric label="Reserva completa" value={`${completedRequirements}/${lote.requerimientos.length}`} detail="Requerimientos cubiertos" accent="#176B52" /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><Metric label="Emisión completa" value={`${issuedRequirements}/${lote.requerimientos.length}`} detail="Requerimientos emitidos" accent="#A55C16" /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><Metric label="WIP de premezcla" value={lote.premezcla?.id || 'Pendiente'} detail={lote.premezcla?.estado || lote.etapa} accent="#6B4F83" /></Grid>
        </Grid>
        <Divider />
        <Box sx={{ px: 2, py: 2.25, overflowX: 'auto' }}>
          <Stepper activeStep={lote.etapaIndex} orientation={isSmall ? 'vertical' : 'horizontal'} alternativeLabel={!isSmall} sx={{ minWidth: isSmall ? 0 : 620 }}>
            {stages.map((label, index) => (
              <Step key={label} completed={index < lote.etapaIndex}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 1, overflow: 'hidden' }}>
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Etapas de preparación de materiales"
          sx={{ borderBottom: '1px solid', borderColor: 'divider', minHeight: 48 }}
        >
          <Tab icon={<Inventory2OutlinedIcon />} iconPosition="start" label="Plan" />
          <Tab icon={<CheckCircleOutlineIcon />} iconPosition="start" label="Reserva" />
          <Tab icon={<ScaleOutlinedIcon />} iconPosition="start" label="Emisión" />
          <Tab icon={<ScienceOutlinedIcon />} iconPosition="start" label="Premezcla" />
          <Tab icon={<RouteOutlinedIcon />} iconPosition="start" label="Trazabilidad" />
        </Tabs>
        <Box sx={{ p: { xs: 1.5, md: 2.5 }, minHeight: 360 }}>
          {tab === 0 && <PlanPanel lote={lote} />}
          {tab === 1 && <ReservationPanel lote={lote} />}
          {tab === 2 && <EmissionPanel lote={lote} capabilities={workspace.capabilities} />}
          {tab === 3 && <PremixPanel lote={lote} />}
          {tab === 4 && <TracePanel lote={lote} />}
        </Box>
      </Paper>
    </Box>
  );
}

export default PreparacionMateriales;
