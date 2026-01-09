import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import TodayIcon from '@mui/icons-material/Today';
import ScaleIcon from '@mui/icons-material/Scale';
import { obtenerOrdenes, obtenerRegistros } from '../services/api';
import ProductionTree from './ProductionTree';

function KpiCard({ title, value, subtitle, icon, color = 'primary' }) {
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
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    opsActivas: 0,
    opsCerradas: 0,
    registrosHoy: 0,
    kgProducidos: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const ordenes = await obtenerOrdenes();
        const registros = await obtenerRegistros();
        
        const hoy = new Date().toISOString().split('T')[0];
        const registrosHoy = registros.filter(r => r.fecha === hoy);
        
        setStats({
          opsActivas: ordenes.filter(o => o.activa !== false).length,
          opsCerradas: ordenes.filter(o => o.activa === false).length,
          registrosHoy: registrosHoy.length,
          kgProducidos: registros.reduce((acc, r) => acc + (r.total_kg || 0), 0),
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Resumen general del sistema de producción
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="OPs Activas"
            value={stats.opsActivas}
            subtitle="En producción"
            icon={<AssignmentIcon />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="OPs Cerradas"
            value={stats.opsCerradas}
            subtitle="Completadas"
            icon={<AssignmentIcon />}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Registros Hoy"
            value={stats.registrosHoy}
            subtitle={new Date().toLocaleDateString()}
            icon={<TodayIcon />}
            color="info"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Kg Producidos"
            value={stats.kgProducidos.toFixed(0)}
            subtitle="Total acumulado"
            icon={<ScaleIcon />}
            color="warning"
          />
        </Grid>
      </Grid>

      {/* Hierarchical Production Tree */}
      <Box sx={{ mt: 4 }}>
        <ProductionTree limit={10} />
      </Box>
    </Box>
  );
}

export default Dashboard;
