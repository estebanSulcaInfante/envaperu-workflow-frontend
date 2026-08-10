import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock('../services/api', () => ({
  default: { get: getMock },
}));

import {
  listarSupervisionMangasScm,
  listarSupervisionOtsScm,
  obtenerDetalleSupervisionOtScm,
  obtenerResumenSupervisionOtsScm,
} from '../services/scmProductionObservabilityApi';

describe('contrato frontend de observabilidad de OT', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.localStorage?.setItem('envaperu_scm_actor_id', '7');
    getMock.mockResolvedValue({ data: { items: [] } });
  });

  it('serializa rango, dimensiones, quick filter y cursor sin enviar vacíos', async () => {
    const signal = new AbortController().signal;
    await listarSupervisionOtsScm({
      desde: '2026-08-01',
      hasta: '2026-08-10',
      tipo: 'ARMADO',
      estado_documental: 'PLANIFICADA',
      estado_operativo: 'PAUSADA',
      turno: 'NOCHE',
      recurso: 'CT-01',
      responsable: 'Ana',
      op: 'OP-1',
      orden: 'OA-1',
      ot: 'OT-1',
      color: 'Rojo',
      q: 'alcancía',
      quick: 'PENDIENTES_PESAJE',
      cursor: 'cursor-2',
      limit: 25,
      signal,
      ignored: '',
    });

    expect(getMock).toHaveBeenCalledWith('/scm/v1/observabilidad/ots', {
      headers: { 'X-Actor-Id': '7' },
      params: {
        fecha_desde: '2026-08-01',
        fecha_hasta: '2026-08-10',
        tipo_ot: 'ARMADO',
        estado_documental: 'PLANIFICADA',
        estado_operativo: 'PAUSADA',
        turno: 'NOCHE',
        recurso: 'CT-01',
        responsable: 'Ana',
        op: 'OP-1',
        orden: 'OA-1',
        ot: 'OT-1',
        color: 'Rojo',
        q: 'alcancía',
        quick: 'PENDIENTES_PESAJE',
        cursor: 'cursor-2',
        limit: 25,
      },
      signal,
    });
  });

  it.each([
    'EN_EJECUCION',
    'PAUSADAS',
    'ATRASADAS',
  ])('envía %s como quick filter canónico', async (quick) => {
    await listarSupervisionOtsScm({ quick });

    expect(getMock).toHaveBeenCalledWith(
      '/scm/v1/observabilidad/ots',
      expect.objectContaining({ params: { quick } }),
    );
  });

  it('reutiliza los filtros en resumen y consulta detalle por public_id', async () => {
    await obtenerResumenSupervisionOtsScm({
      desde: '2026-08-10', hasta: '2026-08-10', tipo: 'FABRICACION', rango: 'MES',
      cursor: 'omitido', limit: 25,
    });
    await obtenerDetalleSupervisionOtScm('ot/1');

    expect(getMock).toHaveBeenNthCalledWith(1, '/scm/v1/observabilidad/resumen', {
      headers: { 'X-Actor-Id': '7' },
      params: {
        fecha_desde: '2026-08-10',
        fecha_hasta: '2026-08-10',
        tipo_ot: 'FABRICACION',
        granularidad: 'MES',
      },
      signal: undefined,
    });
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      '/scm/v1/observabilidad/ots/ot%2F1',
      { headers: { 'X-Actor-Id': '7' }, signal: undefined },
    );
  });

  it('consulta mangas globales con c?digo, estado y art?culo sin perder el cursor', async () => {
    const signal = new AbortController().signal;
    await listarSupervisionMangasScm({
      desde: '2026-08-01',
      hasta: '2026-08-10',
      manga: 'MANGA-000001',
      estado_manga: 'PESADA',
      articulo: 'PC-001',
      q: 'carne',
      cursor: 'manga-cursor-2',
      limit: 25,
      signal,
    });

    expect(getMock).toHaveBeenCalledWith('/scm/v1/observabilidad/mangas', {
      headers: { 'X-Actor-Id': '7' },
      params: {
        fecha_desde: '2026-08-01',
        fecha_hasta: '2026-08-10',
        manga: 'MANGA-000001',
        estado_manga: 'PESADA',
        articulo: 'PC-001',
        q: 'carne',
        cursor: 'manga-cursor-2',
        limit: 25,
      },
      signal,
    });
  });
});
