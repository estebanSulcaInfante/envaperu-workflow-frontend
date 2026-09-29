import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ColoresRecetasAdmin from '../components/ColoresRecetasAdmin';

const actorCan = vi.hoisted(() => vi.fn(() => true));

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
vi.mock('../services/scmCatalogApi', () => ({
  crearMaterialScm: vi.fn(),
  listarCategoriasRecepcionScm: vi.fn(),
}));
vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({ can: actorCan }),
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
import { crearMaterialScm, listarCategoriasRecepcionScm } from '../services/scmCatalogApi';

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
  actorCan.mockImplementation(() => true);
  obtenerColores.mockResolvedValue([color]);
  obtenerFamiliasColor.mockResolvedValue([{ id: 3, nombre: 'SOLIDO', codigo: 1, activo: true, version: 1 }]);
  obtenerIngredientesRecetaColor.mockResolvedValue([
    { id: 11, codigo: 'MP-001', nombre: 'PP VIRGEN', clase: 'MATERIA_PRIMA', activo: true },
    { id: 12, codigo: 'COL-001', nombre: 'AMARILLO', clase: 'COLORANTE', tipo_colorante: 'COLORANTE', activo: true },
  ]);
  obtenerRecetasColorMaestras.mockResolvedValue({ items: [] });
  listarCategoriasRecepcionScm.mockResolvedValue([{ id: 4, codigo: 'RESINA_VIRGEN', nombre: 'Resina virgen', activo: true }]);
  crearMaterialScm.mockResolvedValue({ id: 13, codigo: 'MP-013', nombre: 'PP NUEVO', clase: 'MATERIA_PRIMA', activo: true });
  crearColor.mockResolvedValue({ id: 8, nombre: 'VERDE SOLIDO' });
  crearRecetaColorMaestra.mockResolvedValue({ id: 20, revision: 1 });
});

const sourceRecipe = (overrides = {}) => ({
  id: 20,
  revision: 3,
  color_produccion_id: 7,
  nombre_variante: 'Fórmula vigente',
  producto_sku: 'PT-1',
  estado: 'APROBADA',
  es_default: true,
  base_virgen_kg: 25,
  notas: 'nota fuente',
  lineas: [
    { id: 1, material_id: 11, tipo_componente: 'MATERIA_PRIMA', cantidad: 1, base_kg: null, material_nombre: 'PP VIRGEN' },
    { id: 2, material_id: 12, tipo_componente: 'COLORANTE', cantidad: 500, base_kg: 25, material_nombre: 'AMARILLO' },
  ],
  ...overrides,
});

const confirmedCopy = (overrides = {}) => ({
  ...sourceRecipe(),
  id: 21,
  revision: 1,
  nombre_variante: 'Fórmula vigente (copia)',
  estado: 'BORRADOR',
  es_default: false,
  notas: 'Fuente receta 20 · rev. 3 · nota fuente · Copia de Fórmula vigente',
  ...overrides,
});

async function openDuplicate(user, source = sourceRecipe()) {
  obtenerRecetasColorMaestras.mockResolvedValue({ items: [source] });
  render(<ColoresRecetasAdmin />);
  return screen.findByRole('button', { name: `Duplicar receta ${source.nombre_variante} como borrador` });
}

async function waitForDuplicateReady(dialog) {
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Guardar borrador' })).toBeEnabled());
}

