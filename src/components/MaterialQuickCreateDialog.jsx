import { useState } from 'react';
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Stack, TextField,
} from '@mui/material';
import { crearMaterialScm } from '../services/scmCatalogApi';

export default function MaterialQuickCreateDialog({ open, role, categories, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const close = () => {
    if (saving) return;
    setName('');
    setCategoryId('');
    setError('');
    onClose();
  };

  const save = async () => {
    if (!name.trim() || !categoryId) {
      setError('Ingresa el nombre y selecciona una categoría de recepción activa.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const created = await crearMaterialScm({
        nombre: name.trim(),
        clase: role === 'MATERIA_PRIMA' ? 'MATERIA_PRIMA' : 'COLORANTE',
        categoria_recepcion_id: Number(categoryId),
        unidad_base: 'KG',
        activo: true,
        ...(role !== 'MATERIA_PRIMA' ? { tipo_colorante: role } : {}),
      });
      setName('');
      setCategoryId('');
      onCreated(created);
    } catch (requestError) {
      setError(requestError?.response?.data?.error?.message
        || requestError?.response?.data?.error
        || requestError?.message
        || 'No se pudo crear el material.');
    } finally {
      setSaving(false);
    }
  };

  const available = categories.filter((category) => category.activo !== false);
  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>Crear {role === 'MATERIA_PRIMA' ? 'materia prima' : role === 'ADITIVO' ? 'aditivo' : 'colorante'}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 1 }}>
          <Alert severity="info">El material quedará en el catálogo general con unidad KG y volverá seleccionado a la receta.</Alert>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField autoFocus required fullWidth label="Nombre del material" value={name} onChange={(event) => setName(event.target.value)} />
          <TextField select required fullWidth label="Categoría de recepción" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} helperText="Define cómo se recibirá y controlará este material.">
            {available.map((category) => <MenuItem key={category.id} value={category.id}>{category.codigo} · {category.nombre}</MenuItem>)}
          </TextField>
          {available.length === 0 && <Alert severity="warning">No hay categorías de recepción activas. Configura una antes de crear materiales.</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={saving}>Cancelar</Button>
        <Button variant="contained" onClick={save} disabled={saving || available.length === 0}>Crear y seleccionar</Button>
      </DialogActions>
    </Dialog>
  );
}
