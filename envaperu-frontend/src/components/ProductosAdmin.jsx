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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  Tooltip,
  Autocomplete,
  Stack,
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
  crearProducto, 
  actualizarProducto, 
  eliminarProducto, 
  obtenerProducto,
  buscarPiezas 
} from '../services/api';

function ProductosAdmin() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProducto, setEditingProducto] = useState(null);
  
  const [formData, setFormData] = useState({
    cod_sku_pt: '',
    producto: '',
    familia: '',
    linea: '',
    peso_g: '',
    precio_estimado: '',
    status: 'Activo',
    piezas: []
  });
  
  // Estado para selector de piezas
  const [piezasOptions, setPiezasOptions] = useState([]);
  const [piezasLoading, setPiezasLoading] = useState(false);
  const [piezaInput, setPiezaInput] = useState('');
  
  // Estado para filas expandidas
  const [expandedRows, setExpandedRows] = useState({});

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

  // Buscar piezas para agregar al BOM
  useEffect(() => {
    if (piezaInput.length < 2) {
      setPiezasOptions([]);
      return;
    }
    const timeoutId = setTimeout(async () => {
      setPiezasLoading(true);
      try {
        const piezas = await buscarPiezas(piezaInput);
        setPiezasOptions(piezas);
      } catch {
        setPiezasOptions([]);
      } finally {
        setPiezasLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [piezaInput]);

  const handleOpenDialog = async (producto = null) => {
    if (producto) {
      try {
        const full = await obtenerProducto(producto.cod_sku_pt);
        setEditingProducto(full);
        setFormData({
          cod_sku_pt: full.cod_sku_pt,
          producto: full.producto,
          familia: full.familia || '',
          linea: full.linea || '',
          peso_g: full.peso_g || '',
          precio_estimado: full.precio_estimado || '',
          status: full.status || 'Activo',
          piezas: full.piezas?.map(p => ({ pieza_sku: p.sku, nombre: p.nombre, cantidad: p.cantidad })) || []
        });
      } catch {
        setError('Error cargando producto');
        return;
      }
    } else {
      setEditingProducto(null);
      setFormData({
        cod_sku_pt: '',
        producto: '',
        familia: '',
        linea: '',
        peso_g: '',
        precio_estimado: '',
        status: 'Activo',
        piezas: []
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingProducto(null);
  };

  const handleAddPieza = (pieza) => {
    if (!pieza) return;
    const exists = formData.piezas.find(p => p.pieza_sku === pieza.sku);
    if (exists) return;
    
    setFormData(prev => ({
      ...prev,
      piezas: [...prev.piezas, { pieza_sku: pieza.sku, nombre: pieza.piezas, cantidad: 1 }]
    }));
    setPiezaInput('');
  };

  const handleRemovePieza = (sku) => {
    setFormData(prev => ({
      ...prev,
      piezas: prev.piezas.filter(p => p.pieza_sku !== sku)
    }));
  };

  const handleSubmit = async () => {
    try {
      const data = {
        ...formData,
        peso_g: formData.peso_g ? parseFloat(formData.peso_g) : null,
        precio_estimado: formData.precio_estimado ? parseFloat(formData.precio_estimado) : null
      };
      
      if (editingProducto) {
        await actualizarProducto(editingProducto.cod_sku_pt, data);
      } else {
        await crearProducto(data);
      }
      
      handleCloseDialog();
      fetchProductos();
    } catch {
      setError('Error guardando producto');
    }
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

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={600}>
          <InventoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Catálogo de Productos
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{ bgcolor: '#1E3A5F' }}
        >
          Nuevo Producto
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead sx={{ bgcolor: '#1E3A5F' }}>
            <TableRow>
              <TableCell sx={{ color: 'white', width: 50 }}></TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>SKU</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>Producto</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>Familia</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>Línea</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">Peso (g)</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>Piezas (BOM)</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }} align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {productos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No hay productos registrados.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              productos.map((producto) => (
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

      {/* Dialog para crear/editar */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingProducto ? 'Editar Producto' : 'Nuevo Producto'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField
                label="SKU"
                value={formData.cod_sku_pt}
                onChange={(e) => setFormData({ ...formData, cod_sku_pt: e.target.value })}
                disabled={!!editingProducto}
                fullWidth
              />
              <TextField
                label="Nombre Producto"
                value={formData.producto}
                onChange={(e) => setFormData({ ...formData, producto: e.target.value })}
                fullWidth
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Familia"
                value={formData.familia}
                onChange={(e) => setFormData({ ...formData, familia: e.target.value })}
                fullWidth
              />
              <TextField
                label="Línea"
                value={formData.linea}
                onChange={(e) => setFormData({ ...formData, linea: e.target.value })}
                fullWidth
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Peso (g)"
                type="number"
                value={formData.peso_g}
                onChange={(e) => setFormData({ ...formData, peso_g: e.target.value })}
                fullWidth
              />
              <TextField
                label="Precio Estimado"
                type="number"
                value={formData.precio_estimado}
                onChange={(e) => setFormData({ ...formData, precio_estimado: e.target.value })}
                fullWidth
              />
            </Stack>
            
            {/* BOM - Lista de Piezas */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Piezas (BOM)</Typography>
              <Autocomplete
                options={piezasOptions}
                getOptionLabel={(option) => option.piezas || ''}
                loading={piezasLoading}
                inputValue={piezaInput}
                onInputChange={(_, v) => setPiezaInput(v)}
                onChange={(_, v) => handleAddPieza(v)}
                renderInput={(params) => (
                  <TextField {...params} size="small" placeholder="Buscar pieza para agregar..." />
                )}
                renderOption={(props, option) => (
                  <li {...props} key={option.sku}>
                    <Box>
                      <Typography variant="body2">{option.piezas}</Typography>
                      <Typography variant="caption" color="text.secondary">{option.sku}</Typography>
                    </Box>
                  </li>
                )}
              />
              <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {formData.piezas.map((p) => (
                  <Chip
                    key={p.pieza_sku}
                    label={`${p.nombre || p.pieza_sku} (${p.cantidad})`}
                    onDelete={() => handleRemovePieza(p.pieza_sku)}
                    size="small"
                  />
                ))}
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button variant="contained" onClick={handleSubmit} sx={{ bgcolor: '#1E3A5F' }}>
            {editingProducto ? 'Guardar' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ProductosAdmin;
