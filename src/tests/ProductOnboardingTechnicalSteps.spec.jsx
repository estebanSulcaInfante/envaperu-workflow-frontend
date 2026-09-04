import { createTheme, ThemeProvider } from '@mui/material';
import {
  fireEvent, render, screen, waitFor, within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductOnboardingPage from '../components/productOnboarding/ProductOnboardingPage';
import {
  normalizeReviewData,
  readinessHasPendingApproval,
  reviewIsConfirmed,
} from '../components/productOnboarding/reviewStepModel';

const mockCapabilities = vi.hoisted(() => new Set());

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({ can: (capability) => mockCapabilities.has(capability) }),
}));

vi.mock('../services/scmProductOnboardingApi', () => ({
  aplicarPasoAltaProducto: vi.fn(),
  crearAltaProducto: vi.fn(),
  guardarPasoAltaProducto: vi.fn(),
  obtenerAltaProducto: vi.fn(),
  obtenerResultadosDeAplicacion: vi.fn((payload) => payload?.application_results || null),
  obtenerSesionActualDeAplicacion: vi.fn(() => null),
  obtenerSesionActualDeConflicto: vi.fn(() => null),
  restaurarColoresDesdeEstructura: vi.fn(),
  subirImagenAltaProducto: vi.fn(),
  finalizarAltaProducto: vi.fn(),
  validarAltaProducto: vi.fn(),
}));

vi.mock('../services/scmEngineeringApi', () => ({
  listarArticulosScm: vi.fn(),
  listarCentrosTrabajoScm: vi.fn(),
  listarEstructurasScm: vi.fn(),
  listarPerfilesEmpacablesScm: vi.fn(),
  listarReglasEmpaqueScm: vi.fn(),
  listarRutasScm: vi.fn(),
  listarTiposContenedorScm: vi.fn(),
  mensajeErrorScm: vi.fn((error, fallback) => error?.message || fallback),
}));

vi.mock('../services/api', () => ({
  asociarFamiliaALinea: vi.fn(),
  actualizarProducto: vi.fn(),
  buscarPiezasGlobales: vi.fn(),
  buscarProductos: vi.fn(),
  crearFamiliaColor: vi.fn(),
  crearFamiliaEnLinea: vi.fn(),
  crearLinea: vi.fn(),
  crearProducto: vi.fn(),
  obtenerColores: vi.fn(),
  obtenerFamilias: vi.fn(),
  obtenerFamiliasColor: vi.fn(),
  obtenerIngredientesRecetaColor: vi.fn(),
  obtenerLineas: vi.fn(),
  obtenerMoldes: vi.fn(),
  obtenerRecetasColorMaestras: vi.fn(),
}));

vi.mock('../services/scmCatalogApi', () => ({
  crearMaterialScm: vi.fn(),
  listarCategoriasRecepcionScm: vi.fn(),
}));

import {
  aplicarPasoAltaProducto,
  finalizarAltaProducto,
  guardarPasoAltaProducto,
  obtenerAltaProducto,
  obtenerResultadosDeAplicacion,
  obtenerSesionActualDeAplicacion,
  restaurarColoresDesdeEstructura,
  subirImagenAltaProducto,
  validarAltaProducto,
} from '../services/scmProductOnboardingApi';
import {
  listarArticulosScm,
  listarCentrosTrabajoScm,
  listarEstructurasScm,
  listarPerfilesEmpacablesScm,
  listarReglasEmpaqueScm,
  listarRutasScm,
  listarTiposContenedorScm,
} from '../services/scmEngineeringApi';
import {
  buscarPiezasGlobales,
  crearFamiliaColor,
  obtenerColores,
  obtenerFamiliasColor,
  obtenerIngredientesRecetaColor,
  obtenerMoldes,
  obtenerRecetasColorMaestras,
} from '../services/api';
import {
  crearMaterialScm,
  listarCategoriasRecepcionScm,
} from '../services/scmCatalogApi';

const baseSteps = [
  {
    codigo: 'IDENTIDAD', estado: 'COMPLETADO', bloqueos: [], application_status: {
      status: 'APPLIED', application_key: 'identity-applied', resolved_references: {
        producto_terminado_id: 'PT-000123',
      },
    }, data: {
      producto_ref: { cod_sku_pt: 'PT-000123', producto: 'COLADOR #3' },
    },
  },
  { codigo: 'COMPONENTES', estado: 'EN_PROGRESO', bloqueos: [], data: {} },
  { codigo: 'COLORES', estado: 'PENDIENTE', bloqueos: [], data: {} },
  { codigo: 'ESTRUCTURA', estado: 'PENDIENTE', bloqueos: [], data: {} },
  { codigo: 'RUTA_EMPAQUE', estado: 'PENDIENTE', bloqueos: [], data: {} },
  { codigo: 'REVISION', estado: 'PENDIENTE', bloqueos: [], data: {} },
];

const makeSession = (active) => ({
  id: 'draft-b',
  titulo: 'COLADOR #3',
  estado: 'BORRADOR',
  version: 7,
  paso_actual: active,
  pasos: baseSteps.map((step) => ({
    ...step,
    estado: step.codigo === active ? 'EN_PROGRESO' : step.estado,
  })),
  referencias: { producto_terminado_id: 'PT-000123' },
  readiness: {},
  invalidated_steps: [],
});

const renderStep = (slug) => render(
  <ThemeProvider theme={createTheme()}>
    <MemoryRouter initialEntries={[`/datos-maestros/alta-producto/draft-b/${slug}`]}>
      <Routes>
        <Route
          path="/datos-maestros/alta-producto/:draftId/:stepId"
          element={<ProductOnboardingPage />}
        />
      </Routes>
    </MemoryRouter>
  </ThemeProvider>,
);

const engineeringSession = (active) => {
  const draft = makeSession(active);
  const appliedRefs = {
    IDENTIDAD: { producto_terminado_id: 'PT-000123' },
    COMPONENTES: {
      molde_ref: 'ML-000008',
      piezas: [{ client_id: 'pieza-1', pieza_ref: 41, molde_pieza_ref: 71 }],
    },
    COLORES: {
      colores: [{ client_id: 'color-1', color_ref: 12 }],
      matriz: [{ pieza_ref: 41, color_ref: 12, pieza_color_ref: 11 }],
      formulaciones: [{ color_ref: 12, receta_ref: 5, estado: 'RESUELTA' }],
    },
  };
  draft.referencias = appliedRefs;
  draft.pasos = draft.pasos.map((step) => {
    if (['IDENTIDAD', 'COMPONENTES', 'COLORES'].includes(step.codigo)) {
      return {
        ...step,
        estado: 'COMPLETADO',
        application_status: {
          status: 'APPLIED', application_key: `${step.codigo.toLowerCase()}-applied`,
          resolved_references: appliedRefs[step.codigo],
        },
      };
    }
    return step.codigo === active ? { ...step, estado: 'EN_PROGRESO' } : step;
  });
  return draft;
};

const routeReuseSession = ({ publishRule = false } = {}) => {
  const draft = engineeringSession('RUTA_EMPAQUE');
  const routePayload = {
    notas: 'Ruta existente',
    operaciones: [{
      clave: 'OP1', secuencia_visible: 1, nombre: 'Armar producto', tipo: 'ENSAMBLE',
      executor_kind: 'OP_OT', centro_trabajo_id: 5, articulo_salida_id: 30,
      estructura_revision_id: null, permite_concurrente: false,
    }],
    precedencias: [],
  };
  draft.referencias.ESTRUCTURA = { estructura_revision_ref: 44 };
  draft.pasos = draft.pasos.map((step) => step.codigo === 'ESTRUCTURA' ? {
    ...step,
    estado: 'COMPLETADO',
    application_status: {
      status: 'APPLIED', application_key: 'estructura-applied',
      resolved_references: { estructura_revision_ref: 44 },
    },
  } : step.codigo === 'RUTA_EMPAQUE' ? {
    ...step,
    data: {
      target_product_ref: 'PT-000123',
      target_article_ref: 30,
      ruta: { modo: 'REUTILIZAR', revision_ref: 55, accion: 'VINCULAR', payload: routePayload },
      empaques: [{
        client_id: 'empaque-30',
        articulo_ref: 30,
        perfil_empacable: { modo: 'REUTILIZAR', ref: 8, asignar_predeterminado: true },
        regla_empaque: {
          modo: 'REUTILIZAR', revision_ref: 9,
          accion: publishRule ? 'PUBLICAR' : 'VINCULAR',
        },
      }],
    },
  } : step);
  return { draft, routePayload };
};

