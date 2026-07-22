import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PaletteIcon from '@mui/icons-material/Palette';
import SaveIcon from '@mui/icons-material/Save';
import {
  addColorForma,
  addFormaMolde,
  buscarPiezasGlobales,
  deleteForma,
  getMoldeDetalle,
  obtenerColores,
  obtenerFamilias,
  obtenerLineas,
  updateFormaMolde,
  updateMolde,
} from '../services/api';
import CreateOptionAutocomplete from './ui/CreateOptionAutocomplete';
import ColorQuickCreateDialog from './ui/ColorQuickCreateDialog';
import ClassificationQuickCreateDialog from './ui/ClassificationQuickCreateDialog';

const emptyAssociation = {
  mode: 'EXISTENTE',
  pieza_id: '',
  nombre: '',
  peso_nominal_gr: '',
  linea_id: '',
  familia_id: '',
  cavidades: 1,
  peso_unitario_gr: '',
};

const errorMessage = (error, fallback) => error.response?.data?.error || fallback;

function MoldeDetalle() {
  const { codigo } = useParams();
  const navigate = useNavigate();
  const [molde, setMolde] = useState(null);
  const [piezasGlobales, setPiezasGlobales] = useState([]);
  const [coloresDisponibles, setColoresDisponibles] = useState([]);
  const [lineas, setLineas] = useState([]);
  const [familiasLinea, setFamiliasLinea] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingMolde, setSavingMolde] = useState(false);
  const [savingAssociation, setSavingAssociation] = useState(false);
  const [error, setError] = useState(null);
  const [editMoldeData, setEditMoldeData] = useState({});

  const [openFormaDialog, setOpenFormaDialog] = useState(false);
  const [formaData, setFormaData] = useState(emptyAssociation);
  const [editingForma, setEditingForma] = useState(null);

  const [openColorDialog, setOpenColorDialog] = useState(false);
  const [selectedFormaId, setSelectedFormaId] = useState(null);
  const [selectedColorId, setSelectedColorId] = useState('');
  const [quickColorDialog, setQuickColorDialog] = useState({ open: false, initialName: '' });
  const [classificationDialog, setClassificationDialog] = useState({
    open: false,
    entity: 'linea',
    initialName: '',
  });

  const fetchMolde = useCallback(async () => {
    const data = await getMoldeDetalle(codigo);
    setMolde(data);
    setEditMoldeData({
      peso_tiro_gr: data.peso_tiro_gr ?? '',
      tiempo_ciclo_std: data.tiempo_ciclo_std ?? '',
    });
  }, [codigo]);

  const fetchReferenceData = useCallback(async () => {
    const [pieces, colors, lineItems] = await Promise.all([
      buscarPiezasGlobales(),
      obtenerColores(),
      obtenerLineas(),
    ]);
    setPiezasGlobales(pieces);
    setColoresDisponibles(colors);
    setLineas(lineItems);
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        await Promise.all([fetchMolde(), fetchReferenceData()]);
      } catch (err) {
        if (mounted) setError(errorMessage(err, 'No se pudo cargar el detalle del molde.'));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [fetchMolde, fetchReferenceData]);

  useEffect(() => {
    let active = true;
    if (!openFormaDialog || formaData.mode !== 'NUEVA' || !formaData.linea_id) {
      setFamiliasLinea([]);
      return () => { active = false; };
    }

    obtenerFamilias({ linea_id: formaData.linea_id })
      .then((items) => {
        if (!active) return;
        setFamiliasLinea(items);
        setFormaData((current) => (
          current.familia_id && !items.some(
            (familia) => String(familia.id) === String(current.familia_id)
          )
            ? { ...current, familia_id: '' }
            : current
        ));
      })
      .catch(() => {
        if (active) setFamiliasLinea([]);
      });

    return () => { active = false; };
  }, [formaData.linea_id, formaData.mode, openFormaDialog]);

  const associatedPieceIds = useMemo(
    () => new Set((molde?.formas || []).map((forma) => String(forma.pieza_id))),
    [molde],
  );

  const availablePieces = useMemo(
    () => piezasGlobales.filter((pieza) => pieza.activo !== false && !associatedPieceIds.has(String(pieza.id))),
    [associatedPieceIds, piezasGlobales],
  );

  const globalPieceFor = (forma) => piezasGlobales.find((pieza) => String(pieza.id) === String(forma.pieza_id));

  const refreshCatalog = async () => {
    await Promise.all([fetchMolde(), fetchReferenceData()]);
  };

  const handleSaveMolde = async () => {
    const pesoTiro = Number(editMoldeData.peso_tiro_gr);
    const ciclo = Number(editMoldeData.tiempo_ciclo_std);
    if (pesoTiro <= 0 || ciclo <= 0) {
      setError('El peso de tiro y el tiempo de ciclo deben ser mayores que cero.');
      return;
    }
    try {
      setSavingMolde(true);
      await updateMolde(codigo, { peso_tiro_gr: pesoTiro, tiempo_ciclo_std: ciclo });
      await fetchMolde();
    } catch (err) {
      setError(errorMessage(err, 'No se pudo actualizar el molde.'));
    } finally {
      setSavingMolde(false);
    }
  };

  const openCreateAssociation = () => {
    setEditingForma(null);
    setFormaData(emptyAssociation);
    setOpenFormaDialog(true);
  };

  const openEditAssociation = (forma) => {
    setEditingForma(forma);
    setFormaData({
      mode: 'EXISTENTE',
      pieza_id: forma.pieza_id,
      nombre: forma.nombre,
      peso_nominal_gr: globalPieceFor(forma)?.peso_nominal_gr ?? '',
      linea_id: globalPieceFor(forma)?.linea_id ?? '',
      familia_id: globalPieceFor(forma)?.familia_id ?? '',
      cavidades: forma.cavidades,
      peso_unitario_gr: forma.peso_unitario_gr,
    });
    setOpenFormaDialog(true);
  };

  const closeAssociationDialog = () => {
    if (savingAssociation) return;
    setOpenFormaDialog(false);
    setEditingForma(null);
  };

  const handleSaveAssociation = async () => {
    const cavidades = Number(formaData.cavidades);
    const pesoOperativo = Number(formaData.peso_unitario_gr);
    if (!Number.isInteger(cavidades) || cavidades <= 0 || pesoOperativo <= 0) {
      setError('Las cavidades deben ser un entero positivo y el peso operativo debe ser mayor que cero.');
      return;
    }

    let payload = {
      cavidades,
      peso_unitario_gr: pesoOperativo,
    };

    if (!editingForma && formaData.mode === 'EXISTENTE') {
      if (!formaData.pieza_id) {
        setError('Seleccione una pieza global para asociarla.');
        return;
      }
      payload.pieza_id = Number(formaData.pieza_id);
    }

    if (!editingForma && formaData.mode === 'NUEVA') {
      const nombre = formaData.nombre.trim();
      const pesoNominal = Number(formaData.peso_nominal_gr);
      if (!nombre || pesoNominal <= 0 || !formaData.linea_id || !formaData.familia_id) {
        setError('La nueva pieza requiere nombre, peso nominal, Línea y Familia.');
        return;
      }
      payload = {
        ...payload,
        nombre,
        peso_nominal_gr: pesoNominal,
        linea_id: Number(formaData.linea_id),
        familia_id: Number(formaData.familia_id),
      };
    }

    try {
      setSavingAssociation(true);
      if (editingForma) {
        await updateFormaMolde(editingForma.id, {
          ...payload,
          version: editingForma.version || 1,
        });
      } else {
        await addFormaMolde(codigo, payload);
      }
      setOpenFormaDialog(false);
      setEditingForma(null);
      await refreshCatalog();
    } catch (err) {
      setError(errorMessage(err, 'No se pudo guardar la composición del molde.'));
    } finally {
      setSavingAssociation(false);
    }
  };

  const handleDeleteForma = async (forma) => {
    const confirmed = window.confirm(
      `¿Desvincular ${forma.nombre} del molde ${codigo}? La pieza global y sus variantes de color se conservarán.`,
    );
    if (!confirmed) return;
    try {
      await deleteForma(forma.id);
      await refreshCatalog();
    } catch (err) {
      setError(errorMessage(err, 'No se pudo desvincular la pieza del molde.'));
    }
  };

  const openAddColor = (formaId) => {
    setSelectedFormaId(formaId);
    setSelectedColorId('');
    setOpenColorDialog(true);
  };

  const abrirAltaClasificacion = (entity, initialName = '') => {
    if (entity === 'familia' && !formaData.linea_id) return;
    setClassificationDialog({ open: true, entity, initialName });
  };

  const registrarClasificacionCreada = (created) => {
    if (classificationDialog.entity === 'linea') {
      setLineas((current) => (
        current.some((item) => item.id === created.id) ? current : [...current, created]
      ));
      setFamiliasLinea([]);
      setFormaData((current) => ({ ...current, linea_id: created.id, familia_id: '' }));
      return;
    }

    setFamiliasLinea((current) => (
      current.some((item) => item.id === created.id) ? current : [...current, created]
    ));
    setFormaData((current) => ({ ...current, familia_id: created.id }));
  };

  const handleAddColor = async () => {
    if (!selectedColorId) return;
    try {
      await addColorForma(selectedFormaId, selectedColorId);
      setOpenColorDialog(false);
      setSelectedColorId('');
      await refreshCatalog();
    } catch (err) {
      setError(errorMessage(err, 'No se pudo añadir la variante de color.'));
    }
  };

  const handleColorCreated = async (createdColor) => {
    let refreshedColors;
    try {
      refreshedColors = await obtenerColores();
    } catch (err) {
      console.error('El color se creó, pero no se pudo refrescar el catálogo:', err);
      refreshedColors = [...coloresDisponibles, createdColor];
    }

    const uniqueColors = Array.from(
      new Map([createdColor, ...refreshedColors].map((color) => [String(color.id), color])).values()
    ).sort((a, b) => a.nombre.localeCompare(b.nombre));
    setColoresDisponibles(uniqueColors);
    setSelectedColorId(createdColor.id);
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  if (!molde) return <Box sx={{ p: 3 }}><Alert severity="error">{error || 'Molde no encontrado.'}</Alert></Box>;

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton aria-label="Volver a moldes" onClick={() => navigate('/datos-maestros/moldes')}>
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="overline" color="text.secondary">Datos maestros / Moldes</Typography>
          <Typography variant="h4" fontWeight={800}>{molde.nombre}</Typography>
          <Typography color="text.secondary">{molde.codigo}</Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Paper sx={{ p: 3, mb: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <TextField
            label="Código del molde"
            value={molde.codigo}
            helperText="Identificador inmutable."
            slotProps={{ input: { readOnly: true } }}
            fullWidth
          />
          <TextField label="Nombre" value={molde.nombre} disabled fullWidth />
          <TextField
            label="Tiempo de ciclo estándar (s)"
            type="number"
            value={editMoldeData.tiempo_ciclo_std}
            onChange={(event) => setEditMoldeData({ ...editMoldeData, tiempo_ciclo_std: event.target.value })}
            inputProps={{ min: 0.001, step: 0.001 }}
            fullWidth
          />
          <TextField
            label="Peso de tiro (g)"
            type="number"
            value={editMoldeData.peso_tiro_gr}
            onChange={(event) => setEditMoldeData({ ...editMoldeData, peso_tiro_gr: event.target.value })}
            inputProps={{ min: 0.001, step: 0.001 }}
            fullWidth
          />
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSaveMolde}
            disabled={savingMolde}
            sx={{ minWidth: 180 }}
          >
            {savingMolde ? 'Guardando…' : 'Guardar molde'}
          </Button>
        </Stack>
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 2, alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Composición del molde</Typography>
          <Typography color="text.secondary">
            Cada fila vincula una pieza global con las cavidades y el peso operativo específicos de este molde.
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={openCreateAssociation}>
          Asociar pieza
        </Button>
      </Box>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }} useFlexGap flexWrap="wrap">
        <Chip label={`${molde.formas?.length || 0} piezas`} />
        <Chip label={`${molde.cavidades_totales || 0} cavidades`} />
        <Chip label={`${Number(molde.peso_neto_gr || 0).toFixed(2)} g netos/golpe`} />
      </Stack>

      {(!molde.formas || molde.formas.length === 0) ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography fontWeight={700}>Este molde todavía no tiene piezas asociadas.</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Seleccione una pieza existente o cree una nueva sin salir de esta vista.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateAssociation}>Asociar primera pieza</Button>
        </Paper>
      ) : molde.formas.map((forma) => {
        const globalPiece = globalPieceFor(forma);
        const canCreateVariant = Boolean(globalPiece?.linea_id && globalPiece?.familia_id);
        return (
          <Accordion key={forma.id} defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                  <Typography fontWeight={800}>{forma.nombre}</Typography>
                  <Chip size="small" variant="outlined" label={globalPiece?.codigo || `Pieza #${forma.pieza_id}`} />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {forma.cavidades} cavidades × {Number(forma.peso_unitario_gr).toFixed(2)} g = {Number(forma.peso_total_gr ?? forma.cavidades * forma.peso_unitario_gr).toFixed(2)} g/golpe
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end" sx={{ mb: 2 }}>
                <Button size="small" startIcon={<EditIcon />} onClick={() => openEditAssociation(forma)}>
                  Editar configuración
                </Button>
                <Tooltip title={canCreateVariant ? '' : 'Clasifique primero la pieza con Línea y Familia en el maestro de Piezas.'}>
                  <span>
                    <Button
                      size="small"
                      startIcon={<PaletteIcon />}
                      onClick={() => openAddColor(forma.id)}
                      disabled={!canCreateVariant}
                    >
                      Añadir color
                    </Button>
                  </span>
                </Tooltip>
                <Button size="small" color="warning" startIcon={<DeleteOutlineIcon />} onClick={() => handleDeleteForma(forma)}>
                  Desvincular
                </Button>
              </Stack>

              <Divider sx={{ mb: 2 }} />
              {(!forma.variantes || forma.variantes.length === 0) ? (
                <Typography variant="body2" color="text.secondary">
                  La pieza aún no tiene variantes de color. Las variantes pertenecen a la pieza global y se reutilizan en todos sus moldes.
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>SKU</TableCell>
                        <TableCell>Nombre</TableCell>
                        <TableCell>Color</TableCell>
                        <TableCell align="right">Peso (g)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {forma.variantes.map((variant) => (
                        <TableRow key={variant.sku}>
                          <TableCell><Typography variant="body2" fontWeight={700}>{variant.sku}</Typography></TableCell>
                          <TableCell>{variant.piezas || variant.nombre}</TableCell>
                          <TableCell>{variant.color || 'Sin color'}</TableCell>
                          <TableCell align="right">{variant.peso ?? globalPiece?.peso_nominal_gr ?? '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </AccordionDetails>
          </Accordion>
        );
      })}

      <Dialog open={openFormaDialog} onClose={closeAssociationDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingForma ? 'Editar configuración en el molde' : 'Asociar pieza al molde'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {editingForma ? (
              <Alert severity="info">
                Edita únicamente la relación con {editingForma.nombre}. El maestro global no cambia.
              </Alert>
            ) : null}

            {!editingForma && formaData.mode === 'EXISTENTE' && (
              <CreateOptionAutocomplete
                options={availablePieces}
                value={availablePieces.find((pieza) => String(pieza.id) === String(formaData.pieza_id)) || null}
                getOptionLabel={(pieza) => `${pieza.codigo} — ${pieza.nombre}`}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                onChange={(pieza) => setFormaData({
                  ...formaData,
                  pieza_id: pieza?.id || '',
                  peso_unitario_gr: pieza?.peso_nominal_gr ?? '',
                })}
                onCreateOption={(initialName) => setFormaData({
                  ...emptyAssociation,
                  mode: 'NUEVA',
                  nombre: initialName.trim(),
                })}
                createLabel={(inputValue) => (
                  inputValue ? `Crear pieza “${inputValue}”…` : 'Crear una pieza nueva…'
                )}
                label="Pieza existente"
                required
                helperText="Una misma pieza puede asociarse a varios moldes. La última opción permite crear una nueva."
                noOptionsText="No hay piezas disponibles"
              />
            )}

            {!editingForma && formaData.mode === 'NUEVA' && (
              <>
                <Alert
                  severity="info"
                  action={<Button size="small" onClick={() => setFormaData(emptyAssociation)}>Elegir existente</Button>}
                >
                  La pieza se creará y asociará al molde en una sola operación.
                </Alert>
                <TextField
                  label="Código estable"
                  value="Se asignará automáticamente al guardar"
                  helperText="El backend asignará el siguiente correlativo disponible."
                  slotProps={{ input: { readOnly: true } }}
                  fullWidth
                />
                <TextField
                  label="Nombre de la pieza"
                  value={formaData.nombre}
                  onChange={(event) => setFormaData({ ...formaData, nombre: event.target.value })}
                  required
                  fullWidth
                />
                <TextField
                  label="Peso nominal de la pieza (g)"
                  type="number"
                  value={formaData.peso_nominal_gr}
                  onChange={(event) => {
                    const value = event.target.value;
                    setFormaData({
                      ...formaData,
                      peso_nominal_gr: value,
                      peso_unitario_gr: formaData.peso_unitario_gr || value,
                    });
                  }}
                  inputProps={{ min: 0.001, step: 0.001 }}
                  required
                  fullWidth
                />
                <CreateOptionAutocomplete
                  options={lineas}
                  value={lineas.find(
                    (linea) => String(linea.id) === String(formaData.linea_id)
                  ) || null}
                  onChange={(linea) => setFormaData((current) => ({
                    ...current,
                    linea_id: linea?.id || '',
                    familia_id: '',
                  }))}
                  onCreateOption={(initialName) => abrirAltaClasificacion('linea', initialName)}
                  getOptionLabel={(linea) => `${linea.codigo} — ${linea.nombre}`}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  createLabel={(inputValue) => (
                    inputValue ? `Crear Línea “${inputValue}”…` : 'Crear nueva Línea…'
                  )}
                  label="Línea"
                  required
                />
                <CreateOptionAutocomplete
                  options={familiasLinea}
                  value={familiasLinea.find(
                    (familia) => String(familia.id) === String(formaData.familia_id)
                  ) || null}
                  onChange={(familia) => setFormaData((current) => ({
                    ...current,
                    familia_id: familia?.id || '',
                  }))}
                  onCreateOption={(initialName) => abrirAltaClasificacion('familia', initialName)}
                  getOptionLabel={(familia) => `${familia.codigo} — ${familia.nombre}`}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  createLabel={(inputValue) => (
                    inputValue ? `Crear Familia “${inputValue}”…` : 'Crear nueva Familia…'
                  )}
                  label="Familia"
                  required
                  disabled={!formaData.linea_id}
                  helperText={formaData.linea_id ? 'Solo se muestran Familias asociadas a la Línea.' : 'Seleccione primero una Línea.'}
                />
              </>
            )}

            <Divider />
            <Typography variant="subtitle2" fontWeight={800}>Configuración específica en {molde.codigo}</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Cavidades"
                type="number"
                value={formaData.cavidades}
                onChange={(event) => setFormaData({ ...formaData, cavidades: event.target.value })}
                inputProps={{ min: 1, step: 1 }}
                required
                fullWidth
              />
              <TextField
                label="Peso operativo por pieza (g)"
                type="number"
                value={formaData.peso_unitario_gr}
                onChange={(event) => setFormaData({ ...formaData, peso_unitario_gr: event.target.value })}
                inputProps={{ min: 0.001, step: 0.001 }}
                helperText="Puede diferir del peso nominal del maestro."
                required
                fullWidth
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAssociationDialog} disabled={savingAssociation}>Cancelar</Button>
          <Button variant="contained" onClick={handleSaveAssociation} disabled={savingAssociation}>
            {savingAssociation ? 'Guardando…' : editingForma ? 'Guardar configuración' : 'Asociar pieza'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openColorDialog} onClose={() => setOpenColorDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Añadir variante de color</DialogTitle>
        <DialogContent dividers>
          <CreateOptionAutocomplete
            options={coloresDisponibles}
            value={coloresDisponibles.find(
              (color) => String(color.id) === String(selectedColorId)
            ) || null}
            onChange={(color) => setSelectedColorId(color?.id || '')}
            onCreateOption={(initialName) => setQuickColorDialog({ open: true, initialName })}
            getOptionLabel={(color) => color.nombre}
            isOptionEqualToValue={(option, selected) => String(option.id) === String(selected?.id)}
            createLabel={(inputValue) => (
              inputValue ? `Crear "${inputValue.toUpperCase()}"…` : 'Crear nuevo color…'
            )}
            label="Color de producción"
            placeholder="Buscar color…"
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            La variante queda vinculada a la pieza global, por lo que estará disponible en cualquiera de sus moldes.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenColorDialog(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleAddColor} disabled={!selectedColorId}>Añadir variante</Button>
        </DialogActions>
      </Dialog>

      <ColorQuickCreateDialog
        open={quickColorDialog.open}
        initialName={quickColorDialog.initialName}
        onClose={() => setQuickColorDialog({ open: false, initialName: '' })}
        onCreated={handleColorCreated}
      />
      <ClassificationQuickCreateDialog
        open={classificationDialog.open}
        entity={classificationDialog.entity}
        linea={lineas.find(
          (linea) => String(linea.id) === String(formaData.linea_id)
        ) || null}
        initialName={classificationDialog.initialName}
        onClose={() => setClassificationDialog({
          open: false,
          entity: 'linea',
          initialName: '',
        })}
        onCreated={registrarClasificacionCreada}
      />
    </Box>
  );
}

export default MoldeDetalle;
