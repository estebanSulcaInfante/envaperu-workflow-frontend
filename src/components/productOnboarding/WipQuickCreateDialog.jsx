import { useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
} from '@mui/material';

const emptyDraft = {
  nombre: '',
  descripcion: '',
  requiere_calidad: false,
};

export default function WipQuickCreateDialog({ open, onClose, onCreate, existingNames = [] }) {
  const [draft, setDraft] = useState(emptyDraft);
  const normalizedName = draft.nombre.trim().toLocaleUpperCase('es-PE');
  const duplicate = existingNames.some(
    (name) => String(name).trim().toLocaleUpperCase('es-PE') === normalizedName,
  );

  const close = () => {
    setDraft(emptyDraft);
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>Crear WIP dentro de esta alta</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">
            Se creará junto con la BOM al aplicar la fase. Hasta entonces sólo existe en
            este borrador y puede editarse sin dejar registros huérfanos.
          </Alert>
          <TextField
            autoFocus
            required
            label="Nombre del WIP"
            value={draft.nombre}
            error={duplicate}
            helperText={duplicate ? 'Ya existe un WIP con este nombre en la sesión.' : 'Ejemplo: CUERPO PREARMADO COLADOR #3'}
            onChange={(event) => setDraft((current) => ({
              ...current,
              nombre: event.target.value,
            }))}
          />
          <TextField
            multiline
            minRows={2}
            label="Descripción"
            value={draft.descripcion}
            onChange={(event) => setDraft((current) => ({
              ...current,
              descripcion: event.target.value,
            }))}
          />
          <FormControlLabel
            control={(
              <Checkbox
                checked={draft.requiere_calidad}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  requiere_calidad: event.target.checked,
                }))}
              />
            )}
            label="Requiere liberación de Calidad antes de consumirlo"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={!normalizedName || duplicate}
          onClick={() => {
            onCreate({
              nombre: draft.nombre.trim(),
              ...(draft.descripcion.trim() ? { descripcion: draft.descripcion.trim() } : {}),
              requiere_calidad: draft.requiere_calidad,
            });
            setDraft(emptyDraft);
          }}
        >
          Añadir y seleccionar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
