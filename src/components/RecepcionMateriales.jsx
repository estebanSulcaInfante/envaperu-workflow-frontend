import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ScaleOutlinedIcon from '@mui/icons-material/ScaleOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import ApiPendingButton from './ApiPendingButton';
import {
  obtenerRecepcionMateriales,
  RECEPCION_MATERIALES_SOURCE,
} from '../services/recepcionMateriales';

const kgFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

const formatKg = (value) => `${kgFormatter.format(Number(value || 0))} kg`;

const queueStatus = {
  PENDIENTE: { label: 'Pendiente', color: 'warning' },
  PARCIAL: { label: 'Parcial', color: 'info' },
  LIBERADO: { label: 'Liberado', color: 'success' },
  BLOQUEADO: { label: 'Bloqueado', color: 'error' },
  RECHAZADO: { label: 'Rechazado', color: 'error' },
  SIN_EVALUAR: { label: 'Borrador', color: 'default' },
};

const detailStatus = {
  PENDIENTE: { label: 'Pendiente de Calidad', color: 'warning' },
  PARCIAL: { label: 'Liberación parcial', color: 'info' },
  LIBERADO: { label: 'Liberado', color: 'success' },
  BLOQUEADO: { label: 'Bloqueado por Calidad', color: 'error' },
  RECHAZADO: { label: 'Rechazado', color: 'error' },
  SIN_EVALUAR: { label: 'Borrador', color: 'default' },
};

const allocationColors = {
  PENDIENTE: '#ED9C24',
  LIBERADO: '#2E7D32',
  BLOQUEADO: '#C62828',
  RECHAZADO: '#5F6368',
};

function Metric({ label, value, detail, accent = '#1E3A5F', testId }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        height: '100%',
        minHeight: 92,
        p: 1.75,
        borderLeft: `4px solid ${accent}`,
        borderRadius: 1,
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      <Typography data-testid={testId} variant="h6" sx={{ fontWeight: 750, lineHeight: 1.15 }}>
        {value}
      </Typography>
      {detail && (
        <Typography variant="caption" color="text.secondary">
          {detail}
        </Typography>
      )}
    </Paper>
  );
}

function FieldValue({ label, children }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 650, overflowWrap: 'anywhere' }}>
        {children || 'No registrado'}
      </Typography>
    </Box>
  );
}

function QualityChip({ summary, detail = false }) {
  const config = (detail ? detailStatus : queueStatus)[summary] || queueStatus.SIN_EVALUAR;
  return <Chip size="small" color={config.color} label={config.label} />;
}

