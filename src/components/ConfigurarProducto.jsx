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
import {
  obtenerColores,
  obtenerMoldes,
  configurarProductoCascada,
  obtenerLineas,
  obtenerFamilias
} from '../services/api';

function ConfigurarProducto() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Datos del formulario
  const [molde, setMolde] = useState({
    codigo: '',
    nombre: '',
    peso_tiro_gr: '',
    tiempo_ciclo_std: '30',
    usar_existente: false,
    molde_seleccionado: null
  });
  
  const [piezas, setPiezas] = useState([
    { nombre: '', cavidades: '2', peso_unitario_gr: '', sku_override: '' }
  ]);

  // Kit state (NUEVO)
  const [crearKit, setCrearKit] = useState(false);
  const [kitNombre, setKitNombre] = useState('');
  const [kitSkuOverride, setKitSkuOverride] = useState('');
  
  const [coloresSeleccionados, setColoresSeleccionados] = useState([]);

  const [lineaSeleccionada, setLineaSeleccionada] = useState(null);
  const [familiaSeleccionada, setFamiliaSeleccionada] = useState(null);
  
  // Catálogos
  const [coloresOptions, setColoresOptions] = useState([]);
  const [moldesOptions, setMoldesOptions] = useState([]);
  const [lineasOptions, setLineasOptions] = useState([]);
  const [familiasOptions, setFamiliasOptions] = useState([]);
  const [coloresLoading, setColoresLoading] = useState(false);
  const [moldesLoading, setMoldesLoading] = useState(false);
  const [catalogosLoading, setCatalogosLoading] = useState(false);
  
  // Resultado
  const [resultado, setResultado] = useState(null);

  // Cargar catálogos
  useEffect(() => {
    const cargarCatalogos = async () => {
      try {
        setColoresLoading(true);
        setMoldesLoading(true);
        setCatalogosLoading(true);
        const [coloresRes, moldesRes, lineasRes, familiasRes] = await Promise.all([
          obtenerColores(),
          obtenerMoldes(),
          obtenerLineas(),
          obtenerFamilias()
        ]);
        setColoresOptions(coloresRes || []);
        setMoldesOptions(moldesRes || []);
        setLineasOptions(lineasRes || []);
        setFamiliasOptions(familiasRes || []);
      } catch (err) {
        console.error("Error al cargar catálogos:", err);
        setError("No se pudieron cargar algunos catálogos iniciales.");
      } finally {
        setColoresLoading(false);
        setMoldesLoading(false);
        setCatalogosLoading(false);
      }
    };
    cargarCatalogos();
  }, []);

  // Auto-generar código de molde
  const generarCodigoMolde = (nombre) => {
    if (!nombre) return '';
    const base = nombre.toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9\s]/g, '')
      .split(' ')
      .slice(0, 3)
      .join('-');
    return `MOL-${base}`;
  };

  // Auto-generar nombre del Kit basado en el molde
  useEffect(() => {
    if (crearKit && !kitNombre && molde.nombre) {
      setKitNombre(`${molde.nombre} Completo`);
    }
  }, [crearKit, molde.nombre]);

  // Handlers
  const handleMoldeChange = (field, value) => {
    setMolde(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'nombre' && !prev.usar_existente) {
        updated.codigo = generarCodigoMolde(value);
      }
      return updated;
    });
  };

  const handlePiezaChange = (index, field, value) => {
    setPiezas(prev => prev.map((p, i) => 
      i === index ? { ...p, [field]: value } : p
    ));
  };

  const addPieza = () => {
    setPiezas(prev => [...prev, { nombre: '', cavidades: '2', peso_unitario_gr: '', sku_override: '' }]);
  };

  const removePieza = (index) => {
    if (piezas.length > 1) {
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
    setLoading(true);
    setError(null);
    
    try {
      const payload = {
        molde: {
          codigo: molde.usar_existente ? molde.molde_seleccionado?.codigo : molde.codigo,
          nombre: molde.usar_existente ? molde.molde_seleccionado?.nombre : molde.nombre,
          peso_tiro_gr: parseFloat(molde.peso_tiro_gr) || 0,
          tiempo_ciclo_std: parseFloat(molde.tiempo_ciclo_std) || 30,
          usar_existente: molde.usar_existente
        },
        formas: piezas.map(p => ({
          nombre: p.nombre,
          cavidades: parseInt(p.cavidades) || 1,
          peso_unitario_gr: parseFloat(p.peso_unitario_gr) || 0,
          sku_override: p.sku_override || null
        })),
        // Kit (solo si se activó y hay >1 pieza)
        kit: (crearKit && piezas.length > 1) ? {
          nombre: kitNombre,
          sku_override: kitSkuOverride || null
        } : null,
        color_ids: coloresSeleccionados.map(c => c.id),

        linea_id: lineaSeleccionada?.id || 0,
        familia_id: familiaSeleccionada?.id || 0
      };
      
      const response = await configurarProductoCascada(payload);
      setResultado(response.resultado);
      setActiveStep(5); // Ir al paso de resultado
    } catch (err) {
      setError(err.response?.data?.error || 'Error creando configuración');
    } finally {
      setLoading(false);
    }
  };

  // Validaciones por paso
  const isStep0Valid = () => {
    if (molde.usar_existente) {
      return !!molde.molde_seleccionado;
    }
    return molde.codigo && molde.nombre && molde.peso_tiro_gr && lineaSeleccionada && familiaSeleccionada;
  };

  const isStep1Valid = () => {
    return piezas.every(p => p.nombre && p.cavidades && p.peso_unitario_gr);
  };

  const isStep2Valid = () => {
    return true; // Colors are optional
  };

  // Kit step siempre es válido (es opcional)
  const isStep3Valid = () => true;

  // Calcular peso total estimado
  const pesoNetoCalculado = piezas.reduce((sum, p) => {
    return sum + (parseFloat(p.peso_unitario_gr) || 0) * (parseInt(p.cavidades) || 1);
  }, 0);

  return (
    <Paper sx={{ p: 4, maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        <PrecisionManufacturingIcon /> Configuración Rápida de Producto
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Crea Molde + Pieza(s) + Kit (opcional) + Productos en una sola operación
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
            <Typography sx={{ fontWeight: 600 }}>Configurar Molde</Typography>
          </StepLabel>
          <StepContent>
            <Box sx={{ mb: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={molde.usar_existente}
                    onChange={(e) => handleMoldeChange('usar_existente', e.target.checked)}
                  />
                }
                label="Usar molde existente"
              />
              
              {molde.usar_existente ? (
                <Autocomplete
                  options={moldesOptions}
                  getOptionLabel={(opt) => `${opt.codigo} - ${opt.nombre}`}
                  loading={moldesLoading}
                  value={molde.molde_seleccionado}
                  onChange={(_, newVal) => handleMoldeChange('molde_seleccionado', newVal)}
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
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Nombre del Molde"
                      value={molde.nombre}
                      onChange={(e) => handleMoldeChange('nombre', e.target.value)}
                      placeholder="Ej: Balde Playero 5L"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Código"
                      value={molde.codigo}
                      onChange={(e) => handleMoldeChange('codigo', e.target.value)}
                      placeholder="Auto-generado"
                      helperText="Se genera automáticamente"
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField
                      fullWidth
                      label="Peso Tiro (gr)"
                      type="number"
                      value={molde.peso_tiro_gr}
                      onChange={(e) => handleMoldeChange('peso_tiro_gr', e.target.value)}
                      helperText="Peso total del golpe"
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField
                      fullWidth
                      label="T. Ciclo (seg)"
                      type="number"
                      value={molde.tiempo_ciclo_std}
                      onChange={(e) => handleMoldeChange('tiempo_ciclo_std', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Autocomplete
                      options={lineasOptions}
                      getOptionLabel={(opt) => opt.nombre}
                      loading={catalogosLoading}
                      value={lineaSeleccionada}
                      onChange={(_, newVal) => setLineaSeleccionada(newVal)}
                      renderInput={(params) => (
                        <TextField {...params} label="Línea" required />
                      )}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Autocomplete
                      options={familiasOptions}
                      getOptionLabel={(opt) => opt.nombre}
                      loading={catalogosLoading}
                      value={familiaSeleccionada}
                      onChange={(_, newVal) => setFamiliaSeleccionada(newVal)}
                      renderInput={(params) => (
                        <TextField {...params} label="Familia" required />
                      )}
                    />
                  </Grid>
                </Grid>
              )}
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

        {/* PASO 2: FORMAS */}
        <Step>
          <StepLabel>
            <Typography sx={{ fontWeight: 600 }}>Definir Formas ({piezas.length})</Typography>
          </StepLabel>
          <StepContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Define las formas físicas (cavidades puras) que produce este molde por golpe
            </Typography>
            
            {piezas.map((pieza, index) => (
              <Card key={index} variant="outlined" sx={{ mb: 2, p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" color="primary">
                    Forma {index + 1}
                  </Typography>
                  {piezas.length > 1 && (
                    <IconButton size="small" color="error" onClick={() => removePieza(index)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={5}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Nombre de la Forma"
                      value={pieza.nombre}
                      onChange={(e) => handlePiezaChange(index, 'nombre', e.target.value)}
                      placeholder="Ej: Tapa Regadera"
                    />
                  </Grid>
                  <Grid item xs={6} sm={2}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Cavidades"
                      type="number"
                      value={pieza.cavidades}
                      onChange={(e) => handlePiezaChange(index, 'cavidades', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={6} sm={2}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Peso (gr)"
                      type="number"
                      value={pieza.peso_unitario_gr}
                      onChange={(e) => handlePiezaChange(index, 'peso_unitario_gr', e.target.value)}
                      helperText="Por unidad"
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      size="small"
                      label="SKU (opcional)"
                      value={pieza.sku_override}
                      onChange={(e) => handlePiezaChange(index, 'sku_override', e.target.value)}
                      placeholder="Auto-generado"
                    />
                  </Grid>
                </Grid>
              </Card>
            ))}

            <Button
              startIcon={<AddCircleIcon />}
              onClick={addPieza}
              sx={{ mb: 2 }}
            >
              Agregar Otra Forma
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

        {/* PASO 3: COLORES DE INYECCIÓN (NUEVO) */}
        <Step>
          <StepLabel>
            <Typography sx={{ fontWeight: 600 }}>Colores de Inyección</Typography>
          </StepLabel>
          <StepContent>
            <Box sx={{ mb: 2 }}>
              <Autocomplete
                multiple
                options={coloresOptions}
                getOptionLabel={(opt) => opt.nombre}
                loading={coloresLoading}
                value={coloresSeleccionados}
                onChange={(_, newVal) => setColoresSeleccionados(newVal)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Colores (opcional)"
                    placeholder="Selecciona colores para crear SKUs..."
                    helperText="Si seleccionas colores, se crearán Piezas Color (SKUs físicos) vinculadas a las formas"
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      key={option.id}
                      label={option.nombre}
                      icon={<PaletteIcon />}
                      size="small"
                    />
                  ))
                }
              />
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
              Formar Kit {piezas.length <= 1 && '(no aplica)'}
            </Typography>
          </StepLabel>
          <StepContent>
            {piezas.length > 1 ? (
              <>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Tu molde produce <strong>{piezas.length} formas</strong> por golpe. 
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
                      <Grid item xs={12} sm={7}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Nombre del Kit"
                          value={kitNombre}
                          onChange={(e) => setKitNombre(e.target.value)}
                          placeholder="Ej: Regadera Completa"
                        />
                      </Grid>
                      <Grid item xs={12} sm={5}>
                        <TextField
                          fullWidth
                          size="small"
                          label="SKU Kit (opcional)"
                          value={kitSkuOverride}
                          onChange={(e) => setKitSkuOverride(e.target.value)}
                          placeholder="Auto-generado"
                        />
                      </Grid>
                    </Grid>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Componentes: {piezas.map(p => p.nombre || '?').join(' + ')}
                    </Typography>
                  </Card>
                )}
              </>
            ) : (
              <Alert severity="info" sx={{ mb: 2 }}>
                Solo hay 1 forma, no se necesita Kit. Continúa al siguiente paso.
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button onClick={handleBack}>Atrás</Button>
              <Button variant="contained" onClick={handleNext}>
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
                        : `${molde.codigo} - ${molde.nombre}`
                      }
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Peso tiro: {molde.peso_tiro_gr}gr | T. Ciclo: {molde.tiempo_ciclo_std}s
                    </Typography>
                  </Box>
                  
                  <Divider />
                  
                  <Box>
                    <Typography variant="subtitle2" color="primary">
                      <InventoryIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                      Formas ({piezas.length})
                    </Typography>
                    {piezas.map((p, i) => (
                      <Chip
                        key={i}
                        label={`${p.nombre} (${p.cavidades} cav, ${p.peso_unitario_gr}gr)`}
                        size="small"
                        sx={{ mr: 0.5, mb: 0.5 }}
                      />
                    ))}
                  </Box>

                  {crearKit && piezas.length > 1 && (
                    <>
                      <Divider />
                      <Box>
                        <Typography variant="subtitle2" color="primary">
                          <BuildIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                          Kit
                        </Typography>
                        <Typography variant="body2">
                          {kitNombre} = {piezas.map(p => p.nombre || '?').join(' + ')}
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
            {resultado.molde_creado && (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h4" color="primary">1</Typography>
                  <Typography variant="body2">Molde Creado</Typography>
                </CardContent>
              </Card>
            )}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h4" color="success.main">
                  {resultado.piezas_creadas?.length || 0}
                </Typography>
                <Typography variant="body2">Piezas Creadas</Typography>
              </CardContent>
            </Card>
            {resultado.kit_creado && (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h4" color="info.main">1</Typography>
                  <Typography variant="body2">Kit Creado</Typography>
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
              setMolde({ codigo: '', nombre: '', peso_tiro_gr: '', tiempo_ciclo_std: '30', usar_existente: false, molde_seleccionado: null });
              setPiezas([{ nombre: '', cavidades: '2', peso_unitario_gr: '', sku_override: '' }]);
              setCrearKit(false);
              setKitNombre('');
              setKitSkuOverride('');
              setColoresSeleccionados([]);
            }}>
              Crear Otro
            </Button>
            <Button variant="contained" onClick={() => navigate('/ordenes/nueva')}>
              Crear Orden de Producción
            </Button>
          </Stack>
        </Box>
      )}
    </Paper>
  );
}

export default ConfigurarProducto;
