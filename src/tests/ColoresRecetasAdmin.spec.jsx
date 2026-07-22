import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ColoresRecetasAdmin from '../components/ColoresRecetasAdmin';

vi.mock('../services/api', () => ({
  actualizarColor: vi.fn(),
  actualizarFamiliaColor: vi.fn(),
  actualizarRecetaColorMaestra: vi.fn(),
  crearColor: vi.fn(),
  crearFamiliaColor: vi.fn(),
  crearRecetaColorMaestra: vi.fn(),
  inactivarColor: vi.fn(),
  inactivarFamiliaColor: vi.fn(),
  inactivarRecetaColorMaestra: vi.fn(),
  obtenerColores: vi.fn(),
  obtenerFamiliasColor: vi.fn(),
  obtenerIngredientesRecetaColor: vi.fn(),
  obtenerRecetasColorMaestras: vi.fn(),
}));

import {
  crearColor,
  crearFamiliaColor,
  crearRecetaColorMaestra,
  obtenerColores,
  obtenerFamiliasColor,
  obtenerIngredientesRecetaColor,
  obtenerRecetasColorMaestras,
} from '../services/api';

const color = {
  id: 7,
  nombre: 'AMARILLO CAJA ORGANIZADORA SOLIDO',
  color_base_nombre: 'AMARILLO CAJA ORGANIZADORA',
  familia_color_id: 3,
  familia_color_nombre: 'SOLIDO',
  hex_referencia: '#F2C94C',
  activo: true,
  version: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  obtenerColores.mockResolvedValue([color]);
  obtenerFamiliasColor.mockResolvedValue([{ id: 3, nombre: 'SOLIDO', codigo: 1, activo: true, version: 1 }]);
  obtenerIngredientesRecetaColor.mockResolvedValue([
    { id: 11, codigo: 'MP-001', nombre: 'PP VIRGEN', clase: 'MATERIA_PRIMA', activo: true },
    { id: 12, codigo: 'COL-001', nombre: 'AMARILLO', clase: 'COLORANTE', tipo_colorante: 'COLORANTE', activo: true },
  ]);
  obtenerRecetasColorMaestras.mockResolvedValue({ items: [] });
  crearColor.mockResolvedValue({ id: 8, nombre: 'VERDE SOLIDO' });
  crearRecetaColorMaestra.mockResolvedValue({ id: 20, revision: 1 });
});

describe('ColoresRecetasAdmin', () => {
  it('habilita el maestro y crea un color con HEX opcional', async () => {
    const user = userEvent.setup();
    render(<ColoresRecetasAdmin />);

    expect(await screen.findByRole('heading', { name: 'Colores y recetas' })).toBeInTheDocument();
    expect(screen.getAllByLabelText('Color #F2C94C')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Nuevo color' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Escoger color de la paleta')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Nombre del color base'), 'Verde');
    await user.click(within(dialog).getByRole('combobox', { name: 'Acabado / familia de color' }));
    await user.click(screen.getByRole('option', { name: 'SOLIDO' }));
    await user.type(within(dialog).getByLabelText('HEX de referencia (opcional)'), '#22AA44');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(crearColor).toHaveBeenCalledWith({
      nombre: 'Verde',
      familia_color_id: 3,
      hex_referencia: '#22AA44',
      activo: true,
    }));
  });

  it('permite escoger la paleta y crear familias de color desde el maestro', async () => {
    const user = userEvent.setup();
    render(<ColoresRecetasAdmin />);
    expect(await screen.findByRole('heading', { name: 'Colores y recetas' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Nuevo color' }));
    let dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Escoger color de la paleta'), {
      target: { value: '#3366cc' },
    });
    expect(within(dialog).getByLabelText('HEX de referencia (opcional)')).toHaveValue('#3366CC');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Gestionar familias' }));
    dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Nombre de familia'), 'Pastel');
    expect(within(dialog).getByLabelText('Código automático')).toHaveValue('FC-######');
    await user.click(within(dialog).getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(crearFamiliaColor).toHaveBeenCalledWith({
      nombre: 'Pastel',
    }));
  });

  it('crea una receta propia aprobada con resina y dosis por base virgen', async () => {
    const user = userEvent.setup();
    render(<ColoresRecetasAdmin />);
    expect(await screen.findAllByText(color.nombre)).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Nueva receta' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Nombre de variante'), 'Fórmula OP piloto');

    await user.click(within(dialog).getByRole('button', { name: 'Agregar componente' }));
    await user.click(within(dialog).getByRole('combobox', { name: 'Material' }));
    await user.click(screen.getByRole('option', { name: 'MP-001 · PP VIRGEN' }));
    await user.type(within(dialog).getByLabelText('Fracción (0–1)'), '1');

    await user.click(within(dialog).getByRole('button', { name: 'Agregar componente' }));
    const materialSelectors = within(dialog).getAllByRole('combobox', { name: 'Material' });
    await user.click(materialSelectors[1]);
    await user.click(screen.getByRole('option', { name: 'COL-001 · AMARILLO' }));
    await user.type(within(dialog).getByLabelText('Dosis (g)'), '500');

    await user.click(within(dialog).getByRole('combobox', { name: 'Estado' }));
    await user.click(screen.getByRole('option', { name: 'APROBADA' }));
    await user.click(within(dialog).getByRole('switch', { name: 'Predeterminada' }));
    await user.click(within(dialog).getByRole('button', { name: 'Guardar receta' }));

    await waitFor(() => expect(crearRecetaColorMaestra).toHaveBeenCalledWith(expect.objectContaining({
      color_produccion_id: 7,
      nombre_variante: 'Fórmula OP piloto',
      estado: 'APROBADA',
      es_default: true,
      base_virgen_kg: 25,
      lineas: [
        expect.objectContaining({ material_id: 11, tipo_componente: 'MATERIA_PRIMA', cantidad: 1 }),
        expect.objectContaining({ material_id: 12, tipo_componente: 'COLORANTE', cantidad: 500, base_kg: 25 }),
      ],
    })));
  });
});
