import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  CircularProgress,
  IconButton
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import TodayIcon from '@mui/icons-material/Today';
import ScaleIcon from '@mui/icons-material/Scale';
import { obtenerBultos } from '../services/api';

export default function RegistroNode({ registro, pesoTiro, onPesoClick }) {
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

  // Extraer detalles horarios (OCR data)
  const detallesHorarios = registro.detalles || [];
  
  // Calcular sumas reales de la tabla (fallback si contadores son 0)
  const sumaColadasTabla = detallesHorarios.reduce((acc, d) => acc + (parseInt(d.coladas) || 0), 0);
  const totalColadasDisplay = (registro.total_coladas && registro.total_coladas > 0) 
    ? registro.total_coladas 
    : sumaColadasTabla;

  // Calcular estimado de kg (si backend da 0, calcularlo con el peso de tiro de la orden)
  const kgEstimadoBackend = registro['Total Kg (Est)'] || registro.total_kg || 0;
  const kgEstimadoCalculado = (totalColadasDisplay * (pesoTiro || 0)) / 1000;
  
  const totalKgDisplay = (kgEstimadoBackend > 0) ? kgEstimadoBackend : kgEstimadoCalculado;

  return (
    <Box sx={{ ml: 4, mb: 1 }}>
      <ListItemButton onClick={handleExpand} sx={{ borderRadius: 1, py: 0.5, bgcolor: '#fff', border: '1px solid #eee' }}>
        <ListItemIcon sx={{ minWidth: 36 }}>
          <TodayIcon fontSize="small" color="primary" />
        </ListItemIcon>
        <ListItemText 
          primary={`${registro.FECHA || registro.fecha || 'Sin fecha'} - ${registro.Turno || registro.turno || '?'}`}
          secondary={`${totalColadasDisplay} coladas ${registro.total_coladas ? '(Contador)' : '(Suma)'} | ${totalKgDisplay.toFixed(1)} kg (Est.)`}
          primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
          secondaryTypographyProps={{ variant: 'caption' }}
        />
        
        {/* Action Button for Weight Control (if prop provided) */}
        {onPesoClick && (
             <IconButton 
                size="small" 
                onClick={(e) => { e.stopPropagation(); onPesoClick(); }}
                sx={{ mr: 1, color: 'secondary.main', bgcolor: 'rgba(156, 39, 176, 0.05)' }}
            >
                <ScaleIcon fontSize="small" />
            </IconButton>
        )}
        
        {loading ? <CircularProgress size={16} /> : (expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />)}
      </ListItemButton>
      
      <Collapse in={expanded}>
        <Box sx={{ ml: 4, mb: 1, mt: 1 }}>
            {/* VISTA 1: TABLA DE COLADAS (OCR) */}
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.main', display: 'block', mb: 0.5 }}>
                📋 PRODUCCIÓN POR HORA (OCR)
            </Typography>
            {detallesHorarios.length > 0 ? (
                <Box component="table" sx={{ 
                    width: '100%', 
                    borderCollapse: 'collapse', 
                    fontSize: '0.75rem',
                    mb: 2,
                    bgcolor: 'background.paper',
                    border: '1px solid #eee'
                }}>
                    <thead>
                        <tr style={{ background: '#f5f5f5' }}>
                            <th style={{ padding: '4px', textAlign: 'left' }}>Hora</th>
                            <th style={{ padding: '4px', textAlign: 'left' }}>Maquinista</th>
                            <th style={{ padding: '4px', textAlign: 'left' }}>Color</th>
                            <th style={{ padding: '4px', textAlign: 'center' }}>Coladas</th>
                        </tr>
                    </thead>
                    <tbody>
                        {detallesHorarios.map((d, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '4px' }}>{d.hora}</td>
                                <td style={{ padding: '4px' }}>{d.maquinista || '-'}</td>
                                <td style={{ padding: '4px' }}>{d.color || '-'}</td>
                                <td style={{ padding: '4px', textAlign: 'center', fontWeight: 'bold' }}>{d.coladas}</td>
                            </tr>
                        ))}
                        <tr style={{ background: '#fafafa', borderTop: '2px solid #eee' }}>
                           <td colSpan={3} style={{ padding: '4px', textAlign: 'right', fontWeight: 'bold' }}>Total Suma:</td>
                           <td style={{ padding: '4px', textAlign: 'center', fontWeight: 'bold', color: '#1976d2' }}>{sumaColadasTabla}</td>
                        </tr>
                    </tbody>
                </Box>
            ) : (
                <Typography variant="caption" sx={{ fontStyle: 'italic', display: 'block', mb: 2, color: 'text.secondary' }}>
                    Sin detalles horarios registrados
                </Typography>
            )}

            {/* VISTA 2: LISTA DE PESAJES (VERIFICACION) */}
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'secondary.main', display: 'block', mb: 0.5 }}>
                ⚖️ VERIFICACIÓN DE PESO (BALANZA)
            </Typography>
            <Box sx={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: 0.5, 
                p: 1, 
                bgcolor: 'background.paper', 
                borderRadius: 1, 
                border: '1px solid #eee' 
            }}>
                {bultos.length === 0 && !loading && (
                    <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary', width: '100%', py: 0.5 }}>
                        Sin pesajes registrados
                    </Typography>
                )}
                {bultos.map((bulto, idx) => (
                    <Paper 
                        key={bulto.id || idx} 
                        elevation={0}
                        sx={{ 
                            py: 0.5, 
                            px: 1, 
                            border: '1px solid #e0e0e0', 
                            borderRadius: 1, 
                            bgcolor: '#f8f9fa',
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 1,
                            minWidth: 100
                        }}
                    >
                        <ScaleIcon sx={{ fontSize: 16, color: 'secondary.main' }} />
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.75rem', lineHeight: 1 }}>
                                {bulto.peso_real_kg?.toFixed(2)} kg
                            </Typography>
                            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', lineHeight: 1 }}>
                                {bulto.color || '-'}
                            </Typography>
                        </Box>
                    </Paper>
                ))}
            </Box>
        </Box>
      </Collapse>
    </Box>
  );
}
