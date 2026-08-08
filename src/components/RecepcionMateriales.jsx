import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
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
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ScaleOutlinedIcon from '@mui/icons-material/ScaleOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import {
  obtenerRecepcionMateriales,
  RECEPCION_MATERIALES_SOURCE,
} from '../services/recepcionMateriales';
import {
  CatalogManagementPanel,
  CoveragePanel,
  DocumentsOperationsPanel,
  InventoryOperationsPanel,
} from './Us10aOperations';
import DataTableToolbar from './ui/DataTableToolbar';
import PageHeader from './ui/PageHeader';
import { matchesOmniSearch } from '../utils/tableSearch';

const kgFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

const formatKg = (value) => `${kgFormatter.format(Number(value || 0))} kg`;
const roundKg = (value) => Math.round(Number(value || 0) * 1000) / 1000;

const modeCopy = {
  VIRGEN_CONFIANZA_PROVEEDOR: {
    label: 'Virgen · documento + conteo',
    short: 'Documento + conteo',
    color: 'info',
  },
  SEGUNDA_PESAJE_BOLSA: {
    label: 'Segunda · pesaje bolsa por bolsa',
    short: 'Pesaje por bolsa',
    color: 'secondary',
  },
  POR_CONFIGURAR: {
    label: 'Por configurar',
    short: 'Por configurar',
    color: 'default',
  },
};

const qualityCopy = {
  PENDIENTE: { label: 'Pendiente de Calidad', color: 'warning' },
  PARCIAL: { label: 'Liberación parcial', color: 'info' },
  LIBERADO: { label: 'Liberado', color: 'success' },
  BLOQUEADO: { label: 'Bloqueado', color: 'error' },
  RECHAZADO: { label: 'Rechazado', color: 'error' },
  SIN_EVALUAR: { label: 'Borrador', color: 'default' },
};

function Metric({ label, value, detail, accent = '#1E3A5F', testId }) {
  return (
    <Paper variant="outlined" sx={{ height: '100%', minHeight: 92, p: 1.75, borderLeft: `4px solid ${accent}` }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography data-testid={testId} variant="h6" sx={{ fontWeight: 800, my: 0.25 }}>{value}</Typography>
      {detail && <Typography variant="caption" color="text.secondary">{detail}</Typography>}
    </Paper>
  );
}

function FieldValue({ label, children }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{children || 'No registrado'}</Typography>
    </Box>
  );
}

function LocalPrototypeBanner() {
  return (
    <Alert
      icon={<LockOutlinedIcon />}
      severity="info"
      sx={{ border: '1px solid #90CAF9', bgcolor: '#F4FAFF' }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={0.5}>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 800 }}>Prototipo local · TS-010A</Typography>
          <Typography variant="caption">Datos mock en memoria. No realiza llamadas HTTP ni toca una base de datos.</Typography>
        </Box>
        <Chip data-testid="data-source" size="small" label="MOCK LOCAL · se reinicia al recargar" color="info" variant="outlined" />
      </Stack>
    </Alert>
  );
}

function ReceptionQueue({ receptions, selectedId, onSelect, onNew }) {
  const [search, setSearch] = useState('');
  const [qualityFilter, setQualityFilter] = useState('TODOS');
  const [modeFilter, setModeFilter] = useState('TODOS');
  const filtered = receptions.filter((item) => (
    (qualityFilter === 'TODOS' || item.qualitySummary === qualityFilter)
    && (modeFilter === 'TODOS' || item.mode === modeFilter)
    && matchesOmniSearch(item, search)
  ));

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden', height: '100%' }}>
      <Typography variant="subtitle1" sx={{ px: 2, pt: 2, fontWeight: 800 }}>Bandeja de recepciones</Typography>
      <DataTableToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar recepción, proveedor, material o documento"
        resultCount={filtered.length}
        totalCount={receptions.length}
        filters={[
          {
            id: 'quality',
            label: 'Calidad',
            value: qualityFilter,
            onChange: setQualityFilter,
            options: [
              { value: 'TODOS', label: 'Todos' },
              ...Object.entries(qualityCopy).map(([value, config]) => ({ value, label: config.label })),
            ],
          },
          {
            id: 'mode',
            label: 'Modalidad',
            value: modeFilter,
            onChange: setModeFilter,
            options: [
              { value: 'TODOS', label: 'Todas' },
              ...Object.entries(modeCopy).map(([value, config]) => ({ value, label: config.short })),
            ],
          },
        ]}
        onClear={() => {
          setSearch('');
          setQualityFilter('TODOS');
          setModeFilter('TODOS');
        }}
        actions={<Button size="small" startIcon={<AddOutlinedIcon />} onClick={onNew}>Nueva</Button>}
        sx={{ border: 0, borderBottom: '1px solid', borderColor: 'divider', borderRadius: 0 }}
      />
      <List disablePadding sx={{ maxHeight: 710, overflowY: 'auto' }}>
        {filtered.map((reception) => {
          const quality = qualityCopy[reception.qualitySummary] || qualityCopy.SIN_EVALUAR;
          return (
            <ListItemButton
              data-testid={`reception-row-${reception.id}`}
              key={reception.id}
              selected={selectedId === reception.id}
              onClick={() => onSelect(reception.id)}
              sx={{ py: 1.6, borderBottom: '1px solid #EEEEEE', '&.Mui-selected': { bgcolor: '#EDF4FA', boxShadow: 'inset 3px 0 #1E3A5F' } }}
            >
              <Stack width="100%" spacing={0.65}>
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <Typography variant="body2" sx={{ fontWeight: 850 }}>{reception.id}</Typography>
                  <Chip size="small" label={quality.label} color={quality.color} />
                </Stack>
                <Typography variant="body2" noWrap>{reception.providerName}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap>{reception.materialName} · {reception.documentNumber}</Typography>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" sx={{ fontWeight: 750 }}>{formatKg(reception.physicalKg)}</Typography>
                  <Chip size="small" variant="outlined" label={modeCopy[reception.mode]?.short || reception.mode} />
                </Stack>
              </Stack>
            </ListItemButton>
          );
        })}
        {filtered.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">No hay recepciones que coincidan con los filtros.</Typography>
          </Box>
        )}
      </List>
    </Paper>
  );
}

function QuantityPanel({ reception }) {
  const packaging = reception.packaging;
  const isVirgin = reception.mode === 'VIRGEN_CONFIANZA_PROVEEDOR';
  return (
    <Stack spacing={2}>
      <Alert severity={isVirgin ? 'info' : 'warning'}>
        <Typography variant="body2" sx={{ fontWeight: 800 }}>{modeCopy[reception.mode]?.label}</Typography>
        <Typography variant="caption">
          {isVirgin
            ? 'El inventario usa el documento porque el conteo coincide. EnvaPerú no afirma haber pesado esta entrega.'
            : 'El inventario usa la suma de pesos transcritos. La diferencia documental queda visible como SIN_POLITICA.'}
        </Typography>
      </Alert>
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 6, md: 3 }}><Metric label="Cantidad documental" value={formatKg(packaging.documentedKg)} accent="#607D8B" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Metric label="Peso interno" value={isVirgin ? 'No medido' : formatKg(packaging.measuredNetKg)} accent={isVirgin ? '#0288D1' : '#7B1FA2'} testId="internal-weight" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Metric label="Cantidad aceptada" value={formatKg(packaging.acceptedKg)} accent="#2E7D32" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Metric label="Diferencia" value={packaging.differenceKg == null ? 'No calculada' : formatKg(packaging.differenceKg)} accent="#F57C00" /></Grid>
      </Grid>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label="Autoridad de cantidad">
          <TableHead><TableRow sx={{ bgcolor: '#F4F6F8' }}><TableCell>Fuente</TableCell><TableCell>Bolsas doc.</TableCell><TableCell>Bolsas recibidas</TableCell><TableCell>Peso nominal</TableCell><TableCell>Resultado</TableCell></TableRow></TableHead>
          <TableBody><TableRow>
            <TableCell><Chip size="small" label={reception.quantitySource.replaceAll('_', ' ')} /></TableCell>
            <TableCell>{packaging.documentedPackages}</TableCell>
            <TableCell>{packaging.receivedPackages}</TableCell>
            <TableCell>{packaging.nominalKg == null ? 'Variable' : formatKg(packaging.nominalKg)}</TableCell>
            <TableCell>{packaging.toleranceStatus.replaceAll('_', ' ')}</TableCell>
          </TableRow></TableBody>
        </Table>
      </TableContainer>
      {packaging.bagWeights && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="Pesos por bolsa">
            <TableHead><TableRow sx={{ bgcolor: '#F4F6F8' }}><TableCell>Bolsa</TableCell><TableCell align="right">Peso manual</TableCell><TableCell>Balanza</TableCell></TableRow></TableHead>
            <TableBody>{packaging.bagWeights.map((weight, index) => (
              <TableRow key={`${reception.id}-${index}`}><TableCell>Bolsa {index + 1}</TableCell><TableCell align="right">{formatKg(weight)}</TableCell><TableCell>{packaging.scaleCode}</TableCell></TableRow>
            ))}</TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}