function ReceptionQueue({ receptions, selectedId, onSelect }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('TODOS');

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return receptions.filter((reception) => {
      const matchesStatus = status === 'TODOS'
        || reception.qualitySummary === status
        || (status === 'RETENIDO' && reception.documentaryHold.active)
        || (status === 'BORRADOR' && reception.state === 'BORRADOR');
      const haystack = [
        reception.id,
        reception.providerName,
        reception.materialName,
        reception.documentNumber,
      ].join(' ').toLowerCase();
      return matchesStatus && (!normalizedSearch || haystack.includes(normalizedSearch));
    });
  }, [receptions, search, status]);

  return (
    <Box sx={{ minWidth: 0, borderRight: { lg: '1px solid #E0E0E0' } }}>
      <Box sx={{ p: 2, borderBottom: '1px solid #E0E0E0' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 750, mb: 1.5 }}>
          Bandeja de recepciones
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row', lg: 'column', xl: 'row' }} spacing={1}>
          <TextField
            aria-label="Buscar recepciones"
            fullWidth
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Recepción, proveedor, material..."
            size="small"
            value={search}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start"><SearchOutlinedIcon fontSize="small" /></InputAdornment>
                ),
              },
            }}
          />
          <TextField
            label="Estado"
            onChange={(event) => setStatus(event.target.value)}
            select
            size="small"
            sx={{ minWidth: { sm: 170, lg: '100%', xl: 170 } }}
            value={status}
          >
            <MenuItem value="TODOS">Todos</MenuItem>
            <MenuItem value="PENDIENTE">Pendientes</MenuItem>
            <MenuItem value="PARCIAL">Parciales</MenuItem>
            <MenuItem value="BLOQUEADO">Bloqueados</MenuItem>
            <MenuItem value="RETENIDO">Retención documental</MenuItem>
            <MenuItem value="BORRADOR">Borradores</MenuItem>
          </TextField>
        </Stack>
      </Box>

      <List disablePadding sx={{ maxHeight: { lg: 720 }, overflowY: 'auto' }}>
        {filtered.map((reception) => (
          <ListItemButton
            data-testid={`reception-row-${reception.id}`}
            key={reception.id}
            onClick={() => onSelect(reception.id)}
            selected={selectedId === reception.id}
            sx={{
              alignItems: 'stretch',
              borderBottom: '1px solid #EEEEEE',
              px: 2,
              py: 1.6,
              '&.Mui-selected': {
                bgcolor: '#EDF4FA',
                boxShadow: 'inset 3px 0 0 #1E3A5F',
              },
            }}
          >
            <Stack spacing={0.75} sx={{ width: '100%', minWidth: 0 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>{reception.id}</Typography>
                <QualityChip summary={reception.qualitySummary} />
              </Stack>
              <Typography variant="body2" noWrap>{reception.providerName}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {reception.materialName} · {reception.documentNumber}
              </Typography>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {reception.state === 'BORRADOR' ? formatKg(reception.draftKg) : formatKg(reception.physicalKg)}
                </Typography>
                {reception.state === 'BORRADOR' ? (
                  <Chip size="small" variant="outlined" label="Sin inventario" />
                ) : reception.documentaryHold.active ? (
                  <Chip size="small" color="warning" variant="outlined" label="Retenido" />
                ) : (
                  <Typography variant="caption" color="text.secondary">{reception.createdAt}</Typography>
                )}
              </Stack>
            </Stack>
          </ListItemButton>
        ))}
        {filtered.length === 0 && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Inventory2OutlinedIcon color="disabled" sx={{ fontSize: 36, mb: 1 }} />
            <Typography variant="body2" color="text.secondary">No hay recepciones para este filtro.</Typography>
          </Box>
        )}
      </List>
    </Box>
  );
}

function ReceptionDataTab({ reception }) {
  const inspectionHasIncidents = reception.inspection.some((item) => item.status !== 'CONFORME');

  return (
    <Stack spacing={2.5} sx={{ p: { xs: 1.5, sm: 2.5 } }}>
      <Box component="section">
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5 }}>Procedencia e identidad</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}><FieldValue label="Proveedor">{reception.providerCode} · {reception.providerName}</FieldValue></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><FieldValue label="Documento">{reception.documentNumber}</FieldValue></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><FieldValue label="Orden de compra">{reception.purchaseOrder || 'Entrada excepcional'}</FieldValue></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><FieldValue label="Material">{reception.materialCode} · {reception.materialName}</FieldValue></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><FieldValue label="Lote interno">{reception.internalLot}</FieldValue></Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <FieldValue label="Lote proveedor">
              {reception.supplierLot || 'Ilegible · no inventado'}
            </FieldValue>
          </Grid>
        </Grid>
      </Box>

      <Divider />

      <Box component="section">
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1.25 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Conteo y pesaje</Typography>
          <Chip
            size="small"
            color={reception.packaging.toleranceStatus === 'PENDIENTE_DECISION' ? 'warning' : 'default'}
            variant="outlined"
            label={reception.packaging.toleranceStatus.replaceAll('_', ' ')}
          />
        </Stack>
        <TableContainer>
          <Table size="small" aria-label="Conteo y pesaje de recepción">
            <TableHead>
              <TableRow sx={{ bgcolor: '#F4F6F8' }}>
                <TableCell>Envases documentados</TableCell>
                <TableCell>Envases recibidos</TableCell>
                <TableCell align="right">Peso nominal</TableCell>
                <TableCell align="right">Peso esperado</TableCell>
                <TableCell align="right">Neto medido</TableCell>
                <TableCell align="right">Diferencia</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>{reception.packaging.documentedPackages}</TableCell>
                <TableCell>{reception.packaging.receivedPackages}</TableCell>
                <TableCell align="right">{reception.packaging.nominalKg == null ? 'Variable' : formatKg(reception.packaging.nominalKg)}</TableCell>
                <TableCell align="right">{reception.packaging.expectedKg == null ? 'No aplica' : formatKg(reception.packaging.expectedKg)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 750 }}>{formatKg(reception.packaging.measuredNetKg)}</TableCell>
                <TableCell align="right">{reception.packaging.differenceKg == null ? 'No aplica' : formatKg(reception.packaging.differenceKg)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Divider />

      <Box component="section">
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <FactCheckOutlinedIcon color={inspectionHasIncidents ? 'warning' : 'success'} fontSize="small" />
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Inspección mínima de Almacén</Typography>
        </Stack>
        <Grid container spacing={1}>
          {reception.inspection.map((item) => (
            <Grid key={item.id} size={{ xs: 12, sm: 6 }}>
              <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ py: 0.5 }}>
                {item.status === 'CONFORME'
                  ? <CheckCircleOutlineIcon color="success" fontSize="small" />
                  : <WarningAmberOutlinedIcon color="warning" fontSize="small" />}
                <Box>
                  <Typography variant="body2">{item.label}</Typography>
                  {item.evidence && <Typography variant="caption" color="text.secondary">Evidencia: {item.evidence}</Typography>}
                </Box>
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Box>

      <Divider />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
        <Box>
          <Typography variant="caption" color="text.secondary">Ubicación física actual</Typography>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
            <LocationOnOutlinedIcon color="primary" fontSize="small" />
            <Chip size="small" label={reception.locationId} />
            <Typography variant="body2">{reception.locationName}</Typography>
          </Stack>
        </Box>
        <Typography variant="caption" color="text.secondary">
          La ubicación no modifica el estado de Calidad.
        </Typography>
      </Stack>
    </Stack>
  );
}

