import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import FactoryOutlinedIcon from '@mui/icons-material/FactoryOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import PrecisionManufacturingOutlinedIcon from '@mui/icons-material/PrecisionManufacturingOutlined';
import RestartAltOutlinedIcon from '@mui/icons-material/RestartAltOutlined';
import ScaleOutlinedIcon from '@mui/icons-material/ScaleOutlined';
import SchemaOutlinedIcon from '@mui/icons-material/SchemaOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import { useNavigate } from 'react-router-dom';
import { useScmActor } from '../../context/ScmActorContext';
import { PORTFOLIO_EDGE_DEMO_URL } from '../../config/runtime';
import {
  getPortfolioDemoStatus,
  resetPortfolioDemo,
} from '../../services/portfolioDemoApi';
import PageHeader from '../ui/PageHeader';

const stages = [
  {
    number: '01',
    title: 'Ingeniería y maestros',
    outcome: 'El producto queda definido con estructura, ruta, receta, molde y regla de empaque versionadas.',
    evidence: 'Jarra Real 6 L, PP clarificado y maestros de planta listos para operar.',
    path: '/datos-maestros',
    actorCode: 'TRB-003',
    actor: 'Jefe de Producción',
    mode: 'Interactivo',
    icon: SchemaOutlinedIcon,
    metric: (status) => `${status?.counts?.articles || 0} artículos SCM`,
  },
  {
    number: '02',
    title: 'Demanda y planificación',
    outcome: 'Una necesidad comercial se traduce en OP, cobertura, plan y órdenes operativas trazables.',
    evidence: 'OP de 2,400 unidades dividida en dos órdenes de fabricación.',
    path: '/planificacion',
    actorCode: 'TRB-002',
    actor: 'Planificación',
    mode: 'Interactivo',
    icon: HubOutlinedIcon,
    metric: (status) => `${status?.counts?.production_orders || 0} OP activa`,
  },
  {
    number: '03',
    title: 'Fabricación y OT',
    outcome: 'La OF se lleva a planta por máquina, turno, trabajo de color, responsable y mangas identificadas.',
    evidence: 'Una OT en ejecución conserva una manga pendiente y otra ya procesada.',
    path: '/produccion/ots-planta',
    actorCode: 'TRB-004',
    actor: 'Supervisor de Planta',
    mode: 'Interactivo',
    icon: PrecisionManufacturingOutlinedIcon,
    metric: (status) => status?.highlights?.active_ot || 'OT preparada',
  },
  {
    number: '04',
    title: 'Pesaje y etiquetas',
    outcome: 'El QR transporta el contexto productivo; el peso estable genera evidencia y una etiqueta final.',
    evidence: 'Lectura de balanza y confirmación de impresión reproducidas por servicios simulados.',
    path: '/control/impresion-etiquetas',
    actorCode: 'TRB-004',
    actor: 'Supervisión + estación',
    mode: 'Hardware simulado',
    edgeDemo: true,
    icon: ScaleOutlinedIcon,
    metric: (status) => `${status?.counts?.weighings || 0} pesaje confirmado`,
  },
  {
    number: '05',
    title: 'Almacén, Calidad y Kardex',
    outcome: 'La recepción física crea existencia, bloquea por Calidad y libera saldo con movimiento auditable.',
    evidence: 'Inventario inicial de materia prima y una manga terminada liberada en almacén.',
    path: '/almacen/kardex',
    actorCode: 'TRB-008',
    actor: 'Almacenera',
    mode: 'Interactivo',
    icon: Inventory2OutlinedIcon,
    metric: (status) => `${status?.counts?.inventory_movements || 0} movimientos`,
  },
];

function Metric({ label, value }) {
  return (
    <Box
      sx={{
        minHeight: 82,
        px: 2,
        py: 1.5,
        borderLeft: '3px solid',
        borderColor: 'primary.main',
        bgcolor: '#F7FAFD',
      }}
    >
      <Typography variant="caption" color="text.secondary" fontWeight={750}>
        {label}
      </Typography>
      <Typography variant="h5" fontWeight={850} sx={{ mt: 0.25 }}>
        {value}
      </Typography>
    </Box>
  );
}

function JourneyStage({ stage, status, onOpen }) {
  const Icon = stage.icon;
  return (
    <Paper
      component="article"
      variant="outlined"
      sx={{
        p: { xs: 2, md: 2.5 },
        borderColor: 'divider',
        transition: 'border-color 160ms ease, box-shadow 160ms ease',
        '&:hover': {
          borderColor: 'primary.light',
          boxShadow: '0 8px 24px rgba(30, 58, 95, 0.08)',
        },
      }}
    >
      <Grid container spacing={2} alignItems="center">
        <Grid size={{ xs: 12, md: 1.25 }}>
          <Stack direction={{ xs: 'row', md: 'column' }} spacing={1} alignItems="center">
            <Typography color="primary.main" fontWeight={900}>{stage.number}</Typography>
            <Box
              sx={{
                width: 44,
                height: 44,
                display: 'grid',
                placeItems: 'center',
                border: '1px solid',
                borderColor: 'primary.200',
                borderRadius: 1,
                color: 'primary.main',
                bgcolor: '#F7FAFD',
              }}
            >
              <Icon />
            </Box>
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, md: 6.75 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 0.75 }}>
            <Typography component="h3" variant="h6" fontWeight={850}>{stage.title}</Typography>
            <Chip
              size="small"
              label={stage.mode}
              color={stage.mode === 'Interactivo' ? 'success' : 'warning'}
              variant="outlined"
            />
          </Stack>
          <Typography color="text.primary" sx={{ mb: 0.75 }}>{stage.outcome}</Typography>
          <Typography variant="body2" color="text.secondary">{stage.evidence}</Typography>
        </Grid>
        <Grid size={{ xs: 12, md: 2 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={750}>
            PERFIL
          </Typography>
          <Typography variant="body2" fontWeight={800}>{stage.actor}</Typography>
          <Typography variant="body2" color="primary.main" fontWeight={800} sx={{ mt: 1 }}>
            {stage.metric(status)}
          </Typography>
        </Grid>
        <Grid size={{ xs: 12, md: 2 }}>
          <Stack spacing={0.75}>
            {stage.edgeDemo && (
              <Button
                fullWidth
                variant="contained"
                component="a"
                href={PORTFOLIO_EDGE_DEMO_URL}
                target="_blank"
                rel="noreferrer"
                endIcon={<OpenInNewOutlinedIcon />}
              >
                Abrir estacion edge
              </Button>
            )}
            <Button
              fullWidth
              variant="outlined"
              endIcon={<ArrowForwardOutlinedIcon />}
              onClick={() => onOpen(stage)}
            >
              {stage.edgeDemo ? 'Ver control central' : 'Abrir evidencia'}
            </Button>
          </Stack>
        </Grid>
      </Grid>
    </Paper>
  );
}

