import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
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
  Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import AutorenewOutlinedIcon from '@mui/icons-material/AutorenewOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import MoveDownOutlinedIcon from '@mui/icons-material/MoveDownOutlined';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import DataTableToolbar from './ui/DataTableToolbar';
import { matchesOmniSearch } from '../utils/tableSearch';

const kgFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const formatKg = (value) => `${kgFormatter.format(Number(value || 0))} kg`;
const roundKg = (value) => Math.round(Number(value || 0) * 1000) / 1000;
const nowLabel = () => 'Simulado ahora · local';

const catalogTabs = [
  { key: 'materials', label: 'Materias primas' },
  { key: 'providers', label: 'Proveedores' },
  { key: 'locations', label: 'Ubicaciones' },
  { key: 'motives', label: 'Motivos' },
  { key: 'categoryRules', label: 'Categorías' },
  { key: 'policies', label: 'Políticas' },
];

const emptyCatalogItem = (kind, workspace) => {
  if (kind === 'materials') return { code: '', name: '', categoryId: workspace.categoryRules[0]?.id || '', unitBase: 'KG', active: true };
  if (kind === 'providers') return { code: '', name: '', ruc: '', active: true };
  if (kind === 'locations') return { id: '', name: '', scope: 'MATERIA_PRIMA', type: 'RESINAS', parentId: '', active: true };
  if (kind === 'motives') return { id: '', name: '', context: 'CALIDAD', active: true };
  return { id: '', name: '', mode: 'POR_CONFIGURAR', quantityAuthority: '', supplierLotRequired: false, enabled: true };
};

