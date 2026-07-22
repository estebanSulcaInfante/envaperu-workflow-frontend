import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Stack, Box, FormControl, InputLabel, Select, MenuItem, Autocomplete, Typography, Alert
} from '@mui/material';
import { 
  crearPiezaColor,
  actualizarPiezaColor,
  obtenerLineas,
  obtenerFamilias,
  obtenerColores,
  buscarPiezasGlobales,
} from '../services/api';
import CreateOptionAutocomplete from './ui/CreateOptionAutocomplete';
import ColorQuickCreateDialog from './ui/ColorQuickCreateDialog';

function PiezaDialog({ open, onClose, pieza }) {
  const [formData, setFormData] = useState({
    sku: '',
    nombre: '',
    tipo: 'SIMPLE',
    peso: '',
    linea_id: '',
    familia_id: '',
    color_produccion_id: '',
    pieza_id: '',
    cod_pieza: '',
    cod_extru: '',
    tipo_extruccion: '',
    cod_mp: '',
    mp: ''
  });

  const [maestros, setMaestros] = useState({
    lineas: [],
    familias: [],
    colores: [],
    piezasGlobales: []
  });
  const [quickColorDialog, setQuickColorDialog] = useState({ open: false, initialName: '' });

  useEffect(() => {
    const loadMaestros = async () => {
      try {
        const [resLineas, resColores, resPiezas] = await Promise.all([
          obtenerLineas(),
          obtenerColores(),
          buscarPiezasGlobales('', 200),
        ]);
        setMaestros((current) => ({
          ...current,
          lineas: resLineas,
          colores: resColores,
          piezasGlobales: resPiezas,
        }));
      } catch (err) {
        console.error('Error cargando maestros piezas', err);
      }
    };
    loadMaestros();
  }, []);

  useEffect(() => {
    if (pieza) {
      // El formulario local debe reiniciarse cada vez que cambia la entidad del diálogo.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        sku: pieza.sku,
        nombre: pieza.piezas || pieza.nombre || '',
        tipo: pieza.tipo || 'SIMPLE',
        peso: pieza.peso || '',
        linea_id: pieza.linea_id || '',
        familia_id: pieza.familia_id || '',
        color_produccion_id: pieza.color_produccion_id || pieza.color_id || '',
        pieza_id: pieza.pieza_id || '',
        cod_pieza: pieza.cod_pieza || '',
        cod_extru: pieza.cod_extru || '',
        tipo_extruccion: pieza.tipo_extruccion || '',
        cod_mp: pieza.cod_mp || '',
        mp: pieza.mp || ''
      });
    } else {
      setFormData({
        sku: '', nombre: '', tipo: 'SIMPLE', peso: '',
        linea_id: '', familia_id: '', color_produccion_id: '', pieza_id: '',
        cod_pieza: '', cod_extru: '', tipo_extruccion: '', cod_mp: '', mp: ''
      });
    }
  }, [pieza, open]);

  useEffect(() => {
    if (!open || !formData.pieza_id) return;
    const linkedPiece = maestros.piezasGlobales.find(
      (item) => String(item.id) === String(formData.pieza_id)
    );
    if (!linkedPiece) return;

    // La clasificación de una variante vinculada pertenece a su Pieza maestra.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormData((current) => (
      String(current.linea_id) === String(linkedPiece.linea_id ?? '')
      && String(current.familia_id) === String(linkedPiece.familia_id ?? '')
        ? current
        : {
            ...current,
            linea_id: linkedPiece.linea_id ?? '',
            familia_id: linkedPiece.familia_id ?? '',
          }
    ));
  }, [formData.pieza_id, maestros.piezasGlobales, open]);

  useEffect(() => {
    let active = true;
    if (!open || !formData.linea_id) {
      return () => { active = false; };
    }

    obtenerFamilias({ linea_id: formData.linea_id })
      .then((familias) => {
        if (!active) return;
        setMaestros((current) => ({ ...current, familias }));
        setFormData((current) => (
          current.familia_id && !familias.some(
            (familia) => String(familia.id) === String(current.familia_id)
          )
            ? { ...current, familia_id: '' }
            : current
        ));
      })
      .catch(() => {
        if (active) setMaestros((current) => ({ ...current, familias: [] }));
      });

    return () => { active = false; };
  }, [open, formData.linea_id]);

  const handleColorCreated = async (createdColor) => {
    let refreshedColors;
    try {
      refreshedColors = await obtenerColores();
    } catch (error) {
      console.error('El color se creó, pero no se pudo refrescar el catálogo:', error);
      refreshedColors = [...maestros.colores, createdColor];
    }

    const uniqueColors = Array.from(
      new Map([createdColor, ...refreshedColors].map((color) => [String(color.id), color])).values()
    ).sort((a, b) => a.nombre.localeCompare(b.nombre));
    setMaestros((current) => ({ ...current, colores: uniqueColors }));
    setFormData((current) => ({ ...current, color_produccion_id: createdColor.id }));
  };

  const handleSubmit = async () => {
    if (formData.pieza_id && (!formData.linea_id || !formData.familia_id)) {
      alert('La pieza global seleccionada no tiene una clasificación Línea/Familia válida.');
      return;
    }

    try {
      const { sku, ...editableData } = formData;
      const data = {
        ...editableData,
        peso: formData.peso ? parseFloat(formData.peso) : null
      };
      
      if (pieza) {
        await actualizarPiezaColor(sku, data);
      } else {
        await crearPiezaColor(data);
      }
      onClose();
    } catch {
      alert('Error guardando pieza');
    }
  };

  return (
    <>
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{pieza ? 'Editar Pieza' : 'Nueva Pieza'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Stack direction="row" spacing={2}>
            <TextField
              label="SKU"
              value={pieza ? formData.sku : 'Se asignará automáticamente al guardar'}
              helperText={pieza ? 'Identificador inmutable.' : 'El backend asignará el siguiente correlativo disponible.'}
              slotProps={{ input: { readOnly: true } }}
              fullWidth
            />
            <TextField
              label="Nombre Pieza"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              fullWidth
            />
            <TextField
              label="Cod Pieza (Núm)"
              type="number"
              value={formData.cod_pieza}
              onChange={(e) => setFormData({ ...formData, cod_pieza: e.target.value })}
              fullWidth
            />
          </Stack>

          {formData.pieza_id && (
            <Alert severity="info">
              Línea y Familia se heredan de la pieza global seleccionada.
            </Alert>
          )}

          <Stack direction="row" spacing={2}>
            <Autocomplete
              options={maestros.lineas}
              getOptionLabel={(option) => option.nombre}
              value={maestros.lineas.find(l => String(l.id) === String(formData.linea_id)) || null}
              onChange={(_, v) => {
                setMaestros((current) => ({ ...current, familias: [] }));
                setFormData({
                  ...formData,
                  linea_id: v ? v.id : '',
                  familia_id: '',
                });
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Línea"
                  helperText={formData.pieza_id ? 'Derivada de la pieza global.' : 'Editable solo para variantes legacy.'}
                />
              )}
              disabled={Boolean(formData.pieza_id)}
              fullWidth
            />
            <Autocomplete
              options={maestros.familias}
              getOptionLabel={(option) => option.nombre}
              value={maestros.familias.find(f => String(f.id) === String(formData.familia_id)) || null}
              onChange={(_, v) => setFormData({ ...formData, familia_id: v ? v.id : '' })}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Familia"
                  helperText={formData.pieza_id ? 'Derivada de la pieza global.' : 'Editable solo para variantes legacy.'}
                />
              )}
              disabled={Boolean(formData.pieza_id) || !formData.linea_id}
              fullWidth
            />
          </Stack>
          
          <Stack direction="row" spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Tipo</InputLabel>
              <Select
                value={formData.tipo}
                label="Tipo"
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
              >
                <MenuItem value="SIMPLE">Simple</MenuItem>
                <MenuItem value="KIT">Kit</MenuItem>
              </Select>
            </FormControl>
            <CreateOptionAutocomplete
              options={maestros.colores}
              getOptionLabel={(option) => option.nombre}
              value={maestros.colores.find(
                (color) => String(color.id) === String(formData.color_produccion_id)
              ) || null}
              onChange={(color) => setFormData({
                ...formData,
                color_produccion_id: color ? color.id : '',
              })}
              onCreateOption={(initialName) => setQuickColorDialog({ open: true, initialName })}
              createLabel={(inputValue) => (
                inputValue ? `Crear "${inputValue.toUpperCase()}"…` : 'Crear nuevo color…'
              )}
              label="Color de producción"
              placeholder="Buscar color…"
            />
          </Stack>
          
          <Box sx={{ p: 2, bgcolor: '#f8fbff', borderRadius: 1, border: '1px solid #e0e0e0' }}>
            <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>Maestro global de pieza</Typography>
            <Autocomplete
              options={maestros.piezasGlobales}
              getOptionLabel={(option) => `${option.codigo} - ${option.nombre}`}
              value={maestros.piezasGlobales.find(
                (item) => String(item.id) === String(formData.pieza_id)
              ) || null}
              onChange={(_, v) => {
                setFormData({ 
                  ...formData, 
                  pieza_id: v ? v.id : '',
                  peso: v?.peso_nominal_gr ?? formData.peso,
                  linea_id: v ? (v.linea_id ?? '') : formData.linea_id,
                  familia_id: v ? (v.familia_id ?? '') : formData.familia_id,
                });
              }}
              renderInput={(params) => <TextField {...params} label="Buscar pieza global..." />}
              fullWidth
            />
          </Box>
          
          <TextField
            label="Peso (g)"
            type="number"
            value={formData.peso}
            onChange={(e) => setFormData({ ...formData, peso: e.target.value })}
            helperText="Las cavidades se administran en la composición de cada molde."
            fullWidth
          />
          
          <Typography variant="subtitle2" color="primary">Datos de Material / Extrusión</Typography>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Cod Extrusión"
              value={formData.cod_extru}
              onChange={(e) => setFormData({ ...formData, cod_extru: e.target.value })}
              fullWidth
            />
            <TextField
              label="Tipo Extrusión"
              value={formData.tipo_extruccion}
              onChange={(e) => setFormData({ ...formData, tipo_extruccion: e.target.value })}
              fullWidth
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Cod Materia Prima"
              value={formData.cod_mp}
              onChange={(e) => setFormData({ ...formData, cod_mp: e.target.value })}
              fullWidth
            />
            <TextField
              label="Materia Prima"
              value={formData.mp}
              onChange={(e) => setFormData({ ...formData, mp: e.target.value })}
              fullWidth
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSubmit} sx={{ bgcolor: '#1E3A5F' }}>
          {pieza ? 'Guardar' : 'Crear'}
        </Button>
      </DialogActions>
    </Dialog>
    <ColorQuickCreateDialog
      open={quickColorDialog.open}
      initialName={quickColorDialog.initialName}
      onClose={() => setQuickColorDialog({ open: false, initialName: '' })}
      onCreated={handleColorCreated}
    />
    </>
  );
}

export default PiezaDialog;
