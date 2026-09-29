import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Divider, Grid, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography,
} from '@mui/material';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import {
  actualizarColor,
  actualizarRecetaColorMaestra,
  crearColor,
  crearRecetaColorMaestra,
  obtenerColores,
  obtenerFamiliasColor,
  obtenerIngredientesRecetaColor,
  obtenerRecetasColorMaestras,
} from '../../services/api';
import { crearMaterialScm, listarCategoriasRecepcionScm } from '../../services/scmCatalogApi';
import { useScmActor } from '../../context/ScmActorContext';

const emptyColor = { nombre: '', familia_color_id: '', hex_referencia: '', activo: true };
const emptyRecipe = {
  nombre_variante: '', producto_sku: '', estado: 'BORRADOR', es_default: false,
  base_virgen_kg: 25, notas: '', lineas: [],
};

const asItems = (payload) => (Array.isArray(payload) ? payload : payload?.items || []);
const apiMessage = (error, fallback) => (
  error?.response?.data?.error?.message
  || error?.response?.data?.error
  || error?.response?.data?.message
  || error?.message
  || fallback
);

const newLine = () => ({
  material_id: '', tipo_componente: 'MATERIA_PRIMA', cantidad: '', base_kg: '',
});

function useLatest(value) {
  const ref = useRef(value);
  useEffect(() => { ref.current = value; }, [value]);
  return ref;
}

function Swatch({ hex }) {
  return (
    <Box
      aria-label={hex ? `Color ${hex}` : 'Color sin HEX'}
      sx={{ width: 28, height: 28, borderRadius: 1, bgcolor: hex || 'grey.200', border: '1px solid', borderColor: 'divider' }}
    />
  );
}

function PanelHeader({ title, subtitle, onBack, disabled = false }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Button startIcon={<ArrowBackOutlinedIcon />} onClick={onBack} disabled={disabled}>Volver</Button>
        <Box>
          <Typography variant="h6" fontWeight={800}>{title}</Typography>
          {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
        </Box>
      </Stack>
    </Stack>
  );
}

function RecoveryAlert({ uncertain, onCatalog, onReload }) {
  if (!uncertain) return null;
  return (
    <Alert severity="warning" action={(
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.5}>
        <Button color="inherit" size="small" onClick={onReload}>Recargar catálogo</Button>
        <Button color="inherit" size="small" onClick={onCatalog}>Volver al catálogo</Button>
      </Stack>
    )}>
      No se confirmó la respuesta del servidor. Se bloqueó el reenvío para evitar duplicados; conserva las entradas y reconcilia desde el catálogo.
    </Alert>
  );
}

function StateAlert({ error, notice, loading }) {
  return (
    <>
      {loading && <Alert severity="info">Cargando catálogo…</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}
    </>
  );
}

