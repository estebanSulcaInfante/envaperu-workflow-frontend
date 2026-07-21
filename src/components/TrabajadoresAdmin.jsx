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
  MenuItem,
  OutlinedInput,
  Checkbox,
  ListItemText
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { getTrabajadores, createTrabajador, updateTrabajador, getRolesOperativos, toggleEstadoTrabajador } from '../services/api';
import DataTableToolbar from './ui/DataTableToolbar';
import PageHeader from './ui/PageHeader';
import { matchesOmniSearch } from '../utils/tableSearch';

function TrabajadoresAdmin() {
  const [trabajadores, setTrabajadores] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('TODOS');
  const [statusFilter, setStatusFilter] = useState('TODOS');

  // Formulario
  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    codigo: '',
    nombres: '',
    apellidos: '',
    nombre_corto: '',
    activo: true,
    roles_ids: [],
    observaciones: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [trabRes, rolesRes] = await Promise.all([
        getTrabajadores(),
        getRolesOperativos()
      ]);
      setTrabajadores(trabRes);
      setRoles(rolesRes);
    } catch (err) {
      setError('Error cargando datos de trabajadores');
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
      nombres: '',
      apellidos: '',
      nombre_corto: '',
      activo: true,
      roles_ids: [],
      observaciones: ''
    });
    setOpenDialog(true);
  };

  const handleOpenEdit = (trabajador) => {
    setEditingId(trabajador.id);
    setFormData({
      codigo: trabajador.codigo || '',
      nombres: trabajador.nombres || '',
      apellidos: trabajador.apellidos || '',
      nombre_corto: trabajador.nombre_corto || '',
      activo: trabajador.activo,
      roles_ids: trabajador.roles?.map(r => r.id) || [],
      observaciones: trabajador.observaciones || ''
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
        await updateTrabajador(editingId, formData);
      } else {
        await createTrabajador(formData);
      }
      handleClose();
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Error guardando trabajador');
    }
  };

  const handleToggleEstado = async (id, currentEstado) => {
    try {
      await toggleEstadoTrabajador(id, !currentEstado);
      fetchData();
    } catch {
      alert('Error cambiando estado');
    }
  };

  if (loading && trabajadores.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  const roleOptions = roles.map((role) => ({
    value: String(role.id),
    label: role.nombre,
  }));
  const visibleWorkers = trabajadores.filter((worker) => {
    const matchesRole = roleFilter === 'TODOS'
      || worker.roles?.some((role) => String(role.id) === roleFilter);
    const matchesStatus = statusFilter === 'TODOS'
      || (statusFilter === 'ACTIVOS' && worker.activo)
      || (statusFilter === 'INACTIVOS' && !worker.activo);

    return matchesRole && matchesStatus && matchesOmniSearch(worker, search);
  });

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <PageHeader
          eyebrow="Datos maestros"
          title="Trabajadores"
          description="Personas habilitadas y sus roles operativos de planta."
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <DataTableToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar código, nombre, apellido o rol"
        resultCount={visibleWorkers.length}
        totalCount={trabajadores.length}
        filters={[
          {
            id: 'role',
            label: 'Rol',
            value: roleFilter,
            onChange: setRoleFilter,
            options: [{ value: 'TODOS', label: 'Todos' }, ...roleOptions],
          },
          {
            id: 'status',
            label: 'Estado',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: 'TODOS', label: 'Todos' },
              { value: 'ACTIVOS', label: 'Activos' },
              { value: 'INACTIVOS', label: 'Inactivos' },
            ],
          },
        ]}
        onClear={() => {
          setSearch('');
          setRoleFilter('TODOS');
          setStatusFilter('TODOS');
        }}
        actions={(
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenNew}>
            Nuevo trabajador
          </Button>
        )}
      />

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Código</TableCell>
              <TableCell>Apellidos</TableCell>
              <TableCell>Nombres</TableCell>
              <TableCell>Nombre corto</TableCell>
              <TableCell>Roles</TableCell>
              <TableCell align="center">Estado</TableCell>
              <TableCell align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleWorkers.map((t) => (
              <TableRow key={t.id} hover>
                <TableCell>{t.codigo}</TableCell>
                <TableCell>{t.apellidos}</TableCell>
                <TableCell>{t.nombres}</TableCell>
                <TableCell>{t.nombre_corto}</TableCell>
                <TableCell>
                  {t.roles?.map(r => (
                    <Chip key={r.id} label={r.nombre} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                  ))}
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={t.activo ? 'Activo' : 'Inactivo'}
                    color={t.activo ? 'success' : 'default'}
                    size="small"
                    onClick={() => handleToggleEstado(t.id, t.activo)}
                    sx={{ cursor: 'pointer' }}
                  />
                </TableCell>
                <TableCell align="center">
                  <IconButton color="primary" onClick={() => handleOpenEdit(t)} size="small">
                    <EditIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {visibleWorkers.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                  No hay trabajadores que coincidan con los filtros
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* DIALOG FORM */}
      <Dialog open={openDialog} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingId ? 'Editar Trabajador' : 'Nuevo Trabajador'}
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
              label="Apellidos"
              value={formData.apellidos}
              onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Nombres"
              value={formData.nombres}
              onChange={(e) => setFormData({ ...formData, nombres: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Nombre Corto (Ej. Juan P.)"
              value={formData.nombre_corto}
              onChange={(e) => setFormData({ ...formData, nombre_corto: e.target.value })}
              fullWidth
            />
            
            <FormControl fullWidth>
              <InputLabel>Roles Operativos</InputLabel>
              <Select
                multiple
                value={formData.roles_ids}
                onChange={(e) => setFormData({ ...formData, roles_ids: e.target.value })}
                input={<OutlinedInput label="Roles Operativos" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => {
                      const rol = roles.find(r => r.id === value);
                      return <Chip key={value} label={rol ? rol.nombre : value} size="small" />;
                    })}
                  </Box>
                )}
              >
                {roles.map((rol) => (
                  <MenuItem key={rol.id} value={rol.id}>
                    <Checkbox checked={formData.roles_ids.indexOf(rol.id) > -1} />
                    <ListItemText primary={rol.nombre} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

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
              label="Activo"
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

export default TrabajadoresAdmin;