function CatalogEditor({ kind, value, workspace, onSave, onCancel }) {
  const [form, setForm] = useState(value);
  const [error, setError] = useState('');
  const update = (field, next) => setForm((current) => ({ ...current, [field]: next }));
  const submit = () => {
    if (!(form.code || form.id)?.trim() || !form.name?.trim()) {
      setError('Código y nombre son obligatorios en el prototipo.');
      return;
    }
    onSave(form);
  };
  return (
    <Paper variant="outlined" sx={{ p: 2, bgcolor: '#FAFBFC' }} data-testid={`catalog-editor-${kind}`}>
      <Stack spacing={1.5}>
        <Typography variant="subtitle1" sx={{ fontWeight: 850 }}>{value.__editing ? 'Editar registro' : 'Crear registro mock'}</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Código" value={form.code ?? form.id ?? ''} disabled={value.__editing} onChange={(event) => update(kind === 'providers' || kind === 'materials' ? 'code' : 'id', event.target.value.toUpperCase())} /></Grid>
          <Grid size={{ xs: 12, md: 8 }}><TextField fullWidth label="Nombre" value={form.name || ''} onChange={(event) => update('name', event.target.value)} /></Grid>
          {kind === 'materials' && <><Grid size={{ xs: 12, md: 6 }}><TextField fullWidth select label="Categoría de recepción" value={form.categoryId} onChange={(event) => update('categoryId', event.target.value)}>{workspace.categoryRules.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Unidad base" value={form.unitBase} disabled /></Grid></>}
          {kind === 'providers' && <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="RUC" value={form.ruc || ''} onChange={(event) => update('ruc', event.target.value.replace(/\D/g, '').slice(0, 11))} /></Grid>}
          {kind === 'locations' && <><Grid size={{ xs: 12, md: 4 }}><TextField fullWidth select label="Ámbito" value={form.scope} onChange={(event) => update('scope', event.target.value)}><MenuItem value="MATERIA_PRIMA">Materia prima</MenuItem><MenuItem value="PIEZA_COLOR">PiezaColor · incompatible</MenuItem><MenuItem value="PRODUCTO_TERMINADO">Producto terminado · incompatible</MenuItem></TextField></Grid><Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Tipo funcional" value={form.type || ''} onChange={(event) => update('type', event.target.value.toUpperCase())} /></Grid><Grid size={{ xs: 12, md: 4 }}><TextField fullWidth select label="Ubicación padre" value={form.parentId || ''} onChange={(event) => update('parentId', event.target.value)}><MenuItem value="">Sin padre</MenuItem>{workspace.locations.filter((item) => item.id !== form.id).map((item) => <MenuItem key={item.id} value={item.id}>{item.id}</MenuItem>)}</TextField></Grid></>}
          {kind === 'motives' && <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth select label="Contexto" value={form.context} onChange={(event) => update('context', event.target.value)}>{['CALIDAD', 'CORRECCION', 'DEVOLUCION', 'EXCEPCION', 'RECHAZO'].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField></Grid>}
          {kind === 'categoryRules' && <><Grid size={{ xs: 12, md: 6 }}><TextField fullWidth select label="Modalidad predeterminada" value={form.mode} onChange={(event) => update('mode', event.target.value)}><MenuItem value="VIRGEN_CONFIANZA_PROVEEDOR">Virgen · documento y conteo</MenuItem><MenuItem value="SEGUNDA_PESAJE_BOLSA">Segunda · bolsa por bolsa</MenuItem><MenuItem value="POR_CONFIGURAR">Por configurar</MenuItem></TextField></Grid><Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Autoridad de cantidad" value={form.quantityAuthority || ''} onChange={(event) => update('quantityAuthority', event.target.value)} /></Grid></>}
        </Grid>
        <Stack direction="row" justifyContent="flex-end" spacing={1}><Button onClick={onCancel}>Cancelar</Button><Button variant="contained" onClick={submit}>Guardar localmente</Button></Stack>
      </Stack>
    </Paper>
  );
}

function PoliciesPanel({ workspace, onWorkspaceChange }) {
  const addToleranceVersion = () => {
    const version = workspace.tolerancePolicies.length + 1;
    onWorkspaceChange({ ...workspace, tolerancePolicies: [...workspace.tolerancePolicies, { id: `TOL-DEMO-${version}`, categoryId: 'RESINA_SEGUNDA', mode: 'SEGUNDA_PESAJE_BOLSA', version, absoluteKg: 1.5, percentage: 0.5, status: 'BORRADOR', approvedBy: null }] });
  };
  const addReleaseVersion = () => {
    const version = workspace.releasePolicies.length + 1;
    onWorkspaceChange({ ...workspace, releasePolicies: [...workspace.releasePolicies, { id: `LIB-DEMO-${version}`, materialCode: 'MP-PP-VIRGEN', providerId: 1, version, status: 'BORRADOR', qualityApprover: null, managementApprover: null }] });
  };
  const toggle = (collection, id) => onWorkspaceChange({ ...workspace, [collection]: workspace[collection].map((item) => item.id === id ? { ...item, status: item.status === 'ACTIVA' ? 'RETIRADA' : 'ACTIVA', approvedBy: item.approvedBy || 'TRB-GER-01 · Gerencia de planta', qualityApprover: item.qualityApprover || 'TRB-CAL-01 · Luis Calidad', managementApprover: item.managementApprover || 'TRB-GER-01 · Gerencia de planta' } : item) });
  return (
    <Stack spacing={2}>
      <Alert severity="info">Las políticas usadas no se reescriben. Cada cambio crea una versión y retirar una política solo afecta recepciones futuras.</Alert>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}><Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={1.5}><Stack direction="row" justifyContent="space-between"><Typography variant="h6">Tolerancias</Typography><Button startIcon={<AddOutlinedIcon />} onClick={addToleranceVersion}>Nueva versión</Button></Stack>{workspace.tolerancePolicies.map((item) => <Paper key={item.id} variant="outlined" sx={{ p: 1.5 }}><Stack direction="row" justifyContent="space-between" gap={1}><Box><Typography variant="body2" sx={{ fontWeight: 800 }}>{item.id} · v{item.version}</Typography><Typography variant="caption">{item.categoryId}: ±{item.absoluteKg} kg / {item.percentage}%</Typography></Box><Stack alignItems="flex-end"><Chip size="small" label={item.status} color={item.status === 'ACTIVA' ? 'success' : 'default'} /><Button size="small" onClick={() => toggle('tolerancePolicies', item.id)}>{item.status === 'ACTIVA' ? 'Retirar' : 'Activar'}</Button></Stack></Stack></Paper>)}</Stack></Paper></Grid>
        <Grid size={{ xs: 12, lg: 6 }}><Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={1.5}><Stack direction="row" justifyContent="space-between"><Typography variant="h6">Liberación directa</Typography><Button startIcon={<AddOutlinedIcon />} onClick={addReleaseVersion}>Nueva versión</Button></Stack>{workspace.releasePolicies.map((item) => <Paper key={item.id} variant="outlined" sx={{ p: 1.5 }}><Stack direction="row" justifyContent="space-between" gap={1}><Box><Typography variant="body2" sx={{ fontWeight: 800 }}>{item.id} · v{item.version}</Typography><Typography variant="caption">{item.materialCode} + proveedor {item.providerId}</Typography><Typography variant="caption" display="block">Calidad: {item.qualityApprover || 'Pendiente'} · Gerencia: {item.managementApprover || 'Pendiente'}</Typography></Box><Stack alignItems="flex-end"><Chip size="small" label={item.status} color={item.status === 'ACTIVA' ? 'success' : 'default'} /><Button size="small" onClick={() => toggle('releasePolicies', item.id)}>{item.status === 'ACTIVA' ? 'Retirar' : 'Activar'}</Button></Stack></Stack></Paper>)}</Stack></Paper></Grid>
      </Grid>
    </Stack>
  );
}

export function CatalogManagementPanel({ workspace, onWorkspaceChange, initialKind = 'materials' }) {
  const safeInitialKind = catalogTabs.some((item) => item.key === initialKind) ? initialKind : 'materials';
  const [kind, setKind] = useState(safeInitialKind);
  const [editor, setEditor] = useState(null);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const rows = kind === 'policies' ? [] : workspace[kind];
  const identity = (item) => kind === 'materials' || kind === 'providers' ? item.id : item.id;
  const code = (item) => item.code || item.id;
  const detail = (item) => {
    if (kind === 'materials') return `${item.categoryId} · ${item.unitBase}`;
    if (kind === 'providers') return `RUC ${item.ruc || 'no informado'}`;
    if (kind === 'locations') return `${item.scope} · ${item.type}${item.parentId ? ` · hija de ${item.parentId}` : ''}`;
    if (kind === 'motives') return item.context;
    return `${item.mode} · ${item.quantityAuthority}`;
  };
  const isActive = (item) => kind === 'categoryRules' ? item.enabled : item.active;
  const visibleRows = rows.filter((row) => (
    (statusFilter === 'TODOS' || (statusFilter === 'ACTIVOS') === Boolean(isActive(row)))
    && matchesOmniSearch(row, search, [code, (item) => item.name, detail])
  ));

  const save = (form) => {
    const clean = { ...form };
    delete clean.__editing;
    let next;
    if (editor.__editing) {
      next = rows.map((item) => identity(item) === identity(editor) ? clean : item);
    } else {
      const exists = rows.some((item) => code(item).toUpperCase() === code(clean).toUpperCase());
      if (exists) { setMessage('No se creó: el código ya existe en el catálogo local.'); return; }
      if (kind === 'materials' || kind === 'providers') clean.id = Math.max(0, ...rows.map((item) => Number(item.id) || 0)) + 1;
      next = [...rows, clean];
    }
    onWorkspaceChange({ ...workspace, [kind]: next });
    setEditor(null);
    setMessage('Catálogo actualizado en memoria. Las referencias históricas se conservan al desactivar.');
  };
  const toggle = (row) => onWorkspaceChange({ ...workspace, [kind]: rows.map((item) => identity(item) === identity(row) ? { ...item, [kind === 'categoryRules' ? 'enabled' : 'active']: !isActive(item) } : item) });
  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <Box sx={{ p: 2, bgcolor: '#FAFBFC' }}><Typography variant="h5" sx={{ fontWeight: 850 }}>Catálogos maestros de recepción</Typography><Typography variant="body2" color="text.secondary">CRUD lógico completo: alta, consulta, edición y desactivación. No borra identidades ya referenciadas.</Typography></Box>
      <Tabs value={kind} onChange={(_, value) => { setKind(value); setEditor(null); setSearch(''); setStatusFilter('TODOS'); }} variant="scrollable" scrollButtons="auto">{catalogTabs.map((item) => <Tab key={item.key} value={item.key} label={item.label} />)}</Tabs>
      <Divider />
      <Stack spacing={2} sx={{ p: { xs: 1.5, md: 2.5 } }}>
        {message && <Alert severity={message.startsWith('No se') ? 'warning' : 'success'} onClose={() => setMessage('')}>{message}</Alert>}
        {kind === 'policies' ? <PoliciesPanel workspace={workspace} onWorkspaceChange={onWorkspaceChange} /> : <>
          <Stack direction="row" justifyContent="space-between" alignItems="center"><Alert severity="info" sx={{ flex: 1, mr: 2 }}>Solo las ubicaciones con ámbito <strong>MATERIA_PRIMA</strong> son compatibles con esta historia.</Alert><Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => setEditor(emptyCatalogItem(kind, workspace))}>Nuevo</Button></Stack>
          {editor && <CatalogEditor key={`${kind}-${code(editor)}`} kind={kind} value={editor} workspace={workspace} onSave={save} onCancel={() => setEditor(null)} />}
          <DataTableToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Buscar por código, nombre o clasificación"
            filters={[{ id: 'estado', label: 'Estado', value: statusFilter, onChange: setStatusFilter, options: [{ value: 'TODOS', label: 'Todos' }, { value: 'ACTIVOS', label: 'Activos' }, { value: 'INACTIVOS', label: 'Inactivos' }] }]}
            resultCount={visibleRows.length}
            totalCount={rows.length}
            onClear={() => { setSearch(''); setStatusFilter('TODOS'); }}
          />
          <TableContainer><Table size="small" aria-label={`Catálogo ${kind}`}><TableHead><TableRow sx={{ bgcolor: '#F4F6F8' }}><TableCell>Código</TableCell><TableCell>Nombre</TableCell><TableCell>Clasificación</TableCell><TableCell>Estado</TableCell><TableCell align="right">Acciones</TableCell></TableRow></TableHead><TableBody>{visibleRows.map((row) => <TableRow key={identity(row)}><TableCell sx={{ fontWeight: 800 }}>{code(row)}</TableCell><TableCell>{row.name}</TableCell><TableCell>{detail(row)}</TableCell><TableCell><Chip size="small" label={isActive(row) ? 'ACTIVO' : 'INACTIVO'} color={isActive(row) ? 'success' : 'default'} /></TableCell><TableCell align="right"><Button size="small" onClick={() => setEditor({ ...row, __editing: true })}>Editar</Button><Button size="small" color={isActive(row) ? 'error' : 'success'} onClick={() => toggle(row)}>{isActive(row) ? 'Desactivar' : 'Activar'}</Button></TableCell></TableRow>)}{visibleRows.length === 0 && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 5 }}>Sin resultados para los filtros seleccionados.</TableCell></TableRow>}</TableBody></Table></TableContainer>
        </>}
      </Stack>
    </Paper>
  );
}

