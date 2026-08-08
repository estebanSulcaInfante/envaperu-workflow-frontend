import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, InputLabel, LinearProgress, MenuItem,
  Paper, Select, Stack, Tab, Tabs, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from './ui/PageHeader';
import { useScmActor } from '../context/ScmActorContext';
import { mensajeErrorScm } from '../services/scmEngineeringApi';
import {
  aprobarRevisionReglaAlerta, crearRevisionReglaAlerta,
  gestionarAlertaOperativa, listarAlertasOperativas, listarReglasAlerta,
} from '../services/scmReprocessingApi';

const severityColor = { INFO: 'info', ADVERTENCIA: 'warning', CRITICA: 'error' };
const stateColor = { ABIERTA: 'error', RECONOCIDA: 'warning', RESUELTA: 'success', DESCARTADA: 'default' };

export default function OperationalAlertsScm() {
  const { can, experience } = useScmActor();
  const [tab, setTab] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [rules, setRules] = useState([]);
  const [counts, setCounts] = useState({});
  const [severityCounts, setSeverityCounts] = useState({});
  const [filters, setFilters] = useState({ estado: '', severidad: '', tipo: '' });
  const [target, setTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [ruleDialog, setRuleDialog] = useState(null);
  const [ruleForm, setRuleForm] = useState({
    nombre: '', descripcion: '', umbral: '', unidad: 'HORAS',
    severidad: 'ADVERTENCIA', alcance: 'PRODUCCION',
  });

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const [alertPayload, rulePayload] = await Promise.all([
        listarAlertasOperativas(filters), listarReglasAlerta(),
      ]);
      setAlerts(alertPayload.items || []);
      setCounts(alertPayload.conteos_estado || {});
      setSeverityCounts(alertPayload.conteos_severidad || {});
      setRules(rulePayload.items || []);
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'No se pudo cargar la bandeja de alertas.'));
    } finally {
      setBusy(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const types = useMemo(() => [...new Set(rules.map((item) => item.codigo))], [rules]);
  const run = async (action, success) => {
    setBusy(true);
    setError('');
    try {
      await action();
      setNotice(success);
      setTarget(null);
      setReason('');
      setRuleDialog(null);
      await load();
    } catch (requestError) {
      setError(mensajeErrorScm(requestError, 'La acción no pudo completarse.'));
    } finally {
      setBusy(false);
    }
  };

  const submitAction = () => {
    if (!target) return;
    if (['resolver', 'descartar'].includes(target.action) && !reason.trim()) {
      setError('Resolver o descartar exige un motivo auditable.');
      return;
    }
    run(
      () => gestionarAlertaOperativa(target.id, target.action, { motivo: reason.trim() }),
      target.action === 'reconocer'
        ? 'Alerta reconocida; sigue pendiente hasta su resolución.'
        : 'Alerta cerrada sin modificar el hecho de origen.',
    );
  };

  const createRevision = () => {
    if (!ruleDialog || !Number(ruleForm.umbral)) {
      setError('Indica un umbral positivo.');
      return;
    }
    run(() => crearRevisionReglaAlerta(ruleDialog.codigo, {
      ...ruleForm,
      nombre: ruleForm.nombre || ruleDialog.nombre,
      umbral: Number(ruleForm.umbral),
    }), 'Nueva revisión creada en borrador. Otro actor debe aprobarla.');
  };

  return (
    <Stack spacing={2.5}>
      <PageHeader
        title="Alertas e inconsistencias"
        description={`${experience.label}: atiende desvíos sin alterar pesajes, bolsas ni movimientos originales.`}
        actions={<Button startIcon={<RefreshIcon />} variant="outlined" onClick={load}>Actualizar</Button>}
      />
      {busy && <LinearProgress />}
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
      <Alert severity="info">
        Reconocer significa “ya la vi”; no resuelve, aprueba ni borra la inconsistencia.
      </Alert>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
        {[
          ['Abiertas', counts.ABIERTA || 0, 'error'],
          ['Reconocidas', counts.RECONOCIDA || 0, 'warning'],
          ['Críticas visibles', severityCounts.CRITICA || 0, 'error'],
          ['Resueltas', counts.RESUELTA || 0, 'success'],
        ].map(([label, value, color]) => <Paper key={label} variant="outlined" sx={{ p: 2, borderTop: 3, borderTopColor: `${color}.main` }}>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
          <Typography variant="h4" fontWeight={850}>{value}</Typography>
        </Paper>)}
      </Box>

      <Paper variant="outlined"><Tabs value={tab} onChange={(_, value) => setTab(value)}>
        <Tab label="Bandeja" />
        {can('ALERTA_CONFIGURAR') && <Tab label="Reglas y umbrales" />}
      </Tabs></Paper>

      {tab === 0 && <Paper variant="outlined">
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ p: 2 }}>
          <FormControl fullWidth size="small"><InputLabel>Estado</InputLabel><Select label="Estado" value={filters.estado} onChange={(event) => setFilters({ ...filters, estado: event.target.value })}><MenuItem value="">Todos</MenuItem>{['ABIERTA', 'RECONOCIDA', 'RESUELTA', 'DESCARTADA'].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl>
          <FormControl fullWidth size="small"><InputLabel>Severidad</InputLabel><Select label="Severidad" value={filters.severidad} onChange={(event) => setFilters({ ...filters, severidad: event.target.value })}><MenuItem value="">Todas</MenuItem>{['INFO', 'ADVERTENCIA', 'CRITICA'].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl>
          <FormControl fullWidth size="small"><InputLabel>Tipo</InputLabel><Select label="Tipo" value={filters.tipo} onChange={(event) => setFilters({ ...filters, tipo: event.target.value })}><MenuItem value="">Todos</MenuItem>{types.map((item) => <MenuItem key={item} value={item}>{item.replaceAll('_', ' ')}</MenuItem>)}</Select></FormControl>
        </Stack>
        <TableContainer><Table size="small"><TableHead><TableRow>
          <TableCell>Detectada</TableCell><TableCell>Alerta</TableCell><TableCell>Referencia</TableCell><TableCell>Estado</TableCell><TableCell>Historial</TableCell><TableCell align="right">Acciones</TableCell>
        </TableRow></TableHead><TableBody>
          {alerts.map((item) => <TableRow key={item.id} hover>
            <TableCell>{item.detectada_at ? new Date(item.detectada_at).toLocaleString('es-PE') : '—'}</TableCell>
            <TableCell><Stack direction="row" spacing={1} alignItems="center"><Chip size="small" color={severityColor[item.severidad]} label={item.severidad} /><Box><Typography fontWeight={750}>{item.resumen}</Typography><Typography variant="caption">{item.tipo.replaceAll('_', ' ')}</Typography></Box></Stack></TableCell>
            <TableCell>{item.agregado_tipo}<br /><Typography variant="caption">{item.agregado_id}</Typography></TableCell>
            <TableCell><Chip size="small" color={stateColor[item.estado]} label={item.estado} /></TableCell>
            <TableCell>{item.eventos?.length || 0} evento(s)</TableCell>
            <TableCell align="right">{can('ALERTA_GESTIONAR') && <Stack direction="row" spacing={0.5} justifyContent="flex-end">
              {item.estado === 'ABIERTA' && <Button size="small" onClick={() => setTarget({ id: item.id, action: 'reconocer' })}>Reconocer</Button>}
              {!['RESUELTA', 'DESCARTADA'].includes(item.estado) && <><Button size="small" color="success" onClick={() => setTarget({ id: item.id, action: 'resolver' })}>Resolver</Button><Button size="small" color="inherit" onClick={() => setTarget({ id: item.id, action: 'descartar' })}>Descartar</Button></>}
            </Stack>}</TableCell>
          </TableRow>)}
          {!busy && alerts.length === 0 && <TableRow><TableCell colSpan={6}><Alert severity="success">No hay alertas que coincidan con estos filtros.</Alert></TableCell></TableRow>}
        </TableBody></Table></TableContainer>
      </Paper>}

      {tab === 1 && can('ALERTA_CONFIGURAR') && <Paper variant="outlined">
        <Stack spacing={0.5} sx={{ p: 2 }}><Typography variant="h6" fontWeight={800}>Reglas activas</Typography><Typography color="text.secondary">Cambiar un umbral crea una revisión; las alertas históricas conservan la anterior.</Typography></Stack>
        <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Regla</TableCell><TableCell>Umbral vigente</TableCell><TableCell>Severidad</TableCell><TableCell>Revisiones</TableCell><TableCell align="right">Acciones</TableCell></TableRow></TableHead><TableBody>
          {rules.map((item) => <TableRow key={item.id}><TableCell><Typography fontWeight={750}>{item.nombre}</Typography><Typography variant="caption">{item.codigo}</Typography></TableCell><TableCell>{item.revision_actual ? `${item.revision_actual.umbral} ${item.revision_actual.unidad}` : 'Sin revisión aprobada'}</TableCell><TableCell><Chip size="small" color={severityColor[item.revision_actual?.severidad] || 'default'} label={item.revision_actual?.severidad || 'PENDIENTE'} /></TableCell><TableCell>{item.revisiones.length}</TableCell><TableCell align="right"><Button startIcon={<SettingsOutlinedIcon />} onClick={() => { setRuleDialog(item); setRuleForm({ ...ruleForm, nombre: item.nombre, umbral: item.revision_actual?.umbral || '', unidad: item.revision_actual?.unidad || 'HORAS', severidad: item.revision_actual?.severidad || 'ADVERTENCIA' }); }}>Nueva revisión</Button>{item.revisiones.filter((revision) => revision.estado === 'BORRADOR').map((revision) => <Button key={revision.id} startIcon={<TaskAltOutlinedIcon />} onClick={() => run(() => aprobarRevisionReglaAlerta(item.codigo, revision.id), 'Revisión aprobada y anterior retirada.')}>Aprobar rev. {revision.revision}</Button>)}</TableCell></TableRow>)}
        </TableBody></Table></TableContainer>
      </Paper>}

      <Dialog open={Boolean(target)} onClose={() => setTarget(null)} fullWidth maxWidth="sm"><DialogTitle>{target?.action === 'reconocer' ? 'Reconocer alerta' : target?.action === 'resolver' ? 'Resolver alerta' : 'Descartar alerta'}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>{target?.action === 'reconocer' ? <Alert severity="info">La alerta seguirá pendiente de resolución.</Alert> : <TextField label="Motivo obligatorio" multiline minRows={3} value={reason} onChange={(event) => setReason(event.target.value)} />}</Stack></DialogContent><DialogActions><Button onClick={() => setTarget(null)}>Cancelar</Button><Button variant="contained" onClick={submitAction}>Confirmar</Button></DialogActions></Dialog>

      <Dialog open={Boolean(ruleDialog)} onClose={() => setRuleDialog(null)} fullWidth maxWidth="sm"><DialogTitle>Nueva revisión · {ruleDialog?.nombre}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><TextField type="number" label="Umbral" value={ruleForm.umbral} onChange={(event) => setRuleForm({ ...ruleForm, umbral: event.target.value })} /><FormControl><InputLabel>Unidad</InputLabel><Select label="Unidad" value={ruleForm.unidad} onChange={(event) => setRuleForm({ ...ruleForm, unidad: event.target.value })}>{['HORAS', 'DIAS_CALENDARIO', 'KG', 'PORCENTAJE'].map((item) => <MenuItem key={item} value={item}>{item.replaceAll('_', ' ')}</MenuItem>)}</Select></FormControl><FormControl><InputLabel>Severidad</InputLabel><Select label="Severidad" value={ruleForm.severidad} onChange={(event) => setRuleForm({ ...ruleForm, severidad: event.target.value })}>{['INFO', 'ADVERTENCIA', 'CRITICA'].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl><TextField label="Descripción del cambio" multiline minRows={2} value={ruleForm.descripcion} onChange={(event) => setRuleForm({ ...ruleForm, descripcion: event.target.value })} /></Stack></DialogContent><DialogActions><Button onClick={() => setRuleDialog(null)}>Cancelar</Button><Button variant="contained" onClick={createRevision}>Crear borrador</Button></DialogActions></Dialog>
    </Stack>
  );
}
