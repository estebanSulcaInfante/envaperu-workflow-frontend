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
  Divider
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import RefreshIcon from '@mui/icons-material/Refresh';
import FactoryIcon from '@mui/icons-material/Factory';
import { obtenerOrdenes } from '../services/api';

function LoteRow({ lote }) {
  return (
    <Card 
      sx={{ 
        mb: 1, 
        background: 'rgba(22, 33, 62, 0.6)',
        border: '1px solid rgba(255,255,255,0.05)'
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

function OrdenRow({ orden }) {
  const [open, setOpen] = useState(false);
  const resumen = orden.resumen_totales || {};

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
            sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
          />
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ py: 2, px: 1 }}>
              {/* Resumen de la orden */}
              <Paper 
                sx={{ 
                  p: 2, 
                  mb: 2, 
                  background: 'rgba(102, 126, 234, 0.1)',
                  border: '1px solid rgba(102, 126, 234, 0.2)'
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
          background: 'rgba(26, 26, 46, 0.9)',
          border: '1px solid rgba(255,255,255,0.1)'
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
        background: 'rgba(26, 26, 46, 0.9)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}
    >
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          📋 Órdenes de Producción ({ordenes.length})
        </Typography>
        <IconButton onClick={fetchOrdenes} color="primary">
          <RefreshIcon />
        </IconButton>
      </Box>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
      <Table>
        <TableHead>
          <TableRow sx={{ background: 'rgba(102, 126, 234, 0.1)' }}>
            <TableCell width={50} />
            <TableCell>N° OP</TableCell>
            <TableCell>Producto</TableCell>
            <TableCell>Máquina</TableCell>
            <TableCell>Tipo</TableCell>
            <TableCell align="right">Producción (Kg)</TableCell>
            <TableCell align="right">Tiempo Est.</TableCell>
            <TableCell>Colores</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {ordenes.map((orden) => (
            <OrdenRow key={orden.id} orden={orden} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default OrdenesLista;