const summarizeLot = (lot) => {
  const totals = lot.balances.reduce((acc, balance) => ({ ...acc, [balance.status]: roundKg((acc[balance.status] || 0) + balance.quantityKg) }), {});
  const physical = roundKg(lot.balances.reduce((sum, balance) => sum + balance.quantityKg, 0));
  return { totals, physical, available: lot.documentaryHold ? 0 : (totals.LIBERADO || 0) };
};

const syncReception = (reception, lot) => {
  if (reception.id !== lot.receptionId) return reception;
  const summary = summarizeLot(lot);
  const statuses = Object.keys(summary.totals).filter((status) => summary.totals[status] > 0);
  const qualitySummary = statuses.length > 1 ? 'PARCIAL' : statuses[0] || 'PENDIENTE';
  const primary = lot.balances.find((balance) => balance.quantityKg > 0) || lot.balances[0];
  return {
    ...reception,
    physicalKg: summary.physical,
    availableKg: summary.available,
    qualitySummary,
    locationId: primary?.locationId || reception.locationId,
    locationName: primary?.locationId || reception.locationName,
    documentaryHold: { active: lot.documentaryHold, reason: lot.documentaryHold ? 'Retención mock activa' : null },
    allocations: lot.balances.map((balance) => ({ id: balance.id, status: balance.status, quantityKg: balance.quantityKg, locationId: balance.locationId, reason: 'Operación mock desde inventario', decidedBy: balance.status === 'PENDIENTE' ? null : 'Actor configurado · local' })),
    events: [...reception.events, lot.events.at(-1)].filter(Boolean),
  };
};

