import { ThemeProvider, createTheme } from '@mui/material';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExceptionalFabricationOrderDialog from '../components/ExceptionalFabricationOrderDialog';

const api = vi.hoisted(() => ({
  create: vi.fn(), mold: vi.fn(), articles: vi.fn(), routes: vi.fn(),
  createMold: vi.fn(), pieces: vi.fn(), enableColor: vi.fn(),
  molds: vi.fn(),
}));

vi.mock('../services/api', () => ({
  obtenerMolde: api.mold,
  crearMolde: api.createMold,
  buscarPiezasGlobales: api.pieces,
  habilitarColorMolde: api.enableColor,
  obtenerMoldes: api.molds,
}));
vi.mock('../services/scmEngineeringApi', () => ({
  obtenerActorScm: () => 1,
  listarArticulosScm: api.articles,
  listarRutasArticuloScm: api.routes,
  mensajeErrorScm: (error, fallback) => error?.message || fallback,
}));
vi.mock('../services/scmOtApi', () => ({ crearOrdenFabricacionExcepcionalScm: api.create }));

const mold = {
  codigo: 'M-1', tiempo_ciclo_std: 10, peso_colada_gr: 1,
  formas: [{
    activo: true, pieza_id: 'p1', pieza_codigo: 'P1', nombre: 'Pieza 1', cavidades: 1,
    peso_unitario_gr: 10, variantes: [{ color_produccion_id: 1, sku: 'SKU-1' }],
  }],
};

const renderDialog = (machines = []) => render(
  <ThemeProvider theme={createTheme()}>
    <MemoryRouter>
      <ExceptionalFabricationOrderDialog
        open
        molds={[{ codigo: 'M-1', nombre: 'Molde 1' }]}
        machines={machines}
        colors={[{ id: 1, nombre: 'Rojo' }]}
        recipes={[]}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />
    </MemoryRouter>
  </ThemeProvider>,
);

const fillValidForm = async (user) => {
  await user.type(screen.getByRole('textbox', { name: 'Motivo de reposición' }), 'Reposición autorizada');
  await user.click(screen.getByRole('combobox', { name: 'Proceso de fabricación' }));
  await user.click(screen.getByRole('option', { name: 'Inyección' }));
  await user.click(screen.getByRole('combobox', { name: 'Molde' }));
  await user.click(screen.getByRole('option', { name: /Molde 1/ }));
  await user.click(screen.getByRole('combobox', { name: 'Color del objetivo 1' }));
  await user.click(screen.getByRole('option', { name: 'Rojo' }));
  await user.type(screen.getByRole('spinbutton', { name: 'Objetivo 1 (kg netos)' }), '10');
};