export default function PortfolioDemoHub() {
  const navigate = useNavigate();
  const { actors, applyActor, refreshActors } = useScmActor();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let active = true;
    getPortfolioDemoStatus()
      .then((payload) => { if (active) setStatus(payload); })
      .catch(() => { if (active) setError('No pudimos leer el estado de la demo.'); });
    return () => { active = false; };
  }, []);

  const metrics = useMemo(() => [
    { label: 'Perfiles operativos', value: status?.counts?.actors ?? '—' },
    { label: 'Órdenes operativas', value: status?.counts?.operation_orders ?? '—' },
    { label: 'Mangas trazadas', value: status?.counts?.mangas ?? '—' },
    { label: 'Movimientos Kardex', value: status?.counts?.inventory_movements ?? '—' },
  ], [status]);

  const openStage = (stage) => {
    const targetActor = actors.find((item) => item.codigo === stage.actorCode);
    if (targetActor) applyActor(targetActor.id);
    navigate(stage.path);
  };

  const handleReset = async () => {
    setResetting(true);
    setError('');
    try {
      const payload = await resetPortfolioDemo();
      setStatus(payload);
      await refreshActors();
      setResetOpen(false);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error
        || 'No pudimos restablecer la demo en este momento.',
      );
    } finally {
      setResetting(false);
    }
  };

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Recorrido del primer piloto SCM"
        description="De la definición técnica del producto al ingreso físico en Kardex, con trazabilidad por documento, rol y evidencia."
        actions={(
          <Button
            variant="outlined"
            startIcon={<RestartAltOutlinedIcon />}
            onClick={() => setResetOpen(true)}
          >
            Restablecer demo
          </Button>
        )}
      />

      {error && <Alert severity="warning">{error}</Alert>}

      <Alert
        severity="info"
        icon={<FactoryOutlinedIcon />}
        sx={{ alignItems: 'center' }}
      >
        Todo el contenido es sintético. La integración con balanza RS-232 y la impresión TSC se reproducen sin conectar hardware ni datos de la empresa.
      </Alert>

      <Grid container spacing={1.5} aria-label="Estado del escenario">
        {metrics.map((item) => (
          <Grid key={item.label} size={{ xs: 6, lg: 3 }}>
            <Metric {...item} />
          </Grid>
        ))}
      </Grid>

      <Box component="section" aria-labelledby="pilot-journey-title">
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={1}
          sx={{ mb: 1.5 }}
        >
          <Box>
            <Typography id="pilot-journey-title" component="h2" variant="h5" fontWeight={900}>
              Flujo operativo y evidencia
            </Typography>
            <Typography color="text.secondary">
              Cinco etapas conectan decisiones, ejecución física y trazabilidad documental.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {status ? (
              <Chip
                icon={<CheckCircleOutlineOutlinedIcon />}
                label="Escenario listo"
                color="success"
                variant="outlined"
              />
            ) : (
              <Chip icon={<CircularProgress size={14} />} label="Preparando estado" variant="outlined" />
            )}
            <Button
              variant="text"
              startIcon={<TuneOutlinedIcon />}
              onClick={() => navigate('/inicio')}
            >
              Workspace por rol
            </Button>
          </Stack>
        </Stack>
        <Stack spacing={1.25}>
          {stages.map((stage) => (
            <JourneyStage
              key={stage.number}
              stage={stage}
              status={status}
              onOpen={openStage}
            />
          ))}
        </Stack>
      </Box>

      <Divider />

      <Box component="section" aria-labelledby="scope-title" sx={{ pb: 1 }}>
        <Typography id="scope-title" component="h2" variant="subtitle1" fontWeight={850}>
          Frontera del piloto
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 900, mt: 0.5 }}>
          Esta versión cubre maestros, planificación, fabricación, pesaje, recepción, Calidad y Kardex. Compras completas, despacho, operación offline y cierre contable permanecen fuera de este primer alcance.
        </Typography>
      </Box>

      <Dialog open={resetOpen} onClose={() => !resetting && setResetOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Restablecer escenario</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Se eliminarán las interacciones de esta demo y volverán a cargarse los datos sintéticos iniciales.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(false)} disabled={resetting}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleReset}
            disabled={resetting}
            startIcon={resetting ? <CircularProgress size={16} color="inherit" /> : <RestartAltOutlinedIcon />}
          >
            {resetting ? 'Restableciendo' : 'Restablecer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
