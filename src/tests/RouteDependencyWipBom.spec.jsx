import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RouteDependencyDialog from '../components/RouteDependencyDialog';
import { FeedbackProvider } from '../context/FeedbackContext';

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
  updateStructure: vi.fn(),
  hydrateStructures: vi.fn(),
  approveStructure: vi.fn(),
  publishStructure: vi.fn(),
  sendStructure: vi.fn(),
  rejectStructure: vi.fn(),
  discardStructure: vi.fn(),
  retireStructure: vi.fn(),
  approveRoute: vi.fn(),
  publishRoute: vi.fn(),
  retireRoute: vi.fn(),
  getRoute: vi.fn(),
}));

vi.mock('../services/scmEngineeringApi', () => ({
  obtenerActorScm: () => 7,
  listarArticulosPaginaScm: api.articlePage,
  obtenerRutaScm: api.getRoute,
  listarRutasArticuloScm: api.routes,
  listarCentrosTrabajoScm: api.centers,
  crearCentroTrabajoScm: api.createCenter,
  crearRutaArticuloScm: api.createRoute,
  actualizarRutaScm: api.updateRoute,
  crearArticuloWipScm: api.createWip,
  listarEstructurasScm: api.structures,
  crearEstructuraScm: api.createStructure,
  actualizarEstructuraScm: api.updateStructure,
  hidratarEstructurasScm: api.hydrateStructures,
  resolverArticulosScm: api.resolveArticles,
  enviarEstructuraScm: api.sendStructure,
  aprobarEstructuraScm: api.approveStructure,
  publicarEstructuraScm: api.publishStructure,
  rechazarEstructuraScm: api.rejectStructure,
  descartarEstructuraScm: api.discardStructure,
  retirarEstructuraScm: api.retireStructure,
  aprobarRutaScm: api.approveRoute,
  publicarRutaScm: api.publishRoute,
  retirarRutaScm: api.retireRoute,
  mensajeErrorScm: (error, fallback) => error?.message || fallback,
}));

const target = { id: 5, codigo: 'PC-TAPA', nombre: 'Tapa roja', clase: 'PIEZA_COLOR' };
const component = { id: 506, codigo: 'WIP-506', nombre: 'Subensamble', clase: 'SUBENSAMBLE_WIP', activo: true };
const child = { id: 507, codigo: 'WIP-507', nombre: 'Hijo', clase: 'SUBENSAMBLE_WIP', activo: true };
const grandchild = { id: 508, codigo: 'WIP-508', nombre: 'Nieto', clase: 'SUBENSAMBLE_WIP', activo: true };
const routeHashCurrent = 'a'.repeat(64);
const routeHashRetired = 'b'.repeat(64);
const routeDraft = {
  id: 21,
  nombre: 'Ruta base',
  estado: 'BORRADOR',
  numero_revision: 1,
  version: 2,
  content_hash: null,
  articulo_objetivo_id: target.id,
  operaciones: [
    {
      id: 1,
      clave: 'OP1',
      secuencia_visible: '1',
      nombre: 'Prearmado base',
      tipo: 'PREARMADO',
      executor_kind: 'ORDEN_OPERACION',
      centro_trabajo_id: 1,
      articulo_salida_id: component.id,
      articulo_salida: component,
      estructura_revision_id: '',
    },
    {
      id: 2,
      clave: 'OP2',
      secuencia_visible: '2',
      nombre: 'Inyección final',
      tipo: 'INYECCION',
      executor_kind: 'OP_OT',
      centro_trabajo_id: 1,
      articulo_salida_id: target.id,
      estructura_revision_id: '',
    },
  ],
};

const dialog = (props = {}) => {
  const { withFeedback = false, ...dialogProps } = props;
  const content = (
    <RouteDependencyDialog
      open
      run={{ codigo: 'C01', color_nombre: 'Rojo' }}
      targetArticle={target}
      articleId={target.id}
      canView
      canAdmin
      routeCanView
      routeCanAdmin
      structureCanView
      structureCanAdmin
      articleCanAdmin
      onClose={vi.fn()}
      {...dialogProps}
    />
  );
  return (
    <ThemeProvider theme={createTheme()}>
      {withFeedback ? <FeedbackProvider>{content}</FeedbackProvider> : content}
    </ThemeProvider>
  );
};

