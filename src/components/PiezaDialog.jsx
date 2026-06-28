import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Stack, Box, FormControl, InputLabel, Select, MenuItem, Autocomplete, Typography
} from '@mui/material';
import { 
  crearPieza, 
  actualizarPieza,
  obtenerLineas,
  obtenerFamilias,
  obtenerColores,
  obtenerFormas
} from '../services/api';

function PiezaDialog({ open, onClose, pieza }) {
  const [formData, setFormData] = useState({
    sku: '',
    nombre: '',
    tipo: 'SIMPLE',
    peso: '',
    cavidad: '',
    linea_id: '',
    familia_id: '',
    color_id: '',
    pieza_id: '', // Forma original del molde
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
    formas: []
  });

  useEffect(() => {
    const loadMaestros = async () => {
      try {
        const [resLineas, resFamilias, resColores, resFormas] = await Promise.all([
          obtenerLineas(),
          obtenerFamilias(),
          obtenerColores(),
          obtenerFormas()
        ]);
        setMaestros({
          lineas: resLineas,
          familias: resFamilias,
          colores: resColores,
          formas: resFormas
        });
      } catch (err) {
        console.error('Error cargando maestros piezas', err);
      }
    };
    loadMaestros();
  }, []);

  useEffect(() => {
    if (pieza) {
      setFormData({
        sku: pieza.sku,
        nombre: pieza.piezas || pieza.nombre || '',
        tipo: pieza.tipo || 'SIMPLE',
        peso: pieza.peso || '',
        cavidad: pieza.cavidad || '',
        linea_id: pieza.linea_id || '',
        familia_id: pieza.familia_id || '',
        color_id: pieza.color_id || '',
        pieza_id: pieza.pieza_id || '',
        cod_pieza: pieza.cod_pieza || '',
        cod_extru: pieza.cod_extru || '',
        tipo_extruccion: pieza.tipo_extruccion || '',
        cod_mp: pieza.cod_mp || '',
        mp: pieza.mp || ''
      });
    } else {
      setFormData({
        sku: '', nombre: '', tipo: 'SIMPLE', peso: '', cavidad: '', 
        linea_id: '', familia_id: '', color_id: '', pieza_id: '',
        cod_pieza: '', cod_extru: '', tipo_extruccion: '', cod_mp: '', mp: ''
      });
    }
  }, [pieza, open]);

  const handleSubmit = async () => {
    try {
      const data = {
        ...formData,
        peso: formData.peso ? parseFloat(formData.peso) : null,
        cavidad: formData.cavidad ? parseInt(formData.cavidad) : null
      };
      
      if (pieza) {
        await actualizarPieza(formData.sku, data);
      } else {
        await crearPieza(data);
      }
      onClose();
    } catch (err) {
      alert('Error guardando pieza');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{pieza ? 'Editar Pieza' : 'Nueva Pieza'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Stack direction="row" spacing={2}>
            <TextField
              label="SKU (Auto generado si vacío)"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              disabled={!!pieza}
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

          <Stack direction="row" spacing={2}>
            <Autocomplete
              options={maestros.lineas}
              getOptionLabel={(option) => option.nombre}
              value={maestros.lineas.find(l => l.id === formData.linea_id) || null}
              onChange={(_, v) => setFormData({ ...formData, linea_id: v ? v.id : '' })}
              renderInput={(params) => <TextField {...params} label="Línea" />}
              fullWidth
            />
            <Autocomplete
              options={maestros.familias}
              getOptionLabel={(option) => option.nombre}
              value={maestros.familias.find(f => f.id === formData.familia_id) || null}
              onChange={(_, v) => setFormData({ ...formData, familia_id: v ? v.id : '' })}
              renderInput={(params) => <TextField {...params} label="Familia" />}
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
            <Autocomplete
              options={maestros.colores}
              getOptionLabel={(option) => option.nombre}
              value={maestros.colores.find(c => c.id === formData.color_id) || null}
              onChange={(_, v) => setFormData({ ...formData, color_id: v ? v.id : '' })}
              renderInput={(params) => <TextField {...params} label="Color Producto" />}
              fullWidth
            />
          </Stack>
          
          <Box sx={{ p: 2, bgcolor: '#f8fbff', borderRadius: 1, border: '1px solid #e0e0e0' }}>
            <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>Relación con Producción (Molde)</Typography>
            <Autocomplete
              options={maestros.formas}
              getOptionLabel={(option) => `${option.molde_codigo} - ${option.nombre} (Cav: ${option.cavidades})`}
              value={maestros.formas.find(f => f.id === formData.pieza_id) || null}
              onChange={(_, v) => {
                setFormData({ 
                  ...formData, 
                  pieza_id: v ? v.id : '',
                  // Auto-fill peso y cavidad si viene de la forma
                  peso: v && v.peso_unitario_gr ? v.peso_unitario_gr : formData.peso,
                  cavidad: v && v.cavidades ? v.cavidades : formData.cavidad
                });
              }}
              renderInput={(params) => <TextField {...params} label="Buscar Forma Original del Molde..." />}
              fullWidth
            />
          </Box>
          
          <Stack direction="row" spacing={2}>
            <TextField
              label="Peso (g)"
              type="number"
              value={formData.peso}
              onChange={(e) => setFormData({ ...formData, peso: e.target.value })}
              fullWidth
            />
            <TextField
              label="Cavidad"
              type="number"
              value={formData.cavidad}
              onChange={(e) => setFormData({ ...formData, cavidad: e.target.value })}
              fullWidth
            />
          </Stack>
          
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
  );
}

export default PiezaDialog;
