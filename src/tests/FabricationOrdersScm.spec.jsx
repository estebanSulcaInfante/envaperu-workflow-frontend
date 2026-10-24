import { createTheme, ThemeProvider } from '@mui/material';
import { useEffect } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import FabricationOrdersScm from '../components/FabricationOrdersScm';

const auth = vi.hoisted(() => ({
  actorId: 1,
  article: true,
  articleView: true,
  routeView: true,
  routeAdmin: true,
  ofEdit: true,
  supervisor: false,
  outputRoutes: vi.fn(),
}));

vi.mock('../services/api', () => ({
  obtenerColores: vi.fn().mockResolvedValue([]),
  obtenerFamiliasColor: vi.fn().mockResolvedValue([]),
  obtenerIngredientesRecetaColor: vi.fn().mockResolvedValue([]),
  obtenerMaquinas: vi.fn().mockResolvedValue([]),
  obtenerMolde: vi.fn(),
  obtenerMoldes: vi.fn().mockResolvedValue([]),
  obtenerRecetasColorMaestras: vi.fn().mockResolvedValue({ items: [] }),
}));
vi.mock('../services/scmCatalogApi', () => ({
  crearMaterialScm: vi.fn(),
  listarCategoriasRecepcionScm: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/scmOtApi', () => ({
  anularOrdenFabricacionScm: vi.fn(),
  reemplazarOrdenFabricacionScm: vi.fn(),
  obtenerOrdenFabricacionScm: vi.fn(),
  cerrarOrdenFabricacionScm: vi.fn(),
  configurarOrdenFabricacionScm: vi.fn(),
  crearOrdenFabricacionExcepcionalScm: vi.fn(),
  liberarOrdenFabricacionScm: vi.fn(),
  listarOrdenesFabricacionScm: vi.fn().mockResolvedValue({ items: [] }),
}));

vi.mock('../services/scmEngineeringApi', () => ({
  obtenerActorScm: () => 1,
  listarArticulosScm: vi.fn().mockResolvedValue([]),
  listarArticulosPaginaScm: vi.fn().mockResolvedValue({ items: [], total: 0, has_more: false }),
  listarCentrosTrabajoScm: vi.fn().mockResolvedValue([]),
  obtenerRutaScm: vi.fn().mockResolvedValue({}),
  listarEstructurasScm: vi.fn().mockResolvedValue([]),
  hidratarEstructurasScm: vi.fn().mockResolvedValue({ approved: [], referenced: [] }),
  listarOperacionesRutaPorSalidaScm: auth.outputRoutes,
  listarRutasArticuloScm: vi.fn().mockResolvedValue([]),
  mensajeErrorScm: (error, fallback) => error?.message || fallback,
}));
vi.mock('../services/scmProductionObservabilityApi', () => ({
  listarAvanceOfScm: vi.fn().mockResolvedValue({ items: [], visibilidad: { pesaje: false } }),
}));

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    actorId: auth.actorId,
    can: (capability) => {
      if (capability === 'OF_CANCELAR_EJECUCION') return !auth.supervisor;
      return (
        (capability !== 'ARTICULO_ADMINISTRAR' || auth.article)
        && (capability !== 'ARTICULO_VER' || auth.articleView)
        && (capability !== 'RUTA_VER' || auth.routeView)
        && (capability !== 'RUTA_ADMINISTRAR' || auth.routeAdmin)
        && (capability !== 'OF_EDITAR_BORRADOR' || auth.ofEdit)
      );
    },
    canAny: () => true,
    experience: { label: 'Gerencia' },
  }),
}));

import {
  obtenerColores, obtenerMaquinas, obtenerMolde, obtenerMoldes,
  obtenerRecetasColorMaestras,
} from '../services/api';
import {
  listarArticulosPaginaScm, listarArticulosScm, listarCentrosTrabajoScm, listarRutasArticuloScm,
} from '../services/scmEngineeringApi';
import {
  cerrarOrdenFabricacionScm,
  anularOrdenFabricacionScm,
  configurarOrdenFabricacionScm, crearOrdenFabricacionExcepcionalScm,
  listarOrdenesFabricacionScm, obtenerOrdenFabricacionScm,
} from '../services/scmOtApi';

const renderDetail = (order, detailResponses = [order]) => {
  detailResponses.map((detail) => ({
    ...detail,
    // Existing OF fixtures predate the explicit process contract. Keep their
    // scenarios focused on their original behavior while new cases exercise
    // the unresolved legacy draft guard directly.
    ...(detail.corridas?.length ? {
      snapshot_proceso: detail.snapshot_proceso || (detail.plan_produccion_id ? detail.proceso_requerido : 'INYECCION'),
    } : {}),
  })).forEach((detail, index) => {
    if (index === detailResponses.length - 1) {
      obtenerOrdenFabricacionScm.mockResolvedValue(detail);
    } else {
      obtenerOrdenFabricacionScm.mockResolvedValueOnce(detail);
    }
  });
  return render(
    <ThemeProvider theme={createTheme()}>
      <MemoryRouter initialEntries={[`/produccion/ordenes-fabricacion?of=${order.id}`]}>
        <FabricationOrdersScm />
      </MemoryRouter>
    </ThemeProvider>,
  );
};

const renderInbox = () => render(
  <ThemeProvider theme={createTheme()}>
    <MemoryRouter initialEntries={['/produccion/ordenes-fabricacion']}>
      <FabricationOrdersScm />
    </MemoryRouter>
  </ThemeProvider>,
);

