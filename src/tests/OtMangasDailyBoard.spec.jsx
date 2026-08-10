import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import OtMangasScm from '../components/OtMangasScm';

const catalogMocks = vi.hoisted(() => ({
  getTrabajadores: vi.fn(),
  obtenerMaquinas: vi.fn(),
}));

const scmMocks = vi.hoisted(() => ({
  listarOrdenesFabricacionScm: vi.fn(),
  obtenerPlanMangas: vi.fn(),
  listarOtScm: vi.fn(),
  listarSolicitudesMangaExtraScm: vi.fn(),
  crearOtFabricacionScm: vi.fn(),
  crearTrabajoColorScm: vi.fn(),
}));

const actorMocks = vi.hoisted(() => ({
  can: vi.fn(),
  canAny: vi.fn(),
}));

vi.mock('../services/api', () => catalogMocks);

vi.mock('../services/scmOtApi', () => ({
  agregarMangasTrabajoColorScm: vi.fn(),
  anularMangaScm: vi.fn(),
  anularPesajeScm: vi.fn(),
  aprobarMangaExtraScm: vi.fn(),
  aprobarCorreccionPesajeScm: vi.fn(),
  asignarTrabajadorTrabajoColorScm: vi.fn(),
  cambiarEstadoTrabajoColorScm: vi.fn(),
  crearOtFabricacionScm: scmMocks.crearOtFabricacionScm,
  crearTrabajoColorScm: scmMocks.crearTrabajoColorScm,
  generarEtiquetasPrepesaje: vi.fn(),
  listarOtScm: scmMocks.listarOtScm,
  listarSolicitudesMangaExtraScm: scmMocks.listarSolicitudesMangaExtraScm,
  listarOrdenesFabricacionScm: scmMocks.listarOrdenesFabricacionScm,
  obtenerPesajeMangaScm: vi.fn(),
  obtenerPlanMangas: scmMocks.obtenerPlanMangas,
  recalcularPlanMangas: vi.fn(),
  reasignarMangasTrabajoColorScm: vi.fn(),
  reemplazarEtiquetaScm: vi.fn(),
  solicitarMangaExtraScm: vi.fn(),
  solicitarCorreccionPesajeScm: vi.fn(),
}));

vi.mock('../services/scmEngineeringApi', () => ({
  listarCentrosTrabajoScm: vi.fn().mockResolvedValue([]),
  mensajeErrorScm: (_error, fallback) => fallback,
}));

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    can: actorMocks.can,
    canAny: actorMocks.canAny,
    experience: { label: 'Jefe de Producción' },
  }),
}));

const machines = Array.from({ length: 13 }, (_, index) => ({
  id: index + 1,
  codigo: `SOP-${String(index + 1).padStart(2, '0')}`,
  nombre: `Sopladora ${index + 1}`,
}));

const workers = [{
  id: 8,
  codigo: 'TRB-008',
  nombre_completo: 'Ana Maquinista',
  activo: true,
  roles: [{ codigo: 'MAQUINISTA' }],
}];

const plan = {
  revision: 1,
  lineas: [{
    id: 11,
    corrida_fabricacion_id: 'run-green',
    articulo: { nombre: 'Alcancía Pablo grande' },
    tipo_manga: { nombre: 'Bolsa estándar' },
    cantidad_objetivo_un: '100',
    capacidad_efectiva_un: 100,
    mangas_propuestas: 1,
    saldo_un: '100',
  }],
};

