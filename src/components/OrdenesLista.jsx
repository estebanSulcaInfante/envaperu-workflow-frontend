import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  Chip,
  Collapse,
  IconButton,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Grid,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import RefreshIcon from '@mui/icons-material/Refresh';
import FactoryIcon from '@mui/icons-material/Factory';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import LockIcon from '@mui/icons-material/Lock';
import TextField from '@mui/material/TextField';
import BuildIcon from '@mui/icons-material/Build'; // Icono para ajustes tecnicos
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { Link } from 'react-router-dom';
import { obtenerOrdenes, descargarExcel, getQRImageUrl, toggleEstadoOrden, actualizarMetricasOrden } from '../services/api';
import RegistroForm from './RegistroForm';
import DataTableToolbar from './ui/DataTableToolbar';
import { matchesOmniSearch } from '../utils/tableSearch';

const numberFormatter = new Intl.NumberFormat('es-PE', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3
});

const formatNumber = (value, fallback = '-') => {
  const number = Number(value);
  return Number.isFinite(number) ? numberFormatter.format(number) : fallback;
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('es-PE');
};

const validHex = (value) => /^#[0-9a-f]{6}$/i.test(value || '');

function ColorSwatch({ lote, size = 22 }) {
  const hex = validHex(lote.color_hex) ? lote.color_hex : null;
  return (
    <Box
      component="span"
      role="img"
      aria-label={hex ? `Color ${lote.Color}: ${hex}` : `Color ${lote.Color} sin HEX definido`}
      sx={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, flex: `0 0 ${size}px`, borderRadius: '50%',
        bgcolor: hex || 'grey.100', border: '2px solid #fff',
        boxShadow: '0 0 0 1px rgba(0,0,0,.22)'
      }}
    >
      {!hex && <Typography component="span" sx={{ fontSize: size * 0.55, lineHeight: 1 }}>🎨</Typography>}
    </Box>
  );
}

function Metric({ label, value, unit }) {
  return (
    <Box className="lot-metric">
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>{value}{unit ? ` ${unit}` : ''}</Typography>
    </Box>
  );
}

