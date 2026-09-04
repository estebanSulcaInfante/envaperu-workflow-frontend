import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
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
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import ScaleOutlinedIcon from '@mui/icons-material/ScaleOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { QRCodeSVG } from 'qrcode.react';
import { useScmActor } from '../context/ScmActorContext';
import {
  asignarStockPreparadoRequerimiento,
  cerrarOrdenPreparacionMaterial,
  conciliarOrdenPreparacionMaterial,
  confirmarLecturaPesoPreparacion,
  consumirEntregaMaterialPreparado,
  crearOrdenPreparacionMaterial,
  decidirCalidadBolsaMaterialPreparado,
  despacharEntregaMaterialPreparado,
  emitirInsumoOrdenPreparacionMaterial,
  generarNecesidadMaterialPreparado,
  incorporarAporteOrdenPreparacionMaterial,
  invalidarLecturaPesoPreparacion,
  iniciarOrdenPreparacionMaterial,
  listarDestinosMaterialPreparado,
  listarReservasMaterialPreparadoTrabajo,
  liberarAsignacionStockMaterialPreparado,
  liberarOrdenPreparacionMaterial,
  liberarReservaMaterialPreparado,
  obtenerColaPreparacionMaterial,
  obtenerDetalleOrdenPreparacionMaterial,
  obtenerStockCompatibleRequerimiento,
  prepararEntregaMaterialPreparado,
  registrarLecturaPesoPreparacion,
  recibirBolsaMaterialPreparado,
  recibirEntregaMaterialPreparadoMaquina,
  reservarMaterialPreparadoTrabajo,
  reservarInsumosOrdenPreparacionMaterial,
  retornarEntregaMaterialPreparado,
} from '../services/opmPreparationApi';
import {
  listarAlmacenesScm,
  obtenerAlcanceAlmacenScm,
} from '../services/scmWarehouseOperationsApi';

const PAGE_SIZE = 25;
const kg = (value) => `${Number(value || 0).toFixed(3)} kg`;
const statusLabel = (value = '') => value.replaceAll('_', ' ');

const capabilityByAction = {
  create: 'OPM_CREAR',
  release: 'OPM_LIBERAR',
  execute: 'OPM_EJECUTAR',
  confirmWeight: 'OPM_PESO_CONFIRMAR',
  close: 'OPM_CERRAR',
  quality: 'MATERIAL_PREPARADO_CALIDAD_RESOLVER',
  reserve: 'MATERIAL_PREPARADO_RESERVAR',
  emit: 'MATERIAL_PREPARADO_EMITIR',
  consume: 'MATERIAL_PREPARADO_CONSUMIR',
  return: 'MATERIAL_PREPARADO_DEVOLVER',
  receive: 'MATERIAL_PREPARADO_RECIBIR',
  receiveMachine: 'MATERIAL_PREPARADO_RECIBIR_MAQUINA',
  emitInput: 'MATERIAL_EMITIR',
};

const mapBag = (item) => ({
  id: item.id,
  code: item.codigo,
  qrValue: item.qr_value,
  netKg: Number(item.peso_neto_kg),
  grossKg: Number(item.peso_bruto_kg),
  tareKg: Number(item.tara_kg),
  measurementMethod: item.metodo,
  status: item.estado,
  version: Number(item.version || 1),
  location: item.ubicacion,
  assignmentId: item.asignacion_requerimiento_id,
  isReading: false,
});

const mapReadingAsContribution = (item, contribution, input) => ({
  id: item.id,
  materialCode: input?.material?.codigo || 'LECTURA APORTE',
  materialName: input?.material?.nombre || `Lectura ${String(item.id).slice(0, 8)}`,
  emissionId: contribution?.emision_id || '',
  plannedKg: Number(input?.cantidad_plan_kg || 0),
  provisionalKg: Number(item.neto_kg || 0),
  grossKg: Number(item.bruto_kg || 0),
  tareKg: Number(item.tara_kg || 0),
  measurementMethod: item.metodo,
  status: contribution?.estado || item.estado,
  version: Number(item.version),
  readingType: item.tipo_uso,
});

const mapReadingAsBag = (item) => ({
  id: item.id,
  code: `Lectura bolsa · ${String(item.id).slice(0, 8)}`,
  netKg: Number(item.neto_kg || 0),
  grossKg: Number(item.bruto_kg || 0),
  tareKg: Number(item.tara_kg || 0),
  measurementMethod: item.metodo,
  status: item.estado,
  version: Number(item.version),
  assignmentId: item.asignacion_requerimiento_id,
  isReading: true,
});

const mapCoverage = (item) => ({
  assignmentId: item.id,
  needId: item.requerimiento_id,
  workColorId: item.trabajo_color?.id || '',
  workColorCode: item.trabajo_color?.codigo || item.corrida_codigo,
  runCode: item.corrida_codigo,
  plannedKg: Number(item.cantidad_planificada_kg),
  committedKg: Number(item.cantidad_comprometida_kg),
  consumedKg: Number(item.cantidad_consumida_kg),
  sourceType: item.tipo_fuente,
  orderId: item.orden_preparacion_id,
  lotId: item.lote_id,
  bagId: item.bolsa_id,
  bag: item.bolsa ? mapBag(item.bolsa) : null,
  status: item.estado,
});

const mapDelivery = (item) => (item ? {
  id: item.id,
  status: item.estado,
  version: item.version,
  origin: item.origen,
  destination: item.destino,
  returnLocation: item.retorno,
  quantityKg: Number(item.cantidad_kg),
} : null);

const mapPreparedReservation = (item) => ({
  id: item.id,
  assignmentId: item.asignacion_id,
  needId: item.requerimiento_id,
  bag: mapBag(item.bolsa),
  workColorId: item.trabajo_color.id,
  workColorCode: item.trabajo_color.codigo,
  workColorStatus: item.trabajo_color.estado,
  sourceLocation: item.ubicacion_origen,
  quantityKg: Number(item.cantidad_kg),
  status: item.estado,
  version: item.version,
  delivery: mapDelivery(item.entrega),
});

const normalizeDetail = (raw = {}) => {
  if (!raw.id || !raw.codigo || !raw.estado || !Number.isInteger(raw.version)) {
    throw new Error('El backend devolvió un detalle OPM fuera del contrato canónico.');
  }
  const readings = raw.lecturas;
  const rawRequirements = raw.requerimientos_insumo;
  const inputEmissions = rawRequirements.flatMap((requirement) => (
    (requirement.reservas || []).flatMap((reservation) => reservation.emisiones || [])
  ));
  const contributionByReading = new Map(raw.aportes.map((item) => [item.lectura_id, item]));
  const inputByEmission = new Map();
  rawRequirements.forEach((requirement) => requirement.reservas.forEach((reservation) => (
    reservation.emisiones.forEach((emission) => inputByEmission.set(emission.id, requirement))
  )));
  const contributions = readings.filter((item) => item.tipo_uso === 'APORTE').map((item) => {
    const contribution = contributionByReading.get(item.id);
    return mapReadingAsContribution(item, contribution, inputByEmission.get(contribution?.emision_id));
  });
  const bags = raw.bolsas.length > 0
    ? raw.bolsas.map(mapBag)
    : readings.filter((item) => item.tipo_uso === 'BOLSA_SALIDA').map(mapReadingAsBag);
  const outputByAssignment = bags.reduce((values, bag) => {
    if (!bag.assignmentId || bag.status === 'INVALIDADA') return values;
    values.set(bag.assignmentId, (values.get(bag.assignmentId) || 0) + bag.netKg);
    return values;
  }, new Map());
  const coverage = raw.asignaciones.map(mapCoverage).map((item) => ({
    ...item,
    remainingKg: Math.max(0, item.plannedKg - (outputByAssignment.get(item.assignmentId) || 0)),
  }));
  const balance = {
    inputKg: Number(raw.balance.entradas_incorporadas_kg),
    outputKg: Number(raw.balance.salidas_bolsas_kg),
    lossKg: Number(raw.balance.perdida_muestra_remanente_kg),
    differenceKg: Number(raw.balance.diferencia_kg),
    withinTolerance: raw.balance.conciliado,
  };
  const blockers = [];
  if (contributions.some((item) => item.status === 'PENDIENTE_SEGUNDA_CONFIRMACION')) {
    blockers.push('Hay lecturas de aporte pendientes de segundo actor.');
  }
  if (contributions.some((item) => item.status === 'APROBADA')) {
    blockers.push('Hay lecturas de aporte aprobadas todavía no incorporadas.');
  }
  if (bags.some((item) => item.isReading && item.status === 'PENDIENTE_SEGUNDA_CONFIRMACION')) {
    blockers.push('Hay lecturas de bolsa pendientes de segundo actor.');
  }
  if (raw.estado === 'EN_PREPARACION' && !bags.some((item) => item.status === 'APROBADA' || !item.isReading)) {
    blockers.push('Falta al menos una lectura aprobada de bolsa completa.');
  }
  if (!balance.withinTolerance) blockers.push('El balance está fuera de tolerancia.');
  return {
    ...raw,
    id: raw.id,
    code: raw.codigo,
    status: raw.estado,
    version: raw.version,
    targetKg: Number(raw.cantidad_objetivo_kg),
    recipe: raw.receta,
    needs: raw.asignaciones,
    contributions,
    bags,
    balance,
    quality: { status: raw.lote?.estado || 'NO_APLICA' },
    coverage,
    blockers,
    inputReservations: rawRequirements.flatMap((item) => item.reservas || []),
    inputEmissions,
    inputRequirements: rawRequirements,
    lot: raw.lote,
    preparedReservations: [],
  };
};

function CapabilityHint({ capability, can }) {
  if (can(capability)) return null;
  return <Typography variant="caption" color="warning.dark">Requiere {capability}</Typography>;
}

function Metric({ label, value, detail, color = '#1E3A5F' }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: '#F7F9FC', borderLeft: `4px solid ${color}`, minHeight: 92 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h6" sx={{ fontWeight: 850, mt: 0.25 }}>{value}</Typography>
      <Typography variant="caption" color="text.secondary">{detail}</Typography>
    </Box>
  );
}

