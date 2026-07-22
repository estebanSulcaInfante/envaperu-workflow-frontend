import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Stack, Box, Typography, Autocomplete, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CreateOptionAutocomplete from './ui/CreateOptionAutocomplete';
import ClassificationQuickCreateDialog from './ui/ClassificationQuickCreateDialog';
import { 
  crearProducto, 
  actualizarProducto, 
  buscarPiezasColor,
  obtenerLineas,
  obtenerFamilias
} from '../services/api';

function ProductoDialog({ open, onClose, onSaved, producto }) {
  const [formData, setFormData] = useState({
    cod_sku_pt: '',
    producto: '',
    cod_producto: '',
    familia_id: '',
    linea_id: '',
    peso_g: '',
    precio_estimado: '',
    precio_sin_igv: '',
    doc_x_paq: '',
    doc_x_bulto: '',
    codigo_barra: '',
    marca: '',
    um: 'Docena',
    status: 'Activo',
    piezas: []
  });

  const [maestros, setMaestros] = useState({
    lineas: [],
    familias: []
  });
  const [classificationDialog, setClassificationDialog] = useState({
    open: false,
    entity: 'linea',
    initialName: '',
  });

  useEffect(() => {
    // Cargar listas maestras
    const loadMaestros = async () => {
      try {
        const resLineas = await obtenerLineas();
        setMaestros((current) => ({ ...current, lineas: resLineas }));
      } catch (err) {
        console.error('Error cargando maestros', err);
      }
    };
    loadMaestros();
  }, []);

  const [piezasOptions, setPiezasOptions] = useState([]);
  const [piezasLoading, setPiezasLoading] = useState(false);
  const [piezaInput, setPiezaInput] = useState('');

  useEffect(() => {
    if (producto) {
      setFormData({
        cod_sku_pt: producto.cod_sku_pt || producto.sku || '',
        producto: producto.producto || producto.nombre || '',
        cod_producto: producto.cod_producto || '',
        familia_id: producto.familia_id || '',
        linea_id: producto.linea_id || '',
        peso_g: producto.peso_g || '',
        precio_estimado: producto.precio_estimado || '',
        precio_sin_igv: producto.precio_sin_igv || '',
        doc_x_paq: producto.doc_x_paq || '',
        doc_x_bulto: producto.doc_x_bulto || '',
        codigo_barra: producto.codigo_barra || '',
        marca: producto.marca || '',
        um: producto.um || 'Docena',
        status: producto.status || 'Activo',
        piezas: Array.isArray(producto.piezas) ? producto.piezas.map(p => ({ 
          pieza_sku: p.sku || p.pieza_sku, 
          nombre: p.nombre || p.piezas, 
          cantidad: p.cantidad || 1
        })) : []
      });
    } else {
      setFormData({
        cod_sku_pt: '', producto: '', cod_producto: '', familia_id: '', linea_id: '',
        peso_g: '', precio_estimado: '', precio_sin_igv: '', doc_x_paq: '', doc_x_bulto: '',
        codigo_barra: '', marca: '', um: 'Docena', status: 'Activo', piezas: []
      });
    }
  }, [producto, open]);

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
          current.familia_id && !familias.some((familia) => familia.id === current.familia_id)
            ? { ...current, familia_id: '' }
            : current
        ));
      })
      .catch(() => {
        if (active) setMaestros((current) => ({ ...current, familias: [] }));
      });

    return () => { active = false; };
  }, [open, formData.linea_id]);

  useEffect(() => {
    if (piezaInput.length < 2) {
      setPiezasOptions([]);
      return;
    }
    const timeoutId = setTimeout(async () => {
      setPiezasLoading(true);
      try {
        const piezas = await buscarPiezasColor(piezaInput);
        setPiezasOptions(piezas);
      } catch {
        setPiezasOptions([]);
      } finally {
        setPiezasLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [piezaInput]);

  const handleAddPieza = (pieza) => {
    if (!pieza) return;
    const exists = formData.piezas.find(p => p.pieza_sku === (pieza.sku || pieza.pieza_sku));
    if (exists) return;
    
    setFormData(prev => ({
      ...prev,
      piezas: [...prev.piezas, { pieza_sku: pieza.sku, nombre: pieza.piezas, color: pieza.color, cantidad: 1 }]
    }));
    setPiezaInput('');
  };

  const handleRemovePieza = (sku) => {
    setFormData(prev => ({
      ...prev,
      piezas: prev.piezas.filter(p => p.pieza_sku !== sku)
    }));
  };

  const handleQuantityChange = (sku, qty) => {
    setFormData(prev => ({
      ...prev,
      piezas: prev.piezas.map(p => p.pieza_sku === sku ? { ...p, cantidad: parseInt(qty) || 1 } : p)
    }));
  };

  const abrirAltaClasificacion = (entity, initialName = '') => {
    if (entity === 'familia' && !formData.linea_id) return;
    setClassificationDialog({ open: true, entity, initialName });
  };

  const registrarClasificacionCreada = (created) => {
    if (classificationDialog.entity === 'linea') {
      setMaestros((current) => ({
        ...current,
        lineas: current.lineas.some((item) => item.id === created.id)
          ? current.lineas
          : [...current.lineas, created],
        familias: [],
      }));
      setFormData((current) => ({ ...current, linea_id: created.id, familia_id: '' }));
      return;
    }

    setMaestros((current) => ({
      ...current,
      familias: current.familias.some((item) => item.id === created.id)
        ? current.familias
        : [...current.familias, created],
    }));
    setFormData((current) => ({ ...current, familia_id: created.id }));
  };

  const handleSubmit = async () => {
    try {
      const { cod_sku_pt, ...editableData } = formData;
      const data = {
        ...editableData,
        peso_g: formData.peso_g ? parseFloat(formData.peso_g) : null,
        precio_estimado: formData.precio_estimado ? parseFloat(formData.precio_estimado) : null
      };
      
      const saved = producto
        ? await actualizarProducto(cod_sku_pt, data)
        : await crearProducto(data);
      await onSaved?.(saved);
      onClose();
    } catch {
      alert('Error guardando producto');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{producto ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Stack direction="row" spacing={2}>
            <TextField
              label="SKU"
              value={producto ? formData.cod_sku_pt : 'Se asignará automáticamente al guardar'}
              helperText={producto ? 'Identificador inmutable.' : 'El backend asignará el siguiente correlativo disponible.'}
              slotProps={{ input: { readOnly: true } }}
              fullWidth
            />
            <TextField
              label="Nombre Producto"
              value={formData.producto}
              onChange={(e) => setFormData({ ...formData, producto: e.target.value })}
              fullWidth
            />
            <TextField
              label="Cod Producto (Núm)"
              type="number"
              value={formData.cod_producto}
              onChange={(e) => setFormData({ ...formData, cod_producto: e.target.value })}
              fullWidth
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <CreateOptionAutocomplete
              options={maestros.lineas}
              getOptionLabel={(option) => option.nombre}
              value={maestros.lineas.find(l => l.id === formData.linea_id) || null}
              onChange={(selected) => {
                setMaestros((current) => ({ ...current, familias: [] }));
                setFormData((current) => ({
                  ...current,
                  linea_id: selected?.id || '',
                  familia_id: '',
                }));
              }}
              onCreateOption={(initialName) => abrirAltaClasificacion('linea', initialName)}
              createLabel={(inputValue) => (
                inputValue ? `Crear Línea “${inputValue}”…` : 'Crear nueva Línea…'
              )}
              label="Línea"
              required
            />
            <CreateOptionAutocomplete
              options={maestros.familias}
              getOptionLabel={(option) => option.nombre}
              value={maestros.familias.find(f => f.id === formData.familia_id) || null}
              onChange={(selected) => setFormData((current) => ({
                ...current,
                familia_id: selected?.id || '',
              }))}
              onCreateOption={(initialName) => abrirAltaClasificacion('familia', initialName)}
              createLabel={(inputValue) => (
                inputValue ? `Crear Familia “${inputValue}”…` : 'Crear nueva Familia en esta Línea…'
              )}
              label="Familia"
              disabled={!formData.linea_id}
              required
              helperText={formData.linea_id
                ? 'Solo Familias asociadas a la Línea.'
                : 'Selecciona una Línea antes de crear una Familia.'}
            />
          </Stack>
          
          <Typography variant="subtitle2" color="primary">Logística y Precios</Typography>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Peso (g)"
              type="number"
              value={formData.peso_g}
              onChange={(e) => setFormData({ ...formData, peso_g: e.target.value })}
              fullWidth
            />
            <TextField
              label="Doc x Paq"
              type="number"
              value={formData.doc_x_paq}
              onChange={(e) => setFormData({ ...formData, doc_x_paq: e.target.value })}
              fullWidth
            />
            <TextField
              label="Doc x Bulto"
              type="number"
              value={formData.doc_x_bulto}
              onChange={(e) => setFormData({ ...formData, doc_x_bulto: e.target.value })}
              fullWidth
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Precio Estimado"
              type="number"
              value={formData.precio_estimado}
              onChange={(e) => setFormData({ ...formData, precio_estimado: e.target.value })}
              fullWidth
            />
            <TextField
              label="Precio s/IGV"
              type="number"
              value={formData.precio_sin_igv}
              onChange={(e) => setFormData({ ...formData, precio_sin_igv: e.target.value })}
              fullWidth
            />
            <TextField
              label="Unidad (UM)"
              value={formData.um}
              onChange={(e) => setFormData({ ...formData, um: e.target.value })}
              fullWidth
            />
          </Stack>
          
          <Stack direction="row" spacing={2}>
            <TextField
              label="Marca"
              value={formData.marca}
              onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
              fullWidth
            />
            <TextField
              label="Código de Barras"
              value={formData.codigo_barra}
              onChange={(e) => setFormData({ ...formData, codigo_barra: e.target.value })}
              fullWidth
            />
          </Stack>
          
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Piezas (BOM)</Typography>
            <Autocomplete
              options={piezasOptions}
              getOptionLabel={(option) => option.piezas || ''}
              loading={piezasLoading}
              inputValue={piezaInput}
              onInputChange={(_, v) => setPiezaInput(v)}
              onChange={(_, v) => handleAddPieza(v)}
              renderInput={(params) => (
                <TextField {...params} size="small" placeholder="Buscar pieza para agregar..." />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option.sku}>
                  <Box>
                    <Typography variant="body2">{option.piezas}</Typography>
                    <Typography variant="caption" color="text.secondary">{option.sku}</Typography>
                  </Box>
                </li>
              )}
            />
            <Box sx={{ mt: 2 }}>
              {formData.piezas.length > 0 && (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                      <TableRow>
                        <TableCell>SKU</TableCell>
                        <TableCell>Nombre</TableCell>
                        <TableCell width="120px" align="center">Cantidad</TableCell>
                        <TableCell width="50px"></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {formData.piezas.map((p) => (
                        <TableRow key={p.pieza_sku}>
                          <TableCell>{p.pieza_sku}</TableCell>
                          <TableCell>{p.nombre}</TableCell>
                          <TableCell align="center">
                            <TextField
                              type="number"
                              size="small"
                              inputProps={{ min: 1 }}
                              value={p.cantidad}
                              onChange={(e) => handleQuantityChange(p.pieza_sku, e.target.value)}
                              sx={{ width: '80px' }}
                            />
                          </TableCell>
                          <TableCell>
                            <IconButton size="small" color="error" onClick={() => handleRemovePieza(p.pieza_sku)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSubmit} sx={{ bgcolor: '#1E3A5F' }}>
          {producto ? 'Guardar' : 'Crear'}
        </Button>
      </DialogActions>
      <ClassificationQuickCreateDialog
        open={classificationDialog.open}
        entity={classificationDialog.entity}
        linea={maestros.lineas.find((linea) => linea.id === formData.linea_id) || null}
        initialName={classificationDialog.initialName}
        onClose={() => setClassificationDialog((current) => ({ ...current, open: false }))}
        onCreated={registrarClasificacionCreada}
      />
    </Dialog>
  );
}

export default ProductoDialog;
