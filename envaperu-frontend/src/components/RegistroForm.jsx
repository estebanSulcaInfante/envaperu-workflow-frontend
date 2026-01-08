import { useState, useEffect, useRef } from 'react';
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
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import { crearRegistro, obtenerMaquinas, obtenerOrden, scanRegistroOCR } from '../services/api';

const TURNOS = ['DIURNO', 'NOCTURNO'];

// Horas fijas: siempre 7-6 (11 horas)
// La hora 6-7 es el turno EXTRA y se muestra como fila adicional
const HORAS_FIJAS = [
  '07:00 - 08:00',
  '08:00 - 09:00', 
  '09:00 - 10:00',
  '10:00 - 11:00',
  '11:00 - 12:00',
  '12:00 - 01:00',
  '01:00 - 02:00',
  '02:00 - 03:00',
  '03:00 - 04:00',
  '04:00 - 05:00',
  '05:00 - 06:00'
];

const HORA_EXTRA = '06:00 - 07:00';

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
  const [ocrSuccess, setOcrSuccess] = useState(false);
  const [scanning, setScanning] = useState(false);
  
  // Hora extra (6-7)
  const [horaExtra, setHoraExtra] = useState({ 
    coladas: 0, 
    maquinista: '', 
    color: '', 
    observacion: '' 
  });
  
  // Ref para input de archivo oculto
  const fileInputRef = useRef(null);

  // Handler para escanear imagen con OCR
  const handleScanOCR = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setScanning(true);
    setError(null);
    
    try {
      const result = await scanRegistroOCR(file);
      
      if (result.success && result.data) {
        const data = result.data;
        
        // Pre-llenar header
        setHeader(prev => ({
          ...prev,
          fecha: data.fecha || prev.fecha,
          turno: data.turno || prev.turno,
          hora_inicio: data.hora_inicio || prev.hora_inicio,
          colada_inicial: data.colada_inicial?.toString() || prev.colada_inicial,
          colada_final: data.colada_final?.toString() || prev.colada_final,
          tiempo_enfriamiento: data.enfriamiento?.toString() || prev.tiempo_enfriamiento
        }));
        
        // Pre-llenar detalles si vienen
        if (data.detalles && data.detalles.length > 0) {
          setDetalles(prev => {
            const newDetalles = [...prev];
            data.detalles.forEach(d => {
              const idx = newDetalles.findIndex(nd => nd.hora === d.hora);
              if (idx !== -1) {
                newDetalles[idx] = {
                  ...newDetalles[idx],
                  maquinista: d.maquinista || newDetalles[idx].maquinista,
                  color: d.color || newDetalles[idx].color,
                  coladas: d.coladas || newDetalles[idx].coladas,
                  observacion: d.observacion || newDetalles[idx].observacion
                };
              }
            });
            return newDetalles;
          });
          
          // Buscar si hay datos para hora extra (6-7)
          const extraData = data.detalles.find(d => d.hora === '06:00 - 07:00');
          if (extraData) {
            setHoraExtra(prev => ({
              ...prev,
              maquinista: extraData.maquinista || prev.maquinista,
              color: extraData.color || prev.color,
              coladas: extraData.coladas || prev.coladas,
              observacion: extraData.observacion || prev.observacion
            }));
          }
        }
        
        setOcrSuccess(true);
        setTimeout(() => setOcrSuccess(false), 5000);
      } else {
        setError(result.error || 'Error al procesar imagen');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al escanear imagen');
    } finally {
      setScanning(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Cargar máquinas y datos de la orden al inicio
  useEffect(() => {
    obtenerMaquinas().then(setMaquinas).catch(console.error);
    if (ordenId) {
      obtenerOrden(ordenId).then(setOrdenInfo).catch(console.error);
    }
  }, [ordenId]);

  // Inicializar filas con horas fijas (una sola vez)
  useEffect(() => {
    const nuevosDetalles = HORAS_FIJAS.map(h => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  
  // Totales Calculados en vivo para validación (incluye hora extra)
  const totalColadasDetalle = detalles.reduce((sum, d) => sum + (parseInt(d.coladas) || 0), 0) + (parseInt(horaExtra.coladas) || 0);
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

    // Incluir hora extra si tiene datos
    const allDetalles = [...detalles];
    if (horaExtra.coladas > 0 || horaExtra.observacion) {
      allDetalles.push({ hora: HORA_EXTRA, ...horaExtra });
    }
    
    const payload = {
        ...header,
        detalles: allDetalles.filter(d => d.coladas > 0 || d.observacion)
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
      background: '#FFFFFF',
      border: '1px solid #E0E0E0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ 
          fontWeight: 'bold', 
          color: '#1E3A5F'
        }}>
          <TodayIcon sx={{ mr: 1, verticalAlign: 'bottom', color: '#1E3A5F', fontSize: 20 }} />
          Hoja de Producción Diaria
        </Typography>
        
        {/* Botón Escanear OCR */}
        <Button
          variant="outlined"
          color="secondary"
          size="small"
          startIcon={scanning ? <CircularProgress size={16} /> : <CameraAltIcon />}
          onClick={() => fileInputRef.current?.click()}
          disabled={scanning}
          sx={{ borderColor: '#1E3A5F', color: '#1E3A5F' }}
        >
          {scanning ? 'Escaneando...' : '📷 Escanear'}
        </Button>
        
        {/* Input oculto para seleccionar archivo */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={fileInputRef}
          onChange={handleScanOCR}
          style={{ display: 'none' }}
        />
      </Box>

      {/* Info de la Orden - Compacta */}
      {ordenInfo && (
        <Box sx={{ mb: 3, p: 2, bgcolor: '#E3F2FD', borderRadius: 1, border: '1px solid #1E3A5F' }}>
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold', color: '#1E3A5F' }}>
            Nº OP: {ordenId} - {ordenInfo.producto}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, fontSize: '0.75rem' }}>
            <Typography variant="caption" color="text.secondary">
              <strong>Cavidades:</strong> {ordenInfo.cavidades}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              <strong>Peso Neto:</strong> {ordenInfo.peso_unitario_gr}g
            </Typography>
            <Typography variant="caption" color="text.secondary">
              <strong>Ciclo:</strong> {ordenInfo.tiempo_ciclo}s
            </Typography>
            <Typography variant="caption" color="text.secondary">
              <strong>Máquina:</strong> {ordenInfo.maquina}
            </Typography>
          </Box>
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
      {ocrSuccess && <Alert severity="info" sx={{ mb: 1.5 }}>📷 Datos escaneados. Revise y corrija antes de guardar.</Alert>}
      {success && <Alert severity="success" sx={{ mb: 1.5 }}>✅ Registro guardado correctamente</Alert>}

      <form onSubmit={handleSubmit}>
        {/* Layout Compacto: 2 Cards en Flexbox */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
          {/* Card 1: Datos Generales */}
          <Paper sx={{ p: 1.5, background: '#F5F5F5', flex: '1 1 280px', minWidth: 0 }}>
            <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 600, mb: 1 }}>
              📅 Datos Generales
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <TextField 
                label="Fecha" 
                type="date" 
                name="fecha" 
                value={header.fecha} 
                onChange={handleHeaderChange} 
                InputLabelProps={{ shrink: true }} 
                size="small"
                sx={{ flex: '1 1 140px' }}
              />
              <TextField 
                select 
                label="Turno" 
                name="turno" 
                value={header.turno} 
                onChange={handleHeaderChange}
                size="small"
                sx={{ flex: '1 1 100px' }}
              >
                {TURNOS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
              <TextField 
                label="Hora Inicio" 
                name="hora_inicio" 
                value={header.hora_inicio} 
                onChange={handleHeaderChange} 
                type="time" 
                InputLabelProps={{ shrink: true }}
                size="small"
                sx={{ flex: '1 1 100px' }}
              />
              <TextField 
                select 
                label="Máquina" 
                name="maquina_id" 
                value={header.maquina_id} 
                onChange={handleHeaderChange} 
                required
                size="small"
                sx={{ flex: '1 1 120px' }}
              >
                {maquinas.map(m => <MenuItem key={m.id} value={m.id}>{m.nombre}</MenuItem>)}
              </TextField>
            </Box>
          </Paper>

          {/* Card 2: Contadores y Parámetros */}
          <Paper sx={{ p: 1.5, background: '#F5F5F5', flex: '1 1 280px', minWidth: 0 }}>
            <Typography variant="subtitle2" color="secondary" sx={{ fontWeight: 600, mb: 1 }}>
              ⚙️ Contadores
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <TextField 
                label="Colada Ini" 
                name="colada_inicial" 
                value={header.colada_inicial} 
                onChange={handleHeaderChange}
                inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                placeholder="1000"
                size="small"
                sx={{ flex: '1 1 90px' }}
              />
              <TextField 
                label="Colada Fin" 
                name="colada_final" 
                value={header.colada_final} 
                onChange={handleHeaderChange}
                inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                placeholder="1500"
                size="small"
                sx={{ flex: '1 1 90px' }}
              />
              <TextField 
               label="Total (Auto)" 
               value={totalColadasContador} 
               disabled 
               fullWidth 
               InputProps={{ readOnly: true }} 
               sx={{ 
                 bgcolor: '#E3F2FD', 
                 borderRadius: 1,
                 '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#1E3A5F' }
                }} 
              />
              <TextField 
                label="Ciclo (s)" 
                type="number" 
                name="tiempo_ciclo" 
                value={header.tiempo_ciclo} 
                onChange={handleHeaderChange} 
                inputProps={{ step: 0.1 }}
                size="small"
                sx={{ flex: '1 1 80px' }}
              />
            </Box>
          </Paper>
        </Box>

        {/* TABLA DETALLES */}
        <Typography variant="h6" gutterBottom>Registro Hora a Hora</Typography>
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, bgcolor: '#FFFFFF' }}>
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
              
              {/* FILA HORA EXTRA (6-7) */}
              <TableRow sx={{ bgcolor: 'rgba(255, 152, 0, 0.1)' }}>
                <TableCell>
                  <Typography variant="body2" fontWeight="bold" color="warning.main">
                    {HORA_EXTRA} (EXTRA)
                  </Typography>
                </TableCell>
                <TableCell>
                  <TextField 
                    variant="standard" 
                    fullWidth 
                    value={horaExtra.maquinista} 
                    onChange={(e) => setHoraExtra(prev => ({ ...prev, maquinista: e.target.value }))} 
                  />
                </TableCell>
                <TableCell>
                  <TextField 
                    variant="standard" 
                    fullWidth 
                    value={horaExtra.color} 
                    onChange={(e) => setHoraExtra(prev => ({ ...prev, color: e.target.value }))} 
                  />
                </TableCell>
                <TableCell>
                  <TextField 
                    type="number" 
                    variant="outlined" 
                    size="small"
                    value={horaExtra.coladas} 
                    onChange={(e) => setHoraExtra(prev => ({ ...prev, coladas: parseInt(e.target.value) || 0 }))}
                    sx={{ input: { textAlign: 'right' } }}
                  />
                </TableCell>
                <TableCell>
                  <TextField 
                    variant="standard" 
                    fullWidth 
                    value={horaExtra.observacion} 
                    onChange={(e) => setHoraExtra(prev => ({ ...prev, observacion: e.target.value }))} 
                  />
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
