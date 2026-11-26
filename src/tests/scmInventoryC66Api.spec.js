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

  it('expone la cola de revisión y separa revisión de ajuste', async () => {
    api.get.mockResolvedValue({ data: { revision: { candidatas: [] } } });
    api.post.mockResolvedValue({ data: { token: 'REV-1' } });
    const {
      obtenerRevisionFaltantes,
      registrarRevisionFaltante,
      confirmarFaltanteInventario,
    } = await import('../services/scmInventoryC66Api');

    await obtenerRevisionFaltantes();
    await registrarRevisionFaltante({ codigo: 'C66-001' }, 'key-review');
    await confirmarFaltanteInventario({ codigo: 'C66-001', token: 'REV-1', motivo: 'No encontrado' }, 'key-missing');

    expect(api.get).toHaveBeenCalledWith(
      '/scm/v1/inventario-c66/revision', { headers: { 'X-Actor-Id': '42' } },
    );
    expect(api.post.mock.calls.slice(-2)).toEqual([
      ['/scm/v1/inventario-c66/revision', { codigo: 'C66-001' }, { headers: { 'X-Actor-Id': '42', 'Idempotency-Key': 'key-review' } }],
      ['/scm/v1/inventario-c66/faltantes', { codigo: 'C66-001', token: 'REV-1', motivo: 'No encontrado' }, { headers: { 'X-Actor-Id': '42', 'Idempotency-Key': 'key-missing' } }],
    ]);
  });

  it('expone la bandeja de sesiones y aprueba con idempotencia', async () => {
    api.get.mockResolvedValue({ data: { sesiones: [{ id: 'S-1', nombre: 'Conteo mañana' }] } });
    api.post.mockResolvedValue({ data: { ok: true } });
    const {
      obtenerSesionesRevision,
      obtenerDetalleRevisionSesion,
      aprobarRevisionSesion,
    } = await import('../services/scmInventoryC66Api');

    await obtenerSesionesRevision();
    await obtenerDetalleRevisionSesion('S-1');
    await aprobarRevisionSesion('S-1', {
      version_revision: 3,
      codigos: ['M-1'],
      motivo: 'Cobertura validada',
      cobertura: true,
      movimientos_revisados: true,
      busqueda: true,
    }, 'approve-key');

    expect(api.get.mock.calls.slice(-2)).toEqual([
      ['/scm/v1/inventario-c66/revision/sesiones', { headers: { 'X-Actor-Id': '42' } }],
      ['/scm/v1/inventario-c66/revision/sesiones/S-1', { headers: { 'X-Actor-Id': '42' } }],
    ]);
    expect(api.post.mock.calls.at(-1)).toEqual([
      '/scm/v1/inventario-c66/revision/sesiones/S-1/aprobar',
      {
        version_revision: 3,
        codigos: ['M-1'],
        motivo: 'Cobertura validada',
        cobertura: true,
        movimientos_revisados: true,
        busqueda: true,
      },
      { headers: { 'X-Actor-Id': '42', 'Idempotency-Key': 'approve-key' } },
    ]);
  });
});
