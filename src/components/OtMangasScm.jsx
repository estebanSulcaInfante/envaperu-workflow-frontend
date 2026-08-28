import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Alert, AlertTitle, Box, Button, Card, CardActionArea, Checkbox, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl,
  FormControlLabel, InputLabel, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { getTrabajadores, obtenerMaquinas } from '../services/api';
import {
  agregarMangasTrabajoColorScm,
  anularMangaScm,
  anularPesajeScm,
  aprobarMangaExtraScm,
  aprobarCorreccionPesajeScm,
  cambiarEstadoTrabajoColorScm,
  crearOtFabricacionScm,
  crearTrabajoColorScm,
  generarEtiquetasPrepesaje,
  listarOtScm,
  listarSolicitudesMangaExtraScm,
  listarOrdenesFabricacionScm,
  obtenerPesajeMangaScm,
  obtenerPlanMangas,
  recalcularPlanMangas,
  reasignarMangasTrabajoColorScm,
  reemplazarEtiquetaScm,
  solicitarMangaExtraScm,
  solicitarCorreccionPesajeScm,
} from '../services/scmOtApi';
import {
  listarCentrosTrabajoScm,
  mensajeErrorScm,
} from '../services/scmEngineeringApi';
import PageHeader from './ui/PageHeader';
import ProcessJourney from './ui/ProcessJourney';
import PlantJourneysOverview from './PlantJourneysOverview';
import { useScmActor } from '../context/ScmActorContext';
import { todayInLima } from '../utils/limaDate';
import {
  buildScmPrelabelPreviewUrl,
  loadLastPendingPrintJob,
  storeLastPendingPrintJob,
} from '../utils/scmPrintPreview';

const today = todayInLima;
const journeyContextFromSearch = (searchParams) => {
  const requestedDate = searchParams.get('fecha') || '';
  const requestedShift = String(searchParams.get('turno') || '').toUpperCase();
  const requestedMode = String(searchParams.get('modo') || '').toLowerCase();
  return {
    fecha_operativa: /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : today(),
    turno: ['DIA', 'NOCHE', 'EXTRA'].includes(requestedShift) ? requestedShift : 'DIA',
    perspective: requestedMode === 'armado' ? 'ENSAMBLE' : 'FABRICACION',
    ot: searchParams.get('ot') || '',
  };
};
const stateLabel = (value) => String(value || '').replaceAll('_', ' ');
const compactQuantity = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? new Intl.NumberFormat('es-PE').format(parsed) : '0';
};

const PRODUCTION_CLOSED_MANGA_STATES = new Set([
  'PESADA', 'ETIQUETADA_FINAL', 'PENDIENTE_RECEPCION_ALMACEN', 'RECIBIDA',
]);
const PRODUCTION_OPEN_MANGA_STATES = new Set([
  'ABIERTA', 'INCOMPLETA', 'PESAJE_PARCIAL',
]);
const PRELABELED_MANGA_STATES = new Set(['PREETIQUETADA']);
const PRINTED_LABEL_STATES = new Set(['IMPRESA']);
const GENERATED_LABEL_STATES = new Set(['GENERADA', 'PENDIENTE_IMPRESION']);
const DISCARDED_MANGA_STATES = new Set(['ANULADA', 'BORRADA']);
const UNKNOWN_PRODUCTION_COLOR = 'Color no informado en la OF';

const packagingBlockerFromError = (requestError) => {
  const apiError = requestError?.response?.data?.error;
  const details = apiError?.details;
  if (apiError?.code !== 'PACKAGING_RULE_MISSING' || !details?.articulo?.codigo) {
    return null;
  }
  return {
    article: details.articulo,
    profiles: details.perfiles || {},
    rules: details.reglas || {},
    action: details.accion || {},
  };
};

function PackagingConfigurationBlocker({ blocker, onClose }) {
  const assignedProfiles = Number(blocker.profiles.asignados || 0);
  const activeProfiles = Number(blocker.profiles.activos || 0);
  const defaultProfiles = Number(blocker.profiles.predeterminados_activos || 0);
  const approvedRules = Number(
    blocker.rules.manga_aprobadas_para_perfiles_activos || 0,
  );
  const articleCode = blocker.article.codigo;
  const actionPath = blocker.action.ruta
    || `/datos-maestros/ingenieria-scm?tab=empaque&articulo=${blocker.article.id}`;
  const actionLabel = blocker.action.etiqueta || `Revisar empaque de ${articleCode}`;
  return (
    <Alert severity="warning" onClose={onClose}>
      <AlertTitle component="h2">
        Falta validar el empaque de {articleCode}
      </AlertTitle>
      <Typography variant="body2">
        {blocker.article.nombre} · {assignedProfiles} perfiles asignados ·{' '}
        {activeProfiles} activos · {defaultProfiles} predeterminados.
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.5 }}>
        {approvedRules} reglas MANGA aprobadas para sus perfiles activos.
      </Typography>
      <Typography variant="body2" sx={{ mt: 1 }}>
        El perfil describe la geometría, no la identidad comercial: puede compartirse con un
        producto terminado si ambos conservan la misma estructura física. Antes de asociarlo,
        un supervisor debe validar físicamente el acomodo, la cantidad máxima, la tara y los
        límites de peso; no copies una asociación solo por similitud del nombre.
      </Typography>
      <Button
        component={RouterLink}
        to={actionPath}
        size="small"
        variant="outlined"
        sx={{ mt: 1.25 }}
      >
        {actionLabel}
      </Button>
    </Alert>
  );
}

const productionColorName = (run, planLines = []) => {
  if (!run) return 'Color pendiente de configurar';
  const directColor = typeof run.color === 'string' ? run.color : run.color?.nombre;
  const matchingLine = planLines.find(
    (line) => String(line.corrida_fabricacion_id) === String(run.id),
  );
  return run.color_nombre
    || run.color_identidad?.nombre
    || directColor
    || run.pieza_color?.color_nombre
    || run.pieza_color?.color?.nombre
    || matchingLine?.color_nombre
    || matchingLine?.color?.nombre
    || matchingLine?.articulo?.color_nombre
    || UNKNOWN_PRODUCTION_COLOR;
};

const productionRunArticleNames = (run, planLines = []) => {
  const outputNames = (run?.salidas || [])
    .map((output) => output.articulo_nombre || output.articulo?.nombre)
    .filter(Boolean);
  const planNames = planLines
    .filter((line) => String(line.corrida_fabricacion_id) === String(run?.id))
    .map((line) => line.articulo_nombre || line.articulo?.nombre)
    .filter(Boolean);
  return [...new Set([...outputNames, ...planNames])];
};

const productionRunOptionLabel = (run, order, planLines, index) => {
  const articleNames = productionRunArticleNames(run, planLines);
  return [
    productionColorName(run, planLines),
    articleNames.join(', ') || 'Artículo no informado en la OF',
    order?.codigo || 'OF',
    `secuencia ${run.secuencia || index + 1}`,
  ].join(' · ');
};

const currentWorkerName = (work, ot, workers) => {
  const activeAssignment = work?.asignacion_activa
    || work?.asignacion_vigente
    || [...(work?.asignaciones_personal || [])].reverse().find(
      (item) => ['ACTIVA', 'PREVISTA'].includes(item.estado),
    );
  if (activeAssignment?.trabajador) return activeAssignment.trabajador;
  if (activeAssignment?.trabajador_nombre) return activeAssignment.trabajador_nombre;
  const plannedWorker = ot?.maquinista_predeterminado ?? ot?.maquinista_previsto;
  if (plannedWorker?.nombre_completo) {
    return plannedWorker.nombre_completo;
  }
  if (typeof plannedWorker === 'string') {
    return plannedWorker;
  }
  const plannedWorkerId = ot?.maquinista_predeterminado_id ?? ot?.maquinista_previsto_id;
  const defaultWorker = workers.find(
    (item) => String(item.id) === String(plannedWorkerId),
  );
  return defaultWorker?.nombre_completo || 'Responsable por asignar';
};

const machineIdFromOt = (ot) => ot?.maquina_id ?? ot?.maquina?.id;
const isOperationalMachine = (machine) => machine?.activo !== false
  && !['INACTIVA', 'FUERA_SERVICIO', 'BAJA'].includes(
    String(machine?.estado || '').toUpperCase(),
  );

const machineBoardModel = (machine, allOts, workers, orders, selectedOtId) => {
  const machineOts = allOts
    .filter((ot) => String(machineIdFromOt(ot)) === String(machine.id))
    .sort((left, right) => {
      const priority = { EN_EJECUCION: 0, PLANIFICADA: 1, PAUSADA: 2, CERRADA: 3 };
      return (priority[left.estado] ?? 9) - (priority[right.estado] ?? 9);
    });
  const machineRunning = machineOts.some(
    (item) => (item.trabajos_color || []).some(
      (work) => work.estado === 'EN_EJECUCION',
    ),
  );
  const ot = machineOts.find((item) => item.public_id === selectedOtId)
    || machineOts[0]
    || null;
  const works = ot?.trabajos_color || [];
  const activeWork = works.find((work) => work.estado === 'EN_EJECUCION')
    || works.find((work) => work.estado === 'PAUSADO')
    || works.find((work) => work.estado === 'PLANIFICADO')
    || [...works]
      .sort((left, right) => Number(right.secuencia || 0) - Number(left.secuencia || 0))
      .find((work) => work.estado !== 'ANULADO')
    || null;
  const nextWork = works
    .filter((work) => work.id !== activeWork?.id)
    .filter((work) => ['PLANIFICADO', 'PAUSADO'].includes(work.estado))
    .sort((left, right) => Number(left.secuencia || 0) - Number(right.secuencia || 0))[0]
    || null;
  const mangas = activeWork ? (activeWork.mangas || []) : (ot?.mangas || []);
  const mangaCounts = mangas.reduce((counts, manga) => {
    if (DISCARDED_MANGA_STATES.has(manga.estado)) return counts;
    if (PRODUCTION_CLOSED_MANGA_STATES.has(manga.estado)) counts.closed += 1;
    else if (PRODUCTION_OPEN_MANGA_STATES.has(manga.estado)) counts.open += 1;
    else if (PRELABELED_MANGA_STATES.has(manga.estado)) {
      const labelState = String(manga.etiqueta_vigente?.estado || '').toUpperCase();
      if (PRINTED_LABEL_STATES.has(labelState)) counts.labelsPrinted += 1;
      else if (GENERATED_LABEL_STATES.has(labelState)) counts.labelsGenerated += 1;
      else counts.prelabeledUnknown += 1;
    }
    else counts.pending += 1;
    return counts;
  }, {
    closed: 0,
    open: 0,
    labelsGenerated: 0,
    labelsPrinted: 0,
    prelabeledUnknown: 0,
    pending: 0,
  });
  const order = orders.find(
    (item) => String(item.id) === String(activeWork?.orden_fabricacion_id),
  );
  const run = order?.corridas?.find(
    (item) => String(item.id) === String(activeWork?.corrida_fabricacion_id),
  );
  const orderOutputNames = (run?.salidas || [])
    .map((output) => output.articulo_nombre || output.articulo?.nombre)
    .filter(Boolean);
  const workOutputNames = (activeWork?.articulos_salida || [])
    .map((article) => [article.codigo, article.nombre].filter(Boolean).join(' · '))
    .filter(Boolean);
  const articleName = workOutputNames.join(', ')
    || activeWork?.articulo_nombre
    || activeWork?.mangas?.[0]?.articulo_nombre
    || activeWork?.salidas?.[0]?.articulo_nombre
    || activeWork?.salidas?.[0]?.articulo?.nombre
    || orderOutputNames.join(', ')
    || 'Artículo no informado';

  return {
    machine,
    ot,
    activeWork,
    nextWork,
    articleName,
    workerName: currentWorkerName(activeWork, ot, workers),
    mangaCounts,
    concurrentOtCount: machineOts.length,
    otIds: machineOts.map((item) => item.public_id),
    machineRunning,
  };
};

