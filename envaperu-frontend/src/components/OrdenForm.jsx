import { useState } from 'react';
import {
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Divider,
  Alert,
  Snackbar,
  Chip,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Tooltip,
  InputAdornment
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PaletteIcon from '@mui/icons-material/Palette';
import LockIcon from '@mui/icons-material/Lock';
import { crearOrden } from '../services/api';

const initialOrden = {
  numero_op: '',
  maquina_id: '',
  tipo_maquina: '',
  producto: '',
  molde: '',
  tipo_estrategia: 'POR_PESO',
  meta_total_kg: '',
  meta_total_doc: '',
  peso_unitario_gr: '',
  peso_inc_colada: '',
  cavidades: '',
  tiempo_ciclo: '',
  horas_turno: '24',
  fecha_inicio: new Date().toISOString().slice(0, 16),
  lotes: []
};

const initialLote = {
  color_nombre: '',
  personas: 1,
  stock_kg_manual: '',
  materiales: [],
  pigmentos: []
};

function OrdenForm({ onOrdenCreada }) {
  const [orden, setOrden] = useState(initialOrden);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setOrden(prev => ({ ...prev, [name]: value }));
  };

  const handleAddLote = () => {
    setOrden(prev => ({
      ...prev,
      lotes: [...prev.lotes, { ...initialLote }]
    }));
  };

  const handleRemoveLote = (index) => {
    setOrden(prev => ({
      ...prev,
      lotes: prev.lotes.filter((_, i) => i !== index)
    }));
  };

  const handleLoteChange = (index, field, value) => {
    setOrden(prev => ({
      ...prev,
      lotes: prev.lotes.map((lote, i) => 
        i === index ? { ...lote, [field]: value } : lote
      )
    }));
  };

  const handleAddMaterial = (loteIndex) => {
    setOrden(prev => ({
      ...prev,
      lotes: prev.lotes.map((lote, i) => 
        i === loteIndex 
          ? { ...lote, materiales: [...lote.materiales, { nombre: '', tipo: 'VIRGEN', fraccion: '' }] }
          : lote
      )
    }));
  };

  const handleRemoveMaterial = (loteIndex, matIndex) => {
    setOrden(prev => ({
      ...prev,
      lotes: prev.lotes.map((lote, i) => 
        i === loteIndex 
          ? { ...lote, materiales: lote.materiales.filter((_, j) => j !== matIndex) }
          : lote
      )
    }));
  };

  const handleMaterialChange = (loteIndex, matIndex, field, value) => {
    setOrden(prev => ({
      ...prev,
      lotes: prev.lotes.map((lote, i) => 
        i === loteIndex 
          ? { 
              ...lote, 
              materiales: lote.materiales.map((mat, j) => 
                j === matIndex ? { ...mat, [field]: value } : mat
              ) 
            }
          : lote
      )
    }));
  };

  const handleAddPigmento = (loteIndex) => {
    setOrden(prev => ({
      ...prev,
      lotes: prev.lotes.map((lote, i) => 
        i === loteIndex 
          ? { ...lote, pigmentos: [...lote.pigmentos, { nombre: '', gramos: '' }] }
          : lote
      )
    }));
  };

  const handleRemovePigmento = (loteIndex, pigIndex) => {
    setOrden(prev => ({
      ...prev,
      lotes: prev.lotes.map((lote, i) => 
        i === loteIndex 
          ? { ...lote, pigmentos: lote.pigmentos.filter((_, j) => j !== pigIndex) }
          : lote
      )
    }));
  };

  const handlePigmentoChange = (loteIndex, pigIndex, field, value) => {
    setOrden(prev => ({
      ...prev,
      lotes: prev.lotes.map((lote, i) => 
        i === loteIndex 
          ? { 
              ...lote, 
              pigmentos: lote.pigmentos.map((pig, j) => 
                j === pigIndex ? { ...pig, [field]: value } : pig
              ) 
            }
          : lote
      )
    }));
  };

  const preparePayload = () => {
    return {
      ...orden,
      meta_total_kg: orden.meta_total_kg ? parseFloat(orden.meta_total_kg) : null,
      meta_total_doc: orden.meta_total_doc ? parseFloat(orden.meta_total_doc) : null,
      peso_unitario_gr: orden.peso_unitario_gr ? parseFloat(orden.peso_unitario_gr) : null,
      peso_inc_colada: orden.peso_inc_colada ? parseFloat(orden.peso_inc_colada) : null,
      cavidades: orden.cavidades ? parseInt(orden.cavidades) : null,
      tiempo_ciclo: orden.tiempo_ciclo ? parseFloat(orden.tiempo_ciclo) : null,
      horas_turno: orden.horas_turno ? parseFloat(orden.horas_turno) : 24,
      lotes: orden.lotes.map(lote => ({
        ...lote,
        personas: parseInt(lote.personas) || 1,
        stock_kg_manual: lote.stock_kg_manual ? parseFloat(lote.stock_kg_manual) : null,
        materiales: lote.materiales.map(mat => ({
          nombre: mat.nombre,
          tipo: mat.tipo || 'VIRGEN',
          fraccion: parseFloat(mat.fraccion)
        })),
        pigmentos: lote.pigmentos.map(pig => ({
          nombre: pig.nombre,
          gramos: parseFloat(pig.gramos)
        }))
      }))
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const payload = preparePayload();
      await crearOrden(payload);
      setSnackbar({ open: true, message: '¡Orden creada exitosamente!', severity: 'success' });
      setOrden(initialOrden);
      if (onOrdenCreada) onOrdenCreada();
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Error al crear la orden';
      setSnackbar({ open: true, message: errorMsg, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper 
      component="form" 
      onSubmit={handleSubmit}
      sx={{ 
        p: 4, 
        background: 'rgba(26, 26, 46, 0.9)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}
    >
      <Typography variant="h5" gutterBottom sx={{ 
        fontWeight: 700,
        background: 'linear-gradient(135deg, #4facfe 0%, #764ba2 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent'
      }}>
        Nueva Orden de Producción
      </Typography>
      
      <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.1)' }} />

      {/* Sección: Cabecera */}
      <Typography variant="subtitle1" color="primary" gutterBottom sx={{ fontWeight: 600 }}>
        📋 Información General
      </Typography>
      
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            fullWidth
            label="Número OP"
            name="numero_op"
            value={orden.numero_op}
            onChange={handleChange}
            required
            size="small"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            fullWidth
            label="Máquina ID"
            name="maquina_id"
            value={orden.maquina_id}
            onChange={handleChange}
            size="small"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            fullWidth
            label="Tipo Máquina"
            name="tipo_maquina"
            value={orden.tipo_maquina}
            onChange={handleChange}
            size="small"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            fullWidth
            label="Producto"
            name="producto"
            value={orden.producto}
            onChange={handleChange}
            size="small"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            fullWidth
            label="Molde"
            name="molde"
            value={orden.molde}
            onChange={handleChange}
            size="small"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            fullWidth
            label="Fecha Inicio"
            name="fecha_inicio"
            type="datetime-local"
            value={orden.fecha_inicio}
            onChange={handleChange}
            size="small"
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
      </Grid>

      {/* Sección: Estrategia */}
      <Typography variant="subtitle1" color="primary" gutterBottom sx={{ fontWeight: 600 }}>
        🎯 Estrategia de Producción
      </Typography>
      
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4}>
          <FormControl fullWidth size="small">
            <InputLabel>Tipo Estrategia</InputLabel>
            <Select
              name="tipo_estrategia"
              value={orden.tipo_estrategia}
              onChange={handleChange}
              label="Tipo Estrategia"
            >
              <MenuItem value="POR_PESO">Por Peso (Kg)</MenuItem>
              <MenuItem value="POR_CANTIDAD">Por Cantidad (Doc)</MenuItem>
              <MenuItem value="STOCK">Stock Manual</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Tooltip 
            title={orden.tipo_estrategia !== 'POR_PESO' ? 'Solo disponible con estrategia "Por Peso"' : ''}
            placement="top"
            arrow
          >
            <TextField
              fullWidth
              label="Meta Total (Kg)"
              name="meta_total_kg"
              type="number"
              value={orden.meta_total_kg}
              onChange={handleChange}
              size="small"
              disabled={orden.tipo_estrategia !== 'POR_PESO'}
              InputProps={{
                endAdornment: orden.tipo_estrategia !== 'POR_PESO' ? (
                  <InputAdornment position="end">
                    <LockIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ) : null
              }}
            />
          </Tooltip>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Tooltip 
            title={orden.tipo_estrategia !== 'POR_CANTIDAD' ? 'Solo disponible con estrategia "Por Cantidad"' : ''}
            placement="top"
            arrow
          >
            <TextField
              fullWidth
              label="Meta Total (Docenas)"
              name="meta_total_doc"
              type="number"
              value={orden.meta_total_doc}
              onChange={handleChange}
              size="small"
              disabled={orden.tipo_estrategia !== 'POR_CANTIDAD'}
              InputProps={{
                endAdornment: orden.tipo_estrategia !== 'POR_CANTIDAD' ? (
                  <InputAdornment position="end">
                    <LockIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ) : null
              }}
            />
          </Tooltip>
        </Grid>
      </Grid>

      {/* Sección: Parámetros Técnicos */}
      <Typography variant="subtitle1" color="primary" gutterBottom sx={{ fontWeight: 600 }}>
        ⚙️ Parámetros Técnicos
      </Typography>
      
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={4} md={2}>
          <TextField
            fullWidth
            label="Peso Unit. (gr)"
            name="peso_unitario_gr"
            type="number"
            value={orden.peso_unitario_gr}
            onChange={handleChange}
            size="small"
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <TextField
            fullWidth
            label="Peso Inc. Colada (gr)"
            name="peso_inc_colada"
            type="number"
            value={orden.peso_inc_colada}
            onChange={handleChange}
            size="small"
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <TextField
            fullWidth
            label="Cavidades"
            name="cavidades"
            type="number"
            value={orden.cavidades}
            onChange={handleChange}
            size="small"
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <TextField
            fullWidth
            label="Tiempo Ciclo (seg)"
            name="tiempo_ciclo"
            type="number"
            value={orden.tiempo_ciclo}
            onChange={handleChange}
            size="small"
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <TextField
            fullWidth
            label="Horas Turno"
            name="horas_turno"
            type="number"
            value={orden.horas_turno}
            onChange={handleChange}
            size="small"
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.1)' }} />

      {/* Sección: Lotes */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="subtitle1" color="primary" sx={{ fontWeight: 600 }}>
          🎨 Lotes de Colores ({orden.lotes.length})
        </Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleAddLote}
          size="small"
        >
          Agregar Lote
        </Button>
      </Box>

      {orden.lotes.map((lote, loteIndex) => (
        <Accordion 
          key={loteIndex}
          sx={{ 
            mb: 2, 
            background: 'rgba(22, 33, 62, 0.8)',
            border: '1px solid rgba(255,255,255,0.05)',
            '&:before': { display: 'none' }
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
              <PaletteIcon color="secondary" />
              <Typography sx={{ flexGrow: 1 }}>
                {lote.color_nombre || `Lote #${loteIndex + 1}`}
              </Typography>
              <Chip 
                size="small" 
                label={`${lote.materiales.length} mat.`} 
                color="primary" 
                variant="outlined" 
              />
              <Chip 
                size="small" 
                label={`${lote.pigmentos.length} pig.`} 
                color="secondary" 
                variant="outlined" 
              />
              <IconButton 
                size="small" 
                color="error"
                onClick={(e) => { e.stopPropagation(); handleRemoveLote(loteIndex); }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Nombre del Color"
                  value={lote.color_nombre}
                  onChange={(e) => handleLoteChange(loteIndex, 'color_nombre', e.target.value)}
                  size="small"
                  required
                />
              </Grid>
              <Grid item xs={6} sm={4}>
                <TextField
                  fullWidth
                  label="Personas"
                  type="number"
                  value={lote.personas}
                  onChange={(e) => handleLoteChange(loteIndex, 'personas', e.target.value)}
                  size="small"
                />
              </Grid>
              <Grid item xs={6} sm={4}>
                <Tooltip 
                  title={orden.tipo_estrategia !== 'STOCK' ? 'Solo disponible con estrategia "Stock Manual"' : ''}
                  placement="top"
                  arrow
                >
                  <TextField
                    fullWidth
                    label="Stock Kg Manual"
                    type="number"
                    value={lote.stock_kg_manual}
                    onChange={(e) => handleLoteChange(loteIndex, 'stock_kg_manual', e.target.value)}
                    size="small"
                    disabled={orden.tipo_estrategia !== 'STOCK'}
                    InputProps={{
                      endAdornment: orden.tipo_estrategia !== 'STOCK' ? (
                        <InputAdornment position="end">
                          <LockIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                        </InputAdornment>
                      ) : null
                    }}
                  />
                </Tooltip>
              </Grid>
            </Grid>

            {/* Materiales */}
            <Box sx={{ mt: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Materias Primas
                </Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={() => handleAddMaterial(loteIndex)}>
                  Material
                </Button>
              </Box>
              {lote.materiales.map((mat, matIndex) => (
                <Grid container spacing={1} key={matIndex} sx={{ mb: 1 }}>
                  <Grid item xs={5}>
                    <TextField
                      fullWidth
                      label="Nombre Material"
                      value={mat.nombre}
                      onChange={(e) => handleMaterialChange(loteIndex, matIndex, 'nombre', e.target.value)}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={5}>
                    <TextField
                      fullWidth
                      label="Fracción"
                      type="number"
                      inputProps={{ step: 0.01 }}
                      value={mat.fraccion}
                      onChange={(e) => handleMaterialChange(loteIndex, matIndex, 'fraccion', e.target.value)}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={2}>
                    <IconButton color="error" onClick={() => handleRemoveMaterial(loteIndex, matIndex)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}
            </Box>

            {/* Pigmentos */}
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Colorantes / Pigmentos
                </Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={() => handleAddPigmento(loteIndex)}>
                  Pigmento
                </Button>
              </Box>
              {lote.pigmentos.map((pig, pigIndex) => (
                <Grid container spacing={1} key={pigIndex} sx={{ mb: 1 }}>
                  <Grid item xs={5}>
                    <TextField
                      fullWidth
                      label="Nombre Colorante"
                      value={pig.nombre}
                      onChange={(e) => handlePigmentoChange(loteIndex, pigIndex, 'nombre', e.target.value)}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={5}>
                    <TextField
                      fullWidth
                      label="Gramos"
                      type="number"
                      inputProps={{ step: 0.1 }}
                      value={pig.gramos}
                      onChange={(e) => handlePigmentoChange(loteIndex, pigIndex, 'gramos', e.target.value)}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={2}>
                    <IconButton color="error" onClick={() => handleRemovePigmento(loteIndex, pigIndex)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}

      <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.1)' }} />

      {/* Botón Submit */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={loading}
          endIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
          sx={{
            px: 4,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%)',
            }
          }}
        >
          {loading ? 'Creando...' : 'Crear Orden'}
        </Button>
      </Box>

      {/* Snackbar para notificaciones */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          severity={snackbar.severity} 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
}

export default OrdenForm;
