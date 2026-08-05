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
    experience: { label: 'Jefe de Ensamble' },
  }),
}));

vi.mock('../services/scmAssemblyApi', () => ({
  listarOrdenesEnsambleScm: vi.fn(),
  transicionarOrdenEnsambleScm: vi.fn(),
}));

vi.mock('../services/scmEngineeringApi', () => ({
  listarCentrosTrabajoScm: vi.fn(),
  mensajeErrorScm: vi.fn((error, fallback) => error?.message || fallback),
}));

vi.mock('../services/api', () => ({ getTrabajadores: vi.fn() }));

vi.mock('../services/scmInternalSupplyApi', () => ({
  asignarMangasSalidaEnsambleScm: vi.fn(),
  cerrarMangaArmadoScm: vi.fn(),
  crearOtEnsambleScm: vi.fn(),
  crearSolicitudAbastecimientoScm: vi.fn(),
  listarOtEnsambleScm: vi.fn(),
  listarSolicitudesAbastecimientoScm: vi.fn(),
  obtenerGenealogiaMangaScm: vi.fn(),
  obtenerPlanMangasEnsambleScm: vi.fn(),
  recalcularPlanMangasEnsambleScm: vi.fn(),
}));

vi.mock('../services/scmOtApi', () => ({
  cambiarEstadoOtScm: vi.fn(),
  generarEtiquetasPrepesaje: vi.fn(),
  listarOtScm: vi.fn(),
}));

import { listarOrdenesEnsambleScm } from '../services/scmAssemblyApi';
import { listarCentrosTrabajoScm } from '../services/scmEngineeringApi';
import { getTrabajadores } from '../services/api';
import {
  asignarMangasSalidaEnsambleScm,
  cerrarMangaArmadoScm,
  crearOtEnsambleScm,
  crearSolicitudAbastecimientoScm,
  listarOtEnsambleScm,
  listarSolicitudesAbastecimientoScm,
  obtenerPlanMangasEnsambleScm,
  recalcularPlanMangasEnsambleScm,
} from '../services/scmInternalSupplyApi';
import { listarOtScm } from '../services/scmOtApi';

const order = {
  id: 'oe-1',
  codigo: 'OE-000001',
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

describe('OE y OT diaria de Armado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actorState.capabilities = new Set([
      'OE_VER', 'OE_EJECUTAR', 'OT_CREAR', 'ABASTECIMIENTO_VER',
      'ABASTECIMIENTO_SOLICITAR',
    ]);
    listarOrdenesEnsambleScm.mockResolvedValue({ items: [order] });
    listarOtEnsambleScm.mockResolvedValue({ items: [ot] });
    listarOtScm.mockResolvedValue({ items: [] });
    listarSolicitudesAbastecimientoScm.mockResolvedValue({ items: [] });
    obtenerPlanMangasEnsambleScm.mockResolvedValue({ plan: null });
    listarCentrosTrabajoScm.mockResolvedValue([{
      id: 7, codigo: 'MESA-01', nombre: 'Mesa de Armado 1', tipo: 'ENSAMBLE', activo: true,
    }]);
    getTrabajadores.mockResolvedValue([{
      id: 4, codigo: 'TRB-000004', nombre_completo: 'Ana Armado', activo: true,
    }]);
    crearSolicitudAbastecimientoScm.mockResolvedValue({
      solicitud: { codigo: 'SA-000001' },
    });
    asignarMangasSalidaEnsambleScm.mockResolvedValue({
      mangas: [{ public_id: 'manga-1', codigo: 'OE000001-OT001-M001' }],
    });
  });

  it('solicita componentes para una OT existente y muestra su cuota diaria', async () => {
    const user = userEvent.setup();
    renderView();

    expect(await screen.findByText('OT-000002')).toBeInTheDocument();
    expect(screen.getAllByText('10.000 un').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Solicitar componentes' }));

    await waitFor(() => expect(crearSolicitudAbastecimientoScm).toHaveBeenCalledWith('ot-1'));
    expect(await screen.findByText('SA-000001 creada desde la BOM y la cuota diaria.')).toBeInTheDocument();
  });

  it('vincula el prearmado concurrente con una OT de fabricacion del mismo dia', async () => {
    listarOtEnsambleScm.mockResolvedValue({ items: [] });
    listarOtScm.mockResolvedValue({
      items: [{
        public_id: 'fab-ot-1', codigo_ot: 'OT-000010', tipo_ot: 'FABRICACION',
        estado: 'EN_EJECUCION', fecha_operativa: new Date().toISOString().slice(0, 10), turno: 'DIA',
        maquina: 'Haitian 3000',
      }],
    });
    crearOtEnsambleScm.mockResolvedValue({
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

    await waitFor(() => expect(crearOtEnsambleScm).toHaveBeenCalledWith(
      'oe-1',
      expect.objectContaining({
        modo_ejecucion: 'CONCURRENTE',
        ot_fabricacion_contexto_id: 'fab-ot-1',
      }),
    ));
  });

  it('calcula el plan y asigna las mangas PT a la jornada', async () => {
    actorState.capabilities = new Set([
      'OE_VER', 'PLAN_MANGA_VER', 'ENSAMBLE_PLANIFICAR', 'ABASTECIMIENTO_VER',
    ]);
    recalcularPlanMangasEnsambleScm.mockResolvedValue({
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

    await waitFor(() => expect(asignarMangasSalidaEnsambleScm).toHaveBeenCalledWith(ot));
    expect(await screen.findByText(/1 manga\(s\) de producto terminado asignada\(s\)/)).toBeInTheDocument();
  });

  it('permite al responsable cerrar una manga abastecida y la deja pendiente de pesaje', async () => {
    actorState.capabilities = new Set([
      'OE_VER', 'PLAN_MANGA_VER', 'ABASTECIMIENTO_VER', 'ENSAMBLE_MANGA_CERRAR',
      'GENEALOGIA_VER',
    ]);
    const manga = {
      public_id: 'manga-1',
      codigo: 'OE000001-OT001-M001',
      estado: 'PREETIQUETADA',
      cantidad_planificada_un: '10',
      cantidad_confirmada_un: null,
      version: 2,
    };
    listarOtEnsambleScm.mockResolvedValue({
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
    obtenerPlanMangasEnsambleScm.mockResolvedValue({
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
