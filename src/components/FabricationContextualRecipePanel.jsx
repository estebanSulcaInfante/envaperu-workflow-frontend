import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, FormControlLabel, Grid, MenuItem,
  Paper, Stack, TextField, Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  obtenerFamiliasColor, obtenerIngredientesRecetaColor,
} from '../services/api';
import { listarCategoriasRecepcionScm } from '../services/scmCatalogApi';
import { crearFormulacionContextualScm } from '../services/scmOtApi';
import { useScmActor } from '../context/ScmActorContext';

const newLine = () => ({
  key: crypto.randomUUID(), role: 'MATERIA_PRIMA', materialRef: '',
  amount: '', baseKg: '', newName: '', categoryId: '',
});

const apiMessage = (error) => error?.response?.data?.error?.message
  || error?.response?.data?.error
  || error?.message
  || 'No se pudo guardar la formulación.';

export default function FabricationContextualRecipePanel({
  order, run, colorId, colors, onSaved, onDirtyChange = () => {}, onBusyChange = () => {},
}) {
  const { can, canAny } = useScmActor();
  const canEditRecipe = can('ARTICULO_ADMINISTRAR');
  const canPublish = can('FORMULACION_PUBLICAR_DIRECTO');
  const canCreateMaterial = canAny(['CATALOGO_MATERIAL_ADMINISTRAR', 'CONFIG_RECEPCION_ADMINISTRAR']);
  const fixedColor = run.salidas?.some((output) => output.articulo?.clase === 'PIEZA_COLOR');
  const [families, setFamilies] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [colorMode, setColorMode] = useState('EXISTENTE');
  const [selectedColorId, setSelectedColorId] = useState(colorId || '');
  const [newColorName, setNewColorName] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [newFamilyName, setNewFamilyName] = useState('');
  const [hex, setHex] = useState('');
  const [variant, setVariant] = useState('');
  const [productSku, setProductSku] = useState('');
  const [baseKg, setBaseKg] = useState('25');
  const [notes, setNotes] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [lines, setLines] = useState([newLine()]);
  const operationRef = useRef({ key: crypto.randomUUID(), payload: '' });
  const initialFormRef = useRef(null);
  const dirtyCallbackRef = useRef(onDirtyChange);
  const busyCallbackRef = useRef(onBusyChange);
  dirtyCallbackRef.current = onDirtyChange;
  busyCallbackRef.current = onBusyChange;
  const formSnapshot = JSON.stringify([
    colorMode, selectedColorId, newColorName, familyId, newFamilyName, hex,
    variant, productSku, baseKg, notes, isDefault, lines,
  ]);

  useEffect(() => {
    if (initialFormRef.current === null) initialFormRef.current = formSnapshot;
    dirtyCallbackRef.current(formSnapshot !== initialFormRef.current);
  }, [formSnapshot]);
  useEffect(() => { busyCallbackRef.current(busy); }, [busy]);

  useEffect(() => {
    let active = true;
    Promise.all([
      obtenerFamiliasColor(), obtenerIngredientesRecetaColor(), listarCategoriasRecepcionScm(),
    ]).then(([familyRows, materialRows, categoryRows]) => {
      if (!active) return;
      setFamilies(Array.isArray(familyRows) ? familyRows : familyRows?.items || []);
      setMaterials(Array.isArray(materialRows) ? materialRows : materialRows?.items || []);
      setCategories(Array.isArray(categoryRows) ? categoryRows : categoryRows?.items || []);
    }).catch((requestError) => {
      if (active) setError(apiMessage(requestError));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const rawPercent = useMemo(() => lines
    .filter((line) => line.role === 'MATERIA_PRIMA')
    .reduce((sum, line) => sum + (Number(line.amount) || 0), 0), [lines]);
  const activeCategories = categories.filter((item) => item.activo !== false);
  const activeFamilies = families.filter((item) => item.activo !== false);
  const productScopes = [...new Set((run.salidas || [])
    .map((output) => output.articulo?.producto_sku)
    .filter(Boolean))];
  const editLine = (key, changes) => {
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...changes } : line));
  };
  const addLine = () => setLines((current) => [...current, newLine()]);
  const removeLine = (key) => setLines((current) => current.filter((line) => line.key !== key));

  const submit = async (action) => {
    if (!canEditRecipe) {
      setError('Tu perfil no puede crear formulaciones. Solicita la capacidad de administrar artículos.');
      return;
    }
    if (!variant.trim() || !(Number(baseKg) > 0)) {
      setError('Ingresa una variante y una base virgen positiva.');
      return;
    }
    if (colorMode === 'EXISTENTE' && !selectedColorId) {
      setError('Selecciona un color de producción.');
      return;
    }
    if (colorMode === 'NUEVO' && (!newColorName.trim() || !(familyId || newFamilyName.trim()))) {
      setError('Para el color nuevo, ingresa su nombre y acabado o familia.');
      return;
    }
    if (hex && !/^#[0-9a-fA-F]{6}$/.test(hex)) {
      setError('El HEX debe tener el formato #RRGGBB.');
      return;
    }
    const completedLines = lines.filter((line) => line.materialRef || line.amount || line.newName);
    if (completedLines.some((line) => !(Number(line.amount) > 0)
      || (!line.materialRef && !line.newName.trim())
      || (line.materialRef === 'NUEVO' && (!line.newName.trim() || !line.categoryId)))) {
      setError('Cada componente necesita material, cantidad y, si es nuevo, categoría de recepción.');
      return;
    }
    if (completedLines.some((line) => line.materialRef === 'NUEVO') && !canCreateMaterial) {
      setError('Tu perfil no puede dar de alta materiales.');
      return;
    }
    if (action === 'APROBAR_SELECCIONAR' && (!canPublish || !completedLines.length || Math.abs(rawPercent - 100) > 0.000001)) {
      setError('Para aprobar se requiere permiso, componentes y 100% de materias primas.');
      return;
    }
    const newMaterials = completedLines.filter((line) => line.materialRef === 'NUEVO').map((line) => ({
      client_id: line.key,
      nombre: line.newName.trim(),
      clase: line.role === 'MATERIA_PRIMA' ? 'MATERIA_PRIMA' : 'COLORANTE',
      ...(line.role !== 'MATERIA_PRIMA' ? { tipo_colorante: line.role } : {}),
      categoria_recepcion_id: Number(line.categoryId),
    }));
    const payload = {
      version: order.version,
      accion: action,
      color: colorMode === 'EXISTENTE'
        ? { id: Number(selectedColorId) }
        : {
          nombre: newColorName.trim(),
          ...(familyId ? { familia_color_id: Number(familyId) } : { familia_nueva_nombre: newFamilyName.trim() }),
          ...(hex ? { hex_referencia: hex.toUpperCase() } : {}),
        },
      materiales_nuevos: newMaterials,
      receta: {
        variante: variant.trim(),
        alcance: productSku.trim() || null,
        base_virgen_kg: Number(baseKg),
        notas: notes.trim() || null,
        es_default: action === 'APROBAR_SELECCIONAR' && isDefault,
        lineas: completedLines.map((line) => ({
          ...(line.materialRef === 'NUEVO'
            ? { material_client_id: line.key }
            : { material_id: Number(line.materialRef) }),
          tipo_componente: line.role,
          cantidad: line.role === 'MATERIA_PRIMA'
            ? Number(line.amount) / 100 : Number(line.amount),
          ...(line.role !== 'MATERIA_PRIMA'
            ? { base_kg: Number(line.baseKg || baseKg) } : {}),
        })),
      },
    };
    setBusy(true);
    setError('');
    try {
      const serialized = JSON.stringify(payload);
      if (operationRef.current.payload !== serialized) {
        operationRef.current = { key: crypto.randomUUID(), payload: serialized };
      }
      const result = await crearFormulacionContextualScm(order.id, run.id, payload, operationRef.current.key);
      initialFormRef.current = formSnapshot;
      dirtyCallbackRef.current(false);
      await onSaved(result);
      operationRef.current = { key: crypto.randomUUID(), payload: '' };
    } catch (requestError) {
      setError(apiMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2} sx={{ maxWidth: 850, mx: 'auto', pb: 3 }}>
      <Typography variant="h6" fontWeight={800}>Formulación para {run.codigo}</Typography>
      <Alert severity="info">Completa el color y la receta aquí. Las altas nuevas y la selección se guardan juntas al confirmar.</Alert>
      {error && <Alert severity="error">{error}</Alert>}
      {loading && <Alert severity="info">Cargando colores, materiales y categorías…</Alert>}
      <Paper variant="outlined" sx={{ position: 'sticky', top: 0, zIndex: 1, p: 1, bgcolor: 'background.paper' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="flex-end" spacing={1}>
          <Button variant="outlined" disabled={busy || loading || !canEditRecipe} onClick={() => submit('GUARDAR_BORRADOR')}>Guardar borrador</Button>
          {canPublish && <Button variant="contained" disabled={busy || loading || !canEditRecipe} onClick={() => submit('APROBAR_SELECCIONAR')}>Aprobar y seleccionar</Button>}
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Typography fontWeight={800}>Color de producción</Typography>
          <TextField select fullWidth label="Origen del color" value={colorMode} onChange={(event) => setColorMode(event.target.value)} disabled={busy || fixedColor}>
            <MenuItem value="EXISTENTE">Color existente</MenuItem>
            <MenuItem value="NUEVO">Crear color</MenuItem>
          </TextField>
          {fixedColor && <Alert severity="info">El color de esta corrida ya está fijado por sus salidas PiezaColor.</Alert>}
          {colorMode === 'EXISTENTE' ? (
            <TextField select fullWidth label="Color" value={selectedColorId} onChange={(event) => setSelectedColorId(event.target.value)} disabled={busy || fixedColor}>
              {colors.filter((item) => item.activo !== false).map((item) => <MenuItem key={item.id} value={item.id}>{item.nombre || item.color_base_nombre}</MenuItem>)}
            </TextField>
          ) : (
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Nombre del color base" value={newColorName} onChange={(event) => setNewColorName(event.target.value)} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField select fullWidth label="Acabado / familia" value={familyId} onChange={(event) => setFamilyId(event.target.value)}><MenuItem value="">Crear familia nueva</MenuItem>{activeFamilies.map((item) => <MenuItem key={item.id} value={item.id}>{item.nombre}</MenuItem>)}</TextField></Grid>
              {!familyId && <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Nombre de la nueva familia" value={newFamilyName} onChange={(event) => setNewFamilyName(event.target.value)} /></Grid>}
              <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="HEX de referencia (opcional)" placeholder="#F2C94C" value={hex} onChange={(event) => setHex(event.target.value)} /></Grid>
            </Grid>
          )}
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Typography fontWeight={800}>Receta</Typography>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Nombre de variante" value={variant} onChange={(event) => setVariant(event.target.value)} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select fullWidth label="Alcance de la receta" value={productSku} onChange={(event) => setProductSku(event.target.value)} helperText="General sirve para las salidas compatibles de esta corrida.">
                <MenuItem value="">General</MenuItem>
                {productScopes.map((sku) => <MenuItem key={sku} value={sku}>Producto {sku}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth type="number" label="Base virgen (kg)" value={baseKg} onChange={(event) => setBaseKg(event.target.value)} slotProps={{ htmlInput: { min: 0.001, step: 0.001 } }} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><FormControlLabel control={<Checkbox checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} />} label="Predeterminada al aprobar" /></Grid>
          </Grid>
          <TextField fullWidth multiline minRows={2} label="Notas" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Stack>
      </Paper>
      <Paper id="componentes-formulacion" variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography fontWeight={800}>Componentes</Typography>
              <Typography variant="caption" color={Math.abs(rawPercent - 100) > 0.000001 ? 'warning.main' : 'success.main'}>
                Total materias primas: {rawPercent.toFixed(2)}%
                {rawPercent < 100 && ` · faltan ${(100 - rawPercent).toFixed(2)}%`}
                {rawPercent > 100 && ` · excede ${(rawPercent - 100).toFixed(2)}%`}
              </Typography>
            </Box>
            <Button startIcon={<AddOutlinedIcon />} onClick={addLine}>Agregar componente</Button>
          </Stack>
          {materials.filter((item) => item.activo !== false).length === 0 && <Alert severity="info">No hay materiales activos disponibles para esta formulación. Puedes declararlos aquí.</Alert>}
          {lines.map((line, index) => {
            const raw = line.role === 'MATERIA_PRIMA';
            const candidates = materials.filter((item) => item.activo !== false && (raw
              ? item.clase === 'MATERIA_PRIMA' : item.clase === 'COLORANTE'));
            return (
              <Paper key={line.key} variant="outlined" sx={{ p: 1.5 }}>
                <Stack spacing={1.25}>
                  <Grid container spacing={1.25} alignItems="center">
                    <Grid size={{ xs: 12, sm: 3 }}><TextField select fullWidth size="small" label="Rol" value={line.role} onChange={(event) => editLine(line.key, { role: event.target.value, materialRef: '' })}><MenuItem value="MATERIA_PRIMA">Materia prima</MenuItem><MenuItem value="COLORANTE">Colorante</MenuItem><MenuItem value="ADITIVO">Aditivo</MenuItem></TextField></Grid>
                    <Grid size={{ xs: 12, sm: 5 }}><TextField select fullWidth size="small" label={`Material ${index + 1}`} value={line.materialRef} onChange={(event) => editLine(line.key, { materialRef: event.target.value })}><MenuItem value="">Seleccionar</MenuItem>{candidates.map((item) => <MenuItem key={item.id} value={item.id}>{item.nombre} · {item.codigo}</MenuItem>)}<MenuItem value="NUEVO">+ Crear {raw ? 'materia prima' : line.role === 'ADITIVO' ? 'aditivo' : 'colorante'}</MenuItem></TextField></Grid>
                    <Grid size={{ xs: 10, sm: 3 }}><TextField fullWidth size="small" type="number" label={raw ? 'Porcentaje (%)' : 'Dosis (g)'} value={line.amount} onChange={(event) => editLine(line.key, { amount: event.target.value })} slotProps={{ htmlInput: { min: 0.0001, max: raw ? 100 : undefined, step: raw ? 0.01 : 0.0001 } }} /></Grid>
                    <Grid size={{ xs: 2, sm: 1 }}><Button aria-label={`Quitar componente ${index + 1}`} color="error" onClick={() => removeLine(line.key)}><DeleteOutlineIcon /></Button></Grid>
                  </Grid>
                  {!raw && <TextField size="small" type="number" label="Por kg virgen" value={line.baseKg || baseKg} onChange={(event) => editLine(line.key, { baseKg: event.target.value })} sx={{ maxWidth: 190 }} />}
                  {line.materialRef === 'NUEVO' && (
                    <Grid container spacing={1.25}>
                      <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth size="small" label="Nombre del material nuevo" value={line.newName} onChange={(event) => editLine(line.key, { newName: event.target.value })} /></Grid>
                      <Grid size={{ xs: 12, sm: 6 }}><TextField select fullWidth size="small" label="Categoría de recepción" value={line.categoryId} onChange={(event) => editLine(line.key, { categoryId: event.target.value })}>{activeCategories.map((item) => <MenuItem key={item.id} value={item.id}>{item.codigo} · {item.nombre}</MenuItem>)}</TextField></Grid>
                      {activeCategories.length === 0 && <Grid size={{ xs: 12 }}><Alert severity="warning">No hay categorías activas; configura una antes de dar de alta materiales.</Alert></Grid>}
                    </Grid>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      </Paper>
    </Stack>
  );
}
