import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  Tooltip,
  Stack,
  LinearProgress
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import MenuBookIcon from '@mui/icons-material/MenuBook';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function TalonariosAdmin() {
  const [talonarios, setTalonarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [siguiente, setSiguiente] = useState(null);
  
  const [formData, setFormData] = useState({
    desde: '',
    hasta: '',
    descripcion: ''
  });

  const fetchTalonarios = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/talonarios?activos=false`);
      const data = await res.json();
      setTalonarios(data);
    } catch {
      setError('Error cargando talonarios');
    } finally {
      setLoading(false);
    }
  };

  const fetchSiguiente = async () => {
    try {
      const res = await fetch(`${API_URL}/api/talonarios/siguiente`);
      if (res.ok) {
        const data = await res.json();
        setSiguiente(data.siguiente);
      } else {
        setSiguiente(null);
      }
    } catch {
      setSiguiente(null);
    }
  };

  useEffect(() => {
    fetchTalonarios();
    fetchSiguiente();
  }, []);

  const handleOpenDialog = () => {
    // Sugerir siguiente rango basado en último talonario
    const ultimo = talonarios[0];
    const sugerido = ultimo ? ultimo.hasta + 1 : 30001;
    setFormData({
      desde: sugerido.toString(),
      hasta: (sugerido + 499).toString(),
      descripcion: ''
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  const handleSubmit = async () => {
    try {
      const res = await fetch(`${API_URL}/api/talonarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || 'Error creando talonario');
        return;
      }
      
      handleCloseDialog();
      fetchTalonarios();
      fetchSiguiente();
    } catch {
      setError('Error guardando talonario');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este talonario?')) return;
    
    try {
      const res = await fetch(`${API_URL}/api/talonarios/${id}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || 'No se pudo eliminar');
        return;
      }
      
      fetchTalonarios();
      fetchSiguiente();
    } catch {
      setError('Error eliminando talonario');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={600}>
            <MenuBookIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Talonarios RDP
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestión de correlativos para Registros Diarios de Producción
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {siguiente && (
            <Chip 
              label={`Próximo: ${siguiente}`} 
              color="success" 
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenDialog}
            sx={{ bgcolor: '#1E3A5F' }}
          >
            Nuevo Talonario
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead sx={{ bgcolor: '#1E3A5F' }}>
            <TableRow>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>Rango</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>Descripción</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }} align="center">Uso</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">Disponibles</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>Estado</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }} align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {talonarios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No hay talonarios registrados.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              talonarios.map((t) => (
                <TableRow key={t.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {t.desde.toLocaleString()} - {t.hasta.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>{t.descripcion || '-'}</TableCell>
                  <TableCell align="center" sx={{ width: 200 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress 
                        variant="determinate" 
                        value={t.porcentaje_uso} 
                        sx={{ flexGrow: 1, height: 10, borderRadius: 5 }}
                        color={t.porcentaje_uso >= 90 ? 'warning' : 'primary'}
                      />
                      <Typography variant="caption" sx={{ minWidth: 45 }}>
                        {t.usados}/{t.total}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Typography fontWeight={600} color={t.disponibles === 0 ? 'error.main' : 'success.main'}>
                      {t.disponibles}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {t.disponibles === 0 ? (
                      <Chip label="Agotado" color="error" size="small" />
                    ) : t.activo ? (
                      <Chip label="Activo" color="success" size="small" />
                    ) : (
                      <Chip label="Inactivo" size="small" />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title={t.usados > 0 ? 'No se puede eliminar (tiene uso)' : 'Eliminar'}>
                      <span>
                        <IconButton 
                          size="small" 
                          color="error" 
                          onClick={() => handleDelete(t.id)}
                          disabled={t.usados > 0}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog para crear talonario */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Nuevo Talonario</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Registra el rango de correlativos del talonario recibido de la imprenta.
          </Typography>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Desde"
                type="number"
                value={formData.desde}
                onChange={(e) => setFormData({ ...formData, desde: e.target.value })}
                fullWidth
              />
              <TextField
                label="Hasta"
                type="number"
                value={formData.hasta}
                onChange={(e) => setFormData({ ...formData, hasta: e.target.value })}
                fullWidth
              />
            </Stack>
            <TextField
              label="Descripción (opcional)"
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              placeholder="Ej: Lote Enero 2026"
              fullWidth
            />
            <Alert severity="info">
              Este talonario contendrá <strong>{(parseInt(formData.hasta) || 0) - (parseInt(formData.desde) || 0) + 1}</strong> correlativos
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button variant="contained" onClick={handleSubmit} sx={{ bgcolor: '#1E3A5F' }}>
            Crear Talonario
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default TalonariosAdmin;
