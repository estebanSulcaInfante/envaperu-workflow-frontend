import { render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CalidadProcesoScm from '../components/CalidadProcesoScm';
import { listarJornadasPlantaScm, obtenerOrdenFabricacionScm, obtenerOtScm } from '../services/scmOtApi';
import { obtenerMoldes } from '../services/api';
import { qualityVisitApi } from '../services/qualityVisitApi';

vi.mock('../services/scmOtApi', () => ({
  listarJornadasPlantaScm: vi.fn(),
  obtenerOtScm: vi.fn(),
  obtenerOrdenFabricacionScm: vi.fn(),
}));
vi.mock('../services/api', () => ({ obtenerMoldes: vi.fn() }));
vi.mock('../services/qualityVisitApi', () => ({
  qualityVisitApi: { loadVisits: vi.fn(), saveDraft: vi.fn(), confirmVisit: vi.fn() },
}));

const work = {
  id: 'work-calidad-1',
  estado: 'EN_EJECUCION',
  color: 'ROJO',
  color_hex: '#c62828',
  molde_id: 'mold-17',
  molde_nombre: 'Regaderas sólidos',
  snapshot_tiempo_ciclo_seg: 34,
  articulos_salida: [{ id: 'article-base', pieza_id: 'piece-base', nombre: 'Base' }],
};
const ot = {
  public_id: 'ot-calidad-1',
  codigo_ot: 'OT-CAL-001',
  fecha_operativa: '2026-11-14',
  turno: 'DIA',
  estado: 'EN_EJECUCION',
  maquina_id: 'machine-1',
  maquina_nombre: 'HT-250 B',
  trabajos_color_resumen: [work],
  trabajos_color: [work],
  ots_armado: [{ public_id: 'oa-1', codigo_ot: 'OA-001', estado: 'EN_EJECUCION', modo_ejecucion_ensamble: 'CONCURRENTE', ot_fabricacion_contexto: { public_id: 'ot-calidad-1' }, producto_sku: 'WIP-BASE' }],
};

const router = (element, path = '/calidad/reporte') => (
  <MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>
);

describe('Calidad · alcance de lecturas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listarJornadasPlantaScm.mockResolvedValue({ items: [ot], maquinas: [] });
    obtenerOtScm.mockResolvedValue({ ot });
    qualityVisitApi.loadVisits.mockResolvedValue({ items: [] });
  });

  it('carga el tablero desde una sola jornada enriquecida sin catálogo ni OF por trabajo', async () => {
    render(router(<CalidadProcesoScm view="board" initialDate="2026-11-14" initialShift="DIA" />));

    expect(await screen.findByText('OT-CAL-001')).toBeVisible();
    expect(listarJornadasPlantaScm).toHaveBeenCalledWith(expect.objectContaining({
      fecha_operativa: '2026-11-14', turno: 'DIA', vista: 'calidad',
    }));
    expect(obtenerOrdenFabricacionScm).not.toHaveBeenCalled();
    expect(obtenerMoldes).not.toHaveBeenCalled();
  });

  it('abre el detalle por OT sin volver a pedir la jornada ni expandir referencias', async () => {
    render(router(<CalidadProcesoScm view="sheet" otId={ot.public_id} initialDate="2026-11-14" initialShift="DIA" />,
      `/calidad/reporte/ots/${ot.public_id}?fecha=2026-11-14&turno=DIA`));

    expect(await screen.findByRole('heading', { name: 'Informe de OT' })).toBeVisible();
    expect(obtenerOtScm).toHaveBeenCalledWith(ot.public_id, expect.objectContaining({ vista: 'calidad', signal: expect.anything() }));
    expect(listarJornadasPlantaScm).not.toHaveBeenCalled();
    expect(obtenerOrdenFabricacionScm).not.toHaveBeenCalled();
    expect(obtenerMoldes).not.toHaveBeenCalled();
  });

  it('hidrata el informe real con visitas centrales, sin leer el estado local', async () => {
    qualityVisitApi.loadVisits.mockResolvedValue({ items: [{ id: 'visit-1', tipo: 'INICIAL', estado: 'CONFIRMED', trabajo_id: work.id, payload: { outputIds: [], checks: {} } }] });
    render(router(<CalidadProcesoScm centralQuality view="sheet" otId={ot.public_id} initialDate="2026-11-14" initialShift="DIA" />,
      `/calidad/reporte/ots/${ot.public_id}?fecha=2026-11-14&turno=DIA`));

    expect(await screen.findByRole('heading', { name: 'Informe de OT' })).toBeVisible();
    expect(qualityVisitApi.loadVisits).toHaveBeenCalledWith(ot.public_id, { signal: expect.anything() });
  });

  it('muestra la máquina cuando el detalle directo la entrega como string', async () => {
    obtenerOtScm.mockResolvedValue({
      ot: { ...ot, maquina_id: null, maquina_nombre: null, maquina: 'HT-250 B' },
    });
    render(router(<CalidadProcesoScm view="sheet" otId={ot.public_id} initialDate="2026-11-14" initialShift="DIA" />,
      `/calidad/reporte/ots/${ot.public_id}?fecha=2026-11-14&turno=DIA`));

    await screen.findByRole('heading', { name: 'Informe de OT' });
    expect(screen.getByText(/OT-CAL-001 · HT-250 B/)).toBeVisible();
  });

  it('no inicia disponibilidad ni polling en una hoja de OT', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(router(<CalidadProcesoScm view="sheet" otId={ot.public_id} initialDate="2026-11-14" initialShift="DIA" />));
    expect(await screen.findByRole('heading', { name: 'Informe de OT' })).toBeVisible();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('deduplica el montaje doble de StrictMode para la misma jornada', async () => {
    render(<StrictMode>{router(<CalidadProcesoScm view="board" initialDate="2026-11-14" initialShift="DIA" />)}</StrictMode>);
    expect(await screen.findByText('OT-CAL-001')).toBeVisible();
    expect(listarJornadasPlantaScm).toHaveBeenCalledTimes(1);
  });

  it('reutiliza el contexto redirigido, pasa armado concurrente desde la OT y no repite GET', async () => {
    render(router(<CalidadProcesoScm view="station" otId={ot.public_id} initialDate={ot.fecha_operativa} initialShift="DIA" initialOt={ot} />,
      `/calidad/estacion/ots/${ot.public_id}?fecha=${ot.fecha_operativa}&turno=DIA`));

    expect(await screen.findByTestId('concurrent-wip')).toHaveTextContent('OA-001');
    expect(obtenerOtScm).not.toHaveBeenCalled();
  });

  it('rechaza un detalle cuya fecha o turno no coincide con el enlace', async () => {
    obtenerOtScm.mockResolvedValue({ ot: { ...ot, fecha_operativa: '2026-10-15', turno: 'NOCHE' } });
    render(router(<CalidadProcesoScm view="sheet" otId={ot.public_id} initialDate="2026-11-14" initialShift="DIA" />));

    expect(await screen.findByRole('alert')).toHaveTextContent(/fecha y turno consultados/i);
  });

  it('refresca la hoja real por OT sin volver a cargar jornada', async () => {
    const user = userEvent.setup();
    render(router(<CalidadProcesoScm view="sheet" otId={ot.public_id} initialDate={ot.fecha_operativa} initialShift="DIA" />));
    expect(await screen.findByRole('heading', { name: 'Informe de OT' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(obtenerOtScm).toHaveBeenCalledTimes(2);
    expect(listarJornadasPlantaScm).not.toHaveBeenCalled();
  });
});