const renderDialog = (props = {}) => render(dialog(props));

let articleFrame = 'parent';

const openBom = async (user) => {
  await user.click(await screen.findByRole('button', { name: 'Abrir borrador' }));
  await user.click(await screen.findByRole('button', { name: 'Ir a Estructuras BOM' }));
  await screen.findByText(new RegExp(`BOM de .*${component.codigo}`));
};

beforeEach(() => {
  articleFrame = 'parent';
  api.routes.mockReset().mockResolvedValue([routeDraft]);
  api.centers.mockReset().mockResolvedValue([{ id: 1, codigo: 'INY-01', nombre: 'Inyectora', tipo: 'INYECCION', activo: true }]);
  api.createCenter.mockReset().mockResolvedValue({ id: 2, codigo: 'INY-02', nombre: 'Nueva', tipo: 'INYECCION', activo: true });
  api.createRoute.mockReset().mockResolvedValue(routeDraft);
  api.updateRoute.mockReset().mockResolvedValue(routeDraft);
  api.getRoute.mockReset().mockResolvedValue(routeDraft);
  api.resolveArticles.mockReset().mockImplementation(async (_actor, ids) => ({
    items: ids.map(Number).includes(child.id) ? [component, child] : [component],
  }));
  api.articlePage.mockReset().mockImplementation(async () => ({
    items: articleFrame === 'child' ? [child, grandchild] : [component, child],
    has_more: false,
    next_cursor: null,
  }));
  api.createWip.mockReset().mockResolvedValue(component);
  api.structures.mockReset().mockResolvedValue([]);
  api.createStructure.mockReset().mockResolvedValue({ id: 31, estado: 'BORRADOR', numero_revision: 1, componentes: [] });
  api.updateStructure.mockReset().mockResolvedValue({ id: 31, estado: 'BORRADOR', numero_revision: 1, componentes: [] });
  api.hydrateStructures.mockReset().mockResolvedValue({ approved: [], referenced: [], missing_article_ids: [], missing_revision_ids: [] });
  api.sendStructure.mockReset().mockResolvedValue({ id: 31, estado: 'PENDIENTE_APROBACION' });
  api.approveStructure.mockReset().mockResolvedValue({ id: 31, estado: 'APROBADA' });
  api.publishStructure.mockReset().mockResolvedValue({ id: 31, estado: 'PUBLICADA' });
  api.rejectStructure.mockReset().mockResolvedValue({ id: 31, estado: 'RECHAZADA' });
  api.discardStructure.mockReset().mockResolvedValue({ id: 31, estado: 'DESCARTADA' });
  api.retireStructure.mockReset().mockResolvedValue({ id: 31, estado: 'RETIRADA' });
  api.approveRoute.mockReset().mockResolvedValue({ ...routeDraft, estado: 'APROBADA' });
  api.publishRoute.mockReset().mockResolvedValue({ ...routeDraft, estado: 'PUBLICADA' });
  api.retireRoute.mockReset().mockResolvedValue({ ...routeDraft, estado: 'RETIRADA' });
});

