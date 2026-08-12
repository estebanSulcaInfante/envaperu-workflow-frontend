import { createTheme, ThemeProvider } from '@mui/material';
import {
  render, screen, waitFor, waitForElementToBeRemoved, within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MemoryRouter, Route, Routes, useNavigate,
} from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductOnboardingPage from '../components/productOnboarding/ProductOnboardingPage';

vi.mock('../services/scmProductOnboardingApi', () => ({
  aplicarPasoAltaProducto: vi.fn(),
  crearAltaProducto: vi.fn(),
  guardarPasoAltaProducto: vi.fn(),
  obtenerAltaProducto: vi.fn(),
  obtenerResultadosDeAplicacion: vi.fn((payload) => payload?.application_results || null),
  obtenerSesionActualDeAplicacion: vi.fn(() => null),
  obtenerSesionActualDeConflicto: vi.fn(() => null),
  subirImagenAltaProducto: vi.fn(),
}));

vi.mock('../services/api', () => ({
  asociarFamiliaALinea: vi.fn(),
  actualizarProducto: vi.fn(),
  buscarPiezasGlobales: vi.fn(),
  buscarProductos: vi.fn(),
  crearFamiliaEnLinea: vi.fn(),
  crearLinea: vi.fn(),
  crearProducto: vi.fn(),
  obtenerFamilias: vi.fn(),
  obtenerLineas: vi.fn(),
  obtenerMoldes: vi.fn(),
}));

import {
  aplicarPasoAltaProducto,
  guardarPasoAltaProducto,
  obtenerAltaProducto,
  obtenerSesionActualDeConflicto,
  subirImagenAltaProducto,
} from '../services/scmProductOnboardingApi';
import {
  asociarFamiliaALinea,
  buscarProductos,
  buscarPiezasGlobales,
  crearFamiliaEnLinea,
  crearLinea,
  crearProducto,
  obtenerFamilias,
  obtenerLineas,
  obtenerMoldes,
} from '../services/api';

const session = {
  id: 'draft-1',
  estado: 'BORRADOR',
  version: 2,
  paso_actual: 'IDENTIDAD',
  pasos: [
    { codigo: 'IDENTIDAD', estado: 'EN_PROGRESO', data: {}, bloqueos: [] },
    { codigo: 'COMPONENTES', estado: 'PENDIENTE', data: {}, bloqueos: [] },
    { codigo: 'COLORES', estado: 'PENDIENTE', data: {}, bloqueos: [] },
    { codigo: 'ESTRUCTURA', estado: 'PENDIENTE', data: {}, bloqueos: [] },
    { codigo: 'RUTA_EMPAQUE', estado: 'PENDIENTE', data: {}, bloqueos: [] },
    { codigo: 'REVISION', estado: 'PENDIENTE', data: {}, bloqueos: [] },
  ],
  readiness: {},
  invalidated_steps: [],
};

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const renderPage = () => render(
  <ThemeProvider theme={createTheme()}>
    <MemoryRouter initialEntries={['/datos-maestros/alta-producto/draft-1/identidad']}>
      <Routes>
        <Route
          path="/datos-maestros/alta-producto/:draftId/:stepId"
          element={<ProductOnboardingPage />}
        />
        <Route path="/datos-maestros" element={<div>Hub de maestros</div>} />
      </Routes>
    </MemoryRouter>
  </ThemeProvider>,
);

function BrowserBackControl() {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(-1)}>Volver del navegador</button>;
}

const renderPageWithBackEntry = () => render(
  <ThemeProvider theme={createTheme()}>
    <MemoryRouter
      initialEntries={[
        '/datos-maestros/alta-producto/draft-1/componentes',
        '/datos-maestros/alta-producto/draft-1/identidad',
      ]}
      initialIndex={1}
    >
      <BrowserBackControl />
      <Routes>
        <Route
          path="/datos-maestros/alta-producto/:draftId/:stepId"
          element={<ProductOnboardingPage />}
        />
      </Routes>
    </MemoryRouter>
  </ThemeProvider>,
);

