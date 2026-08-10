import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
vi.mock('../services/api', () => ({ default: { get: getMock } }));

import { listarTrabajosImpresionControlScm } from '../services/scmPrintJobsControlApi';

describe('cola central de impresión', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('envaperu_scm_actor_id', '7');
    getMock.mockResolvedValue({ data: { items: [], count: 0 } });
  });

  it('envía filtros sin credenciales de estación ni campos vacíos', async () => {
    await listarTrabajosImpresionControlScm({
      status: 'PENDING', tipo: 'PREPESAJE', q: 'M-001',
    });
    expect(getMock).toHaveBeenCalledWith(
      '/scm/v1/observabilidad/trabajos-impresion',
      expect.objectContaining({
        headers: { 'X-Actor-Id': '7' },
        params: { status: 'PENDING', tipo: 'PREPESAJE', q: 'M-001', limit: 50 },
      }),
    );
  });
});
