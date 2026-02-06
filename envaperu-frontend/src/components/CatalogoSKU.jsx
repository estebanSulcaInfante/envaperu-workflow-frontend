import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, TextField, Tabs, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Typography, InputAdornment, Chip, CircularProgress,
  TablePagination, Tooltip, IconButton
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import InventoryIcon from '@mui/icons-material/Inventory';
import ExtensionIcon from '@mui/icons-material/Extension';
import RefreshIcon from '@mui/icons-material/Refresh';

const API_BASE = '/api';

function CatalogoSKU() {
  const [tab, setTab] = useState(0); // 0 = Productos, 1 = Piezas
  const [query, setQuery] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = tab === 0 ? 'productos' : 'piezas';
      const url = `${API_BASE}/${endpoint}?q=${encodeURIComponent(query)}&limit=500`;
      const response = await fetch(url);
      const json = await response.json();
      setData(json);
    } catch (error) {
      console.error('Error fetching data:', error);
      setData([]);
    }
    setLoading(false);
  }, [tab, query]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchData]);

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
    setData([]);
    setPage(0);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const paginatedData = data.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <InventoryIcon fontSize="large" />
        Catálogo SKU - Vista Completa
      </Typography>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tab} onChange={handleTabChange} indicatorColor="primary" textColor="primary">
          <Tab icon={<InventoryIcon />} label="Productos Terminados" />
          <Tab icon={<ExtensionIcon />} label="Piezas" />
        </Tabs>
      </Paper>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder={tab === 0 
            ? "Buscar por SKU, nombre, familia, línea, marca, código de barras..." 
            : "Buscar por SKU, pieza, color, familia, molde, material..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <Tooltip title="Recargar datos">
          <IconButton onClick={fetchData} color="primary">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 350px)', overflow: 'auto' }}>
            {tab === 0 ? (
              <ProductosTableComplete data={paginatedData} />
            ) : (
              <PiezasTableComplete data={paginatedData} />
            )}
          </TableContainer>
          
          <TablePagination
            component="div"
            count={data.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[25, 50, 100, 200]}
            labelRowsPerPage="Filas por página:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
          />
        </>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Total: {data.length} registros
      </Typography>
    </Box>
  );
}

