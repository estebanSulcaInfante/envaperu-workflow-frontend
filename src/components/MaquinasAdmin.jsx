import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
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
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import { getMaquinas, createMaquina, updateMaquina, getTiposMaquina, toggleEstadoMaquina } from '../services/api';

function MaquinasAdmin() {
  const [maquinas, setMaquinas] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Formulario
  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    tipo_maquina_id: '',
    estado: 'OPERATIVA',
    numero_serie: '',
    observaciones: '',
    activo: true
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [maqRes, tiposRes] = await Promise.all([
        getMaquinas(),
        getTiposMaquina()
      ]);
      setMaquinas(maqRes);
      setTipos(tiposRes);
    } catch (err) {
      setError('Error cargando datos de máquinas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenNew = () => {
    setEditingId(null);
    setFormData({
      codigo: '',
      nombre: '',
      tipo_maquina_id: tipos.length > 0 ? tipos[0].id : '',
      estado: 'OPERATIVA',
      numero_serie: '',
      observaciones: '',
      activo: true
    });
    setOpenDialog(true);
  };

  const handleOpenEdit = (maquina) => {
    setEditingId(maquina.id);
    setFormData({
      codigo: maquina.codigo || '',
      nombre: maquina.nombre || '',
      tipo_maquina_id: maquina.tipo_maquina_id || '',
      estado: maquina.estado || 'OPERATIVA',
      numero_serie: maquina.numero_serie || '',
      observaciones: maquina.observaciones || '',
      activo: maquina.activo
    });
    setOpenDialog(true);
  };

  const handleClose = () => {
    setOpenDialog(false);
    setError(null);
  };

  const handleSave = async () => {
    try {
      if (editingId) {
        await updateMaquina(editingId, formData);
      } else {
        await createMaquina(formData);
      }
      handleClose();
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Error guardando máquina');
    }
  };

  const handleChangeEstado = async (id, nuevoEstado) => {
    try {
      await toggleEstadoMaquina(id, nuevoEstado);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Error cambiando estado');
    }
  };

  if (loading && maquinas.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  const getEstadoColor = (estado) => {
    switch(estado) {
      case 'OPERATIVA': return 'success';
      case 'MANTENIMIENTO': return 'warning';
      case 'FUERA_SERVICIO': return 'error';
      case 'BAJA': return 'default';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" fontWeight={600}>
          <PrecisionManufacturingIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Catálogo de Máquinas
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenNew}
          sx={{ bgcolor: '#1E3A5F' }}
        >
          Nueva Máquina
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead sx={{ bgcolor: '#1E3A5F' }}>
            <TableRow>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>Código</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>Nombre</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>Tipo</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>Nro. Serie</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }} align="center">Estado Físico</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }} align="center">Visible</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }} align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {maquinas.map((m) => (
              <TableRow key={m.id} hover>
                <TableCell>{m.codigo}</TableCell>
                <TableCell>{m.nombre}</TableCell>
                <TableCell>{m.tipo_maquina?.nombre || m.tipo}</TableCell>
                <TableCell>{m.numero_serie}</TableCell>
                <TableCell align="center">
                  <Select
                    value={m.estado}
                    size="small"
                    onChange={(e) => handleChangeEstado(m.id, e.target.value)}
                    sx={{
                      minWidth: 140,
                      '.MuiOutlinedInput-notchedOutline': { border: 'none' },
                      bgcolor: (theme) => theme.palette[getEstadoColor(m.estado)].light,
                      color: (theme) => theme.palette[getEstadoColor(m.estado)].main,
                      fontWeight: 'bold',
                      borderRadius: 1
                    }}
                  >
                    <MenuItem value="OPERATIVA">OPERATIVA</MenuItem>
                    <MenuItem value="MANTENIMIENTO">MANTENIMIENTO</MenuItem>
                    <MenuItem value="FUERA_SERVICIO">FUERA SERVICIO</MenuItem>
                    <MenuItem value="BAJA">BAJA</MenuItem>
                  </Select>
                </TableCell>
                <TableCell align="center">
                  <Switch
                    checked={m.activo}
                    onChange={(e) => {
                      updateMaquina(m.id, { ...m, activo: e.target.checked })
                        .then(() => fetchData())
                        .catch(err => alert(err.response?.data?.error || 'Error'));
                    }}
                    color="primary"
                    size="small"
                  />
                </TableCell>
                <TableCell align="center">
                  <IconButton color="primary" onClick={() => handleOpenEdit(m)} size="small">
                    <EditIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {maquinas.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                  No hay máquinas registradas
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* DIALOG FORM */}
      <Dialog open={openDialog} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingId ? 'Editar Máquina' : 'Nueva Máquina'}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Código"
              value={formData.codigo}
              onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
              fullWidth
              helperText="Dejar en blanco para autogenerar"
            />
            <TextField
              label="Nombre"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              fullWidth
              required
            />
            
            <FormControl fullWidth required>
              <InputLabel>Tipo de Máquina</InputLabel>
              <Select
                value={formData.tipo_maquina_id}
                onChange={(e) => setFormData({ ...formData, tipo_maquina_id: e.target.value })}
                label="Tipo de Máquina"
              >
                {tipos.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.nombre} ({t.proceso})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth required>
              <InputLabel>Estado Físico</InputLabel>
              <Select
                value={formData.estado}
                onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                label="Estado Físico"
              >
                <MenuItem value="OPERATIVA">OPERATIVA</MenuItem>
                <MenuItem value="MANTENIMIENTO">MANTENIMIENTO</MenuItem>
                <MenuItem value="FUERA_SERVICIO">FUERA SERVICIO</MenuItem>
                <MenuItem value="BAJA">BAJA</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Número de Serie"
              value={formData.numero_serie}
              onChange={(e) => setFormData({ ...formData, numero_serie: e.target.value })}
              fullWidth
            />

            <TextField
              label="Observaciones"
              value={formData.observaciones}
              onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={formData.activo}
                  onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                  color="success"
                />
              }
              label="Activa (Visible en listas)"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSave} variant="contained" sx={{ bgcolor: '#1E3A5F' }}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default MaquinasAdmin;
