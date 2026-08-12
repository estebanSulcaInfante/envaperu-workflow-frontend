import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import {
  buscarPiezasGlobales,
  crearFamiliaColor,
  obtenerColores,
  obtenerFamiliasColor,
  obtenerIngredientesRecetaColor,
  obtenerRecetasColorMaestras,
} from '../../services/api';
import {
  crearMaterialScm,
  listarCategoriasRecepcionScm,
} from '../../services/scmCatalogApi';
import ApplicationResultSummary from './ApplicationResultSummary';
import ColorFormulationEditor from './ColorFormulationEditor';
import {
  createMatrix,
  defaultFormulation,
  newColorDraft,
  normalizeColorsData,
  validateColors,
} from './technicalStepModel';

const asItems = (payload) => (Array.isArray(payload) ? payload : payload?.items || []);

const colorLabel = (color) => (
  `${color.codigo_legacy || color.codigo || color.id} · ${color.nombre}`
);

const pieceKey = (piece) => String(piece.ref || piece.pieza_ref?.id || piece.client_id);
const colorKey = (color) => String(color.color_ref || color.client_id);
const PALETTE_PRESETS = [
  '#FFFFFF', '#000000', '#EF4444', '#F97316', '#FACC15', '#22C55E',
  '#14B8A6', '#3B82F6', '#8B5CF6', '#EC4899', '#A16207', '#94A3B8',
];
const validHex = (value) => /^#[0-9A-F]{6}$/i.test(value || '');