function QualityTab({ reception, capability }) {
  const totals = reception.allocations.reduce((result, allocation) => ({
    ...result,
    [allocation.status]: (result[allocation.status] || 0) + allocation.quantityKg,
  }), {});
  const physicalTotal = reception.allocations.reduce((sum, allocation) => sum + allocation.quantityKg, 0);
  const [decision, setDecision] = useState('LIBERADO');
  const [quantity, setQuantity] = useState(Math.min(400, totals.PENDIENTE || 0));

  return (
    <Stack spacing={2.5} sx={{ p: { xs: 1.5, sm: 2.5 } }}>
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 6, md: 3 }}><Metric label="Existencia física" value={formatKg(physicalTotal)} accent="#1E3A5F" testId="quality-physical-total" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Metric label="Liberado" value={formatKg(totals.LIBERADO)} accent="#2E7D32" testId="quality-released-total" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Metric label="Pendiente" value={formatKg(totals.PENDIENTE)} accent="#ED9C24" testId="quality-pending-total" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Metric label="Bloqueado / rechazado" value={formatKg((totals.BLOQUEADO || 0) + (totals.RECHAZADO || 0))} accent="#C62828" /></Grid>
      </Grid>

      <Box component="section">
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Distribución del lote por Calidad</Typography>
        <Box
          aria-label="Distribución de Calidad"
          sx={{ display: 'flex', width: '100%', height: 14, overflow: 'hidden', bgcolor: '#EEEEEE', borderRadius: 0.75 }}
        >
          {reception.allocations.map((allocation) => (
            <Tooltip key={allocation.id} title={`${allocation.status}: ${formatKg(allocation.quantityKg)}`} arrow>
              <Box
                sx={{
                  bgcolor: allocationColors[allocation.status],
                  width: `${physicalTotal ? (allocation.quantityKg / physicalTotal) * 100 : 0}%`,
                  minWidth: allocation.quantityKg > 0 ? 4 : 0,
                }}
              />
            </Tooltip>
          ))}
        </Box>
      </Box>

      <TableContainer>
        <Table size="small" aria-label="Decisiones parciales de Calidad">
          <TableHead>
            <TableRow sx={{ bgcolor: '#F4F6F8' }}>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Cantidad</TableCell>
              <TableCell>Ubicación</TableCell>
              <TableCell>Motivo</TableCell>
              <TableCell>Responsable</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reception.allocations.map((allocation) => (
              <TableRow key={allocation.id}>
                <TableCell><Chip size="small" label={allocation.status} /></TableCell>
                <TableCell align="right" sx={{ fontWeight: 750 }}>{formatKg(allocation.quantityKg)}</TableCell>
                <TableCell>{allocation.locationId}</TableCell>
                <TableCell>{allocation.reason}</TableCell>
                <TableCell>{allocation.decidedBy || 'Pendiente'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Divider />

      <Box component="section">
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <ScienceOutlinedIcon color="primary" fontSize="small" />
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Preparar decisión de Calidad</Typography>
          <Chip size="small" variant="outlined" label="Vista previa" />
        </Stack>
        <Grid container spacing={1.5} alignItems="flex-start">
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField label="Decisión" select fullWidth size="small" value={decision} onChange={(event) => setDecision(event.target.value)}>
              <MenuItem value="LIBERADO">Liberar</MenuItem>
              <MenuItem value="BLOQUEADO">Bloquear</MenuItem>
              <MenuItem value="RECHAZADO">Rechazar</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              fullWidth
              label="Cantidad"
              onChange={(event) => setQuantity(event.target.value)}
              size="small"
              type="number"
              value={quantity}
              slotProps={{ input: { endAdornment: <InputAdornment position="end">kg</InputAdornment> } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField fullWidth label="Motivo" size="small" defaultValue="Inspección conforme" />
          </Grid>
          <Grid size={{ xs: 12, sm: 8 }}>
            <Alert severity="info" sx={{ py: 0.25 }}>
              La decisión afectaría {formatKg(quantity)}. El remanente no resuelto conservaría su estado actual.
            </Alert>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <ApiPendingButton fullWidth label="Registrar decisión de Calidad" capability={capability} />
          </Grid>
        </Grid>
      </Box>
    </Stack>
  );
}

function HistoryTab({ reception }) {
  const lineage = [
    reception.materialCode,
    reception.internalLot || 'Lote aún no creado',
    reception.supplierLot || 'Lote proveedor ilegible',
    reception.documentNumber,
    reception.purchaseOrder || 'Sin OC · retenido',
    reception.providerCode,
  ];

  return (
    <Stack spacing={2.5} sx={{ p: { xs: 1.5, sm: 2.5 } }}>
      <Box component="section">
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.25 }}>Genealogía hacia el proveedor</Typography>
        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75} alignItems="center">
          {lineage.map((item, index) => (
            <Box key={`${item}-${index}`} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Chip size="small" variant="outlined" label={item} />
              {index < lineage.length - 1 && <Typography color="text.disabled">→</Typography>}
            </Box>
          ))}
        </Stack>
      </Box>
      <Divider />
      <Box component="section">
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.25 }}>Eventos inmutables</Typography>
        <Stack spacing={0}>
          {reception.events.map((event, index) => (
            <Stack key={event.id} direction="row" spacing={1.5} alignItems="stretch">
              <Stack alignItems="center" sx={{ width: 28, flexShrink: 0 }}>
                <Box sx={{ width: 10, height: 10, mt: 0.65, borderRadius: '50%', bgcolor: index === 0 ? '#1E3A5F' : '#78909C' }} />
                {index < reception.events.length - 1 && <Box sx={{ width: 2, flex: 1, minHeight: 46, bgcolor: '#D9E0E6' }} />}
              </Stack>
              <Box sx={{ pb: 2 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ sm: 1 }} alignItems={{ sm: 'baseline' }}>
                  <Typography variant="body2" sx={{ fontWeight: 750 }}>{event.type.replaceAll('_', ' ')}</Typography>
                  <Typography variant="caption" color="text.secondary">{event.time} · {event.actor}</Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">{event.detail}</Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}

function ReceptionDetail({ reception, capabilities, onBack }) {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ p: { xs: 1.5, sm: 2.5 }, borderBottom: '1px solid #E0E0E0' }}>
        <Tooltip title="Volver a la bandeja" arrow>
          <IconButton
            aria-label="Volver a la bandeja"
            onClick={onBack}
            size="small"
            sx={{ display: { xs: 'inline-flex', lg: 'none' }, mb: 1 }}
          >
            <ArrowBackOutlinedIcon />
          </IconButton>
        </Tooltip>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
          <Box>
            <Stack direction="row" alignItems="center" flexWrap="wrap" useFlexGap spacing={1}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>{reception.id}</Typography>
              <QualityChip summary={reception.qualitySummary} detail />
              {reception.documentaryHold.active && <Chip size="small" color="warning" variant="outlined" label="Retención documental" />}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {reception.materialName} · {reception.providerName}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <ApiPendingButton label="Mover" capability={capabilities.moverMaterial} />
            <ApiPendingButton label="Corregir" capability={capabilities.corregirRecepcion} />
          </Stack>
        </Stack>

        <Grid container spacing={1.25} sx={{ mt: 1 }}>
          <Grid size={{ xs: 6, md: 3 }}><Metric label="Existencia física" value={formatKg(reception.physicalKg)} accent="#1E3A5F" testId="physical-total" /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><Metric label="Disponible" value={formatKg(reception.availableKg)} accent="#2E7D32" testId="available-total" /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><Metric label="Ubicación" value={reception.locationId} detail={reception.locationName} accent="#6B4F83" testId="current-location" /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><Metric label="Documento" value={reception.documentNumber} detail={reception.purchaseOrder || 'Entrada excepcional'} accent="#A55C16" /></Grid>
        </Grid>
      </Box>

      <Tabs
        aria-label="Detalle de recepción"
        onChange={(_, value) => setTab(value)}
        scrollButtons="auto"
        sx={{ px: { xs: 0.5, sm: 2 }, borderBottom: '1px solid #E0E0E0' }}
        value={tab}
        variant="scrollable"
      >
        <Tab icon={<ReceiptLongOutlinedIcon />} iconPosition="start" label="Recepción" />
        <Tab icon={<ScienceOutlinedIcon />} iconPosition="start" label="Calidad" />
        <Tab icon={<HistoryOutlinedIcon />} iconPosition="start" label="Historial" />
      </Tabs>

      {tab === 0 && <ReceptionDataTab reception={reception} />}
      {tab === 1 && <QualityTab reception={reception} capability={capabilities.resolverCalidad} />}
      {tab === 2 && <HistoryTab reception={reception} />}
    </Box>
  );
}