describe('TS-017B: fases tecnicas del alta integral', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.localStorage?.clear();
    mockCapabilities.clear();
    [
      'ARTICULO_ADMINISTRAR',
      'ESTRUCTURA_VER', 'ESTRUCTURA_ADMINISTRAR', 'ESTRUCTURA_PUBLICAR_DIRECTO',
      'RUTA_VER', 'RUTA_ADMINISTRAR', 'RUTA_PUBLICAR_DIRECTO',
      'EMPAQUE_VER', 'EMPAQUE_ADMINISTRAR', 'EMPAQUE_PUBLICAR_DIRECTO',
    ].forEach((capability) => mockCapabilities.add(capability));
    obtenerMoldes.mockResolvedValue([{
      codigo: 'ML-000008', nombre: 'MOLDE COLADOR #3', piezas: [],
    }]);
    buscarPiezasGlobales.mockResolvedValue([{
      id: 41, codigo: 'PZ-000041', nombre: 'CUERPO COLADOR #3', peso_nominal_gr: 80,
    }]);
    obtenerColores.mockResolvedValue([{
      id: 12, nombre: 'AZUL SOLIDO', familia_color_id: 3, familia_color_nombre: 'SOLIDO',
    }]);
    obtenerFamiliasColor.mockResolvedValue([{ id: 3, nombre: 'SOLIDO' }]);
    obtenerIngredientesRecetaColor.mockResolvedValue([]);
    obtenerRecetasColorMaestras.mockResolvedValue({ items: [] });
    listarCategoriasRecepcionScm.mockResolvedValue([{
      id: 4, codigo: 'LEGACY_POR_CONFIGURAR', nombre: 'Por configurar', activo: true,
    }]);
    listarArticulosScm.mockResolvedValue([
      {
        id: 30, codigo: 'PT-000123', nombre: 'COLADOR #3', clase: 'PRODUCTO_TERMINADO',
        subtipo: { producto_terminado_id: 'PT-000123' }, version: 1,
      },
      { id: 11, codigo: 'PC-000011', nombre: 'CUERPO AZUL', clase: 'PIEZA_COLOR' },
    ]);
    listarCentrosTrabajoScm.mockResolvedValue([
      { id: 5, codigo: 'CT-000005', nombre: 'Sopladora', tipo: 'SOPLADO', activo: true },
    ]);
    listarEstructurasScm.mockResolvedValue([]);
    listarPerfilesEmpacablesScm.mockResolvedValue([]);
    listarReglasEmpaqueScm.mockResolvedValue([]);
    listarRutasScm.mockResolvedValue([]);
    listarTiposContenedorScm.mockResolvedValue([
      { id: 9, codigo: 'TMG-000009', nombre: 'Manga grande', activo: true },
    ]);
  });

  it('permite varios grupos Molde-Piezas dentro del mismo PT', async () => {
    obtenerAltaProducto.mockResolvedValue(makeSession('COMPONENTES'));
    const user = userEvent.setup();
    renderStep('componentes');

    expect(await screen.findByRole('heading', { name: /Configurar moldes y piezas/i }))
      .toBeVisible();
    expect(screen.getByRole('button', { name: /Crear molde/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /Reutilizar molde/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /A\u00f1adir pieza/i })).toBeVisible();
    await user.click(screen.getByRole('button', { name: /A\u00f1adir otro molde/i }));
    expect(screen.getAllByText(/Grupo de fabricaci\u00f3n/i)).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /Crear molde/i })).toHaveLength(2);
    expect(screen.queryByText(/carga temporal segura|pendiente explícito/i))
      .not.toBeInTheDocument();
    expect(screen.queryByText(/Fase representada/i)).not.toBeInTheDocument();
  });

  it('presenta Color por molde, matriz Pieza por Color y formulacion explicita', async () => {
    const session = makeSession('COLORES');
    session.pasos = session.pasos.map((step) => step.codigo === 'COMPONENTES' ? {
      ...step,
      estado: 'COMPLETADO',
      data: {
        molde_ref: { codigo: 'ML-000008', nombre: 'MOLDE COLADOR #3' },
        piezas: [{ pieza_ref: { id: 41, codigo: 'PZ-000041', nombre: 'CUERPO COLADOR #3' } }],
      },
    } : step);
    obtenerAltaProducto.mockResolvedValue(session);
    renderStep('colores');

    expect(await screen.findByRole('heading', { name: /Colores de todas las piezas/i })).toBeVisible();
    expect(screen.getByText('Acabado')).toBeVisible();
    expect(screen.queryByText('FamiliaColor')).not.toBeInTheDocument();
    expect(screen.getByText(/Matriz Pieza.*Color/i)).toBeVisible();
    for (const option of ['Existente', 'Nueva', 'Sin pigmento', 'Pendiente']) {
      expect(screen.getByText(option)).toBeVisible();
    }
    expect(screen.getByText(/No se inventan ingredientes/i)).toBeVisible();
    expect(screen.queryByText(/Fase representada/i)).not.toBeInTheDocument();
  });

  it('rehidrata nombres, HEX y detalle de receta sin mostrar identificadores tecnicos', async () => {
    const session = makeSession('COLORES');
    const clientId = 'color-67522946-958a-4f61-a507-6df77dbc4a55';
    const componentRefs = {
      molde_ref: 'ML-000008',
      piezas: [{ client_id: 'pieza-1', pieza_ref: 41, molde_pieza_ref: 71 }],
    };
    const colorRefs = {
      colores: [{ client_id: clientId, color_ref: 12 }],
      matriz: [{
        pieza_ref: 41,
        pieza_client_id: 'pieza-1',
        color_ref: 12,
        color_client_id: clientId,
        pieza_color_ref: 'PC-000011',
      }],
      formulaciones: [{
        color_ref: 12,
        color_client_id: clientId,
        receta_ref: 5,
        estado: 'RESUELTA',
      }],
    };
    session.referencias = {
      IDENTIDAD: { producto_terminado_id: 'PT-000123' },
      COMPONENTES: componentRefs,
      COLORES: colorRefs,
    };
    session.pasos = session.pasos.map((step) => {
      if (step.codigo === 'COMPONENTES') {
        return {
          ...step,
          estado: 'COMPLETADO',
          data: {
            molde_ref: { codigo: 'ML-000008', nombre: 'MOLDE COLADOR #3' },
            piezas: [{ pieza_ref: { id: 41, codigo: 'PZ-000041', nombre: 'CUERPO COLADOR #3' } }],
          },
          application_status: {
            status: 'APPLIED',
            application_key: 'components-applied',
            resolved_references: componentRefs,
          },
        };
      }
      if (step.codigo === 'COLORES') {
        return {
          ...step,
          estado: 'COMPLETADO',
          data: {
            color_molde_ref: 'ML-000008',
            colores: [{ client_id: clientId, modo: 'REUTILIZAR', color_ref: 12 }],
            matriz: [{ pieza_ref: 41, color_ref: 12, seleccionada: true }],
            formulaciones: [{
              color_ref: 12,
              tipo: 'NUEVA',
              base_virgen_kg: 25,
              componentes: [{
                material_id: 91,
                tipo_componente: 'MATERIA_PRIMA',
                cantidad: 1,
              }],
            }],
          },
          application_status: {
            status: 'APPLIED',
            application_key: 'colors-applied',
            created: [
              { type: 'PIEZA_COLOR', id: 'PC-000011' },
              { type: 'RECETA_COLOR', id: 5 },
            ],
            reused: [{ type: 'COLOR_PRODUCCION', id: 12, client_id: clientId }],
            pending: [],
            resolved_references: colorRefs,
          },
        };
      }
      return step;
    });
    obtenerColores.mockResolvedValue([{
      id: 12,
      nombre: 'AZUL SÓLIDO',
      familia_color_id: 3,
      familia_color_nombre: 'SÓLIDO',
      hex_referencia: '#303F9F',
    }]);
    obtenerRecetasColorMaestras.mockResolvedValue({
      items: [{
        id: 5,
        color_produccion_id: 12,
        color_nombre: 'AZUL SÓLIDO',
        nombre_variante: 'Alta guiada AZUL SÓLIDO',
        revision: 1,
        estado: 'BORRADOR',
        base_virgen_kg: 25,
        lineas: [{
          id: 501,
          material_id: 91,
          material_codigo: 'MP-000003',
          material_nombre: 'PP Clarificado',
          tipo_componente: 'MATERIA_PRIMA',
          cantidad: 1,
          unidad: 'FRACCION',
          orden: 1,
        }],
      }],
    });
    obtenerAltaProducto.mockResolvedValue(session);

    renderStep('colores');

    expect(await screen.findByText('Reutilizado · AZUL SÓLIDO')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Formulación · AZUL SÓLIDO' })).toBeVisible();
    expect(screen.getByText('Detalle de la receta seleccionada')).toBeVisible();
    expect(screen.getByText(/MP-000003/)).toBeVisible();
    expect(screen.getByText(/PP Clarificado/)).toBeVisible();
    expect(screen.getAllByLabelText('Referencia visual #303F9F').length).toBeGreaterThan(0);
    expect(screen.queryByText(clientId)).not.toBeInTheDocument();
  });

  it('nombra piezas y colores rehidratados y restaura una fase invalidada desde la BOM', async () => {
    const session = makeSession('COLORES');
    const colorsData = {
      colores: [{
        client_id: 'color-aplicado', modo: 'REUTILIZAR', color_ref: 12,
      }],
      matriz: [
        { pieza_ref: 41, color_ref: 12, seleccionada: true, pieza_color_ref: 'PC-000011' },
        { pieza_ref: 42, color_ref: 12, seleccionada: false },
      ],
      formulaciones: [{
        color_ref: 12, color_client_id: 'color-aplicado', tipo: 'EXISTENTE', receta_ref: 5,
      }],
    };
    const colorRefs = {
      colores: [{ client_id: 'color-aplicado', color_ref: 12 }],
      matriz: [{ pieza_ref: 41, color_ref: 12, pieza_color_ref: 'PC-000011' }],
      formulaciones: [{ color_ref: 12, receta_ref: 5, estado: 'RESUELTA' }],
    };
    session.invalidated_steps = ['COLORES', 'ESTRUCTURA'];
    session.referencias = {
      IDENTIDAD: { producto_terminado_id: 'PT-000123' },
      COMPONENTES: {
        moldes: [{
          client_id: 'molde-uno', molde_ref: 'ML-000008', piezas: [
            { client_id: 'pieza-uno', pieza_ref: 41, molde_pieza_ref: 71 },
            { client_id: 'pieza-dos', pieza_ref: 42, molde_pieza_ref: 72 },
          ],
        }],
        piezas: [
          { client_id: 'pieza-uno', pieza_ref: 41, molde_pieza_ref: 71 },
          { client_id: 'pieza-dos', pieza_ref: 42, molde_pieza_ref: 72 },
        ],
      },
      COLORES: colorRefs,
      ESTRUCTURA: { estructura_revision_ref: 44 },
    };
    session.pasos = session.pasos.map((step) => step.codigo === 'COMPONENTES' ? {
      ...step,
      estado: 'COMPLETADO',
      data: {
        moldes: [{
          client_id: 'molde-uno', molde: { modo: 'REUTILIZAR', ref: 'ML-000008' },
          piezas: [
            { client_id: 'pieza-uno', modo: 'REUTILIZAR', ref: 41, cavidades: 1, peso_unitario_gr: 80 },
            { client_id: 'pieza-dos', modo: 'REUTILIZAR', ref: 42, cavidades: 1, peso_unitario_gr: 20 },
          ],
        }],
      },
      application_status: {
        status: 'APPLIED', application_key: 'components-applied',
        resolved_references: session.referencias.COMPONENTES,
      },
    } : step.codigo === 'COLORES' ? {
      ...step,
      estado: 'INVALIDADO',
      data: colorsData,
      application_status: {
        status: 'APPLIED', application_key: 'colors-applied',
        resolved_references: colorRefs,
      },
    } : step.codigo === 'ESTRUCTURA' ? { ...step, estado: 'INVALIDADO' } : step);
    buscarPiezasGlobales.mockResolvedValue([
      { id: 41, codigo: 'PZ-000041', nombre: 'CUERPO COLADOR' },
      { id: 42, codigo: 'PZ-000042', nombre: 'TAPA COLADOR' },
    ]);
    obtenerAltaProducto.mockResolvedValue(session);
    restaurarColoresDesdeEstructura.mockResolvedValue({
      ...session,
      version: 8,
      color_recovery: { piezas_color: 2 },
      pasos: session.pasos.map((step) => step.codigo === 'COLORES'
        ? { ...step, estado: 'EN_PROGRESO', data: colorsData }
        : step),
    });
    const user = userEvent.setup();
    renderStep('colores');

    expect(await screen.findByRole('columnheader', { name: /PZ-000041.*CUERPO COLADOR/i })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: /PZ-000042.*TAPA COLADOR/i })).toBeVisible();
    expect(screen.getByText('AZUL SOLIDO')).toBeVisible();
    expect(screen.queryByText('Color sin nombre')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Restaurar desde la BOM/i }));
    await waitFor(() => expect(restaurarColoresDesdeEstructura)
      .toHaveBeenCalledWith('draft-b', 7));
  });

  it('crea un tipo de color contextual y sincroniza la paleta con el HEX', async () => {
    const session = makeSession('COLORES');
    session.pasos = session.pasos.map((step) => step.codigo === 'COMPONENTES' ? {
      ...step,
      estado: 'COMPLETADO',
      application_status: {
        status: 'APPLIED', application_key: 'components-applied', resolved_references: {
          molde_ref: 'ML-000008',
          piezas: [{ client_id: 'pieza-1', pieza_ref: 41, molde_pieza_ref: 71 }],
        },
      },
      data: {
        molde: { modo: 'REUTILIZAR', ref: 'ML-000008' },
        piezas: [{
          client_id: 'pieza-1', modo: 'REUTILIZAR', ref: 41,
          nombre: 'CUERPO COLADOR #3', cavidades: 1, peso_unitario_gr: 80,
        }],
      },
    } : step);
    session.referencias = {
      IDENTIDAD: { producto_terminado_id: 'PT-000123' },
      COMPONENTES: {
        molde_ref: 'ML-000008',
        piezas: [{ client_id: 'pieza-1', pieza_ref: 41, molde_pieza_ref: 71 }],
      },
    };
    crearFamiliaColor.mockResolvedValue({ id: 9, nombre: 'TRANSLUCIDO', activo: true });
    obtenerAltaProducto.mockResolvedValue(session);
    guardarPasoAltaProducto.mockImplementation(async (_draft, _step, command) => ({
      ...session,
      version: command.expected_version + 1,
      pasos: session.pasos.map((step) => step.codigo === 'COLORES'
        ? { ...step, data: command.data }
        : step),
    }));
    const user = userEvent.setup();
    renderStep('colores');

    await user.click(await screen.findByRole('button', { name: /Añadir color/i }));
    await user.type(screen.getByLabelText(/Nombre del color/i), 'HUMO');
    await user.click(screen.getByRole('button', { name: /Crear tipo de color/i }));
    await user.type(screen.getByLabelText(/Nombre del tipo/i), 'Translúcido');
    await user.click(screen.getByRole('button', { name: /Guardar tipo/i }));

    await waitFor(() => expect(crearFamiliaColor).toHaveBeenCalledWith({ nombre: 'Translúcido' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Nuevo tipo de color/i })).not.toBeInTheDocument());
    expect(screen.getByLabelText(/Acabado \/ tipo de color/i)).toHaveTextContent('TRANSLUCIDO');

    fireEvent.change(screen.getByLabelText(/Escoger color de la paleta/i), {
      target: { value: '#A1B2C3' },
    });
    expect(screen.getByLabelText(/HEX de referencia/i)).toHaveValue('#A1B2C3');

    await user.click(screen.getByRole('button', { name: 'Nueva' }));
    expect(screen.getByLabelText(/Base virgen/i)).toHaveValue(25);

    crearMaterialScm.mockResolvedValue({
      id: 88, codigo: 'ADT-000088', nombre: 'UV MASTER', clase: 'COLORANTE',
      tipo_colorante: 'ADITIVO', activo: true,
    });
    obtenerIngredientesRecetaColor.mockResolvedValue([{
      id: 88, codigo: 'ADT-000088', nombre: 'UV MASTER', clase: 'COLORANTE',
      tipo_colorante: 'ADITIVO', activo: true,
    }]);
    await user.click(screen.getByRole('button', { name: /Añadir ingrediente/i }));
    await user.click(screen.getByRole('combobox', { name: 'Rol' }));
    await user.click(screen.getByRole('option', { name: 'Aditivo' }));
    await user.click(screen.getByRole('button', { name: /Crear aditivo/i }));
    await user.type(screen.getByLabelText(/Nombre del material/i), 'UV MASTER');
    await user.click(screen.getByRole('button', { name: /Crear y seleccionar/i }));

    await waitFor(() => expect(crearMaterialScm).toHaveBeenCalledWith({
      nombre: 'UV MASTER',
      clase: 'COLORANTE',
      categoria_recepcion_id: 4,
      unidad_base: 'KG',
      activo: true,
      tipo_colorante: 'ADITIVO',
    }));
    expect(await screen.findByRole('combobox', { name: 'Material' })).toHaveTextContent('UV MASTER');
  });

  it('reabre Colores aplicado pero pendiente y permite completar, añadir o quitar', async () => {
    const session = makeSession('COLORES');
    const colorsData = {
      color_molde_ref: 'ML-000008',
      colores: [{
        client_id: 'color-1', modo: 'REUTILIZAR', color_ref: 12,
        nombre: 'AZUL SOLIDO', familia_color_id: 3, hex: '#123456',
      }],
      matriz: [{ pieza_ref: 41, color_ref: 12, seleccionada: true }],
      formulaciones: [{
        color_ref: 12, color_client_id: 'color-1', tipo: 'PENDIENTE',
        motivo_pendiente: 'Falta confirmar receta', componentes: [], estado: 'PENDIENTE',
      }],
    };
    const colorRefs = {
      colores: [{ client_id: 'color-1', color_ref: 12 }],
      matriz: [{ pieza_ref: 41, color_ref: 12, pieza_color_ref: 'PC-000012' }],
      formulaciones: [{ color_ref: 12, estado: 'PENDIENTE' }],
    };
    session.version = 35;
    session.referencias = {
      IDENTIDAD: { producto_terminado_id: 'PT-000123' },
      COMPONENTES: {
        molde_ref: 'ML-000008',
        piezas: [{ client_id: 'pieza-1', pieza_ref: 41, molde_pieza_ref: 71 }],
      },
      COLORES: colorRefs,
    };
    session.pasos = session.pasos.map((step) => step.codigo === 'COMPONENTES' ? {
      ...step,
      estado: 'COMPLETADO',
      application_status: {
        status: 'APPLIED', application_key: 'components-applied',
        resolved_references: session.referencias.COMPONENTES,
      },
      data: {
        molde: { modo: 'REUTILIZAR', ref: 'ML-000008' },
        piezas: [{
          client_id: 'pieza-1', modo: 'REUTILIZAR', ref: 41,
          nombre: 'CUERPO COLADOR #3', cavidades: 1, peso_unitario_gr: 80,
        }],
      },
    } : step.codigo === 'COLORES' ? {
      ...step,
      estado: 'EN_PROGRESO',
      data: colorsData,
      application_status: {
        status: 'APPLIED', application_key: 'colors-pending-v1',
        resolved_references: colorRefs, pending: [{ type: 'FORMULACION', color_ref: 12 }],
      },
    } : step);
    aplicarPasoAltaProducto.mockResolvedValue({
      ...session,
      version: 36,
      application_results: { status: 'APPLIED', application_key: 'colors-pending-v2' },
    });
    obtenerAltaProducto.mockResolvedValue(session);
    const user = userEvent.setup();
    renderStep('colores');

    expect(await screen.findByText(/Esta fase necesita completarse/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /Añadir color/i })).toBeDisabled();
    const completePhase = screen.getByRole('button', { name: /Completar fase/i });
    expect(completePhase).toHaveClass('MuiButton-contained');
    await user.click(completePhase);

    expect(screen.getByRole('button', { name: /Añadir color/i })).toBeEnabled();
    expect(screen.getByLabelText(/Motivo pendiente/i)).toBeEnabled();
    await user.clear(screen.getByLabelText(/Motivo pendiente/i));
    await user.type(screen.getByLabelText(/Motivo pendiente/i), 'Validar con mezclas mañana');
    await user.click(screen.getByRole('button', { name: /Aplicar corrección/i }));

    await waitFor(() => expect(aplicarPasoAltaProducto).toHaveBeenCalled());
    expect(aplicarPasoAltaProducto.mock.calls.at(-1)[2]).toMatchObject({
      expected_version: 35,
      supersedes_application_key: 'colors-pending-v1',
    });
  });

  it('reabre Colores aplicado sin pendientes y conserva la receta elegida por pieza', async () => {
    const session = makeSession('COLORES');
    const componentsRefs = {
      molde_ref: 'ML-000008',
      piezas: [{ client_id: 'pieza-1', pieza_ref: 41, molde_pieza_ref: 71 }],
    };
    const colorsData = {
      color_molde_ref: 'ML-000008',
      colores: [{
        client_id: 'color-1', modo: 'REUTILIZAR', color_ref: 12,
        nombre: 'AZUL SOLIDO', familia_color_id: 3, hex: '#123456',
      }],
      matriz: [{ pieza_ref: 41, color_ref: 12, seleccionada: true }],
      formulaciones: [{
        color_ref: 12, color_client_id: 'color-1', tipo: 'EXISTENTE', receta_ref: 5,
      }],
    };
    const colorRefs = {
      colores: [{ client_id: 'color-1', color_ref: 12 }],
      matriz: [{ pieza_ref: 41, color_ref: 12, pieza_color_ref: 'PC-000012' }],
      formulaciones: [{ color_ref: 12, receta_ref: 5, estado: 'RESUELTA' }],
    };
    session.version = 264;
    session.referencias = {
      IDENTIDAD: { producto_terminado_id: 'PT-000123' },
      COMPONENTES: componentsRefs,
      COLORES: colorRefs,
    };
    session.pasos = session.pasos.map((step) => step.codigo === 'COMPONENTES' ? {
      ...step,
      estado: 'COMPLETADO',
      data: {
        molde: { modo: 'REUTILIZAR', ref: 'ML-000008' },
        piezas: [{
          client_id: 'pieza-1', modo: 'REUTILIZAR', ref: 41,
          nombre: 'CUERPO COLADOR #3', cavidades: 1, peso_unitario_gr: 80,
        }],
      },
      application_status: {
        status: 'APPLIED', application_key: 'components-applied',
        resolved_references: componentsRefs,
      },
    } : step.codigo === 'COLORES' ? {
      ...step,
      estado: 'EN_PROGRESO',
      data: colorsData,
      application_status: {
        status: 'APPLIED', application_key: 'colors-applied-v1',
        resolved_references: colorRefs, pending: [],
      },
    } : step);
    obtenerRecetasColorMaestras.mockResolvedValue({
      items: [
        {
          id: 5, color_produccion_id: 12, nombre_variante: 'GENERAL',
          revision: 1, estado: 'APROBADA',
        },
        {
          id: 6, color_produccion_id: 12, nombre_variante: 'CABINA',
          revision: 2, estado: 'APROBADA',
        },
      ],
    });
    aplicarPasoAltaProducto.mockImplementation(async (_draft, _step, command) => ({
      ...session,
      version: 265,
      pasos: session.pasos.map((step) => step.codigo === 'COLORES'
        ? { ...step, data: command.data }
        : step),
      application_results: { status: 'APPLIED', application_key: command.application_key },
    }));
    obtenerAltaProducto.mockResolvedValue(session);
    const user = userEvent.setup();
    renderStep('colores');

    const recipeSelect = await screen.findByRole('combobox', {
      name: /Receta de AZUL SOLIDO en.*CUERPO COLADOR/i,
    });
    expect(recipeSelect).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByRole('button', { name: /Reabrir borrador/i }));
    expect(recipeSelect).not.toHaveAttribute('aria-disabled', 'true');

    await user.click(recipeSelect);
    await user.click(screen.getByRole('option', { name: /CABINA.*revisi.n 2/i }));
    expect(recipeSelect).toHaveTextContent(/CABINA.*revisi.n 2/i);
    await user.click(screen.getByRole('button', { name: /Aplicar correcci.n/i }));

    await waitFor(() => expect(aplicarPasoAltaProducto).toHaveBeenCalled());
    expect(aplicarPasoAltaProducto.mock.calls.at(-1)[2]).toMatchObject({
      expected_version: 264,
      supersedes_application_key: 'colors-applied-v1',
      data: {
        matriz: [expect.objectContaining({
          pieza_ref: 41,
          color_ref: 12,
          receta_ref: 6,
        })],
      },
    });
  });

  it('sube la muestra al SKU PiezaColor resuelto después de aplicar la matriz', async () => {
    const initial = makeSession('COLORES');
    const componentsRefs = {
      molde_ref: 'ML-000008',
      piezas: [{ client_id: 'pieza-1', pieza_ref: 41, molde_pieza_ref: 71 }],
    };
    const colorsData = {
      color_molde_ref: 'ML-000008',
      colores: [{
        client_id: 'color-1', modo: 'REUTILIZAR', color_ref: 12, nombre: 'AZUL SOLIDO',
      }],
      matriz: [{ pieza_ref: 41, color_ref: 12, seleccionada: true }],
      formulaciones: [{
        color_ref: 12, color_client_id: 'color-1', tipo: 'EXISTENTE', receta_ref: 5,
      }],
    };
    initial.referencias = {
      IDENTIDAD: { producto_terminado_id: 'PT-000123' },
      COMPONENTES: componentsRefs,
    };
    initial.pasos = initial.pasos.map((step) => step.codigo === 'COMPONENTES' ? {
      ...step,
      estado: 'COMPLETADO',
      data: {
        molde: { modo: 'REUTILIZAR', ref: 'ML-000008' },
        piezas: [{
          client_id: 'pieza-1', modo: 'REUTILIZAR', ref: 41,
          nombre: 'CUERPO COLADOR #3', cavidades: 1, peso_unitario_gr: 80,
        }],
      },
      application_status: {
        status: 'APPLIED', application_key: 'componentes-applied',
        resolved_references: componentsRefs,
      },
    } : step.codigo === 'COLORES' ? { ...step, data: colorsData } : step);
    const colorsRefs = {
      colores: [{ client_id: 'color-1', color_ref: 12 }],
      matriz: [{
        pieza_ref: 41, color_ref: 12, pieza_color_ref: 11,
      }],
      formulaciones: [{ color_ref: 12, receta_ref: 5, estado: 'RESUELTA' }],
    };
    let appliedSession;
    aplicarPasoAltaProducto.mockImplementation(async (_draft, _step, command) => {
      appliedSession = {
        ...initial,
        version: 8,
        referencias: { ...initial.referencias, COLORES: colorsRefs },
        pasos: initial.pasos.map((step) => step.codigo === 'COLORES' ? {
          ...step,
          estado: 'COMPLETADO',
          data: command.data,
          application_status: {
            status: 'APPLIED', application_key: command.application_key,
            resolved_references: colorsRefs,
          },
        } : step),
        application_results: { status: 'APPLIED', application_key: command.application_key },
      };
      return appliedSession;
    });
    subirImagenAltaProducto.mockImplementation(async () => ({
      ...appliedSession,
      version: 9,
      imagenes: [{
        entity_type: 'PIEZA_COLOR', entity_id: 11,
        imagen_url: 'https://cdn.example/PC-000011.webp',
      }],
      image_results: {
        status: 'APPLIED', entity_type: 'PIEZA_COLOR', entity_id: 11,
        imagen_url: 'https://cdn.example/PC-000011.webp',
      },
    }));
    obtenerAltaProducto.mockResolvedValue(initial);
    const user = userEvent.setup();
    renderStep('colores');
    const file = new File(['webp-real'], 'cuerpo-azul.webp', { type: 'image/webp' });

    await user.upload(
      await screen.findByLabelText(/Seleccionar imagen de CUERPO COLADOR.*AZUL SOLIDO/i),
      file,
    );
    await user.click(screen.getByRole('button', { name: /Aplicar y continuar/i }));

    await waitFor(() => expect(subirImagenAltaProducto).toHaveBeenCalledWith(
      'draft-b',
      'PIEZA_COLOR',
      11,
      expect.objectContaining({
        file,
        expectedVersion: 8,
        applicationKey: expect.stringMatching(/^imagen-.+/),
      }),
    ));
  });

  it('muestra por celda creación, formulación e imagen guardada o faltante', async () => {
    const applied = engineeringSession('COLORES');
    const componentData = {
      molde: { modo: 'REUTILIZAR', ref: 'ML-000008' },
      piezas: [
        {
          client_id: 'pieza-cuerpo', modo: 'REUTILIZAR', ref: 41,
          nombre: 'CUERPO COLADOR', cavidades: 1, peso_unitario_gr: 80,
        },
        {
          client_id: 'pieza-tapa', modo: 'REUTILIZAR', ref: 42,
          nombre: 'TAPA COLADOR', cavidades: 1, peso_unitario_gr: 20,
        },
      ],
    };
    const colorsData = {
      color_molde_ref: 'ML-000008',
      colores: [{
        client_id: 'color-azul', modo: 'REUTILIZAR', color_ref: 12,
        nombre: 'AZUL SOLIDO',
      }],
      matriz: [
        { pieza_ref: 41, color_ref: 12, seleccionada: true },
        { pieza_ref: 42, color_ref: 12, seleccionada: true },
      ],
      formulaciones: [{
        color_ref: 12, color_client_id: 'color-azul', tipo: 'EXISTENTE', receta_ref: 5,
      }],
    };
    const colorRefs = {
      colores: [{ client_id: 'color-azul', color_ref: 12 }],
      matriz: [
        { pieza_ref: 41, color_ref: 12, pieza_color_ref: 'PC-000011' },
        { pieza_ref: 42, color_ref: 12, pieza_color_ref: 'PC-000012' },
      ],
      formulaciones: [{ color_ref: 12, receta_ref: 5, estado: 'RESUELTA' }],
    };
    applied.referencias.COMPONENTES = {
      molde_ref: 'ML-000008',
      piezas: [
        { client_id: 'pieza-cuerpo', pieza_ref: 41, molde_pieza_ref: 71 },
        { client_id: 'pieza-tapa', pieza_ref: 42, molde_pieza_ref: 72 },
      ],
    };
    applied.referencias.COLORES = colorRefs;
    applied.imagenes = [{
      entity_type: 'PIEZA_COLOR', entity_id: 'PC-000011',
      imagen_url: 'https://cdn.example/PC-000011.webp',
    }];
    applied.pasos = applied.pasos.map((step) => step.codigo === 'COMPONENTES' ? {
      ...step,
      data: componentData,
      application_status: {
        ...step.application_status,
        resolved_references: applied.referencias.COMPONENTES,
      },
    } : step.codigo === 'COLORES' ? {
      ...step,
      estado: 'COMPLETADO',
      data: colorsData,
      application_status: {
        status: 'APPLIED', application_key: 'colors-applied',
        created: [{ type: 'PIEZA_COLOR', id: 'PC-000011' }],
        reused: [{ type: 'PIEZA_COLOR', id: 'PC-000012' }],
        pending: [],
        resolved_references: colorRefs,
      },
    } : step);
    obtenerAltaProducto.mockResolvedValue(applied);
    renderStep('colores');

    const completeCell = await screen.findByLabelText(/Estado AZUL SOLIDO en CUERPO COLADOR/i);
    expect(within(completeCell).getByText('PiezaColor creada')).toBeVisible();
    expect(within(completeCell).getByText('Formulación lista')).toBeVisible();
    expect(within(completeCell).getByText('Imagen guardada')).toBeVisible();
    const missingCell = screen.getByLabelText(/Estado AZUL SOLIDO en TAPA COLADOR/i);
    expect(within(missingCell).getByText('PiezaColor reutilizada')).toBeVisible();
    expect(within(missingCell).getByText('Formulación lista')).toBeVisible();
    expect(within(missingCell).getByText('Falta imagen')).toBeVisible();
  });

  it('aplica un molde nuevo con varias piezas sin clasificacion de Pieza en el payload', async () => {
    const initial = makeSession('COMPONENTES');
    obtenerAltaProducto.mockResolvedValue(initial);
    aplicarPasoAltaProducto.mockImplementation(async (_draftId, _step, command) => ({
      ...initial,
      version: 8,
      pasos: initial.pasos.map((step) => step.codigo === 'COMPONENTES' ? {
        ...step, estado: 'COMPLETADO', data: command.data,
      } : step),
      referencias: {
        COMPONENTES: {
          molde_ref: 'ML-000099',
          piezas: [{
            client_id: command.data.piezas[0].client_id,
            pieza_ref: 99,
            molde_pieza_ref: 101,
          }],
        },
      },
      application_results: {
        status: 'APPLIED', created: [{ nombre: 'MOLDE COLADOR' }], reused: [], pending: [],
      },
    }));
    const user = userEvent.setup();
    renderStep('componentes');

    await user.type(await screen.findByLabelText(/Nombre del molde/i), 'MOLDE COLADOR');
    await user.type(screen.getByLabelText(/Peso de tiro/i), '100');
    await user.click(screen.getByRole('button', { name: /Añadir pieza/i }));
    await user.type(screen.getByLabelText(/Nombre de la pieza/i), 'CUERPO COLADOR');
    const cavities = screen.getByLabelText(/Cavidades/i);
    await user.clear(cavities);
    await user.type(cavities, '2');
    await user.type(screen.getByLabelText(/Peso unitario operativo/i), '40');
    expect(screen.queryByLabelText(/Línea de pieza/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Familia de pieza/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Aplicar y continuar/i }));
    await waitFor(() => expect(aplicarPasoAltaProducto).toHaveBeenCalledWith(
      'draft-b',
      'COMPONENTES',
      expect.objectContaining({
        expected_version: 7,
        application_key: expect.stringMatching(/^componentes-.+/),
      }),
    ));
    const piecePayload = aplicarPasoAltaProducto.mock.calls[0][2].data.piezas[0];
    expect(piecePayload).toMatchObject({
      modo: 'NUEVA', nombre: 'CUERPO COLADOR', cavidades: 2, peso_unitario_gr: 40,
    });
    expect(piecePayload).not.toHaveProperty('linea_id');
    expect(piecePayload).not.toHaveProperty('familia_id');
  });

  it('bloquea aplicar Componentes hasta completar Identidad sin ocultar la fase', async () => {
    const blocked = makeSession('COMPONENTES');
    blocked.pasos = blocked.pasos.map((step) => step.codigo === 'IDENTIDAD'
      ? { ...step, estado: 'EN_PROGRESO' }
      : step);
    obtenerAltaProducto.mockResolvedValue(blocked);
    renderStep('componentes');

    expect(await screen.findByRole('heading', { name: /Configurar moldes y piezas/i })).toBeVisible();
    expect(screen.getAllByText(/Completa primero Identidad y fuente/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Esta fase todavía está bloqueada')).toBeVisible();
    expect(screen.getByRole('button', { name: /Ir a Identidad y fuente/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Aplicar y continuar/i })).toBeDisabled();
    expect(aplicarPasoAltaProducto).not.toHaveBeenCalled();
  });

  it('bloquea aplicar Colores hasta completar Componentes', async () => {
    const blocked = makeSession('COLORES');
    blocked.pasos = blocked.pasos.map((step) => step.codigo === 'COMPONENTES'
      ? { ...step, estado: 'EN_PROGRESO' }
      : step);
    obtenerAltaProducto.mockResolvedValue(blocked);
    renderStep('colores');

    expect(await screen.findByRole('heading', { name: /Colores de todas las piezas/i })).toBeVisible();
    expect(screen.getAllByText(/Completa primero Componentes y moldes/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Aplicar y continuar/i })).toBeDisabled();
    expect(aplicarPasoAltaProducto).not.toHaveBeenCalled();
  });

  it('rehidrata Componentes y exige correccion explicita para añadir otro molde', async () => {
    const applied = makeSession('COMPONENTES');
    applied.pasos = applied.pasos.map((step) => step.codigo === 'COMPONENTES' ? {
      ...step,
      estado: 'COMPLETADO',
      application_status: {
        status: 'APPLIED', application_key: 'components-applied', resolved_references: {
          molde_ref: 'ML-000008',
        },
      },
      data: {
        molde: {
          modo: 'NUEVO', nombre: 'MOLDE ORIGINAL', peso_tiro_gr: 100, tiempo_ciclo_std: 30,
        },
        piezas: [{
          client_id: 'pieza-linked', modo: 'NUEVA', nombre: 'PIEZA ORIGINAL',
          cavidades: 2, peso_unitario_gr: 40,
        }],
      },
    } : step);
    applied.referencias = {
      IDENTIDAD: { producto_terminado_id: 'PT-000123' },
      COMPONENTES: {
        molde_ref: 'ML-000008',
        piezas: [{ client_id: 'pieza-linked', pieza_ref: 41, molde_pieza_ref: 91 }],
      },
    };
    obtenerAltaProducto.mockResolvedValue(applied);
    const user = userEvent.setup();
    renderStep('componentes');

    const createMode = await screen.findByRole('button', { name: /Crear molde/i });
    expect(createMode).toBeDisabled();
    expect(screen.getByRole('button', { name: /Reutilizar molde/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Fase aplicada a maestros/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Añadir o vincular moldes/i }));
    await user.click(screen.getByRole('button', { name: /Añadir otro molde/i }));
    expect(screen.getAllByText(/Grupo de fabricación/i)).toHaveLength(2);
    expect(aplicarPasoAltaProducto).not.toHaveBeenCalled();
  });

  it('reanuda desde application_status PARTIAL aunque el navegador no conserve storage', async () => {
    globalThis.localStorage?.clear();
    const partial = makeSession('COMPONENTES');
    partial.pasos = partial.pasos.map((step) => step.codigo === 'COMPONENTES' ? {
      ...step,
      estado: 'EN_PROGRESO',
      application_status: {
        status: 'PARTIAL',
        application_key: 'components-server-partial',
        resolved_references: { molde_ref: 'ML-000008' },
      },
      data: {
        molde: {
          modo: 'NUEVO', nombre: 'MOLDE ORIGINAL', peso_tiro_gr: 100, tiempo_ciclo_std: 30,
        },
        piezas: [{
          client_id: 'pieza-partial', modo: 'NUEVA', nombre: 'PIEZA ORIGINAL',
          cavidades: 2, peso_unitario_gr: 40,
        }, {
          client_id: 'pieza-pendiente', modo: 'NUEVA', nombre: 'PIEZA PENDIENTE',
          cavidades: 1, peso_unitario_gr: 5,
        }],
      },
    } : step);
    partial.referencias = {
      IDENTIDAD: { producto_terminado_id: 'PT-000123' },
      COMPONENTES: {
        molde_ref: 'ML-000008',
        piezas: [{ client_id: 'pieza-partial', pieza_ref: 41, molde_pieza_ref: 91 }],
      },
    };
    obtenerAltaProducto.mockResolvedValue(partial);
    aplicarPasoAltaProducto.mockResolvedValue({
      ...partial,
      version: 8,
      application_results: {
        status: 'APPLIED', application_key: 'components-server-partial',
      },
    });
    const user = userEvent.setup();
    renderStep('componentes');

    const cavities = await screen.findAllByLabelText(/Cavidades/i);
    expect(cavities[0]).toBeDisabled();
    await user.clear(cavities[1]);
    await user.type(cavities[1], '3');
    await user.click(screen.getByRole('button', { name: /Aplicar y continuar/i }));

    await waitFor(() => expect(aplicarPasoAltaProducto).toHaveBeenCalled());
    const command = aplicarPasoAltaProducto.mock.calls[0][2];
    expect(command.application_key).toBe('components-server-partial');
    expect(command.data.piezas[0]).toMatchObject({
      client_id: 'pieza-partial', modo: 'REUTILIZAR', ref: 41, cavidades: 2,
    });
    expect(command.data.piezas[1]).toMatchObject({
      client_id: 'pieza-pendiente', modo: 'NUEVA', cavidades: 3,
    });
  });

  it('reanuda un fallo parcial de colores con la misma application_key y referencias', async () => {
    const colorsData = {
      color_molde_ref: 'ML-000008',
      colores: [{ client_id: 'color-1', modo: 'REUTILIZAR', color_ref: 12, nombre: 'AZUL SOLIDO' }],
      matriz: [{ pieza_ref: 41, color_ref: 12, seleccionada: true }],
      formulaciones: [{
        color_ref: 12,
        color_client_id: 'color-1',
        tipo: 'PENDIENTE',
        motivo_pendiente: 'Falta validar receta con mezclas',
        componentes: [],
      }],
    };
    const initial = makeSession('COLORES');
    initial.pasos = initial.pasos.map((step) => step.codigo === 'COMPONENTES' ? {
      ...step,
      estado: 'COMPLETADO',
      application_status: {
        status: 'APPLIED', application_key: 'components-applied', resolved_references: {
          molde_ref: 'ML-000008',
        },
      },
      data: {
        molde: { modo: 'REUTILIZAR', ref: 'ML-000008' },
        piezas: [{
          client_id: 'pieza-1', modo: 'REUTILIZAR', ref: 41,
          nombre: 'CUERPO COLADOR #3', cavidades: 1, peso_unitario_gr: 80,
        }],
      },
    } : step.codigo === 'COLORES' ? { ...step, data: colorsData } : step);
    initial.referencias = {
      IDENTIDAD: { producto_terminado_id: 'PT-000123' },
      COMPONENTES: {
        molde_ref: 'ML-000008',
        piezas: [{ client_id: 'pieza-1', pieza_ref: 41, molde_pieza_ref: 71 }],
      },
    };
    const partialSession = {
      ...initial,
      version: 8,
      referencias: {
        ...initial.referencias,
        COLORES: {
          colores: [{ client_id: 'color-1', color_ref: 12 }],
          matriz: [{ pieza_ref: 41, color_ref: 12, pieza_color_ref: 'PZC-000120' }],
          formulaciones: [],
        },
      },
    };
    const partialResult = {
      status: 'PARTIAL', application_key: '', created: [{ nombre: 'AZUL SOLIDO' }], reused: [], pending: [{ unit: 'formulacion' }],
    };
    const partialError = Object.assign(new Error('partial'), {
      response: {
        status: 422,
        data: { error: { message: 'Una unidad no pudo aplicarse.', details: {
          current_session: partialSession,
          application_results: partialResult,
        } } },
      },
    });
    const success = {
      ...partialSession,
      version: 9,
      application_results: { ...partialResult, status: 'APPLIED' },
    };
    obtenerAltaProducto.mockResolvedValue(initial);
    obtenerSesionActualDeAplicacion.mockImplementation(
      (error) => error?.response?.data?.error?.details?.current_session || null,
    );
    obtenerResultadosDeAplicacion.mockImplementation((payload) => (
      payload?.application_results
      || payload?.response?.data?.error?.details?.application_results
      || null
    ));
    aplicarPasoAltaProducto
      .mockImplementationOnce(async (_draft, _step, command) => {
        partialResult.application_key = command.application_key;
        throw partialError;
      })
      .mockResolvedValueOnce(success);
    const user = userEvent.setup();
    renderStep('colores');

    await user.click(await screen.findByRole('button', { name: /Aplicar y continuar/i }));
    expect(await screen.findByText(/Una unidad no pudo aplicarse/i)).toBeVisible();
    expect(screen.getByText(/Creado.*AZUL SOLIDO/i)).toBeVisible();

    const reason = screen.getByLabelText(/Motivo pendiente/i);
    await user.clear(reason);
    await user.type(reason, 'Receta confirmada para reintento');

    await user.click(screen.getByRole('button', { name: /Aplicar y continuar/i }));
    await waitFor(() => expect(aplicarPasoAltaProducto).toHaveBeenCalledTimes(2));
    const first = aplicarPasoAltaProducto.mock.calls[0][2];
    const second = aplicarPasoAltaProducto.mock.calls[1][2];
    expect(second.application_key).toBe(first.application_key);
    expect(second.expected_version).toBe(8);
    expect(second.data).not.toEqual(first.data);
    expect(second.data.colores[0]).toMatchObject({
      client_id: 'color-1', modo: 'REUTILIZAR', color_ref: 12,
    });
  });

  it('monta StructureRevisionEditor en BOM y WIP con el PT de la sesion fijado', async () => {
    obtenerAltaProducto.mockResolvedValue(engineeringSession('ESTRUCTURA'));
    renderStep('estructura');

    expect(await screen.findByRole('heading', { name: /Estructura de PT-000123/i }))
      .toBeVisible();
    expect(screen.getByLabelText(/Artículo resultado/i).value)
      .toMatch(/PT-000123.*COLADOR #3/i);
    expect(screen.queryByText(/Fase representada/i)).not.toBeInTheDocument();
  });

  it('crea un WIP contextual, lo autoselecciona y lo aplica sin abandonar la sesión', async () => {
    const session = engineeringSession('ESTRUCTURA');
    obtenerAltaProducto.mockResolvedValue(session);
    guardarPasoAltaProducto.mockImplementation(async (_draft, _step, command) => ({
      ...session,
      version: 8,
      pasos: session.pasos.map((step) => step.codigo === 'ESTRUCTURA'
        ? { ...step, data: command.data }
        : step),
    }));
    aplicarPasoAltaProducto.mockImplementation(async (_draft, _step, command) => ({
      ...session,
      version: 8,
      pasos: session.pasos.map((step) => step.codigo === 'ESTRUCTURA' ? {
        ...step, estado: 'COMPLETADO', data: command.data,
      } : step),
      referencias: {
        ...session.referencias,
        ESTRUCTURA: {
          wips: [{
            client_id: command.data.wips_nuevos[0].client_id,
            articulo_ref: 88,
          }],
          estructura_revision_ref: 44,
        },
      },
      application_results: { status: 'APPLIED', application_key: command.application_key },
    }));
    const user = userEvent.setup();
    renderStep('estructura');

    await user.click(await screen.findByRole('button', { name: /Crear WIP en esta alta/i }));
    await user.type(screen.getByLabelText(/Nombre del WIP/i), 'CUERPO PREARMADO COLADOR');
    await user.click(screen.getByRole('button', { name: /Añadir y seleccionar/i }));

    expect(await screen.findByDisplayValue(/WIP NUEVO.*CUERPO PREARMADO COLADOR/i))
      .toBeVisible();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(await screen.findByRole('button', { name: /Aplicar y continuar/i }));
    await waitFor(() => expect(aplicarPasoAltaProducto).toHaveBeenCalled());
    const payload = aplicarPasoAltaProducto.mock.calls[0][2].data;
    expect(payload.wips_nuevos[0]).toMatchObject({
      nombre: 'CUERPO PREARMADO COLADOR', requiere_calidad: false,
    });
    expect(payload.estructura.payload.componentes[0]).toMatchObject({
      articulo_client_id: payload.wips_nuevos[0].client_id,
      cantidad: 1,
    });
    expect(payload.estructura.payload.componentes[0]).not.toHaveProperty('articulo_id');
  });

  it('reabre una estructura BORRADOR con supersede explícito y nunca crea reemplazo silencioso', async () => {
    const session = engineeringSession('ESTRUCTURA');
    const refs = {
      estructura_revision_ref: 44,
      estructura_revision_version: 2,
      estado: 'BORRADOR',
    };
    session.referencias.ESTRUCTURA = refs;
    session.pasos = session.pasos.map((step) => step.codigo === 'ESTRUCTURA' ? {
      ...step,
      estado: 'COMPLETADO',
      data: {
        target_article_ref: 30,
        estructura: {
          modo: 'NUEVA', accion: 'GUARDAR_BORRADOR', payload: {
            notas: 'Versión original',
            componentes: [{
              secuencia: 1, articulo_id: 11, cantidad: 1, unidad: 'UN', merma_tecnica_pct: 0,
            }],
          },
        },
      },
      application_status: {
        status: 'APPLIED',
        application_key: 'estructura-aplicacion-original',
        resolved_references: refs,
      },
    } : step);
    obtenerAltaProducto.mockResolvedValue(session);
    aplicarPasoAltaProducto.mockImplementation(async (_draft, _step, command) => ({
      ...session,
      version: 8,
      application_results: { status: 'APPLIED', application_key: command.application_key },
    }));
    const user = userEvent.setup();
    renderStep('estructura');

    await user.click(await screen.findByRole('button', { name: /Reabrir borrador/i }));
    const notes = screen.getByLabelText(/Notas de revisión/i);
    expect(notes).toBeEnabled();
    await user.clear(notes);
    await user.type(notes, 'Corrección controlada con espacios');
    expect(notes).toHaveValue('Corrección controlada con espacios');
    await user.click(screen.getByRole('button', { name: /Aplicar corrección/i }));

    await waitFor(() => expect(aplicarPasoAltaProducto).toHaveBeenCalled());
    const command = aplicarPasoAltaProducto.mock.calls[0][2];
    expect(command.supersedes_application_key).toBe('estructura-aplicacion-original');
    expect(command.application_key).not.toBe('estructura-aplicacion-original');
    expect(command.data.estructura).toMatchObject({
      modo: 'EDITAR', revision_ref: 44, expected_version: 2,
    });
    expect(command.data.estructura.payload.notas).toBe('Corrección controlada con espacios');
  });

  it('monta ruta, perfil y regla compartidos sin salida terminal editable', async () => {
    const session = engineeringSession('RUTA_EMPAQUE');
    session.pasos = session.pasos.map((step) => step.codigo === 'ESTRUCTURA' ? {
      ...step,
      estado: 'COMPLETADO',
      application_status: {
        status: 'APPLIED', application_key: 'estructura-applied',
        resolved_references: { estructura_revision_ref: 44 },
      },
    } : step);
    session.referencias.ESTRUCTURA = { estructura_revision_ref: 44 };
    obtenerAltaProducto.mockResolvedValue(session);
    const user = userEvent.setup();
    renderStep('ruta-empaque');

    expect(await screen.findByRole('heading', { name: /Ruta de PT-000123/i })).toBeVisible();
    const operationName = screen.getByLabelText(/Nombre de la operación/i);
    await user.type(operationName, 'Fabricar balde');
    expect(operationName).toHaveValue('Fabricar balde');
    const profileName = screen.getByLabelText('Nombre');
    await user.type(profileName, 'Perfil para los baldes');
    expect(profileName).toHaveValue('Perfil para los baldes');
    const physicalDescription = screen.getByLabelText(/Descripción física/i);
    await user.type(physicalDescription, 'Manga para baldes terminados');
    expect(physicalDescription).toHaveValue('Manga para baldes terminados');
    expect(screen.getByLabelText('Perfil empacable')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByLabelText('Tipo de contenedor')).toBeEnabled();
    expect(screen.getByRole('heading', { name: /Perfil empacable/i })).toBeVisible();
    expect(screen.getByRole('heading', { name: /Regla de empaque/i })).toBeVisible();
    expect(screen.getByLabelText(/Salida terminal.*bloqueada/i).value)
      .toMatch(/PT-000123/i);
  }, 45_000);

  it('exige y aplica un empaque independiente por cada salida de la ruta', async () => {
    const routePayload = {
      notas: 'Fabricación y armado',
      operaciones: [
        {
          clave: 'OP1', secuencia_visible: 1, nombre: 'Fabricar cuerpo', tipo: 'SOPLADO',
          executor_kind: 'OP_OT', centro_trabajo_id: 5, articulo_salida_id: 11,
          estructura_revision_id: null, permite_concurrente: false,
        },
        {
          clave: 'OP2', secuencia_visible: 2, nombre: 'Armar colador', tipo: 'ENSAMBLE',
          executor_kind: 'OP_OT', centro_trabajo_id: 5, articulo_salida_id: 30,
          estructura_revision_id: null, permite_concurrente: false,
        },
      ],
      precedencias: [{ anterior_clave: 'OP1', siguiente_clave: 'OP2' }],
    };
    const session = engineeringSession('RUTA_EMPAQUE');
    session.pasos = session.pasos.map((step) => step.codigo === 'ESTRUCTURA' ? {
      ...step,
      estado: 'COMPLETADO',
      application_status: {
        status: 'APPLIED', application_key: 'estructura-applied',
        resolved_references: { estructura_revision_ref: 44 },
      },
    } : step.codigo === 'RUTA_EMPAQUE' ? {
      ...step,
      data: {
        target_product_ref: 'PT-000123',
        target_article_ref: 30,
        ruta: { modo: 'REUTILIZAR', revision_ref: 55, accion: 'VINCULAR', payload: routePayload },
        empaques: [11, 30].map((articleRef) => ({
          client_id: `empaque-${articleRef}`,
          articulo_ref: articleRef,
          perfil_empacable: { modo: 'REUTILIZAR', ref: 8, asignar_predeterminado: true },
          regla_empaque: { modo: 'REUTILIZAR', revision_ref: 9, accion: 'VINCULAR' },
        })),
      },
    } : step);
    session.referencias.ESTRUCTURA = { estructura_revision_ref: 44 };
    listarRutasScm.mockResolvedValue([{
      id: 55, numero_revision: 1, estado: 'APROBADA', version: 2,
      operaciones: routePayload.operaciones,
      precedencias: [],
    }]);
    listarPerfilesEmpacablesScm.mockResolvedValue([{
      id: 8, codigo: 'PER-008', nombre: 'Manga estándar', activo: true,
    }]);
    listarReglasEmpaqueScm.mockResolvedValue([{
      revision_id: 9, numero_revision: 1, estado: 'APROBADA', perfil_empacable_id: 8,
      perfil_empacable: { nombre: 'Manga estándar' },
    }]);
    aplicarPasoAltaProducto.mockImplementation(async (_draft, _step, command) => ({
      ...session,
      version: 8,
      application_results: { status: 'APPLIED', application_key: command.application_key },
    }));
    obtenerAltaProducto.mockResolvedValue(session);
    const user = userEvent.setup();
    renderStep('ruta-empaque');

    expect(await screen.findByRole('heading', { name: 'PC-000011' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'PT-000123' })).toBeVisible();
    expect(screen.getAllByText('Salida con manga')).toHaveLength(2);
    const apply = screen.getByRole('button', { name: /Aplicar y continuar/i });
    expect(apply).toBeEnabled();
    await user.click(apply);

    await waitFor(() => expect(aplicarPasoAltaProducto).toHaveBeenCalled());
    const command = aplicarPasoAltaProducto.mock.calls[0][2];
    expect(command.data.empaques).toHaveLength(2);
    expect(command.data.empaques.map((item) => item.articulo_ref)).toEqual([11, 30]);
    expect(command.data.empaques.every((item) => (
      item.perfil_empacable.modo === 'REUTILIZAR'
      && item.regla_empaque.modo === 'REUTILIZAR'
    ))).toBe(true);
  });

  it('permite vincular una ruta existente con RUTA_VER cuando empaque sí puede asignarse', async () => {
    const { draft, routePayload } = routeReuseSession();
    mockCapabilities.delete('RUTA_ADMINISTRAR');
    listarRutasScm.mockResolvedValue([{
      id: 55, numero_revision: 1, estado: 'APROBADA', version: 2,
      operaciones: routePayload.operaciones, precedencias: [],
    }]);
    listarPerfilesEmpacablesScm.mockResolvedValue([{
      id: 8, codigo: 'PER-008', nombre: 'Manga estándar', activo: true,
    }]);
    listarReglasEmpaqueScm.mockResolvedValue([{
      revision_id: 9, numero_revision: 1, estado: 'APROBADA', perfil_empacable_id: 8,
    }]);
    obtenerAltaProducto.mockResolvedValue(draft);
    renderStep('ruta-empaque');

    const apply = await screen.findByRole('button', { name: /Aplicar y continuar/i });
    await waitFor(() => expect(apply).toBeEnabled());
    expect(screen.queryByText(/Se requiere Ruta.*administrar/i)).not.toBeInTheDocument();
  });

  it('bloquea antes de API al actor con EMPAQUE_VER pero sin EMPAQUE_ADMINISTRAR', async () => {
    const { draft, routePayload } = routeReuseSession();
    mockCapabilities.delete('EMPAQUE_ADMINISTRAR');
    listarRutasScm.mockResolvedValue([{
      id: 55, numero_revision: 1, estado: 'APROBADA', version: 2,
      operaciones: routePayload.operaciones, precedencias: [],
    }]);
    listarPerfilesEmpacablesScm.mockResolvedValue([{
      id: 8, codigo: 'PER-008', nombre: 'Manga estándar', activo: true,
    }]);
    listarReglasEmpaqueScm.mockResolvedValue([{
      revision_id: 9, numero_revision: 1, estado: 'APROBADA', perfil_empacable_id: 8,
    }]);
    obtenerAltaProducto.mockResolvedValue(draft);
    renderStep('ruta-empaque');

    expect(await screen.findByText(/Empaque.*administrar/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /Aplicar y continuar/i })).toBeDisabled();
    expect(aplicarPasoAltaProducto).not.toHaveBeenCalled();
  });

  it('exige publicación directa de empaque antes de enviar una regla a PUBLICAR', async () => {
    const { draft, routePayload } = routeReuseSession({ publishRule: true });
    mockCapabilities.delete('EMPAQUE_PUBLICAR_DIRECTO');
    listarRutasScm.mockResolvedValue([{
      id: 55, numero_revision: 1, estado: 'APROBADA', version: 2,
      operaciones: routePayload.operaciones, precedencias: [],
    }]);
    listarPerfilesEmpacablesScm.mockResolvedValue([{
      id: 8, codigo: 'PER-008', nombre: 'Manga estándar', activo: true,
    }]);
    listarReglasEmpaqueScm.mockResolvedValue([{
      revision_id: 9, numero_revision: 1, estado: 'APROBADA', perfil_empacable_id: 8,
    }]);
    obtenerAltaProducto.mockResolvedValue(draft);
    renderStep('ruta-empaque');

    expect(await screen.findByText(/publicación directa de empaque/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /Aplicar y continuar/i })).toBeDisabled();
    expect(aplicarPasoAltaProducto).not.toHaveBeenCalled();
  });

  it('consulta estructuras sólo para las salidas usadas, no para todo el catálogo', async () => {
    const articles = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      codigo: `PC-${String(index + 1).padStart(6, '0')}`,
      nombre: `Salida ${index + 1}`,
      clase: 'PIEZA_COLOR',
    }));
    articles[29] = {
      id: 30, codigo: 'PT-000123', nombre: 'COLADOR #3', clase: 'PRODUCTO_TERMINADO',
      subtipo: { producto_terminado_id: 'PT-000123' }, version: 1,
    };
    listarArticulosScm.mockResolvedValue(articles);
    const session = engineeringSession('RUTA_EMPAQUE');
    session.pasos = session.pasos.map((step) => step.codigo === 'ESTRUCTURA' ? {
      ...step,
      estado: 'COMPLETADO',
      application_status: {
        status: 'APPLIED', application_key: 'estructura-applied',
        resolved_references: { estructura_revision_ref: 44 },
      },
    } : step.codigo === 'RUTA_EMPAQUE' ? {
      ...step,
      data: {
        target_product_ref: 'PT-000123', target_article_ref: 30,
        ruta: {
          modo: 'NUEVA', accion: 'GUARDAR_BORRADOR', payload: {
            operaciones: [
              { articulo_salida_id: 11 },
              { articulo_salida_id: 30 },
            ],
          },
        },
      },
    } : step);
    session.referencias.ESTRUCTURA = { estructura_revision_ref: 44 };
    obtenerAltaProducto.mockResolvedValue(session);
    renderStep('ruta-empaque');

    await screen.findByRole('heading', { name: 'PC-000011' });
    await waitFor(() => expect(listarEstructurasScm).toHaveBeenCalled());
    expect(new Set(listarEstructurasScm.mock.calls.map(([articleId]) => Number(articleId))))
      .toEqual(new Set([11, 30]));
    expect(listarEstructurasScm).toHaveBeenCalledTimes(2);
  });

  it('usa readiness autoritativo, navega bloqueos y revalida sin checklist local', async () => {
    const session = engineeringSession('REVISION');
    for (const [code, refs] of [
      ['ESTRUCTURA', { estructura_revision_ref: 44 }],
      ['RUTA_EMPAQUE', { ruta_revision_ref: 55, perfil_empacable_ref: 8, regla_empaque_revision_ref: 9 }],
    ]) {
      session.referencias[code] = refs;
      session.pasos = session.pasos.map((step) => step.codigo === code ? {
        ...step,
        estado: 'COMPLETADO',
        application_status: {
          status: 'APPLIED', application_key: `${code.toLowerCase()}-applied`,
          resolved_references: refs,
        },
      } : step);
    }
    session.readiness = {
      status: 'BLOCKED',
      checked_at: '2026-08-10T12:00:00Z',
      items: [{
        code: 'ROUTE_NOT_APPROVED', severity: 'BLOCKER', paso: 'RUTA_EMPAQUE',
        message: 'La ruta aún no está publicada.', action: 'OPEN_STEP',
      }],
    };
    validarAltaProducto.mockResolvedValue({
      ...session, version: 8, readiness: { status: 'READY', checked_at: '2026-08-10T12:05:00Z', items: [] },
    });
    obtenerAltaProducto.mockResolvedValue(session);
    const user = userEvent.setup();
    renderStep('revision');

    expect(await screen.findByRole('heading', { name: /Revisión técnica/i })).toBeVisible();
    expect(screen.getByText(/La ruta aún no está publicada/i)).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Validar nuevamente/i }));
    await waitFor(() => expect(validarAltaProducto).toHaveBeenCalledWith('draft-b', 7));
    expect(finalizarAltaProducto).not.toHaveBeenCalled();
  });

  it('detecta aprobaciones pendientes aun cuando REVISION mantiene readiness BLOCKED', () => {
    const readiness = {
      status: 'BLOCKED',
      revision_snapshot: [
        { tipo: 'ESTRUCTURA', id: 44, version: 2, content_hash: 'sha-estructura' },
        { tipo: 'RUTA', id: 55, version: 3, content_hash: 'sha-ruta' },
      ],
      items: [
        {
          code: 'STEP_NOT_COMPLETED', severity: 'BLOCKER', paso: 'REVISION',
          message: 'Falta confirmar la revisión.', action: 'OPEN_STEP',
        },
        {
          code: 'STRUCTURE_APPROVAL_REQUIRED', severity: 'WARNING', paso: 'ESTRUCTURA',
          message: 'La estructura está pendiente de aprobación.',
          action: 'REQUEST_APPROVAL', result: 'PENDING_APPROVAL',
        },
      ],
    };

    expect(readinessHasPendingApproval(readiness)).toBe(true);
    const data = normalizeReviewData({}, readiness);
    expect(data.pasos_revisados).toEqual([
      'IDENTIDAD', 'COMPONENTES', 'COLORES', 'ESTRUCTURA', 'RUTA_EMPAQUE',
    ]);
    expect(data.revisiones_revisadas).toEqual(readiness.revision_snapshot);
    expect(reviewIsConfirmed({
      ...data,
      confirmaciones: {
        datos_fuente_revisados: true,
        entiende_que_no_crea_op: true,
        pendientes_aceptados: false,
      },
    }, readiness)).toBe(false);
  });

  it('permite confirmar y finalizar una captura con aprobaciones pendientes visibles', async () => {
    const session = engineeringSession('REVISION');
    for (const [code, refs] of [
      ['ESTRUCTURA', {
        estructura_revision_ref: 44, estructura_revision_version: 2, estado: 'BORRADOR',
      }],
      ['RUTA_EMPAQUE', {
        ruta_revision_ref: 55, ruta_revision_version: 3, ruta_estado: 'BORRADOR',
        empaques: [{
          client_id: 'empaque-30', articulo_ref: 30, perfil_empacable_ref: 8,
          regla_empaque_revision_ref: 9, regla_empaque_revision_version: 1,
          perfil_estado: 'ACTIVO', regla_estado: 'BORRADOR',
        }],
      }],
    ]) {
      session.referencias[code] = refs;
      session.pasos = session.pasos.map((step) => step.codigo === code ? {
        ...step,
        estado: 'COMPLETADO',
        application_status: {
          status: 'APPLIED', application_key: `${code.toLowerCase()}-applied`,
          resolved_references: refs,
        },
      } : step);
    }
    session.readiness = {
      status: 'BLOCKED',
      revision_snapshot: [
        { tipo: 'ESTRUCTURA', id: 44, version: 2, content_hash: 'sha-estructura' },
        { tipo: 'RUTA', id: 55, version: 3, content_hash: 'sha-ruta' },
        { tipo: 'PERFIL_EMPAQUE', id: 8, version: 1, content_hash: 'sha-perfil' },
        { tipo: 'REGLA_EMPAQUE', id: 9, version: 1, content_hash: 'sha-regla' },
      ],
      items: [
        {
          code: 'STEP_NOT_COMPLETED', severity: 'BLOCKER', paso: 'REVISION',
          message: 'Falta confirmar la revisión.', action: 'OPEN_STEP',
        },
        {
          code: 'STRUCTURE_APPROVAL_REQUIRED', severity: 'WARNING', paso: 'ESTRUCTURA',
          message: 'La estructura está pendiente de aprobación.',
          action: 'REQUEST_APPROVAL', result: 'PENDING_APPROVAL',
        },
      ],
    };
    guardarPasoAltaProducto.mockImplementation(async (_draft, _step, command) => ({
      ...session,
      version: 8,
      pasos: session.pasos.map((step) => step.codigo === 'REVISION' ? {
        ...step, estado: command.estado_paso, data: command.data,
      } : step),
    }));
    validarAltaProducto.mockResolvedValue({
      ...session,
      version: 9,
      readiness: {
        ...session.readiness,
        status: 'PENDING_APPROVAL',
        items: session.readiness.items.filter((item) => item.paso !== 'REVISION'),
      },
    });
    finalizarAltaProducto.mockResolvedValue({
      ...session,
      estado: 'FINALIZADA',
      version: 10,
      readiness: {
        ...session.readiness,
        status: 'PENDING_APPROVAL',
        items: session.readiness.items.filter((item) => item.paso !== 'REVISION'),
      },
    });
    obtenerAltaProducto.mockResolvedValue(session);
    const user = userEvent.setup();
    renderStep('revision');

    expect(await screen.findByLabelText(/Acepto cerrar la captura/i)).toBeEnabled();
    await user.click(screen.getByLabelText(/Revisé la identidad/i));
    await user.click(screen.getByLabelText(/Entiendo que finalizar/i));
    await user.click(screen.getByLabelText(/Acepto cerrar la captura/i));
    await user.click(screen.getByRole('button', { name: /Finalizar captura/i }));

    await waitFor(() => expect(finalizarAltaProducto).toHaveBeenCalledWith('draft-b', 9));
    const reviewCommand = guardarPasoAltaProducto.mock.calls.find(
      ([, step]) => step === 'REVISION',
    )[2];
    expect(reviewCommand.data).toMatchObject({
      pasos_revisados: [
        'IDENTIDAD', 'COMPONENTES', 'COLORES', 'ESTRUCTURA', 'RUTA_EMPAQUE',
      ],
      revisiones_revisadas: session.readiness.revision_snapshot,
      confirmaciones: { pendientes_aceptados: true },
    });
    expect(await screen.findByText(/Captura finalizada.*pendiente de aprobación/i))
      .toBeVisible();
  });

  it.each([
    ['READY', /^Captura finalizada.*Listo para planificar/i],
    ['PENDING_APPROVAL', /^Captura finalizada.*pendiente de aprobación/i],
  ])('recarga FINALIZADA %s en consulta y conserva su readiness', async (status, message) => {
    const finalized = engineeringSession('REVISION');
    finalized.estado = 'FINALIZADA';
    finalized.version = 12;
    finalized.readiness = {
      status,
      checked_at: '2026-08-10T18:00:00Z',
      revision_snapshot: [],
      items: [],
    };
    obtenerAltaProducto.mockResolvedValue(finalized);
    renderStep('revision');

    expect(await screen.findByText('Captura finalizada · v12')).toBeVisible();
    expect(screen.getByText(message)).toBeVisible();
    expect(screen.getByLabelText(/Notas de cierre/i)).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Finalizar captura/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^salir$/i })).toBeVisible();
  });
});
