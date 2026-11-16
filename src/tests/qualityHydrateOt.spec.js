import { beforeEach, describe, it, vi, expect } from 'vitest';
import { hydrateQualityJourneyMolds, hydrateQualityOt } from '../components/qualityHydrateOt';
import { obtenerOrdenFabricacionScm } from '../services/scmOtApi';
vi.mock('../services/scmOtApi', () => ({obtenerOrdenFabricacionScm: vi.fn()}));
beforeEach(() => vi.clearAllMocks());
describe('Identidad de pieza para Calidad', () => {
  it('resuelve colores de la misma pieza por la salida de su corrida, sin cruzar corridas por nombres ni sobrescribir el artículo', async () => {
    obtenerOrdenFabricacionScm.mockResolvedValue({molde_id:17,molde:{nombre:'Regaderas'},snapshot_tiempo_ciclo_seg:34,corridas:[
      {id:'azul',salidas:[{articulo_scm_id:4,articulo:{pieza_id:21}}]},
      {id:'verde',salidas:[{articulo_scm_id:9,articulo:{pieza_id:21}}]},
    ]});
    const work=(run,ids)=>({orden_fabricacion_id:'of',corrida_fabricacion_id:run,articulos_salida:ids.map(id=>({id,nombre:'Sin distinguir'}))});
    const result=await hydrateQualityOt({trabajos_color:[work('azul',[4,9]),work('verde',[9])]});
    expect(obtenerOrdenFabricacionScm).toHaveBeenCalledTimes(1);
    expect(result.trabajos_color.map(w=>w.articulos_salida.map(a=>[a.id,a.pieza_id]))).toEqual([[[4,21],[9,undefined]],[[9,21]]]);
    expect(result.trabajos_color.every(w=>w.molde_id===17)).toBe(true);
    expect(result.trabajos_color[0]).toMatchObject({molde_nombre:'Regaderas', snapshot_tiempo_ciclo_seg:34});
  });

  it('resuelve el molde de jornadas resumen por OF una sola vez y conserva identidades homónimas', async () => {
    obtenerOrdenFabricacionScm
      .mockResolvedValueOnce({ molde_id: 'm-1', molde: { nombre: 'Regaderas sólidos' } })
      .mockResolvedValueOnce({ molde_id: 'm-2', molde: { nombre: 'Balde alto' } });
    const work = (id, of, color) => ({ id, estado: 'PAUSADO', color, orden_fabricacion_id: of });
    const ots = [{ public_id: 'ot-277', trabajos_color: [work('a', 'of-1', 'Azure'), work('b', 'of-1', 'Rojo'), work('c', 'of-2', 'Verde')] }];
    const cache = new Map();

    const result = await hydrateQualityJourneyMolds(ots, { cache });
    await hydrateQualityJourneyMolds([...ots, { public_id: 'ot-278', trabajos_color: [work('d', 'of-2', 'Azul')] }], { cache });

    expect(obtenerOrdenFabricacionScm).toHaveBeenCalledTimes(2);
    expect(result[0].trabajos_color.map((item) => item.molde_nombre)).toEqual(['Regaderas sólidos', 'Regaderas sólidos', 'Balde alto']);
    expect(result[0].trabajos_color.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('no descarta la jornada si una OF falla y permite recuperarla en el siguiente intento', async () => {
    obtenerOrdenFabricacionScm
      .mockRejectedValueOnce(new Error('OF temporalmente no disponible'))
      .mockResolvedValueOnce({ molde_id: 'm-1', molde: { nombre: 'Regaderas sólidos' } });
    const ots = [{ public_id: 'ot-277', trabajos_color: [{ id: 'work-1', estado: 'PAUSADO', color: 'Rojo', orden_fabricacion_id: 'of-1' }] }];
    const cache = new Map();

    const first = await hydrateQualityJourneyMolds(ots, { cache });
    const second = await hydrateQualityJourneyMolds(ots, { cache });

    expect(first[0].trabajos_color[0].molde_nombre).toBeUndefined();
    expect(first[0].trabajos_color[0].moldLoadFailed).toBe(true);
    expect(second[0].trabajos_color[0].molde_nombre).toBe('Regaderas sólidos');
    expect(obtenerOrdenFabricacionScm).toHaveBeenCalledTimes(2);
  });
});
