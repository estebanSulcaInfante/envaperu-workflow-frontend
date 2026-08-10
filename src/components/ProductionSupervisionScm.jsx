import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
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
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';
import FactoryOutlinedIcon from '@mui/icons-material/FactoryOutlined';
import PauseOutlinedIcon from '@mui/icons-material/PauseOutlined';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { useScmActor } from '../context/ScmActorContext';
import {
  listarSupervisionOtsScm,
  listarSupervisionMangasScm,
  obtenerDetalleSupervisionOtScm,
  obtenerResumenSupervisionOtsScm,
} from '../services/scmProductionObservabilityApi';
import { mensajeErrorScm } from '../services/scmEngineeringApi';
import { todayInLima } from '../utils/limaDate';
import DataTableToolbar from './ui/DataTableToolbar';
import PageHeader from './ui/PageHeader';

const PAGE_LIMIT = 25;
const RANGE_VALUES = new Set(['HOY', 'SEMANA', 'MES', 'PERSONALIZADO']);
const VIEW_VALUES = new Set(['LISTA', 'RECURSOS', 'MANGAS']);
const MANGA_STATES = [
  'PLANIFICADA', 'PREETIQUETADA', 'ABIERTA', 'CERRADA',
  'PESADA', 'PENDIENTE_RECEPCION_ALMACEN', 'RECIBIDA', 'ANULADA',
];
const QUICK_FILTERS = [
  { value: 'EN_EJECUCION', label: 'En ejecución' },
  { value: 'PAUSADAS', label: 'Pausadas' },
  { value: 'PENDIENTES_PESAJE', label: 'Pendientes de pesaje' },
  { value: 'ATRASADAS', label: 'Atrasadas' },
];
const DOCUMENT_STATES = [
  'BORRADOR', 'PLANIFICADA', 'LIBERADA', 'EN_EJECUCION', 'CERRADA', 'ANULADA',
];
const OPERATION_STATES = [
  'PLANIFICADA', 'EN_EJECUCION', 'PAUSADA', 'COMPLETADA', 'CERRADA', 'ANULADA',
];
const SHIFTS = ['DIA', 'NOCHE', 'EXTRA'];

const stateLabel = (value, fallback = 'NO INFORMADO') => (
  String(value || fallback).replaceAll('_', ' ')
);

const numberValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const quantity = (value, maximumFractionDigits = 3) => new Intl.NumberFormat('es-PE', {
  maximumFractionDigits,
}).format(numberValue(value));

const weight = (value) => `${numberValue(value).toFixed(3)} kg`;

const localDateTime = (value) => {
  if (!value) return 'No informado';
  try {
    return new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
};

const isoDate = (date) => date.toISOString().slice(0, 10);

const dateParts = (value) => {
  const [year, month, day] = String(value).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const rangeDates = (range, today) => {
  const current = dateParts(today);
  if (range === 'SEMANA') {
    const weekday = current.getUTCDay() || 7;
    const from = new Date(current);
    from.setUTCDate(current.getUTCDate() - weekday + 1);
    const to = new Date(from);
    to.setUTCDate(from.getUTCDate() + 6);
    return { desde: isoDate(from), hasta: isoDate(to) };
  }
  if (range === 'MES') {
    const from = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1));
    const to = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0));
    return { desde: isoDate(from), hasta: isoDate(to) };
  }
  return { desde: today, hasta: today };
};

const filtersFromSearch = (searchParams, today) => {
  const requestedRange = String(searchParams.get('rango') || 'HOY').toUpperCase();
  const rango = RANGE_VALUES.has(requestedRange) ? requestedRange : 'HOY';
  const defaults = rangeDates(rango, today);
  return {
    rango,
    desde: searchParams.get('desde') || defaults.desde,
    hasta: searchParams.get('hasta') || defaults.hasta,
    q: searchParams.get('q') || '',
    tipo: searchParams.get('tipo') || '',
    estado_documental: searchParams.get('documental') || '',
    estado_operativo: searchParams.get('operativo') || '',
    turno: searchParams.get('turno') || '',
    recurso: searchParams.get('recurso') || '',
    responsable: searchParams.get('responsable') || '',
    op: searchParams.get('op') || '',
    orden: searchParams.get('orden') || '',
    ot: searchParams.get('ot') || '',
    color: searchParams.get('color') || '',
    manga: searchParams.get('manga') || '',
    estado_manga: searchParams.get('estado_manga') || '',
    articulo: searchParams.get('articulo') || '',
    quick: searchParams.get('quick') || '',
    cursor: searchParams.get('cursor') || '',
    vista: VIEW_VALUES.has(String(searchParams.get('vista') || '').toUpperCase())
      ? String(searchParams.get('vista')).toUpperCase() : 'LISTA',
    autoRefresh: searchParams.get('auto') !== '0',
  };
};

const otData = (item) => item?.ot || {};
const otCode = (item) => otData(item).codigo || otData(item).codigo_ot || 'OT sin código';
const otId = (item) => otData(item).public_id || otData(item).id || '';
const otType = (item) => {
  const type = String(otData(item).tipo || otData(item).tipo_ot || '').toUpperCase();
  return type === 'ENSAMBLE' ? 'ARMADO' : type || 'NO_INFORMADO';
};
const typeLabel = (item) => (otType(item) === 'FABRICACION' ? 'Fabricación' : (
  otType(item) === 'ARMADO' ? 'Armado' : 'Tipo no informado'
));

const journeyUrl = (item) => {
  const ot = otData(item);
  const params = new URLSearchParams();
  if (ot.fecha_operativa) params.set('fecha', ot.fecha_operativa);
  if (ot.turno) params.set('turno', ot.turno);
  params.set('modo', otType(item) === 'ARMADO' ? 'armado' : 'fabricacion');
  if (otId(item)) params.set('ot', otId(item));
  return `/produccion/ots-planta?${params.toString()}`;
};

const assemblyUrl = (item) => {
  const order = item?.upstream?.orden;
  if (!order?.id || String(order.tipo || '').toUpperCase() !== 'OA') return '';
  const params = new URLSearchParams({ oa: String(order.id), modo: 'armado' });
  const ot = otData(item);
  if (otId(item)) params.set('ot', otId(item));
  if (ot.fecha_operativa) params.set('fecha', ot.fecha_operativa);
  if (ot.turno) params.set('turno', ot.turno);
  return `/produccion/ordenes-armado?${params.toString()}`;
};