function CompatibilityCard({ group, can, onCreate, onOpen, onStock }) {
  const recipeName = group.recipe?.name || group.recipe?.nombre || 'Receta sin nombre';
  const recipeCode = group.recipe?.code || group.recipe?.codigo || 'Sin código';
  const revision = group.recipe?.revision || group.recipe?.revision_numero;
  const createCapability = capabilityByAction.create;
  return (
    <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
            <Typography variant="h6" sx={{ fontWeight: 850 }}>{recipeName}</Typography>
            <Chip size="small" color="success" variant="outlined" label="Compatibilidad exacta" />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {recipeCode}{revision ? ` · revisión ${revision}` : ''}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="flex-start" useFlexGap flexWrap="wrap">
          {group.activeOpm && (
            <Button
              variant="outlined"
              endIcon={<ArrowForwardOutlinedIcon />}
              onClick={() => onOpen(group.activeOpm)}
              aria-label={`Abrir ${group.activeOpm.code}`}
            >
              {group.activeOpm.code}
            </Button>
          )}
          {group.needs.length > 0 && <Tooltip title={!can(createCapability) ? `Requiere ${createCapability}` : Number(group.pendingKg) <= 0 ? 'Toda la demanda ya tiene una fuente planificada.' : ''}>
            <span>
              <Button
                variant="contained"
                startIcon={<AddOutlinedIcon />}
                disabled={!can(createCapability) || Number(group.pendingKg) <= 0}
                onClick={() => onCreate(group)}
                aria-label={`Crear OPM para ${recipeName}`}
              >Crear OPM</Button>
            </span>
          </Tooltip>}
        </Stack>
      </Stack>
      <Grid container spacing={1.5} sx={{ mt: 1 }}>
        <Grid size={{ xs: 6, md: 3 }}><Metric label="Demanda compatible" value={kg(group.requiredKg)} detail={`${group.needs.length} necesidades compatibles`} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Metric label="Cobertura comprometida" value={kg(group.coveredKg)} detail="Stock u OPM ya liberada" color="#2E7D32" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Metric label="Planificado total" value={kg(group.plannedKg)} detail="Incluye compromisos aún no liberados" color="#5E35B1" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Metric label="Falta planificar" value={kg(group.pendingKg)} detail={`${Number(group.pendingKg || 0).toFixed(3)} kg sin fuente`} color="#C46A00" /></Grid>
      </Grid>
      <Stack spacing={0.75} sx={{ mt: 1.5 }}>
        {group.needs.map((need) => (
          <Stack key={need.id} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between" sx={{ p: 1, borderRadius: 1.5, bgcolor: '#F7F9FC' }}>
            <Chip size="small" label={`${need.workColorCode} · ${kg(need.pendingKg)} pendiente`} sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }} />
            <Tooltip title={!can(capabilityByAction.reserve) ? `Requiere ${capabilityByAction.reserve}` : 'Consulta solo las bolsas completas compatibles con receta y composición.'}>
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={!can(capabilityByAction.reserve) || Number(need.pendingKg) <= 0}
                  onClick={() => onStock(need)}
                  aria-label={`Revisar stock para ${need.workColorCode}`}
                >Revisar stock</Button>
              </span>
            </Tooltip>
          </Stack>
        ))}
      </Stack>
      {group.needs.length > 0 && <CapabilityHint capability={createCapability} can={can} />}
      {group.needs.length > 0 && <CapabilityHint capability={capabilityByAction.reserve} can={can} />}
    </Paper>
  );
}

const PREPARATION_LANES = [
  {
    id: 'PENDING', title: 'Por preparar', description: 'Necesidades compatibles sin una OPM activa', color: '#1565C0',
    accepts: (group) => !group.activeOpm,
  },
  {
    id: 'ACTIVE', title: 'En preparación', description: 'OPM liberadas, ejecutándose o por conciliar', color: '#C46A00',
    accepts: (group) => group.activeOpm && group.activeOpm.status !== 'CERRADA',
  },
  {
    id: 'READY', title: 'Listo', description: 'Lote preparado; continúa recepción, Calidad o entrega', color: '#2E7D32',
    accepts: (group) => group.activeOpm?.status === 'CERRADA',
  },
];

function PreparationKitchenBoard({ groups, can, onCreate, onOpen, onStock }) {
  return (
    <Box
      aria-label="Bandeja operativa de preparación"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', xl: 'repeat(3, minmax(320px, 1fr))' },
        gap: 1.5,
        alignItems: 'start',
      }}
    >
      {PREPARATION_LANES.map((lane) => {
        const laneGroups = groups.filter(lane.accepts);
        return (
          <Box key={lane.id} sx={{ p: 1.25, borderRadius: 2, bgcolor: '#F6F8FB', minHeight: 190 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} sx={{ mb: 1.25 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900, color: lane.color }}>{lane.title}</Typography>
                <Typography variant="caption" color="text.secondary">{lane.description}</Typography>
              </Box>
              <Chip size="small" label={laneGroups.length} aria-label={`${laneGroups.length} ${lane.title.toLowerCase()}`} />
            </Stack>
            <Stack spacing={1.25}>
              {laneGroups.map((group) => (
                <CompatibilityCard
                  key={group.compatibilityKey}
                  group={group}
                  can={can}
                  onCreate={onCreate}
                  onOpen={onOpen}
                  onStock={onStock}
                />
              ))}
              {laneGroups.length === 0 && (
                <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.7)' }}>
                  <Typography variant="body2" color="text.secondary">Sin tareas</Typography>
                </Paper>
              )}
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
}

function InputSupplySection({ detail, can, onReserve, onEmit }) {
  const requirements = detail.inputRequirements || [];
  const reservations = requirements.flatMap((requirement) => (requirement.reservas || []).map((reservation) => ({
    ...reservation,
    material: requirement.material,
    requirementId: requirement.id,
  })));
  const emissions = reservations.flatMap((reservation) => reservation.emisiones || []);
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
        <Box><Typography variant="h6" sx={{ fontWeight: 850 }}>Abastecimiento de inputs OPM</Typography><Typography variant="body2" color="text.secondary">Reserva desde ubicaciones físicas elegidas y emite hacia Preparación. Emitir cambia custodia; incorporar será el consumo real.</Typography></Box>
        {detail.status === 'LIBERADA' && reservations.length === 0 && <Tooltip title={!can(capabilityByAction.execute) ? `Requiere ${capabilityByAction.execute}` : ''}><span><Button variant="contained" disabled={!can(capabilityByAction.execute)} onClick={onReserve}>Reservar insumos</Button></span></Tooltip>}
      </Stack>
      <TableContainer sx={{ mt: 1.5 }}><Table size="small" aria-label="Reservas y emisiones de inputs OPM"><TableHead><TableRow><TableCell>Material</TableCell><TableCell align="right">Plan</TableCell><TableCell align="right">Reservado</TableCell><TableCell align="right">Emitido disponible</TableCell><TableCell>Origen</TableCell><TableCell align="right">Acción</TableCell></TableRow></TableHead><TableBody>
        {requirements.map((requirement) => {
          const requirementReservations = requirement.reservas || [];
          const reserved = requirementReservations.reduce((sum, item) => sum + Number(item.cantidad_kg || 0), 0);
          const emitted = requirementReservations.reduce((sum, item) => sum + Number(item.emitida_neta_kg || 0), 0);
          return <TableRow key={requirement.id}><TableCell><Typography variant="body2" sx={{ fontWeight: 750 }}>{requirement.material?.nombre}</Typography><Typography variant="caption">{requirement.material?.codigo}</Typography></TableCell><TableCell align="right">{kg(requirement.cantidad_plan_kg)}</TableCell><TableCell align="right">{kg(reserved)}</TableCell><TableCell align="right">{kg(emitted)}</TableCell><TableCell>{requirementReservations.map((reservation) => reservation.ubicacion?.codigo).filter(Boolean).join(', ') || 'Pendiente'}</TableCell><TableCell align="right">{requirementReservations.map((reservation) => {
            const pending = Number(reservation.cantidad_kg || 0) - Number(reservation.emitida_neta_kg || 0);
            return pending > 0 ? <Tooltip key={reservation.id} title={!can(capabilityByAction.emitInput) ? `Requiere ${capabilityByAction.emitInput}` : ''}><span><Button size="small" disabled={!can(capabilityByAction.emitInput)} onClick={() => onEmit({ ...reservation, pendingKg: pending, material: requirement.material })}>Emitir a preparación</Button></span></Tooltip> : null;
          })}</TableCell></TableRow>;
        })}
        {requirements.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3 }}>{detail.status === 'BORRADOR' ? 'Libera la OPM para congelar sus inputs objetivo.' : 'No hay requerimientos de input.'}</TableCell></TableRow>}
      </TableBody></Table></TableContainer>
      {detail.status === 'LIBERADA' && emissions.length === 0 && reservations.length > 0 && <Alert severity="warning" sx={{ mt: 1.5 }}>Antes de iniciar, emite al menos una reserva hacia una ubicación canónica de Preparación.</Alert>}
    </Paper>
  );
}

