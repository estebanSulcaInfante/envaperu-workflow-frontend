import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock('../services/api', () => ({
  default: { get: getMock },
}));
vi.mock('../services/scmEngineeringApi', () => ({
  obtenerActorScm: () => 8,
}));

import { explorarSaldosInventarioScm, listarMovimientosInventarioScm } from '../services/scmInventoryApi';

describe('explorador paginado del Kardex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockResolvedValue({ data: { items: [], page: { total: 0 } } });
  });

  it('envía filtros y cursor al backend sin descargar el Kardex completo', async () => {
    const params = {
      kardex: 'PIEZAS_WIP', q: 'asa', ubicacion: 'PZ-A1',
      disponibilidad: 'LIBRE', ordenar: 'CODIGO', limite: 25,
      cursor: 'cursor-segunda-pagina',
    };

    await explorarSaldosInventarioScm(params);

    expect(getMock).toHaveBeenCalledWith('/scm/v1/inventario/explorador', {
      headers: { 'X-Actor-Id': '8' },
      params,
    });
  });

  it('envía unidad KG como filtro explícito en los movimientos', async () => {
    await listarMovimientosInventarioScm({ unidad: 'KG' });

    expect(getMock).toHaveBeenCalledWith('/scm/v1/inventario/movimientos', {
      headers: { 'X-Actor-Id': '8' },
      params: { limite: 100, unidad: 'KG' },
    });
  });
});
