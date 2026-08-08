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
import SettingsIcon from '@mui/icons-material/Settings';
import {
  getMaquinas,
  createMaquina,
  updateMaquina,
  getTiposMaquina,
  createTipoMaquina,
  updateTipoMaquina,
  deactivateTipoMaquina,
  toggleEstadoMaquina,
} from '../services/api';
import DataTableToolbar from './ui/DataTableToolbar';
import PageHeader from './ui/PageHeader';
import { matchesOmniSearch } from '../utils/tableSearch';

function MaquinasAdmin() {
  const [maquinas, setMaquinas] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('TODOS');
  const [physicalStatus, setPhysicalStatus] = useState('TODOS');
  const [visibility, setVisibility] = useState('TODOS');
  const [typesDialogOpen, setTypesDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [typeForm, setTypeForm] = useState({ nombre: '', proceso: 'INYECCION', fabricante: '', modelo: '', capacidad_toneladas: '' });
  const [typeError, setTypeError] = useState('');

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
        getTiposMaquina({ include_inactive: true })
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

  const resetTypeForm = () => {
    setEditingType(null);
    setTypeForm({ nombre: '', proceso: 'INYECCION', fabricante: '', modelo: '', capacidad_toneladas: '' });
    setTypeError('');
  };

  const editType = (item) => {
    setEditingType(item);
    setTypeForm({
      nombre: item.nombre || '',
      proceso: item.proceso || 'INYECCION',
      fabricante: item.fabricante || '',
      modelo: item.modelo || '',
      capacidad_toneladas: item.capacidad_toneladas ?? '',
    });
    setTypeError('');
  };

  const saveType = async () => {
    if (!typeForm.nombre.trim()) {
      setTypeError('El nombre es obligatorio.');
      return;
    }
    const values = {
      nombre: typeForm.nombre.trim(),
      proceso: typeForm.proceso,
      fabricante: typeForm.fabricante.trim() || null,
      modelo: typeForm.modelo.trim() || null,
      capacidad_toneladas: typeForm.capacidad_toneladas === '' ? null : Number(typeForm.capacidad_toneladas),
    };
    try {
      if (editingType) await updateTipoMaquina(editingType.id, { ...values, version: editingType.version });
      else await createTipoMaquina(values);
      resetTypeForm();
      await fetchData();
    } catch (err) {
      setTypeError(err.response?.data?.error || 'No se pudo guardar el tipo de máquina.');
    }
  };

  const toggleType = async (item) => {
    try {
      if (item.activo) await deactivateTipoMaquina(item.id, item.version);
      else await updateTipoMaquina(item.id, { version: item.version, activo: true });
      await fetchData();
    } catch (err) {
      setTypeError(err.response?.data?.error || 'No se pudo cambiar el estado del tipo.');
    }
  };

  const handleSave = async () => {
    try {
      if (editingId) {
        await updateMaquina(editingId, formData);
      } else {
        const payload = { ...formData };
        delete payload.codigo;
        await createMaquina(payload);
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

  const typeOptions = tipos.filter((type) => type.activo !== false).map((type) => ({
    value: String(type.id),
    label: type.nombre,
  }));
  const visibleMachines = maquinas.filter((machine) => {
    const matchesType = typeFilter === 'TODOS'
      || String(machine.tipo_maquina_id) === typeFilter;
    const matchesPhysicalStatus = physicalStatus === 'TODOS'
      || machine.estado === physicalStatus;
    const matchesVisibility = visibility === 'TODOS'
      || (visibility === 'VISIBLES' && machine.activo)
      || (visibility === 'OCULTAS' && !machine.activo);

    return matchesType
      && matchesPhysicalStatus
      && matchesVisibility
      && matchesOmniSearch(machine, search);
  });

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <PageHeader
          title="Máquinas"
          description="Equipos de planta, tipo de proceso, estado físico y disponibilidad en formularios."
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <DataTableToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar código, máquina, tipo o serie"
        resultCount={visibleMachines.length}
        totalCount={maquinas.length}
        filters={[
          {
            id: 'type',
            label: 'Tipo',
            value: typeFilter,
            onChange: setTypeFilter,
            options: [{ value: 'TODOS', label: 'Todos' }, ...typeOptions],
          },
          {
            id: 'physicalStatus',
            label: 'Estado físico',
            value: physicalStatus,
            onChange: setPhysicalStatus,
            options: [
              { value: 'TODOS', label: 'Todos' },
              { value: 'OPERATIVA', label: 'Operativa' },
              { value: 'MANTENIMIENTO', label: 'Mantenimiento' },
              { value: 'FUERA_SERVICIO', label: 'Fuera de servicio' },
              { value: 'BAJA', label: 'Baja' },
            ],
          },
          {
            id: 'visibility',
            label: 'Visibilidad',
            value: visibility,
            onChange: setVisibility,
            options: [
              { value: 'TODOS', label: 'Todas' },
              { value: 'VISIBLES', label: 'Visibles' },
              { value: 'OCULTAS', label: 'Ocultas' },
            ],
          },
        ]}
        onClear={() => {
          setSearch('');
          setTypeFilter('TODOS');
          setPhysicalStatus('TODOS');
          setVisibility('TODOS');
        }}
        actions={(<Box sx={{ display: 'flex', gap: 1 }}><Button variant="outlined" startIcon={<SettingsIcon />} onClick={() => setTypesDialogOpen(true)}>Tipos</Button><Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenNew}>Nueva máquina</Button></Box>)}
      />

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Código</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Nro. serie</TableCell>
              <TableCell align="center">Estado físico</TableCell>
              <TableCell align="center">Visible</TableCell>
              <TableCell align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleMachines.map((m) => (
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
            {visibleMachines.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                  No hay máquinas que coincidan con los filtros
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
              label="Código automático"
              value={editingId ? formData.codigo : 'MAQ-######'}
              fullWidth
              disabled
              helperText={editingId ? 'Código interno inmutable' : 'Se asignará al guardar'}
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
                {tipos.filter((t) => t.activo !== false || t.id === formData.tipo_maquina_id).map((t) => (
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

      <Dialog open={typesDialogOpen} onClose={() => setTypesDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Tipos de máquina</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {typeError && <Alert severity="error">{typeError}</Alert>}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr 1fr 1fr' }, gap: 1 }}>
              <TextField label="Código automático" value={editingType ? editingType.codigo : 'TMQ-######'} disabled helperText="Código inmutable" />
              <TextField label="Nombre" value={typeForm.nombre} onChange={(event) => setTypeForm((current) => ({ ...current, nombre: event.target.value }))} />
              <TextField select label="Proceso" value={typeForm.proceso} onChange={(event) => setTypeForm((current) => ({ ...current, proceso: event.target.value }))}><MenuItem value="INYECCION">Inyección</MenuItem><MenuItem value="SOPLADO">Soplado</MenuItem><MenuItem value="OTRO">Otro</MenuItem></TextField>
              <Button variant="contained" onClick={saveType}>{editingType ? 'Guardar' : 'Crear'}</Button>
              <TextField label="Fabricante" value={typeForm.fabricante} onChange={(event) => setTypeForm((current) => ({ ...current, fabricante: event.target.value }))} />
              <TextField label="Modelo" value={typeForm.modelo} onChange={(event) => setTypeForm((current) => ({ ...current, modelo: event.target.value }))} />
              <TextField type="number" label="Capacidad (t)" value={typeForm.capacidad_toneladas} onChange={(event) => setTypeForm((current) => ({ ...current, capacidad_toneladas: event.target.value }))} />
              {editingType && <Button onClick={resetTypeForm}>Cancelar edición</Button>}
            </Box>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 340 }}><Table size="small" stickyHeader><TableHead><TableRow><TableCell>Código</TableCell><TableCell>Tipo</TableCell><TableCell>Proceso</TableCell><TableCell>Estado</TableCell><TableCell align="right">Acciones</TableCell></TableRow></TableHead><TableBody>{tipos.map((item) => <TableRow key={item.id}><TableCell>{item.codigo}</TableCell><TableCell>{item.nombre}</TableCell><TableCell>{item.proceso}</TableCell><TableCell><Chip size="small" label={item.activo === false ? 'INACTIVO' : 'ACTIVO'} color={item.activo === false ? 'default' : 'success'} variant="outlined" /></TableCell><TableCell align="right"><Button size="small" onClick={() => editType(item)}>Editar</Button><Button size="small" color={item.activo ? 'error' : 'success'} onClick={() => toggleType(item)}>{item.activo ? 'Inactivar' : 'Reactivar'}</Button></TableCell></TableRow>)}</TableBody></Table></TableContainer>
          </Box>
        </DialogContent>
        <DialogActions><Button onClick={() => setTypesDialogOpen(false)}>Cerrar</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

export default MaquinasAdmin;
