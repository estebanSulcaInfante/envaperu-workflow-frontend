import { describe, expect, it } from 'vitest';
import { matchesOmniSearch, uniqueOptions } from '../utils/tableSearch';

describe('omnibúsqueda de tablas', () => {
  const row = {
    codigo: 'OP-0041',
    maquina: { codigo: 'HT-380A' },
    salidas: [
      { pieza: 'Base de organizador', color: 'Transparente' },
    ],
  };

  it('busca en objetos y colecciones anidadas sin depender de tildes o mayúsculas', () => {
    expect(matchesOmniSearch(row, 'organizador')).toBe(true);
    expect(matchesOmniSearch(row, 'TRANSPARENTE')).toBe(true);
    expect(matchesOmniSearch({ nombre: 'Máquina principal' }, 'maquina')).toBe(true);
    expect(matchesOmniSearch(row, 'inyección')).toBe(false);
  });

  it('permite limitar la búsqueda a columnas explícitas', () => {
    expect(matchesOmniSearch(row, 'HT-380A', ['codigo'])).toBe(false);
    expect(matchesOmniSearch(row, 'OP-0041', ['codigo'])).toBe(true);
  });

  it('genera opciones únicas y ordenadas para filtros', () => {
    expect(uniqueOptions([
      { estado: 'PENDIENTE' },
      { estado: 'LIBERADO' },
      { estado: 'PENDIENTE' },
    ], 'estado')).toEqual(['LIBERADO', 'PENDIENTE']);
  });
});
