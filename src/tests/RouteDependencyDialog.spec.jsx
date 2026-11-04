import { ThemeProvider, createTheme } from '@mui/material/styles';
import { FeedbackProvider } from '../context/FeedbackContext';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RouteDependencyDialog from '../components/RouteDependencyDialog';

const api = vi.hoisted(() => ({
  routes: vi.fn(),
  centers: vi.fn(),
  createCenter: vi.fn(),
  createRoute: vi.fn(),
  updateRoute: vi.fn(),
  resolveArticles: vi.fn(),
  articlePage: vi.fn(),
  createWip: vi.fn(),
  structures: vi.fn(),
  createStructure: vi.fn(),
}));

vi.mock('../services/scmEngineeringApi', () => ({
  obtenerActorScm: () => 7,
  listarArticulosPaginaScm: api.articlePage,
  obtenerRutaScm: undefined,
  listarRutasArticuloScm: api.routes,
  listarCentrosTrabajoScm: api.centers,
  crearCentroTrabajoScm: api.createCenter,
  crearRutaArticuloScm: api.createRoute,
  actualizarRutaScm: api.updateRoute,
  crearArticuloWipScm: api.createWip,
  listarEstructurasScm: api.structures,
  crearEstructuraScm: api.createStructure,
  hidratarEstructurasScm: () => Promise.resolve({ approved: [], referenced: [], missing_article_ids: [], missing_revision_ids: [] }),
  resolverArticulosScm: api.resolveArticles,
  mensajeErrorScm: (error, fallback) => error?.message || fallback,
}));

const target = { id: 5, codigo: 'PC-TAPA', nombre: 'Tapa roja', clase: 'PIEZA_COLOR' };
const renderDialog = (props = {}) => render(
  <ThemeProvider theme={createTheme()}>
    {props.withFeedback ? (
      <FeedbackProvider>
        <RouteDependencyDialog
          open
          run={{ codigo: 'C01', color_nombre: 'Rojo' }}
          targetArticle={target}
          articleId={target.id}
          canView
          canAdmin
          articleCanAdmin={true}
          structureCanView={true}
          structureCanAdmin={true}
          onClose={vi.fn()}
          {...props}
        />
      </FeedbackProvider>
    ) : (
      <RouteDependencyDialog
        open
        run={{ codigo: 'C01', color_nombre: 'Rojo' }}
        targetArticle={target}
        articleId={target.id}
        canView
        canAdmin
        articleCanAdmin={true}
        structureCanView={true}
        structureCanAdmin={true}
        onClose={vi.fn()}
        {...props}
      />
    )}
  </ThemeProvider>,
);

