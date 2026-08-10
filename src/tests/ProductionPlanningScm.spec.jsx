import {
  render, screen, waitFor, waitForElementToBeRemoved,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductionPlanningScm from '../components/ProductionPlanningScm';
import {
  actualizarRutasOpScm,
  calcularPlanOpScm,
  listarOpDemandaScm,
  obtenerPlanOpScm,
} from '../services/scmPlanningApi';
import { buscarProductos } from '../services/api';
import { listarPresentacionesComercialesScm } from '../services/scmCatalogApi';

const { capabilities } = vi.hoisted(() => ({ capabilities: new Set() }));

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    can: (capability) => capabilities.has(capability),
    canAny: () => true,
    experience: { label: 'Auditoría / Consulta' },
  }),
}));

vi.mock('../services/scmPlanningApi', () => ({
  ajustarMetasPlanOpScm: vi.fn(),
  aprobarOpDemandaScm: vi.fn(),
  actualizarRutasOpScm: vi.fn(),
  calcularPlanOpScm: vi.fn(),
  confirmarPlanOpScm: vi.fn(),
  crearOpDemandaScm: vi.fn(),
  listarOpDemandaScm: vi.fn(),
  obtenerPlanOpScm: vi.fn(),
}));

vi.mock('../services/api', () => ({
  buscarProductos: vi.fn(),
}));

vi.mock('../services/scmCatalogApi', () => ({
  listarPresentacionesComercialesScm: vi.fn(),
}));

vi.mock('../services/scmEngineeringApi', () => ({
  mensajeErrorScm: vi.fn((_error, fallback) => fallback),
}));

const renderPage = () => render(
  <ThemeProvider theme={createTheme()}>
    <MemoryRouter>
      <ProductionPlanningScm />
    </MemoryRouter>
  </ThemeProvider>,
);

