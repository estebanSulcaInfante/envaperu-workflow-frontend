import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, TextField, Tabs, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Typography, InputAdornment, Chip, CircularProgress
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import InventoryIcon from '@mui/icons-material/Inventory';
import ExtensionIcon from '@mui/icons-material/Extension';

const API_BASE = 'http://127.0.0.1:5000/api';

function CatalogoSKU() {
  const [tab, setTab] = useState(0); // 0 = Productos, 1 = Piezas
  const [query, setQuery] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = tab === 0 ? 'productos' : 'piezas';
      const url = `${API_BASE}/${endpoint}?q=${encodeURIComponent(query)}&limit=100`;
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
    }, 300); // Debounce de 300ms
    return () => clearTimeout(debounce);
  }, [fetchData]);

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
    setData([]); // Limpiar datos al cambiar tab
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <InventoryIcon fontSize="large" />
        Catálogo SKU
      </Typography>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tab} onChange={handleTabChange} indicatorColor="primary" textColor="primary">
          <Tab icon={<InventoryIcon />} label="Productos Terminados" />
          <Tab icon={<ExtensionIcon />} label="Piezas" />
        </Tabs>
      </Paper>

      <TextField
        fullWidth
        variant="outlined"
        placeholder={tab === 0 ? "Buscar por SKU, nombre, familia..." : "Buscar por SKU, pieza, color..."}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        sx={{ mb: 3 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ maxHeight: 500 }}>
          {tab === 0 ? (
            <ProductosTable data={data} />
          ) : (
            <PiezasTable data={data} />
          )}
        </TableContainer>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Mostrando {data.length} resultados
      </Typography>
    </Box>
  );
}

function ProductosTable({ data }) {
  return (
    <Table stickyHeader size="small">
      <TableHead>
        <TableRow>
          <TableCell><strong>SKU</strong></TableCell>
          <TableCell><strong>Producto</strong></TableCell>
          <TableCell><strong>Familia</strong></TableCell>
          <TableCell><strong>Línea</strong></TableCell>
          <TableCell align="right"><strong>Peso (g)</strong></TableCell>
          <TableCell align="right"><strong>Precio</strong></TableCell>
          <TableCell><strong>Status</strong></TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.cod_sku_pt} hover>
            <TableCell><code>{row.cod_sku_pt}</code></TableCell>
            <TableCell>{row.producto}</TableCell>
            <TableCell>{row.familia}</TableCell>
            <TableCell>{row.linea}</TableCell>
            <TableCell align="right">{row.peso_g ?? '-'}</TableCell>
            <TableCell align="right">{row.precio_estimado ? `S/ ${row.precio_estimado.toFixed(2)}` : '-'}</TableCell>
            <TableCell>
              <Chip 
                label={row.status} 
                size="small" 
                color={row.status === 'ALTA' ? 'success' : 'default'}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PiezasTable({ data }) {
  return (
    <Table stickyHeader size="small">
      <TableHead>
        <TableRow>
          <TableCell><strong>SKU</strong></TableCell>
          <TableCell><strong>Pieza</strong></TableCell>
          <TableCell><strong>Color</strong></TableCell>
          <TableCell><strong>Familia</strong></TableCell>
          <TableCell align="right"><strong>Peso (g)</strong></TableCell>
          <TableCell align="right"><strong>Cavidad</strong></TableCell>
          <TableCell><strong>Método</strong></TableCell>
          <TableCell><strong>En Productos</strong></TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.sku} hover>
            <TableCell><code>{row.sku}</code></TableCell>
            <TableCell>{row.piezas}</TableCell>
            <TableCell>
              <Chip label={row.color || 'N/A'} size="small" variant="outlined" />
            </TableCell>
            <TableCell>{row.familia}</TableCell>
            <TableCell align="right">{row.peso ?? '-'}</TableCell>
            <TableCell align="right">{row.cavidad}</TableCell>
            <TableCell>{row.tipo_extruccion}</TableCell>
            <TableCell>
              {row.num_productos > 0 ? (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  <Chip 
                    label={`${row.num_productos} prod.`} 
                    size="small" 
                    color="primary" 
                    variant="filled"
                  />
                  {row.productos?.slice(0, 2).map((p, i) => (
                    <Typography key={i} variant="caption" sx={{ display: 'block' }}>
                      {p.length > 20 ? p.substring(0, 20) + '...' : p}
                    </Typography>
                  ))}
                </Box>
              ) : (
                <Chip label="Sin enlace" size="small" color="warning" />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default CatalogoSKU;
