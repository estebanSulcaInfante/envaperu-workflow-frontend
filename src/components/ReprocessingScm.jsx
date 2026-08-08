import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControl, FormControlLabel, IconButton, InputLabel, LinearProgress, MenuItem,
  Paper, Select, Stack, Tab, Tabs, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography, Switch,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import ScaleOutlinedIcon from '@mui/icons-material/ScaleOutlined';
import RecyclingOutlinedIcon from '@mui/icons-material/RecyclingOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from './ui/PageHeader';
import { useScmActor } from '../context/ScmActorContext';
import { mensajeErrorScm } from '../services/scmEngineeringApi';
import {
  agregarAporteMolienda, aprobarExcepcionMolienda,
  aprobarReglaCompatibilidad, actualizarMaestroReproceso,
  autorizarDiferenciaCustodia,
  cerrarOrdenMolienda, crearMaestroReproceso, crearOrdenMolienda,
  crearReglaCompatibilidad, iniciarOrdenMolienda, liberarLoteRecuperado,
  listarLotesRecuperados, listarMaestroReproceso, listarMermas,
  listarOrdenesMolienda, listarReferenciasReproceso,
  listarReglasCompatibilidad, registrarMerma, registrarPesosPreMolino,
  validarOrdenMolienda,
} from '../services/scmReprocessingApi';

const MASTER_TYPES = [
  { value: 'familias-material', label: 'Familias de material' },
  { value: 'procesos', label: 'Procesos de origen' },
  { value: 'condiciones', label: 'Condiciones de merma' },
];

const stateColor = (state) => ({
  DISPONIBLE: 'success', VALIDADA: 'success', CERRADA: 'success',
  EN_EJECUCION: 'info', ALMACENADA: 'info', RESERVADA: 'warning',
  BLOQUEADA_COMPATIBILIDAD: 'error', BLOQUEADA: 'error', ANULADA: 'default',
  PENDIENTE_LIBERACION: 'warning', BORRADOR: 'default',
}[state] || 'default');

const selectItems = (items, label = (item) => `${item.codigo} · ${item.nombre}`) => (
  items.map((item) => <MenuItem key={item.id} value={item.id}>{label(item)}</MenuItem>)
);

const required = (value) => value !== '' && value !== null && value !== undefined;

