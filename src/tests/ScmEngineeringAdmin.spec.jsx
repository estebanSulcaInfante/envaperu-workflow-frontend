import {
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material';
import ScmEngineeringAdmin from '../components/ScmEngineeringAdmin';

const actorState = vi.hoisted(() => ({ id: 1 }));

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    actorId: actorState.id,
    actor: {
      id: actorState.id,
      nombre_completo: actorState.id === 1 ? 'Creador UAT' : 'Aprobador UAT',
    },
    can: () => true,
    experience: { label: 'Ingeniería SCM' },
  }),
}));

vi.mock('../services/scmEngineeringApi', () => ({
  actualizarArticuloWipScm: vi.fn(),
  actualizarCentroTrabajoScm: vi.fn(),
  actualizarEstructuraScm: vi.fn(),
  actualizarPerfilEmpacableScm: vi.fn(),
  actualizarReglaEmpaqueScm: vi.fn(),
  actualizarRutaScm: vi.fn(),
  actualizarTipoContenedorScm: vi.fn(),
  aprobarEstructuraScm: vi.fn(),
  aprobarReglaEmpaqueScm: vi.fn(),
  aprobarRutaScm: vi.fn(),
  asignarPerfilesArticuloScm: vi.fn(),
  crearArticuloWipScm: vi.fn(),
  crearCentroTrabajoScm: vi.fn(),
  crearEstructuraScm: vi.fn(),
  crearPerfilEmpacableScm: vi.fn(),
  crearReglaEmpaqueScm: vi.fn(),
  crearRutaScm: vi.fn(),
  crearTipoContenedorScm: vi.fn(),
  descartarEstructuraScm: vi.fn(),
  enviarEstructuraScm: vi.fn(),
  listarArticulosScm: vi.fn(),
  listarCentrosTrabajoScm: vi.fn(),
  listarEstructurasScm: vi.fn(),
  listarPerfilesEmpacablesScm: vi.fn(),
  listarReglasEmpaqueScm: vi.fn(),
  listarRutasScm: vi.fn(),
  listarTiposContenedorScm: vi.fn(),
  mensajeErrorScm: vi.fn((error, fallback) => error?.message || fallback),
  obtenerPerfilesArticuloScm: vi.fn(),
  publicarEstructuraScm: vi.fn(),
  publicarReglaEmpaqueScm: vi.fn(),
  publicarRutaScm: vi.fn(),
  rechazarEstructuraScm: vi.fn(),
  retirarEstructuraScm: vi.fn(),
  retirarRutaScm: vi.fn(),
}));

import {
  actualizarArticuloWipScm,
  aprobarEstructuraScm,
  asignarPerfilesArticuloScm,
  crearArticuloWipScm,
  crearCentroTrabajoScm,
  crearEstructuraScm,
  descartarEstructuraScm,
  listarArticulosScm,
  listarCentrosTrabajoScm,
  listarEstructurasScm,
  listarPerfilesEmpacablesScm,
  listarReglasEmpaqueScm,
  listarRutasScm,
  listarTiposContenedorScm,
  obtenerPerfilesArticuloScm,
  publicarEstructuraScm,
  publicarReglaEmpaqueScm,
  publicarRutaScm,
  rechazarEstructuraScm,
  retirarEstructuraScm,
} from '../services/scmEngineeringApi';

const articles = [
  {
    id: 1,
    codigo: 'PC-000001',
    nombre: 'Asa azul',
    clase: 'PIEZA_COLOR',
    unidad_base: 'UN',
    subtipo: { pieza_color_sku: 'PC-000001' },
  },
  {
    id: 2,
    codigo: 'WIP-000001',
    nombre: 'Balde prearmado',
    clase: 'SUBENSAMBLE_WIP',
    unidad_base: 'UN',
    activo: true,
    version: 1,
    wip: { descripcion: 'Balde con asa' },
  },
  {
    id: 3,
    codigo: 'PT-000001',
    nombre: 'Balde terminado',
    clase: 'PRODUCTO_TERMINADO',
    unidad_base: 'UN',
    subtipo: { producto_terminado_id: 'PT-000001' },
  },
  {
    id: 4,
    codigo: 'PT-LEGACY-SIN-CODIGO',
    nombre: 'Producto legado sin cÃ³digo',
    clase: 'PRODUCTO_TERMINADO',
    unidad_base: 'UN',
    subtipo: { producto_terminado_id: '' },
  },
];

