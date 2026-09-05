import {
  fireEvent, render, screen, waitFor, within,
} from '@testing-library/react';
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
  crearOrdenArmadoExcepcionalScm: vi.fn(),
  listarOrdenesArmadoScm: vi.fn(),
  transicionarOrdenArmadoScm: vi.fn(),
}));

vi.mock('../services/scmEngineeringApi', () => ({
  listarArticulosScm: vi.fn(),
  listarCentrosTrabajoScm: vi.fn(),
  listarEstructurasScm: vi.fn(),
  listarRutasArticuloScm: vi.fn(),
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

import {
  crearOrdenArmadoExcepcionalScm,
  listarOrdenesArmadoScm,
} from '../services/scmAssemblyApi';
import {
  listarArticulosScm,
  listarCentrosTrabajoScm,
  listarEstructurasScm,
  listarRutasArticuloScm,
} from '../services/scmEngineeringApi';
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
import { todayInLima } from '../utils/limaDate';

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
    clase: 'PRODUCTO_TERMINADO',
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

const renderView = (initialEntry = '/') => render(
  <MemoryRouter initialEntries={[initialEntry]}>
    <ThemeProvider theme={createTheme()}>
      <AssemblyOrdersScm />
    </ThemeProvider>
  </MemoryRouter>,
);

describe('OA y OT diaria de Armado', () => {
  it('oculta anuladas hasta activar el filtro y conserva su motivo', async () => {
    const user = userEvent.setup();
    listarOrdenesArmadoScm.mockResolvedValue({ items: [{ ...order, estado: 'ANULADA', anulacion: { motivo: 'Error al crear OA' } }] });
    renderView();
    expect(await screen.findByText('Aún no hay órdenes de armado')).toBeVisible();
    await user.click(screen.getByLabelText('Mostrar anuladas'));
    expect(await screen.findByText(/Anulada · Error al crear OA/)).toBeVisible();
    expect(screen.queryByText('Anular borrador')).not.toBeInTheDocument();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    actorState.capabilities = new Set([
      'OA_VER', 'OA_EJECUTAR', 'OT_VER', 'OT_CREAR', 'ABASTECIMIENTO_VER',
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
    listarArticulosScm.mockResolvedValue([]);
    listarEstructurasScm.mockResolvedValue([]);
    listarRutasArticuloScm.mockResolvedValue([]);
  });

  it('crea un borrador gobernado de reposición WIP sin OP ni selección silenciosa', async () => {
    actorState.capabilities.add('OA_EXCEPCIONAL_CREAR');
    const wip = {
      id: 2,
      codigo: 'WIP-000001',
      nombre: 'Tapa con pico armada',
      clase: 'SUBENSAMBLE_WIP',
      activo: true,
    };
    const structure = {
      id: 43,
      numero_revision: 2,
      version: 3,
      estado: 'APROBADA',
      articulo_resultado_id: 2,
    };
    const route = {
      id: 31,
      numero_revision: 2,
      version: 4,
      estado: 'APROBADA',
      articulo_objetivo: wip,
      operaciones: [{
        id: 101,
        nombre: 'Colocar pico entre ciclos',
        tipo: 'ENSAMBLE',
        executor_kind: 'ORDEN_OPERACION',
        articulo_salida_id: 2,
        estructura_revision_id: 43,
        permite_concurrente: true,
      }],
      precedencias: [],
    };
    listarArticulosScm.mockResolvedValue([wip, {
      id: 3,
      codigo: 'PT-000001',
      nombre: 'Producto terminado',
      clase: 'PRODUCTO_TERMINADO',
      activo: true,
    }]);
    listarEstructurasScm.mockResolvedValue([structure]);
    listarRutasArticuloScm.mockResolvedValue([route]);
    crearOrdenArmadoExcepcionalScm.mockResolvedValue({
      ...order,
      id: 'oa-wip-1',
      codigo: 'OA-000010',
      estado: 'BORRADOR',
      origen_demanda: 'REPOSICION_WIP',
      salida: {
        ...order.salida,
        codigo: wip.codigo,
        nombre: wip.nombre,
        clase: wip.clase,
      },
    });
    const user = userEvent.setup();
    renderView();

    await user.click(await screen.findByRole('button', {
      name: 'Nueva OA de reposición WIP',
    }));
    const dialog = screen.getByRole('dialog', { name: 'Nueva OA de reposición WIP' });
    expect(within(dialog).getByRole('combobox', { name: 'WIP de salida' })).toHaveValue('');
    expect(listarRutasArticuloScm).not.toHaveBeenCalled();

    await user.type(within(dialog).getByRole('combobox', { name: 'WIP de salida' }), 'WIP-000001');
    await user.click(screen.getByRole('option', { name: /WIP-000001.*Tapa con pico armada.*WIP/ }));
    await waitFor(() => expect(listarRutasArticuloScm).toHaveBeenCalledWith(2));
    expect(listarEstructurasScm).toHaveBeenCalledWith(2);
    expect(within(dialog).getByText(/Ingeniería aprobada.*Ruta rev\. 2.*BOM rev\. 2/i))
      .toBeVisible();
    expect(within(dialog).getByText('Concurrente entre ciclos')).toBeVisible();

    await user.click(within(dialog).getByRole('combobox', { name: 'Operación aprobada' }));
    await user.click(screen.getByRole('option', { name: /Colocar pico entre ciclos/ }));
    await user.type(within(dialog).getByRole('spinbutton', { name: 'Cantidad objetivo' }), '20');
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Motivo de reposición' }),
      'Reponer WIP para marcha blanca',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Crear borrador' }));

    await waitFor(() => expect(crearOrdenArmadoExcepcionalScm).toHaveBeenCalledWith({
      origen_demanda: 'REPOSICION_WIP',
      motivo: 'Reponer WIP para marcha blanca',
      articulo_salida_id: 2,
      operacion_ruta_revision_id: 101,
      estructura_revision_id: 43,
      cantidad_objetivo: '20',
      versiones: { ruta: 4, estructura: 3 },
    }));
    expect(await screen.findByText(/OA-000010 creada como borrador.*sin OP/i)).toBeVisible();
  });

  it('distingue una OA de reposición WIP de una OA para producto terminado', async () => {
    listarOrdenesArmadoScm.mockResolvedValue({
      items: [{
        ...order,
        origen_demanda: 'REPOSICION_WIP',
        salida: {
          ...order.salida,
          codigo: 'WIP-000001',
          nombre: 'Tapa con pico armada',
          clase: 'SUBENSAMBLE_WIP',
        },
      }],
    });

    renderView();

    expect(await screen.findByText('Reposición WIP · sin OP')).toBeVisible();
    expect(screen.getByText('Mangas de WIP')).toBeVisible();
    expect(screen.getByText(/cuántas bolsas WIP necesita la OA/i)).toBeVisible();
    expect(screen.queryByText('Mangas de producto terminado')).not.toBeInTheDocument();
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

  it('degrada la consulta OA sin pedir OT ni catálogos cuando falta OT_VER', async () => {
    actorState.capabilities = new Set(['OA_VER']);
    renderView();

    expect(await screen.findByText(/las jornadas requieren el permiso de consulta de OT/i))
      .toBeVisible();
    expect(listarOtArmadoScm).not.toHaveBeenCalled();
    expect(listarCentrosTrabajoScm).not.toHaveBeenCalled();
    expect(getTrabajadores).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Crear OT diaria' })).not.toBeInTheDocument();
  });

  it('vincula el prearmado concurrente con una OT de fabricacion del mismo dia', async () => {
    listarOtArmadoScm.mockResolvedValue({ items: [] });
    listarOtScm.mockResolvedValue({
      items: [{
        public_id: 'fab-ot-1', codigo_ot: 'OT-000010', tipo_ot: 'FABRICACION',
        estado: 'EN_EJECUCION', fecha_operativa: todayInLima(), turno: 'DIA',
        maquina: 'Haitian 3000',
        trabajos_color: [{
          id: 'work-green', color: 'VERDE SÓLIDO', estado: 'EN_EJECUCION',
          orden_fabricacion_codigo: 'OF-001',
          articulos_salida: [{
            id: 21, codigo: 'PC-000021', nombre: 'Alcancía verde',
            clase: 'PIEZA_COLOR', unidad: 'UN',
          }],
        }],
      }],
    });
    crearOtArmadoScm.mockResolvedValue({
      ot: { codigo_ot: 'OT-000011', fecha_operativa: '2026-08-04' },
    });
    const user = userEvent.setup();
    renderView();

    expect(listarOtScm).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('button', { name: 'Crear OT diaria' }));
    await waitFor(() => expect(listarOtScm).toHaveBeenCalledWith(
      undefined,
      'FABRICACION',
      { fecha_operativa: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
    ));
    await user.click(screen.getByRole('combobox', { name: 'Modalidad de ejecución' }));
    await user.click(screen.getByRole('option', { name: 'Concurrente con fabricación' }));
    await user.click(screen.getByRole('combobox', { name: 'OT de fabricación de contexto' }));
    await user.click(screen.getByRole('option', { name: /OT-000010/ }));
    await user.click(screen.getByRole('button', { name: 'Crear OT y continuar' }));

    await waitFor(() => expect(crearOtArmadoScm).toHaveBeenCalledWith(
      'oa-1',
      expect.objectContaining({
        modo_ejecucion: 'CONCURRENTE',
        ot_fabricacion_contexto_id: 'fab-ot-1',
        trabajo_color_contexto_id: 'work-green',
      }),
    ));
  });

  it('bloquea el Armado concurrente si la OT no tiene Trabajo de color activo', async () => {
    listarOtArmadoScm.mockResolvedValue({ items: [] });
    listarOtScm.mockResolvedValue({
      items: [{
        public_id: 'fab-ot-empty', codigo_ot: 'OT-000030', tipo_ot: 'FABRICACION',
        estado: 'EN_EJECUCION', fecha_operativa: todayInLima(),
        turno: 'DIA', maquina: 'Haitian 3000', trabajos_color: [],
      }],
    });
    const user = userEvent.setup();
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Crear OT diaria' }));
    await user.click(screen.getByRole('combobox', { name: 'Modalidad de ejecución' }));
    await user.click(screen.getByRole('option', { name: 'Concurrente con fabricación' }));
    await user.click(screen.getByRole('combobox', { name: 'OT de fabricación de contexto' }));
    await user.click(screen.getByRole('option', { name: /OT-000030/ }));

    expect(screen.getByText(/no tiene un Trabajo de color activo/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Crear OT y continuar' })).toBeDisabled();
  });

  it('recarga solo las OT de Fabricación de la fecha elegida en el formulario', async () => {
    listarOtArmadoScm.mockResolvedValue({ items: [] });
    listarOtScm.mockResolvedValue({ items: [] });
    const user = userEvent.setup();
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Crear OT diaria' }));
    fireEvent.change(screen.getByLabelText('Fecha operativa'), {
      target: { value: '2026-08-12' },
    });

    await waitFor(() => expect(listarOtScm).toHaveBeenCalledWith(
      undefined,
      'FABRICACION',
      { fecha_operativa: '2026-08-12' },
    ));
  });

  it('exige el Trabajo de color concreto cuando la OT concurrente es multicolor', async () => {
    listarOtArmadoScm.mockResolvedValue({ items: [] });
    listarOtScm.mockResolvedValue({
      items: [{
        public_id: 'fab-ot-multi', codigo_ot: 'OT-000020', tipo_ot: 'FABRICACION',
        estado: 'EN_EJECUCION', fecha_operativa: todayInLima(),
        turno: 'DIA', maquina: 'Haitian 3000',
        trabajos_color: [
          { id: 'work-green', color: 'VERDE SÓLIDO', estado: 'EN_EJECUCION', orden_fabricacion_codigo: 'OF-001' },
          {
            id: 'work-blue', color: 'AZUL', estado: 'PLANIFICADO',
            orden_fabricacion_codigo: 'OF-002',
            articulos_salida: [{
              id: 22, codigo: 'PC-000022', nombre: 'Alcancía azul',
              clase: 'PIEZA_COLOR', unidad: 'UN',
            }],
          },
        ],
      }],
    });
    crearOtArmadoScm.mockResolvedValue({
      ot: { codigo_ot: 'OT-000021', fecha_operativa: '2026-08-04' },
    });
    const user = userEvent.setup();
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Crear OT diaria' }));
    await user.click(screen.getByRole('combobox', { name: 'Modalidad de ejecución' }));
    await user.click(screen.getByRole('option', { name: 'Concurrente con fabricación' }));
    await user.click(screen.getByRole('combobox', { name: 'OT de fabricación de contexto' }));
    await user.click(screen.getByRole('option', { name: /OT-000020/ }));
    expect(screen.getByRole('button', { name: 'Crear OT y continuar' })).toBeDisabled();

    await user.click(screen.getByRole('combobox', { name: 'Trabajo de color concurrente' }));
    await user.click(screen.getByRole('option', {
      name: /AZUL.*OF-002.*PC-000022.*Alcancía azul/i,
    }));
    await user.click(screen.getByRole('button', { name: 'Crear OT y continuar' }));

    await waitFor(() => expect(crearOtArmadoScm).toHaveBeenCalledWith(
      'oa-1',
      expect.objectContaining({
        modo_ejecucion: 'CONCURRENTE',
        ot_fabricacion_contexto_id: 'fab-ot-multi',
        trabajo_color_contexto_id: 'work-blue',
      }),
    ));
  });

  it('muestra modalidad y contexto después de crear la OT de Armado', async () => {
    listarOtArmadoScm.mockResolvedValue({ items: [{
      ...ot,
      modo_ejecucion_armado: 'CONCURRENTE',
      ot_fabricacion_contexto: {
        public_id: 'fab-ot-1', codigo_ot: 'OT-000010', maquina: 'Haitian 3000',
      },
      trabajo_color_contexto_id: 'work-green',
    }] });
    renderView();

    expect(await screen.findByText('Concurrente con fabricación')).toBeVisible();
    expect(screen.getByText(/OT-000010.*Haitian 3000/)).toBeVisible();
  });

  it('abre desde el tablero la OA y la jornada indicadas por el enlace profundo', async () => {
    const requestedOrder = {
      ...order,
      id: 'oa-2',
      codigo: 'OA-000002',
      salida: { ...order.salida, nombre: 'Balde azul' },
    };
    const requestedOt = {
      ...ot,
      public_id: 'ot-2',
      codigo_ot: 'OT-000022',
      cantidad_objetivo: '5.000',
    };
    listarOrdenesArmadoScm.mockResolvedValue({ items: [order, requestedOrder] });
    listarOtArmadoScm.mockImplementation((orderId) => Promise.resolve({
      items: orderId === 'oa-2' ? [requestedOt] : [ot],
    }));

    renderView(
      '/produccion/ordenes-armado?oa=oa-2&ot=ot-2&fecha=2026-08-10&turno=NOCHE&modo=armado',
    );

    await waitFor(() => expect(listarOtArmadoScm).toHaveBeenCalledWith('oa-2'));
    expect(await screen.findByText('Balde azul')).toBeVisible();
    expect(screen.getByTestId('assembly-ot-ot-2')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('link', { name: 'Volver a Jornadas' })).toHaveAttribute(
      'href',
      '/produccion/ots-planta?fecha=2026-08-10&turno=NOCHE&modo=armado&ot=ot-2',
    );
    const createButton = screen.getByRole('button', { name: 'Crear OT diaria' });
    await waitFor(() => expect(createButton).toBeEnabled());
    await userEvent.setup().click(createButton);
    expect(screen.getByLabelText('Fecha operativa')).toHaveValue('2026-08-10');
    expect(screen.getByRole('combobox', { name: 'Turno' })).toHaveTextContent('Noche');
  });

  it('limpia modalidad y contextos al cambiar de OA', async () => {
    const nextOrder = {
      ...order,
      id: 'oa-2',
      codigo: 'OA-000002',
      salida: { ...order.salida, nombre: 'Balde azul' },
    };
    listarOrdenesArmadoScm.mockResolvedValue({ items: [order, nextOrder] });
    listarOtArmadoScm.mockResolvedValue({ items: [] });
    listarOtScm.mockResolvedValue({ items: [{
      public_id: 'fab-ot-1', codigo_ot: 'OT-000010', tipo_ot: 'FABRICACION',
      estado: 'EN_EJECUCION', fecha_operativa: todayInLima(), turno: 'DIA',
      maquina: 'Haitian 3000',
      trabajos_color: [{
        id: 'work-green', color: 'VERDE', estado: 'EN_EJECUCION',
        orden_fabricacion_codigo: 'OF-001',
      }],
    }] });
    const user = userEvent.setup();
    renderView();

    const initialCreateButton = await screen.findByRole('button', { name: 'Crear OT diaria' });
    await waitFor(() => expect(initialCreateButton).toBeEnabled());
    await user.click(initialCreateButton);
    await user.click(screen.getByRole('combobox', { name: 'Modalidad de ejecución' }));
    await user.click(screen.getByRole('option', { name: 'Concurrente con fabricación' }));
    await user.click(screen.getByRole('combobox', { name: 'OT de fabricación de contexto' }));
    await user.click(screen.getByRole('option', { name: /OT-000010/ }));
    expect(screen.getByText('Trabajo de color concurrente')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Crear OT diaria de Armado' }))
        .not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('combobox', { name: 'Orden de armado' }));
    await user.click(screen.getByRole('option', { name: /OA-000002/ }));
    await user.click(await screen.findByRole('button', { name: 'Crear OT diaria' }));

    expect(screen.getByRole('combobox', { name: 'Modalidad de ejecución' }))
      .toHaveTextContent('En mesa de armado');
    expect(screen.queryByRole('combobox', { name: 'OT de fabricación de contexto' }))
      .not.toBeInTheDocument();
  });

  it('presenta la necesidad y el rango OT como información no editable', async () => {
    listarOrdenesArmadoScm.mockResolvedValue({ items: [{
      ...order,
      fecha_necesidad: '2026-08-15',
      fecha_necesidad_fuente: { tipo: 'OP', id: 'op-1', codigo: 'OP-000001' },
      rango_fechas_ot: { desde: '2026-08-10', hasta: '2026-08-12', cantidad: 3 },
      programacion_estado: 'PROGRAMADA',
    }] });
    renderView();

    const strip = await screen.findByTestId('order-schedule-strip');
    expect(strip).toHaveTextContent(/Necesidad.*15\/08\/2026/);
    expect(within(strip).getByText(/OP-000001/)).toBeVisible();
    expect(strip).toHaveTextContent(/10\/08\/2026.*12\/08\/2026/);
    expect(within(strip).getByText('3 OT')).toBeVisible();
    expect(within(strip).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('calcula el plan y asigna las mangas PT a la jornada', async () => {
    actorState.capabilities = new Set([
      'OA_VER', 'OT_VER', 'PLAN_MANGA_VER', 'ENSAMBLE_PLANIFICAR',
      'ABASTECIMIENTO_VER',
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
      'OA_VER', 'OT_VER', 'PLAN_MANGA_VER', 'ABASTECIMIENTO_VER',
      'ENSAMBLE_MANGA_CERRAR', 'GENEALOGIA_VER',
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
