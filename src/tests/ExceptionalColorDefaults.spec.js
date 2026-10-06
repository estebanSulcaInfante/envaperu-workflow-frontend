import { describe, expect, it } from 'vitest';
import { exceptionalColorIds } from '../components/exceptionalColorDefaults';

describe('exceptional color candidates', () => {
  it('deduplicates active variants across active mold pieces, excluding inactive colors', () => {
    expect(exceptionalColorIds({ formas: [
      { variantes: [{ color_produccion_id: 1 }, { color_produccion_id: '1' }, { color_produccion_id: 2, activo: false }, { color_produccion_id: 3 }] },
      { activo: false, variantes: [{ color_produccion_id: 4 }] },
      { variantes: [{ color_produccion_id: 1 }, { color_produccion_id: 5 }] },
    ] }, [{ id: 3, activo: false }])).toEqual(['1', '5']);
  });
  it('returns no candidates for empty or inactive molds', () => {
    expect(exceptionalColorIds(null)).toEqual([]);
    expect(exceptionalColorIds({ formas: [] })).toEqual([]);
    expect(exceptionalColorIds({ activo: false, formas: [{ variantes: [{ color_produccion_id: 1 }] }] })).toEqual([]);
  });
});
