import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import AssemblyOrdersScm from '../components/AssemblyOrdersScm';

const actorState = vi.hoisted(() => {
  const state = { capabilities: new Set() };
  state.can = (capability) => state.capabilities.has(capability);
  state.canAny = (required) => required.some((capability) => state.capabilities.has(capability));
  return state;
});

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    can: actorState.can,
    canAny: actorState.canAny,
    experience: { label: 'Jefe de Armado' },
  }),
}));

vi.mock('../services/scmAssemblyApi', () => ({
  listarOrdenesArmadoScm: vi.fn(),
  transicionarOrdenArmadoScm: vi.fn(),
}));

vi.mock('../services/scmEngineeringApi', () => ({
  listarCentrosTrabajoScm: vi.fn(),
  mensajeErrorScm: vi.fn((error, fallback) => error?.message || fallback),
}));

vi.mock('../services/api', () => ({ getTrabajadores: vi.fn() }));

vi.mock('../services/scmInternalSupplyApi', () => ({
  asignarMangasSalidaArmadoScm: vi.fn(),
  cerrarMangaArmadoScm: vi.fn(),
  crearOtArmadoScm: vi.fn(),
  crearSolicitudAbastecimientoScm: vi.fn(),
  listarOtArmadoScm: vi.fn(),
  listarSolicitudesAbastecimientoScm: vi.fn(),
  obtenerGenealogiaMangaScm: vi.fn(),
  obtenerPlanMangasArmadoScm: vi.fn(),
  recalcularPlanMangasArmadoScm: vi.fn(),
}));

vi.mock('../services/scmOtApi', () => ({
  cambiarEstadoOtScm: vi.fn(),
  generarEtiquetasPrepesaje: vi.fn(),
  listarOtScm: vi.fn(),
}));

import { listarOrdenesArmadoScm } from '../services/scmAssemblyApi';
import { listarCentrosTrabajoScm } from '../services/scmEngineeringApi';
import { getTrabajadores } from '../services/api';
import {
  asignarMangasSalidaArmadoScm,
  cerrarMangaArmadoScm,
  crearOtArmadoScm,
  crearSolicitudAbastecimientoScm,
  listarOtArmadoScm,
  listarSolicitudesAbastecimientoScm,
  obtenerPlanMangasArmadoScm,
  recalcularPlanMangasArmadoScm,
} from '../services/scmInternalSupplyApi';
import { listarOtScm } from '../services/scmOtApi';

const order = {
  id: 'oa-1',
  codigo: 'OA-000001',
  estado: 'LIBERADA',
  version: 1,
  operacion: {
    tipo: 'ENSAMBLE',
    permite_concurrente: true,
    centro_trabajo: 'Mesa de Armado 1',
    centro_trabajo_id: 7,
  },
  salida: {
    codigo: 'PT-000002',
    nombre: 'Balde armado',
    cantidad_objetivo: '10.000',
  },
  entradas_planificadas: [{
    articulo_scm_id: 10,
    articulo: { codigo: 'PC-000013', nombre: 'Cuerpo amarillo', clase: 'PIEZA_COLOR' },
    cantidad_por_salida: '1.000',
    merma_tecnica_pct: '0.000',
    cantidad_planificada: '10.000',
  }],
  lote_salida: null,
};

const ot = {
  public_id: 'ot-1',
  codigo_ot: 'OT-000002',
  estado: 'PLANIFICADA',
  fecha_operativa: '2026-08-04',
  turno: 'DIA',
  centro_trabajo: { id: 7, nombre: 'Mesa de Armado 1' },
  responsable: 'Ana Armado',
  cantidad_objetivo: '10.000',
  cantidad_confirmada: '0.000',
  version: 1,
  mangas: [],
};

const renderView = () => render(
  <MemoryRouter>
    <ThemeProvider theme={createTheme()}>
      <AssemblyOrdersScm />
    </ThemeProvider>
  </MemoryRouter>,
);

