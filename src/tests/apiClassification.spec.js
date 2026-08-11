import { beforeEach, describe, expect, it, vi } from 'vitest';

const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }));

vi.mock('axios', () => ({
  default: {
    create: () => ({
      post: postMock,
    }),
  },
}));

import { asociarFamiliaALinea, crearFamiliaEnLinea } from '../services/api';

describe('clasificación contextual', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postMock.mockResolvedValue({ data: { familia: { id: 8, nombre: 'COCINA' } } });
  });

  it('vincula una Familia existente con el contrato familia_id', async () => {
    await asociarFamiliaALinea(3, 8);

    expect(postMock).toHaveBeenCalledWith('/catalogo/lineas/3/familias', {
      familia_id: 8,
    });
  });

  it('crea una Familia nueva con el contrato anidado familia', async () => {
    await crearFamiliaEnLinea(3, { nombre: 'COCINA' });

    expect(postMock).toHaveBeenCalledWith('/catalogo/lineas/3/familias', {
      familia: { nombre: 'COCINA' },
    });
  });
});
