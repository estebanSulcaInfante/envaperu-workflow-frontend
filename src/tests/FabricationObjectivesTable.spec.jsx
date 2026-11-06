import { ThemeProvider, createTheme } from '@mui/material';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import FabricationObjectivesTable from '../components/FabricationObjectivesTable';
import FabricationProgressObjectivesTable from '../components/FabricationProgressObjectivesTable';

const api = vi.hoisted(() => ({ getRoute: vi.fn() }));

vi.mock('../services/scmEngineeringApi', () => ({
  obtenerActorScm: () => 7,
  obtenerRutaScm: api.getRoute,
  mensajeErrorScm: (error, fallback) => error?.message || fallback,
}));

const renderTable = (progress, { savedObjective = '100', draftObjective = savedObjective, state = 'LIBERADA', canEdit = false } = {}) => {
  const run = { id: 'r1', codigo: 'C01', color_nombre: 'Rojo', objetivo_neto_kg: savedObjective, salidas: [] };
  return render(
    <ThemeProvider theme={createTheme()}>
      <FabricationObjectivesTable
        order={{ id: 'of-1', estado: state, corridas: [run] }}
        form={{ corridas: [{ objetivo_neto_kg: draftObjective, receta_revision_id: '' }] }}
        selectedMold={null}
        recipes={[]}
        canEdit={canEdit}
        progress={progress}
        onChangeRun={vi.fn()}
        onChangeOutput={vi.fn()}
        onOpenRecipe={undefined}
        expandedRuns={{}}
        onToggleRun={vi.fn()}
      />
    </ThemeProvider>,
  );
};

