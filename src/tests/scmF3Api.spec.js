import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock('../services/api', () => ({
  default: {
    get: getMock,
    post: postMock,
  },
}));

import {
  crearRutaArticuloScm,
  listarRutasArticuloScm,
} from '../services/scmEngineeringApi';
import { crearOrdenArmadoExcepcionalScm } from '../services/scmAssemblyApi';

describe('clientes API F3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.localStorage?.setItem('envaperu_scm_actor_id', '7');
    getMock.mockResolvedValue({ data: { items: [] } });
    postMock.mockResolvedValue({ data: { id: 31 } });
  });

  it('consulta y crea rutas por identidad canónica de artículo', async () => {
    const payload = { notas: 'Ruta WIP', operaciones: [], precedencias: [] };

    await listarRutasArticuloScm(2);
    await crearRutaArticuloScm(2, payload);

    expect(getMock).toHaveBeenCalledWith('/scm/v1/articulos/2/rutas', {
      headers: { 'X-Actor-Id': '7' },
    });
    expect(postMock).toHaveBeenCalledWith(
      '/scm/v1/articulos/2/rutas',
      payload,
      { headers: { 'X-Actor-Id': '7' } },
    );
  });

  it('crea una OA excepcional con clave idempotente', async () => {
    const payload = {
      origen_demanda: 'REPOSICION_WIP',
      motivo: 'Marcha blanca',
      articulo_salida_id: 2,
      operacion_ruta_revision_id: 101,
      estructura_revision_id: 43,
      cantidad_objetivo: '20',
      versiones: { ruta: 4, estructura: 3 },
    };

    await crearOrdenArmadoExcepcionalScm(payload);

    expect(postMock).toHaveBeenCalledWith(
      '/scm/v1/ordenes-armado/excepcionales',
      payload,
      {
        headers: {
          'X-Actor-Id': '7',
          'Idempotency-Key': expect.any(String),
        },
      },
    );
  });
});

