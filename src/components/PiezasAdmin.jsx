import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import RestoreIcon from '@mui/icons-material/Restore';
import {
  actualizarPiezaGlobal,
  buscarPiezasGlobales,
  crearPiezaGlobal,
  obtenerFamilias,
  obtenerLineas,
} from '../services/api';
import DataTableToolbar from './ui/DataTableToolbar';
import PageHeader from './ui/PageHeader';
import CreateOptionAutocomplete from './ui/CreateOptionAutocomplete';
import ClassificationQuickCreateDialog from './ui/ClassificationQuickCreateDialog';
import { matchesOmniSearch } from '../utils/tableSearch';

const emptyForm = {
  codigo: '',
  nombre: '',
  peso_nominal_gr: '',
  linea_id: '',
  familia_id: '',
  activo: true,
  version: 1,
};

const catalogName = (items, id) => items.find((item) => item.id === id)?.nombre || 'Sin asignar';

function PiezasAdmin() {
  const [piezas, setPiezas] = useState([]);
  const [lineas, setLineas] = useState([]);
  const [familias, setFamilias] = useState([]);
  const [familiasLinea, setFamiliasLinea] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPieza, setEditingPieza] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVAS');
  const [classificationDialog, setClassificationDialog] = useState({
    open: false,
    entity: 'linea',
    initialName: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pieceData, lineData, familyData] = await Promise.all([
        buscarPiezasGlobales(),
        obtenerLineas(),
        obtenerFamilias(),
      ]);
      setPiezas(pieceData);
      setLineas(lineData);
      setFamilias(familyData);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cargar el maestro de piezas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    let active = true;
    if (!dialogOpen || !formData.linea_id) {
      return () => { active = false; };
    }

    obtenerFamilias({ linea_id: formData.linea_id })
      .then((items) => {
        if (!active) return;
        setFamiliasLinea(items);
        setFormData((current) => (
          current.familia_id && !items.some((familia) => familia.id === current.familia_id)
            ? { ...current, familia_id: '' }
            : current
        ));
      })
      .catch(() => {
        if (active) setFamiliasLinea([]);
      });

    return () => { active = false; };
  }, [dialogOpen, formData.linea_id]);

  const visiblePiezas = useMemo(() => piezas.filter((pieza) => {
    const matchesStatus = statusFilter === 'TODAS'
      || (statusFilter === 'ACTIVAS' && pieza.activo !== false)
      || (statusFilter === 'INACTIVAS' && pieza.activo === false);
    return matchesStatus && matchesOmniSearch(pieza, search);
  }), [piezas, search, statusFilter]);

  const openCreate = () => {
    setEditingPieza(null);
    setFormData(emptyForm);
    setFamiliasLinea([]);
    setDialogOpen(true);
  };

  const openEdit = (pieza) => {
    setEditingPieza(pieza);
    setFamiliasLinea([]);
    setFormData({
      codigo: pieza.codigo || '',
      nombre: pieza.nombre || '',
      peso_nominal_gr: pieza.peso_nominal_gr ?? '',
      linea_id: pieza.linea_id ?? '',
      familia_id: pieza.familia_id ?? '',
      activo: pieza.activo !== false,
      version: pieza.version || 1,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    setEditingPieza(null);
  };

  const abrirAltaClasificacion = (entity, initialName = '') => {
    if (entity === 'familia' && !formData.linea_id) return;
    setClassificationDialog({ open: true, entity, initialName });
  };

  const registrarClasificacionCreada = (created) => {
    if (classificationDialog.entity === 'linea') {
      setLineas((current) => (
        current.some((item) => item.id === created.id) ? current : [...current, created]
      ));
      setFamiliasLinea([]);
      setFormData((current) => ({ ...current, linea_id: created.id, familia_id: '' }));
      return;
    }

    setFamilias((current) => (
      current.some((item) => item.id === created.id) ? current : [...current, created]
    ));
    setFamiliasLinea((current) => (
      current.some((item) => item.id === created.id) ? current : [...current, created]
    ));
    setFormData((current) => ({ ...current, familia_id: created.id }));
  };

  const handleSubmit = async () => {
    const nombre = formData.nombre.trim();
    const pesoNominal = Number(formData.peso_nominal_gr);
    if (!nombre || !Number.isFinite(pesoNominal) || pesoNominal <= 0) {
      setError('El nombre y un peso nominal mayor que cero son obligatorios.');
      return;
    }

    const payload = {
      nombre,
      peso_nominal_gr: pesoNominal,
      linea_id: formData.linea_id || null,
      familia_id: formData.familia_id || null,
      activo: formData.activo,
      version: formData.version,
    };

    try {
      setSaving(true);
      if (editingPieza) {
        await actualizarPiezaGlobal(editingPieza.id, payload);
      } else {
        await crearPiezaGlobal(payload);
      }
      setDialogOpen(false);
      setEditingPieza(null);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar la pieza.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (pieza) => {
    const nextActive = pieza.activo === false;
    const action = nextActive ? 'reactivar' : 'desactivar';
    if (!window.confirm(`¿Desea ${action} la pieza ${pieza.codigo}?`)) return;

    try {
      await actualizarPiezaGlobal(pieza.id, {
        activo: nextActive,
        version: pieza.version || 1,
      });
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || `No se pudo ${action} la pieza.`);
    }
  };

  if (loading && piezas.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ mb: 2 }}>
        <PageHeader
          eyebrow="Datos maestros"
          title="Piezas"
          description="Maestro global de formas, independiente de moldes y colores. Las cavidades y el peso operativo se configuran dentro de cada molde."
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <DataTableToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar código, nombre o molde asociado"
        filters={[{
          id: 'estado',
          label: 'Estado',
          value: statusFilter,
          onChange: setStatusFilter,
          options: [
            { value: 'ACTIVAS', label: 'Activas' },
            { value: 'INACTIVAS', label: 'Inactivas' },
            { value: 'TODAS', label: 'Todas' },
          ],
        }]}
        resultCount={visiblePiezas.length}
        totalCount={piezas.length}
        onClear={() => {
          setSearch('');
          setStatusFilter('ACTIVAS');
        }}
        actions={(
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Nueva pieza
          </Button>
        )}
        sx={{ mb: 2 }}
      />

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Código</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>Línea / familia</TableCell>
              <TableCell align="right">Peso nominal (g)</TableCell>
              <TableCell>Moldes asociados</TableCell>
              <TableCell align="right">Variantes</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visiblePiezas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No hay piezas para los filtros seleccionados.</Typography>
                </TableCell>
              </TableRow>
            ) : visiblePiezas.map((pieza) => (
              <TableRow key={pieza.id} hover sx={{ opacity: pieza.activo === false ? 0.62 : 1 }}>
                <TableCell>
                  <Typography variant="body2" fontWeight={700}>{pieza.codigo}</Typography>
                </TableCell>
                <TableCell>{pieza.nombre}</TableCell>
                <TableCell>
                  <Typography variant="body2">{pieza.linea || catalogName(lineas, pieza.linea_id)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {pieza.familia || catalogName(familias, pieza.familia_id)}
                  </Typography>
                </TableCell>
                <TableCell align="right">{Number(pieza.peso_nominal_gr).toFixed(2)}</TableCell>
                <TableCell>
                  {(pieza.moldes || []).length === 0 ? (
                    <Typography variant="caption" color="text.secondary">Sin molde</Typography>
                  ) : (pieza.moldes || []).map((molde) => (
                    <Chip
                      key={molde.composicion_id || molde.molde_id}
                      size="small"
                      variant="outlined"
                      label={molde.molde_id}
                      title={molde.molde_nombre || molde.molde_id}
                      sx={{ mr: 0.5, mb: 0.5 }}
                    />
                  ))}
                </TableCell>
                <TableCell align="right">{pieza.variantes_count || 0}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={pieza.activo === false ? 'default' : 'success'}
                    label={pieza.activo === false ? 'Inactiva' : 'Activa'}
                  />
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="Editar maestro">
                    <IconButton aria-label={`Editar ${pieza.codigo}`} size="small" onClick={() => openEdit(pieza)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={pieza.activo === false ? 'Reactivar' : 'Desactivar'}>
                    <IconButton
                      aria-label={`${pieza.activo === false ? 'Reactivar' : 'Desactivar'} ${pieza.codigo}`}
                      size="small"
                      color={pieza.activo === false ? 'success' : 'warning'}
                      onClick={() => toggleActive(pieza)}
                    >
                      {pieza.activo === false ? <RestoreIcon fontSize="small" /> : <LinkOffIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingPieza ? 'Editar pieza' : 'Nueva pieza'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label="Código estable"
              value={editingPieza ? formData.codigo : 'Se asignará automáticamente al guardar'}
              helperText={editingPieza ? 'Identificador inmutable.' : 'El backend asignará el siguiente correlativo disponible.'}
              slotProps={{ input: { readOnly: true } }}
              fullWidth
            />
            <TextField
              label="Nombre"
              value={formData.nombre}
              onChange={(event) => setFormData({ ...formData, nombre: event.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Peso nominal (g)"
              type="number"
              value={formData.peso_nominal_gr}
              onChange={(event) => setFormData({ ...formData, peso_nominal_gr: event.target.value })}
              inputProps={{ min: 0.001, step: 0.001 }}
              helperText="Referencia del maestro; cada molde puede tener un peso operativo distinto."
              required
              fullWidth
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <CreateOptionAutocomplete
                options={lineas}
                value={lineas.find((linea) => linea.id === formData.linea_id) || null}
                onChange={(selected) => {
                  setFamiliasLinea([]);
                  setFormData((current) => ({
                    ...current,
                    linea_id: selected?.id || '',
                    familia_id: '',
                  }));
                }}
                onCreateOption={(initialName) => abrirAltaClasificacion('linea', initialName)}
                getOptionLabel={(option) => option.nombre}
                createLabel={(inputValue) => (
                  inputValue ? `Crear Línea “${inputValue}”…` : 'Crear nueva Línea…'
                )}
                label="Línea"
                helperText="Opcional; si la informas, selecciona también una Familia asociada."
              />
              <CreateOptionAutocomplete
                options={familiasLinea}
                value={familiasLinea.find((familia) => familia.id === formData.familia_id) || null}
                onChange={(selected) => setFormData((current) => ({
                  ...current,
                  familia_id: selected?.id || '',
                }))}
                onCreateOption={(initialName) => abrirAltaClasificacion('familia', initialName)}
                getOptionLabel={(option) => option.nombre}
                createLabel={(inputValue) => (
                  inputValue ? `Crear Familia “${inputValue}”…` : 'Crear nueva Familia en esta Línea…'
                )}
                label="Familia"
                disabled={!formData.linea_id}
                helperText={formData.linea_id
                  ? 'Solo Familias asociadas a la Línea.'
                  : 'Selecciona una Línea para elegir o crear su Familia.'}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={saving}>Cancelar</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando…' : editingPieza ? 'Guardar cambios' : 'Crear pieza'}
          </Button>
        </DialogActions>
      </Dialog>
      <ClassificationQuickCreateDialog
        open={classificationDialog.open}
        entity={classificationDialog.entity}
        linea={lineas.find((linea) => linea.id === formData.linea_id) || null}
        initialName={classificationDialog.initialName}
        onClose={() => setClassificationDialog((current) => ({ ...current, open: false }))}
        onCreated={registrarClasificacionCreada}
      />
    </Box>
  );
}

export default PiezasAdmin;
