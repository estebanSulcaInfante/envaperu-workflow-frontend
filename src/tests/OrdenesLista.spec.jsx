import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import OrdenesLista from '../components/OrdenesLista';

vi.mock('../services/api', () => ({
  obtenerOrdenes: vi.fn(),
  descargarExcel: vi.fn(),
  getQRImageUrl: vi.fn(() => '/qr.png'),
  toggleEstadoOrden: vi.fn(),
  actualizarMetricasOrden: vi.fn(),
}));

import { obtenerOrdenes } from '../services/api';

const order = {
  numero_op: 'OP-TEST-001',
  producto: 'Caja organizadora',
  maquina: 'INY-01',
  molde: 'Molde caja',
  tipo: 'POR_CANTIDAD',
  activa: true,
  fecha_inicio: '2026-04-24T13:00:00',
  meta_kg: 213.0434782608696,
  avance_real_kg: 0,
  meta_total_doc: 100,
  resumen_totales: {
    'Peso(Kg) PRODUCCION': 213.0434782608696,
    '%Merma': 0.2174,
    'Merma Natural Kg': 46.316,
    'Horas': 33.46,
    'Días': 1.455,
    'F. Fin': '2026-04-26T00:00:00',
  },
  snapshot_tecnico: {
    tiempo_ciclo_seg: 26,
    horas_turno: 23,
    peso_colada_gr: 10,
    peso_neto_golpe_gr: 36,
    peso_tiro_gr: 46,
  },
  lotes: [{
    id: 1,
    Color: 'AMARILLO SÓLIDO',
    color_hex: '#FBC02D',
    meta_kg: 213.0434782608696,
    kg_real: 0,
    coladas: 4861.1111,
    mano_obra: { personas: 2, horas_hombre: 22.5 },
    receta_aplicada: { nombre: 'AMARILLO', revision: 2 },
    materiales: [{ nombre: 'PP Clarif', peso_kg: 213.0434782608696 }],
    pigmentos: [{ nombre: 'Amarillo Pato 1086', dosis_gr: 420 }],
    salidas: [{
      id: 4,
      pieza_nombre: 'Asa de Caja Organizadora',
      pieza_color_sku: 'PC-000001',
      cavidades_snapshot: 3,
      cantidad_objetivo: 14583.3333,
      kg_objetivo_neto: 58.3333,
    }],
  }],
};

const renderList = () => render(
  <MemoryRouter>
    <ThemeProvider theme={createTheme()}><OrdenesLista /></ThemeProvider>
  </MemoryRouter>,
);

describe('OrdenesLista: lotes legibles e impresión A4', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    obtenerOrdenes.mockResolvedValue([order]);
  });

  it('muestra el HEX, métricas normalizadas y salidas tabulares sin precisión excesiva', async () => {
    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByText('OP-TEST-001'));

    expect(screen.getByRole('img', { name: 'Color AMARILLO SÓLIDO: #FBC02D' })).toBeInTheDocument();
    expect(screen.getByText('Composición de resinas')).toBeInTheDocument();
    expect(screen.getByText('Dosificación de colorantes / aditivos')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Unidades' })).toBeInTheDocument();
    expect(screen.getByText('PC-000001')).toBeInTheDocument();
    expect(screen.queryByText(/213\.0434782608696/)).not.toBeInTheDocument();
  });

  it('crea una hoja exclusiva de la OP y abre la impresión del navegador', async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, 'print').mockImplementation(() => {
      const sheet = screen.getByLabelText('Versión imprimible OP-TEST-001');
      expect(sheet).toBeInTheDocument();
      expect(within(sheet).getByText('Merma')).toBeInTheDocument();
      expect(within(sheet).getByText('21.74%')).toBeInTheDocument();
      expect(within(sheet).getByText('Coladas/hora')).toBeInTheDocument();
      expect(within(sheet).queryByText('Modalidad')).not.toBeInTheDocument();
      expect(within(sheet).queryByText('Producción real')).not.toBeInTheDocument();
      expect(within(sheet).queryByText('ACTIVA')).not.toBeInTheDocument();
    });
    renderList();

    await user.click(await screen.findByRole('button', { name: 'Imprimir PDF A4 OP-TEST-001' }));

    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    print.mockRestore();
  });
});
