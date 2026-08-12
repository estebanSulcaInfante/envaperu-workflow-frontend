import { createTheme, ThemeProvider } from '@mui/material';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WarehouseSetupScm from '../components/WarehouseSetupScm';

const api = vi.hoisted(() => ({
  listarAlmacenesScm: vi.fn(),
  crearAlmacenScm: vi.fn(),
  crearUbicacionAlmacenScm: vi.fn(),
  asignarTrabajadorAlmacenScm: vi.fn(),
}));

vi.mock('../services/scmWarehouseOperationsApi', () => api);
vi.mock('../services/workspaceAdminApi', () => ({
  listarTrabajadoresWorkspace: vi.fn().mockResolvedValue({
    items: [{ id: 9, codigo: 'TRB-ALM', nombre_corto: 'Almacenera' }],
  }),
}));

const renderView = () => render(
  <ThemeProvider theme={createTheme()}><WarehouseSetupScm /></ThemeProvider>,
);

describe('configuración física del Kardex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listarAlmacenesScm.mockResolvedValue({ items: [{
      id: 'alm-1', codigo: 'ALM-PZ', nombre: 'Piezas', tipo: 'PIEZAS_WIP',
      ubicaciones: [{ id: 11, codigo: 'ZONA-A', nombre: 'Zona A', tipo: 'ZONA' }],
    }] });
    api.crearUbicacionAlmacenScm.mockResolvedValue({ id: 12 });
    api.asignarTrabajadorAlmacenScm.mockResolvedValue({ id: 'scope-1' });
  });

  it('crea una ubicación con varias clases, jerarquía y disponibilidad explícitas', async () => {
    renderView();
    await screen.findByText(/ALM-PZ/i);
    fireEvent.mouseDown(screen.getByLabelText('Almacén de la ubicación'));
    fireEvent.click(await screen.findByRole('option', { name: /ALM-PZ · Piezas/i }));
    fireEvent.change(screen.getByLabelText('Código de ubicación'), { target: { value: 'MESA-ARM' } });
    fireEvent.change(screen.getByLabelText('Nombre de ubicación'), { target: { value: 'Mesa de Armado' } });
    fireEvent.mouseDown(screen.getByLabelText('Tipo de ubicación'));
    fireEvent.click(await screen.findByText('PUNTO PRODUCCION'));
    fireEvent.mouseDown(screen.getByLabelText('Ubicación padre'));
    fireEvent.click(await screen.findByText(/ZONA-A · Zona A/i));
    fireEvent.mouseDown(screen.getByLabelText('Clases admitidas por la ubicación'));
    fireEvent.click(await screen.findByText('SUBENSAMBLE WIP'));
    fireEvent.keyDown(screen.getByRole('listbox', { name: 'Clases admitidas por la ubicación' }), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('listbox', { name: 'Clases admitidas por la ubicación' })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('checkbox', { name: /permite saldo libre/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Añadir ubicación' }));

    await waitFor(() => expect(api.crearUbicacionAlmacenScm).toHaveBeenCalledWith(
      'alm-1',
      expect.objectContaining({
        codigo: 'MESA-ARM',
        nombre: 'Mesa de Armado',
        tipo: 'PUNTO_PRODUCCION',
        parent_id: 11,
        clases_articulo: expect.arrayContaining(['PIEZA_COLOR', 'SUBENSAMBLE_WIP']),
        permite_saldo_libre: false,
      }),
    ));
  });

  it('asigna varias clases al alcance del trabajador', async () => {
    renderView();
    await screen.findByText(/ALM-PZ/i);
    const section = screen.getByRole('heading', { name: /Asignar trabajador y clases/i }).closest('div.MuiPaper-root');
    fireEvent.mouseDown(within(section).getByLabelText('Almacén del trabajador'));
    fireEvent.click(await screen.findByRole('option', { name: /ALM-PZ · Piezas/i }));
    fireEvent.mouseDown(within(section).getByLabelText('Trabajador'));
    fireEvent.click(await screen.findByRole('option', { name: /TRB-ALM · Almacenera/i }));
    fireEvent.mouseDown(within(section).getByLabelText('Clases asignadas'));
    fireEvent.click(await screen.findByText('SUBENSAMBLE WIP'));
    fireEvent.keyDown(screen.getByRole('listbox', { name: 'Clases asignadas' }), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('listbox', { name: 'Clases asignadas' })).not.toBeInTheDocument());
    fireEvent.click(within(section).getByRole('button', { name: 'Asignar alcance' }));
    await waitFor(() => expect(api.asignarTrabajadorAlmacenScm).toHaveBeenCalledWith(
      'alm-1',
      { trabajador_id: 9, clases_articulo: expect.arrayContaining(['PIEZA_COLOR', 'SUBENSAMBLE_WIP']) },
    ));
  });
});
