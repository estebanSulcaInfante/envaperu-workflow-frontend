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
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import TodayIcon from '@mui/icons-material/Today';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { crearRegistro, obtenerMaquinas, obtenerOrden } from '../services/api';

const TURNOS = ['DIURNO', 'NOCTURNO', 'EXTRA'];

const GENERAR_HORAS = (inicio, cantidad = 12) => {
  const horas = [];
  let h = parseInt(inicio.split(':')[0]);
  for (let i = 0; i < cantidad; i++) {
    horas.push(`${h.toString().padStart(2, '0')}:00`);
    h = (h + 1) % 24;
  }
  return horas;
};

export default function RegistroForm({ ordenId, onRegistroCreado }) {
  // CABECERA (Usar strings para contadores para evitar el "0" inicial)
  const [header, setHeader] = useState({
    maquina_id: '',
    fecha: new Date().toISOString().split('T')[0],
    turno: 'DIURNO',
    hora_inicio: '07:00',
    colada_inicial: '',
    colada_final: '',
    tiempo_ciclo: '',
    tiempo_enfriamiento: '',
    meta_hora: ''
  });

  // Info de la Orden (para mostrar contexto)
  const [ordenInfo, setOrdenInfo] = useState(null);

  // DETALLES (Filas por hora)
  const [detalles, setDetalles] = useState([]);
  
  const [maquinas, setMaquinas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Cargar máquinas y datos de la orden al inicio
  useEffect(() => {
    obtenerMaquinas().then(setMaquinas).catch(console.error);
    if (ordenId) {
      obtenerOrden(ordenId).then(setOrdenInfo).catch(console.error);
    }
  }, [ordenId]);

  // Generar filas automáticas al cambiar turno/hora inicio
  useEffect(() => {
    if (header.hora_inicio) {
      const horas = GENERAR_HORAS(header.hora_inicio, 12);
      // Mantener datos existentes si coinciden horas, sino resetear fila
      const nuevosDetalles = horas.map(h => {
        const existente = detalles.find(d => d.hora === h);
        return existente || { 
          hora: h, 
          coladas: 0, 
          maquinista: '', 
          color: '', 
          observacion: '' 
        };
      });
      setDetalles(nuevosDetalles);
    }
  }, [header.turno, header.hora_inicio]);

  const handleHeaderChange = (e) => {
    const { name, value, type } = e.target;
    setHeader(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const handleDetalleChange = (index, field, value) => {
    const newDetalles = [...detalles];
    newDetalles[index] = { ...newDetalles[index], [field]: value };
    setDetalles(newDetalles);
  };
  
  // Totales Calculados en vivo para validación
  const totalColadasDetalle = detalles.reduce((sum, d) => sum + (parseInt(d.coladas) || 0), 0);
  const coladaIni = parseInt(header.colada_inicial) || 0;
  const coladaFin = parseInt(header.colada_final) || 0;
  const totalColadasContador = coladaFin - coladaIni;
  const diffColadas = totalColadasContador - totalColadasDetalle;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    // Validación básica
    if (diffColadas !== 0) {
        if (!window.confirm(`Advertencia: Las coladas reportadas (${totalColadasDetalle}) no coinciden con la diferencia de contadores (${totalColadasContador}). ¿Continuar?`)) {
            setLoading(false);
            return;
        }
    }

    const payload = {
        ...header,
        detalles: detalles.filter(d => d.coladas > 0 || d.observacion) // Enviar solo filas relevantes? O todas? Mejor todas para historial vacio.
    };

    try {
      await crearRegistro(ordenId, payload);
      setSuccess(true);
      if (onRegistroCreado) onRegistroCreado();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar registro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ 
      p: 4, 
      borderRadius: 2, 
      background: 'rgba(26, 26, 46, 0.95)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.1)'
    }}>
      <Typography variant="h5" sx={{ 
        mb: 1, 
        fontWeight: 'bold', 
        background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent'
      }}>
        <TodayIcon sx={{ mr: 1, verticalAlign: 'bottom', color: '#4facfe' }} />
        Hoja de Producción Diaria
      </Typography>

      {/* Info de la Orden */}
      {ordenInfo && (
        <Box sx={{ mb: 3, p: 2, bgcolor: 'rgba(79, 172, 254, 0.1)', borderRadius: 1, border: '1px solid rgba(79, 172, 254, 0.3)' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#4facfe' }}>
            {ordenId} - {ordenInfo.producto}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Máquina: {ordenInfo.maquina} | Cavidades: {ordenInfo.cavidades} | T/C: {ordenInfo.tiempo_ciclo}s | Peso Unit: {ordenInfo.peso_unitario_gr}g
          </Typography>
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>Registro guardado correctamente</Alert>}

      <form onSubmit={handleSubmit}>
        {/* CABECERA */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
           <Grid item xs={12}><Chip label="Datos Generales" color="primary" variant="outlined" /></Grid>
           
           <Grid item xs={6} sm={3}>
            <TextField label="Fecha" type="date" fullWidth name="fecha" value={header.fecha} onChange={handleHeaderChange} InputLabelProps={{ shrink: true }} />
           </Grid>
           <Grid item xs={6} sm={3}>
             <TextField select label="Turno" fullWidth name="turno" value={header.turno} onChange={handleHeaderChange}>
                {TURNOS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
             </TextField>
           </Grid>
           <Grid item xs={6} sm={3}>
             <TextField label="Hora Inicio" fullWidth name="hora_inicio" value={header.hora_inicio} onChange={handleHeaderChange} type="time" InputLabelProps={{ shrink: true }} />
           </Grid>
           <Grid item xs={6} sm={3}>
             <TextField select label="Máquina" fullWidth name="maquina_id" value={header.maquina_id} onChange={handleHeaderChange} required>
                {maquinas.map(m => <MenuItem key={m.id} value={m.id}>{m.nombre}</MenuItem>)}
             </TextField>
           </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        {/* CONTADORES Y METAS */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
           <Grid item xs={12}><Chip label="Parámetros Máquina" color="secondary" variant="outlined" /></Grid>

           <Grid item xs={6} sm={3}>
             <TextField 
               label="Colada Inicial" 
               fullWidth 
               name="colada_inicial" 
               value={header.colada_inicial} 
               onChange={handleHeaderChange}
               inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
               placeholder="Ej: 1000"
             />
           </Grid>
           <Grid item xs={6} sm={3}>
             <TextField 
               label="Colada Final" 
               fullWidth 
               name="colada_final" 
               value={header.colada_final} 
               onChange={handleHeaderChange}
               inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
               placeholder="Ej: 1500"
             />
           </Grid>
           <Grid item xs={6} sm={3}>
             <TextField 
               label="Total (Auto)" 
               value={totalColadasContador} 
               disabled 
               fullWidth 
               InputProps={{ readOnly: true }} 
               sx={{ 
                 bgcolor: 'rgba(79, 172, 254, 0.15)', 
                 borderRadius: 1,
                 '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#4facfe' }
               }} 
             />
           </Grid>
           
           <Grid item xs={6} sm={3}>
             <TextField label="Ciclo (seg)" type="number" fullWidth name="tiempo_ciclo" value={header.tiempo_ciclo} onChange={handleHeaderChange} inputProps={{ step: 0.1 }} />
           </Grid>
        </Grid>

        {/* TABLA DETALLES */}
        <Typography variant="h6" gutterBottom>Registro Hora a Hora</Typography>
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, bgcolor: 'rgba(26, 26, 46, 0.8)' }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: 'rgba(79, 172, 254, 0.2)' }}>
              <TableRow>
                <TableCell>Hora</TableCell>
                <TableCell>Maquinista</TableCell>
                <TableCell>Color</TableCell>
                <TableCell width={120}>Coladas</TableCell>
                <TableCell>Observación</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {detalles.map((fila, index) => (
                <TableRow key={fila.hora}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">{fila.hora}</Typography>
                  </TableCell>
                  <TableCell>
                    <TextField 
                        variant="standard" 
                        fullWidth 
                        value={fila.maquinista} 
                        onChange={(e) => handleDetalleChange(index, 'maquinista', e.target.value)} 
                    />
                  </TableCell>
                  <TableCell>
                    <TextField 
                        variant="standard" 
                        fullWidth 
                        value={fila.color} 
                        onChange={(e) => handleDetalleChange(index, 'color', e.target.value)} 
                    />
                  </TableCell>
                  <TableCell>
                    <TextField 
                        type="number" 
                        variant="outlined" 
                        size="small"
                        value={fila.coladas} 
                        onChange={(e) => handleDetalleChange(index, 'coladas', parseInt(e.target.value) || 0)}
                        sx={{ input: { textAlign: 'right' } }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField 
                        variant="standard" 
                        fullWidth 
                        value={fila.observacion} 
                        onChange={(e) => handleDetalleChange(index, 'observacion', e.target.value)} 
                    />
                  </TableCell>
                </TableRow>
              ))}
              {/* FILA TOTALES */}
              <TableRow sx={{ bgcolor: 'rgba(79, 172, 254, 0.1)' }}>
                <TableCell colSpan={3} align="right"><strong>Total Reportado:</strong></TableCell>
                <TableCell align="right">
                    <Typography color={diffColadas !== 0 ? 'error' : 'success.main'} fontWeight="bold">
                        {totalColadasDetalle}
                    </Typography>
                </TableCell>
                <TableCell>
                    {diffColadas !== 0 && (
                        <Typography variant="caption" color="error">
                            Dif: {diffColadas}
                        </Typography>
                    )}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
             <Button 
                type="submit" 
                variant="contained" 
                size="large" 
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
             >
                Guardar Informe
             </Button>
        </Box>
      </form>
    </Paper>
  );
}
