import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
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
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Step,
  StepButton,
  Stepper,
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
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import FactoryOutlinedIcon from '@mui/icons-material/FactoryOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import SearchIcon from '@mui/icons-material/Search';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import ApiPendingButton from './ApiPendingButton';
import { obtenerPlanificacionProduccion } from '../services/planificacionProduccion';

const stages = ['Demanda', 'Cobertura', 'Propuestas de OP', 'Configuración', 'Liberación'];

const statusConfig = {
  BORRADOR: { label: 'Borrador', color: 'default' },
  CALCULADA: { label: 'Calculada', color: 'info' },
  CONFIRMADA: { label: 'Confirmada', color: 'primary' },
  EN_COBERTURA: { label: 'En cobertura', color: 'warning' },
  CUBIERTA: { label: 'Cubierta', color: 'success' },
  COBERTURA_NO_CALCULABLE: { label: 'Cobertura no calculable', color: 'error' },
};

const priorityConfig = {
  ALTA: { label: 'Alta', color: 'error' },
  MEDIA: { label: 'Media', color: 'warning' },
  BAJA: { label: 'Baja', color: 'default' },
};

const formatUnits = (value) => new Intl.NumberFormat('es-PE', {
  maximumFractionDigits: 0,
}).format(Number(value || 0));

const formatKg = (value) => `${Number(value || 0).toFixed(3)} kg`;

const formatDate = (value) => new Intl.DateTimeFormat('es-PE', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
}).format(new Date(`${value}T12:00:00`));

const formatDateTime = (value) => {
  if (!value) return 'No disponible';
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
};

function StatusChip({ value }) {
  const config = statusConfig[value] || { label: value, color: 'default' };
  return <Chip size="small" color={config.color} label={config.label} />;
}

function PriorityChip({ value }) {
  const config = priorityConfig[value] || { label: value, color: 'default' };
  return <Chip size="small" variant="outlined" color={config.color} label={config.label} />;
}