function ReceiptData({ reception }) {
  return (
    <Stack spacing={2.5} sx={{ p: { xs: 1.5, md: 2.5 } }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}><FieldValue label="Proveedor">{reception.providerCode} · {reception.providerName}</FieldValue></Grid>
        <Grid size={{ xs: 6, sm: 3 }}><FieldValue label="Documento">{reception.documentNumber}</FieldValue></Grid>
        <Grid size={{ xs: 6, sm: 3 }}><FieldValue label="Orden interna">{reception.purchaseOrder}</FieldValue></Grid>
        <Grid size={{ xs: 12, sm: 6 }}><FieldValue label="Material">{reception.materialCode} · {reception.materialName}</FieldValue></Grid>
        <Grid size={{ xs: 6, sm: 3 }}><FieldValue label="Lote interno">{reception.internalLot}</FieldValue></Grid>
        <Grid size={{ xs: 6, sm: 3 }}><FieldValue label="Lote proveedor">{reception.supplierLot || `${reception.supplierLotStatus} · no inventado`}</FieldValue></Grid>
      </Grid>
      <Divider />
      <QuantityPanel reception={reception} />
      <Divider />
      <Box>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
          <FactCheckOutlinedIcon color="success" />
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Inspección mínima</Typography>
        </Stack>
        <Grid container spacing={1}>
          {reception.inspection.map((item) => (
            <Grid key={item.id} size={{ xs: 12, sm: 6 }}>
              <Stack direction="row" spacing={1}><CheckCircleOutlineIcon color="success" fontSize="small" /><Typography variant="body2">{item.label}</Typography></Stack>
            </Grid>
          ))}
        </Grid>
      </Box>
      <Divider />
      <Box>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}><AttachFileOutlinedIcon color="primary" /><Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Evidencias vinculadas</Typography></Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
          {reception.evidence.map((evidence) => <Chip key={evidence.id} icon={<AttachFileOutlinedIcon />} label={evidence.name} variant="outlined" />)}
        </Stack>
      </Box>
    </Stack>
  );
}

function QualityPanel({ reception }) {
  const totals = reception.allocations.reduce((acc, row) => ({ ...acc, [row.status]: (acc[row.status] || 0) + row.quantityKg }), {});
  return (
    <Stack spacing={2} sx={{ p: { xs: 1.5, md: 2.5 } }}>
      <Alert severity="info">La decisión de Calidad reclasifica cantidades; no cambia la procedencia ni el total físico.</Alert>
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 6, md: 3 }}><Metric label="Físico" value={formatKg(reception.physicalKg)} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Metric label="Liberado" value={formatKg(totals.LIBERADO)} accent="#2E7D32" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Metric label="Pendiente" value={formatKg(totals.PENDIENTE)} accent="#F57C00" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Metric label="Disponible" value={formatKg(reception.availableKg)} accent="#0288D1" /></Grid>
      </Grid>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small"><TableHead><TableRow sx={{ bgcolor: '#F4F6F8' }}><TableCell>Estado</TableCell><TableCell align="right">Cantidad</TableCell><TableCell>Ubicación</TableCell><TableCell>Responsable</TableCell></TableRow></TableHead>
          <TableBody>{reception.allocations.map((row) => <TableRow key={row.id}><TableCell><Chip size="small" label={row.status} /></TableCell><TableCell align="right">{formatKg(row.quantityKg)}</TableCell><TableCell>{row.locationId}</TableCell><TableCell>{row.decidedBy || 'Pendiente'}</TableCell></TableRow>)}</TableBody>
        </Table>
      </TableContainer>
      <Button disabled variant="contained">Registrar decisión · API pendiente</Button>
    </Stack>
  );
}