function ColorPanel({ mode, selectedId, onBack, onSelect, onSaved, canAdmin, busy, setBusy, notifyBusy, onDirtyChange }) {
  const [view, setView] = useState(mode);
  const [colors, setColors] = useState([]);
  const [families, setFamilies] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyColor);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [familiesLoading, setFamiliesLoading] = useState(false);
  const [error, setError] = useState('');
  const [accessoryError, setAccessoryError] = useState('');
  const [notice, setNotice] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [page, setPage] = useState(0);
  const initialRef = useRef(JSON.stringify(emptyColor));
  const familiesLoadedRef = useRef(false);
  const dirtyCallbackRef = useLatest(onDirtyChange);

  useEffect(() => {
    let active = true;
    setLoading(true);
    obtenerColores({ include_inactive: true }).then((colorPayload) => {
      if (!active) return;
      const colorRows = asItems(colorPayload);
      setColors(colorRows);
      setUncertain(false);
      const found = colorRows.find((item) => String(item.id) === String(selectedId));
      if (found) setSelected(found);
    }).catch((requestError) => {
      if (active) setError(apiMessage(requestError, 'No se pudo cargar el catálogo de colores.'));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedId, refreshToken]);

  const loadFamilies = useCallback(async () => {
    if (familiesLoadedRef.current || familiesLoading) return families;
    setFamiliesLoading(true);
    setAccessoryError('');
    try {
      const familyPayload = await obtenerFamiliasColor({ include_inactive: true });
      const rows = asItems(familyPayload);
      setFamilies(rows);
      return rows;
    } catch (requestError) {
      setAccessoryError(apiMessage(requestError, 'No se pudo cargar las familias de color.'));
      return [];
    } finally {
      setFamiliesLoading(false);
      familiesLoadedRef.current = true;
    }
  }, [families, familiesLoading]);

  useEffect(() => {
    if (mode === 'create') loadFamilies();
  }, [loadFamilies, mode]);

  useEffect(() => {
    if (view !== 'create') return;
    const snapshot = JSON.stringify(form);
    if (initialRef.current === null) initialRef.current = snapshot;
    dirtyCallbackRef.current(snapshot !== initialRef.current);
  }, [form, view, dirtyCallbackRef]);

  const visible = useMemo(() => colors.filter((item) => {
    const value = `${item.nombre || ''} ${item.color_base_nombre || ''} ${item.codigo || item.codigo_display || ''} ${item.familia_color_nombre || ''}`.toLowerCase();
    return value.includes(search.trim().toLowerCase());
  }), [colors, search]);

  const openCreate = async () => {
    const familyRows = await loadFamilies();
    setEditing(null);
    setForm({ ...emptyColor, familia_color_id: familyRows.find((item) => item.activo !== false)?.id || '' });
    setError('');
    setUncertain(false);
    setNotice('');
    initialRef.current = JSON.stringify({ ...emptyColor, familia_color_id: familyRows.find((item) => item.activo !== false)?.id || '' });
    setView('create');
  };
  const openEdit = async (item) => {
    await loadFamilies();
    setEditing(item);
    setForm({
      nombre: item.color_base_nombre || item.nombre || '',
      familia_color_id: item.familia_color_id || '',
      hex_referencia: item.hex_referencia || '',
      activo: item.activo !== false,
    });
    setError('');
    setUncertain(false);
    initialRef.current = JSON.stringify({
      nombre: item.color_base_nombre || item.nombre || '', familia_color_id: item.familia_color_id || '',
      hex_referencia: item.hex_referencia || '', activo: item.activo !== false,
    });
    setView('create');
  };
  const leaveCreate = () => {
    const snapshot = JSON.stringify(form);
    if (snapshot !== initialRef.current && !window.confirm('Hay cambios sin guardar. ¿Descartar este formulario?')) return;
    dirtyCallbackRef.current(false);
    setView(editing ? 'detail' : 'catalog');
  };
  const save = async () => {
    if (!canAdmin) { setError('Tu perfil no puede administrar colores.'); return; }
    if (!form.nombre.trim() || !form.familia_color_id) {
      setError('Completa el nombre y la familia de color.');
      return;
    }
    if (form.hex_referencia && !/^#[0-9a-fA-F]{6}$/.test(form.hex_referencia)) {
      setError('El HEX debe tener el formato #RRGGBB.');
      return;
    }
    const payload = {
      nombre: form.nombre.trim(), familia_color_id: Number(form.familia_color_id),
      hex_referencia: form.hex_referencia ? form.hex_referencia.toUpperCase() : null,
      activo: form.activo,
    };
    notifyBusy(true);
    setBusy(true);
    setError('');
    setUncertain(false);
    let released = false;
    try {
      const saved = editing
        ? await actualizarColor(editing.id, { ...payload, version: editing.version })
        : await crearColor(payload);
      const entity = { ...editing, ...saved, ...payload };
      setSelected(entity);
      setColors((current) => {
        const without = current.filter((item) => item.id !== entity.id);
        return [entity, ...without];
      });
      setNotice('Color guardado en el maestro.');
      setView('detail');
      initialRef.current = JSON.stringify(form);
      dirtyCallbackRef.current(false);
      notifyBusy(false);
      setBusy(false);
      released = true;
      onSaved(entity, { kind: 'color', selectable: true, pending: false });
    } catch (requestError) {
      if (!requestError?.response) setUncertain(true);
      setError(apiMessage(requestError, 'No se pudo guardar el color. Conserva los datos y recupera desde el catálogo.'));
    } finally {
      if (!released) {
        notifyBusy(false);
        setBusy(false);
      }
    }
  };

  const recoverCatalog = () => {
    setView('catalog');
  };
  const reloadCatalog = () => {
    setView('catalog');
    familiesLoadedRef.current = false;
    setRefreshToken((current) => current + 1);
  };
  const exitPanel = () => {
    const snapshot = JSON.stringify(form);
    if (snapshot !== initialRef.current && !window.confirm('Hay cambios sin guardar. ¿Salir y descartar este formulario?')) return;
    dirtyCallbackRef.current(false);
    onBack();
  };

  if (view === 'create') {
    return (
      <Stack spacing={2}>
        <PanelHeader title={editing ? 'Editar color de producción' : 'Crear color de producción'} subtitle="El color queda guardado como maestro; todavía no crea ni libera la OF." onBack={leaveCreate} disabled={busy || familiesLoading} />
        <StateAlert error={error} notice={notice} loading={false} />
        {accessoryError && <Alert severity="warning">{accessoryError}</Alert>}
        <RecoveryAlert uncertain={uncertain} onCatalog={recoverCatalog} onReload={reloadCatalog} />
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6 }}><TextField required fullWidth label="Nombre del color" value={form.nombre} disabled={busy} onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField required select fullWidth label="Familia de color" value={form.familia_color_id} disabled={busy} onChange={(event) => setForm((current) => ({ ...current, familia_color_id: event.target.value }))}>{families.filter((item) => item.activo !== false).map((item) => <MenuItem key={item.id} value={item.id}>{item.nombre}</MenuItem>)}</TextField></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="HEX de referencia (opcional)" placeholder="#F2C94C" value={form.hex_referencia} disabled={busy} onChange={(event) => setForm((current) => ({ ...current, hex_referencia: event.target.value.toUpperCase() }))} /></Grid>
          </Grid>
        </Paper>
        <Stack direction="row" justifyContent="flex-end" spacing={1}>
          <Button onClick={leaveCreate} disabled={busy || familiesLoading}>Cancelar</Button>
          <Button variant="contained" startIcon={<CheckCircleOutlineIcon />} onClick={save} disabled={busy || uncertain || familiesLoading || !canAdmin || !families.length}>Guardar y seleccionar</Button>
        </Stack>
      </Stack>
    );
  }

  if (view === 'detail') {
    const item = selected || colors.find((row) => String(row.id) === String(selectedId));
    return (
      <Stack spacing={2}>
        <PanelHeader title="Ficha de color" subtitle="Consulta el maestro y selecciona una identidad existente." onBack={recoverCatalog} disabled={busy} />
        <StateAlert error={error} notice={notice} loading={loading} />
        <RecoveryAlert uncertain={uncertain} onCatalog={recoverCatalog} onReload={reloadCatalog} />
        {item ? (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1.5} alignItems="center"><Swatch hex={item.hex_referencia} /><Box><Typography variant="h6">{item.color_base_nombre || item.nombre}</Typography><Typography color="text.secondary">{item.codigo || item.codigo_display || 'Código asignado por el maestro'}</Typography></Box></Stack>
              <Typography>Familia: {item.familia_color_nombre || item.familia_nombre || 'Sin familia visible'}</Typography>
              <Typography>HEX: {item.hex_referencia || 'Sin HEX'}</Typography>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => openEdit(item)} disabled={!canAdmin}>Editar color</Button>
                {item.activo !== false && <Button variant="contained" onClick={() => onSelect(item)}>Seleccionar color</Button>}
              </Stack>
            </Stack>
          </Paper>
        ) : <Alert severity="info">No hay un color seleccionado. Vuelve al catálogo.</Alert>}
      </Stack>
    );
  }

  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const pageRows = visible.slice(page * pageSize, (page + 1) * pageSize);
  return (
    <Stack spacing={2}>
        <PanelHeader title="Catálogo de colores de producción" subtitle="Busca por nombre, código o familia; abrir la ficha conserva el contexto de la OF." onBack={exitPanel} disabled={busy} />
        <StateAlert error={error} notice={notice} loading={loading} />
        <RecoveryAlert uncertain={uncertain} onCatalog={recoverCatalog} onReload={reloadCatalog} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <TextField fullWidth size="small" label="Buscar color" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} />
        <Button variant="contained" onClick={openCreate} disabled={!canAdmin || uncertain || busy} sx={{ minWidth: 180 }}>Nuevo color</Button>
      </Stack>
      {!loading && visible.length === 0 && <Alert severity="info">No hay colores que coincidan con la búsqueda.</Alert>}
      {visible.length > 0 && <TableContainer component={Paper} variant="outlined"><Table size="small"><TableHead><TableRow><TableCell>Color</TableCell><TableCell>Código</TableCell><TableCell>Familia</TableCell><TableCell>HEX</TableCell><TableCell align="right">Acción</TableCell></TableRow></TableHead><TableBody>{pageRows.map((item) => <TableRow key={item.id}><TableCell><Stack direction="row" spacing={1} alignItems="center"><Swatch hex={item.hex_referencia} /><Typography>{item.color_base_nombre || item.nombre}</Typography></Stack></TableCell><TableCell>{item.codigo || item.codigo_display || '—'}</TableCell><TableCell>{item.familia_color_nombre || item.familia_nombre || '—'}</TableCell><TableCell>{item.hex_referencia || '—'}</TableCell><TableCell align="right"><Button size="small" onClick={() => { setSelected(item); setView('detail'); }}>Ver ficha</Button></TableCell></TableRow>)}</TableBody></Table></TableContainer>}
      {pageCount > 1 && <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={1}><Typography variant="body2">Página {page + 1} de {pageCount}</Typography><Button size="small" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0}>Anterior</Button><Button size="small" onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} disabled={page >= pageCount - 1}>Siguiente</Button></Stack>}
    </Stack>
  );
}

