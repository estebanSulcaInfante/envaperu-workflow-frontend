import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material';
import LineasFamiliasAdmin from '../components/LineasFamiliasAdmin';

vi.mock('../services/api', () => ({
  actualizarFamilia: vi.fn(),
  actualizarLinea: vi.fn(),
  asociarFamiliaALinea: vi.fn(),
  crearFamilia: vi.fn(),
  crearLinea: vi.fn(),
  desasociarFamiliaDeLinea: vi.fn(),
  inactivarFamilia: vi.fn(),
  inactivarLinea: vi.fn(),
  obtenerFamilias: vi.fn(),
  obtenerFamiliasDeLinea: vi.fn(),
  obtenerLineas: vi.fn(),
}));

import {
  asociarFamiliaALinea,
  crearLinea,
  desasociarFamiliaDeLinea,
  inactivarFamilia,
  obtenerFamilias,
  obtenerFamiliasDeLinea,
  obtenerLineas,
} from '../services/api';

const lines = [
  { id: 1, codigo: 10, nombre: 'Hogar', activo: true, version: 2 },
  { id: 2, codigo: 20, nombre: 'Industrial', activo: false, version: 1 },
];

const families = [
  { id: 11, codigo: 101, nombre: 'Baldes', activo: true, version: 3 },
  { id: 12, codigo: 102, nombre: 'Jarras', activo: true, version: 1 },
];

const associations = [{
  id: 81,
  linea_id: 1,
  familia_id: 11,
  activo: true,
  version: 1,
  familia: families[0],
}];

const renderPage = () => render(
  <ThemeProvider theme={createTheme()}>
    <LineasFamiliasAdmin />
  </ThemeProvider>,
);

describe('LineasFamiliasAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    obtenerLineas.mockResolvedValue(lines);
    obtenerFamilias.mockResolvedValue(families);
    obtenerFamiliasDeLinea.mockResolvedValue(associations);
    crearLinea.mockResolvedValue({ id: 3 });
    asociarFamiliaALinea.mockResolvedValue({ id: 82 });
    desasociarFamiliaDeLinea.mockResolvedValue({ activo: false });
    inactivarFamilia.mockResolvedValue({ activo: false });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('carga catálogos incluyendo inactivos y presenta la relación N:M de la línea seleccionada', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Líneas y familias' })).toBeInTheDocument();
    expect(screen.getByText('Industrial')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Baldes')).toHaveLength(2));
    await waitFor(() => expect(obtenerLineas).toHaveBeenCalledWith({ include_inactive: true }));
    expect(obtenerFamilias).toHaveBeenCalledWith({ include_inactive: true });
    expect(obtenerFamiliasDeLinea).toHaveBeenCalledWith(1);
    expect(screen.getByRole('table', { name: 'Familias asociadas a la línea' })).toBeInTheDocument();
  });

  it('crea una línea y envía su estado inicial', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Industrial');

    await user.click(screen.getByRole('button', { name: 'Nueva línea' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Código automático')).toHaveValue('LIN-######');
    await user.type(within(dialog).getByLabelText(/Nombre/), 'Agrícola');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(crearLinea).toHaveBeenCalledWith({
      nombre: 'Agrícola',
      activo: true,
    }));
  });

  it('evita crear otra línea con el mismo nombre', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Industrial');

    await user.click(screen.getByRole('button', { name: 'Nueva línea' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Nombre/), 'hogar');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText(/Ya existe la línea/i)).toBeInTheDocument();
    expect(crearLinea).not.toHaveBeenCalled();
  });

  it('asocia y desasocia familias desde la línea seleccionada', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('table', { name: 'Familias asociadas a la línea' });

    await user.click(screen.getByLabelText('Familia por asociar'));
    await user.click(screen.getByRole('option', { name: /Jarras/ }));
    await user.click(screen.getByRole('button', { name: 'Asociar familia' }));
    await waitFor(() => expect(asociarFamiliaALinea).toHaveBeenCalledWith(1, 12));

    await user.click(screen.getByRole('button', { name: 'Desasociar Baldes' }));
    await waitFor(() => expect(desasociarFamiliaDeLinea).toHaveBeenCalledWith(1, 11));
  });

  it('inactiva una familia sin eliminarla físicamente', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Jarras');

    await user.click(screen.getByRole('button', { name: 'Inactivar familia Jarras' }));

    await waitFor(() => expect(inactivarFamilia).toHaveBeenCalledWith(12, 1));
  });

  it('muestra el estado vacío cuando no existen clasificadores', async () => {
    obtenerLineas.mockResolvedValue([]);
    obtenerFamilias.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('Todavía no hay líneas registradas.')).toBeInTheDocument();
    expect(screen.getByText('Todavía no hay familias registradas.')).toBeInTheDocument();
    expect(screen.getByText('No hay una línea seleccionada.')).toBeInTheDocument();
  });
});
