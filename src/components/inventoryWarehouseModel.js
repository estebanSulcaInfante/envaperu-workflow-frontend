export const WAREHOUSE_FAMILIES = {
  pieces: 'Piezas y WIP · KG', materials: 'Materias primas · KG',
  finished: 'Producto terminado · UN', legacy: 'Piezas y WIP · UN anterior',
};
export const inventoryTimestamp = (value) => {
  if (!value) return '—';
  const utc = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`;
  const date = new Date(utc);
  return Number.isNaN(date.getTime()) ? 'Fecha no informada' : `${date.toLocaleString('es-PE', { timeZone: 'America/Lima' })} (Lima)`;
};
const finite = (value) => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const familyOf = (row) => {
  if (['PIEZA_COLOR', 'SUBENSAMBLE_WIP'].includes(row.clase)) return row.unidad === 'KG' ? 'pieces' : 'legacy';
  if (['MATERIA_PRIMA', 'COLORANTE'].includes(row.clase)) return 'materials';
  if (row.clase === 'PRODUCTO_TERMINADO') return 'finished';
  return row.clase || 'other';
};
export function warehouseFamilyRows(families = []) {
  const groups = new Map();
  for (const item of families) {
    const family = familyOf(item);
    const key = `${item.almacen_id || 'SIN_ALMACEN'}:${family}:${item.unidad}`;
    if (!groups.has(key)) groups.set(key, {
      ...item, key, family, label: WAREHOUSE_FAMILIES[family] || String(item.clase).replaceAll('_', ' '),
      almacen_nombre: item.almacen_nombre || 'Sin almacén asignado',
      fisico: 0, reservado: 0, no_disponible: 0, libre: 0, posiciones: 0,
    });
    const row = groups.get(key);
    for (const field of ['fisico', 'reservado', 'no_disponible', 'libre', 'posiciones']) {
      const amount = finite(item[field]);
      row[field] = row[field] == null || amount == null ? null : row[field] + amount;
    }
  }
  return [...groups.values()];
}
