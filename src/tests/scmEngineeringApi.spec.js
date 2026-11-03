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
  hidratarEstructurasScm,
  listarAsignacionesEmpaqueScm,
  listarArticulosPaginaScm,
  listarAprobacionesIngenieriaScm,
  listarReglasEmpaquePaginaScm,
  obtenerReglaEmpaqueScm,
  obtenerActorScm,
  publicarEstructuraScm,
  publicarReglaEmpaqueScm,
  resolverArticulosScm,
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

describe('lectores paginados con actor explícito', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('serializa filtros CSV y transmite la señal de cancelación', async () => {
    const signal = new AbortController().signal;
    getMock.mockResolvedValue({ data: { items: [], total: 0, has_more: false, next_cursor: null } });
    await listarArticulosPaginaScm(9, {
      q: 'Árbol', clases: ['SUBENSAMBLE_WIP', 'PRODUCTO_TERMINADO'], activo: 'all', limite: 25,
    }, signal);
    expect(getMock).toHaveBeenCalledWith('/scm/v1/articulos/pagina', {
      headers: { 'X-Actor-Id': '9' }, signal,
      params: {
        q: 'Árbol', clases: 'SUBENSAMBLE_WIP,PRODUCTO_TERMINADO', activo: 'all', limite: 25,
      },
    });
  });

  it('mantiene rutas nuevas, ids batch e historial bajo la cabecera del actor', async () => {
    const signal = new AbortController().signal;
    getMock.mockResolvedValue({ data: { items: [], approved: [], referenced: [] } });
    await listarAprobacionesIngenieriaScm(7, { dominio: 'RUTA', limite: 25 }, signal);
    await listarReglasEmpaquePaginaScm(7, { vista: 'historial', limite: 25 }, signal);
    await resolverArticulosScm(7, [12, 13], signal);
    await hidratarEstructurasScm(7, { articuloIds: [12], revisionIds: [91] }, signal);
    expect(getMock).toHaveBeenNthCalledWith(1, '/scm/v1/ingenieria/aprobaciones', expect.objectContaining({
      headers: { 'X-Actor-Id': '7' }, signal, params: { dominio: 'RUTA', limite: 25 },
    }));
    expect(getMock).toHaveBeenNthCalledWith(2, '/scm/v1/reglas-empaque/pagina', expect.objectContaining({
      headers: { 'X-Actor-Id': '7' }, signal, params: { vista: 'historial', limite: 25 },
    }));
    expect(getMock).toHaveBeenNthCalledWith(3, '/scm/v1/articulos/resolver', expect.objectContaining({
      headers: { 'X-Actor-Id': '7' }, signal, params: { ids: '12,13' },
    }));
    expect(getMock).toHaveBeenNthCalledWith(4, '/scm/v1/estructuras/hidratacion', expect.objectContaining({
      headers: { 'X-Actor-Id': '7' }, signal, params: { articulo_ids: '12', revision_ids: '91' },
    }));
  });

  it('expone detalle de regla para hidratar campos no proyectados antes de editar', async () => {
    const signal = new AbortController().signal;
    getMock.mockResolvedValue({ data: { revision_id: 44, tolerancia_peso_pct: 3 } });
    await expect(obtenerReglaEmpaqueScm(44, 7, signal)).resolves.toEqual({
      revision_id: 44, tolerancia_peso_pct: 3,
    });
    expect(getMock).toHaveBeenCalledWith('/scm/v1/reglas-empaque/44', {
      headers: { 'X-Actor-Id': '7' }, signal,
    });
  });
});
