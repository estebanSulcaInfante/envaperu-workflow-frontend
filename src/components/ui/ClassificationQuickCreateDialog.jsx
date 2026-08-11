import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  asociarFamiliaALinea,
  crearFamiliaEnLinea,
  crearLinea,
  obtenerFamilias,
} from '../../services/api';

const emptyForm = { nombre: '' };

/**
 * Alta contextual de los clasificadores de producto.
 * Una Familia siempre nace asociada atómicamente a la Línea recibida.
 */
function ClassificationQuickCreateDialog({
  open,
  entity = 'linea',
  linea = null,
  initialName = '',
  onClose,
  onCreated,
}) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [globalFamilies, setGlobalFamilies] = useState([]);
  const [checkingFamilies, setCheckingFamilies] = useState(false);
  const isFamily = entity === 'familia';
  const normalizedName = form.nombre.trim().toLocaleUpperCase('es-PE');
  const existingFamily = isFamily
    ? globalFamilies.find((item) => item.nombre.trim().toLocaleUpperCase('es-PE') === normalizedName)
    : null;
  const existingFamilyInactive = existingFamily?.activo === false;

  useEffect(() => {
    if (!open) return;
    setForm({ nombre: initialName.trim().toUpperCase() });
    setSaving(false);
    setError('');
    if (entity === 'familia') {
      setCheckingFamilies(true);
      obtenerFamilias({ include_inactive: true })
        .then((items) => setGlobalFamilies(Array.isArray(items) ? items : items?.items || []))
        .catch(() => setGlobalFamilies([]))
        .finally(() => setCheckingFamilies(false));
    } else {
      setGlobalFamilies([]);
    }
  }, [entity, initialName, open]);

  const handleClose = () => {
    if (!saving) onClose?.();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nombre = form.nombre.trim().toUpperCase();

    if (!nombre) {
      setError('Completa el nombre.');
      return;
    }
    if (isFamily && !linea?.id) {
      setError('Selecciona una Línea antes de crear la Familia.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = { nombre };
      const response = isFamily
        ? existingFamily
          ? await asociarFamiliaALinea(linea.id, existingFamily.id)
          : await crearFamiliaEnLinea(linea.id, payload)
        : await crearLinea(payload);
      const created = isFamily ? response?.familia || existingFamily : response;

      if (!created?.id) throw new Error('La API no devolvió el clasificador creado.');
      await onCreated?.(created);
      onClose?.();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error
        || requestError.message
        || `No se pudo crear la ${isFamily ? 'Familia' : 'Línea'}.`
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Nueva {isFamily ? 'Familia' : 'Línea'}</DialogTitle>
      <DialogContent dividers>
        <Stack
          component="form"
          id="quick-create-classification-form"
          spacing={2}
          onSubmit={handleSubmit}
        >
          {isFamily && (
            <Typography variant="body2" color="text.secondary">
              Se asociará inmediatamente a la Línea <strong>{linea?.nombre || 'no seleccionada'}</strong>.
            </Typography>
          )}
          {error && <Alert severity="error">{error}</Alert>}
          {isFamily && existingFamily && (
            <Alert severity="info">
              La Familia <strong>{existingFamily.nombre}</strong> ya existe globalmente.
              {existingFamilyInactive
                ? ' Se reactivará y vinculará a esta Línea sin crear un duplicado.'
                : ' Se vinculará a esta Línea sin crear un duplicado.'}
            </Alert>
          )}
          <TextField
            label="Código automático"
            value={`${isFamily ? 'FAM' : 'LIN'}-######`}
            disabled
            helperText={existingFamily ? 'Se conservará el código existente' : 'Se asignará al guardar'}
          />
          <TextField
            label="Nombre"
            value={form.nombre}
            onChange={(event) => setForm((current) => ({
              ...current,
              nombre: event.target.value.toUpperCase(),
            }))}
            inputProps={{ maxLength: 100 }}
            required
            autoFocus
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>Cancelar</Button>
        <Button
          type="submit"
          form="quick-create-classification-form"
          variant="contained"
          disabled={saving || checkingFamilies || (isFamily && !linea?.id)}
        >
          {saving || checkingFamilies
            ? <CircularProgress size={20} />
            : existingFamilyInactive
              ? 'Reactivar y vincular'
              : existingFamily ? 'Vincular y seleccionar' : 'Crear y seleccionar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ClassificationQuickCreateDialog;