describe('alta de reposición: intento idempotente', () => {
  beforeEach(() => {
    api.mold.mockResolvedValue(mold);
    api.articles.mockResolvedValue([{
      id: 99, codigo: 'ART-1', clase: 'PIEZA_COLOR', subtipo: { pieza_color_sku: 'SKU-1' },
    }]);
    api.routes.mockResolvedValue([]);
    api.pieces.mockResolvedValue([]);
    api.molds.mockResolvedValue([{ ...mold, nombre: 'Molde catálogo', formas: mold.formas }]);
    api.createMold.mockReset();
    api.enableColor.mockReset();
    api.create.mockReset();
  });

  it('expone acciones contextuales del molde dentro de la misma ventana', async () => {
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Molde: acciones' }));
    expect(screen.getByRole('menuitem', { name: 'Buscar en catálogo' })).toBeVisible();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Crear molde' }));
    expect(screen.getByRole('heading', { name: 'Crear molde para esta OF', level: 2 })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Volver a OF' })).toBeVisible();
  });

  it('crea el molde y sus piezas en un payload atómico sin identificadores manuales', async () => {
    const user = userEvent.setup();
    api.createMold.mockResolvedValue({ codigo: 'MOL-000123', nombre: 'Molde nuevo' });
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Molde: acciones' }));
    await user.click(screen.getByRole('menuitem', { name: 'Crear molde' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre del molde' }), 'Molde nuevo');
    await user.type(screen.getByRole('spinbutton', { name: 'Peso de tiro (g)' }), '120');
    await user.type(screen.getByRole('spinbutton', { name: 'Peso neto por pieza (g)' }), '50');
    await user.type(screen.getByRole('textbox', { name: 'Nombre de la pieza' }), 'Pieza técnica');
    await user.click(screen.getByRole('button', { name: 'Crear y usar este molde' }));
    await waitFor(() => expect(api.createMold).toHaveBeenCalledWith({
      nombre: 'Molde nuevo',
      peso_tiro_gr: 120,
      tiempo_ciclo_std: 30,
      piezas: [{ nombre: 'Pieza técnica', peso_nominal_gr: 50, cavidades: 1, peso_unitario_gr: 50 }],
    }));
    expect(api.createMold.mock.calls[0][0]).not.toHaveProperty('codigo');
  });

  it('libera los inputs tras un 4xx de molde y permite corregir el mismo borrador', async () => {
    const user = userEvent.setup();
    api.createMold.mockRejectedValueOnce({ response: { status: 422 }, message: 'nombre inválido' })
      .mockResolvedValueOnce({ codigo: 'MOL-000124', nombre: 'Molde corregido' });
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Molde: acciones' }));
    await user.click(screen.getByRole('menuitem', { name: 'Crear molde' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre del molde' }), 'Molde inicial');
    await user.type(screen.getByRole('spinbutton', { name: 'Peso de tiro (g)' }), '120');
    await user.type(screen.getByRole('spinbutton', { name: 'Peso neto por pieza (g)' }), '50');
    await user.type(screen.getByRole('textbox', { name: 'Nombre de la pieza' }), 'Pieza técnica');
    await user.click(screen.getByRole('button', { name: 'Crear y usar este molde' }));
    expect(await screen.findByText('nombre inválido')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Nombre del molde' })).not.toBeDisabled();
    await user.clear(screen.getByRole('textbox', { name: 'Nombre del molde' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre del molde' }), 'Molde corregido');
    await user.click(screen.getByRole('button', { name: 'Crear y usar este molde' }));
    await waitFor(() => expect(api.createMold).toHaveBeenCalledTimes(2));
  });

  it('bloquea un alta de molde con respuesta incierta y conserva el payload sin segundo POST', async () => {
    const user = userEvent.setup();
    api.createMold.mockResolvedValue({ nombre: 'Molde sin código' });
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Molde: acciones' }));
    await user.click(screen.getByRole('menuitem', { name: 'Crear molde' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre del molde' }), 'Molde incierto');
    await user.type(screen.getByRole('spinbutton', { name: 'Peso de tiro (g)' }), '120');
    await user.type(screen.getByRole('spinbutton', { name: 'Peso neto por pieza (g)' }), '50');
    await user.type(screen.getByRole('textbox', { name: 'Nombre de la pieza' }), 'Pieza técnica');
    await user.click(screen.getByRole('button', { name: 'Crear y usar este molde' }));
    expect(await screen.findByText(/Alta incierta/)).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Nombre del molde' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Crear y usar este molde' })).toBeDisabled();
    expect(api.createMold).toHaveBeenCalledTimes(1);
  });

  it('mantiene abierta la ventana y bloquea Cancelar mientras el POST de molde está pendiente', async () => {
    const user = userEvent.setup();
    let resolveCreate;
    api.createMold.mockImplementation(() => new Promise((resolve) => { resolveCreate = resolve; }));
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Molde: acciones' }));
    await user.click(screen.getByRole('menuitem', { name: 'Crear molde' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre del molde' }), 'Molde pendiente');
    await user.type(screen.getByRole('spinbutton', { name: 'Peso de tiro (g)' }), '120');
    await user.type(screen.getByRole('spinbutton', { name: 'Peso neto por pieza (g)' }), '50');
    await user.type(screen.getByRole('textbox', { name: 'Nombre de la pieza' }), 'Pieza técnica');
    await user.click(screen.getByRole('button', { name: 'Crear y usar este molde' }));
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    resolveCreate({ codigo: 'MOL-000125', nombre: 'Molde pendiente' });
    await waitFor(() => expect(api.createMold).toHaveBeenCalledTimes(1));
  });

  it('permite recuperar un alta incierta desde catálogo y volver a la OF', async () => {
    const user = userEvent.setup();
    api.createMold.mockResolvedValue({ nombre: 'Molde sin código' });
    api.molds.mockResolvedValue([{ ...mold, nombre: 'Molde reconciliable' }]);
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Molde: acciones' }));
    await user.click(screen.getByRole('menuitem', { name: 'Crear molde' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre del molde' }), 'Molde incierto');
    await user.type(screen.getByRole('spinbutton', { name: 'Peso de tiro (g)' }), '120');
    await user.type(screen.getByRole('spinbutton', { name: 'Peso neto por pieza (g)' }), '50');
    await user.type(screen.getByRole('textbox', { name: 'Nombre de la pieza' }), 'Pieza técnica');
    await user.click(screen.getByRole('button', { name: 'Crear y usar este molde' }));
    await user.click(await screen.findByRole('button', { name: 'Revisar catálogo' }));
    expect(await screen.findByRole('heading', { name: 'Catálogo de moldes' })).toBeVisible();
    await user.click(await screen.findByRole('button', { name: 'Seleccionar' }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Molde' })).toHaveValue('Molde reconciliable'));
    expect(screen.getByRole('button', { name: 'Cancelar' })).not.toBeDisabled();
  });

  it('habilita el color en todo el molde y refresca sus variantes', async () => {
    const user = userEvent.setup();
    api.mold
      .mockResolvedValueOnce({ ...mold, formas: [{ ...mold.formas[0], variantes: [] }] })
      .mockResolvedValueOnce(mold);
    api.enableColor.mockResolvedValue({ variantes_creadas: [{ sku: 'SKU-1' }] });
    renderDialog();
    await user.click(screen.getByRole('combobox', { name: 'Molde' }));
    await user.click(screen.getByRole('option', { name: /Molde 1/ }));
    await user.click(screen.getByRole('combobox', { name: 'Color del objetivo 1' }));
    await user.click(screen.getByRole('option', { name: 'Rojo' }));
    await user.click(await screen.findByRole('button', { name: 'Habilitar color en todo el molde' }));
    await waitFor(() => expect(api.enableColor).toHaveBeenCalledWith('M-1', 1));
    expect(api.mold.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('conserva payload y clave al reintentar un timeout de red', async () => {
    const user = userEvent.setup();
    api.create.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({ id: 'of-1' });
    renderDialog();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Crear OF en borrador' }));

    expect(await screen.findByRole('button', { name: 'Reintentar mismo intento' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Motivo de reposición' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Reintentar mismo intento' }));
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(2));
    expect(api.create.mock.calls[1][0]).toEqual(api.create.mock.calls[0][0]);
    expect(api.create.mock.calls[1][1]).toBe(api.create.mock.calls[0][1]);
  });

  it('libera el formulario tras 4xx y genera una clave nueva para el payload corregido', async () => {
    const user = userEvent.setup();
    api.create.mockRejectedValueOnce({ response: { status: 422 }, message: 'payload inválido' })
      .mockResolvedValueOnce({ id: 'of-2' });
    renderDialog();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Crear OF en borrador' }));
    expect(await screen.findByText('payload inválido')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Reintentar mismo intento' })).not.toBeInTheDocument();

    const reason = screen.getByRole('textbox', { name: 'Motivo de reposición' });
    expect(reason).not.toBeDisabled();
    await user.clear(reason);
    await user.type(reason, 'Reposición corregida');
    await user.click(screen.getByRole('button', { name: 'Crear OF en borrador' }));
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(2));
    expect(api.create.mock.calls[1][1]).not.toBe(api.create.mock.calls[0][1]);
    expect(api.create.mock.calls[1][0].motivo).toBe('Reposición corregida');
  });

  it('permite soplado explícito y congela la operación de ruta exacta del objetivo', async () => {
    const user = userEvent.setup();
    api.routes.mockImplementation(async (articleId) => [{
      id: 20,
      numero_revision: 4,
      estado: 'APROBADA',
      content_hash: 'route-hash',
      operaciones: [{
        id: 200 + Number(articleId),
        executor_kind: 'OP_OT',
        tipo: 'SOPLADO',
        nombre: 'Soplar salida',
        articulo_salida: { id: Number(articleId), codigo: `PC-${articleId}` },
      }],
    }]);
    api.mold.mockResolvedValue({
      ...mold,
      formas: mold.formas.map((shape, index) => ({
        ...shape,
        pieza_id: `p${index + 1}`,
        pieza_codigo: `P${index + 1}`,
        variantes: [{ color_produccion_id: 1, sku: `SKU-${index + 1}` }],
      })),
    });
    api.articles.mockResolvedValue([
      { id: 99, codigo: 'ART-1', clase: 'PIEZA_COLOR', subtipo: { pieza_color_sku: 'SKU-1' } },
      { id: 100, codigo: 'ART-2', clase: 'PIEZA_COLOR', subtipo: { pieza_color_sku: 'SKU-2' } },
    ]);
    renderDialog();
    await user.type(screen.getByRole('textbox', { name: 'Motivo de reposición' }), 'Reposición soplado');
    await user.click(screen.getByRole('combobox', { name: 'Proceso de fabricación' }));
    await user.click(screen.getByRole('option', { name: 'Soplado' }));
    await user.click(screen.getByRole('combobox', { name: 'Molde' }));
    await user.click(screen.getByRole('option', { name: /Molde 1/ }));
    await user.click(screen.getByRole('combobox', { name: 'Color del objetivo 1' }));
    await user.click(screen.getByRole('option', { name: 'Rojo' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Objetivo 1 (kg netos)' }), '10');
    const route = await screen.findByRole('combobox', { name: 'Operación de ruta (opcional)' });
    await user.click(route);
    await user.click(await screen.findByRole('option', { name: /Soplar salida.*Soplado/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Crear OF en borrador' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Crear OF en borrador' }));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0][0]).toEqual(expect.objectContaining({
      proceso: 'SOPLADO',
      corridas: [expect.objectContaining({ operacion_ruta_revision_id: 299 })],
    }));
  });

  it('no envía proceso cuando se deriva de la ruta seleccionada', async () => {
    const user = userEvent.setup();
    api.routes.mockResolvedValue([{
      id: 20,
      numero_revision: 4,
      estado: 'APROBADA',
      content_hash: 'route-hash',
      operaciones: [{
        id: 299,
        executor_kind: 'OP_OT',
        tipo: 'SOPLADO',
        nombre: 'Soplar salida',
        articulo_salida: { id: 99, codigo: 'PC-99' },
      }],
    }]);
    api.create.mockResolvedValue({ id: 'of-derived' });
    renderDialog();
    await user.type(screen.getByRole('textbox', { name: 'Motivo de reposición' }), 'Reposición derivada');
    await user.click(screen.getByRole('combobox', { name: 'Molde' }));
    await user.click(screen.getByRole('option', { name: /Molde 1/ }));
    await user.click(screen.getByRole('combobox', { name: 'Color del objetivo 1' }));
    await user.click(screen.getByRole('option', { name: 'Rojo' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Objetivo 1 (kg netos)' }), '10');
    const route = await screen.findByRole('combobox', { name: 'Operación de ruta (opcional)' });
    await user.click(route);
    await user.click(await screen.findByRole('option', { name: /Soplar salida.*Soplado/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Crear OF en borrador' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Crear OF en borrador' }));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0][0]).not.toHaveProperty('proceso');
    expect(api.create.mock.calls[0][0].corridas[0]).toEqual(
      expect.objectContaining({ operacion_ruta_revision_id: 299 }),
    );
  });

  it('mantiene alta explícita disponible aunque el actor no tenga RUTA_VER', async () => {
    const user = userEvent.setup();
    api.routes.mockRejectedValue({ response: { status: 403 }, message: 'RUTA_VER requerido' });
    api.create.mockResolvedValue({ id: 'of-explicit' });
    renderDialog();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Crear OF en borrador' }));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0][0]).toEqual(expect.objectContaining({ proceso: 'INYECCION' }));
  });

  it('limpia máquina y bloquea crear al retirar la última ruta sin proceso explícito', async () => {
    const user = userEvent.setup();
    api.routes.mockResolvedValue([{
      id: 20, numero_revision: 4, estado: 'APROBADA', content_hash: 'route-hash',
      operaciones: [{
        id: 299, executor_kind: 'OP_OT', tipo: 'SOPLADO', nombre: 'Soplar salida',
        articulo_salida: { id: 99, codigo: 'PC-99' },
      }],
    }]);
    renderDialog([
      { id: 10, codigo: 'MAQ-SOP', nombre: 'Sopladora', estado: 'OPERATIVA', tipo_maquina: { proceso: 'SOPLADO' } },
      { id: 11, codigo: 'MAQ-INY', nombre: 'Inyectora', estado: 'OPERATIVA', tipo_maquina: { proceso: 'INYECCION' } },
    ]);
    await user.type(screen.getByRole('textbox', { name: 'Motivo de reposición' }), 'Reposición con cambio');
    await user.click(screen.getByRole('combobox', { name: 'Molde' }));
    await user.click(screen.getByRole('option', { name: /Molde 1/ }));
    await user.click(screen.getByRole('combobox', { name: 'Color del objetivo 1' }));
    await user.click(screen.getByRole('option', { name: 'Rojo' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Objetivo 1 (kg netos)' }), '10');
    const route = await screen.findByRole('combobox', { name: 'Operación de ruta (opcional)' });
    await user.click(route);
    await user.click(await screen.findByRole('option', { name: /Soplar salida.*Soplado/ }));
    await user.click(screen.getByRole('combobox', { name: 'Máquina sugerida (opcional)' }));
    await user.click(await screen.findByRole('option', { name: /Sopladora.*MAQ-SOP/ }));
    await user.click(within(route.closest('.MuiFormControl-root')).getByRole('button', { name: 'Limpiar selección' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Crear OF en borrador' })).toBeDisabled());
    expect(screen.getByRole('combobox', { name: 'Máquina sugerida (opcional)' })).toHaveValue('');
  });

  it('limpia la máquina al eliminar un objetivo del conjunto', async () => {
    const user = userEvent.setup();
    api.routes.mockResolvedValue([{
      id: 20, numero_revision: 4, estado: 'APROBADA', content_hash: 'route-hash',
      operaciones: [{
        id: 299, executor_kind: 'OP_OT', tipo: 'SOPLADO', nombre: 'Soplar salida',
        articulo_salida: { id: 99, codigo: 'PC-99' },
      }],
    }]);
    renderDialog([
      { id: 10, codigo: 'MAQ-SOP', nombre: 'Sopladora', estado: 'OPERATIVA', tipo_maquina: { proceso: 'SOPLADO' } },
    ]);
    await user.type(screen.getByRole('textbox', { name: 'Motivo de reposición' }), 'Reposición al retirar objetivo');
    await user.click(screen.getByRole('combobox', { name: 'Molde' }));
    await user.click(screen.getByRole('option', { name: /Molde 1/ }));
    await user.click(screen.getByRole('combobox', { name: 'Color del objetivo 1' }));
    await user.click(screen.getByRole('option', { name: 'Rojo' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Objetivo 1 (kg netos)' }), '10');
    const route = await screen.findByRole('combobox', { name: 'Operación de ruta (opcional)' });
    await user.click(route);
    await user.click(await screen.findByRole('option', { name: /Soplar salida.*Soplado/ }));
    await user.click(screen.getByRole('button', { name: 'Agregar color' }));
    await user.click(screen.getByRole('combobox', { name: 'Máquina sugerida (opcional)' }));
    await user.click(await screen.findByRole('option', { name: /Sopladora.*MAQ-SOP/ }));
    expect(screen.getByRole('combobox', { name: 'Máquina sugerida (opcional)' })).toHaveValue('Sopladora');
    await user.click(screen.getByRole('button', { name: 'Eliminar objetivo de color 2' }));
    expect(screen.getByRole('combobox', { name: 'Máquina sugerida (opcional)' })).toHaveValue('');
  });

  it('descarta el molde diferido al limpiar y reabrir', async () => {
    const user = userEvent.setup();
    let resolveMold;
    api.mold.mockImplementation(() => new Promise((resolve) => { resolveMold = resolve; }));
    const { rerender } = renderDialog();
    await user.click(screen.getByRole('combobox', { name: 'Molde' }));
    await user.click(screen.getByRole('option', { name: /Molde 1/ }));
    await user.click(screen.getByRole('button', { name: 'Limpiar selección' }));
    rerender(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter>
          <ExceptionalFabricationOrderDialog open={false} molds={[{ codigo: 'M-1', nombre: 'Molde 1' }]} machines={[]} colors={[{ id: 1, nombre: 'Rojo' }]} recipes={[]} onClose={vi.fn()} onCreated={vi.fn()} />
        </MemoryRouter>
      </ThemeProvider>,
    );
    rerender(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter>
          <ExceptionalFabricationOrderDialog open molds={[{ codigo: 'M-1', nombre: 'Molde 1' }]} machines={[]} colors={[{ id: 1, nombre: 'Rojo' }]} recipes={[]} onClose={vi.fn()} onCreated={vi.fn()} />
        </MemoryRouter>
      </ThemeProvider>,
    );
    resolveMold({ ...mold, nombre: 'Mold stale' });
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Molde' })).toHaveValue(''));
    expect(screen.queryByText('Mold stale')).not.toBeInTheDocument();
  });
});
