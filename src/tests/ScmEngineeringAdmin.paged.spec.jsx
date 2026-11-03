import { act, render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ScmEngineeringAdmin from '../components/ScmEngineeringAdmin';

const state = vi.hoisted(() => ({
  actorId: 1,
  capabilities: new Set(),
  articlePage: vi.fn(),
  approvals: vi.fn(),
  rulesPage: vi.fn(),
  hydrate: vi.fn(),
  resolve: vi.fn(),
  routes: vi.fn(),
  structures: vi.fn(),
  centers: vi.fn(),
  containers: vi.fn(),
  profiles: vi.fn(),
  assignments: vi.fn(),
  ruleDetail: vi.fn(),
  updateWip: vi.fn(),
  updateProfile: vi.fn(),
  updateContainer: vi.fn(),
  pendingSignals: [],
  resolveSignals: [],
}));

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    actorId: state.actorId,
    actor: { id: state.actorId, nombre_completo: `Actor ${state.actorId}` },
    can: (name) => state.capabilities.size === 0 || state.capabilities.has(name),
    experience: { label: 'Ingeniería SCM' },
  }),
}));

vi.mock('../services/scmEngineeringApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listarArticulosPaginaScm: (...args) => {
      state.pendingSignals.push(args[2]);
      return state.articlePage(...args);
    },
    listarAprobacionesIngenieriaScm: (...args) => state.approvals(...args),
    listarReglasEmpaquePaginaScm: (...args) => state.rulesPage(...args),
    obtenerReglaEmpaqueScm: (...args) => state.ruleDetail(...args),
    hidratarEstructurasScm: (...args) => state.hydrate(...args),
    resolverArticulosScm: (...args) => state.resolve(...args),
    listarRutasArticuloScm: (...args) => state.routes(...args),
    listarEstructurasScm: (...args) => state.structures(...args),
    listarCentrosTrabajoScm: (...args) => state.centers(...args),
    listarTiposContenedorScm: (...args) => state.containers(...args),
    listarPerfilesEmpacablesScm: (...args) => state.profiles(...args),
    obtenerPerfilesArticuloScm: vi.fn().mockResolvedValue({ perfiles: [] }),
    listarAsignacionesEmpaqueScm: (...args) => state.assignments(...args),
    actualizarArticuloWipScm: (...args) => state.updateWip(...args),
    actualizarPerfilEmpacableScm: (...args) => state.updateProfile(...args),
    actualizarTipoContenedorScm: (...args) => state.updateContainer(...args),
  };
});

const article = (id, clase = 'SUBENSAMBLE_WIP') => ({
  id,
  codigo: `${clase === 'PRODUCTO_TERMINADO' ? 'PT' : 'WIP'}-${String(id).padStart(6, '0')}`,
  nombre: `Artículo ${id}`,
  clase,
  activo: true,
  unidad_base: 'UN',
  wip: clase === 'SUBENSAMBLE_WIP' ? { descripcion: `WIP ${id}` } : undefined,
});

const page = (items = []) => ({
  items,
  total: items.length,
  has_more: false,
  next_cursor: null,
});

const renderPage = () => render(
  <ThemeProvider theme={createTheme()}>
    <ScmEngineeringAdmin />
  </ThemeProvider>,
);

