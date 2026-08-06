import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, IconButton, Paper, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import RestoreIcon from '@mui/icons-material/Restore';
import SellIcon from '@mui/icons-material/Sell';
import {
  actualizarProducto, buscarProductos, obtenerProducto,
} from '../services/api';
import DataTableToolbar from './ui/DataTableToolbar';
import PageHeader from './ui/PageHeader';
import ProductoDialog from './ProductoDialog';
import CommercialPresentationsDialog from './CommercialPresentationsDialog';
import { matchesOmniSearch, uniqueOptions } from '../utils/tableSearch';
import { useScmActor } from '../context/ScmActorContext';

export default function ProductosAdmin() {
  const { can, experience } = useScmActor();
  const canAdmin = can('ARTICULO_ADMINISTRAR');
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProducto, setEditingProducto] = useState(null);
  const [presentationProduct, setPresentationProduct] = useState(null);
  const [search, setSearch] = useState('');
  const [familyFilter, setFamilyFilter] = useState('TODAS');
  const [statusFilter, setStatusFilter] = useState('TODOS');

  const fetchProductos = async () => {
    try {
      setLoading(true);
      setProductos(await buscarProductos());
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error
        || 'No se pudo cargar el catálogo de productos.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProductos(); }, []);

  const openDialog = async (product = null) => {
    setError('');
    if (!product) {
      setEditingProducto(null);
      setDialogOpen(true);
      return;
    }
    if (!String(product.cod_sku_pt || '').trim()) {
      setError('El producto no tiene un SKU válido y debe normalizarse antes de editarlo.');
      return;
    }
    try {
      setEditingProducto(await obtenerProducto(product.cod_sku_pt));
      setDialogOpen(true);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error
        || 'No se pudo cargar el producto seleccionado.',
      );
    }
  };

  const toggleProduct = async (product) => {
    const inactive = String(product.status || 'ACTIVO').toUpperCase() === 'INACTIVO';
    const nextStatus = inactive ? 'ACTIVO' : 'INACTIVO';
    const action = inactive ? 'reactivar' : 'desactivar';
    if (!window.confirm(`¿Desea ${action} el producto ${product.cod_sku_pt}?`)) return;
    try {
      await actualizarProducto(product.cod_sku_pt, { status: nextStatus });
      setNotice(`${product.cod_sku_pt} ${inactive ? 'reactivado' : 'desactivado'}.`);
      await fetchProductos();
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error
        || `No se pudo ${action} el producto.`,
      );
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>;
  }

  const families = uniqueOptions(productos, 'familia');
  const visibleProducts = productos.filter((product) => (
    (familyFilter === 'TODAS' || product.familia === familyFilter)
    && (
      statusFilter === 'TODOS'
      || String(product.status || 'Activo').toUpperCase() === statusFilter
    )
    && matchesOmniSearch(product, search)
  ));

  return (
    <Box sx={{ mt: 2 }}>
      <PageHeader
        eyebrow="Datos maestros"
        title="Productos terminados"
        description="Identidades comerciales estables. La composición productiva se gobierna mediante BOM revisionadas en Ingeniería SCM."
      />
      {error && <Alert severity="error" sx={{ my: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ my: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}
      {!canAdmin && (
        <Alert severity="info" sx={{ my: 2 }}>
          Vista de consulta para {experience.label}. Las altas y cambios corresponden a
          Ingeniería o Configuración SCM.
        </Alert>
      )}

      <DataTableToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar SKU, producto, familia o línea"
        filters={[
          {
            id: 'familia',
            label: 'Familia',
            value: familyFilter,
            onChange: setFamilyFilter,
            options: [
              { value: 'TODAS', label: 'Todas' },
              ...families.map((value) => ({ value, label: value })),
            ],
          },
          {
            id: 'estado',
            label: 'Estado',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: 'TODOS', label: 'Todos' },
              { value: 'ACTIVO', label: 'Activos' },
              { value: 'INACTIVO', label: 'Inactivos' },
            ],
          },
        ]}
        resultCount={visibleProducts.length}
        totalCount={productos.length}
        onClear={() => {
          setSearch('');
          setFamilyFilter('TODAS');
          setStatusFilter('TODOS');
        }}
        actions={canAdmin ? (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openDialog()}>
            Nuevo producto
          </Button>
        ) : null}
        sx={{ my: 2 }}
      />

      <TableContainer component={Paper}>
        <Table>
          <TableHead><TableRow>
            <TableCell>SKU</TableCell>
            <TableCell>Producto</TableCell>
            <TableCell>Familia</TableCell>
            <TableCell>Línea</TableCell>
            <TableCell align="right">Peso ref. (g)</TableCell>
            <TableCell>Estado</TableCell>
            {canAdmin && <TableCell align="center">Acciones</TableCell>}
          </TableRow></TableHead>
          <TableBody>
            {visibleProducts.map((product) => (
              <TableRow key={product.cod_sku_pt} hover>
                <TableCell><Typography variant="body2" fontWeight={700}>{product.cod_sku_pt}</Typography></TableCell>
                <TableCell>{product.producto}</TableCell>
                <TableCell>{product.familia}</TableCell>
                <TableCell>{product.linea}</TableCell>
                <TableCell align="right">{product.peso_g ?? '—'}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={product.status || 'Activo'}
                    color={String(product.status).toUpperCase() === 'INACTIVO' ? 'default' : 'success'}
                  />
                </TableCell>
                {canAdmin && <TableCell align="center">
                  <Tooltip title="Presentaciones comerciales">
                    <IconButton
                      size="small"
                      aria-label={`Presentaciones comerciales ${product.cod_sku_pt}`}
                      onClick={() => setPresentationProduct(product)}
                    >
                      <SellIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Editar identidad y referencias">
                    <IconButton size="small" onClick={() => openDialog(product)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={String(product.status || 'ACTIVO').toUpperCase() === 'INACTIVO' ? 'Reactivar' : 'Desactivar'}>
                    <IconButton
                      size="small"
                      color={String(product.status || 'ACTIVO').toUpperCase() === 'INACTIVO' ? 'success' : 'warning'}
                      aria-label={`${String(product.status || 'ACTIVO').toUpperCase() === 'INACTIVO' ? 'Reactivar' : 'Desactivar'} ${product.cod_sku_pt}`}
                      onClick={() => toggleProduct(product)}
                    >
                      {String(product.status || 'ACTIVO').toUpperCase() === 'INACTIVO'
                        ? <RestoreIcon fontSize="small" />
                        : <LinkOffIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </TableCell>}
              </TableRow>
            ))}
            {visibleProducts.length === 0 && (
              <TableRow><TableCell colSpan={canAdmin ? 7 : 6} align="center" sx={{ py: 5 }}>
                <Typography color="text.secondary">No hay productos para los filtros seleccionados.</Typography>
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {canAdmin && <ProductoDialog
        open={dialogOpen}
        producto={editingProducto}
        onClose={() => {
          setDialogOpen(false);
          setEditingProducto(null);
        }}
        onSaved={async (saved) => {
          await fetchProductos();
          setNotice(`${saved.cod_sku_pt} guardado correctamente.`);
        }}
      />}
      {canAdmin && <CommercialPresentationsDialog
        open={Boolean(presentationProduct)}
        product={presentationProduct}
        onClose={() => setPresentationProduct(null)}
      />}
    </Box>
  );
}
