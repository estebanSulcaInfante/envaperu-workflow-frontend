import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock('axios', () => ({
  default: {
    create: () => ({
      get: getMock,
    }),
  },
}));

import { validarOrdenPrereq } from '../services/api';

describe('validarOrdenPrereq', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockResolvedValue({ data: { valido: true } });
  });

  it('conserva la firma legacy molde + colores', async () => {
    await validarOrdenPrereq('ML-000001', [3, 5]);

    expect(getMock).toHaveBeenCalledWith('/validar-orden-prereq', {
      params: { molde_id: 'ML-000001', color_ids: '3,5' },
    });
  });

  it('envía el contexto completo y omite valores vacíos', async () => {
    await validarOrdenPrereq({
      moldeId: 'ML-000002',
      colorIds: [7, '', null],
      productoSku: 'PT-000010',
      maquinaId: 4,
      numeroOp: '',
    });

    expect(getMock).toHaveBeenCalledWith('/validar-orden-prereq', {
      params: {
        molde_id: 'ML-000002',
        color_ids: '7',
        producto_sku: 'PT-000010',
        maquina_id: 4,
      },
    });
  });
});
