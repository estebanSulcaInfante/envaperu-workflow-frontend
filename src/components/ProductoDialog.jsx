import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Box, Divider, Stack, TextField, Typography,
} from '@mui/material';
import CreateOptionAutocomplete from './ui/CreateOptionAutocomplete';
import ClassificationQuickCreateDialog from './ui/ClassificationQuickCreateDialog';
import {
  actualizarProducto,
  crearProducto,
  eliminarImagenProducto,
  guardarImagenProducto,
  obtenerFamilias,
  obtenerLineas,
} from '../services/api';

const emptyProduct = {
  cod_sku_pt: '',
  producto: '',
  familia_id: '',
  linea_id: '',
  peso_g: '',
  marca: '',
};

const optionalNumber = (value) => (
  value === '' || value === null || value === undefined
    ? null : Number(value)
);

export default function ProductoDialog({
  open, onClose, onSaved, producto,
}) {
  const [formData, setFormData] = useState(emptyProduct);
  const [maestros, setMaestros] = useState({ lineas: [], familias: [] });
  const [classificationDialog, setClassificationDialog] = useState({
    open: false,
    entity: 'linea',
    initialName: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);

  useEffect(() => {
    obtenerLineas()
      .then((lineas) => setMaestros((current) => ({ ...current, lineas })))
      .catch(() => setSaveError('No se pudieron cargar las líneas.'));
  }, []);

  useEffect(() => {
    setSaveError('');
    setAttempted(false);
    setImageFile(null);
    setRemoveImage(false);
    setFormData(producto ? {
      ...emptyProduct,
      cod_sku_pt: producto.cod_sku_pt || producto.sku || '',
      producto: producto.producto || producto.nombre || '',
      familia_id: producto.familia_id || '',
      linea_id: producto.linea_id || '',
      peso_g: producto.peso_g ?? '',
      marca: producto.marca || '',
    } : emptyProduct);
  }, [producto, open]);

  useEffect(() => {
    let active = true;
    if (!open || !formData.linea_id) {
      setMaestros((current) => ({ ...current, familias: [] }));
      return () => { active = false; };
    }
    obtenerFamilias({ linea_id: formData.linea_id })
      .then((familias) => {
        if (!active) return;
        setMaestros((current) => ({ ...current, familias }));
        setFormData((current) => (
          current.familia_id
          && !familias.some((familia) => familia.id === current.familia_id)
            ? { ...current, familia_id: '' } : current
        ));
      })
      .catch(() => {
        if (active) setSaveError('No se pudieron cargar las familias de la línea.');
      });
    return () => { active = false; };
  }, [open, formData.linea_id]);

  const validation = useMemo(() => {
    const validateNumber = (value, { integer = false, min = 0 } = {}) => {
      if (value === '' || value === null || value === undefined) return '';
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return 'Ingresa un número válido.';
      if (parsed < min) return `Debe ser mayor o igual a ${min}.`;
      if (integer && !Number.isInteger(parsed)) return 'Debe ser un número entero.';
      return '';
    };
    return {
      producto: formData.producto.trim() ? '' : 'El nombre es obligatorio.',
      linea_id: formData.linea_id ? '' : 'Selecciona una línea.',
      familia_id: formData.familia_id ? '' : 'Selecciona una familia.',
      peso_g: validateNumber(formData.peso_g),
    };
  }, [formData]);
  const complete = useMemo(
    () => Object.values(validation).every((message) => !message),
    [validation],
  );

  const openClassification = (entity, initialName = '') => {
    if (entity === 'familia' && !formData.linea_id) return;
    setClassificationDialog({ open: true, entity, initialName });
  };

  const registerClassification = (created) => {
    if (classificationDialog.entity === 'linea') {
      setMaestros((current) => ({
        ...current,
        lineas: current.lineas.some((item) => item.id === created.id)
          ? current.lineas : [...current.lineas, created],
        familias: [],
      }));
      setFormData((current) => ({
        ...current, linea_id: created.id, familia_id: '',
      }));
    } else {
      setMaestros((current) => ({
        ...current,
        familias: current.familias.some((item) => item.id === created.id)
          ? current.familias : [...current.familias, created],
      }));
      setFormData((current) => ({ ...current, familia_id: created.id }));
    }
  };

  const handleSubmit = async () => {
    setSaveError('');
    setAttempted(true);
    if (!complete) {
      setSaveError('Revisa los campos señalados antes de guardar.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        producto: formData.producto.trim(),
        linea_id: Number(formData.linea_id),
        familia_id: Number(formData.familia_id),
        peso_g: optionalNumber(formData.peso_g),
        marca: formData.marca.trim() || null,
      };
      const saved = producto
        ? await actualizarProducto(formData.cod_sku_pt, payload)
        : await crearProducto(payload);
      const sku = saved.cod_sku_pt || formData.cod_sku_pt;
      if (imageFile) await guardarImagenProducto(sku, imageFile);
      else if (removeImage && producto?.imagen_url) await eliminarImagenProducto(sku);
      await onSaved?.(saved);
      onClose();
    } catch (error) {
      setSaveError(
        error?.response?.data?.error
        || error?.response?.data?.message
        || error?.message
        || 'No se pudo guardar el producto.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>{producto ? 'Editar producto terminado' : 'Nuevo producto terminado'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {saveError && <Alert severity="error">{saveError}</Alert>}
          <Alert severity="info">
            El alta crea únicamente la identidad maestra. La BOM se define y aprueba
            posteriormente en Ingeniería SCM.
          </Alert>

          <Typography variant="subtitle2" color="primary">Identidad obligatoria</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="SKU automático"
              value={producto
                ? formData.cod_sku_pt
                : 'PT-###### · se asignará al guardar'}
              helperText="Identificador estable e inmutable."
              slotProps={{ input: { readOnly: true } }}
              fullWidth
            />
            <TextField
              label="Nombre del producto"
              value={formData.producto}
              onChange={(event) => setFormData({
                ...formData, producto: event.target.value,
              })}
              required
              error={attempted && Boolean(validation.producto)}
              helperText={attempted ? validation.producto : ''}
              autoFocus
              fullWidth
            />
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <CreateOptionAutocomplete
              options={maestros.lineas}
              getOptionLabel={(option) => option.nombre}
              value={maestros.lineas.find(
                (line) => line.id === formData.linea_id,
              ) || null}
              onChange={(selected) => {
                setMaestros((current) => ({ ...current, familias: [] }));
                setFormData((current) => ({
                  ...current,
                  linea_id: selected?.id || '',
                  familia_id: '',
                }));
              }}
              onCreateOption={(name) => openClassification('linea', name)}
              createLabel={(name) => (
                name ? `Crear Línea “${name}”…` : 'Crear nueva Línea…'
              )}
              label="Línea"
              required
              error={attempted && Boolean(validation.linea_id)}
              helperText={attempted ? validation.linea_id : ''}
            />
            <CreateOptionAutocomplete
              options={maestros.familias}
              getOptionLabel={(option) => option.nombre}
              value={maestros.familias.find(
                (family) => family.id === formData.familia_id,
              ) || null}
              onChange={(selected) => setFormData((current) => ({
                ...current, familia_id: selected?.id || '',
              }))}
              onCreateOption={(name) => openClassification('familia', name)}
              createLabel={(name) => (
                name
                  ? `Crear Familia “${name}”…`
                  : 'Crear nueva Familia en esta Línea…'
              )}
              label="Familia"
              disabled={!formData.linea_id}
              required
              error={attempted && Boolean(validation.familia_id)}
              helperText={attempted && validation.familia_id
                ? validation.familia_id
                : formData.linea_id
                  ? 'Solo familias asociadas a la línea seleccionada.'
                  : 'Selecciona primero una línea.'}
            />
          </Stack>

          <Divider />
          <Typography variant="subtitle2" color="primary">Imagen opcional</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <Box
              component="img"
              src={imageFile
                ? URL.createObjectURL(imageFile)
                : (!removeImage && producto?.imagen_url) || undefined}
              alt="Vista previa del producto"
              sx={{ width: 112, height: 112, objectFit: 'contain', border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'grey.50' }}
            />
            <Stack spacing={1} alignItems={{ xs: 'stretch', sm: 'flex-start' }}>
              <Button component="label" variant="outlined">
                {imageFile || producto?.imagen_url ? 'Cambiar imagen' : 'Seleccionar imagen'}
                <input
                  hidden
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    if (file && file.size > 2 * 1024 * 1024) {
                      setSaveError('La imagen no puede superar 2 MB.');
                      return;
                    }
                    setImageFile(file);
                    setRemoveImage(false);
                  }}
                />
              </Button>
              {(imageFile || (!removeImage && producto?.imagen_url)) && (
                <Button color="error" onClick={() => { setImageFile(null); setRemoveImage(true); }}>
                  Quitar imagen
                </Button>
              )}
              <Typography variant="caption" color="text.secondary">JPG, PNG o WebP; máximo 2 MB.</Typography>
            </Stack>
          </Stack>

          <Divider />
          <Typography variant="subtitle2" color="primary">
            Referencias logísticas opcionales
          </Typography>
          <Typography variant="body2" color="text.secondary">
            No forman parte de la identidad ni son necesarias para guardar.
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Peso referencial (g)"
              type="number"
              value={formData.peso_g}
              onChange={(event) => setFormData({
                ...formData, peso_g: event.target.value,
              })}
              slotProps={{ htmlInput: { min: 0, step: 0.001 } }}
              error={attempted && Boolean(validation.peso_g)}
              helperText={attempted ? validation.peso_g : ''}
              fullWidth
            />
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Marca"
              value={formData.marca}
              onChange={(event) => setFormData({
                ...formData, marca: event.target.value,
              })}
              fullWidth
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? 'Guardando…' : producto ? 'Guardar cambios' : 'Crear producto'}
        </Button>
      </DialogActions>
      <ClassificationQuickCreateDialog
        open={classificationDialog.open}
        entity={classificationDialog.entity}
        linea={maestros.lineas.find(
          (line) => line.id === formData.linea_id,
        ) || null}
        initialName={classificationDialog.initialName}
        onClose={() => setClassificationDialog((current) => ({
          ...current, open: false,
        }))}
        onCreated={registerClassification}
      />
    </Dialog>
  );
}
