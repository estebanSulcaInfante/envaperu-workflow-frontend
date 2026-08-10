import { render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material';
import ProductoDialog from '../components/ProductoDialog';

vi.mock('../services/api', () => ({
  actualizarProducto: vi.fn(),
  buscarPiezasColor: vi.fn(),
  crearFamiliaEnLinea: vi.fn(),
  crearLinea: vi.fn(),
  crearProducto: vi.fn(),
  obtenerFamilias: vi.fn(),
  obtenerLineas: vi.fn(),
}));

import {
  crearFamiliaEnLinea,
  crearProducto,
  obtenerFamilias,
  obtenerLineas,
} from '../services/api';

const renderDialog = (onClose = vi.fn()) => render(
  <ThemeProvider theme={createTheme()}>
    <ProductoDialog open onClose={onClose} producto={null} />
  </ThemeProvider>,
);

describe('ProductoDialog: alta contextual de clasificación', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    obtenerLineas.mockResolvedValue([{ id: 1, codigo: 10, nombre: 'HOGAR' }]);
    obtenerFamilias.mockResolvedValue([]);
    crearFamiliaEnLinea.mockResolvedValue({
      familia: { id: 7, codigo: 14, nombre: 'ENVASES' },
    });
    crearProducto.mockResolvedValue({ cod_sku_pt: 'PT-000001' });
  });

  it('crea la primera Familia de una Línea y guarda el producto con el par confirmado', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog(onClose);

    expect(await screen.findByRole('heading', { name: 'Nuevo producto terminado' }))
      .toBeVisible();
    const lineInput = await screen.findByRole('combobox', { name: 'Línea' });
    await user.click(lineInput);
    await user.click(await screen.findByRole('option', { name: 'HOGAR' }));
    await waitFor(() => expect(obtenerFamilias).toHaveBeenCalledWith({ linea_id: 1 }));

    const familyInput = screen.getByRole('combobox', { name: 'Familia' });
    await user.type(familyInput, 'envases');
    await user.click(await screen.findByRole('option', { name: /Crear Familia “envases”/i }));
    expect(screen.getByLabelText('Código automático')).toHaveValue('FAM-######');
    await user.click(screen.getByRole('button', { name: /Crear y seleccionar/i }));

    await waitFor(() => expect(crearFamiliaEnLinea).toHaveBeenCalledWith(1, {
      nombre: 'ENVASES',
    }));
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog', { name: /Nueva Familia/i }));
    expect(screen.getByRole('combobox', { name: 'Familia' })).toHaveValue('ENVASES');

    await user.type(screen.getByLabelText(/Nombre del producto/i), 'Botella de prueba');
    await user.click(screen.getByRole('button', { name: /Crear producto/i }));

    await waitFor(() => expect(crearProducto).toHaveBeenCalledTimes(1));
    expect(crearProducto.mock.calls[0][0]).toMatchObject({
      producto: 'Botella de prueba',
      linea_id: 1,
      familia_id: 7,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
