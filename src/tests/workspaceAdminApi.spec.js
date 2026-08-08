import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../services/api';
import {
  actualizarRolWorkspace,
  actualizarTrabajadorWorkspace,
  definirRolPrincipalWorkspace,
  listarCapacidadesWorkspace,
} from '../services/workspaceAdminApi';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('../services/scmEngineeringApi', () => ({
  obtenerActorScm: () => 42,
}));

vi.mock('../config/runtime', () => ({
  SCM_AUTH_MODE: 'local_actor',
}));

describe('API administrativa del workspace', () => {
  beforeEach(() => vi.clearAllMocks());

  it('envía el actor local al consultar capacidades', async () => {
    api.get.mockResolvedValue({ data: [{ codigo: 'INVENTARIO_VER' }] });

    await expect(listarCapacidadesWorkspace()).resolves.toEqual([
      { codigo: 'INVENTARIO_VER' },
    ]);
    expect(api.get).toHaveBeenCalledWith('/catalogo/capacidades', {
      headers: { 'X-Actor-Id': '42' },
    });
  });

  it('conserva concurrencia optimista y actor en la actualización de rol', async () => {
    api.put.mockResolvedValue({ data: { id: 7, version: 3 } });
    const payload = {
      nombre: 'Auditor de inventario',
      capacidad_codigos: ['INVENTARIO_VER'],
      expected_version: 2,
    };

    await actualizarRolWorkspace(7, payload);

    expect(api.put).toHaveBeenCalledWith('/catalogo/roles-operativos/7', payload, {
      headers: { 'X-Actor-Id': '42' },
    });
  });

  it('define el principal sin cambiar la identidad simulada del frontend', async () => {
    api.patch.mockResolvedValue({ data: { ok: true } });

    await definirRolPrincipalWorkspace(15, 7);

    expect(api.patch).toHaveBeenCalledWith(
      '/catalogo/trabajadores/15/rol-principal',
      { rol_operativo_id: 7 },
      { headers: { 'X-Actor-Id': '42' } },
    );
  });

  it('autoriza las mutaciones de trabajadores en modo local', async () => {
    api.put.mockResolvedValue({ data: { id: 15 } });
    const payload = { nombres: 'Ana', roles_ids: [7] };

    await actualizarTrabajadorWorkspace(15, payload);

    expect(api.put).toHaveBeenCalledWith('/catalogo/trabajadores/15', payload, {
      headers: { 'X-Actor-Id': '42' },
    });
  });
});