// Componente para celda con tooltip para textos largos
function CellWithTooltip({ value, maxWidth = 150 }) {
  if (!value) return <TableCell>-</TableCell>;
  const text = String(value);
  return (
    <TableCell sx={{ maxWidth, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      <Tooltip title={text} placement="top">
        <span>{text}</span>
      </Tooltip>
    </TableCell>
  );
}

function ProductosTableComplete({ data }) {
  const getRevisionColor = (estado) => {
    switch(estado) {
      case 'VERIFICADO': return 'success';
      case 'EN_REVISION': return 'warning';
      case 'IMPORTADO': return 'default';
      default: return 'default';
    }
  };

  return (
    <Table stickyHeader size="small" sx={{ minWidth: 2000 }}>
      <TableHead>
        <TableRow sx={{ '& th': { fontWeight: 'bold', backgroundColor: '#f5f5f5' } }}>
          <TableCell>SKU</TableCell>
          <TableCell>Producto</TableCell>
          <TableCell>Línea</TableCell>
          <TableCell>Cod Línea</TableCell>
          <TableCell>Familia</TableCell>
          <TableCell>Cod Familia</TableCell>
          <TableCell>Cod Producto</TableCell>
          <TableCell>Familia Color</TableCell>
          <TableCell>Cod Fam Color</TableCell>
          <TableCell>UM</TableCell>
          <TableCell align="right">Doc x Paq</TableCell>
          <TableCell align="right">Doc x Bulto</TableCell>
          <TableCell align="right">Peso (g)</TableCell>
          <TableCell align="right">Precio Est.</TableCell>
          <TableCell align="right">Precio s/IGV</TableCell>
          <TableCell align="right">Ind. x Kg</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Código Barra</TableCell>
          <TableCell>Marca</TableCell>
          <TableCell>Nombre GS1</TableCell>
          <TableCell>Estado Revisión</TableCell>
          <TableCell>OBS</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.cod_sku_pt} hover sx={{ '&:nth-of-type(odd)': { backgroundColor: '#fafafa' } }}>
            <TableCell><code style={{ fontSize: '0.85em', backgroundColor: '#e3f2fd', padding: '2px 6px', borderRadius: '4px' }}>{row.cod_sku_pt}</code></TableCell>
            <CellWithTooltip value={row.producto} maxWidth={200} />
            <TableCell>{row.linea || '-'}</TableCell>
            <TableCell align="center">{row.cod_linea ?? '-'}</TableCell>
            <TableCell>{row.familia || '-'}</TableCell>
            <TableCell align="center">{row.cod_familia ?? '-'}</TableCell>
            <TableCell align="center">{row.cod_producto ?? '-'}</TableCell>
            <TableCell>
              {row.familia_color ? (
                <Chip label={row.familia_color} size="small" variant="outlined" color="secondary" />
              ) : '-'}
            </TableCell>
            <TableCell align="center">{row.cod_familia_color ?? '-'}</TableCell>
            <TableCell>{row.um || '-'}</TableCell>
            <TableCell align="right">{row.doc_x_paq ?? '-'}</TableCell>
            <TableCell align="right">{row.doc_x_bulto ?? '-'}</TableCell>
            <TableCell align="right">{row.peso_g != null ? row.peso_g.toFixed(1) : '-'}</TableCell>
            <TableCell align="right">{row.precio_estimado ? `S/ ${row.precio_estimado.toFixed(2)}` : '-'}</TableCell>
            <TableCell align="right">{row.precio_sin_igv ? `S/ ${row.precio_sin_igv.toFixed(2)}` : '-'}</TableCell>
            <TableCell align="right">{row.indicador_x_kg != null ? row.indicador_x_kg.toFixed(2) : '-'}</TableCell>
            <TableCell>
              <Chip 
                label={row.status || 'N/A'} 
                size="small" 
                color={row.status === 'ALTA' ? 'success' : row.status === 'BAJA' ? 'error' : 'default'}
              />
            </TableCell>
            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8em' }}>{row.codigo_barra || '-'}</TableCell>
            <TableCell>{row.marca || '-'}</TableCell>
            <CellWithTooltip value={row.nombre_gs1} maxWidth={150} />
            <TableCell>
              <Chip 
                label={row.estado_revision || 'N/A'} 
                size="small" 
                color={getRevisionColor(row.estado_revision)}
              />
            </TableCell>
            <CellWithTooltip value={row.obs} maxWidth={150} />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PiezasTableComplete({ data }) {
  const getRevisionColor = (estado) => {
    switch(estado) {
      case 'VERIFICADO': return 'success';
      case 'EN_REVISION': return 'warning';
      case 'IMPORTADO': return 'default';
      default: return 'default';
    }
  };

  return (
    <Table stickyHeader size="small" sx={{ minWidth: 1800 }}>
      <TableHead>
        <TableRow sx={{ '& th': { fontWeight: 'bold', backgroundColor: '#f5f5f5' } }}>
          <TableCell>SKU</TableCell>
          <TableCell>Pieza</TableCell>
          <TableCell>Tipo</TableCell>
          <TableCell>Línea</TableCell>
          <TableCell>Cod Línea</TableCell>
          <TableCell>Familia</TableCell>
          <TableCell>Cod Pieza</TableCell>
          <TableCell>Molde</TableCell>
          <TableCell>Color</TableCell>
          <TableCell>Cod Color</TableCell>
          <TableCell>Tipo Color</TableCell>
          <TableCell align="right">Cavidad</TableCell>
          <TableCell align="right">Peso (g)</TableCell>
          <TableCell>Extrusión</TableCell>
          <TableCell>Cod Extru</TableCell>
          <TableCell>Material (MP)</TableCell>
          <TableCell>Cod MP</TableCell>
          <TableCell>Estado Revisión</TableCell>
          <TableCell>En Productos</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.sku} hover sx={{ '&:nth-of-type(odd)': { backgroundColor: '#fafafa' } }}>
            <TableCell><code style={{ fontSize: '0.85em', backgroundColor: '#e8f5e9', padding: '2px 6px', borderRadius: '4px' }}>{row.sku}</code></TableCell>
            <CellWithTooltip value={row.piezas} maxWidth={180} />
            <TableCell>
              <Chip 
                label={row.tipo || 'SIMPLE'} 
                size="small" 
                variant="outlined"
                color={row.tipo === 'KIT' ? 'primary' : row.tipo === 'COMPONENTE' ? 'secondary' : 'default'}
              />
            </TableCell>
            <TableCell>{row.linea || '-'}</TableCell>
            <TableCell align="center">{row.cod_linea ?? '-'}</TableCell>
            <TableCell>{row.familia || '-'}</TableCell>
            <TableCell align="center">{row.cod_pieza ?? '-'}</TableCell>
            <TableCell>
              {row.molde_id ? (
                <Chip label={row.molde_id} size="small" color="info" variant="outlined" />
              ) : '-'}
            </TableCell>
            <TableCell>
              {row.color ? (
                <Chip label={row.color} size="small" variant="filled" sx={{ backgroundColor: '#e1bee7' }} />
              ) : '-'}
            </TableCell>
            <TableCell align="center">{row.cod_color ?? '-'}</TableCell>
            <TableCell>{row.tipo_color || '-'}</TableCell>
            <TableCell align="right">{row.cavidad ?? '-'}</TableCell>
            <TableCell align="right">{row.peso != null ? row.peso.toFixed(1) : '-'}</TableCell>
            <TableCell>{row.tipo_extruccion || '-'}</TableCell>
            <TableCell align="center">{row.cod_extru ?? '-'}</TableCell>
            <TableCell>{row.mp || '-'}</TableCell>
            <TableCell>{row.cod_mp || '-'}</TableCell>
            <TableCell>
              <Chip 
                label={row.estado_revision || 'N/A'} 
                size="small" 
                color={getRevisionColor(row.estado_revision)}
              />
            </TableCell>
            <TableCell>
              {row.num_productos > 0 ? (
                <Tooltip title={row.productos?.join(', ') || ''}>
                  <Chip 
                    label={`${row.num_productos} prod.`} 
                    size="small" 
                    color="primary" 
                    variant="filled"
                  />
                </Tooltip>
              ) : (
                <Chip label="Sin enlace" size="small" color="warning" variant="outlined" />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default CatalogoSKU;
