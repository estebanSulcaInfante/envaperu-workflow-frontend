import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import OtMangasScm from '../components/OtMangasScm';

const catalogMocks = vi.hoisted(() => ({
  getTrabajadores: vi.fn(),
  obtenerMaquinas: vi.fn(),
  obtenerMoldes: vi.fn(),
}));
const scmMocks = vi.hoisted(() => ({
  listarOtScm: vi.fn(),
  listarJornadasPlantaScm: vi.fn(),
  obtenerOtScm: vi.fn(),
  listarContinuidadesMangaPendientesScm: vi.fn(),
  listarOrdenesFabricacionScm: vi.fn(),
  obtenerPlanMangas: vi.fn(),
  listarSolicitudesMangaExtraScm: vi.fn(),
}));
const engineeringMocks = vi.hoisted(() => ({
  listarCentrosTrabajoScm: vi.fn(),
}));

vi.mock('../services/api', () => catalogMocks);
vi.mock('../services/scmOtApi', () => ({
  agregarMangasTrabajoColorScm: vi.fn(),
  anularMangaScm: vi.fn(),
  anularPesajeScm: vi.fn(),
  aprobarMangaExtraScm: vi.fn(),
  aprobarCorreccionPesajeScm: vi.fn(),
  cambiarEstadoTrabajoColorScm: vi.fn(),
  crearOtFabricacionScm: vi.fn(),
  crearTrabajoColorScm: vi.fn(),
  generarEtiquetasPrepesaje: vi.fn(),
  listarJornadasPlantaScm: scmMocks.listarJornadasPlantaScm,
  listarContinuidadesMangaPendientesScm:
    scmMocks.listarContinuidadesMangaPendientesScm,
  listarOtScm: scmMocks.listarOtScm,
  obtenerOtScm: scmMocks.obtenerOtScm,
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
  listarCentrosTrabajoScm: engineeringMocks.listarCentrosTrabajoScm,
  mensajeErrorScm: (_error, fallback) => fallback,
}));
vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    can: () => true,
    canAny: () => true,
    experience: { label: 'Jefe de Producción' },
  }),
}));

const fabricationOt = {
  public_id: 'ot-fab-1', codigo_ot: 'OT-000001', tipo_ot: 'FABRICACION',
  fecha_operativa: '2026-08-10', turno: 'DIA', estado: 'EN_EJECUCION',
  maquina_id: 1, maquina_codigo: 'SOP-01', maquina: 'Sopladora 1',
  trabajos_color: [], mangas: [],
};
const assemblyOt = {
  public_id: 'ot-arm-1', codigo_ot: 'OT-000002', tipo_ot: 'ENSAMBLE',
  fecha_operativa: '2026-08-10', turno: 'DIA', estado: 'PLANIFICADA',
  orden_operacion_id: 'oa-1',
  orden_armado: {
    id: 'oa-1',
    codigo: 'OA-000001',
    salida: {
      articulo: {
        id: 21, codigo: 'PT-000021', nombre: 'Alcancía Pablo grande',
        clase: 'PRODUCTO_TERMINADO', unidad: 'UN',
      },
      cantidad_objetivo: '240',
    },
  },
  centro_trabajo: { id: 7, codigo: 'MESA-01', nombre: 'Mesa de Armado 1' },
  responsable: 'Ana Armado', cantidad_objetivo: '240', cantidad_confirmada: '0',
  modo_ejecucion_armado: 'MESA',
  mangas: [
    { public_id: 'm-1', estado: 'PLANIFICADA' },
    { public_id: 'm-2', estado: 'PESADA' },
  ],
  abastecimiento: { codigo: 'SA-000001', estado: 'RECIBIDA' },
};

const journeyPayload = ({ fabrication = [fabricationOt], assembly = [assemblyOt] } = {}) => ({
  maquinas: [{ id: 1, codigo: 'SOP-01', nombre: 'Sopladora 1', activo: true }],
  centros_trabajo: [
    { id: 7, codigo: 'MESA-01', nombre: 'Mesa de Armado 1', tipo: 'ENSAMBLE', activo: true },
    { id: 8, codigo: 'MESA-02', nombre: 'Mesa de Armado 2', tipo: 'ENSAMBLE', activo: true },
  ],
  ots_fabricacion: fabrication,
  ots_armado: assembly,
});

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-search">{location.search}</output>;
}

