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

  return (
    <Box sx={{ mb: 1 }}>
      <ListItemButton 
        onClick={handleExpand}
        sx={{ 
          borderRadius: 1,
          bgcolor: expanded ? 'primary.light' : 'transparent',
          '&:hover': { bgcolor: 'primary.light' }
        }}
      >
        <ListItemIcon sx={{ minWidth: 40 }}>
          <AssignmentIcon color={orden.activa !== false ? 'primary' : 'disabled'} />
        </ListItemIcon>
        <ListItemText 
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2" fontWeight={600}>
                {orden.numero_op}
              </Typography>
              <Chip 
                size="small" 
                label={orden.activa !== false ? 'Activa' : 'Cerrada'} 
                color={orden.activa !== false ? 'success' : 'default'}
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            </Box>
          }
          secondary={`${orden.producto || 'Sin producto'} | ${orden.resumen_totales?.['Peso(Kg) PRODUCCION']?.toFixed(1) || 0} kg`}
          secondaryTypographyProps={{ variant: 'caption' }}
        />
        {loading ? <CircularProgress size={18} /> : (expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />)}
      </ListItemButton>
      
      <Collapse in={expanded}>
        <List dense sx={{ py: 0 }}>
          {registros.length === 0 && !loading && (
            <ListItem sx={{ ml: 4, py: 0.5 }}>
              <ListItemText 
                secondary="Sin registros diarios" 
                secondaryTypographyProps={{ variant: 'caption', fontStyle: 'italic' }}
              />
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
