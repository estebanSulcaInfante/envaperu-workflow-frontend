/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import api from '../src/services/api';
import ExceptionalFabricationOrderDialog from '../src/components/ExceptionalFabricationOrderDialog';

const molds = [{ codigo: 'QA-M1', nombre: 'Molde de pieza QA' }];
const colors = [{ id: 1, nombre: 'Rojo QA' }, { id: 2, nombre: 'Azul QA' }];
// Every HTTP request is intercepted locally. No production API or writes.
api.defaults.adapter = async (config) => {
  if (config.method !== 'get') throw new Error('QA: escritura bloqueada');
  const data = config.url.startsWith('/moldes/') ? {
    ...molds[0], tiempo_ciclo_std: 10, peso_colada_gr: 1,
    formas: [{ activo: true, pieza_id: 'qa-piece', nombre: 'Pieza sintética', cavidades: 2, peso_unitario_gr: 10,
      variantes: colors.map((color) => ({ sku: `QA-${color.id}`, color_produccion_id: color.id, activo: true })) }],
  } : { items: config.url.includes('rutas') ? [] : colors.map((color) => ({
    id: color.id, codigo: `QA-PC-${color.id}`, clase: 'PIEZA_COLOR', activo: true, subtipo: { pieza_color_sku: `QA-${color.id}` },
  })) };
  return { data, status: 200, statusText: 'OK', headers: {}, config };
};
function Preview() {
  const [open, setOpen] = useState(true);
  return <ThemeProvider theme={createTheme()}><CssBaseline /><MemoryRouter>
    <p>DATOS SINTÉTICOS · QA local · escrituras bloqueadas</p>
    <Button onClick={() => setOpen(true)}>Abrir OF de prueba</Button>
    <ExceptionalFabricationOrderDialog open={open} molds={molds} colors={colors} recipes={[]} machines={[]}
      onClose={() => setOpen(false)} onCreated={() => {}} />
  </MemoryRouter></ThemeProvider>;
}
createRoot(document.getElementById('root')).render(<Preview />);
