import { beforeEach, describe, expect, it, vi } from 'vitest';

const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }));

vi.mock('../services/api', () => ({
  default: { post: postMock },
}));
vi.mock('../services/scmEngineeringApi', () => ({
  obtenerActorScm: () => 8,
}));

import { confirmarRecepcionMangaScm } from '../services/scmWarehouseApi';

describe('cliente de recepción KG', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postMock.mockResolvedValue({ data: { ok: true } });
  });

  it('usa la clave de intención recibida y no genera una nueva al confirmar', async () => {
    const payload = { label_id: 'label-1', expected_weighing_source: { projection_sha256: 'hash' } };
    await confirmarRecepcionMangaScm(payload, 'idem-stable-1');

    expect(postMock).toHaveBeenCalledWith(
      '/scm/v1/recepcion-mangas/confirmar',
      payload,
      { headers: { 'X-Actor-Id': '8', 'Idempotency-Key': 'idem-stable-1' } },
    );
  });
});
