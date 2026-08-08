import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock('../services/api', () => ({
  default: { post: postMock, get: getMock, patch: vi.fn() },
}));

vi.mock('../services/scmEngineeringApi', () => ({
  obtenerActorScm: () => 42,
}));

import {
  cambiarEstadoTrabajoColorScm,
  crearOtFabricacionScm,
  crearTrabajoColorScm,
  listarOtScm,
  reasignarMangasTrabajoColorScm,
} from '../services/scmOtApi';

const idempotentHeaders = {
  headers: {
    'X-Actor-Id': '42',
    'Idempotency-Key': expect.any(String),
  },
};

describe('contratos OT de máquina y Trabajo de color', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockResolvedValue({ data: { items: [] } });
    postMock.mockResolvedValue({ data: { ok: true } });
  });

  it('envía fecha, turno y máquina al consultar el tablero de OT', async () => {
    await listarOtScm(undefined, 'FABRICACION', {
      fecha_operativa: '2026-08-10',
      turno: 'DIA',
      maquina_id: 4,
    });

    expect(getMock).toHaveBeenCalledWith('/scm/v1/ots', {
      params: {
        tipo_ot: 'FABRICACION',
        fecha_operativa: '2026-08-10',
        turno: 'DIA',
        maquina_id: 4,
      },
      headers: { 'X-Actor-Id': '42' },
    });
  });

  it('omite filtros vacíos sin alterar los parámetros legacy', async () => {
    await listarOtScm('of-1', 'FABRICACION', {
      fecha_operativa: '', turno: '', maquina_id: '',
    });

    expect(getMock).toHaveBeenCalledWith('/scm/v1/ots', {
      params: {
        orden_operacion_id: 'of-1',
        tipo_ot: 'FABRICACION',
      },
      headers: { 'X-Actor-Id': '42' },
    });
  });

  it('crea la cabecera en el endpoint independiente de OF/corrida', async () => {
    const payload = {
      maquina_id: 4,
      fecha_operativa: '2026-08-10',
      turno: 'DIA',
    };
    await crearOtFabricacionScm(payload);

    expect(postMock).toHaveBeenCalledWith(
      '/scm/v1/ots/fabricacion', payload, idempotentHeaders,
    );
  });

  it('agrega y transiciona un Trabajo de color debajo de la OT', async () => {
    const payload = {
      corrida_fabricacion_id: 'run-1',
      maquinista_id: 8,
      asignaciones: [{ plan_linea_id: 11, cantidad_un: 100 }],
    };
    await crearTrabajoColorScm('ot-1', payload);
    await cambiarEstadoTrabajoColorScm('work-1', 'pausar', 3, 'Cambio programado');

    expect(postMock).toHaveBeenNthCalledWith(
      1, '/scm/v1/ots/ot-1/trabajos-color', payload, idempotentHeaders,
    );
    expect(postMock).toHaveBeenNthCalledWith(
      2,
      '/scm/v1/trabajos-color/work-1/pausar',
      { version: 3, motivo: 'Cambio programado' },
      idempotentHeaders,
    );
  });

  it('aísla la reasignación masiva y conserva los ids del subconjunto', async () => {
    const payload = {
      trabajador_id: 9,
      motivo: 'Relevo de turno',
      version: 4,
      manga_ids: ['manga-1', 'manga-2'],
    };
    await reasignarMangasTrabajoColorScm('work-1', payload);

    expect(postMock).toHaveBeenCalledWith(
      '/scm/v1/trabajos-color/work-1/asignaciones', payload, idempotentHeaders,
    );
  });
});
