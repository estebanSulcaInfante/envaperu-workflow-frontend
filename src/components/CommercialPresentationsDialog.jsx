import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import RestoreIcon from '@mui/icons-material/Restore';
import StarIcon from '@mui/icons-material/Star';
import {
  actualizarPresentacionComercialScm,
  crearPresentacionComercialScm,
  listarPresentacionesComercialesScm,
} from '../services/scmCatalogApi';

const emptyForm = {
  id: null,
  nombre: '',
  unidades_base: '',
  codigo_barra: '',
  predeterminada: false,
  version: null,
};

const errorMessage = (error, fallback) => (
  error?.response?.data?.error?.message
  || error?.response?.data?.error
  || error?.message
  || fallback
);

export default function CommercialPresentationsDialog({ open, product, onClose }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!open || !product?.cod_sku_pt) return;
    setBusy(true);
    setError('');
    try {
      setItems(await listarPresentacionesComercialesScm({
        productoId: product.cod_sku_pt,
      }));
    } catch (requestError) {
      setError(errorMessage(requestError, 'No se cargaron las presentaciones.'));
    } finally {
      setBusy(false);
    }
  }, [open, product?.cod_sku_pt]);

  useEffect(() => {
    if (open) {
      setForm(emptyForm);
      setNotice('');
      load();
    }
  }, [load, open]);

  const edit = (item) => setForm({
    id: item.id,
    nombre: item.nombre,
    unidades_base: String(item.unidades_base),
    codigo_barra: item.codigo_barra || '',
    predeterminada: item.predeterminada,
    version: item.version,
  });

  const save = async () => {
    if (!form.nombre.trim() || !Number.isInteger(Number(form.unidades_base))
      || Number(form.unidades_base) <= 0) {
      setError('Indica un nombre y una cantidad entera positiva de unidades.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = {
        nombre: form.nombre.trim(),
        unidades_base: Number(form.unidades_base),
        codigo_barra: form.codigo_barra.trim() || null,
        predeterminada: Boolean(form.predeterminada),
      };
      if (form.id) {
        await actualizarPresentacionComercialScm(form.id, {
          ...payload,
          version: form.version,
        });
      } else {
        await crearPresentacionComercialScm({
          ...payload,
          producto_terminado_id: product.cod_sku_pt,
        });
      }
      setNotice(`${form.nombre.trim()} guardada correctamente.`);
      setForm(emptyForm);
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError, 'No se guardó la presentación.'));
    } finally {
      setBusy(false);
    }
  };

  const updateState = async (item, changes) => {
    setBusy(true);
    setError('');
    try {
      await actualizarPresentacionComercialScm(item.id, {
        version: item.version,
        ...changes,
      });
      setNotice(`${item.nombre} actualizada.`);
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError, 'No se actualizó la presentación.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        Presentaciones comerciales · {product?.cod_sku_pt}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">
            Cada presentación convierte demanda comercial a unidades del PT. No modifica
            la BOM ni la capacidad de una manga.
          </Alert>
          {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
          {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField
              label="Nombre de presentación"
              placeholder="Ej.: Pack x6"
              value={form.nombre}
              onChange={(event) => setForm({ ...form, nombre: event.target.value })}
              fullWidth
            />
            <TextField
              label="Unidades del PT"
              type="number"
              value={form.unidades_base}
              onChange={(event) => setForm({ ...form, unidades_base: event.target.value })}
              inputProps={{ min: 1, step: 1 }}
              helperText="1 pack equivale a esta cantidad de UN"
              fullWidth
            />
            <TextField
              label="Código de barras (opcional)"
              value={form.codigo_barra}
              onChange={(event) => setForm({ ...form, codigo_barra: event.target.value })}
              fullWidth
            />
          </Stack>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            {form.id && <Button onClick={() => setForm(emptyForm)}>Cancelar edición</Button>}
            <Button
              variant="contained"
              startIcon={form.id ? <EditIcon /> : <AddIcon />}
              onClick={save}
              disabled={busy}
            >
              {form.id ? 'Guardar presentación' : 'Agregar presentación'}
            </Button>
          </Stack>
          <Table size="small" aria-label="Presentaciones comerciales del producto">
            <TableHead><TableRow>
              <TableCell>Código</TableCell>
              <TableCell>Presentación</TableCell>
              <TableCell>Conversión</TableCell>
              <TableCell>Código de barras</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="center">Acciones</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.codigo}</TableCell>
                  <TableCell>
                    {item.nombre}{' '}
                    {item.predeterminada && <Chip size="small" color="primary" label="Predeterminada" />}
                  </TableCell>
                  <TableCell>1 {item.nombre} = {item.unidades_base} UN</TableCell>
                  <TableCell>{item.codigo_barra || '—'}</TableCell>
                  <TableCell>{item.activo ? 'Activa' : 'Inactiva'}</TableCell>
                  <TableCell align="center">
                    <Tooltip title="Editar">
                      <IconButton aria-label={`Editar ${item.nombre}`} onClick={() => edit(item)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {!item.predeterminada && item.activo && (
                      <Tooltip title="Usar por defecto">
                        <IconButton
                          aria-label={`Usar ${item.nombre} por defecto`}
                          onClick={() => updateState(item, { predeterminada: true })}
                        >
                          <StarIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title={item.activo ? 'Desactivar' : 'Reactivar'}>
                      <span>
                        <IconButton
                          aria-label={`${item.activo ? 'Desactivar' : 'Reactivar'} ${item.nombre}`}
                          color={item.activo ? 'warning' : 'success'}
                          disabled={item.predeterminada}
                          onClick={() => updateState(item, { activo: !item.activo })}
                        >
                          {item.activo ? <LinkOffIcon fontSize="small" /> : <RestoreIcon fontSize="small" />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {!busy && items.length === 0 && (
                <TableRow><TableCell colSpan={6} align="center">
                  <Typography color="text.secondary">No hay presentaciones registradas.</Typography>
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cerrar</Button></DialogActions>
    </Dialog>
  );
}