function Metric({ label, value, detail, accent = '#1E3A5F' }) {
  return (
    <Box sx={{ minHeight: 72, borderLeft: `3px solid ${accent}`, pl: 1.5, py: 0.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="h6" sx={{ fontSize: 19, fontWeight: 800, mt: 0.25 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {detail}
      </Typography>
    </Box>
  );
}

function RequestTable({ solicitudes, selectedId, onSelect }) {
  if (solicitudes.length === 0) {
    return <Alert severity="info">No existen solicitudes para los filtros seleccionados.</Alert>;
  }

  return (
    <TableContainer sx={{ maxHeight: 330, overflowX: 'auto' }}>
      <Table stickyHeader size="small" sx={{ minWidth: 760 }}>
        <TableHead>
          <TableRow>
            <TableCell>Solicitud</TableCell>
            <TableCell>Producto principal</TableCell>
            <TableCell align="right">Cantidad</TableCell>
            <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Necesidad</TableCell>
            <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>Prioridad</TableCell>
            <TableCell>Estado</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {solicitudes.map((solicitud) => {
            const primaryLine = solicitud.lineas[0];
            return (
              <TableRow
                key={solicitud.id}
                hover
                selected={solicitud.id === selectedId}
                onClick={() => onSelect(solicitud.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') onSelect(solicitud.id);
                }}
                tabIndex={0}
                aria-label={`Abrir ${solicitud.id}`}
                sx={{ cursor: 'pointer', '&.Mui-selected': { bgcolor: '#EAF2F8' } }}
              >
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>{solicitud.id}</Typography>
                  <Typography variant="caption" color="text.secondary">{solicitud.referencia}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{primaryLine.producto}</Typography>
                  <Typography variant="caption" color="text.secondary">{primaryLine.productoSku}</Typography>
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>{formatUnits(solicitud.totalSolicitado)}</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{formatDate(solicitud.fechaNecesidad)}</TableCell>
                <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}><PriorityChip value={solicitud.prioridad} /></TableCell>
                <TableCell><StatusChip value={solicitud.estado} /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function DemandPanel({ solicitud }) {
  return (
    <Stack spacing={2.5}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 3 }}><Metric label="Origen" value={solicitud.origen.replaceAll('_', ' ')} detail={solicitud.referencia} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Metric label="Fecha requerida" value={formatDate(solicitud.fechaNecesidad)} detail={`Prioridad ${solicitud.prioridad.toLowerCase()}`} accent="#9A5B13" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Metric label="Responsable" value={solicitud.responsable} detail="Planificación" accent="#176B52" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Metric label="Versión de cálculo" value={solicitud.id} detail="Fixture reproducible" accent="#6B4F83" /></Grid>
      </Grid>

      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 820 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#F4F6F8' }}>
              <TableCell>ProductoTerminado</TableCell>
              <TableCell>BOM congelada</TableCell>
              <TableCell align="right">Solicitado</TableCell>
              <TableCell align="right">Cobertura PT</TableCell>
              <TableCell align="right">Por armar</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {solicitud.lineas.map((linea) => (
              <TableRow key={linea.id} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{linea.producto}</Typography>
                  <Typography variant="caption" color="text.secondary">{linea.productoSku}</Typography>
                </TableCell>
                <TableCell><Chip size="small" variant="outlined" label={linea.bomRevision} /></TableCell>
                <TableCell align="right">{formatUnits(linea.cantidadSolicitada)}</TableCell>
                <TableCell align="right">{formatUnits(linea.stockPtAsignado)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>{formatUnits(linea.cantidadPorArmar)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

function CoveragePanel({ solicitud }) {
  const inventoryReady = solicitud.inventario.estado === 'DISPONIBLE';

  return (
    <Stack spacing={2}>
      <Alert
        severity={inventoryReady ? 'success' : 'error'}
        icon={inventoryReady ? <Inventory2OutlinedIcon /> : <CloudOffOutlinedIcon />}
      >
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {inventoryReady ? solicitud.inventario.fuente : 'Cobertura no calculable'}
        </Typography>
        <Typography variant="caption">
          {inventoryReady
            ? `Disponibilidad actualizada ${formatDateTime(solicitud.inventario.actualizadoEn)}`
            : `${solicitud.inventario.fuente}: stock desconocido, no se interpreta como cero.`}
        </Typography>
      </Alert>

      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 950 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#F4F6F8' }}>
              <TableCell>PiezaColor</TableCell>
              <TableCell align="right">Por PT</TableCell>
              <TableCell align="right">Necesidad bruta</TableCell>
              <TableCell align="right">Stock libre</TableCell>
              <TableCell align="right">Suministro</TableCell>
              <TableCell align="right">Faltante neto</TableCell>
              <TableCell align="right">Contingencia</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {solicitud.necesidades.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{item.pieza}</Typography>
                  <Typography variant="caption" color="text.secondary">{item.piezaColorSku} · {item.color}</Typography>
                </TableCell>
                <TableCell align="right">{formatUnits(item.cantidadPorPt)}</TableCell>
                <TableCell align="right">{formatUnits(item.cantidadBruta)}</TableCell>
                <TableCell align="right">{item.calculable ? formatUnits(item.stockDisponible) : 'No disponible'}</TableCell>
                <TableCell align="right">{item.calculable ? formatUnits(item.suministroLiberado) : 'No disponible'}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, color: item.calculable && item.faltanteNeto > 0 ? '#9A3B26' : 'inherit' }}>
                  {item.calculable ? formatUnits(item.faltanteNeto) : 'No calculable'}
                </TableCell>
                <TableCell align="right">{item.calculable ? formatUnits(item.contingencia) : 'No calculable'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {inventoryReady && solicitud.faltanteTotal === 0 && (
        <Alert severity="success">La demanda está cubierta y no necesita una nueva OP.</Alert>
      )}
      {solicitud.bloqueos.map((bloqueo) => (
        <Alert key={bloqueo.codigo} severity="error">
          <strong>{bloqueo.codigo}</strong>: {bloqueo.detalle}
        </Alert>
      ))}
    </Stack>
  );
}

function OutputsTable({ propuesta }) {
  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small" sx={{ minWidth: 900 }}>
        <TableHead>
          <TableRow sx={{ bgcolor: '#F4F6F8' }}>
            <TableCell>Salida PiezaColor</TableCell>
            <TableCell align="right">Cavidades</TableCell>
            <TableCell align="right">Peso unit.</TableCell>
            <TableCell align="right">Faltante</TableCell>
            <TableCell align="right">Objetivo</TableCell>
            <TableCell align="right">Salida</TableCell>
            <TableCell align="right">Excedente</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {propuesta.salidas.map((salida) => (
            <TableRow key={salida.piezaColorSku} hover>
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{salida.pieza}</Typography>
                <Typography variant="caption" color="text.secondary">{salida.piezaColorSku}</Typography>
              </TableCell>
              <TableCell align="right">{salida.cavidades}</TableCell>
              <TableCell align="right">{salida.pesoUnitarioGr} g</TableCell>
              <TableCell align="right">{formatUnits(salida.faltanteNeto)}</TableCell>
              <TableCell align="right">{formatUnits(salida.objetivoProduccion)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>{formatUnits(salida.cantidadPlanificada)}</TableCell>
              <TableCell align="right" sx={{ color: salida.excedenteTecnico > 0 ? '#9A5B13' : 'inherit', fontWeight: 700 }}>
                {formatUnits(salida.excedenteTecnico)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function ProposalsPanel({ solicitud, capabilities, onOpenConfiguration }) {
  if (solicitud.inventario.estado !== 'DISPONIBLE') {
    return <Alert severity="error">No se pueden proponer OP hasta recuperar una cobertura confiable.</Alert>;
  }

  if (solicitud.propuestas.length === 0) {
    if (solicitud.faltanteTotal === 0) {
      return <Alert severity="success">Cobertura completa: no se genera ninguna propuesta de OP.</Alert>;
    }
    return (
      <Stack spacing={1.5}>
        {solicitud.bloqueos.map((bloqueo) => (
          <Alert key={bloqueo.codigo} severity="error" icon={<WarningAmberOutlinedIcon />}>
            <strong>{bloqueo.codigo}</strong>: {bloqueo.detalle}
          </Alert>
        ))}
      </Stack>
    );
  }

  return (
    <Stack spacing={3} divider={<Divider flexItem />}>
      {solicitud.propuestas.map((propuesta) => (
        <Box key={propuesta.id}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                <Typography variant="h6" sx={{ fontSize: 19, fontWeight: 800 }}>{propuesta.moldeCodigo}</Typography>
                <Chip size="small" color={propuesta.estado === 'LIBERADA' ? 'success' : 'info'} label={propuesta.estado} />
                <Chip size="small" variant="outlined" label={propuesta.color} />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{propuesta.molde}</Typography>
            </Box>
            <Button size="small" variant="outlined" startIcon={<TuneOutlinedIcon />} onClick={onOpenConfiguration}>
              Ver configuración
            </Button>
          </Box>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={{ xs: 6, md: 3 }}><Metric label="Ciclos enteros" value={formatUnits(propuesta.ciclos)} detail={`${propuesta.salidas.length} salidas físicas`} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><Metric label="Kg netos" value={formatKg(propuesta.kgNetos)} detail="Derivados de piezas y pesos" accent="#176B52" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><Metric label="Contingencia" value={formatUnits(propuesta.contingenciaTotal)} detail="Sin porcentaje oculto" accent="#6B4F83" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><Metric label="Excedente técnico" value={formatUnits(propuesta.excedenteTecnicoTotal)} detail="Permanece como PiezaColor" accent="#9A5B13" /></Grid>
          </Grid>

          <OutputsTable propuesta={propuesta} />

          {propuesta.estado !== 'LIBERADA' && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <ApiPendingButton label="Confirmar plan y crear OP" capability={capabilities.confirmarPlan} />
            </Box>
          )}
        </Box>
      ))}
    </Stack>
  );
}

function ConfigurationPanel({ solicitud, capabilities }) {
  const propuesta = solicitud.propuestas[0];

  if (!propuesta) {
    return <Alert severity={solicitud.faltanteTotal === 0 ? 'success' : 'warning'}>No existe una OP técnica para configurar.</Alert>;
  }

  return (
    <Stack spacing={2.5}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Configuración técnica de OP</Typography>
          <Typography variant="body2" color="text.secondary">
            {propuesta.opNumero || propuesta.id} · snapshot propuesto para {propuesta.moldeCodigo}
          </Typography>
        </Box>
        <Chip size="small" color={propuesta.estado === 'LIBERADA' ? 'success' : 'default'} label={propuesta.estado} />
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><Metric label="Molde" value={propuesta.moldeCodigo} detail={propuesta.molde} /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><Metric label="ColorProduccion" value={propuesta.color} detail={propuesta.colorCodigo} accent="#9A3B26" /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><Metric label="Receta" value={propuesta.receta} detail="Revisión prevista" accent="#176B52" /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><Metric label="Máquina prevista" value={propuesta.maquinaPrevista} detail="Asignación no ejecutada" accent="#6B4F83" /></Grid>
      </Grid>

      <Box sx={{ bgcolor: '#F4F7F9', border: '1px solid #D8E0E6', borderRadius: 1, p: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 4 }}>
            <Typography variant="caption" color="text.secondary">Ciclos</Typography>
            <Typography data-testid="planned-cycles" variant="h6" sx={{ fontSize: 20, fontWeight: 800 }}>{formatUnits(propuesta.ciclos)}</Typography>
          </Grid>
          <Grid size={{ xs: 4 }}>
            <Typography variant="caption" color="text.secondary">Meta neta derivada</Typography>
            <Typography data-testid="planned-net-kg" variant="h6" sx={{ fontSize: 20, fontWeight: 800 }}>{formatKg(propuesta.kgNetos)}</Typography>
          </Grid>
          <Grid size={{ xs: 4 }}>
            <Typography variant="caption" color="text.secondary">Salidas</Typography>
            <Typography variant="h6" sx={{ fontSize: 20, fontWeight: 800 }}>{propuesta.salidas.length}</Typography>
          </Grid>
        </Grid>
      </Box>

      <OutputsTable propuesta={propuesta} />

      {propuesta.estado !== 'LIBERADA' && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <ApiPendingButton label="Guardar configuración" capability={capabilities.guardarConfiguracion} />
        </Box>
      )}
    </Stack>
  );
}

function ReleasePanel({ solicitud, capabilities }) {
  const propuesta = solicitud.propuestas[0];
  const isReleased = solicitud.liberacion.estadoOp === 'LIBERADA';
  const fullCoverage = solicitud.faltanteTotal === 0 && solicitud.propuestas.length === 0;

  if (fullCoverage) {
    return <Alert severity="success">La solicitud se cubre con inventario de ProductoTerminado. No requiere liberar una OP.</Alert>;
  }

  const checks = [
    { label: 'BOM congelada', detail: solicitud.lineas.map((linea) => linea.bomRevision).join(', '), ok: true },
    { label: 'Inventario consultable', detail: solicitud.inventario.fuente, ok: solicitud.inventario.estado === 'DISPONIBLE' },
    { label: 'Molde y composición', detail: propuesta?.moldeCodigo || 'Sin molde compatible', ok: Boolean(propuesta) },
    { label: 'Ciclos enteros', detail: propuesta ? `${formatUnits(propuesta.ciclos)} ciclos` : 'No calculados', ok: Boolean(propuesta && Number.isInteger(propuesta.ciclos) && propuesta.ciclos > 0) },
    { label: 'Receta prevista', detail: propuesta?.receta || 'No asignada', ok: Boolean(propuesta?.receta) },
    { label: 'PiezaColor resueltas', detail: propuesta ? `${propuesta.salidas.length} salidas` : 'Sin salidas', ok: Boolean(propuesta?.salidas.length) },
  ];
  const canRelease = checks.every((item) => item.ok) && solicitud.bloqueos.length === 0;

  return (
    <Stack spacing={2.5}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Puerta de liberación</Typography>
          <Typography variant="body2" color="text.secondary">
            La reserva física comienza después, al confirmar la propuesta de lotes en US-010B.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Chip size="small" variant="outlined" label={`OP: ${solicitud.liberacion.estadoOp}`} />
          <Chip size="small" color={isReleased ? 'success' : 'default'} label={`Materiales: ${solicitud.liberacion.estadoAbastecimiento}`} />
        </Stack>
      </Box>

      <Stack spacing={0} divider={<Divider flexItem />}>
        {checks.map((item) => (
          <Box key={item.label} sx={{ display: 'grid', gridTemplateColumns: '32px minmax(0, 1fr)', gap: 1.5, py: 1.4 }}>
            {item.ok
              ? <CheckCircleOutlineIcon color="success" fontSize="small" sx={{ mt: 0.25 }} />
              : <WarningAmberOutlinedIcon color="error" fontSize="small" sx={{ mt: 0.25 }} />}
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{item.label}</Typography>
              <Typography variant="caption" color="text.secondary">{item.detail}</Typography>
            </Box>
          </Box>
        ))}
      </Stack>

      {!canRelease && solicitud.bloqueos.map((bloqueo) => (
        <Alert key={bloqueo.codigo} severity="error">{bloqueo.detalle}</Alert>
      ))}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
        {isReleased && propuesta?.opNumero ? (
          <Button
            component={RouterLink}
            to={`/ordenes/${propuesta.opNumero}/materiales`}
            variant="contained"
            endIcon={<ArrowForwardOutlinedIcon />}
          >
            Preparar materiales
          </Button>
        ) : (
          <ApiPendingButton
            label="Liberar y calcular materiales"
            capability={capabilities.liberarOp}
          />
        )}
      </Box>
    </Stack>
  );
}

function PlanificacionProduccion() {
  const { solicitudId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
  const [workspace, setWorkspace] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await obtenerPlanificacionProduccion();
      const initialRequest = data.solicitudes.find((item) => item.id === solicitudId) || data.solicitudes[0];
      setWorkspace(data);
      setSelectedId(initialRequest?.id || '');
      setStep(initialRequest?.etapaIndex || 0);
    } catch (loadError) {
      console.error(loadError);
      setError('No fue posible cargar la planificación de producción.');
    } finally {
      setLoading(false);
    }
  }, [solicitudId]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const filteredRequests = useMemo(() => {
    if (!workspace) return [];
    const term = search.trim().toLowerCase();
    return workspace.solicitudes.filter((solicitud) => {
      const matchesStatus = statusFilter === 'TODOS' || solicitud.estado === statusFilter;
      const searchable = [
        solicitud.id,
        solicitud.referencia,
        ...solicitud.lineas.flatMap((linea) => [linea.producto, linea.productoSku]),
      ].join(' ').toLowerCase();
      return matchesStatus && (!term || searchable.includes(term));
    });
  }, [search, statusFilter, workspace]);

  if (loading) {
    return <Box sx={{ minHeight: 360, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  }

  if (error || !workspace) {
    return <Alert severity="error">{error || 'No existen datos de planificación.'}</Alert>;
  }

  const solicitud = workspace.solicitudes.find((item) => item.id === selectedId) || workspace.solicitudes[0];
  const pendingCommandCount = Object.values(workspace.capabilities).filter((capability) => !capability.apiReady).length;

  const handleSelect = (id) => {
    const nextRequest = workspace.solicitudes.find((item) => item.id === id);
    setSelectedId(id);
    setStep(nextRequest?.etapaIndex || 0);
    navigate(`/planificacion/${id}`);
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 1560, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 2.5 }}>
        <Box>
          <Typography component="h1" variant="h4" sx={{ fontSize: 28, fontWeight: 800, color: '#172B3A' }}>
            Planificación de producción
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Demanda de ProductoTerminado, cobertura y generación de OP
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
          <Chip data-testid="planning-data-source" icon={<ScienceOutlinedIcon />} label="Datos mock" color="info" variant="outlined" />
          <Tooltip title="Los comandos de planificación están pendientes de API" arrow>
            <Chip icon={<CloudOffOutlinedIcon />} label={`${pendingCommandCount} APIs pendientes`} variant="outlined" />
          </Tooltip>
          <Tooltip title="Restablecer fixtures">
            <IconButton aria-label="Restablecer planificación mock" onClick={loadWorkspace} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <ApiPendingButton label="Nueva demanda" capability={workspace.capabilities.crearSolicitud} />
        </Stack>
      </Box>

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 1 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, md: 3 }}><Metric label="Solicitudes activas" value={formatUnits(workspace.resumen.solicitudesActivas)} detail="Pendientes de cierre" /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><Metric label="Unidades solicitadas" value={formatUnits(workspace.resumen.unidadesSolicitadas)} detail="ProductoTerminado" accent="#176B52" /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><Metric label="Propuestas de OP" value={formatUnits(workspace.resumen.propuestasOp)} detail="Incluye OP liberadas" accent="#6B4F83" /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><Metric label="Solicitudes bloqueadas" value={formatUnits(workspace.resumen.bloqueos)} detail="Requieren resolución" accent="#9A3B26" /></Grid>
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ mb: 2, borderRadius: 1, overflow: 'hidden' }}>
        <Box sx={{ p: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(260px, 1fr) 220px' }, gap: 1.5 }}>
          <TextField
            size="small"
            label="Buscar solicitud, producto o SKU"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          />
          <FormControl size="small" fullWidth>
            <InputLabel id="planning-status-filter-label">Estado</InputLabel>
            <Select
              labelId="planning-status-filter-label"
              label="Estado"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <MenuItem value="TODOS">Todos</MenuItem>
              {Object.entries(statusConfig).map(([value, config]) => (
                <MenuItem key={value} value={value}>{config.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <Divider />
        <RequestTable solicitudes={filteredRequests} selectedId={solicitud.id} onSelect={handleSelect} />
      </Paper>

      <Paper variant="outlined" sx={{ mb: 2, borderRadius: 1, overflow: 'hidden' }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
              <Typography variant="h6" sx={{ fontSize: 20, fontWeight: 800 }}>{solicitud.id}</Typography>
              <StatusChip value={solicitud.estado} />
              <PriorityChip value={solicitud.prioridad} />
            </Stack>
            <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>{solicitud.lineas[0].producto}</Typography>
            <Typography variant="caption" color="text.secondary">
              {formatUnits(solicitud.totalSolicitado)} PT · necesidad {formatDate(solicitud.fechaNecesidad)} · {solicitud.referencia}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip size="small" icon={<AccountTreeOutlinedIcon />} variant="outlined" label={`${solicitud.necesidades.length} PiezaColor`} />
            <Chip size="small" icon={<FactoryOutlinedIcon />} variant="outlined" label={`${solicitud.propuestas.length} OP`} />
            <Chip size="small" icon={<FactCheckOutlinedIcon />} variant="outlined" label={solicitud.lineas[0].bomRevision} />
          </Stack>
        </Box>
        <Divider />
        <Box sx={{ p: 2, overflowX: 'auto' }}>
          <Stepper
            nonLinear
            activeStep={step}
            orientation={isSmall ? 'vertical' : 'horizontal'}
            sx={{ minWidth: isSmall ? 0 : 720 }}
          >
            {stages.map((label, index) => (
              <Step key={label} completed={index < solicitud.etapaIndex}>
                <StepButton color="inherit" onClick={() => setStep(index)}>{label}</StepButton>
              </Step>
            ))}
          </Stepper>
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2.5 }, borderRadius: 1, minHeight: 390 }}>
        {step === 0 && <DemandPanel solicitud={solicitud} />}
        {step === 1 && <CoveragePanel solicitud={solicitud} />}
        {step === 2 && (
          <ProposalsPanel
            solicitud={solicitud}
            capabilities={workspace.capabilities}
            onOpenConfiguration={() => setStep(3)}
          />
        )}
        {step === 3 && <ConfigurationPanel solicitud={solicitud} capabilities={workspace.capabilities} />}
        {step === 4 && <ReleasePanel solicitud={solicitud} capabilities={workspace.capabilities} />}
      </Paper>
    </Box>
  );
}

export default PlanificacionProduccion;