const renderPage = () => render(
  <ThemeProvider theme={createTheme()}>
    <ScmEngineeringAdmin />
  </ThemeProvider>,
);

describe('Ingeniería SCM R-core', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actorState.id = 1;
    listarArticulosScm.mockResolvedValue(articles);
    listarCentrosTrabajoScm.mockResolvedValue([]);
    listarTiposContenedorScm.mockResolvedValue([]);
    listarPerfilesEmpacablesScm.mockResolvedValue([]);
    listarReglasEmpaqueScm.mockResolvedValue([]);
    obtenerPerfilesArticuloScm.mockResolvedValue({ perfiles: [] });
    listarEstructurasScm.mockResolvedValue([]);
    listarRutasScm.mockResolvedValue([]);
    crearArticuloWipScm.mockResolvedValue({
      id: 4,
      codigo: 'WIP-000002',
      nombre: 'Prearmado nuevo',
    });
    actualizarArticuloWipScm.mockResolvedValue({
      ...articles[1],
      nombre: 'Balde prearmado corregido',
      version: 2,
    });
    crearCentroTrabajoScm.mockResolvedValue({
      id: 1,
      codigo: 'CT-000001',
      nombre: 'Mesa de armado',
      tipo: 'PREARMADO',
      version: 1,
      activo: true,
    });
  });

  it('presenta las cinco áreas R-core conectadas a la API', async () => {
    renderPage();

    expect(await screen.findByText('Ingeniería SCM')).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Artículos' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Estructuras BOM' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Rutas' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Empaque' })).toBeVisible();
    expect(screen.getByRole('tab', { name: /Aprobaciones/ })).toBeVisible();
    expect(screen.getByText('WIP-000001')).toBeVisible();
    expect(listarEstructurasScm).toHaveBeenCalledTimes(4);
    expect(listarRutasScm).toHaveBeenCalledWith('PT-000001');
    expect(listarRutasScm).not.toHaveBeenCalledWith('');
  });

  it('crea un WIP sin exponer clasificación KIT', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /Nuevo WIP/i }));
    const dialog = screen.getByRole('dialog', { name: /Nuevo WIP/i });
    expect(dialog).toBeVisible();
    expect(screen.queryByText(/^KIT$/)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Nombre'), 'Prearmado nuevo');
    await user.type(screen.getByLabelText('Descripción'), 'Balde con asa colocada');
    await user.click(screen.getByRole('button', { name: 'Crear WIP' }));

    await waitFor(() => expect(crearArticuloWipScm).toHaveBeenCalledWith({
      nombre: 'Prearmado nuevo',
      descripcion: 'Balde con asa colocada',
      requiere_calidad: false,
    }));
  });

  it('edita e inactiva un WIP usando su versión vigente', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('WIP-000001');
    await user.click(screen.getByRole('button', { name: 'Editar WIP Balde prearmado' }));
    const nameInput = screen.getByLabelText('Nombre');
    await user.clear(nameInput);
    await user.type(nameInput, 'Balde prearmado corregido');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(actualizarArticuloWipScm).toHaveBeenCalledWith(2, {
      version: 1,
      nombre: 'Balde prearmado corregido',
      descripcion: 'Balde con asa',
      requiere_calidad: false,
    }));
    await waitForElementToBeRemoved(
      () => screen.queryByRole('dialog', { name: 'Editar WIP' }),
    );

    await user.click(screen.getByRole('button', { name: 'Inactivar WIP Balde prearmado' }));
    await waitFor(() => expect(actualizarArticuloWipScm).toHaveBeenCalledWith(2, {
      version: 1,
      activo: false,
    }));
  });

  it('permite asignar un perfil empacable a un producto terminado', async () => {
    const profile = {
      id: 8,
      codigo: 'PEM-000008',
      nombre: 'Jarra terminada',
      activo: true,
    };
    listarPerfilesEmpacablesScm.mockResolvedValue([profile]);
    asignarPerfilesArticuloScm.mockResolvedValue({
      articulo_id: 3,
      version: 2,
      perfiles: [{ perfil_empacable_id: 8, es_predeterminado: true, activo: true }],
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('tab', { name: 'Empaque' }));
    const articleSearch = screen.getAllByRole('combobox')[0];
    await user.type(articleSearch, 'PT-000001');
    const productOption = await screen.findByRole('option', {
      name: /PT-000001.*Balde terminado.*Producto terminado/,
    });
    expect(productOption).toBeVisible();
    await user.click(productOption);

    await user.click(screen.getAllByRole('combobox')[1]);
    await user.click(await screen.findByRole('option', { name: /PEM-000008 · Jarra terminada/ }));
    await user.click(screen.getByRole('button', { name: 'Asignar perfil' }));

    await waitFor(() => expect(asignarPerfilesArticuloScm).toHaveBeenCalledWith(
      articles[2],
      [{ perfil_empacable_id: 8, es_predeterminado: true, activo: true }],
    ));
  });

  it('muestra el perfil predeterminado asignado a cada artículo', async () => {
    const profile = {
      id: 8,
      codigo: 'PEM-000008',
      nombre: 'Jarra terminada',
      descripcion_fisica: 'Producto completamente armado',
      activo: true,
    };
    listarPerfilesEmpacablesScm.mockResolvedValue([profile]);
    obtenerPerfilesArticuloScm.mockImplementation((articleId) => Promise.resolve({
      articulo_id: articleId,
      perfiles: Number(articleId) === 3 ? [{
        id: 18,
        articulo_id: 3,
        perfil_empacable_id: 8,
        es_predeterminado: true,
        activo: true,
        perfil: profile,
      }] : [],
    }));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('tab', { name: 'Empaque' }));
    const assignments = await screen.findByRole('table', {
      name: 'Asignaciones actuales de perfiles empacables',
    });
    expect(within(assignments).getByText('PT-000001')).toBeVisible();
    expect(within(assignments).getByText(/PEM-000008 · Jarra terminada/)).toBeVisible();
    expect(within(assignments).getByText('Predeterminado')).toBeVisible();
  });

  it('crea un centro de trabajo sin pedir un código manual', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('tab', { name: 'Rutas' }));
    await user.click(screen.getByRole('button', { name: 'Centro de trabajo' }));
    const dialog = screen.getByRole('dialog', { name: 'Nuevo centro de trabajo' });
    expect(within(dialog).queryByRole('textbox', { name: 'Código' })).not.toBeInTheDocument();
    expect(within(dialog).getByText(/código se generará automáticamente/i)).toBeVisible();
    await user.type(within(dialog).getByRole('textbox', { name: 'Nombre' }), 'Mesa de armado');
    await user.click(within(dialog).getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(crearCentroTrabajoScm).toHaveBeenCalledWith({
      nombre: 'Mesa de armado',
      tipo: 'PREARMADO',
    }));
  });

  it('permite crear un centro de trabajo de soplado', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('tab', { name: 'Rutas' }));
    await user.click(screen.getByRole('button', { name: 'Centro de trabajo' }));
    const dialog = screen.getByRole('dialog', { name: 'Nuevo centro de trabajo' });
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Nombre' }),
      'Sopladora principal',
    );
    await user.click(within(dialog).getByRole('combobox', { name: 'Tipo de operación' }));
    await user.click(screen.getByRole('option', { name: 'SOPLADO' }));
    await user.click(within(dialog).getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(crearCentroTrabajoScm).toHaveBeenCalledWith({
      nombre: 'Sopladora principal',
      tipo: 'SOPLADO',
    }));
  });

  it('permite marcar una operación de prearmado como concurrente', async () => {
    listarCentrosTrabajoScm.mockResolvedValue([{
      id: 1,
      codigo: 'CT-000001',
      nombre: 'Mesa de armado',
      tipo: 'ENSAMBLE',
      activo: true,
    }]);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('tab', { name: 'Rutas' }));
    await user.click(screen.getByRole('button', { name: 'Nueva ruta' }));
    const dialog = screen.getByRole('dialog', { name: /Nueva ruta/ });
    expect(within(dialog).queryByRole('textbox', { name: 'Clave' })).not.toBeInTheDocument();
    await user.click(within(dialog).getAllByRole('combobox')[0]);
    await user.click(screen.getByRole('option', { name: 'PREARMADO' }));

    const concurrent = within(dialog).getByRole('checkbox', {
      name: 'Permite ejecución concurrente',
    });
    expect(concurrent).not.toBeChecked();
    await user.click(concurrent);
    expect(concurrent).toBeChecked();
  });

  it('permite publicar una ruta desde su propia tarjeta', async () => {
    const draft = {
      id: 30,
      producto_id: 'PT-000001',
      numero_revision: 1,
      estado: 'BORRADOR',
      creada_por_id: 1,
      version: 1,
      notas: 'Ruta de armado',
      articulo_objetivo: articles[2],
      operaciones: [],
      precedencias: [],
    };
    listarRutasScm.mockResolvedValue([draft]);
    publicarRutaScm.mockResolvedValue({ ...draft, estado: 'APROBADA' });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('tab', { name: 'Rutas' }));
    expect(await screen.findByText('Ruta de armado · creador #1')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Publicar' }));

    await waitFor(() => expect(publicarRutaScm).toHaveBeenCalledWith(draft));
    expect(await screen.findByText('Ruta publicada directamente por jefatura.')).toBeVisible();
  });

  it('permite a una jefatura publicar su propia regla de empaque', async () => {
    const draft = {
      revision_id: 41,
      numero_revision: 1,
      estado: 'BORRADOR',
      creada_por_id: 1,
      version: 1,
      perfil_empacable: { nombre: 'Jarra terminada' },
      tipo_contenedor: { nombre: 'Bolsa estándar' },
    };
    listarReglasEmpaqueScm.mockResolvedValue([draft]);
    publicarReglaEmpaqueScm.mockResolvedValue({ ...draft, estado: 'APROBADA' });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('tab', { name: /Aprobaciones/ }));
    const rulesSection = screen.getByRole('heading', {
      name: 'Reglas de empaque en borrador',
    }).parentElement;
    const publish = within(rulesSection).getByRole('button', { name: 'Publicar' });
    expect(publish).toBeEnabled();
    await user.click(publish);

    await waitFor(() => expect(publicarReglaEmpaqueScm).toHaveBeenCalledWith(draft));
    await screen.findByText('Regla de empaque publicada directamente por jefatura.');
  });

  it('impide al creador aprobar su revisión y habilita a un actor distinto', async () => {
    const pendingRevision = {
      id: 10,
      articulo_resultado_id: 3,
      numero_revision: 1,
      estado: 'PENDIENTE_APROBACION',
      creada_por_id: 1,
      version: 2,
      articulo_resultado: articles[2],
      componentes: [{
        id: 20,
        articulo_id: 1,
        cantidad: 1,
        articulo: articles[0],
      }],
    };
    listarEstructurasScm.mockImplementation(
      (articleId) => Promise.resolve(Number(articleId) === 3 ? [pendingRevision] : []),
    );
    aprobarEstructuraScm.mockResolvedValue({
      ...pendingRevision,
      estado: 'APROBADA',
    });
    const user = userEvent.setup();

    const rendered = renderPage();
    await user.click(await screen.findByRole('tab', { name: /Aprobaciones/ }));

    const creatorButton = await screen.findByRole('button', { name: 'Requiere otro actor' });
    expect(creatorButton).toBeDisabled();

    expect(screen.getByRole('button', { name: 'Requiere otro actor' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Actor local de prueba')).not.toBeInTheDocument();

    rendered.unmount();
    actorState.id = 2;
    renderPage();
    await user.click(await screen.findByRole('tab', { name: /Aprobaciones/ }));
    const approverButton = await screen.findByRole('button', { name: 'Aprobar' });
    expect(approverButton).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeEnabled();
    await user.click(approverButton);

    await waitFor(() => expect(aprobarEstructuraScm).toHaveBeenCalledWith(pendingRevision));
    await screen.findByText('Estructura aprobada.');

    const rejectButton = await screen.findByRole('button', { name: 'Rechazar' });
    await waitFor(() => expect(rejectButton).toBeEnabled());
    await user.click(rejectButton);
    const rejectDialog = await screen.findByRole('dialog', { name: 'Rechazar estructura' });
    await user.type(
      within(rejectDialog).getByRole('textbox', { name: 'Motivo' }),
      'Artículo resultado incorrecto',
    );
    await user.click(within(rejectDialog).getByRole('button', { name: 'Confirmar rechazo' }));
    await waitFor(() => expect(rechazarEstructuraScm).toHaveBeenCalledWith(
      pendingRevision,
      'Artículo resultado incorrecto',
    ));
  });

  it('filtra las clases válidas para resultado y componentes de BOM', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('tab', { name: 'Estructuras BOM' }));
    const resultSelect = screen.getByRole('combobox');
    await user.click(resultSelect);
    expect(screen.queryByRole('option', { name: /PC-000001/ })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /WIP-000001/ })).toBeVisible();
    expect(screen.getByRole('option', { name: /PT-000001/ })).toBeVisible();
    await user.keyboard('{Escape}');

    await user.click(resultSelect);
    await user.click(screen.getByRole('option', { name: /WIP-000001/ }));

    await user.click(screen.getByRole('button', { name: 'Nueva revisión' }));
    const bomDialog = await screen.findByRole('dialog', { name: /Nueva estructura/ });
    await user.click(within(bomDialog).getByRole('combobox'));
    expect(screen.getByRole('option', { name: /PC-000001/ })).toBeVisible();
    expect(screen.queryByRole('option', { name: /PT-000001/ })).not.toBeInTheDocument();
  });

  it('muestra la composición aprobada al seleccionar un WIP como componente', async () => {
    const approvedWip = {
      id: 20,
      articulo_resultado_id: 2,
      numero_revision: 2,
      estado: 'APROBADA',
      articulo_resultado: articles[1],
      componentes: [{
        id: 31,
        articulo_id: 1,
        cantidad: '1.000000',
        articulo: articles[0],
      }],
    };
    listarEstructurasScm.mockImplementation(
      (articleId) => Promise.resolve(Number(articleId) === 2 ? [approvedWip] : []),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('tab', { name: 'Estructuras BOM' }));
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: /PT-000001/ }));
    await user.click(screen.getByRole('button', { name: 'Nueva revisión' }));

    const dialog = await screen.findByRole('dialog', { name: /Nueva estructura/ });
    await user.click(within(dialog).getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: /WIP-000001/ }));

    expect(within(dialog).getByText(/Composición vigente de WIP-000001/)).toBeVisible();
    expect(within(dialog).getByText(/1 × PC-000001 · Asa azul/)).toBeVisible();
  });

  it('descarta un borrador propio con motivo sin eliminarlo', async () => {
    const draft = {
      id: 11,
      articulo_resultado_id: 2,
      numero_revision: 1,
      estado: 'BORRADOR',
      creada_por_id: 1,
      version: 1,
      articulo_resultado: articles[1],
      componentes: [{
        id: 21,
        articulo_id: 1,
        cantidad: 1,
        articulo: articles[0],
      }],
    };
    listarEstructurasScm.mockImplementation(
      (articleId) => Promise.resolve(Number(articleId) === 2 ? [draft] : []),
    );
    descartarEstructuraScm.mockResolvedValue({ ...draft, estado: 'DESCARTADA' });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('tab', { name: 'Estructuras BOM' }));
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: /WIP-000001/ }));
    await user.click(await screen.findByRole('button', { name: 'Descartar' }));
    const discardDialog = await screen.findByRole('dialog', {
      name: 'Descartar borrador de estructura',
    });
    await user.type(
      within(discardDialog).getByRole('textbox', { name: 'Motivo' }),
      'Borrador creado por error',
    );
    await user.click(within(discardDialog).getByRole('button', { name: 'Confirmar descarte' }));

    await waitFor(() => expect(descartarEstructuraScm).toHaveBeenCalledWith(
      draft,
      'Borrador creado por error',
    ));
  });

  it('permite a una jefatura publicar su borrador sin solicitar aprobación', async () => {
    const draft = {
      id: 15,
      articulo_resultado_id: 2,
      numero_revision: 1,
      estado: 'BORRADOR',
      creada_por_id: 1,
      version: 1,
      articulo_resultado: articles[1],
      componentes: [{
        id: 23,
        articulo_id: 1,
        cantidad: 1,
        articulo: articles[0],
      }],
    };
    listarEstructurasScm.mockImplementation(
      (articleId) => Promise.resolve(Number(articleId) === 2 ? [draft] : []),
    );
    publicarEstructuraScm.mockResolvedValue({ ...draft, estado: 'APROBADA' });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('tab', { name: 'Estructuras BOM' }));
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: /WIP-000001/ }));
    expect(screen.queryByRole('button', { name: 'Enviar a aprobación' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Publicar' }));
    const publishDialog = screen.getByRole('dialog', { name: 'Publicar estructura' });
    await user.click(within(publishDialog).getByRole('button', { name: 'Publicar estructura' }));

    await waitFor(() => expect(publicarEstructuraScm).toHaveBeenCalledWith(draft));
  });

  it('exige elegir el resultado y permite copiar una revisión histórica', async () => {
    const retired = {
      id: 12,
      articulo_resultado_id: 3,
      numero_revision: 1,
      estado: 'RETIRADA',
      creada_por_id: 1,
      version: 4,
      notas: 'Composición validada',
      articulo_resultado: articles[2],
      componentes: [{
        id: 22,
        articulo_id: 2,
        cantidad: 1,
        merma_tecnica_pct: 0,
        articulo: articles[1],
      }],
    };
    listarEstructurasScm.mockImplementation(
      (articleId) => Promise.resolve(Number(articleId) === 3 ? [retired] : []),
    );
    crearEstructuraScm.mockResolvedValue({ ...retired, id: 13, estado: 'BORRADOR' });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('tab', { name: 'Estructuras BOM' }));
    expect(screen.getByRole('button', { name: 'Nueva revisión' })).toBeDisabled();
    expect(screen.getByText(/Selecciona explícitamente/)).toBeVisible();

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: /PT-000001/ }));
    await user.click(screen.getByRole('button', { name: 'Mostrar historial (1)' }));
    await user.click(screen.getByRole('button', { name: 'Crear nueva basada en esta' }));
    const cloneDialog = screen.getByRole('dialog', {
      name: 'Crear nueva revisión basada en esta',
    });
    await user.click(within(cloneDialog).getByRole('button', { name: 'Crear borrador' }));

    await waitFor(() => expect(crearEstructuraScm).toHaveBeenCalledWith(3, {
      notas: 'Basada en revisión 1 · Composición validada',
      componentes: [{
        secuencia: 1,
        articulo_id: 2,
        cantidad: 1,
        unidad: 'UN',
        merma_tecnica_pct: 0,
      }],
    }));
  });

  it('advierte que retirar una revisión aprobada es irreversible', async () => {
    const approved = {
      id: 14,
      articulo_resultado_id: 3,
      numero_revision: 2,
      estado: 'APROBADA',
      creada_por_id: 2,
      version: 3,
      articulo_resultado: articles[2],
      componentes: [],
    };
    listarEstructurasScm.mockImplementation(
      (articleId) => Promise.resolve(Number(articleId) === 3 ? [approved] : []),
    );
    retirarEstructuraScm.mockResolvedValue({ ...approved, estado: 'RETIRADA' });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('tab', { name: 'Estructuras BOM' }));
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: /PT-000001/ }));
    await user.click(screen.getByRole('button', { name: 'Retirar' }));
    const retireDialog = screen.getByRole('dialog', { name: 'Retirar revisión aprobada' });
    expect(within(retireDialog).getByText(/retiro es irreversible/i)).toBeVisible();
    await user.click(within(retireDialog).getByRole('button', { name: 'Confirmar retiro' }));
    await waitFor(() => expect(retirarEstructuraScm).toHaveBeenCalledWith(approved));
  });
});