function TracePanel({ reception }) {
  const lineage = [reception.materialCode, reception.internalLot, reception.documentNumber, reception.purchaseOrder, reception.providerCode].filter(Boolean);
  return (
    <Stack spacing={2} sx={{ p: { xs: 1.5, md: 2.5 } }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Genealogía hacia el proveedor</Typography>
      <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75} alignItems="center">
        {lineage.map((item, index) => <Box key={item} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><Chip label={item} color={index === 1 ? 'primary' : 'default'} />{index < lineage.length - 1 && <Typography color="text.secondary">←</Typography>}</Box>)}
      </Stack>
      <Divider />
      {reception.events.map((event) => (
        <Paper key={event.id} variant="outlined" sx={{ p: 1.5, borderLeft: '4px solid #1E3A5F' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
            <Box><Typography variant="body2" sx={{ fontWeight: 800 }}>{event.type.replaceAll('_', ' ')}</Typography><Typography variant="body2">{event.detail}</Typography></Box>
            <Box sx={{ textAlign: { sm: 'right' } }}><Typography variant="caption" color="text.secondary">{event.time}</Typography><Typography variant="caption" display="block">{event.actor}</Typography></Box>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

function ReceptionDetail({ reception, onBack, onEdit }) {
  const [tab, setTab] = useState(0);
  const quality = qualityCopy[reception.qualitySummary] || qualityCopy.SIN_EVALUAR;
  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <Stack spacing={1.5} sx={{ p: 2, bgcolor: '#FAFBFC', borderBottom: '1px solid #E0E0E0' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton onClick={onBack} sx={{ display: { lg: 'none' } }}><ArrowBackOutlinedIcon /></IconButton>
          <Box flex={1}><Typography variant="overline" color="text.secondary">{reception.id}</Typography><Typography variant="h5" sx={{ fontWeight: 850 }}>{reception.materialName}</Typography></Box>
          <Stack alignItems="flex-end" spacing={0.5}><Chip label={reception.state === 'RECHAZADA_PRE_CUSTODIA' ? 'RECHAZADA SIN CUSTODIA' : quality.label} color={reception.state === 'RECHAZADA_PRE_CUSTODIA' ? 'error' : quality.color} />{reception.state === 'BORRADOR' && <Button size="small" variant="outlined" onClick={onEdit}>Editar borrador</Button>}</Stack>
        </Stack>
        <Grid container spacing={1.25}>
          <Grid size={{ xs: 6, md: 3 }}><Metric label="Existencia física" value={formatKg(reception.physicalKg)} testId="physical-total" /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><Metric label="Disponible" value={formatKg(reception.availableKg)} accent="#2E7D32" testId="available-total" /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><Metric label="Ubicación" value={reception.locationId} detail={reception.locationName} accent="#0288D1" testId="current-location" /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><Metric label="Autoridad" value={modeCopy[reception.mode]?.short} detail={reception.quantitySource.replaceAll('_', ' ')} accent="#7B1FA2" /></Grid>
        </Grid>
      </Stack>
      <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto">
        <Tab icon={<ReceiptLongOutlinedIcon />} iconPosition="start" label="Recepción" />
        <Tab icon={<FactCheckOutlinedIcon />} iconPosition="start" label="Calidad" />
        <Tab icon={<HistoryOutlinedIcon />} iconPosition="start" label="Trazabilidad" />
      </Tabs>
      <Divider />
      {tab === 0 && <ReceiptData reception={reception} />}
      {tab === 1 && <QualityPanel reception={reception} />}
      {tab === 2 && <TracePanel reception={reception} />}
    </Paper>
  );
}

function BagWeightEditor({ weights, onChange }) {
  const update = (index, value) => onChange(weights.map((weight, rowIndex) => rowIndex === index ? Number(value) : weight));
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" aria-label="Editar pesos por bolsa">
        <TableHead><TableRow sx={{ bgcolor: '#F4F6F8' }}><TableCell>Bolsa</TableCell><TableCell>Peso manual</TableCell><TableCell width={50} /></TableRow></TableHead>
        <TableBody>{weights.map((weight, index) => (
          <TableRow key={`bag-${index}`}>
            <TableCell>Bolsa {index + 1}</TableCell>
            <TableCell><TextField aria-label={`Peso bolsa ${index + 1}`} size="small" type="number" value={weight} onChange={(event) => update(index, event.target.value)} slotProps={{ input: { endAdornment: <InputAdornment position="end">kg</InputAdornment> } }} /></TableCell>
            <TableCell><Tooltip title="Quitar bolsa"><IconButton aria-label={`Quitar bolsa ${index + 1}`} onClick={() => onChange(weights.filter((_, rowIndex) => rowIndex !== index))}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip></TableCell>
          </TableRow>
        ))}</TableBody>
      </Table>
      <Button sx={{ m: 1 }} size="small" startIcon={<AddOutlinedIcon />} onClick={() => onChange([...weights, 0])}>Agregar bolsa</Button>
    </TableContainer>
  );
}

function ReceptionDraft({ workspace, onBack, onCommit, initialReception = null }) {
  const initialMode = initialReception?.mode || 'VIRGEN_CONFIANZA_PROVEEDOR';
  const initialDraft = initialReception ? {
    ...structuredClone(workspace.draftTemplates[initialMode]),
    providerId: workspace.providers.find((item) => item.code === initialReception.providerCode)?.id || 1,
    purchaseOrderId: initialReception.purchaseOrder || '',
    materialId: workspace.materials.find((item) => item.code === initialReception.materialCode)?.id || 1,
    documentType: initialReception.documentType,
    documentNumber: initialReception.documentNumber,
    documentedPackages: initialReception.packaging.documentedPackages,
    receivedPackages: initialReception.packaging.receivedPackages,
    documentedKg: initialReception.packaging.documentedKg,
    nominalKg: initialReception.packaging.nominalKg,
    bagWeights: initialReception.packaging.bagWeights || [],
    locationId: initialReception.locationId,
    supplierLotStatus: initialReception.supplierLotStatus,
    supplierLot: initialReception.supplierLot || '',
    evidenceTypeIds: initialReception.evidence.map((item) => item.type),
  } : structuredClone(workspace.draftTemplates.VIRGEN_CONFIANZA_PROVEEDOR);
  const [mode, setMode] = useState(initialMode);
  const [draft, setDraft] = useState(initialDraft);
  const [intakeType, setIntakeType] = useState(initialReception?.isExceptional ? 'EXCEPCIONAL' : 'ORDINARIA');
  const [managementDecision, setManagementDecision] = useState('');
  const [message, setMessage] = useState('');

  const switchMode = (value) => {
    setMode(value);
    setDraft(structuredClone(workspace.draftTemplates[value]));
    setMessage('');
  };
  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const measuredKg = roundKg((draft.bagWeights || []).reduce((sum, value) => sum + Number(value || 0), 0));
  const countMatches = Number(draft.documentedPackages) === Number(draft.receivedPackages);
  const acceptedKg = mode === 'VIRGEN_CONFIANZA_PROVEEDOR'
    ? (countMatches ? Number(draft.documentedKg) : Number(draft.receivedPackages) * Number(draft.nominalKg))
    : measuredKg;
  const differenceKg = mode === 'SEGUNDA_PESAJE_BOLSA' ? roundKg(measuredKg - Number(draft.documentedKg)) : null;
  const selectedMaterial = workspace.materials.find((item) => item.id === Number(draft.materialId));

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton onClick={onBack}><ArrowBackOutlinedIcon /></IconButton>
        <Box><Typography variant="h5" sx={{ fontWeight: 850 }}>{initialReception ? `Editar ${initialReception.id}` : 'Nueva recepción de materia prima'}</Typography><Typography variant="body2" color="text.secondary">CRUD mock en memoria; confirmar crea lote y saldos locales</Typography></Box>
      </Stack>
      {message && <Alert severity="success" onClose={() => setMessage('')}>{message}</Alert>}
      <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2.5 } }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>1. Modalidad de cantidad</Typography>
            <TextField fullWidth select label="Regla que gobierna el inventario" value={mode} onChange={(event) => switchMode(event.target.value)}>
              <MenuItem value="VIRGEN_CONFIANZA_PROVEEDOR">Virgen · confiar en documento si coincide el conteo</MenuItem>
              <MenuItem value="SEGUNDA_PESAJE_BOLSA">Segunda · sumar peso manual de cada bolsa</MenuItem>
            </TextField>
          </Box>
          <Alert severity={mode === 'VIRGEN_CONFIANZA_PROVEEDOR' ? 'info' : 'warning'}>
            {mode === 'VIRGEN_CONFIANZA_PROVEEDOR'
              ? 'No se solicita peso interno. Si el conteo no coincide, Gerencia debe decidir antes de confirmar.'
              : 'Cada bolsa se registra por separado. La suma medida aumenta inventario y la diferencia queda SIN_POLITICA.'}
          </Alert>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>2. Procedencia y documento</Typography>
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth select label="Tipo de ingreso" value={intakeType} onChange={(event) => setIntakeType(event.target.value)}><MenuItem value="ORDINARIA">Ordinaria · exige OC aprobada</MenuItem><MenuItem value="EXCEPCIONAL">Excepcional · queda retenida</MenuItem></TextField></Grid>
              <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth select label="Proveedor" value={draft.providerId} onChange={(event) => update('providerId', Number(event.target.value))}>{workspace.providers.map((item) => <MenuItem key={item.id} value={item.id}>{item.code} · {item.name}</MenuItem>)}</TextField></Grid>
              <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth select disabled={intakeType === 'EXCEPCIONAL'} label="Orden de compra aprobada" value={intakeType === 'EXCEPCIONAL' ? '' : draft.purchaseOrderId} onChange={(event) => update('purchaseOrderId', event.target.value)}><MenuItem value="">Sin orden</MenuItem>{workspace.purchaseOrders.filter((item) => item.status === 'APROBADA').map((item) => <MenuItem key={item.id} value={item.id}>{item.id} · {item.providerName}</MenuItem>)}</TextField></Grid>
              <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth select label="Material" value={draft.materialId} onChange={(event) => update('materialId', Number(event.target.value))}>{workspace.materials.filter((item) => workspace.categoryRules.find((rule) => rule.id === item.categoryId)?.enabled).map((item) => <MenuItem key={item.id} value={item.id}>{item.code} · {item.name}</MenuItem>)}</TextField></Grid>
              <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth label="Tipo documento" value={draft.documentType} onChange={(event) => update('documentType', event.target.value)} /></Grid>
              <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth label="Número documento" value={draft.documentNumber} onChange={(event) => update('documentNumber', event.target.value)} /></Grid>
            </Grid>
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>3. Conteo y cantidad</Typography>
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 6, md: 3 }}><TextField fullWidth type="number" label="Bolsas documentadas" value={draft.documentedPackages} onChange={(event) => update('documentedPackages', Number(event.target.value))} /></Grid>
              <Grid size={{ xs: 6, md: 3 }}><TextField fullWidth type="number" label="Bolsas recibidas" value={draft.receivedPackages} onChange={(event) => update('receivedPackages', Number(event.target.value))} /></Grid>
              <Grid size={{ xs: 6, md: 3 }}><TextField fullWidth type="number" label="Cantidad documental" value={draft.documentedKg} onChange={(event) => update('documentedKg', Number(event.target.value))} slotProps={{ input: { endAdornment: <InputAdornment position="end">kg</InputAdornment> } }} /></Grid>
              <Grid size={{ xs: 6, md: 3 }}><TextField fullWidth type="number" disabled={mode !== 'VIRGEN_CONFIANZA_PROVEEDOR'} label="Peso nominal bolsa" value={draft.nominalKg ?? ''} onChange={(event) => update('nominalKg', Number(event.target.value))} slotProps={{ input: { endAdornment: <InputAdornment position="end">kg</InputAdornment> } }} /></Grid>
            </Grid>
          </Box>
          {mode === 'SEGUNDA_PESAJE_BOLSA' && <Box><Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}><ScaleOutlinedIcon color="secondary" /><Typography variant="subtitle1" sx={{ fontWeight: 800 }}>4. Pesaje manual bolsa por bolsa</Typography></Stack><BagWeightEditor weights={draft.bagWeights} onChange={(weights) => update('bagWeights', weights)} /></Box>}
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 4 }}><Metric label="Peso interno" value={mode === 'VIRGEN_CONFIANZA_PROVEEDOR' ? 'NO MEDIDO' : formatKg(measuredKg)} accent="#7B1FA2" testId="draft-internal-weight" /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><Metric label="Cantidad que gobernaría inventario" value={formatKg(acceptedKg)} detail={modeCopy[mode].short} accent="#2E7D32" testId="accepted-weight" /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><Metric label="Diferencia documental" value={differenceKg == null ? 'No aplica sin pesaje' : formatKg(differenceKg)} detail={differenceKg == null ? 'No se finge una medición' : 'SIN_POLITICA'} accent="#F57C00" testId="weight-difference" /></Grid>
          </Grid>
          {!countMatches && mode === 'VIRGEN_CONFIANZA_PROVEEDOR' && <Alert severity="error" icon={<WarningAmberOutlinedIcon />}><Stack spacing={1}><Typography variant="body2">Conteo discrepante. Gerencia debe decidir antes de confirmar.</Typography><TextField size="small" select label="Decisión de Gerencia" value={managementDecision} onChange={(event) => setManagementDecision(event.target.value)}><MenuItem value="ACEPTAR_DOCUMENTO">Aceptar cantidad documental</MenuItem><MenuItem value="ACEPTAR_CONTEO">Aceptar conteo nominal</MenuItem><MenuItem value="RECHAZAR">Rechazar antes de custodia</MenuItem></TextField></Stack></Alert>}
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>5. Evidencia y destino</Typography>
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth select label="Ubicación inicial" value={draft.locationId} onChange={(event) => update('locationId', event.target.value)}>{workspace.locations.filter((item) => item.active && item.scope === 'MATERIA_PRIMA').map((item) => <MenuItem key={item.id} value={item.id}>{item.id} · {item.name}</MenuItem>)}</TextField></Grid>
              <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth select label="Responsable de recepción" value={draft.receiverId} onChange={(event) => update('receiverId', event.target.value)}>{workspace.participants.filter((item) => item.active && item.capabilities.includes('RECEPCION_CONFIRMAR')).map((item) => <MenuItem key={item.id} value={item.id}>{item.id} · {item.name}</MenuItem>)}</TextField></Grid>
              <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth select label="Estado lote proveedor" value={draft.supplierLotStatus} onChange={(event) => update('supplierLotStatus', event.target.value)}><MenuItem value="INFORMADO">Informado</MenuItem><MenuItem value="NO_INFORMADO">No informado</MenuItem><MenuItem value="ILEGIBLE">Ilegible</MenuItem></TextField></Grid>
              <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth disabled={draft.supplierLotStatus !== 'INFORMADO'} label="Lote proveedor" value={draft.supplierLot || ''} onChange={(event) => update('supplierLot', event.target.value)} /></Grid>
            </Grid>
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ mt: 1.5 }}>
              {draft.evidenceTypeIds.map((id) => <Chip key={id} icon={<AttachFileOutlinedIcon />} label={`${workspace.evidenceTypes.find((item) => item.id === id)?.name} · mock`} color="info" variant="outlined" />)}
            </Stack>
          </Box>
          <Divider />
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1} alignItems={{ sm: 'center' }}>
            <Typography variant="caption" color="text.secondary">Material: {selectedMaterial?.name}. Toda acción se pierde al recargar.</Typography>
            <Stack direction="row" spacing={1}>
              <Button color="error" onClick={() => onCommit('REJECT', { draft, mode, intakeType, measuredKg, acceptedKg, differenceKg, managementDecision, existingId: initialReception?.id })}>Rechazar sin custodia</Button>
              <Button variant="outlined" onClick={() => onCommit('SAVE', { draft, mode, intakeType, measuredKg, acceptedKg, differenceKg, managementDecision, existingId: initialReception?.id })}>Guardar borrador local</Button>
              <Button variant="contained" disabled={(!countMatches && mode === 'VIRGEN_CONFIANZA_PROVEEDOR' && !managementDecision) || (intakeType === 'ORDINARIA' && !draft.purchaseOrderId)} onClick={() => onCommit(managementDecision === 'RECHAZAR' ? 'REJECT' : 'CONFIRM', { draft, mode, intakeType, measuredKg, acceptedKg: managementDecision === 'ACEPTAR_DOCUMENTO' ? Number(draft.documentedKg) : acceptedKg, differenceKg, managementDecision, existingId: initialReception?.id })}>Confirmar y crear lote mock</Button>
            </Stack>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}