function DraftReception({ workspace, onBack }) {
  const [draft, setDraft] = useState(workspace.draftTemplate);
  const locations = workspace.catalogs.locations.filter((location) => location.scope === 'MATERIA_PRIMA');
  const expectedKg = Number(draft.receivedPackages || 0) * Number(draft.nominalKg || 0);
  const measuredKg = Number(draft.measuredNetKg || 0);
  const differenceKg = measuredKg - expectedKg;
  const allConform = draft.inspection.every((item) => item.status === 'CONFORME');

  const updateField = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const updateInspection = (id, checked) => setDraft((current) => ({
    ...current,
    inspection: current.inspection.map((item) => (
      item.id === id ? { ...item, status: checked ? 'CONFORME' : 'INCIDENCIA' } : item
    )),
  }));

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5} sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Tooltip title="Volver a recepciones" arrow>
            <IconButton aria-label="Volver a recepciones" onClick={onBack}><ArrowBackOutlinedIcon /></IconButton>
          </Tooltip>
          <Box>
            <Typography component="h1" variant="h5" sx={{ fontWeight: 800 }}>Nueva recepción de materia prima</Typography>
            <Typography variant="body2" color="text.secondary">Dataset canónico de US-010A para validación operativa</Typography>
          </Box>
        </Stack>
        <Chip data-testid="data-source" label="Datos mock" color="warning" variant="outlined" />
      </Stack>

      <Alert severity="info" icon={<Inventory2OutlinedIcon />} sx={{ mb: 2 }}>
        <strong>El borrador no afecta inventario.</strong> El lote interno y la existencia física solo aparecen después de una confirmación real.
      </Alert>

      <Paper variant="outlined" sx={{ borderRadius: 1, overflow: 'hidden' }}>
        <Box component="section" sx={{ p: { xs: 2, md: 3 } }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <ReceiptLongOutlinedIcon color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>1. Procedencia y documento</Typography>
          </Stack>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="Proveedor" size="small" value={`${draft.providerCode} · ${draft.providerName}`} onChange={() => {}} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField fullWidth label="Orden de compra" size="small" value={draft.purchaseOrder} onChange={(event) => updateField('purchaseOrder', event.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField fullWidth label="Guía de remisión" size="small" value={draft.documentNumber} onChange={(event) => updateField('documentNumber', event.target.value)} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography variant="caption" color="text.secondary">{draft.purchaseOrderLine}</Typography>
            </Grid>
          </Grid>
        </Box>

        <Divider />

        <Box component="section" sx={{ p: { xs: 2, md: 3 } }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <Inventory2OutlinedIcon color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>2. Material y lote</Typography>
          </Stack>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Material"
                onChange={(event) => {
                  const material = workspace.catalogs.materials.find((item) => item.id === event.target.value);
                  setDraft((current) => ({ ...current, materialId: material.id, materialName: material.name }));
                }}
                select
                size="small"
                value={draft.materialId}
              >
                {workspace.catalogs.materials.map((material) => (
                  <MenuItem key={material.id} value={material.id}>{material.id} · {material.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField fullWidth label="Lote del proveedor" size="small" value={draft.supplierLot} onChange={(event) => updateField('supplierLot', event.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField fullWidth label="Legibilidad" select size="small" value={draft.supplierLotStatus} onChange={(event) => updateField('supplierLotStatus', event.target.value)}>
                <MenuItem value="LEGIBLE">Legible</MenuItem>
                <MenuItem value="ILEGIBLE">Ilegible</MenuItem>
                <MenuItem value="AUSENTE">Ausente</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </Box>

        <Divider />

        <Box component="section" sx={{ p: { xs: 2, md: 3 } }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <ScaleOutlinedIcon color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>3. Conteo y pesaje</Typography>
          </Stack>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField fullWidth label="Envases documentados" size="small" type="number" value={draft.documentedPackages} onChange={(event) => updateField('documentedPackages', event.target.value)} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField fullWidth label="Envases recibidos" size="small" type="number" value={draft.receivedPackages} onChange={(event) => updateField('receivedPackages', event.target.value)} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                fullWidth
                label="Peso nominal"
                size="small"
                type="number"
                value={draft.nominalKg}
                onChange={(event) => updateField('nominalKg', event.target.value)}
                slotProps={{ input: { endAdornment: <InputAdornment position="end">kg</InputAdornment> } }}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                error={measuredKg <= 0}
                fullWidth
                helperText={measuredKg <= 0 ? 'Debe ser mayor que cero' : 'Peso que aumentaría el inventario'}
                label="Peso neto medido"
                size="small"
                type="number"
                value={draft.measuredNetKg}
                onChange={(event) => updateField('measuredNetKg', event.target.value)}
                slotProps={{ input: { endAdornment: <InputAdornment position="end">kg</InputAdornment> } }}
              />
            </Grid>
          </Grid>

          <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12, sm: 4 }}><Metric label="Peso esperado" value={formatKg(expectedKg)} detail="Envases recibidos × peso nominal" accent="#1E3A5F" testId="expected-weight" /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><Metric label="Neto medido" value={formatKg(measuredKg)} detail="Hecho físico conservado" accent="#2E7D32" testId="measured-weight" /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><Metric label="Diferencia" value={formatKg(differenceKg)} detail="Sin política activa: no se clasifica como merma" accent="#A55C16" testId="weight-difference" /></Grid>
          </Grid>
        </Box>

        <Divider />

        <Box component="section" sx={{ p: { xs: 2, md: 3 } }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <WarehouseOutlinedIcon color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>4. Inspección y ubicación</Typography>
          </Stack>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 5 }}>
              <TextField
                fullWidth
                label="Ubicación inicial"
                onChange={(event) => updateField('locationId', event.target.value)}
                select
                size="small"
                value={draft.locationId}
              >
                {locations.map((location) => (
                  <MenuItem key={location.id} value={location.id}>{location.name}</MenuItem>
                ))}
              </TextField>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                Solo ubicaciones activas compatibles con MATERIA_PRIMA.
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <Grid container>
                {draft.inspection.map((item) => (
                  <Grid key={item.id} size={{ xs: 12, sm: 6 }}>
                    <FormControlLabel
                      control={(
                        <Checkbox
                          checked={item.status === 'CONFORME'}
                          onChange={(event) => updateInspection(item.id, event.target.checked)}
                        />
                      )}
                      label={<Typography variant="body2">{item.label}</Typography>}
                    />
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
          {!allConform && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              La inspección tiene incidencias. El material deberá permanecer no disponible a la espera de Calidad.
            </Alert>
          )}
        </Box>

        <Divider />

        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5} sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Responsable: {draft.receiver} · el lote interno aún no existe
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <ApiPendingButton label="Guardar borrador" capability={workspace.capabilities.guardarBorrador} />
            <ApiPendingButton label="Confirmar recepción" capability={workspace.capabilities.confirmarRecepcion} />
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}

function RecepcionMateriales() {
  const navigate = useNavigate();
  const location = useLocation();
  const { recepcionId } = useParams();
  const [workspace, setWorkspace] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    obtenerRecepcionMateriales()
      .then((data) => {
        if (active) setWorkspace(data);
      })
      .catch(() => {
        if (active) setError('No fue posible cargar las recepciones de materia prima.');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!workspace) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 420 }} spacing={1.5}>
        <CircularProgress size={32} />
        <Typography variant="body2" color="text.secondary">Cargando recepciones...</Typography>
      </Stack>
    );
  }

  if (location.pathname.endsWith('/nueva')) {
    return <DraftReception workspace={workspace} onBack={() => navigate('/materiales/recepciones')} />;
  }

  const selected = workspace.receptions.find((reception) => reception.id === recepcionId)
    || workspace.receptions[0];
  const confirmed = workspace.receptions.filter((reception) => reception.state === 'CONFIRMADA');
  const physicalTotal = confirmed.reduce((sum, reception) => sum + reception.physicalKg, 0);
  const availableTotal = confirmed.reduce((sum, reception) => sum + reception.availableKg, 0);
  const pendingCount = confirmed.filter((reception) => ['PENDIENTE', 'PARCIAL'].includes(reception.qualitySummary)).length;
  const holdCount = confirmed.filter((reception) => reception.documentaryHold.active).length;

  return (
    <Box sx={{ maxWidth: 1600, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5} sx={{ mb: 2 }}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
            <Typography component="h1" variant="h5" sx={{ fontWeight: 800 }}>Recepción de materias primas</Typography>
            <Chip data-testid="data-source" label={RECEPCION_MATERIALES_SOURCE === 'MOCK' ? 'Datos mock' : 'API'} color="warning" variant="outlined" size="small" />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Recepción física, cuarentena, Calidad y disponibilidad sin mezclar sus estados
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => navigate('/materiales/recepciones/nueva')}>
          Nueva recepción
        </Button>
      </Stack>

      <Grid
        container
        spacing={1.5}
        sx={{ mb: 2, display: { xs: recepcionId ? 'none' : 'flex', sm: 'flex' } }}
      >
        <Grid size={{ xs: 6, lg: 3 }}><Metric label="Existencia recibida" value={formatKg(physicalTotal)} detail={`${confirmed.length} recepciones confirmadas`} accent="#1E3A5F" /></Grid>
        <Grid size={{ xs: 6, lg: 3 }}><Metric label="Disponible para producción" value={formatKg(availableTotal)} detail="Calidad + documentos + ubicación" accent="#2E7D32" /></Grid>
        <Grid size={{ xs: 6, lg: 3 }}><Metric label="Con revisión pendiente" value={pendingCount} detail="Incluye resoluciones parciales" accent="#ED9C24" /></Grid>
        <Grid size={{ xs: 6, lg: 3 }}><Metric label="Retención documental" value={holdCount} detail="Stock físico no disponible" accent="#C62828" /></Grid>
      </Grid>

      <Paper
        variant="outlined"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(340px, 0.78fr) minmax(0, 1.5fr)' },
          overflow: 'hidden',
          borderRadius: 1,
        }}
      >
        <Box sx={{ display: { xs: recepcionId ? 'none' : 'block', lg: 'block' }, minWidth: 0 }}>
          <ReceptionQueue
            receptions={workspace.receptions}
            selectedId={selected.id}
            onSelect={(id) => navigate(`/materiales/recepciones/${id}`)}
          />
        </Box>
        <Box sx={{ display: { xs: recepcionId ? 'block' : 'none', lg: 'block' }, minWidth: 0 }}>
          <ReceptionDetail
            key={selected.id}
            reception={selected}
            capabilities={workspace.capabilities}
            onBack={() => navigate('/materiales/recepciones')}
          />
        </Box>
      </Paper>
    </Box>
  );
}

export default RecepcionMateriales;
