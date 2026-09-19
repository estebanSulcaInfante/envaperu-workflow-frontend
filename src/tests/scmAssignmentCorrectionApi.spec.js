import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../services/api';
import {
  corregirAsignacionTrabajoMangaScm,
  previsualizarCorreccionAsignacionMangaScm,
} from '../services/scmOtApi';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('../services/scmEngineeringApi', () => ({
  obtenerActorScm: () => 42,
}));

describe('API de corrección auditada de asignación manga', () => {
  beforeEach(() => vi.clearAllMocks());

  it('previsualiza destino, asignación y bloqueos sin mutar', async () => {
    api.get.mockResolvedValue({ data: { puede_aplicar: false, bloqueos: [{ code: 'KG_RESERVA_ACTIVA' }] } });

    await previsualizarCorreccionAsignacionMangaScm('manga-1', 'trabajo-2', 'asig-2');

    expect(api.get).toHaveBeenCalledWith(
      '/scm/v1/mangas/manga-1/correccion-asignacion/preview',
      {
        params: {
          destino_trabajo_ot_id: 'trabajo-2',
          destino_asignacion_id: 'asig-2',
        },
        headers: { 'X-Actor-Id': '42' },
      },
    );
  });

  it('envía versión, motivo e idempotencia para aplicar una sola vez', async () => {
    api.post.mockResolvedValue({ data: { stock_kg: { movimientos_creados: 0 } } });
    const operationId = 'operation-1';

    await corregirAsignacionTrabajoMangaScm('manga-1', {
      destino_trabajo_ot_id: 'trabajo-2',
      destino_asignacion_id: 'asig-2',
      version: 3,
      motivo: 'Trabajo de color equivocado',
    }, operationId);

    expect(api.post).toHaveBeenCalledWith(
      '/scm/v1/mangas/manga-1/correcciones-asignacion',
      expect.objectContaining({ version: 3, motivo: 'Trabajo de color equivocado' }),
      { headers: { 'X-Actor-Id': '42', 'Idempotency-Key': operationId } },
    );
  });
});