describe('Ingeniería SCM paginada y acotada', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.actorId = 1;
    state.capabilities = new Set();
    state.pendingSignals = [];
    state.resolveSignals = [];
    state.articlePage.mockResolvedValue(page([article(1), article(2, 'PRODUCTO_TERMINADO')]));
    state.approvals.mockImplementation(async (_, params) => ({
      scope: { dominio: params.dominio, estado: 'BORRADOR', capacidad: `${params.dominio}_VER` },
      ...page([{ id: `${params.dominio}-1`, revision_id: 1, estado: params.dominio === 'ESTRUCTURA' ? 'PENDIENTE_APROBACION' : 'BORRADOR' }]),
    }));
    state.rulesPage.mockResolvedValue(page([]));
    state.ruleDetail.mockResolvedValue({ revision_id: 1, version: 1, estado: 'BORRADOR', notas: '' });
    state.hydrate.mockResolvedValue({ approved: [], referenced: [], missing_article_ids: [], missing_revision_ids: [] });
    state.resolve.mockImplementation((...args) => {
      state.resolveSignals.push(args[2]);
      return Promise.resolve({ items: [], missing_ids: [] });
    });
    state.routes.mockResolvedValue([]);
    state.structures.mockResolvedValue([]);
    state.centers.mockResolvedValue([]);
    state.containers.mockResolvedValue([]);
    state.profiles.mockResolvedValue([]);
    state.assignments.mockResolvedValue(page([]));
    state.updateWip.mockResolvedValue({ id: 1, version: 2 });
    state.updateProfile.mockResolvedValue({ id: 1, version: 2 });
    state.updateContainer.mockResolvedValue({ id: 1, version: 2 });
    window.history.replaceState({}, '', '/');
  });

  it('B-UI-01 carga Artículos sin fan-out de estructuras, rutas ni empaque', async () => {
    renderPage();
    await screen.findByText('Artículo 1');
    expect(state.articlePage).toHaveBeenCalledTimes(1);
    expect(state.routes).not.toHaveBeenCalled();
    expect(state.hydrate).not.toHaveBeenCalled();
    expect(state.rulesPage).not.toHaveBeenCalled();
    expect(state.approvals).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: 'Aprobaciones' })).toBeVisible();
    expect(screen.queryByRole('tab', { name: 'Aprobaciones (0)' })).not.toBeInTheDocument();
  });

  it('B-UI-01 debouncea la búsqueda principal desde la última pulsación', async () => {
    renderPage();
    const search = await screen.findByRole('textbox', { name: 'Buscar por código, nombre o clase' });
    state.articlePage.mockClear();
    const user = userEvent.setup({ delay: 10 });
    await user.type(search, 'CANDY');
    expect(state.articlePage).not.toHaveBeenCalled();
    await act(async () => new Promise((resolve) => globalThis.setTimeout(resolve, 100)));
    expect(state.articlePage).not.toHaveBeenCalled();
    await act(async () => new Promise((resolve) => globalThis.setTimeout(resolve, 250)));
    await waitFor(() => expect(state.articlePage).toHaveBeenCalledTimes(1));
    expect(state.articlePage.mock.calls[0][1]).toEqual(expect.objectContaining({ q: 'CANDY' }));
  });

  it('B-CAP-01 cancela selector remoto al cambiar capacidades con el selector montado', async () => {
    const user = userEvent.setup();
    const view = renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Estructuras BOM' }));
    const search = await screen.findByRole('combobox', { name: 'Artículo resultado' });
    state.articlePage.mockClear();
    await user.type(search, 'CANDY');
    await new Promise((resolve) => globalThis.setTimeout(resolve, 100));

    state.capabilities = new Set(['ARTICULO_VER', 'ESTRUCTURA_VER']);
    view.rerender(
      <ThemeProvider theme={createTheme()}>
        <ScmEngineeringAdmin />
      </ThemeProvider>,
    );
    expect(screen.getByRole('combobox', { name: 'Artículo resultado' })).toBeInTheDocument();
    await new Promise((resolve) => globalThis.setTimeout(resolve, 320));
    expect(state.articlePage.mock.calls.filter((call) => call[1]?.q === 'CANDY')).toHaveLength(0);
  });

  it('B-UI-01 muestra espera explícita mientras Artículos está pendiente', async () => {
    state.articlePage.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(await screen.findByLabelText('Cargando artículos')).toBeVisible();
    expect(screen.queryByText('Todavía no hay registros.')).not.toBeInTheDocument();
  });

  it.each([
    ['Artículos', ['ESTRUCTURA_VER'], 'Sin permiso para consultar artículos.'],
    ['Estructuras BOM', ['ARTICULO_VER'], 'Sin permiso para consultar estructuras BOM.'],
    ['Rutas', ['ARTICULO_VER', 'ESTRUCTURA_VER'], 'Sin permiso para consultar rutas.'],
    ['Empaque', ['ARTICULO_VER', 'RUTA_VER'], 'Sin permiso para consultar empaque.'],
  ])('B-CAP-01 bloquea lecturas dependientes parciales en %s', async (tabName, capabilities, message) => {
    const user = userEvent.setup();
    state.capabilities = new Set(capabilities);
    renderPage();
    await user.click(await screen.findByRole('tab', { name: tabName }));
    expect(await screen.findByText(message)).toBeVisible();
    expect(state.hydrate).not.toHaveBeenCalled();
    expect(state.structures).not.toHaveBeenCalled();
    expect(state.routes).not.toHaveBeenCalled();
    expect(state.centers).not.toHaveBeenCalled();
    expect(state.rulesPage).not.toHaveBeenCalled();
  });

  it('B-CAP-01 permite catálogos y reglas de empaque sin ARTICULO_VER', async () => {
    const user = userEvent.setup();
    state.capabilities = new Set(['EMPAQUE_VER']);
    state.containers.mockResolvedValue([{ id: 1, codigo: 'TMG-1', nombre: 'Manga', activo: true }]);
    state.profiles.mockResolvedValue([{ id: 1, codigo: 'PEM-1', nombre: 'Perfil', activo: true }]);
    state.rulesPage.mockResolvedValue(page([{ revision_id: 1, estado: 'BORRADOR' }]));
    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Empaque' }));
    await waitFor(() => expect(state.rulesPage).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ vista: 'actual' }),
      expect.any(AbortSignal),
    ));
    expect(state.articlePage).not.toHaveBeenCalled();
    expect(state.assignments).not.toHaveBeenCalled();
    expect(state.centers).not.toHaveBeenCalled();
    expect(state.containers).toHaveBeenCalled();
    expect(state.profiles).toHaveBeenCalled();
  });

  it('B-MUT-01 renombrar perfil refresca solo la vista activa y aprobación sin fan-out', async () => {
    const user = userEvent.setup();
    state.profiles.mockResolvedValue([{ id: 1, codigo: 'PEM-1', nombre: 'Perfil', activo: true, version: 1 }]);
    state.rulesPage.mockResolvedValue(page([]));
    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Empaque' }));
    await user.click(await screen.findByRole('button', { name: 'Editar perfil Perfil' }));
    state.articlePage.mockClear();
    state.rulesPage.mockClear();
    state.approvals.mockClear();
    await user.clear(screen.getByLabelText('Nombre'));
    await user.type(screen.getByLabelText('Nombre'), 'Perfil renombrado');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(state.updateProfile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(state.rulesPage.mock.calls.map((call) => call[1].vista))
      .toEqual(['actual']));
    await waitFor(() => expect(state.approvals).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ dominio: 'EMPAQUE' }),
      expect.any(AbortSignal),
    ));
    expect(state.articlePage).not.toHaveBeenCalled();
  });

  it('B-MUT-01 renombrar contenedor refresca solo la vista activa y aprobación sin fan-out', async () => {
    const user = userEvent.setup();
    state.containers.mockResolvedValue([{ id: 1, codigo: 'TMG-1', nombre: 'Manga', activo: true, version: 1, clase: 'MANGA', material: 'PE', tara_nominal_g: 1, tolerancia_tara_g: 0, peso_bruto_max_kg: 10 }]);
    state.rulesPage.mockResolvedValue(page([]));
    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Empaque' }));
    await user.click(await screen.findByRole('button', { name: 'Editar contenedor Manga' }));
    state.articlePage.mockClear();
    state.rulesPage.mockClear();
    state.approvals.mockClear();
    await user.clear(screen.getByLabelText('Nombre'));
    await user.type(screen.getByLabelText('Nombre'), 'Manga renombrada');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(state.updateContainer).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(state.rulesPage.mock.calls.map((call) => call[1].vista))
      .toEqual(['actual']));
    await waitFor(() => expect(state.approvals).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ dominio: 'EMPAQUE' }),
      expect.any(AbortSignal),
    ));
    expect(state.articlePage).not.toHaveBeenCalled();
  });

  it('B-MUT-01 renombrar perfil en historial no consulta la vista actual oculta', async () => {
    const user = userEvent.setup();
    state.profiles.mockResolvedValue([{ id: 1, codigo: 'PEM-1', nombre: 'Perfil', activo: true, version: 1 }]);
    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Empaque' }));
    await user.click(await screen.findByRole('button', { name: 'Mostrar historial' }));
    await waitFor(() => expect(state.rulesPage).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ vista: 'historial' }),
      expect.any(AbortSignal),
    ));
    await user.click(await screen.findByRole('button', { name: 'Editar perfil Perfil' }));
    state.rulesPage.mockClear();
    await user.clear(screen.getByLabelText('Nombre'));
    await user.type(screen.getByLabelText('Nombre'), 'Perfil historial');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(state.updateProfile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(state.rulesPage.mock.calls.map((call) => call[1].vista))
      .toEqual(['historial']));
    expect(state.rulesPage.mock.calls.every((call) => call[1].vista !== 'actual')).toBe(true);
  });

  it('B-MUT-01 toggle de perfil refresca solo catálogo propio, regla activa y aprobación', async () => {
    const user = userEvent.setup();
    state.profiles.mockResolvedValue([{ id: 1, codigo: 'PEM-1', nombre: 'Perfil', activo: true, version: 1 }]);
    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Empaque' }));
    state.articlePage.mockClear();
    state.rulesPage.mockClear();
    state.approvals.mockClear();
    await user.click(await screen.findByRole('button', { name: 'Inactivar perfil Perfil' }));
    await waitFor(() => expect(state.updateProfile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(state.rulesPage.mock.calls.map((call) => call[1].vista))
      .toEqual(['actual']));
    expect(state.profiles).toHaveBeenCalled();
    expect(state.approvals).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ dominio: 'EMPAQUE' }),
      expect.any(AbortSignal),
    );
    expect(state.articlePage).not.toHaveBeenCalled();
  });

  it('B-MUT-01 toggle de contenedor refresca solo catálogo propio, regla activa y aprobación', async () => {
    const user = userEvent.setup();
    state.containers.mockResolvedValue([{ id: 1, codigo: 'TMG-1', nombre: 'Manga', activo: true, version: 1, clase: 'MANGA', material: 'PE', tara_nominal_g: 1, tolerancia_tara_g: 0, peso_bruto_max_kg: 10 }]);
    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Empaque' }));
    state.articlePage.mockClear();
    state.rulesPage.mockClear();
    state.approvals.mockClear();
    await user.click(await screen.findByRole('button', { name: 'Inactivar contenedor Manga' }));
    await waitFor(() => expect(state.updateContainer).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(state.rulesPage.mock.calls.map((call) => call[1].vista))
      .toEqual(['actual']));
    expect(state.containers).toHaveBeenCalled();
    expect(state.approvals).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ dominio: 'EMPAQUE' }),
      expect.any(AbortSignal),
    );
    expect(state.articlePage).not.toHaveBeenCalled();
  });

  it('B-MUT-02 falla el catálogo tras write y reintenta solo ese GET', async () => {
    const user = userEvent.setup();
    state.profiles.mockResolvedValue([{ id: 1, codigo: 'PEM-1', nombre: 'Perfil', activo: true, version: 1 }]);
    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Empaque' }));
    await waitFor(() => expect(state.assignments).toHaveBeenCalled());
    await user.click(await screen.findByRole('button', { name: 'Editar perfil Perfil' }));
    state.profiles.mockClear();
    state.rulesPage.mockClear();
    state.approvals.mockClear();
    state.assignments.mockClear();
    state.profiles.mockRejectedValueOnce(new Error('perfil refresh down')).mockResolvedValue([]);
    await user.clear(screen.getByLabelText('Nombre'));
    await user.type(screen.getByLabelText('Nombre'), 'Perfil con catálogo fallido');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(state.updateProfile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Editar perfil empacable' })).not.toBeInTheDocument());
    expect(await screen.findByText('Cambio guardado; no se pudo actualizar esta sección.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Reintentar actualización' }));
    await waitFor(() => expect(state.profiles).toHaveBeenCalledTimes(2));
    expect(state.updateProfile).toHaveBeenCalledTimes(1);
    expect(state.rulesPage).toHaveBeenCalledTimes(1);
    expect(state.approvals).toHaveBeenCalledTimes(1);
  });

  it('B-MUT-02 falla aprobación EMPAQUE tras write y reintenta solo ese GET', async () => {
    const user = userEvent.setup();
    state.profiles.mockResolvedValue([{ id: 1, codigo: 'PEM-1', nombre: 'Perfil', activo: true, version: 1 }]);
    let failApproval = true;
    state.approvals.mockImplementation(async (_, params) => {
      if (params.dominio === 'EMPAQUE' && failApproval) {
        failApproval = false;
        throw new Error('approval refresh down');
      }
      return { scope: { dominio: params.dominio }, ...page([]) };
    });
    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Empaque' }));
    await user.click(await screen.findByRole('button', { name: 'Editar perfil Perfil' }));
    state.profiles.mockClear();
    state.rulesPage.mockClear();
    state.approvals.mockClear();
    await waitFor(() => expect(state.assignments).toHaveBeenCalled());
    state.assignments.mockClear();
    await user.clear(screen.getByLabelText('Nombre'));
    await user.type(screen.getByLabelText('Nombre'), 'Perfil con aprobación fallida');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(state.updateProfile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Editar perfil empacable' })).not.toBeInTheDocument());
    expect(await screen.findByText('Cambio guardado; no se pudo actualizar esta sección.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Reintentar actualización' }));
    await waitFor(() => expect(state.approvals).toHaveBeenCalledTimes(2));
    expect(state.approvals.mock.calls.every((call) => call[1].dominio === 'EMPAQUE')).toBe(true);
    expect(state.profiles).toHaveBeenCalledTimes(1);
    expect(state.rulesPage).toHaveBeenCalledTimes(1);
    expect(state.assignments).toHaveBeenCalledTimes(1);
    expect(state.updateProfile).toHaveBeenCalledTimes(1);
  });

  it('B-MUT-01 refresca desde cursor 0 sin abortar el GET posterior al write', async () => {
    const user = userEvent.setup();
    state.profiles.mockResolvedValue([{ id: 1, codigo: 'PEM-1', nombre: 'Perfil', activo: true, version: 1 }]);
    state.rulesPage.mockImplementation(async (_, params) => ({
      items: [], total: 50, has_more: true, next_cursor: params.cursor ? null : 'cursor-1',
    }));
    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Empaque' }));
    await user.click(await screen.findByRole('button', { name: 'Go to next page' }));
    await waitFor(() => expect(state.rulesPage).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ cursor: 'cursor-1' }),
      expect.any(AbortSignal),
    ));
    await user.click(await screen.findByRole('button', { name: 'Editar perfil Perfil' }));
    state.rulesPage.mockClear();
    await user.clear(screen.getByLabelText('Nombre'));
    await user.type(screen.getByLabelText('Nombre'), 'Perfil cursor 0');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(state.updateProfile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(state.rulesPage.mock.calls.length).toBeGreaterThanOrEqual(1));
    expect(state.rulesPage.mock.calls.every((call) => call[1].cursor === undefined)).toBe(true);
    expect(screen.queryByText('Cambio guardado; no se pudo actualizar esta sección.')).not.toBeInTheDocument();
  });

  it('B-UI-03 obtiene aprobaciones globales por dominio sin selección de artículo', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('tab', { name: /Aprobaciones/ }));
    await waitFor(() => expect(state.approvals).toHaveBeenCalledTimes(3));
    expect(state.approvals.mock.calls.map((call) => call[1].dominio).sort()).toEqual([
      'EMPAQUE', 'ESTRUCTURA', 'RUTA',
    ]);
    expect(state.approvals.mock.calls.every((call) => call[0] === 1)).toBe(true);
  });

  it('B-MUT-02 reintenta solo el dominio de aprobación afectado', async () => {
    const user = userEvent.setup();
    let failStructure = true;
    state.approvals.mockImplementation(async (_, params) => {
      if (params.dominio === 'ESTRUCTURA' && failStructure) {
        failStructure = false;
        throw new Error('estructura temporalmente no disponible');
      }
      return {
        scope: { dominio: params.dominio },
        ...page([{ id: `${params.dominio}-1`, revision_id: 1, estado: 'PENDIENTE_APROBACION' }]),
      };
    });
    renderPage();
    await user.click(await screen.findByRole('tab', { name: /Aprobaciones/ }));
    expect(await screen.findByText('No se pudo actualizar esta sección.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Reintentar sección' }));
    await waitFor(() => expect(state.approvals).toHaveBeenCalledTimes(4));
    expect(state.approvals.mock.calls[3][1]).toEqual(expect.objectContaining({ dominio: 'ESTRUCTURA' }));
  });

  it('B-UI-03 conserva q normalizada al paginar la bandeja global', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('tab', { name: /Aprobaciones/ }));
    const query = screen.getByRole('textbox', { name: 'Buscar pendientes' });
    await user.type(query, 'Arbol');
    await waitFor(() => expect(state.approvals.mock.calls.some((call) => call[1].q === 'Arbol')).toBe(true));
    expect(state.approvals.mock.calls.filter((call) => call[1].q === 'Arbol').length).toBe(3);
  });

  it('B-UI-03 conserva cursores independientes al avanzar y volver en los tres dominios', async () => {
    const user = userEvent.setup();
    state.approvals.mockImplementation(async (_, params) => ({
      scope: { dominio: params.dominio },
      items: [{ id: `${params.dominio}-${params.cursor || '0'}`, revision_id: 1, estado: 'BORRADOR' }],
      total: 60,
      has_more: true,
      next_cursor: params.cursor === 'cursor-1' ? 'cursor-2' : 'cursor-1',
    }));
    renderPage();
    await user.click(await screen.findByRole('tab', { name: /Aprobaciones/ }));
    await waitFor(() => expect(state.approvals).toHaveBeenCalledTimes(3));
    for (let domainIndex = 0; domainIndex < 3; domainIndex += 1) {
      await user.click(screen.getAllByRole('button', { name: 'Go to next page' })[domainIndex]);
    }
    await waitFor(() => expect(state.approvals.mock.calls.filter((call) => call[1].cursor === 'cursor-1').length).toBeGreaterThanOrEqual(3));
    for (let domainIndex = 0; domainIndex < 3; domainIndex += 1) {
      await user.click(screen.getAllByRole('button', { name: 'Go to next page' })[domainIndex]);
    }
    await waitFor(() => expect(state.approvals.mock.calls.filter((call) => call[1].cursor === 'cursor-2').length).toBeGreaterThanOrEqual(3));
    for (let domainIndex = 0; domainIndex < 3; domainIndex += 1) {
      await user.click(screen.getAllByRole('button', { name: 'Go to previous page' })[domainIndex]);
    }
    for (let domainIndex = 0; domainIndex < 3; domainIndex += 1) {
      await user.click(screen.getAllByRole('button', { name: 'Go to previous page' })[domainIndex]);
    }
    await waitFor(() => expect(state.approvals.mock.calls.filter((call) => call[1].cursor === undefined).length).toBeGreaterThanOrEqual(6));
  });

  it('C-RULE-02 consulta historial de reglas solo tras acción explícita', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Empaque' }));
    await waitFor(() => expect(state.rulesPage).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ vista: 'actual', limite: 25 }),
      expect.any(AbortSignal),
    ));
    expect(state.rulesPage).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Mostrar historial' }));
    await waitFor(() => expect(state.rulesPage).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ vista: 'historial', limite: 25 }),
      expect.any(AbortSignal),
    ));
  });

  it('C-RULE-02 aborta detalle lento y conserva el último editor seleccionado', async () => {
    const user = userEvent.setup();
    let resolveSlow;
    const slow = new Promise((resolve) => { resolveSlow = resolve; });
    const ruleA = { revision_id: 1, version: 1, estado: 'BORRADOR', notas: 'A' };
    const ruleB = { revision_id: 2, version: 1, estado: 'BORRADOR', notas: 'B' };
    state.rulesPage.mockResolvedValue(page([ruleA, ruleB]));
    state.ruleDetail.mockImplementation((revisionId) => Number(revisionId) === 1
      ? slow
      : Promise.resolve(ruleB));
    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Empaque' }));
    await screen.findByRole('button', { name: 'Editar regla 1' });
    await user.click(screen.getByRole('button', { name: 'Editar regla 1' }));
    await waitFor(() => expect(state.ruleDetail).toHaveBeenCalledWith(
      1,
      1,
      expect.any(AbortSignal),
    ));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Editar regla de empaque' })).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Editar regla 2' }));
    await waitFor(() => expect(state.ruleDetail).toHaveBeenCalledWith(
      2,
      1,
      expect.any(AbortSignal),
    ));
    expect(state.ruleDetail.mock.calls[0][2].aborted).toBe(true);
    expect(await screen.findByLabelText('Notas')).toHaveValue('B');
    resolveSlow(ruleA);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByLabelText('Notas')).toHaveValue('B');
  });

  it('B-ACTOR-01 aborta la lectura de la identidad anterior', async () => {
    const first = new Promise(() => {});
    state.articlePage.mockReturnValue(first);
    const rendered = renderPage();
    await waitFor(() => expect(state.articlePage).toHaveBeenCalled());
    state.actorId = 2;
    rendered.rerender(
      <ThemeProvider theme={createTheme()}><ScmEngineeringAdmin /></ThemeProvider>,
    );
    await waitFor(() => expect(state.pendingSignals[0]?.aborted).toBe(true));
    expect(state.articlePage.mock.calls[0][0]).toBe(1);
  });

  it('C-ART-02 conserva límite estable entre páginas pequeñas y grandes', async () => {
    state.articlePage.mockResolvedValueOnce(page(Array.from({ length: 25 }, (_, index) => article(index + 1))));
    renderPage();
    await screen.findByText('Artículo 1');
    expect(state.articlePage.mock.calls[0][1]).toEqual(expect.objectContaining({ limite: 25 }));
    expect(state.articlePage.mock.calls[0][1].limite).toBe(25);
    expect(state.articlePage.mock.calls[0][2]).toBeInstanceOf(AbortSignal);
  });

  it('B-UI-02 selecciona una referencia BOM y emite hidratación acotada', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Estructuras BOM' }));
    const input = await screen.findByRole('combobox', { name: 'Artículo resultado' });
    await user.click(input);
    await user.click(await screen.findByRole('option', { name: /WIP-000001/ }));
    await waitFor(() => expect(state.hydrate).toHaveBeenCalledTimes(1));
    expect(state.hydrate.mock.calls[0][0]).toBe(1);
    expect(state.hydrate.mock.calls[0][1].articuloIds).toEqual(['1']);
  });

  it('B-UI-02 conserva error local de BOM y permite reintentar el contexto', async () => {
    const user = userEvent.setup();
    state.hydrate.mockRejectedValueOnce(new Error('BOM temporalmente no disponible'));
    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Estructuras BOM' }));
    await user.click(screen.getByRole('combobox', { name: 'Artículo resultado' }));
    await user.click(await screen.findByRole('option', { name: /WIP-000001/ }));
    expect(await screen.findByText('BOM temporalmente no disponible')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reintentar BOM' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Reintentar BOM' }));
    await waitFor(() => expect(state.hydrate.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it('B-UI-02 conserva un artículo seleccionado fuera de la página en el cache del actor', async () => {
    const outsidePage = article(99, 'PRODUCTO_TERMINADO');
    window.history.replaceState({}, '', '/datos-maestros/ingenieria-scm?tab=empaque&articulo=99');
    state.articlePage.mockResolvedValue(page([article(1)]));
    state.resolve.mockResolvedValue({ items: [outsidePage], missing_ids: [] });
    renderPage();
    await waitFor(() => expect(state.resolve).toHaveBeenCalledWith(
      1,
      [99],
      expect.any(AbortSignal),
    ));
    expect(await screen.findByText(/Configurando empaque para PT-000099/)).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Artículo empacable' })).toHaveValue(
      'PT-000099 · Artículo 99',
    );
  });

  it('B-MUT-02 conserva éxito del write y reintenta solo GET tras refresh fallido', async () => {
    const user = userEvent.setup();
    state.articlePage
      .mockResolvedValueOnce(page([article(1)]))
      .mockRejectedValueOnce(new Error('refresh down'))
      .mockResolvedValue(page([article(1)]));
    renderPage();
    await screen.findByText('Artículo 1');
    await user.click(screen.getByRole('button', { name: 'Editar WIP Artículo 1' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(state.updateWip).toHaveBeenCalledTimes(1));
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog', { name: 'Editar WIP' }));
    expect(await screen.findByText('Artículo WIP actualizado.')).toBeVisible();
    expect(await screen.findByText('Cambio guardado; no se pudo actualizar esta sección.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Reintentar sección' }));
    await waitFor(() => expect(state.updateWip).toHaveBeenCalledTimes(1));
    expect(state.articlePage.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('B-CAP-01 no consulta el dominio de aprobaciones sin *_VER', async () => {
    const user = userEvent.setup();
    state.capabilities = new Set(['ARTICULO_VER', 'ESTRUCTURA_VER', 'EMPAQUE_VER']);
    renderPage();
    await user.click(await screen.findByRole('tab', { name: /Aprobaciones/ }));
    await waitFor(() => expect(state.approvals).toHaveBeenCalledTimes(2));
    expect(state.approvals.mock.calls.map((call) => call[1].dominio).sort()).toEqual([
      'EMPAQUE', 'ESTRUCTURA',
    ]);
    expect(screen.getByText('Sin permiso para consultar aprobaciones de rutas.')).toBeVisible();
  });

  it('H-BOM-01 divide referencias de editor en chunks de 100 y no trunca IDs', async () => {
    const user = userEvent.setup();
    state.structures.mockResolvedValue([{
      id: 10,
      articulo_resultado_id: 1,
      estado: 'BORRADOR',
      numero_revision: 2,
      componentes: Array.from({ length: 101 }, (_, index) => ({
        articulo_id: index + 1000,
        cantidad: 1,
        merma_tecnica_pct: 0,
      })),
    }]);
    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Estructuras BOM' }));
    await user.click(screen.getByRole('combobox', { name: 'Artículo resultado' }));
    await user.click(await screen.findByRole('option', { name: /WIP-000001/ }));
    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    await waitFor(() => expect(state.resolve).toHaveBeenCalledTimes(2));
    const resolvedIds = state.resolve.mock.calls.flatMap((call) => call[1]);
    expect(resolvedIds).toHaveLength(102);
    expect(resolvedIds).toContain(1100);
    expect(state.hydrate.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('H-ACTOR-01 cancela hidratación de referencias al cambiar actor', async () => {
    const user = userEvent.setup();
    state.structures.mockResolvedValue([{
      id: 10, articulo_resultado_id: 1, estado: 'BORRADOR', numero_revision: 2,
      componentes: [{ articulo_id: 1000, cantidad: 1, merma_tecnica_pct: 0 }],
    }]);
    state.resolve.mockImplementation((...args) => {
      state.resolveSignals.push(args[2]);
      return new Promise(() => {});
    });
    const rendered = renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Estructuras BOM' }));
    await user.click(screen.getByRole('combobox', { name: 'Artículo resultado' }));
    await user.click(await screen.findByRole('option', { name: /WIP-000001/ }));
    await waitFor(() => expect(state.hydrate).toHaveBeenCalled());
    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    await waitFor(() => expect(state.resolveSignals.length).toBeGreaterThan(0));
    state.actorId = 2;
    rendered.rerender(<ThemeProvider theme={createTheme()}><ScmEngineeringAdmin /></ThemeProvider>);
    await waitFor(() => expect(state.resolveSignals[0]?.aborted).toBe(true));
  });

  it('H-BOM-02 conserva bloqueo honesto cuando falta una referencia autorizada', async () => {
    const user = userEvent.setup();
    state.structures.mockResolvedValue([{
      id: 10, articulo_resultado_id: 1, estado: 'BORRADOR', numero_revision: 2,
      componentes: [{ articulo_id: 1000, cantidad: 1, merma_tecnica_pct: 0 }],
    }]);
    state.hydrate.mockResolvedValue({
      approved: [], referenced: [], missing_article_ids: [1000], missing_revision_ids: [],
    });
    const rendered = renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Estructuras BOM' }));
    await user.click(screen.getByRole('combobox', { name: 'Artículo resultado' }));
    await user.click(await screen.findByRole('option', { name: /WIP-000001/ }));
    await waitFor(() => expect(state.hydrate).toHaveBeenCalled());
    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    expect(await screen.findByText(/Dependencia sin resolver: 1000/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeDisabled();
    rendered.unmount();
  });

  it('H-ROUTE-01 hidrata salidas y revisión histórica antes de normalizar ruta', async () => {
    const user = userEvent.setup();
    state.articlePage.mockResolvedValue(page([article(1), article(2, 'PRODUCTO_TERMINADO')]));
    state.routes.mockResolvedValue([{
      id: 20, numero_revision: 3, estado: 'BORRADOR',
      operaciones: [
        {
          id: 201, clave: 'OP1', secuencia_visible: 1, nombre: 'Prearmado', tipo: 'PREARMADO',
          executor_kind: 'ORDEN_OPERACION', centro_trabajo_id: 1,
          articulo_salida_id: 1000, estructura_revision_id: 55, permite_concurrente: false,
        },
        {
          id: 202, clave: 'OP2', secuencia_visible: 2, nombre: 'Salida', tipo: 'ACABADO',
          executor_kind: 'ORDEN_OPERACION', centro_trabajo_id: 1,
          articulo_salida_id: 2, estructura_revision_id: null, permite_concurrente: false,
        },
      ],
      precedencias: [],
    }]);
    state.hydrate.mockImplementation(async (_, payload) => ({
      approved: [],
      referenced: payload.revisionIds.includes(55)
        ? [{ id: 55, estado: 'RETIRADA', numero_revision: 2, articulo_resultado_id: 1000 }]
        : [],
      missing_article_ids: [],
      missing_revision_ids: [],
    }));
    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Rutas' }));
    await user.click(await screen.findByRole('combobox', { name: 'Artículo objetivo' }));
    await user.click(await screen.findByRole('option', { name: /WIP-000001/ }));
    await waitFor(() => expect(state.routes).toHaveBeenCalled());
    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    await waitFor(() => expect(state.resolve).toHaveBeenCalled());
    const ids = state.resolve.mock.calls.flatMap((call) => call[1]);
    expect(ids).toEqual(expect.arrayContaining([1, 2, 1000]));
    expect(state.hydrate.mock.calls.flatMap((call) => call[1].revisionIds)).toContain(55);
    expect(await screen.findByText(/rev\. 2 · RETIRADA/)).toBeVisible();
  });

});
