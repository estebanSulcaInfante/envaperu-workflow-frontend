import { beforeEach, describe, expect, it, vi } from 'vitest';

const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }));

vi.mock('../services/api', () => ({
  default: { post: postMock },
}));

import { actualizarRutasOpScm } from '../services/scmPlanningApi';

describe('actualizarRutasOpScm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.localStorage?.setItem('envaperu_scm_actor_id', '8');
    postMock.mockResolvedValue({ data: { cambios: [] } });
  });

  it('envía la versión congelada con actor e idempotencia', async () => {
    await actualizarRutasOpScm({ id: 'op-uuid', version: 12 });

    expect(postMock).toHaveBeenCalledWith(
      '/scm/v1/ordenes-produccion/op-uuid/actualizar-rutas',
      { version: 12 },
      {
        headers: {
          'X-Actor-Id': '8',
          'Idempotency-Key': expect.any(String),
        },
      },
    );
  });
});