function LoteRow({ lote, printMode = false }) {
  const recipe = lote.receta_aplicada;
  const people = lote.mano_obra?.personas ?? lote.personas;
  const hours = lote.mano_obra?.horas_hombre;

  return (
    <Card className={printMode ? 'lot-card lot-card-print' : 'lot-card'} variant="outlined" sx={{ mb: printMode ? 1 : 1.5 }}>
      <CardContent sx={{ p: printMode ? 1.25 : 2, '&:last-child': { pb: printMode ? 1.25 : 2 } }}>
        <Box className="lot-card-header" sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ColorSwatch lote={lote} size={printMode ? 18 : 24} />
            <Box>
              <Typography variant={printMode ? 'subtitle2' : 'subtitle1'} sx={{ fontWeight: 750, lineHeight: 1.2 }}>
                {lote.Color || 'Sin color'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {recipe ? `Receta ${recipe.nombre} · revisión ${recipe.revision}` : 'Sin receta asociada'}
              </Typography>
            </Box>
          </Box>
          <Box className="lot-metrics" sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(92px, 1fr))', gap: 1.5 }}>
            <Metric label="Meta" value={formatNumber(lote.meta_kg)} unit="kg" />
            <Metric label="Coladas objetivo" value={formatNumber(lote.coladas ?? lote.coladas_calculadas)} />
            <Metric label="Personas" value={people != null ? formatNumber(people) : '-'} />
            <Metric label="Horas-hombre" value={hours != null ? formatNumber(hours) : '-'} />
          </Box>
        </Box>

        <Box className="lot-body-grid">
          <Grid container spacing={printMode ? 1 : 2} className="lot-composition">
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="overline" color="text.secondary">Composición de resinas</Typography>
              <Box className="lot-detail-list">
                {lote.materiales?.length ? lote.materiales.map((material, index) => (
                  <Box className="lot-detail-row" key={material.id || `${material.nombre}-${index}`}>
                    <span>{material.nombre}</span><strong>{formatNumber(material.peso_kg)} kg</strong>
                  </Box>
                )) : <Typography variant="body2" color="text.secondary">Sin materiales registrados</Typography>}
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="overline" color="text.secondary">
                {printMode ? 'Dosificación' : 'Dosificación de colorantes / aditivos'}
              </Typography>
              <Box className="lot-detail-list">
                {lote.pigmentos?.length ? lote.pigmentos.map((pigmento, index) => (
                  <Box className="lot-detail-row" key={pigmento.id || `${pigmento.nombre}-${index}`}>
                    <span>{pigmento.nombre}</span><strong>{formatNumber(pigmento.dosis_gr)} g</strong>
                  </Box>
                )) : <Typography variant="body2" color="text.secondary">Sin dosificación registrada</Typography>}
              </Box>
            </Grid>
          </Grid>

          {lote.salidas?.length > 0 && (
            <Box className="lot-outputs" sx={{ mt: 1.5 }}>
              <Typography variant="overline" color="text.secondary">Salidas físicas objetivo</Typography>
              <Box className="lot-output-table" component="table">
                <thead><tr><th>Pieza</th><th>SKU</th><th>Cav.</th><th>Unidades</th><th>Kg netos</th></tr></thead>
                <tbody>{lote.salidas.map((salida) => (
                  <tr key={salida.id || `${salida.pieza_id}-${salida.pieza_color_sku}`}>
                    <td>{salida.pieza_nombre || '-'}</td><td>{salida.pieza_color_sku || '-'}</td>
                    <td>{formatNumber(salida.cavidades_snapshot ?? salida.cavidades)}</td><td>{formatNumber(salida.cantidad_objetivo)}</td>
                    <td>{formatNumber(salida.kg_objetivo_neto)} kg</td>
                  </tr>
                ))}</tbody>
              </Box>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

function OrderPrintSheet({ orden }) {
  if (!orden) return null;
  const resumen = orden.resumen_totales || {};
  const technical = orden.snapshot_tecnico || {};
  const metaKg = orden.meta_kg || resumen['Peso(Kg) PRODUCCION'] || 0;
  const wastePercent = Number(resumen['%Merma']);
  const cycleSeconds = Number(technical.tiempo_ciclo_seg);
  const cyclesPerHour = cycleSeconds > 0 ? 3600 / cycleSeconds : null;
  return (
    <Box className="order-print-sheet" aria-label={`Versión imprimible ${orden.numero_op}`}>
      <Box className="print-header">
        <Box><Typography variant="overline">ENVAPERÚ · ORDEN DE PRODUCCIÓN</Typography><Typography variant="h4" sx={{ fontWeight: 800 }}>{orden.numero_op}</Typography></Box>
      </Box>
      <Box className="print-order-grid">
        <div><span>Producto</span><strong>{orden.producto || '-'}</strong></div>
        <div><span>Máquina</span><strong>{orden.maquina || '-'}</strong></div>
        <div><span>Molde</span><strong>{orden.molde || '-'}</strong></div>
        <div><span>Inicio programado</span><strong>{formatDate(orden.fecha_inicio)}</strong></div>
        <div><span>Fin estimado</span><strong>{formatDate(resumen['F. Fin'])}</strong></div>
        <div><span>Meta neta</span><strong>{formatNumber(metaKg)} kg</strong></div>
        <div><span>Merma</span><strong>{Number.isFinite(wastePercent) ? formatNumber(wastePercent * 100) : '-'}%</strong></div>
        <div><span>Merma a recuperar</span><strong>{formatNumber(resumen['Merma Natural Kg'])} kg</strong></div>
      </Box>
      <Box className="print-technical-grid">
        <div><span>Ciclo</span><strong>{formatNumber(cycleSeconds)} s</strong></div>
        <div><span>Coladas/hora</span><strong>{formatNumber(cyclesPerHour)}</strong></div>
        <div><span>Horas/turno</span><strong>{formatNumber(technical.horas_turno)} h</strong></div>
        <div><span>Peso neto/golpe</span><strong>{formatNumber(technical.peso_neto_golpe_gr)} g</strong></div>
        <div><span>Ramal/colada</span><strong>{formatNumber(technical.peso_colada_gr)} g</strong></div>
        <div><span>Peso de tiro</span><strong>{formatNumber(technical.peso_tiro_gr)} g</strong></div>
        <div><span>Duración estimada</span><strong>{formatNumber(resumen['Horas'])} h / {formatNumber(resumen['Días'])} días</strong></div>
      </Box>
      <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: 750 }}>Lotes de color</Typography>
      {orden.lotes?.map((lote, index) => <LoteRow key={lote.id || index} lote={lote} printMode />)}
      <Box className="print-footer">Generado el {new Date().toLocaleString('es-PE')}</Box>
    </Box>
  );
}

function OrdenRow({ orden, onRegistroCreado, onRefresh, onPrint }) {
  const [open, setOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [registroDialogOpen, setRegistroDialogOpen] = useState(false);
  const [metricasDialogOpen, setMetricasDialogOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [toggling, setToggling] = useState(false);
  const resumen = orden.resumen_totales || {};
  const isActiva = orden.activa !== false;

  const handleDownloadExcel = async (e) => {
    e.stopPropagation();
    setDownloading(true);
    try {
      await descargarExcel(orden.numero_op);
    } catch (error) {
      console.error('Error descargando Excel:', error);
    } finally {
      setDownloading(false);
    }
  };

  const handleOpenQR = (e) => {
    e.stopPropagation();
    setQrDialogOpen(true);
  };

  const handleOpenRegistro = (e) => {
    e.stopPropagation();
    setRegistroDialogOpen(true);
  };

  const handleToggleEstado = async (e) => {
    e.stopPropagation();
    setToggling(true);
    try {
      await toggleEstadoOrden(orden.numero_op, !isActiva);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error cambiando estado:', error);
    } finally {
      setToggling(false);
    }
  };

  return (
    <>
      <TableRow 
        sx={{ 
          '&:hover': { background: 'rgba(79, 172, 254, 0.05)' },
          cursor: 'pointer'
        }}
        onClick={() => setOpen(!open)}
      >
        <TableCell>
          <IconButton size="small">
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 600 }}>
            {orden.numero_op}
          </Typography>
        </TableCell>
        <TableCell>{orden.producto}</TableCell>
        <TableCell>{orden.maquina}</TableCell>
        <TableCell>
          <Chip 
            size="small" 
            label={orden.tipo} 
            color={orden.tipo === 'POR_PESO' ? 'primary' : orden.tipo === 'POR_CANTIDAD' ? 'secondary' : 'default'}
            variant="outlined"
          />
        </TableCell>
        <TableCell align="right" sx={{ minWidth: 140 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {orden.avance_real_kg?.toFixed(1) || '0.0'} / {(orden.meta_kg || resumen['Peso(Kg) PRODUCCION'] || 0).toFixed(0)} kg
            </Typography>
            <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: '100%', height: 6, bgcolor: 'grey.200', borderRadius: 3, overflow: 'hidden' }}>
                <Box 
                  sx={{ 
                    width: `${Math.min(((orden.avance_real_kg || 0) / (orden.meta_kg || resumen['Peso(Kg) PRODUCCION'] || 1) * 100), 100)}%`, 
                    height: '100%', 
                    bgcolor: isActiva ? 'success.main' : 'text.disabled',
                    transition: 'width 0.5s'
                  }} 
                />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 25 }}>
                {Math.round((orden.avance_real_kg || 0) / (orden.meta_kg || resumen['Peso(Kg) PRODUCCION'] || 1) * 100)}%
              </Typography>
            </Box>
          </Box>
        </TableCell>
        <TableCell align="right">
          <Typography variant="body2" color="secondary">
            {resumen['Días']?.toFixed(1) || '-'} días
          </Typography>
        </TableCell>
        <TableCell>
          <Chip 
            size="small" 
            label={`${orden.lotes?.length || 0} colores`}
            variant="filled"
            sx={{ 
              background: 'linear-gradient(135deg, #1E3A5F 0%, #0D2137 100%)',
              color: '#FFFFFF'
            }}
          />
        </TableCell>
        <TableCell>
          <Chip 
            size="small" 
            label={isActiva ? 'Activa' : 'Cerrada'}
            color={isActiva ? 'success' : 'default'}
            variant={isActiva ? 'filled' : 'outlined'}
          />
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Preparación de materiales">
              <IconButton
                component={Link}
                to={`/materiales/preparaciones/${orden.numero_op}`}
                size="small"
                color="primary"
                onClick={(event) => event.stopPropagation()}
                aria-label={`Preparación de materiales ${orden.numero_op}`}
              >
                <Inventory2OutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={isActiva ? 'Crear Registro Diario' : 'OP cerrada'}>
              <span>
                <IconButton 
                  size="small" 
                  color="success" 
                  onClick={handleOpenRegistro}
                  disabled={!isActiva}
                >
                  <AddCircleOutlineIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={isActiva ? 'Cerrar OP' : 'Reabrir OP'}>
              <IconButton 
                size="small" 
                color={isActiva ? 'warning' : 'primary'}
                onClick={handleToggleEstado}
                disabled={toggling}
              >
                {toggling ? <CircularProgress size={18} /> : (isActiva ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />)}
              </IconButton>
            </Tooltip>
            {isActiva && (
                <Tooltip title="Ajustar Parámetros (Cavidades/Ciclo)">
                    <IconButton 
                        size="small" 
                        color="default"
                        onClick={(e) => { e.stopPropagation(); setMetricasDialogOpen(true); }}
                    >
                        <BuildIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            )}
            <Tooltip title="Ver QR del Formulario">
              <IconButton size="small" color="secondary" onClick={handleOpenQR}>
                <QrCode2Icon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Descargar Excel">
              <IconButton 
                size="small" 
                color="primary" 
                onClick={handleDownloadExcel}
                disabled={downloading}
                aria-label={`Descargar Excel ${orden.numero_op}`}
              >
                {downloading ? <CircularProgress size={18} /> : <DownloadIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Imprimir / Guardar como PDF A4">
              <IconButton
                size="small"
                color="primary"
                onClick={(event) => { event.stopPropagation(); onPrint?.(orden); }}
                aria-label={`Imprimir PDF A4 ${orden.numero_op}`}
              >
                <PrintIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </TableCell>
      </TableRow>

      {/* QR Dialog */}
      <Dialog open={qrDialogOpen} onClose={() => setQrDialogOpen(false)} maxWidth="xs">
        <DialogTitle sx={{ textAlign: 'center' }}>
          QR - {orden.numero_op}
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', py: 3 }}>
          <img 
            src={getQRImageUrl(orden.numero_op, 250)} 
            alt={`QR ${orden.numero_op}`}
            style={{ maxWidth: '100%', height: 'auto' }}
          />
          <Typography variant="caption" display="block" sx={{ mt: 2, color: 'text.secondary' }}>
            Escanea para abrir el formulario de seguimiento
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
          <Button 
            variant="outlined" 
            startIcon={<DownloadIcon />}
            href={getQRImageUrl(orden.numero_op, 400)}
            download={`QR-${orden.numero_op}.png`}
          >
            Descargar QR
          </Button>
          <Button variant="contained" onClick={() => setQrDialogOpen(false)}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Registro Dialog */}
      <Dialog 
        open={registroDialogOpen} 
        onClose={() => setRegistroDialogOpen(false)} 
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#1a1a2e', color: 'white' }}>
          📝 Nuevo Registro - {orden.numero_op}
        </DialogTitle>
        <DialogContent sx={{ bgcolor: '#1a1a2e', pt: 2 }}>
          <RegistroForm 
            ordenId={orden.numero_op} 
            onRegistroCreado={() => {
              setRegistroDialogOpen(false);
              if (onRegistroCreado) onRegistroCreado();
            }}
          />
        </DialogContent>
      </Dialog>
      
      {/* Metricas Dialog */}
      <Dialog
        open={metricasDialogOpen}
        onClose={() => setMetricasDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ textAlign: 'center', bgcolor: '#f5f5f5' }}>
            ⚙️ Ajustar Parámetros Técnicos - {orden.numero_op}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
            <Alert severity="warning" sx={{ mb: 2, mt: 1 }}>
                Cambiar estos valores afectará el cálculo de eficiencia de los futuros registros, pero mantendrá la integridad histórica de los pasados.
                Usa esto si se dañó un molde (reducir cavidades) o cambió el ciclo real.
            </Alert>
            <MetricasForm 
                orden={orden} 
                onClose={() => setMetricasDialogOpen(false)}
                onSuccess={() => {
                    setMetricasDialogOpen(false);
                    if(onRefresh) onRefresh();
                }}
            />
        </DialogContent>
      </Dialog>

      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={10}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ py: 2, px: 1 }}>
              {/* Resumen de la orden */}
              <Paper 
                sx={{ 
                  p: 2, 
                  mb: 2, 
                  background: '#E3F2FD',
                  border: '1px solid #1E3A5F'
                }}
              >
                <Typography variant="subtitle2" gutterBottom color="primary">
                  📊 Resumen de Producción
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Producción Real / Meta</Typography>
                    <Typography variant="body1">
                        {orden.avance_real_kg?.toFixed(2) || '0.00'} / {(orden.meta_kg || resumen['Peso(Kg) PRODUCCION'] || 0).toFixed(2)} Kg
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Inc. Merma</Typography>
                    <Typography variant="body1">{resumen['Peso (Kg) Inc. Merma']} Kg</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">% Merma</Typography>
                    <Typography variant="body1">{((resumen['%Merma'] || 0) * 100).toFixed(2)}%</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Extra</Typography>
                    <Typography variant="body1">{resumen['EXTRA']} Kg</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Total a Máquina</Typography>
                    <Typography variant="body1" color="primary" sx={{ fontWeight: 600 }}>
                      {(resumen['Peso REAL A ENTREGAR'] || orden.meta_kg || 0).toFixed(2)} Kg
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Docenas</Typography>
                    <Typography variant="body1">{resumen['Total DOC'] || (orden.meta_total_doc || 0).toFixed(0)}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Tiempo</Typography>
                    <Typography variant="body1">{resumen['Horas']} hrs / {resumen['Días']} días</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Fecha Fin Est.</Typography>
                    <Typography variant="body1">
                      {resumen['F. Fin'] ? new Date(resumen['F. Fin']).toLocaleDateString() : '-'}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              {/* Lotes */}
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                🎨 Lotes de Color
              </Typography>
              {orden.lotes?.map((lote, index) => (
                <LoteRow key={lote.id || index} lote={lote} />
              ))}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

