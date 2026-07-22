import { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  Grid,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Alert,
  Chip,
  IconButton,
  Divider,
  Card,
  CardContent,
  Autocomplete,
  CircularProgress,
  Switch,
  FormControlLabel,
  Tooltip,
  Stack
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import PaletteIcon from '@mui/icons-material/Palette';
import InventoryIcon from '@mui/icons-material/Inventory2';
import BuildIcon from '@mui/icons-material/Build';
import { useNavigate } from 'react-router-dom';
import CreateOptionAutocomplete from './ui/CreateOptionAutocomplete';
import ColorQuickCreateDialog from './ui/ColorQuickCreateDialog';
import ClassificationQuickCreateDialog from './ui/ClassificationQuickCreateDialog';
import {
  obtenerColores,
  obtenerMoldes,
  configurarProductoCascada,
  obtenerLineas,
  obtenerFamilias,
  buscarPiezasGlobales
} from '../services/api';

const nuevaPiezaVacia = () => ({
  usar_existente: false,
  preexistente_en_molde: false,
  pieza_seleccionada: null,
  nombre: '',
  cavidades: '2',
  peso_unitario_gr: ''
});

const nombreCatalogo = (catalogo, id) => (
  catalogo.find((item) => item.id === id)?.nombre || (id ? `ID ${id}` : 'Sin clasificar')
);

function ConfigurarProducto() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Datos del formulario
  const [molde, setMolde] = useState({
    nombre: '',
    peso_tiro_gr: '',
    tiempo_ciclo_std: '30',
    usar_existente: false,
    molde_seleccionado: null
  });
  
  const [piezas, setPiezas] = useState([nuevaPiezaVacia()]);

  // Kit state (NUEVO)
  const [crearKit, setCrearKit] = useState(false);
  const [kitNombre, setKitNombre] = useState('');
  
  const [coloresSeleccionados, setColoresSeleccionados] = useState([]);
  const [colorDialogOpen, setColorDialogOpen] = useState(false);
  const [colorInitialName, setColorInitialName] = useState('');

  const [lineaSeleccionada, setLineaSeleccionada] = useState(null);
  const [familiaSeleccionada, setFamiliaSeleccionada] = useState(null);
  const [classificationDialog, setClassificationDialog] = useState({
    open: false,
    entity: 'linea',
    initialName: '',
  });
  
  // Catálogos
  const [coloresOptions, setColoresOptions] = useState([]);
  const [moldesOptions, setMoldesOptions] = useState([]);
  const [piezasOptions, setPiezasOptions] = useState([]);
  const [lineasOptions, setLineasOptions] = useState([]);
  const [familiasCatalogo, setFamiliasCatalogo] = useState([]);
  const [familiasOptions, setFamiliasOptions] = useState([]);
  const [coloresLoading, setColoresLoading] = useState(false);
  const [moldesLoading, setMoldesLoading] = useState(false);
  const [piezasLoading, setPiezasLoading] = useState(false);
  const [catalogosLoading, setCatalogosLoading] = useState(false);
  const [familiasLoading, setFamiliasLoading] = useState(false);
  const [familiasError, setFamiliasError] = useState('');
  
  // Resultado
  const [resultado, setResultado] = useState(null);
  const nombreMoldeActual = molde.usar_existente
    ? molde.molde_seleccionado?.nombre || ''
    : molde.nombre;
  const composicionesMoldeSeleccionado = (
    molde.molde_seleccionado?.formas || molde.molde_seleccionado?.piezas || []
  ).filter((forma) => forma.activo !== false);

  // Cargar catálogos
  useEffect(() => {
    const cargarCatalogos = async () => {
      try {
        setColoresLoading(true);
        setMoldesLoading(true);
        setPiezasLoading(true);
        setCatalogosLoading(true);
        const [coloresRes, moldesRes, lineasRes, familiasRes, piezasRes] = await Promise.all([
          obtenerColores(),
          obtenerMoldes(),
          obtenerLineas(),
          obtenerFamilias(),
          buscarPiezasGlobales('', 200)
        ]);
        setColoresOptions(coloresRes || []);
        setMoldesOptions(moldesRes || []);
        setLineasOptions(lineasRes || []);
        setFamiliasCatalogo(familiasRes || []);
        setPiezasOptions((piezasRes || []).filter((pieza) => pieza.activo !== false));
      } catch (err) {
        console.error("Error al cargar catálogos:", err);
        setError("No se pudieron cargar algunos catálogos iniciales.");
      } finally {
        setColoresLoading(false);
        setMoldesLoading(false);
        setPiezasLoading(false);
        setCatalogosLoading(false);
      }
    };
    cargarCatalogos();
  }, []);

  useEffect(() => {
    let active = true;
    if (!lineaSeleccionada?.id) {
      setFamiliasOptions([]);
      setFamiliasError('');
      return () => { active = false; };
    }

    setFamiliasLoading(true);
    setFamiliasError('');
    obtenerFamilias({ linea_id: lineaSeleccionada.id })
      .then((familias) => {
        if (!active) return;
        setFamiliasOptions(familias || []);
        setFamiliasCatalogo((current) => {
          const byId = new Map(current.map((familia) => [familia.id, familia]));
          (familias || []).forEach((familia) => byId.set(familia.id, familia));
          return [...byId.values()];
        });
        setFamiliaSeleccionada((current) => (
          current && !(familias || []).some((familia) => familia.id === current.id) ? null : current
        ));
      })
      .catch(() => {
        if (active) {
          setFamiliasOptions([]);
          setFamiliaSeleccionada(null);
          setFamiliasError('No se pudieron cargar las familias de la línea seleccionada.');
        }
      })
      .finally(() => {
        if (active) setFamiliasLoading(false);
      });

    return () => { active = false; };
  }, [lineaSeleccionada?.id]);

  // Auto-generar nombre del Kit basado en el molde
  useEffect(() => {
    if (crearKit && !kitNombre && nombreMoldeActual) {
      setKitNombre(`${nombreMoldeActual} Completo`);
    }
  }, [crearKit, kitNombre, nombreMoldeActual]);

  useEffect(() => {
    if (coloresSeleccionados.length === 0 && crearKit) {
      setCrearKit(false);
      setKitNombre('');
    }
  }, [coloresSeleccionados.length, crearKit]);

  // Handlers
  const handleMoldeChange = (field, value) => {
    setMolde(prev => ({ ...prev, [field]: value }));
  };

  const handleModoMoldeChange = (usarExistente) => {
    setMolde((current) => ({
      ...current,
      usar_existente: usarExistente,
      molde_seleccionado: null,
      peso_tiro_gr: usarExistente ? '' : current.peso_tiro_gr,
      tiempo_ciclo_std: usarExistente ? '30' : current.tiempo_ciclo_std,
    }));
    setPiezas([nuevaPiezaVacia()]);
  };

  const handleMoldeSeleccionado = (selected) => {
    setMolde((current) => ({
      ...current,
      molde_seleccionado: selected,
      peso_tiro_gr: selected?.peso_tiro_gr ? String(selected.peso_tiro_gr) : '',
      tiempo_ciclo_std: selected?.tiempo_ciclo_std ? String(selected.tiempo_ciclo_std) : '30',
    }));

    const composiciones = (selected?.formas || selected?.piezas || [])
      .filter((forma) => forma.activo !== false);
    if (composiciones.length === 0) {
      setPiezas([nuevaPiezaVacia()]);
      return;
    }

    const piezasDelMolde = composiciones.map((forma) => {
      const piezaCatalogo = piezasOptions.find((pieza) => pieza.id === forma.pieza_id);
      const piezaSeleccionada = piezaCatalogo || {
        id: forma.pieza_id,
        codigo: forma.pieza_codigo || `PZ-${forma.pieza_id}`,
        nombre: forma.pieza_nombre || forma.nombre,
        peso_nominal_gr: forma.peso_nominal_gr || forma.peso_unitario_gr,
        linea_id: forma.linea_id,
        familia_id: forma.familia_id,
        activo: true,
      };
      return {
        usar_existente: true,
        preexistente_en_molde: true,
        pieza_seleccionada: piezaSeleccionada,
        nombre: piezaSeleccionada.nombre,
        cavidades: String(forma.cavidades),
        peso_unitario_gr: String(forma.peso_unitario_gr),
      };
    });
    setPiezas(piezasDelMolde);
  };

  const handlePiezaChange = (index, field, value) => {
    setPiezas(prev => prev.map((p, i) => 
      i === index && !p.preexistente_en_molde ? { ...p, [field]: value } : p
    ));
  };

  const handleModoPiezaChange = (index, usarExistente) => {
    setPiezas((current) => current.map((pieza, currentIndex) => (
      currentIndex === index && !pieza.preexistente_en_molde
        ? { ...nuevaPiezaVacia(), cavidades: pieza.cavidades, usar_existente: usarExistente }
        : pieza
    )));
  };

  const handlePiezaSeleccionada = (index, piezaSeleccionada) => {
    setPiezas((current) => current.map((pieza, currentIndex) => (
      currentIndex === index && !pieza.preexistente_en_molde
        ? {
            ...pieza,
            pieza_seleccionada: piezaSeleccionada,
            nombre: piezaSeleccionada?.nombre || '',
            peso_unitario_gr: piezaSeleccionada?.peso_nominal_gr
              ? String(piezaSeleccionada.peso_nominal_gr)
              : ''
          }
        : pieza
    )));
  };

  const agregarColor = (color) => {
    if (!color) return;
    const colorId = Number(color.id);
    if (!Number.isInteger(colorId) || colorId <= 0) {
      setError('El color seleccionado no tiene una identidad válida. Recarga el catálogo e inténtalo nuevamente.');
      return;
    }
    const normalizedColor = { ...color, id: colorId };
    setColoresSeleccionados((current) => (
      current.some((item) => item.id === colorId) ? current : [...current, normalizedColor]
    ));
  };

  const quitarColor = (colorId) => {
    setColoresSeleccionados((current) => current.filter((color) => color.id !== colorId));
  };

  const abrirAltaColor = (initialName = '') => {
    setColorInitialName(initialName);
    setColorDialogOpen(true);
  };

  const registrarColorCreado = (createdColor) => {
    setColoresOptions((current) => (
      current.some((color) => color.id === createdColor.id)
        ? current.map((color) => (color.id === createdColor.id ? createdColor : color))
        : [...current, createdColor]
    ));
    agregarColor(createdColor);
  };

  const abrirAltaClasificacion = (entity, initialName = '') => {
    if (entity === 'familia' && !lineaSeleccionada) return;
    setClassificationDialog({ open: true, entity, initialName });
  };

  const registrarClasificacionCreada = (created) => {
    if (classificationDialog.entity === 'linea') {
      setLineasOptions((current) => (
        current.some((item) => item.id === created.id) ? current : [...current, created]
      ));
      setLineaSeleccionada(created);
      setFamiliaSeleccionada(null);
      setFamiliasOptions([]);
      return;
    }

    setFamiliasOptions((current) => (
      current.some((item) => item.id === created.id) ? current : [...current, created]
    ));
    setFamiliasCatalogo((current) => (
      current.some((item) => item.id === created.id) ? current : [...current, created]
    ));
    setFamiliaSeleccionada(created);
  };

  const addPieza = () => {
    setPiezas(prev => [...prev, nuevaPiezaVacia()]);
  };

  const removePieza = (index) => {
    if (piezas.length > 1 && !piezas[index]?.preexistente_en_molde) {
      setPiezas(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleNext = () => {
    setActiveStep(prev => prev + 1);
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    setError(null);

    if (!isStep0Valid()) {
      setError('Selecciona un molde válido y una combinación Línea–Familia activa.');
      setActiveStep(0);
      return;
    }
    if (!isStep1Valid()) {
      setError('La composición requiere al menos una pieza completa, sin duplicados y con cavidades y peso positivos.');
      setActiveStep(1);
      return;
    }
    if (!isStep2Valid()) {
      setError('Revisa los colores seleccionados y la clasificación de las piezas antes de continuar.');
      setActiveStep(2);
      return;
    }
    if (!isStep3Valid()) {
      setError('Un kit requiere al menos dos piezas, un color seleccionado y un nombre.');
      setActiveStep(3);
      return;
    }

    setLoading(true);
    
    try {
      const payload = {
        molde: molde.usar_existente
          ? {
              codigo: molde.molde_seleccionado.codigo,
              usar_existente: true,
            }
          : {
              nombre: molde.nombre.trim(),
              peso_tiro_gr: parseFloat(molde.peso_tiro_gr),
              tiempo_ciclo_std: parseFloat(molde.tiempo_ciclo_std) || 30,
              usar_existente: false,
            },
        formas: piezas.map((pieza) => ({
          ...(pieza.usar_existente
            ? { pieza_id: pieza.pieza_seleccionada.id }
            : { nombre: pieza.nombre.trim() }),
          cavidades: parseInt(pieza.cavidades, 10),
          peso_unitario_gr: parseFloat(pieza.peso_unitario_gr)
        })),
        // Kit (solo si se activó y hay >1 pieza)
        kit: (crearKit && piezas.length > 1 && coloresSeleccionados.length > 0) ? {
          nombre: kitNombre.trim()
        } : null,
        color_ids: coloresSeleccionados.map(c => c.id),

        linea_id: lineaSeleccionada.id,
        familia_id: familiaSeleccionada.id
      };
      
      const response = await configurarProductoCascada(payload);
      setResultado(response.resultado || response);
      setActiveStep(5); // Ir al paso de resultado
    } catch (err) {
      setError(err.response?.data?.error || 'Error creando configuración');
    } finally {
      setLoading(false);
    }
  };

  // Validaciones por paso
  const isStep0Valid = () => {
    if (!lineaSeleccionada || !familiaSeleccionada) return false;
    if (molde.usar_existente) {
      return !!molde.molde_seleccionado;
    }
    return Boolean(molde.nombre.trim() && Number(molde.peso_tiro_gr) > 0);
  };

  const isStep1Valid = () => {
    const idsExistentes = piezas
      .filter((pieza) => pieza.usar_existente && pieza.pieza_seleccionada)
      .map((pieza) => pieza.pieza_seleccionada.id);
    const sinDuplicados = new Set(idsExistentes).size === idsExistentes.length;
    const nombresNuevos = piezas
      .filter((pieza) => !pieza.usar_existente)
      .map((pieza) => pieza.nombre.trim().toUpperCase())
      .filter(Boolean);
    const nombresSinDuplicados = new Set(nombresNuevos).size === nombresNuevos.length;

    return piezas.length > 0 && sinDuplicados && nombresSinDuplicados && piezas.every((pieza) => (
      (pieza.usar_existente
        ? Number.isInteger(Number(pieza.pieza_seleccionada?.id)) && Number(pieza.pieza_seleccionada.id) > 0
        : Boolean(pieza.nombre.trim()))
      && Number.isInteger(Number(pieza.cavidades))
      && Number(pieza.cavidades) > 0
      && Number.isFinite(Number(pieza.peso_unitario_gr))
      && Number(pieza.peso_unitario_gr) > 0
    ));
  };

  const isStep2Valid = () => {
    const coloresValidos = coloresSeleccionados.every((color) => (
      Number.isInteger(Number(color.id)) && Number(color.id) > 0
    ));
    if (!coloresValidos) return false;
    if (coloresSeleccionados.length === 0) return true;
    return piezas.length > 0 && piezas.every((pieza) => (
      !pieza.usar_existente
      || (pieza.pieza_seleccionada?.linea_id && pieza.pieza_seleccionada?.familia_id)
    ));
  };

  const isStep3Valid = () => (
    !crearKit
    || (
      piezas.length > 1
      && coloresSeleccionados.length > 0
      && Boolean(kitNombre.trim())
    )
  );

  // Calcular peso total estimado
  const pesoNetoCalculado = piezas.reduce((sum, p) => {
    return sum + (parseFloat(p.peso_unitario_gr) || 0) * (parseInt(p.cavidades) || 1);
  }, 0);

  const nombrePieza = (pieza) => pieza.pieza_seleccionada?.nombre || pieza.nombre || '?';
  const piezasMaestrasNuevas = Array.isArray(resultado?.piezas_maestras_creadas)
    ? resultado.piezas_maestras_creadas.length
    : piezas.filter((pieza) => !pieza.usar_existente).length;
  const piezasMaestrasReutilizadas = Array.isArray(resultado?.piezas_maestras_reutilizadas)
    ? resultado.piezas_maestras_reutilizadas.length
    : Array.isArray(resultado?.formas_reutilizadas)
      ? resultado.formas_reutilizadas.length
      : piezas.filter((pieza) => pieza.usar_existente).length;
  const kitsCreados = Array.isArray(resultado?.kit_creado)
    ? resultado.kit_creado.length
    : resultado?.kit_creado ? 1 : 0;
  const variantesCreadas = Array.isArray(resultado?.variantes_creadas)
    ? resultado.variantes_creadas.length
    : Math.max(0, (resultado?.piezas_creadas?.length || 0) - kitsCreados);
  const variantesReutilizadas = Array.isArray(resultado?.variantes_reutilizadas)
    ? resultado.variantes_reutilizadas.length
    : 0;
  const codigoMoldeReutilizado = resultado?.molde_reutilizado
    || (molde.usar_existente ? molde.molde_seleccionado?.codigo : null);

  return (
    <Paper sx={{ p: 4, maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        <PrecisionManufacturingIcon /> Configuración guiada de producto
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configura Molde ↔ Pieza y genera las variantes PiezaColor sin duplicar identidades maestras.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stepper activeStep={activeStep} orientation="vertical">
        {/* PASO 1: MOLDE */}
        <Step>
          <StepLabel>
            <Typography sx={{ fontWeight: 600 }}>Molde y clasificación</Typography>
          </StepLabel>
          <StepContent>
            <Box sx={{ mb: 2 }}>
              <FormControlLabel
                control={
                    <Switch
                      checked={molde.usar_existente}
                      onChange={(e) => handleModoMoldeChange(e.target.checked)}
                  />
                }
                label="Usar molde existente"
              />
              
              {molde.usar_existente ? (
                <Autocomplete
                  options={moldesOptions.filter((option) => option.activo !== false)}
                  getOptionLabel={(opt) => `${opt.codigo} - ${opt.nombre}`}
                  loading={moldesLoading}
                  value={molde.molde_seleccionado}
                  onChange={(_, newVal) => handleMoldeSeleccionado(newVal)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Seleccionar Molde"
                      fullWidth
                      sx={{ mt: 2 }}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {moldesLoading && <CircularProgress size={20} />}
                            {params.InputProps.endAdornment}
                          </>
                        )
                      }}
                    />
                  )}
                />
              ) : (
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Nombre del Molde"
                      value={molde.nombre}
                      onChange={(e) => handleMoldeChange('nombre', e.target.value)}
                      placeholder="Ej: Balde Playero 5L"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Código"
                      value="Se asignará automáticamente al guardar"
                      helperText="El backend asignará el siguiente correlativo disponible."
                      slotProps={{ input: { readOnly: true } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <TextField
                      fullWidth
                      label="Peso Tiro (gr)"
                      type="number"
                      value={molde.peso_tiro_gr}
                      onChange={(e) => handleMoldeChange('peso_tiro_gr', e.target.value)}
                      helperText="Peso total del golpe"
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <TextField
                      fullWidth
                      label="T. Ciclo (seg)"
                      type="number"
                      value={molde.tiempo_ciclo_std}
                      onChange={(e) => handleMoldeChange('tiempo_ciclo_std', e.target.value)}
                    />
                  </Grid>
                </Grid>
              )}

              {molde.usar_existente && molde.molde_seleccionado && (
                <Alert severity={composicionesMoldeSeleccionado.length > 0 ? 'success' : 'warning'} sx={{ mt: 2 }}>
                  Se reutilizará <strong>{molde.molde_seleccionado.codigo} · {molde.molde_seleccionado.nombre}</strong>
                  {composicionesMoldeSeleccionado.length > 0 ? (
                    <> con sus <strong>{composicionesMoldeSeleccionado.length} configuraciones Molde–Pieza activas</strong> precargadas.</>
                  ) : (
                    <>. No tiene una composición activa; agrega al menos una pieza antes de continuar.</>
                  )}
                </Alert>
              )}

              <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
                La combinación Línea–Familia clasifica las piezas nuevas y cualquier kit generado.
                Las piezas existentes conservan siempre su propia clasificación.
              </Alert>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <CreateOptionAutocomplete
                    options={lineasOptions}
                    getOptionLabel={(option) => option.nombre}
                    loading={catalogosLoading}
                    value={lineaSeleccionada}
                    onChange={(newVal) => {
                      setLineaSeleccionada(newVal);
                      setFamiliaSeleccionada(null);
                      setFamiliasOptions([]);
                      setFamiliasError('');
                    }}
                    onCreateOption={(initialName) => abrirAltaClasificacion('linea', initialName)}
                    createLabel={(inputValue) => (
                      inputValue ? `Crear Línea “${inputValue}”…` : 'Crear nueva Línea…'
                    )}
                    label="Línea"
                    required
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <CreateOptionAutocomplete
                    options={familiasOptions}
                    getOptionLabel={(option) => option.nombre}
                    loading={familiasLoading}
                    value={familiaSeleccionada}
                    onChange={setFamiliaSeleccionada}
                    onCreateOption={(initialName) => abrirAltaClasificacion('familia', initialName)}
                    createLabel={(inputValue) => (
                      inputValue ? `Crear Familia “${inputValue}”…` : 'Crear nueva Familia en esta Línea…'
                    )}
                    disabled={!lineaSeleccionada || familiasLoading || Boolean(familiasError)}
                    noOptionsText={lineaSeleccionada ? 'La línea no tiene familias asociadas' : 'Selecciona una línea primero'}
                    label="Familia"
                    required
                    error={Boolean(familiasError)}
                    helperText={familiasError || (
                      lineaSeleccionada && !familiasLoading && familiasOptions.length === 0
                        ? 'Esta línea no tiene familias habilitadas; puedes crear la primera aquí.'
                        : 'Solo se muestran familias asociadas a la línea.'
                    )}
                  />
                </Grid>
              </Grid>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={!isStep0Valid()}
              >
                Siguiente
              </Button>
            </Box>
          </StepContent>
        </Step>

        {/* PASO 2: PIEZAS Y RELACIÓN MOLDE-PIEZA */}
        <Step>
          <StepLabel>
            <Typography sx={{ fontWeight: 600 }}>Piezas y composición ({piezas.length})</Typography>
          </StepLabel>
          <StepContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Vincula una Pieza global existente o crea una nueva. Cavidades y peso operativo pertenecen a la relación Molde–Pieza.
            </Typography>
            
            {piezas.map((pieza, index) => (
              <Card key={index} variant="outlined" sx={{ mb: 2, p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" color="primary">
                    Pieza {index + 1}
                  </Typography>
                  {piezas.length > 1 && !pieza.preexistente_en_molde && (
                    <IconButton size="small" color="error" onClick={() => removePieza(index)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                    )}
                </Box>
                <FormControlLabel
                  control={(
                    <Switch
                      size="small"
                      checked={pieza.usar_existente}
                      onChange={(event) => handleModoPiezaChange(index, event.target.checked)}
                      disabled={pieza.preexistente_en_molde}
                    />
                  )}
                  label="Vincular pieza maestra existente"
                  sx={{ mb: 1 }}
                />
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 5 }}>
                    {pieza.usar_existente ? (
                      <Autocomplete
                        options={piezasOptions}
                        value={pieza.pieza_seleccionada}
                        loading={piezasLoading}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        getOptionLabel={(option) => `${option.codigo} · ${option.nombre}`}
                        getOptionDisabled={(option) => piezas.some((candidate, candidateIndex) => (
                          candidateIndex !== index && candidate.pieza_seleccionada?.id === option.id
                        ))}
                        onChange={(_, newValue) => handlePiezaSeleccionada(index, newValue)}
                        disabled={pieza.preexistente_en_molde}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            size="small"
                            label="Pieza existente"
                            required
                            placeholder="Buscar por código o nombre"
                          />
                        )}
                      />
                    ) : (
                      <TextField
                        fullWidth
                        size="small"
                        label="Nombre de la pieza nueva"
                        value={pieza.nombre}
                        onChange={(e) => handlePiezaChange(index, 'nombre', e.target.value)}
                        placeholder="Ej: Tapa regadera"
                        required
                      />
                    )}
                  </Grid>
                  <Grid size={{ xs: 6, sm: 2 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Cavidades"
                      type="number"
                      value={pieza.cavidades}
                      onChange={(e) => handlePiezaChange(index, 'cavidades', e.target.value)}
                      inputProps={{ min: 1 }}
                      disabled={pieza.preexistente_en_molde}
                      required
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 2 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Peso (gr)"
                      type="number"
                      value={pieza.peso_unitario_gr}
                      onChange={(e) => handlePiezaChange(index, 'peso_unitario_gr', e.target.value)}
                      inputProps={{ min: 0.01, step: 0.01 }}
                      disabled={pieza.preexistente_en_molde}
                      helperText={pieza.usar_existente ? 'Operativo en este molde' : 'Nominal y operativo inicial'}
                      required
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="SKU por color"
                      value="Se asignará automáticamente al guardar"
                      helperText="Se generará un correlativo por cada variante creada."
                      slotProps={{ input: { readOnly: true } }}
                    />
                  </Grid>
                </Grid>
                {pieza.usar_existente && pieza.pieza_seleccionada && (
                  <Alert
                    severity={pieza.pieza_seleccionada.linea_id && pieza.pieza_seleccionada.familia_id ? 'success' : 'warning'}
                    sx={{ mt: 1.5 }}
                  >
                    {pieza.pieza_seleccionada.linea_id && pieza.pieza_seleccionada.familia_id ? (
                      <>
                        Conserva su clasificación: <strong>
                          {nombreCatalogo(lineasOptions, pieza.pieza_seleccionada.linea_id)} · {nombreCatalogo(familiasCatalogo, pieza.pieza_seleccionada.familia_id)}
                        </strong>. El wizard solo enviará su <code>pieza_id</code>.
                      </>
                    ) : (
                      <>La pieza no está clasificada. Puede vincularse al molde, pero debe clasificarse antes de generar PiezaColor.</>
                    )}
                  </Alert>
                )}
                {pieza.preexistente_en_molde && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Relación activa precargada. Para cambiar cavidades o peso operativo, edita la composición desde el detalle del molde.
                  </Typography>
                )}
              </Card>
            ))}

            <Button
              startIcon={<AddCircleIcon />}
              onClick={addPieza}
              sx={{ mb: 2 }}
            >
              Agregar otra pieza
            </Button>

            {pesoNetoCalculado > 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Peso neto calculado: <strong>{pesoNetoCalculado.toFixed(1)} gr</strong>
                {molde.peso_tiro_gr && (
                  <> | Colada estimada: <strong>{(parseFloat(molde.peso_tiro_gr) - pesoNetoCalculado).toFixed(1)} gr</strong></>
                )}
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button onClick={handleBack}>Atrás</Button>
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={!isStep1Valid()}
              >
                Siguiente
              </Button>
            </Box>
          </StepContent>
        </Step>

        {/* PASO 3: VARIANTES PIEZA-COLOR */}
        <Step>
          <StepLabel>
            <Typography sx={{ fontWeight: 600 }}>Variantes PiezaColor</Typography>
          </StepLabel>
          <StepContent>
            <Box sx={{ mb: 2 }}>
              <CreateOptionAutocomplete
                options={coloresOptions.filter((color) => (
                  !coloresSeleccionados.some((selected) => selected.id === color.id)
                ))}
                value={null}
                onChange={agregarColor}
                onCreateOption={abrirAltaColor}
                getOptionLabel={(option) => option.nombre}
                loading={coloresLoading}
                label="Agregar color de producción"
                placeholder="Buscar color"
                helperText="Selecciona un color o usa la última opción para crearlo con su acabado."
                createLabel={(inputValue) => (
                  inputValue ? `Crear color “${inputValue}”…` : 'Crear nuevo color…'
                )}
              />
              {coloresSeleccionados.length > 0 && (
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
                  {coloresSeleccionados.map((color) => (
                    <Chip
                      key={color.id}
                      label={color.nombre}
                      icon={<PaletteIcon />}
                      size="small"
                      color="primary"
                      variant="outlined"
                      onDelete={() => quitarColor(color.id)}
                    />
                  ))}
                </Stack>
              )}
              {!isStep2Valid() && (
                <Alert severity="warning" sx={{ mt: 1.5 }}>
                  Para generar PiezaColor, clasifica primero las piezas existentes sin Línea–Familia desde el maestro de Piezas.
                </Alert>
              )}
              {coloresSeleccionados.length > 0 && isStep2Valid() && (
                <Alert severity="info" sx={{ mt: 1.5 }}>
                  Se resolverán hasta <strong>{piezas.length * coloresSeleccionados.length}</strong> combinaciones Pieza + Color.
                  Las ya existentes conservarán su SKU.
                </Alert>
              )}
              {coloresSeleccionados.length === 0 && (
                <Alert severity="warning" sx={{ mt: 1.5 }}>
                  Puedes continuar sin colores, pero no se crearán PiezaColor ni kits.
                </Alert>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button onClick={handleBack}>Atrás</Button>
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={!isStep2Valid()}
              >
                Siguiente
              </Button>
            </Box>
          </StepContent>
        </Step>

        {/* PASO 4: KIT */}
        <Step>
          <StepLabel>
            <Typography sx={{ fontWeight: 600 }}>
              <BuildIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
              Formar Kit {piezas.length <= 1
                ? '(no aplica)'
                : coloresSeleccionados.length === 0 ? '(requiere color)' : ''}
            </Typography>
          </StepLabel>
          <StepContent>
            {piezas.length > 1 && coloresSeleccionados.length > 0 ? (
              <>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Tu molde produce <strong>{piezas.length} piezas</strong> por golpe.
                  ¿Se ensamblan para formar un solo producto?
                </Alert>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={crearKit}
                      onChange={(e) => setCrearKit(e.target.checked)}
                    />
                  }
                  label="Sí, formar un Kit (pieza ensamblada)"
                  sx={{ mb: 2, display: 'block' }}
                />

                {crearKit && (
                  <Card variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'action.hover' }}>
                    <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
                      <BuildIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                      Kit: {kitNombre || '(sin nombre)'}
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 7 }}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Nombre del Kit"
                          value={kitNombre}
                          onChange={(e) => setKitNombre(e.target.value)}
                          placeholder="Ej: Regadera Completa"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 5 }}>
                        <TextField
                          fullWidth
                          size="small"
                          label="SKU del kit"
                          value="Se asignará automáticamente al guardar"
                          helperText="El backend asignará el siguiente correlativo disponible."
                          slotProps={{ input: { readOnly: true } }}
                        />
                      </Grid>
                    </Grid>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Componentes: {piezas.map(nombrePieza).join(' + ')}
                    </Typography>
                  </Card>
                )}
              </>
            ) : piezas.length > 1 ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Para formar un kit primero selecciona al menos un color. El backend genera un SKU de kit por color.
              </Alert>
            ) : (
              <Alert severity="info" sx={{ mb: 2 }}>
                Solo hay 1 pieza, no se necesita Kit. Continúa al siguiente paso.
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button onClick={handleBack}>Atrás</Button>
              <Button variant="contained" onClick={handleNext} disabled={!isStep3Valid()}>
                Revisar
              </Button>
            </Box>
          </StepContent>
        </Step>

        {/* PASO 5: RESUMEN */}
        <Step>
          <StepLabel>
            <Typography sx={{ fontWeight: 600 }}>Revisar y Crear</Typography>
          </StepLabel>
          <StepContent>
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="subtitle2" color="primary">
                      <PrecisionManufacturingIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                      Molde
                    </Typography>
                    <Typography>
                      {molde.usar_existente 
                        ? `${molde.molde_seleccionado?.codigo} - ${molde.molde_seleccionado?.nombre}`
                        : `${molde.nombre} — código automático al guardar`
                      }
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Peso tiro: {molde.peso_tiro_gr}gr | T. Ciclo: {molde.tiempo_ciclo_std}s
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Clasificación para altas nuevas: {lineaSeleccionada?.nombre} · {familiaSeleccionada?.nombre}
                    </Typography>
                  </Box>
                  
                  <Divider />
                  
                  <Box>
                    <Typography variant="subtitle2" color="primary">
                      <InventoryIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                      Composición Molde–Pieza ({piezas.length})
                    </Typography>
                    {piezas.map((p, i) => (
                      <Chip
                        key={i}
                        label={`${nombrePieza(p)} (${p.cavidades} cav, ${p.peso_unitario_gr}gr)${p.usar_existente ? ' · existente' : ' · nueva'}`}
                        size="small"
                        sx={{ mr: 0.5, mb: 0.5 }}
                      />
                    ))}
                  </Box>

                  <Divider />
                  <Box>
                    <Typography variant="subtitle2" color="primary">
                      <PaletteIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                      Colores de producción ({coloresSeleccionados.length})
                    </Typography>
                    {coloresSeleccionados.length > 0 ? coloresSeleccionados.map((color) => (
                      <Chip key={color.id} label={color.nombre} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                    )) : (
                      <Typography variant="body2" color="warning.main">
                        Sin colores: no se crearán PiezaColor ni kits.
                      </Typography>
                    )}
                  </Box>

                  {crearKit && piezas.length > 1 && coloresSeleccionados.length > 0 && (
                    <>
                      <Divider />
                      <Box>
                        <Typography variant="subtitle2" color="primary">
                          <BuildIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                          Kit
                        </Typography>
                        <Typography variant="body2">
                          {kitNombre} = {piezas.map(nombrePieza).join(' + ')}
                        </Typography>
                      </Box>
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button onClick={handleBack}>Atrás</Button>
              <Button
                variant="contained"
                color="success"
                onClick={handleSubmit}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <CheckCircleIcon />}
              >
                {loading ? 'Creando...' : 'Crear Todo'}
              </Button>
            </Box>
          </StepContent>
        </Step>
      </Stepper>

      {/* RESULTADO */}
      {activeStep === 5 && resultado && (
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <CheckCircleIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom>¡Configuración Completada!</Typography>
          
          <Stack direction="row" spacing={2} justifyContent="center" sx={{ my: 3 }} flexWrap="wrap">
            {resultado.molde_creado ? (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" color="primary">{resultado.molde_creado}</Typography>
                  <Typography variant="body2">Molde creado</Typography>
                </CardContent>
              </Card>
            ) : codigoMoldeReutilizado ? (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" color="info.main">{codigoMoldeReutilizado}</Typography>
                  <Typography variant="body2">Molde reutilizado</Typography>
                </CardContent>
              </Card>
            ) : null}
            {piezasMaestrasNuevas > 0 && (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h4" color="primary">{piezasMaestrasNuevas}</Typography>
                  <Typography variant="body2">Piezas maestras nuevas</Typography>
                </CardContent>
              </Card>
            )}
            {piezasMaestrasReutilizadas > 0 && (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h4" color="info.main">{piezasMaestrasReutilizadas}</Typography>
                  <Typography variant="body2">Piezas maestras reutilizadas</Typography>
                </CardContent>
              </Card>
            )}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h4" color="success.main">{variantesCreadas}</Typography>
                <Typography variant="body2">PiezaColor creadas</Typography>
              </CardContent>
            </Card>
            {variantesReutilizadas > 0 && (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h4" color="info.main">{variantesReutilizadas}</Typography>
                  <Typography variant="body2">PiezaColor reutilizadas</Typography>
                </CardContent>
              </Card>
            )}
            {kitsCreados > 0 && (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h4" color="info.main">{kitsCreados}</Typography>
                  <Typography variant="body2">Kits creados</Typography>
                </CardContent>
              </Card>
            )}
          </Stack>

          {resultado.errores?.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2, textAlign: 'left' }}>
              <Typography variant="subtitle2">Notas:</Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {resultado.errores.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </Alert>
          )}

          <Stack direction="row" spacing={2} justifyContent="center">
            <Button variant="outlined" onClick={() => {
              setActiveStep(0);
              setResultado(null);
              setMolde({ nombre: '', peso_tiro_gr: '', tiempo_ciclo_std: '30', usar_existente: false, molde_seleccionado: null });
              setPiezas([nuevaPiezaVacia()]);
              setCrearKit(false);
              setKitNombre('');
              setColoresSeleccionados([]);
              setLineaSeleccionada(null);
              setFamiliaSeleccionada(null);
              setFamiliasOptions([]);
            }}>
              Crear Otro
            </Button>
            <Button variant="contained" onClick={() => navigate('/produccion/ordenes/nueva-excepcional')}>
              Crear Orden de Producción
            </Button>
          </Stack>
        </Box>
      )}
      <ColorQuickCreateDialog
        open={colorDialogOpen}
        initialName={colorInitialName}
        onClose={() => setColorDialogOpen(false)}
        onCreated={registrarColorCreado}
      />
      <ClassificationQuickCreateDialog
        open={classificationDialog.open}
        entity={classificationDialog.entity}
        linea={lineaSeleccionada}
        initialName={classificationDialog.initialName}
        onClose={() => setClassificationDialog((current) => ({ ...current, open: false }))}
        onCreated={registrarClasificacionCreada}
      />
    </Paper>
  );
}

export default ConfigurarProducto;
