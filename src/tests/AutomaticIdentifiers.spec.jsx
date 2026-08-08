import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import ConfigurarProducto from '../components/ConfigurarProducto';
import MoldesLista from '../components/MoldesLista';
import PiezaDialog from '../components/PiezaDialog';
import ProductoDialog from '../components/ProductoDialog';
import ProductosAdmin from '../components/ProductosAdmin';

vi.mock('../services/api', () => ({
  actualizarPiezaColor: vi.fn(),
  actualizarProducto: vi.fn(),
  buscarPiezasColor: vi.fn(),
  buscarPiezasGlobales: vi.fn(),
  buscarProductos: vi.fn(),
  configurarProductoCascada: vi.fn(),
  crearColor: vi.fn(),
  crearFamiliaEnLinea: vi.fn(),
  crearLinea: vi.fn(),
  crearMolde: vi.fn(),
  crearPiezaColor: vi.fn(),
  crearProducto: vi.fn(),
  eliminarMolde: vi.fn(),
  eliminarProducto: vi.fn(),
  obtenerColores: vi.fn(),
  obtenerFamilias: vi.fn(),
  obtenerFamiliasColor: vi.fn(),
  obtenerLineas: vi.fn(),
  obtenerMoldes: vi.fn(),
  obtenerProducto: vi.fn(),
}));

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    can: () => true,
    canAny: () => true,
    experience: { label: 'Administrador de prueba', focus: 'Administración de prueba.' },
  }),
}));

import {
  actualizarProducto,
  buscarPiezasGlobales,
  buscarProductos,
  crearMolde,
  crearPiezaColor,
  crearProducto,
  obtenerColores,
  obtenerFamilias,
  obtenerFamiliasColor,
  obtenerLineas,
  obtenerMoldes,
} from '../services/api';

const renderWithShell = (ui) => render(
  <ThemeProvider theme={createTheme()}>
    <MemoryRouter>{ui}</MemoryRouter>
  </ThemeProvider>,
);

