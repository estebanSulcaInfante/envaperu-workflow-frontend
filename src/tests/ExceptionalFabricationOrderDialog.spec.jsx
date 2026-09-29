import { ThemeProvider, createTheme } from '@mui/material';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExceptionalFabricationOrderDialog from '../components/ExceptionalFabricationOrderDialog';

const api = vi.hoisted(() => ({
  create: vi.fn(), mold: vi.fn(), articles: vi.fn(), routes: vi.fn(),
  createMold: vi.fn(), pieces: vi.fn(), enableColor: vi.fn(),
  molds: vi.fn(), colors: vi.fn(), recipes: vi.fn(),
}));

vi.mock('../services/api', () => ({
  obtenerMolde: api.mold,
  crearMolde: api.createMold,
  buscarPiezasGlobales: api.pieces,
  habilitarColorMolde: api.enableColor,
  obtenerMoldes: api.molds,
  obtenerColores: api.colors,
  obtenerRecetasColorMaestras: api.recipes,
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
    api.colors.mockResolvedValue([{ id: 1, nombre: 'Rojo', activo: true }]);
    api.recipes.mockResolvedValue([]);
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

  it('prellena una copia sin POST, exige revisar y usa kg/salidas del molde vigente', async () => {
    const user = userEvent.setup();
    api.create.mockResolvedValue({ id: 'of-copy', codigo: 'OF-COPY' });
    api.mold.mockResolvedValue({ ...mold, formas: [{ ...mold.formas[0], cavidades: 2, peso_unitario_gr: 12 }] });
    const source = {
      id: 'of-source', codigo: 'OF-SOURCE', estado: 'BORRADOR', origen_demanda: 'EXCEPCIONAL',
      motivo: 'Reposición fuente', snapshot_proceso: 'INYECCION', molde_id: 'M-1', maquina_prevista_id: 3,
      snapshot_tiempo_ciclo_seg: '10', snapshot_horas_turno: '8', snapshot_peso_colada_gr: '1',
      corridas: [{ id: 'run-source', color_produccion_id: 1, ciclos_objetivo: 4, objetivo_neto_kg: '10', salidas: [{
        id: 'output-source', articulo_scm_id: 99, articulo: { id: 99, clase: 'PIEZA_COLOR', pieza_id: 'p1' },
        cantidad_por_ciclo_snapshot: 1, peso_unitario_snapshot_g: 10,
      }] }],
    };
    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter><ExceptionalFabricationOrderDialog open initialSource={source} molds={[{ codigo: 'M-1', nombre: 'Molde 1' }]} machines={[{ id: 3, codigo: 'MAQ-3', nombre: 'Inyectora', estado: 'OPERATIVA', tipo_maquina: { proceso: 'INYECCION' } }]} colors={[{ id: 1, nombre: 'Rojo' }]} recipes={[]} onClose={vi.fn()} onCreated={vi.fn()} /></MemoryRouter>
      </ThemeProvider>,
    );
    expect(await screen.findByRole('heading', { name: 'Duplicar OF como borrador' })).toBeVisible();
    expect(api.create).not.toHaveBeenCalled();
    const review = await screen.findByRole('checkbox', { name: 'He revisado la fuente y la composición actual' });
    expect(screen.getByRole('button', { name: 'Crear OF en borrador' })).toBeDisabled();
    const objective = screen.getByRole('spinbutton', { name: 'Objetivo 1 (kg netos)' });
    await user.clear(objective);
    await user.type(objective, '12.345');
    await user.type(screen.getByRole('spinbutton', { name: 'Horas de turno' }), '8');
    await user.click(screen.getByRole('combobox', { name: 'Proceso de fabricación' }));
    await user.click(screen.getByRole('option', { name: 'Inyección' }));
    await user.click(review);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Crear OF en borrador' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Crear OF en borrador' }));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0][0]).toEqual(expect.objectContaining({
      motivo: expect.stringContaining('OF-SOURCE'),
      corridas: [expect.objectContaining({ objetivo_neto_kg: 12.345, salidas: [expect.objectContaining({ articulo_scm_id: 99, cantidad_por_ciclo: 2, peso_unitario_g: 12 })] })],
    }));
    expect(api.create.mock.calls[0][0].corridas[0]).not.toHaveProperty('ciclos_objetivo');
  });

  it('bloquea un molde fuente inactivo y exige revisar otra vez al cambiar de molde', async () => {
    const user = userEvent.setup();
    api.mold.mockImplementation(async (code) => ({ ...mold, codigo: code, activo: code !== 'M-1' }));
    const source = {
      codigo: 'OF-000010', origen_demanda: 'EXCEPCIONAL', snapshot_proceso: 'INYECCION',
      molde_id: 'M-1', snapshot_tiempo_ciclo_seg: 10, snapshot_horas_turno: 8, snapshot_peso_colada_gr: 1,
      corridas: [{ color_produccion_id: 1, objetivo_neto_kg: 10, salidas: [{
        articulo: { id: 99, clase: 'PIEZA_COLOR', pieza_id: 'p1' },
        cantidad_por_ciclo_snapshot: 1, peso_unitario_snapshot_g: 10,
      }] }],
    };
    render(<ThemeProvider theme={createTheme()}><MemoryRouter>
      <ExceptionalFabricationOrderDialog open initialSource={source}
        molds={[{ codigo: 'M-2', nombre: 'Molde vigente' }]} machines={[]}
        colors={[{ id: 1, nombre: 'Rojo' }]} recipes={[]} onClose={vi.fn()} onCreated={vi.fn()} />
    </MemoryRouter></ThemeProvider>);
    expect(await screen.findByText(/El molde de la copia está inactivo\. Selecciona un molde vigente\./)).toBeVisible();
    const review = screen.getByRole('checkbox', { name: 'He revisado la fuente y la composición actual' });
    await user.click(review);
    expect(screen.getByRole('button', { name: 'Crear OF en borrador' })).toBeDisabled();
    expect(api.create).not.toHaveBeenCalled();
    await user.click(screen.getByRole('combobox', { name: 'Molde' }));
    await user.click(screen.getByRole('option', { name: /Molde vigente/ }));
    await waitFor(() => expect(api.mold).toHaveBeenLastCalledWith('M-2'));
    expect(review).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Crear OF en borrador' })).toBeDisabled();
    await user.type(screen.getByRole('spinbutton', { name: 'Horas de turno' }), '8');
    await user.click(screen.getByRole('combobox', { name: 'Proceso de fabricación' }));
    await user.click(screen.getByRole('option', { name: 'Inyección' }));
    await user.click(review);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Crear OF en borrador' })).toBeEnabled());
    expect(api.create).not.toHaveBeenCalled();
  });

  it('deja la máquina vacía al duplicar aunque la fuente tuviera una sugerencia retirada', async () => {
    const user = userEvent.setup();
    const source = {
      codigo: 'OF-000010', snapshot_proceso: 'INYECCION', maquina_prevista_id: 95,
      molde_id: 'M-1', snapshot_tiempo_ciclo_seg: 10, snapshot_horas_turno: 8, snapshot_peso_colada_gr: 1,
      corridas: [{ color_produccion_id: 1, objetivo_neto_kg: 10, salidas: [{
        articulo: { id: 99, clase: 'PIEZA_COLOR', pieza_id: 'p1' },
        cantidad_por_ciclo_snapshot: 1, peso_unitario_snapshot_g: 10,
      }] }],
    };
    api.create.mockResolvedValue({ id: 'new-order' });
    render(<ThemeProvider theme={createTheme()}><MemoryRouter>
      <ExceptionalFabricationOrderDialog open initialSource={source}
        molds={[{ codigo: 'M-1', nombre: 'Molde 1' }]} machines={[]}
        colors={[{ id: 1, nombre: 'Rojo' }]} recipes={[]} onClose={vi.fn()} onCreated={vi.fn()} />
    </MemoryRouter></ThemeProvider>);
    expect(screen.getByRole('combobox', { name: 'Máquina sugerida (opcional)' })).toHaveValue('');
    await user.type(screen.getByRole('spinbutton', { name: 'Horas de turno' }), '8');
    await user.click(screen.getByRole('combobox', { name: 'Proceso de fabricación' }));
    await user.click(screen.getByRole('option', { name: 'Inyección' }));
    await user.click(screen.getByRole('checkbox', { name: 'He revisado la fuente y la composición actual' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Crear OF en borrador' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Crear OF en borrador' }));
    expect(api.create.mock.calls[0][0].maquina_prevista_id).toBeNull();
  });

  it('regenera métricas y adopta la revisión aprobada actual sin reintroducir props antiguas', async () => {
    const user = userEvent.setup();
    api.create.mockResolvedValue({ id: 'of-current' });
    api.mold.mockResolvedValue({ ...mold, tiempo_ciclo_std: 45, peso_colada_gr: 15, formas: [{ ...mold.formas[0], cavidades: 3, peso_unitario_gr: 35 }] });
    api.colors.mockResolvedValue([{ id: 1, nombre: 'Rojo vigente', activo: true }]);
    api.recipes.mockResolvedValue([
      { id: 1, color_produccion_id: 1, producto_sku: null, nombre_variante: 'Jarra', revision: 1, estado: 'INACTIVA' },
      { id: 3, color_produccion_id: 1, producto_sku: null, nombre_variante: 'Jarra', revision: 2, estado: 'APROBADA' },
    ]);
    const source = {
      id: 'of-source', codigo: 'OF-SOURCE', origen_demanda: 'EXCEPCIONAL', molde_id: 'M-1',
      snapshot_proceso: 'INYECCION', snapshot_tiempo_ciclo_seg: 30, snapshot_horas_turno: 8, snapshot_peso_colada_gr: 10,
      corridas: [{ color_produccion_id: 1, objetivo_neto_kg: 34, receta_revision_id: 1,
        receta: { id: 1, color_produccion_id: 1, producto_sku: null, nombre_variante: 'Jarra', revision: 1, estado: 'INACTIVA' },
        salidas: [{ articulo: { id: 99, clase: 'PIEZA_COLOR', pieza_id: 'p1' }, cantidad_por_ciclo_snapshot: 2, peso_unitario_snapshot_g: 10 }] }],
    };
    render(<ThemeProvider theme={createTheme()}><MemoryRouter>
      <ExceptionalFabricationOrderDialog open initialSource={source} molds={[{ codigo: 'M-1', nombre: 'Molde 1' }]}
        machines={[{ id: 3, nombre: 'Máquina antigua', estado: 'OPERATIVA', tipo_maquina: { proceso: 'INYECCION' } }]}
        colors={[{ id: 99, nombre: 'Prop stale', activo: true }]} recipes={[{ id: 99, nombre_variante: 'Prop stale', estado: 'APROBADA' }]}
        onClose={vi.fn()} onCreated={vi.fn()} />
    </MemoryRouter></ThemeProvider>);
    await waitFor(() => expect(api.colors).toHaveBeenCalledWith({ include_inactive: true }));
    expect(screen.queryByText('Prop stale')).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Tiempo de ciclo (s)' })).toHaveValue(45);
    expect(screen.getByRole('spinbutton', { name: 'Peso de colada (g)' })).toHaveValue(15);
    expect(screen.getByRole('spinbutton', { name: 'Horas de turno' })).toHaveValue(null);
    await user.type(screen.getByRole('spinbutton', { name: 'Horas de turno' }), '8');
    await user.click(screen.getByRole('combobox', { name: 'Proceso de fabricación' }));
    await user.click(screen.getByRole('option', { name: 'Inyección' }));
    await user.click(screen.getByRole('checkbox', { name: 'He revisado la fuente y la composición actual' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Crear OF en borrador' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Crear OF en borrador' }));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0][0]).toEqual(expect.objectContaining({
      snapshot_tiempo_ciclo_seg: 45, snapshot_peso_colada_gr: 15, maquina_prevista_id: null,
      corridas: [expect.objectContaining({ receta_revision_id: 3, objetivo_neto_kg: 34 })],
    }));
  });

  it('bloquea la copia si falla el catálogo fresco y no usa props como fallback', async () => {
    api.colors.mockRejectedValue(new Error('catálogo no disponible'));
    api.recipes.mockResolvedValue([{ id: 99, nombre_variante: 'Prop stale', estado: 'APROBADA' }]);
    const source = {
      id: 'of-source', codigo: 'OF-SOURCE', origen_demanda: 'EXCEPCIONAL', molde_id: 'M-1',
      snapshot_proceso: 'INYECCION', corridas: [{ color_produccion_id: 1, objetivo_neto_kg: 10,
        salidas: [{ articulo: { id: 99, clase: 'PIEZA_COLOR', pieza_id: 'p1' }, cantidad_por_ciclo_snapshot: 1, peso_unitario_snapshot_g: 10 }] }],
    };
    render(<ThemeProvider theme={createTheme()}><MemoryRouter>
      <ExceptionalFabricationOrderDialog open initialSource={source} molds={[{ codigo: 'M-1', nombre: 'Molde 1' }]}
        colors={[{ id: 1, nombre: 'Prop stale', activo: true }]} recipes={[]} onClose={vi.fn()} onCreated={vi.fn()} />
    </MemoryRouter></ThemeProvider>);
    expect((await screen.findAllByText('catálogo no disponible')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Prop stale')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear OF en borrador' })).toBeDisabled();
  });

  it('vacía artículos al reabrir y bloquea el POST si la segunda carga falla', async () => {
    const user = userEvent.setup();
    const source = {
      id: 'of-source-reopen', codigo: 'OF-REOPEN', origen_demanda: 'EXCEPCIONAL', molde_id: 'M-1',
      snapshot_proceso: 'INYECCION', corridas: [{ color_produccion_id: 1, objetivo_neto_kg: 10,
        salidas: [{ articulo: { id: 99, clase: 'PIEZA_COLOR', pieza_id: 'p1' }, cantidad_por_ciclo_snapshot: 1, peso_unitario_snapshot_g: 10 }] }],
    };
    api.articles.mockClear();
    api.articles.mockResolvedValueOnce([{ id: 99, codigo: 'ART-1', clase: 'PIEZA_COLOR', subtipo: { pieza_color_sku: 'SKU-1' } }])
      .mockRejectedValueOnce(new Error('artículos no disponibles al reabrir'));
    const view = render(<ThemeProvider theme={createTheme()}><MemoryRouter>
      <ExceptionalFabricationOrderDialog open initialSource={source} molds={[{ codigo: 'M-1', nombre: 'Molde 1' }]}
        machines={[]} colors={[{ id: 1, nombre: 'Rojo' }]} recipes={[]} onClose={vi.fn()} onCreated={vi.fn()} />
    </MemoryRouter></ThemeProvider>);
    await waitFor(() => expect(api.articles).toHaveBeenCalled());
    view.rerender(<ThemeProvider theme={createTheme()}><MemoryRouter>
      <ExceptionalFabricationOrderDialog open={false} initialSource={source} molds={[{ codigo: 'M-1', nombre: 'Molde 1' }]}
        machines={[]} colors={[{ id: 1, nombre: 'Rojo' }]} recipes={[]} onClose={vi.fn()} onCreated={vi.fn()} />
    </MemoryRouter></ThemeProvider>);
    view.rerender(<ThemeProvider theme={createTheme()}><MemoryRouter>
      <ExceptionalFabricationOrderDialog open initialSource={source} molds={[{ codigo: 'M-1', nombre: 'Molde 1' }]}
        machines={[]} colors={[{ id: 1, nombre: 'Rojo' }]} recipes={[]} onClose={vi.fn()} onCreated={vi.fn()} />
    </MemoryRouter></ThemeProvider>);
    expect((await screen.findAllByText('artículos no disponibles al reabrir')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Crear OF en borrador' })).toBeDisabled();
    expect(screen.queryByText('ART-1')).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'He revisado la fuente y la composición actual' }));
    expect(api.create).not.toHaveBeenCalled();
  });

  it('mantiene bloqueada una copia con ruta fuente si la consulta actual falla', async () => {
    const user = userEvent.setup();
    const source = {
      id: 'of-source-route', codigo: 'OF-ROUTE', origen_demanda: 'EXCEPCIONAL', molde_id: 'M-1',
      snapshot_proceso: 'INYECCION', corridas: [{ color_produccion_id: 1, objetivo_neto_kg: 10,
        operacion_ruta_revision_id: 299,
        salidas: [{ articulo: { id: 99, clase: 'PIEZA_COLOR', pieza_id: 'p1' }, cantidad_por_ciclo_snapshot: 1, peso_unitario_snapshot_g: 10 }] }],
    };
    api.routes.mockClear();
    api.routes.mockRejectedValue(new Error('rutas actuales no disponibles'));
    render(<ThemeProvider theme={createTheme()}><MemoryRouter>
      <ExceptionalFabricationOrderDialog open initialSource={source} molds={[{ codigo: 'M-1', nombre: 'Molde 1' }]}
        machines={[]} colors={[{ id: 1, nombre: 'Rojo' }]} recipes={[]} onClose={vi.fn()} onCreated={vi.fn()} />
    </MemoryRouter></ThemeProvider>);
    await user.type(screen.getByRole('spinbutton', { name: 'Horas de turno' }), '8');
    await user.click(screen.getByRole('combobox', { name: 'Proceso de fabricación' }));
    await user.click(screen.getByRole('option', { name: 'Inyección' }));
    await user.click(screen.getByRole('checkbox', { name: 'He revisado la fuente y la composición actual' }));
    await waitFor(() => expect(api.routes).toHaveBeenCalled());
    expect((await screen.findAllByText('rutas actuales no disponibles')).length).toBeGreaterThan(0);
    expect(screen.getByText(/bloqueada hasta consultar las rutas actuales/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Crear OF en borrador' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Continuar sin ruta/ })).not.toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('no recicla una ruta retirada y exige decisión visible para continuar sin ruta', async () => {
    const user = userEvent.setup();
    const source = {
      id: 'of-source-retired-route', codigo: 'OF-ROUTE-RETIRED', origen_demanda: 'EXCEPCIONAL', molde_id: 'M-1',
      snapshot_proceso: 'INYECCION', corridas: [{ color_produccion_id: 1, objetivo_neto_kg: 10,
        operacion_ruta_revision_id: 299,
        salidas: [{ articulo: { id: 99, clase: 'PIEZA_COLOR', pieza_id: 'p1' }, cantidad_por_ciclo_snapshot: 1, peso_unitario_snapshot_g: 10 }] }],
    };
    api.routes.mockResolvedValue([]);
    render(<ThemeProvider theme={createTheme()}><MemoryRouter>
      <ExceptionalFabricationOrderDialog open initialSource={source} molds={[{ codigo: 'M-1', nombre: 'Molde 1' }]}
        machines={[]} colors={[{ id: 1, nombre: 'Rojo' }]} recipes={[]} onClose={vi.fn()} onCreated={vi.fn()} />
    </MemoryRouter></ThemeProvider>);
    const withoutRoute = await screen.findByRole('button', { name: 'Continuar sin ruta para objetivo 1' });
    expect(screen.getByRole('button', { name: 'Crear OF en borrador' })).toBeDisabled();
    await user.click(withoutRoute);
    await user.type(screen.getByRole('spinbutton', { name: 'Horas de turno' }), '8');
    await user.click(screen.getByRole('combobox', { name: 'Proceso de fabricación' }));
    await user.click(screen.getByRole('option', { name: 'Inyección' }));
    await user.click(screen.getByRole('checkbox', { name: 'He revisado la fuente y la composición actual' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Crear OF en borrador' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Crear OF en borrador' }));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0][0].corridas[0]).not.toHaveProperty('operacion_ruta_revision_id');
  });

  it('propone la misma ruta sólo cuando el catálogo actual la devuelve para la salida exacta', async () => {
    const user = userEvent.setup();
    api.routes.mockResolvedValue([{
      id: 20, numero_revision: 4, estado: 'APROBADA', content_hash: 'current-route',
      operaciones: [{ id: 299, executor_kind: 'OP_OT', tipo: 'INYECCION', nombre: 'Inyectar salida', articulo_salida: { id: 99 } }],
    }]);
    const source = {
      id: 'of-source-current-route', codigo: 'OF-ROUTE-CURRENT', origen_demanda: 'EXCEPCIONAL', molde_id: 'M-1',
      snapshot_proceso: 'INYECCION', corridas: [{ color_produccion_id: 1, objetivo_neto_kg: 10,
        operacion_ruta_revision_id: 299,
        salidas: [{ articulo: { id: 99, clase: 'PIEZA_COLOR', pieza_id: 'p1' }, cantidad_por_ciclo_snapshot: 1, peso_unitario_snapshot_g: 10 }] }],
    };
    render(<ThemeProvider theme={createTheme()}><MemoryRouter>
      <ExceptionalFabricationOrderDialog open initialSource={source} molds={[{ codigo: 'M-1', nombre: 'Molde 1' }]}
        machines={[]} colors={[{ id: 1, nombre: 'Rojo' }]} recipes={[]} onClose={vi.fn()} onCreated={vi.fn()} />
    </MemoryRouter></ThemeProvider>);
    const route = await screen.findByRole('combobox', { name: 'Operación de ruta (opcional)' });
    await waitFor(() => expect(route).toHaveValue('Inyectar salida · Inyección'));
    await user.type(screen.getByRole('spinbutton', { name: 'Horas de turno' }), '8');
    await user.click(screen.getByRole('checkbox', { name: 'He revisado la fuente y la composición actual' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Crear OF en borrador' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Crear OF en borrador' }));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0][0].corridas[0]).toEqual(expect.objectContaining({ operacion_ruta_revision_id: 299 }));
  });

  it('conserva la receta fuente de cada objetivo al eliminar el primero y refrescar el catálogo', async () => {
    const user = userEvent.setup();
    api.recipes.mockResolvedValue([
      { id: 3, color_produccion_id: 1, producto_sku: null, nombre_variante: 'Jarra', revision: 2, estado: 'APROBADA' },
      { id: 4, color_produccion_id: 2, producto_sku: null, nombre_variante: 'Jarra', revision: 2, estado: 'APROBADA' },
    ]);
    const source = {
      id: 'of-source-two-runs', codigo: 'OF-TWO', origen_demanda: 'EXCEPCIONAL', molde_id: 'M-1',
      snapshot_proceso: 'INYECCION', corridas: [
        { color_produccion_id: 1, objetivo_neto_kg: 10, receta: { id: 1, color_produccion_id: 1, nombre_variante: 'Jarra', revision: 1 },
          salidas: [{ articulo: { id: 99, clase: 'PIEZA_COLOR', pieza_id: 'p1' }, cantidad_por_ciclo_snapshot: 1, peso_unitario_snapshot_g: 10 }] },
        { color_produccion_id: 2, objetivo_neto_kg: 12, receta: { id: 2, color_produccion_id: 2, nombre_variante: 'Jarra', revision: 1 },
          salidas: [{ articulo: { id: 99, clase: 'PIEZA_COLOR', pieza_id: 'p1' }, cantidad_por_ciclo_snapshot: 1, peso_unitario_snapshot_g: 10 }] },
      ],
    };
    api.mold.mockResolvedValue({ ...mold, formas: [{ ...mold.formas[0], variantes: [
      { color_produccion_id: 1, sku: 'SKU-1' },
      { color_produccion_id: 2, sku: 'SKU-1' },
    ] }] });
    api.colors.mockResolvedValue([{ id: 1, nombre: 'Rojo' }, { id: 2, nombre: 'Azul' }]);
    api.create.mockResolvedValue({ id: 'of-two-runs' });
    render(<ThemeProvider theme={createTheme()}><MemoryRouter>
      <ExceptionalFabricationOrderDialog open initialSource={source} molds={[{ codigo: 'M-1', nombre: 'Molde 1' }]}
        machines={[]} colors={[]} recipes={[]} onClose={vi.fn()} onCreated={vi.fn()} />
    </MemoryRouter></ThemeProvider>);
    await waitFor(() => expect(screen.getByText(/Receta vigente del objetivo 2/)).toBeVisible());
    await user.click(screen.getByRole('button', { name: 'Eliminar objetivo de color 1' }));
    expect(screen.getByRole('combobox', { name: 'Color del objetivo 1' })).toHaveValue('Azul');
    api.recipes.mockClear();
    await user.click(screen.getByRole('button', { name: 'Crear o editar aquí' }));
    expect(await screen.findByRole('heading', { name: 'Catálogo de recetas de color' })).toBeVisible();
    await waitFor(() => expect(api.recipes).toHaveBeenCalledWith({ color_produccion_id: 2, include_inactive: true }));
    await user.click(screen.getByRole('button', { name: 'Seleccionar' }));
    expect(screen.getByRole('combobox', { name: 'Formulación de material' })).toHaveValue('Jarra');
    await user.type(screen.getByRole('spinbutton', { name: 'Horas de turno' }), '8');
    await user.click(screen.getByRole('combobox', { name: 'Proceso de fabricación' }));
    await user.click(screen.getByRole('option', { name: 'Inyección' }));
    await user.click(screen.getByRole('checkbox', { name: 'He revisado la fuente y la composición actual' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Crear OF en borrador' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Crear OF en borrador' }));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0][0].corridas[0]).toEqual(expect.objectContaining({ color_produccion_id: 2, receta_revision_id: 4 }));
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