const purchaseOrderStatusColor = (status) => ({
  APROBADA: 'success',
  PENDIENTE_APROBACION: 'warning',
  CANCELADA: 'error',
}[status] || 'default');

function PurchaseOrderForm({ initialOrder, workspace, onSave, onCancel }) {
  const enabledMaterials = workspace.materials.filter((material) => (
    workspace.categoryRules.find((rule) => rule.id === material.categoryId)?.enabled
  ));
  const [providerId, setProviderId] = useState(initialOrder?.providerId || workspace.providers[0]?.id || '');
  const [lines, setLines] = useState(() => (
    initialOrder?.lines.map((line) => ({ ...line })) || [{
      id: Date.now(),
      materialCode: enabledMaterials[0]?.code || '',
      authorizedKg: 2500,
      receivedKg: 0,
    }]
  ));
  const [error, setError] = useState('');
  const editing = Boolean(initialOrder);

  const updateLine = (id, field, value) => setLines((current) => current.map((line) => (
    line.id === id ? { ...line, [field]: value } : line
  )));
  const addLine = () => setLines((current) => [...current, {
    id: Date.now() + current.length,
    materialCode: enabledMaterials[0]?.code || '',
    authorizedKg: 1000,
    receivedKg: 0,
  }]);
  const removeLine = (id) => setLines((current) => current.filter((line) => line.id !== id));
  const submit = () => {
    const invalidLine = lines.some((line) => !line.materialCode || Number(line.authorizedKg) <= 0 || Number(line.authorizedKg) < Number(line.receivedKg || 0));
    if (!providerId || !lines.length || invalidLine) {
      setError('Selecciona un proveedor y registra al menos una línea válida. Lo autorizado no puede ser menor que lo ya recibido.');
      return;
    }
    const provider = workspace.providers.find((item) => item.id === Number(providerId));
    onSave({
      ...(initialOrder || {}),
      providerId: Number(providerId),
      providerName: provider?.name || 'Proveedor sin nombre',
      lines: lines.map((line) => {
        const material = workspace.materials.find((item) => item.code === line.materialCode);
        const authorizedKg = roundKg(line.authorizedKg);
        const receivedKg = roundKg(line.receivedKg);
        return {
          ...line,
          materialCode: material?.code || line.materialCode,
          materialName: material?.name || line.materialName,
          authorizedKg,
          receivedKg,
          balanceKg: roundKg(authorizedKg - receivedKg),
        };
      }),
    });
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2.5 } }} data-testid="purchase-order-form">
      <Stack spacing={2}>
        <Box>
          <Typography variant="overline" color="primary">CRUD mock · {editing ? `Edición ${initialOrder.id}` : 'Alta local'}</Typography>
          <Typography variant="h5" sx={{ fontWeight: 850 }}>{editing ? 'Editar borrador' : 'Crear orden de compra'}</Typography>
          <Typography variant="body2" color="text.secondary">Los cambios viven únicamente en memoria y se pierden al recargar.</Typography>
        </Box>
        {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
        <TextField select fullWidth label="Proveedor de la orden" value={providerId} onChange={(event) => setProviderId(Number(event.target.value))}>
          {workspace.providers.filter((provider) => provider.active).map((provider) => (
            <MenuItem key={provider.id} value={provider.id}>{provider.code} · {provider.name}</MenuItem>
          ))}
        </TextField>
        <Stack spacing={1.25}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Líneas autorizadas</Typography>
          {lines.map((line, index) => (
            <Paper key={line.id} variant="outlined" sx={{ p: 1.5, bgcolor: '#FAFBFC' }}>
              <Grid container spacing={1.5} alignItems="center">
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField select fullWidth label={`Material línea ${index + 1}`} value={line.materialCode} onChange={(event) => updateLine(line.id, 'materialCode', event.target.value)}>
                    {enabledMaterials.map((material) => <MenuItem key={material.id} value={material.code}>{material.code} · {material.name}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 10, md: 5 }}>
                  <TextField fullWidth type="number" label={`Cantidad autorizada línea ${index + 1}`} value={line.authorizedKg} onChange={(event) => updateLine(line.id, 'authorizedKg', event.target.value)} slotProps={{ input: { endAdornment: <InputAdornment position="end">kg</InputAdornment> } }} />
                  {Number(line.receivedKg || 0) > 0 && <Typography variant="caption" color="text.secondary">Ya recibido: {formatKg(line.receivedKg)}</Typography>}
                </Grid>
                <Grid size={{ xs: 2, md: 1 }}>
                  <Tooltip title="Quitar línea"><span><IconButton aria-label={`Quitar línea ${index + 1}`} color="error" disabled={lines.length === 1 || Number(line.receivedKg || 0) > 0} onClick={() => removeLine(line.id)}><DeleteOutlineIcon /></IconButton></span></Tooltip>
                </Grid>
              </Grid>
            </Paper>
          ))}
          <Box><Button startIcon={<AddOutlinedIcon />} onClick={addLine}>Agregar línea</Button></Box>
        </Stack>
        <Divider />
        <Stack direction={{ xs: 'column-reverse', sm: 'row' }} justifyContent="flex-end" gap={1}>
          <Button onClick={onCancel}>Volver sin guardar</Button>
          <Button variant="contained" onClick={submit}>{editing ? 'Guardar cambios locales' : 'Crear borrador local'}</Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

function PurchaseOrdersPanel({ workspace, orders, onChange }) {
  const [selectedId, setSelectedId] = useState(orders[0]?.id);
  const [editor, setEditor] = useState(null);
  const [message, setMessage] = useState('');
  const selected = orders.find((item) => item.id === selectedId) || orders[0];

  const replaceSelected = (changes, successMessage) => {
    onChange(orders.map((item) => item.id === selected.id ? { ...item, ...changes } : item));
    setMessage(successMessage);
  };
  const nextMockId = () => {
    let sequence = orders.length + 1;
    let id = `OCM-DEMO-${String(sequence).padStart(3, '0')}`;
    while (orders.some((order) => order.id === id)) {
      sequence += 1;
      id = `OCM-DEMO-${String(sequence).padStart(3, '0')}`;
    }
    return id;
  };
  const saveOrder = (values) => {
    if (editor.mode === 'create') {
      const id = nextMockId();
      const created = {
        ...values,
        id,
        revision: 1,
        status: 'BORRADOR',
        createdBy: 'TRB-COM-01 · María Compras',
        approvedBy: null,
        approvedAt: null,
        previousRevisions: [],
      };
      onChange([created, ...orders]);
      setSelectedId(id);
      setMessage('Orden creada como borrador local. Ya puedes editarla, enviarla o descartarla.');
    } else {
      onChange(orders.map((item) => item.id === values.id ? { ...item, ...values } : item));
      setMessage('Cambios del borrador guardados únicamente en memoria.');
    }
    setEditor(null);
  };
  const sendForApproval = () => replaceSelected({ status: 'PENDIENTE_APROBACION', approvedBy: null, approvedAt: null }, 'Orden enviada a aprobación dentro del mock.');
  const returnToDraft = () => replaceSelected({ status: 'BORRADOR', approvedBy: null, approvedAt: null }, 'Orden devuelta a borrador para permitir su edición.');
  const approve = () => replaceSelected({ status: 'APROBADA', approvedBy: 'TRB-GER-01 · Gerencia de planta', approvedAt: 'Simulado ahora · local' }, 'Aprobación de Gerencia simulada en memoria.');
  const discardDraft = () => {
    const remaining = orders.filter((item) => item.id !== selected.id);
    onChange(remaining);
    setSelectedId(remaining[0]?.id);
    setEditor(null);
    setMessage('Borrador descartado del estado local. No existió persistencia que eliminar.');
  };
  const cancelOrder = () => replaceSelected({ status: 'CANCELADA', cancelledAt: 'Simulado ahora · local', cancelledBy: 'TRB-COM-01 · María Compras' }, 'Orden cancelada lógicamente; su detalle permanece visible para trazabilidad.');
  const createRevision = () => {
    const previousRevisions = [...(selected.previousRevisions || []), {
      revision: selected.revision,
      status: selected.status,
      approvedBy: selected.approvedBy,
      approvedAt: selected.approvedAt,
    }];
    replaceSelected({ revision: selected.revision + 1, status: 'BORRADOR', approvedBy: null, approvedAt: null, previousRevisions }, `Revisión ${selected.revision + 1} creada como borrador editable.`);
  };

  if (!selected) return null;
  return (
    <Stack spacing={2}>
      {message && <Alert severity="success" onClose={() => setMessage('')}>{message}</Alert>}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2, borderBottom: '1px solid #E0E0E0' }}>
              <Box><Typography variant="h6" sx={{ fontWeight: 850 }}>Órdenes de compra</Typography><Typography variant="caption" color="text.secondary">CRUD completo · memoria local</Typography></Box>
              <Button size="small" startIcon={<AddOutlinedIcon />} onClick={() => setEditor({ mode: 'create' })}>Nueva orden</Button>
            </Stack>
            <List disablePadding>{orders.map((order) => (
              <ListItemButton key={order.id} data-testid={`purchase-order-row-${order.id}`} selected={order.id === selected.id} onClick={() => { setSelectedId(order.id); setEditor(null); }} sx={{ borderBottom: '1px solid #EEEEEE' }}>
                <Stack width="100%" spacing={0.5}>
                  <Stack direction="row" justifyContent="space-between" gap={1}><Typography variant="body2" sx={{ fontWeight: 850 }}>{order.id}</Typography><Chip size="small" label={order.status.replaceAll('_', ' ')} color={purchaseOrderStatusColor(order.status)} /></Stack>
                  <Typography variant="body2">{order.providerName}</Typography>
                  <Typography variant="caption" color="text.secondary">Revisión {order.revision} · {formatKg(order.lines.reduce((sum, line) => sum + line.balanceKg, 0))} pendiente</Typography>
                </Stack>
              </ListItemButton>
            ))}</List>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, lg: 8 }}>
          {editor ? (
            <PurchaseOrderForm key={`${editor.mode}-${selected.id}-${selected.revision}`} initialOrder={editor.mode === 'edit' ? selected : null} workspace={workspace} onSave={saveOrder} onCancel={() => setEditor(null)} />
          ) : (
            <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2.5 } }} data-testid="purchase-order-detail">
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
                  <Box><Typography variant="overline" color="text.secondary">Revisión {selected.revision}</Typography><Typography variant="h5" sx={{ fontWeight: 850 }}>{selected.id}</Typography><Typography variant="body2">{selected.providerName}</Typography></Box>
                  <Chip label={selected.status.replaceAll('_', ' ')} color={purchaseOrderStatusColor(selected.status)} />
                </Stack>
                <Alert severity="info">La guía del proveedor no sustituye esta autorización interna. Creador y aprobador deben ser personas distintas.</Alert>
                <Grid container spacing={1.5}><Grid size={{ xs: 12, sm: 6 }}><FieldValue label="Creada por">{selected.createdBy}</FieldValue></Grid><Grid size={{ xs: 12, sm: 6 }}><FieldValue label="Aprobada por Gerencia">{selected.approvedBy || 'Pendiente'}</FieldValue></Grid></Grid>
                <TableContainer><Table size="small" aria-label={`Líneas de ${selected.id}`}><TableHead><TableRow sx={{ bgcolor: '#F4F6F8' }}><TableCell>Material</TableCell><TableCell align="right">Autorizado</TableCell><TableCell align="right">Recibido</TableCell><TableCell align="right">Saldo</TableCell></TableRow></TableHead><TableBody>{selected.lines.map((line) => <TableRow key={line.id}><TableCell>{line.materialCode}<Typography variant="caption" display="block" color="text.secondary">{line.materialName}</Typography></TableCell><TableCell align="right">{formatKg(line.authorizedKg)}</TableCell><TableCell align="right">{formatKg(line.receivedKg)}</TableCell><TableCell align="right" sx={{ fontWeight: 800 }}>{formatKg(line.balanceKg)}</TableCell></TableRow>)}</TableBody></Table></TableContainer>
                {selected.previousRevisions?.length > 0 && <Alert severity="info" icon={<HistoryOutlinedIcon />}>{selected.previousRevisions.length} revisión anterior conservada en este mock.</Alert>}
                <Divider />
                <Stack direction="row" justifyContent="flex-end" flexWrap="wrap" useFlexGap spacing={1}>
                  {selected.status === 'BORRADOR' && <Button onClick={discardDraft} color="error">Descartar borrador</Button>}
                  {selected.status === 'BORRADOR' && <Button variant="outlined" onClick={() => setEditor({ mode: 'edit' })}>Editar borrador</Button>}
                  {selected.status === 'BORRADOR' && <Button variant="contained" onClick={sendForApproval}>Enviar a aprobación</Button>}
                  {selected.status === 'PENDIENTE_APROBACION' && <Button variant="outlined" onClick={returnToDraft}>Devolver a borrador</Button>}
                  {selected.status === 'PENDIENTE_APROBACION' && <Button variant="contained" onClick={approve}>Aprobar como Gerencia</Button>}
                  {['PENDIENTE_APROBACION', 'APROBADA'].includes(selected.status) && <Button color="error" onClick={cancelOrder}>Cancelar orden</Button>}
                  {['APROBADA', 'CANCELADA'].includes(selected.status) && <Button variant="outlined" onClick={createRevision}>Crear nueva revisión</Button>}
                </Stack>
              </Stack>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Stack>
  );
}

