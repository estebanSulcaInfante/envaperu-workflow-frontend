import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Switch,
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
import { useSearchParams } from 'react-router-dom';
import PageHeader from './ui/PageHeader';
import DataTableToolbar from './ui/DataTableToolbar';
import { matchesOmniSearch } from '../utils/tableSearch';
import {
  actualizarCategoriaRecepcionScm,
  actualizarMaterialScm,
  actualizarProveedorScm,
  crearCategoriaRecepcionScm,
  crearMaterialScm,
  crearProveedorScm,
  listarCategoriasRecepcionScm,
  listarMaterialesScm,
  listarProveedoresScm,
  obtenerActorScmLocal,
} from '../services/scmCatalogApi';

const tabs = [
  { key: 'materials', label: 'Materias primas', api: true },
  { key: 'providers', label: 'Proveedores', api: true },
  { key: 'categoryRules', label: 'Categorías', api: true },
  { key: 'locations', label: 'Ubicaciones', api: false },
  { key: 'motives', label: 'Motivos', api: false },
  { key: 'policies', label: 'Políticas', api: false },
];

const emptyForms = {
  materials: { codigo: '', nombre: '', clase: 'MATERIA_PRIMA', tipo_colorante: 'COLORANTE', categoria_recepcion_id: '', unidad_base: 'KG', activo: true },
  providers: { codigo: '', razon_social: '', ruc: '', activo: true },
  categoryRules: { codigo: '', nombre: '', modalidad_default: 'POR_CONFIGURAR', lote_externo_obligatorio: false, recepcion_habilitada: false, activo: true },
};

const automaticCode = (kind, value) => {
  if (value.id) return value.codigo;
  if (kind === 'providers') return 'PRV-######';
  if (kind === 'categoryRules') return 'CAT-######';
  if (value.clase === 'MATERIA_PRIMA') return 'MP-######';
  return value.tipo_colorante === 'ADITIVO' ? 'ADT-######' : 'COL-######';
};

const apiError = (error) => {
  const payload = error?.response?.data?.error;
  if (typeof payload === 'string') return payload;
  return payload?.message || error?.message || 'No se pudo completar la operación.';
};

const titleFor = (kind) => ({
  materials: 'Material',
  providers: 'Proveedor',
  categoryRules: 'Categoría de recepción',
}[kind]);

function CatalogForm({ kind, value, categories, saving, onChange, onSave, onCancel }) {
  const editing = Boolean(value.id);
  return (
    <Paper variant="outlined" sx={{ p: 2, bgcolor: '#FAFBFC' }}>
      <Stack spacing={1.5}>
        <Typography variant="subtitle1" sx={{ fontWeight: 850 }}>{editing ? `Editar ${titleFor(kind)}` : `Crear ${titleFor(kind)}`}</Typography>
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Código automático" value={automaticCode(kind, value)} disabled helperText={editing ? 'Código interno inmutable' : 'Se asignará al guardar'} /></Grid>
          {kind === 'providers' ? (
            <Grid size={{ xs: 12, md: 8 }}><TextField fullWidth label="Razón social" value={value.razon_social} onChange={(event) => onChange('razon_social', event.target.value)} /></Grid>
          ) : (
            <Grid size={{ xs: 12, md: 8 }}><TextField fullWidth label="Nombre" value={value.nombre} onChange={(event) => onChange('nombre', event.target.value)} /></Grid>
          )}
          {kind === 'materials' && <>
            <Grid size={{ xs: 12, md: 4 }}><TextField select fullWidth label="Clase" value={value.clase} disabled={editing} onChange={(event) => onChange('clase', event.target.value)}><MenuItem value="MATERIA_PRIMA">Materia prima</MenuItem><MenuItem value="COLORANTE">Colorante / aditivo</MenuItem></TextField></Grid>
            {value.clase === 'COLORANTE' && <Grid size={{ xs: 12, md: 4 }}><TextField select fullWidth label="Tipo de dosificador" value={value.tipo_colorante || 'COLORANTE'} onChange={(event) => onChange('tipo_colorante', event.target.value)}><MenuItem value="COLORANTE">Colorante</MenuItem><MenuItem value="ADITIVO">Aditivo</MenuItem></TextField></Grid>}
            <Grid size={{ xs: 12, md: 6 }}><TextField select fullWidth label="Categoría de recepción" value={value.categoria_recepcion_id} onChange={(event) => onChange('categoria_recepcion_id', event.target.value)}>{categories.filter((item) => item.activo || item.id === Number(value.categoria_recepcion_id)).map((item) => <MenuItem key={item.id} value={item.id}>{item.codigo} · {item.nombre}</MenuItem>)}</TextField></Grid>
            <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth label="Unidad" value="KG" disabled /></Grid>
          </>}
          {kind === 'providers' && <Grid size={{ xs: 12, md: 5 }}><TextField fullWidth label="RUC (opcional)" value={value.ruc || ''} onChange={(event) => onChange('ruc', event.target.value.replace(/\D/g, '').slice(0, 11))} /></Grid>}
          {kind === 'categoryRules' && <>
            <Grid size={{ xs: 12, md: 5 }}><TextField select fullWidth label="Modalidad predeterminada" value={value.modalidad_default} onChange={(event) => onChange('modalidad_default', event.target.value)}><MenuItem value="VIRGEN_CONFIANZA_PROVEEDOR">Virgen · confianza en proveedor</MenuItem><MenuItem value="SEGUNDA_PESAJE_BOLSA">Segunda · pesaje bolsa por bolsa</MenuItem><MenuItem value="POR_CONFIGURAR">Por configurar</MenuItem></TextField></Grid>
            <Grid size={{ xs: 12, md: 3 }}><FormControlLabel control={<Switch checked={value.lote_externo_obligatorio} onChange={(event) => onChange('lote_externo_obligatorio', event.target.checked)} />} label="Exige lote proveedor" /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><FormControlLabel control={<Switch disabled={value.modalidad_default === 'POR_CONFIGURAR'} checked={value.recepcion_habilitada} onChange={(event) => onChange('recepcion_habilitada', event.target.checked)} />} label="Habilitada para recepción" /></Grid>
          </>}
          {editing && <Grid size={{ xs: 12 }}><FormControlLabel control={<Switch checked={value.activo} onChange={(event) => onChange('activo', event.target.checked)} />} label="Registro activo" /></Grid>}
        </Grid>
        <Stack direction="row" justifyContent="flex-end" spacing={1}><Button onClick={onCancel} disabled={saving}>Cancelar</Button><Button variant="contained" onClick={onSave} disabled={saving}>{saving ? 'Guardando…' : 'Guardar en API'}</Button></Stack>
      </Stack>
    </Paper>
  );
}

function MaterialCatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedKind = searchParams.get('catalogo') || 'materials';
  const kind = tabs.some((item) => item.key === requestedKind) ? requestedKind : 'materials';
  const activeTab = tabs.find((item) => item.key === kind);
  const [materials, setMaterials] = useState([]);
  const [providers, setProviders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('TODOS');
  const [form, setForm] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [materialRows, providerRows, categoryRows] = await Promise.all([
        listarMaterialesScm(),
        listarProveedoresScm(),
        listarCategoriasRecepcionScm(),
      ]);
      setMaterials(materialRows);
      setProviders(providerRows);
      setCategories(categoryRows);
    } catch (requestError) {
      setError(apiError(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const rows = useMemo(
    () => (kind === 'materials' ? materials : kind === 'providers' ? providers : kind === 'categoryRules' ? categories : []),
    [categories, kind, materials, providers],
  );
  const visibleRows = useMemo(() => rows.filter((item) => (
    (status === 'TODOS' || (status === 'ACTIVOS') === Boolean(item.activo))
    && matchesOmniSearch(item, search)
  )), [rows, search, status]);

  const openNew = () => setForm({ ...emptyForms[kind] });
  const openEdit = (item) => setForm({ ...item });
  const changeForm = (field, value) => setForm((current) => {
    const next = { ...current, [field]: value };
    if (field === 'modalidad_default' && value === 'POR_CONFIGURAR') next.recepcion_habilitada = false;
    return next;
  });

  const validate = () => {
    if (kind === 'providers' && !form.razon_social?.trim()) return 'La razón social es obligatoria.';
    if (kind !== 'providers' && !form.nombre?.trim()) return 'El nombre es obligatorio.';
    if (kind === 'materials' && !form.categoria_recepcion_id) return 'Selecciona una categoría de recepción.';
    if (kind === 'providers' && form.ruc && form.ruc.length !== 11) return 'El RUC debe tener 11 dígitos.';
    return '';
  };

  const save = async () => {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    const editing = Boolean(form.id);
    setSaving(true);
    setError('');
    try {
      if (kind === 'materials') {
        const payload = editing
          ? { version: form.version, nombre: form.nombre.trim(), categoria_recepcion_id: Number(form.categoria_recepcion_id), activo: form.activo, ...(form.clase === 'COLORANTE' ? { tipo_colorante: form.tipo_colorante || 'COLORANTE' } : {}) }
          : { nombre: form.nombre.trim(), clase: form.clase, categoria_recepcion_id: Number(form.categoria_recepcion_id), unidad_base: 'KG', activo: true, ...(form.clase === 'COLORANTE' ? { tipo_colorante: form.tipo_colorante || 'COLORANTE' } : {}) };
        await (editing ? actualizarMaterialScm(form.id, payload) : crearMaterialScm(payload));
      } else if (kind === 'providers') {
        const payload = editing
          ? { version: form.version, razon_social: form.razon_social.trim(), ruc: form.ruc || null, activo: form.activo }
          : { razon_social: form.razon_social.trim(), ruc: form.ruc || null, activo: true };
        await (editing ? actualizarProveedorScm(form.id, payload) : crearProveedorScm(payload));
      } else {
        const values = { nombre: form.nombre.trim(), modalidad_default: form.modalidad_default, lote_externo_obligatorio: form.lote_externo_obligatorio, recepcion_habilitada: form.recepcion_habilitada, activo: editing ? form.activo : true };
        const payload = editing ? { version: form.version, ...values } : values;
        await (editing ? actualizarCategoriaRecepcionScm(form.id, payload) : crearCategoriaRecepcionScm(payload));
      }
      setForm(null);
      setNotice(`${titleFor(kind)} guardado en la base local.`);
      await load();
    } catch (requestError) {
      setError(apiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (item) => {
    setSaving(true);
    setError('');
    try {
      if (kind === 'materials') await actualizarMaterialScm(item.id, { version: item.version, activo: !item.activo });
      if (kind === 'providers') await actualizarProveedorScm(item.id, { version: item.version, activo: !item.activo });
      if (kind === 'categoryRules') await actualizarCategoriaRecepcionScm(item.id, { version: item.version, activo: !item.activo });
      setNotice(`${titleFor(kind)} ${item.activo ? 'inactivado' : 'reactivado'} en la API.`);
      await load();
    } catch (requestError) {
      setError(apiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  const detail = (item) => {
    if (kind === 'materials') return `${item.clase === 'COLORANTE' ? item.tipo_colorante || 'COLORANTE' : 'MATERIA_PRIMA'} · ${item.categoria_recepcion_codigo} · ${item.unidad_base}`;
    if (kind === 'providers') return item.ruc ? `RUC ${item.ruc}` : 'RUC no informado';
    return `${item.modalidad_default} · ${item.recepcion_habilitada ? 'Recepción habilitada' : 'No recibible'}`;
  };

  return (
    <Stack spacing={2.25} sx={{ maxWidth: 1440, mx: 'auto' }}>
      <PageHeader eyebrow="Datos maestros" title="Materiales y abastecimiento" description="Catálogos persistentes utilizados por compras, recepción, recetas y producción." />
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Box sx={{ p: 2, bgcolor: '#FAFBFC' }}><Typography variant="h5" sx={{ fontWeight: 850 }}>Catálogos maestros de materiales</Typography><Typography variant="body2" color="text.secondary">Conectado a la API local · actor temporal #{obtenerActorScmLocal()} hasta integrar autenticación.</Typography></Box>
        <Tabs value={kind} onChange={(_, value) => { setSearchParams({ catalogo: value }); setForm(null); setSearch(''); setStatus('TODOS'); }} variant="scrollable" scrollButtons="auto">{tabs.map((item) => <Tab key={item.key} value={item.key} label={item.label} />)}</Tabs>
        <Stack spacing={2} sx={{ p: { xs: 1.5, md: 2.5 } }}>
          {!activeTab.api ? (
            <Alert severity="warning">Este catálogo todavía no tiene contrato CRUD en la API. No se muestran ni guardan datos simulados desde esta vista.</Alert>
          ) : loading ? (
            <Box sx={{ minHeight: 260, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>
          ) : <>
            <Stack direction="row" justifyContent="flex-end"><Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openNew}>Nuevo</Button></Stack>
            {form && <CatalogForm kind={kind} value={form} categories={categories} saving={saving} onChange={changeForm} onSave={save} onCancel={() => setForm(null)} />}
            <DataTableToolbar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar por código, nombre o clasificación" filters={[{ id: 'estado', label: 'Estado', value: status, onChange: setStatus, options: [{ value: 'TODOS', label: 'Todos' }, { value: 'ACTIVOS', label: 'Activos' }, { value: 'INACTIVOS', label: 'Inactivos' }] }]} resultCount={visibleRows.length} totalCount={rows.length} onClear={() => { setSearch(''); setStatus('TODOS'); }} />
            <TableContainer><Table size="small" aria-label={`Catálogo API ${kind}`}><TableHead><TableRow><TableCell>Código</TableCell><TableCell>Nombre</TableCell><TableCell>Clasificación</TableCell><TableCell>Estado</TableCell><TableCell align="right">Acciones</TableCell></TableRow></TableHead><TableBody>{visibleRows.map((item) => <TableRow key={item.id}><TableCell sx={{ fontWeight: 800 }}>{item.codigo}</TableCell><TableCell>{kind === 'providers' ? item.razon_social : item.nombre}</TableCell><TableCell>{detail(item)}</TableCell><TableCell><Chip size="small" label={item.activo ? 'ACTIVO' : 'INACTIVO'} color={item.activo ? 'success' : 'default'} variant="outlined" /></TableCell><TableCell align="right"><Button size="small" onClick={() => openEdit(item)}>Editar</Button><Button size="small" disabled={saving} color={item.activo ? 'error' : 'success'} onClick={() => toggle(item)}>{item.activo ? 'Inactivar' : 'Reactivar'}</Button></TableCell></TableRow>)}{visibleRows.length === 0 && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 5 }}>No hay registros.</TableCell></TableRow>}</TableBody></Table></TableContainer>
          </>}
        </Stack>
      </Paper>
    </Stack>
  );
}

export default MaterialCatalogPage;
