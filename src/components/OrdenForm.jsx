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
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CalculateIcon from '@mui/icons-material/Calculate';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import { crearOrden, buscarProductos, obtenerColores, obtenerRecetaColor, validarOrdenPrereq, obtenerMaquinas, obtenerMoldes } from '../services/api';
import { listarMaterialesScm } from '../services/scmCatalogApi';
import CreateOptionAutocomplete from './ui/CreateOptionAutocomplete';
import ColorQuickCreateDialog from './ui/ColorQuickCreateDialog';

const initialOrden = {
  numero_op: '',
  maquina_id: '',
  tipo_maquina: '',
  producto: '',
  producto_sku: '',
  molde: '',
  molde_id: '',
  tipo_cambio: '',
  snapshot_peso_colada_gr: '',
  snapshot_tiempo_ciclo: '',
  snapshot_horas_turno: '24',
  fecha_inicio: new Date().toISOString().slice(0, 16),
  // Compatibilidad con borradores anteriores. La OP nueva siempre usa el
  // snapshot automático de la composición MoldePieza seleccionada.
  snapshot_composicion: [],
  lotes: []
};

const initialLote = {
  color_id: null,
  color_nombre: '',
  meta_kg: '',
  personas: 1,
  materiales: [],
  pigmentos: [],
  _receta_sugerida: null,  // { pigmentos, n_muestras_min } — estado UI temporal
};

const STORAGE_KEY = 'envaperu_orden_form_draft';

const normalizedColorHex = (value) => (
  /^#[0-9A-F]{6}$/i.test(String(value || '').trim())
    ? String(value).trim().toUpperCase()
    : null
);

