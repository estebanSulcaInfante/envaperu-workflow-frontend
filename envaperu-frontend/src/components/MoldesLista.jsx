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
  Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import { obtenerMoldes, crearMolde, actualizarMolde, eliminarMolde } from '../services/api';

function MoldesLista() {
  const [moldes, setMoldes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMolde, setEditingMolde] = useState(null);
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    peso_tiro_gr: '',
    tiempo_ciclo_std: 30,
    notas: ''
  });

  const fetchMoldes = async () => {
    try {
      setLoading(true);
      const data = await obtenerMoldes();
      setMoldes(data);
    } catch {
      setError('Error cargando moldes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMoldes();
  }, []);

  const handleOpenDialog = (molde = null) => {
    if (molde) {
      setEditingMolde(molde);
      setFormData({
        codigo: molde.codigo,
        nombre: molde.nombre,
        peso_tiro_gr: molde.peso_tiro_gr,
        tiempo_ciclo_std: molde.tiempo_ciclo_std,
        notas: molde.notas || ''
      });
    } else {
      setEditingMolde(null);
      setFormData({
        codigo: '',
        nombre: '',
        peso_tiro_gr: '',
        tiempo_ciclo_std: 30,
        notas: ''
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingMolde(null);
  };

  const handleSubmit = async () => {
    try {
      const data = {
        ...formData,
        peso_tiro_gr: parseFloat(formData.peso_tiro_gr),
        tiempo_ciclo_std: parseFloat(formData.tiempo_ciclo_std)
      };
      
      if (editingMolde) {
        await actualizarMolde(editingMolde.codigo, data);
      } else {
        await crearMolde(data);
      }
      
      handleCloseDialog();
      fetchMoldes();
    } catch {
      setError('Error guardando molde');
    }
  };

  const handleDelete = async (codigo) => {
    if (window.confirm('¿Eliminar este molde?')) {
      try {
        await eliminarMolde(codigo);
        fetchMoldes();
      } catch {
        setError('No se pudo eliminar el molde');
      }
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
          <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Catálogo de Moldes
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{ bgcolor: '#1E3A5F' }}
        >
          Nuevo Molde
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead sx={{ bgcolor: '#1E3A5F' }}>
            <TableRow>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>Código</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>Nombre</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">Peso Tiro (g)</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">Peso Neto (g)</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">Colada (g)</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">Merma %</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">Cavidades</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">T. Ciclo (s)</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>Piezas</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }} align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {moldes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    No hay moldes registrados. Crea uno nuevo.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              moldes.map((molde) => (
                <TableRow key={molde.codigo} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{molde.codigo}</Typography>
                  </TableCell>
                  <TableCell>{molde.nombre}</TableCell>
                  <TableCell align="right">{molde.peso_tiro_gr?.toFixed(1)}</TableCell>
                  <TableCell align="right">{molde.peso_neto_gr?.toFixed(1)}</TableCell>
                  <TableCell align="right">{molde.peso_colada_gr?.toFixed(1)}</TableCell>
                  <TableCell align="right">
                    <Chip 
                      size="small" 
                      label={`${(molde.merma_pct * 100).toFixed(1)}%`}
                      color={molde.merma_pct > 0.1 ? 'warning' : 'success'}
                    />
                  </TableCell>
                  <TableCell align="right">{molde.cavidades_totales}</TableCell>
                  <TableCell align="right">{molde.tiempo_ciclo_std}</TableCell>
                  <TableCell>
                    {molde.piezas?.map((p) => (
                      <Chip 
                        key={p.id} 
                        size="small" 
                        label={`${p.pieza_nombre || p.pieza_sku} (${p.cavidades})`}
                        sx={{ mr: 0.5, mb: 0.5 }}
                      />
                    ))}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => handleOpenDialog(molde)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Eliminar">
                      <IconButton size="small" color="error" onClick={() => handleDelete(molde.codigo)}>
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
          {editingMolde ? 'Editar Molde' : 'Nuevo Molde'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Código"
              value={formData.codigo}
              onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
              disabled={!!editingMolde}
              placeholder="MOL-001"
              fullWidth
            />
            <TextField
              label="Nombre"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              fullWidth
            />
            <TextField
              label="Peso Tiro (g)"
              type="number"
              value={formData.peso_tiro_gr}
              onChange={(e) => setFormData({ ...formData, peso_tiro_gr: e.target.value })}
              helperText="Peso total del golpe (piezas + colada)"
              fullWidth
            />
            <TextField
              label="Tiempo Ciclo (segundos)"
              type="number"
              value={formData.tiempo_ciclo_std}
              onChange={(e) => setFormData({ ...formData, tiempo_ciclo_std: e.target.value })}
              fullWidth
            />
            <TextField
              label="Notas"
              value={formData.notas}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              multiline
              rows={2}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button variant="contained" onClick={handleSubmit} sx={{ bgcolor: '#1E3A5F' }}>
            {editingMolde ? 'Guardar' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default MoldesLista;
