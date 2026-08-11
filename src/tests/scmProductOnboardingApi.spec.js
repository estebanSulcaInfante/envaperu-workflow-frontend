import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';

const { getMock, postMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  putMock: vi.fn(),
}));

vi.mock('../services/api', () => ({
  default: { get: getMock, post: postMock, put: putMock },
}));

import {
  aplicarPasoAltaProducto,
  crearAltaProducto,
  guardarPasoAltaProducto,
  obtenerAltaProducto,
  obtenerSesionActualDeConflicto,
  subirImagenAltaProducto,
} from '../services/scmProductOnboardingApi';

describe('API de alta integral de producto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.localStorage?.setItem('envaperu_scm_actor_id', '7');
  });

  afterEach(() => vi.unstubAllGlobals());

  it('crea y recupera borradores con el actor actual', async () => {
    postMock.mockResolvedValueOnce({ data: { id: 'draft-1', version: 1 } });
    getMock.mockResolvedValueOnce({ data: { id: 'draft-1', version: 1 } });

    await expect(crearAltaProducto({ titulo: 'Portavajillas' }))
      .resolves.toMatchObject({ id: 'draft-1' });
    await expect(obtenerAltaProducto('draft-1'))
      .resolves.toMatchObject({ version: 1 });

    expect(postMock).toHaveBeenCalledWith(
      '/scm/v1/altas-producto',
      { titulo: 'Portavajillas' },
      expect.objectContaining({ headers: expect.objectContaining({ 'X-Actor-Id': '7' }) }),
    );
    expect(getMock).toHaveBeenCalledWith(
      '/scm/v1/altas-producto/draft-1',
      expect.objectContaining({ headers: { 'X-Actor-Id': '7' } }),
    );
  });

  it('guarda cada paso con compare-and-swap y expone la sesion fresca de un 409', async () => {
    putMock.mockResolvedValueOnce({ data: { id: 'draft-1', version: 4 } });
    await guardarPasoAltaProducto('draft-1', 'IDENTIDAD', {
      expected_version: 3,
      data: { producto: { producto: 'COLADOR #3' } },
      estado_paso: 'COMPLETADO',
    });

    expect(putMock).toHaveBeenCalledWith(
      '/scm/v1/altas-producto/draft-1/pasos/IDENTIDAD',
      expect.objectContaining({ expected_version: 3, estado_paso: 'COMPLETADO' }),
      expect.any(Object),
    );

    const current = { id: 'draft-1', version: 6 };
    expect(obtenerSesionActualDeConflicto({
      response: { status: 409, data: { current_session: current } },
    })).toEqual(current);
  });

  it('mantiene un Idempotency-Key UUID v4 si randomUUID no esta disponible', async () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes) => {
        bytes.fill(17);
        return bytes;
      },
    });
    postMock.mockResolvedValueOnce({ data: { id: 'draft-2', version: 1 } });

    await crearAltaProducto({ titulo: 'Prueba' });

    const key = postMock.mock.calls[0][2].headers['Idempotency-Key'];
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('aplica COMPONENTES de forma idempotente y versionada', async () => {
    postMock.mockResolvedValueOnce({
      data: { id: 'draft-1', version: 5, application_results: { created: [] } },
    });

    await aplicarPasoAltaProducto('draft-1', 'COMPONENTES', {
      expected_version: 4,
      application_key: 'components-v4',
      data: { molde: { modo: 'NUEVO', nombre: 'COLADOR 3' }, piezas: [] },
    });

    expect(postMock).toHaveBeenCalledWith(
      '/scm/v1/altas-producto/draft-1/pasos/COMPONENTES/aplicar',
      expect.objectContaining({ expected_version: 4, application_key: 'components-v4' }),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Actor-Id': '7',
          'Idempotency-Key': expect.stringMatching(/^[0-9a-f-]{36}$/i),
        }),
      }),
    );
  });

  it('sube una imagen binaria de sesión sin serializarla en el draft', async () => {
    const file = new File(['imagen-real'], 'colador.webp', { type: 'image/webp' });
    postMock.mockResolvedValueOnce({
      data: {
        id: 'draft-1', version: 6,
        image_results: { entity_type: 'PRODUCTO_TERMINADO', entity_id: 'PT-000123' },
      },
    });

    await subirImagenAltaProducto('draft-1', 'PRODUCTO_TERMINADO', 'PT-000123', {
      file,
      expectedVersion: 5,
      applicationKey: 'imagen-pt-1',
    });

    const [url, body, config] = postMock.mock.calls[0];
    expect(url).toBe('/scm/v1/altas-producto/draft-1/imagenes/PRODUCTO_TERMINADO/PT-000123');
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('imagen')).toBe(file);
    expect(body.get('expected_version')).toBe('5');
    expect(body.get('application_key')).toBe('imagen-pt-1');
    expect(config.headers['Idempotency-Key'])
      .toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(config.headers).not.toHaveProperty('Content-Type');
  });
});
