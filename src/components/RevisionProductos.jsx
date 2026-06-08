import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Chip,
  TextField,
  Alert,
  Tooltip,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  LinearProgress,
  Card,
  CardContent,
  Tabs,
  Tab
} from '@mui/material';
import RateReviewIcon from '@mui/icons-material/RateReview';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import EditNoteIcon from '@mui/icons-material/EditNote';
import FilterListIcon from '@mui/icons-material/FilterList';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import CategoryIcon from '@mui/icons-material/Category';
import InventoryIcon from '@mui/icons-material/Inventory2';
import {
  listarProductosRevision,
  actualizarRevisionProducto,
  actualizarRevisionBulk,
  obtenerEstadisticasRevision,
  listarPiezasRevision,
  actualizarRevisionPieza,
  actualizarRevisionPiezasBulk,
  obtenerEstadisticasRevisionPiezas
} from '../services/api';

const ESTADOS = {
  IMPORTADO: { label: 'Importado', color: 'warning', icon: <PendingIcon fontSize="small" /> },
  EN_REVISION: { label: 'En Revisión', color: 'info', icon: <EditNoteIcon fontSize="small" /> },
  VERIFICADO: { label: 'Verificado', color: 'success', icon: <CheckCircleIcon fontSize="small" /> }
};

function TabPanel({ children, value, index, ...other }) {
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

function RevisionProductos() {
  const [tabIndex, setTabIndex] = useState(0);
  const tipoActual = tabIndex === 0 ? 'productos' : 'piezas';
  
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  
  // Filtros y paginación
  const [filtroEstado, setFiltroEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  
  // Selección para bulk actions
  const [selected, setSelected] = useState([]);
  
  // Dialog de edición
  const [editDialog, setEditDialog] = useState({ open: false, item: null });
  const [editNotas, setEditNotas] = useState('');
  const [editEstado, setEditEstado] = useState('');

  const fetchStats = useCallback(async () => {
    try {
      const data = tipoActual === 'productos' 
        ? await obtenerEstadisticasRevision()
        : await obtenerEstadisticasRevisionPiezas();
      setStats(data);
    } catch (err) {
      console.error('Error cargando estadísticas:', err);
    }
  }, [tipoActual]);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page,
        per_page: 15,
        ...(filtroEstado && { estado: filtroEstado }),
        ...(busqueda && { q: busqueda })
      };
      
      const data = tipoActual === 'productos'
        ? await listarProductosRevision(params)
        : await listarPiezasRevision(params);
      
      setItems(tipoActual === 'productos' ? data.productos : data.piezas);
      setPagination(data.pagination);
      setSelected([]);
    } catch (err) {
      setError('Error cargando datos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, filtroEstado, busqueda, tipoActual]);

  useEffect(() => {
    fetchItems();
    fetchStats();
  }, [fetchItems, fetchStats]);

  // Reset al cambiar de tab
  useEffect(() => {
    setPage(1);
    setFiltroEstado('');
    setBusqueda('');
    setSelected([]);
  }, [tabIndex]);

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      setPage(1);
      fetchItems();
    }
  };

  const getItemKey = (item) => {
    return tipoActual === 'productos' ? item.cod_sku_pt : item.sku;
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelected(items.map(getItemKey));
    } else {
      setSelected([]);
    }
  };

  const handleSelect = (key) => {
    setSelected(prev => 
      prev.includes(key) 
        ? prev.filter(s => s !== key)
        : [...prev, key]
    );
  };

  const handleBulkUpdate = async (nuevoEstado) => {
    if (selected.length === 0) return;
    
    try {
      if (tipoActual === 'productos') {
        await actualizarRevisionBulk(selected, nuevoEstado);
      } else {
        await actualizarRevisionPiezasBulk(selected, nuevoEstado);
      }
      fetchItems();
      fetchStats();
    } catch {
      setError('Error actualizando datos');
    }
  };

  const handleOpenEdit = (item) => {
    setEditDialog({ open: true, item });
    setEditNotas(item.notas_revision || '');
    setEditEstado(item.estado_revision);
  };

  const handleSaveEdit = async () => {
    try {
      const key = getItemKey(editDialog.item);
      if (tipoActual === 'productos') {
        await actualizarRevisionProducto(key, {
          estado_revision: editEstado,
          notas_revision: editNotas
        });
      } else {
        await actualizarRevisionPieza(key, {
          estado_revision: editEstado,
          notas_revision: editNotas
        });
      }
      setEditDialog({ open: false, item: null });
      fetchItems();
      fetchStats();
    } catch {
      setError('Error guardando cambios');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-PE', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const renderStats = () => (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
      <Card sx={{ bgcolor: '#fff3e0' }}>
        <CardContent>
          <Typography variant="h4" fontWeight={700} color="warning.main">
            {stats?.por_estado?.IMPORTADO || 0}
          </Typography>
          <Typography variant="body2" color="text.secondary">Importados (Pendientes)</Typography>
        </CardContent>
      </Card>
      <Card sx={{ bgcolor: '#e3f2fd' }}>
        <CardContent>
          <Typography variant="h4" fontWeight={700} color="info.main">
            {stats?.por_estado?.EN_REVISION || 0}
          </Typography>
          <Typography variant="body2" color="text.secondary">En Revisión</Typography>
        </CardContent>
      </Card>
      <Card sx={{ bgcolor: '#e8f5e9' }}>
        <CardContent>
          <Typography variant="h4" fontWeight={700} color="success.main">
            {stats?.por_estado?.VERIFICADO || 0}
          </Typography>
          <Typography variant="body2" color="text.secondary">Verificados</Typography>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h4" fontWeight={700} color="primary">
            {stats?.porcentaje_verificado || 0}%
          </Typography>
          <Typography variant="body2" color="text.secondary">Progreso</Typography>
          <LinearProgress 
            variant="determinate" 
            value={stats?.porcentaje_verificado || 0} 
            sx={{ mt: 1, height: 8, borderRadius: 4 }}
          />
        </CardContent>
      </Card>
    </Box>
  );

  const renderFilters = () => (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <FilterListIcon color="action" />
        <TextField
          size="small"
          placeholder={`Buscar ${tipoActual === 'productos' ? 'producto' : 'pieza'}, SKU...`}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={handleSearch}
          InputProps={{
            endAdornment: <SearchIcon color="action" />
          }}
          sx={{ width: 300 }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Estado</InputLabel>
          <Select
            value={filtroEstado}
            label="Estado"
            onChange={(e) => { setFiltroEstado(e.target.value); setPage(1); }}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="IMPORTADO">Importados</MenuItem>
            <MenuItem value="EN_REVISION">En Revisión</MenuItem>
            <MenuItem value="VERIFICADO">Verificados</MenuItem>
          </Select>
        </FormControl>
        
        {/* Bulk Actions */}
        {selected.length > 0 && (
          <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
            <Typography variant="body2" sx={{ alignSelf: 'center', mr: 1 }}>
              {selected.length} seleccionados:
            </Typography>
            <Button 
              size="small" 
              variant="outlined" 
              color="info"
              onClick={() => handleBulkUpdate('EN_REVISION')}
            >
              Marcar En Revisión
            </Button>
            <Button 
              size="small" 
              variant="contained" 
              color="success"
              onClick={() => handleBulkUpdate('VERIFICADO')}
            >
              Marcar Verificados
            </Button>
          </Stack>
        )}
      </Stack>
    </Paper>
  );

  const renderTable = () => (
    <TableContainer component={Paper}>
      {loading && <LinearProgress />}
      <Table size="small">
        <TableHead sx={{ bgcolor: '#1E3A5F' }}>
          <TableRow>
            <TableCell padding="checkbox" sx={{ color: 'white' }}>
              <Checkbox
                indeterminate={selected.length > 0 && selected.length < items.length}
                checked={items.length > 0 && selected.length === items.length}
                onChange={handleSelectAll}
                sx={{ color: 'white', '&.Mui-checked': { color: 'white' } }}
              />
            </TableCell>
            <TableCell sx={{ color: 'white', fontWeight: 600 }}>SKU</TableCell>
            <TableCell sx={{ color: 'white', fontWeight: 600 }}>
              {tipoActual === 'productos' ? 'Producto' : 'Pieza'}
            </TableCell>
            <TableCell sx={{ color: 'white', fontWeight: 600 }}>Línea</TableCell>
            <TableCell sx={{ color: 'white', fontWeight: 600 }}>Familia</TableCell>
            <TableCell sx={{ color: 'white', fontWeight: 600 }}>Estado</TableCell>
            <TableCell sx={{ color: 'white', fontWeight: 600 }}>Importado</TableCell>
            <TableCell sx={{ color: 'white', fontWeight: 600 }}>Notas</TableCell>
            <TableCell sx={{ color: 'white', fontWeight: 600 }} align="center">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {!loading && items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                <Typography color="text.secondary">
                  No hay {tipoActual} que coincidan con los filtros.
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => {
              const key = getItemKey(item);
              const estado = ESTADOS[item.estado_revision] || ESTADOS.IMPORTADO;
              const nombre = tipoActual === 'productos' ? item.producto : item.piezas;
              
              return (
                <TableRow 
                  key={key} 
                  hover
                  selected={selected.includes(key)}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selected.includes(key)}
                      onChange={() => handleSelect(key)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600} fontFamily="monospace">
                      {key}
                    </Typography>
                  </TableCell>
                  <TableCell>{nombre}</TableCell>
                  <TableCell>{item.linea || '-'}</TableCell>
                  <TableCell>{item.familia || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      icon={estado.icon}
                      label={estado.label}
                      color={estado.color}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {formatDate(item.fecha_importacion)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {item.notas_revision ? (
                      <Tooltip title={item.notas_revision}>
                        <Typography variant="caption" sx={{ 
                          maxWidth: 150, 
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {item.notas_revision}
                        </Typography>
                      </Tooltip>
                    ) : '-'}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Revisar / Editar">
                      <IconButton size="small" onClick={() => handleOpenEdit(item)}>
                        <EditNoteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const renderEditDialog = () => (
    <Dialog open={editDialog.open} onClose={() => setEditDialog({ open: false, item: null })} maxWidth="sm" fullWidth>
      <DialogTitle>
        Revisar {tipoActual === 'productos' ? 'Producto' : 'Pieza'}
      </DialogTitle>
      <DialogContent>
        {editDialog.item && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">SKU</Typography>
              <Typography variant="h6" fontFamily="monospace">{getItemKey(editDialog.item)}</Typography>
              <Typography variant="body1" sx={{ mt: 1 }}>
                {tipoActual === 'productos' ? editDialog.item.producto : editDialog.item.piezas}
              </Typography>
              <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Línea: <strong>{editDialog.item.linea || '-'}</strong>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Familia: <strong>{editDialog.item.familia || '-'}</strong>
                </Typography>
              </Stack>
            </Box>
            
            <FormControl fullWidth>
              <InputLabel>Estado de Revisión</InputLabel>
              <Select
                value={editEstado}
                label="Estado de Revisión"
                onChange={(e) => setEditEstado(e.target.value)}
              >
                <MenuItem value="IMPORTADO">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PendingIcon color="warning" fontSize="small" />
                    <span>Importado (Pendiente)</span>
                  </Stack>
                </MenuItem>
                <MenuItem value="EN_REVISION">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <EditNoteIcon color="info" fontSize="small" />
                    <span>En Revisión</span>
                  </Stack>
                </MenuItem>
                <MenuItem value="VERIFICADO">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CheckCircleIcon color="success" fontSize="small" />
                    <span>Verificado</span>
                  </Stack>
                </MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              label="Notas de Revisión"
              multiline
              rows={3}
              value={editNotas}
              onChange={(e) => setEditNotas(e.target.value)}
              placeholder="Ej: Verificar precio con contabilidad, peso parece incorrecto..."
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setEditDialog({ open: false, item: null })}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={handleSaveEdit} sx={{ bgcolor: '#1E3A5F' }}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={600}>
          <RateReviewIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Revisión de Datos Importados
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => { fetchItems(); fetchStats(); }}
        >
          Actualizar
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs 
          value={tabIndex} 
          onChange={(_, newValue) => setTabIndex(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab 
            icon={<CategoryIcon />} 
            iconPosition="start" 
            label="Productos" 
            sx={{ minHeight: 48 }}
          />
          <Tab 
            icon={<InventoryIcon />} 
            iconPosition="start" 
            label="Piezas" 
            sx={{ minHeight: 48 }}
          />
        </Tabs>
      </Paper>

      {/* Stats */}
      {stats && renderStats()}

      {/* Filters */}
      {renderFilters()}

      {/* Table */}
      {renderTable()}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination
            count={pagination.pages}
            page={page}
            onChange={(_, p) => setPage(p)}
            color="primary"
          />
        </Box>
      )}

      {/* Edit Dialog */}
      {renderEditDialog()}
    </Box>
  );
}

export default RevisionProductos;