function DailyMachineBoard({
  machines, ots, workers, orders, selectedOtId, canCreateOt, onOpen,
}) {
  const cards = machines.map(
    (machine) => machineBoardModel(machine, ots, workers, orders, selectedOtId),
  );
  const machinesWithOt = cards.filter((card) => card.ot).length;
  const machinesRunning = cards.filter(
    (card) => card.machineRunning,
  ).length;
  return (
    <Stack spacing={1.5}>
      <Stack
        data-testid="plant-day-summary"
        role="status"
        aria-live="polite"
        aria-label="Resumen de planta para el turno"
        direction="row"
        spacing={0.75}
        useFlexGap
        flexWrap="wrap"
      >
        <Chip color="primary" variant="outlined" label={`Máquinas ${cards.length}`} />
        <Chip variant="outlined" label={`Con OT ${machinesWithOt}`} />
        <Chip
          color={machinesRunning ? 'success' : 'default'}
          variant="outlined"
          label={`En ejecución ${machinesRunning}`}
        />
        <Chip
          color={cards.length - machinesWithOt ? 'warning' : 'default'}
          variant="outlined"
          label={`Sin OT ${cards.length - machinesWithOt}`}
        />
      </Stack>
      <Box
        data-testid="daily-machine-board"
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 285px), 1fr))',
          gap: 1.5,
        }}
      >
      {cards.map((card) => {
        const selected = card.otIds.includes(selectedOtId);
        const running = card.activeWork?.estado === 'EN_EJECUCION';
        const actionable = Boolean(card.ot || canCreateOt);
        const CardSurface = actionable ? CardActionArea : Box;
        const operationalState = !card.ot
          ? { label: 'Sin OT', color: 'default' }
          : (running
            ? { label: 'Produciendo', color: 'success' }
            : (card.activeWork?.estado === 'PAUSADO'
              ? { label: 'Pausada', color: 'warning' }
              : (card.activeWork?.estado === 'PLANIFICADO'
                ? { label: 'Lista', color: 'info' }
                : { label: 'Sin trabajo activo', color: 'default' })));
        return (
          <Card
            key={card.machine.id}
            data-testid="machine-day-card"
            variant="outlined"
            sx={{
              minHeight: 250,
              borderColor: selected ? 'primary.main' : (running ? 'success.main' : 'divider'),
              borderWidth: selected ? 2 : 1,
              bgcolor: card.machine.boardUnavailable
                ? 'rgba(237, 108, 2, 0.06)'
                : (card.ot ? 'background.paper' : 'grey.50'),
            }}
          >
            <CardSurface
              role={actionable ? undefined : 'group'}
              aria-label={card.ot
                ? `Abrir jornada de ${card.machine.codigo}: ver detalle y gestionar`
                : `${card.machine.codigo} sin OT`}
              aria-current={selected ? 'true' : undefined}
              onClick={actionable ? () => onOpen(card) : undefined}
              sx={{ p: 2, height: '100%', alignItems: 'stretch' }}
            >
              <Stack spacing={1.25} sx={{ height: '100%' }}>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Box>
                    <Typography component="h3" variant="h6" fontWeight={900}>
                      {card.machine.codigo}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {card.machine.nombre}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    color={operationalState.color}
                    label={operationalState.label}
                  />
                </Stack>

                {card.machine.boardUnavailable && (
                  <Alert severity="warning" icon={false} sx={{ py: 0.25 }}>
                    Máquina inactiva o no disponible
                  </Alert>
                )}

                {!card.ot ? (
                  <Box sx={{ flex: 1, display: 'grid', alignContent: 'center' }}>
                    <Typography fontWeight={800}>Sin jornada para este turno</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {canCreateOt
                        ? 'Selecciona la tarjeta para preparar una OT en esta máquina.'
                        : 'No hay jornada registrada para este turno.'}
                    </Typography>
                    {canCreateOt ? (
                      <Typography color="primary.main" fontWeight={900} sx={{ mt: 1 }}>
                        Preparar OT →
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                        Sin acciones disponibles para tu perfil.
                      </Typography>
                    )}
                  </Box>
                ) : (
                  <>
                    <Box>
                      <Typography fontWeight={900}>{card.ot.codigo_ot}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Maquinista: {card.workerName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Estado OT: {stateLabel(card.ot.estado)}
                      </Typography>
                    </Box>
                    {card.activeWork ? (
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          {running
                            ? 'Trabajo activo'
                            : (card.activeWork.estado === 'PAUSADO'
                              ? 'Trabajo pausado'
                              : (card.activeWork.estado === 'PLANIFICADO'
                                ? 'Próximo trabajo'
                                : 'Último trabajo'))}
                        </Typography>
                        <Typography fontWeight={900}>{card.activeWork.color || 'Color por confirmar'}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {card.articleName} · {card.activeWork.orden_fabricacion_codigo || 'OF por confirmar'}
                        </Typography>
                      </Box>
                    ) : (
                      <Alert severity="warning" icon={false} sx={{ py: 0.5 }}>
                        OT sin trabajo de color
                      </Alert>
                    )}
                    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                      <Chip size="small" label={`Cerradas ${card.mangaCounts.closed}`} />
                      {card.mangaCounts.open > 0 && (
                        <Chip
                          size="small"
                          color="warning"
                          label={`Abiertas ${card.mangaCounts.open}`}
                        />
                      )}
                      {card.mangaCounts.labelsGenerated > 0 && (
                        <Chip
                          size="small"
                          color="info"
                          label={`Etiqueta generada ${card.mangaCounts.labelsGenerated}`}
                        />
                      )}
                      {card.mangaCounts.labelsPrinted > 0 && (
                        <Chip
                          size="small"
                          color="success"
                          label={`Etiqueta impresa ${card.mangaCounts.labelsPrinted}`}
                        />
                      )}
                      {card.mangaCounts.prelabeledUnknown > 0 && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`Preetiqueta sin estado ${card.mangaCounts.prelabeledUnknown}`}
                        />
                      )}
                      <Chip size="small" label={`Pendientes ${card.mangaCounts.pending}`} />
                    </Stack>
                    {card.nextWork && (
                      <Typography variant="caption" color="text.secondary">
                        Siguiente: {card.nextWork.color || 'Color por confirmar'} · {card.nextWork.orden_fabricacion_codigo || 'OF por confirmar'}
                      </Typography>
                    )}
                    {card.concurrentOtCount > 1 && (
                      <Typography variant="caption" color="warning.main">
                        Atención: {card.concurrentOtCount} OT coinciden en esta máquina.
                      </Typography>
                    )}
                    <Box
                      sx={{
                        mt: 'auto',
                        pt: 1.25,
                        borderTop: 1,
                        borderColor: 'divider',
                      }}
                    >
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Trabajos, mangas y responsables
                        </Typography>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Typography color="primary.main" fontWeight={900}>
                            Ver detalle y gestionar
                          </Typography>
                          <ArrowForwardIcon color="primary" fontSize="small" />
                        </Stack>
                      </Stack>
                    </Box>
                  </>
                )}
              </Stack>
            </CardSurface>
          </Card>
        );
      })}
      </Box>
    </Stack>
  );
}

const legacyWork = (ot) => ({
  id: `legacy-${ot.public_id}`,
  codigo: `${ot.codigo_ot} · compatibilidad`,
  secuencia: 1,
  estado: ot.estado === 'CERRADA' ? 'COMPLETADO' : ot.estado,
  version: ot.version,
  orden_fabricacion_id: ot.orden_operacion_id,
  orden_fabricacion_codigo: ot.orden_fabricacion?.codigo || 'OF legacy',
  corrida_fabricacion_id: ot.corrida_fabricacion_id,
  corrida_codigo: null,
  color: ot.mangas?.[0]?.color || 'Contexto anterior',
  cantidad_objetivo_un: ot.mangas?.reduce(
    (total, item) => total + Number(item.cantidad_asignada_un || 0), 0,
  ) || 0,
  cantidad_confirmada_un: 0,
  asignaciones_personal: [],
  asignacion_activa: null,
  mangas: ot.mangas || [],
  legacy: true,
});

const normalizeOt = (ot) => ({
  ...ot,
  trabajos_color: Array.isArray(ot.trabajos_color)
    ? ot.trabajos_color
    : (ot.corrida_fabricacion_id ? [legacyWork(ot)] : []),
});

function ColorWorkQueue({ works, selectedWorkId, onSelect }) {
  if (!works.length) {
    return (
      <Alert severity="info">
        Esta OT todavía no tiene trabajos. Agrega el primer color desde la OF liberada.
      </Alert>
    );
  }
  return (
    <Stack spacing={1} data-testid="color-work-queue">
      {works.map((work) => {
        const selected = work.id === selectedWorkId;
        const running = work.estado === 'EN_EJECUCION';
        return (
          <Card
            key={work.id}
            variant="outlined"
            sx={{
              borderColor: selected ? 'primary.main' : (running ? 'success.main' : 'divider'),
              borderWidth: selected ? 2 : 1,
            }}
          >
            <CardActionArea
              aria-label={`Ver mangas de ${work.color || work.codigo}`}
              onClick={() => onSelect(work.id)}
              sx={{ p: 1.5 }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ sm: 'center' }}
              >
                <Box sx={{ minWidth: 38 }}>
                  <Typography variant="caption" color="text.secondary">
                    #{work.secuencia}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography fontWeight={850}>{work.color || 'Sin color informado'}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {work.orden_fabricacion_codigo || 'Sin OF'}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: { sm: 'right' } }}>
                  <Chip
                    size="small"
                    label={stateLabel(work.estado)}
                    color={running ? 'success' : (work.estado === 'PAUSADO' ? 'warning' : 'default')}
                  />
                  <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                    {compactQuantity(work.cantidad_confirmada_un)} / {compactQuantity(work.cantidad_objetivo_un)} un
                  </Typography>
                </Box>
              </Stack>
            </CardActionArea>
          </Card>
        );
      })}
    </Stack>
  );
}