describe('identificadores internos automáticos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buscarPiezasGlobales.mockResolvedValue([]);
    buscarProductos.mockResolvedValue([]);
    obtenerColores.mockResolvedValue([]);
    obtenerFamilias.mockResolvedValue([]);
    obtenerFamiliasColor.mockResolvedValue([]);
    obtenerLineas.mockResolvedValue([]);
    obtenerMoldes.mockResolvedValue([]);
    crearMolde.mockResolvedValue({ codigo: 'ML-000001' });
    crearPiezaColor.mockResolvedValue({ sku: 'PC-000001' });
    crearProducto.mockResolvedValue({ cod_sku_pt: 'PT-000001' });
  });

  it('crea moldes sin solicitar ni enviar el correlativo', async () => {
    const user = userEvent.setup();
    renderWithShell(<MoldesLista />);

    await user.click(await screen.findByRole('button', { name: /nuevo molde/i }));
    const identifier = screen.getByLabelText(/código del molde/i);
    expect(identifier).toHaveValue('Se asignará automáticamente al guardar');
    expect(identifier).toHaveAttribute('readonly');
    await user.type(screen.getByLabelText(/nombre descriptivo/i), 'Molde de prueba');
    await user.type(screen.getByLabelText(/peso tiro completo/i), '120');
    await user.click(screen.getByRole('button', { name: /crear molde/i }));

    await waitFor(() => expect(crearMolde).toHaveBeenCalledTimes(1));
    expect(crearMolde.mock.calls[0][0]).not.toHaveProperty('codigo');
  });

  it('crea productos terminados sin enviar cod_sku_pt desde el administrador activo', async () => {
    const user = userEvent.setup();
    obtenerLineas.mockResolvedValue([{ id: 1, codigo: 10, nombre: 'HOGAR' }]);
    obtenerFamilias.mockResolvedValue([{ id: 7, codigo: 14, nombre: 'ENVASES' }]);
    renderWithShell(<ProductosAdmin />);

    await user.click(await screen.findByRole('button', { name: /nuevo producto/i }));
    const identifier = screen.getByLabelText(/sku automático/i);
    expect(identifier).toHaveValue('PT-###### · se asignará al guardar');
    expect(identifier).toHaveAttribute('readonly');
    expect(screen.queryByLabelText(/unidades por paquete/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/unidades por bulto/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Línea' }));
    await user.click(await screen.findByRole('option', { name: 'HOGAR' }));
    await waitFor(() => expect(obtenerFamilias).toHaveBeenCalledWith({ linea_id: 1 }));
    await user.click(screen.getByRole('combobox', { name: 'Familia' }));
    await user.click(await screen.findByRole('option', { name: 'ENVASES' }));
    await user.type(screen.getByLabelText(/nombre del producto/i), 'Producto de prueba');
    await user.click(screen.getByRole('button', { name: /crear producto/i }));

    await waitFor(() => expect(crearProducto).toHaveBeenCalledTimes(1));
    expect(crearProducto.mock.calls[0][0]).not.toHaveProperty('cod_sku_pt');
    expect(crearProducto.mock.calls[0][0]).toMatchObject({
      linea_id: 1,
      familia_id: 7,
    });
  });

  it('desactiva el producto sin ofrecer eliminación directa', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    buscarProductos
      .mockResolvedValueOnce([{
        cod_sku_pt: 'PT-000001',
        producto: 'Jarra Regadera',
        familia: 'JARDIN',
        linea: 'Hogar',
        status: 'ACTIVO',
      }])
      .mockResolvedValueOnce([]);
    actualizarProducto.mockResolvedValue({ cod_sku_pt: 'PT-000001' });

    renderWithShell(<ProductosAdmin />);

    expect(await screen.findByRole('button', { name: 'Desactivar PT-000001' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Desactivar PT-000001' }));

    await waitFor(() => expect(actualizarProducto).toHaveBeenCalledWith(
      'PT-000001',
      { status: 'INACTIVO' },
    ));
  });

  it('crea PiezaColor sin SKU manual en el diálogo legacy', async () => {
    const user = userEvent.setup();
    renderWithShell(<PiezaDialog open onClose={vi.fn()} pieza={null} />);

    const identifier = screen.getByLabelText(/^sku$/i);
    expect(identifier).toHaveValue('Se asignará automáticamente al guardar');
    expect(identifier).toHaveAttribute('readonly');
    await user.type(screen.getByLabelText(/nombre pieza/i), 'Variante de prueba');
    await user.click(screen.getByRole('button', { name: /^crear$/i }));

    await waitFor(() => expect(crearPiezaColor).toHaveBeenCalledTimes(1));
    expect(crearPiezaColor.mock.calls[0][0]).not.toHaveProperty('sku');
  });

  it('crea el producto sin referencias comerciales legacy', async () => {
    const user = userEvent.setup();
    obtenerLineas.mockResolvedValue([{ id: 1, codigo: 10, nombre: 'HOGAR' }]);
    obtenerFamilias.mockResolvedValue([{ id: 7, codigo: 14, nombre: 'ENVASES' }]);
    renderWithShell(<ProductoDialog open onClose={vi.fn()} producto={null} />);

    const identifier = screen.getByLabelText(/sku automático/i);
    expect(identifier).toHaveValue('PT-###### · se asignará al guardar');
    expect(identifier).toHaveAttribute('readonly');
    expect(screen.queryByLabelText(/unidad comercial/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/código de barras/i)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/nombre del producto/i), 'Producto con barras');
    await user.click(screen.getByRole('combobox', { name: 'Línea' }));
    await user.click(await screen.findByRole('option', { name: 'HOGAR' }));
    await waitFor(() => expect(obtenerFamilias).toHaveBeenCalledWith({ linea_id: 1 }));
    await user.click(screen.getByRole('combobox', { name: 'Familia' }));
    await user.click(await screen.findByRole('option', { name: 'ENVASES' }));
    await user.click(screen.getByRole('button', { name: /crear producto/i }));

    await waitFor(() => expect(crearProducto).toHaveBeenCalledTimes(1));
    expect(crearProducto.mock.calls[0][0]).not.toHaveProperty('cod_sku_pt');
    expect(crearProducto.mock.calls[0][0]).not.toHaveProperty('doc_x_paq');
    expect(crearProducto.mock.calls[0][0]).not.toHaveProperty('doc_x_bulto');
    expect(crearProducto.mock.calls[0][0]).not.toHaveProperty('codigo_barra');
    expect(crearProducto.mock.calls[0][0]).not.toHaveProperty('um');
  });

  it('el asistente de configuración muestra los correlativos como informativos', async () => {
    renderWithShell(<ConfigurarProducto />);

    const identifier = await screen.findByLabelText(/^código$/i);
    expect(identifier).toHaveValue('Se asignará automáticamente al guardar');
    expect(identifier).toHaveAttribute('readonly');
  });
});
