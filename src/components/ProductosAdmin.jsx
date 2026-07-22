import { useState, useEffect, Fragment } from 'react';
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
  CircularProgress,
  Alert,
  Tooltip,
  Collapse
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import InventoryIcon from '@mui/icons-material/Inventory2';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { 
  buscarProductos, 
  eliminarProducto, 
  obtenerProducto
} from '../services/api';
import DataTableToolbar from './ui/DataTableToolbar';
import PageHeader from './ui/PageHeader';
import ProductoDialog from './ProductoDialog';
import { matchesOmniSearch, uniqueOptions } from '../utils/tableSearch';

function ProductosAdmin() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProducto, setEditingProducto] = useState(null);
  
  // Estado para filas expandidas
  const [expandedRows, setExpandedRows] = useState({});
  const [search, setSearch] = useState('');
  const [familyFilter, setFamilyFilter] = useState('TODAS');
  const [statusFilter, setStatusFilter] = useState('TODOS');

  const fetchProductos = async () => {
    try {
      setLoading(true);
      const data = await buscarProductos();
      setProductos(data);
    } catch {
      setError('Error cargando productos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductos();
  }, []);

  const handleOpenDialog = async (producto = null) => {
    if (producto) {
      try {
        const full = await obtenerProducto(producto.cod_sku_pt);
        setEditingProducto(full);
      } catch {
        setError('Error cargando producto');
        return;
      }
    } else {
      setEditingProducto(null);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingProducto(null);
  };

  const handleDelete = async (sku) => {
    if (window.confirm('¿Eliminar este producto?')) {
      try {
        await eliminarProducto(sku);
        fetchProductos();
      } catch {
        setError('No se pudo eliminar el producto');
      }
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const families = uniqueOptions(productos, 'familia');
  const visibleProductos = productos.filter((producto) => (
    (familyFilter === 'TODAS' || producto.familia === familyFilter)
    && (statusFilter === 'TODOS' || String(producto.status || 'Activo').toUpperCase() === statusFilter)
    && matchesOmniSearch(producto, search)
  ));

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ mb: 2 }}>
        <PageHeader
          eyebrow="Datos maestros"
          title="Productos terminados"
          description="Paquetes comerciales definidos por su BOM de PiezaColor."
        />
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <DataTableToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar SKU, producto, familia, línea o pieza BOM"
        filters={[
          { id: 'familia', label: 'Familia', value: familyFilter, onChange: setFamilyFilter, options: [{ value: 'TODAS', label: 'Todas' }, ...families.map((value) => ({ value, label: value }))] },
          { id: 'estado', label: 'Estado', value: statusFilter, onChange: setStatusFilter, options: [{ value: 'TODOS', label: 'Todos' }, { value: 'ACTIVO', label: 'Activos' }, { value: 'INACTIVO', label: 'Inactivos' }] },
        ]}
        resultCount={visibleProductos.length}
        totalCount={productos.length}
        onClear={() => { setSearch(''); setFamilyFilter('TODAS'); setStatusFilter('TODOS'); }}
        actions={<Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>Nuevo producto</Button>}
        sx={{ mb: 2 }}
      />

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 50 }}></TableCell>
              <TableCell>SKU</TableCell>
              <TableCell>Producto</TableCell>
              <TableCell>Familia</TableCell>
              <TableCell>Línea</TableCell>
              <TableCell align="right">Peso (g)</TableCell>
              <TableCell>Piezas (BOM)</TableCell>
              <TableCell align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleProductos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No hay productos para los filtros seleccionados.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              visibleProductos.map((producto) => (
                <Fragment key={producto.cod_sku_pt}>
                  <TableRow hover sx={{ '& > *': { borderBottom: 'unset' } }}>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={async () => {
                          if (!expandedRows[producto.cod_sku_pt]) {
                            try {
                              const full = await obtenerProducto(producto.cod_sku_pt);
                              setExpandedRows(prev => ({ ...prev, [producto.cod_sku_pt]: full.piezas || [] }));
                            } catch {
                              setExpandedRows(prev => ({ ...prev, [producto.cod_sku_pt]: [] }));
                            }
                          } else {
                            setExpandedRows(prev => ({ ...prev, [producto.cod_sku_pt]: null }));
                          }
                        }}
                      >
                        {expandedRows[producto.cod_sku_pt] ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{producto.cod_sku_pt}</Typography>
                    </TableCell>
                    <TableCell>{producto.producto}</TableCell>
                    <TableCell>{producto.familia}</TableCell>
                    <TableCell>{producto.linea}</TableCell>
                    <TableCell align="right">{producto.peso_g}</TableCell>
                    <TableCell>
                      <Chip size="small" label={`${producto.num_piezas || 0} piezas`} color={producto.num_piezas > 0 ? 'primary' : 'default'} />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => handleOpenDialog(producto)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar">
                        <IconButton size="small" color="error" onClick={() => handleDelete(producto.cod_sku_pt)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
                      <Collapse in={!!expandedRows[producto.cod_sku_pt]} timeout="auto" unmountOnExit>
                        <Box sx={{ margin: 1, ml: 6, mb: 2 }}>
                          <Typography variant="subtitle2" gutterBottom sx={{ color: '#1E3A5F' }}>
                            📦 Piezas (BOM)
                          </Typography>
                          {expandedRows[producto.cod_sku_pt]?.length > 0 ? (
                            <Table size="small">
                              <TableHead>
                                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                  <TableCell>SKU Pieza</TableCell>
                                  <TableCell>Nombre</TableCell>
                                  <TableCell>Color</TableCell>
                                  <TableCell align="right">Peso (g)</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {expandedRows[producto.cod_sku_pt].map((pieza) => (
                                  <TableRow key={pieza.sku}>
                                    <TableCell>{pieza.sku}</TableCell>
                                    <TableCell>{pieza.nombre}</TableCell>
                                    <TableCell>{pieza.color}</TableCell>
                                    <TableCell align="right">{pieza.peso}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              No hay piezas asociadas a este producto.
                            </Typography>
                          )}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <ProductoDialog
        open={dialogOpen}
        producto={editingProducto}
        onClose={handleCloseDialog}
        onSaved={fetchProductos}
      />
    </Box>
  );
}

export default ProductosAdmin;