describe('ColoresRecetasAdmin', () => {
  it('crea materia prima con categoría y la selecciona en la receta abierta', async () => {
    const user = userEvent.setup();
    render(<ColoresRecetasAdmin />);
    await user.click(await screen.findByRole('button', { name: 'Nueva receta' }));
    await user.click(screen.getByRole('button', { name: 'Agregar componente' }));
    await user.click(screen.getByRole('button', { name: 'Crear materia prima' }));
    const materialDialog = screen.getByRole('dialog', { name: 'Crear materia prima' });
    await user.type(await within(materialDialog).findByLabelText(/Nombre del material/), 'PP NUEVO');
    await user.click(within(materialDialog).getByRole('combobox', { name: /Categoría de recepción/ }));
    await user.click(screen.getByRole('option', { name: 'RESINA_VIRGEN · Resina virgen' }));
    await user.click(within(materialDialog).getByRole('button', { name: 'Crear y seleccionar' }));
    expect(crearMaterialScm).toHaveBeenCalledWith({
      nombre: 'PP NUEVO', clase: 'MATERIA_PRIMA', categoria_recepcion_id: 4,
      unidad_base: 'KG', activo: true,
    });
    expect(await screen.findByRole('combobox', { name: 'Material' })).toHaveTextContent('PP NUEVO');
  });
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
    await user.type(within(dialog).getByLabelText('Materia prima (%)'), '100');

    await user.click(within(dialog).getByRole('button', { name: 'Agregar componente' }));
    const materialSelectors = within(dialog).getAllByRole('combobox', { name: 'Material' });
    await user.click(materialSelectors[1]);
    await user.click(screen.getByRole('option', { name: 'COL-001 · AMARILLO' }));
    await user.type(within(dialog).getByLabelText('Dosis (g)'), '500');

    await user.click(within(dialog).getByRole('combobox', { name: 'Estado' }));
    await user.click(screen.getByRole('option', { name: 'APROBADA' }));
    await user.click(within(dialog).getByRole('switch', { name: 'Predeterminada' }));
    await user.click(within(dialog).getByRole('button', { name: 'Aprobar receta' }));

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
    expect(crearRecetaColorMaestra.mock.calls[0][0]).not.toHaveProperty('exigir_variante_nueva');
  });

  it('duplica una receta con POST como borrador editable, sin PUT ni predeterminada', async () => {
    const user = userEvent.setup();
    const source = {
      id: 20, revision: 3, color_produccion_id: 7, nombre_variante: 'Fórmula vigente', producto_sku: 'PT-1',
      estado: 'APROBADA', es_default: true, base_virgen_kg: 25, notas: 'nota fuente',
      lineas: [
        { id: 1, material_id: 11, tipo_componente: 'MATERIA_PRIMA', cantidad: 1, base_kg: null, material_nombre: 'PP VIRGEN' },
        { id: 2, material_id: 12, tipo_componente: 'COLORANTE', cantidad: 500, base_kg: 25, material_nombre: 'AMARILLO' },
      ],
    };
    obtenerRecetasColorMaestras.mockResolvedValue({ items: [source] });
    render(<ColoresRecetasAdmin />);
    await user.click(await screen.findByRole('button', { name: 'Duplicar receta Fórmula vigente como borrador' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/BORRADOR y no predeterminada/)).toBeVisible();
    expect(within(dialog).getByRole('textbox', { name: 'Nombre de variante' })).toHaveValue('Fórmula vigente (copia)');
    await waitForDuplicateReady(dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(crearRecetaColorMaestra).toHaveBeenCalledWith(expect.objectContaining({
      color_produccion_id: 7, estado: 'BORRADOR', es_default: false, exigir_variante_nueva: true,
      lineas: [
        expect.objectContaining({ material_id: 11, cantidad: 1 }),
        expect.objectContaining({ material_id: 12, cantidad: 500, base_kg: 25 }),
      ],
    })));
  });

  it('conserva el marcador de fuente aunque se reemplacen las notas editables', async () => {
    const user = userEvent.setup();
    const source = sourceRecipe();
    await user.click(await openDuplicate(user, source));
    const dialog = screen.getByRole('dialog');
    await waitForDuplicateReady(dialog);
    const notes = within(dialog).getByRole('textbox', { name: 'Notas' });
    await user.clear(notes);
    await user.type(notes, 'Nota operativa de la copia');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(crearRecetaColorMaestra).toHaveBeenCalledWith(expect.objectContaining({
      notas: expect.stringMatching(/Nota operativa de la copia.*Fuente receta 20.*rev\. 3.*Copia de Fórmula vigente/i),
      estado: 'BORRADOR',
      es_default: false,
    })));
  });

  it('cancela sin mutar y conserva la receta fuente', async () => {
    const user = userEvent.setup();
    const source = sourceRecipe();
    await user.click(await openDuplicate(user, source));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(crearRecetaColorMaestra).not.toHaveBeenCalled();
    expect(source).toMatchObject({ estado: 'APROBADA', es_default: true, revision: 3 });
  });

  it('bloquea referencias inactivas hasta reemplazarlas', async () => {
    const user = userEvent.setup();
    const source = sourceRecipe({ lineas: [{ id: 9, material_id: 99, tipo_componente: 'MATERIA_PRIMA', cantidad: 1, base_kg: null }] });
    obtenerIngredientesRecetaColor.mockResolvedValue([
      { id: 99, codigo: 'MP-OLD', nombre: 'MP INACTIVA', clase: 'MATERIA_PRIMA', activo: false },
      { id: 11, codigo: 'MP-001', nombre: 'PP VIRGEN', clase: 'MATERIA_PRIMA', activo: true },
    ]);
    await user.click(await openDuplicate(user, source));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/material.*inactiv/i)).toBeVisible();
    const save = within(dialog).getByRole('button', { name: 'Guardar borrador' });
    expect(save).toBeDisabled();
    await user.click(within(dialog).getByRole('combobox', { name: 'Material' }));
    await user.click(screen.getByRole('option', { name: 'MP-001 · PP VIRGEN' }));
    expect(save).toBeEnabled();
    await user.click(save);
    await waitFor(() => expect(crearRecetaColorMaestra).toHaveBeenCalledWith(expect.objectContaining({
      estado: 'BORRADOR',
      lineas: [expect.objectContaining({ material_id: 11, cantidad: 1 })],
    })));
  });

  it('permite duplicar a un perfil sin permiso de aprobar', async () => {
    const user = userEvent.setup();
    actorCan.mockImplementation((capability) => capability !== 'FORMULACION_PUBLICAR_DIRECTO');
    await user.click(await openDuplicate(user));
    const dialog = screen.getByRole('dialog');
    await waitForDuplicateReady(dialog);
    expect(within(dialog).queryByRole('option', { name: 'APROBADA' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(crearRecetaColorMaestra).toHaveBeenCalledWith(expect.objectContaining({ estado: 'BORRADOR', es_default: false })));
  });

  it('bloquea crear y duplicar cuando el color seleccionado está inactivo', async () => {
    const user = userEvent.setup();
    const inactiveColor = { ...color, activo: false };
    obtenerColores.mockResolvedValue([inactiveColor]);
    obtenerRecetasColorMaestras.mockResolvedValue({ items: [sourceRecipe()] });
    render(<ColoresRecetasAdmin />);
    expect(await screen.findByText(/color está inactivo.*No se pueden crear ni duplicar/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Nueva receta' })).toBeDisabled();
    await user.click(screen.getByRole('switch', { name: 'Inactivos' }));
    const duplicate = await screen.findByRole('button', { name: 'Duplicar receta Fórmula vigente como borrador' });
    expect(duplicate).toBeDisabled();
    expect(crearRecetaColorMaestra).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('conserva el diálogo y el formulario ante un 4xx', async () => {
    const user = userEvent.setup();
    crearRecetaColorMaestra.mockRejectedValueOnce({ response: { status: 409, data: { error: 'Ya existe la variante' } } });
    await user.click(await openDuplicate(user));
    const dialog = screen.getByRole('dialog');
    await waitForDuplicateReady(dialog);
    const name = within(dialog).getByRole('textbox', { name: 'Nombre de variante' });
    await user.clear(name);
    await user.type(name, 'Variante corregida');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(within(dialog).getByText('Ya existe la variante')).toBeVisible());
    expect(name).toHaveValue('Variante corregida');
    expect(within(dialog).queryByText(/respuesta fue incierta/i)).not.toBeInTheDocument();
  });

  it('reconcilia una respuesta incierta si el GET confirma la copia', async () => {
    const user = userEvent.setup();
    const source = sourceRecipe();
    obtenerRecetasColorMaestras
      .mockResolvedValueOnce({ items: [source] })
      .mockResolvedValueOnce({ items: [source] })
      .mockResolvedValueOnce({ items: [confirmedCopy()] });
    crearRecetaColorMaestra.mockRejectedValueOnce(new Error('timeout'));
    render(<ColoresRecetasAdmin />);
    await user.click(await screen.findByRole('button', { name: 'Duplicar receta Fórmula vigente como borrador' }));
    const dialog = screen.getByRole('dialog');
    await waitForDuplicateReady(dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Guardar borrador' }));
    const review = await within(dialog).findByRole('button', { name: 'Revisar catálogo' });
    await user.click(review);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText(/copia.*confirmada/i)).toBeVisible();
    expect(crearRecetaColorMaestra).toHaveBeenCalledTimes(1);
  });

  it('tras un GET sin copia habilita sólo un reintento explícito', async () => {
    const user = userEvent.setup();
    obtenerRecetasColorMaestras
      .mockResolvedValueOnce({ items: [sourceRecipe()] })
      .mockResolvedValueOnce({ items: [sourceRecipe()] })
      .mockResolvedValueOnce({ items: [] });
    crearRecetaColorMaestra.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({ id: 22, revision: 1 });
    render(<ColoresRecetasAdmin />);
    await user.click(await screen.findByRole('button', { name: 'Duplicar receta Fórmula vigente como borrador' }));
    const dialog = screen.getByRole('dialog');
    await waitForDuplicateReady(dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Guardar borrador' }));
    await user.click(await within(dialog).findByRole('button', { name: 'Revisar catálogo' }));
    const retry = await within(dialog).findByRole('button', { name: 'Reintentar guardado' });
    expect(retry).toBeEnabled();
    await user.click(retry);
    await waitFor(() => expect(crearRecetaColorMaestra).toHaveBeenCalledTimes(2));
  });

  it('congela nombre y dosis durante timeout y reintenta con el payload original', async () => {
    const user = userEvent.setup();
    let rejectCreate;
    obtenerRecetasColorMaestras
      .mockResolvedValueOnce({ items: [sourceRecipe()] })
      .mockResolvedValueOnce({ items: [sourceRecipe()] })
      .mockResolvedValueOnce({ items: [] });
    crearRecetaColorMaestra
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectCreate = reject; }))
      .mockResolvedValueOnce({ id: 24, revision: 1 });
    render(<ColoresRecetasAdmin />);
    await user.click(await screen.findByRole('button', { name: 'Duplicar receta Fórmula vigente como borrador' }));
    const dialog = screen.getByRole('dialog');
    await waitForDuplicateReady(dialog);
    const name = within(dialog).getByRole('textbox', { name: 'Nombre de variante' });
    const dose = within(dialog).getByRole('spinbutton', { name: 'Materia prima (%)' });
    const save = within(dialog).getByRole('button', { name: 'Guardar borrador' });
    await user.click(save);
    await waitFor(() => expect(name).toBeDisabled());
    expect(dose).toBeDisabled();
    rejectCreate(new Error('timeout'));
    await within(dialog).findByRole('button', { name: 'Revisar catálogo' });
    expect(name).toBeDisabled();
    expect(dose).toBeDisabled();
    const originalPayload = crearRecetaColorMaestra.mock.calls[0][0];
    fireEvent.change(name, { target: { value: 'Cambio indebido' } });
    fireEvent.change(dose, { target: { value: '55' } });
    expect(name).toHaveValue('Fórmula vigente (copia)');
    expect(dose).toHaveValue(100);
    await user.click(within(dialog).getByRole('button', { name: 'Revisar catálogo' }));
    const retry = await within(dialog).findByRole('button', { name: 'Reintentar guardado' });
    await user.click(retry);
    await waitFor(() => expect(crearRecetaColorMaestra).toHaveBeenCalledTimes(2));
    expect(crearRecetaColorMaestra.mock.calls[1][0]).toEqual(originalPayload);
  });

  it('mantiene bloqueado el reintento si falla la consulta de reconciliación', async () => {
    const user = userEvent.setup();
    obtenerRecetasColorMaestras
      .mockResolvedValueOnce({ items: [sourceRecipe()] })
      .mockResolvedValueOnce({ items: [sourceRecipe()] })
      .mockRejectedValueOnce(new Error('GET failed'));
    crearRecetaColorMaestra.mockRejectedValueOnce(new Error('timeout'));
    render(<ColoresRecetasAdmin />);
    await user.click(await screen.findByRole('button', { name: 'Duplicar receta Fórmula vigente como borrador' }));
    const dialog = screen.getByRole('dialog');
    await waitForDuplicateReady(dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Guardar borrador' }));
    await user.click(await within(dialog).findByRole('button', { name: 'Revisar catálogo' }));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Guardar borrador' })).toBeDisabled());
    expect(within(dialog).getByText(/no se pudo consultar/i)).toBeVisible();
    expect(crearRecetaColorMaestra).toHaveBeenCalledTimes(1);
  });

  it('permite cancelar la incertidumbre y reabrir el formulario conservado', async () => {
    const user = userEvent.setup();
    obtenerRecetasColorMaestras
      .mockResolvedValueOnce({ items: [sourceRecipe()] })
      .mockResolvedValueOnce({ items: [sourceRecipe()] });
    crearRecetaColorMaestra.mockRejectedValueOnce(new Error('timeout'));
    render(<ColoresRecetasAdmin />);
    await user.click(await screen.findByRole('button', { name: 'Duplicar receta Fórmula vigente como borrador' }));
    const dialog = screen.getByRole('dialog');
    await waitForDuplicateReady(dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Guardar borrador' }));
    await within(dialog).findByRole('button', { name: 'Revisar catálogo' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Reabrir copia' }));
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(within(screen.getByRole('dialog')).getByRole('textbox', { name: 'Nombre de variante' })).toHaveValue('Fórmula vigente (copia)');
    expect(crearRecetaColorMaestra).toHaveBeenCalledTimes(1);
  });

  it('evita el doble POST mientras el guardado está pendiente', async () => {
    const user = userEvent.setup();
    let resolveCreate;
    crearRecetaColorMaestra.mockImplementationOnce(() => new Promise((resolve) => { resolveCreate = resolve; }));
    await user.click(await openDuplicate(user));
    const dialog = screen.getByRole('dialog');
    await waitForDuplicateReady(dialog);
    const save = within(dialog).getByRole('button', { name: 'Guardar borrador' });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(crearRecetaColorMaestra).toHaveBeenCalledTimes(1);
    resolveCreate({ id: 23, revision: 1 });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('recarga el color, ingredientes y recetas vigentes al abrir una copia y calcula nombre único fresco', async () => {
    const user = userEvent.setup();
    const source = sourceRecipe();
    const freshSource = sourceRecipe({ notas: 'nota vigente', lineas: [{ id: 99, material_id: 12, tipo_componente: 'COLORANTE', cantidad: 725, base_kg: 25 }] });
    const freshCollision = { ...confirmedCopy(), id: 30, nombre_variante: 'Fórmula vigente (copia)' };
    obtenerRecetasColorMaestras.mockResolvedValue({ items: [source] });
    render(<ColoresRecetasAdmin />);
    await screen.findByRole('button', { name: `Duplicar receta ${source.nombre_variante} como borrador` });
    obtenerColores.mockResolvedValue([{ ...color, hex_referencia: '#112233' }]);
    obtenerIngredientesRecetaColor.mockResolvedValue([
      { id: 12, codigo: 'COL-001', nombre: 'AMARILLO VIGENTE', clase: 'COLORANTE', tipo_colorante: 'COLORANTE', activo: true },
    ]);
    obtenerRecetasColorMaestras.mockResolvedValue({ items: [freshSource, freshCollision] });

    await user.click(screen.getByRole('button', { name: `Duplicar receta ${source.nombre_variante} como borrador` }));
    const dialog = screen.getByRole('dialog');
    await waitForDuplicateReady(dialog);
    expect(within(dialog).getByRole('textbox', { name: 'Nombre de variante' })).toHaveValue('Fórmula vigente (copia 2)');
    expect(within(dialog).getByRole('spinbutton', { name: 'Dosis (g)' })).toHaveValue(725);
    expect(obtenerColores).toHaveBeenLastCalledWith({ include_inactive: true });
    expect(obtenerIngredientesRecetaColor).toHaveBeenLastCalledWith({ include_inactive: true });
    expect(obtenerRecetasColorMaestras).toHaveBeenLastCalledWith({ color_produccion_id: 7, include_inactive: true });
  });

  it('bloquea una referencia que se volvió inactiva en la recarga fresca', async () => {
    const user = userEvent.setup();
    const source = sourceRecipe();
    obtenerRecetasColorMaestras.mockResolvedValue({ items: [source] });
    render(<ColoresRecetasAdmin />);
    await screen.findByRole('button', { name: `Duplicar receta ${source.nombre_variante} como borrador` });
    obtenerIngredientesRecetaColor.mockResolvedValue([
      { id: 11, codigo: 'MP-001', nombre: 'PP VIRGEN', clase: 'MATERIA_PRIMA', activo: false },
      { id: 12, codigo: 'COL-001', nombre: 'AMARILLO', clase: 'COLORANTE', tipo_colorante: 'COLORANTE', activo: true },
    ]);
    await user.click(screen.getByRole('button', { name: `Duplicar receta ${source.nombre_variante} como borrador` }));
    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(within(dialog).getByText(/material.*inactiv/i)).toBeVisible());
    expect(within(dialog).getByRole('button', { name: 'Guardar borrador' })).toBeDisabled();
  });

  it('bloquea una fuente que se volvió inactiva en la consulta fresca', async () => {
    const user = userEvent.setup();
    const source = sourceRecipe();
    obtenerRecetasColorMaestras.mockResolvedValue({ items: [source] });
    render(<ColoresRecetasAdmin />);
    const duplicate = await screen.findByRole('button', { name: `Duplicar receta ${source.nombre_variante} como borrador` });
    obtenerRecetasColorMaestras.mockResolvedValue({ items: [{ ...source, estado: 'INACTIVA' }] });
    await user.click(duplicate);
    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(within(dialog).getByText(/fuente está inactiva/i)).toBeVisible());
    expect(within(dialog).getByRole('button', { name: 'Guardar borrador' })).toBeDisabled();
    expect(crearRecetaColorMaestra).not.toHaveBeenCalled();
  });

  it('exige permisos de ARTICULO_ADMINISTRAR y nunca hace POST al duplicar sin ellos', async () => {
    actorCan.mockImplementation((capability) => capability !== 'ARTICULO_ADMINISTRAR');
    obtenerRecetasColorMaestras.mockResolvedValue({ items: [sourceRecipe()] });
    render(<ColoresRecetasAdmin />);
    const duplicate = await screen.findByRole('button', { name: `Duplicar receta ${sourceRecipe().nombre_variante} como borrador` });
    expect(duplicate).toBeDisabled();
    fireEvent.click(duplicate);
    expect(crearRecetaColorMaestra).not.toHaveBeenCalled();
  });

  it('compara notas normalizadas y no confirma una copia con nota operativa distinta', async () => {
    const user = userEvent.setup();
    const source = sourceRecipe();
    obtenerRecetasColorMaestras
      .mockResolvedValueOnce({ items: [source] })
      .mockResolvedValueOnce({ items: [source] })
      .mockResolvedValueOnce({ items: [confirmedCopy({ notas: 'Fuente receta 20 · rev. 3 · nota distinta · Copia de Fórmula vigente' })] });
    crearRecetaColorMaestra.mockRejectedValueOnce(new Error('timeout'));
    render(<ColoresRecetasAdmin />);
    await user.click(await screen.findByRole('button', { name: `Duplicar receta ${source.nombre_variante} como borrador` }));
    const dialog = screen.getByRole('dialog');
    await waitForDuplicateReady(dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Guardar borrador' }));
    await user.click(await within(dialog).findByRole('button', { name: 'Revisar catálogo' }));
    await waitFor(() => expect(within(dialog).getAllByText(/contenido o fuente no coincide/i).length).toBeGreaterThan(0));
    expect(within(dialog).getByRole('button', { name: 'Guardar borrador' })).toBeDisabled();
  });

  it('bloquea el guardado mientras consulta y deja recuperación explícita si falla la consulta fresca', async () => {
    const user = userEvent.setup();
    let rejectColors;
    const source = sourceRecipe();
    obtenerRecetasColorMaestras.mockResolvedValue({ items: [source] });
    render(<ColoresRecetasAdmin />);
    const duplicate = await screen.findByRole('button', { name: `Duplicar receta ${source.nombre_variante} como borrador` });
    obtenerColores.mockImplementationOnce(() => new Promise((_, reject) => { rejectColors = reject; }));
    await user.click(duplicate);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Consultando colores/i)).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Guardar borrador' })).toBeDisabled();
    rejectColors(new Error('catalog unavailable'));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Reintentar consulta' })).toBeVisible());
    expect(within(dialog).getByRole('button', { name: 'Guardar borrador' })).toBeDisabled();
    expect(crearRecetaColorMaestra).not.toHaveBeenCalled();
  });

  it('cancelar invalida una consulta tardía y no contamina el diálogo', async () => {
    const user = userEvent.setup();
    let resolveColors;
    const source = sourceRecipe();
    obtenerRecetasColorMaestras.mockResolvedValue({ items: [source] });
    render(<ColoresRecetasAdmin />);
    const duplicate = await screen.findByRole('button', { name: `Duplicar receta ${source.nombre_variante} como borrador` });
    obtenerColores.mockImplementationOnce(() => new Promise((resolve) => { resolveColors = resolve; }));
    await user.click(duplicate);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Consultando colores/i)).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    resolveColors([color]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(crearRecetaColorMaestra).not.toHaveBeenCalled();
  });
});
