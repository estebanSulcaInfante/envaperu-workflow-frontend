import { beforeEach, describe, expect, it, vi } from 'vitest';

const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }));

vi.mock('../services/api', () => ({
  default: {
    post: postMock,
  },
}));

import {
  aprobarReglaEmpaqueScm,
  publicarEstructuraScm,
  publicarReglaEmpaqueScm,
} from '../services/scmEngineeringApi';

describe('aprobarReglaEmpaqueScm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.localStorage?.setItem('envaperu_scm_actor_id', '2');
    postMock.mockResolvedValue({ data: { estado: 'APROBADA' } });
  });

  it('usa revision_id, que es el identificador expuesto por la API de empaque', async () => {
    await aprobarReglaEmpaqueScm({
      revision_id: 17,
      regla_id: 9,
      version: 3,
    });

    expect(postMock).toHaveBeenCalledWith(
      '/scm/v1/reglas-empaque/17/aprobar',
      { version: 3 },
      {
        headers: {
          'X-Actor-Id': '2',
          'Idempotency-Key': expect.any(String),
        },
      },
    );
  });

  it('publica directamente un borrador con versión e idempotencia', async () => {
    await publicarEstructuraScm({ id: 31, version: 4 });

    expect(postMock).toHaveBeenCalledWith(
      '/scm/v1/estructuras/31/publicar',
      { version: 4 },
      {
        headers: {
          'X-Actor-Id': '2',
          'Idempotency-Key': expect.any(String),
        },
      },
    );
  });

  it('publica directamente una regla de empaque con revision_id', async () => {
    await publicarReglaEmpaqueScm({ revision_id: 42, version: 2 });

    expect(postMock).toHaveBeenCalledWith(
      '/scm/v1/reglas-empaque/42/publicar',
      { version: 2 },
      {
        headers: {
          'X-Actor-Id': '2',
          'Idempotency-Key': expect.any(String),
        },
      },
    );
  });
});