function ContributionsSection({ detail, can, onAdd, onConfirm, onIncorporate, onInvalidate }) {
  const executionOpen = detail.status === 'EN_PREPARACION';
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} alignItems={{ sm: 'center' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 850 }}>Aportes e incorporación real</Typography>
          <Typography variant="body2" color="text.secondary">El plan no se copia como peso. Cada input se incorpora tras la confirmación de otro actor.</Typography>
        </Box>
        <Button startIcon={<ScaleOutlinedIcon />} disabled={!executionOpen || !can(capabilityByAction.execute)} onClick={onAdd}>Registrar aporte</Button>
      </Stack>
      <Alert severity="warning" icon={<WarningAmberOutlinedIcon />} sx={{ my: 1.5 }}>
        <Typography component="span" variant="body2" sx={{ fontWeight: 850 }}>Pesos provisionales · contingencia manual</Typography>
        <Typography component="span" variant="body2">. Registra bruto, tara, neto y motivo; el creador no puede confirmar su propia lectura.</Typography>
      </Alert>
      <TableContainer>
        <Table size="small" aria-label="Aportes provisionales de la OPM">
          <TableHead><TableRow><TableCell>Insumo</TableCell><TableCell align="right">Plan</TableCell><TableCell align="right">Neto medido</TableCell><TableCell>Método</TableCell><TableCell>Estado</TableCell><TableCell align="right">Acción</TableCell></TableRow></TableHead>
          <TableBody>
            {detail.contributions.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell><Typography variant="body2" sx={{ fontWeight: 750 }}>{item.materialName}</Typography><Typography variant="caption">{item.materialCode}</Typography></TableCell>
                <TableCell align="right">{kg(item.plannedKg)}</TableCell>
                <TableCell align="right">{kg(item.provisionalKg)}</TableCell>
                <TableCell>{item.measurementMethod === 'MANUAL' || item.measurementMethod === 'CONTINGENCIA_MANUAL' ? 'Manual · contingencia' : statusLabel(item.measurementMethod)}</TableCell>
                <TableCell><Chip size="small" label={statusLabel(item.status)} color={item.status === 'CONFIRMADO' ? 'success' : 'warning'} /></TableCell>
                <TableCell align="right">
                  {(item.status === 'PENDIENTE_CONFIRMACION' || item.status === 'PENDIENTE_SEGUNDA_CONFIRMACION') && (
                    <Button size="small" disabled={!can(capabilityByAction.confirmWeight)} onClick={() => onConfirm(item)}>Confirmar peso</Button>
                  )}
                  {item.status === 'APROBADA' && (
                    <Button size="small" disabled={!can(capabilityByAction.execute)} onClick={() => onIncorporate(item)}>Incorporar input</Button>
                  )}
                  {(item.status === 'PENDIENTE_CONFIRMACION' || item.status === 'PENDIENTE_SEGUNDA_CONFIRMACION' || item.status === 'APROBADA') && (
                    <Button size="small" color="error" disabled={!can(capabilityByAction.execute) && !can(capabilityByAction.confirmWeight) && !can(capabilityByAction.close)} onClick={() => onInvalidate(item)} aria-label="Invalidar lectura">Invalidar</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {detail.contributions.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3 }}>Aún no hay aportes medidos.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

function OutputSection({
  detail, can, onAddBag, onConfirmBag, onInvalidateBag, onReceiveBag, onQualityBag, onReconcile, onClose,
}) {
  const [stickerBag, setStickerBag] = useState(null);
  const balance = detail.balance || {};
  const executionOpen = detail.status === 'EN_PREPARACION' || detail.status === 'PENDIENTE_CONCILIACION';
  const outputRegistrationOpen = detail.status === 'EN_PREPARACION';
  const hasPendingOutputAssignment = detail.coverage.some(
    (item) => item.sourceType === 'OPM_ESPERADA' && item.remainingKg > 0,
  );
  const reconciling = detail.status === 'EN_PREPARACION';
  const blockingBeforeReconcile = detail.blockers.filter((blocker) => blocker !== 'El balance está fuera de tolerancia.');
  const closeBlocked = !executionOpen
    || (reconciling ? blockingBeforeReconcile.length > 0 : detail.blockers.length > 0)
    || (detail.status === 'PENDIENTE_CONCILIACION' && !balance.withinTolerance)
    || !can(capabilityByAction.close);
  const closeReason = !executionOpen
    ? `La OPM está ${statusLabel(detail.status)}; solo se cierra desde preparación o conciliación.`
    : !can(capabilityByAction.close)
      ? `Requiere ${capabilityByAction.close}`
      : (reconciling ? blockingBeforeReconcile : detail.blockers).join(' ');
  const qualityStatus = detail.quality?.status || detail.quality?.estado || 'NO_APLICA';
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 850 }}>Salida, bolsas y balance</Typography>
          <Typography variant="body2" color="text.secondary">
            <Box component="span" sx={{ fontWeight: 850 }}>Solo bolsas completas en el piloto</Box>. En preparación se registra un pesaje provisional de salida; la bolsa y su QR canónicos nacen al cerrar el lote.
          </Typography>
        </Box>
        <Tooltip title={!hasPendingOutputAssignment ? 'Todas las necesidades de esta OPM ya tienen su salida atribuida.' : !can(capabilityByAction.execute) ? `Requiere ${capabilityByAction.execute}` : ''}><span><Button disabled={!outputRegistrationOpen || !hasPendingOutputAssignment || !can(capabilityByAction.execute)} onClick={onAddBag}>Pesar salida para bolsa</Button></span></Tooltip>
      </Stack>
      <Grid container spacing={1.5} sx={{ my: 1.5 }}>
        <Grid size={{ xs: 6, md: 3 }}><Metric label="Inputs incorporados" value={kg(balance.inputKg)} detail="Consumo real de emisiones" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Metric label="Salida pesada" value={kg(balance.outputKg)} detail={`${detail.bags.length} bolsa(s)`} color="#2E7D32" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Metric label="Pérdida declarada" value={kg(balance.lossKg)} detail="No inferida" color="#6D4C41" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Metric label="Diferencia" value={kg(balance.differenceKg)} detail={balance.withinTolerance ? 'Dentro de tolerancia' : 'Fuera de tolerancia'} color={balance.withinTolerance ? '#2E7D32' : '#C62828'} /></Grid>
      </Grid>
      <TableContainer>
        <Table size="small" aria-label="Bolsas de material preparado">
          <TableHead><TableRow><TableCell>Bolsa / QR</TableCell><TableCell align="right">Neto</TableCell><TableCell>Método</TableCell><TableCell>Estado</TableCell><TableCell align="right">Acción</TableCell></TableRow></TableHead>
          <TableBody>
            {detail.bags.map((bag) => (
              <TableRow key={bag.id}>
                <TableCell sx={{ fontWeight: 750 }}>{bag.code}</TableCell>
                <TableCell align="right">{kg(bag.netKg)}</TableCell>
                <TableCell>{bag.measurementMethod === 'CONTINGENCIA_MANUAL' ? 'Manual · contingencia' : statusLabel(bag.measurementMethod)}</TableCell>
                <TableCell><Chip size="small" label={statusLabel(bag.status)} /></TableCell>
                <TableCell align="right">
                  {(bag.status === 'PENDIENTE_CONFIRMACION' || bag.status === 'PENDIENTE_SEGUNDA_CONFIRMACION') && <Button size="small" disabled={!can(capabilityByAction.confirmWeight)} onClick={() => onConfirmBag(bag)}>Confirmar peso</Button>}
                  {bag.isReading && (bag.status === 'PENDIENTE_CONFIRMACION' || bag.status === 'PENDIENTE_SEGUNDA_CONFIRMACION' || bag.status === 'APROBADA') && <Button size="small" color="error" disabled={!can(capabilityByAction.execute) && !can(capabilityByAction.confirmWeight) && !can(capabilityByAction.close)} onClick={() => onInvalidateBag(bag)} aria-label="Invalidar lectura de bolsa">Invalidar</Button>}
                  {bag.status === 'PENDIENTE_RECEPCION' && <Button size="small" disabled={!can(capabilityByAction.receive)} onClick={() => onReceiveBag(bag)}>Recibir en almacén</Button>}
                  {bag.status === 'PENDIENTE_CALIDAD' && <Button size="small" color="success" disabled={!can(capabilityByAction.quality)} onClick={() => onQualityBag(bag)}>Resolver Calidad</Button>}
                  {bag.qrValue && <Button size="small" onClick={() => setStickerBag(bag)}>Ver / imprimir sticker</Button>}
                </TableCell>
              </TableRow>
            ))}
            {detail.bags.length === 0 && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}>Registra y confirma al menos una bolsa completa.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
      {detail.blockers.length > 0 && <Alert severity="warning" sx={{ mt: 1.5 }}><Typography variant="body2" sx={{ fontWeight: 800 }}>Bloqueos antes del cierre</Typography><Box component="ul" sx={{ my: 0.5, pl: 2.5 }}>{detail.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</Box></Alert>}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5} sx={{ mt: 1.5 }}>
        <Chip color={qualityStatus === 'DISPONIBLE' ? 'success' : 'warning'} label={qualityStatus === 'PENDIENTE' || qualityStatus === 'PENDIENTE_CALIDAD' ? 'Calidad pendiente' : `Calidad · ${statusLabel(qualityStatus)}`} />
        <Tooltip title={closeReason}>
          <span><Button variant="contained" disabled={closeBlocked} onClick={reconciling ? onReconcile : onClose}>{reconciling ? 'Conciliar balance' : 'Cerrar y generar lote preparado'}</Button></span>
        </Tooltip>
      </Stack>
      {closeBlocked && closeReason && <Typography variant="caption" color="warning.dark" sx={{ display: 'block', textAlign: 'right', mt: 0.5 }}>{closeReason}</Typography>}
      <Dialog className="prepared-bag-print-dialog" open={Boolean(stickerBag)} onClose={() => setStickerBag(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Sticker de material preparado</DialogTitle>
        <DialogContent>
          {stickerBag && <Box id="prepared-bag-print-sheet" sx={{ p: 2, textAlign: 'center', border: '2px solid #102F4F', borderRadius: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 900 }}>{stickerBag.code}</Typography>
            <Typography sx={{ mb: 1 }}>Material preparado · {kg(stickerBag.netKg)}</Typography>
            <QRCodeSVG value={stickerBag.qrValue} size={220} level="M" aria-label={`QR de ${stickerBag.code}`} />
            <Typography component="code" sx={{ display: 'block', mt: 1, overflowWrap: 'anywhere' }}>{stickerBag.qrValue}</Typography>
          </Box>}
        </DialogContent>
        <DialogActions><Button onClick={() => setStickerBag(null)}>Cerrar</Button><Button variant="contained" onClick={() => window.print()}>Imprimir sticker</Button></DialogActions>
      </Dialog>
    </Paper>
  );
}

function CoverageSection({
  detail, can, deliveryDestinations, returnDestinations,
  onReserve, onReleaseCoverage, onPrepare, onDispatch, onReceiveMachine, onConsume, onReturn, onRelease,
}) {
  const reservationsByAssignment = useMemo(() => {
    const groups = new Map();
    detail.preparedReservations.forEach((reservation) => {
      const values = groups.get(reservation.assignmentId) || [];
      values.push(reservation);
      groups.set(reservation.assignmentId, values);
    });
    return groups;
  }, [detail.preparedReservations]);
  const unavailableBagIds = useMemo(() => new Set(
    detail.preparedReservations
      .filter((reservation) => reservation.status !== 'LIBERADA')
      .map((reservation) => reservation.bag.id),
  ), [detail.preparedReservations]);
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 850 }}>Cobertura y consumo por TrabajoColor</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        La cobertura no mueve Kardex. Vincular crea la reserva física; despachar cambia custodia; recibir en máquina habilita el consumo. El retorno siempre es de una bolsa completa sin consumir.
      </Typography>
      <Alert severity="success" sx={{ mb: 1.5 }}>Flujo L2 activo con contrato canónico. No se permite consumo parcial, fraccionamiento ni reempaque en el piloto.</Alert>
      {deliveryDestinations.length > 0 && <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1.5 }}><Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>Destinos canónicos publicados:</Typography>{deliveryDestinations.map((location) => <Chip key={location.id} size="small" label={`${location.codigo}${location.almacen ? ` · ${location.almacen.codigo}` : ' · punto global'}`} />)}</Stack>}
      <TableContainer>
        <Table size="small" aria-label="Cobertura por TrabajoColor">
          <TableHead><TableRow><TableCell>TrabajoColor / corrida</TableCell><TableCell>Fuente</TableCell><TableCell align="right">Planificado</TableCell><TableCell align="right">Comprometido</TableCell><TableCell align="right">Consumido</TableCell><TableCell align="right">Reserva física</TableCell></TableRow></TableHead>
          <TableBody>
            {detail.coverage.map((coverage) => {
              const assignmentReservations = reservationsByAssignment.get(coverage.assignmentId) || [];
              const linkedKg = assignmentReservations
                .filter((reservation) => ['ACTIVA', 'CONSUMIDA'].includes(reservation.status))
                .reduce((sum, reservation) => sum + reservation.quantityKg, 0);
              const candidates = coverage.sourceType === 'LOTE_PREPARADO_STOCK'
                ? (coverage.bag && !unavailableBagIds.has(coverage.bag.id) ? [coverage.bag] : [])
                : detail.bags.filter((bag) => bag.status === 'DISPONIBLE' && !unavailableBagIds.has(bag.id));
              const reserveReason = !coverage.workColorId
                ? 'La corrida todavía no tiene TrabajoColor.'
                : coverage.status !== 'COMPROMETIDA'
                  ? `La asignación está ${statusLabel(coverage.status)}.`
                  : linkedKg >= coverage.committedKg
                    ? 'Toda la cobertura comprometida ya tiene bolsa vinculada.'
                    : candidates.length === 0
                      ? 'No hay una bolsa completa elegible publicada para esta asignación.'
                      : !can(capabilityByAction.reserve) ? `Requiere ${capabilityByAction.reserve}` : '';
              return (
                <TableRow key={coverage.assignmentId} hover>
                  <TableCell sx={{ fontWeight: 750 }}>{coverage.workColorCode}</TableCell>
                  <TableCell><Chip size="small" label={statusLabel(coverage.sourceType)} /></TableCell><TableCell align="right">{kg(coverage.plannedKg)}</TableCell><TableCell align="right">{kg(coverage.committedKg)}</TableCell><TableCell align="right">{kg(coverage.consumedKg)}</TableCell>
                  <TableCell align="right"><Stack direction="row" spacing={0.5} justifyContent="flex-end" useFlexGap flexWrap="wrap"><Tooltip title={reserveReason}><span><Button size="small" disabled={Boolean(reserveReason)} onClick={() => onReserve(coverage, candidates)} aria-label={`Vincular bolsa completa para ${coverage.workColorCode}`}>Vincular bolsa completa</Button></span></Tooltip>{coverage.sourceType === 'LOTE_PREPARADO_STOCK' && coverage.status === 'COMPROMETIDA' && assignmentReservations.length === 0 && coverage.consumedKg === 0 && <Tooltip title={!can(capabilityByAction.reserve) ? `Requiere ${capabilityByAction.reserve}` : 'Corrige la fuente planificada; no mueve Kardex porque todavía no existe reserva física.'}><span><Button size="small" color="error" disabled={!can(capabilityByAction.reserve)} onClick={() => onReleaseCoverage(coverage)}>Liberar cobertura de stock</Button></span></Tooltip>}</Stack></TableCell>
                </TableRow>
              );
            })}
            {detail.coverage.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3 }}>La cobertura aparecerá cuando la OPM tenga necesidades asignadas.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle1" sx={{ fontWeight: 850 }}>Custodia y entrega de bolsas</Typography>
      <TableContainer sx={{ mt: 1 }}>
        <Table size="small" aria-label="Custodia L2 de material preparado">
          <TableHead><TableRow><TableCell>Bolsa</TableCell><TableCell>TrabajoColor</TableCell><TableCell>Reserva</TableCell><TableCell>Entrega</TableCell><TableCell>Custodia</TableCell><TableCell align="right">Siguiente acción</TableCell></TableRow></TableHead>
          <TableBody>
            {detail.preparedReservations.map((reservation) => {
              const delivery = reservation.delivery;
              const workAllowsConsumption = ['EN_EJECUCION', 'PAUSADO'].includes(reservation.workColorStatus);
              return <TableRow key={reservation.id} hover>
                <TableCell><Typography variant="body2" sx={{ fontWeight: 800 }}>{reservation.bag.code}</Typography><Typography variant="caption">{kg(reservation.quantityKg)}</Typography></TableCell>
                <TableCell>{reservation.workColorCode}</TableCell>
                <TableCell><Chip size="small" label={statusLabel(reservation.status)} /></TableCell>
                <TableCell>{delivery ? <Chip size="small" color={delivery.status === 'CERRADA' ? 'success' : 'default'} label={statusLabel(delivery.status)} /> : 'Sin preparar'}</TableCell>
                <TableCell>{delivery?.destination?.codigo || reservation.sourceLocation?.codigo}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end" useFlexGap flexWrap="wrap">
                    {reservation.status === 'ACTIVA' && !delivery && <Tooltip title={!can(capabilityByAction.emit) ? `Requiere ${capabilityByAction.emit}` : ''}><span><Button size="small" disabled={!can(capabilityByAction.emit) || deliveryDestinations.length === 0} onClick={() => onPrepare(reservation)} aria-label={`Preparar entrega de ${reservation.bag.code}`}>Preparar entrega</Button></span></Tooltip>}
                    {reservation.status === 'ACTIVA' && delivery?.status === 'PREPARADA' && <Tooltip title={!can(capabilityByAction.emit) ? `Requiere ${capabilityByAction.emit}` : ''}><span><Button size="small" disabled={!can(capabilityByAction.emit)} onClick={() => onDispatch(reservation)}>Despachar bolsa</Button></span></Tooltip>}
                    {reservation.status === 'ACTIVA' && delivery?.status === 'EN_TRANSITO' && <Tooltip title={!can(capabilityByAction.receiveMachine) ? `Requiere ${capabilityByAction.receiveMachine}` : ''}><span><Button size="small" disabled={!can(capabilityByAction.receiveMachine)} onClick={() => onReceiveMachine(reservation)}>Confirmar recepción en máquina</Button></span></Tooltip>}
                    {reservation.status === 'ACTIVA' && delivery?.status === 'RECIBIDA_MAQUINA' && <Tooltip title={!can(capabilityByAction.consume) ? `Requiere ${capabilityByAction.consume}` : !workAllowsConsumption ? `El TrabajoColor está ${statusLabel(reservation.workColorStatus)}; solo EN EJECUCIÓN o PAUSADO admite consumo.` : ''}><span><Button size="small" color="success" disabled={!can(capabilityByAction.consume) || !workAllowsConsumption} onClick={() => onConsume(reservation)}>Consumir bolsa completa</Button></span></Tooltip>}
                    {reservation.status === 'ACTIVA' && ['EN_TRANSITO', 'RECIBIDA_MAQUINA'].includes(delivery?.status) && <Tooltip title={!can(capabilityByAction.return) ? `Requiere ${capabilityByAction.return}` : ''}><span><Button size="small" color="warning" disabled={!can(capabilityByAction.return) || returnDestinations.length === 0} onClick={() => onReturn(reservation)}>Retornar bolsa completa</Button></span></Tooltip>}
                    {['ACTIVA', 'DEVUELTA'].includes(reservation.status) && (!delivery || ['PREPARADA', 'RETORNADA_TOTAL'].includes(delivery.status)) && <Tooltip title={!can(capabilityByAction.reserve) ? `Requiere ${capabilityByAction.reserve}` : ''}><span><Button size="small" color="error" disabled={!can(capabilityByAction.reserve)} onClick={() => onRelease(reservation)}>Liberar reserva</Button></span></Tooltip>}
                  </Stack>
                  {reservation.status === 'ACTIVA' && delivery?.status === 'RECIBIDA_MAQUINA' && !can(capabilityByAction.consume) && <Typography variant="caption" color="warning.dark" sx={{ display: 'block' }}>Requiere {capabilityByAction.consume}</Typography>}
                  {reservation.status === 'ACTIVA' && delivery?.status === 'RECIBIDA_MAQUINA' && can(capabilityByAction.consume) && !workAllowsConsumption && <Typography variant="caption" color="warning.dark" sx={{ display: 'block' }}>Inicia o pausa operativamente el TrabajoColor antes de consumir.</Typography>}
                </TableCell>
              </TableRow>;
            })}
            {detail.preparedReservations.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3 }}>Aún no hay bolsas vinculadas físicamente a un TrabajoColor.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