const makeWork = ({
  id = 'work-green',
  sequence = 1,
  color = 'VERDE SÓLIDO',
  state = 'EN_EJECUCION',
  ofCode = 'OF-001',
  mangas = [],
} = {}) => ({
  id,
  codigo: `TRABAJO-${sequence}`,
  secuencia: sequence,
  estado: state,
  version: 1,
  orden_fabricacion_id: `of-${sequence}`,
  orden_fabricacion_codigo: ofCode,
  corrida_fabricacion_id: `run-${id}`,
  corrida_codigo: `C${String(sequence).padStart(2, '0')}`,
  color,
  articulo_nombre: 'Alcancía Pablo grande',
  cantidad_objetivo_un: '100',
  cantidad_confirmada_un: '0',
  asignacion_activa: state === 'EN_EJECUCION'
    ? { trabajador_id: 8, trabajador: 'Ana Maquinista', estado: 'ACTIVA' }
    : null,
  asignaciones_personal: [{
    trabajador_id: 8,
    trabajador: 'Ana Maquinista',
    estado: 'PREVISTA',
  }],
  mangas,
});

const closedManga = {
  public_id: 'manga-closed',
  codigo: 'MNG-001',
  articulo_nombre: 'Alcancía Pablo grande',
  color: 'VERDE SÓLIDO',
  estado: 'PENDIENTE_RECEPCION_ALMACEN',
  cantidad_asignada_un: '100',
};

const openManga = {
  public_id: 'manga-open',
  codigo: 'MNG-002',
  articulo_nombre: 'Alcancía Pablo grande',
  color: 'VERDE SÓLIDO',
  estado: 'PREETIQUETADA',
  cantidad_asignada_un: '100',
  etiqueta_vigente: { public_id: 'label-generated', estado: 'GENERADA' },
};

const pendingManga = {
  public_id: 'manga-pending',
  codigo: 'MNG-003',
  articulo_nombre: 'Alcancía Pablo grande',
  color: 'VERDE SÓLIDO',
  estado: 'PLANIFICADA',
  cantidad_asignada_un: '100',
};

const makeOt = ({ machineId = 1, id = 'ot-1', works } = {}) => {
  const trabajos = works || [makeWork({
    mangas: [closedManga, openManga, pendingManga],
  })];
  return {
    public_id: id,
    codigo_ot: `OT-${String(machineId).padStart(6, '0')}`,
    fecha_operativa: '2026-08-10',
    maquina_id: machineId,
    maquina_codigo: machines[machineId - 1].codigo,
    maquina: machines[machineId - 1].nombre,
    turno: 'DIA',
    estado: 'EN_EJECUCION',
    version: 1,
    maquinista_previsto_id: 8,
    maquinista_previsto: 'Ana Maquinista',
    trabajos_color: trabajos,
    mangas: trabajos.flatMap((work) => work.mangas || []),
  };
};

const renderSubject = () => render(
  <MemoryRouter>
    <OtMangasScm />
  </MemoryRouter>,
);