function LotMetrics({ lot }) {
  const summary = summarizeLot(lot);
  return <Grid container spacing={1.25}>{[
    ['Existencia física', summary.physical, '#1E3A5F'],
    ['Disponible', summary.available, '#2E7D32'],
    ['Pendiente', summary.totals.PENDIENTE, '#F57C00'],
    ['Bloqueado/rechazado', (summary.totals.BLOQUEADO || 0) + (summary.totals.RECHAZADO || 0), '#C62828'],
  ].map(([label, value, color]) => <Grid key={label} size={{ xs: 6, md: 3 }}><Paper variant="outlined" sx={{ p: 1.5, borderLeft: `4px solid ${color}` }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="h6" sx={{ fontWeight: 850 }}>{formatKg(value)}</Typography></Paper></Grid>)}</Grid>;
}

export function InventoryOperationsPanel({ workspace, onWorkspaceChange, initialTab = 0 }) {
  const [selectedId, setSelectedId] = useState(workspace.lots[0]?.id);
  const [tab, setTab] = useState(initialTab);
  const [qualityStatus, setQualityStatus] = useState('LIBERADO');
  const [qualityQty, setQualityQty] = useState('');
  const [movementBalanceId, setMovementBalanceId] = useState('');
  const [movementQty, setMovementQty] = useState('');
  const [destinationId, setDestinationId] = useState('ALM-MP-01');
  const [correctionDelta, setCorrectionDelta] = useState('-1');
  const [returnQty, setReturnQty] = useState('');
  const [message, setMessage] = useState('');
  const lot = workspace.lots.find((item) => item.id === selectedId) || workspace.lots[0];
  const compatibleLocations = workspace.locations.filter((item) => item.active && item.scope === 'MATERIA_PRIMA');
  const selectedBalanceId = movementBalanceId || lot?.balances[0]?.id;

  const applyLot = (nextLot, extra = {}) => {
    onWorkspaceChange({
      ...workspace,
      ...extra,
      lots: workspace.lots.map((item) => item.id === nextLot.id ? nextLot : item),
      receptions: workspace.receptions.map((item) => syncReception(item, nextLot)),
    });
  };
  const withEvent = (current, type, detail, actor) => ({ ...current, events: [...current.events, { id: `LOT-EVT-${current.id}-${current.events.length + 1}`, type, detail, actor, time: nowLabel() }] });
  const qualityDecision = () => {
    const pending = lot.balances.find((balance) => balance.status === 'PENDIENTE' && balance.quantityKg > 0);
    const quantity = roundKg(qualityQty || pending?.quantityKg);
    if (!pending || quantity <= 0 || quantity > pending.quantityKg) { setMessage('La cantidad debe ser positiva y no superar el saldo PENDIENTE.'); return; }
    const destination = qualityStatus === 'LIBERADO' ? 'ALM-MP-01' : qualityStatus === 'BLOQUEADO' ? 'MP-BLOQUEADOS' : 'MP-DEVOLUCIONES';
    const balances = lot.balances.flatMap((balance) => {
      if (balance.id !== pending.id) return [balance];
      const rows = [];
      if (balance.quantityKg > quantity) rows.push({ ...balance, quantityKg: roundKg(balance.quantityKg - quantity) });
      rows.push({ id: `SAL-${lot.id}-${lot.balances.length + 1}`, status: qualityStatus, locationId: destination, quantityKg: quantity });
      return rows;
    });
    applyLot(withEvent({ ...lot, balances }, 'DECISION_CALIDAD', `${formatKg(quantity)} pasaron de PENDIENTE a ${qualityStatus}.`, 'TRB-CAL-01 · Luis Calidad'));
    setQualityQty('');
    setMessage('Decisión parcial de Calidad aplicada en memoria sin cambiar la procedencia.');
  };
  const move = () => {
    const source = lot.balances.find((balance) => balance.id === selectedBalanceId);
    const quantity = roundKg(movementQty || source?.quantityKg);
    const destination = compatibleLocations.find((item) => item.id === destinationId);
    if (!source || !destination || quantity <= 0 || quantity > source.quantityKg) { setMessage('Movimiento inválido: revisa saldo, cantidad y destino compatible.'); return; }
    const balances = lot.balances.flatMap((balance) => {
      if (balance.id !== source.id) return [balance];
      const rows = [];
      if (balance.quantityKg > quantity) rows.push({ ...balance, quantityKg: roundKg(balance.quantityKg - quantity) });
      rows.push({ id: `SAL-${lot.id}-${lot.balances.length + 1}`, status: balance.status, locationId: destination.id, quantityKg: quantity });
      return rows;
    });
    applyLot(withEvent({ ...lot, balances }, 'MOVIMIENTO_INTERNO', `${formatKg(quantity)} movidos de ${source.locationId} a ${destination.id}; estado ${source.status} conservado.`, 'TRB-ALM-01 · Rosa Almacén'));
    setMovementQty('');
    setMessage('Movimiento aplicado; el total físico y la genealogía se conservaron.');
  };
  const toggleHold = () => {
    const active = !lot.documentaryHold;
    applyLot(withEvent({ ...lot, documentaryHold: active }, active ? 'RETENCION_DOCUMENTAL' : 'REGULARIZACION_DOCUMENTAL', active ? 'Disponibilidad retenida por documentación.' : 'Retención regularizada por supervisor distinto.', active ? 'TRB-ALM-01 · Rosa Almacén' : 'TRB-SUP-01 · Supervisor suplente'));
    setMessage(active ? 'Retención documental activa: existe stock, pero no está disponible.' : 'Retención regularizada; se recalculó la disponibilidad.');
  };
  const requestCorrection = () => {
    const correction = { id: `COR-DEMO-${workspace.corrections.length + 1}`, receptionId: lot.receptionId, lotId: lot.id, type: 'CANTIDAD', deltaKg: roundKg(correctionDelta), reason: 'Corrección mock solicitada desde el lote', status: 'PENDIENTE_GERENCIA', requestedBy: 'TRB-ALM-01 · Rosa Almacén', approvedBy: null };
    onWorkspaceChange({ ...workspace, corrections: [...workspace.corrections, correction] });
    setMessage('Corrección solicitada. No cambió inventario y espera decisión de Gerencia.');
  };
  const resolveCorrection = (correction, decision) => {
    let nextLot = lot;
    if (decision === 'APLICAR' && correction.deltaKg) {
      const target = lot.balances.find((balance) => balance.quantityKg + correction.deltaKg >= 0);
      if (!target) { setMessage('La compensación excede la existencia corregible; operación rechazada sin efectos.'); return; }
      nextLot = withEvent({ ...lot, balances: lot.balances.map((balance) => balance.id === target.id ? { ...balance, quantityKg: roundKg(balance.quantityKg + correction.deltaKg) } : balance) }, 'CORRECCION_COMPENSATORIA', `Gerencia aplicó ${formatKg(correction.deltaKg)} sin sobrescribir la recepción original.`, 'TRB-GER-01 · Gerencia de planta');
    } else if (decision === 'APLICAR') {
      nextLot = withEvent(lot, 'CORRECCION_PROCEDENCIA', 'Gerencia aprobó una corrección de procedencia; before/after permanecen auditados.', 'TRB-GER-01 · Gerencia de planta');
    }
    const corrections = workspace.corrections.map((item) => item.id === correction.id ? { ...item, status: decision === 'APLICAR' ? 'APLICADA' : 'RECHAZADA', approvedBy: 'TRB-GER-01 · Gerencia de planta' } : item);
    applyLot(nextLot, { corrections });
    setMessage(`Corrección ${decision === 'APLICAR' ? 'aplicada' : 'rechazada'} por Gerencia en memoria.`);
  };
  const registerReturn = () => {
    const source = lot.balances.find((balance) => ['BLOQUEADO', 'RECHAZADO'].includes(balance.status) && balance.quantityKg > 0);
    const quantity = roundKg(returnQty || source?.quantityKg);
    if (!source || quantity <= 0 || quantity > source.quantityKg) { setMessage('Solo puede devolverse saldo BLOQUEADO o RECHAZADO y sin exceder su existencia.'); return; }
    const balances = lot.balances.map((balance) => balance.id === source.id ? { ...balance, quantityKg: roundKg(balance.quantityKg - quantity) } : balance).filter((balance) => balance.quantityKg > 0);
    const supplierReturn = { id: `DEV-${String(workspace.supplierReturns.length + 1).padStart(4, '0')}`, lotId: lot.id, providerId: lot.providerId, quantityKg: quantity, status: 'APLICADA', reason: 'Devolución mock acordada', actor: 'TRB-ALM-01 · Rosa Almacén' };
    applyLot(withEvent({ ...lot, balances }, 'DEVOLUCION_PROVEEDOR', `${formatKg(quantity)} devueltos al proveedor desde ${source.status}.`, 'TRB-ALM-01 · Rosa Almacén'), { supplierReturns: [...workspace.supplierReturns, supplierReturn] });
    setReturnQty('');
    setMessage('Devolución registrada como evento propio; no reabrió la OC ni borró la recepción.');
  };

  if (!lot) return <Alert severity="info">No existen lotes mock.</Alert>;
  const summary = summarizeLot(lot);
  return (
    <Stack spacing={2}>
      {message && <Alert severity={message.includes('inválid') || message.includes('excede') ? 'error' : 'success'} onClose={() => setMessage('')}>{message}</Alert>}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 4 }}><Paper variant="outlined" sx={{ overflow: 'hidden' }}><Box sx={{ p: 2, bgcolor: '#FAFBFC' }}><Typography variant="h6" sx={{ fontWeight: 850 }}>Inventario por lote</Typography><Typography variant="caption">Saldos por ubicación, Calidad y retención</Typography></Box><List disablePadding>{workspace.lots.map((item) => { const itemSummary = summarizeLot(item); return <ListItemButton key={item.id} selected={item.id === lot.id} onClick={() => { setSelectedId(item.id); setTab(0); setMovementBalanceId(''); }} sx={{ borderTop: '1px solid #EEEEEE' }}><Stack width="100%"><Stack direction="row" justifyContent="space-between"><Typography sx={{ fontWeight: 850 }}>{item.id}</Typography>{item.documentaryHold && <Chip size="small" color="warning" label="RETENIDO" />}</Stack><Typography variant="body2">{item.materialName}</Typography><Typography variant="caption">{formatKg(itemSummary.physical)} físico · {formatKg(itemSummary.available)} disponible</Typography></Stack></ListItemButton>; })}</List></Paper></Grid>
        <Grid size={{ xs: 12, lg: 8 }}><Paper variant="outlined" sx={{ overflow: 'hidden' }}><Stack spacing={1.5} sx={{ p: 2 }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between"><Box><Typography variant="overline">{lot.receptionId} · {lot.providerName}</Typography><Typography variant="h5" sx={{ fontWeight: 850 }}>{lot.id}</Typography><Typography variant="body2">{lot.materialCode} · {lot.materialName}</Typography></Box><Chip icon={lot.documentaryHold ? <LockOutlinedIcon /> : <Inventory2OutlinedIcon />} label={lot.documentaryHold ? 'RETENCIÓN ACTIVA' : 'CUSTODIA ACTIVA'} color={lot.documentaryHold ? 'warning' : 'success'} /></Stack><LotMetrics lot={lot} /></Stack><Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto"><Tab label="Saldos" /><Tab label="Calidad y movimientos" /><Tab label="Correcciones y devolución" /><Tab label="Trazabilidad" /></Tabs><Divider />
          <Box sx={{ p: 2 }}>
            {tab === 0 && <Stack spacing={2}><Alert severity="info">Disponible = LIBERADO sin retención documental. La existencia física suma todos los estados y ubicaciones.</Alert><TableContainer><Table size="small" aria-label={`Saldos de ${lot.id}`}><TableHead><TableRow sx={{ bgcolor: '#F4F6F8' }}><TableCell>Estado Calidad</TableCell><TableCell>Ubicación</TableCell><TableCell align="right">Cantidad</TableCell><TableCell>Disponibilidad</TableCell></TableRow></TableHead><TableBody>{lot.balances.map((balance) => <TableRow key={balance.id}><TableCell><Chip size="small" label={balance.status} color={balance.status === 'LIBERADO' ? 'success' : balance.status === 'PENDIENTE' ? 'warning' : 'error'} /></TableCell><TableCell>{balance.locationId}</TableCell><TableCell align="right">{formatKg(balance.quantityKg)}</TableCell><TableCell>{balance.status === 'LIBERADO' && !lot.documentaryHold ? 'DISPONIBLE' : 'NO DISPONIBLE'}</TableCell></TableRow>)}</TableBody></Table></TableContainer><Button variant="outlined" color={lot.documentaryHold ? 'success' : 'warning'} onClick={toggleHold}>{lot.documentaryHold ? 'Regularizar como Supervisor' : 'Registrar retención documental'}</Button></Stack>}
            {tab === 1 && <Stack spacing={2}><Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={1.5}><Stack direction="row" spacing={1} alignItems="center"><FactCheckOutlinedIcon color="primary" /><Typography variant="h6">Decisión parcial de Calidad</Typography></Stack><Grid container spacing={1.5}><Grid size={{ xs: 12, md: 4 }}><TextField fullWidth select label="Estado destino" value={qualityStatus} onChange={(event) => setQualityStatus(event.target.value)}><MenuItem value="LIBERADO">Liberado</MenuItem><MenuItem value="BLOQUEADO">Bloqueado</MenuItem><MenuItem value="RECHAZADO">Rechazado</MenuItem></TextField></Grid><Grid size={{ xs: 12, md: 4 }}><TextField fullWidth type="number" label="Cantidad a resolver (kg)" value={qualityQty} onChange={(event) => setQualityQty(event.target.value)} placeholder={String(summary.totals.PENDIENTE || 0)} /></Grid><Grid size={{ xs: 12, md: 4 }}><Button fullWidth sx={{ height: '100%' }} variant="contained" onClick={qualityDecision}>Aplicar decisión mock</Button></Grid></Grid></Stack></Paper><Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={1.5}><Stack direction="row" spacing={1} alignItems="center"><MoveDownOutlinedIcon color="primary" /><Typography variant="h6">Movimiento interno</Typography></Stack><Grid container spacing={1.5}><Grid size={{ xs: 12, md: 4 }}><TextField fullWidth select label="Saldo origen" value={selectedBalanceId} onChange={(event) => setMovementBalanceId(event.target.value)}>{lot.balances.map((balance) => <MenuItem key={balance.id} value={balance.id}>{balance.status} · {balance.locationId} · {formatKg(balance.quantityKg)}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, md: 3 }}><TextField fullWidth type="number" label="Cantidad (kg)" value={movementQty} onChange={(event) => setMovementQty(event.target.value)} /></Grid><Grid size={{ xs: 12, md: 3 }}><TextField fullWidth select label="Destino compatible" value={destinationId} onChange={(event) => setDestinationId(event.target.value)}>{compatibleLocations.map((item) => <MenuItem key={item.id} value={item.id}>{item.id} · {item.name}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, md: 2 }}><Button fullWidth sx={{ height: '100%' }} variant="outlined" onClick={move}>Mover</Button></Grid></Grid><Alert severity="warning">Las ubicaciones de piezas y producto terminado quedan excluidas deliberadamente.</Alert></Stack></Paper></Stack>}
            {tab === 2 && <Stack spacing={2}><Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={1.5}><Typography variant="h6">Corrección compensatoria</Typography><Alert severity="info">Solicitar no cambia inventario. Gerencia aplica o rechaza después, conservando el valor original.</Alert><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField type="number" label="Delta de cantidad (kg)" value={correctionDelta} onChange={(event) => setCorrectionDelta(event.target.value)} /><Button variant="outlined" onClick={requestCorrection}>Solicitar corrección</Button></Stack>{workspace.corrections.filter((item) => item.lotId === lot.id).map((item) => <Paper key={item.id} variant="outlined" sx={{ p: 1.5 }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}><Box><Typography variant="body2" sx={{ fontWeight: 800 }}>{item.id} · {item.type} · {item.status}</Typography><Typography variant="caption">Delta {formatKg(item.deltaKg)} · {item.reason}</Typography></Box>{item.status === 'PENDIENTE_GERENCIA' && <Stack direction="row"><Button size="small" color="error" onClick={() => resolveCorrection(item, 'RECHAZAR')}>Rechazar</Button><Button size="small" variant="contained" onClick={() => resolveCorrection(item, 'APLICAR')}>Aprobar Gerencia</Button></Stack>}</Stack></Paper>)}</Stack></Paper><Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={1.5}><Stack direction="row" spacing={1} alignItems="center"><LocalShippingOutlinedIcon color="primary" /><Typography variant="h6">Devolución a proveedor</Typography></Stack><Typography variant="body2">Solo usa saldo BLOQUEADO o RECHAZADO. No reabre la OC y no borra la recepción.</Typography><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField type="number" label="Cantidad a devolver (kg)" value={returnQty} onChange={(event) => setReturnQty(event.target.value)} /><Button variant="outlined" color="error" onClick={registerReturn}>Registrar devolución</Button></Stack>{workspace.supplierReturns.filter((item) => item.lotId === lot.id).map((item) => <Alert key={item.id} severity="success">{item.id}: {formatKg(item.quantityKg)} devueltos · {item.status}</Alert>)}</Stack></Paper></Stack>}
            {tab === 3 && <Stack spacing={1.25}><Alert severity="info">Genealogía: {lot.id} ← {lot.receptionId} ← documento/OC ← proveedor {lot.providerId}.</Alert>{lot.events.slice().reverse().map((event) => <Paper key={event.id} variant="outlined" sx={{ p: 1.5, borderLeft: '4px solid #1E3A5F' }}><Typography variant="body2" sx={{ fontWeight: 800 }}>{event.type.replaceAll('_', ' ')}</Typography><Typography variant="body2">{event.detail}</Typography><Typography variant="caption" color="text.secondary">{event.actor} · {event.time}</Typography></Paper>)}</Stack>}
          </Box>
        </Paper></Grid>
      </Grid>
    </Stack>
  );
}

