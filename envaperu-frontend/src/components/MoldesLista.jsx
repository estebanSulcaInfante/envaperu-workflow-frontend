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
import Autocomplete from '@mui/material/Autocomplete';
import Grid from '@mui/material/Grid';
import { obtenerMoldes, crearMolde, actualizarMolde, eliminarMolde, buscarPiezas } from '../services/api';

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
    notas: '',
    // Simple Mode Fields (for when no piezas are linked)
    cavidades: 1,
    peso_unitario_gr: 0,
    // Advanced Mode: Linked Piezas
    piezas_vinculadas: [] // Array of { pieza_sku, pieza_nombre, cavidades, peso_unitario_gr }
  });
  
  // State for Pieza Autocomplete
  const [piezaSearch, setPiezaSearch] = useState('');
  const [piezasOptions, setPiezasOptions] = useState([]);
  const [piezasLoading, setPiezasLoading] = useState(false);

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
      
      // Try to get first piece for defaults
      const firstPiece = molde.piezas && molde.piezas.length > 0 ? molde.piezas[0] : null;
      
      setFormData({
        codigo: molde.codigo,
        nombre: molde.nombre,
        peso_tiro_gr: molde.peso_tiro_gr,
        tiempo_ciclo_std: molde.tiempo_ciclo_std,
        notas: molde.notas || '',
        cavidades: firstPiece ? firstPiece.cavidades : 1,
        peso_unitario_gr: firstPiece ? firstPiece.peso_unitario_gr : 0,
        piezas_vinculadas: molde.piezas ? molde.piezas.map(p => ({
          pieza_sku: p.pieza_sku,
          pieza_nombre: p.pieza_nombre || p.pieza_sku,
          cavidades: p.cavidades,
          peso_unitario_gr: p.peso_unitario_gr
        })) : []
      });
    } else {
      setEditingMolde(null);
      setFormData({
        codigo: '',
        nombre: '',
        peso_tiro_gr: '',
        tiempo_ciclo_std: 30,
        notas: '',
        cavidades: 1,
        peso_unitario_gr: 0,
        piezas_vinculadas: []
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
        tiempo_ciclo_std: parseFloat(formData.tiempo_ciclo_std),
        // Pass simple mode fields
        cavidades: parseInt(formData.cavidades),
        peso_unitario_gr: parseFloat(formData.peso_unitario_gr)
      };
      
      // If we have linked piezas, send them; otherwise backend uses simple mode
      if (formData.piezas_vinculadas && formData.piezas_vinculadas.length > 0) {
        data.piezas = formData.piezas_vinculadas.map(p => ({
          pieza_sku: p.pieza_sku,
          cavidades: parseInt(p.cavidades),
          peso_unitario_gr: parseFloat(p.peso_unitario_gr)
        }));
      }
      
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
            {/* Simple Mode Inputs */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Cavidades"
                type="number"
                value={formData.cavidades}
                onChange={(e) => setFormData({ ...formData, cavidades: e.target.value })}
                fullWidth
              />
              <TextField
                label="Peso Unitario (g)"
                type="number"
                value={formData.peso_unitario_gr}
                onChange={(e) => setFormData({ ...formData, peso_unitario_gr: e.target.value })}
                helperText="Peso de 1 pieza limipia"
                fullWidth
              />
            </Box>
            
            {/* Advanced Mode: Linked Piezas */}
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
              Piezas Vinculadas ({formData.piezas_vinculadas?.length || 0})
            </Typography>
            <Autocomplete
              options={piezasOptions}
              getOptionLabel={(option) => `${option.piezas || option.sku} (${option.sku})`}
              loading={piezasLoading}
              inputValue={piezaSearch}
              onInputChange={(_, value) => {
                setPiezaSearch(value);
                if (value.length >= 2) {
                  setPiezasLoading(true);
                  buscarPiezas(value).then(data => {
                    setPiezasOptions(data);
                  }).finally(() => setPiezasLoading(false));
                }
              }}
              onChange={(_, newValue) => {
                if (newValue) {
                  // Add pieza to linked list if not already there
                  const existing = formData.piezas_vinculadas.find(p => p.pieza_sku === newValue.sku);
                  if (!existing) {
                    setFormData(prev => ({
                      ...prev,
                      piezas_vinculadas: [...prev.piezas_vinculadas, {
                        pieza_sku: newValue.sku,
                        pieza_nombre: newValue.piezas || newValue.sku,
                        cavidades: newValue.cavidad || 1,
                        peso_unitario_gr: newValue.peso || 0
                      }]
                    }));
                  }
                  setPiezaSearch('');
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Buscar Pieza para vincular"
                  placeholder="Escribe nombre o SKU..."
                  size="small"
                  helperText="Busca y agrega piezas del catálogo"
                />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option.sku}>
                  <Box>
                    <Typography variant="body2">{option.piezas}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.sku} | {option.color || 'Sin color'} | {option.peso}g
                    </Typography>
                  </Box>
                </li>
              )}
              filterOptions={(x) => x} // Server-side filtering
              sx={{ mb: 1 }}
            />
            
            {/* List of linked piezas */}
            {formData.piezas_vinculadas?.map((pieza, idx) => (
              <Box key={pieza.pieza_sku} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="body2" sx={{ flex: 1 }}>{pieza.pieza_nombre}</Typography>
                <TextField
                  label="Cav."
                  type="number"
                  size="small"
                  value={pieza.cavidades}
                  onChange={(e) => {
                    const updated = [...formData.piezas_vinculadas];
                    updated[idx].cavidades = e.target.value;
                    setFormData(prev => ({ ...prev, piezas_vinculadas: updated }));
                  }}
                  sx={{ width: 70 }}
                />
                <TextField
                  label="Peso (g)"
                  type="number"
                  size="small"
                  value={pieza.peso_unitario_gr}
                  onChange={(e) => {
                    const updated = [...formData.piezas_vinculadas];
                    updated[idx].peso_unitario_gr = e.target.value;
                    setFormData(prev => ({ ...prev, piezas_vinculadas: updated }));
                  }}
                  sx={{ width: 90 }}
                />
                <IconButton size="small" color="error" onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    piezas_vinculadas: prev.piezas_vinculadas.filter((_, i) => i !== idx)
                  }));
                }}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
            
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