describe('RouteDependencyDialog contextual', () => {
  beforeEach(() => {
    api.routes.mockReset().mockResolvedValue([]);
    api.centers.mockReset().mockResolvedValue([{ id: 1, codigo: 'INY-01', nombre: 'Inyectora 1', tipo: 'INYECCION', activo: true }]);
    api.createCenter.mockReset().mockResolvedValue({ id: 2, codigo: 'INY-02', nombre: 'Inyectora 2', tipo: 'INYECCION', activo: true });
    api.createRoute.mockReset().mockResolvedValue({ id: 10, estado: 'BORRADOR' });
    api.resolveArticles.mockReset().mockResolvedValue({ items: [target] });
    api.articlePage.mockReset().mockResolvedValue({ items: [], has_more: false, next_cursor: null });
    api.createWip.mockReset().mockResolvedValue({ id: 506, codigo: 'WIP-506', nombre: 'WIP nuevo', clase: 'SUBENSAMBLE_WIP', activo: true });
    api.structures.mockReset().mockResolvedValue([]);
    api.createStructure.mockReset().mockResolvedValue({ id: 33, estado: 'BORRADOR', numero_revision: 1, componentes: [] });
  });

  it('mantiene el contexto directo y permite crear un centro sin usar otra salida', async () => {
    const user = userEvent.setup();
    renderDialog();
    expect(await screen.findByText(/artículo directo .*PC-TAPA/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Nueva ruta' }));
    await user.click(screen.getByRole('combobox', { name: 'Tipo de operación' }));
    await user.click(screen.getByRole('option', { name: 'INYECCIÓN' }));
    await user.click(screen.getByRole('button', { name: 'Crear centro aquí' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre del centro' }), 'Inyectora 2');
    await user.click(screen.getByRole('button', { name: 'Crear y seleccionar' }));
    await waitFor(() => expect(api.createCenter).toHaveBeenCalledWith({ nombre: 'Inyectora 2', tipo: 'INYECCION' }));
    expect(screen.getByText(/Centro confirmado y seleccionado/)).toBeVisible();
  });

  it('bloquea un propietario explícito WIP y no consulta rutas', async () => {
    renderDialog({ targetArticle: { ...target, clase: 'SUBENSAMBLE_WIP' } });
    expect(await screen.findByText(/Solo se admite una Pieza-color directa/)).toBeVisible();
    expect(api.routes).not.toHaveBeenCalled();
  });

  it('busca y selecciona un owner WIP/PT remoto sin sustituir la salida PC de la OF', async () => {
    const user = userEvent.setup();
    api.articlePage.mockResolvedValue({
      items: [{ id: 506, codigo: 'WIP-506', nombre: 'Subensamble remoto', clase: 'SUBENSAMBLE_WIP', activo: true }],
      has_more: false,
      next_cursor: null,
    });
    renderDialog();
    expect(await screen.findByRole('button', { name: /Usar .*WIP-506.*como dueño/i })).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Usar .*WIP-506.*como dueño/i }));
    expect(await screen.findByText(/Propietario explícito: .*WIP-506/)).toBeVisible();
    expect(screen.getByText(/salida física de la OF sigue siendo .*PC-TAPA/)).toBeVisible();
    await waitFor(() => expect(api.routes).toHaveBeenCalledWith(506, 7, expect.any(AbortSignal)));
    expect(api.articlePage).toHaveBeenCalledWith(7, expect.objectContaining({
      clases: 'SUBENSAMBLE_WIP,PRODUCTO_TERMINADO',
      limite: 25,
    }), expect.any(AbortSignal));
  });

  it('mantiene editable y enfocado el buscador de owner mientras el GET permite otra consulta', async () => {
    const user = userEvent.setup();
    const pending = [];
    api.articlePage.mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
    renderDialog();
    const ownerSearch = screen.getByRole('textbox', { name: 'Buscar dueño WIP o PT' });

    await waitFor(() => expect(api.articlePage).toHaveBeenCalledTimes(1), { timeout: 1000 });
    expect(ownerSearch).not.toBeDisabled();
    await user.click(ownerSearch);
    await user.type(ownerSearch, 'WIP');
    await waitFor(() => expect(api.articlePage).toHaveBeenCalledTimes(2), { timeout: 1000 });
    expect(api.articlePage.mock.calls[1][1]).toEqual(expect.objectContaining({ q: 'WIP', limite: 25 }));
    expect(ownerSearch).not.toBeDisabled();
    expect(ownerSearch).toHaveFocus();

    pending[0]?.({ items: [], has_more: false, next_cursor: null });
    pending[1]?.({ items: [], has_more: false, next_cursor: null });
  });

  it('conserva el error y la recuperación contextual al cerrar el snackbar compartido', async () => {
    const user = userEvent.setup();
    api.routes.mockRejectedValueOnce(new Error('GET rutas falló')).mockResolvedValue([]);
    renderDialog({ withFeedback: true });

    const messages = await screen.findAllByText('GET rutas falló');
    expect(messages.length).toBeGreaterThanOrEqual(2);
    await user.click(screen.getByRole('button', { name: 'Cerrar notificación' }));
    expect(screen.getByText('GET rutas falló')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(api.routes).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('GET rutas falló')).not.toBeInTheDocument());
  });

  it('confirma un WIP owner como maestro independiente y vuelve al frame de ruta', async () => {
    const user = userEvent.setup();
    api.createWip.mockResolvedValue({ id: 506, codigo: 'WIP-506', nombre: 'WIP preparado', clase: 'SUBENSAMBLE_WIP', activo: true });
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Preparar ruta para otro artículo' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre del WIP' }), 'WIP preparado');
    await user.click(screen.getByRole('button', { name: 'Confirmar WIP' }));
    await waitFor(() => expect(api.createWip).toHaveBeenCalledWith({
      nombre: 'WIP preparado', descripcion: null, requiere_calidad: false,
    }));
    expect(screen.getByText(/dueño de ruta .*WIP-506/)).toBeVisible();
    expect(screen.getByText(/salida OF .*PC-TAPA/)).toBeVisible();
  });

  it('exige una salida explícita cuando la corrida tiene múltiples propietarios directos', async () => {
    const user = userEvent.setup();
    renderDialog({
      targetArticle: null,
      articleId: undefined,
      run: {
        codigo: 'C-MULTI',
        salidas: [{ articulo: { id: 6, codigo: 'PC-A', clase: 'PIEZA_COLOR' } }, { articulo: { id: 7, codigo: 'PC-B', clase: 'PIEZA_COLOR' } }],
      },
    });
    expect(await screen.findByText(/Selecciona explícitamente la salida Pieza-color/)).toBeVisible();
    expect(api.routes).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'PC-B' }));
    await waitFor(() => expect(api.routes).toHaveBeenCalledWith(7, 7, expect.any(AbortSignal)));
  });

  it('resuelve la clase ausente antes de consultar y restringe un propietario no Pieza-color', async () => {
    api.resolveArticles.mockResolvedValue({ items: [{ id: 5, codigo: 'WIP-5', clase: 'SUBENSAMBLE_WIP' }] });
    renderDialog({ targetArticle: { id: 5, codigo: 'WIP-5' } });
    expect(await screen.findByText(/Solo se admite una Pieza-color directa/)).toBeVisible();
    expect(api.routes).not.toHaveBeenCalled();
    expect(api.resolveArticles).toHaveBeenCalledWith(7, [5], expect.any(AbortSignal));
  });

  it('adapta el alta de centro al tipo terminal de la operación y no deja PREARMADO incompatible', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Nueva ruta' }));
    await user.click(screen.getByRole('combobox', { name: 'Tipo de operación' }));
    await user.click(screen.getByRole('option', { name: 'INYECCIÓN' }));
    await user.click(screen.getByRole('button', { name: 'Crear centro aquí' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre del centro' }), 'Inyectora terminal');
    await user.click(screen.getByRole('button', { name: 'Crear y seleccionar' }));
    await waitFor(() => expect(api.createCenter).toHaveBeenCalledWith({ nombre: 'Inyectora terminal', tipo: 'INYECCION' }));
  });

  it('bloquea un alta de centro incierta sin repetir el POST', async () => {
    const user = userEvent.setup();
    api.createCenter.mockRejectedValue(Object.assign(new Error('timeout'), { status: 500 }));
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Nueva ruta' }));
    await user.click(screen.getByRole('combobox', { name: 'Tipo de operación' }));
    await user.click(screen.getByRole('option', { name: 'INYECCIÓN' }));
    await user.click(screen.getByRole('button', { name: 'Crear centro aquí' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre del centro' }), 'Centro incierto');
    const createButton = screen.getByRole('button', { name: 'Crear y seleccionar' });
    await user.click(createButton);
    expect(await screen.findByText(/Alta incierta/)).toBeVisible();
    expect(createButton).toBeDisabled();
    expect(api.createCenter).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['otro tipo', [{ id: 8, nombre: 'Centro incierto', tipo: 'SOPLADO' }], false],
    ['homónimos', [{ id: 8, nombre: 'Centro incierto', tipo: 'INYECCION' }, { id: 9, nombre: 'Centro incierto', tipo: 'INYECCION' }], false],
    ['único compatible', [{ id: 8, nombre: 'Centro incierto', tipo: 'INYECCION' }], true],
  ])('reconcilia sólo un centro inequívoco: %s', async (_case, results, canAdopt) => {
    const user = userEvent.setup();
    api.createCenter.mockRejectedValue(new Error('Respuesta perdida'));
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Nueva ruta' }));
    await user.click(screen.getByRole('combobox', { name: 'Tipo de operación' }));
    await user.click(screen.getByRole('option', { name: 'INYECCIÓN' }));
    await user.click(screen.getByRole('button', { name: 'Crear centro aquí' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre del centro' }), 'Centro incierto');
    await user.click(screen.getByRole('button', { name: 'Crear y seleccionar' }));
    await screen.findByText(/Alta incierta/);
    api.centers.mockResolvedValue(results);
    await user.click(screen.getByRole('button', { name: 'Consultar catálogo' }));
    await waitFor(() => expect(api.centers).toHaveBeenCalledTimes(2));
    if (canAdopt) {
      await user.click(await screen.findByRole('button', { name: 'Adoptar encontrado' }));
      expect(await screen.findByText(/Centro existente adoptado/)).toBeVisible();
    } else {
      expect(screen.queryByRole('button', { name: 'Adoptar encontrado' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Crear y seleccionar' })).toBeDisabled();
    }
    expect(api.createCenter).toHaveBeenCalledTimes(1);
  });

  it('Escape y el pie del diálogo respetan el borrador sin llamar al cierre del host', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog({ onClose });
    await user.click(screen.getByRole('button', { name: 'Nueva ruta' }));
    await user.type(screen.getByRole('textbox', { name: 'Notas de revisión' }), 'No perder este borrador');
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    expect(await screen.findByText(/Hay un borrador de ruta sin guardar/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
    await user.click(screen.getByRole('button', { name: 'Volver a OF' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Notas de revisión' })).toHaveValue('No perder este borrador');
  });
});
