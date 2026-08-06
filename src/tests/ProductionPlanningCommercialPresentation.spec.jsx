import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductionPlanningScm from '../components/ProductionPlanningScm';
import {
  crearOpDemandaScm,
  listarOpDemandaScm,
} from '../services/scmPlanningApi';
import { buscarProductos } from '../services/api';
import { listarPresentacionesComercialesScm } from '../services/scmCatalogApi';

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    can: (capability) => capability === 'OP_CREAR',
    canAny: () => true,
    experience: { label: 'Planificación' },
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

vi.mock('../services/api', () => ({ buscarProductos: vi.fn() }));
vi.mock('../services/scmCatalogApi', () => ({
  listarPresentacionesComercialesScm: vi.fn(),
}));
vi.mock('../services/scmEngineeringApi', () => ({
  mensajeErrorScm: vi.fn((_error, fallback) => fallback),
}));

const renderPage = () => render(
  <ThemeProvider theme={createTheme()}>
    <MemoryRouter><ProductionPlanningScm /></MemoryRouter>
  </ThemeProvider>,
);

describe('Demanda por presentación comercial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listarOpDemandaScm.mockResolvedValue({ items: [] });
    buscarProductos.mockResolvedValue([{
      cod_sku_pt: 'PT-000001',
      producto: 'Alcancia Pablo Grande',
    }]);
    listarPresentacionesComercialesScm.mockResolvedValue([{
      id: 2,
      codigo: 'PRE-000002',
      producto_terminado_id: 'PT-000001',
      nombre: 'Pack x6',
      unidades_base: 6,
      predeterminada: true,
      activo: true,
    }]);
    crearOpDemandaScm.mockResolvedValue({ id: 'op-1', codigo: 'OP-000001' });
  });

  it('convierte visualmente packs y envía la presentación a la OP', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Nueva OP' }));
    await user.click(screen.getByRole('combobox', { name: 'Producto terminado' }));
    await user.click(await screen.findByRole('option', { name: /PT-000001.*Alcancia/i }));
    await user.type(screen.getByLabelText('Cantidad de presentaciones'), '10');

    expect(screen.getByText('10 Pack x6 = 60 UN')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Crear borrador' }));

    await waitFor(() => expect(crearOpDemandaScm).toHaveBeenCalledWith(
      expect.objectContaining({
        lineas: [{
          producto_terminado_id: 'PT-000001',
          presentacion_comercial_id: 2,
          cantidad_presentaciones: 10,
        }],
      }),
    ));
  });
});
