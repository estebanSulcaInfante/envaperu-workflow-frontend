import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';
import ProductionPlanningScm from '../components/ProductionPlanningScm';
import { listarOpDemandaScm } from '../services/scmPlanningApi';
import { buscarProductos } from '../services/api';

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    can: () => false,
    canAny: () => true,
    experience: { label: 'Auditoría / Consulta' },
  }),
}));

vi.mock('../services/scmPlanningApi', () => ({
  ajustarMetasPlanOpScm: vi.fn(),
  aprobarOpDemandaScm: vi.fn(),
  calcularPlanOpScm: vi.fn(),
  confirmarPlanOpScm: vi.fn(),
  crearOpDemandaScm: vi.fn(),
  listarOpDemandaScm: vi.fn(),
  obtenerPlanOpScm: vi.fn(),
}));

vi.mock('../services/api', () => ({
  buscarProductos: vi.fn(),
}));

vi.mock('../services/scmEngineeringApi', () => ({
  mensajeErrorScm: vi.fn((_error, fallback) => fallback),
}));

const renderPage = () => render(
  <ThemeProvider theme={createTheme()}>
    <MemoryRouter>
      <ProductionPlanningScm />
    </MemoryRouter>
  </ThemeProvider>,
);

describe('Planificación de OP', () => {
  it('muestra un estado vacío estable cuando no existen OP ni productos', async () => {
    listarOpDemandaScm.mockResolvedValue({ items: [] });
    buscarProductos.mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText('Todavía no existen OP de demanda.')).toBeInTheDocument();
    expect(screen.getByText(/Vista de consulta para Auditoría/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(listarOpDemandaScm).toHaveBeenCalledTimes(1);
      expect(buscarProductos).toHaveBeenCalledTimes(1);
    });
  });
});