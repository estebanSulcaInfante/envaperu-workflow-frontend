import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Grid
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import { obtenerMoldes, crearMolde, eliminarMolde } from '../services/api';

function MoldesLista() {
  const navigate = useNavigate();
  const [moldes, setMoldes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Dialog for new Molde
  const [dialogOpen, setDialogOpen] = useState(false);
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

  const handleOpenDialog = () => {
    setFormData({
      codigo: '',
      nombre: '',
      peso_tiro_gr: '',
      tiempo_ciclo_std: 30,
      notas: ''
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  const handleSave = async () => {
    try {
      await crearMolde(formData);
      handleCloseDialog();
      fetchMoldes();
    } catch (err) {
      alert(err.response?.data?.error || 'Error guardando molde');
    }
  };

  const handleDelete = async (codigo) => {
    if (window.confirm(`¿Está seguro de eliminar el molde ${codigo}?`)) {
      try {
        await eliminarMolde(codigo);
        fetchMoldes();
      } catch (err) {
        alert(err.response?.data?.error || 'Error eliminando molde');
      }
    }
  };

  if (loading && moldes.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" fontWeight={600}>
          <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Catálogo de Moldes
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenDialog}
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
              <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">Cavidades Totales</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">T. Ciclo (s)</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>Formas</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }} align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {moldes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
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
                  <TableCell align="right">{molde.cavidades_totales}</TableCell>
                  <TableCell align="right">{molde.tiempo_ciclo_std}</TableCell>
                  <TableCell>
                    {molde.formas?.map((p) => (
                      <Chip 
                        key={p.id} 
                        size="small" 
                        label={`${p.nombre} (${p.cavidades})`}
                        sx={{ mr: 0.5, mb: 0.5 }}
                      />
                    ))}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Ver Detalle y Editar Formas/SKUs">
                      <IconButton size="small" onClick={() => navigate(`/catalogo/moldes/${molde.codigo}`)}>
                        <EditIcon fontSize="small" color="primary" />
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

      {/* Dialog Nuevo Molde */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Nuevo Molde</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Código Molde (Ej. MOL-123)"
                fullWidth
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Nombre Descriptivo"
                fullWidth
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Peso Tiro Completo (g)"
                type="number"
                fullWidth
                value={formData.peso_tiro_gr}
                onChange={(e) => setFormData({ ...formData, peso_tiro_gr: parseFloat(e.target.value) })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Tiempo Ciclo (s)"
                type="number"
                fullWidth
                value={formData.tiempo_ciclo_std}
                onChange={(e) => setFormData({ ...formData, tiempo_ciclo_std: parseFloat(e.target.value) })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Notas Adicionales"
                multiline
                rows={2}
                fullWidth
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave}>
            Crear Molde
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default MoldesLista;
