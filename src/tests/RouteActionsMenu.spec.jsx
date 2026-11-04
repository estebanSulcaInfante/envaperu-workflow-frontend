import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import RouteActionsMenu from '../components/RouteActionsMenu';

const api = vi.hoisted(() => ({ getRoute: vi.fn() }));

vi.mock('../services/scmEngineeringApi', () => ({
  obtenerActorScm: () => 7,
  obtenerRutaScm: api.getRoute,
  mensajeErrorScm: (error, fallback) => error?.message || fallback,
}));

const selectedRoute = {
  operation_id: 602,
  route_revision_id: 77,
  route_revision_number: 4,
  route_content_hash: 'hash-77',
  route_state: 'APROBADA',
  operation: { id: 602, clave: 'OP-602', nombre: 'Operación seleccionada', tipo: 'INYECCION', executor_kind: 'OP_OT' },
  output_article: { id: 501, codigo: 'PC-501', clase: 'PIEZA_COLOR' },
  owner_route_target_article: { id: 506, codigo: 'WIP-506', clase: 'SUBENSAMBLE_WIP' },
};

describe('RouteActionsMenu · consumidor de lector por salida', () => {
  it('consulta la segunda página en servidor y abre la revisión exacta de la operación plana', async () => {
    const user = userEvent.setup();
    const onRouteSearch = vi.fn();
    const onRouteNextPage = vi.fn();
    const detail = {
      id: 77,
      numero_revision: 4,
      estado: 'APROBADA',
      content_hash: 'hash-77',
      articulo_objetivo_id: 506,
      operaciones: [
        { id: 602, nombre: 'Operación seleccionada', tipo: 'INYECCION', executor_kind: 'OP_OT', articulo_salida: { id: 501, codigo: 'PC-501' } },
        { id: 603, nombre: 'Segunda operación', tipo: 'SOPLADO', executor_kind: 'OP_OT', articulo_salida: { id: 501, codigo: 'PC-501' } },
      ],
    };
    api.getRoute.mockResolvedValue(detail);
    render(
      <ThemeProvider theme={createTheme()}>
        <RouteActionsMenu
          run={{ id: 'run-1', codigo: 'C01', salidas: [{ articulo: selectedRoute.output_article }] }}
          selectedRoute={selectedRoute}
          availableRoutes={[selectedRoute]}
          canViewRoutes
          canViewArticles
          routePageMeta={{ hasMore: true, nextCursor: 'cursor-2', total: 101 }}
          onRouteSearch={onRouteSearch}
          onRouteNextPage={onRouteNextPage}
        />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Acciones de ruta para C01' }));
    await user.click(screen.getByRole('menuitem', { name: 'Ver ruta' }));
    expect(await screen.findByRole('textbox', { name: 'Buscar en rutas de la salida' })).toBeVisible();
    await waitFor(() => expect(api.getRoute).toHaveBeenCalledWith(77, 7, expect.any(AbortSignal)));
    expect(await screen.findByText('Segunda operación')).toBeVisible();
    await user.type(screen.getByRole('textbox', { name: 'Buscar en rutas de la salida' }), 'segunda');
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(onRouteSearch).toHaveBeenCalledWith('segunda');
    await user.click(screen.getByRole('button', { name: 'Cargar más rutas' }));
    expect(onRouteNextPage).toHaveBeenCalledTimes(1);
  });

  it('descarta el GET exacto del actor anterior cuando cambia el contexto con el inspector abierto', async () => {
    const user = userEvent.setup();
    let resolveActorA;
    let resolveActorB;
    api.getRoute.mockImplementation((_revisionId, requestedActor) => (
      requestedActor === 1
        ? new Promise((resolve) => { resolveActorA = resolve; })
        : new Promise((resolve) => { resolveActorB = resolve; })
    ));
    const detailFor = (operationName) => ({
      id: 77,
      numero_revision: 4,
      estado: 'APROBADA',
      content_hash: 'hash-77',
      articulo_objetivo_id: 506,
      operaciones: [{
        id: 602,
        nombre: operationName,
        tipo: 'INYECCION',
        executor_kind: 'OP_OT',
        articulo_salida: { id: 501 },
      }],
    });
    const view = render(
      <ThemeProvider theme={createTheme()}>
        <RouteActionsMenu
          actorId={1}
          run={{ id: 'run-actor-stale', codigo: 'C01', salidas: [{ articulo: selectedRoute.output_article }] }}
          selectedRoute={selectedRoute}
          canViewRoutes
          canViewArticles
        />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Acciones de ruta para C01' }));
    await user.click(screen.getByRole('menuitem', { name: 'Ver ruta' }));
    await waitFor(() => expect(api.getRoute).toHaveBeenCalledWith(77, 1, expect.any(AbortSignal)));

    view.rerender(
      <ThemeProvider theme={createTheme()}>
        <RouteActionsMenu
          actorId={2}
          run={{ id: 'run-actor-stale', codigo: 'C01', salidas: [{ articulo: selectedRoute.output_article }] }}
          selectedRoute={selectedRoute}
          canViewRoutes
          canViewArticles
        />
      </ThemeProvider>,
    );
    await waitFor(() => expect(api.getRoute).toHaveBeenCalledWith(77, 2, expect.any(AbortSignal)));

    resolveActorA(detailFor('Operación del actor A'));
    resolveActorB(detailFor('Operación del actor B'));
    expect((await screen.findAllByText('Operación del actor B'))[0]).toBeVisible();
    expect(screen.queryByText('Operación del actor A')).not.toBeInTheDocument();
  });

  it.each([
    ['salida distinta', (base) => ({ ...base, operaciones: [{ ...base.operaciones[0], articulo_salida: { id: 999 } }] }), /salida física exacta/],
    ['owner distinto', (base) => ({ ...base, articulo_objetivo_id: 999 }), /dueño de ruta congelado/],
    ['revisión distinta', (base) => ({ ...base, id: 999 }), /revisión exacta solicitada/],
    ['hash distinto', (base) => ({ ...base, content_hash: 'b'.repeat(64) }), /hash de la revisión/],
    ['operación ausente', (base) => ({ ...base, operaciones: [] }), /no contiene la operación congelada/],
  ])('rechaza detalle mutable con metadata exacta inválida: %s', async (_label, makeDetail, expected) => {
    const user = userEvent.setup();
    const detail = {
      id: 77,
      numero_revision: 4,
      estado: 'APROBADA',
      content_hash: 'hash-77',
      articulo_objetivo_id: 506,
      operaciones: [{ id: 602, nombre: 'Operación seleccionada', tipo: 'INYECCION', executor_kind: 'OP_OT', articulo_salida: { id: 501 } }],
    };
    api.getRoute.mockResolvedValue(makeDetail(detail));
    render(
      <ThemeProvider theme={createTheme()}>
        <RouteActionsMenu
          run={{ id: 'run-invalid', codigo: 'C01', salidas: [{ articulo: selectedRoute.output_article }] }}
          selectedRoute={selectedRoute}
          canViewRoutes
          canViewArticles
        />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Acciones de ruta para C01' }));
    await user.click(screen.getByRole('menuitem', { name: 'Ver ruta' }));
    const panel = await screen.findByRole('dialog', { name: 'Ruta seleccionada' });
    expect((await within(panel).findAllByText(expected))[0]).toBeVisible();
    expect(panel).not.toHaveTextContent('Operaciones de la revisión');
  });

  it.each([
    ['salida distinta', (base) => ({ ...base, operaciones: [{ ...base.operaciones[0], articulo_salida: { id: 999 } }] }), /salida física exacta/],
    ['hash distinto', (base) => ({ ...base, content_hash: 'b'.repeat(64) }), /hash de la revisión/],
  ])('rechaza detalle congelado con metadata exacta inválida: %s', async (_label, makeDetail, expected) => {
    const user = userEvent.setup();
    const detail = {
      id: 77,
      numero_revision: 4,
      estado: 'APROBADA',
      content_hash: 'hash-77',
      articulo_objetivo_id: 506,
      operaciones: [{ id: 602, nombre: 'Operación seleccionada', tipo: 'INYECCION', executor_kind: 'OP_OT', articulo_salida: { id: 501 } }],
    };
    api.getRoute.mockResolvedValue(makeDetail(detail));
    render(
      <ThemeProvider theme={createTheme()}>
        <RouteActionsMenu
          run={{ id: 'run-frozen-invalid', codigo: 'C01', salidas: [{ articulo: selectedRoute.output_article }] }}
          selectedRoute={selectedRoute}
          canViewRoutes
          canViewArticles
          frozen
          frozenHash="hash-77"
        />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Acciones de ruta para C01' }));
    await user.click(screen.getByRole('menuitem', { name: 'Ver ruta' }));
    const panel = await screen.findByRole('dialog', { name: 'Ruta congelada' });
    expect((await within(panel).findAllByText(expected))[0]).toBeVisible();
    expect(panel).not.toHaveTextContent('Operaciones de la revisión');
  });
});
