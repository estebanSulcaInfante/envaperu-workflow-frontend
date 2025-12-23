import { useState, useEffect } from 'react';
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
  Divider
} from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AddIcon from '@mui/icons-material/Add';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { obtenerRegistros, obtenerOrdenes } from '../services/api';
import RegistroForm from './RegistroForm';

export default function RegistrosLista() {
  const [registros, setRegistros] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

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
  const cargarRegistros = async () => {
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
  };

  useEffect(() => {
    cargarRegistros();
  }, [ordenSeleccionada]);

  const handleRegistroCreado = () => {
    cargarRegistros(); // Refrescar lista
    setMostrarFormulario(false); // Ocultar form
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
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#1a1a2e' }}>Fecha</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#1a1a2e' }}>Turno</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#1a1a2e' }}>Máquina</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#1a1a2e' }}>Maquinista</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#1a1a2e' }}>Pieza-Color</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#1a1a2e' }} align="right">Coladas</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#1a1a2e' }} align="right">Horas</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#1a1a2e' }} align="right">Peso Real (Kg)</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#1a1a2e' }} align="right">DOC</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#1a1a2e' }} align="right">Prod. Esperada</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {registros.map((r, idx) => (
                  <TableRow 
                    key={idx}
                    sx={{ '&:hover': { bgcolor: 'rgba(79, 172, 254, 0.1)' } }}
                  >
                    <TableCell>{r['FECHA']}</TableCell>
                    <TableCell>
                      <Chip 
                        label={r['Turno']} 
                        size="small"
                        color={r['Turno'] === 'DIA' ? 'warning' : r['Turno'] === 'NOCHE' ? 'secondary' : 'default'}
                      />
                    </TableCell>
                    <TableCell>{r['Maquina']}</TableCell>
                    <TableCell>{r['Maquinista']}</TableCell>
                    <TableCell>{r['Pieza-Color']}</TableCell>
                    <TableCell align="right">{r['Coladas']}</TableCell>
                    <TableCell align="right">{r['Horas Trab.']}</TableCell>
                    <TableCell align="right">{r['Peso Real (Kg)']?.toFixed(2)}</TableCell>
                    <TableCell align="right">{r['DOC']?.toFixed(0)}</TableCell>
                    <TableCell align="right">{r['Produccion esperada']?.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {registros.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 4, color: 'grey.500' }}>
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
