import { useState, useEffect } from 'react';
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
import SearchIcon from '@mui/icons-material/Search';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { obtenerOrdenes, descargarExcel, getQRImageUrl, toggleEstadoOrden } from '../services/api';
import RegistroForm from './RegistroForm';

function LoteRow({ lote }) {
  return (
    <Card 
      sx={{ 
        mb: 1, 
        background: '#FAFAFA',
        border: '1px solid #E0E0E0'
      }}
    >
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3}>
            <Typography variant="subtitle2" color="secondary">
              🎨 {lote.Color}
            </Typography>
          </Grid>
          <Grid item xs={6} sm={2}>
            <Typography variant="caption" color="text.secondary">Peso (Kg)</Typography>
            <Typography variant="body2">
              {lote['Peso (Kg)'] || lote['Por Cantidad (Kg)'] || lote['Stock (Kg)'] || '-'}
            </Typography>
          </Grid>
          <Grid item xs={6} sm={2}>
            <Typography variant="caption" color="text.secondary">Extra (Kg)</Typography>
            <Typography variant="body2">{lote['Extra (Kg)']}</Typography>
          </Grid>
          <Grid item xs={6} sm={2}>
            <Typography variant="caption" color="text.secondary">Total + Extra</Typography>
            <Typography variant="body2" color="primary">{lote['TOTAL + EXTRA (Kg)']}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">Coladas</Typography>
            <Chip 
              size="small" 
              label={lote.coladas_calculadas} 
              color="primary"
              sx={{ ml: 1 }}
            />
          </Grid>
        </Grid>
        
        {/* Materiales y Pigmentos */}
        {(lote.materiales?.length > 0 || lote.pigmentos?.length > 0) && (
          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <Grid container spacing={2}>
              {lote.materiales?.length > 0 && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">Materiales:</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                    {lote.materiales.map((mat, i) => (
                      <Chip 
                        key={i}
                        size="small"
                        variant="outlined"
                        label={`${mat.nombre}: ${mat.peso_kg} kg`}
                      />
                    ))}
                  </Box>
                </Grid>
              )}
              {lote.pigmentos?.length > 0 && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">Pigmentos:</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                    {lote.pigmentos.map((pig, i) => (
                      <Chip 
                        key={i}
                        size="small"
                        variant="outlined"
                        color="secondary"
                        label={`${pig.nombre}: ${pig.dosis_gr} gr`}
                      />
                    ))}
                  </Box>
                </Grid>
              )}
            </Grid>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

function OrdenRow({ orden, onRegistroCreado, onRefresh }) {
  const [open, setOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [registroDialogOpen, setRegistroDialogOpen] = useState(false);
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
        <TableCell align="right">
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {resumen['Peso(Kg) PRODUCCION']?.toFixed(2) || '-'}
          </Typography>
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
            <Tooltip title="Ver QR del Formulario">
              <IconButton size="small" color="secondary" onClick={handleOpenQR}>
                <QrCode2Icon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Descargar Excel para Imprimir">
              <IconButton 
                size="small" 
                color="primary" 
                onClick={handleDownloadExcel}
                disabled={downloading}
              >
                {downloading ? <CircularProgress size={18} /> : <PrintIcon fontSize="small" />}
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

      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={9}>
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
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Producción</Typography>
                    <Typography variant="body1">{resumen['Peso(Kg) PRODUCCION']?.toFixed(2)} Kg</Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Inc. Merma</Typography>
                    <Typography variant="body1">{resumen['Peso (Kg) Inc. Merma']} Kg</Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">% Merma</Typography>
                    <Typography variant="body1">{((resumen['%Merma'] || 0) * 100).toFixed(2)}%</Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Extra</Typography>
                    <Typography variant="body1">{resumen['EXTRA']} Kg</Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Total a Máquina</Typography>
                    <Typography variant="body1" color="primary" sx={{ fontWeight: 600 }}>
                      {resumen['Peso REAL A ENTREGAR']} Kg
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Docenas</Typography>
                    <Typography variant="body1">{resumen['Total DOC']}</Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Tiempo</Typography>
                    <Typography variant="body1">{resumen['Horas']} hrs / {resumen['Días']} días</Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
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
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchOrdenes = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await obtenerOrdenes();
      setOrdenes(data);
    } catch (err) {
      setError('Error al cargar las órdenes. Verifica que el servidor esté corriendo.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrdenes();
  }, []);

  // Filtrar órdenes
  const filteredOrdenes = ordenes.filter(orden => {
    // Filtro de búsqueda
    const matchesSearch = searchTerm === '' || 
      orden.numero_op?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      orden.producto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      orden.maquina?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filtro de estado
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'activa' && orden.activa !== false) ||
      (statusFilter === 'cerrada' && orden.activa === false);
    
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
    <TableContainer 
      component={Paper}
      sx={{ 
        background: '#FFFFFF',
        border: '1px solid #E0E0E0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}
    >
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          📋 Órdenes de Producción ({filteredOrdenes.length}/{ordenes.length})
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Buscar OP, producto, máquina..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ minWidth: 220 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
          <ToggleButtonGroup
            size="small"
            value={statusFilter}
            exclusive
            onChange={(e, value) => value && setStatusFilter(value)}
          >
            <ToggleButton value="all">Todas</ToggleButton>
            <ToggleButton value="activa">Activas</ToggleButton>
            <ToggleButton value="cerrada">Cerradas</ToggleButton>
          </ToggleButtonGroup>
          <IconButton onClick={fetchOrdenes} color="primary">
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>
      <Divider sx={{ borderColor: '#E0E0E0' }} />
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
            <OrdenRow key={orden.numero_op} orden={orden} onRefresh={fetchOrdenes} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default OrdenesLista;
