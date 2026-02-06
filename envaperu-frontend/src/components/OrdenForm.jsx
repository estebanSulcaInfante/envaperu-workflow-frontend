import { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Divider,
  Alert,
  Snackbar,
  Chip,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Tooltip,
  InputAdornment,
  Autocomplete,
  Stack,
  LinearProgress
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PaletteIcon from '@mui/icons-material/Palette';
import LockIcon from '@mui/icons-material/Lock';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CalculateIcon from '@mui/icons-material/Calculate';
import { crearOrden, buscarProductos, obtenerPiezasProducibles, obtenerColores, validarOrdenPrereq, crearColor, obtenerMaquinas, obtenerProducto } from '../services/api';

const initialOrden = {
  numero_op: '',
  maquina_id: '',
  tipo_maquina: '',
  producto: '',
  producto_sku: '', // SKU del producto seleccionado
  molde: '',
  molde_id: '', // Código del molde seleccionado
  tipo_estrategia: 'POR_PESO',
  meta_total_kg: '',
  meta_total_doc: '',
  tipo_cambio: '',
  peso_unitario_gr: '',
  peso_inc_colada: '',
  cavidades: '',
  tiempo_ciclo: '',
  horas_turno: '24',
  fecha_inicio: new Date().toISOString().slice(0, 16),
  lotes: []
};

const initialLote = {
  color_id: null, // Nuevo campo FK
  color_nombre: '',
  personas: 1,
  stock_kg_manual: '',
  materiales: [],
  pigmentos: []
};

const STORAGE_KEY = 'envaperu_orden_form_draft';

function OrdenForm({ onOrdenCreada }) {
  const [orden, setOrden] = useState(() => {
    // Cargar datos guardados de localStorage al iniciar
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('💾 Borrador recuperado de localStorage');
        return { ...initialOrden, ...parsed };
      }
    } catch (e) {
      console.error('Error cargando borrador:', e);
    }
    return initialOrden;
  });

  // Auto-guardar en localStorage cada vez que cambia el formulario
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orden));
    } catch (e) {
      console.error('Error guardando borrador:', e);
    }
  }, [orden]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // Estado para Autocomplete de Productos
  const [productosOptions, setProductosOptions] = useState([]);
  const [productosLoading, setProductosLoading] = useState(false);
  const [productoInputValue, setProductoInputValue] = useState('');

  // Estado para Autocomplete de Piezas/Moldes
  const [piezasProducibles, setPiezasProducibles] = useState([]);
  const [piezasLoading, setPiezasLoading] = useState(false);
  
  // Estado para Colores
  const [coloresOptions, setColoresOptions] = useState([]);
  const [coloresLoading, setColoresLoading] = useState(false);

  // Estado para Pre-validación
  const [validationResult, setValidationResult] = useState(null);
  const [validationLoading, setValidationLoading] = useState(false);

  // Estado para Máquinas
  const [maquinasOptions, setMaquinasOptions] = useState([]);
  const [maquinasLoading, setMaquinasLoading] = useState(false);

  // Estado de Errores de Validación
  const [errors, setErrors] = useState({});

  // Estado de Piezas Filtradas (Cascada)
  const [filteredPiezas, setFilteredPiezas] = useState([]);

  // Fetch product details when selected for cascading logic
  useEffect(() => {
    const filterAndAutoSelect = async () => {
      // Si no hay producto, mostrar todas las piezas
      if (!orden.producto_sku) {
        setFilteredPiezas(piezasProducibles);
        return;
      }
      
      try {
        const prodDetails = await obtenerProducto(orden.producto_sku);
        
        if (prodDetails && prodDetails.piezas) {
            const pieceSkus = prodDetails.piezas.map(p => p.sku);
            const filtradas = piezasProducibles.filter(p => pieceSkus.includes(p.sku));
            setFilteredPiezas(filtradas);
            
            // Auto-select si solo hay 1
            if (filtradas.length === 1) {
                const p = filtradas[0];
                setOrden(prev => ({
                    ...prev,
                    molde: p.molde ? p.molde.nombre : '',
                    molde_id: p.molde ? p.molde.codigo : '',
                    peso_unitario_gr: p.peso_unitario_gr, // De la pieza
                    cavidades: p.cavidades,
                    tipo_estrategia: 'POR_PESO' // Default
                }));
            }
        }
      } catch (err) {
        console.error("Error cascading product details:", err);
        setFilteredPiezas(piezasProducibles); // Fallback
      }
    };
    
    if (piezasProducibles.length > 0) {
        filterAndAutoSelect();
    }
  }, [orden.producto_sku, piezasProducibles]);

  // Fetch piezas producibles, máquinas y colores al cargar
  useEffect(() => {
    const fetchPiezasProducibles = async () => {
      setPiezasLoading(true);
      try {
        const piezas = await obtenerPiezasProducibles();
        setPiezasProducibles(piezas);
      } catch (error) {
        console.error('Error cargando piezas producibles:', error);
      } finally {
        setPiezasLoading(false);
      }
    };
    
    const fetchMaquinas = async () => {
      setMaquinasLoading(true);
      try {
        const data = await obtenerMaquinas();
        setMaquinasOptions(data);
      } catch (error) {
        console.error('Error cargando maquinas:', error);
      } finally {
        setMaquinasLoading(false);
      }
    };
    
    const fetchColores = async () => {
        setColoresLoading(true);
        try {
            const colores = await obtenerColores();
            setColoresOptions(colores);
        } catch (error) {
            console.error("Error cargando colores:", error);
        } finally {
            setColoresLoading(false);
        }
    };

    fetchPiezasProducibles();
    fetchMaquinas();
    fetchColores();
  }, []);

  const validateForm = () => {
    const newErrors = {};
    if (!orden.numero_op) newErrors.numero_op = 'Requerido';
    if (!orden.maquina_id) newErrors.maquina_id = 'Requerido';
    if (!orden.producto_sku) newErrors.producto = 'Requerido';
    if (!orden.molde_id) newErrors.molde = 'Requerido para parámetros técnicos';
    
    if (orden.meta_total_kg && parseFloat(orden.meta_total_kg) <= 0) newErrors.meta_total_kg = 'Debe ser mayor a 0';
    
    setErrors(newErrors);
    // Return true if NO errors
    return Object.keys(newErrors).length === 0;
  };

  // Fetch productos cuando cambia el input (debounced)
  useEffect(() => {
    if (productoInputValue.length < 2) {
      setProductosOptions([]);
      return;
    }
    const timeoutId = setTimeout(async () => {
      setProductosLoading(true);
      try {
        const productos = await buscarProductos(productoInputValue);
        setProductosOptions(productos);
      } catch (error) {
        console.error('Error buscando productos:', error);
        setProductosOptions([]);
      } finally {
        setProductosLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [productoInputValue]);

  // Pre-validación cuando cambia molde o lotes
  useEffect(() => {
    const validatePrereq = async () => {
      if (!orden.molde_id) {
        setValidationResult(null);
        return;
      }
      
      setValidationLoading(true);
      try {
        const colorIds = orden.lotes
          .map(l => l.color_id)
          .filter(id => id !== null);
        
        const result = await validarOrdenPrereq(orden.molde_id, colorIds);
        setValidationResult(result);
      } catch (err) {
        console.error('Error validando pre-requisitos:', err);
        setValidationResult(null);
      } finally {
        setValidationLoading(false);
      }
    };
    
    const timer = setTimeout(validatePrereq, 500); // Debounce
    return () => clearTimeout(timer);
  }, [orden.molde_id, orden.lotes]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setOrden(prev => ({ ...prev, [name]: value }));
  };

  const handleAddLote = () => {
    setOrden(prev => ({
      ...prev,
      lotes: [...prev.lotes, { ...initialLote }]
    }));
  };

  const handleRemoveLote = (index) => {
    setOrden(prev => ({
      ...prev,
      lotes: prev.lotes.filter((_, i) => i !== index)
    }));
  };

  const handleLoteChange = (index, field, value) => {
    setOrden(prev => ({
      ...prev,
      lotes: prev.lotes.map((lote, i) => 
        i === index ? { ...lote, [field]: value } : lote
      )
    }));
  };

  const handleAddMaterial = (loteIndex) => {
    setOrden(prev => ({
      ...prev,
      lotes: prev.lotes.map((lote, i) => 
        i === loteIndex 
          ? { ...lote, materiales: [...lote.materiales, { nombre: '', tipo: 'VIRGEN', fraccion: '' }] }
          : lote
      )
    }));
  };

  const handleRemoveMaterial = (loteIndex, matIndex) => {
    setOrden(prev => ({
      ...prev,
      lotes: prev.lotes.map((lote, i) => 
        i === loteIndex 
          ? { ...lote, materiales: lote.materiales.filter((_, j) => j !== matIndex) }
          : lote
      )
    }));
  };

  const handleMaterialChange = (loteIndex, matIndex, field, value) => {
    setOrden(prev => ({
      ...prev,
      lotes: prev.lotes.map((lote, i) => 
        i === loteIndex 
          ? { 
              ...lote, 
              materiales: lote.materiales.map((mat, j) => 
                j === matIndex ? { ...mat, [field]: value } : mat
              ) 
            }
          : lote
      )
    }));
  };

  const handleAddPigmento = (loteIndex) => {
    setOrden(prev => ({
      ...prev,
      lotes: prev.lotes.map((lote, i) => 
        i === loteIndex 
          ? { ...lote, pigmentos: [...lote.pigmentos, { nombre: '', gramos: '' }] }
          : lote
      )
    }));
  };

  const handleRemovePigmento = (loteIndex, pigIndex) => {
    setOrden(prev => ({
      ...prev,
      lotes: prev.lotes.map((lote, i) => 
        i === loteIndex 
          ? { ...lote, pigmentos: lote.pigmentos.filter((_, j) => j !== pigIndex) }
          : lote
      )
    }));
  };

  const handlePigmentoChange = (loteIndex, pigIndex, field, value) => {
    setOrden(prev => ({
      ...prev,
      lotes: prev.lotes.map((lote, i) => 
        i === loteIndex 
          ? { 
              ...lote, 
              pigmentos: lote.pigmentos.map((pig, j) => 
                j === pigIndex ? { ...pig, [field]: value } : pig
              ) 
            }
          : lote
      )
    }));
  };

  const preparePayload = () => {
    return {
      ...orden,
      producto_sku: orden.producto_sku || null,
      meta_total_kg: orden.meta_total_kg ? parseFloat(orden.meta_total_kg) : null,
      meta_total_doc: orden.meta_total_doc ? parseFloat(orden.meta_total_doc) : null,
      tipo_cambio: orden.tipo_cambio ? parseFloat(orden.tipo_cambio) : null,
      snapshot_peso_unitario_gr: orden.peso_unitario_gr ? parseFloat(orden.peso_unitario_gr) : null,
      snapshot_peso_inc_colada: orden.peso_inc_colada ? parseFloat(orden.peso_inc_colada) : null,
      snapshot_cavidades: orden.cavidades ? parseInt(orden.cavidades) : null,
      snapshot_tiempo_ciclo: orden.tiempo_ciclo ? parseFloat(orden.tiempo_ciclo) : null,
      snapshot_horas_turno: orden.horas_turno ? parseFloat(orden.horas_turno) : 24,
      lotes: orden.lotes.map(lote => ({
        ...lote,
        color_id: lote.color_id, // ENVIAR ID
        personas: parseInt(lote.personas) || 1,
        stock_kg_manual: lote.stock_kg_manual ? parseFloat(lote.stock_kg_manual) : null,
        materiales: lote.materiales.map(mat => ({
          nombre: mat.nombre,
          tipo: mat.tipo || 'VIRGEN',
          fraccion: parseFloat(mat.fraccion)
        })),
        pigmentos: lote.pigmentos.map(pig => ({
          nombre: pig.nombre,
          gramos: parseFloat(pig.gramos)
        }))
      }))
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
        setSnackbar({ open: true, message: 'Faltan campos requeridos', severity: 'error' });
        return;
    }

    setLoading(true);
    
    try {
      const payload = preparePayload();
      await crearOrden(payload);
      setSnackbar({ open: true, message: '¡Orden creada exitosamente!', severity: 'success' });
      // Limpiar borrador de localStorage tras éxito
      localStorage.removeItem(STORAGE_KEY);
      setOrden(initialOrden);
      if (onOrdenCreada) onOrdenCreada();
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Error al crear la orden';
      setSnackbar({ open: true, message: errorMsg, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Limpiar formulario y borrador
  const handleClearForm = () => {
    localStorage.removeItem(STORAGE_KEY);
    setOrden(initialOrden);
    setValidationResult(null);
    setProductoInputValue('');
    setSnackbar({ open: true, message: 'Formulario limpiado', severity: 'info' });
  };

  // Cálculos dinámicos basados en los parámetros actuales
  const calcularEstimaciones = () => {
    const peso = parseFloat(orden.peso_unitario_gr) || 0;
    const cavidades = parseInt(orden.cavidades) || 0;
    const tiempoCiclo = parseFloat(orden.tiempo_ciclo) || 0;
    const horasTurno = parseFloat(orden.horas_turno) || 24;
    const metaKg = parseFloat(orden.meta_total_kg) || 0;
    const metaDoc = parseFloat(orden.meta_total_doc) || 0;
    
    // Ciclos por hora = 3600 / tiempo_ciclo
    const ciclosPorHora = tiempoCiclo > 0 ? 3600 / tiempoCiclo : 0;
    
    // Piezas por hora = ciclos/hora × cavidades
    const piezasPorHora = ciclosPorHora * cavidades;
    
    // Docenas por hora = piezas/hora / 12
    const docenasPorHora = piezasPorHora / 12;
    
    // Kg por hora = piezas/hora × peso / 1000
    const kgPorHora = (piezasPorHora * peso) / 1000;
    
    // Capacidad diaria (24h)
    const kgDia = kgPorHora * horasTurno;
    const docDia = docenasPorHora * horasTurno;
    
    // Tiempo estimado para cumplir meta
    let tiempoEstimadoHoras = 0;
    if (orden.tipo_estrategia === 'POR_PESO' && metaKg > 0 && kgPorHora > 0) {
      tiempoEstimadoHoras = metaKg / kgPorHora;
    } else if (orden.tipo_estrategia === 'POR_CANTIDAD' && metaDoc > 0 && docenasPorHora > 0) {
      tiempoEstimadoHoras = metaDoc / docenasPorHora;
    }
    
    return {
      ciclosPorHora: ciclosPorHora.toFixed(1),
      piezasPorHora: piezasPorHora.toFixed(0),
      docenasPorHora: docenasPorHora.toFixed(1),
      kgPorHora: kgPorHora.toFixed(2),
      kgDia: kgDia.toFixed(1),
      docDia: docDia.toFixed(0),
      tiempoEstimadoHoras: tiempoEstimadoHoras.toFixed(1),
      tiempoEstimadoDias: (tiempoEstimadoHoras / horasTurno).toFixed(1),
      esValido: peso > 0 && cavidades > 0 && tiempoCiclo > 0
    };
  };
  
  const estimaciones = calcularEstimaciones();

  return (
    <Paper 
      component="form" 
      onSubmit={handleSubmit}
      sx={{ 
        p: 4, 
        background: '#FFFFFF',
        border: '1px solid #E0E0E0',
        borderRadius: 2,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}
    >
      {/* Header corporativo */}
      <Box sx={{ 
        mb: 4, 
        pb: 2, 
        borderBottom: '1px solid #E0E0E0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Typography variant="h5" sx={{ 
          fontWeight: 700,
          background: 'linear-gradient(135deg, #1E3A5F 0%, #0D2137 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Nueva Orden de Producción
        </Typography>
        <Button
          variant="outlined"
          color="warning"
          size="small"
          onClick={handleClearForm}
          startIcon={<DeleteOutlineIcon />}
        >
          Limpiar Formulario
        </Button>
      </Box>
      
      <Divider sx={{ my: 2, borderColor: '#E0E0E0' }} />

      {/* Pre-validation Banner */}
      {validationLoading && <LinearProgress sx={{ mb: 2 }} />}
      {validationResult && !validationLoading && (
        <Box sx={{ mb: 2 }}>
          {validationResult.errors.map((err, i) => (
            <Alert key={`err-${i}`} severity="error" sx={{ mb: 1 }}>
              {err}
            </Alert>
          ))}
          {validationResult.warnings.map((warn, i) => (
            <Alert key={`warn-${i}`} severity="warning" sx={{ mb: 1 }}>
              {warn}
            </Alert>
          ))}
          {validationResult.valid && validationResult.warnings.length === 0 && validationResult.errors.length === 0 && (
            <Alert severity="success" icon={<CheckCircleIcon />}>
              ✅ Todos los requisitos cumplidos - Molde: {validationResult.molde?.nombre} ({validationResult.molde?.piezas_count} piezas)
            </Alert>
          )}
        </Box>
      )}

      {/* Layout Compacto: 3 Cards con Flexbox */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
        {/* Card 1: Identidad */}
        <Paper sx={{ p: 1.5, background: '#FAFAFA', border: '1px solid #E0E0E0', flex: '1 1 280px', minWidth: 0 }}>
          <Typography variant="subtitle2" color="primary" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
            📋 Identidad
          </Typography>
          <Stack spacing={1}>
            <TextField
              fullWidth
              label="Número OP"
              name="numero_op"
              value={orden.numero_op}
              onChange={handleChange}
              required
              error={!!errors.numero_op}
              helperText={errors.numero_op}
              size="small"
              placeholder="Ej: OP-24-001"
            />
            {/* Selector de Máquina */}
            <FormControl fullWidth size="small" error={!!errors.maquina_id}>
              <InputLabel>Máquina</InputLabel>
              <Select
                name="maquina_id"
                label="Máquina"
                value={orden.maquina_id || ''}
                onChange={(e) => {
                  const maqId = e.target.value;
                  const maqObj = maquinasOptions.find(m => m.id === maqId);
                  setOrden(prev => ({
                    ...prev,
                    maquina_id: maqId,
                    tipo_maquina: maqObj ? maqObj.tipo : prev.tipo_maquina
                  }));
                }}
                disabled={maquinasLoading}
              >
                {maquinasLoading ? (
                  <MenuItem disabled>Cargando...</MenuItem>
                ) : (
                  maquinasOptions.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      {m.nombre} ({m.tipo})
                    </MenuItem>
                  ))
                )}
              </Select>
              {errors.maquina_id && <Typography variant="caption" color="error">{errors.maquina_id}</Typography>}
            </FormControl>
            
            <TextField
              fullWidth
              label="Tipo Máquina"
              name="tipo_maquina"
              value={orden.tipo_maquina}
              onChange={handleChange}
              size="small"
              disabled // Auto-rellenado
              InputProps={{
                startAdornment: <InputAdornment position="start">🏭</InputAdornment>,
              }}
            />
          </Stack>
        </Paper>

        {/* Card 2: Producto & Molde */}
        <Paper sx={{ p: 1.5, background: '#FAFAFA', border: '1px solid #E0E0E0', flex: '1 1 280px', minWidth: 0 }}>
          <Typography variant="subtitle2" color="primary" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
            🏭 Producto & Molde
          </Typography>
          <Stack spacing={1}>
            <Autocomplete
              freeSolo
              forcePopupIcon
              options={productosOptions}
              value={orden.producto || null}
              getOptionLabel={(option) => {
                // Si es string, retornarlo tal cual
                if (typeof option === 'string') return option;
                // Si es objeto, usar el formato deseado
                return `${option.producto} (${option.cod_sku_pt})`;
              }}
              loading={productosLoading}
              inputValue={productoInputValue}
              onInputChange={(_, newInputValue) => {
                setProductoInputValue(newInputValue);
              }}
              onChange={(_, newValue) => {
                if (newValue && typeof newValue === 'object') {
                  setOrden(prev => ({
                    ...prev,
                    producto: newValue.producto,
                    producto_sku: newValue.cod_sku_pt,
                    peso_unitario_gr: newValue.peso_g ? String(newValue.peso_g) : prev.peso_unitario_gr
                  }));
                  // Filter pieces based on selected product using useEffect
                  // const filtered = piezasProducibles.filter(p => p.producto_sku === newValue.cod_sku_pt);
                  // setFilteredPiezas(filtered);
                } else {
                  setOrden(prev => ({ ...prev, producto: newValue || '', producto_sku: '' }));
                  setFilteredPiezas([]); // Clear filter if no product selected
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Producto"
                  size="small"
                  placeholder="Buscar producto (min. 2 caracteres)..."
                  error={!!errors.producto}
                  helperText={errors.producto || "Escriba para buscar productos"}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {productosLoading ? <CircularProgress color="inherit" size={18} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option.cod_sku_pt}>
                  <Box>
                    <Typography variant="body2">{option.producto}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.cod_sku_pt} | {option.familia}
                    </Typography>
                  </Box>
                </li>
              )}
            />
            <Autocomplete
              options={filteredPiezas.length > 0 ? filteredPiezas : piezasProducibles}
              getOptionLabel={(option) => 
                typeof option === 'string' ? option : option.nombre || ''
              }
              loading={piezasLoading}
              value={
                // Buscar por nombre de pieza (orden.molde guarda el nombre) o código
                piezasProducibles.find(p => p.nombre === orden.molde || p.sku === orden.molde_id) || null
              }
              onChange={(_, newValue) => {
                if (newValue && typeof newValue === 'object') {
                  setOrden(prev => ({ 
                    ...prev, 
                    molde: newValue.nombre,
                    molde_id: newValue.molde?.codigo || newValue.sku, // Prefer Mold Code, fallback to SKU if direct
                    cavidades: newValue.cavidades ? String(newValue.cavidades) : prev.cavidades,
                    peso_unitario_gr: newValue.peso_unitario_gr ? String(newValue.peso_unitario_gr) : prev.peso_unitario_gr,
                    peso_inc_colada: newValue.molde?.peso_tiro_gr ? String(newValue.molde.peso_tiro_gr) : prev.peso_inc_colada,
                    tiempo_ciclo: newValue.molde?.tiempo_ciclo_std ? String(newValue.molde.tiempo_ciclo_std) : prev.tiempo_ciclo
                  }));
                } else {
                  setOrden(prev => ({ ...prev, molde: '', molde_id: '' }));
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Pieza / Molde"
                  size="small"
                  placeholder="Seleccionar pieza producible..."
                  helperText={errors.molde || (filteredPiezas.length > 0 && filteredPiezas.length < piezasProducibles.length ? "Filtrado por Producto" : "Solo piezas asociadas a un molde")}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {piezasLoading ? <CircularProgress color="inherit" size={18} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option.sku}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{option.nombre}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.sku} | Molde: {option.molde?.nombre || '-'} | {option.cavidades} cav × {option.peso_unitario_gr}g
                    </Typography>
                  </Box>
                </li>
              )}
              isOptionEqualToValue={(option, value) => option.sku === value?.sku}
            />
          </Stack>
        </Paper>

        {/* Card 3: Estrategia */}
        <Paper sx={{ p: 1.5, background: '#FAFAFA', border: '1px solid #E0E0E0', flex: '1 1 280px', minWidth: 0 }}>
          <Typography variant="subtitle2" color="primary" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
            🎯 Estrategia
          </Typography>
          <Stack spacing={1}>
            <FormControl fullWidth size="small">
              <InputLabel>Tipo Estrategia</InputLabel>
              <Select
                name="tipo_estrategia"
                value={orden.tipo_estrategia}
                onChange={handleChange}
                label="Tipo Estrategia"
              >
                <MenuItem value="POR_PESO">Por Peso (Kg)</MenuItem>
                <MenuItem value="POR_CANTIDAD">Por Cantidad (Doc)</MenuItem>
                <MenuItem value="STOCK">Stock Manual</MenuItem>
              </Select>
            </FormControl>
            <Tooltip 
              title={orden.tipo_estrategia !== 'POR_PESO' ? 'Solo con estrategia "Por Peso"' : ''}
              placement="top"
              arrow
            >
              <TextField
                fullWidth
                label="Meta Total (Kg)"
                name="meta_total_kg"
                type="number"
                value={orden.meta_total_kg}
                onChange={handleChange}
                size="small"
                disabled={orden.tipo_estrategia !== 'POR_PESO'}
                InputProps={{
                  endAdornment: orden.tipo_estrategia !== 'POR_PESO' ? (
                    <InputAdornment position="end">
                      <LockIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                    </InputAdornment>
                  ) : null
                }}
              />
            </Tooltip>
            <Tooltip 
              title={orden.tipo_estrategia !== 'POR_CANTIDAD' ? 'Solo con estrategia "Por Cantidad"' : ''}
              placement="top"
              arrow
            >
              <TextField
                fullWidth
                label="Meta Total (Doc)"
                name="meta_total_doc"
                type="number"
                value={orden.meta_total_doc}
                onChange={handleChange}
                size="small"
                disabled={orden.tipo_estrategia !== 'POR_CANTIDAD'}
                InputProps={{
                  endAdornment: orden.tipo_estrategia !== 'POR_CANTIDAD' ? (
                    <InputAdornment position="end">
                      <LockIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                    </InputAdornment>
                  ) : null
                }}
              />
            </Tooltip>
          </Stack>
        </Paper>
      </Box>

      {/* Fila: Parámetros Técnicos + Fechas */}
      <Paper sx={{ p: 1.5, mb: 2, background: '#FAFAFA', border: '1px solid #E0E0E0' }}>
        <Typography variant="subtitle2" color="primary" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
          ⚙️ Parámetros Técnicos
        </Typography>
        <Grid container spacing={1}>
          <Grid item xs={6} sm={4} md={2}>
            <TextField
              fullWidth
              label="Peso Unit. (gr)"
              name="peso_unitario_gr"
              type="number"
              value={orden.peso_unitario_gr}
              onChange={handleChange}
              size="small"
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <TextField
              fullWidth
              label="Peso Inc. (gr)"
              name="peso_inc_colada"
              type="number"
              value={orden.peso_inc_colada}
              onChange={handleChange}
              size="small"
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <TextField
              fullWidth
              label="Cavidades"
              name="cavidades"
              type="number"
              value={orden.cavidades}
              onChange={handleChange}
              size="small"
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <TextField
              fullWidth
              label="T. Ciclo (seg)"
              name="tiempo_ciclo"
              type="number"
              value={orden.tiempo_ciclo}
              onChange={handleChange}
              size="small"
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <TextField
              fullWidth
              label="Horas Turno"
              name="horas_turno"
              type="number"
              value={orden.horas_turno}
              onChange={handleChange}
              size="small"
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <TextField
              fullWidth
              label="Fecha Inicio"
              name="fecha_inicio"
              type="datetime-local"
              value={orden.fecha_inicio}
              onChange={handleChange}
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Panel de Cálculos Dinámicos */}
      {estimaciones.esValido && (
        <Paper sx={{ p: 1.5, mb: 2, background: 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)', border: '1px solid #81C784' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <CalculateIcon sx={{ color: '#2E7D32' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1B5E20' }}>
              📊 Estimaciones de Producción (Calculado en tiempo real)
            </Typography>
          </Box>
          <Grid container spacing={1}>
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={{ textAlign: 'center', p: 1, background: 'rgba(255,255,255,0.7)', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">Ciclos/Hora</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#2E7D32' }}>{estimaciones.ciclosPorHora}</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={{ textAlign: 'center', p: 1, background: 'rgba(255,255,255,0.7)', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">Piezas/Hora</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#2E7D32' }}>{estimaciones.piezasPorHora}</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={{ textAlign: 'center', p: 1, background: 'rgba(255,255,255,0.7)', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">Docenas/Hora</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#2E7D32' }}>{estimaciones.docenasPorHora}</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={{ textAlign: 'center', p: 1, background: 'rgba(255,255,255,0.7)', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">Kg/Hora</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#2E7D32' }}>{estimaciones.kgPorHora}</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={{ textAlign: 'center', p: 1, background: 'rgba(255,255,255,0.7)', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">Kg/Día ({orden.horas_turno}h)</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#1565C0' }}>{estimaciones.kgDia}</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={{ textAlign: 'center', p: 1, background: 'rgba(255,255,255,0.7)', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">Doc/Día ({orden.horas_turno}h)</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#1565C0' }}>{estimaciones.docDia}</Typography>
              </Box>
            </Grid>
          </Grid>
          {/* Tiempo estimado para meta */}
          {(parseFloat(orden.meta_total_kg) > 0 || parseFloat(orden.meta_total_doc) > 0) && parseFloat(estimaciones.tiempoEstimadoHoras) > 0 && (
            <Box sx={{ mt: 1, p: 1, background: 'rgba(255,255,255,0.9)', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: '#1B5E20' }}>
                ⏱️ <strong>Tiempo estimado para cumplir meta:</strong> {estimaciones.tiempoEstimadoHoras} horas ({estimaciones.tiempoEstimadoDias} días de {orden.horas_turno}h)
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      <Divider sx={{ my: 2, borderColor: '#E0E0E0' }} />

      {/* Sección: Lotes */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="subtitle1" color="primary" sx={{ fontWeight: 600 }}>
          🎨 Lotes de Colores ({orden.lotes.length})
        </Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleAddLote}
          size="small"
        >
          Agregar Lote
        </Button>
      </Box>

      {orden.lotes.map((lote, loteIndex) => (
        <Accordion 
          key={loteIndex}
          sx={{ 
            mb: 2, 
            background: '#FAFAFA',
            border: '1px solid #E0E0E0',
            '&:before': { display: 'none' }
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
              <PaletteIcon color="secondary" />
              <Typography sx={{ flexGrow: 1 }}>
                {lote.color_nombre || `Lote #${loteIndex + 1}`}
              </Typography>
              <Chip 
                size="small" 
                label={`${lote.materiales.length} mat.`} 
                color="primary" 
                variant="outlined" 
              />
              <Chip 
                size="small" 
                label={`${lote.pigmentos.length} pig.`} 
                color="secondary" 
                variant="outlined" 
              />
              <IconButton 
                size="small" 
                color="error"
                onClick={(e) => { e.stopPropagation(); handleRemoveLote(loteIndex); }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Autocomplete
                    options={coloresOptions}
                    getOptionLabel={(option) => typeof option === 'string' ? option : option.nombre}
                    value={coloresOptions.find(c => c.id === lote.color_id) || (lote.color_nombre ? { nombre: lote.color_nombre, id: null } : null)}
                    loading={coloresLoading}
                    onChange={async (_, newValue) => {
                        if (typeof newValue === 'string') {
                            // Usuario escribió un nuevo color - crear on-the-fly
                            try {
                                const nuevoColor = await crearColor(newValue);
                                setOrden(prev => ({
                                    ...prev,
                                    lotes: prev.lotes.map((l, i) => 
                                        i === loteIndex ? { ...l, color_id: nuevoColor.id, color_nombre: nuevoColor.nombre } : l
                                    )
                                }));
                                // Agregar a la lista si es nuevo
                                if (!nuevoColor.existed) {
                                    setColoresOptions(prev => [...prev, nuevoColor].sort((a, b) => a.nombre.localeCompare(b.nombre)));
                                    setSnackbar({ 
                                        open: true, 
                                        message: `✨ Color "${nuevoColor.nombre}" creado exitosamente`, 
                                        severity: 'success' 
                                    });
                                }
                            } catch (err) {
                                console.error('Error creando color:', err);
                                setSnackbar({ open: true, message: 'Error creando color', severity: 'error' });
                            }
                        } else if (newValue && typeof newValue === 'object') {
                            // Selección de opción existente
                            setOrden(prev => ({
                                ...prev,
                                lotes: prev.lotes.map((l, i) => 
                                    i === loteIndex ? { ...l, color_id: newValue.id, color_nombre: newValue.nombre } : l
                                )
                            }));
                        } else {
                            // Clear
                            setOrden(prev => ({
                                ...prev,
                                lotes: prev.lotes.map((l, i) => 
                                    i === loteIndex ? { ...l, color_id: null, color_nombre: '' } : l
                                )
                            }));
                        }
                    }}
                    filterOptions={(options, params) => {
                        const filtered = options.filter(opt => 
                            opt.nombre.toLowerCase().includes(params.inputValue.toLowerCase())
                        );
                        // Sugerir crear nuevo si no existe
                        if (params.inputValue !== '' && !filtered.some(o => o.nombre.toLowerCase() === params.inputValue.toLowerCase())) {
                            filtered.push({
                                inputValue: params.inputValue,
                                nombre: `➕ Crear "${params.inputValue.toUpperCase()}"`,
                                isNew: true
                            });
                        }
                        return filtered;
                    }}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="Seleccionar o crear Color"
                            size="small"
                            required
                            placeholder="Escribe para buscar o crear..."
                            InputProps={{
                                ...params.InputProps,
                                endAdornment: (
                                    <>
                                        {coloresLoading ? <CircularProgress color="inherit" size={18} /> : null}
                                        {params.InputProps.endAdornment}
                                    </>
                                ),
                            }}
                        />
                    )}
                    renderOption={(props, option) => (
                        <li {...props} key={option.id || option.inputValue}>
                            <Typography 
                                sx={{ 
                                    color: option.isNew ? 'success.main' : 'text.primary',
                                    fontWeight: option.isNew ? 600 : 400
                                }}
                            >
                                {option.nombre}
                            </Typography>
                        </li>
                    )}
                    freeSolo
                    selectOnFocus
                    clearOnBlur
                    handleHomeEndKeys
                />
              </Grid>
              <Grid item xs={6} sm={4}>
                <TextField
                  fullWidth
                  label="Personas"
                  type="number"
                  value={lote.personas}
                  onChange={(e) => handleLoteChange(loteIndex, 'personas', e.target.value)}
                  size="small"
                />
              </Grid>
              <Grid item xs={6} sm={4}>
                <Tooltip 
                  title={orden.tipo_estrategia !== 'STOCK' ? 'Solo disponible con estrategia "Stock Manual"' : ''}
                  placement="top"
                  arrow
                >
                  <TextField
                    fullWidth
                    label="Stock Kg Manual"
                    type="number"
                    value={lote.stock_kg_manual}
                    onChange={(e) => handleLoteChange(loteIndex, 'stock_kg_manual', e.target.value)}
                    size="small"
                    disabled={orden.tipo_estrategia !== 'STOCK'}
                    InputProps={{
                      endAdornment: orden.tipo_estrategia !== 'STOCK' ? (
                        <InputAdornment position="end">
                          <LockIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                        </InputAdornment>
                      ) : null
                    }}
                  />
                </Tooltip>
              </Grid>
            </Grid>

            {/* Materiales */}
            <Box sx={{ mt: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Materias Primas
                </Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={() => handleAddMaterial(loteIndex)}>
                  Material
                </Button>
              </Box>
              {lote.materiales.map((mat, matIndex) => (
                <Grid container spacing={1} key={matIndex} sx={{ mb: 1 }}>
                  <Grid item xs={5}>
                    <TextField
                      fullWidth
                      label="Nombre Material"
                      value={mat.nombre}
                      onChange={(e) => handleMaterialChange(loteIndex, matIndex, 'nombre', e.target.value)}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={5}>
                    <TextField
                      fullWidth
                      label="Fracción"
                      type="number"
                      inputProps={{ step: 0.01 }}
                      value={mat.fraccion}
                      onChange={(e) => handleMaterialChange(loteIndex, matIndex, 'fraccion', e.target.value)}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={2}>
                    <IconButton color="error" onClick={() => handleRemoveMaterial(loteIndex, matIndex)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}
            </Box>

            {/* Pigmentos */}
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Colorantes / Pigmentos
                </Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={() => handleAddPigmento(loteIndex)}>
                  Pigmento
                </Button>
              </Box>
              {lote.pigmentos.map((pig, pigIndex) => (
                <Grid container spacing={1} key={pigIndex} sx={{ mb: 1 }}>
                  <Grid item xs={5}>
                    <TextField
                      fullWidth
                      label="Nombre Colorante"
                      value={pig.nombre}
                      onChange={(e) => handlePigmentoChange(loteIndex, pigIndex, 'nombre', e.target.value)}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={5}>
                    <TextField
                      fullWidth
                      label="Gramos"
                      type="number"
                      inputProps={{ step: 0.1 }}
                      value={pig.gramos}
                      onChange={(e) => handlePigmentoChange(loteIndex, pigIndex, 'gramos', e.target.value)}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={2}>
                    <IconButton color="error" onClick={() => handleRemovePigmento(loteIndex, pigIndex)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}

      <Divider sx={{ my: 3, borderColor: '#E0E0E0' }} />

      {/* Botón Submit */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={loading}
          endIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
          sx={{
            px: 4,
            background: 'linear-gradient(135deg, #1E3A5F 0%, #0D2137 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #152a45 0%, #0a1a2e 100%)',
            }
          }}
        >
          {loading ? 'Creando...' : 'Crear Orden'}
        </Button>
      </Box>

      {/* Snackbar para notificaciones */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          severity={snackbar.severity} 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
}

export default OrdenForm;