describe('alta integral de Producto Terminado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.localStorage?.clear();
    obtenerAltaProducto.mockResolvedValue(session);
    guardarPasoAltaProducto.mockResolvedValue({ ...session, version: 3 });
    aplicarPasoAltaProducto.mockResolvedValue({
      ...session,
      version: 3,
      paso_actual: 'IDENTIDAD',
      pasos: session.pasos.map((step) => step.codigo === 'IDENTIDAD' ? {
        ...step,
        estado: 'COMPLETADO',
        application_status: {
          status: 'APPLIED', application_key: 'identity-applied',
          resolved_references: { producto_terminado_id: 'PT-000123' },
        },
        data: {
          modo: 'NUEVO',
          producto: {
            producto: 'COLADOR #3', linea_id: 1, familia_id: 8,
          },
          procedencia: { referencia: 'SKU PIEZAS 2026.xlsx' },
        },
      } : step),
      referencias: { IDENTIDAD: { producto_terminado_id: 'PT-000123' } },
      application_results: { status: 'APPLIED', created: [], reused: [], pending: [] },
    });
    obtenerLineas.mockResolvedValue([{ id: 1, nombre: 'HOGAR' }]);
    obtenerFamilias.mockResolvedValue([{ id: 8, nombre: 'COCINA' }]);
    buscarProductos.mockResolvedValue([]);
    buscarPiezasGlobales.mockResolvedValue([]);
    obtenerMoldes.mockResolvedValue([]);
    crearProducto.mockResolvedValue({ cod_sku_pt: 'PT-000123', producto: 'COLADOR #3' });
    crearLinea.mockResolvedValue({ id: 2, nombre: 'NUEVA LINEA' });
    crearFamiliaEnLinea.mockResolvedValue({ familia: { id: 9, nombre: 'NUEVA FAMILIA' } });
    obtenerSesionActualDeConflicto.mockReturnValue(null);
    subirImagenAltaProducto.mockResolvedValue({
      ...session,
      version: 4,
      imagenes: [{
        entity_type: 'PRODUCTO_TERMINADO', entity_id: 'PT-000123',
        imagen_url: 'https://cdn.example/PT-000123.webp',
      }],
      image_results: {
        status: 'APPLIED', entity_type: 'PRODUCTO_TERMINADO', entity_id: 'PT-000123',
        imagen_url: 'https://cdn.example/PT-000123.webp',
      },
    });
  });

  it('expone las seis fases y acciones persistentes sin prometer altas futuras', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: /Alta integral de producto/i }))
      .toBeVisible();
    for (const label of [
      'Identidad y fuente', 'Componentes y moldes', 'Colores, recetas y SKU',
      'BOM y WIP', 'Ruta y empaque', 'Revisi\u00f3n',
    ]) expect(screen.getByText(label)).toBeVisible();

    const rail = screen.getByRole('navigation', { name: /Fases del alta/i });
    expect(rail).toHaveAttribute('data-desktop-layout', 'grid-3x2');
    expect(within(rail).getAllByRole('button')).toHaveLength(6);

    expect(screen.getByRole('button', { name: 'Atr\u00e1s' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Guardar y continuar' })).toBeVisible();
    expect(screen.getByRole('button', { name: /salir/i })).toBeVisible();
    expect(document.querySelector('[data-mobile-layout="stacked-actions"]')).toBeInTheDocument();
  });

  it('autoguarda la procedencia y la identidad en el borrador', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText(/Nombre del producto/i), 'COLADOR #3');
    await user.type(screen.getByLabelText(/Archivo o fuente/i), 'SKU PIEZAS 2026.xlsx');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(guardarPasoAltaProducto).toHaveBeenCalledWith(
      'draft-1',
      'IDENTIDAD',
      expect.objectContaining({
        expected_version: 2,
        data: expect.objectContaining({
          producto: expect.objectContaining({ producto: 'COLADOR #3' }),
          procedencia: expect.objectContaining({ referencia: 'SKU PIEZAS 2026.xlsx' }),
        }),
      }),
    ));
  });

  it('guarda cambios pendientes antes de salir del asistente', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText(/Nombre del producto/i), 'PORTAVAJILLAS');
    await user.click(screen.getByRole('button', { name: /Guardar y salir/i }));

    await waitFor(() => expect(guardarPasoAltaProducto).toHaveBeenCalledWith(
      'draft-1',
      'IDENTIDAD',
      expect.objectContaining({
        expected_version: 2,
        data: expect.objectContaining({
          producto: expect.objectContaining({ producto: 'PORTAVAJILLAS' }),
        }),
      }),
    ));
    expect(await screen.findByText('Hub de maestros')).toBeVisible();
  });

  it('guarda antes de navegar por el rail a otra fase', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText(/Nombre del producto/i), 'PORTAVAJILLAS');
    await user.click(screen.getByRole('button', { name: /Componentes y moldes/i }));

    await waitFor(() => expect(guardarPasoAltaProducto).toHaveBeenCalledWith(
      'draft-1',
      'IDENTIDAD',
      expect.objectContaining({ expected_version: 2 }),
    ));
    expect(await screen.findByRole('heading', { name: /Configurar moldes y piezas/i })).toBeVisible();
  });

  it('guarda antes de aceptar Back del navegador dentro de la SPA', async () => {
    const user = userEvent.setup();
    renderPageWithBackEntry();

    await user.type(await screen.findByLabelText(/Nombre del producto/i), 'PORTAVAJILLAS');
    await user.click(screen.getByRole('button', { name: /Volver del navegador/i }));

    await waitFor(() => expect(guardarPasoAltaProducto).toHaveBeenCalledWith(
      'draft-1',
      'IDENTIDAD',
      expect.objectContaining({
        expected_version: 2,
        data: expect.objectContaining({
          producto: expect.objectContaining({ producto: 'PORTAVAJILLAS' }),
        }),
      }),
    ));
    expect(await screen.findByRole('heading', { name: /Configurar moldes y piezas/i })).toBeVisible();
  });

  it('materializa un PT sin duplicar el SKU al completar Identidad', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText(/Nombre del producto/i), 'COLADOR #3');
    await user.type(screen.getByLabelText(/Archivo o fuente/i), 'SKU PIEZAS 2026.xlsx');
    const line = screen.getByRole('combobox', { name: /L\u00ednea/i });
    await user.click(line);
    await user.click(await screen.findByRole('option', { name: 'HOGAR' }));
    await waitFor(() => expect(obtenerFamilias).toHaveBeenCalledWith({ linea_id: 1 }));
    const family = screen.getByRole('combobox', { name: /Familia/i });
    await user.click(family);
    await user.click(await screen.findByRole('option', { name: 'COCINA' }));

    await user.click(screen.getByRole('button', { name: 'Guardar y continuar' }));

    await waitFor(() => expect(aplicarPasoAltaProducto).toHaveBeenCalledWith(
      'draft-1',
      'IDENTIDAD',
      expect.objectContaining({
        expected_version: 2,
        application_key: expect.stringMatching(/^identidad-.+/),
        data: expect.objectContaining({
          modo: 'NUEVO',
          producto: expect.objectContaining({
            producto: 'COLADOR #3', linea_id: 1, familia_id: 8,
          }),
        }),
      }),
    ));
    expect(await screen.findByRole('heading', { name: /Configurar moldes y piezas/i })).toBeVisible();
  });

  it('conserva la imagen local y la sube al SKU PT después de aplicar Identidad', async () => {
    const user = userEvent.setup();
    renderPage();
    const file = new File(['webp-real'], 'colador.webp', { type: 'image/webp' });

    await user.upload(
      await screen.findByLabelText(/Seleccionar imagen de Producto Terminado/i),
      file,
    );
    await user.type(screen.getByLabelText(/Nombre del producto/i), 'COLADOR #3');
    await user.type(screen.getByLabelText(/Archivo o fuente/i), 'SKU PIEZAS 2026.xlsx');
    await user.click(screen.getByRole('combobox', { name: /Línea/i }));
    await user.click(await screen.findByRole('option', { name: 'HOGAR' }));
    await waitFor(() => expect(obtenerFamilias).toHaveBeenCalledWith({ linea_id: 1 }));
    await user.click(screen.getByRole('combobox', { name: /Familia/i }));
    await user.click(await screen.findByRole('option', { name: 'COCINA' }));
    await user.click(screen.getByRole('button', { name: 'Guardar y continuar' }));

    await waitFor(() => expect(subirImagenAltaProducto).toHaveBeenCalledWith(
      'draft-1',
      'PRODUCTO_TERMINADO',
      'PT-000123',
      expect.objectContaining({
        file,
        expectedVersion: 3,
        applicationKey: expect.stringMatching(/^imagen-.+/),
      }),
    ));
    expect(await screen.findByRole('heading', { name: /Configurar moldes y piezas/i }))
      .toBeVisible();
  });

  it('encuentra por consulta remota un duplicado ausente de la carga inicial', async () => {
    buscarProductos.mockImplementation(async (query) => (
      query ? [{
        cod_sku_pt: 'PT-000900', producto: 'COLADOR #3', linea_id: 1, familia_id: 8,
      }] : []
    ));
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText(/Nombre del producto/i), 'COLADOR #3');

    await waitFor(() => expect(buscarProductos).toHaveBeenCalledWith('COLADOR #3'));
    const duplicateCode = await screen.findByText('PT-000900');
    expect(duplicateCode.closest('[role="alert"]')).toHaveTextContent(/Ya existe.*PT-000900/i);
  });

  it('crea Linea y luego Familia vinculada sin abandonar la fase', async () => {
    const user = userEvent.setup();
    renderPage();

    const line = await screen.findByRole('combobox', { name: /L\u00ednea/i });
    await user.type(line, 'nueva linea');
    await user.click(await screen.findByRole('option', { name: /Crear L\u00ednea.*nueva linea/i }));
    await user.click(screen.getByRole('button', { name: /Crear y seleccionar/i }));
    await waitFor(() => expect(crearLinea).toHaveBeenCalledWith({ nombre: 'NUEVA LINEA' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Nueva L\u00ednea/i })).not.toBeInTheDocument());
    expect(screen.getByRole('combobox', { name: /L\u00ednea/i })).toHaveValue('NUEVA LINEA');

    const family = screen.getByRole('combobox', { name: /Familia/i });
    await user.type(family, 'nueva familia');
    await user.click(await screen.findByRole('option', { name: /Crear Familia.*nueva familia/i }));
    await user.click(screen.getByRole('button', { name: /Crear y seleccionar/i }));

    await waitFor(() => expect(crearFamiliaEnLinea).toHaveBeenCalledWith(2, {
      nombre: 'NUEVA FAMILIA',
    }));
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog', { name: /Nueva Familia/i }));
    expect(screen.getByRole('combobox', { name: /Familia/i })).toHaveValue('NUEVA FAMILIA');
  });

  it('vincula una Familia global existente a la Linea sin duplicarla', async () => {
    obtenerFamilias.mockImplementation(async (params = {}) => (
      params.linea_id ? [] : [{ id: 8, nombre: 'COCINA' }]
    ));
    asociarFamiliaALinea.mockResolvedValue({ familia: { id: 8, nombre: 'COCINA' } });
    const user = userEvent.setup();
    renderPage();

    const line = await screen.findByRole('combobox', { name: /Línea/i });
    await user.click(line);
    await user.click(await screen.findByRole('option', { name: 'HOGAR' }));
    await waitFor(() => expect(obtenerFamilias).toHaveBeenCalledWith({ linea_id: 1 }));

    const family = screen.getByRole('combobox', { name: /Familia/i });
    await user.type(family, 'cocina');
    await user.click(await screen.findByRole('option', { name: /Crear Familia.*cocina/i }));

    expect(await screen.findByText(/ya existe globalmente/i)).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Vincular y seleccionar/i }));
    await waitFor(() => expect(asociarFamiliaALinea).toHaveBeenCalledWith(1, 8));
    expect(crearFamiliaEnLinea).not.toHaveBeenCalled();
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog', { name: /Nueva Familia/i }));
    expect(screen.getByRole('combobox', { name: /Familia/i })).toHaveValue('COCINA');
  });

  it('reactiva y vincula una Familia global inactiva antes de autoseleccionarla', async () => {
    obtenerFamilias.mockImplementation(async (params = {}) => (
      params.linea_id ? [] : [{ id: 18, nombre: 'LIMPIEZA', activo: false }]
    ));
    asociarFamiliaALinea.mockResolvedValue({
      familia: { id: 18, nombre: 'LIMPIEZA', activo: true },
    });
    const user = userEvent.setup();
    renderPage();

    const line = await screen.findByRole('combobox', { name: /Línea/i });
    await user.click(line);
    await user.click(await screen.findByRole('option', { name: 'HOGAR' }));
    const family = screen.getByRole('combobox', { name: /Familia/i });
    await user.type(family, 'limpieza');
    await user.click(await screen.findByRole('option', { name: /Crear Familia.*limpieza/i }));

    expect(await screen.findByText(/se reactivará y vinculará/i)).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Reactivar y vincular/i }));
    await waitFor(() => expect(asociarFamiliaALinea).toHaveBeenCalledWith(1, 18));
    expect(crearFamiliaEnLinea).not.toHaveBeenCalled();
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog', { name: /Nueva Familia/i }));
    expect(screen.getByRole('combobox', { name: /Familia/i })).toHaveValue('LIMPIEZA');
  });

  it('detiene el guardado cuando el servidor reporta una version mas nueva', async () => {
    const current = { ...session, version: 9 };
    const versionError = Object.assign(new Error('conflict'), {
      response: { status: 409 },
    });
    guardarPasoAltaProducto.mockRejectedValueOnce(versionError);
    obtenerSesionActualDeConflicto.mockReturnValue(current);
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText(/Nombre del producto/i), 'COLADOR #3');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText(/Otra persona guard\u00f3 este borrador/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /Cargar versi\u00f3n nueva/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /Reintentar mis cambios/i })).toBeVisible();
  });

  it('no pisa una edicion hecha mientras el autosave estaba en vuelo', async () => {
    const firstSave = deferred();
    guardarPasoAltaProducto
      .mockReturnValueOnce(firstSave.promise)
      .mockResolvedValueOnce({ ...session, version: 4 });
    const user = userEvent.setup();
    renderPage();

    const name = await screen.findByLabelText(/Nombre del producto/i);
    await user.type(name, 'COLADOR');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(guardarPasoAltaProducto).toHaveBeenCalledTimes(1));

    await user.type(name, ' #3');
    firstSave.resolve({ ...session, version: 3 });

    await waitFor(() => expect(name).toHaveValue('COLADOR #3'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(guardarPasoAltaProducto).toHaveBeenCalledWith(
      'draft-1',
      'IDENTIDAD',
      expect.objectContaining({
        expected_version: 3,
        data: expect.objectContaining({
          producto: expect.objectContaining({ producto: 'COLADOR #3' }),
        }),
      }),
    ));
  });
});
