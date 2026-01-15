import { useState, useEffect, useCallback } from 'react';
import {
  Paper,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  MenuItem,
  Grid,
  Button,
  Collapse,
  IconButton,
  Tooltip,
  Dialog,
  DialogContent,
  DialogTitle,
  List
} from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AddIcon from '@mui/icons-material/Add';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import InfoIcon from '@mui/icons-material/Info';
import ScaleIcon from '@mui/icons-material/Scale';
import { obtenerRegistros, obtenerOrdenes } from '../services/api';
import RegistroForm from './RegistroForm';
import ControlPesoWidget from './ControlPesoWidget';
import RegistroNode from './RegistroNode';

export default function RegistrosLista() {
  const [registros, setRegistros] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  
  // Estado para modal de peso
  const [openPeso, setOpenPeso] = useState(false);
  const [registroSeleccionadoId, setRegistroSeleccionadoId] = useState(null);

  // Cargar órdenes disponibles
  useEffect(() => {
    const cargarOrdenes = async () => {
      try {
        const data = await obtenerOrdenes();
        setOrdenes(data);
        if (data.length > 0) {
          setOrdenSeleccionada(data[0].numero_op);
        }
      } catch (err) {
        console.error('Error cargando órdenes:', err);
      }
    };
    cargarOrdenes();
  }, []);

  // Cargar registros cuando cambia la orden seleccionada
  const cargarRegistros = useCallback(async () => {
    if (!ordenSeleccionada) return;
    setLoading(true);
    setError(null);
    try {
      const data = await obtenerRegistros(ordenSeleccionada);
      setRegistros(data);
    } catch (err) {
      setError('Error al cargar registros');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [ordenSeleccionada]);

  useEffect(() => {
    cargarRegistros();
  }, [cargarRegistros]);

  const handleRegistroCreado = () => {
    cargarRegistros(); // Refrescar lista
    setMostrarFormulario(false); // Ocultar form
  };
  
  const handleOpenPeso = (id) => {
      setRegistroSeleccionadoId(id);
      setOpenPeso(true);
  };

  return (
    <Box>
      {/* Botón para mostrar formulario */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          startIcon={mostrarFormulario ? <ExpandLessIcon /> : <AddIcon />}
          onClick={() => setMostrarFormulario(!mostrarFormulario)}
          sx={{
            background: mostrarFormulario 
              ? 'linear-gradient(135deg, #f44336 0%, #e91e63 100%)'
              : 'linear-gradient(135deg, #1E3A5F 0%, #0D2137 100%)',
            '&:hover': {
              background: mostrarFormulario
                ? 'linear-gradient(135deg, #d32f2f 0%, #c2185b 100%)'
                : 'linear-gradient(135deg, #152a45 0%, #0a1a2e 100%)',
            }
          }}
        >
          {mostrarFormulario ? 'Ocultar Formulario' : 'Nuevo Registro'}
        </Button>
      </Box>

      {/* Formulario colapsable */}
      <Collapse in={mostrarFormulario}>
        <Box sx={{ mb: 3 }}>
          {ordenSeleccionada ? (
            <RegistroForm 
              ordenId={ordenSeleccionada} 
              onRegistroCreado={handleRegistroCreado}
            />
          ) : (
            <Alert severity="warning">Selecciona una orden primero</Alert>
          )}
        </Box>
      </Collapse>

      {/* Modal Control Peso */}
      <Dialog open={openPeso} onClose={() => setOpenPeso(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: '#1a1a2e', color: 'white' }}>Verificación de Peso</DialogTitle>
        <DialogContent sx={{ bgcolor: '#1a1a2e' }}>
            {registroSeleccionadoId && (
                <ControlPesoWidget registroId={registroSeleccionadoId} />
            )}
        </DialogContent>
      </Dialog>

      {/* Lista de Registros */}
      <Paper sx={{ 
        background: '#FFFFFF',
        border: '1px solid #E0E0E0',
        borderRadius: 2,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <Box sx={{ p: 3, display: 'flex', alignItems: 'center', borderBottom: '1px solid #E0E0E0' }}>
          <CalendarMonthIcon sx={{ fontSize: 32, color: '#1E3A5F' }} />
          <Typography variant="h5" sx={{ 
            ml: 1, 
            fontWeight: 'bold',
            color: '#1E3A5F'
          }}>
            Registros Diarios de Producción
          </Typography>
        </Box>

        <Grid container spacing={2} sx={{ mb: 3, px: 3, pt: 3 }}>
          <Grid item xs={12} sm={4}>
            <TextField
              select
              fullWidth
              label="Seleccionar Orden"
              value={ordenSeleccionada}
              onChange={(e) => setOrdenSeleccionada(e.target.value)}
            >
              {ordenes.map(o => (
                <MenuItem key={o.numero_op} value={o.numero_op}>
                  {o.numero_op} - {o.producto}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={8}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', height: '100%' }}>
              <Chip label={`${registros.length} registros`} color="info" />
            </Box>
          </Grid>
        </Grid>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ px: 2, pb: 2 }}>
            <Paper variant="outlined" sx={{ bgcolor: '#f8f9fa' }}>
                <List>
                    {registros.map((r, idx) => {
                         // Find the full order object to get estimated shot weight
                         const currentOrden = ordenes.find(o => o.numero_op === ordenSeleccionada);
                         
                         return (
                            <Box key={idx} sx={{ borderBottom: '1px solid #e0e0e0', '&:last-child': { borderBottom: 'none' } }}>
                                <RegistroNode 
                                    registro={r} 
                                    pesoTiro={currentOrden?.peso_tiro} 
                                    onPesoClick={() => handleOpenPeso(r['ID Registro'])}
                                />
                            </Box>
                         );
                    })}
                    
                    {registros.length === 0 && (
                        <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
                            <Typography>No hay registros para esta orden</Typography>
                        </Box>
                    )}
                </List>
            </Paper>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