function RecipePanel({ mode, colorId, selectedId, onBack, onSelect, onSaved, canAdmin, canPublish, canCreateMaterial, busy, setBusy, notifyBusy, onDirtyChange }) {
  const [view, setView] = useState(mode);
  const [recipes, setRecipes] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyRecipe);
  const [editing, setEditing] = useState(null);
  const [materialForm, setMaterialForm] = useState({ nombre: '', categoria_recepcion_id: '', clase: 'MATERIA_PRIMA' });
  const [materialIndex, setMaterialIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [materialLoading, setMaterialLoading] = useState(false);
  const [accessoryLoading, setAccessoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [accessoryError, setAccessoryError] = useState('');
  const [notice, setNotice] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const uncertainKindRef = useRef(null);
  const [page, setPage] = useState(0);
  const initialRef = useRef(JSON.stringify({ form: emptyRecipe, material: null }));
  const materialInitialRef = useRef(JSON.stringify({ nombre: '', categoria_recepcion_id: '', clase: 'MATERIA_PRIMA' }));
  const accessoriesLoadedRef = useRef(false);
  const dirtyCallbackRef = useLatest(onDirtyChange);

  useEffect(() => {
    if (!colorId) return undefined;
    let active = true;
    setLoading(true);
    obtenerRecetasColorMaestras({ color_produccion_id: colorId, include_inactive: true })
      .then((recipePayload) => {
        if (!active) return;
        const rows = asItems(recipePayload).filter((item) => item.color_produccion_id == null || String(item.color_produccion_id) === String(colorId));
        setRecipes(rows);
        const found = rows.find((item) => String(item.id) === String(selectedId));
        if (found) { setSelected(found); if (mode === 'detail') setView('detail'); }
      }).catch((requestError) => {
        if (active) setError(apiMessage(requestError, 'No se pudo cargar la formulación del color.'));
      }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [colorId, mode, selectedId]);

  const loadRecipeAccessories = useCallback(async () => {
    if (accessoriesLoadedRef.current || accessoryLoading) return;
    setAccessoryLoading(true);
    setAccessoryError('');
    const [ingredientResult, categoryResult] = await Promise.allSettled([
      obtenerIngredientesRecetaColor({ include_inactive: true }),
      listarCategoriasRecepcionScm(),
    ]);
    if (ingredientResult.status === 'fulfilled') setIngredients(asItems(ingredientResult.value));
    if (categoryResult.status === 'fulfilled') setCategories(asItems(categoryResult.value));
    const failed = [ingredientResult, categoryResult].filter((result) => result.status === 'rejected');
    if (failed.length) setAccessoryError('No se pudo cargar parte del catálogo auxiliar. El catálogo de recetas sigue disponible; recupera antes de editar.');
    setAccessoryLoading(false);
    accessoriesLoadedRef.current = true;
  }, [accessoryLoading]);

  useEffect(() => {
    if (mode === 'create') loadRecipeAccessories();
  }, [loadRecipeAccessories, mode]);

  useEffect(() => {
    const snapshot = JSON.stringify({ form, material: view === 'material' ? materialForm : null });
    if (initialRef.current === null) initialRef.current = snapshot;
    dirtyCallbackRef.current(snapshot !== initialRef.current);
  }, [form, materialForm, view, dirtyCallbackRef]);

  const visible = useMemo(() => recipes.filter((item) => `${item.nombre_variante || ''} ${item.revision || ''} ${item.estado || ''}`.toLowerCase().includes(search.trim().toLowerCase())), [recipes, search]);
  const activeCategories = categories.filter((item) => item.activo !== false);
  const rawPercent = form.lineas.filter((line) => line.tipo_componente === 'MATERIA_PRIMA').reduce((sum, line) => sum + (Number(line.cantidad) || 0), 0);

  const openCreate = async () => {
    if (uncertain || busy) return;
    await loadRecipeAccessories();
    setEditing(null);
    setForm({ ...emptyRecipe, lineas: [] });
    setError('');
    setUncertain(false);
    setNotice('');
    initialRef.current = JSON.stringify({ form: { ...emptyRecipe, lineas: [] }, material: null });
    setPage(0);
    setView('create');
  };
  const openEdit = async (item) => {
    if (uncertain || busy) return;
    await loadRecipeAccessories();
    setEditing(item);
    setForm({
      nombre_variante: item.nombre_variante || '', producto_sku: item.producto_sku || '',
      estado: item.estado === 'INACTIVA' ? 'BORRADOR' : item.estado || 'BORRADOR',
      es_default: Boolean(item.es_default), base_virgen_kg: item.base_virgen_kg || 25,
      notas: item.notas || '', lineas: (item.lineas || []).map((line) => ({
        material_id: line.material_id || '', tipo_componente: line.tipo_componente || 'MATERIA_PRIMA',
        cantidad: line.tipo_componente === 'MATERIA_PRIMA' ? Number(line.cantidad || 0) * 100 : line.cantidad,
        base_kg: line.base_kg || item.base_virgen_kg || 25,
      })),
    });
    setError('');
    setUncertain(false);
    initialRef.current = JSON.stringify({ form: {
      nombre_variante: item.nombre_variante || '', producto_sku: item.producto_sku || '',
      estado: item.estado === 'INACTIVA' ? 'BORRADOR' : item.estado || 'BORRADOR',
      es_default: Boolean(item.es_default), base_virgen_kg: item.base_virgen_kg || 25,
      notas: item.notas || '', lineas: (item.lineas || []).map((line) => ({
        material_id: line.material_id || '', tipo_componente: line.tipo_componente || 'MATERIA_PRIMA',
        cantidad: line.tipo_componente === 'MATERIA_PRIMA' ? Number(line.cantidad || 0) * 100 : line.cantidad,
        base_kg: line.base_kg || item.base_virgen_kg || 25,
      })),
    }, material: null,
    });
    setView('create');
  };
  const leaveCreate = () => {
    const snapshot = JSON.stringify({ form, material: null });
    if (snapshot !== initialRef.current && !window.confirm('Hay cambios sin guardar. ¿Descartar este formulario?')) return;
    dirtyCallbackRef.current(false);
    setView(editing ? 'detail' : 'catalog');
  };

  const isRecipeEligible = (item) => item?.estado === 'APROBADA' && !item?.producto_sku;
  const updateLine = (index, field, value) => setForm((current) => ({
    ...current,
    lineas: current.lineas.map((line, lineIndex) => {
      if (lineIndex !== index) return line;
      if (field === 'tipo_componente') return { ...line, tipo_componente: value, material_id: '' };
      return { ...line, [field]: value };
    }),
  }));
  const addLine = () => setForm((current) => ({ ...current, lineas: [...current.lineas, newLine()] }));
  const removeLine = (index) => setForm((current) => ({ ...current, lineas: current.lineas.filter((_, lineIndex) => lineIndex !== index) }));

  const openMaterial = (index, role) => {
    if (uncertain || busy) return;
    setMaterialIndex(index);
    setMaterialForm({ nombre: '', categoria_recepcion_id: '', clase: role === 'MATERIA_PRIMA' ? 'MATERIA_PRIMA' : 'COLORANTE', tipo_colorante: role === 'MATERIA_PRIMA' ? undefined : role });
    materialInitialRef.current = JSON.stringify({ nombre: '', categoria_recepcion_id: '', clase: role === 'MATERIA_PRIMA' ? 'MATERIA_PRIMA' : 'COLORANTE', tipo_colorante: role === 'MATERIA_PRIMA' ? undefined : role });
    setError('');
    setView('material');
  };
  const leaveMaterial = () => {
    if (JSON.stringify(materialForm) !== materialInitialRef.current
      && !window.confirm('Hay cambios sin guardar en el material. ¿Descartarlos y conservar la receta?')) return;
    setView('create');
  };
  const saveMaterial = async () => {
    if (uncertain || busy || materialLoading) return;
    if (!canCreateMaterial) { setError('Tu perfil no puede dar de alta materiales en el catálogo.'); return; }
    if (!materialForm.nombre.trim() || !materialForm.categoria_recepcion_id) {
      setError('Ingresa el nombre y una categoría de recepción activa.');
      return;
    }
    const payload = {
      nombre: materialForm.nombre.trim(), clase: materialForm.clase,
      categoria_recepcion_id: Number(materialForm.categoria_recepcion_id), unidad_base: 'KG', activo: true,
      ...(materialForm.clase !== 'MATERIA_PRIMA' ? { tipo_colorante: materialForm.tipo_colorante } : {}),
    };
    setMaterialLoading(true);
    notifyBusy(true);
    setBusy(true);
    setError('');
    setUncertain(false);
    let released = false;
    try {
      const created = await crearMaterialScm(payload);
      setIngredients((current) => [...current, created]);
      setForm((current) => ({
        ...current,
        lineas: current.lineas.map((line, lineIndex) => lineIndex === materialIndex ? { ...line, material_id: created.id } : line),
      }));
      setNotice('Material guardado y seleccionado en la formulación.');
      materialInitialRef.current = JSON.stringify(materialForm);
      setView('create');
      dirtyCallbackRef.current(true);
    } catch (requestError) {
      if (!requestError?.response) {
        uncertainKindRef.current = 'material';
        setUncertain(true);
      }
      setError(apiMessage(requestError, 'No se pudo guardar el material. Conserva la formulación y recupera desde el catálogo.'));
    } finally {
      setMaterialLoading(false);
      if (!released) {
        notifyBusy(false);
        setBusy(false);
      }
    }
  };

  const saveRecipe = async (targetState) => {
    if (uncertain || busy || materialLoading) return;
    if (!canAdmin) { setError('Tu perfil no puede administrar formulaciones.'); return; }
    if (!form.nombre_variante.trim()) { setError('Ingresa el nombre de la variante.'); return; }
    if (!(Number(form.base_virgen_kg) > 0)) { setError('La base virgen debe ser positiva.'); return; }
    if (form.lineas.some((line) => !line.material_id || !(Number(line.cantidad) > 0))) {
      setError('Completa el material y una cantidad positiva en cada componente.');
      return;
    }
    if (targetState === 'APROBADA' && (!canPublish || !form.lineas.length || Math.abs(rawPercent - 100) > 0.000001)) {
      setError('Para aprobar se requiere permiso de publicación y 100% de materias primas.');
      return;
    }
    const payload = {
      color_produccion_id: Number(colorId), nombre_variante: form.nombre_variante.trim(),
      producto_sku: form.producto_sku.trim() || null, estado: targetState,
      es_default: targetState === 'APROBADA' && form.es_default,
      base_virgen_kg: Number(form.base_virgen_kg), notas: form.notas.trim() || null,
      lineas: form.lineas.map((line) => ({
        material_id: Number(line.material_id), tipo_componente: line.tipo_componente,
        cantidad: line.tipo_componente === 'MATERIA_PRIMA' ? Number(line.cantidad) / 100 : Number(line.cantidad),
        base_kg: line.tipo_componente === 'MATERIA_PRIMA' ? null : Number(line.base_kg || form.base_virgen_kg),
      })),
    };
    notifyBusy(true);
    setBusy(true);
    setError('');
    setUncertain(false);
    let released = false;
    try {
      const result = editing
        ? await actualizarRecetaColorMaestra(editing.id, { ...payload, version: editing.version })
        : await crearRecetaColorMaestra(payload);
      const entity = { ...editing, ...result, ...payload, estado: targetState, id: result?.id || editing?.id };
      setSelected(entity);
      setRecipes((current) => [entity, ...current.filter((item) => item.id !== entity.id)]);
      initialRef.current = JSON.stringify({ form, material: null });
      dirtyCallbackRef.current(false);
      const selectable = targetState === 'APROBADA' && !form.producto_sku.trim();
      notifyBusy(false);
      setBusy(false);
      released = true;
      onSaved(entity, { kind: 'recipe', selectable, pending: targetState !== 'APROBADA', scope: form.producto_sku.trim() || null });
      if (selectable) onSelect(entity);
      else setNotice(targetState === 'BORRADOR'
        ? 'Borrador guardado. Queda pendiente de aprobación y no se selecciona para la OF.'
        : 'Receta aprobada, pero con alcance de producto; solo la formulación genérica es elegible para esta OF.');
      setView('detail');
    } catch (requestError) {
      if (!requestError?.response) {
        uncertainKindRef.current = 'recipe';
        setUncertain(true);
      }
      setError(apiMessage(requestError, 'No se pudo guardar la receta. Conserva las entradas y recupera desde el catálogo.'));
    } finally {
      if (!released) {
        notifyBusy(false);
        setBusy(false);
      }
    }
  };

  const recoverCatalog = () => {
    setView('catalog');
  };
  const reloadCatalog = async () => {
    if (busy || materialLoading) return;
    notifyBusy(true);
    setBusy(true);
    setError('');
    try {
      // Reconcile the catalogue for the uncertain write, never an unrelated master.
      if (uncertainKindRef.current === 'material') {
        const payload = await obtenerIngredientesRecetaColor({ include_inactive: true });
        setIngredients(asItems(payload));
        setView('create');
        setNotice('Materiales actualizados. Busca el material guardado antes de crear otro; la receta conserva sus cambios.');
      } else {
        const payload = await obtenerRecetasColorMaestras({ color_produccion_id: colorId, include_inactive: true });
        setRecipes(asItems(payload).filter((item) => item.color_produccion_id == null || String(item.color_produccion_id) === String(colorId)));
        setView('catalog');
        setNotice('Catálogo actualizado. Revisa si la receta ya se guardó antes de crear otra.');
      }
      uncertainKindRef.current = null;
      setUncertain(false);
    } catch (requestError) {
      setError(apiMessage(requestError, 'No se pudo recuperar el catálogo. El reenvío sigue bloqueado.'));
    } finally {
      notifyBusy(false);
      setBusy(false);
    }
  };
  const exitPanel = () => {
    const snapshot = JSON.stringify({ form, material: null });
    if (snapshot !== initialRef.current && !window.confirm('Hay cambios sin guardar. ¿Salir y descartar este formulario?')) return;
    dirtyCallbackRef.current(false);
    onBack();
  };

  if (!colorId) return <Stack spacing={2}><PanelHeader title="Formulación de color" onBack={onBack} disabled={busy || materialLoading} /><Alert severity="warning">Selecciona un color antes de consultar o crear una receta.</Alert></Stack>;
  if (view === 'material') {
    return (
      <Stack spacing={2}>
        <PanelHeader title="Crear material" subtitle="El material vuelve seleccionado sin perder la formulación." onBack={leaveMaterial} disabled={busy || materialLoading} />
        <StateAlert error={error} notice={notice} loading={false} />
        {accessoryError && <Alert severity="warning">{accessoryError}</Alert>}
        <RecoveryAlert uncertain={uncertain} onCatalog={recoverCatalog} onReload={reloadCatalog} />
        <Paper variant="outlined" sx={{ p: 2 }}><Grid container spacing={1.5}><Grid size={{ xs: 12, sm: 6 }}><TextField required fullWidth label="Nombre del material" value={materialForm.nombre} disabled={busy || materialLoading || uncertain} onChange={(event) => setMaterialForm((current) => ({ ...current, nombre: event.target.value }))} /></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField required select fullWidth label="Categoría de recepción" value={materialForm.categoria_recepcion_id} disabled={busy || materialLoading || uncertain} onChange={(event) => setMaterialForm((current) => ({ ...current, categoria_recepcion_id: event.target.value }))}>{activeCategories.map((item) => <MenuItem key={item.id} value={item.id}>{item.nombre} · {item.codigo}</MenuItem>)}</TextField></Grid></Grid></Paper>
        <Stack direction="row" justifyContent="flex-end" spacing={1}><Button onClick={leaveMaterial} disabled={busy || materialLoading}>Volver a receta</Button><Button variant="contained" onClick={saveMaterial} disabled={busy || materialLoading || uncertain || accessoryLoading || !canCreateMaterial}>Crear y volver</Button></Stack>
      </Stack>
    );
  }
  if (view === 'create') {
    return (
      <Stack spacing={2}>
        <PanelHeader title={editing ? 'Editar receta de color' : 'Crear receta de color'} subtitle="Las materias primas se expresan en porcentaje; los demás ingredientes, en dosis." onBack={leaveCreate} disabled={busy || materialLoading || accessoryLoading} />
        <StateAlert error={error} notice={notice} loading={false} />
        {accessoryError && <Alert severity="warning">{accessoryError}</Alert>}
        <RecoveryAlert uncertain={uncertain} onCatalog={recoverCatalog} onReload={reloadCatalog} />
        <Paper variant="outlined" sx={{ p: 2 }}><Grid container spacing={1.5}><Grid size={{ xs: 12, sm: 6 }}><TextField required fullWidth label="Nombre de variante" value={form.nombre_variante} disabled={busy || uncertain} onChange={(event) => setForm((current) => ({ ...current, nombre_variante: event.target.value }))} /></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Producto SKU (opcional)" value={form.producto_sku} disabled={busy || uncertain} onChange={(event) => setForm((current) => ({ ...current, producto_sku: event.target.value }))} /></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField required type="number" fullWidth label="Base virgen (kg)" value={form.base_virgen_kg} disabled={busy || uncertain} onChange={(event) => setForm((current) => ({ ...current, base_virgen_kg: event.target.value }))} /></Grid></Grid><TextField fullWidth multiline minRows={2} sx={{ mt: 1.5 }} label="Notas" value={form.notas} disabled={busy || uncertain} onChange={(event) => setForm((current) => ({ ...current, notas: event.target.value }))} /></Paper>
        <Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={1.5}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}><Box><Typography fontWeight={800}>Componentes</Typography><Typography variant="body2" color={Math.abs(rawPercent - 100) > 0.000001 ? 'warning.main' : 'success.main'}>Materias primas: {rawPercent.toFixed(2)}%</Typography></Box><Button startIcon={<AddOutlinedIcon />} onClick={addLine} disabled={busy || uncertain || accessoryLoading}>Agregar componente</Button></Stack>{form.lineas.map((line, index) => { const raw = line.tipo_componente === 'MATERIA_PRIMA'; const candidates = ingredients.filter((item) => item.activo !== false && (raw ? item.clase === 'MATERIA_PRIMA' : item.clase === 'COLORANTE' && (item.tipo_colorante || 'COLORANTE') === line.tipo_componente)); return <Paper variant="outlined" sx={{ p: 1.5 }} key={`${index}-${line.material_id}`}><Grid container spacing={1.25} alignItems="center"><Grid size={{ xs: 12, sm: 3 }}><TextField select fullWidth size="small" label="Rol" value={line.tipo_componente} disabled={busy || uncertain} onChange={(event) => updateLine(index, 'tipo_componente', event.target.value)}><MenuItem value="MATERIA_PRIMA">Materia prima</MenuItem><MenuItem value="COLORANTE">Colorante</MenuItem><MenuItem value="ADITIVO">Aditivo</MenuItem></TextField></Grid><Grid size={{ xs: 12, sm: 5 }}><TextField select fullWidth size="small" label={`Material ${index + 1}`} value={line.material_id} disabled={busy || uncertain || accessoryLoading} onChange={(event) => event.target.value === 'NUEVO' ? openMaterial(index, line.tipo_componente) : updateLine(index, 'material_id', event.target.value)}><MenuItem value="">Seleccionar material</MenuItem>{candidates.map((item) => <MenuItem key={item.id} value={item.id}>{item.nombre} · {item.codigo || 'Sin código'}</MenuItem>)}<MenuItem value="NUEVO">+ Crear {raw ? 'materia prima' : line.tipo_componente === 'ADITIVO' ? 'aditivo' : 'colorante'}</MenuItem></TextField></Grid><Grid size={{ xs: 10, sm: 3 }}><TextField fullWidth size="small" type="number" label={raw ? 'Materia prima (%)' : 'Dosis (g)'} value={line.cantidad} disabled={busy || uncertain} onChange={(event) => updateLine(index, 'cantidad', event.target.value)} /></Grid><Grid size={{ xs: 2, sm: 1 }}><Button aria-label={`Quitar componente ${index + 1}`} color="error" onClick={() => removeLine(index)} disabled={busy || uncertain}><DeleteOutlineIcon /></Button></Grid>{!raw && <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth size="small" type="number" label="Por kg virgen" value={line.base_kg || form.base_virgen_kg} disabled={busy || uncertain} onChange={(event) => updateLine(index, 'base_kg', event.target.value)} /></Grid>}</Grid></Paper>; })}{form.lineas.length === 0 && <Alert severity="info">Añade una materia prima o ingrediente para completar la receta.</Alert>}</Stack></Paper>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="flex-end" spacing={1}><Button variant="outlined" onClick={() => saveRecipe('BORRADOR')} disabled={busy || uncertain || accessoryLoading || !canAdmin}>Guardar borrador</Button>{canAdmin && canPublish && <Button variant="contained" startIcon={<CheckCircleOutlineIcon />} onClick={() => saveRecipe('APROBADA')} disabled={busy || uncertain || accessoryLoading}>Aprobar y seleccionar</Button>}</Stack>
      </Stack>
    );
  }
  if (view === 'detail') {
    const item = selected || recipes.find((row) => String(row.id) === String(selectedId));
    const approved = item?.estado === 'APROBADA';
    return <Stack spacing={2}><PanelHeader title="Ficha de receta" subtitle="La revisión y el estado pertenecen al color seleccionado." onBack={recoverCatalog} disabled={busy || materialLoading} /><StateAlert error={error} notice={notice} loading={loading} /><RecoveryAlert uncertain={uncertain} onCatalog={recoverCatalog} onReload={reloadCatalog} />{item ? <Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={1.25}><Typography variant="h6">{item.nombre_variante}</Typography><Typography color="text.secondary">Revisión {item.revision || '—'} · {item.estado}</Typography><Typography>Base virgen: {item.base_virgen_kg ?? '—'} kg</Typography>{item.producto_sku && <Alert severity="info">Alcance de producto {item.producto_sku}: esta revisión no es elegible para la OF directa genérica.</Alert>}<Divider />{(item.lineas || []).map((line, index) => <Typography key={`${line.material_id}-${index}`}>{line.material_nombre || line.nombre || `Material ${line.material_id}`} · {line.tipo_componente === 'MATERIA_PRIMA' ? `${Number(line.cantidad || 0) * 100}%` : `${line.cantidad || 0} g`}</Typography>)}<Stack direction="row" spacing={1}><Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => openEdit(item)} disabled={!canAdmin || busy}>Editar receta</Button>{approved && isRecipeEligible(item) && <Button variant="contained" onClick={() => onSelect(item)} disabled={busy}>Seleccionar receta</Button>}</Stack></Stack></Paper> : <Alert severity="info">No hay una receta seleccionada. Vuelve al catálogo.</Alert>}</Stack>;
  }
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const pageRows = visible.slice(page * pageSize, (page + 1) * pageSize);
  return <Stack spacing={2}><PanelHeader title="Catálogo de recetas de color" subtitle="Solo las recetas aprobadas y genéricas son elegibles para la OF." onBack={exitPanel} disabled={busy || materialLoading} /><StateAlert error={error} notice={notice} loading={loading} /><RecoveryAlert uncertain={uncertain} onCatalog={recoverCatalog} onReload={reloadCatalog} /><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField fullWidth size="small" label="Buscar receta" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} /><Button variant="contained" onClick={openCreate} disabled={!canAdmin || busy || uncertain} sx={{ minWidth: 180 }}>Nueva receta</Button></Stack>{accessoryError && <Alert severity="warning">{accessoryError}</Alert>}{!loading && visible.length === 0 && <Alert severity="info">No hay recetas para este color.</Alert>}{visible.length > 0 && <TableContainer component={Paper} variant="outlined"><Table size="small"><TableHead><TableRow><TableCell>Variante</TableCell><TableCell>Revisión</TableCell><TableCell>Estado</TableCell><TableCell>Alcance</TableCell><TableCell align="right">Acción</TableCell></TableRow></TableHead><TableBody>{pageRows.map((item) => <TableRow key={item.id}><TableCell>{item.nombre_variante}</TableCell><TableCell>{item.revision || '—'}</TableCell><TableCell>{item.estado}</TableCell><TableCell>{item.producto_sku || 'Genérica'}</TableCell><TableCell align="right"><Stack direction="row" justifyContent="flex-end" spacing={0.5}><Button size="small" onClick={() => { setSelected(item); setView('detail'); }}>Ver ficha</Button>{isRecipeEligible(item) && <Button size="small" onClick={() => onSelect(item)} disabled={busy}>Seleccionar</Button>}</Stack></TableCell></TableRow>)}</TableBody></Table></TableContainer>}{pageCount > 1 && <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={1}><Typography variant="body2">Página {page + 1} de {pageCount}</Typography><Button size="small" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0}>Anterior</Button><Button size="small" onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} disabled={page >= pageCount - 1}>Siguiente</Button></Stack>}</Stack>;
}

