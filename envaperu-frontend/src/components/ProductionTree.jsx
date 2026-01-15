import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
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
import TodayIcon from '@mui/icons-material/Today';
import ScaleIcon from '@mui/icons-material/Scale';
import { obtenerOrdenes, obtenerRegistros, obtenerBultos } from '../services/api';

function RegistroNode({ registro }) {
  const [expanded, setExpanded] = useState(false);
  const [bultos, setBultos] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleExpand = async () => {
    if (!expanded && bultos.length === 0) {
      setLoading(true);
      try {
        const data = await obtenerBultos(registro['ID Registro'] || registro.id);
        setBultos(data);
      } catch (error) {
        console.error('Error loading bultos:', error);
      } finally {
        setLoading(false);
      }
    }
    setExpanded(!expanded);
  };

  return (
    <Box sx={{ ml: 4 }}>
      <ListItemButton onClick={handleExpand} sx={{ borderRadius: 1, py: 0.5 }}>
        <ListItemIcon sx={{ minWidth: 36 }}>
          <TodayIcon fontSize="small" color="primary" />
        </ListItemIcon>
        <ListItemText 
          primary={`${registro.FECHA || registro.fecha || 'Sin fecha'} - ${registro.Turno || registro.turno || '?'}`}
          secondary={`${registro['Total Coladas (Calc)'] || registro.total_coladas || 0} coladas | ${(registro['Total Kg (Est)'] || registro.total_kg || 0).toFixed(1)} kg`}
          primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
          secondaryTypographyProps={{ variant: 'caption' }}
        />
        {loading ? <CircularProgress size={16} /> : (expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />)}
      </ListItemButton>
      
      <Collapse in={expanded}>
        <List dense sx={{ ml: 4, py: 0 }}>
          {bultos.length === 0 && !loading && (
            <ListItem sx={{ py: 0.5 }}>
              <ListItemText 
                secondary="Sin pesajes registrados" 
                secondaryTypographyProps={{ variant: 'caption', fontStyle: 'italic' }}
              />
            </ListItem>
          )}
          {bultos.map((bulto, idx) => (
            <ListItem key={bulto.id || idx} sx={{ py: 0.25 }}>
              <ListItemIcon sx={{ minWidth: 32 }}>
                <ScaleIcon fontSize="small" color="secondary" />
              </ListItemIcon>
              <ListItemText
                primary={`${bulto.peso_real_kg?.toFixed(2) || '?'} kg`}
                secondary={bulto.color || '-'}
                primaryTypographyProps={{ variant: 'caption', fontWeight: 600, color: 'text.primary' }}
                secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
              />
            </ListItem>
          ))}
        </List>
      </Collapse>
    </Box>
  );
}

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
            <RegistroNode key={reg['ID Registro'] || reg.id} registro={reg} />
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
