import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';

import OtMangasScm from '../components/OtMangasScm';

const catalogMocks = vi.hoisted(() => ({
  getTrabajadores: vi.fn(),
  obtenerMaquinas: vi.fn(),
  obtenerMoldes: vi.fn(),
}));

const scmMocks = vi.hoisted(() => ({
  listarOrdenesFabricacionScm: vi.fn(),
  obtenerPlanMangas: vi.fn(),
  listarOtScm: vi.fn(),
  listarContinuidadesMangaPendientesScm: vi.fn(),
  listarSolicitudesMangaExtraScm: vi.fn(),
  crearOtFabricacionScm: vi.fn(),
  crearTrabajoColorScm: vi.fn(),
}));

const actorMocks = vi.hoisted(() => ({
  can: vi.fn(),
  canAny: vi.fn(),
  actorId: 1,
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
  listarContinuidadesMangaPendientesScm:
    scmMocks.listarContinuidadesMangaPendientesScm,
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
    actorId: actorMocks.actorId,
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

const renderSubject = (path = '/') => render(
  <MemoryRouter initialEntries={[path]}>
    <OtMangasScm />
  </MemoryRouter>,
);

function UrlProbe() {
  const location = useLocation();
  return <output aria-label="URL actual">{location.pathname}{location.search}</output>;
}

function HistoryProbe() {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(-1)}>Volver</button>;
}

describe('tablero diario por máquina y selección humana de color', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actorMocks.actorId = 1;
    actorMocks.can.mockReturnValue(true);
    actorMocks.canAny.mockReturnValue(true);
    catalogMocks.obtenerMaquinas.mockResolvedValue(machines);
    catalogMocks.getTrabajadores.mockResolvedValue(workers);
    catalogMocks.obtenerMoldes.mockResolvedValue([]);
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
          color_identidad: { hex: '#2E7D32' },
          color_hex: '#FF0000',
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
    scmMocks.listarContinuidadesMangaPendientesScm.mockResolvedValue({ items: [] });
  });

  it('muestra las 13 máquinas aunque ninguna tenga OT para la fecha y turno', async () => {
    renderSubject();

    const board = await screen.findByTestId('daily-machine-board');
    expect(within(board).getAllByTestId('machine-day-card')).toHaveLength(13);
    expect(within(board).getAllByText('Sin OT')).toHaveLength(13);
    expect(within(board).getByText('ID: SOP-01')).toBeVisible();
    expect(within(board).getByText('ID: SOP-13')).toBeVisible();
    const summary = screen.getByRole('group', { name: 'Filtrar máquinas por estado de OT' });
    expect(within(summary).getByRole('button', { name: 'Todas 13' })).toBeVisible();
    expect(within(summary).getByRole('button', { name: 'Con OT 0' })).toBeVisible();
    expect(within(summary).getByRole('button', { name: 'En ejecución 0' })).toBeVisible();
    expect(within(summary).getByRole('button', { name: 'Sin OT 13' })).toBeVisible();
    expect(scmMocks.listarOtScm).toHaveBeenCalledWith(
      undefined,
      'FABRICACION',
      {
        fecha_operativa: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        turno: 'DIA',
      },
    );
  });

  it('habilita Crear OT en global después de cargar catálogos esenciales', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/produccion/ots-planta?vista=todas']}>
        <OtMangasScm />
      </MemoryRouter>,
    );

    const newOt = await screen.findByRole('button', { name: 'Nueva OT' });
    await waitFor(() => expect(newOt).toBeEnabled());
    await user.click(newOt);
    const dialog = await screen.findByRole('dialog', { name: 'Nueva OT de máquina' });
    const machine = within(dialog).getByRole('combobox', { name: 'Máquina' });
    await user.click(machine);
    await user.click(screen.getByRole('option', { name: 'Sopladora 1SOP-01' }));
    expect(within(dialog).getByRole('button', { name: 'Crear OT de máquina' })).toBeEnabled();
  });

  it('conserva máquinas y maquinistas si falla el catálogo opcional de OF', async () => {
    const user = userEvent.setup();
    scmMocks.listarOrdenesFabricacionScm.mockRejectedValueOnce(new Error('OF temporalmente no disponible'));
    render(
      <MemoryRouter initialEntries={['/produccion/ots-planta?vista=todas']}>
        <OtMangasScm />
      </MemoryRouter>,
    );

    const newOt = await screen.findByRole('button', { name: 'Nueva OT' });
    await waitFor(() => expect(newOt).toBeEnabled());
    expect(screen.getByText(/No se pudieron cargar los nombres de OF\/molde/)).toBeVisible();
    await user.click(newOt);
    const dialog = await screen.findByRole('dialog', { name: 'Nueva OT de máquina' });
    await user.click(within(dialog).getByRole('combobox', { name: 'Máquina' }));
    expect(screen.getByRole('option', { name: 'Sopladora 1SOP-01' })).toBeVisible();
  });

  it('permite crear OT sin maquinista predeterminado si el catálogo de trabajadores falla', async () => {
    const user = userEvent.setup();
    catalogMocks.getTrabajadores.mockRejectedValueOnce(new Error('trabajadores no disponibles'));
    render(
      <MemoryRouter initialEntries={['/produccion/ots-planta?vista=todas']}>
        <OtMangasScm />
      </MemoryRouter>,
    );

    const newOt = await screen.findByRole('button', { name: 'Nueva OT' });
    await waitFor(() => expect(newOt).toBeEnabled());
    expect(screen.getByText(/No se pudieron cargar los maquinistas/)).toBeVisible();
    await user.click(newOt);
    const dialog = await screen.findByRole('dialog', { name: 'Nueva OT de máquina' });
    await user.click(within(dialog).getByRole('combobox', { name: 'Máquina' }));
    await user.click(screen.getByRole('option', { name: 'Sopladora 1SOP-01' }));
    await user.click(within(dialog).getByRole('combobox', { name: 'Maquinista predeterminado' }));
    expect(screen.getByRole('option', { name: 'Asignar en cada trabajo' })).toBeVisible();
    await user.click(screen.getByRole('option', { name: 'Asignar en cada trabajo' }));
    expect(within(dialog).getByRole('button', { name: 'Crear OT de máquina' })).toBeEnabled();
  });

  it('mantiene Crear OT bloqueado si falla un catálogo esencial', async () => {
    catalogMocks.obtenerMaquinas.mockRejectedValueOnce(new Error('máquinas no disponibles'));
    render(
      <MemoryRouter initialEntries={['/produccion/ots-planta?vista=todas']}>
        <OtMangasScm />
      </MemoryRouter>,
    );

    const newOt = await screen.findByRole('button', { name: 'Nueva OT' });
    await waitFor(() => expect(newOt).toBeDisabled());
    expect(screen.getByText(/No se pudieron cargar máquinas y maquinistas/)).toBeVisible();
  });

  it('preserva filtros diarios y globales al alternar vistas y recargar la URL', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[
        '/produccion/ots-planta?fecha=2026-10-19&turno=DIA&modo=fabricacion&ot_estado=SIN_OT&maquina_id=2&gq=soplado',
      ]}>
        <OtMangasScm />
        <UrlProbe />
      </MemoryRouter>,
    );

    await screen.findByTestId('daily-machine-board');
    await user.click(screen.getByRole('button', { name: 'Todas las OT' }));
    await waitFor(() => expect(screen.getByTestId('ot-global-index')).toBeVisible());
    const globalUrl = screen.getByLabelText('URL actual').textContent;
    expect(decodeURIComponent(globalUrl)).toContain('gq=soplado');
    expect(decodeURIComponent(globalUrl)).toContain('ot_estado=SIN_OT');
    expect(decodeURIComponent(globalUrl)).toContain('maquina_id=2');

    await user.click(screen.getByRole('button', { name: 'Tablero diario' }));
    await waitFor(() => expect(screen.getByTestId('daily-machine-board')).toBeVisible());
    const dailyUrl = screen.getByLabelText('URL actual').textContent;
    expect(dailyUrl).toContain('gq=soplado');
    expect(dailyUrl).toContain('ot_estado=SIN_OT');
    expect(dailyUrl).toContain('maquina_id=2');
  });

  it('integra el control de turno sin duplicar el resumen de Fabricación', async () => {
    renderSubject();

    await screen.findByTestId('daily-machine-board');
    expect(screen.queryByTestId('plant-journeys-summary')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Filtrar máquinas por estado de OT' })).toBeVisible();
    expect(screen.queryByTestId('plant-day-summary')).not.toBeInTheDocument();
  });

  it('filtra por los cuatro estados con conteos de jornada estables y recuperación del vacío', async () => {
    const user = userEvent.setup();
    scmMocks.listarOtScm.mockResolvedValue({ items: [makeOt()] });
    renderSubject();

    const board = await screen.findByTestId('daily-machine-board');
    const filters = screen.getByRole('group', { name: 'Filtrar máquinas por estado de OT' });
    expect(within(filters).getByRole('button', { name: 'Todas 13' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(filters).getByRole('button', { name: 'Con OT 1' })).toBeVisible();
    expect(within(filters).getByRole('button', { name: 'En ejecución 1' })).toBeVisible();
    expect(within(filters).getByRole('button', { name: 'Sin OT 12' })).toBeVisible();

    const runningFilter = within(filters).getByRole('button', { name: 'En ejecución 1' });
    act(() => runningFilter.focus());
    await user.keyboard('{Enter}');
    expect(within(board).getAllByTestId('machine-day-card')).toHaveLength(1);
    expect(runningFilter).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('daily-board-visible-count')).toHaveTextContent('Mostrando 1 de 13 máquinas');
    expect(within(filters).getByRole('button', { name: 'Todas 13' })).toBeVisible();

    await user.click(within(filters).getByRole('button', { name: 'Sin OT 12' }));
    expect(within(board).getAllByTestId('machine-day-card')).toHaveLength(12);
    await user.click(within(filters).getByRole('button', { name: 'Con OT 1' }));
    expect(within(board).getAllByTestId('machine-day-card')).toHaveLength(1);
    await user.click(within(filters).getByRole('button', { name: 'Todas 13' }));
    expect(within(board).getAllByTestId('machine-day-card')).toHaveLength(13);
  });

  it('rehidrata el chip de estado desde URL sin una nueva consulta', async () => {
    renderSubject('/produccion/ots-planta?ot_estado=EN_EJECUCION');
    const board = await screen.findByTestId('daily-machine-board');
    const filters = screen.getByRole('group', { name: 'Filtrar máquinas por estado de OT' });
    expect(within(filters).getByRole('button', { name: 'En ejecución 0' }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(within(board).queryAllByTestId('machine-day-card')).toHaveLength(0);
    expect(screen.getByText(/Restablece los filtros/)).toBeVisible();
  });

  it('combina máquina y estado por Y y recupera el vacío sin consultar ni mutar', async () => {
    const user = userEvent.setup();
    scmMocks.listarOtScm.mockResolvedValue({ items: [makeOt()] });
    renderSubject();
    const board = await screen.findByTestId('daily-machine-board');
    const machineSelect = screen.getByRole('combobox', { name: 'Filtrar lista por máquina' });
    await user.click(machineSelect);
    await user.click(screen.getByRole('option', { name: /Sopladora 2/ }));
    const filters = screen.getByRole('group', { name: 'Filtrar máquinas por estado de OT' });
    await user.click(within(filters).getByRole('button', { name: 'Con OT 1' }));
    expect(within(board).queryAllByTestId('machine-day-card')).toHaveLength(0);
    expect(screen.getByTestId('daily-board-visible-count')).toHaveTextContent('Mostrando 0 de 13 máquinas');
    const readCount = scmMocks.listarOtScm.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Restablecer filtros' }));
    expect(within(board).getAllByTestId('machine-day-card')).toHaveLength(13);
    expect(scmMocks.listarOtScm).toHaveBeenCalledTimes(readCount);
    expect(scmMocks.crearOtFabricacionScm).not.toHaveBeenCalled();
  });

  it('sincroniza selección y limpieza de máquina en URL sin perder filtros globales', async () => {
    const user = userEvent.setup();
    scmMocks.listarOtScm.mockResolvedValue({ items: [makeOt()] });
    render(
      <MemoryRouter initialEntries={['/produccion/ots-planta?gq=soplado']}>
        <OtMangasScm />
        <UrlProbe />
      </MemoryRouter>,
    );

    await screen.findByTestId('daily-machine-board');
    const machineSelect = screen.getByRole('combobox', { name: 'Filtrar lista por máquina' });
    await user.click(machineSelect);
    await user.click(screen.getByRole('option', { name: /Sopladora 2/ }));
    await waitFor(() => {
      const url = screen.getByLabelText('URL actual').textContent;
      expect(url).toContain('maquina_id=2');
      expect(url).toContain('gq=soplado');
    });

    await user.click(screen.getByRole('button', { name: 'Con OT 1' }));
    await user.click(screen.getByRole('button', { name: 'Restablecer filtros' }));
    await waitFor(() => {
      const url = screen.getByLabelText('URL actual').textContent;
      expect(url).not.toContain('maquina_id=');
      expect(url).toContain('gq=soplado');
    });
  });

  it('rehidrata máquina desde el historial y limpia la selección si la URL no la tiene', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/produccion/ots-planta?gq=soplado']}>
        <OtMangasScm />
        <UrlProbe />
        <HistoryProbe />
      </MemoryRouter>,
    );

    await screen.findByTestId('daily-machine-board');
    await user.click(screen.getByRole('combobox', { name: 'Filtrar lista por máquina' }));
    await user.click(screen.getByRole('option', { name: /Sopladora 2/ }));
    await waitFor(() => expect(screen.getByLabelText('URL actual').textContent)
      .toContain('maquina_id=2'));
    await user.click(screen.getByRole('button', { name: 'Volver' }));
    await waitFor(() => {
      expect(screen.getByLabelText('URL actual').textContent).not.toContain('maquina_id=');
      expect(screen.getAllByTestId('machine-day-card')).toHaveLength(13);
    });
  });

  it('no rebota el chip SIN OT al volver a una URL sin estado', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[
        '/produccion/ots-planta',
        '/produccion/ots-planta?ot_estado=SIN_OT',
      ]} initialIndex={1}>
        <OtMangasScm />
        <UrlProbe />
        <HistoryProbe />
      </MemoryRouter>,
    );

    await screen.findByTestId('daily-machine-board');
    await user.click(screen.getByRole('button', { name: 'Volver' }));
    await waitFor(() => {
      expect(screen.getByLabelText('URL actual').textContent).not.toContain('ot_estado=');
      expect(screen.getByRole('button', { name: 'Todas 13' })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('refresca jornadas y catálogos al cambiar actor conservando criterios y reemplazando datos', async () => {
    const user = userEvent.setup();
    scmMocks.listarOtScm.mockImplementation(() => Promise.resolve({
      items: [makeOt({
        machineId: actorMocks.actorId === 2 ? 2 : 1,
        id: actorMocks.actorId === 2 ? 'actor-two' : 'actor-one',
      })],
    }));
    const { rerender } = render(
      <MemoryRouter initialEntries={['/produccion/ots-planta?fecha=2026-10-20&turno=NOCHE&gq=soplado']}>
        <OtMangasScm />
        <UrlProbe />
      </MemoryRouter>,
    );
    await screen.findByTestId('daily-machine-board');
    await user.click(screen.getByRole('combobox', { name: 'Filtrar lista por máquina' }));
    await user.click(screen.getByRole('option', { name: /Sopladora 2/ }));
    await waitFor(() => expect(screen.getByLabelText('URL actual').textContent)
      .toContain('maquina_id=2'));
    const firstCalls = scmMocks.listarOtScm.mock.calls.length;
    actorMocks.actorId = 2;
    rerender(
      <MemoryRouter initialEntries={['/produccion/ots-planta?fecha=2026-10-20&turno=NOCHE&gq=soplado&maquina_id=2']}>
        <OtMangasScm />
        <UrlProbe />
      </MemoryRouter>,
    );
    await waitFor(() => expect(scmMocks.listarOtScm.mock.calls.length).toBeGreaterThan(firstCalls));
    expect(await screen.findByText('OT-000002')).toBeVisible();
    expect(screen.queryByText('OT-000001')).not.toBeInTheDocument();
    const url = screen.getByLabelText('URL actual').textContent;
    expect(url).toContain('fecha=2026-10-20');
    expect(url).toContain('turno=NOCHE');
    expect(url).toContain('gq=soplado');
    expect(url).toContain('maquina_id=2');
  });

  it('abre el mismo modal de Nueva OT al preparar una máquina sin OT', async () => {
    const user = userEvent.setup();
    renderSubject();

    await user.click(await screen.findByRole('button', { name: 'SOP-01 sin OT' }));

    const dialog = await screen.findByRole('dialog', { name: 'Nueva OT de máquina' });
    expect(within(dialog).getByRole('combobox', { name: 'Máquina' })).toHaveTextContent('SOP-01');
    expect(within(dialog).getByRole('button', { name: 'Crear OT de máquina' })).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Nueva OT de máquina' })).not.toBeInTheDocument());
    expect(scmMocks.crearOtFabricacionScm).not.toHaveBeenCalled();
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
    expect(within(board).getByText('ID: SOP-01')).toBeVisible();
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
    expect(screen.getByRole('button', { name: 'En ejecución 1' })).toBeVisible();
  });

  it('excluye la OT anulada del aviso sin retirarla de la consulta histórica', async () => {
    const user = userEvent.setup();
    scmMocks.listarOtScm.mockResolvedValue({ items: [
      { ...makeOt({ id: 'ot-replacement', works: [] }), estado: 'PLANIFICADA' },
      {
        ...makeOt({ id: 'ot-annulled', works: [] }),
        codigo_ot: 'OT-ANULADA-001',
        estado: 'ANULADA',
      },
    ] });
    renderSubject();

    const card = await screen.findByRole('button', { name: /Abrir jornada de SOP-01/i });
    expect(within(card).getByText('OT-000001')).toBeVisible();
    expect(within(card).queryByText(/Atención:.*OT coinciden/i)).not.toBeInTheDocument();
    await user.click(card);
    await user.click(screen.getByRole('combobox', { name: 'OT de máquina' }));
    await user.click(screen.getByRole('option', { name: /OT-ANULADA-001/ }));
    expect(within(card).getByText('OT-ANULADA-001')).toBeVisible();
    expect(within(card).queryByText(/Atención:.*OT coinciden/i)).not.toBeInTheDocument();
  });

  it('cuenta dos OT no anuladas aunque exista además una anulada', async () => {
    scmMocks.listarOtScm.mockResolvedValue({ items: [
      makeOt({ id: 'ot-current' }),
      makeOt({ id: 'ot-other' }),
      { ...makeOt({ id: 'ot-annulled', works: [] }), estado: 'ANULADA' },
    ] });
    renderSubject();

    const card = await screen.findByRole('button', { name: /Abrir jornada de SOP-01/i });
    expect(within(card).getByText(/Atención: 2 OT coinciden/i)).toBeVisible();
    expect(within(card).queryByText(/Atención: 3 OT coinciden/i)).not.toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'En ejecución 1' })).toBeVisible();
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
    // A closed journey remains readable, but no longer offers new work.
    expect(screen.queryByRole('combobox', { name: 'Orden de fabricación' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Agregar a la cola de esta OT' })).not.toBeInTheDocument();
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
    expect(screen.getByRole('heading', { name: 'Contexto de OT' })).toBeVisible();
  });

  it('muestra un único color como configuración de solo lectura sin exponer C01', async () => {
    scmMocks.listarOtScm.mockResolvedValue({ items: [makeOt()] });
    renderSubject();
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar trabajo', exact: true }));

    const colorSummary = await screen.findByTestId('single-production-color');
    expect(within(colorSummary).getByText('Color a fabricar')).toBeVisible();
    expect(within(colorSummary).getByText('VERDE SÓLIDO')).toBeVisible();
    expect(within(colorSummary).getByTitle('Muestra de referencia: #2E7D32')).toBeVisible();
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

    await userEvent.click(await screen.findByRole('button', { name: 'Agregar trabajo', exact: true }));
    const summary = await screen.findByTestId('single-production-color');
    expect(within(summary).getByText('Color no informado en la OF')).toBeVisible();
    expect(within(summary).getByTitle('Sin hexadecimal de referencia')).toBeVisible();
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
            color_identidad: { hex: '#2E7D32' },
            estado: 'LIBERADA', secuencia: 1,
            salidas: [{ articulo: { nombre: 'Alcancía Pablo grande' } }],
          },
          {
            id: 'run-blue', codigo: 'C02', color_nombre: 'AZUL MARINO',
            color_hex: '#000080',
            estado: 'LIBERADA', secuencia: 2,
            salidas: [{ articulo: { nombre: 'Alcancía Pablo mediana' } }],
          },
        ],
      }],
    });
    scmMocks.listarOtScm.mockResolvedValue({ items: [makeOt()] });
    renderSubject();

    await user.click(await screen.findByRole('button', { name: 'Agregar trabajo', exact: true }));
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
    expect(within(screen.getByRole('option', { name: /VERDE SÓLIDO · Alcancía Pablo grande/ }))
      .getByTitle('Muestra de referencia: #2E7D32')).toBeVisible();
    expect(within(screen.getByRole('option', { name: /AZUL MARINO · Alcancía Pablo mediana/ }))
      .getByTitle('Muestra de referencia: #000080')).toBeVisible();
    await user.click(screen.getByRole('option', { name: /AZUL MARINO · Alcancía Pablo mediana/ }));
    expect(within(colorSelect).getByTitle('Muestra de referencia: #000080')).toBeVisible();
  });

  it('busca OF por nombre y código de molde y conserva la selección al escribir', async () => {
    const user = userEvent.setup();
    scmMocks.listarOtScm.mockResolvedValue({ items: [makeOt()] });
    scmMocks.listarOrdenesFabricacionScm.mockResolvedValueOnce({
      items: [{
        id: 'of-mold-search',
        codigo: 'OF-010',
        estado: 'LIBERADA',
        molde_id: 'ML-PRISMA',
        corridas: [{
          id: 'run-mold-search', color_nombre: 'AZUL', estado: 'LIBERADA',
          salidas: [{ articulo: { nombre: 'Pieza prisma' } }],
        }],
      }],
    });
    catalogMocks.obtenerMoldes.mockResolvedValue([
      { codigo: 'ML-PRISMA', nombre: 'Molde Prísma', activo: true },
    ]);
    renderSubject();
    await user.click(await screen.findByRole('button', { name: 'Agregar trabajo', exact: true }));

    const input = await screen.findByRole('combobox', { name: 'Orden de fabricación' });
    await user.click(input);
    await user.keyboard('{Control>}a{/Control}ML-PRISMA');
    expect(await screen.findByRole('option', { name: /Molde Prísma.*OF: OF-010/i })).toBeVisible();
    expect(screen.getByTestId('fabrication-order-selection')).toHaveTextContent('OF: OF-010');

    await user.keyboard('{Control>}a{/Control}molde prisma');
    expect(await screen.findByRole('option', { name: /Molde Prísma.*OF: OF-010/i })).toBeVisible();
    await user.keyboard('{Control>}a{/Control}OF-010');
    expect(await screen.findByRole('option', { name: /Molde Prísma.*OF: OF-010/i })).toBeVisible();
  });

  it('muestra sin resultados sin cambiar la OF seleccionada mientras se escribe', async () => {
    const user = userEvent.setup();
    scmMocks.listarOtScm.mockResolvedValue({ items: [makeOt()] });
    renderSubject();
    await user.click(await screen.findByRole('button', { name: 'Agregar trabajo', exact: true }));
    const input = await screen.findByRole('combobox', { name: 'Orden de fabricación' });
    expect(input).toHaveValue('OF-001');

    await user.click(input);
    await user.keyboard('{Control>}a{/Control}NO-EXISTE');

    expect(await screen.findByText('Sin OF que coincida con molde, código o ID')).toBeVisible();
    expect(screen.getByTestId('fabrication-order-selection')).toHaveTextContent('OF: OF-001');
    expect(input).toHaveValue('NO-EXISTE');
    expect(screen.getByRole('button', { name: 'Agregar a la cola de esta OT' })).toBeDisabled();
  });
});
