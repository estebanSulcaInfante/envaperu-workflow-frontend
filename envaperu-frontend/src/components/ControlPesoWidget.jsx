import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  IconButton,
  Alert,
  Grid,
  Chip,
  CircularProgress
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ScaleIcon from '@mui/icons-material/Scale';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { obtenerBultos, agregarBulto, eliminarBulto, validarPesoRegistro } from '../services/api';

export default function ControlPesoWidget({ registroId, onUpdate }) {
  const [bultos, setBultos] = useState([]);
  const [validacion, setValidacion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [nuevoPeso, setNuevoPeso] = useState('');
  const [nuevoColor, setNuevoColor] = useState('');
  const [error, setError] = useState('');

  const cargarDatos = useCallback(async () => {
    if (!registroId) return;
    setLoading(true);
    try {
      const datosBultos = await obtenerBultos(registroId);
      setBultos(datosBultos);
      
      const val = await validarPesoRegistro(registroId);
      setValidacion(val);
    } catch (err) {
      console.error(err);
      setError('Error cargando datos de peso');
    } finally {
      setLoading(false);
    }
  }, [registroId]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const handleAgregar = async (e) => {
    e.preventDefault();
    if (!nuevoPeso) return;
    try {
        await agregarBulto(registroId, {
            peso: parseFloat(nuevoPeso),
            color: nuevoColor || 'GENERICO'
        });
        setNuevoPeso('');
        setNuevoColor('');
        cargarDatos();
        if (onUpdate) onUpdate();
    } catch (err) {
        setError(err.message || 'Error guardando peso');
    }
  };

  const handleEliminar = async (id) => {
    if (!window.confirm('¿Borrar bulto?')) return;
    try {
        await eliminarBulto(id);
        cargarDatos();
        if (onUpdate) onUpdate();
    } catch (err) {
        setError(err.message);
    }
  };

  return (
    <Box sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2 }}>
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <ScaleIcon color="secondary" />
        <Typography variant="h6" color="white">Control de Peso (Doble Verificación)</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Resumen de Validación */}
      {validacion && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: validacion.coincide ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)' }}>
            <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                    <Typography variant="subtitle2" color="grey.400">Total Maquinista (Teórico)</Typography>
                    <Typography variant="h5" color="white">{validacion.peso_teorico_kg} Kg</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Typography variant="subtitle2" color="grey.400">Total Pesado (Real)</Typography>
                    <Typography variant="h5" color="secondary.main">{validacion.total_pesado_kg} Kg</Typography>
                </Grid>
                <Grid item xs={12} md={4} textAlign="right">
                    <Chip 
                        icon={validacion.coincide ? <CheckCircleIcon/> : <ErrorIcon/>} 
                        label={validacion.coincide ? "Peso Coincide" : `Diferencia: ${validacion.diferencia_kg} Kg`} 
                        color={validacion.coincide ? "success" : "error"}
                        variant="outlined"
                        sx={{ fontSize: '1rem', py: 2 }}
                    />
                </Grid>
            </Grid>
        </Paper>
      )}

      {/* Formulario Agregar */}
      <Paper component="form" onSubmit={handleAgregar} sx={{ p: 2, mb: 2, display: 'flex', gap: 2, alignItems: 'center', bgcolor: 'background.paper' }}>
        <TextField 
            label="Peso (Kg)" 
            type="number" 
            size="small" 
            value={nuevoPeso}
            onChange={(e) => setNuevoPeso(e.target.value)}
            InputProps={{ inputProps: { step: 0.01 } }}
            required
        />
        <TextField 
            label="Color / Detalle" 
            size="small" 
            value={nuevoColor}
            onChange={(e) => setNuevoColor(e.target.value)}
        />
        <Button variant="contained" color="secondary" type="submit" startIcon={<AddIcon />}>
            Registrar Bulto
        </Button>
      </Paper>

      {/* Lista de Bultos */}
      <TableContainer sx={{maxHeight: 300}}>
        <Table size="small">
            <TableHead>
                <TableRow>
                    <TableCell>Hora</TableCell>
                    <TableCell>Color</TableCell>
                    <TableCell align="right">Peso (Kg)</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {bultos.map((b) => (
                    <TableRow key={b.id}>
                        <TableCell>{new Date(b.hora).toLocaleTimeString()}</TableCell>
                        <TableCell>{b.color}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{b.peso_real_kg}</TableCell>
                        <TableCell align="right">
                            <IconButton size="small" color="error" onClick={() => handleEliminar(b.id)}>
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// Helper icon import (was missing in main import block if not careful)
import AddIcon from '@mui/icons-material/Add';
