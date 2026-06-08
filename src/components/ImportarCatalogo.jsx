import { useState, useCallback } from 'react';
import {
  Paper,
  Typography,
  Box,
  Button,
  Stepper,
  Step,
  StepLabel,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  Divider,
  FormControlLabel,
  Switch,
  Card,
  CardContent,
  Stack
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import DescriptionIcon from '@mui/icons-material/Description';
import {
  validarImportProductos,
  ejecutarImportProductos,
  validarImportPiezas,
  ejecutarImportPiezas,
  detectarColoresExcel
} from '../services/api';

const steps = ['Subir Archivo', 'Revisar Datos', 'Confirmar Importación'];

function ImportarCatalogo() {
  const [activeStep, setActiveStep] = useState(0);
  const [tipoImport, setTipoImport] = useState('productos'); // productos o piezas
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [coloresDetectados, setColoresDetectados] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [crearColoresAuto, setCrearColoresAuto] = useState(true);
  const [error, setError] = useState(null);

  const handleFileSelect = useCallback((event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setValidationResult(null);
      setColoresDetectados(null);
      setImportResult(null);
      setError(null);
    }
  }, []);

  const handleValidate = async () => {
    if (!file) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Validar archivo
      const validateFn = tipoImport === 'productos' ? validarImportProductos : validarImportPiezas;
      const result = await validateFn(file);
      setValidationResult(result);
      
      // Detectar colores
      const colores = await detectarColoresExcel(file, tipoImport);
      setColoresDetectados(colores);
      
      setActiveStep(1);
    } catch (err) {
      setError(err.response?.data?.error || 'Error validando archivo');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const importFn = tipoImport === 'productos' ? ejecutarImportProductos : ejecutarImportPiezas;
      const result = await importFn(file, crearColoresAuto);
      setImportResult(result);
      setActiveStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Error importando datos');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setActiveStep(0);
    setFile(null);
    setValidationResult(null);
    setColoresDetectados(null);
    setImportResult(null);
    setError(null);
  };

  return (
    <Paper sx={{ p: 4 }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
        📥 Importar Catálogo desde Excel/CSV
      </Typography>
      
      <Stepper activeStep={activeStep} sx={{ my: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {loading && <LinearProgress sx={{ mb: 3 }} />}
      
      {/* PASO 1: Subir Archivo */}
      {activeStep === 0 && (
        <Box>
          <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
            <Button
              variant={tipoImport === 'productos' ? 'contained' : 'outlined'}
              onClick={() => setTipoImport('productos')}
            >
              Productos Terminados
            </Button>
            <Button
              variant={tipoImport === 'piezas' ? 'contained' : 'outlined'}
              onClick={() => setTipoImport('piezas')}
            >
              Piezas
            </Button>
          </Stack>
          
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Formato esperado para {tipoImport === 'productos' ? 'Productos' : 'Piezas'}:
              </Typography>
              <Typography variant="body2" component="pre" sx={{ 
                fontFamily: 'monospace', 
                fontSize: '0.75rem',
                backgroundColor: '#f5f5f5',
                p: 1,
                borderRadius: 1,
                overflow: 'auto'
              }}>
                {tipoImport === 'productos' 
                  ? 'Cod Linea, Linea, Cod Familia, Familia, Cod Producto, Producto, Cod Color, Familia Color, COD SKU PT, ...'
                  : 'SKU, Cod Linea, Linea, FAMILIA, PRODUCTO, Cod Pieza, PIEZAS, Cod Col, Tipo Color, Cavidad, Peso, ...'}
              </Typography>
            </CardContent>
          </Card>
          
          <Box
            sx={{
              border: '2px dashed',
              borderColor: file ? 'success.main' : 'grey.400',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              backgroundColor: file ? 'success.50' : 'grey.50',
              cursor: 'pointer',
              '&:hover': { borderColor: 'primary.main' }
            }}
            onClick={() => document.getElementById('file-input').click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            
            {file ? (
              <>
                <DescriptionIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                <Typography variant="h6" color="success.main">{file.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {(file.size / 1024).toFixed(1)} KB
                </Typography>
              </>
            ) : (
              <>
                <CloudUploadIcon sx={{ fontSize: 48, color: 'grey.500', mb: 1 }} />
                <Typography color="text.secondary">
                  Arrastra un archivo Excel o CSV aquí o haz clic para seleccionar
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  Formatos soportados: .xlsx, .xls, .csv
                </Typography>
              </>
            )}
          </Box>
          
          <Box sx={{ mt: 3, textAlign: 'right' }}>
            <Button
              variant="contained"
              onClick={handleValidate}
              disabled={!file || loading}
            >
              Validar Archivo
            </Button>
          </Box>
        </Box>
      )}
      
      {/* PASO 2: Revisar Datos */}
      {activeStep === 1 && validationResult && (
        <Box>
          {/* Resumen de Validación */}
          <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
            <Card variant="outlined" sx={{ flex: 1 }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="primary">{validationResult.total_filas}</Typography>
                <Typography variant="body2" color="text.secondary">Filas Total</Typography>
              </CardContent>
            </Card>
            <Card variant="outlined" sx={{ flex: 1 }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="success.main">{validationResult.filas_validas}</Typography>
                <Typography variant="body2" color="text.secondary">Filas Válidas</Typography>
              </CardContent>
            </Card>
            <Card variant="outlined" sx={{ flex: 1 }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="warning.main">
                  {tipoImport === 'productos'
                    ? (validationResult.familias_nuevas?.length || 0)
                    : (validationResult.colores_nuevos?.length || 0)
                  }
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {tipoImport === 'productos' ? 'Familias Nuevas' : 'Colores Nuevos'}
                </Typography>
              </CardContent>
            </Card>
          </Stack>
          
          {/* Errores de Validación - Ahora con detalle por fila */}
          {validationResult.errores?.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                ❌ Errores encontrados ({validationResult.filas_con_errores || validationResult.errores.length} filas):
              </Typography>
              <Box component="ul" sx={{ margin: 0, pl: 2.5, maxHeight: 200, overflow: 'auto' }}>
                {validationResult.errores.slice(0, 10).map((err, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {typeof err === 'object' ? (
                      <>
                        <strong>Fila {err.fila}:</strong> {err.mensaje}
                        {err.columna && <em> (columna: {err.columna})</em>}
                      </>
                    ) : (
                      err
                    )}
                  </li>
                ))}
                {validationResult.errores.length > 10 && (
                  <li><em>... y {validationResult.errores.length - 10} errores más</em></li>
                )}
              </Box>
            </Alert>
          )}
          
          {/* Warnings de Validación */}
          {validationResult.warnings?.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                ⚠️ Advertencias ({validationResult.filas_con_warnings || validationResult.warnings.length}):
              </Typography>
              <Box component="ul" sx={{ margin: 0, pl: 2.5, maxHeight: 150, overflow: 'auto' }}>
                {validationResult.warnings.slice(0, 5).map((warn, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {typeof warn === 'object' ? (
                      <>
                        {warn.fila > 0 && <strong>Fila {warn.fila}: </strong>}
                        {warn.mensaje}
                      </>
                    ) : (
                      warn
                    )}
                  </li>
                ))}
                {validationResult.warnings.length > 5 && (
                  <li><em>... y {validationResult.warnings.length - 5} advertencias más</em></li>
                )}
              </Box>
            </Alert>
          )}
          
          {/* Info del formato detectado */}
          {validationResult.formato_archivo && (
            <Alert severity="info" sx={{ mb: 2 }} icon={<DescriptionIcon />}>
              Formato detectado: <strong>{validationResult.formato_archivo.toUpperCase()}</strong>
              {validationResult.columnas_detectadas?.length > 0 && (
                <> | Columnas: {validationResult.columnas_detectadas.length}</>           
              )}
            </Alert>
          )}
          
          {/* Familias de Color (para Productos) o Colores (para Piezas) */}
          {coloresDetectados && coloresDetectados.colores.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                {tipoImport === 'productos' ? 'Familias de Color' : 'Colores'} Detectados ({coloresDetectados.total_colores})
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Código</TableCell>
                      <TableCell>Nombre en Archivo</TableCell>
                      <TableCell>Estado</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {coloresDetectados.colores.slice(0, 10).map((color) => (
                      <TableRow key={color.codigo}>
                        <TableCell>{color.codigo}</TableCell>
                        <TableCell>{color.nombre_archivo}</TableCell>
                        <TableCell>
                          {color.existe ? (
                            <Chip 
                              size="small" 
                              icon={<CheckCircleIcon />} 
                              label={`Existe: ${color.nombre_db}`}
                              color="success"
                            />
                          ) : (
                            <Chip 
                              size="small" 
                              icon={<WarningIcon />} 
                              label="Nuevo - Se creará"
                              color="warning"
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {coloresDetectados.colores.length > 10 && (
                <Typography variant="caption" color="text.secondary">
                  Mostrando 10 de {coloresDetectados.colores.length} {tipoImport === 'productos' ? 'familias' : 'colores'}
                </Typography>
              )}
            </Box>
          )}
          
          <Divider sx={{ my: 3 }} />
          
          {/* Preview de Datos */}
          <Typography variant="subtitle1" gutterBottom>Vista Previa (primeras 10 filas)</Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, maxHeight: 350, overflow: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {tipoImport === 'productos' ? (
                    <>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 100 }}>SKU</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 180 }}>Producto</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Línea</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Familia</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Fam. Color</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} align="right">Peso (g)</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} align="right">Precio</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>UM</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Marca</TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell sx={{ fontWeight: 'bold' }}>SKU</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Pieza</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Cavidad</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Peso</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Color</TableCell>
                    </>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {validationResult.preview?.map((row, i) => (
                  <TableRow key={i} hover>
                    {tipoImport === 'productos' ? (
                      <>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          {row.cod_sku_pt || row.sku}
                        </TableCell>
                        <TableCell>{row.producto}</TableCell>
                        <TableCell>{row.linea}</TableCell>
                        <TableCell>{row.familia}</TableCell>
                        <TableCell>{row.familia_color}</TableCell>
                        <TableCell align="right">
                          {typeof row.peso_g === 'number' ? row.peso_g.toFixed(1) : row.peso_g}
                        </TableCell>
                        <TableCell align="right">
                          {typeof row.precio_estimado === 'number' ? row.precio_estimado.toFixed(2) : row.precio_estimado}
                        </TableCell>
                        <TableCell>{row.um}</TableCell>
                        <TableCell>
                          <Chip 
                            size="small" 
                            label={row.status || 'N/A'} 
                            color={row.status === 'ALTA' ? 'success' : 'default'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>{row.marca}</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>{row.sku}</TableCell>
                        <TableCell>{row.pieza}</TableCell>
                        <TableCell>{row.cavidad}</TableCell>
                        <TableCell>{row.peso}</TableCell>
                        <TableCell>{row.color}</TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          {/* Opciones */}
          <FormControlLabel
            control={
              <Switch
                checked={crearColoresAuto}
                onChange={(e) => setCrearColoresAuto(e.target.checked)}
              />
            }
            label={tipoImport === 'productos' 
              ? "Crear familias de color nuevas automáticamente" 
              : "Crear colores nuevos automáticamente"
            }
          />
          
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={() => setActiveStep(0)}>
              Volver
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleImport}
              disabled={loading || (validationResult.errores?.length > 0 && validationResult.es_valido === false)}
            >
              Importar {validationResult.filas_validas} Registros
            </Button>
          </Box>
        </Box>
      )}
      
      {/* PASO 3: Resultado */}
      {activeStep === 2 && importResult && (
        <Box sx={{ textAlign: 'center' }}>
          <CheckCircleIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom>¡Importación Completada!</Typography>
          
          <Stack direction="row" spacing={2} justifyContent="center" sx={{ my: 3 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h4" color="success.main">
                  {importResult.productos_creados || importResult.piezas_creadas || 0}
                </Typography>
                <Typography variant="body2">
                  {tipoImport === 'productos' ? 'Productos' : 'Piezas'} Creados
                </Typography>
              </CardContent>
            </Card>
            {(importResult.productos_actualizados > 0 || importResult.piezas_actualizados > 0) && (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h4" color="warning.main">
                    {importResult.productos_actualizados || importResult.piezas_actualizados || 0}
                  </Typography>
                  <Typography variant="body2">
                    Actualizados
                  </Typography>
                </CardContent>
              </Card>
            )}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h4" color="info.main">
                  {tipoImport === 'productos' 
                    ? (importResult.familias_creadas || 0)
                    : (importResult.colores_creados || 0)
                  }
                </Typography>
                <Typography variant="body2">
                  {tipoImport === 'productos' ? 'Familias Color' : 'Colores'} Creados
                </Typography>
              </CardContent>
            </Card>
          </Stack>
          
          {importResult.errores?.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2, textAlign: 'left' }}>
              <Typography variant="subtitle2">Algunos errores ocurrieron:</Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {importResult.errores.slice(0, 5).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </Alert>
          )}
          
          <Button variant="contained" onClick={handleReset}>
            Importar Otro Archivo
          </Button>
        </Box>
      )}
    </Paper>
  );
}

export default ImportarCatalogo;