function ConfigurationPanel({ workspace, onParticipants, onEvidence }) {
  const [tab, setTab] = useState(0);
  const [participantEditor, setParticipantEditor] = useState(null);
  const [evidenceEditor, setEvidenceEditor] = useState(null);
  const [configSearch, setConfigSearch] = useState('');
  const [configStatus, setConfigStatus] = useState('TODOS');
  const matchesConfigStatus = (item) => configStatus === 'TODOS'
    || (configStatus === 'ACTIVOS' && item.active)
    || (configStatus === 'INACTIVOS' && !item.active);
  const visibleParticipants = workspace.participants.filter((item) => matchesConfigStatus(item) && matchesOmniSearch(item, configSearch));
  const visibleEvidence = workspace.evidenceTypes.filter((item) => matchesConfigStatus(item) && matchesOmniSearch(item, configSearch));
  const configFilters = [{
    id: 'status',
    label: 'Estado',
    value: configStatus,
    onChange: setConfigStatus,
    options: [
      { value: 'TODOS', label: 'Todos' },
      { value: 'ACTIVOS', label: 'Activos' },
      { value: 'INACTIVOS', label: 'Inactivos' },
    ],
  }];
  const toggleParticipant = (id) => onParticipants(workspace.participants.map((item) => item.id === id ? { ...item, active: !item.active } : item));
  const toggleEvidence = (id) => onEvidence(workspace.evidenceTypes.map((item) => item.id === id ? { ...item, active: !item.active } : item));
  const addParticipant = () => {
    const participant = { id: `TRB-DEMO-${workspace.participants.length + 1}`, name: 'Nuevo participante mock', roles: ['ALMACEN'], capabilities: ['RECEPCION_CONFIRMAR'], active: true };
    onParticipants([...workspace.participants, participant]);
    setParticipantEditor(participant);
  };
  const saveParticipant = () => {
    onParticipants(workspace.participants.map((item) => item.id === participantEditor.id ? participantEditor : item));
    setParticipantEditor(null);
  };
  const addEvidence = () => {
    const evidence = { id: `EVID-DEMO-${workspace.evidenceTypes.length + 1}`, name: 'Nueva evidencia mock', contexts: ['RECEPCION'], required: false, active: true };
    onEvidence([...workspace.evidenceTypes, evidence]);
    setEvidenceEditor(evidence);
  };
  const saveEvidence = () => {
    onEvidence(workspace.evidenceTypes.map((item) => item.id === evidenceEditor.id ? evidenceEditor : item));
    setEvidenceEditor(null);
  };
  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <Box sx={{ p: 2, bgcolor: '#FAFBFC' }}><Typography variant="h5" sx={{ fontWeight: 850 }}>Recepción y Calidad</Typography><Typography variant="body2" color="text.secondary">Asignaciones, tipos de evidencia y modalidades de materiales.</Typography></Box>
      <Tabs value={tab} onChange={(_, value) => { setTab(value); setConfigSearch(''); setConfigStatus('TODOS'); }} variant="scrollable"><Tab icon={<PeopleOutlineIcon />} iconPosition="start" label="Participantes" /><Tab icon={<AttachFileOutlinedIcon />} iconPosition="start" label="Evidencias" /><Tab icon={<SettingsOutlinedIcon />} iconPosition="start" label="Categorías" /></Tabs>
      <Divider />
      <Box sx={{ p: { xs: 1.5, md: 2.5 } }}>
        {tab === 0 && <Stack spacing={2}><Alert severity="info">Cambiar una asignación afecta acciones futuras. Los eventos anteriores conservan actor y snapshot.</Alert><DataTableToolbar searchValue={configSearch} onSearchChange={setConfigSearch} searchPlaceholder="Buscar persona, rol o capacidad" filters={configFilters} resultCount={visibleParticipants.length} totalCount={workspace.participants.length} onClear={() => { setConfigSearch(''); setConfigStatus('TODOS'); }} actions={<Button aria-label="Agregar participante mock" startIcon={<AddOutlinedIcon />} onClick={addParticipant}>Agregar participante</Button>} />{participantEditor && <Paper variant="outlined" sx={{ p: 2 }}><Grid container spacing={1.5}><Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Nombre" value={participantEditor.name} onChange={(event) => setParticipantEditor((current) => ({ ...current, name: event.target.value }))} /></Grid><Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Roles separados por coma" value={participantEditor.roles.join(',')} onChange={(event) => setParticipantEditor((current) => ({ ...current, roles: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) }))} /></Grid><Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Capacidades separadas por coma" value={participantEditor.capabilities.join(',')} onChange={(event) => setParticipantEditor((current) => ({ ...current, capabilities: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) }))} /></Grid></Grid><Stack direction="row" justifyContent="flex-end" mt={1}><Button onClick={() => setParticipantEditor(null)}>Cancelar</Button><Button variant="contained" onClick={saveParticipant}>Guardar asignación</Button></Stack></Paper>}<TableContainer><Table size="small" aria-label="Participantes configurables"><TableHead><TableRow sx={{ bgcolor: '#F4F6F8' }}><TableCell>Participante</TableCell><TableCell>Rol</TableCell><TableCell>Capacidades</TableCell><TableCell>Estado</TableCell><TableCell /></TableRow></TableHead><TableBody>{visibleParticipants.map((item) => <TableRow key={item.id}><TableCell><Typography variant="body2" sx={{ fontWeight: 800 }}>{item.name}</Typography><Typography variant="caption">{item.id}</Typography></TableCell><TableCell>{item.roles.join(', ')}</TableCell><TableCell><Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.5}>{item.capabilities.map((capability) => <Chip key={capability} size="small" label={capability} variant="outlined" />)}</Stack></TableCell><TableCell><Chip size="small" color={item.active ? 'success' : 'default'} label={item.active ? 'Activo' : 'Inactivo'} /></TableCell><TableCell><Button size="small" onClick={() => setParticipantEditor({ ...item })}>Editar</Button><Button size="small" onClick={() => toggleParticipant(item.id)}>{item.active ? 'Desactivar' : 'Activar'}</Button></TableCell></TableRow>)}{visibleParticipants.length === 0 && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}>Sin participantes para los filtros seleccionados.</TableCell></TableRow>}</TableBody></Table></TableContainer></Stack>}
        {tab === 1 && <Stack spacing={2}><Alert severity="warning">El tipo y requisito son configurables. Un archivo ya usado no se edita: se reemplaza mediante otro adjunto enlazado.</Alert><DataTableToolbar searchValue={configSearch} onSearchChange={setConfigSearch} searchPlaceholder="Buscar tipo o contexto de evidencia" filters={configFilters} resultCount={visibleEvidence.length} totalCount={workspace.evidenceTypes.length} onClear={() => { setConfigSearch(''); setConfigStatus('TODOS'); }} actions={<Button startIcon={<AddOutlinedIcon />} onClick={addEvidence}>Agregar tipo</Button>} />{evidenceEditor && <Paper variant="outlined" sx={{ p: 2 }}><Grid container spacing={1.5}><Grid size={{ xs: 12, md: 5 }}><TextField fullWidth label="Nombre" value={evidenceEditor.name} onChange={(event) => setEvidenceEditor((current) => ({ ...current, name: event.target.value }))} /></Grid><Grid size={{ xs: 12, md: 5 }}><TextField fullWidth label="Contextos separados por coma" value={evidenceEditor.contexts.join(',')} onChange={(event) => setEvidenceEditor((current) => ({ ...current, contexts: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) }))} /></Grid><Grid size={{ xs: 12, md: 2 }}><TextField fullWidth select label="Requisito" value={evidenceEditor.required ? 'SI' : 'NO'} onChange={(event) => setEvidenceEditor((current) => ({ ...current, required: event.target.value === 'SI' }))}><MenuItem value="SI">Obligatoria</MenuItem><MenuItem value="NO">Opcional</MenuItem></TextField></Grid></Grid><Stack direction="row" justifyContent="flex-end" mt={1}><Button onClick={() => setEvidenceEditor(null)}>Cancelar</Button><Button variant="contained" onClick={saveEvidence}>Guardar tipo</Button></Stack></Paper>}<TableContainer><Table size="small" aria-label="Tipos de evidencia configurables"><TableHead><TableRow sx={{ bgcolor: '#F4F6F8' }}><TableCell>Tipo</TableCell><TableCell>Contextos</TableCell><TableCell>Requisito</TableCell><TableCell>Estado</TableCell><TableCell /></TableRow></TableHead><TableBody>{visibleEvidence.map((item) => <TableRow key={item.id}><TableCell><Typography variant="body2" sx={{ fontWeight: 800 }}>{item.name}</Typography><Typography variant="caption">{item.id}</Typography></TableCell><TableCell>{item.contexts.join(', ')}</TableCell><TableCell>{item.required ? 'Obligatoria' : 'Opcional'}</TableCell><TableCell><Chip size="small" color={item.active ? 'success' : 'default'} label={item.active ? 'Activa' : 'Inactiva'} /></TableCell><TableCell><Button size="small" onClick={() => setEvidenceEditor({ ...item })}>Editar</Button><Button size="small" onClick={() => toggleEvidence(item.id)}>{item.active ? 'Desactivar' : 'Activar'}</Button></TableCell></TableRow>)}{visibleEvidence.length === 0 && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}>Sin evidencias para los filtros seleccionados.</TableCell></TableRow>}</TableBody></Table></TableContainer></Stack>}
        {tab === 2 && <Grid container spacing={1.5}>{workspace.categoryRules.map((rule) => <Grid key={rule.id} size={{ xs: 12, md: 6 }}><Paper variant="outlined" sx={{ p: 2, height: '100%', borderLeft: `4px solid ${rule.enabled ? '#2E7D32' : '#9E9E9E'}` }}><Stack direction="row" justifyContent="space-between" gap={1}><Box><Typography variant="subtitle1" sx={{ fontWeight: 850 }}>{rule.name}</Typography><Typography variant="caption">{rule.id}</Typography></Box><Chip size="small" label={rule.enabled ? 'Habilitada' : 'Deshabilitada'} color={rule.enabled ? 'success' : 'default'} /></Stack><Divider sx={{ my: 1.5 }} /><FieldValue label="Modalidad de cantidad">{modeCopy[rule.mode]?.label}</FieldValue><Box mt={1}><FieldValue label="Autoridad">{rule.quantityAuthority}</FieldValue></Box></Paper></Grid>)}</Grid>}
      </Box>
    </Paper>
  );
}