export function DocumentsOperationsPanel({ workspace, onWorkspaceChange }) {
  const [selectedId, setSelectedId] = useState(workspace.supplierDocuments[0]?.id);
  const [message, setMessage] = useState('');
  const selected = workspace.supplierDocuments.find((item) => item.id === selectedId) || workspace.supplierDocuments[0];
  const updateSelected = (changes) => onWorkspaceChange({ ...workspace, supplierDocuments: workspace.supplierDocuments.map((item) => item.id === selected.id ? { ...item, ...changes } : item) });
  const addDocument = () => {
    const id = `DOC-DEMO-${workspace.supplierDocuments.length + 1}`;
    const document = { id, providerId: 1, type: 'GUIA_REMISION', series: 'DEMO', number: String(workspace.supplierDocuments.length + 1).padStart(4, '0'), issueDate: '2026-07-21', documentaryKg: 1000, receptionId: null, lines: [{ id: `DOC-L-DEMO-${workspace.supplierDocuments.length + 1}`, description: 'Descripción externa pendiente de conciliación', supplierCode: 'EXT-DEMO', quantity: 1000, unit: 'KG', reconciledMaterialCode: null }], attachments: [] };
    onWorkspaceChange({ ...workspace, supplierDocuments: [document, ...workspace.supplierDocuments] });
    setSelectedId(id);
    setMessage('Documento externo creado como borrador local; todavía no autoriza una compra ni crea inventario.');
  };
  const addAttachment = () => {
    const attachmentCount = workspace.supplierDocuments.reduce((sum, item) => sum + item.attachments.length, 0);
    const attachment = { id: `ADJ-DEMO-${attachmentCount + 1}`, typeId: 'GUIA_PROVEEDOR', name: `evidencia-${selected.id}.pdf`, status: 'VIGENTE', replacesId: null };
    updateSelected({ attachments: [...selected.attachments, attachment] });
    setMessage('Adjunto mock agregado. Solo se guardan metadatos visuales, no bytes.');
  };
  const replaceAttachment = (attachment) => {
    const attachmentCount = workspace.supplierDocuments.reduce((sum, item) => sum + item.attachments.length, 0);
    const replacement = { id: `ADJ-DEMO-${attachmentCount + 1}`, typeId: attachment.typeId, name: `reemplazo-${attachment.name}`, status: 'VIGENTE', replacesId: attachment.id };
    updateSelected({ attachments: [...selected.attachments.map((item) => item.id === attachment.id ? { ...item, status: 'REEMPLAZADO' } : item), replacement] });
    setMessage('Evidencia reemplazada sin borrar el archivo histórico.');
  };
  const discard = () => {
    const remaining = workspace.supplierDocuments.filter((item) => item.id !== selected.id);
    onWorkspaceChange({ ...workspace, supplierDocuments: remaining });
    setSelectedId(remaining[0]?.id);
    setMessage('Borrador documental sin vínculos descartado del estado local.');
  };
  if (!selected) return <Alert severity="info">No existen documentos.</Alert>;
  return (
    <Stack spacing={2}>
      {message && <Alert severity="success" onClose={() => setMessage('')}>{message}</Alert>}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 4 }}><Paper variant="outlined" sx={{ overflow: 'hidden' }}><Stack direction="row" justifyContent="space-between" sx={{ p: 2 }}><Box><Typography variant="h6" sx={{ fontWeight: 850 }}>Documentos externos</Typography><Typography variant="caption">Evidencia, no autorización interna</Typography></Box><Button size="small" startIcon={<AddOutlinedIcon />} onClick={addDocument}>Nuevo</Button></Stack><List disablePadding>{workspace.supplierDocuments.map((item) => <ListItemButton key={item.id} selected={item.id === selected.id} onClick={() => setSelectedId(item.id)} sx={{ borderTop: '1px solid #EEEEEE' }}><Stack><Typography sx={{ fontWeight: 800 }}>{item.type} · {item.series}-{item.number}</Typography><Typography variant="caption">{item.id} · {formatKg(item.documentaryKg)} · {item.receptionId || 'Sin recepción'}</Typography></Stack></ListItemButton>)}</List></Paper></Grid>
        <Grid size={{ xs: 12, lg: 8 }}><Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={2}><Stack direction="row" justifyContent="space-between"><Box><Typography variant="overline">{selected.id}</Typography><Typography variant="h5" sx={{ fontWeight: 850 }}>{selected.series}-{selected.number}</Typography></Box><Chip label={selected.receptionId ? `VINCULADO ${selected.receptionId}` : 'BORRADOR EXTERNO'} color={selected.receptionId ? 'success' : 'default'} /></Stack><Alert severity="warning">La guía prueba lo declarado por el proveedor. No prueba aprobación de compra, medición interna, custodia ni liberación.</Alert><Grid container spacing={1.5}><Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label="Fecha emisión" value={selected.issueDate} onChange={(event) => updateSelected({ issueDate: event.target.value })} /></Grid><Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth type="number" label="Cantidad documental kg" value={selected.documentaryKg} onChange={(event) => updateSelected({ documentaryKg: Number(event.target.value) })} /></Grid><Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth select label="Proveedor" value={selected.providerId} onChange={(event) => updateSelected({ providerId: Number(event.target.value) })}>{workspace.providers.map((item) => <MenuItem key={item.id} value={item.id}>{item.code}</MenuItem>)}</TextField></Grid></Grid><TableContainer><Table size="small" aria-label="Conciliación documental"><TableHead><TableRow sx={{ bgcolor: '#F4F6F8' }}><TableCell>Descripción original</TableCell><TableCell>Código proveedor</TableCell><TableCell>Cantidad externa</TableCell><TableCell>Material interno conciliado</TableCell></TableRow></TableHead><TableBody>{selected.lines.map((line) => <TableRow key={line.id}><TableCell>{line.description}</TableCell><TableCell>{line.supplierCode}</TableCell><TableCell>{line.quantity} {line.unit}</TableCell><TableCell><TextField size="small" select aria-label={`Conciliar ${line.id}`} value={line.reconciledMaterialCode || ''} onChange={(event) => updateSelected({ lines: selected.lines.map((item) => item.id === line.id ? { ...item, reconciledMaterialCode: event.target.value } : item) })}><MenuItem value="">Pendiente</MenuItem>{workspace.materials.map((item) => <MenuItem key={item.id} value={item.code}>{item.code}</MenuItem>)}</TextField></TableCell></TableRow>)}</TableBody></Table></TableContainer><Divider /><Stack direction="row" justifyContent="space-between"><Typography variant="h6">Evidencias</Typography><Button startIcon={<AttachFileOutlinedIcon />} onClick={addAttachment}>Adjuntar mock</Button></Stack>{selected.attachments.length === 0 && <Alert severity="info">Sin adjuntos. Una recepción ordinaria no podrá confirmarse así.</Alert>}{selected.attachments.map((attachment) => <Paper key={attachment.id} variant="outlined" sx={{ p: 1.25 }}><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography variant="body2" sx={{ fontWeight: 800 }}>{attachment.name}</Typography><Typography variant="caption">{attachment.typeId} · {attachment.status}{attachment.replacesId ? ` · reemplaza ${attachment.replacesId}` : ''}</Typography></Box>{attachment.status === 'VIGENTE' && <Button size="small" onClick={() => replaceAttachment(attachment)}>Reemplazar</Button>}</Stack></Paper>)}{!selected.receptionId && <Button color="error" onClick={discard}>Descartar borrador documental</Button>}</Stack></Paper></Grid>
      </Grid>
    </Stack>
  );
}