function OrdenesLista() {
  const printTarget = new URLSearchParams(window.location.search).get('print');
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODAS');
  const [printOrder, setPrintOrder] = useState(null);

  const fetchOrdenes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await obtenerOrdenes();
      setOrdenes(data);
      if (printTarget) {
        setPrintOrder(data.find((orden) => orden.numero_op === printTarget) || null);
      }
    } catch (err) {
      setError('Error al cargar las órdenes. Verifica que el servidor esté corriendo.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [printTarget]);

  useEffect(() => {
    fetchOrdenes();
  }, [fetchOrdenes]);

  useEffect(() => {
    if (!printOrder || printTarget) return undefined;
    const previousTitle = document.title;
    const timer = window.setTimeout(() => {
      document.title = `${printOrder.numero_op}-orden-produccion`;
      window.print();
      document.title = previousTitle;
      setPrintOrder(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [printOrder, printTarget]);

  // Filtrar órdenes
  const filteredOrdenes = ordenes.filter(orden => {
    // Filtro de búsqueda
    const matchesSearch = matchesOmniSearch(orden, searchTerm);
    
    // Filtro de estado
    const matchesStatus = statusFilter === 'TODAS' ||
      (statusFilter === 'ACTIVAS' && orden.activa !== false) ||
      (statusFilter === 'CERRADAS' && orden.activa === false);
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert 
        severity="error" 
        action={
          <IconButton color="inherit" size="small" onClick={fetchOrdenes}>
            <RefreshIcon />
          </IconButton>
        }
      >
        {error}
      </Alert>
    );
  }

  if (ordenes.length === 0) {
    return (
      <Paper 
        sx={{ 
          p: 6, 
          textAlign: 'center',
          background: '#FFFFFF',
          border: '1px solid #E0E0E0'
        }}
      >
        <FactoryIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary">
          No hay órdenes de producción
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Crea tu primera orden desde la pestaña "Crear Orden"
        </Typography>
      </Paper>
    );
  }

  return (
    <>
    <TableContainer
      className="orders-screen-view"
      component={Paper}
      sx={{ 
        background: '#FFFFFF',
        border: '1px solid #E0E0E0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}
    >
      <Box sx={{ p: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 750, mb: 1.5 }}>Órdenes de producción</Typography>
        <DataTableToolbar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar OP, producto, máquina, molde o color"
          filters={[{ id: 'estado', label: 'Estado', value: statusFilter, onChange: setStatusFilter, options: [{ value: 'TODAS', label: 'Todas' }, { value: 'ACTIVAS', label: 'Activas' }, { value: 'CERRADAS', label: 'Cerradas' }] }]}
          resultCount={filteredOrdenes.length}
          totalCount={ordenes.length}
          onClear={() => { setSearchTerm(''); setStatusFilter('TODAS'); }}
          actions={(
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Tooltip title="Actualizar órdenes"><IconButton onClick={fetchOrdenes} color="primary"><RefreshIcon /></IconButton></Tooltip>
              <Button component={Link} to="/produccion/ordenes/nueva-excepcional" size="small" variant="outlined" startIcon={<AddCircleOutlineIcon />}>OP excepcional</Button>
            </Box>
          )}
        />
      </Box>
      <Table>
        <TableHead>
          <TableRow sx={{ background: '#E3F2FD' }}>
            <TableCell width={50} />
            <TableCell>N° OP</TableCell>
            <TableCell>Producto</TableCell>
            <TableCell>Máquina</TableCell>
            <TableCell>Tipo</TableCell>
            <TableCell align="right">Producción (Kg)</TableCell>
            <TableCell align="right">Tiempo Est.</TableCell>
            <TableCell>Colores</TableCell>
            <TableCell>Estado</TableCell>
            <TableCell>Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredOrdenes.map((orden) => (
            <OrdenRow key={orden.numero_op} orden={orden} onRefresh={fetchOrdenes} onPrint={setPrintOrder} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
    {printOrder ? createPortal(<OrderPrintSheet orden={printOrder} />, document.body) : null}
    </>
  );
}

// Componente interno para el formulario de metricas
function MetricasForm({ orden, onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        snapshot_tiempo_ciclo: orden.tiempo_ciclo || orden.snapshot_tiempo_ciclo || '',
        snapshot_peso_inc_colada: orden.peso_inc_colada || orden.snapshot_peso_inc_colada || ''
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            await actualizarMetricasOrden(orden.numero_op, {
                snapshot_tiempo_ciclo: parseFloat(formData.snapshot_tiempo_ciclo),
                snapshot_peso_inc_colada: parseFloat(formData.snapshot_peso_inc_colada)
            });
            onSuccess();
        } catch (error) {
            console.error(error);
            alert("Error al actualizar métricas: " + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                    <TextField 
                        label="Tiempo Ciclo (seg)"
                        type="number"
                        name="snapshot_tiempo_ciclo"
                        value={formData.snapshot_tiempo_ciclo}
                        onChange={handleChange}
                        fullWidth
                        size="small"
                    />
                </Grid>
                <Grid size={{ xs: 6 }}>
                    <TextField 
                        label="Peso Tiro (inc. Colada)"
                        type="number"
                        name="snapshot_peso_inc_colada"
                        value={formData.snapshot_peso_inc_colada}
                        onChange={handleChange}
                        fullWidth
                        size="small"
                    />
                </Grid>
            </Grid>
            <DialogActions>
                <Button onClick={onClose} disabled={loading}>Cancelar</Button>
                <Button variant="contained" onClick={handleSubmit} disabled={loading}>
                    {loading ? <CircularProgress size={24} /> : 'Guardar Cambios'}
                </Button>
            </DialogActions>
        </Box>
    );
}

export default OrdenesLista;
