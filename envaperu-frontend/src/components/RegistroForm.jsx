import { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  MenuItem,
  Box,
  Alert,
  CircularProgress,
  Divider,
  Chip,
  InputAdornment
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import TodayIcon from '@mui/icons-material/Today';
import PersonIcon from '@mui/icons-material/Person';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import ScaleIcon from '@mui/icons-material/Scale';
import { crearRegistro, obtenerMaquinas } from '../services/api';

const TURNOS = ['DIA', 'TARDE', 'NOCHE'];

export default function RegistroForm({ ordenId, onRegistroCreado }) {
  const [formData, setFormData] = useState({
    maquina_id: '',
    fecha: new Date().toISOString().split('T')[0],
    turno: 'DIA',
    hora_ingreso: '',
    maquinista: '',
    molde: '',
    pieza_color: '',
    coladas: 0,
    horas_trabajadas: 0,
    peso_real_kg: 0,
    cantidad_x_bulto: 0,
    numero_bultos: 0,
    doc_registro_nro: '',
    color_merma: '',
    peso_merma: 0,
    peso_chancaca: 0,
    fraccion_virgen: 0.5
  });

  const [maquinas, setMaquinas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const cargarMaquinas = async () => {
      try {
        const data = await obtenerMaquinas();
        setMaquinas(data);
      } catch (err) {
        console.error('Error cargando máquinas:', err);
      }
    };
    cargarMaquinas();
  }, []);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await crearRegistro(ordenId, formData);
      setSuccess(true);
      // Reset form parcialmente
      setFormData(prev => ({
        ...prev,
        coladas: 0,
        horas_trabajadas: 0,
        peso_real_kg: 0,
        numero_bultos: 0,
        peso_merma: 0,
        peso_chancaca: 0
      }));
      if (onRegistroCreado) onRegistroCreado();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar registro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper 
      sx={{ 
        p: 4, 
        background: 'rgba(26, 26, 46, 0.9)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}
    >
      <Typography variant="h5" gutterBottom sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1,
        background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        fontWeight: 700
      }}>
        <TodayIcon sx={{ color: '#4facfe' }} />
        Nuevo Registro Diario - {ordenId}
      </Typography>

      <Divider sx={{ my: 2 }} />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>Registro guardado exitosamente</Alert>}

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* SECCIÓN: DATOS GENERALES */}
          <Grid item xs={12}>
            <Chip label="Datos Generales" color="primary" sx={{ mb: 1 }} />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              select
              fullWidth
              label="Máquina"
              name="maquina_id"
              value={formData.maquina_id}
              onChange={handleChange}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PrecisionManufacturingIcon />
                  </InputAdornment>
                )
              }}
            >
              {maquinas.map(m => (
                <MenuItem key={m.id} value={m.id}>
                  {m.nombre} ({m.tipo})
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Fecha"
              name="fecha"
              type="date"
              value={formData.fecha}
              onChange={handleChange}
              required
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              select
              fullWidth
              label="Turno"
              name="turno"
              value={formData.turno}
              onChange={handleChange}
              required
            >
              {TURNOS.map(t => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Hora Ingreso"
              name="hora_ingreso"
              value={formData.hora_ingreso}
              onChange={handleChange}
              placeholder="08:00"
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Maquinista"
              name="maquinista"
              value={formData.maquinista}
              onChange={handleChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon />
                  </InputAdornment>
                )
              }}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Nº Doc. Registro"
              name="doc_registro_nro"
              value={formData.doc_registro_nro}
              onChange={handleChange}
            />
          </Grid>

          {/* SECCIÓN: PRODUCTO */}
          <Grid item xs={12}>
            <Chip label="Producto" color="secondary" sx={{ mb: 1, mt: 2 }} />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Molde"
              name="molde"
              value={formData.molde}
              onChange={handleChange}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Pieza-Color"
              name="pieza_color"
              value={formData.pieza_color}
              onChange={handleChange}
              helperText="Ej: BALDE-ROJO"
            />
          </Grid>

          {/* SECCIÓN: PRODUCCIÓN */}
          <Grid item xs={12}>
            <Chip label="Producción" sx={{ mb: 1, mt: 2, bgcolor: '#00c853', color: 'white' }} />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Coladas"
              name="coladas"
              type="number"
              value={formData.coladas}
              onChange={handleChange}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Horas Trabajadas"
              name="horas_trabajadas"
              type="number"
              inputProps={{ step: 0.5 }}
              value={formData.horas_trabajadas}
              onChange={handleChange}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Peso Real (Kg)"
              name="peso_real_kg"
              type="number"
              inputProps={{ step: 0.1 }}
              value={formData.peso_real_kg}
              onChange={handleChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <ScaleIcon />
                  </InputAdornment>
                )
              }}
            />
          </Grid>

          {/* SECCIÓN: EMPAQUE */}
          <Grid item xs={12}>
            <Chip label="Empaque" sx={{ mb: 1, mt: 2, bgcolor: '#ff9800', color: 'white' }} />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Cantidad x Bulto"
              name="cantidad_x_bulto"
              type="number"
              value={formData.cantidad_x_bulto}
              onChange={handleChange}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="# Bultos"
              name="numero_bultos"
              type="number"
              value={formData.numero_bultos}
              onChange={handleChange}
            />
          </Grid>

          {/* SECCIÓN: MERMA */}
          <Grid item xs={12}>
            <Chip label="Merma" sx={{ mb: 1, mt: 2, bgcolor: '#f44336', color: 'white' }} />
          </Grid>

          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              label="Color Merma"
              name="color_merma"
              value={formData.color_merma}
              onChange={handleChange}
            />
          </Grid>

          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              label="Peso Merma (Kg)"
              name="peso_merma"
              type="number"
              inputProps={{ step: 0.1 }}
              value={formData.peso_merma}
              onChange={handleChange}
            />
          </Grid>

          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              label="Peso Chancaca (Kg)"
              name="peso_chancaca"
              type="number"
              inputProps={{ step: 0.1 }}
              value={formData.peso_chancaca}
              onChange={handleChange}
            />
          </Grid>

          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              label="Fracción Virgen"
              name="fraccion_virgen"
              type="number"
              inputProps={{ step: 0.1, min: 0, max: 1 }}
              value={formData.fraccion_virgen}
              onChange={handleChange}
              helperText="0.0 a 1.0"
            />
          </Grid>

          {/* BOTÓN SUBMIT */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  px: 4,
                  py: 1.5,
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%)',
                  }
                }}
              >
                {loading ? 'Guardando...' : 'Guardar Registro'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>
    </Paper>
  );
}