describe('tabla de objetivos de OF', () => {
  it('expone acciones de ruta y conserva la revisión congelada aunque el catálogo tenga una revisión nueva', async () => {
    const user = userEvent.setup();
    const onRefreshRoutes = vi.fn();
    api.getRoute.mockResolvedValue({
      id: 20,
      numero_revision: 3,
      estado: 'APROBADA',
      content_hash: 'hash-congelado',
      operaciones: [{ id: 201, nombre: 'Inyectar tapa', tipo: 'INYECCION', executor_kind: 'OP_OT', articulo_salida: { id: 5 } }],
    });
    const run = {
      id: 'r-route', codigo: 'C01', color_nombre: 'Rojo', objetivo_neto_kg: '100',
      operacion_ruta_revision_id: 201,
      operacion_ruta_hash: 'hash-congelado',
      operacion_ruta: {
        id: 201, nombre: 'Inyectar tapa', tipo: 'INYECCION', executor_kind: 'OP_OT',
        ruta_revision_id: 20, ruta_numero_revision: 3, ruta_content_hash: 'hash-congelado',
        articulo_salida: { id: 5, nombre: 'Tapa roja', codigo: 'PC-TAPA' },
      },
      salidas: [{ id: 'out-1', articulo: { id: 5, nombre: 'Tapa roja', codigo: 'PC-TAPA' } }],
    };
    render(
      <ThemeProvider theme={createTheme()}>
        <FabricationObjectivesTable
          order={{ id: 'of-route', codigo: 'OF-ROUTE', estado: 'LIBERADA', corridas: [run] }}
          form={{ corridas: [{ objetivo_neto_kg: '100', receta_revision_id: '', operacion_ruta_revision_id: '201' }] }}
          selectedMold={null}
          recipes={[]}
          canEdit={false}
          progress={{ state: 'restricted', label: 'Avance restringido' }}
          onChangeRun={vi.fn()}
          onChangeOutput={vi.fn()}
          onOpenRecipe={undefined}
          expandedRuns={{}}
          onToggleRun={vi.fn()}
          routeCanView
          articleCanView
          routeCanAdmin
          onRefreshRoutes={onRefreshRoutes}
          routeOptionsByArticle={{ 5: [{
            id: 202, operacion_ruta_revision_id: 202, ruta_revision_id: 21,
            ruta_numero_revision: 4, ruta_hash: 'hash-nuevo', proceso: 'INYECCION',
            nombre: 'Inyectar tapa nueva', articulo_salida: { id: 5, nombre: 'Tapa roja', codigo: 'PC-TAPA' },
          }] }}
        />
      </ThemeProvider>,
    );

    const actionsButton = screen.getByRole('button', { name: 'Acciones de ruta para C01' });
    actionsButton.focus();
    await user.keyboard('{Enter}');
    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('C01 · Rojo')).toBeVisible();
    expect(within(menu).getByRole('menuitem', { name: 'Ver ruta' })).toBeEnabled();
    expect(within(menu).getByRole('menuitem', { name: 'Administrar' })).toBeEnabled();
    expect(within(menu).getByRole('menuitem', { name: 'Actualizar' })).toBeEnabled();
    await user.click(within(menu).getByRole('menuitem', { name: 'Ver ruta' }));
    expect(await screen.findByRole('dialog', { name: 'Ruta congelada' })).toHaveTextContent('Revisión 3');
    expect(screen.getByRole('dialog', { name: 'Ruta congelada' })).toHaveTextContent('C01 · Rojo');
    expect(screen.getByRole('dialog', { name: 'Ruta congelada' })).not.toHaveTextContent('Revisión 4');
    await user.click(screen.getByRole('button', { name: 'Cerrar detalle de ruta' }));
    await user.click(screen.getByRole('button', { name: 'Acciones de ruta para C01' }));
    await user.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Actualizar' }));
    expect(onRefreshRoutes).toHaveBeenCalledWith(run);
  });

  it('no muestra el hash de la ruta persistida cuando el borrador selecciona una operación nueva', async () => {
    const user = userEvent.setup();
    const run = {
      id: 'r-draft-route', codigo: 'C01', color_nombre: 'Rojo', objetivo_neto_kg: '100',
      operacion_ruta_revision_id: 77,
      operacion_ruta_hash: 'hash-revision-1',
      operacion_ruta: { id: 77, nombre: 'Ruta persistida', tipo: 'INYECCION', ruta_revision_id: 10, ruta_numero_revision: 1 },
      salidas: [{ id: 'out-draft-route', articulo: { id: 5, nombre: 'Tapa roja', codigo: 'PC-TAPA' } }],
    };
    const currentRoute = {
      operation_id: 88,
      route_revision_id: 11,
      route_revision_number: 2,
      route_content_hash: 'hash-revision-2',
      route_state: 'APROBADA',
      operation: { id: 88, executor_kind: 'OP_OT', tipo: 'INYECCION', nombre: 'Ruta nueva' },
      output_article: { id: 5, codigo: 'PC-TAPA', nombre: 'Tapa roja' },
      owner_route_target_article: { id: 506, codigo: 'WIP-506', nombre: 'WIP principal' },
    };
    api.getRoute.mockResolvedValue({
      id: 11,
      numero_revision: 2,
      estado: 'APROBADA',
      content_hash: 'hash-revision-2',
      articulo_objetivo_id: 506,
      operaciones: [{ id: 88, executor_kind: 'OP_OT', tipo: 'INYECCION', nombre: 'Ruta nueva', articulo_salida: { id: 5 } }],
    });
    render(
      <ThemeProvider theme={createTheme()}>
        <FabricationObjectivesTable
          order={{ id: 'of-draft-route', codigo: 'OF-DRAFT-ROUTE', estado: 'BORRADOR', corridas: [run] }}
          form={{ corridas: [{ objetivo_neto_kg: '100', receta_revision_id: '', operacion_ruta_revision_id: '88' }] }}
          selectedMold={null}
          recipes={[]}
          canEdit
          progress={{ state: 'restricted', label: 'Avance restringido' }}
          onChangeRun={vi.fn()}
          onChangeOutput={vi.fn()}
          onOpenRecipe={undefined}
          expandedRuns={{}}
          onToggleRun={vi.fn()}
          routeCanView
          articleCanView
          routeCanAdmin
          routeOptionsByArticle={{ 5: [currentRoute] }}
        />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Acciones de ruta para C01' }));
    await user.click(screen.getByRole('menuitem', { name: 'Ver ruta' }));
    const panel = await screen.findByRole('dialog', { name: 'Ruta seleccionada' });
    expect(panel).toHaveTextContent('Ruta nueva');
    expect(panel).toHaveTextContent('Revisión 2');
    expect(panel).not.toHaveTextContent('Hash congelado: hash-revision-1');
  });

  it('marca incompleto un snapshot liberado sin hash o sin operación exacta', async () => {
    const user = userEvent.setup();
    const run = {
      id: 'r-incomplete-route', codigo: 'C01', color_nombre: 'Rojo', objetivo_neto_kg: '100',
      operacion_ruta_revision_id: 77,
      operacion_ruta: { id: 77, nombre: 'Ruta parcial', tipo: 'INYECCION', ruta_revision_id: 10, ruta_numero_revision: 1 },
      salidas: [{ id: 'out-incomplete-route', articulo: { id: 5, nombre: 'Tapa roja', codigo: 'PC-TAPA' } }],
    };
    api.getRoute.mockResolvedValue({
      id: 10,
      numero_revision: 1,
      estado: 'APROBADA',
      content_hash: 'hash-otra',
      articulo_objetivo_id: 506,
      operaciones: [{ id: 77, executor_kind: 'OP_OT', tipo: 'INYECCION', nombre: 'Ruta parcial', articulo_salida: { id: 5 } }],
    });
    render(
      <ThemeProvider theme={createTheme()}>
        <FabricationObjectivesTable
          order={{ id: 'of-incomplete-route', codigo: 'OF-INCOMPLETE-ROUTE', estado: 'LIBERADA', corridas: [run] }}
          form={{ corridas: [{ objetivo_neto_kg: '100', receta_revision_id: '', operacion_ruta_revision_id: '77' }] }}
          selectedMold={null}
          recipes={[]}
          canEdit={false}
          progress={{ state: 'restricted', label: 'Avance restringido' }}
          onChangeRun={vi.fn()}
          onChangeOutput={vi.fn()}
          onOpenRecipe={undefined}
          expandedRuns={{}}
          onToggleRun={vi.fn()}
          routeCanView
          articleCanView
          routeCanAdmin
          routeOptionsByArticle={{ 5: [{
            operation_id: 77,
            route_revision_id: 10,
            route_revision_number: 1,
            route_content_hash: 'hash-otra',
            route_state: 'APROBADA',
            operation: { id: 77, executor_kind: 'OP_OT', tipo: 'INYECCION', nombre: 'Ruta parcial' },
            output_article: { id: 5 },
            owner_route_target_article: { id: 506 },
          }] }}
        />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Acciones de ruta para C01' }));
    await user.click(screen.getByRole('menuitem', { name: 'Ver ruta' }));
    const panel = await screen.findByRole('dialog', { name: 'Ruta congelada' });
    expect(panel).toHaveTextContent(/Información incompleta/);
    expect(panel).not.toHaveTextContent('Operaciones de la revisión');
  });

  it('busca y pagina operaciones en servidor antes de seleccionar y conserva el binding de la segunda página', async () => {
    const user = userEvent.setup();
    const onChangeRun = vi.fn();
    const onSearchRoutes = vi.fn();
    const onLoadMoreRoutes = vi.fn();
    const run = {
      id: 'r-route-page', codigo: 'C01', color_nombre: 'Rojo', objetivo_neto_kg: '10',
      salidas: [{ id: 'out-route-page', articulo: { id: 501, codigo: 'PC-501', nombre: 'Pieza color' } }],
    };
    const operationA = {
      id: 601, operation_id: 601, operacion_ruta_revision_id: 601, route_revision_id: 77, ruta_revision_id: 77,
      route_revision_number: 4, route_content_hash: 'a'.repeat(64), route_state: 'APROBADA',
      executor_kind: 'OP_OT', tipo: 'INYECCION', nombre: 'Operación A',
      output_article: { id: 501, codigo: 'PC-501', nombre: 'Pieza color' },
      owner_route_target_article: { id: 506, codigo: 'WIP-506', nombre: 'WIP principal' },
    };
    const operationB = {
      ...operationA,
      id: 602,
      operation_id: 602,
      operacion_ruta_revision_id: 602,
      nombre: 'Operación B',
      owner_route_target_article: { id: 507, codigo: 'WIP-507', nombre: 'WIP alterno' },
    };
    const renderPage = (options, hasMore = true) => render(
      <ThemeProvider theme={createTheme()}>
        <FabricationObjectivesTable
          order={{ id: 'of-route-page', codigo: 'OF-PAGE', estado: 'BORRADOR', corridas: [run] }}
          form={{ corridas: [{ objetivo_neto_kg: '10', receta_revision_id: '' }] }}
          selectedMold={null} recipes={[]} canEdit
          progress={{ state: 'restricted', label: 'Avance restringido' }}
          onChangeRun={onChangeRun} onChangeOutput={vi.fn()} onOpenRecipe={undefined}
          expandedRuns={{}} onToggleRun={vi.fn()}
          routeCanView articleCanView routeCanAdmin
          routeOptionsByArticle={{ 501: options }}
          routePageMetaByArticle={{ 501: { hasMore } }}
          onSearchRoutes={onSearchRoutes}
          onLoadMoreRoutes={onLoadMoreRoutes}
        />
      </ThemeProvider>,
    );
    const view = renderPage([operationA]);
    const selector = screen.getByRole('combobox', { name: 'Operación de ruta (opcional)' });
    await user.click(selector);
    expect(await screen.findByRole('option', { name: /Operación A/ })).toBeVisible();
    await user.type(selector, 'Operación B');
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(onSearchRoutes).toHaveBeenCalledWith(run, 'Operación B');
    await user.click(screen.getByRole('option', { name: 'Cargar más resultados' }));
    expect(onLoadMoreRoutes).toHaveBeenCalledWith(run);
    view.rerender(
      <ThemeProvider theme={createTheme()}>
        <FabricationObjectivesTable
          order={{ id: 'of-route-page', codigo: 'OF-PAGE', estado: 'BORRADOR', corridas: [run] }}
          form={{ corridas: [{ objetivo_neto_kg: '10', receta_revision_id: '' }] }}
          selectedMold={null} recipes={[]} canEdit
          progress={{ state: 'restricted', label: 'Avance restringido' }}
          onChangeRun={onChangeRun} onChangeOutput={vi.fn()} onOpenRecipe={undefined}
          expandedRuns={{}} onToggleRun={vi.fn()}
          routeCanView articleCanView routeCanAdmin
          routeOptionsByArticle={{ 501: [operationA, operationB] }}
          routePageMetaByArticle={{ 501: { hasMore: false } }}
          onSearchRoutes={onSearchRoutes}
          onLoadMoreRoutes={onLoadMoreRoutes}
        />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole('combobox', { name: 'Operación de ruta (opcional)' }));
    const secondPageOption = await screen.findByRole('option', { name: /Operación B/ });
    expect(secondPageOption).toHaveTextContent('WIP alterno');
    expect(secondPageOption).toHaveTextContent('WIP-507');
    await user.click(secondPageOption);
    expect(onChangeRun).toHaveBeenCalledWith(0, { operacion_ruta_revision_id: 602 });
  });

  it.each([
    ['capabilities explícitas', { articleCanAdmin: true, structureCanView: true, structureCanAdmin: true, canRouteApprove: true, canRoutePublish: true, canStructureApprove: true, canStructurePublish: true }, false],
    ['sin capacidades de entidades', {}, true],
  ])('propaga %s desde la tabla y no suma permisos por entrar desde OF', async (_label, caps, expectDisabled) => {
    const user = userEvent.setup();
    const run = {
      id: 'r-capabilities', codigo: 'C01', color_nombre: 'Rojo', objetivo_neto_kg: '10',
      operacion_ruta_revision_id: 201,
      operacion_ruta: { id: 201, nombre: 'Ruta owner', tipo: 'INYECCION', ruta_revision_id: 20, ruta_numero_revision: 3, ruta_content_hash: 'hash', articulo_salida: { id: 5, codigo: 'PC-TAPA', nombre: 'Tapa', clase: 'PIEZA_COLOR' } },
      salidas: [{ id: 'out', articulo: { id: 5, codigo: 'PC-TAPA', nombre: 'Tapa', clase: 'PIEZA_COLOR' } }],
    };
    render(
      <ThemeProvider theme={createTheme()}>
        <FabricationObjectivesTable
          order={{ id: 'of-capabilities', codigo: 'OF-CAP', estado: 'BORRADOR', corridas: [run] }}
          form={{ corridas: [{ objetivo_neto_kg: '10', operacion_ruta_revision_id: '' }] }}
          selectedMold={null} recipes={[]} canEdit={false}
          progress={{ state: 'restricted', label: 'Avance restringido' }}
          onChangeRun={vi.fn()} onChangeOutput={vi.fn()} onOpenRecipe={undefined}
          expandedRuns={{}} onToggleRun={vi.fn()}
          routeCanView articleCanView routeCanAdmin
          {...caps}
          routeOptionsByArticle={{ 5: [{ id: 201, operacion_ruta_revision_id: 201, ruta_revision_id: 20, ruta_numero_revision: 3, ruta_hash: 'hash', estado: 'APROBADA', articulo_salida: { id: 5, codigo: 'PC-TAPA', nombre: 'Tapa' } }] }}
        />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Acciones de ruta para C01' }));
    await user.click(screen.getByRole('menuitem', { name: 'Administrar' }));
    const ownerButton = await screen.findByRole('button', { name: 'Preparar ruta para otro artículo' });
    if (expectDisabled) expect(ownerButton).toBeDisabled();
    else expect(ownerButton).toBeEnabled();
  });

  it('espera la primera respuesta diferida y conserva el snapshot durante refresh', () => {
    const order = { id: 'of-deferred', codigo: 'OF-DEFERRED', corridas: [{ id: 'r-deferred', codigo: 'C01', objetivo_neto_kg: '10', salidas: [] }] };
    const progress = [{ corrida_id: 'r-deferred', of: 'OF-DEFERRED', corrida: 'C01', objetivo_neto_kg: '10', kg_finalizados_efectivos: '4', coverage: { estado: 'COMPLETA' } }];
    const view = render(
      <ThemeProvider theme={createTheme()}>
        <FabricationProgressObjectivesTable items={[]} orders={[order]} loading />
      </ThemeProvider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Cargando objetivos');
    expect(screen.queryByText('OF-DEFERRED')).not.toBeInTheDocument();

    view.rerender(
      <ThemeProvider theme={createTheme()}>
        <FabricationProgressObjectivesTable items={progress} orders={[order]} loading />
      </ThemeProvider>,
    );
    expect(screen.getByText('OF-DEFERRED')).toBeVisible();
    expect(screen.getByTestId('fabrication-objective-comparison').querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('muestra Sin pesajes sin fabricar cero/meta cuando no hay mangas ni pesos', () => {
    renderTable({
      state: 'incomplete',
      label: 'Sin pesajes',
      rows: [{
        run: { id: 'r1', objetivo_neto_kg: '100' },
        progress: {
          corrida_id: 'r1', objetivo_neto_kg: '100', kg_medidos_efectivos: null,
          kg_finalizados_efectivos: null, kg_medidos_en_abiertas: '0',
          coverage: { estado: 'COMPLETA' }, mangas: { total: 0 },
        },
      }],
    });

    expect(screen.getByText('Sin pesajes')).toBeVisible();
    expect(screen.queryByText(/0\.00 \/ 100\.00 kg/)).not.toBeInTheDocument();
    expect(screen.queryByText(/100\.0%/)).not.toBeInTheDocument();
  });

  it('distingue meta nula de cero cuando el usuario edita un objetivo legado', () => {
    renderTable({ state: 'restricted', label: 'Avance restringido' }, {
      savedObjective: null, draftObjective: '10', state: 'BORRADOR', canEdit: true,
    });

    expect(screen.getByText(/Meta aún no guardada/)).toBeVisible();
    expect(screen.queryByText(/0\.00 kg guardados/)).not.toBeInTheDocument();
  });

  it('muestra el historial de tramo incompleto sin ocultar el porcentaje de OF', () => {
    renderTable({
      state: 'incomplete',
      label: 'Avance parcial',
      rows: [{
        run: { id: 'r1', objetivo_neto_kg: '100' },
        progress: {
          corrida_id: 'r1', objetivo_neto_kg: '100', kg_medidos_efectivos: 45,
          kg_finalizados_efectivos: 40, kg_medidos_en_abiertas: 5,
          motivos_atribucion: ['TRAMO_INICIO_NO_REGISTRADO'],
          coverage: { estado: 'COMPLETA', motivos: [] },
          mangas: { total: 2, conocidas: 2 },
        },
      }],
    });

    expect(screen.getByText(/45\.00% · meta guardada/)).toBeVisible();
    expect(screen.getByTestId('attribution-warning')).toHaveTextContent('Historial del tramo incompleto: peso incluido; inicio del tramo sin registrar.');
    expect(screen.queryByText('TRAMO_INICIO_NO_REGISTRADO')).not.toBeInTheDocument();
  });
});