function RecepcionMateriales({ forcedSection }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { recepcionId } = useParams();
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    obtenerRecepcionMateriales()
      .then((data) => setWorkspace(data))
      .catch(() => setError('No se pudo cargar el prototipo local.'))
      .finally(() => setLoading(false));
  }, []);

  const section = forcedSection || ['compras', 'calidad', 'inventario', 'documentos', 'catalogos', 'configuracion', 'cobertura']
    .find((item) => location.pathname.includes(`/${item}`)) || 'recepciones';
  const isNew = location.pathname.endsWith('/nueva');
  const isEdit = location.pathname.endsWith('/editar');
  const selected = useMemo(() => workspace?.receptions.find((item) => item.id === recepcionId) || workspace?.receptions[0], [workspace, recepcionId]);

  if (loading) return <Box sx={{ minHeight: 420, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  if (error || !workspace) return <Alert severity="error">{error || 'Datos mock no disponibles.'}</Alert>;

  const commitReception = (action, payload) => {
    const { draft, mode, intakeType, measuredKg, acceptedKg, differenceKg, managementDecision, existingId } = payload;
    const id = existingId || `REC-DEMO-${String(workspace.receptions.length + 1).padStart(3, '0')}`;
    const provider = workspace.providers.find((item) => item.id === Number(draft.providerId));
    const material = workspace.materials.find((item) => item.id === Number(draft.materialId));
    const category = workspace.categoryRules.find((item) => item.id === material?.categoryId);
    const locationItem = workspace.locations.find((item) => item.id === draft.locationId);
    const isConfirmed = action === 'CONFIRM';
    const isRejected = action === 'REJECT';
    const lotId = workspace.receptions.find((item) => item.id === id)?.internalLot || `LM-DEMO-${String(workspace.lots.length + 1).padStart(3, '0')}`;
    const directPolicy = workspace.releasePolicies.find((item) => item.status === 'ACTIVA' && item.materialCode === material?.code && item.providerId === provider?.id);
    const qualityStatus = directPolicy && intakeType === 'ORDINARIA' ? 'LIBERADO' : 'PENDIENTE';
    const balanceLocation = qualityStatus === 'LIBERADO' ? 'ALM-MP-01' : draft.locationId;
    const evidence = draft.evidenceTypeIds.map((type, index) => ({ id: `EV-${id}-${index + 1}`, type, name: `${workspace.evidenceTypes.find((item) => item.id === type)?.name || type} · mock`, status: 'VINCULADA' }));
    const eventType = isConfirmed ? 'RECEPCION_CONFIRMADA' : isRejected ? 'RECHAZO_PRE_CUSTODIA' : 'BORRADOR_GUARDADO';
    const record = {
      id,
      state: isConfirmed ? 'CONFIRMADA' : isRejected ? 'RECHAZADA_PRE_CUSTODIA' : 'BORRADOR',
      qualitySummary: isConfirmed ? qualityStatus : 'SIN_EVALUAR',
      createdAt: 'Simulado ahora · local',
      isExceptional: intakeType === 'EXCEPCIONAL',
      providerCode: provider?.code,
      providerName: provider?.name,
      purchaseOrder: intakeType === 'EXCEPCIONAL' ? null : draft.purchaseOrderId,
      documentType: draft.documentType,
      documentNumber: draft.documentNumber,
      materialCode: material?.code,
      materialName: material?.name,
      category: category?.name,
      mode,
      quantitySource: mode === 'VIRGEN_CONFIANZA_PROVEEDOR' ? 'DOCUMENTO_PROVEEDOR' : 'PESAJE_MANUAL_BOLSA',
      internalLot: isConfirmed ? lotId : 'Se asignará al confirmar',
      supplierLot: draft.supplierLotStatus === 'INFORMADO' ? draft.supplierLot : null,
      supplierLotStatus: draft.supplierLotStatus,
      physicalKg: isConfirmed ? acceptedKg : 0,
      availableKg: isConfirmed && qualityStatus === 'LIBERADO' ? acceptedKg : 0,
      locationId: isConfirmed ? balanceLocation : draft.locationId,
      locationName: isConfirmed && qualityStatus === 'LIBERADO' ? 'Almacén de resinas' : locationItem?.name,
      documentaryHold: { active: isConfirmed && intakeType === 'EXCEPCIONAL', reason: intakeType === 'EXCEPCIONAL' ? 'Ingreso excepcional pendiente de regularización' : null },
      packaging: {
        documentedPackages: draft.documentedPackages,
        receivedPackages: draft.receivedPackages,
        nominalKg: draft.nominalKg,
        documentedKg: draft.documentedKg,
        internalWeightStatus: mode === 'VIRGEN_CONFIANZA_PROVEEDOR' ? 'NO_MEDIDO' : 'MEDIDO_MANUAL',
        measuredNetKg: mode === 'VIRGEN_CONFIANZA_PROVEEDOR' ? null : measuredKg,
        acceptedKg,
        differenceKg,
        toleranceStatus: mode === 'VIRGEN_CONFIANZA_PROVEEDOR' ? 'SIN_PESAJE_INTERNO' : 'SIN_POLITICA',
        scaleCode: draft.scaleCode,
        bagWeights: draft.bagWeights,
      },
      evidence,
      inspection: [
        { id: 'identidad', label: 'Material y grado correctos', status: 'CONFORME' },
        { id: 'lote', label: 'Lote externo revisado cuando está disponible', status: 'CONFORME' },
        { id: 'empaque', label: 'Empaque íntegro', status: 'CONFORME' },
        { id: 'contaminacion', label: 'Sin contaminación visible', status: 'CONFORME' },
      ],
      allocations: isConfirmed ? [{ id: `SAL-${lotId}-1`, status: qualityStatus, quantityKg: acceptedKg, locationId: balanceLocation, reason: directPolicy ? `Liberación directa ${directPolicy.id}` : 'Pendiente de Calidad', decidedBy: directPolicy ? 'Política aprobada por Calidad y Gerencia' : null }] : [],
      events: [{ id: `EVT-${id}-1`, time: 'Simulado ahora · local', type: eventType, actor: 'TRB-ALM-01 · Rosa Almacén', detail: isConfirmed ? `${formatKg(acceptedKg)} aceptados; ${managementDecision || 'regla de modalidad aplicada'}.` : isRejected ? 'Material rechazado antes de aceptar custodia; inventario permanece en cero.' : 'Borrador editable guardado sin afectar inventario.' }],
    };
    const receptions = existingId ? workspace.receptions.map((item) => item.id === id ? record : item) : [record, ...workspace.receptions];
    const lots = isConfirmed && !workspace.lots.some((item) => item.receptionId === id) ? [{ id: lotId, receptionId: id, materialCode: material?.code, materialName: material?.name, providerId: provider?.id, providerName: provider?.name, supplierLotStatus: record.supplierLotStatus, supplierLot: record.supplierLot, documentaryHold: intakeType === 'EXCEPCIONAL', balances: [{ id: `SAL-${lotId}-1`, status: qualityStatus, locationId: balanceLocation, quantityKg: acceptedKg }], events: [{ id: `LOT-EVT-${lotId}-1`, type: 'RECEPCION', detail: `${formatKg(acceptedKg)} creados desde ${id}.`, actor: 'TRB-ALM-01 · Rosa Almacén', time: 'Simulado ahora · local' }] }, ...workspace.lots] : workspace.lots;
  const purchaseOrders = isConfirmed && intakeType === 'ORDINARIA' ? workspace.purchaseOrders.map((order) => order.id === draft.purchaseOrderId ? { ...order, lines: order.lines.map((line) => line.materialCode === material?.code ? { ...line, receivedKg: roundKg(line.receivedKg + acceptedKg), balanceKg: roundKg(line.balanceKg - acceptedKg) } : line) } : order) : workspace.purchaseOrders;
    const documentExists = workspace.supplierDocuments.some((item) => item.series && `${item.series}-${item.number}` === draft.documentNumber);
    const supplierDocuments = documentExists || !isConfirmed ? workspace.supplierDocuments : [...workspace.supplierDocuments, { id: `DOC-${id}`, providerId: provider?.id, type: draft.documentType, series: 'LOCAL', number: draft.documentNumber, issueDate: '2026-07-21', documentaryKg: draft.documentedKg, receptionId: id, lines: [{ id: `DOC-L-${id}`, description: material?.name, supplierCode: '', quantity: draft.documentedKg, unit: 'KG', reconciledMaterialCode: material?.code }], attachments: evidence.map((item) => ({ id: item.id, typeId: item.type, name: item.name, status: 'VIGENTE', replacesId: null })) }];
    setWorkspace((current) => ({ ...current, receptions, lots, purchaseOrders, supplierDocuments }));
    navigate(`/materiales/recepciones/${id}`);
  };
  const headerBySection = {
    recepciones: ['Materias primas · US-010A', 'Recepción trazable de materiales', 'Ingreso, evidencia, cantidad aceptada y custodia inicial.'],
    compras: ['Materias primas', 'Órdenes de compra internas', 'Autorización operativa y saldo pendiente por material.'],
    calidad: ['Materias primas', 'Calidad de materiales', 'Liberación, bloqueo o rechazo total y parcial por lote.'],
    inventario: ['Materias primas', 'Lotes e inventario', 'Saldos por ubicación, estado de Calidad y retención documental.'],
    documentos: ['Materias primas', 'Documentos de proveedor', 'Conciliación de guías, referencias y evidencias con la recepción.'],
    catalogos: ['Datos maestros', 'Catálogos de abastecimiento', 'Identidades reutilizadas por recepción, Calidad e inventario.'],
    configuracion: ['Soporte', 'Configuración operativa', 'Participantes, evidencias y modalidades aplicables al flujo de materias primas.'],
    cobertura: ['Materias primas', 'Cobertura funcional US-010A', 'Escenarios, reglas y capacidades representadas por el prototipo.'],
  };
  const [, headerTitle, headerDescription] = headerBySection[section] || headerBySection.recepciones;
  return (
    <Stack spacing={2.25} sx={{ maxWidth: 1540, mx: 'auto' }}>
      <PageHeader
        title={headerTitle}
        description={headerDescription}
        actions={<Chip icon={<Inventory2OutlinedIcon />} label={RECEPCION_MATERIALES_SOURCE} variant="outlined" />}
      />
      <LocalPrototypeBanner />
      {section === 'recepciones' && (isNew || isEdit
        ? <ReceptionDraft key={isEdit ? selected?.id : 'new'} workspace={workspace} initialReception={isEdit ? selected : null} onCommit={commitReception} onBack={() => navigate('/materiales/recepciones')} />
        : <Grid container spacing={2}><Grid size={{ xs: 12, lg: 4 }}><ReceptionQueue receptions={workspace.receptions} selectedId={selected?.id} onSelect={(id) => navigate(`/materiales/recepciones/${id}`)} onNew={() => navigate('/materiales/recepciones/nueva')} /></Grid><Grid size={{ xs: 12, lg: 8 }}>{selected && <ReceptionDetail reception={selected} onBack={() => navigate('/materiales/recepciones')} onEdit={() => navigate(`/materiales/recepciones/${selected.id}/editar`)} />}</Grid></Grid>)}
      {section === 'compras' && <PurchaseOrdersPanel workspace={workspace} orders={workspace.purchaseOrders} onChange={(purchaseOrders) => setWorkspace((current) => ({ ...current, purchaseOrders }))} />}
      {section === 'calidad' && <InventoryOperationsPanel workspace={workspace} onWorkspaceChange={setWorkspace} initialTab={1} />}
      {section === 'inventario' && <InventoryOperationsPanel workspace={workspace} onWorkspaceChange={setWorkspace} />}
      {section === 'documentos' && <DocumentsOperationsPanel workspace={workspace} onWorkspaceChange={setWorkspace} />}
      {section === 'catalogos' && <CatalogManagementPanel workspace={workspace} onWorkspaceChange={setWorkspace} />}
      {section === 'configuracion' && <ConfigurationPanel workspace={workspace} onParticipants={(participants) => setWorkspace((current) => ({ ...current, participants }))} onEvidence={(evidenceTypes) => setWorkspace((current) => ({ ...current, evidenceTypes }))} />}
      {section === 'cobertura' && <CoveragePanel workspace={workspace} />}
    </Stack>
  );
}

export default RecepcionMateriales;
