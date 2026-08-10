import { describe, expect, it } from 'vitest';

import { isoDateInLima } from '../utils/limaDate';

describe('fecha operativa de Lima', () => {
  it('conserva el día local a las 20:00 aunque UTC ya esté en el día siguiente', () => {
    expect(isoDateInLima(new Date('2026-08-10T01:00:00.000Z'))).toBe('2026-08-09');
  });
});
