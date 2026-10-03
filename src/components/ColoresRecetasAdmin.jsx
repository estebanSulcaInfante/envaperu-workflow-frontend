import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PowerSettingsNewOutlinedIcon from '@mui/icons-material/PowerSettingsNewOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import {
  actualizarColor,
  actualizarFamiliaColor,
  actualizarRecetaColorMaestra,
  crearColor,
  crearFamiliaColor,
  crearRecetaColorMaestra,
  inactivarColor,
  inactivarFamiliaColor,
  inactivarRecetaColorMaestra,
  obtenerColores,
  obtenerFamiliasColor,
  obtenerIngredientesRecetaColor,
  obtenerRecetasColorMaestras,
} from '../services/api';
import PageHeader from './ui/PageHeader';
import MaterialQuickCreateDialog from './MaterialQuickCreateDialog';
import { matchesOmniSearch } from '../utils/tableSearch';
import { listarCategoriasRecepcionScm } from '../services/scmCatalogApi';
import { useScmActor } from '../context/ScmActorContext';
import { buildRecipeDuplicateDraft } from './duplicateDraft';
import ColorHexPickerField, { ColorSwatch } from './ui/ColorHexPickerField';

const emptyColor = {
  nombre: '',
  familia_color_id: '',
  hex_referencia: '',
  activo: true,
};

const emptyRecipe = {
  nombre_variante: '',
  producto_sku: '',
  estado: 'BORRADOR',
  es_default: false,
  base_virgen_kg: 25,
  notas: '',
  lineas: [],
};

const emptyFamily = { nombre: '', codigo: '', activo: true };

const apiError = (error, fallback) => (
  error?.response?.data?.error
  || error?.response?.data?.message
  || fallback
);

const asItems = (response) => (Array.isArray(response) ? response : response?.items || []);

const normalizeRecipeValue = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  return Number.isFinite(number) ? number : String(value).trim();
};

const recipeLinesFingerprint = (lines = []) => lines.map((line) => ({
  material_id: String(line.material_id ?? ''),
  tipo_componente: line.tipo_componente || '',
  cantidad: normalizeRecipeValue(line.cantidad),
  base_kg: normalizeRecipeValue(line.base_kg),
}));

const normalizeRecipeNotes = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const recipeContentMatches = (candidate, payload) => (
  String(candidate?.color_produccion_id ?? '') === String(payload.color_produccion_id ?? '')
  && String(candidate?.nombre_variante ?? '').trim() === String(payload.nombre_variante ?? '').trim()
  && String(candidate?.producto_sku ?? '') === String(payload.producto_sku ?? '')
  && normalizeRecipeValue(candidate?.base_virgen_kg) === normalizeRecipeValue(payload.base_virgen_kg)
  && normalizeRecipeNotes(candidate?.notas) === normalizeRecipeNotes(payload?.notas)
  && recipeLinesFingerprint(candidate?.lineas).length === recipeLinesFingerprint(payload.lineas).length
  && recipeLinesFingerprint(candidate?.lineas).every((line, index) => {
    const expected = recipeLinesFingerprint(payload.lineas)[index];
    return expected && JSON.stringify(line) === JSON.stringify(expected);
  })
);

const sourceNoteMatches = (candidate, source) => {
  const notes = String(candidate?.notas || '').toLocaleLowerCase();
  const sourceId = String(source?.id ?? '').toLocaleLowerCase();
  const sourceName = String(source?.nombre_variante || '').trim().toLocaleLowerCase();
  const revision = source?.revision == null ? '' : String(source.revision).toLocaleLowerCase();
  const escapedId = sourceId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const idMarker = sourceId && new RegExp(`fuente\\s+receta\\s+${escapedId}(?:\\D|$)`).test(notes);
  return Boolean(idMarker
    && sourceName && notes.includes(sourceName)
    && (!revision || notes.includes(revision)));
};

const ensureRecipeSourceNote = (notes, source) => {
  const current = String(notes || '').trim();
  const sourceId = String(source?.id ?? '').trim();
  const sourceName = String(source?.nombre_variante || '').trim();
  const revision = source?.revision == null ? '' : ` · rev. ${source.revision}`;
  const marker = `Fuente receta ${sourceId}${revision} · Copia de ${sourceName}`;
  const normalized = current.toLocaleLowerCase();
  if (sourceId && sourceName
    && normalized.includes(`fuente receta ${sourceId.toLocaleLowerCase()}`)
    && normalized.includes(`copia de ${sourceName.toLocaleLowerCase()}`)
    && (!revision || normalized.includes(`rev. ${String(source.revision).toLocaleLowerCase()}`))) return current;
  return [current, marker].filter(Boolean).join(' · ');
};

