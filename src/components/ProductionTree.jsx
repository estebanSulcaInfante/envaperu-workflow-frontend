import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Collapse,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { obtenerOrdenes, obtenerRegistros } from '../services/api';
import RegistroNode from './RegistroNode';

function OrdenNode({ orden }) {
  const [expanded, setExpanded] = useState(false);
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleExpand = async () => {
    if (!expanded && registros.length === 0) {
      setLoading(true);
      try {
        const data = await obtenerRegistros(orden.numero_op);
        setRegistros(data);
      } catch (error) {
        console.error('Error loading registros:', error);
      } finally {
        setLoading(false);
      }
    }
    setExpanded(!expanded);
  };

  // Cálculos de progreso
  const meta = orden.meta_kg || 0;
  // Usamos avance_real_kg si existe (backend nuevo), fallback a resumen_totales o 0
  const real = orden.avance_real_kg || 0; 
  const porcentaje = meta > 0 ? Math.min((real / meta) * 100, 100) : 0;
  
  // Fecha formateada
  const fechaInicio = orden.fecha_inicio ? new Date(orden.fecha_inicio).toLocaleDateString() : 'Sin fecha';

  return (
    <Box sx={{ mb: 1.5 }}>
      <Paper variant="outlined" sx={{ overflow: 'hidden', borderColor: expanded ? 'primary.main' : 'divider' }}>
        <ListItemButton 
          onClick={handleExpand}
          sx={{ 
            bgcolor: expanded ? 'primary.soft' : 'transparent',
            '&:hover': { bgcolor: 'action.hover' },
            flexWrap: 'wrap'
          }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <AssignmentIcon color={orden.activa !== false ? 'primary' : 'disabled'} />
          </ListItemIcon>
          
          <ListItemText 
            sx={{ my: 0.5, flex: '1 1 300px', mr: 2 }}
            primary={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {orden.numero_op}
                </Typography>
                <Chip 
                  size="small" 
                  label={orden.activa !== false ? 'Activa' : 'Cerrada'} 
                  color={orden.activa !== false ? 'success' : 'default'}
                  variant={orden.activa !== false ? 'filled' : 'outlined'}
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
                <Typography variant="body2" color="text.secondary">
                  • {orden.producto || 'Sin producto'}
                </Typography>
              </Box>
            }
            secondary={
              <Box>
                {/* Barra de Progreso */}
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5, mb: 0.5 }}>
                  <Box sx={{ width: '100%', mr: 1 }}>
                    <Box 
                      sx={{ 
                        height: 6, 
                        width: '100%', 
                        bgcolor: 'grey.200', 
                        borderRadius: 3,
                        overflow: 'hidden'
                      }}
                    >
                      <Box 
                        sx={{ 
                          height: '100%', 
                          width: `${porcentaje}%`, 
                          bgcolor: orden.activa !== false ? 'success.main' : 'text.disabled',
                          transition: 'width 0.5s ease-in-out'
                        }} 
                      />
                    </Box>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 35 }}>
                    {Math.round(porcentaje)}%
                  </Typography>
                </Box>
                
                {/* Detalles Texto */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'text.secondary' }}>
                  <span>
                    PROGRESO: <strong>{real.toFixed(1)} kg</strong> / {meta.toFixed(1)} kg
                  </span>
                  <span>
                    INICIO: {fechaInicio}
                  </span>
                </Box>
              </Box>
            }
          />
          
          {loading ? <CircularProgress size={20} /> : (expanded ? <ExpandLessIcon color="action" /> : <ExpandMoreIcon color="action" />)}
        </ListItemButton>
        
        <Collapse in={expanded}>
          <Divider />
          <List dense sx={{ py: 0, bgcolor: 'background.paper' }}>
            {registros.length === 0 && !loading && (
              <ListItem sx={{ py: 2, justifyContent: 'center' }}>
                <Typography variant="body2" color="text.secondary" fontStyle="italic">
                  Sin registros diarios de producción
                </Typography>
              </ListItem>
            )}
            {registros.map((reg) => (
                <RegistroNode 
                    key={reg['ID Registro'] || reg.id} 
                    registro={reg} 
                    pesoTiro={orden.peso_tiro} 
                />
            ))}
          </List>
        </Collapse>
      </Paper>
    </Box>
  );
}

function ProductionTree({ limit = 10 }) {
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await obtenerOrdenes();
        // Sort by most recent and active first
        const sorted = data.sort((a, b) => {
          if (a.activa !== b.activa) return a.activa === false ? 1 : -1;
          return 0;
        });
        setOrdenes(sorted.slice(0, limit));
      } catch (error) {
        console.error('Error loading ordenes:', error);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [limit]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        📊 Estructura de Producción
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Click para expandir: OP → Registros Diarios → Pesajes
      </Typography>
      <Divider sx={{ mb: 2 }} />
      
      <List sx={{ py: 0 }}>
        {ordenes.map((orden) => (
          <OrdenNode key={orden.numero_op} orden={orden} />
        ))}
      </List>
      
      {ordenes.length === 0 && (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
          No hay órdenes de producción
        </Typography>
      )}
    </Paper>
  );
}

export default ProductionTree;