const initialWeight = {
  grossKg: '', tareKg: '', netKg: '', reason: '', evidenceRef: '',
};

function WeightDialog({
  open, title, emissions = [], assignments = [], confirmation = false,
  stationBaseContext = null, onClose, onSubmit,
}) {
  const [form, setForm] = useState(() => ({
    ...initialWeight,
    emissionId: emissions[0]?.id || '',
    assignmentId: assignments[0]?.assignmentId || '',
  }));
  const valid = Number(form.grossKg) > 0
    && Number(form.netKg) > 0
    && Math.abs((Number(form.grossKg) - Number(form.tareKg)) - Number(form.netKg)) < 0.0005
    && form.reason.trim()
    && (confirmation || form.evidenceRef.trim())
    && (!emissions.length || form.emissionId);
  const fullyValid = valid && (!assignments.length || form.assignmentId);
  const stationContext = stationBaseContext ? JSON.stringify({
    type: 'SCM_PREPARATION_WEIGHT_TARGET', v: 1,
    ...stationBaseContext,
    ...(stationBaseContext.tipo_uso === 'BOLSA_SALIDA'
      ? { asignacion_requerimiento_id: form.assignmentId || null } : {}),
  }) : '';
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <Alert severity="warning">{confirmation ? 'Segundo actor: vuelve a ingresar exactamente bruto, tara y neto observados.' : 'Contingencia manual: exige evidencia y confirmación posterior de otro actor.'}</Alert>
        {emissions.length > 0 && <FormControl fullWidth><InputLabel id="opm-emission-label">Emisión de insumo</InputLabel><Select labelId="opm-emission-label" label="Emisión de insumo" value={form.emissionId} onChange={(event) => setForm((current) => ({ ...current, emissionId: event.target.value }))}>{emissions.map((item) => <MenuItem key={item.id} value={item.id}>{item.codigo || item.id}</MenuItem>)}</Select></FormControl>}
        {assignments.length > 1 && <FormControl fullWidth><InputLabel id="opm-output-assignment-label">Necesidad que cubrirá</InputLabel><Select labelId="opm-output-assignment-label" label="Necesidad que cubrirá" value={form.assignmentId} onChange={(event) => setForm((current) => ({ ...current, assignmentId: event.target.value }))}>{assignments.map((item) => <MenuItem key={item.assignmentId} value={item.assignmentId}>{item.workColorCode} · {item.runCode} · plan {kg(item.plannedKg)} · pendiente {kg(item.remainingKg)}</MenuItem>)}</Select></FormControl>}
        {assignments.length === 1 && <Alert severity="info">Necesidad autoseleccionada: {assignments[0].workColorCode} · {assignments[0].runCode} · pendiente {kg(assignments[0].remainingKg)}.</Alert>}
        {!confirmation && stationBaseContext && <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography fontWeight={800}>Pesaje conectado recomendado</Typography>
          <Typography variant="body2" color="text.secondary">Copia este contexto en la estación de Preparación. La balanza derivará el NET y dejará evidencia automática.</Typography>
          <TextField fullWidth multiline minRows={3} sx={{ mt: 1 }} label="Contexto QR" value={stationContext} InputProps={{ readOnly: true }} />
          <Button sx={{ mt: 1 }} variant="outlined" disabled={assignments.length > 0 && !form.assignmentId} onClick={async () => { await navigator.clipboard?.writeText(stationContext); window.open('http://127.0.0.1:5051/?tab=scm-prepared-material', '_blank'); }}>Copiar y abrir estación</Button>
        </Paper>}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField fullWidth label="Peso bruto (kg)" type="number" value={form.grossKg} onChange={(event) => setForm((current) => ({ ...current, grossKg: event.target.value }))} /><TextField fullWidth label="Tara (kg)" type="number" value={form.tareKg} onChange={(event) => setForm((current) => ({ ...current, tareKg: event.target.value }))} /><TextField fullWidth label="Peso neto (kg)" type="number" value={form.netKg} onChange={(event) => setForm((current) => ({ ...current, netKg: event.target.value }))} /></Stack>
        <TextField label="Motivo de contingencia" multiline minRows={2} value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} />
        {!confirmation && <TextField label="Referencia de evidencia" value={form.evidenceRef} onChange={(event) => setForm((current) => ({ ...current, evidenceRef: event.target.value }))} helperText="Foto, acta o referencia verificable del pesaje manual." />}
        {form.grossKg && form.netKg && !fullyValid && <Typography variant="caption" color="error">El neto debe ser exactamente bruto menos tara y todos los campos son obligatorios.</Typography>}
      </Stack></DialogContent>
      <DialogActions><Button onClick={onClose}>Cancelar</Button><Button variant="contained" disabled={!fullyValid} onClick={() => onSubmit(form)}>Registrar provisional</Button></DialogActions>
    </Dialog>
  );
}