describe('OA y OT diaria de Armado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actorState.capabilities = new Set([
      'OA_VER', 'OA_EJECUTAR', 'OT_CREAR', 'ABASTECIMIENTO_VER',
      'ABASTECIMIENTO_SOLICITAR',
    ]);
    listarOrdenesArmadoScm.mockResolvedValue({ items: [order] });
    listarOtArmadoScm.mockResolvedValue({ items: [ot] });
    listarOtScm.mockResolvedValue({ items: [] });
    listarSolicitudesAbastecimientoScm.mockResolvedValue({ items: [] });
    obtenerPlanMangasArmadoScm.mockResolvedValue({ plan: null });
    listarCentrosTrabajoScm.mockResolvedValue([{
      id: 7, codigo: 'MESA-01', nombre: 'Mesa de Armado 1', tipo: 'ENSAMBLE', activo: true,
    }]);
    getTrabajadores.mockResolvedValue([{
      id: 4, codigo: 'TRB-000004', nombre_completo: 'Ana Armado', activo: true,
    }]);
    crearSolicitudAbastecimientoScm.mockResolvedValue({
      solicitud: { codigo: 'SA-000001' },
    });
    asignarMangasSalidaArmadoScm.mockResolvedValue({
      mangas: [{ public_id: 'manga-1', codigo: 'OA000001-OT001-M001' }],
    });
  });

  it('solicita componentes para una OT existente y muestra su cuota diaria', async () => {
    const user = userEvent.setup();
    renderView();

    expect(await screen.findByText('OT-000002')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Órdenes de armado' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/ensambl/i);
    expect(screen.getAllByText('10.000 un').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Solicitar componentes' }));

    await waitFor(() => expect(crearSolicitudAbastecimientoScm).toHaveBeenCalledWith('ot-1'));
    expect(await screen.findByText('SA-000001 creada desde la BOM y la cuota diaria.')).toBeInTheDocument();
  });

  it('no presenta un vacío operativo cuando falló la consulta de OA', async () => {
    listarOrdenesArmadoScm.mockRejectedValueOnce(new Error('Servicio OA no disponible'));

    renderView();

    expect(await screen.findByText('Servicio OA no disponible')).toBeVisible();
    expect(screen.queryByText('Aún no hay órdenes de armado')).not.toBeInTheDocument();
  });

  it('vincula el prearmado concurrente con una OT de fabricacion del mismo dia', async () => {
    listarOtArmadoScm.mockResolvedValue({ items: [] });
    listarOtScm.mockResolvedValue({
      items: [{
        public_id: 'fab-ot-1', codigo_ot: 'OT-000010', tipo_ot: 'FABRICACION',
        estado: 'EN_EJECUCION', fecha_operativa: new Date().toISOString().slice(0, 10), turno: 'DIA',
        maquina: 'Haitian 3000',
      }],
    });
    crearOtArmadoScm.mockResolvedValue({
      ot: { codigo_ot: 'OT-000011', fecha_operativa: '2026-08-04' },
    });
    const user = userEvent.setup();
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Crear OT diaria' }));
    await user.click(screen.getByRole('combobox', { name: 'Modalidad de ejecuciÃ³n' }));
    await user.click(screen.getByRole('option', { name: 'Concurrente con fabricaciÃ³n' }));
    await user.click(screen.getByRole('combobox', { name: 'OT de fabricaciÃ³n de contexto' }));
    await user.click(screen.getByRole('option', { name: /OT-000010/ }));
    await user.click(screen.getByRole('button', { name: 'Crear OT y continuar' }));

    await waitFor(() => expect(crearOtArmadoScm).toHaveBeenCalledWith(
      'oa-1',
      expect.objectContaining({
        modo_ejecucion: 'CONCURRENTE',
        ot_fabricacion_contexto_id: 'fab-ot-1',
      }),
    ));
  });

  it('calcula el plan y asigna las mangas PT a la jornada', async () => {
    actorState.capabilities = new Set([
      'OA_VER', 'PLAN_MANGA_VER', 'ENSAMBLE_PLANIFICAR', 'ABASTECIMIENTO_VER',
    ]);
    recalcularPlanMangasArmadoScm.mockResolvedValue({
      plan: {
        revision: 1,
        lineas: [{
          mangas_propuestas: 1,
          capacidad_efectiva_un: 10,
          cantidad_asignada_un: '0',
          saldo_un: '10',
        }],
      },
    });
    const user = userEvent.setup();
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Planificar mangas de salida' }));
    expect(await screen.findByText(/Plan de mangas de salida revisión 1 calculado/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Asignar mangas PT' }));

    await waitFor(() => expect(asignarMangasSalidaArmadoScm).toHaveBeenCalledWith(ot));
    expect(await screen.findByText(/1 manga\(s\) de producto terminado asignada\(s\)/)).toBeInTheDocument();
  });

  it('permite al responsable cerrar una manga abastecida y la deja pendiente de pesaje', async () => {
    actorState.capabilities = new Set([
      'OA_VER', 'PLAN_MANGA_VER', 'ABASTECIMIENTO_VER', 'ENSAMBLE_MANGA_CERRAR',
      'GENEALOGIA_VER',
    ]);
    const manga = {
      public_id: 'manga-1',
      codigo: 'OA000001-OT001-M001',
      estado: 'PREETIQUETADA',
      cantidad_planificada_un: '10',
      cantidad_confirmada_un: null,
      version: 2,
    };
    listarOtArmadoScm.mockResolvedValue({
      items: [{ ...ot, estado: 'EN_EJECUCION', mangas: [manga] }],
    });
    listarSolicitudesAbastecimientoScm.mockResolvedValue({
      items: [{
        id: 'sa-1',
        codigo: 'SA-000001',
        estado: 'RECIBIDA',
        orden_trabajo: { public_id: 'ot-1' },
      }],
    });
    obtenerPlanMangasArmadoScm.mockResolvedValue({
      plan: {
        revision: 1,
        lineas: [{
          mangas_propuestas: 1,
          capacidad_efectiva_un: 10,
          cantidad_asignada_un: '10',
          saldo_un: '0',
        }],
      },
    });
    cerrarMangaArmadoScm.mockResolvedValue({
      manga: { ...manga, estado: 'CERRADA_ARMADO_PENDIENTE_PESAJE' },
    });
    const user = userEvent.setup();
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Confirmar armado' }));
    expect(screen.getByRole('heading', { name: 'Confirmar manga terminada' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cerrar armado' }));

    await waitFor(() => expect(cerrarMangaArmadoScm).toHaveBeenCalledWith(manga, {
      cantidad_real: 10,
      motivo_diferencia: null,
    }));
    expect(await screen.findByText(/Armado cerrado; queda pendiente de pesaje/)).toBeInTheDocument();
  });
});
