import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Stack,
  Select,
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
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import {
  actualizarPiezaGlobal,
  buscarPiezasGlobales,
  cambiarEstadoPiezaColor,
  crearPiezaGlobal,
  eliminarImagenPiezaColor,
  guardarImagenPiezaColor,
  habilitarColorMolde,
  obtenerColores,
  obtenerFamilias,
  obtenerLineas,
} from '../services/api';
import DataTableToolbar from './ui/DataTableToolbar';
import PageHeader from './ui/PageHeader';
import CreateOptionAutocomplete from './ui/CreateOptionAutocomplete';
import ClassificationQuickCreateDialog from './ui/ClassificationQuickCreateDialog';
import { matchesOmniSearch } from '../utils/tableSearch';
import { useScmActor } from '../context/ScmActorContext';

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
  const { can, experience } = useScmActor();
  const canAdmin = can('ARTICULO_ADMINISTRAR');
  const [piezas, setPiezas] = useState([]);
  const [lineas, setLineas] = useState([]);
  const [familias, setFamilias] = useState([]);
  const [colores, setColores] = useState([]);
  const [familiasLinea, setFamiliasLinea] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPieza, setEditingPieza] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [expanded, setExpanded] = useState(() => new Set());
  const [colorDialog, setColorDialog] = useState({ open: false, pieza: null, moldeId: '', colorId: '' });
  const [imageDialog, setImageDialog] = useState({ open: false, variante: null });
  const [variantImageFile, setVariantImageFile] = useState(null);
  const [removeVariantImage, setRemoveVariantImage] = useState(false);
  const [attempted, setAttempted] = useState(false);
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
      const [pieceData, lineData, familyData, colorData] = await Promise.all([
        buscarPiezasGlobales('', 200, { includeInactiveVariants: true }),
        obtenerLineas(),
        obtenerFamilias(),
        obtenerColores(),
      ]);
      setPiezas(pieceData);
      setLineas(lineData);
      setFamilias(familyData);
      setColores(colorData);
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
    setAttempted(false);
    setFamiliasLinea([]);
    setDialogOpen(true);
  };

  const openEdit = (pieza) => {
    setEditingPieza(pieza);
    setAttempted(false);
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
    setAttempted(true);
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
      editingPieza
        ? await actualizarPiezaGlobal(editingPieza.id, payload)
        : await crearPiezaGlobal(payload);
      setDialogOpen(false);
      setEditingPieza(null);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar la pieza.');
    } finally {
      setSaving(false);
    }
  };

  const toggleExpanded = (piezaId) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(piezaId)) next.delete(piezaId);
      else next.add(piezaId);
      return next;
    });
  };

  const openColorDialog = (pieza) => {
    const moldes = pieza.moldes || [];
    setColorDialog({
      open: true,
      pieza,
      moldeId: moldes.length === 1 ? moldes[0].molde_id : '',
      colorId: '',
    });
  };

  const saveMoldColor = async () => {
    if (!colorDialog.moldeId || !colorDialog.colorId) return;
    setSaving(true);
    setError(null);
    try {
      await habilitarColorMolde(colorDialog.moldeId, Number(colorDialog.colorId));
      setColorDialog({ open: false, pieza: null, moldeId: '', colorId: '' });
      await fetchData();
      setExpanded((current) => new Set(current).add(colorDialog.pieza.id));
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo habilitar el color para el molde completo.');
    } finally {
      setSaving(false);
    }
  };

  const openVariantImage = (variante) => {
    setImageDialog({ open: true, variante });
    setVariantImageFile(null);
    setRemoveVariantImage(false);
  };

  const saveVariantImage = async () => {
    const variante = imageDialog.variante;
    if (!variante || (!variantImageFile && !removeVariantImage)) return;
    setSaving(true);
    setError(null);
    try {
      if (variantImageFile) await guardarImagenPiezaColor(variante.sku, variantImageFile);
      else if (removeVariantImage && variante.imagen_url) await eliminarImagenPiezaColor(variante.sku);
      setImageDialog({ open: false, variante: null });
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar la imagen del SKU.');
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

  const toggleVariantActive = async (pieza, variante) => {
    const nextActive = variante.activo === false;
    const action = nextActive ? 'reactivar' : 'desactivar';
    const confirmation = nextActive
      ? `¿Reactivar PiezaColor ${variante.sku}? Volverá a estar disponible para nuevas selecciones y planificaciones.`
      : `¿Desactivar PiezaColor ${variante.sku}? Se retirará de nuevas selecciones y planificaciones, pero conservará todo su historial.`;
    if (!window.confirm(confirmation)) return;

    try {
      setSaving(true);
      setError(null);
      await cambiarEstadoPiezaColor(
        variante.sku,
        nextActive,
        variante.version || 1,
      );
      await fetchData();
      setExpanded((current) => new Set(current).add(pieza.id));
    } catch (err) {
      setError(err.response?.data?.error || `No se pudo ${action} la PiezaColor.`);
    } finally {
      setSaving(false);
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
          title="Piezas"
          description="Maestro global de formas, independiente de moldes y colores. Las cavidades y el peso operativo se configuran dentro de cada molde."
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {!canAdmin && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Vista de consulta para {experience.label}. Las altas y cambios corresponden a
          Ingeniería o Configuración SCM.
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
        actions={canAdmin ? (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Nueva pieza
          </Button>
        ) : null}
        sx={{ mb: 2 }}
      />

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" />
              <TableCell>Código</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>Línea / familia</TableCell>
              <TableCell align="right">Peso nominal (g)</TableCell>
              <TableCell>Moldes asociados</TableCell>
              <TableCell align="right">Variantes</TableCell>
              <TableCell>Estado</TableCell>
              {canAdmin && <TableCell align="center">Acciones</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {visiblePiezas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canAdmin ? 9 : 8} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No hay piezas para los filtros seleccionados.</Typography>
                </TableCell>
              </TableRow>
            ) : visiblePiezas.map((pieza) => (
              <Fragment key={pieza.id}>
                <TableRow hover sx={{ opacity: pieza.activo === false ? 0.62 : 1 }}>
                  <TableCell padding="checkbox">
                    <IconButton
                      size="small"
                      aria-label={`${expanded.has(pieza.id) ? 'Ocultar' : 'Mostrar'} SKU de ${pieza.codigo}`}
                      onClick={() => toggleExpanded(pieza.id)}
                    >
                      {expanded.has(pieza.id) ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
                    </IconButton>
                  </TableCell>
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
                  <TableCell align="right">{(pieza.variantes || []).length}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={pieza.activo === false ? 'default' : 'success'}
                      label={pieza.activo === false ? 'Inactiva' : 'Activa'}
                    />
                  </TableCell>
                  {canAdmin && <TableCell align="center">
                    <Tooltip title="Habilitar color para todo el molde">
                      <span>
                        <IconButton
                          aria-label={`Habilitar color desde ${pieza.codigo}`}
                          size="small"
                          color="primary"
                          disabled={pieza.activo === false || (pieza.moldes || []).length === 0}
                          onClick={() => openColorDialog(pieza)}
                        >
                          <PaletteOutlinedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
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
                  </TableCell>}
                </TableRow>
                <TableRow>
                  <TableCell colSpan={canAdmin ? 9 : 8} sx={{ py: 0, bgcolor: 'grey.50' }}>
                    <Collapse in={expanded.has(pieza.id)} timeout="auto" unmountOnExit>
                      <Box sx={{ py: 1.5, pl: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                          SKU físicos por color
                        </Typography>
                        {(pieza.variantes || []).length === 0 ? (
                          <Alert severity="info">
                            Sin PiezaColor. Habilita un color en uno de sus moldes; se crearán todas las salidas del golpe.
                          </Alert>
                        ) : (
                          <Table size="small" aria-label={`SKU de ${pieza.codigo}`}>
                            <TableHead>
                              <TableRow>
                                <TableCell>Imagen</TableCell>
                                <TableCell>SKU</TableCell>
                                <TableCell>Variante</TableCell>
                                <TableCell>Color</TableCell>
                                <TableCell align="right">Peso (g)</TableCell>
                                <TableCell>Revisión</TableCell>
                                <TableCell>Estado</TableCell>
                                {canAdmin && <TableCell align="center">Acciones</TableCell>}
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {(pieza.variantes || []).map((variante) => (
                                <TableRow key={variante.sku} sx={{ opacity: variante.activo === false ? 0.62 : 1 }}>
                                  <TableCell>
                                    {variante.imagen_url ? (
                                      <Box component="img" src={variante.imagen_url} alt={`Imagen ${variante.sku}`} sx={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 1, border: '1px solid', borderColor: 'divider' }} />
                                    ) : <ImageOutlinedIcon color="disabled" />}
                                  </TableCell>
                                  <TableCell><Typography fontWeight={750}>{variante.sku}</Typography></TableCell>
                                  <TableCell>{variante.nombre}</TableCell>
                                  <TableCell>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                      <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: variante.color_hex || 'grey.300', border: '1px solid', borderColor: 'divider' }} />
                                      <Typography variant="body2">{variante.color || 'Sin color'}</Typography>
                                    </Stack>
                                  </TableCell>
                                  <TableCell align="right">{Number(variante.peso || pieza.peso_nominal_gr).toFixed(2)}</TableCell>
                                  <TableCell><Chip size="small" variant="outlined" label={variante.estado_revision || 'SIN REVISAR'} /></TableCell>
                                  <TableCell>
                                    <Chip
                                      size="small"
                                      color={variante.activo === false ? 'default' : 'success'}
                                      label={variante.activo === false ? 'Inactiva' : 'Activa'}
                                    />
                                  </TableCell>
                                  {canAdmin && <TableCell align="center">
                                    <Stack direction="row" spacing={0.5} justifyContent="center">
                                      <Button size="small" startIcon={<ImageOutlinedIcon />} onClick={() => openVariantImage(variante)}>
                                        Imagen
                                      </Button>
                                      <Tooltip title={variante.activo === false ? 'Reactivar PiezaColor' : 'Desactivar PiezaColor'}>
                                        <span>
                                          <IconButton
                                            aria-label={`${variante.activo === false ? 'Reactivar' : 'Desactivar'} PiezaColor ${variante.sku}`}
                                            size="small"
                                            color={variante.activo === false ? 'success' : 'warning'}
                                            disabled={saving}
                                            onClick={() => toggleVariantActive(pieza, variante)}
                                          >
                                            {variante.activo === false ? <RestoreIcon fontSize="small" /> : <LinkOffIcon fontSize="small" />}
                                          </IconButton>
                                        </span>
                                      </Tooltip>
                                    </Stack>
                                  </TableCell>}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {canAdmin && <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
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
              error={attempted && !formData.nombre.trim()}
              helperText={attempted && !formData.nombre.trim() ? 'El nombre es obligatorio.' : ''}
              fullWidth
            />
            <TextField
              label="Peso nominal (g)"
              type="number"
              value={formData.peso_nominal_gr}
              onChange={(event) => setFormData({ ...formData, peso_nominal_gr: event.target.value })}
              inputProps={{ min: 0.001, step: 0.001 }}
              helperText="Referencia del maestro; cada molde puede tener un peso operativo distinto."
              error={attempted && !(Number(formData.peso_nominal_gr) > 0)}
              required
              fullWidth
            />
            <Alert severity="info">
              Pieza representa una forma abstracta. Las fotografías se administran en cada SKU PiezaColor.
            </Alert>
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
      </Dialog>}
      {canAdmin && <Dialog
        open={colorDialog.open}
        onClose={() => !saving && setColorDialog({ open: false, pieza: null, moldeId: '', colorId: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Habilitar color en molde</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="warning">
              El color se aplicará al golpe completo. Se crearán o reutilizarán los SKU de todas las piezas activas del molde seleccionado.
            </Alert>
            <FormControl fullWidth required>
              <InputLabel id="mold-color-mold-label">Molde</InputLabel>
              <Select
                labelId="mold-color-mold-label"
                label="Molde"
                value={colorDialog.moldeId}
                onChange={(event) => setColorDialog((current) => ({ ...current, moldeId: event.target.value }))}
              >
                {(colorDialog.pieza?.moldes || []).map((molde) => (
                  <MenuItem key={molde.molde_id} value={molde.molde_id}>
                    {molde.molde_id} · {molde.molde_nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth required>
              <InputLabel id="mold-color-color-label">Color de producción</InputLabel>
              <Select
                labelId="mold-color-color-label"
                label="Color de producción"
                value={colorDialog.colorId}
                onChange={(event) => setColorDialog((current) => ({ ...current, colorId: event.target.value }))}
              >
                {colores.filter((color) => color.activo !== false).map((color) => (
                  <MenuItem key={color.id} value={color.id}>
                    {color.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setColorDialog({ open: false, pieza: null, moldeId: '', colorId: '' })} disabled={saving}>Cancelar</Button>
          <Button variant="contained" onClick={saveMoldColor} disabled={saving || !colorDialog.moldeId || !colorDialog.colorId}>
            {saving ? 'Habilitando…' : 'Habilitar para todo el molde'}
          </Button>
        </DialogActions>
      </Dialog>}
      {canAdmin && <Dialog
        open={imageDialog.open}
        onClose={() => !saving && setImageDialog({ open: false, variante: null })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Imagen de {imageDialog.variante?.sku || 'PiezaColor'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} alignItems="center">
            <Typography variant="body2" align="center">
              {imageDialog.variante?.nombre}<br />{imageDialog.variante?.color}
            </Typography>
            <Box
              component="img"
              src={variantImageFile
                ? URL.createObjectURL(variantImageFile)
                : (!removeVariantImage && imageDialog.variante?.imagen_url) || undefined}
              alt={`Vista previa ${imageDialog.variante?.sku || ''}`}
              sx={{ width: 180, height: 180, objectFit: 'contain', border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'grey.50' }}
            />
            <Button component="label" variant="outlined" startIcon={<ImageOutlinedIcon />}>
              {variantImageFile || imageDialog.variante?.imagen_url ? 'Cambiar imagen' : 'Seleccionar imagen'}
              <input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
                const file = event.target.files?.[0] || null;
                if (file && file.size > 2 * 1024 * 1024) {
                  setError('La imagen no puede superar 2 MB.');
                  return;
                }
                setVariantImageFile(file);
                setRemoveVariantImage(false);
              }} />
            </Button>
            {(variantImageFile || (!removeVariantImage && imageDialog.variante?.imagen_url)) && (
              <Button color="error" onClick={() => { setVariantImageFile(null); setRemoveVariantImage(true); }}>
                Quitar imagen
              </Button>
            )}
            <Typography variant="caption" color="text.secondary">JPG, PNG o WebP; máximo 2 MB.</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImageDialog({ open: false, variante: null })} disabled={saving}>Cancelar</Button>
          <Button variant="contained" onClick={saveVariantImage} disabled={saving || (!variantImageFile && !removeVariantImage)}>
            {saving ? 'Guardando…' : 'Guardar imagen'}
          </Button>
        </DialogActions>
      </Dialog>}
      {canAdmin && <ClassificationQuickCreateDialog
        open={classificationDialog.open}
        entity={classificationDialog.entity}
        linea={lineas.find((linea) => linea.id === formData.linea_id) || null}
        initialName={classificationDialog.initialName}
        onClose={() => setClassificationDialog((current) => ({ ...current, open: false }))}
        onCreated={registrarClasificacionCreada}
      />}
    </Box>
  );
}

export default PiezasAdmin;
