import { render, screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import ConfigurarProducto from '../components/ConfigurarProducto';

vi.mock('../services/api', () => ({
  buscarPiezasGlobales: vi.fn(),
  configurarProductoCascada: vi.fn(),
  crearColor: vi.fn(),
  crearFamiliaEnLinea: vi.fn(),
  crearLinea: vi.fn(),
  obtenerColores: vi.fn(),
  obtenerFamilias: vi.fn(),
  obtenerFamiliasColor: vi.fn(),
  obtenerLineas: vi.fn(),
  obtenerMoldes: vi.fn(),
}));

import {
  buscarPiezasGlobales,
  configurarProductoCascada,
  crearColor,
  crearFamiliaEnLinea,
  crearLinea,
  obtenerColores,
  obtenerFamilias,
  obtenerFamiliasColor,
  obtenerLineas,
  obtenerMoldes,
} from '../services/api';

const linea = { id: 1, codigo: 10, nombre: 'HOGAR', activo: true };
const familia = { id: 7, codigo: 14, nombre: 'TAPAS', activo: true };
const piezaExistente = {
  id: 55,
  codigo: 'PZ-000055',
  nombre: 'Tapa regadera',
  peso_nominal_gr: 18.5,
  linea_id: linea.id,
  familia_id: familia.id,
  activo: true,
};
const segundaPieza = {
  id: 56,
  codigo: 'PZ-000056',
  nombre: 'Cuerpo regadera',
  peso_nominal_gr: 60,
  linea_id: linea.id,
  familia_id: familia.id,
  activo: true,
};

const renderWizard = () => render(
  <ThemeProvider theme={createTheme()}>
    <MemoryRouter><ConfigurarProducto /></MemoryRouter>
  </ThemeProvider>,
);

const selectAutocomplete = async (user, label, option) => {
  const input = screen.getByLabelText(label);
  await user.click(input);
  await user.click(await screen.findByRole('option', { name: option }));
};

describe('configuración guiada Molde–Pieza–PiezaColor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    obtenerColores.mockResolvedValue([]);
    obtenerFamiliasColor.mockResolvedValue([{ id: 3, nombre: 'SOLIDO' }]);
    obtenerMoldes.mockResolvedValue([]);
    obtenerLineas.mockResolvedValue([linea]);
    obtenerFamilias.mockImplementation(async (params = {}) => (
      params.linea_id === linea.id ? [familia] : [familia]
    ));
    buscarPiezasGlobales.mockResolvedValue([piezaExistente]);
    crearColor.mockResolvedValue({ id: 22, nombre: 'VERDE SOLIDO', existed: false });
    crearLinea.mockResolvedValue({ id: 2, codigo: 20, nombre: 'INDUSTRIAL' });
    crearFamiliaEnLinea.mockResolvedValue({
      familia: { id: 8, codigo: 18, nombre: 'ENVASES' },
    });
    configurarProductoCascada.mockResolvedValue({
      resultado: { piezas_creadas: [], formas_creadas: [], errores: [] },
    });
  });

  it('filtra las familias por la línea seleccionada', async () => {
    const user = userEvent.setup();
    renderWizard();

    await selectAutocomplete(user, /^Línea/i, 'HOGAR');

    await waitFor(() => expect(obtenerFamilias).toHaveBeenCalledWith({ linea_id: linea.id }));
    await selectAutocomplete(user, /^Familia/i, 'TAPAS');
    expect(screen.getByLabelText(/^Familia/i)).toHaveValue('TAPAS');
  });

  it('crea una Familia dentro de la Línea activa y la selecciona', async () => {
    const user = userEvent.setup();
    renderWizard();

    await selectAutocomplete(user, /^Línea/i, 'HOGAR');
    const familyInput = screen.getByLabelText(/^Familia/i);
    await user.type(familyInput, 'envases');
    await user.click(await screen.findByRole('option', { name: /Crear Familia “envases”/i }));

    const dialog = await screen.findByRole('dialog', { name: /Nueva Familia/i });
    expect(dialog).toBeVisible();
    expect(within(dialog).getByLabelText('Código automático')).toHaveValue('FAM-######');
    expect(within(dialog).getByLabelText(/^Nombre/i)).toHaveValue('ENVASES');
    await user.click(within(dialog).getByRole('button', { name: /Crear y seleccionar/i }));

    await waitFor(() => expect(crearFamiliaEnLinea).toHaveBeenCalledWith(1, {
      nombre: 'ENVASES',
    }));
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog', { name: /Nueva Familia/i }));
    expect(screen.getByLabelText(/^Familia/i)).toHaveValue('ENVASES');
  });

  it('vincula una pieza existente sin duplicar ni contradecir su clasificación', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.type(await screen.findByLabelText(/Nombre del Molde/i), 'Molde regadera');
    await user.type(screen.getByLabelText(/Peso Tiro/i), '120');
    await selectAutocomplete(user, /^Línea/i, 'HOGAR');
    await selectAutocomplete(user, /^Familia/i, 'TAPAS');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    await user.click(screen.getByRole('switch', { name: /Vincular pieza maestra existente/i }));
    await selectAutocomplete(user, /^Pieza existente/i, 'PZ-000055 · Tapa regadera');

    expect(screen.getByText(/Conserva su clasificación/i)).toHaveTextContent('HOGAR · TAPAS');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await user.click(screen.getByRole('button', { name: 'Revisar' }));
    await user.click(screen.getByRole('button', { name: 'Crear Todo' }));

    await waitFor(() => expect(configurarProductoCascada).toHaveBeenCalledTimes(1));
    const payload = configurarProductoCascada.mock.calls[0][0];
    expect(payload.linea_id).toBe(linea.id);
    expect(payload.familia_id).toBe(familia.id);
    expect(payload.formas).toEqual([{
      pieza_id: piezaExistente.id,
      cavidades: 2,
      peso_unitario_gr: 18.5,
    }]);
    expect(payload.formas[0]).not.toHaveProperty('linea_id');
    expect(payload.formas[0]).not.toHaveProperty('familia_id');
    expect(payload.formas[0]).not.toHaveProperty('nombre');
  });

  it('precarga y conserva toda la composición de un molde existente', async () => {
    const user = userEvent.setup();
    const moldeExistente = {
      codigo: 'ML-000020',
      nombre: 'Molde regadera completo',
      peso_tiro_gr: 210,
      tiempo_ciclo_std: 35,
      activo: true,
      formas: [
        {
          pieza_id: piezaExistente.id,
          pieza_codigo: piezaExistente.codigo,
          nombre: piezaExistente.nombre,
          linea_id: linea.id,
          familia_id: familia.id,
          cavidades: 2,
          peso_unitario_gr: 18.5,
          activo: true,
        },
        {
          pieza_id: segundaPieza.id,
          pieza_codigo: segundaPieza.codigo,
          nombre: segundaPieza.nombre,
          linea_id: linea.id,
          familia_id: familia.id,
          cavidades: 1,
          peso_unitario_gr: 60,
          activo: true,
        },
      ],
    };
    obtenerMoldes.mockResolvedValue([moldeExistente]);
    buscarPiezasGlobales.mockResolvedValue([piezaExistente, segundaPieza]);
    renderWizard();

    await user.click(await screen.findByRole('switch', { name: /Usar molde existente/i }));
    await selectAutocomplete(user, /Seleccionar Molde/i, 'ML-000020 - Molde regadera completo');
    expect(screen.getByText(/2 configuraciones Molde–Pieza activas/i)).toBeVisible();
    await selectAutocomplete(user, /^Línea/i, 'HOGAR');
    await selectAutocomplete(user, /^Familia/i, 'TAPAS');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    const piezasPrecargadas = screen.getAllByLabelText(/^Pieza existente/i);
    expect(piezasPrecargadas).toHaveLength(2);
    expect(piezasPrecargadas[0]).toHaveValue('PZ-000055 · Tapa regadera');
    expect(piezasPrecargadas[1]).toHaveValue('PZ-000056 · Cuerpo regadera');
    expect(screen.getAllByLabelText(/^Cavidades/i).map((input) => input.value)).toEqual(['2', '1']);
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(screen.getByText(/no se crearán PiezaColor ni kits/i)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText(/Para formar un kit primero selecciona al menos un color/i)).toBeVisible();
    expect(screen.queryByRole('switch', { name: /formar un Kit/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Revisar' }));
    expect(screen.getByText('ML-000020 - Molde regadera completo')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Crear Todo' }));

    await waitFor(() => expect(configurarProductoCascada).toHaveBeenCalledTimes(1));
    const payload = configurarProductoCascada.mock.calls[0][0];
    expect(payload.molde).toEqual({ codigo: 'ML-000020', usar_existente: true });
    expect(payload.formas).toEqual([
      { pieza_id: 55, cavidades: 2, peso_unitario_gr: 18.5 },
      { pieza_id: 56, cavidades: 1, peso_unitario_gr: 60 },
    ]);
    expect(payload.kit).toBeNull();
    expect(await screen.findByText('Molde reutilizado')).toBeVisible();
    expect(screen.getByText('Piezas maestras reutilizadas')).toBeVisible();
  });

  it('no permite enviar un molde existente sin formas activas', async () => {
    const user = userEvent.setup();
    obtenerMoldes.mockResolvedValue([{
      codigo: 'ML-000099',
      nombre: 'Molde sin configurar',
      peso_tiro_gr: 100,
      tiempo_ciclo_std: 30,
      activo: true,
      formas: [],
    }]);
    renderWizard();

    await user.click(await screen.findByRole('switch', { name: /Usar molde existente/i }));
    await selectAutocomplete(user, /Seleccionar Molde/i, 'ML-000099 - Molde sin configurar');
    expect(screen.getByText(/No tiene una composición activa/i)).toBeVisible();
    await selectAutocomplete(user, /^Línea/i, 'HOGAR');
    await selectAutocomplete(user, /^Familia/i, 'TAPAS');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    expect(configurarProductoCascada).not.toHaveBeenCalled();
  });

  it('crea un color desde la última opción y lo selecciona sin perder el avance', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.type(await screen.findByLabelText(/Nombre del Molde/i), 'Molde tapa');
    await user.type(screen.getByLabelText(/Peso Tiro/i), '80');
    await selectAutocomplete(user, /^Línea/i, 'HOGAR');
    await selectAutocomplete(user, /^Familia/i, 'TAPAS');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    await user.type(screen.getByLabelText(/Nombre de la pieza nueva/i), 'Tapa nueva');
    await user.type(screen.getByLabelText(/^Peso \(gr\)/i), '18');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    const colorInput = screen.getByLabelText(/Agregar color de producción/i);
    await user.type(colorInput, 'verde');
    await user.click(await screen.findByRole('option', { name: /Crear color “verde”/i }));

    expect(await screen.findByRole('dialog', { name: /Nuevo color de producción/i })).toBeVisible();
    expect(screen.getByLabelText(/Color base/i)).toHaveValue('VERDE');
    await waitFor(() => expect(screen.getByRole('button', { name: /Crear y seleccionar/i })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: /Crear y seleccionar/i }));

    await waitFor(() => expect(crearColor).toHaveBeenCalledWith({ nombre: 'VERDE', familia_color_id: 3 }));
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog', { name: /Nuevo color de producción/i }));
    expect(await screen.findByText('VERDE SOLIDO')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await user.click(screen.getByRole('button', { name: 'Revisar' }));
    await user.click(screen.getByRole('button', { name: 'Crear Todo' }));

    await waitFor(() => expect(configurarProductoCascada).toHaveBeenCalledTimes(1));
    expect(configurarProductoCascada.mock.calls[0][0]).toMatchObject({
      linea_id: linea.id,
      familia_id: familia.id,
      color_ids: [22],
      formas: [{ nombre: 'Tapa nueva', cavidades: 2, peso_unitario_gr: 18 }],
    });
  });

  it('rechaza una opción de color sin identidad persistida', async () => {
    const user = userEvent.setup();
    obtenerColores.mockResolvedValue([{ id: null, nombre: 'COLOR SIN ID' }]);
    renderWizard();

    await user.type(await screen.findByLabelText(/Nombre del Molde/i), 'Molde prueba');
    await user.type(screen.getByLabelText(/Peso Tiro/i), '80');
    await selectAutocomplete(user, /^Línea/i, 'HOGAR');
    await selectAutocomplete(user, /^Familia/i, 'TAPAS');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await user.type(screen.getByLabelText(/Nombre de la pieza nueva/i), 'Pieza prueba');
    await user.type(screen.getByLabelText(/^Peso \(gr\)/i), '18');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    const colorInput = screen.getByLabelText(/Agregar color de producción/i);
    await user.click(colorInput);
    await user.click(await screen.findByRole('option', { name: 'COLOR SIN ID' }));

    expect(screen.getByText(/color seleccionado no tiene una identidad válida/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /Eliminar COLOR SIN ID/i })).not.toBeInTheDocument();
  });
});
