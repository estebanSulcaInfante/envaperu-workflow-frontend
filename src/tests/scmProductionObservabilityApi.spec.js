import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock('../services/api', () => ({
  default: { get: getMock },
}));

import {
  listarDocumentosPendientesSupervisionScm,
  listarSupervisionMangasScm,
  listarSupervisionOtsScm,
  obtenerDetalleSupervisionOtScm,
  obtenerResumenSupervisionOtsScm,
  listarAvanceOfScm,
  listarProduccionHistoricaScm,
  exportarProduccionHistoricaScm,
  listarMangasHistoricoScm,
  obtenerDetalleMangaScm,
  listarExploradorMangasScm,
  exportarExploradorMangasScm,
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

  it('consulta documentos liberados que todavia no tienen OT', async () => {
    await listarDocumentosPendientesSupervisionScm({
      desde: '2026-08-01', hasta: '2026-08-31', q: 'OF-000002', limit: 25,
    });

    expect(getMock).toHaveBeenCalledWith(
      '/scm/v1/observabilidad/documentos-pendientes',
      expect.objectContaining({
        params: expect.objectContaining({
          fecha_desde: '2026-08-01',
          fecha_hasta: '2026-08-31',
          q: 'OF-000002',
          limit: 25,
        }),
      }),
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

  it('consulta el explorador de Fabricación con fecha operativa y exporta el modo elegido', async () => {
    const signal = new AbortController().signal;
    await listarExploradorMangasScm({ desde: '2026-08-01', hasta: '2026-08-10', q: 'M-01', estado: 'PESADA', signal });
    expect(getMock).toHaveBeenCalledWith('/scm/v1/observabilidad/mangas-fabricacion', expect.objectContaining({
      params: expect.objectContaining({ tipo_ot: 'FABRICACION', fecha_desde: '2026-08-01', fecha_hasta: '2026-08-10', q: 'M-01', estado_manga: 'PESADA' }),
      signal,
    }));
    await exportarExploradorMangasScm({ desde: '2026-08-01' }, 'DETALLADO');
    expect(getMock).toHaveBeenCalledWith('/scm/v1/observabilidad/mangas-fabricacion/export.xlsx', expect.objectContaining({
      params: expect.objectContaining({ tipo_ot: 'FABRICACION', vista: 'DETALLADO' }), responseType: 'blob',
    }));
  });

  it('serializa el criterio de fecha de OT o pesaje final también para exportación', async () => {
    await listarExploradorMangasScm({ fechaTipo: 'PESAJE_FINAL', desde: '2026-08-10', hasta: '2026-08-12' });
    expect(getMock).toHaveBeenCalledWith('/scm/v1/observabilidad/mangas-fabricacion', expect.objectContaining({
      params: expect.objectContaining({ fecha_tipo: 'PESAJE_FINAL', fecha_desde: '2026-08-10', fecha_hasta: '2026-08-12' }),
    }));
    await exportarExploradorMangasScm({ fechaTipo: 'PESAJE_FINAL', desde: '2026-08-10' }, 'RESUMIDO');
    expect(getMock).toHaveBeenCalledWith('/scm/v1/observabilidad/mangas-fabricacion/export.xlsx', expect.objectContaining({
      params: expect.objectContaining({ fecha_tipo: 'PESAJE_FINAL', fecha_desde: '2026-08-10', vista: 'RESUMIDO' }),
    }));
  });

  it('pasa AbortSignal a Axios sin serializarlo como filtro del reporte OF', async () => {
    const signal = new AbortController().signal;
    await listarAvanceOfScm({ signal, q: 'OF-1' });
    expect(getMock).toHaveBeenCalledWith('/scm/v1/observabilidad/avance-of', {
      headers: { 'X-Actor-Id': '7' }, params: { q: 'OF-1' }, signal,
    });
  });

  it('no convierte un alcance OF explícitamente vacío en una consulta global', async () => {
    const payload = await listarAvanceOfScm({ ofIds: [] });

    expect(payload).toEqual({ items: [], visibilidad: {}, as_of: null });
    expect(getMock).not.toHaveBeenCalled();
  });

  it('preserva arrays vacíos explícitos del histórico y excluye signal', async () => {
    const signal = new AbortController().signal;
    await listarProduccionHistoricaScm({
      desde: '2026-09-01', hasta: '2026-09-26', agrupaciones: [], medidas: [], signal,
    });
    expect(getMock).toHaveBeenCalledWith('/scm/v1/observabilidad/produccion-historica', {
      headers: { 'X-Actor-Id': '7' },
      params: {
        desde: '2026-09-01', hasta: '2026-09-26', agrupaciones: '', medidas: '', incluir_jerarquia: 1,
      },
      signal,
    });
  });

  it('exporta con los filtros aplicados, incluidos agrupadores explícitamente vacíos', async () => {
    await exportarProduccionHistoricaScm({ desde: '2026-09-01', hasta: '2026-09-26', agrupaciones: [], medidas: ['PESO_KG'] });
    expect(getMock).toHaveBeenCalledWith('/scm/v1/observabilidad/produccion-historica/export.xlsx', {
      headers: { 'X-Actor-Id': '7' },
      params: { desde: '2026-09-01', hasta: '2026-09-26', agrupaciones: '', medidas: 'PESO_KG' },
      responseType: 'blob',
    });
  });

  it('pasa AbortSignal de exportación sin serializarlo como filtro', async () => {
    const signal = new AbortController().signal;
    await exportarProduccionHistoricaScm({ medidas: ['MANGAS'], signal });
    expect(getMock).toHaveBeenCalledWith('/scm/v1/observabilidad/produccion-historica/export.xlsx', expect.objectContaining({
      params: { medidas: 'MANGAS' }, signal,
    }));
  });

  it('consulta mangas con grupo JSON exacto y conserva señal de cancelación', async () => {
    const signal = new AbortController().signal;
    await listarMangasHistoricoScm(
      { desde: '2026-09-01', hasta: '2026-09-26', agrupaciones: ['OF', 'ARTICULO'], medidas: ['PESO_KG'], signal },
      [{ dimension: 'OF', value: 'OF-1' }],
    );
    expect(getMock).toHaveBeenCalledWith('/scm/v1/observabilidad/produccion-historica/mangas', expect.objectContaining({
      params: expect.objectContaining({ grupo: '[{"dimension":"OF","value":"OF-1"}]' }), signal,
    }));
  });

  it('obtiene la ficha por identidad pública sin enviar filtros de reporte', async () => {
    const signal = new AbortController().signal;
    await obtenerDetalleMangaScm('manga-publica', { signal });
    expect(getMock).toHaveBeenCalledWith('/scm/v1/observabilidad/mangas/manga-publica', {
      headers: { 'X-Actor-Id': '7' }, signal,
    });
  });
});
