import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import OtMangasScm from '../components/OtMangasScm';

const catalogMocks = vi.hoisted(() => ({
  getTrabajadores: vi.fn(),
  obtenerMaquinas: vi.fn(),
}));
const scmMocks = vi.hoisted(() => ({
  listarOtScm: vi.fn(),
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
    await waitFor(() => {
      expect(scmMocks.listarOtScm).toHaveBeenCalledWith(undefined, 'FABRICACION', {
        fecha_operativa: expect.any(String), turno: 'DIA',
      });
      expect(scmMocks.listarOtScm).toHaveBeenCalledWith(undefined, 'ENSAMBLE', {
        fecha_operativa: expect.any(String), turno: 'DIA',
      });
    });
    const summary = screen.getByTestId('plant-journeys-summary');
    expect(within(summary).getByText('Jornadas 2')).toBeVisible();
    expect(within(summary).getByText('En ejecución 1')).toBeVisible();
    expect(within(summary).getByText('Máquinas 1')).toBeVisible();
    expect(within(summary).getByText('Centros de armado 2')).toBeVisible();
  });

  it('explica que la tarjeta abre acciones y permite volver al tablero conservando el turno', async () => {
    const landing = renderJourneys(undefined, 'landing');

    const machineCard = await screen.findByRole('button', {
      name: /Abrir jornada de SOP-01: ver detalle y gestionar/i,
    });
    expect(within(machineCard).getByText('Ver detalle y gestionar')).toBeVisible();
    expect(within(machineCard).getByText('Trabajos, mangas y responsables')).toBeVisible();
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
        '/produccion/ordenes-armado?oa=oa-1&ot=ot-arm-1&fecha=2026-08-10&turno=DIA&modo=armado',
      );
  });

  it('actualiza Fabricación y Armado desde un solo filtro accesible', async () => {
    const user = userEvent.setup();
    renderJourneys();

    const date = await screen.findByLabelText('Fecha de jornada');
    await user.clear(date);
    await user.type(date, '2026-08-12');
    await user.click(screen.getByRole('button', { name: 'Actualizar jornadas' }));

    await waitFor(() => {
      expect(scmMocks.listarOtScm).toHaveBeenCalledWith(undefined, 'FABRICACION', {
        fecha_operativa: '2026-08-12', turno: 'DIA',
      });
      expect(scmMocks.listarOtScm).toHaveBeenCalledWith(undefined, 'ENSAMBLE', {
        fecha_operativa: '2026-08-12', turno: 'DIA',
      });
    });
    expect(screen.getAllByLabelText('Fecha de jornada')).toHaveLength(1);
  });

  it('conserva las jornadas de Armado si falla el catálogo de centros', async () => {
    engineeringMocks.listarCentrosTrabajoScm.mockRejectedValueOnce(new Error('sin catálogo'));
    const user = userEvent.setup();
    renderJourneys();

    await user.click(await screen.findByRole('tab', { name: /Armado.*Centros/i }));
    expect(screen.getByText(/Las jornadas existentes siguen visibles/i)).toBeVisible();
    expect(screen.getByText('Mesa de Armado 1')).toBeVisible();
    expect(screen.getByText('OT-000002')).toBeVisible();
  });

  it('muestra Armado aunque la familia de Fabricación no responda', async () => {
    scmMocks.listarOtScm.mockImplementation((_order, type) => (
      type === 'FABRICACION'
        ? Promise.reject(new Error('fabricación no disponible'))
        : Promise.resolve({ items: [assemblyOt] })
    ));
    renderJourneys(
      '/produccion/ots-planta?fecha=2026-08-10&turno=DIA&modo=armado',
    );

    expect(await screen.findByText(/No se pudieron cargar las jornadas de Fabricación/i))
      .toBeVisible();
    expect(screen.getByText('Mesa de Armado 1')).toBeVisible();
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
});
