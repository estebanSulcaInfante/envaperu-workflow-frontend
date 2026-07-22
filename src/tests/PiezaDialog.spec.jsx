import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material';
import PiezaDialog from '../components/PiezaDialog';

vi.mock('../services/api', () => ({
  actualizarPiezaColor: vi.fn(),
  buscarPiezasGlobales: vi.fn(),
  crearColor: vi.fn(),
  crearPiezaColor: vi.fn(),
  obtenerColores: vi.fn(),
  obtenerFamilias: vi.fn(),
  obtenerFamiliasColor: vi.fn(),
  obtenerLineas: vi.fn(),
}));

import {
  buscarPiezasGlobales,
  crearColor,
  crearPiezaColor,
  obtenerColores,
  obtenerFamilias,
  obtenerFamiliasColor,
  obtenerLineas,
} from '../services/api';

const lines = [{ id: 4, nombre: 'HOGAR' }];
const families = [{ id: 8, nombre: 'COCINA' }];
const globalPieces = [{
  id: 10,
  codigo: 'PZ-000010',
  nombre: 'Tapa universal',
  peso_nominal_gr: 18.5,
  linea_id: 4,
  familia_id: 8,
}];
const colors = [{ id: 1, nombre: 'ROJO SOLIDO' }];

const renderDialog = (props = {}) => render(
  <ThemeProvider theme={createTheme()}>
    <PiezaDialog open onClose={vi.fn()} pieza={null} {...props} />
  </ThemeProvider>,
);

describe('PiezaDialog: datos derivados y alta rápida', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    obtenerLineas.mockResolvedValue(lines);
    obtenerFamilias.mockResolvedValue(families);
    obtenerColores.mockResolvedValue(colors);
    buscarPiezasGlobales.mockResolvedValue(globalPieces);
    obtenerFamiliasColor.mockResolvedValue([{ id: 3, nombre: 'SOLIDO' }]);
    crearColor.mockResolvedValue({ id: 2, nombre: 'VERDE SOLIDO', existed: false });
    crearPiezaColor.mockResolvedValue({ sku: 'PC-000002' });
  });

  it('deriva Línea y Familia de la pieza global y bloquea su edición', async () => {
    const user = userEvent.setup();
    renderDialog();

    expect(await screen.findByLabelText('Línea')).not.toBeDisabled();
    const pieceInput = await screen.findByLabelText(/buscar pieza global/i);
    await user.click(pieceInput);
    await user.type(pieceInput, 'Tapa');
    await user.click(await screen.findByRole('option', { name: /PZ-000010.*Tapa universal/i }));

    const lineInput = screen.getByLabelText('Línea');
    const familyInput = screen.getByLabelText('Familia');
    await waitFor(() => {
      expect(lineInput).toHaveValue('HOGAR');
      expect(familyInput).toHaveValue('COCINA');
    });
    expect(lineInput).toBeDisabled();
    expect(familyInput).toBeDisabled();
    expect(screen.getByText(/se heredan de la pieza global/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/nombre pieza/i), 'Tapa verde');
    await user.click(screen.getByRole('button', { name: /^crear$/i }));

    await waitFor(() => expect(crearPiezaColor).toHaveBeenCalledTimes(1));
    expect(crearPiezaColor.mock.calls[0][0]).toMatchObject({
      pieza_id: 10,
      linea_id: 4,
      familia_id: 8,
      peso: 18.5,
    });
  });

  it('crea ColorProduccion desde la última opción y lo deja seleccionado', async () => {
    const user = userEvent.setup();
    obtenerColores
      .mockResolvedValueOnce(colors)
      .mockResolvedValue([...colors, { id: 2, nombre: 'VERDE SOLIDO' }]);
    renderDialog();

    const colorInput = await screen.findByLabelText(/color de producción/i);
    await user.click(colorInput);
    await user.click(await screen.findByRole('option', { name: /crear nuevo color/i }));
    await user.type(screen.getByLabelText(/color base/i), 'verde');
    await waitFor(() => expect(screen.getByRole('combobox', { name: /acabado/i })).toHaveTextContent('SOLIDO'));
    await user.click(screen.getByRole('button', { name: /crear y seleccionar/i }));

    await waitFor(() => expect(colorInput).toHaveValue('VERDE SOLIDO'));
    expect(crearColor).toHaveBeenCalledWith({ nombre: 'VERDE', familia_color_id: 3 });
    expect(obtenerColores).toHaveBeenCalledTimes(2);
  });
});