function StateChips({ item }) {
  const ot = otData(item);
  return (
    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
      <Chip
        size="small"
        variant="outlined"
        label={`Documental: ${stateLabel(ot.estado_documental)}`}
      />
      <Chip
        size="small"
        color={ot.estado_operativo === 'EN_EJECUCION' ? 'success' : (
          ot.estado_operativo === 'PAUSADA' ? 'warning' : 'default'
        )}
        label={`Operativo: ${stateLabel(ot.estado_operativo)}`}
      />
    </Stack>
  );
}

function UpstreamLabel({ item }) {
  const op = item?.upstream?.op;
  const order = item?.upstream?.orden;
  if (!op && !order) return <Typography variant="body2">Sin orden superior</Typography>;
  return (
    <Box>
      <Typography variant="body2" fontWeight={800}>{order?.codigo || 'Sin OF/OA'}</Typography>
      <Typography variant="caption" color="text.secondary">
        {op?.codigo || 'Sin OP'}{op?.fecha_necesidad ? ` · necesidad ${op.fecha_necesidad}` : ''}
      </Typography>
    </Box>
  );
}

function ProgressSummary({ item }) {
  const work = item?.trabajo_actual;
  const totals = item?.cantidades_resumen;
  const hasTotals = totals?.objetivo_un != null || totals?.confirmado_un != null;
  const target = numberValue(totals?.objetivo_un);
  const confirmed = numberValue(totals?.confirmado_un);
  const percent = target > 0 ? Math.min(999, (confirmed / target) * 100) : null;
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" fontWeight={850}>Avance total OT</Typography>
      {hasTotals ? (
        <>
          <Typography variant="body2">
            {quantity(confirmed)} / {quantity(target)} un
            {percent === null ? '' : ` · ${quantity(percent, 1)}%`}
          </Typography>
          {percent !== null && (
            <LinearProgress
              variant="determinate"
              value={Math.min(100, percent)}
              aria-label={`Avance total de ${otCode(item)}`}
              sx={{ height: 6, borderRadius: 999 }}
            />
          )}
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">No informado</Typography>
      )}
      <Typography variant="caption" color="text.secondary">
        {work
          ? `Actual: ${work.color || 'Color no informado'} · ${quantity(work.confirmado_un)} / ${quantity(work.objetivo_un)} un`
          : 'Sin trabajo activo'}
      </Typography>
      {item?.trabajo_siguiente?.color && (
        <Typography variant="caption" color="text.secondary">
          Siguiente: {item.trabajo_siguiente.color}
        </Typography>
      )}
    </Stack>
  );
}

function LogisticsSummary({ item, canWeighing, canAlerts }) {
  const mangas = item?.mangas_resumen || {};
  const hasMangaSummary = Boolean(item?.mangas_resumen);
  const weighingVisible = canWeighing && item?.visibilidad?.pesaje !== false;
  const alertsVisible = canAlerts && item?.visibilidad?.alertas !== false;
  return (
    <Stack spacing={0.5}>
      <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
        <Chip
          size="small"
          variant="outlined"
          label={hasMangaSummary ? `Mangas ${quantity(mangas.total, 0)}` : 'Mangas: No informado'}
        />
        {numberValue(mangas.abiertas) > 0 && (
          <Chip size="small" color="warning" label={`Abiertas ${quantity(mangas.abiertas, 0)}`} />
        )}
        {numberValue(mangas.pendientes_pesaje) > 0 && (
          <Chip size="small" color="warning" variant="outlined" label={`Por pesar ${quantity(mangas.pendientes_pesaje, 0)}`} />
        )}
        {numberValue(mangas.pendientes_recepcion) > 0 && (
          <Chip size="small" color="info" variant="outlined" label={`Por recibir ${quantity(mangas.pendientes_recepcion, 0)}`} />
        )}
      </Stack>
      {weighingVisible && item?.pesaje_resumen && (
        <Typography variant="caption" color="text.secondary">
          {weight(item.pesaje_resumen.neto_kg ?? item.pesaje_resumen.peso_fisico_neto_kg)} físicos
          {item.pesaje_resumen.kg_produccion_estandar != null
            ? ` · ${weight(item.pesaje_resumen.kg_produccion_estandar)} estándar` : ''}
        </Typography>
      )}
      {alertsVisible && numberValue(item?.alertas_resumen?.abiertas) > 0 && (
        <Typography variant="caption" color="error.main">
          {quantity(item.alertas_resumen.abiertas, 0)} alerta(s) abierta(s)
        </Typography>
      )}
    </Stack>
  );
}

function RowActions({ item, canOpenAssembly, onDetail }) {
  const oaUrl = canOpenAssembly ? assemblyUrl(item) : '';
  return (
    <Stack spacing={0.5} alignItems="flex-end">
      <Button
        size="small"
        component={RouterLink}
        to={journeyUrl(item)}
        endIcon={<ArrowForwardOutlinedIcon />}
        aria-label={`Abrir jornada de ${otCode(item)}`}
      >
        Abrir jornada
      </Button>
      {oaUrl && (
        <Button size="small" component={RouterLink} to={oaUrl} aria-label={`Abrir OA de ${otCode(item)}`}>
          Abrir OA
        </Button>
      )}
      <Button
        size="small"
        variant="outlined"
        startIcon={<VisibilityOutlinedIcon />}
        onClick={() => onDetail(item)}
        aria-label={`Ver detalle de ${otCode(item)}`}
      >
        Detalle
      </Button>
    </Stack>
  );
}

