import { beforeEach, describe, expect, it, vi } from 'vitest';

const { putMock } = vi.hoisted(() => ({ putMock: vi.fn() }));

vi.mock('axios', () => ({
  default: {
    create: () => ({
      put: putMock,
    }),
  },
}));

import {
  guardarImagenPiezaColor,
  guardarImagenProducto,
} from '../services/api';

describe('carga de imágenes del catálogo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    putMock.mockResolvedValue({ data: { imagen_url: '/api/imagen' } });
  });

  it.each([
    ['pieza-color', () => guardarImagenPiezaColor('PC 07', new File(['foto'], 'pieza.png', { type: 'image/png' })), '/piezas-color/PC%2007/imagen'],
    ['producto', () => guardarImagenProducto('PT 01', new File(['foto'], 'producto.png', { type: 'image/png' })), '/productos/PT%2001/imagen'],
  ])('envía la imagen de %s como multipart/form-data', async (_entity, upload, path) => {
    await upload();

    expect(putMock).toHaveBeenCalledTimes(1);
    const [actualPath, body, options] = putMock.mock.calls[0];
    expect(actualPath).toBe(path);
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('imagen')).toBeInstanceOf(File);
    expect(options).toEqual({
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  });
});