export default function ReprocessingScm({ initialTab = 0 }) {
  const { can, experience } = useScmActor();
  const [tab, setTab] = useState(initialTab);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refs, setRefs] = useState({
    familias_material: [], procesos: [], condiciones: [], colores: [],
    familias_color: [], materiales_salida: [], ubicaciones: [],
  });
  const [scrap, setScrap] = useState([]);
  const [orders, setOrders] = useState([]);
  const [recovered, setRecovered] = useState([]);
  const [rules, setRules] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [dialog, setDialog] = useState('');
  const [reasonTarget, setReasonTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [masterType, setMasterType] = useState('familias-material');
  const [masterItems, setMasterItems] = useState([]);
  const [masterForm, setMasterForm] = useState({ codigo: '', nombre: '', descripcion: '', recuperable: true });
  const [scrapForm, setScrapForm] = useState({
    familia_material_id: '', proceso_origen_id: '', condicion_id: '',
    color_id: '', familia_color_id: '', material_id: '',
    origen_tipo: 'FABRICACION', origen_id: '', peso_bruto_kg: '', tara_kg: '0',
    ubicacion_codigo: 'ALMACEN_MERMA', observaciones: '',
  });
  const [orderForm, setOrderForm] = useState({
    familia_objetivo_id: '', proceso_objetivo_id: '', color_objetivo_id: '',
    familia_color_objetivo_id: '', material_salida_id: '',
    tolerancia_custodia_kg: '1.000', tolerancia_balance_kg: '', notas: '',
  });
  const [inputForm, setInputForm] = useState({ lote_merma_id: '', cantidad_planificada_kg: '' });
  const [weights, setWeights] = useState({});
  const [closeForm, setCloseForm] = useState({
    perdida_kg: '',
    salidas: [{ peso_neto_kg: '', ubicacion_codigo: 'ALMACEN_RECUPERADO' }],
  });
  const [ruleForm, setRuleForm] = useState({
    codigo: '', nombre: '', familia_objetivo_id: '', proceso_objetivo_id: '',
    familia_aporte_id: '', proceso_aporte_id: '', resultado: 'COMPATIBLE',
    porcentaje_maximo: '', simetrica: false,
  });

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const [referencePayload, scrapPayload, orderPayload, recoveredPayload, rulePayload] = await Promise.all([
        listarReferenciasReproceso(), listarMermas(), listarOrdenesMolienda(),
        listarLotesRecuperados(), listarReglasCompatibilidad(),
      ]);
      setRefs(referencePayload);
      setScrap(scrapPayload.items || []);
      setOrders(orderPayload.items || []);
      setRecovered(recoveredPayload.items || []);
      setRules(rulePayload.items || []);
      setSelectedOrderId((current) => current || orderPayload.items?.[0]?.id || '');
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo cargar el módulo de reproceso.'));
    } finally {
      setBusy(false);
    }
  }, []);

  const loadMaster = useCallback(async () => {
    try {
      const payload = await listarMaestroReproceso(masterType);
      setMasterItems(payload.items || []);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo cargar el maestro.'));
    }
  }, [masterType]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 4) loadMaster(); }, [loadMaster, tab]);
  useEffect(() => { setTab(initialTab); }, [initialTab]);

  const selectedOrder = useMemo(
    () => orders.find((item) => item.id === selectedOrderId) || null,
    [orders, selectedOrderId],
  );
  const freeScrap = useMemo(
    () => scrap.filter((item) => Number(item.saldo_libre_kg) > 0 && !['BLOQUEADA', 'ANULADA'].includes(item.estado)),
    [scrap],
  );
  const totals = useMemo(() => ({
    scrap: scrap.reduce((sum, item) => sum + Number(item.saldo_disponible_kg || 0), 0),
    reserved: scrap.reduce((sum, item) => sum + Number(item.saldo_reservado_kg || 0), 0),
    recovered: recovered.filter((item) => item.estado === 'DISPONIBLE').reduce((sum, item) => sum + Number(item.saldo_disponible_kg || 0), 0),
    pending: recovered.filter((item) => item.estado === 'PENDIENTE_LIBERACION').length,
  }), [recovered, scrap]);

  const run = async (action, success) => {
    setBusy(true);
    setError('');
    try {
      await action();
      setNotice(success);
      setDialog('');
      await load();
      if (tab === 4) await loadMaster();
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'La acción no pudo completarse.'));
    } finally {
      setBusy(false);
    }
  };

  const createScrap = () => {
    const mandatory = ['familia_material_id', 'proceso_origen_id', 'condicion_id', 'color_id', 'origen_id', 'peso_bruto_kg'];
    if (!mandatory.every((key) => required(scrapForm[key]))) {
      setError('Completa clasificación, origen y peso bruto antes de guardar.');
      return;
    }
    run(() => registrarMerma({
      ...scrapForm,
      familia_material_id: Number(scrapForm.familia_material_id),
      proceso_origen_id: Number(scrapForm.proceso_origen_id),
      condicion_id: Number(scrapForm.condicion_id),
      color_id: Number(scrapForm.color_id),
      familia_color_id: scrapForm.familia_color_id ? Number(scrapForm.familia_color_id) : null,
      material_id: scrapForm.material_id ? Number(scrapForm.material_id) : null,
      peso_bruto_kg: Number(scrapForm.peso_bruto_kg), tara_kg: Number(scrapForm.tara_kg || 0),
    }), 'Bolsa de merma pesada y acreditada en el subledger de kg.');
  };

  const createOrder = () => {
    const mandatory = ['familia_objetivo_id', 'proceso_objetivo_id', 'color_objetivo_id', 'material_salida_id'];
    if (!mandatory.every((key) => required(orderForm[key]))) {
      setError('Define familia, proceso, color y material de salida.');
      return;
    }
    run(() => crearOrdenMolienda({
      ...orderForm,
      familia_objetivo_id: Number(orderForm.familia_objetivo_id),
      proceso_objetivo_id: Number(orderForm.proceso_objetivo_id),
      color_objetivo_id: Number(orderForm.color_objetivo_id),
      familia_color_objetivo_id: orderForm.familia_color_objetivo_id ? Number(orderForm.familia_color_objetivo_id) : null,
      material_salida_id: Number(orderForm.material_salida_id),
      tolerancia_custodia_kg: Number(orderForm.tolerancia_custodia_kg),
      tolerancia_balance_kg: orderForm.tolerancia_balance_kg ? Number(orderForm.tolerancia_balance_kg) : null,
    }), 'Orden de molienda creada en borrador.');
  };

  const recordWeights = () => {
    if (!selectedOrder?.aportes?.length || selectedOrder.aportes.some((item) => !Number(weights[item.id] || item.peso_pre_molino_kg))) {
      setError('Registra el peso previo al molino de cada aporte.');
      return;
    }
    run(() => registrarPesosPreMolino(selectedOrder.id, {
      aportes: selectedOrder.aportes.map((item) => ({
        aporte_id: item.id,
        peso_pre_molino_kg: Number(weights[item.id] || item.peso_pre_molino_kg),
      })),
    }), 'Pesos previos conciliados. Revisa alertas o bloqueos antes de iniciar.');
  };

  const updateCloseOutput = (index, patch) => setCloseForm((current) => ({
    ...current,
    salidas: current.salidas.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch } : item
    )),
  }));

  const addCloseOutput = () => setCloseForm((current) => ({
    ...current,
    salidas: [...current.salidas, { peso_neto_kg: '', ubicacion_codigo: 'ALMACEN_RECUPERADO' }],
  }));

  const removeCloseOutput = (index) => setCloseForm((current) => ({
    ...current,
    salidas: current.salidas.filter((_, itemIndex) => itemIndex !== index),
  }));

  const closeOrder = () => run(() => cerrarOrdenMolienda(selectedOrder.id, {
    perdida_kg: Number(closeForm.perdida_kg || 0),
    salidas: closeForm.salidas.map((item) => ({
      peso_neto_kg: Number(item.peso_neto_kg),
      ubicacion_codigo: item.ubicacion_codigo,
      ubicacion_nombre: 'Almacén de material recuperado',
    })),
  }), 'Molienda cerrada: entradas debitadas y lote recuperado pendiente de liberación.');

  const submitReason = () => {
    if (!reason.trim() || !reasonTarget) {
      setError('Indica un motivo auditable.');
      return;
    }
    if (reasonTarget.type === 'release') {
      run(() => liberarLoteRecuperado(reasonTarget.id, { motivo: reason.trim() }), 'Material recuperado liberado y disponible.');
    } else if (reasonTarget.type === 'custody') {
      run(() => autorizarDiferenciaCustodia(reasonTarget.id, { motivo: reason.trim() }), 'Diferencia de custodia autorizada; la evidencia original permanece visible.');
    } else {
      run(() => aprobarExcepcionMolienda(reasonTarget.id, { motivo: reason.trim() }), 'Excepción autorizada y marcada de forma visible.');
    }
    setReason('');
    setReasonTarget(null);
  };

  const submitMaster = () => run(
    () => crearMaestroReproceso(masterType, masterForm),
    'Maestro creado; ya está disponible para clasificar nuevas bolsas.',
  );

  const submitRule = () => {
    const mandatory = ['codigo', 'nombre', 'familia_objetivo_id', 'proceso_objetivo_id', 'familia_aporte_id', 'proceso_aporte_id'];
    if (!mandatory.every((key) => required(ruleForm[key]))) {
      setError('Completa la identidad y ambos lados de la regla.');
      return;
    }
    run(() => crearReglaCompatibilidad({
      ...ruleForm,
      familia_objetivo_id: Number(ruleForm.familia_objetivo_id),
      proceso_objetivo_id: Number(ruleForm.proceso_objetivo_id),
      familia_aporte_id: Number(ruleForm.familia_aporte_id),
      proceso_aporte_id: Number(ruleForm.proceso_aporte_id),
      porcentaje_maximo: ruleForm.resultado === 'CONDICIONADA' ? Number(ruleForm.porcentaje_maximo) : null,
    }), 'Revisión de compatibilidad creada en borrador.');
  };

  return (
    <Stack spacing={2.5}>
      <PageHeader
        title="Merma, molienda y material recuperado"
        description={`${experience.label}: ${experience.focus}`}
        actions={<Button startIcon={<RefreshIcon />} variant="outlined" onClick={load}>Actualizar</Button>}
      />
      {busy && <LinearProgress />}
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
      <Alert severity="info">
        El peso de almacén crea saldo una vez. El peso previo al molino lo concilia y consume;
        nunca se suman como dos entradas.
      </Alert>

      <Paper variant="outlined"><Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable">
        <Tab label="Resumen" />
        <Tab label="Merma almacenada" />
        <Tab label="Órdenes de molienda" />
        <Tab label="Material recuperado" />
        <Tab label="Maestros y reglas" />
      </Tabs></Paper>

      {tab === 0 && <Stack spacing={2}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
          {[
            ['Merma física', `${totals.scrap.toFixed(3)} kg`, 'Existencia pesada en almacén'],
            ['Reservada', `${totals.reserved.toFixed(3)} kg`, 'Comprometida por órdenes'],
            ['Recuperado libre', `${totals.recovered.toFixed(3)} kg`, 'Liberado por Jefatura'],
            ['Por liberar', totals.pending, 'Lotes esperando decisión'],
          ].map(([label, value, help]) => <Paper key={label} variant="outlined" sx={{ p: 2 }}>
            <Typography color="text.secondary" variant="body2">{label}</Typography>
            <Typography variant="h4" fontWeight={850}>{value}</Typography>
            <Typography variant="caption" color="text.secondary">{help}</Typography>
          </Paper>)}
        </Box>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight={800}>Siguiente tarea recomendada</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {totals.pending > 0 && can('MOLIENDA_LOTE_LIBERAR')
              ? `Revisa y libera ${totals.pending} lote(s) recuperado(s).`
              : orders.some((item) => item.estado === 'EN_EJECUCION')
                ? 'Hay una molienda en ejecución pendiente de balance y cierre.'
                : 'Registra merma segregada o prepara una nueva orden con el saldo libre.'}
          </Typography>
        </Paper>
      </Stack>}

      {tab === 1 && <Paper variant="outlined">
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ p: 2 }}>
          <Box><Typography variant="h6" fontWeight={800}>Bolsas de merma</Typography>
            <Typography color="text.secondary">Una fila equivale a una unidad física identificada.</Typography></Box>
          {can('MERMA_RECUPERABLE_REGISTRAR') && <Button startIcon={<ScaleOutlinedIcon />} variant="contained" onClick={() => setDialog('scrap')}>Pesar ingreso</Button>}
        </Stack>
        <TableContainer><Table size="small"><TableHead><TableRow>
          <TableCell>Bolsa</TableCell><TableCell>Clasificación</TableCell><TableCell>Origen</TableCell>
          <TableCell align="right">Físico</TableCell><TableCell align="right">Reservado</TableCell><TableCell align="right">Libre</TableCell><TableCell>Estado</TableCell>
        </TableRow></TableHead><TableBody>
          {scrap.map((item) => <TableRow key={item.id}>
            <TableCell><Typography fontWeight={750}>{item.codigo}</Typography><Typography variant="caption">{item.ubicacion?.nombre}</Typography></TableCell>
            <TableCell>{item.familia_material} · {item.proceso_origen}<br /><Typography variant="caption">{item.condicion}</Typography></TableCell>
            <TableCell>{item.origen_tipo} · {item.origen_id}</TableCell>
            <TableCell align="right">{item.saldo_disponible_kg} kg</TableCell>
            <TableCell align="right">{item.saldo_reservado_kg} kg</TableCell>
            <TableCell align="right"><Chip size="small" color="success" label={`${item.saldo_libre_kg} kg`} /></TableCell>
            <TableCell><Chip size="small" color={stateColor(item.estado)} label={item.estado.replaceAll('_', ' ')} /></TableCell>
          </TableRow>)}
          {!busy && scrap.length === 0 && <TableRow><TableCell colSpan={7}><Alert severity="info">Aún no hay merma pesada en almacén.</Alert></TableCell></TableRow>}
        </TableBody></Table></TableContainer>
      </Paper>}

      {tab === 2 && <Stack spacing={2}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
            <FormControl fullWidth><InputLabel>Orden de molienda</InputLabel><Select label="Orden de molienda" value={selectedOrderId} onChange={(event) => setSelectedOrderId(event.target.value)}>
              {orders.map((item) => <MenuItem key={item.id} value={item.id}>{item.codigo} · {item.estado.replaceAll('_', ' ')}</MenuItem>)}
            </Select></FormControl>
            {can('MOLIENDA_ORDEN_CREAR') && <Button sx={{ whiteSpace: 'nowrap' }} startIcon={<AddIcon />} variant="contained" onClick={() => setDialog('order')}>Nueva orden</Button>}
          </Stack>
        </Paper>
        {selectedOrder ? <Paper variant="outlined">
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ p: 2 }}>
            <Box><Stack direction="row" spacing={1} alignItems="center"><Typography variant="h6" fontWeight={850}>{selectedOrder.codigo}</Typography><Chip size="small" color={stateColor(selectedOrder.estado)} label={selectedOrder.estado.replaceAll('_', ' ')} /></Stack>
              <Typography color="text.secondary">Tolerancia custodia {selectedOrder.tolerancia_custodia_kg} kg · Balance {selectedOrder.tolerancia_balance_kg ? `${selectedOrder.tolerancia_balance_kg} kg` : 'pendiente de configurar'}</Typography></Box>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {['BORRADOR', 'BLOQUEADA_COMPATIBILIDAD'].includes(selectedOrder.estado) && can('MOLIENDA_ORDEN_CREAR') && <Button onClick={() => run(() => validarOrdenMolienda(selectedOrder.id), 'Compatibilidad recalculada con cantidades planificadas.')}>Validar mezcla</Button>}
              {selectedOrder.estado === 'BLOQUEADA_COMPATIBILIDAD' && can('MOLIENDA_EXCEPCION_APROBAR') && <Button color="warning" onClick={() => { setReasonTarget({ type: 'exception', id: selectedOrder.id }); setDialog('reason'); }}>Autorizar excepción</Button>}
              {selectedOrder.estado === 'VALIDADA' && can('MOLIENDA_EJECUTAR') && <Button color="success" variant="contained" onClick={() => run(() => iniciarOrdenMolienda(selectedOrder.id), 'Orden iniciada; el saldo sigue reservado hasta el cierre.')}>Iniciar molienda</Button>}
              {selectedOrder.estado === 'EN_EJECUCION' && can('MOLIENDA_EJECUTAR') && <Button color="success" variant="contained" onClick={() => setDialog('close')}>Cerrar y acreditar salida</Button>}
            </Stack>
          </Stack>
          <Divider />
          <TableContainer><Table size="small"><TableHead><TableRow>
            <TableCell>Aporte</TableCell><TableCell align="right">Planificado</TableCell><TableCell>Regla</TableCell><TableCell align="right">Pre-molino</TableCell><TableCell>Diferencia</TableCell><TableCell align="right">Decisión</TableCell>
          </TableRow></TableHead><TableBody>{selectedOrder.aportes.map((item) => <TableRow key={item.id}>
            <TableCell>{item.lote_codigo}</TableCell><TableCell align="right">{item.cantidad_planificada_kg} kg</TableCell>
            <TableCell><Chip size="small" color={item.resultado_compatibilidad === 'COMPATIBLE' ? 'success' : item.resultado_compatibilidad === 'CONDICIONADA' ? 'warning' : 'default'} label={item.resultado_compatibilidad || 'SIN EVALUAR'} /></TableCell>
            <TableCell align="right">{can('MOLIENDA_EJECUTAR') && selectedOrder.estado === 'VALIDADA' ? <TextField size="small" type="number" label="kg" value={weights[item.id] ?? item.peso_pre_molino_kg ?? ''} onChange={(event) => setWeights({ ...weights, [item.id]: event.target.value })} sx={{ width: 120 }} /> : `${item.peso_pre_molino_kg || '—'} kg`}</TableCell>
            <TableCell>{item.diferencia_custodia_kg ? `${item.diferencia_custodia_kg} kg` : '—'} {item.excede_tolerancia && <Chip size="small" color={item.autorizado_por_id ? 'warning' : 'error'} label={item.autorizado_por_id ? 'AUTORIZADA' : 'REQUIERE AUTORIZACIÓN'} />}</TableCell>
            <TableCell align="right">{item.excede_tolerancia && !item.autorizado_por_id && can('MOLIENDA_EXCEPCION_APROBAR') && <Button color="warning" size="small" onClick={() => { setReasonTarget({ type: 'custody', id: item.id }); setDialog('reason'); }}>Autorizar</Button>}</TableCell>
          </TableRow>)}</TableBody></Table></TableContainer>
          {selectedOrder.estado === 'VALIDADA' && can('MOLIENDA_EJECUTAR') && <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ p: 2 }}>
            <Button startIcon={<ScaleOutlinedIcon />} variant="outlined" onClick={recordWeights}>Guardar pesos previos</Button>
          </Stack>}
          {selectedOrder.estado === 'BORRADOR' && can('MOLIENDA_ORDEN_CREAR') && <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ p: 2 }}>
            <FormControl sx={{ minWidth: 280 }}><InputLabel>Bolsa con saldo libre</InputLabel><Select label="Bolsa con saldo libre" value={inputForm.lote_merma_id} onChange={(event) => setInputForm({ ...inputForm, lote_merma_id: event.target.value })}>{freeScrap.map((item) => <MenuItem key={item.id} value={item.id}>{item.codigo} · libre {item.saldo_libre_kg} kg</MenuItem>)}</Select></FormControl>
            <TextField type="number" label="Cantidad planificada (kg)" value={inputForm.cantidad_planificada_kg} onChange={(event) => setInputForm({ ...inputForm, cantidad_planificada_kg: event.target.value })} />
            <Button variant="outlined" onClick={() => run(() => agregarAporteMolienda(selectedOrder.id, { ...inputForm, cantidad_planificada_kg: Number(inputForm.cantidad_planificada_kg) }), 'Aporte reservado para esta orden.')}>Agregar aporte</Button>
          </Stack>}
        </Paper> : <Alert severity="info">Crea una orden para preparar una mezcla trazable.</Alert>}
      </Stack>}

      {tab === 3 && <Paper variant="outlined">
        <Typography variant="h6" fontWeight={800} sx={{ p: 2 }}>Lotes de material recuperado</Typography>
        <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Lote</TableCell><TableCell>Orden</TableCell><TableCell align="right">Peso</TableCell><TableCell>Composición</TableCell><TableCell>Estado</TableCell><TableCell align="right">Acción</TableCell></TableRow></TableHead><TableBody>
          {recovered.map((item) => <TableRow key={item.id}><TableCell><Typography fontWeight={750}>{item.codigo}</Typography><Typography variant="caption">{item.ubicacion?.nombre}</Typography></TableCell><TableCell>{item.orden_id}</TableCell><TableCell align="right">{item.peso_neto_kg} kg</TableCell><TableCell>{item.composicion_snapshot?.length || 0} aporte(s){item.mezcla_excepcional && <Chip size="small" color="warning" label="EXCEPCIONAL" sx={{ ml: 1 }} />}</TableCell><TableCell><Chip size="small" color={stateColor(item.estado)} label={item.estado.replaceAll('_', ' ')} /></TableCell><TableCell align="right">{item.estado === 'PENDIENTE_LIBERACION' && can('MOLIENDA_LOTE_LIBERAR') && <Button startIcon={<VerifiedOutlinedIcon />} onClick={() => { setReasonTarget({ type: 'release', id: item.id }); setDialog('reason'); }}>Liberar</Button>}</TableCell></TableRow>)}
          {!busy && recovered.length === 0 && <TableRow><TableCell colSpan={6}><Alert severity="info">Aún no hay salidas de molienda.</Alert></TableCell></TableRow>}
        </TableBody></Table></TableContainer>
      </Paper>}

      {tab === 4 && <Stack spacing={2}>
        {!can('MOLIENDA_REGLA_ADMINISTRAR') && <Alert severity="info">Tu perfil puede consultar esta configuración, pero no modificarla.</Alert>}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
            <FormControl sx={{ minWidth: 240 }}><InputLabel>Maestro</InputLabel><Select label="Maestro" value={masterType} onChange={(event) => setMasterType(event.target.value)}>{MASTER_TYPES.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}</Select></FormControl>
            {can('MOLIENDA_REGLA_ADMINISTRAR') && <>
              <TextField label="Código" value={masterForm.codigo} onChange={(event) => setMasterForm({ ...masterForm, codigo: event.target.value.toUpperCase() })} />
              <TextField label="Nombre" value={masterForm.nombre} onChange={(event) => setMasterForm({ ...masterForm, nombre: event.target.value })} />
              {masterType === 'condiciones' && (
                <FormControlLabel
                  control={<Switch checked={masterForm.recuperable} onChange={(event) => setMasterForm({ ...masterForm, recuperable: event.target.checked })} />}
                  label={masterForm.recuperable ? 'Recuperable' : 'No recuperable'}
                />
              )}
              <Button startIcon={<AddIcon />} variant="contained" onClick={submitMaster}>Crear</Button>
            </>}
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 2 }}>{masterItems.map((item) => <Chip key={item.id} label={`${item.codigo} · ${item.nombre}${item.recuperable === false ? ' · NO RECUPERABLE' : ''}`} color={item.activo ? 'default' : 'warning'} onDelete={can('MOLIENDA_REGLA_ADMINISTRAR') ? () => run(() => actualizarMaestroReproceso(masterType, item.id, { version: item.version, activo: !item.activo }), item.activo ? 'Maestro desactivado.' : 'Maestro reactivado.') : undefined} deleteIcon={item.activo ? undefined : <RecyclingOutlinedIcon />} />)}</Stack>
        </Paper>
        <Paper variant="outlined">
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" sx={{ p: 2 }}><Box><Typography variant="h6" fontWeight={800}>Reglas de compatibilidad</Typography><Typography color="text.secondary">Las aprobadas quedan congeladas; cambiar una regla crea otra revisión.</Typography></Box>{can('MOLIENDA_REGLA_ADMINISTRAR') && <Button startIcon={<AddIcon />} onClick={() => setDialog('rule')}>Nueva revisión</Button>}</Stack>
          <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Regla</TableCell><TableCell>Objetivo</TableCell><TableCell>Aporte</TableCell><TableCell>Resultado</TableCell><TableCell>Estado</TableCell><TableCell align="right">Acción</TableCell></TableRow></TableHead><TableBody>{rules.map((item) => <TableRow key={item.id}><TableCell>{item.codigo} · rev. {item.revision}<br /><Typography variant="caption">{item.nombre}</Typography></TableCell><TableCell>{item.familia_objetivo_id} / {item.proceso_objetivo_id}</TableCell><TableCell>{item.familia_aporte_id} / {item.proceso_aporte_id}{item.simetrica && ' · simétrica'}</TableCell><TableCell>{item.resultado}{item.porcentaje_maximo && ` ≤ ${item.porcentaje_maximo}%`}</TableCell><TableCell><Chip size="small" color={item.estado === 'APROBADA' ? 'success' : 'warning'} label={item.estado} /></TableCell><TableCell align="right">{item.estado === 'BORRADOR' && can('MOLIENDA_REGLA_APROBAR') && <Button onClick={() => run(() => aprobarReglaCompatibilidad(item.id), 'Regla aprobada; la revisión anterior quedó histórica.')}>Aprobar</Button>}</TableCell></TableRow>)}</TableBody></Table></TableContainer>
        </Paper>
      </Stack>}

      <Dialog open={dialog === 'scrap'} onClose={() => setDialog('')} fullWidth maxWidth="md"><DialogTitle>Pesar bolsa de merma recuperable</DialogTitle><DialogContent><Box sx={{ pt: 1, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
        <FormControl><InputLabel>Familia de material *</InputLabel><Select label="Familia de material *" value={scrapForm.familia_material_id} onChange={(event) => setScrapForm({ ...scrapForm, familia_material_id: event.target.value })}>{selectItems(refs.familias_material)}</Select></FormControl>
        <FormControl><InputLabel>Proceso de origen *</InputLabel><Select label="Proceso de origen *" value={scrapForm.proceso_origen_id} onChange={(event) => setScrapForm({ ...scrapForm, proceso_origen_id: event.target.value })}>{selectItems(refs.procesos)}</Select></FormControl>
        <FormControl><InputLabel>Condición *</InputLabel><Select label="Condición *" value={scrapForm.condicion_id} onChange={(event) => setScrapForm({ ...scrapForm, condicion_id: event.target.value })}>{selectItems(refs.condiciones, (item) => `${item.nombre}${item.recuperable ? '' : ' · NO RECUPERABLE'}`)}</Select></FormControl>
        <FormControl><InputLabel>Color nominal *</InputLabel><Select label="Color nominal *" value={scrapForm.color_id} onChange={(event) => setScrapForm({ ...scrapForm, color_id: event.target.value })}>{selectItems(refs.colores, (item) => item.nombre)}</Select></FormControl>
        <TextField label="Documento/origen *" value={scrapForm.origen_id} onChange={(event) => setScrapForm({ ...scrapForm, origen_id: event.target.value })} helperText="Ejemplo: OF-000123, OA-000045 o contingencia aprobada." />
        <TextField label="Tipo de origen" value={scrapForm.origen_tipo} onChange={(event) => setScrapForm({ ...scrapForm, origen_tipo: event.target.value.toUpperCase() })} />
        <TextField type="number" label="Peso bruto (kg) *" value={scrapForm.peso_bruto_kg} onChange={(event) => setScrapForm({ ...scrapForm, peso_bruto_kg: event.target.value })} />
        <TextField type="number" label="Tara (kg)" value={scrapForm.tara_kg} onChange={(event) => setScrapForm({ ...scrapForm, tara_kg: event.target.value })} helperText="El sistema calcula y acredita solo el neto." />
        <TextField label="Ubicación" value={scrapForm.ubicacion_codigo} onChange={(event) => setScrapForm({ ...scrapForm, ubicacion_codigo: event.target.value.toUpperCase() })} />
        <TextField label="Observaciones" value={scrapForm.observaciones} onChange={(event) => setScrapForm({ ...scrapForm, observaciones: event.target.value })} />
      </Box></DialogContent><DialogActions><Button onClick={() => setDialog('')}>Cancelar</Button><Button variant="contained" disabled={busy} onClick={createScrap}>Pesar y registrar</Button></DialogActions></Dialog>

      <Dialog open={dialog === 'order'} onClose={() => setDialog('')} fullWidth maxWidth="md"><DialogTitle>Nueva orden de molienda</DialogTitle><DialogContent><Box sx={{ pt: 1, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
        <FormControl><InputLabel>Familia objetivo *</InputLabel><Select label="Familia objetivo *" value={orderForm.familia_objetivo_id} onChange={(event) => setOrderForm({ ...orderForm, familia_objetivo_id: event.target.value })}>{selectItems(refs.familias_material)}</Select></FormControl>
        <FormControl><InputLabel>Proceso objetivo *</InputLabel><Select label="Proceso objetivo *" value={orderForm.proceso_objetivo_id} onChange={(event) => setOrderForm({ ...orderForm, proceso_objetivo_id: event.target.value })}>{selectItems(refs.procesos)}</Select></FormControl>
        <FormControl><InputLabel>Color dominante *</InputLabel><Select label="Color dominante *" value={orderForm.color_objetivo_id} onChange={(event) => setOrderForm({ ...orderForm, color_objetivo_id: event.target.value })}>{selectItems(refs.colores, (item) => item.nombre)}</Select></FormControl>
        <FormControl><InputLabel>Material recuperado de salida *</InputLabel><Select label="Material recuperado de salida *" value={orderForm.material_salida_id} onChange={(event) => setOrderForm({ ...orderForm, material_salida_id: event.target.value })}>{selectItems(refs.materiales_salida)}</Select></FormControl>
        <TextField type="number" label="Tolerancia de custodia (kg)" value={orderForm.tolerancia_custodia_kg} onChange={(event) => setOrderForm({ ...orderForm, tolerancia_custodia_kg: event.target.value })} />
        <TextField type="number" label="Tolerancia de balance (kg)" value={orderForm.tolerancia_balance_kg} onChange={(event) => setOrderForm({ ...orderForm, tolerancia_balance_kg: event.target.value })} helperText="Obligatoria para cerrar; no se inventa un valor por defecto." />
      </Box></DialogContent><DialogActions><Button onClick={() => setDialog('')}>Cancelar</Button><Button variant="contained" onClick={createOrder}>Crear borrador</Button></DialogActions></Dialog>

      <Dialog open={dialog === 'close'} onClose={() => setDialog('')} fullWidth maxWidth="md">
        <DialogTitle>Cerrar molienda y acreditar salidas</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="warning">
              Esta acción consume las entradas una sola vez. Cada salida crea una bolsa trazable pendiente de liberación.
            </Alert>
            {closeForm.salidas.map((item, index) => (
              <Paper key={`salida-${index}`} variant="outlined" sx={{ p: 2 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
                  <TextField
                    fullWidth
                    type="number"
                    label={`Peso neto de salida ${index + 1} (kg) *`}
                    value={item.peso_neto_kg}
                    onChange={(event) => updateCloseOutput(index, { peso_neto_kg: event.target.value })}
                  />
                  <TextField
                    fullWidth
                    label="Ubicación de salida"
                    value={item.ubicacion_codigo}
                    onChange={(event) => updateCloseOutput(index, { ubicacion_codigo: event.target.value.toUpperCase() })}
                  />
                  {closeForm.salidas.length > 1 && (
                    <IconButton color="error" aria-label={`Quitar salida ${index + 1}`} onClick={() => removeCloseOutput(index)}>
                      <DeleteOutlineIcon />
                    </IconButton>
                  )}
                </Stack>
              </Paper>
            ))}
            <Button startIcon={<AddIcon />} onClick={addCloseOutput}>Agregar otra bolsa de salida</Button>
            <TextField
              type="number"
              label="Pérdida del proceso (kg)"
              value={closeForm.perdida_kg}
              onChange={(event) => setCloseForm({ ...closeForm, perdida_kg: event.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog('')}>Cancelar</Button>
          <Button
            color="success"
            variant="contained"
            disabled={closeForm.salidas.length === 0 || closeForm.salidas.some((item) => !Number(item.peso_neto_kg))}
            onClick={closeOrder}
          >
            Confirmar balance y cerrar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialog === 'reason'} onClose={() => setDialog('')} fullWidth maxWidth="sm"><DialogTitle>{reasonTarget?.type === 'release' ? 'Liberar material recuperado' : reasonTarget?.type === 'custody' ? 'Autorizar diferencia de custodia' : 'Autorizar mezcla excepcional'}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><Alert severity="warning">La decisión queda vinculada a tu identidad y no modifica los hechos anteriores.</Alert><TextField label="Motivo obligatorio" multiline minRows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></Stack></DialogContent><DialogActions><Button onClick={() => setDialog('')}>Cancelar</Button><Button variant="contained" onClick={submitReason}>Confirmar decisión</Button></DialogActions></Dialog>

      <Dialog open={dialog === 'rule'} onClose={() => setDialog('')} fullWidth maxWidth="md"><DialogTitle>Nueva revisión de compatibilidad</DialogTitle><DialogContent><Box sx={{ pt: 1, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}><TextField label="Código estable *" value={ruleForm.codigo} onChange={(event) => setRuleForm({ ...ruleForm, codigo: event.target.value.toUpperCase() })} /><TextField label="Nombre *" value={ruleForm.nombre} onChange={(event) => setRuleForm({ ...ruleForm, nombre: event.target.value })} />
        <FormControl><InputLabel>Familia objetivo *</InputLabel><Select label="Familia objetivo *" value={ruleForm.familia_objetivo_id} onChange={(event) => setRuleForm({ ...ruleForm, familia_objetivo_id: event.target.value })}>{selectItems(refs.familias_material)}</Select></FormControl><FormControl><InputLabel>Proceso objetivo *</InputLabel><Select label="Proceso objetivo *" value={ruleForm.proceso_objetivo_id} onChange={(event) => setRuleForm({ ...ruleForm, proceso_objetivo_id: event.target.value })}>{selectItems(refs.procesos)}</Select></FormControl>
        <FormControl><InputLabel>Familia del aporte *</InputLabel><Select label="Familia del aporte *" value={ruleForm.familia_aporte_id} onChange={(event) => setRuleForm({ ...ruleForm, familia_aporte_id: event.target.value })}>{selectItems(refs.familias_material)}</Select></FormControl><FormControl><InputLabel>Proceso del aporte *</InputLabel><Select label="Proceso del aporte *" value={ruleForm.proceso_aporte_id} onChange={(event) => setRuleForm({ ...ruleForm, proceso_aporte_id: event.target.value })}>{selectItems(refs.procesos)}</Select></FormControl>
        <FormControl><InputLabel>Resultado</InputLabel><Select label="Resultado" value={ruleForm.resultado} onChange={(event) => setRuleForm({ ...ruleForm, resultado: event.target.value })}><MenuItem value="COMPATIBLE">Compatible</MenuItem><MenuItem value="CONDICIONADA">Condicionada</MenuItem><MenuItem value="INCOMPATIBLE">Incompatible</MenuItem></Select></FormControl>
        {ruleForm.resultado === 'CONDICIONADA' && <TextField type="number" label="Porcentaje máximo" value={ruleForm.porcentaje_maximo} onChange={(event) => setRuleForm({ ...ruleForm, porcentaje_maximo: event.target.value })} />}
        <FormControlLabel
          control={<Switch checked={ruleForm.simetrica} onChange={(event) => setRuleForm({ ...ruleForm, simetrica: event.target.checked })} />}
          label="Aplicar también en sentido inverso"
        />
      </Box></DialogContent><DialogActions><Button onClick={() => setDialog('')}>Cancelar</Button><Button variant="contained" onClick={submitRule}>Crear borrador</Button></DialogActions></Dialog>
    </Stack>
  );
}
