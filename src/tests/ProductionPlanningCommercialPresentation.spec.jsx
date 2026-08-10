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
    expect(screen.getByRole('combobox', { name: 'Presentación comercial' })).toHaveTextContent(
      /Pack x6.*Predeterminada/i,
    );
    await user.type(screen.getByLabelText(/Cantidad de presentaciones/), '10');
    await user.type(screen.getByLabelText(/Fecha de necesidad/), '2026-08-20');

    expect(screen.getByText('10 Pack x6 = 60 UN')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Crear OP en borrador' }));

    await waitFor(() => expect(crearOpDemandaScm).toHaveBeenCalledWith(
      expect.objectContaining({
        lineas: [{
          producto_terminado_id: 'PT-000001',
          presentacion_comercial_id: 2,
          cantidad_presentaciones: 10,
        }],
        fecha_necesidad: '2026-08-20',
      }),
    ));
  });

  it('separa datos autorizados de cálculos y no supone cantidad ni fecha', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Nueva OP' }));

    expect(screen.getByRole('heading', { name: 'Datos que debe proporcionar la solicitud' }))
      .toBeInTheDocument();
    expect(screen.getByText(/No crees la OP sin una cantidad autorizada/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Lo que deriva el sistema' }))
      .toBeInTheDocument();
    expect(screen.getByText(/cobertura y la propuesta OF\/OA se calculan después/i))
      .toBeInTheDocument();

    expect(screen.getByLabelText(/Cantidad de presentaciones/)).toHaveValue(null);
    expect(screen.getByLabelText(/Fecha de necesidad/)).toHaveValue('');
    expect(screen.getByText(/no es la fecha de inicio de producción ni una promesa de entrega/i))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear OP en borrador' })).toBeDisabled();

    await user.click(screen.getByRole('combobox', { name: 'Producto terminado' }));
    await user.click(await screen.findByRole('option', { name: /PT-000001.*Alcancia/i }));
    expect(screen.getByText(/Se propone la presentación predeterminada del maestro/i))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear OP en borrador' })).toBeDisabled();

    await user.type(screen.getByLabelText(/Cantidad de presentaciones/), '10');
    expect(screen.getByRole('button', { name: 'Crear OP en borrador' })).toBeDisabled();

    await user.type(screen.getByLabelText(/Fecha de necesidad/), '2026-08-20');
    expect(screen.getByRole('button', { name: 'Crear OP en borrador' })).toBeEnabled();
  });

  it('no reutiliza silenciosamente los datos de una solicitud anterior', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Nueva OP' }));
    await user.click(screen.getByRole('combobox', { name: 'Producto terminado' }));
    await user.click(await screen.findByRole('option', { name: /PT-000001.*Alcancia/i }));
    await user.type(screen.getByLabelText(/Cantidad de presentaciones/), '10');
    await user.type(screen.getByLabelText(/Fecha de necesidad/), '2026-08-20');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Nueva OP de demanda' }))
      .not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Nueva OP' }));

    expect(screen.getByRole('combobox', { name: 'Producto terminado' }))
      .not.toHaveTextContent('PT-000001');
    expect(screen.getByLabelText(/Cantidad de presentaciones/)).toHaveValue(null);
    expect(screen.getByLabelText(/Fecha de necesidad/)).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Crear OP en borrador' })).toBeDisabled();
  });
});