const scenarioTitles = [
  'Confirmar una recepción de un lote', 'Un borrador no afecta inventario', 'Separar lotes de proveedor', 'Lote obligatorio ilegible', 'Rechazar cantidad inválida', 'Reintento idempotente', 'Conflicto de clave repetida', 'Liberar un lote', 'Bloquear un lote liberado', 'Impedir decisión no autorizada', 'Movimiento conserva total', 'Impedir stock negativo', 'Corrección no destructiva', 'Trazabilidad hacia atrás', 'Fallo atómico de confirmación', 'Entrega parcial de OC', 'Guía relacionada con más de una OC', 'Cantidad nominal y peso medido', 'Entrada excepcional sin OC', 'Regularizar entrada excepcional', 'Resolver lote ilegible', 'Liberación directa autorizada', 'Retirar liberación directa', 'Resolver parte de un lote', 'Inspección impide liberación directa', 'Ubicación compatible', 'Impedir destino de piezas', 'Tolerancia aprobada', 'Decisión fuera de tolerancia', 'Conteo y peso de sacos', 'Editar borrador', 'No editar recepción confirmada', 'Gerencia aprueba corrección', 'Rechazo antes de custodia', 'Devolución completa', 'Devolución parcial', 'Impedir devolución excesiva', 'Corregir procedencia', 'Impedir compensación sobre consumo', 'Crear y aprobar OC', 'Guía no sustituye autorización', 'Conciliar guía y evidencias', 'Reintento de documento externo', 'Virgen confía en proveedor', 'Segunda pesa bolsa por bolsa', 'Lote externo opcional',
];

