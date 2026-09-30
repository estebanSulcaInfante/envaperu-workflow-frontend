import { describe, expect, it } from 'vitest';
import { warehouseFamilyRows } from '../components/inventoryWarehouseModel';

describe('resumen por almacén', () => {
  it('reúne piezas/WIP de la misma unidad sin sumar saldos UN a KG', () => {
    const base = { almacen_id: 'a', almacen_nombre: 'Piezas', reservado: '1', no_disponible: '0', posiciones: 1 };
    const rows = warehouseFamilyRows([
      { ...base, clase: 'PIEZA_COLOR', unidad: 'KG', fisico: '15', libre: '14' },
      { ...base, clase: 'SUBENSAMBLE_WIP', unidad: 'KG', fisico: '12', libre: '11' },
      { ...base, clase: 'PIEZA_COLOR', unidad: 'UN', fisico: '20', libre: '19' },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.family === 'pieces')).toMatchObject({ fisico: 27, libre: 25, posiciones: 2, unidad: 'KG' });
    expect(rows.find((row) => row.family === 'legacy')).toMatchObject({ fisico: 20, unidad: 'UN' });
  });
  it('no convierte magnitudes ausentes en cero', () => {
    const [row] = warehouseFamilyRows([{ clase: 'PRODUCTO_TERMINADO', unidad: 'UN', fisico: null, libre: null }]);
    expect(row.fisico).toBeNull();
    expect(row.libre).toBeNull();
    expect(row.almacen_nombre).toBe('Sin almacén asignado');
  });
});
