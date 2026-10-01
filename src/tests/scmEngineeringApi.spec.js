import { beforeEach, describe, expect, it, vi } from 'vitest';

const { postMock, getMock } = vi.hoisted(() => ({ postMock: vi.fn(), getMock: vi.fn() }));

vi.mock('../services/api', () => ({
  default: {
    post: postMock,
    get: getMock,
  },
}));

import {
  aprobarReglaEmpaqueScm,
  listarAsignacionesEmpaqueScm,
  obtenerActorScm,
  publicarEstructuraScm,
  publicarReglaEmpaqueScm,
  resolveActorScmId,
} from '../services/scmEngineeringApi';

describe('aprobarReglaEmpaqueScm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.localStorage?.setItem('envaperu_scm_actor_id', '2');
    postMock.mockResolvedValue({ data: { estado: 'APROBADA' } });
  });

  it('prioriza el perfil elegido sobre el actor inicial del lanzador', () => {
    expect(resolveActorScmId({
      storedActorId: '3',
      configuredActorId: '1',
    })).toBe(3);
    expect(obtenerActorScm()).toBe(2);
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

it('conserva metadata y transmite busqueda/cursor al servidor de asignaciones', async () => {
  globalThis.localStorage?.setItem('envaperu_scm_actor_id', '2');
  const payload = { items: [], total: 41, has_more: true, next_cursor: 'siguiente' };
  getMock.mockResolvedValue({ data: payload });
  expect(await listarAsignacionesEmpaqueScm({ q: 'Balde', limite: 25, cursor: 'anterior' })).toEqual(payload);
  expect(getMock).toHaveBeenCalledWith('/scm/v1/empaque/asignaciones', {
    headers: { 'X-Actor-Id': '2' }, params: { q: 'Balde', limite: 25, cursor: 'anterior' },
  });
});