import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = { get: vi.fn(), post: vi.fn(), delete: vi.fn() };

vi.mock('../services/api', () => ({ default: api }));
vi.mock('../services/scmEngineeringApi', () => ({ obtenerActorScm: () => 42 }));

describe('API de conteo C66', () => {
  beforeEach(() => vi.clearAllMocks());

  it('usa el contrato SCM y conserva la misma clave de operación en POST/DELETE', async () => {
    api.get.mockResolvedValue({ data: { conteo_por_pieza: true } });
    api.post.mockResolvedValue({ data: { id: 'S-C66-1' } });
    api.delete.mockResolvedValue({ data: { ok: true } });
    const {
      obtenerEstadoInventarioC66,
      abrirSesionInventarioC66,
      registrarLecturaInventarioC66,
      retirarLecturaInventarioC66,
      cerrarSesionInventarioC66,
    } = await import('../services/scmInventoryC66Api');

    await obtenerEstadoInventarioC66();
    await obtenerEstadoInventarioC66('S-C66-1');
    await abrirSesionInventarioC66({ zona: 'C66', nombre: 'Turno mañana', piezas: ['Tapa'] }, 'key-open');
    await registrarLecturaInventarioC66('S-C66-1', { codigo: 'C66-001' }, 'key-read');
    await retirarLecturaInventarioC66('S-C66-1', 'C66-001', 'key-remove');
    await cerrarSesionInventarioC66('S-C66-1', {}, 'key-close');

    expect(api.get.mock.calls).toEqual([
      ['/scm/v1/inventario-c66/estado', { headers: { 'X-Actor-Id': '42' } }],
      ['/scm/v1/inventario-c66/estado?sesion_id=S-C66-1', { headers: { 'X-Actor-Id': '42' } }],
    ]);
    expect(api.post.mock.calls.map(([, , config]) => config.headers)).toEqual([
      { 'X-Actor-Id': '42', 'Idempotency-Key': 'key-open' },
      { 'X-Actor-Id': '42', 'Idempotency-Key': 'key-read' },
      { 'X-Actor-Id': '42', 'Idempotency-Key': 'key-close' },
    ]);
    expect(api.delete).toHaveBeenCalledWith(
      '/scm/v1/inventario-c66/sesiones/S-C66-1/lecturas/C66-001',
      { headers: { 'X-Actor-Id': '42', 'Idempotency-Key': 'key-remove' } },
    );
  });
});