function ColoresRecetasAdmin({ embedded = false, initialColorId = null, onRecipeSaved = null }) {
  const { can } = useScmActor();
  const canPublishRecipe = can('FORMULACION_PUBLICAR_DIRECTO');
  const [colors, setColors] = useState([]);
  const [families, setFamilies] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [selectedColorId, setSelectedColorId] = useState(null);
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [colorDialog, setColorDialog] = useState({ open: false, item: null });
  const [colorForm, setColorForm] = useState(emptyColor);
  const [familyDialogOpen, setFamilyDialogOpen] = useState(false);
  const [familyForm, setFamilyForm] = useState(emptyFamily);
  const [editingFamily, setEditingFamily] = useState(null);
  const [recipeDialog, setRecipeDialog] = useState({ open: false, item: null });
  const [recipeForm, setRecipeForm] = useState(emptyRecipe);
  const [uncertainRecipeAttempt, setUncertainRecipeAttempt] = useState(null);
  const [reconcilingRecipe, setReconcilingRecipe] = useState(false);
  const [duplicateRecipeLoading, setDuplicateRecipeLoading] = useState(false);
  const [duplicateRecipeLoadError, setDuplicateRecipeLoadError] = useState('');
  const duplicateRecipeRequest = useRef(0);
  const saveRecipeInFlight = useRef(false);
  const [materialDialog, setMaterialDialog] = useState({ open: false, lineIndex: null, role: 'MATERIA_PRIMA' });
  const recipeInputsLocked = saving || reconcilingRecipe || duplicateRecipeLoading || Boolean(uncertainRecipeAttempt);

  const selectedColor = colors.find((item) => item.id === selectedColorId) || null;
  const selectedColorInactive = selectedColor?.activo === false;
  const visibleColors = useMemo(() => colors.filter((item) => (
    (includeInactive || item.activo !== false) && matchesOmniSearch(item, search)
  )), [colors, includeInactive, search]);
  const visibleRecipes = useMemo(() => recipes.filter(
    (item) => includeInactive || item.estado !== 'INACTIVA',
  ), [recipes, includeInactive]);
  const duplicateReferenceIssues = useMemo(() => {
    if (!recipeDialog.duplicateSource) return [];
    return recipeForm.lineas.flatMap((line, index) => {
      const material = ingredients.find((item) => String(item.id) === String(line.material_id));
      if (!line.material_id) return [`Componente ${index + 1}: selecciona un material de reemplazo.`];
      if (!material) return [`Componente ${index + 1}: el material original ya no existe en el catálogo.`];
      if (material.activo === false) return [`Componente ${index + 1}: el material ${material.nombre || material.codigo || line.material_id} está inactivo; reemplázalo.`];
      return [];
    });
  }, [ingredients, recipeDialog.duplicateSource, recipeForm.lineas]);

  const loadCatalog = async () => {
    setLoading(true);
    setError('');
    try {
      const [colorRows, familyRows, ingredientRows, categoryRows] = await Promise.all([
        obtenerColores({ include_inactive: true }),
        obtenerFamiliasColor({ include_inactive: true }),
        obtenerIngredientesRecetaColor({ include_inactive: true }),
        listarCategoriasRecepcionScm(),
      ]);
      setColors(asItems(colorRows));
      setFamilies(asItems(familyRows));
      setIngredients(asItems(ingredientRows));
      setCategories(asItems(categoryRows));
      setSelectedColorId((current) => (
        asItems(colorRows).some((item) => item.id === current)
          ? current
          : asItems(colorRows).some((item) => item.id === Number(initialColorId))
            ? Number(initialColorId)
          : asItems(colorRows).find((item) => item.activo !== false)?.id
            ?? asItems(colorRows)[0]?.id
            ?? null
      ));
    } catch (requestError) {
      setError(apiError(requestError, 'No se pudo cargar el maestro de colores y recetas.'));
    } finally {
      setLoading(false);
    }
  };

  const loadRecipes = async (colorId) => {
    if (!colorId) {
      setRecipes([]);
      return;
    }
    setRecipeLoading(true);
    setError('');
    try {
      const response = await obtenerRecetasColorMaestras({
        color_produccion_id: colorId,
        include_inactive: true,
      });
      setRecipes(asItems(response));
    } catch (requestError) {
      setRecipes([]);
      setError(apiError(requestError, 'No se pudieron cargar las recetas del color.'));
    } finally {
      setRecipeLoading(false);
    }
  };

  useEffect(() => { loadCatalog(); }, []);
  useEffect(() => { loadRecipes(selectedColorId); }, [selectedColorId]);

  const openNewColor = () => {
    setColorDialog({ open: true, item: null });
    setColorForm({ ...emptyColor, familia_color_id: families[0]?.id || '' });
    setError('');
  };

  const resetFamilyForm = () => {
    setEditingFamily(null);
    setFamilyForm(emptyFamily);
  };

  const editFamily = (item) => {
    setEditingFamily(item);
    setFamilyForm({
      nombre: item.nombre,
      codigo: item.codigo ?? '',
      codigo_display: item.codigo_display,
      activo: item.activo !== false,
    });
  };

  const saveFamily = async () => {
    if (!familyForm.nombre.trim()) {
      setError('Ingresa el nombre de la familia de color.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        nombre: familyForm.nombre.trim(),
      };
      let savedFamily;
      if (editingFamily) {
        payload.codigo = familyForm.codigo === '' ? null : Number(familyForm.codigo);
        savedFamily = await actualizarFamiliaColor(editingFamily.id, {
          ...payload,
          activo: familyForm.activo,
          version: editingFamily.version,
        });
      } else {
        savedFamily = await crearFamiliaColor(payload);
      }
      await loadCatalog();
      if (colorDialog.open && savedFamily?.id) {
        setColorForm((current) => ({ ...current, familia_color_id: savedFamily.id }));
        setFamilyDialogOpen(false);
      }
      resetFamilyForm();
      setNotice('Familia de color guardada correctamente.');
    } catch (requestError) {
      setError(apiError(requestError, 'No se pudo guardar la familia de color.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleFamily = async (item) => {
    if (item.activo !== false && !window.confirm(`¿Inactivar la familia ${item.nombre}?`)) return;
    setSaving(true);
    setError('');
    try {
      if (item.activo === false) {
        await actualizarFamiliaColor(item.id, {
          nombre: item.nombre,
          codigo: item.codigo,
          activo: true,
          version: item.version,
        });
      } else {
        await inactivarFamiliaColor(item.id, item.version);
      }
      await loadCatalog();
      if (editingFamily?.id === item.id) resetFamilyForm();
      setNotice(`Familia ${item.activo === false ? 'reactivada' : 'inactivada'}.`);
    } catch (requestError) {
      setError(apiError(requestError, 'No se pudo cambiar el estado de la familia.'));
    } finally {
      setSaving(false);
    }
  };

  const openEditColor = (item) => {
    setColorDialog({ open: true, item });
    setColorForm({
      nombre: item.color_base_nombre || '',
      familia_color_id: item.familia_color_id || '',
      hex_referencia: item.hex_referencia || '',
      activo: item.activo !== false,
    });
    setError('');
  };

  const saveColor = async () => {
    const name = colorForm.nombre.trim();
    if (!name || !colorForm.familia_color_id) {
      setError('Completa el nombre y el acabado del color.');
      return;
    }
    if (colorForm.hex_referencia && !/^#[0-9a-fA-F]{6}$/.test(colorForm.hex_referencia)) {
      setError('El HEX debe usar el formato #RRGGBB.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        nombre: name,
        familia_color_id: Number(colorForm.familia_color_id),
        hex_referencia: colorForm.hex_referencia || null,
        activo: colorForm.activo,
      };
      let savedColor;
      if (colorDialog.item) {
        savedColor = await actualizarColor(colorDialog.item.id, {
          ...payload,
          version: colorDialog.item.version,
        });
      } else {
        savedColor = await crearColor(payload);
      }
      setColorDialog({ open: false, item: null });
      setNotice('Color guardado correctamente.');
      await loadCatalog();
      if (savedColor?.id) setSelectedColorId(savedColor.id);
    } catch (requestError) {
      setError(apiError(requestError, 'No se pudo guardar el color.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleColor = async (item) => {
    if (item.activo !== false && !window.confirm(`¿Inactivar ${item.nombre}?`)) return;
    setError('');
    try {
      if (item.activo === false) {
        await actualizarColor(item.id, {
          version: item.version,
          nombre: item.color_base_nombre,
          familia_color_id: item.familia_color_id,
          hex_referencia: item.hex_referencia,
          activo: true,
        });
      } else {
        await inactivarColor(item.id, item.version);
      }
      setNotice(`Color ${item.activo === false ? 'reactivado' : 'inactivado'}.`);
      await loadCatalog();
    } catch (requestError) {
      setError(apiError(requestError, 'No se pudo cambiar el estado del color.'));
    }
  };

  const openNewRecipe = () => {
    setRecipeDialog({ open: true, item: null, duplicateSource: null });
    setRecipeForm({ ...emptyRecipe, lineas: [] });
    setError('');
  };

  const openEditRecipe = (item) => {
    setRecipeDialog({ open: true, item, duplicateSource: null });
    setRecipeForm({
      nombre_variante: item.nombre_variante,
      producto_sku: item.producto_sku || '',
      estado: item.estado === 'INACTIVA' ? 'BORRADOR' : item.estado,
      es_default: item.es_default,
      base_virgen_kg: item.base_virgen_kg,
      notas: item.notas || '',
      lineas: item.lineas.map((line) => ({
        material_id: line.material_id,
        tipo_componente: line.tipo_componente,
        cantidad: line.tipo_componente === 'MATERIA_PRIMA'
          ? Number(line.cantidad) * 100 : line.cantidad,
        base_kg: line.base_kg || item.base_virgen_kg,
      })),
    });
    setError('');
  };

  const openDuplicateRecipe = async (item) => {
    if (!can('ARTICULO_ADMINISTRAR')) return;
    const requestId = duplicateRecipeRequest.current + 1;
    duplicateRecipeRequest.current = requestId;
    const colorId = item?.color_produccion_id ?? selectedColorId;
    setDuplicateRecipeLoading(true);
    setDuplicateRecipeLoadError('');
    setError('');
    setRecipeDialog({ open: true, item: null, duplicateSource: item });
    setRecipeForm({ ...emptyRecipe, estado: 'BORRADOR', es_default: false, lineas: [] });
    try {
      const [colorRows, ingredientRows, recipeResponse] = await Promise.all([
        obtenerColores({ include_inactive: true }),
        obtenerIngredientesRecetaColor({ include_inactive: true }),
        obtenerRecetasColorMaestras({ color_produccion_id: colorId, include_inactive: true }),
      ]);
      if (duplicateRecipeRequest.current !== requestId) return;
      const freshColors = asItems(colorRows);
      const freshIngredients = asItems(ingredientRows);
      const freshRecipes = asItems(recipeResponse);
      const freshColor = freshColors.find((candidate) => String(candidate?.id) === String(colorId));
      const freshSource = freshRecipes.find((candidate) => String(candidate?.id) === String(item?.id));
      if (!freshColor || !freshSource) {
        throw new Error('La receta fuente ya no está disponible en el catálogo vigente.');
      }
      if (freshSource.estado === 'INACTIVA') {
        throw new Error('La receta fuente está inactiva en el catálogo vigente y no se puede duplicar.');
      }
      setColors(freshColors);
      setIngredients(freshIngredients);
      setRecipes(freshRecipes);
      setSelectedColorId(freshColor.id);
      const draft = buildRecipeDuplicateDraft(freshSource, freshRecipes, `receta ${freshSource.id}`);
      setRecipeDialog({ open: true, item: null, duplicateSource: freshSource });
      setRecipeForm({
        nombre_variante: draft.nombre_variante,
        producto_sku: draft.producto_sku || '',
        estado: 'BORRADOR',
        es_default: false,
        base_virgen_kg: draft.base_virgen_kg,
        notas: draft.notas,
        lineas: draft.lineas.map((line) => ({
          ...line,
          cantidad: line.tipo_componente === 'MATERIA_PRIMA' ? Number(line.cantidad) * 100 : line.cantidad,
          base_kg: line.base_kg || draft.base_virgen_kg,
        })),
      });
    } catch (requestError) {
      if (duplicateRecipeRequest.current !== requestId) return;
      const message = requestError?.message || apiError(requestError, 'No se pudieron consultar los maestros vigentes para la copia.');
      setDuplicateRecipeLoadError(message);
      setError(message);
    } finally {
      if (duplicateRecipeRequest.current === requestId) setDuplicateRecipeLoading(false);
    }
  };

  const cancelRecipeDialog = () => {
    duplicateRecipeRequest.current += 1;
    setDuplicateRecipeLoading(false);
    setDuplicateRecipeLoadError('');
    setRecipeDialog({ open: false, item: null, duplicateSource: null });
  };

  const addRecipeLine = () => {
    if (recipeInputsLocked) return;
    setRecipeForm((current) => ({
      ...current,
      lineas: [...current.lineas, {
        material_id: '',
        tipo_componente: 'MATERIA_PRIMA',
        cantidad: '',
        base_kg: current.base_virgen_kg || 25,
      }],
    }));
  };

  const updateRecipeLine = (index, field, value) => {
    if (recipeInputsLocked) return;
    setRecipeForm((current) => ({
      ...current,
      lineas: current.lineas.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const next = { ...line, [field]: value };
        if (field === 'material_id') {
          const material = ingredients.find((item) => String(item.id) === String(value));
          next.tipo_componente = material?.clase === 'MATERIA_PRIMA'
            ? 'MATERIA_PRIMA'
            : material?.tipo_colorante || 'COLORANTE';
        }
        return next;
      }),
    }));
  };

  const removeRecipeLine = (index) => {
    if (recipeInputsLocked) return;
    setRecipeForm((current) => ({
      ...current,
      lineas: current.lineas.filter((_, lineIndex) => lineIndex !== index),
    }));
  };

  const resinFraction = recipeForm.lineas
    .filter((line) => line.tipo_componente === 'MATERIA_PRIMA')
    .reduce((sum, line) => sum + (Number(line.cantidad) || 0), 0);

  const buildRecipePayload = () => {
    const payload = {
      color_produccion_id: selectedColorId,
      nombre_variante: recipeForm.nombre_variante.trim(),
      producto_sku: recipeForm.producto_sku.trim() || null,
      estado: recipeDialog.duplicateSource ? 'BORRADOR' : recipeForm.estado,
      es_default: recipeDialog.duplicateSource ? false : recipeForm.estado === 'APROBADA' && recipeForm.es_default,
      base_virgen_kg: Number(recipeForm.base_virgen_kg),
      notas: recipeDialog.duplicateSource
        ? ensureRecipeSourceNote(recipeForm.notas, recipeDialog.duplicateSource)
        : recipeForm.notas.trim() || null,
      lineas: recipeForm.lineas.map((line) => ({
        material_id: Number(line.material_id),
        tipo_componente: line.tipo_componente,
        cantidad: line.tipo_componente === 'MATERIA_PRIMA'
          ? Number(line.cantidad) / 100 : Number(line.cantidad),
        base_kg: line.tipo_componente === 'MATERIA_PRIMA'
          ? null
          : Number(line.base_kg || recipeForm.base_virgen_kg),
      })),
    };
    return recipeDialog.duplicateSource
      ? { ...payload, exigir_variante_nueva: true }
      : payload;
  };

  const reconcileRecipeAttempt = async () => {
    if (!uncertainRecipeAttempt || reconcilingRecipe) return;
    const queryColorId = uncertainRecipeAttempt.payload?.color_produccion_id;
    setReconcilingRecipe(true);
    setError('');
    try {
      const response = await obtenerRecetasColorMaestras({
        color_produccion_id: queryColorId,
        include_inactive: true,
      });
      const rows = asItems(response);
      if (String(selectedColorId ?? '') === String(queryColorId ?? '')) setRecipes(rows);
      const confirmed = rows.find((candidate) => (
        candidate?.estado === 'BORRADOR'
        && candidate?.es_default !== true
        && recipeContentMatches(candidate, uncertainRecipeAttempt.payload)
        && sourceNoteMatches(candidate, uncertainRecipeAttempt.source)
      ));
      if (confirmed) {
        setNotice(`Copia confirmada: ${confirmed.nombre_variante} (id ${confirmed.id}, revisión ${confirmed.revision || '—'}).`);
        setRecipeDialog({ open: false, item: null, duplicateSource: null });
        setUncertainRecipeAttempt(null);
      } else {
        const sameIdentity = rows.some((candidate) => (
          String(candidate?.color_produccion_id ?? '') === String(uncertainRecipeAttempt.payload.color_produccion_id ?? '')
          && String(candidate?.nombre_variante ?? '').trim() === String(uncertainRecipeAttempt.payload.nombre_variante ?? '').trim()
          && String(candidate?.producto_sku ?? '') === String(uncertainRecipeAttempt.payload.producto_sku ?? '')
        ));
        setUncertainRecipeAttempt((current) => ({
          ...current,
          recoveryAllowed: !sameIdentity,
          collision: sameIdentity,
        }));
        setError(sameIdentity
          ? 'Existe una variante con el mismo color, alcance y nombre, pero su contenido o fuente no coincide. No se reintentará a ciegas.'
          : 'La consulta no encontró la copia. Puedes reintentar el guardado de forma explícita; no se enviará automáticamente.');
      }
    } catch (requestError) {
      setError(apiError(requestError, 'No se pudo consultar el catálogo para reconciliar la copia.'));
    } finally {
      setReconcilingRecipe(false);
    }
  };

  const reopenUncertainRecipe = () => {
    if (!uncertainRecipeAttempt) return;
    const colorId = uncertainRecipeAttempt.payload?.color_produccion_id;
    if (colorId != null) setSelectedColorId(colorId);
    setRecipeDialog({ open: true, item: null, duplicateSource: uncertainRecipeAttempt.source });
    setRecipeForm(uncertainRecipeAttempt.form);
    setError('');
  };

  const saveRecipe = async () => {
    const isDuplicate = Boolean(recipeDialog.duplicateSource);
    if (isDuplicate && (duplicateRecipeLoading || duplicateRecipeLoadError)) return;
    const isUncertainDuplicateRetry = Boolean(isDuplicate && uncertainRecipeAttempt?.recoveryAllowed);
    if (isDuplicate && uncertainRecipeAttempt && !uncertainRecipeAttempt.recoveryAllowed) return;
    if (!isUncertainDuplicateRetry) {
      if (recipeForm.estado === 'APROBADA' && !canPublishRecipe) {
        setError('Tu perfil puede guardar borradores, pero no aprobar formulaciones.');
        return;
      }
      const recipeName = recipeForm.nombre_variante.trim();
      if (!selectedColorId || !recipeName) {
        setError('Selecciona un color e ingresa el nombre de la variante.');
        return;
      }
      if (recipeName.length > 120) {
        setError('El nombre de variante no puede superar 120 caracteres.');
        return;
      }
      if (isDuplicate && duplicateReferenceIssues.length) {
        setError('Resuelve las referencias de materiales inactivas o ausentes antes de guardar.');
        return;
      }
      if (isDuplicate && selectedColorInactive) {
        setError('El color fuente está inactivo. Reactívalo o selecciona un color activo antes de duplicar.');
        return;
      }
      if (isDuplicate && recipes.some((item) => (
        String(item.nombre_variante || '').trim().toLocaleLowerCase() === recipeName.toLocaleLowerCase()
      ))) {
        setError('El nombre de variante ya existe para este color y alcance. Elige otro.');
        return;
      }
      if (recipeForm.lineas.some((line) => !line.material_id || Number(line.cantidad) <= 0)) {
        setError('Completa el material y una cantidad positiva en cada línea.');
        return;
      }
      if (recipeForm.estado === 'APROBADA' && Math.abs(resinFraction - 100) > 0.000001) {
        setError('Para aprobar, los porcentajes de materia prima deben sumar 100%.');
        return;
      }
    }
    if (saveRecipeInFlight.current) return;
    saveRecipeInFlight.current = true;
    setSaving(true);
    setError('');
    let payload;
    try {
      payload = isUncertainDuplicateRetry ? uncertainRecipeAttempt.payload : buildRecipePayload();
      const result = recipeDialog.item && !recipeDialog.duplicateSource
        ? await actualizarRecetaColorMaestra(recipeDialog.item.id, {
          ...payload,
          version: recipeDialog.item.version,
        })
        : await crearRecetaColorMaestra(payload);
      setRecipeDialog({ open: false, item: null });
      if (recipeDialog.duplicateSource) setUncertainRecipeAttempt(null);
      setNotice(result.reemplaza_receta_id
        ? `Se creó la revisión ${result.revision}; la anterior quedó histórica.`
        : 'Receta guardada correctamente.');
      await loadRecipes(selectedColorId);
      onRecipeSaved?.(result);
    } catch (requestError) {
      setError(apiError(requestError, 'No se pudo guardar la receta.'));
      const status = requestError?.response?.status || requestError?.status;
      if (!(Number.isInteger(status) && status >= 400 && status < 500) && recipeDialog.duplicateSource) {
        setUncertainRecipeAttempt({
          source: recipeDialog.duplicateSource,
          form: recipeForm,
          payload,
          recoveryAllowed: false,
          collision: false,
        });
      }
    } finally {
      setSaving(false);
      saveRecipeInFlight.current = false;
    }
  };

  const deactivateRecipe = async (item) => {
    if (!window.confirm(`¿Inactivar ${item.nombre_variante} revisión ${item.revision}?`)) return;
    setError('');
    try {
      await inactivarRecetaColorMaestra(item.id, item.version);
      setNotice('Receta inactivada sin borrar su historia.');
      await loadRecipes(selectedColorId);
    } catch (requestError) {
      setError(apiError(requestError, 'No se pudo inactivar la receta.'));
    }
  };

  if (loading) {
    return <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress /></Stack>;
  }

  return (
    <Stack spacing={2.25} sx={{ maxWidth: 1500, mx: 'auto' }}>
      {embedded ? (
        <Typography variant="h6" fontWeight={800}>Colores y formulaciones de la OF</Typography>
      ) : (
        <PageHeader
          title="Colores y recetas"
          description="Administra colores visuales y fórmulas manuales versionadas. Las OP conservan su propia copia histórica."
        />
      )}

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
      {uncertainRecipeAttempt && !recipeDialog.open && (
        <Alert severity="warning" action={<Stack direction="row" spacing={1}><Button color="inherit" onClick={reopenUncertainRecipe}>Reabrir copia</Button><Button color="inherit" onClick={reconcileRecipeAttempt} disabled={reconcilingRecipe}>{reconcilingRecipe ? 'Consultando…' : 'Revisar catálogo'}</Button></Stack>}>
          Hay un guardado de copia sin confirmar. Revisa el catálogo antes de volver a duplicar; puedes restaurar el formulario original.
        </Alert>
      )}

      <Alert severity="info">
        El HEX es solo una referencia visual. La dosis aprobada se expresa contra kg de material virgen; la materia de segunda no aumenta esa base.
      </Alert>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" sx={{ p: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>Maestro de colores</Typography>
                <Typography variant="caption" color="text.secondary">{visibleColors.length} colores visibles</Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" onClick={() => { resetFamilyForm(); setFamilyDialogOpen(true); }}>Gestionar familias</Button>
                <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openNewColor}>Nuevo color</Button>
              </Stack>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ px: 2, pb: 2 }}>
              <TextField
                fullWidth
                size="small"
                label="Buscar color"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <FormControlLabel
                control={<Switch checked={includeInactive} onChange={(event) => setIncludeInactive(event.target.checked)} />}
                label="Inactivos"
              />
            </Stack>
            <TableContainer sx={{ maxHeight: 560 }}>
              <Table size="small" stickyHeader aria-label="Maestro de colores">
                <TableHead><TableRow><TableCell>Color</TableCell><TableCell>Estado</TableCell><TableCell align="right">Acciones</TableCell></TableRow></TableHead>
                <TableBody>
                  {visibleColors.map((item) => (
                    <TableRow
                      key={item.id}
                      hover
                      selected={item.id === selectedColorId}
                      onClick={() => setSelectedColorId(item.id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Stack direction="row" spacing={1.25} alignItems="center">
                          <ColorSwatch hex={item.hex_referencia} />
                          <Box><Typography variant="body2" sx={{ fontWeight: 750 }}>{item.nombre}</Typography><Typography variant="caption" color="text.secondary">{item.hex_referencia || 'Sin HEX'} · ID {item.id}</Typography></Box>
                        </Stack>
                      </TableCell>
                      <TableCell><Chip size="small" label={item.activo === false ? 'INACTIVO' : 'ACTIVO'} color={item.activo === false ? 'default' : 'success'} variant="outlined" /></TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <IconButton aria-label={`Editar color ${item.nombre}`} size="small" onClick={(event) => { event.stopPropagation(); openEditColor(item); }}><EditOutlinedIcon fontSize="small" /></IconButton>
                        <IconButton aria-label={`${item.activo === false ? 'Reactivar' : 'Inactivar'} color ${item.nombre}`} size="small" onClick={(event) => { event.stopPropagation(); toggleColor(item); }}><PowerSettingsNewOutlinedIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {visibleColors.length === 0 && <TableRow><TableCell colSpan={3} align="center" sx={{ py: 5 }}>No hay colores para mostrar.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 7 }}>
          <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ p: 2 }}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <ColorSwatch hex={selectedColor?.hex_referencia} size={36} />
                <Box><Typography variant="h6" sx={{ fontWeight: 800 }}>{selectedColor?.nombre || 'Seleccione un color'}</Typography><Typography variant="caption" color="text.secondary">Recetas propias y revisiones históricas</Typography></Box>
              </Stack>
              <Button variant="contained" disabled={!selectedColor || selectedColorInactive} startIcon={<ScienceOutlinedIcon />} onClick={openNewRecipe}>Nueva receta</Button>
            </Stack>
            {selectedColorInactive && <Alert severity="warning" sx={{ mx: 2, mb: 1 }}>Este color está inactivo. No se pueden crear ni duplicar recetas hasta reactivarlo.</Alert>}
            {recipeLoading ? (
              <Stack alignItems="center" sx={{ py: 7 }}><CircularProgress size={28} /></Stack>
            ) : (
              <TableContainer sx={{ maxHeight: 560 }}>
                <Table size="small" stickyHeader aria-label="Recetas del color seleccionado">
                  <TableHead><TableRow><TableCell>Variante</TableCell><TableCell>Composición</TableCell><TableCell>Estado</TableCell><TableCell align="right">Acciones</TableCell></TableRow></TableHead>
                  <TableBody>
                    {visibleRecipes.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell sx={{ verticalAlign: 'top' }}>
                          <Typography variant="body2" sx={{ fontWeight: 800 }}>{item.nombre_variante}</Typography>
                          <Typography variant="caption" color="text.secondary">Rev. {item.revision} · {item.producto_sku || 'Aplicación general'}</Typography>
                          {item.es_default && <Chip size="small" label="PREDETERMINADA" color="primary" sx={{ display: 'flex', mt: 0.75, width: 'fit-content' }} />}
                        </TableCell>
                        <TableCell>
                          <Stack spacing={0.35}>
                            {item.lineas.map((line) => <Typography key={line.id || `${line.material_id}-${line.tipo_componente}`} variant="caption">{line.material_nombre}: {line.unidad === 'FRACCION' ? `${Number(line.cantidad) * 100}%` : `${line.cantidad} g/${line.base_kg} kg virgen`}</Typography>)}
                            {item.lineas.length === 0 && <Typography variant="caption" color="warning.main">Borrador sin componentes</Typography>}
                          </Stack>
                        </TableCell>
                        <TableCell><Chip size="small" label={item.estado} color={item.estado === 'APROBADA' ? 'success' : item.estado === 'BORRADOR' ? 'warning' : 'default'} variant="outlined" /></TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          <Tooltip title={item.estado === 'APROBADA' ? 'Editar crea una nueva revisión' : 'Editar borrador'}><IconButton aria-label={`Editar receta ${item.nombre_variante}`} size="small" onClick={() => openEditRecipe(item)}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title={selectedColorInactive ? 'El color fuente está inactivo' : !can('ARTICULO_ADMINISTRAR') ? 'No tienes permiso para duplicar recetas' : uncertainRecipeAttempt ? 'Revisa primero el guardado incierto' : 'Duplicar como borrador'}><span><IconButton aria-label={`Duplicar receta ${item.nombre_variante} como borrador`} size="small" disabled={item.estado === 'INACTIVA' || selectedColorInactive || !can('ARTICULO_ADMINISTRAR') || Boolean(uncertainRecipeAttempt)} onClick={() => openDuplicateRecipe(item)}><ContentCopyOutlinedIcon fontSize="small" /></IconButton></span></Tooltip>
                          {item.estado !== 'INACTIVA' && <IconButton aria-label={`Inactivar receta ${item.nombre_variante}`} size="small" onClick={() => deactivateRecipe(item)}><PowerSettingsNewOutlinedIcon fontSize="small" /></IconButton>}
                        </TableCell>
                      </TableRow>
                    ))}
                    {visibleRecipes.length === 0 && <TableRow><TableCell colSpan={4} align="center" sx={{ py: 6 }}>{selectedColor ? 'Este color todavía no tiene recetas propias.' : 'Seleccione un color.'}</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={colorDialog.open} onClose={() => !saving && setColorDialog({ open: false, item: null })} maxWidth="sm" fullWidth>
        <DialogTitle>{colorDialog.item ? 'Editar color' : 'Nuevo color de producción'}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Nombre del color base" value={colorForm.nombre} onChange={(event) => setColorForm((current) => ({ ...current, nombre: event.target.value }))} autoFocus fullWidth />
          <Stack spacing={0.5}>
            <TextField select label="Acabado / familia de color" value={colorForm.familia_color_id} onChange={(event) => setColorForm((current) => ({ ...current, familia_color_id: event.target.value }))} fullWidth>{families.filter((family) => family.activo !== false || family.id === colorForm.familia_color_id).map((family) => <MenuItem key={family.id} value={family.id}>{family.nombre}{family.activo === false ? ' (INACTIVA)' : ''}</MenuItem>)}</TextField>
            <Button size="small" startIcon={<AddOutlinedIcon />} sx={{ alignSelf: 'flex-start' }} onClick={() => { resetFamilyForm(); setFamilyDialogOpen(true); }}>Crear acabado / familia</Button>
          </Stack>
          <ColorHexPickerField
            value={colorForm.hex_referencia}
            onChange={(hex_referencia) => setColorForm((current) => ({ ...current, hex_referencia }))}
            disabled={saving}
          />
          {colorDialog.item && <FormControlLabel control={<Switch checked={colorForm.activo} onChange={(event) => setColorForm((current) => ({ ...current, activo: event.target.checked }))} />} label="Disponible para nuevas OP" />}
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setColorDialog({ open: false, item: null })} disabled={saving}>Cancelar</Button><Button variant="contained" onClick={saveColor} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button></DialogActions>
      </Dialog>

      <Dialog open={familyDialogOpen} onClose={() => !saving && setFamilyDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Familias de color</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">Define acabados como SÓLIDO, CARAMELO, TRANSPARENTE o PASTEL. Una familia inactiva deja de estar disponible para colores nuevos, sin romper los existentes.</Alert>
            <Grid container spacing={1} alignItems="center">
              <Grid size={{ xs: 12, sm: 7 }}><TextField fullWidth label="Nombre de familia" value={familyForm.nombre} onChange={(event) => setFamilyForm((current) => ({ ...current, nombre: event.target.value }))} /></Grid>
              <Grid size={{ xs: 12, sm: 3 }}><TextField fullWidth label="Código automático" value={editingFamily ? (familyForm.codigo_display || familyForm.codigo) : 'FC-######'} disabled helperText={editingFamily ? 'Código inmutable' : 'Se asignará al guardar'} /></Grid>
              <Grid size={{ xs: 12, sm: 2 }}><Button fullWidth variant="contained" onClick={saveFamily} disabled={saving}>{editingFamily ? 'Guardar' : 'Crear'}</Button></Grid>
            </Grid>
            {editingFamily && <Button size="small" onClick={resetFamilyForm} sx={{ alignSelf: 'flex-start' }}>Cancelar edición</Button>}
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 360 }}>
              <Table size="small" stickyHeader aria-label="Familias de color">
                <TableHead><TableRow><TableCell>Familia</TableCell><TableCell>Código</TableCell><TableCell>Estado</TableCell><TableCell align="right">Acciones</TableCell></TableRow></TableHead>
                <TableBody>
                  {families.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.nombre}</TableCell>
                      <TableCell>{item.codigo_display || item.codigo || '—'}</TableCell>
                      <TableCell><Chip size="small" label={item.activo === false ? 'INACTIVA' : 'ACTIVA'} color={item.activo === false ? 'default' : 'success'} variant="outlined" /></TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <IconButton size="small" aria-label={`Editar familia ${item.nombre}`} onClick={() => editFamily(item)}><EditOutlinedIcon fontSize="small" /></IconButton>
                        <IconButton size="small" aria-label={`${item.activo === false ? 'Reactivar' : 'Inactivar'} familia ${item.nombre}`} onClick={() => toggleFamily(item)}><PowerSettingsNewOutlinedIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setFamilyDialogOpen(false)} disabled={saving}>Cerrar</Button></DialogActions>
      </Dialog>

      <Dialog open={recipeDialog.open} onClose={() => !saving && !reconcilingRecipe && cancelRecipeDialog()} maxWidth="md" fullWidth>
        <DialogTitle>{recipeDialog.duplicateSource ? `Duplicar como borrador · ${recipeDialog.duplicateSource.nombre_variante}` : recipeDialog.item ? `${recipeDialog.item.estado === 'APROBADA' ? 'Nueva revisión de' : 'Editar'} ${recipeDialog.item.nombre_variante}` : `Nueva receta para ${selectedColor?.nombre || ''}`}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {recipeDialog.duplicateSource && duplicateRecipeLoading && <Alert severity="info">Consultando colores, materiales y recetas vigentes… El guardado está bloqueado hasta completar la consulta.</Alert>}
          {recipeDialog.duplicateSource && duplicateRecipeLoadError && <Alert severity="error" action={<Button color="inherit" onClick={() => openDuplicateRecipe(recipeDialog.duplicateSource)}>Reintentar consulta</Button>}>No se pudo preparar la copia con los maestros vigentes.</Alert>}
          {recipeDialog.duplicateSource && <Alert severity="info">Fuente: {recipeDialog.duplicateSource.nombre_variante} · revisión {recipeDialog.duplicateSource.revision || '—'}. Se guardará una variante nueva BORRADOR y no predeterminada; aprobar es una acción posterior.</Alert>}
          {recipeDialog.duplicateSource && selectedColorInactive && <Alert severity="error">El color fuente está inactivo. Reactívalo o selecciona un color activo para habilitar la copia.</Alert>}
          {duplicateReferenceIssues.length > 0 && <Alert severity="error">La copia está bloqueada hasta resolver las referencias:<Box component="ul" sx={{ m: 0, pl: 2 }}>{duplicateReferenceIssues.map((issue) => <li key={issue}>{issue}</li>)}</Box></Alert>}
          {uncertainRecipeAttempt && <Alert severity="warning" action={<Button color="inherit" onClick={reconcileRecipeAttempt} disabled={reconcilingRecipe}>{reconcilingRecipe ? 'Consultando…' : 'Revisar catálogo'}</Button>}>{uncertainRecipeAttempt.collision ? 'Hay una variante con el mismo nombre, pero su contenido o fuente no coincide. No se reintentará a ciegas.' : uncertainRecipeAttempt.recoveryAllowed ? 'La consulta no encontró la copia. Puedes reintentar explícitamente; no se enviará automáticamente.' : 'No se pudo confirmar el guardado de esta copia. Revisa el catálogo antes de reintentar.'}</Alert>}
          {recipeDialog.item?.estado === 'APROBADA' && <Alert severity="info">La revisión aprobada no será sobrescrita: se conservará inactiva y se creará la siguiente revisión.</Alert>}
          <Box component="fieldset" disabled={saving || reconcilingRecipe || Boolean(uncertainRecipeAttempt)} sx={{ border: 0, p: 0, m: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Nombre de variante" value={recipeForm.nombre_variante} onChange={(event) => { if (!recipeInputsLocked) setRecipeForm((current) => ({ ...current, nombre_variante: event.target.value })); }} helperText="Máximo 120 caracteres" slotProps={{ htmlInput: { maxLength: 120 } }} /></Grid>
            <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Producto SKU (opcional)" value={recipeForm.producto_sku} onChange={(event) => { if (!recipeInputsLocked) setRecipeForm((current) => ({ ...current, producto_sku: event.target.value })); }} helperText="Vacío = receta general del color" /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField select fullWidth label="Estado" value={recipeForm.estado} disabled={Boolean(recipeDialog.duplicateSource)} onChange={(event) => { if (!recipeInputsLocked) setRecipeForm((current) => ({ ...current, estado: event.target.value, es_default: event.target.value === 'APROBADA' ? current.es_default : false })); }}><MenuItem value="BORRADOR">BORRADOR</MenuItem>{canPublishRecipe && !recipeDialog.duplicateSource && <MenuItem value="APROBADA">APROBADA</MenuItem>}</TextField></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth type="number" label="Base virgen (kg)" value={recipeForm.base_virgen_kg} onChange={(event) => { if (!recipeInputsLocked) setRecipeForm((current) => ({ ...current, base_virgen_kg: event.target.value })); }} slotProps={{ htmlInput: { min: 0.001, step: 0.001 } }} /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><FormControlLabel control={<Switch disabled={recipeForm.estado !== 'APROBADA'} checked={recipeForm.es_default} onChange={(event) => { if (!recipeInputsLocked) setRecipeForm((current) => ({ ...current, es_default: event.target.checked })); }} />} label="Predeterminada" /></Grid>
          </Grid>
          <TextField fullWidth multiline minRows={2} label="Notas" value={recipeForm.notas} onChange={(event) => { if (!recipeInputsLocked) setRecipeForm((current) => ({ ...current, notas: event.target.value })); }} />
          <Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography variant="h6" sx={{ fontWeight: 750 }}>Componentes</Typography><Typography variant="caption" color={recipeForm.estado === 'APROBADA' && Math.abs(resinFraction - 100) > 0.000001 ? 'error.main' : 'text.secondary'}>Total materias primas: {resinFraction.toFixed(2)}%</Typography></Box><Button startIcon={<AddOutlinedIcon />} onClick={addRecipeLine}>Agregar componente</Button></Stack>
          {ingredients.filter((item) => item.activo !== false).length === 0 && (
            <Alert severity="info">No hay materiales activos disponibles para esta formulación. Agrega un componente y créalo aquí mismo.</Alert>
          )}
          {recipeForm.lineas.map((line, index) => {
            const selectedIngredient = ingredients.find((item) => String(item.id) === String(line.material_id));
            const isRaw = line.tipo_componente === 'MATERIA_PRIMA';
            return (
              <Paper key={`${index}-${line.material_id}`} variant="outlined" sx={{ p: 1.5 }}>
                <Grid container spacing={1.25} alignItems="center">
                  <Grid size={{ xs: 12, md: 5 }}><Stack spacing={0.5}><TextField select fullWidth size="small" label="Material" value={line.material_id} onChange={(event) => updateRecipeLine(index, 'material_id', event.target.value)}>{ingredients.filter((item) => item.activo !== false).map((item) => <MenuItem key={item.id} value={item.id}>{item.codigo} · {item.nombre}</MenuItem>)}</TextField><Button size="small" startIcon={<AddOutlinedIcon />} sx={{ alignSelf: 'flex-start' }} onClick={() => setMaterialDialog({ open: true, lineIndex: index, role: line.tipo_componente })}>Crear {line.tipo_componente === 'MATERIA_PRIMA' ? 'materia prima' : line.tipo_componente === 'ADITIVO' ? 'aditivo' : 'colorante'}</Button></Stack></Grid>
                  <Grid size={{ xs: 12, md: 2.5 }}><TextField select fullWidth size="small" label="Rol" value={line.tipo_componente} disabled={selectedIngredient?.clase === 'MATERIA_PRIMA'} onChange={(event) => updateRecipeLine(index, 'tipo_componente', event.target.value)}>{selectedIngredient?.clase === 'MATERIA_PRIMA' ? <MenuItem value="MATERIA_PRIMA">Materia prima</MenuItem> : selectedIngredient?.clase === 'COLORANTE' ? [<MenuItem key="COLORANTE" value="COLORANTE">Colorante</MenuItem>, <MenuItem key="ADITIVO" value="ADITIVO">Aditivo</MenuItem>] : [<MenuItem key="MATERIA_PRIMA" value="MATERIA_PRIMA">Materia prima</MenuItem>, <MenuItem key="COLORANTE" value="COLORANTE">Colorante</MenuItem>, <MenuItem key="ADITIVO" value="ADITIVO">Aditivo</MenuItem>]}</TextField></Grid>
                  <Grid size={{ xs: 10, md: isRaw ? 4 : 2 }}><TextField fullWidth size="small" type="number" label={isRaw ? 'Materia prima (%)' : 'Dosis (g)'} value={line.cantidad} onChange={(event) => updateRecipeLine(index, 'cantidad', event.target.value)} slotProps={{ htmlInput: { min: 0.0001, max: isRaw ? 100 : undefined, step: isRaw ? 0.01 : 0.0001 } }} /></Grid>
                  {!isRaw && <Grid size={{ xs: 10, md: 2 }}><TextField fullWidth size="small" type="number" label="Por kg virgen" value={line.base_kg} onChange={(event) => updateRecipeLine(index, 'base_kg', event.target.value)} slotProps={{ htmlInput: { min: 0.001, step: 0.001 } }} /></Grid>}
                  <Grid size={{ xs: 2, md: 0.5 }}><IconButton aria-label={`Eliminar componente ${index + 1}`} color="error" onClick={() => removeRecipeLine(index)}><DeleteOutlineIcon fontSize="small" /></IconButton></Grid>
                </Grid>
              </Paper>
            );
          })}
          {recipeForm.lineas.length === 0 && <Alert severity="warning">Esta formulación todavía no tiene componentes. Puede guardar el borrador vacío; para aprobarlo, los porcentajes de materia prima deben sumar 100%.</Alert>}
          </Box>
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => !saving && !reconcilingRecipe && cancelRecipeDialog()} disabled={saving || reconcilingRecipe}>Cancelar</Button><Button variant="contained" onClick={saveRecipe} disabled={saving || reconcilingRecipe || duplicateRecipeLoading || Boolean(duplicateRecipeLoadError) || (!uncertainRecipeAttempt && duplicateReferenceIssues.length > 0) || (Boolean(uncertainRecipeAttempt) && !uncertainRecipeAttempt.recoveryAllowed)}>{saving ? 'Guardando…' : recipeDialog.duplicateSource && uncertainRecipeAttempt?.recoveryAllowed ? 'Reintentar guardado' : recipeDialog.duplicateSource ? 'Guardar borrador' : recipeForm.estado === 'APROBADA' ? embedded ? 'Aprobar y seleccionar' : 'Aprobar receta' : recipeDialog.item?.estado === 'APROBADA' ? 'Crear revisión' : 'Guardar receta'}</Button></DialogActions>
      </Dialog>
      <MaterialQuickCreateDialog
        open={materialDialog.open}
        role={materialDialog.role}
        categories={categories}
        onClose={() => setMaterialDialog({ open: false, lineIndex: null, role: 'MATERIA_PRIMA' })}
        onCreated={(created) => {
          setIngredients((current) => [...current, created]);
          setRecipeForm((current) => ({
            ...current,
            lineas: current.lineas.map((line, index) => index === materialDialog.lineIndex
              ? { ...line, material_id: created.id, tipo_componente: materialDialog.role }
              : line),
          }));
          setMaterialDialog({ open: false, lineIndex: null, role: 'MATERIA_PRIMA' });
        }}
      />
    </Stack>
  );
}

export default ColoresRecetasAdmin;
