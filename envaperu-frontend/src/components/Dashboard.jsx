import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Paper,
  Chip,
  LinearProgress,
  Tooltip,
  Divider
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import TodayIcon from '@mui/icons-material/Today';
import ScaleIcon from '@mui/icons-material/Scale';
import SpeedIcon from '@mui/icons-material/Speed';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import { obtenerOrdenes, obtenerRegistros, obtenerMaquinas } from '../services/api';
import ProductionTree from './ProductionTree';

function KpiCard({ title, value, subtitle, icon, color = 'primary', progress = null }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box
            sx={{
              p: 1,
              borderRadius: 2,
              backgroundColor: `${color}.light`,
              color: `${color}.main`,
              mr: 2,
            }}
          >
            {icon}
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {value}
          </Typography>
        </Box>
        <Typography variant="subtitle1" color="text.secondary">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
        {progress !== null && (
          <Box sx={{ mt: 1 }}>
            <LinearProgress 
              variant="determinate" 
              value={Math.min(progress, 100)} 
              color={color}
              sx={{ height: 6, borderRadius: 3 }}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// Componente para mostrar estado de una máquina
function MachineCard({ maquina, ordenActiva }) {
  const isActive = !!ordenActiva;
  const progress = ordenActiva 
    ? Math.min(((ordenActiva.avance_real_kg || 0) / (ordenActiva.meta_kg || 1)) * 100, 100)
    : 0;

  return (
    <Paper 
      sx={{ 
        p: 2, 
        border: '2px solid',
        borderColor: isActive ? 'success.main' : 'grey.300',
        backgroundColor: isActive ? 'success.soft' : 'grey.50',
        height: '100%'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <PrecisionManufacturingIcon 
          sx={{ color: isActive ? 'success.main' : 'grey.400' }} 
        />
        <Typography variant="subtitle2" fontWeight={600}>
          {maquina.nombre}
        </Typography>
        <Chip 
          size="small" 
          label={isActive ? 'EN PROD' : 'LIBRE'}
          color={isActive ? 'success' : 'default'}
          sx={{ ml: 'auto', height: 20, fontSize: '0.65rem' }}
        />
      </Box>
      
      {isActive ? (
        <>
          <Typography variant="caption" color="text.secondary" display="block">
            {ordenActiva.numero_op} • {ordenActiva.producto || 'Sin producto'}
          </Typography>
          <Box sx={{ mt: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption">Avance</Typography>
              <Typography variant="caption" fontWeight={600}>
                {progress.toFixed(0)}%
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              color="success"
              sx={{ height: 4, borderRadius: 2 }}
            />
          </Box>
        </>
      ) : (
        <Typography variant="caption" color="text.secondary" fontStyle="italic">
          Sin orden asignada
        </Typography>
      )}
    </Paper>
  );
}

// Componente para desglose por Familia
function FamiliaBreakdown({ ordenes }) {
  // Agrupar producción por familia/linea
  const breakdown = ordenes
    .filter(o => o.activa !== false)
    .reduce((acc, o) => {
      const familia = o.familia || o.producto || 'Sin clasificar';
      if (!acc[familia]) {
        acc[familia] = { kg: 0, count: 0 };
      }
      acc[familia].kg += o.avance_real_kg || 0;
      acc[familia].count += 1;
      return acc;
    }, {});

  const entries = Object.entries(breakdown).sort((a, b) => b[1].kg - a[1].kg);
  const maxKg = entries.length > 0 ? Math.max(...entries.map(e => e[1].kg)) : 0;

  if (entries.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" fontStyle="italic">
        Sin datos de producción activa
      </Typography>
    );
  }

  return (
    <Box>
      {entries.slice(0, 5).map(([familia, data]) => (
        <Box key={familia} sx={{ mb: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2" fontWeight={500}>
              {familia}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {data.kg.toFixed(1)} kg ({data.count} OPs)
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={maxKg > 0 ? (data.kg / maxKg) * 100 : 0}
            sx={{ height: 8, borderRadius: 4, bgcolor: 'grey.200' }}
          />
        </Box>
      ))}
    </Box>
  );
}

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [ordenes, setOrdenes] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [stats, setStats] = useState({
    opsActivas: 0,
    opsCerradas: 0,
    registrosHoy: 0,
    kgHoy: 0,
    eficienciaGlobal: 0,
    maquinasActivas: 0,
    totalMaquinas: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [ordenesData, registrosData, maquinasData] = await Promise.all([
          obtenerOrdenes(),
          obtenerRegistros(),
          obtenerMaquinas()
        ]);
        
        setOrdenes(ordenesData);
        setMaquinas(maquinasData);
        
        const hoy = new Date().toISOString().split('T')[0];
        const registrosHoy = registrosData.filter(r => r.fecha === hoy);
        
        // Calcular eficiencia global (promedio de avance de OPs activas)
        const opsActivas = ordenesData.filter(o => o.activa !== false);
        const eficiencia = opsActivas.length > 0
          ? opsActivas.reduce((acc, o) => {
              const meta = o.meta_kg || 1;
              const avance = o.avance_real_kg || 0;
              return acc + Math.min((avance / meta) * 100, 100);
            }, 0) / opsActivas.length
          : 0;

        // Identificar máquinas con OPs activas
        const maquinasConOP = new Set(opsActivas.map(o => o.maquina_id));
        
        setStats({
          opsActivas: opsActivas.length,
          opsCerradas: ordenesData.filter(o => o.activa === false).length,
          registrosHoy: registrosHoy.length,
          kgHoy: registrosHoy.reduce((acc, r) => acc + (r.total_kg || 0), 0),
          eficienciaGlobal: eficiencia,
          maquinasActivas: maquinasConOP.size,
          totalMaquinas: maquinasData.length
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  // Mapear máquinas a sus OPs activas
  const getMaquinaOP = (maquinaId) => {
    return ordenes.find(o => o.maquina_id === maquinaId && o.activa !== false);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
        Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Visión general de la planta • {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
      </Typography>

      {/* KPIs Principales */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={4} md={2.4}>
          <KpiCard
            title="OPs Activas"
            value={stats.opsActivas}
            subtitle="En producción"
            icon={<AssignmentIcon />}
            color="primary"
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <Tooltip title="Promedio de avance hacia meta de todas las OPs activas">
            <Box sx={{ height: '100%' }}>
              <KpiCard
                title="Eficiencia Global"
                value={`${stats.eficienciaGlobal.toFixed(0)}%`}
                subtitle="Avance promedio"
                icon={<SpeedIcon />}
                color="success"
                progress={stats.eficienciaGlobal}
              />
            </Box>
          </Tooltip>
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <KpiCard
            title="Máquinas"
            value={`${stats.maquinasActivas}/${stats.totalMaquinas}`}
            subtitle="En operación"
            icon={<PrecisionManufacturingIcon />}
            color="info"
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <KpiCard
            title="Registros Hoy"
            value={stats.registrosHoy}
            subtitle={new Date().toLocaleDateString()}
            icon={<TodayIcon />}
            color="secondary"
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <KpiCard
            title="Kg Hoy"
            value={stats.kgHoy.toFixed(0)}
            subtitle="Producción del día"
            icon={<ScaleIcon />}
            color="warning"
          />
        </Grid>
      </Grid>

      {/* Grid de Máquinas */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          🏭 Estado de Máquinas
        </Typography>
        <Grid container spacing={1.5}>
          {maquinas.map((maq) => (
            <Grid item xs={6} sm={4} md={3} lg={2} key={maq.id}>
              <MachineCard maquina={maq} ordenActiva={getMaquinaOP(maq.id)} />
            </Grid>
          ))}
          {maquinas.length === 0 && (
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" fontStyle="italic">
                No hay máquinas registradas
              </Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* Desglose por Familia */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              📊 Producción por Línea
            </Typography>
            <FamiliaBreakdown ordenes={ordenes} />
          </Paper>
        </Grid>
        <Grid item xs={12} md={7}>
          <ProductionTree limit={5} />
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard;
