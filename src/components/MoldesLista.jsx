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
import { obtenerMoldes, crearMolde, eliminarMolde } from '../services/api';
import DataTableToolbar from './ui/DataTableToolbar';
import PageHeader from './ui/PageHeader';
import { matchesOmniSearch } from '../utils/tableSearch';

function MoldesLista() {
  const navigate = useNavigate();
  const [moldes, setMoldes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [configuration, setConfiguration] = useState('TODOS');
  
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

  const visibleMoldes = moldes.filter((molde) => {
    const hasForms = (molde.formas?.length || 0) > 0;
    const matchesConfiguration = configuration === 'TODOS'
      || (configuration === 'CONFIGURADOS' && hasForms)
      || (configuration === 'SIN_FORMAS' && !hasForms);

    return matchesConfiguration && matchesOmniSearch(molde, search);
  });

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <PageHeader
          eyebrow="Datos maestros"
          title="Moldes"
          description="Configuración física, cavidades y formas producidas por cada molde."
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <DataTableToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar código, molde, forma o cavidades"
        resultCount={visibleMoldes.length}
        totalCount={moldes.length}
        filters={[
          {
            id: 'configuration',
            label: 'Configuración',
            value: configuration,
            onChange: setConfiguration,
            options: [
              { value: 'TODOS', label: 'Todos' },
              { value: 'CONFIGURADOS', label: 'Con formas' },
              { value: 'SIN_FORMAS', label: 'Sin formas' },
            ],
          },
        ]}
        onClear={() => {
          setSearch('');
          setConfiguration('TODOS');
        }}
        actions={(
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenDialog}>
            Nuevo molde
          </Button>
        )}
      />

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Código</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell align="right">Peso Tiro (g)</TableCell>
              <TableCell align="right">Peso Neto (g)</TableCell>
              <TableCell align="right">Cavidades Totales</TableCell>
              <TableCell align="right">T. Ciclo (s)</TableCell>
              <TableCell>Formas</TableCell>
              <TableCell align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleMoldes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    No hay moldes que coincidan con los filtros.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              visibleMoldes.map((molde) => (
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
                      <IconButton size="small" onClick={() => navigate(`/datos-maestros/moldes/${molde.codigo}`)}>
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