const scenarioArea = (number) => {
  if (number <= 7) return 'Recepción e idempotencia';
  if (number <= 10) return 'Calidad y autorización';
  if (number <= 15) return 'Inventario y auditoría';
  if (number <= 23) return 'OC, documentos y políticas';
  if (number <= 30) return 'Calidad, ubicaciones y tolerancias';
  if (number <= 39) return 'Borradores, correcciones y devoluciones';
  return 'Compras, documentos y modalidades';
};

const scenarioSurface = (number) => {
  if ([6, 7, 15, 43].includes(number)) return 'Evidencia visual';
  if ([1, 2, 3, 4, 5, 18, 19, 21, 28, 29, 30, 31, 32, 34, 44, 45, 46].includes(number)) return 'Recepciones';
  if ([8, 9, 10, 11, 12, 13, 14, 20, 22, 23, 24, 25, 26, 27, 33, 35, 36, 37, 38, 39].includes(number)) return 'Lotes e inventario';
  if ([40, 41].includes(number)) return 'Órdenes de compra';
  return 'Documentos externos';
};

export function CoveragePanel({ workspace }) {
  const [filter, setFilter] = useState('TODOS');
  const scenarios = useMemo(() => scenarioTitles.map((title, index) => ({ number: index + 1, title, area: scenarioArea(index + 1), surface: scenarioSurface(index + 1) })), []);
  const visible = scenarios.filter((item) => filter === 'TODOS' || item.surface === filter);
  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}><Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}><Box><Typography variant="h5" sx={{ fontWeight: 850 }}>Cobertura visual REC-01 a REC-46</Typography><Typography variant="body2" color="text.secondary">Mapa de la especificación a las superficies del prototipo. “Evidencia visual” demuestra estados de error/idempotencia, no una transacción real.</Typography></Box><TextField select label="Filtrar superficie" value={filter} onChange={(event) => setFilter(event.target.value)} sx={{ minWidth: 230 }}><MenuItem value="TODOS">Todas</MenuItem>{['Recepciones', 'Lotes e inventario', 'Órdenes de compra', 'Documentos externos', 'Evidencia visual'].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField></Stack></Paper>
      <Grid container spacing={1.25}>{visible.map((item) => <Grid key={item.number} size={{ xs: 12, md: 6, xl: 4 }}><Paper variant="outlined" sx={{ p: 1.5, height: '100%', borderLeft: `4px solid ${item.surface === 'Evidencia visual' ? '#F57C00' : '#2E7D32'}` }}><Stack direction="row" justifyContent="space-between" gap={1}><Box><Typography variant="body2" sx={{ fontWeight: 850 }}>REC-{String(item.number).padStart(2, '0')}</Typography><Typography variant="body2">{item.title}</Typography><Typography variant="caption" color="text.secondary">{item.area}</Typography></Box><Chip size="small" label={item.surface} color={item.surface === 'Evidencia visual' ? 'warning' : 'success'} variant="outlined" /></Stack></Paper></Grid>)}</Grid>
      <Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={1}><Stack direction="row" spacing={1} alignItems="center"><RuleOutlinedIcon color="primary" /><Typography variant="h6">Controles transaccionales representados</Typography></Stack>{workspace.operationLog.map((operation) => <Alert key={operation.id} severity="info" icon={<AutorenewOutlinedIcon />}><strong>{operation.id} · {operation.aggregate} · {operation.result}</strong><br />{operation.detail}</Alert>)}</Stack></Paper>
    </Stack>
  );
}
