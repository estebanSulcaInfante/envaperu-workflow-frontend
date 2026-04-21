import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OrdenForm from '../components/OrdenForm';
import { ThemeProvider, createTheme } from '@mui/material';

// Mocks the API services
vi.mock('../services/api', () => ({
  crearOrden: vi.fn(),
  buscarProductos: vi.fn(),
  obtenerPiezasProducibles: vi.fn(),
  obtenerColores: vi.fn(),
  obtenerMaquinas: vi.fn(),
  validarOrdenPrereq: vi.fn(),
  obtenerProducto: vi.fn(),
}));

import { 
  obtenerPiezasProducibles, 
  obtenerColores, 
  obtenerMaquinas, 
  obtenerProducto 
} from '../services/api';

const mockPiezas = [
  { sku: 'MZ-BLD', nombre: 'Pieza Balde', cavidades: 1, peso_unitario_gr: 145, tipo: 'SIMPLE',
    molde: { codigo: 'MLB01', nombre: 'Molde Balde Playero', peso_tiro_gr: 150, piezas: [{ sku: 'MZ-BLD', cavidades: 1, peso_unitario_gr: 145 }] } 
  },
  { sku: 'MZ-JBASE', nombre: 'Base Jarra', cavidades: 1, peso_unitario_gr: 100, tipo: 'COMPUESTO',
    molde: { 
      codigo: 'MLJ01', 
      nombre: 'Molde Jarra Regadera', 
      peso_tiro_gr: 150,
      piezas: [
        { sku: 'MZ-JBASE', nombre: 'Base Jarra', cavidades: 1, peso_unitario_gr: 100 },
        { sku: 'MZ-JTAPA', nombre: 'Tapa Jarra', cavidades: 1, peso_unitario_gr: 20 },
        { sku: 'MZ-JROS', nombre: 'Roseta', cavidades: 2, peso_unitario_gr: 5 }
      ]
    } 
  }
];

const mockMaquinas = [{ id: '1', nombre: 'INJ-01', tipo: 'Inyectoras' }];
const mockColores = [{ id: '1', nombre: 'ROJO' }];

const TestWrapper = ({ children }) => (
  <ThemeProvider theme={createTheme({})}>{children}</ThemeProvider>
);

describe('Specs: OrdenForm (Spec-Driven)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    
    obtenerPiezasProducibles.mockResolvedValue(mockPiezas);
    obtenerMaquinas.mockResolvedValue(mockMaquinas);
    obtenerColores.mockResolvedValue(mockColores);
  });

  it('Escenario 1: Molde Simple - 1 Pieza', async () => {
    render(<TestWrapper><OrdenForm /></TestWrapper>);
    const user = userEvent.setup();
    
    // Select the simple piece/mold
    const moldeInput = await screen.findByLabelText(/Pieza \/ Molde/i);
    await user.type(moldeInput, 'Balde');
    
    // Select option
    const option = await screen.findByRole('option', { name: /Pieza Balde/i });
    await user.click(option);

    // Wait for the composition to appear
    expect(await screen.findByText('Auto desde catálogo')).toBeInTheDocument();
  });

  it('Escenario 2: Molde Compuesto - Jarra Regadera despliega 3 piezas', async () => {
    obtenerProducto.mockResolvedValue({
      producto: 'Jarra Regadera',
      cod_sku_pt: 'PT-JRG',
      piezas: [{ sku: 'MZ-JBASE' }] // Cascading trigger
    });

    render(<TestWrapper><OrdenForm /></TestWrapper>);
    const user = userEvent.setup();

    // Select the jar component
    const moldeInput = await screen.findByLabelText(/Pieza \/ Molde/i);
    await user.type(moldeInput, 'Base Jarra');
    
    const option = await screen.findByRole('option', { name: /Base Jarra/i });
    await user.click(option);

    // Assert: Debe mostrar las piezas cargadas desde el mockup, no ocultarlas
    const inputs = await screen.findAllByRole('textbox');
    const values = inputs.map(i => i.value);
    expect(values).toContain('Base Jarra');
    expect(values).toContain('Tapa Jarra');
    expect(values).toContain('Roseta');
  });
});
