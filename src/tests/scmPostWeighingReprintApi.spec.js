import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
}));

vi.mock('../services/api', () => ({ default: api }));
vi.mock('../services/scmEngineeringApi', () => ({
  obtenerActorScm: vi.fn(() => 41),
}));

import {
  confirmPostWeighingReprint,
  getPostWeighingReprintRequest,
  previewPostWeighingReprint,
} from '../services/scmPostWeighingReprintApi';

describe('API de reimpresión POSTPESAJE', () => {
  beforeEach(() => vi.clearAllMocks());

  it('envía preview con ids explícitos, estación y actor', async () => {
    api.post.mockResolvedValueOnce({ data: { preview_digest: 'digest-1' } });
    const payload = {
      items: [{ pesaje_id: 'pesaje-1', source_label_id: 'label-1', copias: 2 }],
      station_id: 'station-1',
    };

    await expect(previewPostWeighingReprint(payload)).resolves.toEqual({ preview_digest: 'digest-1' });
    expect(api.post).toHaveBeenCalledWith(
      '/scm/v1/reimpresiones-postpesaje/preview',
      payload,
      { headers: { 'X-Actor-Id': '41' } },
    );
  });

  it('confirma con la misma clave de operación para idempotencia', async () => {
    api.post.mockResolvedValueOnce({ data: { request_id: 'request-1', estado: 'QUEUED' } });
    await confirmPostWeighingReprint({
      operation_id: 'operation-1',
      motivo: 'Etiqueta deteriorada',
      preview_digest: 'digest-1',
    }, 'operation-1');
    expect(api.post).toHaveBeenCalledWith(
      '/scm/v1/reimpresiones-postpesaje/confirmar',
      {
        operation_id: 'operation-1',
        motivo: 'Etiqueta deteriorada',
        preview_digest: 'digest-1',
      },
      { headers: { 'X-Actor-Id': '41', 'Idempotency-Key': 'operation-1' } },
    );
  });

  it('consulta el estado por request_id', async () => {
    api.get.mockResolvedValueOnce({ data: { request_id: 'request-1', estado: 'QUEUED' } });
    await expect(getPostWeighingReprintRequest('request-1')).resolves.toEqual({
      request_id: 'request-1', estado: 'QUEUED',
    });
    expect(api.get).toHaveBeenCalledWith(
      '/scm/v1/reimpresiones-postpesaje/solicitudes/request-1',
      { headers: { 'X-Actor-Id': '41' } },
    );
  });
});