export default function ProductColorsStep({
  value,
  onChange,
  pieces,
  moldReference,
  resolvedReferences,
  applicationResult,
  images = [],
  imageEntries = {},
  showValidation,
}) {
  const data = normalizeColorsData({
    ...value,
    color_molde_ref: value?.color_molde_ref || moldReference || null,
  }, resolvedReferences);
  const [catalogs, setCatalogs] = useState({
    colors: [], pieces: [], finishes: [], ingredients: [], recipes: [], materialCategories: [],
  });
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [finishDialog, setFinishDialog] = useState({ open: false, colorClientId: null });
  const [finishName, setFinishName] = useState('');
  const [finishError, setFinishError] = useState('');
  const [savingFinish, setSavingFinish] = useState(false);
  const errors = useMemo(() => validateColors(data, pieces), [data, pieces]);
  const resolvedColors = resolvedReferences?.colores || [];
  const resolvedMatrix = resolvedReferences?.matriz || [];
  const resolvedFormulations = resolvedReferences?.formulaciones || [];
  const colorCatalogById = useMemo(() => new Map(
    catalogs.colors.map((item) => [String(item.id), item]),
  ), [catalogs.colors]);
  const pieceCatalogById = useMemo(() => new Map(
    catalogs.pieces.map((item) => [String(item.id), item]),
  ), [catalogs.pieces]);
  const displayColor = (color) => (
    color.nombre
    || colorCatalogById.get(String(color.color_ref))?.nombre
    || `Color ${color.color_ref || color.client_id}`
  );
  const displayPiece = (piece) => {
    const catalogPiece = pieceCatalogById.get(String(pieceKey(piece)));
    const code = piece.codigo || piece.pieza_ref?.codigo || catalogPiece?.codigo;
    const name = piece.nombre || piece.pieza_ref?.nombre || catalogPiece?.nombre;
    if (code && name) return `${code} · ${name}`;
    return name || code || `Pieza ${pieceKey(piece)}`;
  };
  const colorIsResolved = (color) => resolvedColors.some((item) => (
    String(item.client_id || '') === String(color.client_id)
    || (item.color_ref && String(item.color_ref) === String(color.color_ref))
  ));
  const matrixIsResolved = (piece, color) => resolvedMatrix.some((item) => (
    String(item.pieza_ref || item.pieza_client_id) === pieceKey(piece)
    && String(item.color_ref || item.color_client_id) === colorKey(color)
  ));
  const formulationIsResolved = (color) => resolvedFormulations.some((item) => (
    String(item.color_client_id || '') === String(color.client_id)
    || (item.color_ref && String(item.color_ref) === String(color.color_ref))
  ));
  const matrixOutcome = (entityId) => {
    if (!entityId) return 'PiezaColor sin aplicar';
    const matches = (item) => item.type === 'PIEZA_COLOR'
      && String(item.id) === String(entityId);
    if ((applicationResult?.created || []).some(matches)) return 'PiezaColor creada';
    if ((applicationResult?.reused || []).some(matches)) return 'PiezaColor reutilizada';
    return 'PiezaColor aplicada';
  };
  const storedImage = (entityId) => images.some((image) => (
    String(image.entity_type || image.tipo_entidad) === 'PIEZA_COLOR'
    && String(image.entity_id || image.entidad_id) === String(entityId)
  ));

  useEffect(() => {
    let active = true;
    Promise.all([
      obtenerColores(),
      buscarPiezasGlobales('', 300),
      obtenerFamiliasColor(),
      obtenerIngredientesRecetaColor(),
      obtenerRecetasColorMaestras({ include_inactive: true }),
      listarCategoriasRecepcionScm(),
    ])
      .then(([colors, piecesCatalog, finishes, ingredients, recipes, materialCategories]) => {
        if (!active) return;
        setCatalogs({
          colors: asItems(colors).filter((item) => item.activo !== false),
          pieces: asItems(piecesCatalog).filter((item) => item.activo !== false),
          finishes: asItems(finishes).filter((item) => item.activo !== false),
          ingredients: asItems(ingredients).filter((item) => item.activo !== false),
          recipes: asItems(recipes),
          materialCategories: asItems(materialCategories).filter((item) => item.activo !== false),
        });
      })
      .catch(() => {
        if (active) setCatalogError('No se pudieron cargar colores o recetas. Guarda el borrador antes de reintentar.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const createIngredient = async (payload) => {
    const created = await crearMaterialScm(payload);
    const refreshed = asItems(await obtenerIngredientesRecetaColor())
      .filter((item) => item.activo !== false);
    setCatalogs((current) => ({ ...current, ingredients: refreshed }));
    return refreshed.find((item) => String(item.id) === String(created.id)) || created;
  };

  const commitColors = (colors) => {
    const currentFormulations = new Map(data.formulaciones.map((item) => [
      String(item.color_ref || item.color_client_id), item,
    ]));
    const formulations = colors.map((color) => (
      currentFormulations.get(String(color.color_ref || color.client_id))
      || currentFormulations.get(String(color.client_id))
      || defaultFormulation(color)
    ));
    onChange({
      ...data,
      colores: colors,
      matriz: createMatrix(pieces, colors, data.matriz),
      formulaciones: formulations,
    });
  };

  const updateColor = (clientId, nextColor) => {
    commitColors(data.colores.map((color) => (color.client_id === clientId ? nextColor : color)));
  };

  const matrixCell = (piece, color) => data.matriz.find((cell) => (
    String(cell.pieza_ref || cell.pieza_client_id) === pieceKey(piece)
    && String(cell.color_ref || cell.color_client_id) === colorKey(color)
  ));

  const toggleCell = (piece, color, checked) => {
    const targetPiece = pieceKey(piece);
    const targetColor = colorKey(color);
    onChange({
      ...data,
      matriz: createMatrix(pieces, data.colores, data.matriz).map((cell) => (
        String(cell.pieza_ref || cell.pieza_client_id) === targetPiece
        && String(cell.color_ref || cell.color_client_id) === targetColor
          ? { ...cell, seleccionada: checked }
          : cell
      )),
    });
  };

  const openFinishDialog = (colorClientId) => {
    setFinishDialog({ open: true, colorClientId });
    setFinishName('');
    setFinishError('');
  };

  const saveFinish = async () => {
    const name = finishName.trim();
    if (!name) {
      setFinishError('Ingresa el nombre del tipo de color.');
      return;
    }
    setSavingFinish(true);
    setFinishError('');
    try {
      const created = await crearFamiliaColor({ nombre: name });
      setCatalogs((current) => ({
        ...current,
        finishes: [...current.finishes.filter((item) => item.id !== created.id), created]
          .sort((left, right) => left.nombre.localeCompare(right.nombre)),
      }));
      const target = data.colores.find((item) => item.client_id === finishDialog.colorClientId);
      if (target) updateColor(target.client_id, { ...target, familia_color_id: created.id });
      setFinishDialog({ open: false, colorClientId: null });
      setFinishName('');
    } catch (requestError) {
      setFinishError(
        requestError?.response?.data?.error?.message
        || requestError?.response?.data?.error
        || 'No se pudo crear el tipo de color.',
      );
    } finally {
      setSavingFinish(false);
    }
  };

  return (
    <Stack spacing={2.25}>
      <Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <PaletteOutlinedIcon color="primary" />
          <Typography component="h2" variant="h5" sx={{ fontWeight: 900 }}>
            Colores de todas las piezas
          </Typography>
        </Stack>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 920 }}>
          La matriz reúne las piezas de todos los moldes del PT. Marca únicamente
          las combinaciones que se fabrican y define su formulación por separado.
        </Typography>
      </Box>

      {catalogError && <Alert severity="warning">{catalogError}</Alert>}
      {!pieces.length && (
        <Alert severity="warning">
          La fase Componentes aún no aporta piezas resueltas. Vuelve a esa fase antes de aplicar colores.
        </Alert>
      )}
      <ApplicationResultSummary
        result={applicationResult}
        references={resolvedReferences}
        title="Colores y formulaciones aplicados"
      />

      <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 2.5 }}>
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ sm: 'center' }}
            spacing={1}
          >
            <Box>
              <Typography variant="overline" color="primary.main" sx={{ fontWeight: 850 }}>1 · Catálogo</Typography>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Typography variant="h6" sx={{ fontWeight: 850 }}>ColorProducción del molde</Typography>
                <Chip size="small" color="info" variant="outlined" label="Acabado" />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                “Acabado” distingue, por ejemplo, sólido, transparente o pastel.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={loading ? <CircularProgress size={16} /> : <AddRoundedIcon />}
              onClick={() => commitColors([...data.colores, newColorDraft()])}
            >
              Añadir color
            </Button>
          </Stack>

          {showValidation && errors.colores.general && <Alert severity="error">{errors.colores.general}</Alert>}
          <Stack spacing={1.25}>
            {data.colores.map((color, index) => {
              const selected = catalogs.colors.find((item) => String(item.id) === String(color.color_ref)) || null;
              const itemErrors = errors.colores[color.client_id] || {};
              return (
                <Paper
                  key={color.client_id}
                  variant="outlined"
                  sx={{ p: 1.5, m: 0, minWidth: 0 }}
                >
                  <Stack spacing={1.25}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>Color {index + 1}</Typography>
                      {colorIsResolved(color) && <Chip size="small" color="info" label="Aplicado" />}
                      <IconButton
                        aria-label={`Eliminar color ${index + 1}`}
                        color="error"
                        title={colorIsResolved(color)
                          ? 'Quitar de esta alta; el maestro compartido no se elimina.'
                          : 'Quitar color'}
                        onClick={() => commitColors(data.colores.filter((item) => item.client_id !== color.client_id))}
                      >
                        <DeleteOutlineRoundedIcon />
                      </IconButton>
                    </Stack>
                    {colorIsResolved(color) && (
                      <Alert severity="info" icon={false}>
                        La identidad de este color ya es un maestro compartido. Puedes quitarlo de esta
                        alta o completar su receta; nombre, tipo y HEX se editan desde Colores y recetas.
                      </Alert>
                    )}
                    <Box component="fieldset" disabled={colorIsResolved(color)} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
                      <Stack spacing={1.25}>
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={color.modo}
                      aria-label={`Origen de color ${index + 1}`}
                      onChange={(_, mode) => {
                        if (!mode) return;
                        updateColor(color.client_id, mode === 'NUEVO' ? {
                          ...color, modo: 'NUEVO', color_ref: null, nombre: '', familia_color_id: '', hex: '',
                        } : {
                          ...color, modo: 'REUTILIZAR', color_ref: null, nombre: '', familia_color_id: '', hex: '',
                        });
                      }}
                    >
                      <ToggleButton value="NUEVO" disabled={Boolean(color.color_ref)}>
                        Crear color
                      </ToggleButton>
                      <ToggleButton value="REUTILIZAR">Reutilizar color</ToggleButton>
                    </ToggleButtonGroup>
                    {color.modo === 'REUTILIZAR' ? (
                      <Autocomplete
                        options={catalogs.colors}
                        value={selected}
                        getOptionLabel={colorLabel}
                        isOptionEqualToValue={(option, candidate) => option.id === candidate.id}
                        onChange={(_, selectedColor) => updateColor(color.client_id, {
                          ...color,
                          color_ref: selectedColor?.id || null,
                          nombre: selectedColor?.nombre || '',
                          familia_color_id: selectedColor?.familia_color_id || '',
                          hex: selectedColor?.hex_referencia || '',
                        })}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            required
                            label="Color existente"
                            error={showValidation && Boolean(itemErrors.color_ref)}
                            helperText={(showValidation && itemErrors.color_ref) || 'Se reutiliza exactamente el color y su Acabado.'}
                          />
                        )}
                      />
                    ) : (
                      <Grid container spacing={1.25}>
                        <Grid size={{ xs: 12, md: 5 }}>
                          <TextField
                            fullWidth
                            required
                            label="Nombre del color"
                            value={color.nombre}
                            onChange={(event) => updateColor(color.client_id, { ...color, nombre: event.target.value })}
                            error={showValidation && Boolean(itemErrors.nombre)}
                            helperText={(showValidation && itemErrors.nombre) || 'Nombre visual/base, por ejemplo VERDE PASTO.'}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <Stack spacing={0.75}>
                            <TextField
                              select
                              fullWidth
                              required
                              label="Acabado / tipo de color"
                              value={color.familia_color_id}
                              onChange={(event) => updateColor(color.client_id, { ...color, familia_color_id: event.target.value })}
                              error={showValidation && Boolean(itemErrors.familia_color_id)}
                              helperText={(showValidation && itemErrors.familia_color_id) || 'Ejemplos: SÓLIDO, TRANSPARENTE, PASTEL.'}
                            >
                              {catalogs.finishes.map((finish) => (
                                <MenuItem key={finish.id} value={finish.id}>{finish.nombre}</MenuItem>
                              ))}
                            </TextField>
                            <Button
                              size="small"
                              startIcon={<AddRoundedIcon />}
                              onClick={() => openFinishDialog(color.client_id)}
                              sx={{ alignSelf: 'flex-start' }}
                            >
                              Crear tipo de color
                            </Button>
                          </Stack>
                        </Grid>
                        <Grid size={{ xs: 12, md: 3 }}>
                          <Stack spacing={0.75}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <TextField
                                type="color"
                                label="Paleta"
                                value={validHex(color.hex) ? color.hex : '#FFFFFF'}
                                onChange={(event) => updateColor(color.client_id, { ...color, hex: event.target.value.toUpperCase() })}
                                sx={{ width: 92 }}
                                slotProps={{ htmlInput: { 'aria-label': 'Escoger color de la paleta' } }}
                              />
                              <TextField
                                fullWidth
                                label="HEX de referencia"
                                placeholder="#RRGGBB"
                                value={color.hex}
                                onChange={(event) => updateColor(color.client_id, { ...color, hex: event.target.value.toUpperCase() })}
                                error={showValidation && Boolean(itemErrors.hex)}
                                helperText={(showValidation && itemErrors.hex) || 'Referencia visual opcional.'}
                              />
                            </Stack>
                            <Stack direction="row" gap={0.5} flexWrap="wrap" aria-label="Colores frecuentes">
                              {PALETTE_PRESETS.map((hex) => (
                                <IconButton
                                  key={hex}
                                  size="small"
                                  aria-label={`Usar color ${hex}`}
                                  title={hex}
                                  onClick={() => updateColor(color.client_id, { ...color, hex })}
                                  sx={{ p: 0.25, border: '1px solid', borderColor: 'divider' }}
                                >
                                  <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: hex, border: '1px solid', borderColor: 'divider' }} />
                                </IconButton>
                              ))}
                              <Button size="small" onClick={() => updateColor(color.client_id, { ...color, hex: '' })}>
                                Sin referencia
                              </Button>
                            </Stack>
                          </Stack>
                        </Grid>
                      </Grid>
                    )}
                      </Stack>
                    </Box>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        </Stack>
      </Paper>

      <Box>
        <Typography variant="overline" color="primary.main" sx={{ fontWeight: 850 }}>2 · Cobertura física</Typography>
        <Typography variant="h6" sx={{ fontWeight: 850 }}>Matriz Pieza × Color</Typography>
        <Typography variant="body2" color="text.secondary">
          La cobertura es atómica por molde: una celda desmarcada se mostrará como bloqueo antes de aplicar.
        </Typography>
      </Box>
      {showValidation && errors.matriz.length > 0 && (
        <Alert severity="error">{[...new Set(errors.matriz)].join(' ')}</Alert>
      )}
      <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: '100%' }}>
        <Table size="small" aria-label="Matriz Pieza por Color">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 850, minWidth: 210 }}>Color</TableCell>
              {pieces.map((piece) => (
                <TableCell key={pieceKey(piece)} align="center" sx={{ fontWeight: 800, minWidth: 150 }}>
                  {displayPiece(piece)}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.colores.map((color) => (
              <TableRow key={color.client_id}>
                <TableCell>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: color.hex || 'grey.300', border: '1px solid', borderColor: 'divider' }} />
                    <Typography variant="body2" sx={{ fontWeight: 750 }}>{displayColor(color)}</Typography>
                  </Stack>
                </TableCell>
                {pieces.map((piece) => {
                  const cell = matrixCell(piece, color);
                  const checked = cell?.seleccionada !== false;
                  const resolvedCell = resolvedMatrix.find((item) => (
                    String(item.pieza_ref || item.pieza_client_id) === pieceKey(piece)
                    && String(item.color_ref || item.color_client_id) === colorKey(color)
                  ));
                  const entityId = cell?.pieza_color_ref || resolvedCell?.pieza_color_ref;
                  const formulation = data.formulaciones.find((item) => (
                    String(item.color_ref || item.color_client_id) === colorKey(color)
                    || item.color_client_id === color.client_id
                  ));
                  const resolvedFormulation = resolvedFormulations.find((item) => (
                    String(item.color_ref || item.color_client_id) === colorKey(color)
                    || item.color_client_id === color.client_id
                  ));
                  const formulaPending = (resolvedFormulation?.estado || formulation?.tipo)
                    === 'PENDIENTE';
                  const imageKey = `PIEZA_COLOR:${piece.client_id || piece.ref}:${color.client_id || color.color_ref}`;
                  const imageEntry = imageEntries[imageKey];
                  const imageSaved = storedImage(entityId) || imageEntry?.status === 'DONE';
                  const imagePending = ['LOCAL', 'UPLOADING'].includes(imageEntry?.status);
                  return (
                    <TableCell key={pieceKey(piece)} align="center">
                      <Checkbox
                        checked={checked}
                        disabled={matrixIsResolved(piece, color)}
                        onChange={(event) => toggleCell(piece, color, event.target.checked)}
                        inputProps={{ 'aria-label': `${displayColor(color)} en ${displayPiece(piece)}` }}
                      />
                      {cell?.pieza_color_ref && <Chip size="small" color="success" variant="outlined" label={cell.pieza_color_ref} />}
                      <Stack
                        spacing={0.5}
                        sx={{ mt: 0.75, alignItems: 'center' }}
                        aria-label={`Estado ${displayColor(color)} en ${displayPiece(piece)}`}
                      >
                        <Chip
                          size="small"
                          variant="outlined"
                          color={entityId ? 'success' : 'default'}
                          label={matrixOutcome(entityId)}
                        />
                        <Chip
                          size="small"
                          variant="outlined"
                          color={formulaPending ? 'warning' : 'success'}
                          label={formulaPending ? 'Formulación pendiente' : 'Formulación lista'}
                        />
                        <Chip
                          size="small"
                          variant="outlined"
                          color={imageSaved ? 'success' : imagePending ? 'info' : 'warning'}
                          label={imageSaved
                            ? 'Imagen guardada'
                            : imagePending ? 'Imagen pendiente de subida'
                              : imageEntry?.status === 'ERROR' ? 'Error de imagen' : 'Falta imagen'}
                        />
                      </Stack>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box>
        <Typography variant="overline" color="primary.main" sx={{ fontWeight: 850 }}>3 · Fórmula</Typography>
        <Typography variant="h6" sx={{ fontWeight: 850 }}>Receta por color</Typography>
        <Typography variant="body2" color="text.secondary">
          Existente, Nueva, Sin pigmento o Pendiente son decisiones explícitas y auditables.
        </Typography>
      </Box>
      <Alert severity="info">
        No se inventan ingredientes: cada material y proporción debe seleccionarse o quedar Pendiente con motivo.
      </Alert>
      {!data.colores.length && (
        <Stack direction="row" gap={0.75} flexWrap="wrap" aria-label="Opciones de formulación">
          {['Existente', 'Nueva', 'Sin pigmento', 'Pendiente'].map((option) => (
            <Chip key={option} label={option} variant="outlined" />
          ))}
        </Stack>
      )}
      <Stack spacing={1.25}>
        {data.colores.map((color) => {
          const formulation = data.formulaciones.find((item) => (
            String(item.color_ref || item.color_client_id) === colorKey(color)
            || item.color_client_id === color.client_id
          )) || defaultFormulation(color);
          return (
            <ColorFormulationEditor
              key={color.client_id}
              color={color}
              formulation={formulation}
              recipes={catalogs.recipes}
              ingredients={catalogs.ingredients}
              materialCategories={catalogs.materialCategories}
              onCreateIngredient={createIngredient}
              errors={errors.formulaciones[color.client_id] || errors.formulaciones[color.color_ref] || {}}
              showValidation={showValidation}
              disabled={formulationIsResolved(color)
                && resolvedFormulations.find((item) => (
                  String(item.color_ref || item.color_client_id) === colorKey(color)
                  || item.color_client_id === color.client_id
                ))?.estado !== 'PENDIENTE'}
              onChange={(nextFormulation) => onChange({
                ...data,
                formulaciones: data.formulaciones.map((item) => (
                  item.color_client_id === color.client_id ? nextFormulation : item
                )),
              })}
            />
          );
        })}
      </Stack>

      <Paper variant="outlined" sx={{ p: 1.75, bgcolor: 'grey.50' }}>
        <Stack spacing={1.25}>
          <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>Resumen antes de aplicar</Typography>
          <Stack direction="row" gap={0.75} flexWrap="wrap">
            <Chip label={`${data.colores.length} color(es)`} />
            <Chip label={`${createMatrix(pieces, data.colores, data.matriz).filter((cell) => cell.seleccionada !== false).length} combinaciones`} />
            <Chip
              color={data.formulaciones.some((item) => item.tipo === 'PENDIENTE') ? 'warning' : 'success'}
              label={`${data.formulaciones.filter((item) => item.tipo === 'PENDIENTE').length} receta(s) pendiente(s)`}
            />
          </Stack>
        </Stack>
      </Paper>

      <Dialog
        open={finishDialog.open}
        onClose={() => !savingFinish && setFinishDialog({ open: false, colorClientId: null })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Nuevo tipo de color</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <Alert severity="info">
              Crea un acabado reutilizable como TRANSPARENTE, PASTEL, CARAMELO o MATE.
            </Alert>
            {finishError && <Alert severity="error">{finishError}</Alert>}
            <TextField
              autoFocus
              fullWidth
              required
              label="Nombre del tipo"
              value={finishName}
              onChange={(event) => setFinishName(event.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setFinishDialog({ open: false, colorClientId: null })}
            disabled={savingFinish}
          >
            Cancelar
          </Button>
          <Button variant="contained" onClick={saveFinish} disabled={savingFinish}>
            {savingFinish ? 'Guardando…' : 'Guardar tipo'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
