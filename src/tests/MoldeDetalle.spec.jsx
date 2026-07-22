import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MoldeDetalle from '../components/MoldeDetalle';

vi.mock('../services/api', () => ({
  addColorForma: vi.fn(),
  addFormaMolde: vi.fn(),
  buscarPiezasGlobales: vi.fn(),
  crearColor: vi.fn(),
  deleteForma: vi.fn(),
  getMoldeDetalle: vi.fn(),
  obtenerColores: vi.fn(),
  obtenerFamiliasColor: vi.fn(),
  obtenerFamilias: vi.fn(),
  obtenerLineas: vi.fn(),
  updateFormaMolde: vi.fn(),
  updateMolde: vi.fn(),
}));

import {
  addColorForma,
  addFormaMolde,
  buscarPiezasGlobales,
  crearColor,
  deleteForma,
  getMoldeDetalle,
  obtenerColores,
  obtenerFamiliasColor,
  obtenerFamilias,
  obtenerLineas,
  updateFormaMolde,
} from '../services/api';

const mold = {
  codigo: 'MOL-A',
  nombre: 'Molde A',
  peso_tiro_gr: 120,
  tiempo_ciclo_std: 30,
  peso_neto_gr: 37,
  cavidades_totales: 2,
  formas: [{
    id: 81,
    pieza_id: 10,
    nombre: 'Tapa universal',
    cavidades: 2,
    peso_unitario_gr: 18.5,
    peso_total_gr: 37,
    version: 4,
    variantes: [{ sku: 'PZ10-ROJO', piezas: 'Tapa universal roja', color: 'Rojo', peso: 18.5 }],
  }],
};

const globalPieces = [
  { id: 10, codigo: 'PZ-000010', nombre: 'Tapa universal', peso_nominal_gr: 18.5, linea_id: 1, familia_id: 1, activo: true },
  { id: 11, codigo: 'PZ-000011', nombre: 'Base compartida', peso_nominal_gr: 42.25, linea_id: 1, familia_id: 1, activo: true },
];

const renderPage = () => render(
  <ThemeProvider theme={createTheme()}>
    <MemoryRouter initialEntries={['/datos-maestros/moldes/MOL-A']}>
      <Routes>
        <Route path="/datos-maestros/moldes/:codigo" element={<MoldeDetalle />} />
      </Routes>
    </MemoryRouter>
  </ThemeProvider>,
);

