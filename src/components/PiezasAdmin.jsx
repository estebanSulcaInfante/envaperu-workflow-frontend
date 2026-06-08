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
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CategoryIcon from '@mui/icons-material/Category';
import { buscarPiezas, crearPieza, actualizarPieza, eliminarPieza } from '../services/api';

function PiezasAdmin() {
  const [piezas, setPiezas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPieza, setEditingPieza] = useState(null);
  
  const [formData, setFormData] = useState({
    sku: '',
    nombre: '',
    tipo: 'SIMPLE',
    peso: '',
    cavidad: '',
    linea: '',
    familia: '',
    color: ''
  });

  const fetchPiezas = async () => {
    try {
      setLoading(true);
      const data = await buscarPiezas();
      setPiezas(data);
    } catch {
      setError('Error cargando piezas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPiezas();
  }, []);

  const handleOpenDialog = (pieza = null) => {
    if (pieza) {
      setEditingPieza(pieza);
      setFormData({
        sku: pieza.sku,
        nombre: pieza.piezas,
        tipo: pieza.tipo || 'SIMPLE',
        peso: pieza.peso || '',
        cavidad: pieza.cavidad || '',
        linea: pieza.linea || '',
        familia: pieza.familia || '',
        color: pieza.color || ''
      });
    } else {
      setEditingPieza(null);
      setFormData({
        sku: '',
        nombre: '',
        tipo: 'SIMPLE',
        peso: '',
        cavidad: '',
        linea: '',
        familia: '',
        color: ''
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPieza(null);
  };

  const handleSubmit = async () => {
    try {
      const data = {
        ...formData,
        peso: formData.peso ? parseFloat(formData.peso) : null,
        cavidad: formData.cavidad ? parseInt(formData.cavidad) : null
      };
      
      if (editingPieza) {
        await actualizarPieza(editingPieza.sku, data);
      } else {
        await crearPieza(data);
      }
      
      handleCloseDialog();
      fetchPiezas();
    } catch {
      setError('Error guardando pieza');
    }
  };

  const handleDelete = async (sku) => {
    if (window.confirm('¿Eliminar esta pieza?')) {
      try {
        await eliminarPieza(sku);
        fetchPiezas();
      } catch {
        setError('No se pudo eliminar la pieza (puede estar asociada a un molde)');
      }
    }
  };

  const getTipoColor = (tipo) => {
    switch(tipo) {
      case 'KIT': return 'primary';
      case 'COMPONENTE': return 'warning';
      default: return 'default';
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
        <Typography variant="h5" fontWeight={600}>
          <CategoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Catálogo de Piezas
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{ bgcolor: '#1E3A5F' }}
        >
          Nueva Pieza
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead sx={{ bgcolor: '#1E3A5F' }}>
            <TableRow>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>SKU</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>Nombre</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>Tipo</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>Familia</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">Peso (g)</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">Cavidades</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>En Productos</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }} align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {piezas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No hay piezas registradas.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              piezas.map((pieza) => (
                <TableRow key={pieza.sku} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{pieza.sku}</Typography>
                  </TableCell>
                  <TableCell>{pieza.piezas}</TableCell>
                  <TableCell>
                    <Chip size="small" label={pieza.tipo || 'SIMPLE'} color={getTipoColor(pieza.tipo)} />
                  </TableCell>
                  <TableCell>{pieza.familia}</TableCell>
                  <TableCell align="right">{pieza.peso}</TableCell>
                  <TableCell align="right">{pieza.cavidad}</TableCell>
                  <TableCell>
                    {pieza.productos?.slice(0, 2).map((p, i) => (
                      <Chip key={i} size="small" label={p} sx={{ mr: 0.5, mb: 0.5 }} variant="outlined" />
                    ))}
                    {pieza.num_productos > 2 && (
                      <Chip size="small" label={`+${pieza.num_productos - 2}`} sx={{ mb: 0.5 }} />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => handleOpenDialog(pieza)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Eliminar">
                      <IconButton size="small" color="error" onClick={() => handleDelete(pieza.sku)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog para crear/editar */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingPieza ? 'Editar Pieza' : 'Nueva Pieza'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField
                label="SKU"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                disabled={!!editingPieza}
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel>Tipo</InputLabel>
                <Select
                  value={formData.tipo}
                  label="Tipo"
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                >
                  <MenuItem value="SIMPLE">Simple</MenuItem>
                  <MenuItem value="KIT">Kit</MenuItem>
                  <MenuItem value="COMPONENTE">Componente</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            <TextField
              label="Nombre"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              fullWidth
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Familia"
                value={formData.familia}
                onChange={(e) => setFormData({ ...formData, familia: e.target.value })}
                fullWidth
              />
              <TextField
                label="Línea"
                value={formData.linea}
                onChange={(e) => setFormData({ ...formData, linea: e.target.value })}
                fullWidth
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Peso (g)"
                type="number"
                value={formData.peso}
                onChange={(e) => setFormData({ ...formData, peso: e.target.value })}
                fullWidth
              />
              <TextField
                label="Cavidades"
                type="number"
                value={formData.cavidad}
                onChange={(e) => setFormData({ ...formData, cavidad: e.target.value })}
                fullWidth
              />
            </Stack>
            <TextField
              label="Color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button variant="contained" onClick={handleSubmit} sx={{ bgcolor: '#1E3A5F' }}>
            {editingPieza ? 'Guardar' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default PiezasAdmin;