const renderJourneys = (entry = (
  '/produccion/ots-planta?fecha=2026-08-10&turno=DIA&modo=fabricacion'
), view = 'all') => render(
  <MemoryRouter initialEntries={[entry]}>
    <OtMangasScm view={view} />
    <LocationProbe />
  </MemoryRouter>,
);

describe('OTs de planta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    catalogMocks.obtenerMaquinas.mockResolvedValue([
      { id: 1, codigo: 'SOP-01', nombre: 'Sopladora 1', activo: true },
    ]);
    catalogMocks.getTrabajadores.mockResolvedValue([]);
    engineeringMocks.listarCentrosTrabajoScm.mockResolvedValue([
      { id: 7, codigo: 'MESA-01', nombre: 'Mesa de Armado 1', tipo: 'ENSAMBLE', activo: true },
      { id: 8, codigo: 'MESA-02', nombre: 'Mesa de Armado 2', tipo: 'ENSAMBLE', activo: true },
    ]);
    scmMocks.listarOrdenesFabricacionScm.mockResolvedValue({ items: [] });
    scmMocks.obtenerPlanMangas.mockResolvedValue({ plan: null });
    scmMocks.listarSolicitudesMangaExtraScm.mockResolvedValue({ items: [] });
    scmMocks.listarContinuidadesMangaPendientesScm.mockResolvedValue({ items: [] });
    scmMocks.listarJornadasPlantaScm.mockResolvedValue(journeyPayload());
    scmMocks.obtenerOtScm.mockImplementation(async (id) => ({
      ot: { ...fabricationOt, public_id: id },
    }));
    scmMocks.listarOtScm.mockImplementation((_order, type) => Promise.resolve({
      items: type === 'ENSAMBLE' ? [assemblyOt] : [fabricationOt],
    }));
  });

  it('consulta ambas familias con fecha y turno compartidos y resume toda la planta', async () => {
    renderJourneys();

    expect(await screen.findByRole('heading', { name: 'OTs de planta' })).toBeVisible();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const fabricationTab = screen.getByRole('tab', { name: /Fabricación.*Máquinas/i });
    expect(fabricationTab).toHaveAttribute('aria-controls', 'plant-journeys-panel-fabrication');
    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby', 'plant-journeys-tab-fabrication',
    );
    await waitFor(() => expect(scmMocks.listarJornadasPlantaScm).toHaveBeenCalledWith({
      fecha_operativa: expect.any(String), turno: 'DIA', vista: 'resumen',
    }));
    expect(screen.queryByTestId('plant-journeys-summary')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Filtrar máquinas por estado de OT' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Todas 1' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'En ejecución 0' })).toBeVisible();
    expect(screen.queryByTestId('plant-day-summary')).not.toBeInTheDocument();
  });

  it('explica que la tarjeta abre acciones y permite volver al tablero conservando el turno', async () => {
    const user = userEvent.setup();
    const landing = renderJourneys(undefined, 'landing');

    const machineCard = await screen.findByRole('button', {
      name: /Abrir jornada de SOP-01: ver detalle y gestionar/i,
    });
    expect(within(machineCard).getByText('Ver detalle y gestionar')).toBeVisible();
    expect(within(machineCard).getByText('Trabajos, mangas y responsables')).toBeVisible();
    await user.click(machineCard);
    await waitFor(() => expect(screen.getByTestId('location-search').textContent)
      .toContain('retorno=%2Fproduccion%2Fots-planta'));
    landing.unmount();

    renderJourneys(
      '/produccion/ots-planta/trabajo?fecha=2026-08-10&turno=DIA&modo=fabricacion&ot=ot-fab-1',
      'detail',
    );

    expect(await screen.findByRole('link', { name: 'Volver a OTs de planta' }))
      .toHaveAttribute(
        'href',
        '/produccion/ots-planta?fecha=2026-08-10&turno=DIA&modo=fabricacion',
      );
  });

  it('muestra la perspectiva de centros y enlaza al detalle canónico de OA y OT', async () => {
    const user = userEvent.setup();
    renderJourneys();

    await user.click(await screen.findByRole('tab', { name: /Armado.*Centros/i }));
    const board = screen.getByTestId('daily-assembly-board');
    expect(within(board).getByText('Mesa de Armado 1')).toBeVisible();
    expect(within(board).getByText('OA: OA-000001')).toBeVisible();
    expect(within(board).getByText('OT-000002')).toBeVisible();
    expect(within(board).getByText(/En mesa de armado/i)).toBeVisible();
    expect(within(board).getByText(/Ana Armado/i)).toBeVisible();
    expect(within(board).getByText(/PT-000021.*Alcancía Pablo grande/i)).toBeVisible();
    expect(within(board).getByText('Mangas 2')).toBeVisible();
    expect(within(board).getByText('PLANIFICADA 1')).toBeVisible();
    expect(within(board).getByText('PESADA 1')).toBeVisible();
    expect(within(board).getByText(/SA-000001.*RECIBIDA/i)).toBeVisible();
    expect(within(board).getByText('Mesa de Armado 2')).toBeVisible();
    expect(within(board).getByText('Sin jornada para este turno')).toBeVisible();
    expect(within(board).getByRole('link', { name: /Abrir OA-000001.*OT-000002/i }))
      .toHaveAttribute(
        'href',
        '/produccion/ordenes-armado?oa=oa-1&ot=ot-arm-1&fecha=2026-08-10&turno=DIA&modo=armado&return_to=%2Fproduccion%2Fots-planta%3Ffecha%3D2026-08-10%26turno%3DDIA%26modo%3Darmado',
      );
  });

  it('actualiza Fabricación y Armado desde un solo filtro accesible', async () => {
    const user = userEvent.setup();
    renderJourneys();

    const date = await screen.findByLabelText('Fecha de jornada');
    await user.clear(date);
    await user.type(date, '2026-08-12');
    await user.click(screen.getByRole('button', { name: 'Actualizar jornadas' }));

    await waitFor(() => expect(scmMocks.listarJornadasPlantaScm).toHaveBeenCalledWith({
      fecha_operativa: '2026-08-12', turno: 'DIA', vista: 'resumen',
    }));
    expect(screen.getAllByLabelText('Fecha de jornada')).toHaveLength(1);
  });

  it('usa el catálogo de centros incluido en la jornada consolidada', async () => {
    engineeringMocks.listarCentrosTrabajoScm.mockRejectedValueOnce(new Error('sin catálogo'));
    const user = userEvent.setup();
    renderJourneys();

    await user.click(await screen.findByRole('tab', { name: /Armado.*Centros/i }));
    expect(screen.getByText('Mesa de Armado 1')).toBeVisible();
    expect(screen.getByText('OT-000002')).toBeVisible();
  });

  it('muestra Armado aunque la jornada consolidada no incluya Fabricación', async () => {
    scmMocks.listarJornadasPlantaScm.mockResolvedValueOnce(journeyPayload({ fabrication: [] }));
    renderJourneys(
      '/produccion/ots-planta?fecha=2026-08-10&turno=DIA&modo=armado',
    );

    expect(await screen.findByText('Mesa de Armado 1')).toBeVisible();
    expect(screen.getByText('OT-000002')).toBeVisible();
  });

  it('restaura fecha, turno, perspectiva y OT desde la URL', async () => {
    renderJourneys(
      '/produccion/ots-planta?fecha=2026-08-10&turno=NOCHE&modo=armado&ot=ot-arm-1',
    );

    expect(await screen.findByLabelText('Fecha de jornada')).toHaveValue('2026-08-10');
    expect(screen.getByRole('tab', { name: /Armado.*Centros/i })).toHaveAttribute(
      'aria-selected', 'true',
    );
    expect(await screen.findByText('OT-000002')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Turno' })).toHaveTextContent('Noche');
    expect(screen.getByTestId('location-search')).toHaveTextContent(
      'fecha=2026-08-10&turno=NOCHE&modo=armado&ot=ot-arm-1',
    );
  });

  it('carga un único detalle para la OT seleccionada desde el resumen server-side', async () => {
    renderJourneys(
      '/produccion/ots-planta/trabajo?fecha=2026-08-10&turno=DIA&modo=fabricacion&ot=ot-fab-1',
      'detail',
    );

    expect(await screen.findByRole('heading', { name: 'Contexto de OT' })).toBeVisible();
    await waitFor(() => expect(scmMocks.obtenerOtScm).toHaveBeenCalledTimes(1));
    expect(scmMocks.obtenerOtScm).toHaveBeenCalledWith(
      'ot-fab-1', { signal: expect.any(AbortSignal) },
    );
    expect(scmMocks.listarJornadasPlantaScm).toHaveBeenCalledWith({
      fecha_operativa: '2026-08-10', turno: 'DIA', vista: 'resumen',
    });
  });

  it('conserva contadores exactos de mangas del resumen de Armado', async () => {
    scmMocks.listarJornadasPlantaScm.mockResolvedValueOnce(journeyPayload({
      assembly: [{
        ...assemblyOt,
        mangas: [],
        mangas_resumen: {
          total: 3,
          por_estado: { PLANIFICADA: 1, PESADA: 2, BORRADA: 1, ANULADA: 1 },
        },
      }],
    }));
    const user = userEvent.setup();
    renderJourneys();
    await user.click(await screen.findByRole('tab', { name: /Armado.*Centros/i }));

    const board = screen.getByTestId('daily-assembly-board');
    // The legacy Armado card counted every manga, including BORRADA/ANULADA;
    // the summary preserves that visible total while exposing exact states.
    expect(within(board).getByText('Mangas 5')).toBeVisible();
    expect(within(board).getByText('PLANIFICADA 1')).toBeVisible();
    expect(within(board).getByText('PESADA 2')).toBeVisible();
    expect(within(board).getByText('BORRADA 1')).toBeVisible();
    expect(within(board).getByText('ANULADA 1')).toBeVisible();
  });

  it('expone el fallo del detalle sin habilitar acciones ni reintentar POST', async () => {
    scmMocks.obtenerOtScm.mockRejectedValueOnce(new Error('detalle no disponible'));
    renderJourneys(
      '/produccion/ots-planta/trabajo?fecha=2026-08-10&turno=DIA&modo=fabricacion&ot=ot-fab-1',
      'detail',
    );

    expect(await screen.findByTestId('ot-detail-error')).toHaveTextContent(
      'No se pudo consultar el detalle de la OT seleccionada',
    );
    expect(screen.queryByRole('button', { name: 'Agregar trabajo' })).not.toBeInTheDocument();
  });

  it('ignora el detalle obsoleto al cambiar de OT mientras la primera lectura está pendiente', async () => {
    let resolveFirst;
    let resolveSecond;
    scmMocks.listarJornadasPlantaScm.mockResolvedValueOnce(journeyPayload({
      fabrication: [
        fabricationOt,
        { ...fabricationOt, public_id: 'ot-fab-2', codigo_ot: 'OT-000003', maquina_id: 2, maquina_codigo: 'SOP-02' },
      ],
    }));
    scmMocks.obtenerOtScm
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    const user = userEvent.setup();
    renderJourneys();

    await user.click(await screen.findByRole('button', {
      name: /Abrir jornada de SOP-02: ver detalle y gestionar/i,
    }));
    await act(async () => {
      resolveFirst({ ot: fabricationOt });
      await Promise.resolve();
    });
    expect(screen.queryByText('OT-000001 · 0 trabajos de color')).not.toBeInTheDocument();
    await act(async () => {
      resolveSecond({
        ot: { ...fabricationOt, public_id: 'ot-fab-2', codigo_ot: 'OT-000003', maquina_id: 2 },
      });
      await Promise.resolve();
    });
    expect(await screen.findByText(/OT-000003 · 0 trabajos de color/)).toBeVisible();
  });
});