function LoteColorMarker({ hex }) {
  const normalizedHex = normalizedColorHex(hex);
  if (!normalizedHex) return <PaletteIcon color="secondary" />;

  return (
    <Box
      component="span"
      role="img"
      aria-label={`Muestra de color ${normalizedHex}`}
      title={normalizedHex}
      sx={{
        width: 24,
        height: 24,
        flex: '0 0 24px',
        borderRadius: '50%',
        bgcolor: normalizedHex,
        border: '2px solid',
        borderColor: 'common.white',
        boxShadow: '0 0 0 1px rgba(15, 23, 42, 0.28)',
      }}
    />
  );
}

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

  // Estado para el catálogo normalizado de moldes
  const [moldesOptions, setMoldesOptions] = useState([]);
  const [moldesLoading, setMoldesLoading] = useState(false);
  
  // Estado para Colores
  const [coloresOptions, setColoresOptions] = useState([]);
  const [coloresLoading, setColoresLoading] = useState(false);
  const [materialesCatalogo, setMaterialesCatalogo] = useState([]);
  const [colorCreateDialog, setColorCreateDialog] = useState({
    open: false,
    loteIndex: null,
    initialName: '',
  });

  // Estado para Pre-validación
  const [validationResult, setValidationResult] = useState(null);
  const [validationLoading, setValidationLoading] = useState(false);

  // Estado para Máquinas
  const [maquinasOptions, setMaquinasOptions] = useState([]);
  const [maquinasLoading, setMaquinasLoading] = useState(false);

  // Errores de validación de campos del formulario
  const [errors, setErrors] = useState({});

  // Fetch moldes, máquinas y colores al cargar
  useEffect(() => {
    const fetchMoldes = async () => {
      setMoldesLoading(true);
      try {
        const moldes = await obtenerMoldes();
        setMoldesOptions((moldes || []).filter((molde) => molde.activo !== false));
      } catch (error) {
        console.error('Error cargando moldes:', error);
        setMoldesOptions([]);
      } finally {
        setMoldesLoading(false);
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

    fetchMoldes();
    fetchMaquinas();
    fetchColores();
    listarMaterialesScm()
      .then((items) => setMaterialesCatalogo(items.filter((item) => item.activo !== false)))
      .catch((error) => console.error('Error cargando catálogo SCM de materiales:', error));
  }, []);

  const validateForm = () => {
    const newErrors = {};
    if (!orden.numero_op.trim()) newErrors.numero_op = 'Requerido';
    if (!orden.maquina_id) newErrors.maquina_id = 'Requerido';
    if (!orden.molde_id) newErrors.molde = 'Seleccione un molde del catálogo';
    if (!(Number(orden.snapshot_tiempo_ciclo) > 0)) newErrors.snapshot_tiempo_ciclo = 'Debe ser mayor a 0';
    if (!(Number(orden.snapshot_horas_turno) > 0)) newErrors.snapshot_horas_turno = 'Debe ser mayor a 0';
    if (orden.snapshot_peso_colada_gr === '' || Number(orden.snapshot_peso_colada_gr) < 0) {
      newErrors.snapshot_peso_colada_gr = 'Debe ser mayor o igual a 0';
    }

    if (orden.lotes.length === 0) {
      newErrors.lotes = 'Agregue al menos un lote de color.';
    } else {
      const invalidLots = orden.lotes.reduce((result, lote, index) => {
        const lotErrors = {};
        if (!lote.color_id) lotErrors.color_id = 'Seleccione un color.';
        if (!(Number(lote.meta_kg) > 0)) lotErrors.meta_kg = 'La meta debe ser mayor a 0.';
        if (!Number.isInteger(Number(lote.personas)) || Number(lote.personas) <= 0) {
          lotErrors.personas = 'Debe ser un entero mayor a 0.';
        }
        if (Object.keys(lotErrors).length > 0) result[index] = lotErrors;
        return result;
      }, {});
      if (Object.keys(invalidLots).length > 0) newErrors.lotes = invalidLots;
    }
    
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

  const validationColorIdsKey = orden.lotes
    .map((lote) => lote.color_id)
    .filter((id) => id !== null && id !== '')
    .join(',');

  // Pre-validación cuando cambia una referencia de catálogo relevante.
  useEffect(() => {
    let active = true;
    if (!orden.molde_id) {
      setValidationResult(null);
      setValidationLoading(false);
      return () => { active = false; };
    }

    setValidationResult(null);
    setValidationLoading(true);
    const validatePrereq = async () => {
      try {
        const colorIds = validationColorIdsKey
          ? validationColorIdsKey.split(',')
          : [];
        
        const result = await validarOrdenPrereq({
          moldeId: orden.molde_id,
          colorIds,
          productoSku: orden.producto_sku,
          maquinaId: orden.maquina_id,
          numeroOp: orden.numero_op.trim(),
        });
        if (active) setValidationResult(result);
      } catch (err) {
        console.error('Error validando pre-requisitos:', err);
        if (active) {
          setValidationResult({
            valid: false,
            errors: ['No se pudo validar la integridad de catálogos. Reintente antes de guardar.'],
            warnings: [],
            issues: [{
              codigo: 'PREFLIGHT_NO_DISPONIBLE',
              mensaje: 'No se pudo validar la integridad de catálogos. Reintente antes de guardar.',
              status: 503,
            }],
          });
        }
      } finally {
        if (active) setValidationLoading(false);
      }
    };
    
    const timer = setTimeout(validatePrereq, 500); // Debounce
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [orden.molde_id, orden.producto_sku, orden.maquina_id, orden.numero_op, validationColorIdsKey]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setOrden(prev => ({ ...prev, [name]: value }));
  };

  // ---- Handlers Lotes ----
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
        i === index ? {
          ...lote,
          [field]: value,
          ...(['meta_kg', 'color_id'].includes(field) ? { _receta_sugerida: null } : {}),
        } : lote
      )
    }));
  };

  const handleColorSelected = (loteIndex, color) => {
    setOrden(prev => ({
      ...prev,
      lotes: prev.lotes.map((lote, index) => (
        index === loteIndex
          ? {
              ...lote,
              color_id: color?.id ?? null,
              color_nombre: color?.nombre ?? '',
              _receta_sugerida: null,
            }
          : lote
      )),
    }));
  };

  const handleOpenColorCreate = (loteIndex, initialName) => {
    setColorCreateDialog({
      open: true,
      loteIndex,
      initialName: initialName || '',
    });
  };

  const handleColorCreated = async (createdColor) => {
    let refreshedColors;
    try {
      refreshedColors = await obtenerColores();
    } catch (error) {
      console.error('El color se creó, pero no se pudo refrescar el catálogo:', error);
      refreshedColors = [...coloresOptions, createdColor];
    }

    const uniqueColors = Array.from(
      new Map(refreshedColors.map((color) => [String(color.id), color])).values()
    ).sort((a, b) => a.nombre.localeCompare(b.nombre));
    const selectedColor = uniqueColors.find(
      (color) => String(color.id) === String(createdColor.id)
    ) || createdColor;

    setColoresOptions(uniqueColors);
    handleColorSelected(colorCreateDialog.loteIndex, selectedColor);
    setSnackbar({
      open: true,
      message: createdColor.existed
        ? `El color "${selectedColor.nombre}" ya existía y quedó seleccionado`
        : `Color "${selectedColor.nombre}" creado y seleccionado`,
      severity: createdColor.existed ? 'info' : 'success',
    });
  };

  const handleAddMaterial = (loteIndex) => {
    setOrden(prev => ({
      ...prev,
      lotes: prev.lotes.map((lote, i) => 
        i === loteIndex 
          ? { ...lote, materiales: [...lote.materiales, { nombre: '', tipo: 'VIRGEN', fraccion: '' }], _receta_sugerida: null }
          : lote
      )
    }));
  };

  const handleRemoveMaterial = (loteIndex, matIndex) => {
    setOrden(prev => ({
      ...prev,
      lotes: prev.lotes.map((lote, i) => 
        i === loteIndex 
          ? { ...lote, materiales: lote.materiales.filter((_, j) => j !== matIndex), _receta_sugerida: null }
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
              ),
              _receta_sugerida: null,
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
          ? { ...lote, pigmentos: [...lote.pigmentos, { nombre: '', gramos: '' }], _receta_sugerida: null }
          : lote
      )
    }));
  };

  const handleRemovePigmento = (loteIndex, pigIndex) => {
    setOrden(prev => ({
      ...prev,
      lotes: prev.lotes.map((lote, i) => 
        i === loteIndex 
          ? { ...lote, pigmentos: lote.pigmentos.filter((_, j) => j !== pigIndex), _receta_sugerida: null }
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
              ),
              _receta_sugerida: null,
            }
          : lote
      )
    }));
  };

  // Calcular proporción neta del golpe (peso neto = piezas, sin colada)
  // Los parámetros técnicos ahora usan los snapshots reales del modelo refactorizado
  const getParamsTecnicos = () => {
    const selectedMold = moldesOptions.find(
      (molde) => String(molde.codigo) === String(orden.molde_id)
    );
    const forms = (selectedMold?.formas || []).filter((forma) => forma.activo !== false);
    const catalogNetWeight = forms.reduce(
      (total, forma) => total + Number(forma.cavidades || 0) * Number(forma.peso_unitario_gr || 0),
      0,
    );
    const catalogCavities = forms.reduce(
      (total, forma) => total + Number(forma.cavidades || 0),
      0,
    );
    return {
      pesoNeto: catalogNetWeight || Number(orden.peso_unitario_gr) || 0,
      cavidades: catalogCavities || Number(orden.cavidades) || 0,
      tiempoCiclo: Number(orden.snapshot_tiempo_ciclo) || 0,
      horasTurno: Number(orden.snapshot_horas_turno) || 0,
      pesoColada: Number(orden.snapshot_peso_colada_gr) || 0,
    };
  };

  const applyMasterRecipe = async (loteIndex) => {
    const lote = orden.lotes[loteIndex];
    const metaKg = Number(lote?.meta_kg);
    if (!lote?.color_id || !(metaKg > 0)) {
      setSnackbar({ open: true, message: 'Selecciona un color e ingresa la meta en kg antes de aplicar la receta.', severity: 'warning' });
      return;
    }
    try {
      const recipe = await obtenerRecetaColor(lote.color_id, orden.producto_sku || null, metaKg);
      if (!recipe.tiene_receta || recipe.fuente !== 'RECETA_MAESTRA') {
        setSnackbar({ open: true, message: 'El color no tiene una receta maestra aprobada y predeterminada.', severity: 'warning' });
        return;
      }
      const materials = (recipe.materias_primas || []).map((item) => ({
        material_id: item.material_id,
        nombre: item.nombre,
        tipo: item.modalidad_recepcion === 'SEGUNDA_PESAJE_BOLSA' ? 'SEGUNDA' : 'VIRGEN',
        fraccion: item.fraccion,
      }));
      const virginFraction = (recipe.materias_primas || []).reduce((sum, item) => (
        item.modalidad_recepcion === 'VIRGEN_CONFIANZA_PROVEEDOR'
          ? sum + Number(item.fraccion || 0)
          : sum
      ), 0);
      const kgVirgin = metaKg * virginFraction;
      const pigments = (recipe.pigmentos || []).map((item) => ({
        material_id: item.material_id,
        nombre: item.nombre,
        gramos: Number((Number(item.dosis_gramos) * kgVirgin / Number(item.base_kg)).toFixed(2)),
        tipo_componente: item.tipo_componente,
      }));
      setOrden((current) => ({
        ...current,
        lotes: current.lotes.map((item, index) => index === loteIndex ? {
          ...item,
          materiales: materials,
          pigmentos: pigments,
          _receta_sugerida: { id: recipe.receta.id, revision: recipe.receta.revision, fuente: recipe.fuente, kg_virgen_base: kgVirgin },
        } : item),
      }));
      setSnackbar({ open: true, message: `Receta ${recipe.receta.nombre_variante} · revisión ${recipe.receta.revision} aplicada.`, severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: error?.response?.data?.error || 'No se pudo aplicar la receta maestra.', severity: 'error' });
    }
  };

  const preparePayload = () => {
    const p = getParamsTecnicos();
    return {
      numero_op:              orden.numero_op.trim(),
      maquina_id:             orden.maquina_id,
      producto:               orden.producto,
      producto_sku:           orden.producto_sku || null,
      molde:                  orden.molde,
      molde_id:               orden.molde_id || null,
      tipo_cambio:            orden.tipo_cambio ? parseFloat(orden.tipo_cambio) : null,
      snapshot_tiempo_ciclo:  p.tiempoCiclo,
      snapshot_horas_turno:   p.horasTurno,
      snapshot_peso_colada_gr: p.pesoColada,
      fecha_inicio:           orden.fecha_inicio,
      auto_snapshot_molde:    true,
      snapshot_composicion:   [],
      lotes: orden.lotes.map(lote => ({
        color_id:   lote.color_id,
        color_nombre: lote.color_nombre,
        meta_kg:    lote.meta_kg ? parseFloat(lote.meta_kg) : 0.0,
        personas:   parseInt(lote.personas) || 1,
        ...(lote._receta_sugerida ? {
          receta_aplicada: {
            id: lote._receta_sugerida.id,
            revision: lote._receta_sugerida.revision,
          },
        } : {}),
        materiales: lote.materiales.map(mat => ({
          material_id: mat.material_id || null,
          nombre:   mat.nombre,
          tipo:     mat.tipo || 'VIRGEN',
          fraccion: parseFloat(mat.fraccion)
        })),
        pigmentos: lote.pigmentos.map(pig => ({
          material_id: pig.material_id || null,
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
    if (validationLoading || validationResult?.valid !== true) {
      setSnackbar({
        open: true,
        message: validationLoading
          ? 'Espere a que termine la validación de catálogos.'
          : 'Complete la validación de catálogo y corrija los conflictos indicados.',
        severity: 'error',
      });
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

  // Precalculos globales (basados en parámetros técnicos del molde)
  const calcularEstimacionesGlobales = () => {
    const params = getParamsTecnicos();
    const pesoNetoGolpe = params.pesoNeto;
    const cavidades = params.cavidades;
    const tiempoCiclo = params.tiempoCiclo;
    const horasTurno = params.horasTurno;

    const ciclosPorHora = tiempoCiclo > 0 ? 3600 / tiempoCiclo : 0;
    const piezasPorHora = ciclosPorHora * cavidades;
    const docenasPorHora = piezasPorHora / 12;
    const kgPorHora = (ciclosPorHora * pesoNetoGolpe) / 1000;
    const kgDia = kgPorHora * horasTurno;
    const docDia = docenasPorHora * horasTurno;

    return {
      ciclosPorHora: ciclosPorHora.toFixed(1),
      piezasPorHora: piezasPorHora.toFixed(0),
      docenasPorHora: docenasPorHora.toFixed(1),
      kgPorHora: kgPorHora.toFixed(2),
      kgDia: kgDia.toFixed(1),
      docDia: docDia.toFixed(0),
      esValido: pesoNetoGolpe > 0 && cavidades > 0 && tiempoCiclo > 0 && horasTurno > 0,
      _kgPorHoraRaw: kgPorHora,
      _horasTurno: horasTurno,
    };
  };

  // Precalculo por lote: dado meta_kg, ¿cuánto tiempo tarda este color?
  const calcularEstimacionLote = (lote, estGlobales) => {
    const metaKg = parseFloat(lote.meta_kg) || 0;
    if (metaKg <= 0 || !estGlobales.esValido) return null;
    const horas = estGlobales._kgPorHoraRaw > 0 ? metaKg / estGlobales._kgPorHoraRaw : 0;
    const dias = horas / estGlobales._horasTurno;
    return {
      horas: horas.toFixed(1),
      dias: dias.toFixed(2),
    };
  };

  const paramsTecnicos = getParamsTecnicos();
  const estimacionesGlobales = calcularEstimacionesGlobales();

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
          Nueva OP excepcional
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
          {(validationResult.issues || []).map((issue, i) => (
            <Alert key={`${issue.codigo || 'issue'}-${i}`} severity="error" sx={{ mb: 1 }}>
              <strong>{issue.codigo || 'CATÁLOGO_INVALIDO'}:</strong> {issue.mensaje}
            </Alert>
          ))}
          {(validationResult.errors || []).map((err, i) => (
            (validationResult.issues || []).some((issue) => issue.mensaje === err) ? null : (
              <Alert key={`err-${i}`} severity="error" sx={{ mb: 1 }}>{err}</Alert>
            )
          ))}
          {(validationResult.warnings || []).map((warn, i) => (
            <Alert key={`warn-${i}`} severity="warning" sx={{ mb: 1 }}>
              {warn}
            </Alert>
          ))}
          {validationResult.valid && (validationResult.warnings || []).length === 0 && (validationResult.errors || []).length === 0 && (
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
              <InputLabel id="orden-maquina-label">Máquina</InputLabel>
              <Select
                id="orden-maquina-select"
                labelId="orden-maquina-label"
                name="maquina_id"
                label="Máquina"
                value={orden.maquina_id || ''}
                onChange={(e) => {
                  const maqId = e.target.value;
                  const maqObj = maquinasOptions.find((m) => String(m.id) === String(maqId));
                  setOrden(prev => ({
                    ...prev,
                    maquina_id: maqId,
                    tipo_maquina: maqObj ? (maqObj.tipo || maqObj.tipo_maquina?.nombre || '') : ''
                  }));
                }}
                disabled={maquinasLoading}
              >
                {maquinasLoading ? (
                  <MenuItem disabled>Cargando...</MenuItem>
                ) : (
                  maquinasOptions.map((m) => (
                    <MenuItem
                      key={m.id}
                      value={m.id}
                      disabled={m.activo === false || (m.estado && m.estado !== 'OPERATIVA')}
                    >
                      {m.nombre} ({m.tipo || m.tipo_maquina?.nombre || 'Sin tipo'})
                      {m.estado && m.estado !== 'OPERATIVA' ? ` · ${m.estado}` : ''}
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
              forcePopupIcon
              options={productosOptions}
              value={orden.producto ? { producto: orden.producto, cod_sku_pt: orden.producto_sku || '' } : null}
              isOptionEqualToValue={(option, value) => option.cod_sku_pt === value?.cod_sku_pt}
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
                  }));
                } else {
                  setOrden(prev => ({ ...prev, producto: '', producto_sku: '' }));
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Producto terminado (opcional)"
                  size="small"
                  placeholder="Buscar producto (min. 2 caracteres)..."
                  helperText="Puede omitirse para reposición excepcional de PiezaColor."
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
              options={moldesOptions}
              getOptionLabel={(option) => 
                typeof option === 'string' ? option : option.nombre || ''
              }
              loading={moldesLoading}
              value={
                moldesOptions.find((m) => String(m.codigo) === String(orden.molde_id)) || null
              }
              onChange={(_, newValue) => {
                if (newValue && typeof newValue === 'object') {
                  const forms = (newValue.formas || []).filter((forma) => forma.activo !== false);
                  const cavities = forms.reduce(
                    (total, forma) => total + Number(forma.cavidades || 0),
                    0,
                  );
                  const netWeight = forms.reduce(
                    (total, forma) => total + Number(forma.cavidades || 0) * Number(forma.peso_unitario_gr || 0),
                    0,
                  );
                  const runnerWeight = Math.max(0, Number(newValue.peso_tiro_gr || 0) - netWeight);
                  setOrden(prev => ({
                    ...prev,
                    molde: newValue.nombre,
                    molde_id: newValue.codigo,
                    cavidades: String(cavities),
                    peso_unitario_gr: String(netWeight),
                    snapshot_peso_colada_gr: String(runnerWeight),
                    snapshot_tiempo_ciclo: newValue.tiempo_ciclo_std ? String(newValue.tiempo_ciclo_std) : prev.snapshot_tiempo_ciclo,
                    snapshot_composicion: [],
                  }));
                } else {
                  setOrden(prev => ({
                    ...prev,
                    molde: '',
                    molde_id: '',
                    cavidades: '',
                    peso_unitario_gr: '',
                    snapshot_peso_colada_gr: '',
                    snapshot_tiempo_ciclo: '',
                    snapshot_composicion: [],
                  }));
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Molde"
                  size="small"
                  placeholder="Seleccionar molde a usar..."
                  error={!!errors.molde}
                  helperText={errors.molde || 'La compatibilidad con el producto se valida por sus Piezas abstractas.'}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {moldesLoading ? <CircularProgress color="inherit" size={18} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option.codigo}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{option.nombre}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.codigo} | T/C: {option.tiempo_ciclo_std}s | {option.peso_tiro_gr}g
                    </Typography>
                  </Box>
                </li>
              )}
              isOptionEqualToValue={(option, value) => option.codigo === value?.codigo}
            />
          </Stack>
        </Paper>

        {/* Card 3: Composición del Molde (snapshot manual / auto) */}
        <Paper sx={{ p: 1.5, background: '#FAFAFA', border: '1px solid #E0E0E0', flex: '1 1 280px', minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 600 }}>
              🔩 Composición del Molde
            </Typography>
            {orden.molde_id && (
              <Chip label="Snapshot automático" size="small" color="success" variant="outlined" />
            )}
          </Box>

          {(() => {
            const selectedMold = moldesOptions.find(
              (molde) => String(molde.codigo) === String(orden.molde_id)
            );
            const vistaTabla = (selectedMold?.formas || []).filter((forma) => forma.activo !== false);

            return (
              <>
                {vistaTabla.length === 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Seleccione un molde con composición activa en Datos maestros.
                  </Typography>
                )}
                {vistaTabla.map((row, idx) => (
                  <Grid container spacing={1} key={row.id || row.pieza_id || idx} sx={{ mb: 1, alignItems: 'center' }}>
                    <Grid  size={{ xs: 5 }}>
                      <TextField
                        fullWidth
                        label="Pieza"
                        size="small"
                        disabled
                        value={row.nombre || row.pieza?.nombre || `Pieza #${row.pieza_id}`}
                      />
                    </Grid>
                    <Grid  size={{ xs: 3 }}>
                      <TextField
                        fullWidth
                        label="Cav."
                        size="small"
                        type="number"
                        disabled
                        value={row.cavidades}
                      />
                    </Grid>
                    <Grid  size={{ xs: 3 }}>
                      <TextField
                        fullWidth
                        label="Peso (gr)"
                        size="small"
                        type="number"
                        disabled
                        value={row.peso_unitario_gr}
                      />
                    </Grid>
                  </Grid>
                ))}
              </>
            );
          })()}
        </Paper>
      </Box>

      {/* Fila: Parámetros Técnicos + Fechas */}
      <Paper sx={{ p: 1.5, mb: 2, background: '#FAFAFA', border: '1px solid #E0E0E0' }}>
        <Typography variant="subtitle2" color="primary" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
          ⚙️ Parámetros Técnicos
        </Typography>
        <Grid  container spacing={1}>
          <Grid  size={{ xs: 6, sm: 4, md: 2 }}>
            <TextField
              fullWidth
              label="Peso neto/golpe (gr)"
              name="peso_unitario_gr"
              type="number"
              value={paramsTecnicos.pesoNeto || ''}
              size="small"
              helperText="Suma de cavidades × peso en MoldePieza"
              disabled
            />
          </Grid>
          <Grid  size={{ xs: 6, sm: 4, md: 2 }}>
            <TextField
              fullWidth
              label="Peso Colada (gr)"
              name="snapshot_peso_colada_gr"
              type="number"
              value={orden.snapshot_peso_colada_gr}
              onChange={handleChange}
              size="small"
              error={!!errors.snapshot_peso_colada_gr}
              helperText={errors.snapshot_peso_colada_gr || 'Ramal / runner'}
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Grid>
          <Grid  size={{ xs: 6, sm: 4, md: 2 }}>
            <TextField
              fullWidth
              label="Cavidades totales"
              name="cavidades"
              type="number"
              value={paramsTecnicos.cavidades || ''}
              size="small"
              helperText="Derivadas de MoldePieza"
              disabled
            />
          </Grid>
          <Grid  size={{ xs: 6, sm: 4, md: 2 }}>
            <TextField
              fullWidth
              label="T. Ciclo (seg)"
              name="snapshot_tiempo_ciclo"
              type="number"
              value={orden.snapshot_tiempo_ciclo}
              onChange={handleChange}
              size="small"
              error={!!errors.snapshot_tiempo_ciclo}
              helperText={errors.snapshot_tiempo_ciclo}
              inputProps={{ min: 0.001, step: 0.001 }}
            />
          </Grid>
          <Grid  size={{ xs: 6, sm: 4, md: 2 }}>
            <TextField
              fullWidth
              label="Horas Turno"
              name="snapshot_horas_turno"
              type="number"
              value={orden.snapshot_horas_turno}
              onChange={handleChange}
              size="small"
              error={!!errors.snapshot_horas_turno}
              helperText={errors.snapshot_horas_turno}
              inputProps={{ min: 0.5, step: 0.5 }}
            />
          </Grid>
          <Grid  size={{ xs: 6, sm: 4, md: 2 }}>
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

      {/* Panel de Estimaciones Globales (Capacidad de la Máquina) */}
      {estimacionesGlobales.esValido && (
        <Paper sx={{ p: 1.5, mb: 2, background: 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)', border: '1px solid #81C784' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <CalculateIcon sx={{ color: '#2E7D32' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1B5E20' }}>
              📊 Capacidad de Máquina (tiempo real)
            </Typography>
          </Box>
          <Grid  container spacing={1}>
            {[
              { label: 'Ciclos/Hora', value: estimacionesGlobales.ciclosPorHora, color: '#2E7D32' },
              { label: 'Piezas/Hora', value: estimacionesGlobales.piezasPorHora, color: '#2E7D32' },
              { label: 'Doc/Hora', value: estimacionesGlobales.docenasPorHora, color: '#2E7D32' },
              { label: 'Kg/Hora', value: estimacionesGlobales.kgPorHora, color: '#2E7D32' },
              { label: `Kg/Día (${orden.snapshot_horas_turno}h)`, value: estimacionesGlobales.kgDia, color: '#1565C0' },
              { label: `Doc/Día (${orden.snapshot_horas_turno}h)`, value: estimacionesGlobales.docDia, color: '#1565C0' },
            ].map(({ label, value, color }) => (
              <Grid  size={{ xs: 6, sm: 4, md: 2 }} key={label}>
                <Box sx={{ textAlign: 'center', p: 1, background: 'rgba(255,255,255,0.7)', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color }}>{value}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
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

      {typeof errors.lotes === 'string' && (
        <Alert severity="error" sx={{ mb: 2 }}>{errors.lotes}</Alert>
      )}

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
              <LoteColorMarker
                hex={coloresOptions.find(
                  (color) => String(color.id) === String(lote.color_id)
                )?.hex_referencia}
              />
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
              <Box 
                component="span"
                onClick={(e) => { e.stopPropagation(); handleRemoveLote(loteIndex); }}
                sx={{ cursor: 'pointer', color: 'error.main', display: 'flex', alignItems: 'center', p: 0.5, borderRadius: 1, '&:hover': { bgcolor: 'error.light', color: 'error.contrastText' } }}
              >
                <DeleteIcon fontSize="small" />
              </Box>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid  container spacing={2}>
              <Grid  size={{ xs: 12, sm: 4 }}>
                <CreateOptionAutocomplete
                  options={coloresOptions}
                  value={
                    coloresOptions.find((color) => String(color.id) === String(lote.color_id))
                    || (lote.color_nombre ? { nombre: lote.color_nombre, id: lote.color_id } : null)
                  }
                  onChange={(color) => handleColorSelected(loteIndex, color)}
                  onCreateOption={(initialName) => handleOpenColorCreate(loteIndex, initialName)}
                  getOptionLabel={(color) => color.nombre}
                  isOptionEqualToValue={(option, selected) => (
                    String(option.id) === String(selected?.id)
                    || option.nombre === selected?.nombre
                  )}
                  createLabel={(inputValue) => (
                    inputValue
                      ? `Crear "${inputValue.toUpperCase()}"…`
                      : 'Crear nuevo color…'
                  )}
                  label="Color de producción"
                  loading={coloresLoading}
                  required
                  placeholder="Buscar color…"
                  error={!!errors.lotes?.[loteIndex]?.color_id}
                  helperText={errors.lotes?.[loteIndex]?.color_id || 'Selecciona uno existente o créalo sin salir de la OP'}
                />
              </Grid>
              {/* --- Meta Kg por lote + Estimación de tiempo --- */}
              <Grid  size={{ xs: 6, sm: 4 }}>
                <TextField
                  fullWidth
                  label="Meta (Kg)"
                  type="number"
                  value={lote.meta_kg}
                  onChange={(e) => handleLoteChange(loteIndex, 'meta_kg', e.target.value)}
                  size="small"
                  required
                  error={!!errors.lotes?.[loteIndex]?.meta_kg}
                  helperText={errors.lotes?.[loteIndex]?.meta_kg || 'Kg objetivo para este color'}
                  inputProps={{ min: 0.001, step: 0.001 }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">kg</InputAdornment>
                  }}
                />
              </Grid>
              <Grid  size={{ xs: 6, sm: 4 }}>
                <TextField
                  fullWidth
                  label="Personas"
                  type="number"
                  value={lote.personas}
                  onChange={(e) => handleLoteChange(loteIndex, 'personas', e.target.value)}
                  size="small"
                  required
                  error={!!errors.lotes?.[loteIndex]?.personas}
                  helperText={errors.lotes?.[loteIndex]?.personas}
                  inputProps={{ min: 1, step: 1 }}
                />
              </Grid>
            </Grid>

            {/* Estimación por lote en tiempo real */}
            {(() => {
              const est = calcularEstimacionLote(lote, estimacionesGlobales);
              if (!est) return null;
              return (
                <Box sx={{
                  mt: 1, px: 1.5, py: 0.75,
                  background: 'linear-gradient(90deg, #E3F2FD, #E8F5E9)',
                  borderRadius: 1, display: 'flex', gap: 3, alignItems: 'center'
                }}>
                  <CalculateIcon sx={{ color: '#1565C0', fontSize: 18 }} />
                  <Typography variant="caption" sx={{ color: '#0D47A1' }}>
                    ⏱ <strong>{est.horas}h</strong> ≈ {est.dias} días para <strong>{lote.meta_kg} kg</strong>
                  </Typography>
                </Box>
              );
            })()}

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
                <Grid  container spacing={1} key={matIndex} sx={{ mb: 1 }}>
                  <Grid  size={{ xs: 5 }}>
                    <Autocomplete
                      options={materialesCatalogo.filter((item) => item.clase === 'MATERIA_PRIMA')}
                      getOptionLabel={(item) => `${item.codigo} · ${item.nombre}`}
                      isOptionEqualToValue={(option, selected) => option.id === selected?.id}
                      value={materialesCatalogo.find((item) => item.id === mat.material_id) || null}
                      onChange={(_, selected) => {
                        handleMaterialChange(loteIndex, matIndex, 'material_id', selected?.id || null);
                        handleMaterialChange(loteIndex, matIndex, 'nombre', selected?.nombre || '');
                        handleMaterialChange(loteIndex, matIndex, 'tipo', selected?.categoria_recepcion?.modalidad_default === 'SEGUNDA_PESAJE_BOLSA' ? 'SEGUNDA' : 'VIRGEN');
                      }}
                      renderInput={(params) => <TextField {...params} fullWidth label="Materia prima del catálogo" size="small" />}
                    />
                  </Grid>
                  <Grid  size={{ xs: 5 }}>
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
                  <Grid  size={{ xs: 2 }}>
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
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Tooltip title="Aplica la receta maestra aprobada y calcula dosis sobre los kg de material virgen" arrow>
                    <span>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ScienceOutlinedIcon />}
                        disabled={!lote.color_id || !(Number(lote.meta_kg) > 0)}
                        onClick={() => applyMasterRecipe(loteIndex)}
                        sx={{ whiteSpace: 'nowrap' }}
                      >
                        Aplicar receta maestra
                      </Button>
                    </span>
                  </Tooltip>
                  <Button size="small" startIcon={<AddIcon />} onClick={() => handleAddPigmento(loteIndex)}>
                    Pigmento
                  </Button>
                </Box>
              </Box>
              {lote.pigmentos.map((pig, pigIndex) => (
                <Grid  container spacing={1} key={pigIndex} sx={{ mb: 1 }}>
                  <Grid  size={{ xs: 5 }}>
                    <Autocomplete
                      options={materialesCatalogo.filter((item) => item.clase === 'COLORANTE')}
                      getOptionLabel={(item) => `${item.codigo} · ${item.nombre}${item.tipo_colorante === 'ADITIVO' ? ' · ADITIVO' : ''}`}
                      isOptionEqualToValue={(option, selected) => option.id === selected?.id}
                      value={materialesCatalogo.find((item) => item.id === pig.material_id) || null}
                      onChange={(_, selected) => {
                        handlePigmentoChange(loteIndex, pigIndex, 'material_id', selected?.id || null);
                        handlePigmentoChange(loteIndex, pigIndex, 'nombre', selected?.nombre || '');
                        handlePigmentoChange(loteIndex, pigIndex, 'tipo_componente', selected?.tipo_colorante || 'COLORANTE');
                      }}
                      renderInput={(params) => <TextField {...params} fullWidth label="Colorante o aditivo del catálogo" size="small" />}
                    />
                  </Grid>
                  <Grid  size={{ xs: 5 }}>
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
                  <Grid  size={{ xs: 2 }}>
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

      <ColorQuickCreateDialog
        open={colorCreateDialog.open}
        initialName={colorCreateDialog.initialName}
        onClose={() => setColorCreateDialog({ open: false, loteIndex: null, initialName: '' })}
        onCreated={handleColorCreated}
      />

      {/* Botón Submit */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={loading || validationLoading || validationResult?.valid !== true}
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