describe('tablero diario por máquina y selección humana de color', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actorMocks.can.mockReturnValue(true);
    actorMocks.canAny.mockReturnValue(true);
    catalogMocks.obtenerMaquinas.mockResolvedValue(machines);
    catalogMocks.getTrabajadores.mockResolvedValue(workers);
    scmMocks.listarOrdenesFabricacionScm.mockResolvedValue({
      items: [{
        id: 'of-green',
        codigo: 'OF-001',
        estado: 'LIBERADA',
        maquina_prevista_id: 1,
        corridas: [{
          id: 'run-green',
          codigo: 'C01',
          color_nombre: 'VERDE SÓLIDO',
          estado: 'LIBERADA',
          ciclos_objetivo: 100,
          secuencia: 1,
          salidas: [{ articulo: { nombre: 'Alcancía Pablo grande' } }],
        }],
      }],
    });
    scmMocks.obtenerPlanMangas.mockResolvedValue({ plan });
    scmMocks.listarSolicitudesMangaExtraScm.mockResolvedValue({ items: [] });
    scmMocks.listarOtScm.mockResolvedValue({ items: [] });
  });

  it('muestra las 13 máquinas aunque ninguna tenga OT para la fecha y turno', async () => {
    renderSubject();

    const board = await screen.findByTestId('daily-machine-board');
    expect(within(board).getAllByTestId('machine-day-card')).toHaveLength(13);
    expect(within(board).getAllByText('Sin OT')).toHaveLength(13);
    expect(within(board).getByText('SOP-01')).toBeVisible();
    expect(within(board).getByText('SOP-13')).toBeVisible();
    const summary = screen.getByTestId('plant-day-summary');
    expect(within(summary).getByText('Máquinas 13')).toBeVisible();
    expect(within(summary).getByText('Con OT 0')).toBeVisible();
    expect(within(summary).getByText('En ejecución 0')).toBeVisible();
    expect(within(summary).getByText('Sin OT 13')).toBeVisible();
    expect(scmMocks.listarOtScm).toHaveBeenCalledWith(
      undefined,
      'FABRICACION',
      {
        fecha_operativa: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        turno: 'DIA',
      },
    );
  });

  it('excluye del tablero las máquinas inactivas o fuera de servicio', async () => {
    catalogMocks.obtenerMaquinas.mockResolvedValue([
      machines[0],
      { ...machines[1], activo: false },
      { ...machines[2], estado: 'FUERA_SERVICIO' },
    ]);
    renderSubject();

    const board = await screen.findByTestId('daily-machine-board');
    expect(within(board).getAllByTestId('machine-day-card')).toHaveLength(1);
    expect(within(board).getByText('SOP-01')).toBeVisible();
    expect(within(board).queryByText('SOP-02')).not.toBeInTheDocument();
    expect(within(board).queryByText('SOP-03')).not.toBeInTheDocument();
  });

  it('mantiene visible una máquina inactiva cuando tiene una OT consultada', async () => {
    catalogMocks.obtenerMaquinas.mockResolvedValue([
      machines[0],
      { ...machines[1], activo: false },
    ]);
    scmMocks.listarOtScm.mockResolvedValue({
      items: [makeOt({ machineId: 2, id: 'ot-inactive-machine' })],
    });
    renderSubject();

    const board = await screen.findByTestId('daily-machine-board');
    expect(within(board).getAllByTestId('machine-day-card')).toHaveLength(2);
    const inactiveCard = screen.getByRole('button', { name: /Abrir jornada de SOP-02/i });
    expect(within(inactiveCard).getByText(/Máquina inactiva o no disponible/i)).toBeVisible();
  });

  it('deja las máquinas sin OT como consulta cuando el actor no puede crearlas', async () => {
    actorMocks.can.mockImplementation((code) => code !== 'OT_CREAR');
    catalogMocks.obtenerMaquinas.mockResolvedValue([machines[0]]);
    renderSubject();

    const card = await screen.findByRole('group', { name: 'SOP-01 sin OT' });
    expect(within(card).getByText(/No hay jornada registrada para este turno/i)).toBeVisible();
    expect(within(card).queryByText(/Preparar OT/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'SOP-01 sin OT' })).not.toBeInTheDocument();
  });

  it('consulta jornadas con OT_VER sin exigir acceso al listado de OF', async () => {
    actorMocks.can.mockImplementation((code) => code === 'OT_VER');
    actorMocks.canAny.mockReturnValue(false);
    catalogMocks.obtenerMaquinas.mockResolvedValue([machines[0]]);
    const workFromOtDto = {
      ...makeWork(),
      articulo_nombre: null,
      articulos_salida: [{
        id: 21, codigo: 'PC-000021', nombre: 'Alcancía desde OT',
        clase: 'PIEZA_COLOR', unidad: 'UN',
      }],
    };
    scmMocks.listarOtScm.mockImplementation((_order, type) => Promise.resolve({
      items: type === 'FABRICACION' ? [makeOt({ works: [workFromOtDto] })] : [],
    }));
    renderSubject();

    expect(await screen.findByTestId('daily-machine-board')).toBeVisible();
    expect(screen.getByText(/PC-000021.*Alcancía desde OT/i)).toBeVisible();
    expect(scmMocks.listarOrdenesFabricacionScm).not.toHaveBeenCalled();
    expect(scmMocks.listarOtScm).toHaveBeenCalledWith(
      undefined,
      'FABRICACION',
      expect.objectContaining({ turno: 'DIA' }),
    );
  });

  it('alerta y conserva en la lista cada OT histórica que coincide en una máquina', async () => {
    const user = userEvent.setup();
    const terminalWork = makeWork({
      id: 'legacy-terminal', state: 'COMPLETADO', color: 'ROJO', mangas: [],
    });
    scmMocks.listarOtScm.mockResolvedValue({ items: [
      makeOt({ machineId: 1, id: 'ot-current' }),
      {
        ...makeOt({ machineId: 1, id: 'ot-legacy', works: [terminalWork] }),
        codigo_ot: 'OT-LEGACY-002',
        estado: 'CERRADA',
      },
    ] });
    renderSubject();

    const card = await screen.findByRole('button', { name: /Abrir jornada de SOP-01/i });
    expect(within(card).getByText(/Atención: 2 OT coinciden/i)).toBeVisible();
    await user.click(card);
    await user.click(screen.getByRole('combobox', { name: 'OT de máquina' }));
    expect(screen.getByRole('option', { name: /OT-000001/ })).toBeVisible();
    await user.click(screen.getByRole('option', { name: /OT-LEGACY-002/ }));
    expect(card).toHaveAttribute('aria-current', 'true');
    expect(within(card).getByText('OT-LEGACY-002')).toBeVisible();
    expect(within(screen.getByTestId('plant-day-summary')).getByText(
      'En ejecución 1',
    )).toBeVisible();
  });

  it('resume trabajo activo, responsable, mangas y siguiente color en la máquina', async () => {
    const nextWork = makeWork({
      id: 'work-blue', sequence: 2, color: 'AZUL', state: 'PLANIFICADO', ofCode: 'OF-002',
    });
    scmMocks.listarOtScm.mockResolvedValue({ items: [makeOt({ works: [
      makeWork({ mangas: [closedManga, openManga, pendingManga] }), nextWork,
    ] })] });

    renderSubject();

    const card = await screen.findByRole('button', { name: /Abrir jornada de SOP-01/i });
    expect(within(card).getByText('OT-000001')).toBeVisible();
    expect(within(card).getByText(/Ana Maquinista/)).toBeVisible();
    expect(within(card).getByText('VERDE SÓLIDO')).toBeVisible();
    expect(within(card).getByText(/Alcancía Pablo grande · OF-001/)).toBeVisible();
    expect(within(card).getByText('Cerradas 1')).toBeVisible();
    expect(within(card).queryByText(/Abiertas/)).not.toBeInTheDocument();
    expect(within(card).getByText('Etiqueta generada 1')).toBeVisible();
    expect(within(card).queryByText(/Con sticker/)).not.toBeInTheDocument();
    expect(within(card).getByText('Pendientes 1')).toBeVisible();
    expect(within(card).getByText(/Siguiente: AZUL · OF-002/)).toBeVisible();
    expect(within(screen.getByTestId('plant-day-summary')).getByText(
      'En ejecución 1',
    )).toBeVisible();
  });

  it('solo afirma impresión cuando la etiqueta vigente lo confirma', async () => {
    const printedManga = {
      ...openManga,
      public_id: 'manga-printed',
      codigo: 'MNG-IMPRESA',
      etiqueta_vigente: { public_id: 'label-printed', estado: 'IMPRESA' },
    };
    scmMocks.listarOtScm.mockResolvedValue({
      items: [makeOt({ works: [makeWork({ mangas: [openManga, printedManga] })] })],
    });

    renderSubject();

    const card = await screen.findByRole('button', { name: /Abrir jornada de SOP-01/i });
    expect(within(card).getByText('Etiqueta generada 1')).toBeVisible();
    expect(within(card).getByText('Etiqueta impresa 1')).toBeVisible();
  });

  it('usa el maquinista previsto real de la OT cuando aún no existe asignación hija', async () => {
    const plannedWork = {
      ...makeWork({ state: 'PLANIFICADO' }),
      asignacion_activa: null,
      asignacion_vigente: null,
      asignaciones_personal: [],
    };
    scmMocks.listarOtScm.mockResolvedValue({ items: [makeOt({ works: [plannedWork] })] });
    renderSubject();

    const card = await screen.findByRole('button', { name: /Abrir jornada de SOP-01/i });
    expect(within(card).getByText('Maquinista: Ana Maquinista')).toBeVisible();
  });

  it('prioriza el trabajo pausado y resume solo sus mangas, no las de otro color', async () => {
    const completedGreen = makeWork({
      id: 'completed-green',
      color: 'VERDE SÓLIDO',
      state: 'COMPLETADO',
      mangas: [closedManga, { ...closedManga, public_id: 'closed-2', codigo: 'MNG-004' }],
    });
    const plannedYellow = makeWork({
      id: 'planned-yellow', sequence: 1, color: 'AMARILLO', state: 'PLANIFICADO',
      mangas: [pendingManga],
    });
    const pausedBlue = makeWork({
      id: 'paused-blue', sequence: 2, color: 'AZUL', state: 'PAUSADO',
      mangas: [{ ...pendingManga, public_id: 'blue-pending', color: 'AZUL' }],
    });
    scmMocks.listarOtScm.mockResolvedValue({
      items: [makeOt({ works: [plannedYellow, pausedBlue, completedGreen] })],
    });
    renderSubject();

    const card = await screen.findByRole('button', { name: /Abrir jornada de SOP-01/i });
    expect(within(card).getByText('Trabajo pausado')).toBeVisible();
    expect(within(card).getByText('Pausada')).toBeVisible();
    expect(within(card).queryByText('Produciendo')).not.toBeInTheDocument();
    expect(within(card).getByText('AZUL')).toBeVisible();
    expect(within(card).getByText('Cerradas 0')).toBeVisible();
    expect(within(card).getByText('Pendientes 1')).toBeVisible();
    expect(within(card).queryByText('Cerradas 2')).not.toBeInTheDocument();
  });

  it('resuelve el artículo histórico desde una OF cerrada sin ofrecerla para alta', async () => {
    const user = userEvent.setup();
    const closedWork = {
      ...makeWork({
        id: 'closed', color: 'ROJO', state: 'COMPLETADO', ofCode: 'OF-CLOSED', mangas: [],
      }),
      orden_fabricacion_id: 'of-closed',
      articulo_nombre: null,
    };
    scmMocks.listarOrdenesFabricacionScm.mockResolvedValue({ items: [{
      id: 'of-closed',
      codigo: 'OF-CLOSED',
      estado: 'CERRADA',
      corridas: [{
        id: 'run-closed',
        estado: 'COMPLETADA',
        salidas: [{ articulo: { nombre: 'Alcancía histórica' } }],
      }],
    }] });
    scmMocks.listarOtScm.mockResolvedValue({
      items: [{ ...makeOt({ works: [closedWork] }), estado: 'CERRADA' }],
    });
    renderSubject();

    const card = await screen.findByRole('button', { name: /Abrir jornada de SOP-01/i });
    expect(within(card).getByText('Último trabajo')).toBeVisible();
    expect(within(card).getByText(/Alcancía histórica · OF-CLOSED/)).toBeVisible();
    await user.click(screen.getByRole('combobox', { name: 'Orden de fabricación' }));
    expect(screen.queryByRole('option', { name: 'OF-CLOSED' })).not.toBeInTheDocument();
  });

  it('selecciona la OT al abrir una tarjeta y lleva al detalle existente', async () => {
    const user = userEvent.setup();
    scmMocks.listarOtScm.mockResolvedValue({ items: [
      makeOt({ machineId: 1, id: 'ot-1' }),
      makeOt({ machineId: 2, id: 'ot-2' }),
    ] });
    renderSubject();

    await user.click(await screen.findByRole('button', { name: /Abrir jornada de SOP-02/i }));

    expect(screen.getByRole('combobox', { name: 'OT de máquina' })).toHaveTextContent(
      'OT-000002',
    );
    expect(screen.getByRole('heading', { name: /Detalle de OT-000002/i })).toBeVisible();
  });

  it('muestra un único color como configuración de solo lectura sin exponer C01', async () => {
    scmMocks.listarOtScm.mockResolvedValue({ items: [makeOt()] });
    renderSubject();

    const colorSummary = await screen.findByTestId('single-production-color');
    expect(within(colorSummary).getByText('Color a fabricar')).toBeVisible();
    expect(within(colorSummary).getByText('VERDE SÓLIDO')).toBeVisible();
    expect(within(colorSummary).getByText(
      /Definido en la configuración liberada de la OF/i,
    )).toBeVisible();
    expect(screen.queryByRole('combobox', { name: 'Color a fabricar' })).not.toBeInTheDocument();
    expect(screen.queryByText('C01')).not.toBeInTheDocument();
  });

  it('no inventa un color faltante ni permite agregar ese trabajo a la OT', async () => {
    scmMocks.listarOrdenesFabricacionScm.mockResolvedValue({ items: [{
      id: 'of-without-color',
      codigo: 'OF-020',
      estado: 'LIBERADA',
      corridas: [{
        id: 'run-green', codigo: 'C01', color_nombre: null, color: null,
        estado: 'LIBERADA', secuencia: 1,
        salidas: [{ articulo: { nombre: 'Alcancía sin color' } }],
      }],
    }] });
    scmMocks.listarOtScm.mockResolvedValue({ items: [makeOt()] });
    renderSubject();

    const summary = await screen.findByTestId('single-production-color');
    expect(within(summary).getByText('Color no informado en la OF')).toBeVisible();
    expect(within(summary).queryByText(/heredado/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', {
      name: 'Agregar a la cola de esta OT',
    })).toBeDisabled();
  });

  it('ofrece un selector humano cuando la OF tiene varios colores sin pedir sus códigos', async () => {
    const user = userEvent.setup();
    scmMocks.listarOrdenesFabricacionScm.mockResolvedValue({
      items: [{
        id: 'of-multi',
        codigo: 'OF-010',
        estado: 'LIBERADA',
        corridas: [
          {
            id: 'run-green', codigo: 'C01', color_nombre: 'VERDE SÓLIDO',
            estado: 'LIBERADA', secuencia: 1,
            salidas: [{ articulo: { nombre: 'Alcancía Pablo grande' } }],
          },
          {
            id: 'run-blue', codigo: 'C02', color_nombre: 'AZUL MARINO',
            estado: 'LIBERADA', secuencia: 2,
            salidas: [{ articulo: { nombre: 'Alcancía Pablo mediana' } }],
          },
        ],
      }],
    });
    scmMocks.listarOtScm.mockResolvedValue({ items: [makeOt()] });
    renderSubject();

    const colorSelect = await screen.findByRole('combobox', { name: 'Color a fabricar' });
    await user.click(colorSelect);
    expect(screen.getByRole('option', {
      name: /VERDE SÓLIDO · Alcancía Pablo grande · OF-010 · secuencia 1/,
    })).toBeVisible();
    expect(screen.getByRole('option', {
      name: /AZUL MARINO · Alcancía Pablo mediana · OF-010 · secuencia 2/,
    })).toBeVisible();
    expect(screen.queryByText('C01')).not.toBeInTheDocument();
    expect(screen.queryByText('C02')).not.toBeInTheDocument();
  });
});