describe('Planificación de OP', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capabilities.clear();
    buscarProductos.mockResolvedValue([]);
    listarPresentacionesComercialesScm.mockResolvedValue([]);
  });

  it('muestra un estado vacío estable cuando no existen OP ni productos', async () => {
    listarOpDemandaScm.mockResolvedValue({ items: [] });
    buscarProductos.mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText('Todavía no existen OP de demanda.')).toBeInTheDocument();
    expect(screen.getByText(/Vista de consulta para Auditoría/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(listarOpDemandaScm).toHaveBeenCalledTimes(1);
      expect(buscarProductos).toHaveBeenCalledTimes(1);
    });
  });

  it('mantiene consultable un plan histórico cuyos documentos perdieron relaciones maestras', async () => {
    listarOpDemandaScm.mockResolvedValue({
      items: [{
        id: 'op-local',
        codigo: 'OP-DEMO-AP-2400',
        estado: 'PLANIFICADA',
        fecha_necesidad: '2026-08-14',
        version: 1,
        referencia_origen: 'MOCK_LOCAL_ALCANCIA_PABLO_V1',
        lineas: [{
          id: 'line-1',
          producto: '[MOCK LOCAL] Alcancia Pablo Grande',
          producto_terminado_id: 'PT-DEMO-AP',
          cantidad_solicitada: '2400.000',
          presentacion_comercial: null,
          cobertura: {
            planificada: '2400.000',
            comprometida: '0.000',
            satisfecha: '0.000',
          },
        }],
      }],
    });
    obtenerPlanOpScm.mockResolvedValue({
      plan: {
        id: 'plan-local',
        revision: 1,
        estado: 'CONFIRMADO',
        propuesta: {
          marker: 'MOCK_LOCAL_ALCANCIA_PABLO_V1',
          documentos: [
            { clave: 'MOCK-OF-IDLE', cantidad: 2266 },
            { clave: 'MOCK-OF-ACTIVE', cantidad: 134 },
          ],
        },
      },
    });

    renderPage();

    expect(await screen.findByText('MOCK-OF-IDLE')).toBeInTheDocument();
    expect(screen.getAllByText('Artículo no disponible')).toHaveLength(2);
    expect(screen.getByText(/2 documentos históricos tienen datos incompletos/i)).toBeInTheDocument();
    expect(screen.getByText(/consulta las OF\/OA ya creadas/i)).toBeInTheDocument();
  });

  it('bloquea la confirmación de un plan calculado incompleto y explica cómo corregirlo', async () => {
    capabilities.add('PLANIFICACION_CALCULAR');
    capabilities.add('PLANIFICACION_CONFIRMAR');
    listarOpDemandaScm.mockResolvedValue({
      items: [{
        id: 'op-incomplete',
        codigo: 'OP-000099',
        estado: 'APROBADA',
        fecha_necesidad: '2026-08-15',
        version: 1,
        lineas: [],
      }],
    });
    obtenerPlanOpScm.mockResolvedValue({
      plan: {
        id: 'plan-incomplete',
        revision: 1,
        estado: 'CALCULADO',
        propuesta: {
          documentos: [{ clave: 'RUTA-SIN-MAESTRO', cantidad_objetivo: '10' }],
          bloqueos: [],
          reservas_stock: [],
        },
      },
    });

    renderPage();

    expect(await screen.findByText('RUTA-SIN-MAESTRO')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar plan' })).toBeDisabled();
    expect(screen.getByText(/No puedes confirmar esta revisión: recalcula el plan/i))
      .toBeInTheDocument();
    expect(screen.getByText(/Esta OP no tiene líneas de demanda consultables/i))
      .toBeInTheDocument();
  });

  it('identifica cada artículo sin operación y abre su ruta conservando la OP', async () => {
    capabilities.add('PLANIFICACION_CALCULAR');
    capabilities.add('PLANIFICACION_CONFIRMAR');
    listarOpDemandaScm.mockResolvedValue({
      items: [{
        id: 'op-blocked',
        codigo: 'OP-000001',
        estado: 'APROBADA',
        fecha_necesidad: '2026-08-17',
        version: 2,
        lineas: [{
          id: 'line-blocked',
          producto: 'GUIA-CIEGA-2 Producto terminado',
          producto_terminado_id: 'PT-000002',
          cantidad_solicitada: '2400.000',
          cobertura: {},
        }],
      }],
    });
    obtenerPlanOpScm.mockResolvedValue({
      plan: {
        id: 'plan-blocked',
        revision: 1,
        estado: 'CALCULADO',
        propuesta: {
          politica_stock: 'KARDEX_NORMALIZADO',
          documentos: [{
            clave: 'R1-O1',
            tipo: 'ENSAMBLE',
            operacion_ruta_id: 1,
            ruta_hash: 'route-hash',
            articulo_scm_id: 4,
            articulo: {
              codigo: 'PT-000002',
              nombre: 'GUIA-CIEGA-2 Producto terminado',
              clase: 'PRODUCTO_TERMINADO',
            },
            cantidad_objetivo: '2400.000',
            cantidad_calculada: '2400.000',
          }],
          asignaciones_demanda: [],
          reservas_stock: [],
          bloqueos: [{
            codigo: 'ROUTE_OUTPUT_MISSING',
            linea_id: 'line-blocked',
            producto_terminado_id: 'PT-000002',
            articulo_id: 1,
            articulo_codigo: 'PC-DEMO-AP-CARNE',
            articulo: {
              codigo: 'PC-DEMO-AP-CARNE',
              nombre: '[MOCK LOCAL] Alcancia Pablo Grande CARNE SOLIDO',
              clase: 'PIEZA_COLOR',
            },
            cantidad: '2400',
            motivo_codigo: 'SIN_OPERACION_DE_RUTA',
            motivo: 'La BOM requiere este artículo, pero la ruta aprobada no incluye una operación cuya salida sea este artículo.',
          }],
        },
      },
    });

    renderPage();

    expect(await screen.findByText('PC-DEMO-AP-CARNE')).toBeVisible();
    expect(screen.getByText('[MOCK LOCAL] Alcancia Pablo Grande CARNE SOLIDO')).toBeVisible();
    expect(screen.getByText('Pieza-color')).toBeVisible();
    expect(screen.getByText(/La BOM requiere este artículo/i)).toBeVisible();
    expect(screen.getByText('2400 UN requeridas')).toBeVisible();
    const routeLink = screen.getByRole('link', { name: 'Revisar ruta del PT-000002' });
    const target = new URL(routeLink.getAttribute('href'), 'http://localhost');
    expect(target.pathname).toBe('/datos-maestros/ingenieria-scm');
    expect(target.searchParams.get('tab')).toBe('rutas');
    expect(target.searchParams.get('producto')).toBe('PT-000002');
    expect(target.searchParams.get('faltante')).toBe('PC-DEMO-AP-CARNE');
    expect(target.searchParams.get('op')).toBe('OP-000001');
    expect(target.searchParams.get('volver')).toBe('/planificacion?op=op-blocked');
    expect(screen.getByRole('button', { name: 'Confirmar plan' })).toBeDisabled();
  });

  it('no actualiza la ingeniería congelada de forma silenciosa y exige confirmación', async () => {
    const user = userEvent.setup();
    capabilities.add('PLANIFICACION_CALCULAR');
    listarOpDemandaScm.mockResolvedValue({
      items: [{
        id: 'op-blocked',
        codigo: 'OP-000001',
        estado: 'APROBADA',
        fecha_necesidad: '2026-08-17',
        version: 4,
        lineas: [{
          id: 'line-blocked',
          producto_terminado_id: 'PT-000002',
          cantidad_solicitada: '10',
          ruta_revision_id: 21,
          cobertura: {},
        }],
      }],
    });
    obtenerPlanOpScm.mockResolvedValue({
      plan: {
        id: 'plan-blocked',
        revision: 2,
        estado: 'CALCULADO',
        propuesta: {
          documentos: [],
          asignaciones_demanda: [],
          reservas_stock: [],
          bloqueos: [{
            codigo: 'ROUTE_OUTPUT_MISSING',
            linea_id: 'line-blocked',
            producto_terminado_id: 'PT-000002',
            articulo_codigo: 'PC-000001',
            motivo: 'La ruta aprobada congelada no incluye la salida requerida.',
          }],
        },
      },
    });

    renderPage();

    const action = await screen.findByRole('button', {
      name: 'Actualizar ingeniería de la OP',
    });
    expect(actualizarRutasOpScm).not.toHaveBeenCalled();

    await user.click(action);
    expect(actualizarRutasOpScm).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', {
      name: 'Actualizar ingeniería congelada de la OP',
    });
    expect(dialog).toHaveTextContent(/reemplaza los snapshots técnicos de ruta congelados/i);
    expect(dialog).toHaveTextContent(/Recalcular por sí solo nunca adopta revisiones nuevas/i);
    expect(dialog).toHaveTextContent(/PT-000002/i);
    expect(dialog).toHaveTextContent(/ID 21/i);
  });

  it('muestra el before/after auditable, informa planes superados y permite recalcular', async () => {
    const user = userEvent.setup();
    capabilities.add('PLANIFICACION_CALCULAR');
    const oldOrder = {
      id: 'op-blocked',
      codigo: 'OP-000001',
      estado: 'APROBADA',
      fecha_necesidad: '2026-08-17',
      version: 4,
      lineas: [{
        id: 'line-blocked',
        producto_terminado_id: 'PT-000002',
        cantidad_solicitada: '10',
        ruta_revision_id: 21,
        cobertura: {},
      }],
    };
    const refreshedOrder = { ...oldOrder, version: 5, lineas: [{
      ...oldOrder.lineas[0], ruta_revision_id: 22,
    }] };
    listarOpDemandaScm
      .mockResolvedValueOnce({ items: [oldOrder] })
      .mockResolvedValue({ items: [refreshedOrder] });
    obtenerPlanOpScm
      .mockResolvedValueOnce({
        plan: {
          id: 'plan-blocked',
          revision: 2,
          estado: 'CALCULADO',
          propuesta: {
            documentos: [], asignaciones_demanda: [], reservas_stock: [],
            bloqueos: [{
              codigo: 'ROUTE_OUTPUT_MISSING',
              linea_id: 'line-blocked',
              producto_terminado_id: 'PT-000002',
              articulo_codigo: 'PC-000001',
              motivo: 'Falta una salida en la ruta congelada.',
            }],
          },
        },
      })
      .mockResolvedValue({ plan: null });
    actualizarRutasOpScm.mockResolvedValue({
      orden: refreshedOrder,
      cambios: [{
        linea_id: 'line-blocked',
        producto_terminado_id: 'PT-000002',
        ruta_anterior: { id: 21, codigo: 'PT-000002-R1', revision: 1, estado: 'RETIRADA' },
        ruta_nueva: { id: 22, codigo: 'PT-000002-R2', revision: 2, estado: 'APROBADA' },
      }],
      planes_superados: ['plan-blocked'],
    });
    calcularPlanOpScm.mockResolvedValue({
      orden: refreshedOrder,
      plan: { revision: 3 },
    });

    renderPage();
    await user.click(await screen.findByRole('button', {
      name: 'Actualizar ingeniería de la OP',
    }));
    await user.click(screen.getByRole('button', { name: 'Confirmar actualización' }));

    await waitFor(() => expect(actualizarRutasOpScm).toHaveBeenCalledWith(oldOrder));
    expect(await screen.findByText(/Ruta PT-000002-R1 · revisión 1/i)).toBeVisible();
    expect(screen.getByText(/Ruta PT-000002-R2 · revisión 2/i)).toBeVisible();
    expect(screen.getByText(/1 plan calculado quedó superado/i)).toBeVisible();
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog', {
      name: 'Actualizar ingeniería congelada de la OP',
    }));

    const recalculate = screen.getByRole('button', {
      name: 'Recalcular con ingeniería actualizada',
    });
    await user.click(recalculate);
    await waitFor(() => expect(calcularPlanOpScm).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'op-blocked', version: 5 }),
    ));
  });

  it('conserva la OP sin afirmar cambios cuando la actualización falla por versión', async () => {
    const user = userEvent.setup();
    capabilities.add('PLANIFICACION_CALCULAR');
    const order = {
      id: 'op-conflict', codigo: 'OP-000002', estado: 'APROBADA',
      fecha_necesidad: '2026-08-17', version: 7,
      lineas: [{
        id: 'line-1', producto_terminado_id: 'PT-000003',
        cantidad_solicitada: '5', ruta_revision_id: 31, cobertura: {},
      }],
    };
    listarOpDemandaScm.mockResolvedValue({ items: [order] });
    obtenerPlanOpScm.mockResolvedValue({
      plan: {
        id: 'plan-conflict', revision: 1, estado: 'CALCULADO',
        propuesta: {
          documentos: [], asignaciones_demanda: [], reservas_stock: [],
          bloqueos: [{
            codigo: 'ROUTE_OUTPUT_MISSING', producto_terminado_id: 'PT-000003',
            articulo_codigo: 'PC-000003', motivo: 'Bloqueo de ruta.',
          }],
        },
      },
    });
    actualizarRutasOpScm.mockRejectedValue({ response: { status: 409 } });

    renderPage();
    await user.click(await screen.findByRole('button', {
      name: 'Actualizar ingeniería de la OP',
    }));
    await user.click(screen.getByRole('button', { name: 'Confirmar actualización' }));

    expect(await screen.findByText(/No se actualizó la ingeniería de la OP/i)).toBeVisible();
    expect(screen.queryByText(/plan calculado quedó superado/i)).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', {
      name: 'Actualizar ingeniería congelada de la OP',
    })).toBeVisible();
  });

  it('usa identificadores humanos sin bloquear cuando solo faltan relaciones de consulta', async () => {
    capabilities.add('PLANIFICACION_CONFIRMAR');
    listarOpDemandaScm.mockResolvedValue({
      items: [{
        id: 'op-relations',
        codigo: 'OP-000100',
        estado: 'APROBADA',
        fecha_necesidad: '2026-08-16',
        version: 1,
        lineas: [{
          id: 'line-relations',
          producto_terminado_id: 'PT-000002',
          cantidad_solicitada: '20',
          cobertura: {},
        }],
      }],
    });
    obtenerPlanOpScm.mockResolvedValue({
      plan: {
        id: 'plan-relations',
        revision: 1,
        estado: 'CALCULADO',
        propuesta: {
          politica_stock: 'KARDEX_NORMALIZADO',
          documentos: [{
            clave: 'R1-O9',
            tipo: 'ENSAMBLE',
            operacion_ruta_id: 9,
            ruta_hash: 'route-hash',
            articulo_scm_id: 42,
            cantidad_objetivo: '20',
            cantidad_calculada: '20',
          }],
          asignaciones_demanda: [],
          bloqueos: [],
          reservas_stock: [],
        },
      },
    });

    renderPage();

    expect(await screen.findByText('Artículo #42')).toBeInTheDocument();
    expect(screen.getByText('Operación de ruta #9')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar plan' })).toBeEnabled();
    expect(screen.queryByText(/datos incompletos de artículo/i)).not.toBeInTheDocument();
  });
});
