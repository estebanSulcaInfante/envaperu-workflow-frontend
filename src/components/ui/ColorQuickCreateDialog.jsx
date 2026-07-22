import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { crearColor, obtenerFamiliasColor } from '../../services/api';

const emptyForm = { nombre: '', familia_color_id: '' };

/**
 * Alta rápida de ColorProduccion (ColorBase + FamiliaColor/acabado).
 * Puede reutilizarse desde cualquier selector que reciba un ColorProduccion.
 */
function ColorQuickCreateDialog({
  open,
  onClose,
  onCreated,
  initialName = '',
}) {
  const [form, setForm] = useState(emptyForm);
  const [familias, setFamilias] = useState([]);
  const [loadingFamilies, setLoadingFamilies] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;

    let active = true;
    setForm({ ...emptyForm, nombre: initialName.trim().toUpperCase() });
    setError('');
    setLoadingFamilies(true);

    obtenerFamiliasColor()
      .then((items) => {
        if (!active) return;
        const available = Array.isArray(items) ? items : [];
        setFamilias(available);
        const solid = available.find((item) => item.nombre?.trim().toUpperCase() === 'SOLIDO');
        setForm((current) => ({
          ...current,
          familia_color_id: solid?.id ?? (available.length === 1 ? available[0].id : ''),
        }));
      })
      .catch((requestError) => {
        if (!active) return;
        setFamilias([]);
        setError(requestError.response?.data?.error || 'No se pudieron cargar los acabados de color.');
      })
      .finally(() => {
        if (active) setLoadingFamilies(false);
      });

    return () => {
      active = false;
    };
  }, [initialName, open]);

  const handleClose = () => {
    if (!saving) onClose?.();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nombre = form.nombre.trim().toUpperCase();

    if (!nombre || !form.familia_color_id) {
      setError('Completa el nombre y el acabado del color.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const created = await crearColor({
        nombre,
        familia_color_id: Number(form.familia_color_id),
      });
      await onCreated?.(created);
      onClose?.();
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'No se pudo crear el color.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Nuevo color de producción</DialogTitle>
      <DialogContent dividers>
        <Stack component="form" id="quick-create-color-form" spacing={2} onSubmit={handleSubmit}>
          <Typography variant="body2" color="text.secondary">
            El color operativo combina un color base con su acabado.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            autoFocus
            label="Color base"
            value={form.nombre}
            onChange={(event) => setForm((current) => ({
              ...current,
              nombre: event.target.value.toUpperCase(),
            }))}
            required
            inputProps={{ maxLength: 50 }}
            placeholder="Ej. VERDE"
          />
          <FormControl required disabled={loadingFamilies || saving}>
            <InputLabel id="quick-color-family-label">Acabado</InputLabel>
            <Select
              labelId="quick-color-family-label"
              label="Acabado"
              value={form.familia_color_id}
              onChange={(event) => setForm((current) => ({
                ...current,
                familia_color_id: event.target.value,
              }))}
              endAdornment={loadingFamilies ? <CircularProgress size={18} sx={{ mr: 3 }} /> : null}
            >
              {familias.map((familia) => (
                <MenuItem key={familia.id} value={familia.id}>{familia.nombre}</MenuItem>
              ))}
            </Select>
            <FormHelperText>Ej. sólido, transparente o caramelo</FormHelperText>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>Cancelar</Button>
        <Button
          type="submit"
          form="quick-create-color-form"
          variant="contained"
          disabled={saving || loadingFamilies || familias.length === 0}
        >
          {saving ? 'Creando…' : 'Crear y seleccionar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ColorQuickCreateDialog;
