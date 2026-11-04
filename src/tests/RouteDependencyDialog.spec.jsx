import { ThemeProvider, createTheme } from '@mui/material/styles';
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
}));

vi.mock('../services/scmEngineeringApi', () => ({
  obtenerActorScm: () => 7,
  listarRutasArticuloScm: api.routes,
  listarCentrosTrabajoScm: api.centers,
  crearCentroTrabajoScm: api.createCenter,
  crearRutaArticuloScm: api.createRoute,
  actualizarRutaScm: api.updateRoute,
  resolverArticulosScm: api.resolveArticles,
  mensajeErrorScm: (error, fallback) => error?.message || fallback,
}));

const target = { id: 5, codigo: 'PC-TAPA', nombre: 'Tapa roja', clase: 'PIEZA_COLOR' };
const renderDialog = (props = {}) => render(
  <ThemeProvider theme={createTheme()}>
    <RouteDependencyDialog
      open
      run={{ codigo: 'C01', color_nombre: 'Rojo' }}
      targetArticle={target}
      articleId={target.id}
      canView
      canAdmin
      onClose={vi.fn()}
      {...props}
    />
  </ThemeProvider>,
);

describe('RouteDependencyDialog contextual', () => {
  beforeEach(() => {
    api.routes.mockReset().mockResolvedValue([]);
    api.centers.mockReset().mockResolvedValue([{ id: 1, codigo: 'INY-01', nombre: 'Inyectora 1', tipo: 'INYECCION', activo: true }]);
    api.createCenter.mockReset().mockResolvedValue({ id: 2, codigo: 'INY-02', nombre: 'Inyectora 2', tipo: 'INYECCION', activo: true });
    api.createRoute.mockReset().mockResolvedValue({ id: 10, estado: 'BORRADOR' });
    api.resolveArticles.mockReset().mockResolvedValue({ items: [target] });
  });

  it('mantiene el contexto directo y permite crear un centro sin usar otra salida', async () => {
    const user = userEvent.setup();
    renderDialog();
    expect(await screen.findByText(/artículo directo PC-TAPA/)).toBeVisible();
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