describe('RouteDependencyDialog · WIP/BOM P1', () => {
  it('decodifica approved y referenced de hidratación y encuentra la BOM aprobada del hijo fuera de la página', async () => {
    const user = userEvent.setup();
    const parentBom = {
      id: 34,
      articulo_resultado_id: component.id,
      numero_revision: 1,
      estado: 'APROBADA',
      componentes: [{ articulo_id: child.id, cantidad: '1', merma_tecnica_pct: '0', articulo: child }],
    };
    const childBom = {
      id: 32,
      articulo_resultado_id: child.id,
      numero_revision: 2,
      estado: 'APROBADA',
      componentes: [{ articulo_id: grandchild.id, cantidad: '1', merma_tecnica_pct: '0', articulo: grandchild }],
    };
    api.structures.mockResolvedValue([parentBom]);
    api.hydrateStructures.mockResolvedValue({
      approved: [childBom],
      referenced: [{ ...childBom, id: '32' }],
      missing_article_ids: [501],
      missing_revision_ids: [],
    });
    renderDialog();
    await openBom(user);
    await waitFor(() => expect(api.hydrateStructures).toHaveBeenCalledWith(
      7,
      { articuloIds: [child.id] },
      expect.any(AbortSignal),
    ));
    expect(screen.getAllByRole('button', { name: 'Ver revisión' })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Ver revisión' }));
    expect(await screen.findByText(/Composición vigente de WIP-507/)).toBeVisible();
    expect(screen.queryByText(/No se encontró una BOM aprobada para WIP-507/)).not.toBeInTheDocument();
  });

  it('conserva BOM padre e hija sucias al pedir Escape y restaura el catálogo al volver', async () => {
    const user = userEvent.setup();
    renderDialog();
    await openBom(user);
    await user.click(screen.getByRole('button', { name: 'Nueva BOM borrador' }));
    await user.type(screen.getByRole('textbox', { name: 'Notas de revisión' }), 'nota padre');
    const componentBox = screen.getByRole('combobox', { name: 'Artículo componente' });
    await user.click(componentBox);
    await user.click(await screen.findByRole('option', { name: /WIP-507/ }));
    articleFrame = 'child';
    await user.click(await screen.findByRole('button', { name: 'Abrir estructura WIP' }));
    await screen.findByText(new RegExp(`BOM de .*${child.codigo}`));
    await user.keyboard('{Escape}');
    expect(await screen.findByText(/Hay un borrador de ruta sin guardar/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
    await user.click(screen.getByRole('button', { name: 'Volver a BOM padre' }));
    expect(await screen.findByDisplayValue('nota padre')).toBeVisible();
    const restoredComponent = screen.getByRole('combobox', { name: 'Artículo componente' });
    expect(restoredComponent).toHaveValue('WIP-507 · Hijo');
    await user.click(restoredComponent);
    expect(await screen.findByRole('option', { name: /WIP-507/ })).toBeVisible();
    expect(screen.queryByRole('option', { name: /WIP-508/ })).not.toBeInTheDocument();
  });

  it.each([
    ['aprobar', 'BORRADOR', 'Aprobar ruta', 'approveRoute', { canRouteApprove: true }],
    ['publicar', 'BORRADOR', 'Publicar ruta', 'publishRoute', { canRoutePublish: true }],
    ['retirar', 'APROBADA', 'Retirar ruta', 'retireRoute', { canRouteApprove: true }],
  ])('bloquea Escape/cierre mientras %s ruta está en vuelo', async (_action, estado, label, apiName, caps) => {
    const user = userEvent.setup();
    let resolveApproval;
    api.routes.mockResolvedValue([{ ...routeDraft, estado }]);
    api[apiName].mockImplementation(() => new Promise((resolve) => { resolveApproval = resolve; }));
    const onClose = vi.fn();
    renderDialog({ onClose, ...caps });
    await user.click(await screen.findByRole('button', { name: label }));
    await user.click(screen.getByRole('button', { name: 'Volver a OF' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(await screen.findByText(/Espera a que termine la escritura/)).toBeVisible();
    resolveApproval({ ...routeDraft, estado: 'APROBADA' });
    await waitFor(() => expect(api[apiName]).toHaveBeenCalledTimes(1));
  });

  it('tras timeout de gobierno de ruta ofrece GET/reconciliación y nunca reintenta POST a ciegas', async () => {
    const user = userEvent.setup();
    api.approveRoute.mockRejectedValue(new Error('timeout'));
    renderDialog({ canRouteApprove: true });
    await user.click(await screen.findByRole('button', { name: 'Aprobar ruta' }));
    expect(await screen.findByText(/Gobierno incierto/)).toBeVisible();
    api.routes.mockResolvedValue([{ ...routeDraft, estado: 'APROBADA', version: 3, content_hash: routeHashCurrent }]);
    expect(await screen.findByRole('button', { name: /Consultar rutas/ })).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Consultar rutas/ }));
    await waitFor(() => expect(api.routes).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/^Aprobada(?:\s*·|$)/)).toBeVisible();
    expect(api.approveRoute).toHaveBeenCalledTimes(1);
  });

  it('mantiene la cuarentena si el GET devuelve el mismo ID en el estado original y versión vieja', async () => {
    const user = userEvent.setup();
    api.approveRoute.mockRejectedValue(new Error('timeout'));
    renderDialog({ canRouteApprove: true });
    await user.click(await screen.findByRole('button', { name: 'Aprobar ruta' }));
    expect(await screen.findByText(/Gobierno incierto/)).toBeVisible();
    api.routes.mockResolvedValue([{ ...routeDraft, estado: 'BORRADOR', version: 2 }]);
    await user.click(screen.getByRole('button', { name: /Consultar rutas/ }));
    await waitFor(() => expect(api.routes).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/Gobierno incierto/)).toBeVisible();
    expect(screen.getByText(/^Borrador(?:\s*·|$)/)).toBeVisible();
    expect(api.approveRoute).toHaveBeenCalledTimes(1);
  });

  it('no aplica el GET de reconciliación antes de verificar el hash del intento', async () => {
    const user = userEvent.setup();
    const pinned = { ...routeDraft, content_hash: routeHashCurrent };
    api.routes.mockResolvedValue([pinned]);
    api.approveRoute.mockRejectedValue(new Error('timeout'));
    renderDialog({ canRouteApprove: true });
    await user.click(await screen.findByRole('button', { name: 'Aprobar ruta' }));
    expect(await screen.findByText(/Gobierno incierto/)).toBeVisible();
    api.routes.mockResolvedValue([{ ...pinned, estado: 'APROBADA', version: 3, content_hash: routeHashRetired }]);
    await user.click(screen.getByRole('button', { name: /Consultar rutas/ }));
    await waitFor(() => expect(api.routes).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/Gobierno incierto/)).toBeVisible();
    expect(screen.getByText(/^Borrador(?:\s*·|$)/)).toBeVisible();
  });

  it('reconcilia retiro incierto por mismo ID y hash conservado por el backend', async () => {
    const user = userEvent.setup();
    const approvedRoute = { ...routeDraft, estado: 'APROBADA', version: 3, content_hash: routeHashCurrent };
    api.routes.mockResolvedValue([approvedRoute]);
    api.retireRoute.mockRejectedValue(new Error('timeout'));
    renderDialog({ canRouteApprove: true });
    await user.click(await screen.findByRole('button', { name: 'Retirar ruta' }));
    await screen.findByText(/Gobierno incierto/);
    api.routes.mockResolvedValue([{ ...approvedRoute, estado: 'RETIRADA', version: 4, content_hash: routeHashCurrent }]);
    await user.click(screen.getByRole('button', { name: /Consultar rutas/ }));
    expect(await screen.findByText(/^Retirada(?:\s*·|$)/)).toBeVisible();
    expect(api.retireRoute).toHaveBeenCalledTimes(1);
  });

  it('rechaza adoptar un retiro cuando cambia el hash de la misma revisión', async () => {
    const user = userEvent.setup();
    const approvedRoute = { ...routeDraft, estado: 'APROBADA', version: 3, content_hash: routeHashCurrent };
    api.routes.mockResolvedValue([approvedRoute]);
    api.retireRoute.mockRejectedValue(new Error('timeout'));
    renderDialog({ canRouteApprove: true, frozenHash: routeHashCurrent });
    await user.click(await screen.findByRole('button', { name: 'Retirar ruta' }));
    await screen.findByText(/Gobierno incierto/);
    api.routes.mockResolvedValue([{ ...approvedRoute, estado: 'RETIRADA', version: 4, content_hash: routeHashRetired }]);
    await user.click(screen.getByRole('button', { name: /Consultar rutas/ }));
    await waitFor(() => expect(api.routes).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/^Aprobada(?:\s*·|$)/)).toBeVisible();
    expect(screen.getByText(/Gobierno incierto/)).toBeVisible();
    expect(api.retireRoute).toHaveBeenCalledTimes(1);
  });

  it('tras timeout de gobierno BOM ofrece GET/reconciliación y no repite el POST', async () => {
    const user = userEvent.setup();
    api.structures.mockResolvedValue([{ id: 31, estado: 'PENDIENTE_APROBACION', numero_revision: 1, version: 7, articulo_resultado_id: component.id, componentes: [] }]);
    api.approveStructure.mockRejectedValue(new Error('timeout'));
    renderDialog({ canStructureApprove: true });
    await openBom(user);
    await user.click(await screen.findByRole('button', { name: 'Aprobar BOM' }));
    expect(await screen.findByText(/Gobierno incierto/)).toBeVisible();
    api.structures.mockResolvedValue([{ id: 31, estado: 'APROBADA', numero_revision: 1, version: 8, articulo_resultado_id: component.id, componentes: [] }]);
    expect(await screen.findByRole('button', { name: /Consultar BOM|Consultar revisión/ })).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Consultar BOM|Consultar revisión/ }));
    await waitFor(() => expect(api.structures).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('APROBADA')).toBeVisible();
    expect(api.approveStructure).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['cero coincidencias', []],
    ['dos coincidencias', [
      { id: 600, codigo: 'WIP-600', nombre: 'Subensamble', clase: 'SUBENSAMBLE_WIP', activo: true },
      { id: 601, codigo: 'WIP-601', nombre: 'Subensamble', clase: 'SUBENSAMBLE_WIP', activo: true },
    ]],
  ])('no adopta una alta WIP incierta cuando hay %s', async (_case, rows) => {
    const user = userEvent.setup();
    api.createWip.mockRejectedValue(new Error('respuesta perdida tras commit'));
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Preparar ruta para otro artículo' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre del WIP' }), component.nombre);
    await user.type(screen.getByRole('textbox', { name: 'Descripción' }), 'Desc WIP');
    await user.click(screen.getByRole('button', { name: 'Confirmar WIP' }));
    expect(await screen.findByText(/Alta incierta/)).toBeVisible();
    api.articlePage.mockResolvedValue({ items: rows, has_more: false, next_cursor: null });
    await user.click(await screen.findByRole('button', { name: /Consultar artículos/ }));
    expect(await screen.findByText(/Alta incierta/)).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Nombre del WIP' })).toHaveValue(component.nombre);
    expect(api.createWip).toHaveBeenCalledTimes(1);
    expect(api.createWip).toHaveBeenCalledWith({ nombre: component.nombre, descripcion: 'Desc WIP', requiere_calidad: false });
  });

  it('adopta sólo la coincidencia WIP única con clase activa y no vuelve a enviar POST', async () => {
    const user = userEvent.setup();
    api.createWip.mockRejectedValue(new Error('respuesta perdida tras commit'));
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Preparar ruta para otro artículo' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre del WIP' }), component.nombre);
    await user.click(screen.getByRole('button', { name: 'Confirmar WIP' }));
    await screen.findByText(/Alta incierta/);
    const adopted = { id: 602, codigo: 'WIP-602', nombre: component.nombre, clase: 'SUBENSAMBLE_WIP', activo: true, version: 9 };
    api.articlePage.mockResolvedValue({ items: [adopted], has_more: false, next_cursor: null });
    await user.click(screen.getByRole('button', { name: /Consultar artículos/ }));
    await waitFor(() => expect(screen.queryByText(/Alta incierta/)).not.toBeInTheDocument());
    expect(api.createWip).toHaveBeenCalledTimes(1);
    expect(api.articlePage).toHaveBeenCalledWith(7, expect.objectContaining({
      q: component.nombre,
      clases: 'SUBENSAMBLE_WIP,PRODUCTO_TERMINADO',
      activo: 'true',
    }), expect.any(AbortSignal));
    await user.click(screen.getByRole('button', { name: 'Volver a ruta' }));
    expect(await screen.findByText(/Propietario explícito: .*WIP-602/)).toBeVisible();
  });

  it.each([
    ['un PT homónimo', { id: 700, codigo: 'PT-700', nombre: component.nombre, clase: 'PRODUCTO_TERMINADO', activo: true }],
    ['un WIP con descripción/calidad distintos', {
      id: 701,
      codigo: 'WIP-701',
      nombre: component.nombre,
      clase: 'SUBENSAMBLE_WIP',
      activo: true,
      wip: { descripcion: 'otra descripción', requiere_calidad: true },
    }],
  ])('mantiene la cuarentena ante %s al reconciliar un alta WIP', async (_case, row) => {
    const user = userEvent.setup();
    api.createWip.mockRejectedValue(new Error('respuesta perdida tras commit'));
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Preparar ruta para otro artículo' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre del WIP' }), component.nombre);
    await user.type(screen.getByRole('textbox', { name: 'Descripción' }), 'Descripción esperada');
    await user.click(screen.getByRole('button', { name: 'Confirmar WIP' }));
    expect(await screen.findByText(/Alta incierta/)).toBeVisible();
    api.articlePage.mockResolvedValue({ items: [row], has_more: false, next_cursor: null });
    await user.click(screen.getByRole('button', { name: /Consultar artículos/ }));
    expect(await screen.findByText(/Alta incierta/)).toBeVisible();
    expect(api.createWip).toHaveBeenCalledTimes(1);
  });

  it('aplica capacidades de ruta sin heredar una ruta a WIP/BOM: aprobar BORRADOR y retirar APROBADA', async () => {
    const user = userEvent.setup();
    api.structures.mockResolvedValue([]);
    renderDialog({ canRouteApprove: true, canRoutePublish: false, structureCanAdmin: false, structureCanApprove: false });
    expect(await screen.findByRole('button', { name: 'Aprobar ruta' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Publicar ruta' })).not.toBeInTheDocument();
    await openBom(user);
    expect(screen.getByRole('button', { name: 'Nueva BOM borrador' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Preparar WIP para componente BOM' })).toBeDisabled();
  });

  it('expone publicación directa de ruta BORRADOR sólo con capacidad DIRECT', async () => {
    api.routes.mockResolvedValue([{ ...routeDraft, estado: 'BORRADOR' }]);
    renderDialog({ canRouteApprove: false, canRoutePublish: true });
    expect(await screen.findByRole('button', { name: 'Publicar ruta' })).toBeVisible();
  });

  it('expone retirar ruta APROBADA con APROBAR, sin exigir PUBLICAR', async () => {
    api.routes.mockResolvedValue([{ ...routeDraft, estado: 'APROBADA' }]);
    renderDialog({ canRouteApprove: true, canRoutePublish: false });
    expect(await screen.findByRole('button', { name: 'Retirar ruta' })).toBeVisible();
  });

  it('separa ADMIN de APROBAR en gobierno BOM: ADMIN envía/descarta y APROBAR aprueba/rechaza', async () => {
    api.structures.mockResolvedValue([
      { id: 31, estado: 'BORRADOR', numero_revision: 1, articulo_resultado_id: component.id, componentes: [] },
      { id: 32, estado: 'PENDIENTE_APROBACION', numero_revision: 2, articulo_resultado_id: component.id, componentes: [] },
    ]);
    const user = userEvent.setup();
    const view = renderDialog({ structureCanAdmin: true, canStructureApprove: false, canStructurePublish: false });
    await openBom(user);
    expect(await screen.findByRole('button', { name: 'Enviar BOM' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Descartar BOM' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Aprobar BOM' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rechazar BOM' })).not.toBeInTheDocument();
    view.unmount();
    renderDialog({ structureCanAdmin: false, canStructureApprove: true, canStructurePublish: false });
    await openBom(user);
    expect(await screen.findByRole('button', { name: 'Aprobar BOM' })).toBeVisible();
    expect(screen.getAllByRole('button', { name: 'Rechazar BOM' }).length).toBeGreaterThan(0);
  });

  it('expone publicar BOM BORRADOR sólo a capacidad DIRECT', async () => {
    api.structures.mockResolvedValue([{ id: 31, estado: 'BORRADOR', numero_revision: 1, articulo_resultado_id: component.id, componentes: [] }]);
    const user = userEvent.setup();
    renderDialog({ canStructureApprove: false, canStructurePublish: true });
    await openBom(user);
    expect(await screen.findByRole('button', { name: 'Publicar BOM' })).toBeVisible();
  });

  it('expone retirar BOM APROBADA a capacidad APROBAR sin exigir PUBLICAR', async () => {
    api.structures.mockResolvedValue([{ id: 32, estado: 'APROBADA', numero_revision: 2, articulo_resultado_id: component.id, componentes: [] }]);
    const user = userEvent.setup();
    renderDialog({ canStructureApprove: true, canStructurePublish: false });
    await openBom(user);
    expect(await screen.findByRole('button', { name: 'Retirar BOM' })).toBeVisible();
  });

  it('no expone acciones de gobierno para estados o capacidades incompatibles', async () => {
    const user = userEvent.setup();
    api.routes.mockResolvedValue([{ ...routeDraft, estado: 'APROBADA', version: 3 }]);
    const view = renderDialog({ canRoutePublish: true, canRouteApprove: false });
    expect(await screen.findByText(/^Aprobada(?:\s*·|$)/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Publicar ruta' })).not.toBeInTheDocument();
    view.unmount();

    api.routes.mockResolvedValue([routeDraft]);
    api.structures.mockResolvedValue([{ id: 31, estado: 'BORRADOR', numero_revision: 1, articulo_resultado_id: component.id, componentes: [] }]);
    renderDialog({ structureCanAdmin: false, canStructureApprove: true });
    await openBom(user);
    expect(screen.queryByRole('button', { name: 'Rechazar BOM' })).not.toBeInTheDocument();
  });

  it('conserva texto WIP dirty antes de cualquier POST al pedir Escape/cierre', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog({ onClose });
    await user.click(screen.getByRole('button', { name: 'Preparar ruta para otro artículo' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre del WIP' }), 'WIP aún local');
    await user.type(screen.getByRole('textbox', { name: 'Descripción' }), 'texto no perdido');
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    expect(await screen.findByText(/Hay un borrador de ruta sin guardar/)).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Nombre del WIP' })).toHaveValue('WIP aún local');
    expect(screen.getByRole('textbox', { name: 'Descripción' })).toHaveValue('texto no perdido');
    expect(api.createWip).not.toHaveBeenCalled();
  });

  it('tras timeout de guardar BOM exige consulta/adopción por identidad y versión sin repetir POST', async () => {
    const user = userEvent.setup();
    api.createStructure.mockRejectedValue(new Error('timeout después de commit'));
    renderDialog();
    await openBom(user);
    await user.click(screen.getByRole('button', { name: 'Nueva BOM borrador' }));
    await user.type(screen.getByRole('textbox', { name: 'Notas de revisión' }), 'BOM incierta');
    await user.click(screen.getByRole('combobox', { name: 'Artículo componente' }));
    await user.click(await screen.findByRole('option', { name: /WIP-507/ }));
    await user.click(screen.getByRole('button', { name: 'Crear BOM borrador' }));
    expect(await screen.findByText(/Guardado incierto/)).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Notas de revisión' })).toHaveValue('BOM incierta');
    expect(await screen.findByRole('button', { name: /Consultar BOM|Consultar catálogo/ })).toBeVisible();
    api.structures.mockResolvedValue([{ id: 31, estado: 'BORRADOR', numero_revision: 4, version: 8, articulo_resultado_id: component.id, componentes: [{ articulo_id: child.id, cantidad: '2' }] }]);
    await user.click(screen.getByRole('button', { name: /Consultar BOM|Consultar catálogo/ }));
    await waitFor(() => expect(api.structures).toHaveBeenCalledTimes(2));
    expect(api.createStructure).toHaveBeenCalledTimes(1);
  });

  it('en conflicto 409 de BOM conserva formulario pero no marca guardado incierto', async () => {
    const user = userEvent.setup();
    api.createStructure.mockRejectedValue(Object.assign(new Error('version conflict'), { status: 409 }));
    renderDialog();
    await openBom(user);
    await user.click(screen.getByRole('button', { name: 'Nueva BOM borrador' }));
    await user.type(screen.getByRole('textbox', { name: 'Notas de revisión' }), 'BOM 409 conserva');
    await user.click(screen.getByRole('combobox', { name: 'Artículo componente' }));
    await user.click(await screen.findByRole('option', { name: /WIP-507/ }));
    await user.click(screen.getByRole('button', { name: 'Crear BOM borrador' }));
    await waitFor(() => expect(api.createStructure).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('textbox', { name: 'Notas de revisión' })).toHaveValue('BOM 409 conserva');
    expect(screen.queryByText(/Guardado incierto/)).not.toBeInTheDocument();
  });

  it('comparte error y éxito de guardar BOM, conserva el borrador al cerrar snackbar y permite reintentar', async () => {
    const user = userEvent.setup();
    api.createStructure
      .mockRejectedValueOnce(Object.assign(new Error('BOM no guardada'), { status: 409 }))
      .mockResolvedValueOnce({
        id: 31,
        estado: 'BORRADOR',
        numero_revision: 1,
        articulo_resultado_id: component.id,
        notas: 'BOM reintentable',
        componentes: [{ secuencia: 1, articulo_id: child.id, cantidad: 1, unidad: 'UN', merma_tecnica_pct: 0 }],
      });
    renderDialog({ withFeedback: true });
    await openBom(user);
    await user.click(screen.getByRole('button', { name: 'Nueva BOM borrador' }));
    await user.type(screen.getByRole('textbox', { name: 'Notas de revisión' }), 'BOM reintentable');
    await user.click(screen.getByRole('combobox', { name: 'Artículo componente' }));
    await user.click(await screen.findByRole('option', { name: /WIP-507/ }));
    await user.click(screen.getByRole('button', { name: 'Crear BOM borrador' }));

    expect(await screen.findByText('BOM no guardada')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Notas de revisión' })).toHaveValue('BOM reintentable');
    await user.click(screen.getByRole('button', { name: 'Cerrar notificación' }));
    expect(screen.getByRole('textbox', { name: 'Notas de revisión' })).toHaveValue('BOM reintentable');

    const retry = screen.getByRole('button', { name: 'Crear BOM borrador' });
    await waitFor(() => expect(retry).toBeEnabled());
    await user.click(retry);
    await waitFor(() => expect(api.createStructure).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('status', { name: /BOM guardada como borrador/ })).toBeVisible();
  });

  it('no ofrece autoaprobación de BOM al mismo actor creador, aunque tenga capacidad aprobar', async () => {
    const user = userEvent.setup();
    api.structures.mockResolvedValue([{ id: 31, estado: 'PENDIENTE_APROBACION', numero_revision: 1, version: 2, creada_por_id: 7, articulo_resultado_id: component.id, componentes: [] }]);
    renderDialog({ actorId: 7, canStructureApprove: true });
    await openBom(user);
    expect(screen.queryByRole('button', { name: 'Aprobar BOM' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rechazar BOM' })).not.toBeInTheDocument();
  });

  it('descarta respuestas del actor anterior cuando una sesión cambia de actor', async () => {
    const user = userEvent.setup();
    let resolveStale;
    api.routes.mockImplementation((_articleId, actorId) => actorId === 7
      ? new Promise((resolve) => { resolveStale = resolve; })
      : Promise.resolve([{ ...routeDraft, id: 99, nombre: 'Ruta actor nuevo' }]));
    const view = renderDialog({ actorId: 7 });
    view.rerender(dialog({ actorId: 9 }));
    expect(await screen.findByText('Ruta actor nuevo')).toBeVisible();
    resolveStale([{ ...routeDraft, nombre: 'Ruta actor stale' }]);
    await waitFor(() => expect(screen.queryByText('Ruta actor stale')).not.toBeInTheDocument());
    expect(api.routes).toHaveBeenCalledWith(target.id, 9, expect.any(AbortSignal));
    expect(user).toBeDefined();
  });

  it('descarta el resultado tardío de un POST de gobierno cuando cambia el actor', async () => {
    const user = userEvent.setup();
    let resolveApproval;
    api.approveRoute.mockImplementation(() => new Promise((resolve) => { resolveApproval = resolve; }));
    const view = renderDialog({ actorId: 7, canRouteApprove: true });
    await user.click(await screen.findByRole('button', { name: 'Aprobar ruta' }));
    view.rerender(dialog({ actorId: 9, canRouteApprove: true }));
    await waitFor(() => expect(api.routes).toHaveBeenCalledWith(target.id, 9, expect.any(AbortSignal)));
    resolveApproval({ ...routeDraft, estado: 'APROBADA', version: 3 });
    await waitFor(() => expect(screen.queryByText(/Ruta aprobar ejecutada/)).not.toBeInTheDocument());
    expect(screen.getByText(/^Borrador(?:\s*·|$)/)).toBeVisible();
  });
});