describe('Órdenes de fabricación', () => {
  it('envía la precisión completa de kg y gramos, y conserva la edición si falla guardar', async () => {
    const user = userEvent.setup();
    const order = {
      id: 'precision', codigo: 'OF-PRECISION', estado: 'BORRADOR', version: 1,
      molde_id: 'M-1', snapshot_peso_colada_gr: '5.1234', snapshot_horas_turno: '8', snapshot_tiempo_ciclo_seg: '30',
      corridas: [{ id: 'r1', codigo: 'C01', objetivo_neto_kg: '12.3456', salidas: [] }],
    };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    obtenerMoldes.mockResolvedValue([{ codigo: 'M-1', nombre: 'Molde precisión', activo: true, formas: [] }]);
    configurarOrdenFabricacionScm.mockRejectedValue(new Error('Error de prueba: conserva borrador'));
    renderDetail(order);
    let target = await screen.findByRole('spinbutton', { name: /Objetivo neto/ });
    expect(target).toHaveValue(12.35);
    await user.click(target);
    expect(target).toHaveValue(12.3456);
    await user.tab();
    await user.click(screen.getByRole('button', { name: 'Guardar configuración técnica' }));
    expect(configurarOrdenFabricacionScm).toHaveBeenLastCalledWith('precision', expect.objectContaining({
      snapshot_peso_colada_gr: 5.1234,
      corridas: [expect.objectContaining({ objetivo_neto_kg: 12.3456 })],
    }));
    expect(await screen.findByText('Error de prueba: conserva borrador')).toBeVisible();
    target = await screen.findByRole('spinbutton', { name: /Objetivo neto/ });
    await user.clear(target);
    await user.type(target, '13.1234');
    await user.click(screen.getByRole('button', { name: 'Guardar configuración técnica' }));
    expect(configurarOrdenFabricacionScm).toHaveBeenLastCalledWith('precision', expect.objectContaining({
      corridas: [expect.objectContaining({ objetivo_neto_kg: 13.1234 })],
    }));
    target = await screen.findByRole('spinbutton', { name: /Objetivo neto/ });
    expect(target).toHaveValue(13.12);
    await user.click(target);
    expect(target).toHaveValue(13.1234);
  });
  it('abre la formulación en un panel sin abandonar la OF', async () => {
    const user = userEvent.setup();
    const order = {
      id: 'of-contexto', codigo: 'OF-CONTEXTO', estado: 'BORRADOR', version: 1,
      corridas: [{ id: 'run-1', codigo: 'OF-CONTEXTO-C01', color_produccion_id: 7, salidas: [] }],
    };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    renderDetail(order);
    await user.click(await screen.findByRole('button', { name: 'Crear o editar aquí' }));
    expect(await screen.findByText('OF-CONTEXTO · OF-CONTEXTO-C01 · formulación')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Volver a la OF' })).toBeVisible();
  });
  it('advierte antes de descartar una formulación sin guardar', async () => {
    const user = userEvent.setup();
    const order = {
      id: 'of-dirty', codigo: 'OF-DIRTY', estado: 'BORRADOR', version: 1,
      corridas: [{ id: 'run-dirty', codigo: 'OF-DIRTY-C01', color_produccion_id: 7, salidas: [] }],
    };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    renderDetail(order);
    await user.click(await screen.findByRole('button', { name: 'Crear o editar aquí' }));
    await user.type(screen.getByLabelText('Nombre de variante'), 'Rojo piloto');
    await user.click(screen.getByRole('button', { name: 'Volver a la OF' }));
    expect(screen.getByRole('dialog', { name: 'Cambios sin guardar' })).toBeVisible();
    expect(screen.getByLabelText('Nombre de variante')).toHaveValue('Rojo piloto');
    await user.click(screen.getByRole('button', { name: 'Descartar cambios' }));
    expect(screen.queryByLabelText('Nombre de variante')).not.toBeInTheDocument();
  });
  it('distingue fabricación concurrente estimada de pesajes directos de la OF', async () => {
    const order = { id: 'of-source', codigo: 'OF-FUENTE', estado: 'CERRADA', version: 3, corridas: [], cierre_kg: { kg_medido: '0.000', kg_fabricacion_estimado: '10.000' } };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    renderDetail(order);
    expect(await screen.findByText(/Cierre documental: 0\.00 kg pesados directamente/)).toHaveTextContent('Aporte de fabricación estimado: 10.00 kg');
    expect(screen.getByText(/medición y estimación no se suman como stock/)).toBeVisible();
  });
  it('presenta cierre KG con el contrato real sin código ni estado en la respuesta', async () => {
    const kgOrder = { id: 'of-kg', codigo: 'OF-KG-01', estado: 'EN_EJECUCION', version: 2, corridas: [] };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [kgOrder] });
    cerrarOrdenFabricacionScm.mockResolvedValue({ kg_medido: '12.000', un_confirmadas: false, cierre: { kg_medido: '12.000' } });
    const user = userEvent.setup();
    renderDetail(kgOrder);
    await user.click(await screen.findByRole('button', { name: 'Cerrar OF' }));
    expect(await screen.findByText('OF-KG-01 cerrada: 12.00 kg medidos, sin movimiento de stock por el cierre.')).toBeVisible();
    expect(cerrarOrdenFabricacionScm).toHaveBeenCalledWith('of-kg', { version: 2 });
  });
  it('anula el borrador con motivo y permite volver a ocultar las anuladas', async () => {
    const user = userEvent.setup();
    const draft = { id: 'of-annul', codigo: 'OF-000099', estado: 'BORRADOR', version: 1, corridas: [] };
    const annulled = { ...draft, estado: 'ANULADA', version: 2, anulacion: { motivo: 'Duplicada' } };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [draft], pagination: { page: 1, page_size: 25, total: 1, total_pages: 1 } });
    anularOrdenFabricacionScm.mockImplementation(async () => {
      listarOrdenesFabricacionScm.mockImplementation((filters) => Promise.resolve(filters?.estado === 'SIN_ANULADAS'
        ? { items: [], pagination: { page: 1, page_size: 25, total: 0, total_pages: 0 } }
        : { items: [annulled], pagination: { page: 1, page_size: 25, total: 1, total_pages: 1 } }));
      return annulled;
    });
    renderDetail(draft, [draft, annulled]);
    await user.click(await screen.findByRole('button', { name: 'Mostrar acciones' }));
    await user.click(await screen.findByRole('button', { name: 'Anular borrador' }));
    await user.type(screen.getByLabelText('Motivo de anulación'), 'Duplicada');
    await user.click(screen.getByText('Confirmar anulación'));
    expect(await screen.findByText(/Anulada · Duplicada/)).toBeVisible();
    expect(anularOrdenFabricacionScm).toHaveBeenCalledWith(draft, 'Duplicada');
    await waitFor(() => expect(screen.queryByText('Hay una operación en curso. Espera a que termine antes de salir.')).not.toBeInTheDocument());
    await waitFor(() => expect(obtenerOrdenFabricacionScm.mock.calls.length).toBeGreaterThan(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Actualizar' })).not.toBeDisabled());
    const listCallsBeforeBack = listarOrdenesFabricacionScm.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Volver a bandeja' }));
    await waitFor(() => expect(listarOrdenesFabricacionScm.mock.calls.length).toBeGreaterThan(listCallsBeforeBack));
    await waitFor(() => expect(screen.queryByText('Hay una operación en curso. Espera a que termine antes de salir.')).not.toBeInTheDocument());
    const stateFilter = await screen.findByRole('combobox', { name: 'Estado' });
    expect(stateFilter).toHaveTextContent('Todos los estados');
    await user.click(stateFilter);
    await user.click(screen.getByRole('option', { name: 'Sin anuladas' }));
    expect(await screen.findByText('Sin coincidencias en la consulta')).toBeVisible();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Actualizar' })).not.toBeDisabled());
  });
  beforeEach(() => {
    auth.actorId = 1;
    auth.article = true;
    auth.articleView = true;
    auth.routeView = true;
    auth.routeAdmin = true;
    auth.ofEdit = true;
    auth.supervisor = false;
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [], pagination: { page: 1, page_size: 25, total: 0, total_pages: 0 } });
    obtenerColores.mockResolvedValue([]);
    obtenerMaquinas.mockResolvedValue([]);
    obtenerMoldes.mockResolvedValue([]);
    obtenerRecetasColorMaestras.mockResolvedValue({ items: [] });
    obtenerMolde.mockReset();
    // API reads always return a Promise, including between navigation tests.
    obtenerOrdenFabricacionScm.mockReset().mockResolvedValue(null);
    listarArticulosScm.mockResolvedValue([]);
    listarRutasArticuloScm.mockClear();
    listarRutasArticuloScm.mockResolvedValue([]);
    auth.outputRoutes.mockReset();
    auth.outputRoutes.mockImplementation((articleId, requestedActor, options, signal) => (
      listarRutasArticuloScm(articleId, requestedActor, options, signal)
    ));
    crearOrdenFabricacionExcepcionalScm.mockReset();
    configurarOrdenFabricacionScm.mockReset();
    cerrarOrdenFabricacionScm.mockReset();
  });

  it('expone gestionar ejecución en detalle para LIBERADA con capacidad de cancelar', async () => {
    const order = { id: 'of-empty', codigo: 'OF-EMPTY', estado: 'LIBERADA', version: 3, corridas: [] };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order], pagination: { page: 1, page_size: 25, total: 1, total_pages: 1 } });
    renderDetail(order);
    expect(await screen.findByRole('button', { name: 'Gestionar ejecución' })).toBeVisible();
  });

  it('expone la acción en la tabla para LIBERADA y PROGRAMADA con capacidad de cancelar', async () => {
    const orders = [
      { id: 'of-empty-table', codigo: 'OF-TABLE-LIB', estado: 'LIBERADA', version: 3, corridas: [] },
      { id: 'of-programada-table', codigo: 'OF-TABLE-PROG', estado: 'PROGRAMADA', version: 4, corridas: [] },
    ];
    listarOrdenesFabricacionScm.mockResolvedValue({ items: orders, pagination: { page: 1, page_size: 25, total: 2, total_pages: 1 } });
    renderInbox();
    expect(await screen.findByRole('button', { name: 'Gestionar ejecución OF-TABLE-LIB' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Gestionar ejecución OF-TABLE-PROG' })).toBeVisible();
  });

  it('oculta la acción en la tabla para Supervisor pause-only en LIBERADA y PROGRAMADA', async () => {
    auth.supervisor = true;
    const orders = [
      { id: 'of-supervisor-lib', codigo: 'OF-SUP-LIB', estado: 'LIBERADA', version: 3, corridas: [] },
      { id: 'of-supervisor-prog', codigo: 'OF-SUP-PROG', estado: 'PROGRAMADA', version: 4, corridas: [] },
    ];
    listarOrdenesFabricacionScm.mockResolvedValue({ items: orders, pagination: { page: 1, page_size: 25, total: 2, total_pages: 1 } });
    renderInbox();
    await screen.findByText('OF-SUP-LIB');
    expect(screen.queryByRole('button', { name: 'Gestionar ejecución OF-SUP-LIB' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gestionar ejecución OF-SUP-PROG' })).not.toBeInTheDocument();
  });

  it('no abre gestionar ejecución a Supervisor pause-only en LIBERADA o PROGRAMADA', async () => {
    auth.supervisor = true;
    const order = { id: 'of-supervisor', codigo: 'OF-SUPERVISOR', estado: 'PROGRAMADA', version: 2, corridas: [] };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order], pagination: { page: 1, page_size: 25, total: 1, total_pages: 1 } });
    renderDetail(order);
    await screen.findByText('OF-SUPERVISOR');
    expect(screen.queryByRole('button', { name: 'Gestionar ejecución' })).not.toBeInTheDocument();
  });

  it('explica el permiso faltante sin ofrecer alta contextual falsa', async () => {
    auth.article = false;
    const order = {
      id: 'of-limited', codigo: 'OF-LIMITED', estado: 'BORRADOR', version: 1,
      corridas: [{ id: 'run-limited', codigo: 'OF-LIMITED-C01', color_produccion_id: 7, salidas: [] }],
    };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    renderDetail(order);
    expect(await screen.findByText(/solicita administración de artículos/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Crear o editar aquí' })).not.toBeInTheDocument();
  });

  it('muestra la formulacion del color y permite elegir otra variante aprobada en borrador', async () => {
    const user = userEvent.setup();
    const order = {
      id: 'of-recipe', codigo: 'OF-000021', estado: 'BORRADOR', version: 3,
      molde_id: 'ML-RECETA', maquina_prevista_id: 8,
      snapshot_tiempo_ciclo_seg: '20', snapshot_horas_turno: '8',
      snapshot_peso_colada_gr: '2',
      corridas: [{
        id: 'run-recipe', codigo: 'OF-000021-C01', color_produccion_id: 5,
        objetivo_neto_kg: '1.000',
        receta_revision_id: 31,
        salidas: [{
          id: 'out-recipe', cantidad_objetivo: '100.000', excedente_objetivo: '0.000',
          cantidad_por_ciclo_snapshot: '4.0000', peso_unitario_snapshot_g: '12.0000',
          articulo: { codigo: 'PC-ASA-ROJO', nombre: 'Asa ROJO', clase: 'PIEZA_COLOR', pieza_id: 31 },
        }],
      }],
    };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    obtenerMoldes.mockResolvedValue([{
      codigo: 'ML-RECETA', nombre: 'Molde Asa', activo: true,
      formas: [{ pieza_id: 31, activo: true, cavidades: 4, peso_unitario_gr: 12 }],
    }]);
    obtenerMaquinas.mockResolvedValue([{
      id: 8, codigo: 'INY-01', nombre: 'Inyectora', activo: true, estado: 'OPERATIVA',
    }]);
    obtenerColores.mockResolvedValue([{ id: 5, nombre: 'ROJO', activo: true }]);
    obtenerRecetasColorMaestras.mockResolvedValue({ items: [
      {
        id: 31, color_produccion_id: 5, nombre_variante: 'Rojo estándar', revision: 1,
        estado: 'APROBADA', es_default: true, producto_sku: null, base_virgen_kg: 25,
        lineas: [
          { id: 1, material_nombre: 'PP Virgen', tipo_componente: 'MATERIA_PRIMA', cantidad: 0.8, unidad: 'FRACCION' },
          { id: 2, material_nombre: 'PP Molido', tipo_componente: 'MATERIA_PRIMA', cantidad: 0.2, unidad: 'FRACCION' },
          { id: 3, material_nombre: 'Rojo EP', tipo_componente: 'COLORANTE', cantidad: 120, unidad: 'GRAMOS', base_kg: 25 },
        ],
      },
      {
        id: 32, color_produccion_id: 5, nombre_variante: 'Rojo intenso', revision: 2,
        estado: 'APROBADA', es_default: false, producto_sku: null, base_virgen_kg: 25,
        lineas: [
          { id: 4, material_nombre: 'PP Virgen', tipo_componente: 'MATERIA_PRIMA', cantidad: 1, unidad: 'FRACCION' },
          { id: 5, material_nombre: 'Rojo EP', tipo_componente: 'COLORANTE', cantidad: 150, unidad: 'GRAMOS', base_kg: 25 },
        ],
      },
      {
        id: 33, color_produccion_id: 5, nombre_variante: 'Borrador inseguro', revision: 1,
        estado: 'BORRADOR', es_default: false, producto_sku: null, base_virgen_kg: 25, lineas: [],
      },
      {
        id: 34, color_produccion_id: 5, nombre_variante: 'Solo otro producto', revision: 1,
        estado: 'APROBADA', es_default: false, producto_sku: 'PT-AJENO', base_virgen_kg: 25, lineas: [],
      },
    ] });
    configurarOrdenFabricacionScm.mockResolvedValue({ codigo: 'OF-000021' });

    renderDetail(order);

    const recipeSelect = await screen.findByRole('combobox', { name: /Formulación de material/ });
    expect(recipeSelect).toHaveValue('Rojo estándar');
    expect(screen.getAllByText('Rev. 1 · Predeterminada').length).toBeGreaterThan(0);
    expect(screen.getByText('PP Virgen')).toBeVisible();
    expect(screen.getByText('80% de la mezcla')).toBeVisible();
    expect(screen.getByText('120 g / 25 kg virgen')).toBeVisible();

    await user.click(recipeSelect);
    expect(screen.getByRole('option', { name: /Rojo intenso.*Rev. 2/ })).toBeVisible();
    expect(screen.queryByRole('option', { name: /Borrador inseguro/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Solo otro producto/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: /Rojo intenso.*Rev. 2/ }));
    expect(screen.getByText('100% de la mezcla')).toBeVisible();
    expect(screen.getByText('150 g / 25 kg virgen')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Guardar configuración técnica' }));
    expect(configurarOrdenFabricacionScm).toHaveBeenCalledWith(
      'of-recipe',
      expect.objectContaining({
        corridas: [expect.objectContaining({ receta_revision_id: 32 })],
      }),
    );
  });

  it('mantiene visible y bloqueada la formulacion congelada de una OF liberada', async () => {
    const order = {
      id: 'of-frozen', codigo: 'OF-000022', estado: 'LIBERADA', version: 4,
      corridas: [{
        id: 'run-frozen', codigo: 'OF-000022-C01', color_produccion_id: 5,
        receta_revision_id: 41, receta_hash: 'a'.repeat(64),
        receta: {
          id: 41, nombre: 'Rojo congelado', nombre_variante: 'Rojo congelado',
          revision: 3, estado: 'APROBADA', base_virgen_kg: 25,
          lineas: [{
            id: 6, material_nombre: 'Rojo EP', tipo_componente: 'COLORANTE',
            cantidad: 140, unidad: 'GRAMOS', base_kg: 25,
          }],
        },
        salidas: [],
      }],
    };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    obtenerColores.mockResolvedValue([{ id: 5, nombre: 'ROJO', activo: true }]);

    renderDetail(order);

    const recipeSelect = await screen.findByRole('combobox', { name: /Formulación de material/ });
    expect(recipeSelect).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getAllByText('Congelada al liberar')[0]).toBeVisible();
    expect(screen.getByText('140 g / 25 kg virgen')).toBeVisible();
  });

  it('crea una OF normalizada de reposicion para una PiezaColor del molde', async () => {
    const user = userEvent.setup();
    obtenerMoldes.mockResolvedValue([{
      codigo: 'ML-ASA', nombre: 'Molde Asa', activo: true,
    }]);
    obtenerMolde.mockResolvedValue({
      codigo: 'ML-ASA', nombre: 'Molde Asa', activo: true,
      tiempo_ciclo_std: 20, peso_colada_gr: 2,
      formas: [{
        pieza_id: 31, pieza_codigo: 'PZ-ASA', nombre: 'Asa de balde',
        activo: true, cavidades: 4, peso_unitario_gr: 12,
        variantes: [{ sku: 'PC-ASA-ROJO', color_produccion_id: 5 }],
      }],
    });
    obtenerMaquinas.mockResolvedValue([{
      id: 8, codigo: 'INY-01', nombre: 'Inyectora 1', activo: true, estado: 'OPERATIVA',
      tipo_maquina: { proceso: 'INYECCION' },
    }, {
      id: 9, codigo: 'SOP-01', nombre: 'Sopladora 1', activo: true, estado: 'OPERATIVA',
      tipo_maquina: { proceso: 'SOPLADO' },
    }]);
    obtenerColores.mockResolvedValue([{ id: 5, nombre: 'ROJO', activo: true }]);
    obtenerRecetasColorMaestras.mockResolvedValue({ items: [{
      id: 51, color_produccion_id: 5, nombre_variante: 'Rojo reposición', revision: 1,
      estado: 'APROBADA', es_default: true, producto_sku: null, base_virgen_kg: 25,
      lineas: [{
        id: 501, material_nombre: 'Rojo EP', tipo_componente: 'COLORANTE',
        cantidad: 110, unidad: 'GRAMOS', base_kg: 25,
      }],
    }] });
    listarArticulosScm.mockResolvedValue([{
      id: 91, codigo: 'PC-ASA-ROJO', nombre: 'Asa ROJO', clase: 'PIEZA_COLOR',
      subtipo: { pieza_color_sku: 'PC-ASA-ROJO' },
    }]);
    crearOrdenFabricacionExcepcionalScm.mockResolvedValue({
      id: 'of-ex-1', codigo: 'OF-000010', estado: 'BORRADOR', corridas: [],
    });
    listarOrdenesFabricacionScm
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [{
        id: 'of-ex-1', codigo: 'OF-000010', estado: 'BORRADOR', version: 1, corridas: [],
      }] });

    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter><FabricationOrdersScm /></MemoryRouter>
      </ThemeProvider>,
    );

    await user.click(await screen.findByRole('button', { name: 'Nueva OF de reposición' }));
    await user.click(screen.getByRole('combobox', { name: 'Motivo de reposición' }));
    await user.click(screen.getByRole('option', { name: 'Otro', exact: true }));
    await user.type(screen.getByRole('textbox', { name: 'Especifica el motivo' }), 'Stock de asas para prearmado');
    await user.click(screen.getByRole('combobox', { name: 'Molde' }));
    await user.click(await screen.findByRole('option', { name: /Molde Asa.*ML-ASA/ }));
    await screen.findByDisplayValue('20');
    await user.click(screen.getByRole('combobox', { name: 'Proceso de fabricación' }));
    await user.click(screen.getByRole('option', { name: 'Inyección' }));
    await user.click(screen.getByRole('combobox', { name: 'Máquina sugerida (opcional)' }));
    expect(screen.queryByRole('option', { name: /SOP-01/ })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('option', { name: /INY-01/ }));
    await user.click(screen.getByRole('combobox', { name: 'Color del objetivo 1' }));
    await user.click(await screen.findByRole('option', { name: 'ROJO' }));
    await user.type(screen.getByLabelText(/Objetivo 1 \(kg netos\)/), '12');

    expect(screen.getByRole('combobox', { name: /Formulación de material/ }))
      .toHaveValue('Rojo reposición');
    expect(screen.getByText('110 g / 25 kg virgen')).toBeVisible();
    expect(screen.getByText('Asa de balde')).toBeVisible();
    expect(screen.getByText(/PZ-ASA/)).toBeVisible();
    expect(screen.getByText(/PC-ASA-ROJO/)).toBeVisible();
    expect(screen.getByText(/4 un\/ciclo/)).toBeVisible();
    expect(screen.getAllByText(/250 ciclos calculados/)[0]).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Crear OF en borrador' }));

    expect(crearOrdenFabricacionExcepcionalScm).toHaveBeenCalledWith(expect.objectContaining({
      motivo: 'Stock de asas para prearmado',
      molde_id: 'ML-ASA',
      maquina_prevista_id: 8,
      snapshot_tiempo_ciclo_seg: 20,
      snapshot_horas_turno: 8,
      snapshot_peso_colada_gr: 2,
      corridas: [{
        color_produccion_id: 5,
        receta_revision_id: 51,
        objetivo_neto_kg: 12,
        salidas: [{
          articulo_scm_id: 91,
          cantidad_por_ciclo: 4,
          peso_unitario_g: 12,
        }],
      }],
    }), expect.any(String));
    expect(await screen.findByText(/OF-000010 creada como reposición/)).toBeVisible();
  });

  it.each([
    ['capacidad de artículo explícita', true, false],
    ['sin capacidad de artículo', false, true],
  ])('propaga capacidades independientes a Nueva OF: %s', async (_label, articleAdmin, expectDisabled) => {
    const user = userEvent.setup();
    auth.article = articleAdmin;
    obtenerMoldes.mockResolvedValue([{
      codigo: 'ML-OF-CAPS', nombre: 'Molde caps', activo: true,
      tiempo_ciclo_std: 20, peso_colada_gr: 2,
      formas: [{ pieza_id: 31, pieza_codigo: 'PZ-CAPS', nombre: 'Pieza caps', activo: true, cavidades: 1, peso_unitario_gr: 12, variantes: [{ sku: 'PC-CAPS', color_produccion_id: 5 }] }],
    }]);
    obtenerMolde.mockResolvedValue({
      codigo: 'ML-OF-CAPS', nombre: 'Molde caps', activo: true,
      tiempo_ciclo_std: 20, peso_colada_gr: 2,
      formas: [{ pieza_id: 31, pieza_codigo: 'PZ-CAPS', nombre: 'Pieza caps', activo: true, cavidades: 1, peso_unitario_gr: 12, variantes: [{ sku: 'PC-CAPS', color_produccion_id: 5 }] }],
    });
    obtenerMaquinas.mockResolvedValue([{ id: 8, codigo: 'INY-CAPS', nombre: 'Inyectora caps', activo: true, estado: 'OPERATIVA', tipo_maquina: { proceso: 'INYECCION' } }]);
    obtenerColores.mockResolvedValue([{ id: 5, nombre: 'ROJO', activo: true }]);
    listarArticulosScm.mockResolvedValue([{ id: 91, codigo: 'PC-CAPS', nombre: 'Pieza caps', clase: 'PIEZA_COLOR', pieza_id: 31, subtipo: { pieza_color_sku: 'PC-CAPS' } }]);
    obtenerRecetasColorMaestras.mockResolvedValue({ items: [] });
    render(<ThemeProvider theme={createTheme()}><MemoryRouter><FabricationOrdersScm /></MemoryRouter></ThemeProvider>);
    await user.click(await screen.findByRole('button', { name: 'Nueva OF de reposición' }));
    await user.click(screen.getByRole('combobox', { name: 'Motivo de reposición' }));
    await user.click(screen.getByRole('option', { name: 'Otro', exact: true }));
    await user.type(screen.getByRole('textbox', { name: 'Especifica el motivo' }), 'Prueba capacidades OF');
    await user.click(screen.getByRole('combobox', { name: 'Molde' }));
    await user.click(await screen.findByRole('option', { name: /Molde caps.*ML-OF-CAPS/ }));
    await user.click(screen.getByRole('combobox', { name: 'Proceso de fabricación' }));
    await user.click(screen.getByRole('option', { name: 'Inyección' }));
    await user.click(screen.getByRole('combobox', { name: 'Máquina sugerida (opcional)' }));
    await user.click(await screen.findByRole('option', { name: /INY-CAPS/ }));
    await user.click(screen.getByRole('combobox', { name: 'Color del objetivo 1' }));
    await user.click(await screen.findByRole('option', { name: 'ROJO' }));
    await user.click(screen.getByRole('button', { name: /Acciones de ruta para Objetivo 1/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Administrar' }));
    const ownerButton = await screen.findByRole('button', { name: 'Preparar ruta para otro artículo' });
    if (expectDisabled) expect(ownerButton).toBeDisabled();
    else expect(ownerButton).toBeEnabled();
  });

  it('explica el siguiente paso cuando Planificación todavía no generó OF', async () => {
    listarOrdenesFabricacionScm.mockReset();
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [], pagination: { page: 1, page_size: 25, total: 0, total_pages: 0 } });
    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter>
          <FabricationOrdersScm />
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(await screen.findByText('Aún no hay órdenes de fabricación')).toBeVisible();
    expect(screen.queryByRole('combobox', { name: 'Orden de fabricación' }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ir a Planificación' }))
      .not.toBeInTheDocument();
  });

  it('no confunde un fallo de carga con una colección vacía', async () => {
    listarOrdenesFabricacionScm.mockRejectedValueOnce(new Error('Servicio no disponible'));

    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter>
          <FabricationOrdersScm />
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(await screen.findByText('Servicio no disponible')).toBeVisible();
    expect(screen.queryByText('Aún no hay órdenes de fabricación')).not.toBeInTheDocument();
  });

  it('filtra el recurso y mantiene opcional la sugerencia de máquina', async () => {
    const user = userEvent.setup();
    const order = {
        id: 'of-1',
        codigo: 'OF-000001',
        estado: 'BORRADOR',
        version: 1,
        proceso_requerido: 'SOPLADO',
        corridas: [{
          id: 'run-1',
          codigo: 'OF-000001-C01',
          color_produccion_id: 1,
          salidas: [{
            id: 'out-1',
            articulo: {
              codigo: 'PC-000005',
              nombre: 'Alcancía verde',
              clase: 'PIEZA_COLOR',
              pieza_id: 5,
            },
            cantidad_objetivo: '2400.000',
            excedente_objetivo: '0.000',
          }],
        },
      ],
    };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    obtenerMoldes.mockResolvedValue([
      {
        codigo: 'ML-CORRECTO',
        nombre: 'Molde Alcancía',
        activo: true,
        tiempo_ciclo_std: 45,
        peso_colada_gr: 5,
        formas: [{ pieza_id: 5, activo: true }],
      },
      {
        codigo: 'ML-AJENO',
        nombre: 'Molde Jarra',
        activo: true,
        formas: [{ pieza_id: 1, activo: true }],
      },
    ]);
    obtenerMaquinas.mockResolvedValue([
      {
        id: 10,
        codigo: 'MAQ-SOP',
        nombre: 'Sopladora',
        activo: true,
        estado: 'OPERATIVA',
        tipo_maquina: { proceso: 'SOPLADO' },
      },
      {
        id: 11,
        codigo: 'MAQ-INY',
        nombre: 'Haitian',
        activo: true,
        estado: 'OPERATIVA',
        tipo_maquina: { proceso: 'INYECCION' },
      },
    ]);
    obtenerColores.mockResolvedValue([{ id: 1, nombre: 'VERDE', activo: true }]);

    renderDetail(order);

    await screen.findByText('Configuración del recurso');
    const mold = screen.getByRole('combobox', { name: 'Molde' });
    const machine = screen.getByRole('combobox', { name: 'Máquina sugerida (opcional)' });
    expect(mold).toHaveValue('Molde Alcancía');
    expect(mold).toHaveAttribute('title', 'Molde Alcancía · ML-CORRECTO');
    expect(machine).toHaveValue('');
    expect(screen.getByText('Máquina sugerida (opcional)', { selector: 'label' })).toBeVisible();
    expect(screen.getByText(/Se muestran moldes compatibles con SOPLADO/))
      .toBeVisible();
    expect(screen.getByRole('spinbutton', { name: 'Horas efectivas' })).toBeValid();

    await user.click(mold);
    expect(screen.getByRole('option', { name: /ML-CORRECTO/ })).toBeVisible();
    expect(screen.queryByRole('option', { name: /ML-AJENO/ })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(machine);
    expect(screen.getByRole('option', { name: /Sopladora.*MAQ-SOP/ })).toBeVisible();
    expect(screen.queryByRole('option', { name: /MAQ-INY/ })).not.toBeInTheDocument();
  });

  it('prioriza kg netos, calcula ciclos con techo y conserva el mínimo de demanda', async () => {
    const user = userEvent.setup();
    const order = {
      id: 'of-kg-target', codigo: 'OF-KG-TARGET', estado: 'BORRADOR', version: 4,
      molde_id: 'ML-ASA', maquina_prevista_id: 8,
      snapshot_tiempo_ciclo_seg: '20', snapshot_horas_turno: '8', snapshot_peso_colada_gr: '2',
      corridas: [{
        id: 'run-kg-target', codigo: 'OF-KG-TARGET-C01', color_produccion_id: 5,
        ciclos_objetivo: 3, salidas: [{
          id: 'out-kg-target', cantidad_objetivo: '10.000', excedente_objetivo: '0.000',
          cantidad_por_ciclo_snapshot: '4.0000', peso_unitario_snapshot_g: '12.0000',
          articulo: { codigo: 'PC-ASA-ROJO', nombre: 'Asa ROJO', clase: 'PIEZA_COLOR', pieza_id: 31 },
        }, {
          id: 'out-kg-target-2', cantidad_objetivo: '5.000', excedente_objetivo: '0.000',
          cantidad_por_ciclo_snapshot: '2.0000', peso_unitario_snapshot_g: '30.0000',
          articulo: { codigo: 'PC-TAPA-ROJO', nombre: 'Tapa ROJO', clase: 'PIEZA_COLOR', pieza_id: 32 },
        }],
      }],
    };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    obtenerMoldes.mockResolvedValue([{
      codigo: 'ML-ASA', nombre: 'Molde Asa', activo: true,
      formas: [
        { pieza_id: 31, activo: true, cavidades: 4, peso_unitario_gr: 12 },
        { pieza_id: 32, activo: true, cavidades: 2, peso_unitario_gr: 30 },
      ],
    }]);
    obtenerMaquinas.mockResolvedValue([{ id: 8, codigo: 'INY-01', nombre: 'Inyectora 1', activo: true, estado: 'OPERATIVA' }]);
    obtenerColores.mockResolvedValue([{ id: 5, nombre: 'ROJO', activo: true }]);
    configurarOrdenFabricacionScm.mockResolvedValue({ codigo: order.codigo });

    renderDetail(order);

    await screen.findByText('Configuración del recurso');
    const mold = screen.getByRole('combobox', { name: 'Molde' });
    expect(mold).toHaveValue('Molde Asa');
    await user.click(mold);
    expect(screen.getByRole('option', { name: /Molde Asa.*ML-ASA/ })).toBeVisible();
    await user.keyboard('{Escape}');

    const target = screen.getByLabelText(/Objetivo neto \(kg\)/);
    await user.type(target, '0.05');
    expect(screen.getAllByText(/3 ciclos calculados/)[0]).toBeVisible();
    expect(screen.getByText(/0\.32 kg alcanzables/)).toBeVisible();
    expect(screen.getByText(/0\.32 kg alcanzables/)).toHaveAttribute('title', '0.324 kg (valor original)');
    expect(screen.getByText(/redondeo de 0\.27 kg/)).toBeVisible();
    expect(screen.queryByLabelText(/Ciclos del objetivo 1/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Guardar configuración técnica' }));
    expect(configurarOrdenFabricacionScm).toHaveBeenCalledWith(order.id, expect.objectContaining({
      corridas: [expect.objectContaining({
        objetivo_neto_kg: 0.05,
        salidas: expect.arrayContaining([expect.objectContaining({ id: 'out-kg-target' })]),
      })],
    }));
    expect(configurarOrdenFabricacionScm.mock.calls[0][1].corridas[0]).not.toHaveProperty('ciclos_objetivo');
  });

  it('calcula 7 ciclos para 0.07 kg con 0.01 kg netos por ciclo', async () => {
    const user = userEvent.setup();
    const order = {
      id: 'of-decimal-target', codigo: 'OF-DECIMAL-TARGET', estado: 'BORRADOR', version: 1,
      molde_id: 'ML-DECIMAL',
      corridas: [{
        id: 'run-decimal-target', codigo: 'OF-DECIMAL-TARGET-C01', color_produccion_id: 5,
        salidas: [{
          id: 'out-decimal-target', cantidad_objetivo: '1.000', excedente_objetivo: '0.000',
          cantidad_por_ciclo_snapshot: '1.0000', peso_unitario_snapshot_g: '10.0000',
          articulo: { codigo: 'PC-DECIMAL', nombre: 'Pieza decimal', clase: 'PIEZA_COLOR', pieza_id: 99 },
        }],
      }],
    };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    obtenerMoldes.mockResolvedValue([{
      codigo: 'ML-DECIMAL', nombre: 'Molde decimal', activo: true,
      formas: [{ pieza_id: 99, activo: true, cavidades: 1, peso_unitario_gr: 10 }],
    }]);
    obtenerColores.mockResolvedValue([{ id: 5, nombre: 'ROJO', activo: true }]);

    renderDetail(order);

    const target = await screen.findByRole('spinbutton', { name: /Objetivo neto \(kg\)/ });
    await user.type(target, '0.07');
    expect(screen.getByText('7 ciclos calculados')).toBeVisible();
    expect(screen.getByText(/0\.07 kg alcanzables/)).toBeVisible();
  });

  it('exige objetivo kg en un objetivo de color nuevo', async () => {
    const user = userEvent.setup();
    const order = {
      id: 'of-required-target', codigo: 'OF-REQUIRED-TARGET', estado: 'BORRADOR', version: 1,
      molde_id: 'ML-REQUIRED',
      corridas: [{
        id: 'run-required', codigo: 'OF-REQUIRED-TARGET-C01', ciclos_objetivo: 4, salidas: [],
      }],
    };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    obtenerMoldes.mockResolvedValue([{ codigo: 'ML-REQUIRED', nombre: 'Molde requerido', activo: true, formas: [] }]);

    renderDetail(order);

    const target = await screen.findByRole('spinbutton', { name: /Objetivo neto \(kg\)/ });
    expect(target).toBeRequired();
    expect(screen.getByText(/Obligatorio para este objetivo de color nuevo/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Guardar configuración técnica' }));
    expect(await screen.findByText(/Completa el objetivo neto en kg de cada objetivo de color nuevo/)).toBeVisible();
    expect(configurarOrdenFabricacionScm).not.toHaveBeenCalled();
  });

  it('conserva una orden legacy cargada sin objetivo kg y envía sus ciclos de referencia', async () => {
    const user = userEvent.setup();
    const order = {
      id: 'of-legacy', codigo: 'OF-LEGACY', estado: 'BORRADOR', version: 2,
      molde_id: 'ML-LEGACY',
      corridas: [{
        id: 'run-legacy', codigo: 'OF-LEGACY-C01', ciclos_objetivo: 4,
        lote_color_legacy_id: 44, meta_kg_legacy: '12.000', salidas: [],
      }],
    };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    obtenerMoldes.mockResolvedValue([{ codigo: 'ML-LEGACY', nombre: 'Molde legacy', activo: true, formas: [] }]);
    configurarOrdenFabricacionScm.mockResolvedValue({ codigo: order.codigo });

    renderDetail(order);

    const target = await screen.findByRole('spinbutton', { name: /Objetivo neto \(kg\)/ });
    expect(target).not.toBeRequired();
    expect(screen.getByText('4 ciclos calculados')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Guardar configuración técnica' }));
    expect(configurarOrdenFabricacionScm).not.toHaveBeenCalled();
    expect(screen.getByRole('spinbutton', { name: 'Material no neto/ciclo (g)' })).toHaveAccessibleDescription(/usa 0 si no corresponde/);
    await user.type(screen.getByRole('spinbutton', { name: 'Material no neto/ciclo (g)' }), '0');
    await user.click(screen.getByRole('button', { name: 'Guardar configuración técnica' }));
    expect(configurarOrdenFabricacionScm).toHaveBeenCalledWith(order.id, expect.objectContaining({
      corridas: [expect.objectContaining({ ciclos_objetivo: 4 })],
    }));
  });

  it('deriva cavidades y peso neto para un PT monopieza sin pedir datos manuales', async () => {
    const order = {
        id: 'of-jarra',
        codigo: 'OF-000001',
        estado: 'BORRADOR',
        version: 1,
        proceso_requerido: 'INYECCION',
        corridas: [{
          id: 'run-jarra',
          codigo: 'OF-000001-C01',
          color_produccion_id: 1,
          salidas: [{
            id: 'out-jarra',
            articulo: {
              codigo: 'PT-JARRA-REAL-6L-TRANSPARENTE',
              nombre: 'Jarra Real 6 L Transparente',
              clase: 'PRODUCTO_TERMINADO',
              pieza_id: 5,
              derivacion_molde: 'PT_MONOPIEZA',
            },
            cantidad_objetivo: '100.000',
            excedente_objetivo: '0.000',
          }],
        }],
    };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    obtenerMoldes.mockResolvedValue([{
      codigo: 'ML-JARRA-REAL-6L',
      nombre: 'Molde Jarra Real 6 L',
      activo: true,
      tiempo_ciclo_std: 30,
      peso_colada_gr: 10,
      peso_tiro_gr: 250,
      peso_neto_gr: 240,
      cavidades_totales: 1,
      formas: [{
        pieza_id: 5,
        activo: true,
        cavidades: 1,
        peso_unitario_gr: 240,
      }],
    }]);
    obtenerMaquinas.mockResolvedValue([{
      id: 10,
      codigo: 'INY-01',
      nombre: 'Inyectora 1',
      activo: true,
      estado: 'OPERATIVA',
      tipo_maquina: { proceso: 'INYECCION' },
    }]);
    obtenerColores.mockResolvedValue([{ id: 1, nombre: 'TRANSPARENTE', activo: true }]);

    renderDetail(order);

    const row = await screen.findByRole('row', { name: /Jarra Real 6 L Transparente/ });
    expect(within(row).getByText('PT monopieza · derivado')).toBeVisible();
    expect(within(row).getByText('Componente único del PT')).toBeVisible();
    expect(within(row).getByText('Neto de una unidad')).toBeVisible();
    expect(within(row).getByText('1')).toBeVisible();
    expect(within(row).getByText('240.0 g')).toBeVisible();
    expect(within(row).queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.getByText(/240\.0 g netos\/ciclo y 250\.0 g de peso bruto por ciclo/)).toBeVisible();
    expect(screen.getByText(/10\.0 g es material no neto/)).toBeVisible();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ver ayuda' }));
    expect(screen.getByText(/La OPM todavía no debe existir/)).toBeVisible();
  });

  it('prefiere el contexto temporal canónico y muestra un rango de necesidad', async () => {
    const order = {
      id: 'of-date', codigo: 'OF-000010', estado: 'LIBERADA', version: 1,
      fecha_necesidad: '2026-08-15',
      fecha_necesidad_fuente: { tipo: 'OP', id: 'op-1', codigo: 'OP-000001' },
      rango_fechas_ot: { desde: null, hasta: null, cantidad: 0 },
      programacion_estado: 'SIN_JORNADA',
      contexto_temporal: {
        fecha_necesidad_min: '2026-08-15',
        fecha_necesidad_max: '2026-08-17',
        fecha_ot_primera: '2026-08-10',
        fecha_ot_ultima: '2026-08-11',
        programacion_estado: 'EN_EJECUCION',
        cantidad_ot: 2,
      },
      corridas: [{ id: 'run-date', codigo: 'C01', salidas: [] }],
    };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });

    renderDetail(order);

    const strip = await screen.findByTestId('order-schedule-strip');
    expect(strip).toHaveTextContent(/Necesidad.*15\/08\/2026.*17\/08\/2026/);
    expect(strip).toHaveTextContent(/Jornadas OT.*10\/08\/2026.*11\/08\/2026/);
    expect(within(strip).getByText('En ejecución')).toBeVisible();
    expect(within(strip).getByText('2 OT')).toBeVisible();
    expect(within(strip).queryByRole('textbox')).not.toBeInTheDocument();
  });
  it('cierra una OF desde pesajes efectivos y muestra la proyección de la OP', async () => {
    const user = userEvent.setup();
    const running = {
      id: 'of-running', codigo: 'OF-000020', estado: 'EN_EJECUCION', version: 7,
      corridas: [{ id: 'run-1', codigo: 'C01', salidas: [] }],
    };
    listarOrdenesFabricacionScm
      .mockResolvedValueOnce({ items: [running] })
      .mockResolvedValueOnce({ items: [{ ...running, estado: 'CERRADA', version: 8 }] });
    cerrarOrdenFabricacionScm.mockResolvedValue({
      ...running,
      estado: 'CERRADA',
      cierre: {
        ordenes_produccion: [{ codigo: 'OP-000010', estado: 'COMPLETADA' }],
      },
    });

    renderDetail(running);

    await user.type(
      await screen.findByLabelText(/Motivo de diferencia/),
      'Cierre conciliado del turno',
    );
    await user.click(screen.getByRole('button', { name: 'Cerrar OF' }));

    expect(cerrarOrdenFabricacionScm).toHaveBeenCalledWith('of-running', {
      version: 7,
      motivo: 'Cierre conciliado del turno',
    });
    expect(await screen.findByText(/OP: OP-000010 COMPLETADA/)).toBeVisible();
  });

  it('preserva una referencia de ruta sin reenviarla si no cambió', async () => {
    const order = {
      id: 'of-route-preserve', codigo: 'OF-ROUTE-PRESERVE', estado: 'BORRADOR', version: 2,
      fuente_proceso: 'EXPLICITO', snapshot_proceso: 'INYECCION', molde_id: 'M-ROUTE',
      snapshot_tiempo_ciclo_seg: '20', snapshot_horas_turno: '8', snapshot_peso_colada_gr: '2',
      corridas: [{ id: 'run-route', codigo: 'C01', objetivo_neto_kg: '1', operacion_ruta_revision_id: 77, salidas: [] }],
    };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    obtenerMoldes.mockResolvedValue([{ codigo: 'M-ROUTE', nombre: 'Molde route', activo: true, formas: [] }]);
    configurarOrdenFabricacionScm.mockResolvedValue(order);
    renderDetail(order);
    await screen.findByText('Configuración del recurso');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Guardar configuración técnica' }));
    await waitFor(() => expect(configurarOrdenFabricacionScm).toHaveBeenCalled());
    expect(configurarOrdenFabricacionScm.mock.calls[0][1].corridas[0]).not.toHaveProperty('operacion_ruta_revision_id');
  });

  it('deja readonly la ruta planificada y omite su referencia al guardar', async () => {
    const order = {
      id: 'of-route-planned', codigo: 'OF-ROUTE-PLANNED', estado: 'BORRADOR', version: 3,
      plan_produccion_id: 'plan-1', proceso_requerido: 'SOPLADO', molde_id: 'M-PLAN',
      snapshot_tiempo_ciclo_seg: '20', snapshot_horas_turno: '8', snapshot_peso_colada_gr: '2',
      corridas: [{ id: 'run-plan', codigo: 'C01', objetivo_neto_kg: '1', operacion_ruta_revision_id: 88, salidas: [] }],
    };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    obtenerMoldes.mockResolvedValue([{ codigo: 'M-PLAN', nombre: 'Molde plan', activo: true, formas: [] }]);
    configurarOrdenFabricacionScm.mockResolvedValue(order);
    renderDetail(order);
    const route = await screen.findByRole('combobox', { name: 'Operación de ruta (opcional)' });
    expect(route).toBeDisabled();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Guardar configuración técnica' }));
    await waitFor(() => expect(configurarOrdenFabricacionScm).toHaveBeenCalled());
    expect(configurarOrdenFabricacionScm.mock.calls[0][1].corridas[0]).not.toHaveProperty('operacion_ruta_revision_id');
  });

  it('envía null al retirar explícitamente un override y derivar rutas aprobadas', async () => {
    const user = userEvent.setup();
    const order = {
      id: 'of-route-derive', codigo: 'OF-ROUTE-DERIVE', estado: 'BORRADOR', version: 4,
      fuente_proceso: 'EXPLICITO', snapshot_proceso: 'INYECCION', molde_id: 'M-DERIVE',
      snapshot_tiempo_ciclo_seg: '20', snapshot_horas_turno: '8', snapshot_peso_colada_gr: '2',
      corridas: [{
        id: 'run-derive', codigo: 'C01', objetivo_neto_kg: '1', operacion_ruta_revision_id: 88,
        salidas: [{ id: 'out-derive', articulo: { id: 5, pieza_id: 5, nombre: 'Pieza 5', codigo: 'PC-5' } }],
      }],
    };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    auth.outputRoutes.mockResolvedValue({
      items: [{
        operation_id: 88, route_revision_id: 1, route_revision_number: 1, route_content_hash: 'hash', route_state: 'APROBADA',
        operation: { id: 88, executor_kind: 'OP_OT', tipo: 'INYECCION', nombre: 'Inyectar pieza' },
        output_article: { id: 5, codigo: 'PC-5', clase: 'PIEZA_COLOR' },
        owner_route_target_article: { id: 5, codigo: 'PC-5', clase: 'PIEZA_COLOR' },
      }], total: 1, has_more: false, next_cursor: null,
    });
    obtenerMoldes.mockResolvedValue([{ codigo: 'M-DERIVE', nombre: 'Molde derive', activo: true, formas: [{ pieza_id: 5, activo: true }] }]);
    configurarOrdenFabricacionScm.mockResolvedValue(order);
    renderDetail(order);
    await screen.findByText('Configuración del recurso');
    await user.click(screen.getByRole('combobox', { name: 'Proceso de fabricación' }));
    await user.click(await screen.findByRole('option', { name: 'Derivar de rutas — Inyección' }));
    await user.click(screen.getByRole('button', { name: 'Guardar configuración técnica' }));
    await waitFor(() => expect(configurarOrdenFabricacionScm).toHaveBeenCalled());
    expect(configurarOrdenFabricacionScm.mock.calls[0][1]).toHaveProperty('proceso', null);
  });

  it('serializa null al limpiar una referencia de ruta existente', async () => {
    const user = userEvent.setup();
    const order = {
      id: 'of-route-clear', codigo: 'OF-ROUTE-CLEAR', estado: 'BORRADOR', version: 5,
      fuente_proceso: 'EXPLICITO', snapshot_proceso: 'INYECCION', molde_id: 'M-CLEAR',
      snapshot_tiempo_ciclo_seg: '20', snapshot_horas_turno: '8', snapshot_peso_colada_gr: '2',
      corridas: [{ id: 'run-clear', codigo: 'C01', objetivo_neto_kg: '1', operacion_ruta_revision_id: 77, operacion_ruta: { id: 77, tipo: 'INYECCION', nombre: 'Ruta vieja' }, salidas: [] }],
    };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    obtenerMoldes.mockResolvedValue([{ codigo: 'M-CLEAR', nombre: 'Molde clear', activo: true, formas: [] }]);
    configurarOrdenFabricacionScm.mockResolvedValue(order);
    renderDetail(order);
    const route = await screen.findByRole('combobox', { name: 'Operación de ruta (opcional)' });
    await user.click(within(route.closest('.MuiFormControl-root')).getByRole('button', { name: 'Limpiar selección' }));
    await user.click(screen.getByRole('button', { name: 'Guardar configuración técnica' }));
    await waitFor(() => expect(configurarOrdenFabricacionScm).toHaveBeenCalled());
    expect(configurarOrdenFabricacionScm.mock.calls[0][1].corridas[0]).toHaveProperty('operacion_ruta_revision_id', null);
  });

  it('serializa el nuevo ID de ruta cuando cambia el vínculo', async () => {
    const user = userEvent.setup();
    const order = {
      id: 'of-route-change', codigo: 'OF-ROUTE-CHANGE', estado: 'BORRADOR', version: 6,
      fuente_proceso: 'EXPLICITO', snapshot_proceso: 'INYECCION', molde_id: 'M-CHANGE',
      snapshot_tiempo_ciclo_seg: '20', snapshot_horas_turno: '8', snapshot_peso_colada_gr: '2',
      corridas: [{ id: 'run-change', codigo: 'C01', objetivo_neto_kg: '1', operacion_ruta_revision_id: 77,
        salidas: [{ id: 'out-change', articulo: { id: 5, pieza_id: 5, nombre: 'Pieza 5', codigo: 'PC-5' } }] }],
    };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    auth.outputRoutes.mockResolvedValue({
      items: [{
        operation_id: 88, route_revision_id: 2, route_revision_number: 2, route_content_hash: 'hash-2', route_state: 'APROBADA',
        operation: { id: 88, executor_kind: 'OP_OT', tipo: 'INYECCION', nombre: 'Inyectar nueva' },
        output_article: { id: 5, codigo: 'PC-5', clase: 'PIEZA_COLOR' },
        owner_route_target_article: { id: 5, codigo: 'PC-5', clase: 'PIEZA_COLOR' },
      }], total: 1, has_more: false, next_cursor: null,
    });
    obtenerMoldes.mockResolvedValue([{ codigo: 'M-CHANGE', nombre: 'Molde change', activo: true, formas: [{ pieza_id: 5, activo: true }] }]);
    configurarOrdenFabricacionScm.mockResolvedValue(order);
    renderDetail(order);
    const route = await screen.findByRole('combobox', { name: 'Operación de ruta (opcional)' });
    await user.click(route);
    await user.click(await screen.findByRole('option', { name: /Inyectar nueva.*Inyección/ }));
    await user.click(screen.getByRole('button', { name: 'Guardar configuración técnica' }));
    await waitFor(() => expect(configurarOrdenFabricacionScm).toHaveBeenCalled());
    expect(configurarOrdenFabricacionScm.mock.calls[0][1].corridas[0]).toHaveProperty('operacion_ruta_revision_id', 88);
  });

  it('descarta una búsqueda de rutas diferida del actor anterior al cambiar la OF de contexto', async () => {
    const user = userEvent.setup();
    const order = {
      id: 'of-route-actor-stale', codigo: 'OF-ROUTE-ACTOR', estado: 'BORRADOR', version: 1,
      fuente_proceso: 'EXPLICITO', snapshot_proceso: 'INYECCION', molde_id: 'M-ACTOR',
      snapshot_tiempo_ciclo_seg: '20', snapshot_horas_turno: '8', snapshot_peso_colada_gr: '2',
      corridas: [{
        id: 'run-actor-stale', codigo: 'C01', color_produccion_id: 7, objetivo_neto_kg: '1', salidas: [
          { id: 'out-actor-stale', articulo: { id: 5, pieza_id: 5, nombre: 'Pieza actor', codigo: 'PC-ACTOR' } },
        ],
      }],
    };
    const routeFor = (operationId, revisionId, name, hash) => ({
      operation_id: operationId,
      route_revision_id: revisionId,
      route_revision_number: 1,
      route_content_hash: hash,
      route_state: 'APROBADA',
      operation: { id: operationId, clave: `OP-${operationId}`, nombre: name, tipo: 'INYECCION', executor_kind: 'OP_OT' },
      output_article: { id: 5, codigo: 'PC-ACTOR', clase: 'PIEZA_COLOR' },
      owner_route_target_article: { id: 506, codigo: 'WIP-506', clase: 'SUBENSAMBLE_WIP' },
    });
    const actorARoute = routeFor(501, 701, 'Ruta actor A', 'hash-actor-a');
    const actorBRoute = routeFor(502, 702, 'Ruta actor B buscar', 'hash-actor-b');
    let resolveSearchA;
    auth.outputRoutes.mockImplementation((_articleId, requestedActor, options) => {
      if (options?.q === 'buscar') return new Promise((resolve) => { resolveSearchA = resolve; });
      return Promise.resolve({ items: [requestedActor === 1 ? actorARoute : actorBRoute], total: 1, has_more: false });
    });
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    listarArticulosScm.mockResolvedValue([{ id: 5, clase: 'PIEZA_COLOR', activo: true, subtipo: { pieza_color_sku: 'SKU-ACTOR' } }]);
    obtenerMoldes.mockResolvedValue([{
      codigo: 'M-ACTOR', nombre: 'Molde actor', activo: true,
      formas: [{ pieza_id: 5, activo: true, variantes: [{ color_produccion_id: 7, sku: 'SKU-ACTOR' }] }],
    }]);
    const view = renderDetail(order);
    const routeInput = await screen.findByRole('combobox', { name: 'Operación de ruta (opcional)' });
    await user.click(routeInput);
    expect(await screen.findByRole('option', { name: /Ruta actor A/ })).toBeVisible();
    await user.type(routeInput, 'buscar');
    await new Promise((resolve) => setTimeout(resolve, 350));
    await waitFor(() => expect(auth.outputRoutes).toHaveBeenCalledWith(
      5,
      1,
      expect.objectContaining({ q: 'buscar', limite: 100 }),
      expect.any(AbortSignal),
    ));

    auth.actorId = 2;
    view.rerender(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter initialEntries={[`/produccion/ordenes-fabricacion?of=${order.id}`]}>
          <FabricationOrdersScm />
        </MemoryRouter>
      </ThemeProvider>,
    );
    await waitFor(() => expect(auth.outputRoutes).toHaveBeenCalledWith(
      '5',
      2,
      expect.objectContaining({ limite: 100 }),
      expect.any(AbortSignal),
    ));
    resolveSearchA({ items: [actorARoute], total: 1, has_more: false });
    const refreshedRouteInput = screen.getByRole('combobox', { name: 'Operación de ruta (opcional)' });
    await user.clear(refreshedRouteInput);
    await waitFor(() => expect(refreshedRouteInput).not.toBeDisabled());
    await user.click(refreshedRouteInput);
    await new Promise((resolve) => setTimeout(resolve, 350));
    await waitFor(() => expect(auth.outputRoutes).toHaveBeenCalledWith(
      5,
      2,
      expect.objectContaining({ q: undefined, limite: 100 }),
      expect.any(AbortSignal),
    ));
    expect(auth.outputRoutes.mock.calls.some(([articleId, requestedActor]) => (
      String(articleId) === '5' && requestedActor === 2
    ))).toBe(true);
    expect(screen.queryByRole('option', { name: /Ruta actor A/ })).not.toBeInTheDocument();
  });

  it('permite reintentar una ruta fallida sin perder las rutas ya resueltas', async () => {
    const order = {
      id: 'of-route-retry', codigo: 'OF-ROUTE-RETRY', estado: 'BORRADOR', version: 7,
      fuente_proceso: 'EXPLICITO', snapshot_proceso: 'INYECCION', molde_id: 'M-RETRY',
      snapshot_tiempo_ciclo_seg: '20', snapshot_horas_turno: '8', snapshot_peso_colada_gr: '2',
      corridas: [{
        id: 'run-retry', codigo: 'C01', color_produccion_id: 7, objetivo_neto_kg: '1', salidas: [
          { id: 'out-retry', articulo: { id: 5, pieza_id: 5, nombre: 'Pieza 5', codigo: 'PC-5' } },
        ],
      }],
    };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    listarArticulosScm.mockResolvedValue([{ id: 5, clase: 'PIEZA_COLOR', subtipo: { pieza_color_sku: 'SKU-5' } }]);
    obtenerMoldes.mockResolvedValue([{
      codigo: 'M-RETRY', nombre: 'Molde retry', activo: true,
      formas: [{ pieza_id: 5, activo: true, cavidades: 1, peso_unitario_gr: 1, variantes: [{ color_produccion_id: 7, sku: 'SKU-5' }] }],
    }]);
    listarRutasArticuloScm
      .mockRejectedValueOnce(new Error('rutas temporalmente no disponibles'))
      .mockResolvedValueOnce([]);
    listarRutasArticuloScm.mockClear();
    renderDetail(order);

    expect(await screen.findByText(/No se pudieron cargar las rutas opcionales/)).toBeVisible();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar rutas' }));
    await waitFor(() => expect(listarRutasArticuloScm).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText(/No se pudieron cargar las rutas opcionales/)).not.toBeInTheDocument());
  });

  it('no consulta rutas ni ofrece acciones a un perfil sin RUTA_VER', async () => {
    auth.routeView = false;
    const order = {
      id: 'of-route-restricted', codigo: 'OF-ROUTE-RESTRICTED', estado: 'LIBERADA', version: 2,
      corridas: [{
        id: 'run-restricted', codigo: 'C01', operacion_ruta_revision_id: 201,
        operacion_ruta: { id: 201, nombre: 'Ruta restringida', ruta_revision_id: 20 },
        salidas: [{ articulo: { id: 5, nombre: 'Pieza 5', codigo: 'PC-5' } }],
      }],
    };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    renderDetail(order);
    await screen.findByText('Configuración del recurso');
    expect(listarRutasArticuloScm).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Acciones de ruta para C01' })).not.toBeInTheDocument();
  });

  it('gates Administrar by route/article read plus route administration, independently of OF editing', async () => {
    auth.articleView = false;
    const order = {
      id: 'of-route-admin', codigo: 'OF-ROUTE-ADMIN', estado: 'LIBERADA', version: 2,
      corridas: [{
        id: 'run-admin', codigo: 'C01', operacion_ruta_revision_id: 201,
        operacion_ruta: { id: 201, nombre: 'Ruta de administración', ruta_revision_id: 20 },
        salidas: [{ articulo: { id: 5, nombre: 'Pieza 5', codigo: 'PC-5' } }],
      }],
    };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    listarRutasArticuloScm.mockResolvedValue([{ id: 20, numero_revision: 3, estado: 'APROBADA', content_hash: 'hash-20', operaciones: [] }]);
    renderDetail(order);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Acciones de ruta para C01' }));
    const admin = screen.getByRole('menuitem', { name: 'Administrar' });
    expect(admin).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('menuitem', { name: 'Ver ruta' })).toBeEnabled();
    expect(screen.getByRole('menuitem', { name: 'Actualizar' })).toBeEnabled();
  });

  it('abre Ingeniería de rutas en la superficie OF sin popup ni URL padre', async () => {
    const user = userEvent.setup();
    const order = {
      id: 'of-route-admin-embedded', codigo: 'OF-ROUTE-EMBEDDED', estado: 'LIBERADA', version: 2,
      corridas: [{
        id: 'run-admin-embedded', codigo: 'C01', color_nombre: 'Azul', operacion_ruta_revision_id: 201,
        operacion_ruta: { id: 201, nombre: 'Ruta contextual', ruta_revision_id: 20 },
        salidas: [{ articulo: { id: 5, nombre: 'Pieza 5', codigo: 'PC-5', clase: 'PIEZA_COLOR' } }],
      }],
    };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    listarArticulosPaginaScm.mockResolvedValue({
      items: [{ id: 5, nombre: 'Pieza 5', codigo: 'PC-5', clase: 'PIEZA_COLOR', activo: true }],
      total: 1, has_more: false, next_cursor: null,
    });
    listarCentrosTrabajoScm.mockResolvedValue([{ id: 1, codigo: 'INY', nombre: 'Inyectora', tipo: 'INYECCION', activo: true }]);
    listarRutasArticuloScm.mockResolvedValue([{ id: 20, numero_revision: 3, estado: 'APROBADA', content_hash: 'hash-20', operaciones: [] }]);
    renderDetail(order);
    const initialUrl = window.location.href;
    const actionsButton = await screen.findByRole('button', { name: 'Acciones de ruta para C01' });
    await user.click(actionsButton);
    await user.click(screen.getByRole('menuitem', { name: 'Administrar' }));
    expect(await screen.findByRole('dialog', { name: 'Administrar ruta contextual' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Administrar' })).not.toBeInTheDocument();
    expect(window.location.href).toBe(initialUrl);
    await user.click(screen.getByRole('button', { name: 'Volver a OF' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Administrar ruta contextual' })).not.toBeInTheDocument());
    expect(window.location.href).toBe(initialUrl);
    expect(actionsButton).toHaveFocus();
  });

  it('protege el borrador de Ingeniería al cerrar embedded con Escape', async () => {
    const user = userEvent.setup();
    const order = {
      id: 'of-route-embedded-guard', codigo: 'OF-ROUTE-GUARD', estado: 'BORRADOR', version: 2,
      corridas: [{
        id: 'run-embedded-guard', codigo: 'C01', color_nombre: 'Azul',
        salidas: [{ articulo: { id: 5, nombre: 'Pieza 5', codigo: 'PC-5', clase: 'PIEZA_COLOR' } }],
      }],
    };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    listarArticulosPaginaScm.mockResolvedValue({
      items: [{ id: 5, nombre: 'Pieza 5', codigo: 'PC-5', clase: 'PIEZA_COLOR', activo: true }],
      total: 1, has_more: false, next_cursor: null,
    });
    listarCentrosTrabajoScm.mockResolvedValue([{ id: 1, codigo: 'INY', nombre: 'Inyectora', tipo: 'INYECCION', activo: true }]);
    listarRutasArticuloScm.mockResolvedValue([]);
    renderDetail(order);
    await user.click(await screen.findByRole('button', { name: 'Acciones de ruta para C01' }));
    await user.click(screen.getByRole('menuitem', { name: 'Administrar' }));
    await user.click(await screen.findByRole('button', { name: 'Nueva ruta' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre de la operación' }), 'Borrador protegido');
    await user.keyboard('{Escape}');
    expect(await screen.findByText(/Hay un borrador de ruta sin guardar/)).toBeVisible();
    expect(screen.getByRole('dialog', { name: 'Administrar ruta contextual' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Descartar niveles no guardados' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Administrar ruta contextual' })).not.toBeInTheDocument());
  });

  it('mantiene acciones de ruta autorizadas cuando OF_EDITAR_BORRADOR está ausente', async () => {
    auth.ofEdit = false;
    const order = {
      id: 'of-route-of-readonly', codigo: 'OF-ROUTE-OF-READONLY', estado: 'LIBERADA', version: 2,
      corridas: [{
        id: 'run-of-readonly', codigo: 'C01', operacion_ruta_revision_id: 201,
        operacion_ruta: { id: 201, nombre: 'Ruta autorizada', ruta_revision_id: 20 },
        salidas: [{ articulo: { id: 5, nombre: 'Pieza 5', codigo: 'PC-5' } }],
      }],
    };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    listarRutasArticuloScm.mockResolvedValue([{ id: 20, numero_revision: 3, estado: 'APROBADA', content_hash: 'hash-20', operaciones: [] }]);
    renderDetail(order);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Acciones de ruta para C01' }));
    expect(screen.getByRole('menuitem', { name: 'Ver ruta' })).toBeEnabled();
    expect(screen.getByRole('menuitem', { name: 'Administrar' })).toBeEnabled();
  });

  it('aísla respuestas tardías al cambiar actor y OF durante la consulta de rutas', async () => {
    const deferred = () => {
      let resolve;
      const promise = new Promise((nextResolve) => { resolve = nextResolve; });
      return { promise, resolve };
    };
    const firstRoutes = deferred();
    const secondRoutes = deferred();
    const orderA = {
      id: 'of-race-a', codigo: 'OF-RACE-A', estado: 'LIBERADA', version: 1,
      corridas: [{ id: 'run-race-a', codigo: 'C01', operacion_ruta_revision_id: 501,
        operacion_ruta: { id: 501, nombre: 'Ruta A', ruta_revision_id: 50 },
        salidas: [{ articulo: { id: 5, nombre: 'Pieza A', codigo: 'PC-A' } }] }],
    };
    const orderB = {
      id: 'of-race-b', codigo: 'OF-RACE-B', estado: 'LIBERADA', version: 1,
      corridas: [{ id: 'run-race-b', codigo: 'C01', operacion_ruta_revision_id: 601,
        operacion_ruta: { id: 601, nombre: 'Ruta B', ruta_revision_id: 60 },
        salidas: [{ articulo: { id: 5, nombre: 'Pieza B', codigo: 'PC-B' } }] }],
    };
    const RouteDriver = ({ orderId }) => {
      const navigate = useNavigate();
      useEffect(() => { navigate(`/produccion/ordenes-fabricacion?of=${orderId}`); }, [navigate, orderId]);
      return <FabricationOrdersScm />;
    };
    auth.actorId = 1;
    obtenerOrdenFabricacionScm.mockImplementation((id) => Promise.resolve(id === 'of-race-b' ? orderB : orderA));
    listarRutasArticuloScm.mockImplementation((articleId, actorId) => {
      if (String(articleId) !== '5') return Promise.resolve([]);
      return Number(actorId) === 1 ? firstRoutes.promise : secondRoutes.promise;
    });
    const view = render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter initialEntries={['/produccion/ordenes-fabricacion?of=of-race-a']}>
          <RouteDriver orderId="of-race-a" />
        </MemoryRouter>
      </ThemeProvider>,
    );
    await waitFor(() => expect(listarRutasArticuloScm).toHaveBeenCalledWith(
      '5', 1, expect.objectContaining({ limite: 100 }), expect.any(AbortSignal),
    ));
    auth.actorId = 2;
    view.rerender(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter initialEntries={['/produccion/ordenes-fabricacion?of=of-race-a']}>
          <RouteDriver orderId="of-race-b" />
        </MemoryRouter>
      </ThemeProvider>,
    );
    await waitFor(() => expect(listarRutasArticuloScm).toHaveBeenCalledWith(
      '5', 2, expect.objectContaining({ limite: 100 }), expect.any(AbortSignal),
    ));
    firstRoutes.resolve([{ id: 50, numero_revision: 1, estado: 'APROBADA', content_hash: 'hash-a', operaciones: [{ id: 501, nombre: 'Ruta A', tipo: 'INYECCION', executor_kind: 'OP_OT', articulo_salida: { id: 5 } }] }]);
    await waitFor(() => expect(screen.getByText('OF-RACE-B')).toBeVisible());
    expect(screen.queryByDisplayValue('Ruta A · Inyección')).not.toBeInTheDocument();
    secondRoutes.resolve([{ id: 60, numero_revision: 1, estado: 'APROBADA', content_hash: 'hash-b', operaciones: [{ id: 601, nombre: 'Ruta B', tipo: 'INYECCION', executor_kind: 'OP_OT', articulo_salida: { id: 5 } }] }]);
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Operación de ruta (opcional)' }).value).toMatch(/Ruta B/));
    expect(screen.queryByDisplayValue('Ruta A · Inyección')).not.toBeInTheDocument();
  });

  it('actualiza el catálogo de rutas sin reiniciar el borrador ni la selección congelada', async () => {
    const user = userEvent.setup();
    const order = {
      id: 'of-route-refresh', codigo: 'OF-ROUTE-REFRESH', estado: 'BORRADOR', version: 2,
      fuente_proceso: 'EXPLICITO', snapshot_proceso: 'INYECCION', molde_id: 'M-ROUTE',
      corridas: [{
        id: 'run-refresh', codigo: 'C01', objetivo_neto_kg: '1', operacion_ruta_revision_id: 201,
        operacion_ruta: {
          id: 201, nombre: 'Ruta congelada', tipo: 'INYECCION', ruta_revision_id: 20,
          ruta_numero_revision: 3, ruta_content_hash: 'hash-20',
        },
        salidas: [{ id: 'out-refresh', articulo: { id: 5, pieza_id: 5, nombre: 'Pieza 5', codigo: 'PC-5' } }],
      }],
    };
    const oldRoute = { id: 20, numero_revision: 3, estado: 'APROBADA', content_hash: 'hash-20', operaciones: [{ id: 201, executor_kind: 'OP_OT', tipo: 'INYECCION', nombre: 'Ruta congelada', articulo_salida: { id: 5 } }] };
    const newRoute = { id: 21, numero_revision: 4, estado: 'APROBADA', content_hash: 'hash-21', operaciones: [{ id: 202, executor_kind: 'OP_OT', tipo: 'INYECCION', nombre: 'Ruta sucesora', articulo_salida: { id: 5 } }] };
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [order] });
    listarRutasArticuloScm.mockResolvedValueOnce([oldRoute]).mockResolvedValueOnce([newRoute]);
    obtenerMoldes.mockResolvedValue([{ codigo: 'M-ROUTE', nombre: 'Molde route', activo: true, formas: [{ pieza_id: 5, activo: true }] }]);
    renderDetail(order);
    const target = await screen.findByRole('spinbutton', { name: /Objetivo neto/ });
    await user.click(target);
    await user.clear(target);
    await user.type(target, '5.125');
    await user.tab();
    const routeInput = screen.getByRole('combobox', { name: 'Operación de ruta (opcional)' });
    expect(routeInput).toHaveValue('Ruta congelada · Inyección');
    await waitFor(() => expect(listarRutasArticuloScm).toHaveBeenCalledWith(
      '5', 1, expect.objectContaining({ limite: 100 }), expect.any(AbortSignal),
    ));
    await user.click(screen.getByRole('button', { name: 'Acciones de ruta para C01' }));
    await user.click(screen.getByRole('menuitem', { name: 'Actualizar' }));
    await waitFor(() => expect(auth.outputRoutes.mock.calls.filter(([, , options]) => !options?.q).length).toBeGreaterThanOrEqual(2));
    expect(target).toHaveValue(5.13);
    await user.click(target);
    expect(target).toHaveValue(5.125);
    expect(screen.getByRole('combobox', { name: 'Operación de ruta (opcional)' })).toHaveValue('Ruta congelada · Inyección');
  });
});
