import { useState, useEffect, useCallback } from 'react';
import {
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
  DialogTitle
} from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AddIcon from '@mui/icons-material/Add';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import InfoIcon from '@mui/icons-material/Info';
import ScaleIcon from '@mui/icons-material/Scale';
import { obtenerRegistros, obtenerOrdenes } from '../services/api';
import RegistroForm from './RegistroForm';
import ControlPesoWidget from './ControlPesoWidget';

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
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            '&:hover': {
              background: mostrarFormulario
                ? 'linear-gradient(135deg, #d32f2f 0%, #c2185b 100%)'
                : 'linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%)',
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
      <Paper 
        sx={{ 
          p: 3, 
          background: 'rgba(26, 26, 46, 0.9)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <CalendarMonthIcon sx={{ fontSize: 32, color: '#4facfe' }} />
          <Typography variant="h5" sx={{ 
            fontWeight: 700,
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Registros Diarios de Producción
          </Typography>
        </Box>

        <Grid container spacing={2} sx={{ mb: 3 }}>
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
          <TableContainer sx={{ maxHeight: 500 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#1a1a2e' }}>ID</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#1a1a2e' }}>Fecha</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#1a1a2e' }}>Turno</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#1a1a2e' }}>Máquina</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#1a1a2e' }}>Hora Inicio</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#1a1a2e' }} align="right">Cont. Inicial</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#1a1a2e' }} align="right">Cont. Final</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#1a1a2e' }} align="right">Total Coladas</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#1a1a2e' }} align="right">Total Kg (Est)</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#1a1a2e' }} align="center">Detalles</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#1a1a2e' }} align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {registros.map((r, idx) => (
                  <TableRow 
                    key={idx}
                    sx={{ '&:hover': { bgcolor: 'rgba(79, 172, 254, 0.1)' } }}
                  >
                    <TableCell>{r['ID Registro']}</TableCell>
                    <TableCell>{r['FECHA']}</TableCell>
                    <TableCell>
                      <Chip 
                        label={r['Turno']} 
                        size="small"
                        color={r['Turno'] === 'DIA' ? 'warning' : r['Turno'] === 'NOCHE' ? 'secondary' : 'default'}
                      />
                    </TableCell>
                    <TableCell>{r['Maquina']}</TableCell>
                    <TableCell>{r['Hora Inicio']}</TableCell>
                    <TableCell align="right">{r['Colada Ini']}</TableCell>
                    <TableCell align="right">{r['Colada Fin']}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: '#4caf50' }}>{r['Total Coladas (Calc)']}</TableCell>
                    <TableCell align="right">{r['Total Kg (Est)']?.toFixed(2)}</TableCell>
                    <TableCell align="center">
                         <Tooltip title={`${r['detalles']?.length || 0} horas reportadas`}>
                            <Box display="inline-flex" alignItems="center">
                                <InfoIcon fontSize="small" sx={{ color: 'info.main', mr: 0.5 }} />
                                ({r['detalles']?.length || 0})
                            </Box>
                         </Tooltip>
                    </TableCell>
                    <TableCell align="center">
                        <Tooltip title="Control de Peso">
                            <IconButton color="secondary" size="small" onClick={() => handleOpenPeso(r['ID Registro'])}>
                                <ScaleIcon />
                            </IconButton>
                        </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {registros.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 4, color: 'grey.500' }}>
                      No hay registros para esta orden
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}