describe('MoldeDetalle: relación N:M MoldePieza', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMoldeDetalle.mockResolvedValue(mold);
    buscarPiezasGlobales.mockResolvedValue(globalPieces);
    obtenerColores.mockResolvedValue([{ id: 1, codigo: 'R', nombre: 'Rojo' }]);
    obtenerFamiliasColor.mockResolvedValue([{ id: 3, nombre: 'SOLIDO' }]);
    obtenerLineas.mockResolvedValue([{ id: 1, codigo: 10, nombre: 'HOGAR' }]);
    obtenerFamilias.mockResolvedValue([{ id: 1, codigo: 20, nombre: 'TAPAS' }]);
    crearColor.mockResolvedValue({ id: 2, codigo: 'V', nombre: 'VERDE SOLIDO', existed: false });
    addColorForma.mockResolvedValue({ sku: 'PC-000002' });
    addFormaMolde.mockResolvedValue({ id: 82 });
    updateFormaMolde.mockResolvedValue({ id: 81 });
    deleteForma.mockResolvedValue({ message: 'ok' });
  });

  it('muestra la asociación y conserva las variantes de color de la pieza', async () => {
    renderPage();

    expect(await screen.findByText('Composición del molde')).toBeInTheDocument();
    expect(screen.getByLabelText(/código del molde/i)).toHaveAttribute('readonly');
    expect(screen.getByText('PZ-000010')).toBeInTheDocument();
    expect(screen.getByText(/2 cavidades × 18.50 g/i)).toBeInTheDocument();
    expect(screen.getByText('PZ10-ROJO')).toBeInTheDocument();
  });

  it('asocia una pieza global existente con parámetros propios del molde', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Composición del molde');

    await user.click(screen.getByRole('button', { name: /^asociar pieza$/i }));
    const dialog = screen.getByRole('dialog', { name: /asociar pieza al molde/i });
    const pieceInput = within(dialog).getByLabelText(/pieza existente/i);
    await user.click(pieceInput);
    await user.type(pieceInput, 'Base');
    await user.click(await screen.findByRole('option', { name: /PZ-000011.*Base compartida/i }));
    await user.clear(within(dialog).getByLabelText(/^cavidades/i));
    await user.type(within(dialog).getByLabelText(/^cavidades/i), '3');
    await user.click(within(dialog).getByRole('button', { name: /^asociar pieza$/i }));

    await waitFor(() => expect(addFormaMolde).toHaveBeenCalledWith('MOL-A', {
      pieza_id: 11,
      cavidades: 3,
      peso_unitario_gr: 42.25,
    }));
  });

  it('crea una pieza clasificada desde la última opción sin enviar un código manual', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Composición del molde');

    await user.click(screen.getByRole('button', { name: /^asociar pieza$/i }));
    const dialog = screen.getByRole('dialog', { name: /asociar pieza al molde/i });
    const pieceInput = within(dialog).getByLabelText(/pieza existente/i);
    await user.click(pieceInput);
    await user.click(await screen.findByRole('option', { name: /crear una pieza nueva/i }));

    const identifier = within(dialog).getByLabelText(/código estable/i);
    expect(identifier).toHaveValue('Se asignará automáticamente al guardar');
    expect(identifier).toHaveAttribute('readonly');
    await user.type(within(dialog).getByLabelText(/nombre de la pieza/i), 'Asa universal');
    await user.type(within(dialog).getByLabelText(/peso nominal de la pieza/i), '9.5');
    await user.click(within(dialog).getByLabelText(/^línea/i));
    await user.click(await screen.findByRole('option', { name: /10.*HOGAR/i }));
    await user.click(within(dialog).getByLabelText(/^familia/i));
    await user.click(await screen.findByRole('option', { name: /20.*TAPAS/i }));
    await user.clear(within(dialog).getByLabelText(/peso operativo/i));
    await user.type(within(dialog).getByLabelText(/peso operativo/i), '9.5');
    await user.click(within(dialog).getByRole('button', { name: /^asociar pieza$/i }));

    await waitFor(() => expect(addFormaMolde).toHaveBeenCalledTimes(1));
    expect(addFormaMolde.mock.calls[0][1]).toMatchObject({
      nombre: 'Asa universal',
      peso_nominal_gr: 9.5,
      linea_id: 1,
      familia_id: 1,
      cavidades: 1,
      peso_unitario_gr: 9.5,
    });
    expect(addFormaMolde.mock.calls[0][1]).not.toHaveProperty('codigo');
  });

  it('edita únicamente cavidades y peso operativo de MoldePieza', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Composición del molde');

    await user.click(screen.getByRole('button', { name: /editar configuración/i }));
    const dialog = screen.getByRole('dialog', { name: /editar configuración en el molde/i });
    await user.clear(within(dialog).getByLabelText(/^cavidades/i));
    await user.type(within(dialog).getByLabelText(/^cavidades/i), '4');
    await user.clear(within(dialog).getByLabelText(/peso operativo/i));
    await user.type(within(dialog).getByLabelText(/peso operativo/i), '19');
    await user.click(within(dialog).getByRole('button', { name: /guardar configuración/i }));

    await waitFor(() => expect(updateFormaMolde).toHaveBeenCalledWith(81, {
      cavidades: 4,
      peso_unitario_gr: 19,
      version: 4,
    }));
  });

  it('desvincula la composición sin eliminar la pieza global', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await screen.findByText('Composición del molde');

    await user.click(screen.getByRole('button', { name: /desvincular/i }));

    await waitFor(() => expect(deleteForma).toHaveBeenCalledWith(81));
    expect(buscarPiezasGlobales).toHaveBeenCalled();
  });

  it('crea un color desde la última opción, lo selecciona y añade la variante', async () => {
    const user = userEvent.setup();
    obtenerColores
      .mockResolvedValueOnce([{ id: 1, codigo: 'R', nombre: 'Rojo' }])
      .mockResolvedValue([
        { id: 1, codigo: 'R', nombre: 'Rojo' },
        { id: 2, codigo: 'V', nombre: 'VERDE SOLIDO' },
      ]);

    renderPage();
    await screen.findByText('Composición del molde');

    await user.click(screen.getByRole('button', { name: /añadir color/i }));
    const variantDialog = screen.getByRole('dialog', { name: /añadir variante de color/i });
    const colorInput = within(variantDialog).getByLabelText(/color de producción/i);
    await user.click(colorInput);
    await user.click(await screen.findByRole('option', { name: /crear nuevo color/i }));

    await user.type(screen.getByLabelText(/color base/i), 'verde');
    await waitFor(() => expect(screen.getByRole('combobox', { name: /acabado/i })).toHaveTextContent('SOLIDO'));
    await user.click(screen.getByRole('button', { name: /crear y seleccionar/i }));

    await waitFor(() => expect(colorInput).toHaveValue('VERDE SOLIDO'));
    expect(crearColor).toHaveBeenCalledWith({ nombre: 'VERDE', familia_color_id: 3 });
    let addVariantButton;
    await waitFor(() => {
      addVariantButton = within(variantDialog).getByRole('button', { name: /añadir variante/i });
      expect(addVariantButton).toBeEnabled();
    });
    await user.click(addVariantButton);

    await waitFor(() => expect(addColorForma).toHaveBeenCalledWith(81, 2));
  });
});