function SupervisionTable({
  items, canWeighing, canAlerts, canOpenAssembly, onDetail,
}) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" aria-label="Órdenes de trabajo supervisadas">
        <TableHead>
          <TableRow>
            <TableCell>OT y estados</TableCell>
            <TableCell>OP / OF-OA</TableCell>
            <TableCell>Jornada y recurso</TableCell>
            <TableCell>Responsable y trabajo</TableCell>
            <TableCell>Mangas, pesaje y almacén</TableCell>
            <TableCell>Última actividad</TableCell>
            <TableCell align="right">Consultar</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow key={otId(item) || otCode(item)} data-testid={`supervision-row-${otId(item)}`} hover>
              <TableCell sx={{ minWidth: 230 }}>
                <Typography fontWeight={900}>{otCode(item)}</Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
                  {typeLabel(item)} · etapa {stateLabel(item?.etapa_actual)}
                </Typography>
                <StateChips item={item} />
              </TableCell>
              <TableCell sx={{ minWidth: 160 }}><UpstreamLabel item={item} /></TableCell>
              <TableCell sx={{ minWidth: 180 }}>
                <Typography variant="body2" fontWeight={800}>
                  {item?.recurso?.codigo || 'Sin recurso'}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {item?.recurso?.nombre || 'Recurso no informado'}
                </Typography>
                <Typography variant="caption">
                  {otData(item).fecha_operativa || 'Sin fecha'} · {stateLabel(otData(item).turno, 'SIN TURNO')}
                </Typography>
              </TableCell>
              <TableCell sx={{ minWidth: 190 }}>
                <Typography variant="body2" fontWeight={750}>
                  {item?.responsable?.nombre || 'Por asignar'}
                </Typography>
                <ProgressSummary item={item} />
              </TableCell>
              <TableCell sx={{ minWidth: 220 }}>
                <LogisticsSummary item={item} canWeighing={canWeighing} canAlerts={canAlerts} />
              </TableCell>
              <TableCell sx={{ minWidth: 150 }}>
                <Typography variant="body2">{localDateTime(item?.ultimo_evento_at)}</Typography>
                {item?.riesgo?.atrasada && <Chip size="small" color="error" label="Atrasada" sx={{ mt: 0.5 }} />}
                {item?.riesgo?.horas_sin_actividad != null && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    {quantity(item.riesgo.horas_sin_actividad, 1)} h sin actividad
                  </Typography>
                )}
              </TableCell>
              <TableCell align="right">
                <RowActions
                  item={item}
                  canOpenAssembly={canOpenAssembly}
                  onDetail={onDetail}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function SupervisionCards({
  items, canWeighing, canAlerts, canOpenAssembly, onDetail,
}) {
  return (
    <Stack spacing={1.25} aria-label="Órdenes de trabajo supervisadas">
      {items.map((item) => (
        <Card key={otId(item) || otCode(item)} variant="outlined" data-testid={`supervision-card-${otId(item)}`}>
          <CardContent>
            <Stack spacing={1.25}>
              <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                <Box>
                  <Typography component="h3" variant="subtitle1" fontWeight={900}>{otCode(item)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {typeLabel(item)} · {otData(item).fecha_operativa || 'Sin fecha'} · {stateLabel(otData(item).turno, 'SIN TURNO')}
                  </Typography>
                </Box>
                {item?.riesgo?.atrasada && <Chip size="small" color="error" label="Atrasada" />}
              </Stack>
              <StateChips item={item} />
              <Divider />
              <UpstreamLabel item={item} />
              <Typography variant="body2">
                <strong>Recurso:</strong> {item?.recurso?.codigo || 'Sin recurso'} · {item?.recurso?.nombre || 'No informado'}
              </Typography>
              <Typography variant="body2">
                <strong>Responsable:</strong> {item?.responsable?.nombre || 'Por asignar'}
              </Typography>
              <ProgressSummary item={item} />
              <LogisticsSummary item={item} canWeighing={canWeighing} canAlerts={canAlerts} />
              <Typography variant="caption" color="text.secondary">
                Última actividad: {localDateTime(item?.ultimo_evento_at)}
              </Typography>
            </Stack>
          </CardContent>
          <CardActions sx={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <RowActions item={item} canOpenAssembly={canOpenAssembly} onDetail={onDetail} />
          </CardActions>
        </Card>
      ))}
    </Stack>
  );
}

const mangaData = (item) => item?.manga || {};
const mangaId = (item) => mangaData(item).public_id || mangaData(item).id || '';
const mangaCode = (item) => mangaData(item).codigo || 'Manga sin codigo';
const mangaArticle = (item) => {
  const article = mangaData(item).articulo || {};
  return [article.codigo, article.nombre].filter(Boolean).join(' - ') || 'Articulo no informado';
};

function MangaSummary({ item }) {
  const manga = mangaData(item);
  return (
    <Stack spacing={0.25}>
      <Typography variant="body2">
        {quantity(manga.cantidad_confirmada_un)} / {quantity(manga.cantidad_objetivo_un)} un
      </Typography>
      {manga.pesaje ? (
        <>
          <Typography variant="caption" color="text.secondary">
            {weight(manga.pesaje.peso_fisico_neto_kg)} fisicos
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {weight(manga.pesaje.kg_produccion_estandar)} estandar
          </Typography>
        </>
      ) : <Typography variant="caption" color="text.secondary">Sin pesaje efectivo</Typography>}
    </Stack>
  );
}

function MangaActions({ item, onDetail }) {
  return (
    <Stack spacing={0.5} alignItems="flex-end">
      <Button
        size="small"
        variant="outlined"
        startIcon={<VisibilityOutlinedIcon />}
        onClick={() => onDetail(item)}
        aria-label={`Ver trazabilidad de ${mangaCode(item)}`}
      >
        Ver trazabilidad
      </Button>
      <Button
        size="small"
        component={RouterLink}
        to={journeyUrl(item)}
        endIcon={<ArrowForwardOutlinedIcon />}
        aria-label={`Abrir jornada de ${mangaCode(item)}`}
      >
        Abrir jornada
      </Button>
    </Stack>
  );
}

function MangaTable({ items, onDetail }) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" aria-label="Mangas supervisadas">
        <TableHead>
          <TableRow>
            <TableCell>Manga y estado</TableCell>
            <TableCell>Articulo y color</TableCell>
            <TableCell>OT y origen</TableCell>
            <TableCell>Recurso y responsable</TableCell>
            <TableCell>Cantidad y peso</TableCell>
            <TableCell>Etiqueta y almacen</TableCell>
            <TableCell align="right">Consultar</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => {
            const manga = mangaData(item);
            return (
              <TableRow key={mangaId(item) || mangaCode(item)} data-testid={`supervision-manga-${mangaId(item)}`} hover>
                <TableCell sx={{ minWidth: 190 }}>
                  <Typography fontWeight={900}>{mangaCode(item)}</Typography>
                  <Chip size="small" label={stateLabel(manga.estado_operativo || manga.estado_logistico)} sx={{ mt: 0.5 }} />
                </TableCell>
                <TableCell sx={{ minWidth: 200 }}>
                  <Typography variant="body2" fontWeight={750}>{mangaArticle(item)}</Typography>
                  <Typography variant="caption" color="text.secondary">{manga.color || 'Color no informado'}</Typography>
                </TableCell>
                <TableCell sx={{ minWidth: 180 }}>
                  <Typography variant="body2" fontWeight={800}>{otCode(item)}</Typography>
                  <UpstreamLabel item={item} />
                </TableCell>
                <TableCell sx={{ minWidth: 180 }}>
                  <Typography variant="body2">{item?.recurso?.codigo || 'Sin recurso'} ? {item?.recurso?.nombre || 'No informado'}</Typography>
                  <Typography variant="caption" color="text.secondary">{manga.responsable?.nombre || item?.responsable?.nombre || 'Por asignar'}</Typography>
                </TableCell>
                <TableCell sx={{ minWidth: 155 }}><MangaSummary item={item} /></TableCell>
                <TableCell sx={{ minWidth: 170 }}>
                  <Typography variant="body2">{manga.etiqueta ? `${stateLabel(manga.etiqueta.tipo)} ? ${stateLabel(manga.etiqueta.estado)}` : 'Sin etiqueta'}</Typography>
                  <Typography variant="caption" color="text.secondary">{stateLabel(manga.almacen?.estado_logistico || manga.estado_logistico)}</Typography>
                </TableCell>
                <TableCell align="right"><MangaActions item={item} onDetail={onDetail} /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function MangaCards({ items, onDetail }) {
  return (
    <Stack spacing={1.25} aria-label="Mangas supervisadas">
      {items.map((item) => (
        <Card key={mangaId(item) || mangaCode(item)} variant="outlined" data-testid={`supervision-manga-${mangaId(item)}`}>
          <CardContent>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" spacing={1}>
                <Typography component="h3" variant="subtitle1" fontWeight={900}>{mangaCode(item)}</Typography>
                <Chip size="small" label={stateLabel(mangaData(item).estado_operativo || mangaData(item).estado_logistico)} />
              </Stack>
              <Typography variant="body2" fontWeight={750}>{mangaArticle(item)}</Typography>
              <Typography variant="caption" color="text.secondary">{mangaData(item).color || 'Color no informado'}</Typography>
              <Typography variant="body2"><strong>Origen:</strong> {otCode(item)}</Typography>
              <UpstreamLabel item={item} />
              <MangaSummary item={item} />
            </Stack>
          </CardContent>
          <CardActions sx={{ justifyContent: 'flex-end' }}><MangaActions item={item} onDetail={onDetail} /></CardActions>
        </Card>
      ))}
    </Stack>
  );
}

function ResourceView({ items, onDetail, canOpenAssembly }) {
  const groups = useMemo(() => {
    const mapped = new Map();
    items.forEach((item) => {
      const resource = item?.recurso || {};
      const key = String(resource.id || resource.codigo || 'SIN_RECURSO');
      if (!mapped.has(key)) mapped.set(key, { resource, items: [] });
      mapped.get(key).items.push(item);
    });
    return [...mapped.values()];
  }, [items]);

  return (
    <Box
      aria-label="Recursos incluidos en la consulta"
      sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 1.5 }}
    >
      {groups.map((group) => {
        const running = group.items.filter(
          (item) => otData(item).estado_operativo === 'EN_EJECUCION',
        ).length;
        return (
          <Paper key={group.resource.id || group.resource.codigo || 'sin-recurso'} variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.25}>
              <Stack direction="row" justifyContent="space-between" spacing={1}>
                <Box>
                  <Typography component="h3" variant="h6" fontWeight={900}>
                    {group.resource.codigo || 'Sin recurso'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {group.resource.nombre || 'Recurso no informado'}
                  </Typography>
                </Box>
                <Chip size="small" color={running ? 'success' : 'default'} label={`${running} en ejecución`} />
              </Stack>
              {group.items.map((item) => (
                <Paper key={otId(item)} variant="outlined" sx={{ p: 1.25, bgcolor: 'grey.50' }}>
                  <Stack spacing={0.75}>
                    <Typography fontWeight={850}>{otCode(item)} · {typeLabel(item)}</Typography>
                    <StateChips item={item} />
                    <ProgressSummary item={item} />
                    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                      <Button
                        size="small"
                        component={RouterLink}
                        to={journeyUrl(item)}
                        aria-label={`Abrir jornada de ${otCode(item)}`}
                      >
                        Abrir jornada
                      </Button>
                      {canOpenAssembly && assemblyUrl(item) && (
                        <Button size="small" component={RouterLink} to={assemblyUrl(item)}>
                          Abrir OA
                        </Button>
                      )}
                      <Button size="small" onClick={() => onDetail(item)} aria-label={`Ver detalle de ${otCode(item)}`}>
                        Detalle
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Paper>
        );
      })}
    </Box>
  );
}

function Kpi({ testId, label, value, help, color = 'primary.main' }) {
  return (
    <Paper data-testid={testId} variant="outlined" sx={{ p: 1.5, borderTop: 3, borderTopColor: color }}>
      <Typography variant="caption" color="text.secondary" fontWeight={800}>{label}</Typography>
      <Typography variant="h5" fontWeight={900}>{value}</Typography>
      <Typography variant="caption" color="text.secondary">{help}</Typography>
    </Paper>
  );
}

function KpiGrid({ summary, fallbackItems, canWeighing }) {
  const totals = summary?.totales || {};
  const operational = totals.por_estado_operativo || {};
  const sumKnown = (selector) => {
    const known = fallbackItems.map(selector).filter((value) => value != null);
    return known.length ? known.reduce((sum, value) => sum + numberValue(value), 0) : null;
  };
  const fallbackCount = (state) => fallbackItems.filter(
    (item) => otData(item).estado_operativo === state,
  ).length;
  const values = {
    total: totals.ots ?? fallbackItems.length,
    running: operational.EN_EJECUCION ?? fallbackCount('EN_EJECUCION'),
    paused: (operational.PAUSADA ?? operational.PAUSADO) ?? (
      fallbackCount('PAUSADA') + fallbackCount('PAUSADO')
    ),
    pendingWeighing: totals.mangas_pendientes_pesaje
      ?? sumKnown((item) => item?.mangas_resumen?.pendientes_pesaje),
    pendingReceiving: totals.mangas_pendientes_recepcion
      ?? sumKnown((item) => item?.mangas_resumen?.pendientes_recepcion),
    objective: totals.objetivo_un
      ?? sumKnown((item) => item?.cantidades_resumen?.objetivo_un),
    confirmed: totals.confirmado_un
      ?? sumKnown((item) => item?.cantidades_resumen?.confirmado_un),
    physicalWeight: totals.peso_fisico_neto_kg
      ?? sumKnown((item) => item?.pesaje_resumen?.peso_fisico_neto_kg ?? item?.pesaje_resumen?.neto_kg),
    standardWeight: totals.kg_produccion_estandar
      ?? sumKnown((item) => item?.pesaje_resumen?.kg_produccion_estandar),
  };
  const unitsValue = values.confirmed == null || values.objective == null
    ? 'No informado'
    : `${quantity(values.confirmed)} / ${quantity(values.objective)} un`;
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: 1.25 }}>
      <Kpi testId="kpi-total" label="OT EN EL PERIODO" value={quantity(values.total, 0)} help="Documentos visibles" />
      <Kpi testId="kpi-running" label="EN EJECUCIÓN" value={quantity(values.running, 0)} help="Estado operativo" color="success.main" />
      <Kpi testId="kpi-paused" label="PAUSADAS" value={quantity(values.paused, 0)} help="Requieren continuidad" color="warning.main" />
      <Kpi
        testId="kpi-units"
        label="UNIDADES CONFIRMADAS"
        value={unitsValue}
        help="Confirmado / objetivo del periodo"
        color="success.main"
      />
      <Kpi
        testId="kpi-pending-weighing"
        label="MANGAS POR PESAR"
        value={values.pendingWeighing == null ? 'No informado' : quantity(values.pendingWeighing, 0)}
        help="Estado operativo de manga"
        color="warning.main"
      />
      <Kpi
        testId="kpi-pending-receiving"
        label="MANGAS POR RECIBIR"
        value={values.pendingReceiving == null ? 'No informado' : quantity(values.pendingReceiving, 0)}
        help="Flujo logístico"
        color="info.main"
      />
      <Kpi
        testId="kpi-physical-weight"
        label="PESO FÍSICO NETO"
        value={canWeighing
          ? (values.physicalWeight == null ? 'No informado' : weight(values.physicalWeight))
          : 'Restringido'}
        help={canWeighing ? 'Balanza, tras correcciones aplicadas' : 'Requiere permiso de pesaje'}
        color="info.main"
      />
      <Kpi
        testId="kpi-standard-weight"
        label="KG DE PRODUCCIÓN ESTÁNDAR"
        value={canWeighing
          ? (values.standardWeight == null ? 'No informado' : weight(values.standardWeight))
          : 'Restringido'}
        help={canWeighing ? 'Métrica estándar, separada del peso físico' : 'Requiere permiso de pesaje'}
        color="secondary.main"
      />
    </Box>
  );
}

function DetailHierarchy({
  item, canWeighing, canWarehouse, canQuality, canAlerts, canOpenAssembly,
}) {
  const op = item?.upstream?.op;
  const order = item?.upstream?.orden;
  const orders = Array.isArray(item?.upstream?.ordenes) && item.upstream.ordenes.length
    ? item.upstream.ordenes : (order ? [order] : []);
  const works = Array.isArray(item?.trabajos) ? item.trabajos : [];
  return (
    <Stack spacing={1.5}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1 }}>
        <Paper variant="outlined" sx={{ p: 1.25 }}>
          <Typography variant="overline">1 · Demanda</Typography>
          <Typography fontWeight={850}>{op?.codigo || 'OP no informada'}</Typography>
          <Typography variant="caption">{stateLabel(op?.estado)}</Typography>
        </Paper>
        <Paper data-testid="detail-upstream-orders" variant="outlined" sx={{ p: 1.25 }}>
          <Typography variant="overline">2 · Orden de operación</Typography>
          {!orders.length && <Typography fontWeight={850}>OF/OA no informada</Typography>}
          <Stack spacing={0.75}>
            {orders.map((candidate) => {
              const current = String(candidate.id || '') === String(order?.id || '');
              return (
                <Box key={candidate.id || candidate.codigo}>
                  <Stack direction="row" spacing={0.5} alignItems="center" useFlexGap flexWrap="wrap">
                    <Typography fontWeight={850}>{candidate.codigo || 'Orden sin código'}</Typography>
                    {current && orders.length > 1 && <Chip size="small" color="primary" label="Actual" />}
                  </Stack>
                  <Typography variant="caption">
                    {stateLabel(candidate.tipo, 'OF/OA')} · {stateLabel(candidate.estado)}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.25 }}>
          <Typography variant="overline">3 · Jornada</Typography>
          <Typography fontWeight={850}>{otCode(item)}</Typography>
          <Typography variant="caption">{stateLabel(otData(item).estado_operativo)}</Typography>
        </Paper>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button
          component={RouterLink}
          to={journeyUrl(item)}
          variant="outlined"
          endIcon={<ArrowForwardOutlinedIcon />}
          aria-label={`Abrir jornada de ${otCode(item)}`}
        >
          Abrir jornada
        </Button>
        {canOpenAssembly && assemblyUrl(item) && (
          <Button component={RouterLink} to={assemblyUrl(item)} variant="text">
            Abrir OA
          </Button>
        )}
      </Stack>

      {item?.bloqueos?.length > 0 && item.bloqueos.map((blocker) => (
        <Alert key={`${blocker.codigo}-${blocker.mensaje}`} severity={String(blocker.severidad || '').toLowerCase() === 'critica' ? 'error' : 'warning'}>
          <strong>{blocker.codigo}</strong> · {blocker.mensaje}
        </Alert>
      ))}

      <Typography component="h3" variant="h6" fontWeight={850}>Trabajos y mangas</Typography>
      {!works.length && <Alert severity="info">No hay trabajos detallados disponibles para esta OT.</Alert>}
      {works.map((work, index) => (
        <Accordion key={work.id || `${work.codigo}-${index}`} defaultExpanded={index === 0} disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreOutlinedIcon />}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ width: '100%', pr: 1 }}>
              <Typography fontWeight={850} sx={{ flex: 1 }}>
                #{work.secuencia || index + 1} · {work.color || work.codigo || 'Trabajo sin color'}
              </Typography>
              <Chip size="small" label={`Operativo: ${stateLabel(work.estado || work.estado_operativo)}`} />
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={1}>
              {(!work.mangas || work.mangas.length === 0) && (
                <Typography variant="body2" color="text.secondary">Sin mangas detalladas.</Typography>
              )}
              {(work.mangas || []).map((manga) => {
                const weighingVisible = canWeighing && item?.visibilidad?.pesaje !== false;
                const warehouseVisible = canWarehouse && item?.visibilidad?.almacen !== false;
                const qualityVisible = canQuality && item?.visibilidad?.calidad !== false;
                return (
                  <Paper key={manga.public_id || manga.codigo} variant="outlined" sx={{ p: 1.25 }}>
                    <Stack spacing={0.75}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75} alignItems={{ sm: 'center' }}>
                        <Typography fontWeight={850} sx={{ flex: 1 }}>{manga.codigo || 'Manga sin código'}</Typography>
                        <Chip size="small" variant="outlined" label={`Operativo: ${stateLabel(manga.estado_operativo)}`} />
                        <Chip size="small" color="info" variant="outlined" label={`Logístico: ${stateLabel(manga.estado_logistico)}`} />
                      </Stack>
                      <Typography variant="body2">
                        {quantity(manga.cantidad_confirmada_un)} / {quantity(manga.cantidad_objetivo_un)} un · responsable {manga.responsable?.nombre || 'Por asignar'}
                      </Typography>
                      {manga.etiqueta && (
                        <Typography variant="caption" color="text.secondary">
                          Etiqueta {stateLabel(manga.etiqueta.tipo, 'TIPO NO INFORMADO')}
                          {manga.etiqueta.version != null ? ` · v${manga.etiqueta.version}` : ''}
                          {' · '}{stateLabel(manga.etiqueta.estado)}
                        </Typography>
                      )}
                      {weighingVisible && manga.pesaje && (
                        <Alert severity="info" icon={false}>
                          Neto físico {weight(manga.pesaje.neto_fisico_kg ?? manga.pesaje.peso_fisico_neto_kg)}
                          {' · '}Kg estándar {weight(manga.pesaje.kg_produccion_estandar ?? manga.pesaje.kg_produccion_ot)}
                          {' · '}{stateLabel(manga.pesaje.estado)}
                        </Alert>
                      )}
                      {warehouseVisible && manga.almacen && (
                        <Typography variant="caption">
                          Almacén: {stateLabel(manga.almacen.estado_logistico ?? manga.almacen.estado)}
                        </Typography>
                      )}
                      {qualityVisible && manga.almacen?.estado_calidad && (
                        <Typography variant="caption">
                          Calidad: {stateLabel(manga.almacen.estado_calidad)}
                        </Typography>
                      )}
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          </AccordionDetails>
        </Accordion>
      ))}
      {canAlerts && item?.visibilidad?.alertas !== false && item?.alertas_resumen && (
        <Alert severity={numberValue(item.alertas_resumen.criticas) ? 'error' : 'info'}>
          {quantity(item.alertas_resumen.abiertas, 0)} alerta(s) abierta(s)
        </Alert>
      )}
    </Stack>
  );
}

function DetailDrawer({
  target, detail, busy, error, onClose, canWeighing, canWarehouse, canAlerts,
  canQuality, canOpenAssembly,
}) {
  const item = detail?.item || target;
  return (
    <Drawer
      anchor="right"
      open={Boolean(target)}
      onClose={onClose}
      slotProps={{
        paper: {
          'aria-labelledby': 'supervision-detail-title',
          sx: { width: { xs: '100%', md: 720 }, maxWidth: '100%' },
        },
      }}
    >
      {target && (
        <Box
          sx={{ p: { xs: 2, md: 2.5 } }}
        >
          <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography id="supervision-detail-title" component="h2" variant="h5" fontWeight={900}>
                Trazabilidad de {otCode(target)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Lectura jerárquica; ninguna acción operativa se ejecuta desde este panel.
              </Typography>
            </Box>
            <Tooltip title="Cerrar detalle">
              <IconButton aria-label="Cerrar detalle" onClick={onClose}><CloseOutlinedIcon /></IconButton>
            </Tooltip>
          </Stack>
          {busy && <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>}
          {error && <Alert severity="error">{error}</Alert>}
          {!busy && !error && item && (
            <DetailHierarchy
              item={item}
              canWeighing={canWeighing}
              canWarehouse={canWarehouse}
              canQuality={canQuality}
              canAlerts={canAlerts}
              canOpenAssembly={canOpenAssembly}
            />
          )}
        </Box>
      )}
    </Drawer>
  );
}

export default function ProductionSupervisionScm() {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('lg'));
  const { can, experience } = useScmActor();
  const [searchParams, setSearchParams] = useSearchParams();
  const todayRef = useRef(todayInLima());
  const filters = useMemo(
    () => filtersFromSearch(searchParams, todayRef.current),
    [searchParams],
  );
  const [searchDraft, setSearchDraft] = useState(filters.q);
  const canWeighing = can('MANGA_PESAJE_VER');
  const canAlerts = can('ALERTA_VER');
  const canWarehouse = can('RECEPCION_MANGA_VER');
  const canQuality = can('CALIDAD_MANGA_VER');
  const canOpenAssembly = can('OA_VER');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState({ next_cursor: null, limit: PAGE_LIMIT, has_more: false });
  const [summary, setSummary] = useState(null);
  const [asOf, setAsOf] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [summaryError, setSummaryError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [cursorHistory, setCursorHistory] = useState([]);
  const [detailTarget, setDetailTarget] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailError, setDetailError] = useState('');
  const detailRequestRef = useRef(null);
  const invalidRange = filters.desde && filters.hasta && filters.desde > filters.hasta;

  const updateSearch = useCallback((patch, { preserveCursor = false } = {}) => {
    if (!preserveCursor) setCursorHistory([]);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(patch).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') next.delete(key);
        else next.set(key, String(value));
      });
      if (!preserveCursor && !Object.prototype.hasOwnProperty.call(patch, 'cursor')) {
        next.delete('cursor');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    setSearchDraft(filters.q);
  }, [filters.q]);

  useEffect(() => {
    if (searchDraft === filters.q) return undefined;
    const timeout = globalThis.setTimeout(() => updateSearch({ q: searchDraft }), 300);
    return () => globalThis.clearTimeout(timeout);
  }, [filters.q, searchDraft, updateSearch]);

  const changeRange = (_event, value) => {
    if (!value || value === filters.rango) return;
    const dates = value === 'PERSONALIZADO'
      ? { desde: filters.desde || todayRef.current, hasta: filters.hasta || todayRef.current }
      : rangeDates(value, todayRef.current);
    updateSearch({ rango: value, ...dates });
  };

  useEffect(() => {
    if (invalidRange) {
      setBusy(false);
      setError('');
      return undefined;
    }
    const controller = new AbortController();
    let active = true;
    const load = async () => {
      setBusy(true);
      setError('');
      const requestFilters = {
        ...filters,
        limit: PAGE_LIMIT,
        signal: controller.signal,
      };
      const listRequest = filters.vista === 'MANGAS'
        ? listarSupervisionMangasScm(requestFilters)
        : listarSupervisionOtsScm(requestFilters);
      const [listResult, summaryResult] = await Promise.allSettled([
        listRequest,
        obtenerResumenSupervisionOtsScm(requestFilters),
      ]);
      if (!active) return;
      if (listResult.status === 'fulfilled') {
        setItems(listResult.value.items || []);
        setPage(listResult.value.page || { next_cursor: null, limit: PAGE_LIMIT, has_more: false });
        setAsOf(listResult.value.as_of || summaryResult.value?.as_of || null);
      } else {
        setError(mensajeErrorScm(listResult.reason, 'No se pudo cargar la supervisión de OT.'));
      }
      if (summaryResult.status === 'fulfilled') {
        setSummary(summaryResult.value);
        setSummaryError('');
        setAsOf((current) => summaryResult.value.as_of || current);
      } else {
        setSummary(null);
        setSummaryError('El resumen no está disponible; la lista conserva los datos que sí pudieron consultarse.');
      }
      setBusy(false);
    };
    load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [filters, invalidRange, refreshKey]);

  useEffect(() => {
    if (!filters.autoRefresh) return undefined;
    const interval = globalThis.setInterval(() => setRefreshKey((value) => value + 1), 30000);
    return () => globalThis.clearInterval(interval);
  }, [filters.autoRefresh]);

  const openDetail = async (item) => {
    detailRequestRef.current?.abort();
    setDetailTarget(item);
    setDetail(null);
    setDetailError('');
    setDetailBusy(true);
    const controller = new AbortController();
    detailRequestRef.current = controller;
    try {
      const payload = await obtenerDetalleSupervisionOtScm(otId(item), {
        signal: controller.signal,
      });
      if (detailRequestRef.current === controller) setDetail(payload);
    } catch (requestError) {
      if (detailRequestRef.current === controller && requestError?.name !== 'CanceledError' && requestError?.name !== 'AbortError') {
        setDetailError(mensajeErrorScm(requestError, 'No se pudo cargar la trazabilidad de esta OT.'));
      }
    } finally {
      if (detailRequestRef.current === controller) setDetailBusy(false);
    }
  };

  const closeDetail = () => {
    detailRequestRef.current?.abort();
    detailRequestRef.current = null;
    setDetailTarget(null);
    setDetail(null);
    setDetailError('');
  };

  useEffect(() => () => detailRequestRef.current?.abort(), []);

  const nextPage = () => {
    if (!page?.has_more || !page?.next_cursor) return;
    setCursorHistory((current) => [...current, filters.cursor || '']);
    updateSearch({ cursor: page.next_cursor }, { preserveCursor: true });
  };

  const previousPage = () => {
    if (!cursorHistory.length) return;
    const previousCursor = cursorHistory[cursorHistory.length - 1];
    setCursorHistory((current) => current.slice(0, -1));
    updateSearch({ cursor: previousCursor }, { preserveCursor: true });
  };

  const quickOptions = QUICK_FILTERS.filter(
    (item) => !item.capability || can(item.capability),
  );

  return (
    <Stack spacing={2.25}>
      <PageHeader
        title="Supervisión de producción"
        description={`${experience.label}: consulta todas las OT y su trazabilidad sin mezclar creación, ejecución ni correcciones.`}
        actions={(
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="outlined"
              startIcon={filters.autoRefresh ? <PauseOutlinedIcon /> : <PlayArrowOutlinedIcon />}
              aria-label={filters.autoRefresh
                ? 'Pausar actualización automática' : 'Reanudar actualización automática'}
              onClick={() => updateSearch({ auto: filters.autoRefresh ? '0' : '1' }, { preserveCursor: true })}
            >
              {filters.autoRefresh ? 'Pausar autoactualización' : 'Reanudar autoactualización'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshOutlinedIcon />}
              disabled={busy}
              onClick={() => setRefreshKey((value) => value + 1)}
            >
              Actualizar ahora
            </Button>
          </Stack>
        )}
      />

      <Alert severity="info">
        Vista de solo lectura. Para crear, iniciar, pausar, pesar o corregir, abre la jornada correspondiente.
      </Alert>

      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack spacing={1.5}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.25} alignItems={{ lg: 'center' }}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={filters.rango}
              onChange={changeRange}
              aria-label="Rango de supervisión"
            >
              <ToggleButton value="HOY">Hoy</ToggleButton>
              <ToggleButton value="SEMANA">Semana</ToggleButton>
              <ToggleButton value="MES">Mes</ToggleButton>
              <ToggleButton value="PERSONALIZADO">Personalizado</ToggleButton>
            </ToggleButtonGroup>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                size="small"
                type="date"
                label="Desde"
                value={filters.desde}
                disabled={filters.rango !== 'PERSONALIZADO'}
                onChange={(event) => updateSearch({ rango: 'PERSONALIZADO', desde: event.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                size="small"
                type="date"
                label="Hasta"
                value={filters.hasta}
                disabled={filters.rango !== 'PERSONALIZADO'}
                onChange={(event) => updateSearch({ rango: 'PERSONALIZADO', hasta: event.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
            <Box sx={{ flex: 1 }} />
            <Stack direction="row" spacing={0.75} alignItems="center" color="text.secondary">
              <AccessTimeOutlinedIcon fontSize="small" />
              <Typography variant="caption">
                {asOf ? `Datos al ${localDateTime(asOf)}` : 'Aún sin corte de datos'} · {filters.autoRefresh ? 'cada 30 s' : 'actualización pausada'}
              </Typography>
            </Stack>
          </Stack>
          {invalidRange && <Alert severity="error">La fecha Desde no puede ser posterior a Hasta.</Alert>}
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" aria-label="Filtros rápidos">
            {quickOptions.map((item) => (
              <Button
                key={item.value}
                size="small"
                variant={filters.quick === item.value ? 'contained' : 'outlined'}
                color={item.value === 'ATRASADAS' ? 'warning' : 'primary'}
                onClick={() => updateSearch({ quick: filters.quick === item.value ? '' : item.value })}
              >
                {item.label}
              </Button>
            ))}
          </Stack>
        </Stack>
      </Paper>

      <DataTableToolbar
        searchValue={searchDraft}
        onSearchChange={setSearchDraft}
        searchPlaceholder={filters.vista === 'MANGAS' ? 'Buscar codigo de manga, articulo, color, OT, OP u OF/OA' : 'Buscar OT, OP, OF/OA, color, recurso o responsable'}
        resultCount={items.length}
        totalCount={filters.vista === 'MANGAS' ? undefined : summary?.totales?.ots}
        filters={[
          {
            id: 'tipo', label: 'Tipo de OT', value: filters.tipo, allValue: '',
            onChange: (value) => updateSearch({ tipo: value }),
            options: [
              { value: '', label: 'Fabricación y Armado' },
              { value: 'FABRICACION', label: 'Fabricación' },
              { value: 'ARMADO', label: 'Armado' },
            ],
          },
          {
            id: 'operativo', label: 'Estado operativo', value: filters.estado_operativo, allValue: '',
            onChange: (value) => updateSearch({ operativo: value }),
            options: [{ value: '', label: 'Todos los estados' }, ...OPERATION_STATES.map((value) => ({ value, label: stateLabel(value) }))],
          },
          {
            id: 'turno', label: 'Turno', value: filters.turno, allValue: '',
            onChange: (value) => updateSearch({ turno: value }),
            options: [{ value: '', label: 'Todos los turnos' }, ...SHIFTS.map((value) => ({ value, label: stateLabel(value) }))],
          },
        ]}
        onClear={() => updateSearch({
          q: '', tipo: '', operativo: '', turno: '', documental: '', recurso: '',
          responsable: '', op: '', orden: '', ot: '', color: '', manga: '', estado_manga: '', articulo: '', quick: '',
        })}
      />

      <Accordion variant="outlined" disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreOutlinedIcon />} aria-controls="advanced-filters-content">
          <Typography fontWeight={800}>Más filtros: estados, responsables y códigos</Typography>
        </AccordionSummary>
        <AccordionDetails id="advanced-filters-content">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 1.25 }}>
            <FormControl size="small" fullWidth>
              <InputLabel id="document-state-label">Estado documental</InputLabel>
              <Select
                labelId="document-state-label"
                label="Estado documental"
                value={filters.estado_documental}
                onChange={(event) => updateSearch({ documental: event.target.value })}
              >
                <MenuItem value="">Todos</MenuItem>
                {DOCUMENT_STATES.map((value) => <MenuItem key={value} value={value}>{stateLabel(value)}</MenuItem>)}
            {filters.vista === 'MANGAS' && (
              <FormControl size="small" fullWidth>
                <InputLabel id="manga-state-label">Estado de manga</InputLabel>
                <Select
                  labelId="manga-state-label"
                  label="Estado de manga"
                  value={filters.estado_manga}
                  onChange={(event) => updateSearch({ estado_manga: event.target.value })}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {MANGA_STATES.map((value) => <MenuItem key={value} value={value}>{stateLabel(value)}</MenuItem>)}
                </Select>
              </FormControl>
            )}
              </Select>
            </FormControl>
            {[
              ['recurso', 'Recurso', filters.recurso],
              ['responsable', 'Responsable', filters.responsable],
              ['op', 'Código OP', filters.op],
              ['orden', 'Código OF u OA', filters.orden],
              ...(filters.vista === 'MANGAS' ? [['manga', 'Codigo de manga', filters.manga], ['articulo', 'Articulo', filters.articulo]] : []),
              ['ot', 'Código OT', filters.ot],
              ['color', 'Color', filters.color],
            ].map(([key, label, value]) => (
              <TextField
                key={key}
                size="small"
                label={label}
                value={value}
                onChange={(event) => updateSearch({ [key]: event.target.value })}
              />
            ))}
          </Box>
        </AccordionDetails>
      </Accordion>

      {busy && items.length > 0 && <LinearProgress aria-label="Actualizando supervisión" />}
      {error && (
        <Alert severity="error" action={<Button color="inherit" onClick={() => setRefreshKey((value) => value + 1)}>Reintentar</Button>}>
          {error}
        </Alert>
      )}
      {summaryError && <Alert severity="warning">{summaryError}</Alert>}

      <KpiGrid summary={summary} fallbackItems={filters.vista === 'MANGAS' ? [] : items} canWeighing={canWeighing} />

      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} alignItems={{ sm: 'center' }}>
        {filters.vista === 'MANGAS' && (
          <Box>
            <Typography component="h2" variant="h6" fontWeight={900}>Mangas</Typography>
            <Typography variant="body2" color="text.secondary">
              Una fila por manga de cualquier estado; abre su trazabilidad para consultar la OT, el trabajo y sus eventos.
            </Typography>
          </Box>
        )}
        <Box sx={{ display: filters.vista === 'MANGAS' ? 'none' : 'block' }}>
          <Typography component="h2" variant="h6" fontWeight={900}>Órdenes de trabajo</Typography>
          <Typography variant="body2" color="text.secondary">
            Una fila por OT; abre el detalle para recorrer su genealogía sin cambiar estados.
          </Typography>
        </Box>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={filters.vista}
          onChange={(_event, value) => value && updateSearch({ vista: value })}
          aria-label="Modo de visualización"
        >
          <ToggleButton value="LISTA">Lista de OT</ToggleButton>
          <ToggleButton value="MANGAS">Mangas</ToggleButton>
          <ToggleButton value="RECURSOS">Recursos del turno</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {busy && items.length === 0 && !error ? (
        <Box role="status" aria-label="Cargando supervisión" sx={{ minHeight: 260, display: 'grid', placeItems: 'center' }}>
          <Stack alignItems="center" spacing={1}><CircularProgress /><Typography>Consultando OT…</Typography></Stack>
        </Box>
      ) : null}

      {!busy && !error && items.length === 0 && (
        <Paper variant="outlined" sx={{ minHeight: 240, display: 'grid', placeItems: 'center', p: 3 }}>
          <Stack spacing={1} alignItems="center" textAlign="center">
            <FactoryOutlinedIcon color="disabled" sx={{ fontSize: 42 }} />
            <Typography component="h3" variant="h6" fontWeight={850}>No hay OT para estos filtros</Typography>
            <Typography variant="body2" color="text.secondary">Amplía el rango o limpia los filtros de consulta.</Typography>
          </Stack>
        </Paper>
      )}

      {items.length > 0 && filters.vista === 'RECURSOS' && (
        <>
          {page.has_more && <Alert severity="info">El modo Recursos resume esta página. Usa Lista de OT para recorrer todas las páginas.</Alert>}
          <ResourceView items={items} onDetail={openDetail} canOpenAssembly={canOpenAssembly} />
        </>
      )}
      {items.length > 0 && filters.vista === 'LISTA' && (mobile
        ? (
          <SupervisionCards
            items={items}
            canWeighing={canWeighing}
            canAlerts={canAlerts}
            canOpenAssembly={canOpenAssembly}
            onDetail={openDetail}
          />
        ) : (
          <SupervisionTable
            items={items}
            canWeighing={canWeighing}
            canAlerts={canAlerts}
            canOpenAssembly={canOpenAssembly}
            onDetail={openDetail}
          />
        ))}

      {items.length > 0 && filters.vista === 'MANGAS' && (mobile
        ? <MangaCards items={items} onDetail={openDetail} /> : <MangaTable items={items} onDetail={openDetail} />)}
      {items.length > 0 && (
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
          <Button disabled={!cursorHistory.length || busy} onClick={previousPage} aria-label="Página anterior">
            Anterior
          </Button>
          <Typography role="status" aria-live="polite" variant="body2">
            Página {cursorHistory.length + 1}
          </Typography>
          <Button disabled={!page.has_more || !page.next_cursor || busy} onClick={nextPage} aria-label="Siguiente página">
            Siguiente
          </Button>
        </Stack>
      )}

      <DetailDrawer
        target={detailTarget}
        detail={detail}
        busy={detailBusy}
        error={detailError}
        onClose={closeDetail}
        canWeighing={canWeighing}
        canWarehouse={canWarehouse}
        canQuality={canQuality}
        canAlerts={canAlerts}
        canOpenAssembly={canOpenAssembly}
      />
    </Stack>
  );
}