function MangaTable({
  work,
  canPrelabel,
  canAnnulManga,
  canReplaceLabel,
  canViewWeighing,
  selectedLabels,
  selectedRelief,
  onToggleLabel,
  onToggleRelief,
  onAnnul,
  onReplace,
  onWeighing,
  weighingBusy,
}) {
  const mangas = work?.mangas || [];
  if (!mangas.length) return <Alert severity="info">Este trabajo todavía no tiene mangas.</Alert>;
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">Imprimir</TableCell>
            <TableCell>Manga</TableCell>
            <TableCell>Salida</TableCell>
            <TableCell>Responsable</TableCell>
            <TableCell align="right">Cantidad</TableCell>
            <TableCell>Estado</TableCell>
            <TableCell padding="checkbox">Relevo</TableCell>
            <TableCell>Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {mangas.map((manga) => {
            const labelChecked = selectedLabels.includes(manga.public_id);
            const reliefChecked = selectedRelief.includes(manga.public_id);
            const labelEligible = !manga.etiqueta_vigente && manga.estado === 'PLANIFICADA';
            const reliefEligible = ['PLANIFICADA', 'PREETIQUETADA'].includes(manga.estado);
            return (
              <TableRow key={manga.public_id} selected={labelChecked || reliefChecked}>
                <TableCell padding="checkbox">
                  <Checkbox
                    inputProps={{ 'aria-label': `Seleccionar manga ${manga.codigo}` }}
                    checked={labelChecked}
                    disabled={
                      !canPrelabel || !labelEligible
                      || (!labelChecked && selectedLabels.length >= 2)
                    }
                    onChange={() => onToggleLabel(manga.public_id)}
                  />
                </TableCell>
                <TableCell>
                  <Typography fontWeight={800}>{manga.codigo}</Typography>
                  <Typography variant="caption">{manga.tipo_manga || manga.tipo}</Typography>
                </TableCell>
                <TableCell>
                  {manga.articulo_nombre}
                  <Typography display="block" variant="caption">{manga.color}</Typography>
                </TableCell>
                <TableCell>{manga.maquinista || 'Por asignar'}</TableCell>
                <TableCell align="right">{compactQuantity(manga.cantidad_asignada_un)}</TableCell>
                <TableCell>
                  <Chip size="small" label={stateLabel(manga.estado)} />
                </TableCell>
                <TableCell padding="checkbox">
                  <Checkbox
                    inputProps={{ 'aria-label': `Incluir ${manga.codigo} en el relevo` }}
                    checked={reliefChecked}
                    disabled={!reliefEligible}
                    onChange={() => onToggleRelief(manga.public_id)}
                  />
                </TableCell>
                <TableCell>
                  <Stack direction={{ xs: 'column', xl: 'row' }} spacing={0.5}>
                    {canAnnulManga && (
                      <Button
                        size="small"
                        color="error"
                        disabled={!['PLANIFICADA', 'PREETIQUETADA'].includes(manga.estado)}
                        onClick={() => onAnnul(manga)}
                      >
                        Anular manga
                      </Button>
                    )}
                    {canReplaceLabel && (
                      <Button
                        size="small"
                        disabled={!manga.etiqueta_vigente || manga.estado === 'ANULADA'}
                        onClick={() => onReplace(manga)}
                      >
                        Reemplazar etiqueta
                      </Button>
                    )}
                    {canViewWeighing && (
                      <Button
                        size="small"
                        aria-label={`Ver pesaje de ${manga.codigo}`}
                        disabled={
                          weighingBusy || ![
                            'PESADA', 'ETIQUETADA_FINAL', 'PENDIENTE_RECEPCION_ALMACEN',
                            'ANULADA',
                          ].includes(manga.estado)
                        }
                        onClick={() => onWeighing(manga)}
                      >
                        Ver pesaje
                      </Button>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function OtMangasScm({ view = 'all' }) {
  const navigate = useNavigate();
  const isLanding = view === 'landing';
  const isDetail = view === 'detail';
  const { can, canAny, experience } = useScmActor();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialJourneyContextRef = useRef(null);
  if (initialJourneyContextRef.current === null) {
    initialJourneyContextRef.current = journeyContextFromSearch(searchParams);
  }
  const initialJourneyContext = initialJourneyContextRef.current;
  const canManagePlan = can('PLAN_MANGA_ADMINISTRAR');
  const canViewFabricationOrders = can('OF_VER');
  const canCreateOt = can('OT_CREAR');
  const canStartWork = can('OT_INICIAR');
  const canCloseWork = can('OT_CERRAR');
  const canPlanMangas = can('MANGA_PLANIFICAR');
  const canRequestExtra = can('MANGA_EXTRA_SOLICITAR');
  const canApproveExtra = can('MANGA_EXTRA_APROBAR');
  const canPrelabel = can('MANGA_ETIQUETA_PRE_GENERAR');
  const canAnnulManga = can('MANGA_ANULAR');
  const canReplaceLabel = can('MANGA_ETIQUETA_REEMPLAZAR_APROBAR');
  const canViewWeighing = can('MANGA_PESAJE_VER');
  const canRequestCorrection = can('PESAJE_CORRECCION_SOLICITAR');
  const canApproveCorrection = can('PESAJE_CORRECCION_APROBAR');
  const canAnnulWeighing = can('ANULAR_PESAJE');
  const hasOperationalActions = canAny([
    'PLAN_MANGA_ADMINISTRAR', 'OT_CREAR', 'OT_INICIAR', 'OT_CERRAR',
    'MANGA_PLANIFICAR', 'MANGA_EXTRA_SOLICITAR', 'MANGA_EXTRA_APROBAR',
    'MANGA_ETIQUETA_PRE_GENERAR', 'MANGA_ANULAR',
    'MANGA_ETIQUETA_REEMPLAZAR_APROBAR', 'PESAJE_CORRECCION_SOLICITAR',
    'PESAJE_CORRECCION_APROBAR', 'ANULAR_PESAJE',
  ]);

  const [catalogs, setCatalogs] = useState({
    orders: [], machines: [], allMachines: [], workers: [],
  });
  const [ots, setOts] = useState([]);
  const [assemblyOts, setAssemblyOts] = useState([]);
  const [assemblyCenters, setAssemblyCenters] = useState([]);
  const [centerCatalogWarning, setCenterCatalogWarning] = useState('');
  const [journeyWarnings, setJourneyWarnings] = useState({
    FABRICACION: '', ENSAMBLE: '',
  });
  const [perspective, setPerspective] = useState(initialJourneyContext.perspective);
  const [selectedOtId, setSelectedOtId] = useState(
    initialJourneyContext.perspective === 'FABRICACION' ? initialJourneyContext.ot : '',
  );
  const [assemblyContextOtId, setAssemblyContextOtId] = useState(
    initialJourneyContext.perspective === 'ENSAMBLE' ? initialJourneyContext.ot : '',
  );
  const [selectedWorkId, setSelectedWorkId] = useState('');
  const selectedWorkIdRef = useRef('');
  const creationRef = useRef(null);
  const detailRef = useRef(null);
  const [listFilters, setListFilters] = useState({
    fecha_operativa: initialJourneyContext.fecha_operativa,
    turno: initialJourneyContext.turno,
    maquina_id: '',
  });
  const [headerForm, setHeaderForm] = useState({
    fecha_operativa: initialJourneyContext.fecha_operativa,
    maquina_id: '', turno: initialJourneyContext.turno,
    maquinista_predeterminado_id: '',
  });
  const [workForm, setWorkForm] = useState({
    orderId: '', runId: '', workerId: '', quantities: {},
  });
  const [draftPlan, setDraftPlan] = useState(null);
  const [selectedWorkPlan, setSelectedWorkPlan] = useState(null);
  const [extraRequests, setExtraRequests] = useState([]);
  const [mangaAllocation, setMangaAllocation] = useState({
    plan_linea_id: '', cantidad_un: '', motivo: '',
  });
  const [selectedLabels, setSelectedLabels] = useState([]);
  const [selectedRelief, setSelectedRelief] = useState([]);
  const [reliefForm, setReliefForm] = useState({
    workerId: '', reason: '', openManga: false, boundaryCount: '',
  });
  const [busy, setBusy] = useState(true);
  const [planBusy, setPlanBusy] = useState(false);
  const [error, setError] = useState('');
  const [packagingBlocker, setPackagingBlocker] = useState(null);
  const [notice, setNotice] = useState('');
  const [printJob, setPrintJob] = useState(loadLastPendingPrintJob);
  const [replacementPrintJobs, setReplacementPrintJobs] = useState([]);
  const [mangaActionDialog, setMangaActionDialog] = useState(null);
  const [mangaActionReason, setMangaActionReason] = useState('');
  const [workActionDialog, setWorkActionDialog] = useState(null);
  const [workActionReason, setWorkActionReason] = useState('');
  const [weighingDialog, setWeighingDialog] = useState(null);
  const [weighingBusy, setWeighingBusy] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({
    peso_bruto_kg: '', tara_kg: '', cantidad_confirmada: '', motivo: '',
  });
  const [annulmentForm, setAnnulmentForm] = useState({ motivo: '', evidencia: '' });

  const selectedOt = useMemo(
    () => {
      const item = ots.find((candidate) => candidate.public_id === selectedOtId) || null;
      if (item && listFilters.maquina_id
        && String(machineIdFromOt(item)) !== String(listFilters.maquina_id)) {
        return null;
      }
      return item;
    },
    [listFilters.maquina_id, ots, selectedOtId],
  );
  const works = useMemo(() => selectedOt?.trabajos_color || [], [selectedOt]);
  const selectedWork = useMemo(
    () => works.find((item) => item.id === selectedWorkId) || null,
    [works, selectedWorkId],
  );
  const selectedOrder = useMemo(
    () => catalogs.orders.find((item) => item.id === workForm.orderId) || null,
    [catalogs.orders, workForm.orderId],
  );
  const eligibleOrders = useMemo(
    () => catalogs.orders.filter(
      (item) => ['LIBERADA', 'PROGRAMADA', 'EN_EJECUCION'].includes(item.estado),
    ),
    [catalogs.orders],
  );
  const boardMachines = useMemo(() => {
    const resources = new Map(
      catalogs.machines.map((machine) => [String(machine.id), machine]),
    );
    ots.forEach((ot) => {
      const machineId = machineIdFromOt(ot);
      if (machineId == null || resources.has(String(machineId))) return;
      const knownMachine = catalogs.allMachines.find(
        (machine) => String(machine.id) === String(machineId),
      );
      resources.set(String(machineId), {
        ...(knownMachine || {}),
        id: knownMachine?.id ?? machineId,
        codigo: knownMachine?.codigo || ot.maquina_codigo || `Máquina ${machineId}`,
        nombre: knownMachine?.nombre || ot.maquina_nombre || ot.maquina || 'Recurso no disponible',
        boardUnavailable: true,
      });
    });
    return [...resources.values()];
  }, [catalogs.allMachines, catalogs.machines, ots]);
  const selectedRun = useMemo(
    () => selectedOrder?.corridas?.find((item) => item.id === workForm.runId) || null,
    [selectedOrder, workForm.runId],
  );
  const selectedRunHasColor = selectedRun
    && productionColorName(selectedRun, draftPlan?.lineas) !== UNKNOWN_PRODUCTION_COLOR;
  const availableRuns = useMemo(
    () => (selectedOrder?.corridas || []).filter(
      (item) => ['LIBERADA', 'EN_EJECUCION'].includes(item.estado),
    ),
    [selectedOrder],
  );
  const filteredOts = useMemo(
    () => (listFilters.maquina_id
      ? ots.filter(
        (item) => String(machineIdFromOt(item)) === String(listFilters.maquina_id),
      )
      : ots),
    [listFilters.maquina_id, ots],
  );
  const selectedFilteredOtId = filteredOts.some(
    (item) => item.public_id === selectedOtId,
  ) ? selectedOtId : '';
  const assemblyCenterCount = useMemo(() => {
    const keys = new Set(assemblyCenters.map((center) => String(
      center.id || center.codigo || center.nombre || 'sin-centro',
    )));
    assemblyOts.forEach((item) => keys.add(String(
      item.centro_trabajo?.id
      || item.centro_trabajo?.codigo
      || item.centro_trabajo?.nombre
      || 'sin-centro',
    )));
    return keys.size;
  }, [assemblyCenters, assemblyOts]);
  const runningJourneyCount = [...ots, ...assemblyOts].filter(
    (item) => item.estado === 'EN_EJECUCION',
  ).length;
  const draftRunLines = useMemo(
    () => (draftPlan?.lineas || []).filter(
      (line) => line.corrida_fabricacion_id === workForm.runId,
    ),
    [draftPlan, workForm.runId],
  );
  const selectedWorkLines = useMemo(
    () => (selectedWorkPlan?.lineas || []).filter(
      (line) => line.corrida_fabricacion_id === selectedWork?.corrida_fabricacion_id,
    ),
    [selectedWorkPlan, selectedWork?.corrida_fabricacion_id],
  );
  const runningWork = works.find((item) => item.estado === 'EN_EJECUCION') || null;
  const pendingWorkMangas = (selectedWork?.mangas || []).filter(
    (item) => ![
      'PESADA', 'ETIQUETADA_FINAL', 'PENDIENTE_RECEPCION_ALMACEN',
      'RECIBIDA', 'ANULADA',
    ].includes(item.estado),
  );
  const currentWorker = selectedWork?.asignacion_activa
    || [...(selectedWork?.asignaciones_personal || [])].reverse().find(
      (item) => ['ACTIVA', 'PREVISTA'].includes(item.estado),
    ) || null;

  const loadExtraRequests = useCallback(async (orderId, workId) => {
    if (!orderId || !workId) {
      setExtraRequests([]);
      return;
    }
    const payload = await listarSolicitudesMangaExtraScm(orderId, 'PENDIENTE');
    if (selectedWorkIdRef.current === workId) {
      setExtraRequests((payload.items || []).filter(
        (item) => item.trabajo_color_id === workId,
      ));
    }
  }, []);

  const applyOtPayload = useCallback((items, preferredOtId, preferredWorkId) => {
    const normalized = (items || []).map(normalizeOt);
    setOts(normalized);
    const nextOt = normalized.find((item) => item.public_id === preferredOtId)
      || normalized[0]
      || null;
    const nextWorks = nextOt?.trabajos_color || [];
    const nextWork = nextWorks.find((item) => item.id === preferredWorkId)
      || nextWorks[0]
      || null;
    setSelectedOtId(nextOt?.public_id || '');
    setSelectedWorkId(nextWork?.id || '');
  }, []);

  const loadOts = useCallback(async (
    preferredOtId, preferredWorkId, filters = listFilters,
  ) => {
    const query = {
      fecha_operativa: filters.fecha_operativa,
      turno: filters.turno,
    };
    const [fabricationResult, assemblyResult] = await Promise.allSettled([
      listarOtScm(undefined, 'FABRICACION', query),
      listarOtScm(undefined, 'ENSAMBLE', query),
    ]);
    if (fabricationResult.status === 'fulfilled') {
      applyOtPayload(fabricationResult.value.items || [], preferredOtId, preferredWorkId);
    }
    if (assemblyResult.status === 'fulfilled') {
      setAssemblyOts(assemblyResult.value.items || []);
    }
    setJourneyWarnings({
      FABRICACION: fabricationResult.status === 'rejected'
        ? 'No se pudieron actualizar las jornadas de Fabricación. Se conserva la última información visible.'
        : '',
      ENSAMBLE: assemblyResult.status === 'rejected'
        ? 'No se pudieron actualizar las jornadas de Armado. Se conserva la última información visible.'
        : '',
    });
  }, [applyOtPayload, listFilters]);

  useEffect(() => {
    setBusy(true);
    const centersRequest = listarCentrosTrabajoScm()
      .then((centers) => {
        setCenterCatalogWarning('');
        return centers;
      })
      .catch(() => {
        setCenterCatalogWarning(
          'No se pudo consultar el catálogo de centros. Las jornadas existentes siguen visibles.',
        );
        return [];
      });
    Promise.all([
      canViewFabricationOrders
        ? listarOrdenesFabricacionScm()
        : Promise.resolve({ items: [] }),
      obtenerMaquinas(),
      getTrabajadores({ rol: 'MAQUINISTA', activo: true }),
      centersRequest,
    ])
      .then(async ([orderPayload, machines, workers, centers]) => {
        const orders = orderPayload.items || [];
        const selectableOrders = orders.filter(
          (item) => ['LIBERADA', 'PROGRAMADA', 'EN_EJECUCION'].includes(item.estado),
        );
        const operationalMachines = (machines || []).filter(isOperationalMachine);
        const activeWorkers = (workers || []).filter((item) => item.activo !== false);
        setCatalogs({
          orders,
          machines: operationalMachines,
          allMachines: machines || [],
          workers: activeWorkers,
        });
        setAssemblyCenters((centers || []).filter((center) => (
          center.activo !== false
          && ['PREARMADO', 'ENSAMBLE', 'ACABADO', 'EMPAQUE'].includes(center.tipo)
        )));
        const firstOrder = selectableOrders[0];
        const firstRun = firstOrder?.corridas?.find(
          (item) => ['LIBERADA', 'EN_EJECUCION'].includes(item.estado),
        );
        setHeaderForm((current) => ({
          ...current,
          maquina_id: current.maquina_id || operationalMachines[0]?.id || '',
          maquinista_predeterminado_id:
            current.maquinista_predeterminado_id || activeWorkers[0]?.id || '',
        }));
        setWorkForm((current) => ({
          ...current,
          orderId: current.orderId || firstOrder?.id || '',
          runId: current.runId || firstRun?.id || '',
          workerId: current.workerId || activeWorkers[0]?.id || '',
        }));
        setReliefForm((current) => ({
          ...current, workerId: current.workerId || activeWorkers[0]?.id || '',
        }));
        const initialFilters = {
          fecha_operativa: initialJourneyContext.fecha_operativa,
          turno: initialJourneyContext.turno,
          maquina_id: '',
        };
        setListFilters(initialFilters);
        const query = {
          fecha_operativa: initialFilters.fecha_operativa,
          turno: initialFilters.turno,
        };
        const [fabricationResult, assemblyResult] = await Promise.allSettled([
          listarOtScm(undefined, 'FABRICACION', query),
          listarOtScm(undefined, 'ENSAMBLE', query),
        ]);
        if (fabricationResult.status === 'fulfilled') {
          applyOtPayload(
            fabricationResult.value.items || [],
            initialJourneyContext.perspective === 'FABRICACION'
              ? initialJourneyContext.ot : undefined,
          );
        }
        if (assemblyResult.status === 'fulfilled') {
          setAssemblyOts(assemblyResult.value.items || []);
        }
        setJourneyWarnings({
          FABRICACION: fabricationResult.status === 'rejected'
            ? 'No se pudieron cargar las jornadas de Fabricación.' : '',
          ENSAMBLE: assemblyResult.status === 'rejected'
            ? 'No se pudieron cargar las jornadas de Armado.' : '',
        });
      })
      .catch((requestError) => setError(
        mensajeErrorScm(requestError, 'No se pudieron cargar OT, OF y recursos.'),
      ))
      .finally(() => setBusy(false));
  }, [applyOtPayload, canViewFabricationOrders, initialJourneyContext]);

  useEffect(() => {
    selectedWorkIdRef.current = selectedWorkId;
    setSelectedLabels([]);
    setSelectedRelief([]);
    setReplacementPrintJobs([]);
  }, [selectedWorkId]);

  useEffect(() => {
    storeLastPendingPrintJob(printJob);
  }, [printJob]);

  useEffect(() => {
    const contextualOt = perspective === 'ENSAMBLE'
      ? assemblyContextOtId
      : selectedOtId;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('fecha', listFilters.fecha_operativa);
      next.set('turno', listFilters.turno);
      next.set('modo', perspective === 'ENSAMBLE' ? 'armado' : 'fabricacion');
      if (contextualOt) next.set('ot', contextualOt);
      else next.delete('ot');
      return next.toString() === current.toString() ? current : next;
    }, { replace: true });
  }, [
    assemblyContextOtId,
    listFilters.fecha_operativa,
    listFilters.turno,
    perspective,
    selectedOtId,
    setSearchParams,
  ]);

  useEffect(() => {
    if (!listFilters.maquina_id || selectedFilteredOtId) return;
    const nextOt = filteredOts[0] || null;
    setSelectedOtId(nextOt?.public_id || '');
    setSelectedWorkId(nextOt?.trabajos_color?.[0]?.id || '');
  }, [filteredOts, listFilters.maquina_id, selectedFilteredOtId]);

  useEffect(() => {
    if (!workForm.orderId) {
      setDraftPlan(null);
      return undefined;
    }
    let active = true;
    setPlanBusy(true);
    obtenerPlanMangas(workForm.orderId)
      .then((payload) => {
        if (!active) return;
        setDraftPlan(payload.plan);
        setWorkForm((current) => ({
          ...current,
          quantities: Object.fromEntries(
            (payload.plan?.lineas || []).map((line) => [line.id, line.saldo_un]),
          ),
        }));
      })
      .catch((requestError) => {
        if (active) setError(mensajeErrorScm(
          requestError, 'La OF todavía no tiene un plan de mangas disponible.',
        ));
      })
      .finally(() => { if (active) setPlanBusy(false); });
    return () => { active = false; };
  }, [workForm.orderId]);

  const selectedWorkOrderId = selectedWork?.orden_fabricacion_id;
  const selectedWorkRunId = selectedWork?.corrida_fabricacion_id;
  const selectedWorkIsLegacy = Boolean(selectedWork?.legacy);

  useEffect(() => {
    if (!selectedWorkOrderId || selectedWorkIsLegacy) {
      setSelectedWorkPlan(null);
      setMangaAllocation({ plan_linea_id: '', cantidad_un: '', motivo: '' });
      return undefined;
    }
    let active = true;
    obtenerPlanMangas(selectedWorkOrderId)
      .then((payload) => {
        if (!active) return;
        setSelectedWorkPlan(payload.plan);
        const firstLine = (payload.plan?.lineas || []).find(
          (line) => line.corrida_fabricacion_id === selectedWorkRunId,
        );
        setMangaAllocation({
          plan_linea_id: String(firstLine?.id || ''), cantidad_un: '', motivo: '',
        });
      })
      .catch(() => { if (active) setSelectedWorkPlan(null); });
    return () => { active = false; };
  }, [selectedWorkOrderId, selectedWorkRunId, selectedWorkIsLegacy]);

  useEffect(() => {
    if (!selectedWorkOrderId || !selectedWorkId || selectedWorkIsLegacy) {
      setExtraRequests([]);
      return;
    }
    loadExtraRequests(selectedWorkOrderId, selectedWorkId)
      .catch(() => setExtraRequests([]));
  }, [
    loadExtraRequests, selectedWorkId, selectedWorkIsLegacy, selectedWorkOrderId,
  ]);

  const refresh = async () => {
    setBusy(true);
    setError('');
    try {
      await loadOts(selectedOtId, selectedWorkId);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo actualizar la jornada.'));
    } finally {
      setBusy(false);
    }
  };

  const applyListFilters = async (event) => {
    event?.preventDefault();
    if (!listFilters.fecha_operativa || !listFilters.turno) {
      setError('Selecciona fecha y turno para actualizar el tablero.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await loadOts(selectedOtId, selectedWorkId, listFilters);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudieron buscar las OT.'));
    } finally {
      setBusy(false);
    }
  };

  const changeJourneyPerspective = (nextPerspective) => {
    setPerspective(nextPerspective);
    if (nextPerspective === 'ENSAMBLE') setAssemblyContextOtId('');
  };

  const createHeader = async () => {
    if (!headerForm.maquina_id || !headerForm.fecha_operativa || !headerForm.turno) {
      setError('Selecciona máquina, fecha y turno.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = {
        fecha_operativa: headerForm.fecha_operativa,
        maquina_id: Number(headerForm.maquina_id),
        turno: headerForm.turno,
        ...(headerForm.maquinista_predeterminado_id ? {
          maquinista_predeterminado_id: Number(headerForm.maquinista_predeterminado_id),
        } : {}),
      };
      const result = await crearOtFabricacionScm(payload);
      setNotice(`${result.ot.codigo_ot} creada como jornada de máquina, todavía sin color.`);
      const creationFilters = {
        fecha_operativa: headerForm.fecha_operativa,
        turno: headerForm.turno,
        maquina_id: '',
      };
      setListFilters(creationFilters);
      await loadOts(result.ot.public_id, undefined, creationFilters);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo crear la OT de máquina.'));
    } finally {
      setBusy(false);
    }
  };

  const createWork = async () => {
    const assignments = draftRunLines
      .filter((line) => Number(workForm.quantities[line.id]) > 0)
      .map((line) => ({
        plan_linea_id: Number(line.id),
        cantidad_un: Number(workForm.quantities[line.id]),
      }));
    if (!selectedOt || !selectedRun || !selectedRunHasColor
      || !workForm.workerId || !assignments.length) {
      setError('Selecciona OT, color a fabricar, maquinista y una cantidad positiva.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await crearTrabajoColorScm(selectedOt.public_id, {
        corrida_fabricacion_id: selectedRun.id,
        maquinista_id: Number(workForm.workerId),
        asignaciones: assignments,
      });
      setNotice(
        `${result.trabajo_color.color || result.trabajo_color.codigo} agregado a la cola de ${selectedOt.codigo_ot}.`,
      );
      await loadOts(selectedOt.public_id, result.trabajo_color.id);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo agregar el Trabajo de color.'));
    } finally {
      setBusy(false);
    }
  };

  const recalculateDraftPlan = async () => {
    if (!workForm.orderId) return;
    setPlanBusy(true);
    setError('');
    setPackagingBlocker(null);
    try {
      const result = await recalcularPlanMangas(workForm.orderId);
      setDraftPlan(result.plan);
      setWorkForm((current) => ({
        ...current,
        quantities: Object.fromEntries(
          result.plan.lineas.map((line) => [line.id, line.saldo_un]),
        ),
      }));
      setNotice(`Plan de ${selectedOrder?.codigo} recalculado. No se creó ninguna manga.`);
    } catch (requestError) {
      const blocker = packagingBlockerFromError(requestError);
      if (blocker) {
        setPackagingBlocker(blocker);
      } else {
        setError(mensajeErrorScm(requestError, 'No se pudo recalcular el plan de la OF.'));
      }
    } finally {
      setPlanBusy(false);
    }
  };

  const transitionWork = async (action, reason = '') => {
    if (!selectedWork || selectedWork.legacy) return;
    setBusy(true);
    setError('');
    try {
      const result = await cambiarEstadoTrabajoColorScm(
        selectedWork.id, action, selectedWork.version, reason,
      );
      setNotice(
        `${result.trabajo_color.color || result.trabajo_color.codigo}: ${stateLabel(result.trabajo_color.estado)}.`,
      );
      setWorkActionDialog(null);
      setWorkActionReason('');
      await loadOts(selectedOt.public_id, selectedWork.id);
    } catch (requestError) {
      const code = requestError.response?.data?.error?.code;
      setError(code === 'OT_WORK_ALREADY_RUNNING'
        ? `Pausa primero ${runningWork?.color || 'el trabajo en ejecución'} antes de iniciar otro color.`
        : mensajeErrorScm(requestError, 'No se pudo cambiar el estado del trabajo.'));
    } finally {
      setBusy(false);
    }
  };

  const submitWorkDialog = () => {
    if (workActionDialog?.action === 'anular' && !workActionReason.trim()) {
      setError('La anulación del trabajo requiere un motivo.');
      return;
    }
    transitionWork(workActionDialog.action, workActionReason);
  };

  const addMangas = async () => {
    if (
      !selectedWork || !mangaAllocation.plan_linea_id
      || Number(mangaAllocation.cantidad_un) <= 0
    ) {
      setError('Selecciona una salida y una cantidad positiva.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await agregarMangasTrabajoColorScm(selectedWork.id, {
        plan_linea_id: Number(mangaAllocation.plan_linea_id),
        cantidad_un: Number(mangaAllocation.cantidad_un),
      });
      setNotice(`${result.mangas.length} manga(s) agregadas a ${selectedWork.color}.`);
      setMangaAllocation((current) => ({ ...current, cantidad_un: '' }));
      await loadOts(selectedOt.public_id, selectedWork.id);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudieron agregar las mangas.'));
    } finally {
      setBusy(false);
    }
  };

  const requestExtraManga = async () => {
    if (
      !selectedOt || !selectedWork || !mangaAllocation.plan_linea_id
      || Number(mangaAllocation.cantidad_un) <= 0
      || !mangaAllocation.motivo.trim()
    ) {
      setError('La manga EXTRA requiere salida, cantidad y motivo.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await solicitarMangaExtraScm(selectedOt.public_id, {
        trabajo_color_id: selectedWork.id,
        plan_linea_id: Number(mangaAllocation.plan_linea_id),
        cantidad_un: Number(mangaAllocation.cantidad_un),
        motivo: mangaAllocation.motivo.trim(),
      });
      setNotice(`Solicitud EXTRA ${result.solicitud.id} enviada a aprobación.`);
      setMangaAllocation((current) => ({
        ...current, cantidad_un: '', motivo: '',
      }));
      await loadExtraRequests(selectedWorkOrderId, selectedWork.id);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo solicitar la manga EXTRA.'));
    } finally {
      setBusy(false);
    }
  };

  const approveExtraManga = async (requestId) => {
    setBusy(true);
    setError('');
    try {
      const result = await aprobarMangaExtraScm(requestId);
      setNotice(`Solicitud aprobada: ${result.mangas.length} manga(s) EXTRA creadas.`);
      await Promise.all([
        loadOts(selectedOt.public_id, selectedWork.id),
        loadExtraRequests(selectedWorkOrderId, selectedWork.id),
      ]);
    } catch (requestError) {
      setError(mensajeErrorScm(
        requestError,
        'No se aprobó la solicitud. Solicitante y aprobador deben ser personas distintas.',
      ));
    } finally {
      setBusy(false);
    }
  };

  const relieveWorker = async () => {
    if (!selectedWork || !reliefForm.workerId || !reliefForm.reason.trim()) {
      setError('El relevo requiere maquinista y motivo.');
      return;
    }
    if (reliefForm.openManga && selectedRelief.length !== 1) {
      setError('Una manga abierta se transfiere individualmente. Selecciona exactamente una.');
      return;
    }
    if (
      reliefForm.openManga
      && (!Number.isInteger(Number(reliefForm.boundaryCount))
        || Number(reliefForm.boundaryCount) < 0)
    ) {
      setError('Registra el conteo acumulado de frontera de la manga abierta.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await reasignarMangasTrabajoColorScm(selectedWork.id, {
        trabajador_id: Number(reliefForm.workerId),
        motivo: reliefForm.reason.trim(),
        version: selectedWork.version,
        ...(selectedRelief.length ? { manga_ids: selectedRelief } : {}),
        ...(reliefForm.openManga ? {
          manga_abierta: true,
          conteo_frontera: Number(reliefForm.boundaryCount),
        } : {}),
      });
      const replacementJobs = result.trabajos_impresion_reemplazo || [];
      setReplacementPrintJobs(replacementJobs);
      const replacementLabelCount = replacementJobs.reduce(
        (total, job) => total + (job.labels?.length || 0), 0,
      );
      setNotice(
        `${result.mangas.length} manga(s) reasignadas a ${result.asignacion.trabajador}.`
        + (replacementLabelCount
          ? ` Reimprime ${replacementLabelCount} preetiqueta(s) de reemplazo.`
          : ''),
      );
      setSelectedRelief([]);
      setReliefForm((current) => ({
        ...current, reason: '', openManga: false, boundaryCount: '',
      }));
      await loadOts(selectedOt.public_id, selectedWork.id);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo registrar el relevo.'));
    } finally {
      setBusy(false);
    }
  };

  const copyPrintJobId = async (printJobId) => {
    const value = String(printJobId || '').trim();
    if (!value) return;
    try {
      if (globalThis.navigator?.clipboard?.writeText) {
        await globalThis.navigator.clipboard.writeText(value);
      } else {
        const input = document.createElement('textarea');
        input.value = value;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }
      setNotice(`ID ${value} copiado.`);
    } catch {
      setError('No se pudo copiar el ID. Selecciónalo manualmente.');
    }
  };

  const openPrintJobPreview = (printJobId) => {
    const previewUrl = buildScmPrelabelPreviewUrl(printJobId);
    globalThis.open(previewUrl, '_blank', 'noopener,noreferrer');
  };

  const generateLabels = async () => {
    if (selectedLabels.length < 1 || selectedLabels.length > 2) {
      setError('Selecciona una o dos mangas del mismo Trabajo de color.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await generarEtiquetasPrepesaje(selectedLabels);
      setPrintJob(result);
      setNotice(
        `Trabajo ${result.print_job_id}: preetiqueta generada y pendiente de impresión.`,
      );
      setSelectedLabels([]);
      await loadOts(selectedOt.public_id, selectedWork.id);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se generaron las preetiquetas.'));
    } finally {
      setBusy(false);
    }
  };

  const submitMangaAction = async () => {
    if (!mangaActionDialog || !mangaActionReason.trim()) {
      setError('Indica el motivo de la acción.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (mangaActionDialog.type === 'annul') {
        await anularMangaScm(mangaActionDialog.manga.public_id, mangaActionReason.trim());
        setNotice(`${mangaActionDialog.manga.codigo} anulada; el cupo volvió al trabajo.`);
      } else {
        const result = await reemplazarEtiquetaScm(
          mangaActionDialog.manga.etiqueta_vigente.public_id,
          mangaActionReason.trim(),
        );
        setPrintJob({ ...result, labels: [result.label] });
        setNotice(
          `Trabajo ${result.print_job_id}: etiqueta generada y pendiente de impresión.`,
        );
      }
      setMangaActionDialog(null);
      setMangaActionReason('');
      await loadOts(selectedOt.public_id, selectedWork.id);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se completó la acción de manga.'));
    } finally {
      setBusy(false);
    }
  };

  const openWeighing = async (manga) => {
    setWeighingBusy(true);
    setError('');
    try {
      const detail = await obtenerPesajeMangaScm(manga.public_id);
      setWeighingDialog({ manga, detail });
      setCorrectionForm({
        peso_bruto_kg: detail.vigente?.peso_bruto_kg || '',
        tara_kg: detail.vigente?.tara_kg || '',
        cantidad_confirmada: detail.vigente?.cantidad_confirmada || '',
        motivo: '',
      });
      setAnnulmentForm({ motivo: '', evidencia: '' });
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo consultar el pesaje.'));
    } finally {
      setWeighingBusy(false);
    }
  };

  const refreshWeighing = async () => {
    if (!weighingDialog) return;
    const detail = await obtenerPesajeMangaScm(weighingDialog.manga.public_id);
    setWeighingDialog((current) => ({ ...current, detail }));
  };

  const requestWeighingCorrection = async () => {
    const original = weighingDialog?.detail?.original;
    if (!original || !correctionForm.motivo.trim()) {
      setError('La corrección requiere un motivo.');
      return;
    }
    setWeighingBusy(true);
    setError('');
    try {
      await solicitarCorreccionPesajeScm(original.public_id, {
        proposed: {
          peso_bruto_kg: correctionForm.peso_bruto_kg,
          tara_kg: correctionForm.tara_kg,
          cantidad_confirmada: correctionForm.cantidad_confirmada,
        },
        motivo: correctionForm.motivo.trim(),
      });
      await refreshWeighing();
      setCorrectionForm((current) => ({ ...current, motivo: '' }));
      setNotice('Corrección solicitada. Debe aprobarla otro actor autorizado.');
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo solicitar la corrección.'));
    } finally {
      setWeighingBusy(false);
    }
  };

  const approveWeighingCorrection = async (correctionId) => {
    setWeighingBusy(true);
    setError('');
    try {
      const result = await aprobarCorreccionPesajeScm(correctionId, {
        motivo_aprobacion: 'Validación de Jefe de Producción',
      });
      setPrintJob({ print_job_id: result.print_job_id, labels: [result.post_label] });
      await refreshWeighing();
      await loadOts(selectedOt.public_id, selectedWork.id);
      setNotice('Corrección aplicada; la nueva etiqueta final quedó lista para imprimir.');
    } catch (requestError) {
      setError(mensajeErrorScm(
        requestError, 'No se aprobó. Usa un actor autorizado distinto del solicitante.',
      ));
    } finally {
      setWeighingBusy(false);
    }
  };

  const annulWeighing = async () => {
    const original = weighingDialog?.detail?.original;
    if (!original || !annulmentForm.motivo.trim()) {
      setError('La anulación requiere un motivo.');
      return;
    }
    setWeighingBusy(true);
    setError('');
    try {
      await anularPesajeScm(original.public_id, {
        motivo: annulmentForm.motivo.trim(),
        evidencia: annulmentForm.evidencia.trim() || null,
      });
      await refreshWeighing();
      await loadOts(selectedOt.public_id, selectedWork.id);
      setNotice('Pesaje anulado; los QR quedaron invalidados y el cupo volvió al trabajo.');
    } catch (requestError) {
      const code = requestError.response?.data?.error?.code;
      setError(code === 'RECEIPT_REVERSAL_REQUIRED'
        ? 'La manga ya ingresó a Almacén. Aprueba primero la reversa de recepción.'
        : mensajeErrorScm(requestError, 'No se pudo anular el pesaje.'));
    } finally {
      setWeighingBusy(false);
    }
  };

  const selectOrder = (orderId) => {
    const order = catalogs.orders.find((item) => item.id === orderId);
    const run = order?.corridas?.find(
      (item) => ['LIBERADA', 'EN_EJECUCION'].includes(item.estado),
    );
    setWorkForm((current) => ({
      ...current, orderId, runId: run?.id || '', quantities: {},
    }));
  };

  const openMachineCard = (card) => {
    if (!card.ot) {
      setHeaderForm((current) => ({
        ...current,
        fecha_operativa: listFilters.fecha_operativa,
        turno: listFilters.turno,
        maquina_id: card.machine.id,
      }));
      setListFilters((current) => ({ ...current, maquina_id: card.machine.id }));
      setSelectedOtId('');
      setSelectedWorkId('');
      setNotice(`${card.machine.codigo} quedó seleccionada para crear su jornada.`);
      globalThis.requestAnimationFrame?.(() => {
        creationRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
        creationRef.current?.focus?.({ preventScroll: true });
      });
      return;
    }
    setSelectedOtId(card.ot.public_id);
    if (isLanding) {
      const params = new URLSearchParams({
        fecha: listFilters.fecha_operativa,
        turno: listFilters.turno,
        modo: 'fabricacion',
        ot: card.ot.public_id,
      });
      navigate('/produccion/ots-planta/trabajo?' + params.toString());
      return;
    }
    setSelectedWorkId(card.activeWork?.id || card.ot.trabajos_color?.[0]?.id || '');
    setListFilters((current) => ({ ...current, maquina_id: card.machine.id }));
    globalThis.requestAnimationFrame?.(() => {
      detailRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    });
  };

  const prelabelButtonText = selectedLabels.length
    ? `Generar ${selectedLabels.length} preetiqueta${selectedLabels.length > 1 ? 's' : ''}`
    : 'Selecciona hasta 2 mangas';
  const overviewParams = new URLSearchParams({
    fecha: listFilters.fecha_operativa,
    turno: listFilters.turno,
    modo: perspective === 'ENSAMBLE' ? 'armado' : 'fabricacion',
  });
  const overviewUrl = `/produccion/ots-planta?${overviewParams.toString()}`;

  return (
    <Stack spacing={2.5}>
      <PageHeader
        title={isDetail ? (selectedOt?.codigo_ot || 'Detalle de OT') : 'OTs de planta'}
        description="Consulta el turno completo y continúa el trabajo desde Máquinas o Centros de Armado sin mezclar sus responsabilidades."
        actions={(
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            {isDetail && (
              <Button
                component={RouterLink}
                to={overviewUrl}
                startIcon={<ArrowBackIcon />}
                variant="outlined"
              >
                Volver a OTs de planta
              </Button>
            )}
            <Button startIcon={<RefreshIcon />} variant="outlined" onClick={refresh}>
              Actualizar
            </Button>
          </Stack>
        )}
      />
      <ProcessJourney current="jornada" />
      {!hasOperationalActions && (
        <Alert severity="info">
          Vista de consulta para {experience.label}. Las acciones se muestran a los responsables de la jornada.
        </Alert>
      )}
      {packagingBlocker && (
        <PackagingConfigurationBlocker
          blocker={packagingBlocker}
          onClose={() => setPackagingBlocker(null)}
        />
      )}
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}

      {!isDetail && (
      <PlantJourneysOverview
        filters={listFilters}
        onFiltersChange={setListFilters}
        onSubmit={applyListFilters}
        busy={busy}
        perspective={perspective}
        onPerspectiveChange={changeJourneyPerspective}
        journeyCount={ots.length + assemblyOts.length}
        runningCount={runningJourneyCount}
        machineCount={boardMachines.length}
        assemblyCenterCount={assemblyCenterCount}
        assemblyOts={assemblyOts}
        assemblyCenters={assemblyCenters}
        centerCatalogWarning={centerCatalogWarning}
        journeyWarnings={journeyWarnings}
        selectedAssemblyOtId={assemblyContextOtId}
      />
      )}

      <Stack
        id="plant-journeys-panel-fabrication"
        role="tabpanel"
        aria-labelledby="plant-journeys-tab-fabrication"
        hidden={perspective !== 'FABRICACION'}
        spacing={2.5}
        sx={{ display: perspective === 'FABRICACION' ? 'flex' : 'none' }}
      >

      {!isDetail && (
      <Paper
        ref={creationRef}
        tabIndex={-1}
        aria-label="Preparar OT de máquina"
        variant="outlined"
        sx={{ p: 2 }}
      >
        <Typography variant="overline" color="primary.main">1 · Jornada de máquina</Typography>
        <Typography component="h2" variant="h6" fontWeight={850}>
          Crear una OT sin amarrarla a un color
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Define solamente dónde y cuándo se trabajará. Los colores se agregan después como una cola.
        </Typography>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5}>
          <TextField
            label="Fecha operativa"
            type="date"
            value={headerForm.fecha_operativa}
            InputLabelProps={{ shrink: true }}
            onChange={(event) => setHeaderForm({
              ...headerForm, fecha_operativa: event.target.value,
            })}
          />
          <FormControl sx={{ minWidth: 230 }}>
            <InputLabel>Máquina</InputLabel>
            <Select
              label="Máquina"
              value={headerForm.maquina_id}
              onChange={(event) => setHeaderForm({
                ...headerForm, maquina_id: event.target.value,
              })}
            >
              {catalogs.machines.map((item) => (
                <MenuItem key={item.id} value={item.id}>{item.codigo} · {item.nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 130 }}>
            <InputLabel>Turno</InputLabel>
            <Select
              label="Turno"
              value={headerForm.turno}
              onChange={(event) => setHeaderForm({ ...headerForm, turno: event.target.value })}
            >
              <MenuItem value="DIA">Día</MenuItem>
              <MenuItem value="NOCHE">Noche</MenuItem>
              <MenuItem value="EXTRA">Extra</MenuItem>
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 230 }}>
            <InputLabel>Maquinista predeterminado</InputLabel>
            <Select
              label="Maquinista predeterminado"
              value={headerForm.maquinista_predeterminado_id}
              onChange={(event) => setHeaderForm({
                ...headerForm, maquinista_predeterminado_id: event.target.value,
              })}
            >
              <MenuItem value=""><em>Asignar en cada trabajo</em></MenuItem>
              {catalogs.workers.map((item) => (
                <MenuItem key={item.id} value={item.id}>{item.nombre_completo}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {canCreateOt && (
            <Button variant="contained" disabled={busy} onClick={createHeader}>
              Crear OT de máquina
            </Button>
          )}
        </Stack>
      </Paper>

      )}
      {busy && <Box sx={{ display: 'grid', placeItems: 'center', py: 2 }}><CircularProgress /></Box>}

      <Paper variant="outlined" sx={{ p: 2 }}>
        {!isDetail && (<>
        <Typography variant="overline" color="primary.main">2 · Tablero diario por máquina</Typography>
        <Typography component="h2" variant="h6" fontWeight={850}>
          Estado del turno de un vistazo
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Cada máquina permanece visible aunque todavía no tenga OT. Abre una tarjeta para continuar en su detalle.
        </Typography>
        <Paper variant="outlined" sx={{ p: 1.5, my: 1.5, bgcolor: 'grey.50' }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            alignItems={{ md: 'center' }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography fontWeight={850}>Detalle de Máquinas</Typography>
              <Typography variant="body2" color="text.secondary">
                Este selector enfoca el detalle; no cambia el tablero ni el turno consultado.
              </Typography>
            </Box>
            <FormControl size="small" sx={{ minWidth: 260 }}>
              <InputLabel>Filtrar lista por máquina</InputLabel>
              <Select
                label="Filtrar lista por máquina"
                value={listFilters.maquina_id}
                onChange={(event) => {
                  const machineId = event.target.value;
                  setListFilters({ ...listFilters, maquina_id: machineId });
                  const nextOt = machineId
                    ? ots.find(
                      (item) => String(machineIdFromOt(item)) === String(machineId),
                    )
                    : ots[0];
                  if (nextOt) {
                    setSelectedOtId(nextOt.public_id);
                    setSelectedWorkId(nextOt.trabajos_color?.[0]?.id || '');
                  } else {
                    setSelectedOtId('');
                    setSelectedWorkId('');
                  }
                }}
              >
                <MenuItem value=""><em>Todas las máquinas</em></MenuItem>
                {boardMachines.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.codigo} · {item.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </Paper>

        <DailyMachineBoard
          machines={boardMachines}
          ots={ots}
          workers={catalogs.workers}
          orders={catalogs.orders}
          selectedOtId={selectedOtId}
          canCreateOt={canCreateOt}
          onOpen={openMachineCard}
        />

        <Divider sx={{ my: 2.5 }} />
        </>)}
        {!isLanding && (<>

        <Box ref={detailRef} sx={{ scrollMarginTop: 16 }}>
          <Typography
            component="h3"
            variant="h6"
            fontWeight={850}
            id="ot-machine-detail-heading"
          >
            {selectedOt ? `Detalle de ${selectedOt.codigo_ot}` : 'Lista y detalle de OT'}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Alternativa compacta para seleccionar cualquiera de las OT, incluidas coincidencias históricas en una misma máquina.
        </Typography>
        {filteredOts.length > 0 && (
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ md: 'center' }}
            sx={{ mb: 2 }}
          >
            <FormControl sx={{ width: { xs: '100%', md: 'auto' }, minWidth: { md: 310 } }}>
              <InputLabel id="ot-machine-select-label">OT de máquina</InputLabel>
              <Select
                id="ot-machine-select"
                labelId="ot-machine-select-label"
                label="OT de máquina"
                value={selectedFilteredOtId}
                onChange={(event) => {
                  setSelectedOtId(event.target.value);
                  const next = ots.find((item) => item.public_id === event.target.value);
                  setSelectedWorkId(next?.trabajos_color?.[0]?.id || '');
                }}
              >
                {filteredOts.map((item) => (
                  <MenuItem key={item.public_id} value={item.public_id}>
                    {item.codigo_ot} · {item.maquina_codigo || item.maquina} · {item.fecha_operativa} · {stateLabel(item.turno)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {selectedOt && (
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight={850}>
                  {selectedOt.codigo_ot} · {selectedOt.maquina_codigo || selectedOt.maquina}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedOt.fecha_operativa} · turno {stateLabel(selectedOt.turno)} · {works.length} trabajos de color
                </Typography>
              </Box>
            )}
            {selectedOt && <Chip label={stateLabel(selectedOt.estado)} />}
          </Stack>
        )}
        {!selectedOt ? (
          <Alert severity="info">
            No hay OT para la fecha y turno seleccionados. Las máquinas siguen visibles para preparar su jornada.
          </Alert>
        ) : (
          <ColorWorkQueue
            works={works}
            selectedWorkId={selectedWorkId}
            onSelect={setSelectedWorkId}
          />
        )}
        </>)}
      </Paper>

      {!isLanding && (<>
      {selectedOt && canCreateOt && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography component="h2" variant="h6" fontWeight={850}>
            Agregar Trabajo de color
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Selecciona la OF. El color y las salidas provienen de su configuración liberada; no se escriben manualmente.
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
            <FormControl sx={{ minWidth: 260 }}>
              <InputLabel id="fabrication-order-select-label">
                Orden de fabricación
              </InputLabel>
              <Select
                id="fabrication-order-select"
                labelId="fabrication-order-select-label"
                label="Orden de fabricación"
                value={workForm.orderId}
                onChange={(event) => selectOrder(event.target.value)}
              >
                {eligibleOrders.map((item) => (
                  <MenuItem key={item.id} value={item.id}>{item.codigo}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {availableRuns.length === 1 && (
              <Paper
                data-testid="single-production-color"
                variant="outlined"
                sx={{ px: 1.75, py: 1.25, minWidth: { md: 280 }, flex: 1 }}
              >
                <Typography variant="caption" color="text.secondary">
                  Color a fabricar
                </Typography>
                <Typography fontWeight={900}>
                  {productionColorName(availableRuns[0], draftPlan?.lineas)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {productionRunArticleNames(
                    availableRuns[0], draftPlan?.lineas,
                  ).join(', ') || 'Artículo no informado en la OF'} · {selectedOrder.codigo}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {selectedRunHasColor
                    ? 'Definido en la configuración liberada de la OF; no se edita aquí.'
                    : 'Completa el color en la configuración de la OF y libérala nuevamente.'}
                </Typography>
              </Paper>
            )}
            {availableRuns.length > 1 && (
              <FormControl sx={{ minWidth: 260 }}>
                <InputLabel id="production-color-select-label">Color a fabricar</InputLabel>
                <Select
                  id="production-color-select"
                  labelId="production-color-select-label"
                  label="Color a fabricar"
                  value={workForm.runId}
                  onChange={(event) => setWorkForm({
                    ...workForm, runId: event.target.value,
                  })}
                >
                  {availableRuns.map((item, index) => (
                    <MenuItem
                      key={item.id}
                      value={item.id}
                      disabled={productionColorName(
                        item, draftPlan?.lineas,
                      ) === UNKNOWN_PRODUCTION_COLOR}
                    >
                      {productionRunOptionLabel(
                        item, selectedOrder, draftPlan?.lineas, index,
                      )}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {selectedOrder && availableRuns.length === 0 && (
              <Alert severity="warning" sx={{ minWidth: { md: 280 } }}>
                Esta OF no tiene colores liberados para fabricar.
              </Alert>
            )}
            <FormControl sx={{ minWidth: 240 }}>
              <InputLabel>Maquinista inicial</InputLabel>
              <Select
                label="Maquinista inicial"
                value={workForm.workerId}
                onChange={(event) => setWorkForm({ ...workForm, workerId: event.target.value })}
              >
                {catalogs.workers.map((item) => (
                  <MenuItem key={item.id} value={item.id}>{item.nombre_completo}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {canManagePlan && (
              <Button variant="outlined" disabled={planBusy} onClick={recalculateDraftPlan}>
                Recalcular plan de la OF
              </Button>
            )}
          </Stack>
          {planBusy && <CircularProgress size={24} />}
          {!planBusy && draftRunLines.length > 0 && (
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>Salida</TableCell>
                  <TableCell>Tipo de manga</TableCell>
                  <TableCell align="right">Saldo</TableCell>
                  <TableCell>Asignar al trabajo</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {draftRunLines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>{line.articulo.nombre}</TableCell>
                      <TableCell>{line.tipo_manga.nombre}</TableCell>
                      <TableCell align="right">{compactQuantity(line.saldo_un)} un</TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          label="Cantidad"
                          value={workForm.quantities[line.id] ?? ''}
                          inputProps={{ min: 0, max: Number(line.saldo_un), step: 1 }}
                          onChange={(event) => setWorkForm((current) => ({
                            ...current,
                            quantities: {
                              ...current.quantities, [line.id]: event.target.value,
                            },
                          }))}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <Button
            variant="contained"
            disabled={busy || !selectedRun || !selectedRunHasColor}
            onClick={createWork}
          >
            Agregar a la cola de esta OT
          </Button>
        </Paper>
      )}

      {selectedWork && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="overline" color="primary.main">3 · Ejecución y mangas</Typography>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            alignItems={{ md: 'center' }}
            sx={{ mb: 2 }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography component="h2" variant="h6" fontWeight={850}>
                {selectedWork.color}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedWork.orden_fabricacion_codigo} · responsable {currentWorker?.trabajador || 'por asignar'}
              </Typography>
            </Box>
            <Chip
              label={stateLabel(selectedWork.estado)}
              color={selectedWork.estado === 'EN_EJECUCION' ? 'success' : 'default'}
            />
            {!selectedWork.legacy && canStartWork && selectedWork.estado === 'PLANIFICADO' && (
              <Button
                variant="contained"
                disabled={busy || Boolean(runningWork && runningWork.id !== selectedWork.id)}
                onClick={() => transitionWork('iniciar')}
              >
                Iniciar este color
              </Button>
            )}
            {!selectedWork.legacy && canStartWork && selectedWork.estado === 'PAUSADO' && (
              <Button
                variant="contained"
                disabled={busy || Boolean(runningWork && runningWork.id !== selectedWork.id)}
                onClick={() => transitionWork('reanudar')}
              >
                Reanudar este color
              </Button>
            )}
            {!selectedWork.legacy && canStartWork && selectedWork.estado === 'EN_EJECUCION' && (
              <Button
                variant="outlined"
                color="warning"
                onClick={() => {
                  setWorkActionReason('');
                  setWorkActionDialog({ action: 'pausar' });
                }}
              >
                Pausar para cambiar de color
              </Button>
            )}
            {!selectedWork.legacy && canCloseWork && selectedWork.estado === 'EN_EJECUCION' && (
              <Button
                color="success"
                variant="outlined"
                disabled={busy || pendingWorkMangas.length > 0}
                onClick={() => transitionWork('completar')}
              >
                Completar trabajo
              </Button>
            )}
            {!selectedWork.legacy && canCloseWork
              && ['PLANIFICADO', 'PAUSADO'].includes(selectedWork.estado) && (
                <Button
                  color="error"
                  variant="text"
                  onClick={() => {
                    setWorkActionReason('');
                    setWorkActionDialog({ action: 'anular' });
                  }}
                >
                  Anular trabajo
                </Button>
            )}
          </Stack>
          {runningWork && runningWork.id !== selectedWork.id && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {runningWork.color} está en ejecución. Páusalo antes de iniciar o reanudar este color.
            </Alert>
          )}
          {selectedWork.estado === 'EN_EJECUCION' && pendingWorkMangas.length > 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              No se puede completar todavía: {pendingWorkMangas.length} manga(s) siguen sin pesar o anular.
            </Alert>
          )}

          {!selectedWork.legacy && canCreateOt && (
            <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: 'grey.50' }}>
              <Typography fontWeight={850}>Asignar o relevar maquinista</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Marca mangas en la columna “Relevo” para transferir solo ese subconjunto. Sin selección se transfieren todas las elegibles.
              </Typography>
              <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1}>
                <FormControl size="small" sx={{ minWidth: 240 }}>
                  <InputLabel>Nuevo maquinista</InputLabel>
                  <Select
                    label="Nuevo maquinista"
                    value={reliefForm.workerId}
                    onChange={(event) => setReliefForm({
                      ...reliefForm, workerId: event.target.value,
                    })}
                  >
                    {catalogs.workers.map((item) => (
                      <MenuItem key={item.id} value={item.id}>{item.nombre_completo}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  label="Motivo del relevo"
                  value={reliefForm.reason}
                  onChange={(event) => setReliefForm({
                    ...reliefForm, reason: event.target.value,
                  })}
                  sx={{ flex: 1 }}
                />
                <Button
                  variant="outlined"
                  disabled={busy || !reliefForm.reason.trim()}
                  onClick={relieveWorker}
                >
                  {selectedRelief.length
                    ? `Relevar ${selectedRelief.length} manga${selectedRelief.length > 1 ? 's' : ''}`
                    : 'Relevar mangas elegibles'}
                </Button>
              </Stack>
              <FormControlLabel
                sx={{ mt: 1 }}
                control={(
                  <Checkbox
                    checked={reliefForm.openManga}
                    onChange={(event) => setReliefForm({
                      ...reliefForm,
                      openManga: event.target.checked,
                      boundaryCount: event.target.checked ? reliefForm.boundaryCount : '',
                    })}
                  />
                )}
                label="La manga seleccionada está abierta e incompleta"
              />
              {reliefForm.openManga && (
                <Stack spacing={1}>
                  <TextField
                    size="small"
                    type="number"
                    label="Conteo acumulado al relevo (un)"
                    value={reliefForm.boundaryCount}
                    inputProps={{ min: 0, step: 1 }}
                    onChange={(event) => setReliefForm({
                      ...reliefForm, boundaryCount: event.target.value,
                    })}
                    helperText="El conteo separa la responsabilidad entre maquinistas; no crea un pesaje intermedio."
                    sx={{ maxWidth: 420 }}
                  />
                  <Alert severity="info">
                    El conteo de frontera es evidencia declarada por el supervisor, no una medición automática. Sin un conteo verificable o un contador físico, el sistema registra el relevo, pero no atribuye unidades exactas por trabajador.
                  </Alert>
                  <Alert severity="warning">
                    La manga conserva su identidad de manga, color y Trabajo de color; la preetiqueta anterior se invalida y debe reemplazarse. El relevo solo puede ocurrir dentro de esta misma OT.
                  </Alert>
                </Stack>
              )}
            </Paper>
          )}

          {!selectedWork.legacy
            && (canPlanMangas || canRequestExtra)
            && selectedWorkLines.length > 0 && (
            <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
              <Typography fontWeight={850}>Mangas adicionales para este color</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                La salida y la solicitud quedan vinculadas únicamente a {selectedWork.color}.
              </Typography>
              <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1}>
                <FormControl size="small" sx={{ minWidth: 280 }}>
                  <InputLabel>Salida de este trabajo</InputLabel>
                  <Select
                    label="Salida de este trabajo"
                    value={mangaAllocation.plan_linea_id}
                    onChange={(event) => setMangaAllocation({
                      ...mangaAllocation, plan_linea_id: event.target.value,
                    })}
                  >
                    {selectedWorkLines.map((line) => (
                      <MenuItem key={line.id} value={String(line.id)}>
                        {line.articulo.nombre} · saldo {compactQuantity(line.saldo_un)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  type="number"
                  label="Cantidad (un)"
                  value={mangaAllocation.cantidad_un}
                  inputProps={{ min: 1, step: 1 }}
                  onChange={(event) => setMangaAllocation({
                    ...mangaAllocation, cantidad_un: event.target.value,
                  })}
                />
                {canRequestExtra && (
                  <TextField
                    size="small"
                    label="Motivo para manga EXTRA"
                    value={mangaAllocation.motivo}
                    onChange={(event) => setMangaAllocation({
                      ...mangaAllocation, motivo: event.target.value,
                    })}
                    sx={{ flex: 1, minWidth: 230 }}
                  />
                )}
                {canPlanMangas && (
                  <Button variant="outlined" disabled={busy} onClick={addMangas}>
                    Agregar normales
                  </Button>
                )}
                {canRequestExtra && (
                  <Button
                    color="warning"
                    variant="contained"
                    disabled={busy || !mangaAllocation.motivo.trim()}
                    onClick={requestExtraManga}
                  >
                    Solicitar EXTRA
                  </Button>
                )}
              </Stack>
            </Paper>
          )}

          {canApproveExtra && extraRequests.length > 0 && (
            <Paper
              variant="outlined"
              sx={{ p: 1.5, mb: 2, borderColor: 'warning.light' }}
            >
              <Typography fontWeight={850}>Autorizaciones EXTRA de este color</Typography>
              <Stack spacing={1} sx={{ mt: 1 }}>
                {extraRequests.map((item) => (
                  <Stack
                    key={item.id}
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1}
                    alignItems={{ md: 'center' }}
                  >
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {compactQuantity(item.cantidad_solicitada_un)} un · {item.motivo}
                    </Typography>
                    <Button
                      size="small"
                      color="warning"
                      variant="outlined"
                      aria-label={`Aprobar solicitud ${item.id}`}
                      disabled={busy}
                      onClick={() => approveExtraManga(item.id)}
                    >
                      Aprobar EXTRA
                    </Button>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          )}

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            alignItems={{ md: 'center' }}
            sx={{ mb: 1.5 }}
          >
            <Typography fontWeight={850} sx={{ flex: 1 }}>
              Mangas de {selectedWork.color}
            </Typography>
            {canPrelabel && (
              <Button
                variant="contained"
                startIcon={<PrintOutlinedIcon />}
                disabled={!selectedLabels.length || selectedLabels.length > 2}
                onClick={generateLabels}
              >
                {prelabelButtonText}
              </Button>
            )}
          </Stack>
          <MangaTable
            work={selectedWork}
            canPrelabel={canPrelabel}
            canAnnulManga={canAnnulManga}
            canReplaceLabel={canReplaceLabel}
            canViewWeighing={canViewWeighing}
            selectedLabels={selectedLabels}
            selectedRelief={selectedRelief}
            onToggleLabel={(id) => setSelectedLabels((current) => (
              current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
            ))}
            onToggleRelief={(id) => setSelectedRelief((current) => (
              current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
            ))}
            onAnnul={(manga) => {
              setMangaActionReason('');
              setMangaActionDialog({ type: 'annul', manga });
            }}
            onReplace={(manga) => {
              setMangaActionReason('');
              setMangaActionDialog({ type: 'replace', manga });
            }}
            onWeighing={openWeighing}
            weighingBusy={weighingBusy}
          />
        </Paper>
      )}

      {printJob && (
        <Alert severity="info">
          <Stack spacing={1}>
            <Box>
              <Typography fontWeight={850}>
                {printJob.labels?.length === 1 ? 'Preetiqueta generada' : 'Preetiquetas generadas'}
                {' y pendiente'}{printJob.labels?.length === 1 ? '' : 's'} de impresión
              </Typography>
              <Typography variant="body2">
                Trabajo <strong>{printJob.print_job_id}</strong> · {printJob.labels?.length || 0}{' '}
                {printJob.labels?.length === 1 ? 'etiqueta' : 'etiquetas'}.
                La vista previa no registra una impresión física.
              </Typography>
            </Box>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              alignItems={{ sm: 'center' }}
            >
              <Button
                size="small"
                variant="outlined"
                onClick={() => copyPrintJobId(printJob.print_job_id)}
              >
                Copiar ID del trabajo
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={() => openPrintJobPreview(printJob.print_job_id)}
              >
                Abrir vista previa en estación
              </Button>
            </Stack>
          </Stack>
        </Alert>
      )}

      {replacementPrintJobs.length > 0 && (
        <Alert severity="warning">
          <Typography fontWeight={850}>Reimpresión obligatoria por relevo</Typography>
          <Typography variant="body2">
            La preetiqueta anterior se invalida y debe reemplazarse. Abre todos estos trabajos en la estación de pesaje:
          </Typography>
          <Box component="ul" sx={{ my: 0.75, pl: 2.5 }}>
            {replacementPrintJobs.map((job) => {
              const labelCount = job.labels?.length || 0;
              return (
                <Typography component="li" key={job.print_job_id} variant="body2">
                  <strong>{job.print_job_id}</strong> · {labelCount} {labelCount === 1 ? 'etiqueta' : 'etiquetas'}
                </Typography>
              );
            })}
          </Box>
        </Alert>
      )}

      </>)}
      </Stack>

      <Dialog open={Boolean(workActionDialog)} onClose={() => setWorkActionDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          {workActionDialog?.action === 'anular' ? 'Anular Trabajo de color' : 'Pausar Trabajo de color'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity={workActionDialog?.action === 'anular' ? 'warning' : 'info'}>
              {workActionDialog?.action === 'anular'
                ? 'La evidencia se conserva y las mangas sin pesar devolverán su cupo.'
                : 'Podrás iniciar otro color y reanudar este trabajo más adelante.'}
            </Alert>
            <TextField
              autoFocus
              multiline
              minRows={2}
              label={workActionDialog?.action === 'anular' ? 'Motivo obligatorio' : 'Motivo de pausa opcional'}
              value={workActionReason}
              onChange={(event) => setWorkActionReason(event.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWorkActionDialog(null)}>Cancelar</Button>
          <Button
            variant="contained"
            color={workActionDialog?.action === 'anular' ? 'error' : 'warning'}
            disabled={busy || (workActionDialog?.action === 'anular' && !workActionReason.trim())}
            onClick={submitWorkDialog}
          >
            {workActionDialog?.action === 'anular' ? 'Anular trabajo' : 'Pausar trabajo'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(mangaActionDialog)} onClose={() => setMangaActionDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          {mangaActionDialog?.type === 'annul' ? 'Anular manga' : 'Reemplazar etiqueta'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="warning">
              {mangaActionDialog?.type === 'annul'
                ? 'La manga y sus etiquetas quedarán anuladas; no se elimina la evidencia.'
                : 'La etiqueta actual será invalidada y se generará otra identidad imprimible.'}
            </Alert>
            <TextField
              autoFocus
              multiline
              minRows={3}
              label="Motivo obligatorio"
              value={mangaActionReason}
              onChange={(event) => setMangaActionReason(event.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMangaActionDialog(null)}>Cancelar</Button>
          <Button
            variant="contained"
            color={mangaActionDialog?.type === 'annul' ? 'error' : 'primary'}
            disabled={busy || !mangaActionReason.trim()}
            onClick={submitMangaAction}
          >
            Confirmar acción
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(weighingDialog)} onClose={() => setWeighingDialog(null)} fullWidth maxWidth="md">
        <DialogTitle>Pesaje de {weighingDialog?.manga?.codigo}</DialogTitle>
        <DialogContent>
          {weighingBusy && <CircularProgress size={24} />}
          {weighingDialog?.detail?.original && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              {weighingDialog.detail.anulacion && (
                <Alert severity="warning">
                  Pesaje anulado: {weighingDialog.detail.anulacion.motivo}. Los QR anteriores ya no son válidos.
                </Alert>
              )}
              <Alert severity="info">
                El original es inmutable. Una corrección aprobada crea una proyección vigente y otra etiqueta final.
              </Alert>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead><TableRow>
                    <TableCell>Versión</TableCell>
                    <TableCell align="right">Bruto kg</TableCell>
                    <TableCell align="right">Tara kg</TableCell>
                    <TableCell align="right">Neto físico kg</TableCell>
                    <TableCell align="right">Cantidad un</TableCell>
                    <TableCell align="right">Kg trabajo</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {[
                      ['Original', weighingDialog.detail.original],
                      ['Vigente', weighingDialog.detail.vigente],
                    ].filter(([, value]) => value).map(([label, value]) => (
                      <TableRow key={label}>
                        <TableCell>{label}</TableCell>
                        <TableCell align="right">{value.peso_bruto_kg}</TableCell>
                        <TableCell align="right">{value.tara_kg}</TableCell>
                        <TableCell align="right">{value.peso_fisico_neto_kg}</TableCell>
                        <TableCell align="right">{value.cantidad_confirmada}</TableCell>
                        <TableCell align="right">{value.kg_produccion_ot}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {canRequestCorrection && !weighingDialog.detail.anulacion && (
                <>
                  <Divider />
                  <Typography fontWeight={850}>Solicitar corrección</Typography>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                    <TextField
                      type="number"
                      label="Bruto kg"
                      size="small"
                      value={correctionForm.peso_bruto_kg}
                      onChange={(event) => setCorrectionForm({
                        ...correctionForm, peso_bruto_kg: event.target.value,
                      })}
                    />
                    <TextField
                      type="number"
                      label="Tara kg"
                      size="small"
                      value={correctionForm.tara_kg}
                      onChange={(event) => setCorrectionForm({
                        ...correctionForm, tara_kg: event.target.value,
                      })}
                    />
                    <TextField
                      type="number"
                      label="Cantidad un"
                      size="small"
                      value={correctionForm.cantidad_confirmada}
                      onChange={(event) => setCorrectionForm({
                        ...correctionForm, cantidad_confirmada: event.target.value,
                      })}
                    />
                  </Stack>
                  <TextField
                    label="Motivo obligatorio"
                    multiline
                    minRows={2}
                    value={correctionForm.motivo}
                    onChange={(event) => setCorrectionForm({
                      ...correctionForm, motivo: event.target.value,
                    })}
                  />
                  <Button
                    variant="outlined"
                    disabled={weighingBusy || !correctionForm.motivo.trim()}
                    onClick={requestWeighingCorrection}
                  >
                    Solicitar corrección
                  </Button>
                </>
              )}

              {canAnnulWeighing && !weighingDialog.detail.anulacion && (
                <Paper variant="outlined" sx={{ p: 1.5, borderColor: 'error.light' }}>
                  <Stack spacing={1}>
                    <Typography fontWeight={850} color="error">Anular pesaje</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Invalida ambas etiquetas, anula la manga y devuelve su cupo al Trabajo de color. Si ingresó a Almacén, exige primero la reversa.
                    </Typography>
                    <TextField
                      label="Motivo de anulación"
                      multiline
                      minRows={2}
                      value={annulmentForm.motivo}
                      onChange={(event) => setAnnulmentForm({
                        ...annulmentForm, motivo: event.target.value,
                      })}
                    />
                    <TextField
                      label="Evidencia opcional"
                      value={annulmentForm.evidencia}
                      onChange={(event) => setAnnulmentForm({
                        ...annulmentForm, evidencia: event.target.value,
                      })}
                    />
                    <Button
                      color="error"
                      variant="contained"
                      disabled={weighingBusy || !annulmentForm.motivo.trim()}
                      onClick={annulWeighing}
                    >
                      Anular pesaje definitivamente
                    </Button>
                  </Stack>
                </Paper>
              )}

              {weighingDialog.detail.correcciones?.map((correction) => (
                <Paper key={correction.id} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography fontWeight={800}>
                        {correction.estado} · solicitante #{correction.requested_by_id}
                      </Typography>
                      <Typography variant="body2">{correction.reason}</Typography>
                    </Box>
                    {canApproveCorrection && correction.estado === 'PENDIENTE' && (
                      <Button
                        variant="contained"
                        color="warning"
                        disabled={weighingBusy}
                        onClick={() => approveWeighingCorrection(correction.id)}
                      >
                        Aprobar corrección
                      </Button>
                    )}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setWeighingDialog(null)}>Cerrar</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}