export default function FirstOfMasterPanel({
  kind = 'color', mode = 'catalog', colorId, selectedId, onBack = () => {}, onSelect = () => {},
  onSaved = () => {}, onBusyChange = () => {}, onDirtyChange = () => {},
}) {
  const { can, canAny = () => false } = useScmActor();
  const [busy, setBusy] = useState(false);
  const busyCallbackRef = useLatest(onBusyChange);
  const notifyBusy = (value) => busyCallbackRef.current(value);
  const setPanelBusy = (next) => setBusy(next);
  if (kind === 'recipe') {
    return <RecipePanel mode={mode} colorId={colorId} selectedId={selectedId} onBack={onBack} onSelect={onSelect} onSaved={onSaved} canAdmin={can('ARTICULO_ADMINISTRAR')} canPublish={can('FORMULACION_PUBLICAR_DIRECTO')} canCreateMaterial={canAny(['CATALOGO_MATERIAL_ADMINISTRAR', 'CONFIG_RECEPCION_ADMINISTRAR'])} busy={busy} setBusy={setPanelBusy} notifyBusy={notifyBusy} onDirtyChange={onDirtyChange} />;
  }
  return <ColorPanel mode={mode} selectedId={selectedId} onBack={onBack} onSelect={onSelect} onSaved={onSaved} canAdmin={can('ARTICULO_ADMINISTRAR')} busy={busy} setBusy={setPanelBusy} notifyBusy={notifyBusy} onDirtyChange={onDirtyChange} />;
}