function OpmPreparationWorkspace() {
  const { actorId, can } = useScmActor();
  const [queue, setQueue] = useState({ items: [], eligibleRuns: [], nextCursor: null });
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [createGroup, setCreateGroup] = useState(null);
  const [reasonDialog, setReasonDialog] = useState(null);
  const [weightDialog, setWeightDialog] = useState(null);
  const [confirmReadingDialog, setConfirmReadingDialog] = useState(null);
  const [incorporateDialog, setIncorporateDialog] = useState(null);
  const [reconcileDialog, setReconcileDialog] = useState(null);
  const [qualityDialog, setQualityDialog] = useState(null);
  const [retryCommand, setRetryCommand] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseReach, setWarehouseReach] = useState(null);
  const [preparedDestinations, setPreparedDestinations] = useState([]);
  const [movementDialog, setMovementDialog] = useState(null);
  const [reserveInputsDialog, setReserveInputsDialog] = useState(null);
  const [stockDialog, setStockDialog] = useState(null);
  const [l2Dialog, setL2Dialog] = useState(null);

  const loadQueue = useCallback(async ({ cursor = null, append = false } = {}) => {
    setLoading(true);
    setError('');
    try {
      const page = await obtenerColaPreparacionMaterial({
        cursor,
        limit: PAGE_SIZE,
        includeEligible: can(capabilityByAction.create),
      });
      setQueue((current) => ({
        items: append ? [...current.items, ...page.items] : page.items,
        eligibleRuns: append ? [...current.eligibleRuns, ...(page.eligibleRuns || [])] : (page.eligibleRuns || []),
        nextCursor: page.nextCursor,
      }));
    } catch (loadError) {
      console.error(loadError);
      setError('No se pudo cargar la cola resumida de preparación.');
    } finally {
      setLoading(false);
    }
  }, [can]);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  const selectedId = selected?.id;
  useEffect(() => {
    if (!selectedId) return undefined;
    let active = true;
    setWarehouses([]);
    setWarehouseReach(null);
    setPreparedDestinations([]);
    Promise.all([listarAlmacenesScm(), obtenerAlcanceAlmacenScm(), listarDestinosMaterialPreparado()])
      .then(([warehousePayload, reachPayload, destinationPayload]) => {
        if (!active) return;
        setWarehouses(warehousePayload.items || []);
        setWarehouseReach(reachPayload);
        setPreparedDestinations(destinationPayload.items);
      })
      .catch((loadError) => {
        console.error(loadError);
        if (active) setError('No se pudieron cargar las ubicaciones físicas autorizadas. Los movimientos quedan bloqueados.');
      });
    return () => { active = false; };
  }, [actorId, selectedId]);

  const loadDetail = useCallback(async (opmId) => {
    const response = await obtenerDetalleOrdenPreparacionMaterial(opmId);
    const normalized = normalizeDetail(response);
    const workColorIds = Array.from(new Set(
      normalized.coverage.map((coverage) => coverage.workColorId).filter(Boolean),
    ));
    const reservationPayloads = await Promise.all(
      workColorIds.map((workColorId) => listarReservasMaterialPreparadoTrabajo(workColorId)),
    );
    return {
      ...normalized,
      preparedReservations: reservationPayloads.flatMap((payload) => payload.items).map(mapPreparedReservation),
    };
  }, []);

  const openDetail = useCallback(async (opm) => {
    setDetailLoading(true);
    setError('');
    try {
      setSelected(await loadDetail(opm.id));
    } catch (loadError) {
      console.error(loadError);
      setError('No se pudo cargar el detalle de la OPM.');
    } finally {
      setDetailLoading(false);
    }
  }, [loadDetail]);

  const refreshDetail = useCallback(async () => {
    if (!selected?.id) return;
    setSelected(await loadDetail(selected.id));
  }, [loadDetail, selected?.id]);

  const refreshWorkspace = useCallback(async () => {
    setError('');
    setFeedback('');
    await loadQueue();
    if (!selected?.id) return;
    setDetailLoading(true);
    try {
      await refreshDetail();
    } catch (loadError) {
      console.error(loadError);
      setError('No se pudo actualizar el detalle de la OPM abierta. No ejecutes acciones hasta volver a actualizar.');
    } finally {
      setDetailLoading(false);
    }
  }, [loadQueue, refreshDetail, selected?.id]);

  const executeMutation = async (command) => {
    const {
      operation, success, refreshQueue = false, idempotencyKey,
    } = command;
    setBusy(true);
    setError('');
    setFeedback('');
    try {
      const result = await operation(idempotencyKey);
      setFeedback(success);
      setRetryCommand(null);
      if (refreshQueue) await loadQueue();
      if (selected?.id) await refreshDetail();
      return result;
    } catch (mutationError) {
      console.error(mutationError);
      const errorCode = mutationError?.response?.data?.error?.code;
      const status = mutationError?.response?.status;
      let errorMessage = errorCode === 'PREPARED_STOCK_DECISION_REQUIRED'
        ? 'Existe stock compatible sin decidir. Usa «Revisar stock» en cada necesidad antes de crear una OPM para el saldo.'
        : mutationError?.response?.data?.error?.message;
      if (status === 409 && errorCode === 'VERSION_CONFLICT' && selected?.id) {
        try {
          await refreshDetail();
          errorMessage = 'La OPM cambió mientras trabajabas. Recargamos sus datos vigentes; revísalos y vuelve a ejecutar la acción si todavía corresponde.';
        } catch (refreshError) {
          console.error(refreshError);
          errorMessage = 'La OPM cambió mientras trabajabas y no se pudo recargar. Pulsa «Actualizar» antes de continuar.';
        }
      }
      setError(errorMessage || 'La operación fue rechazada. Revisa los bloqueos antes de reintentar.');
      if (!status || status >= 500) setRetryCommand(command);
      else setRetryCommand(null);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const mutate = (operation, success, options = {}) => executeMutation({
    operation,
    success,
    ...options,
    idempotencyKey: crypto.randomUUID(),
  });

  const createOpm = async (reason) => {
    const group = createGroup;
    setCreateGroup(null);
    const created = await mutate((idempotencyKey) => crearOrdenPreparacionMaterial({
      coberturas: group.needs.filter((need) => Number(need.pendingKg) > 0).map((need) => ({
        requerimiento_id: need.id,
        cantidad_kg: Number(need.pendingKg).toFixed(3),
      })),
      motivo: reason,
    }, { idempotencyKey }), 'OPM creada con coberturas cuantificadas.', { refreshQueue: true });
    if (created?.id) await openDetail({ id: created.id });
  };

  const generateNeed = (run) => mutate(
    (idempotencyKey) => generarNecesidadMaterialPreparado(run.id, { idempotencyKey }),
    `Necesidad generada desde ${run.code}. Ya puede consolidarse por receta compatible.`,
    { refreshQueue: true },
  );

  const loadCompatibleStock = async (need, { cursor = null, append = false } = {}) => {
    setStockDialog((current) => ({
      ...(current || { need, selectedIds: [], reason: '' }),
      need,
      loading: true,
      error: '',
    }));
    try {
      const payload = await obtenerStockCompatibleRequerimiento(need.id, {
        cursor,
        limit: PAGE_SIZE,
      });
      setStockDialog((current) => ({
        ...current,
        need: { ...need, version: payload.requerimiento.version },
        items: append ? [...(current?.items || []), ...payload.items] : payload.items,
        nextCursor: payload.next_cursor,
        loading: false,
      }));
    } catch (loadError) {
      console.error(loadError);
      setStockDialog((current) => ({
        ...current,
        loading: false,
        error: 'No se pudo consultar el stock compatible para esta necesidad.',
      }));
    }
  };

  const submitStockAssignment = async () => {
    const dialog = stockDialog;
    const result = await mutate((idempotencyKey) => asignarStockPreparadoRequerimiento(dialog.need.id, {
      version: dialog.need.version,
      bolsa_ids: dialog.selectedIds,
      motivo: dialog.reason,
    }, { idempotencyKey }), 'Cobertura desde stock asignada explícitamente. Aún no movió ni reservó el Kardex; la reserva física ocurrirá al vincular la bolsa al TrabajoColor.', { refreshQueue: true });
    if (result) setStockDialog(null);
  };

  const openL2 = (action, reservation, extra = {}) => setL2Dialog({
    action,
    reservation,
    reason: '',
    bagId: extra.candidates?.[0]?.id || '',
    candidates: extra.candidates || [],
    coverage: extra.coverage || null,
    locationId: '',
  });

  const submitL2 = async () => {
    const dialog = l2Dialog;
    let operation;
    let success;
    if (dialog.action === 'reserve') {
      operation = (idempotencyKey) => reservarMaterialPreparadoTrabajo(dialog.coverage.workColorId, {
        asignacion_id: dialog.coverage.assignmentId,
        bolsa_id: dialog.bagId,
        motivo: dialog.reason,
      }, { idempotencyKey });
      success = 'Bolsa completa vinculada: ahora existe reserva física para el TrabajoColor.';
    }
    if (dialog.action === 'prepare') {
      operation = (idempotencyKey) => prepararEntregaMaterialPreparado(dialog.reservation.id, {
        version: dialog.reservation.version,
        ubicacion_destino_id: Number(dialog.locationId),
        motivo: dialog.reason,
      }, { idempotencyKey });
      success = 'Entrega preparada con destino canónico; la bolsa aún permanece en el almacén.';
    }
    if (dialog.action === 'dispatch') {
      operation = (idempotencyKey) => despacharEntregaMaterialPreparado(dialog.reservation.delivery.id, {
        version: dialog.reservation.delivery.version,
        motivo: dialog.reason,
      }, { idempotencyKey });
      success = 'Bolsa despachada y en tránsito bajo custodia del destino.';
    }
    if (dialog.action === 'receiveMachine') {
      operation = (idempotencyKey) => recibirEntregaMaterialPreparadoMaquina(dialog.reservation.delivery.id, {
        version: dialog.reservation.delivery.version,
        motivo: dialog.reason,
      }, { idempotencyKey });
      success = 'Recepción en máquina confirmada; el consumo ya puede declararse.';
    }
    if (dialog.action === 'consume') {
      operation = (idempotencyKey) => consumirEntregaMaterialPreparado(dialog.reservation.workColorId, {
        entrega_id: dialog.reservation.delivery.id,
        version: dialog.reservation.delivery.version,
        motivo: dialog.reason,
      }, { idempotencyKey });
      success = 'Bolsa completa consumida; se debitó el físico del punto de producción.';
    }
    if (dialog.action === 'return') {
      operation = (idempotencyKey) => retornarEntregaMaterialPreparado(dialog.reservation.delivery.id, {
        version: dialog.reservation.delivery.version,
        ubicacion_retorno_id: Number(dialog.locationId),
        motivo: dialog.reason,
      }, { idempotencyKey });
      success = 'Bolsa completa retornada al almacén sin consumo ni pérdida de identidad.';
    }
    if (dialog.action === 'release') {
      operation = (idempotencyKey) => liberarReservaMaterialPreparado(dialog.reservation.id, {
        version: dialog.reservation.version,
        motivo: dialog.reason,
      }, { idempotencyKey });
      success = 'Reserva liberada; la cobertura permanece comprometida y puede vincularse nuevamente.';
    }
    if (dialog.action === 'releaseCoverage') {
      operation = (idempotencyKey) => liberarAsignacionStockMaterialPreparado(dialog.coverage.assignmentId, {
        motivo: dialog.reason,
      }, { idempotencyKey });
      success = 'Cobertura de stock liberada sin mover Kardex; la necesidad vuelve a quedar pendiente de planificación.';
    }
    setL2Dialog(null);
    await mutate(operation, success, { refreshQueue: true });
  };

  const simpleReason = (title, action, success) => setReasonDialog({ title, action, success, reason: '' });
  const submitReason = async () => {
    const dialog = reasonDialog;
    setReasonDialog(null);
    await mutate((idempotencyKey) => dialog.action(dialog.reason, idempotencyKey, dialog), dialog.success, { refreshQueue: true });
  };

  const handleLifecycle = (type) => {
    if (type === 'release') simpleReason('Liberar OPM', (motivo, idempotencyKey) => liberarOrdenPreparacionMaterial(selected.id, { version: selected.version, motivo }, { idempotencyKey }), 'OPM liberada; sus requerimientos de insumo quedaron congelados.');
    if (type === 'start') simpleReason('Iniciar preparación', (motivo, idempotencyKey) => iniciarOrdenPreparacionMaterial(selected.id, { version: selected.version, motivo }, { idempotencyKey }), 'Preparación iniciada.');
  };

  const openReserveInputs = () => setReserveInputsDialog({ locationIds: [], reason: '' });
  const submitReserveInputs = async () => {
    const dialog = reserveInputsDialog;
    setReserveInputsDialog(null);
    await mutate((idempotencyKey) => reservarInsumosOrdenPreparacionMaterial(selected.id, {
      version: selected.version,
      ubicacion_origen_ids: dialog.locationIds.map(Number),
    }, { idempotencyKey }), 'Insumos reservados atómicamente desde las ubicaciones seleccionadas.');
  };

  const submitWeight = async (form) => {
    const type = weightDialog;
    setWeightDialog(null);
    const payload = {
      version: selected.version,
      tipo_uso: type === 'contribution' ? 'APORTE' : 'BOLSA_SALIDA',
      ...(type === 'bag' ? { asignacion_requerimiento_id: form.assignmentId } : {}),
      bruto_kg: Number(form.grossKg).toFixed(3),
      tara_kg: Number(form.tareKg).toFixed(3),
      neto_kg: Number(form.netKg).toFixed(3),
      motivo: form.reason,
      evidencia_ref: form.evidenceRef,
    };
    await mutate(
      (idempotencyKey) => registrarLecturaPesoPreparacion(selected.id, payload, { idempotencyKey }),
      `${type === 'contribution' ? 'Lectura de aporte' : 'Lectura de bolsa'} registrada; espera confirmación de otro actor.`,
    );
  };

  const confirmContribution = (item) => setConfirmReadingDialog(item);
  const confirmBag = (item) => setConfirmReadingDialog(item);
  const invalidateReading = (item) => simpleReason(
    'Invalidar lectura provisional',
    (motivo, idempotencyKey) => invalidarLecturaPesoPreparacion(item.id, {
      version: item.version,
      motivo,
    }, { idempotencyKey }),
    'Lectura invalidada sin borrar su trazabilidad. Puedes registrar una nueva medición.',
  );
  const submitReadingConfirmation = async (form) => {
    const reading = confirmReadingDialog;
    setConfirmReadingDialog(null);
    await mutate((idempotencyKey) => confirmarLecturaPesoPreparacion(reading.id, {
      version: reading.version,
      bruto_kg: Number(form.grossKg).toFixed(3),
      tara_kg: Number(form.tareKg).toFixed(3),
      neto_kg: Number(form.netKg).toFixed(3),
      motivo: form.reason,
    }, { idempotencyKey }), 'Segundo actor confirmó exactamente los tres pesos.');
  };
  const openIncorporate = (reading) => setIncorporateDialog({
    reading,
    emissionId: selected.inputEmissions[0]?.id || '',
    reason: '',
  });
  const submitIncorporate = async () => {
    const dialog = incorporateDialog;
    setIncorporateDialog(null);
    await mutate((idempotencyKey) => incorporarAporteOrdenPreparacionMaterial(selected.id, {
      version: selected.version,
      lectura_id: dialog.reading.id,
      emision_id: dialog.emissionId,
      motivo: dialog.reason,
    }, { idempotencyKey }), 'Input medido incorporado y consumido desde su emisión real.');
  };
  const openReconcile = () => setReconcileDialog({
    lossKg: '0.000', sampleKg: '0.000', remnantKg: '0.000', reason: '',
  });
  const submitReconcile = async () => {
    const dialog = reconcileDialog;
    setReconcileDialog(null);
    await mutate((idempotencyKey) => conciliarOrdenPreparacionMaterial(selected.id, {
      version: selected.version,
      perdida_kg: Number(dialog.lossKg).toFixed(3),
      muestra_kg: Number(dialog.sampleKg).toFixed(3),
      remanente_equipo_kg: Number(dialog.remnantKg).toFixed(3),
      motivo: dialog.reason,
    }, { idempotencyKey }), 'Balance conciliado a 0.001 kg; la OPM ya puede cerrarse.');
  };
  const closeOpm = () => setReasonDialog({
    title: 'Cerrar y crear LMP',
    success: 'OPM cerrada; las bolsas nacieron identificadas en Preparación y quedaron pendientes de Calidad.',
    reason: '',
    closeOpm: true,
    flow: 'DIRECTO_MAQUINA',
    locationId: physicalLocations.find((item) => item.tipo === 'STAGING')?.id || '',
    action: (motivo, idempotencyKey, dialog) => cerrarOrdenPreparacionMaterial(selected.id, {
      version: selected.version,
      motivo,
      flujo_salida: dialog.flow,
      ...(dialog.flow === 'DIRECTO_MAQUINA'
        ? { ubicacion_preparacion_id: Number(dialog.locationId) } : {}),
    }, { idempotencyKey }),
  });

  const decideQuality = async (decision, reason) => {
    const bag = qualityDialog;
    setQualityDialog(null);
    const lotId = selected.lot?.id;
    await mutate((idempotencyKey) => decidirCalidadBolsaMaterialPreparado(lotId, bag.id, { decision, motivo: reason }, { idempotencyKey }), `Calidad registró ${decision} para ${bag.code}.`, { refreshQueue: true });
  };

  const authorizedWarehouseIds = useMemo(
    () => new Set((warehouseReach?.almacenes || []).map((warehouse) => warehouse.id)),
    [warehouseReach],
  );
  const physicalLocations = useMemo(() => warehouses
    .filter((warehouse) => authorizedWarehouseIds.has(warehouse.id))
    .flatMap((warehouse) => (warehouse.ubicaciones || [])
      .filter((location) => location.activo !== false)
      .map((location) => ({ ...location, warehouse }))), [authorizedWarehouseIds, warehouses]);
  const deliveryDestinations = useMemo(() => preparedDestinations.filter(
    (location) => location.usos.includes('ENTREGA_PRODUCCION'),
  ), [preparedDestinations]);
  const returnDestinations = useMemo(() => preparedDestinations.filter(
    (location) => location.usos.includes('RETORNO_ALMACEN'),
  ), [preparedDestinations]);
  const movementLocations = useMemo(() => {
    if (movementDialog?.action !== 'emitInput') return physicalLocations;
    const sourceId = Number(movementDialog.reservation?.ubicacion?.id);
    return physicalLocations.filter((location) => (
      Number(location.id) !== sourceId && location.tipo === 'STAGING'
    ));
  }, [movementDialog, physicalLocations]);

  const submitMovement = async () => {
    const dialog = movementDialog;
    setMovementDialog(null);
    const locationId = Number(dialog.locationId);
    if (dialog.action === 'receive') {
      await mutate((idempotencyKey) => recibirBolsaMaterialPreparado(selected.lot.id, dialog.bag.id, {
        ubicacion_id: locationId,
        motivo: dialog.reason,
      }, { idempotencyKey }), 'Bolsa recibida y acreditada físicamente; queda pendiente de Calidad.', { refreshQueue: true });
    }
    if (dialog.action === 'emitInput') {
      await mutate((idempotencyKey) => emitirInsumoOrdenPreparacionMaterial(selected.id, dialog.reservation.id, {
        version: selected.version,
        ubicacion_destino_id: locationId,
        cantidad_kg: Number(dialog.reservation.pendingKg).toFixed(3),
        motivo: dialog.reason,
      }, { idempotencyKey }), 'Input emitido a Preparación; cambió custodia y aún no fue consumido.');
    }
  };

  const lifecycleActions = useMemo(() => {
    if (!selected) return [];
    if (selected.status === 'BORRADOR') return [{ type: 'release', label: 'Liberar OPM', capability: capabilityByAction.release }];
    if (selected.status === 'LIBERADA') return [{
      type: 'start',
      label: 'Iniciar preparación',
      capability: capabilityByAction.execute,
      disabledReason: selected.inputEmissions.length === 0 ? 'Primero emite al menos un input a Preparación.' : '',
    }];
    return [];
  }, [selected]);

  const l2DialogMeta = {
    reserve: {
      title: `Vincular bolsa completa · ${l2Dialog?.coverage?.workColorCode || ''}`,
      confirm: 'Crear reserva física',
      alert: 'La cobertura ya existe, pero el Kardex sigue libre. Esta acción vincula una bolsa completa al TrabajoColor y recién crea la reserva física.',
    },
    prepare: {
      title: `Preparar entrega · ${l2Dialog?.reservation?.bag?.code || ''}`,
      confirm: 'Confirmar preparación de entrega',
      alert: 'Congela el destino operativo; todavía no descuenta el almacén ni declara tránsito.',
    },
    dispatch: {
      title: `Despachar bolsa · ${l2Dialog?.reservation?.bag?.code || ''}`,
      confirm: 'Confirmar despacho',
      alert: 'El despacho cambia custodia y mueve la bolsa completa del almacén al punto operativo.',
    },
    receiveMachine: {
      title: `Confirmar recepción en máquina · ${l2Dialog?.reservation?.bag?.code || ''}`,
      confirm: 'Confirmar recepción',
      alert: 'El maquinista confirma custodia de la bolsa íntegra. Sin esta recepción el consumo permanece bloqueado.',
    },
    consume: {
      title: `Consumir bolsa completa · ${l2Dialog?.reservation?.bag?.code || ''}`,
      confirm: 'Confirmar consumo total',
      alert: 'Esta acción es irreversible en el piloto: consume toda la bolsa recibida, sin cantidades parciales.',
    },
    return: {
      title: `Retornar bolsa completa · ${l2Dialog?.reservation?.bag?.code || ''}`,
      confirm: 'Confirmar retorno total',
      alert: 'Solo retorna una bolsa íntegra y no consumida a una ubicación canónica de almacén.',
    },
    release: {
      title: `Liberar reserva · ${l2Dialog?.reservation?.bag?.code || ''}`,
      confirm: 'Liberar reserva',
      alert: 'Libera la reserva física, pero conserva la cobertura comprometida para poder vincular otra vez la bolsa.',
    },
    releaseCoverage: {
      title: `Liberar cobertura de stock · ${l2Dialog?.coverage?.workColorCode || ''}`,
      confirm: 'Liberar cobertura de stock',
      alert: 'Corrige la fuente planificada antes de reservar físicamente. No mueve Kardex ni consume la bolsa.',
    },
  }[l2Dialog?.action];
  const l2NeedsLocation = ['prepare', 'return'].includes(l2Dialog?.action);
  const l2Locations = l2Dialog?.action === 'prepare' ? deliveryDestinations : returnDestinations;
  const l2Valid = Boolean(l2Dialog?.reason?.trim())
    && (!l2NeedsLocation || Boolean(l2Dialog?.locationId))
    && (l2Dialog?.action !== 'reserve' || Boolean(l2Dialog?.bagId));

  if (loading && queue.items.length === 0) return <Box sx={{ minHeight: 360, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;

  return (
    <Stack spacing={2.25} sx={{ maxWidth: 1560, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ md: 'flex-start' }}>
        <Box>
          <Typography component="h1" variant="h4" sx={{ fontWeight: 900 }}>Preparación almacenable · OPM</Typography>
          <Typography color="text.secondary">Consolida necesidades compatibles, pesa lo realmente incorporado y genera lotes reutilizables con genealogía.</Typography>
        </Box>
        <Stack direction="row" spacing={1}><Chip color="success" variant="outlined" icon={<CheckCircleOutlineIcon />} label="Resumen cursor · detalle bajo demanda" /><Button startIcon={<RefreshOutlinedIcon />} onClick={refreshWorkspace} disabled={loading || detailLoading}>Actualizar</Button></Stack>
      </Stack>

      <Alert severity="info" icon={<ScienceOutlinedIcon />}>
        Este es el flujo canónico OPM: una preparación puede cubrir varios Trabajos de color. La molienda (OM) permanece aguas arriba y entrega insumos identificados; no sustituye la OPM. La premezcla ligada a una sola corrida permanece disponible abajo como flujo legacy temporal y no crea stock reutilizable.
      </Alert>
      {feedback && <Alert severity="success" onClose={() => setFeedback('')}>{feedback}</Alert>}
      {error && (
        <Alert
          severity="error"
          onClose={() => { setError(''); setRetryCommand(null); }}
          action={retryCommand ? (
            <Button color="inherit" size="small" disabled={busy} onClick={() => executeMutation(retryCommand)}>
              Reintentar misma operación
            </Button>
          ) : null}
        >
          {error}
        </Alert>
      )}

      {!selected && <>
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 4 }}><Metric label="Grupos compatibles" value={queue.items.length} detail="Solo resumen del servidor" /></Grid>
          <Grid size={{ xs: 12, md: 4 }}><Metric label="Carga por página" value={PAGE_SIZE} detail="Cursor opaco; sin ledger completo" color="#5E35B1" /></Grid>
          <Grid size={{ xs: 12, md: 4 }}><Metric label="Regla piloto" value="Bolsa completa" detail="Sin fraccionamiento operativo" color="#C46A00" /></Grid>
        </Grid>
        {queue.eligibleRuns.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 850 }}>Corridas listas para originar una necesidad</Typography>
            <Typography variant="body2" color="text.secondary">La necesidad nace de una corrida liberada con receta aprobada; después se agrupa por compatibilidad exacta.</Typography>
            <Stack spacing={1} sx={{ mt: 1.5 }}>
              {queue.eligibleRuns.map((run) => (
                <Stack key={run.id} direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={1} sx={{ p: 1.25, bgcolor: '#F7F9FC', borderRadius: 1 }}>
                  <Box><Typography sx={{ fontWeight: 800 }}>{run.code} · {run.workColor?.codigo || 'TrabajoColor por crear'}</Typography><Typography variant="caption" color="text.secondary">{run.recipe?.name} · rev. {run.recipe?.revision} · {kg(run.requiredKg)}</Typography></Box>
                  <Tooltip title={!can(capabilityByAction.create) ? `Requiere ${capabilityByAction.create}` : ''}><span><Button disabled={busy || !can(capabilityByAction.create)} onClick={() => generateNeed(run)}>Generar necesidad</Button></span></Tooltip>
                </Stack>
              ))}
            </Stack>
          </Paper>
        )}
        <PreparationKitchenBoard
          groups={queue.items}
          can={can}
          onCreate={setCreateGroup}
          onOpen={openDetail}
          onStock={(need) => loadCompatibleStock(need)}
        />
        {queue.items.length === 0 && queue.eligibleRuns.length === 0 && <Paper variant="outlined" sx={{ p: 5, textAlign: 'center' }}><Inventory2OutlinedIcon color="disabled" sx={{ fontSize: 42 }} /><Typography variant="h6">No hay necesidades pendientes ni corridas elegibles.</Typography></Paper>}
        {queue.nextCursor && <Button disabled={loading} onClick={() => loadQueue({ cursor: queue.nextCursor, append: true })}>Cargar siguientes {PAGE_SIZE}</Button>}
      </>}

      {detailLoading && <Paper variant="outlined" sx={{ minHeight: 240, display: 'grid', placeItems: 'center' }}><CircularProgress /></Paper>}
      {selected && !detailLoading && <>
        <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 2, background: 'linear-gradient(115deg, #F4F8FF 0%, #FFFFFF 70%)' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start"><Button startIcon={<ArrowBackOutlinedIcon />} onClick={() => setSelected(null)}>Cola</Button><Box><Typography component="h2" variant="h5" sx={{ fontWeight: 900 }}>{selected.code}</Typography><Typography color="text.secondary">{selected.recipe?.name || selected.recipe?.nombre || 'Receta'} · objetivo {kg(selected.targetKg)}</Typography></Box></Stack>
            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap"><Chip label={statusLabel(selected.status)} color={selected.status === 'CERRADA' ? 'success' : 'primary'} />{lifecycleActions.map((action) => <Tooltip key={action.type} title={!can(action.capability) ? `Requiere ${action.capability}` : action.disabledReason}><span><Button variant="contained" disabled={busy || !can(action.capability) || Boolean(action.disabledReason)} onClick={() => handleLifecycle(action.type)}>{action.label}</Button></span></Tooltip>)}</Stack>
          </Stack>
        </Paper>
        <InputSupplySection detail={selected} can={can} onReserve={openReserveInputs} onEmit={(reservation) => setMovementDialog({ action: 'emitInput', reservation, coverage: null, bag: null, locationId: '', reason: '' })} />
        <ContributionsSection detail={selected} can={can} onAdd={() => setWeightDialog('contribution')} onConfirm={confirmContribution} onIncorporate={openIncorporate} onInvalidate={invalidateReading} />
        <OutputSection
          detail={selected}
          can={can}
          onAddBag={() => setWeightDialog('bag')}
          onConfirmBag={confirmBag}
          onInvalidateBag={invalidateReading}
          onReceiveBag={(bag) => setMovementDialog({ action: 'receive', bag, coverage: null, locationId: '', reason: '' })}
          onQualityBag={setQualityDialog}
          onReconcile={openReconcile}
          onClose={closeOpm}
        />
        {selected.lot && (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 850 }}>Recepción y Calidad · {selected.lot.codigo || selected.lot.code}</Typography>
                {(selected.lot.estado || selected.lot.status) === 'PENDIENTE_RECEPCION' ? (
                  <Typography color="warning.dark">El cierre no acreditó Kardex. Recibe cada bolsa en una ubicación física autorizada.</Typography>
                ) : (
                  <Typography color="text.secondary">Las bolsas ya fueron recibidas. Preparación y Calidad deben ser actores distintos.</Typography>
                )}
              </Box>
              {(selected.lot.estado || selected.lot.status) === 'PENDIENTE_CALIDAD' && <Chip color="warning" label="Resolver bolsa por bolsa" />}
            </Stack>
          </Paper>
        )}
        <CoverageSection
          detail={selected}
          can={can}
          deliveryDestinations={deliveryDestinations}
          returnDestinations={returnDestinations}
          onReserve={(coverage, candidates) => openL2('reserve', null, { coverage, candidates })}
          onReleaseCoverage={(coverage) => openL2('releaseCoverage', null, { coverage })}
          onPrepare={(reservation) => openL2('prepare', reservation)}
          onDispatch={(reservation) => openL2('dispatch', reservation)}
          onReceiveMachine={(reservation) => openL2('receiveMachine', reservation)}
          onConsume={(reservation) => openL2('consume', reservation)}
          onReturn={(reservation) => openL2('return', reservation)}
          onRelease={(reservation) => openL2('release', reservation)}
        />
      </>}

      <Dialog open={Boolean(createGroup)} onClose={() => setCreateGroup(null)} fullWidth maxWidth="sm">
        <DialogTitle>Crear OPM consolidada</DialogTitle>
        <DialogContent><Stack spacing={1.5} sx={{ pt: 1 }}><Alert severity="info">Se crearán coberturas cuantificadas para {createGroup?.needs.length || 0} necesidades compatibles. La receta se deriva y valida en el servidor.</Alert><TextField autoFocus label="Motivo" multiline minRows={2} id="create-opm-reason" /></Stack></DialogContent>
        <DialogActions><Button onClick={() => setCreateGroup(null)}>Cancelar</Button><Button variant="contained" onClick={() => createOpm(document.getElementById('create-opm-reason')?.value?.trim() || 'Consolidación de necesidades compatibles')}>Crear OPM</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(stockDialog)} onClose={() => setStockDialog(null)} fullWidth maxWidth="md">
        <DialogTitle>Stock compatible · {stockDialog?.need?.workColorCode}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <Alert severity="info">Decide de forma explícita si esta bolsa será fuente de cobertura antes de crear una OPM. Esta decisión no mueve ni reserva físicamente el Kardex; eso ocurrirá al vincular la bolsa a un TrabajoColor. En el piloto no hay fraccionamiento ni reempaque.</Alert>
            {stockDialog?.error && <Alert severity="error">{stockDialog.error}</Alert>}
            {stockDialog?.loading && <Box sx={{ display: 'grid', placeItems: 'center', py: 3 }}><CircularProgress size={28} /></Box>}
            {!stockDialog?.loading && (stockDialog?.items || []).map((bag) => (
              <Paper key={bag.id} variant="outlined" sx={{ p: 1.25 }}>
                <FormControlLabel
                  control={<Checkbox checked={stockDialog.selectedIds.includes(bag.id)} onChange={(event) => setStockDialog((current) => ({ ...current, selectedIds: event.target.checked ? [...current.selectedIds, bag.id] : current.selectedIds.filter((id) => id !== bag.id) }))} />}
                  label={<Box><Typography variant="body2" sx={{ fontWeight: 850 }}>{bag.codigo}</Typography><Typography variant="caption" color="text.secondary">{bag.lote.codigo} · {kg(bag.peso_neto_kg)} · {bag.ubicacion.codigo} · {bag.ubicacion.nombre}</Typography></Box>}
                />
              </Paper>
            ))}
            {!stockDialog?.loading && (stockDialog?.items || []).length === 0 && <Alert severity="warning">No hay bolsas completas compatibles y libres. Crea una OPM por el saldo pendiente.</Alert>}
            {stockDialog?.nextCursor && <Button disabled={stockDialog.loading} onClick={() => loadCompatibleStock(stockDialog.need, { cursor: stockDialog.nextCursor, append: true })}>Cargar siguientes {PAGE_SIZE} bolsas</Button>}
            <TextField label="Motivo" multiline minRows={2} value={stockDialog?.reason || ''} onChange={(event) => setStockDialog((current) => ({ ...current, reason: event.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setStockDialog(null)}>Cerrar</Button><Button variant="contained" disabled={busy || !stockDialog?.selectedIds?.length || !stockDialog?.reason?.trim()} onClick={submitStockAssignment}>Asignar cobertura desde bolsas completas</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(l2Dialog)} onClose={() => setL2Dialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>{l2DialogMeta?.title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity={l2Dialog?.action === 'consume' ? 'warning' : 'info'}>{l2DialogMeta?.alert}</Alert>
            {l2Dialog?.action === 'reserve' && <FormControl fullWidth>
              <InputLabel id="l2-bag-label">Bolsa completa</InputLabel>
              <Select labelId="l2-bag-label" label="Bolsa completa" value={l2Dialog?.bagId || ''} onChange={(event) => setL2Dialog((current) => ({ ...current, bagId: event.target.value }))}>
                {(l2Dialog?.candidates || []).map((bag) => <MenuItem key={bag.id} value={bag.id}>{bag.code} · {kg(bag.netKg)} · {bag.location?.codigo || 'Ubicación por confirmar'}</MenuItem>)}
              </Select>
            </FormControl>}
            {l2NeedsLocation && <FormControl fullWidth>
              <InputLabel id="l2-location-label">{l2Dialog?.action === 'prepare' ? 'Destino de producción' : 'Ubicación de retorno'}</InputLabel>
              <Select labelId="l2-location-label" label={l2Dialog?.action === 'prepare' ? 'Destino de producción' : 'Ubicación de retorno'} value={l2Dialog?.locationId || ''} onChange={(event) => setL2Dialog((current) => ({ ...current, locationId: event.target.value }))}>
                {l2Locations.map((location) => <MenuItem key={location.id} value={location.id}>{location.almacen ? `${location.almacen.codigo} · ` : ''}{location.codigo} · {location.nombre}{location.almacen ? '' : ' · punto global'}</MenuItem>)}
              </Select>
            </FormControl>}
            <TextField label="Motivo" multiline minRows={2} value={l2Dialog?.reason || ''} onChange={(event) => setL2Dialog((current) => ({ ...current, reason: event.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setL2Dialog(null)}>Cancelar</Button><Button variant="contained" color={l2Dialog?.action === 'consume' ? 'success' : 'primary'} disabled={busy || !l2Valid} onClick={submitL2}>{l2DialogMeta?.confirm}</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(reasonDialog)} onClose={() => setReasonDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>{reasonDialog?.title}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
          {reasonDialog?.closeOpm && <>
            <Alert severity="info">Directo a máquina: la bolsa nace físicamente en Preparación, pasa Calidad allí y luego se despacha. No se inventa una recepción en almacén.</Alert>
            <TextField select label="Flujo de salida" value={reasonDialog.flow} onChange={(event) => setReasonDialog((current) => ({ ...current, flow: event.target.value }))}>
              <MenuItem value="DIRECTO_MAQUINA">Directo a máquina</MenuItem><MenuItem value="ALMACEN">Almacenar material preparado</MenuItem>
            </TextField>
            {reasonDialog.flow === 'DIRECTO_MAQUINA' && <TextField select label="Punto físico de Preparación" value={reasonDialog.locationId} onChange={(event) => setReasonDialog((current) => ({ ...current, locationId: event.target.value }))}>
              {physicalLocations.filter((item) => item.tipo === 'STAGING' && (item.clases_articulo || []).includes('MATERIAL_PREPARADO')).map((item) => <MenuItem key={item.id} value={item.id}>{item.codigo} · {item.nombre}</MenuItem>)}
            </TextField>}
          </>}
          <TextField autoFocus fullWidth label="Motivo" multiline minRows={2} value={reasonDialog?.reason || ''} onChange={(event) => setReasonDialog((current) => ({ ...current, reason: event.target.value }))} />
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setReasonDialog(null)}>Cancelar</Button><Button variant="contained" disabled={!reasonDialog?.reason?.trim() || (reasonDialog?.closeOpm && reasonDialog.flow === 'DIRECTO_MAQUINA' && !reasonDialog.locationId)} onClick={submitReason}>Confirmar</Button></DialogActions>
      </Dialog>

      {weightDialog && <WeightDialog open title={weightDialog === 'contribution' ? 'Registrar lectura provisional de aporte' : 'Registrar pesaje provisional de salida para bolsa'} assignments={weightDialog === 'bag' ? selected.coverage.filter((item) => item.sourceType === 'OPM_ESPERADA' && item.remainingKg > 0) : []} stationBaseContext={{ orden_preparacion_id: selected.id, orden_preparacion_codigo: selected.code, receta_nombre: selected.recipe?.name || selected.recipe?.nombre || 'Receta de la OPM', objetivo_kg: selected.targetKg, version: selected.version, tipo_uso: weightDialog === 'contribution' ? 'APORTE' : 'BOLSA_SALIDA', pesado_por_id: actorId }} onClose={() => setWeightDialog(null)} onSubmit={submitWeight} />}
      {confirmReadingDialog && <WeightDialog open confirmation title="Segundo actor · confirmar lectura" onClose={() => setConfirmReadingDialog(null)} onSubmit={submitReadingConfirmation} />}

      <Dialog open={Boolean(incorporateDialog)} onClose={() => setIncorporateDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>Incorporar lectura aprobada</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="warning">Esta acción consume el peso neto real desde la emisión seleccionada. Emitir no habría consumido el input.</Alert>
          <FormControl fullWidth><InputLabel id="incorporate-emission-label">Emisión de input</InputLabel><Select labelId="incorporate-emission-label" label="Emisión de input" value={incorporateDialog?.emissionId || ''} onChange={(event) => setIncorporateDialog((current) => ({ ...current, emissionId: event.target.value }))}>{(selected?.inputEmissions || []).map((emission) => <MenuItem key={emission.id} value={emission.id}>{emission.codigo || emission.id} · disponible {kg(emission.cantidad_disponible_kg)}</MenuItem>)}</Select></FormControl>
          <TextField label="Motivo" multiline minRows={2} value={incorporateDialog?.reason || ''} onChange={(event) => setIncorporateDialog((current) => ({ ...current, reason: event.target.value }))} />
          {selected?.inputEmissions?.length === 0 && <Alert severity="error">No existen emisiones disponibles para incorporar. Reserva y emite los insumos primero.</Alert>}
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setIncorporateDialog(null)}>Cancelar</Button><Button variant="contained" disabled={!incorporateDialog?.emissionId || !incorporateDialog?.reason?.trim()} onClick={submitIncorporate}>Incorporar input real</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(reconcileDialog)} onClose={() => setReconcileDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>Conciliar balance de masa</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">Entradas incorporadas = bolsas completas + pérdida + muestra + remanente. El resultado debe cerrar a 0.001 kg.</Alert>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField label="Pérdida (kg)" type="number" value={reconcileDialog?.lossKg || ''} onChange={(event) => setReconcileDialog((current) => ({ ...current, lossKg: event.target.value }))} /><TextField label="Muestra (kg)" type="number" value={reconcileDialog?.sampleKg || ''} onChange={(event) => setReconcileDialog((current) => ({ ...current, sampleKg: event.target.value }))} /><TextField label="Remanente en equipo (kg)" type="number" value={reconcileDialog?.remnantKg || ''} onChange={(event) => setReconcileDialog((current) => ({ ...current, remnantKg: event.target.value }))} /></Stack>
          <TextField label="Motivo" multiline minRows={2} value={reconcileDialog?.reason || ''} onChange={(event) => setReconcileDialog((current) => ({ ...current, reason: event.target.value }))} />
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setReconcileDialog(null)}>Cancelar</Button><Button variant="contained" disabled={!reconcileDialog?.reason?.trim()} onClick={submitReconcile}>Conciliar a 0.001 kg</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(movementDialog)} onClose={() => setMovementDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>{movementDialog?.action === 'receive' ? 'Recibir bolsa en almacén' : 'Emitir input a Preparación'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              {movementDialog?.action === 'emitInput'
                ? `Origen reservado: ${movementDialog?.reservation?.ubicacion?.codigo || 'por confirmar'}. Emitir mueve ${kg(movementDialog?.reservation?.pendingKg)} a una zona de Preparación; todavía no consume el material.`
                : 'Solo se muestran ubicaciones activas dentro del alcance físico del actor. El acceso transversal de consulta no autoriza esta operación.'}
            </Alert>
            <FormControl fullWidth>
              <InputLabel id="physical-location-label">{movementDialog?.action === 'emitInput' ? 'Destino de preparación' : 'Ubicación física autorizada'}</InputLabel>
              <Select
                labelId="physical-location-label"
                label={movementDialog?.action === 'emitInput' ? 'Destino de preparación' : 'Ubicación física autorizada'}
                value={movementDialog?.locationId || ''}
                onChange={(event) => setMovementDialog((current) => ({ ...current, locationId: event.target.value }))}
              >
                {movementLocations.map((location) => <MenuItem key={location.id} value={location.id}>{location.almacen?.codigo || location.warehouse?.codigo || 'Punto operativo'} · {location.codigo} · {location.nombre}</MenuItem>)}
              </Select>
            </FormControl>
            {movementLocations.length === 0 && <Alert severity="warning">{movementDialog?.action === 'emitInput' ? 'No tienes una zona STAGING de Preparación distinta del origen.' : 'No tienes ubicaciones canónicas autorizadas para esta acción.'}</Alert>}
            <TextField label="Motivo" multiline minRows={2} value={movementDialog?.reason || ''} onChange={(event) => setMovementDialog((current) => ({ ...current, reason: event.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setMovementDialog(null)}>Cancelar</Button><Button variant="contained" disabled={!movementDialog?.locationId || !movementDialog?.reason?.trim()} onClick={submitMovement}>{movementDialog?.action === 'emitInput' ? `Emitir ${kg(movementDialog?.reservation?.pendingKg)}` : 'Confirmar ubicación y custodia'}</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(reserveInputsDialog)} onClose={() => setReserveInputsDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>Reservar inputs desde ubicaciones reales</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">La reserva buscará saldos únicamente en las ubicaciones seleccionadas y dentro de tu alcance físico.</Alert>
          <FormControl fullWidth><InputLabel id="reserve-input-locations-label">Ubicaciones de origen</InputLabel><Select multiple labelId="reserve-input-locations-label" label="Ubicaciones de origen" value={reserveInputsDialog?.locationIds || []} onChange={(event) => setReserveInputsDialog((current) => ({ ...current, locationIds: event.target.value }))} renderValue={(selectedIds) => selectedIds.map((id) => physicalLocations.find((item) => item.id === id)?.codigo).filter(Boolean).join(', ')}>{physicalLocations.map((location) => <MenuItem key={location.id} value={location.id}>{location.warehouse.codigo} · {location.codigo} · {location.nombre}</MenuItem>)}</Select></FormControl>
          {physicalLocations.length === 0 && <Alert severity="warning">No tienes ubicaciones físicas asignadas para reservar.</Alert>}
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setReserveInputsDialog(null)}>Cancelar</Button><Button variant="contained" disabled={!reserveInputsDialog?.locationIds?.length} onClick={submitReserveInputs}>Reservar desde selección</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(qualityDialog)} onClose={() => setQualityDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>Decisión de Calidad · {qualityDialog?.code}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}><Alert severity="warning">La persona que preparó el lote no puede resolver su propia decisión de Calidad.</Alert><TextField id="quality-reason" label="Motivo" multiline minRows={2} /></Stack></DialogContent>
        <DialogActions><Button onClick={() => setQualityDialog(null)}>Cancelar</Button><Button color="error" onClick={() => decideQuality('RECHAZAR', document.getElementById('quality-reason')?.value || 'Rechazo de Calidad')}>Rechazar</Button><Button color="warning" onClick={() => decideQuality('BLOQUEAR', document.getElementById('quality-reason')?.value || 'Bloqueo de Calidad')}>Bloquear</Button><Button variant="contained" color="success" onClick={() => decideQuality('LIBERAR', document.getElementById('quality-reason')?.value || 'Liberación de Calidad')}>Liberar</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}

export default OpmPreparationWorkspace;
