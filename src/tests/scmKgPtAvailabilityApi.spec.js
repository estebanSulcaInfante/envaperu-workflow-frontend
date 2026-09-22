import { describe, expect, it, vi } from 'vitest';
import api from '../services/api';
import {
  consultarDisponibilidadPiezasKg,
  consultarDisponibilidadPt,
  registrarMovimientoPtManual,
} from '../services/scmKgPtAvailabilityApi';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('../services/scmEngineeringApi', () => ({ obtenerActorScm: () => 7 }));

describe('contrato de disponibilidad KG/PT', () => {
  it('consulta el endpoint KG con filtros y actor', async () => {
    api.get.mockResolvedValue({ data: { items: [] } });
    await consultarDisponibilidadPiezasKg({ q: 'PC-01', ubicacion: 'PROD' });
    expect(api.get).toHaveBeenCalledWith('/scm/v1/disponibilidad/piezas', expect.objectContaining({
      params: { q: 'PC-01', ubicacion: 'PROD' },
    }));
  });

  it('consulta PT sin inventar saldo cuando la respuesta viene vacía', async () => {
    api.get.mockResolvedValue({ data: { items: [] } });
    const payload = await consultarDisponibilidadPt();
    expect(payload.items).toEqual([]);
  });

  it('envía fecha operativa y clave idempotente al Kardex PT manual', async () => {
    api.post.mockResolvedValue({ data: { movement: { id: 'm1' } } });
    await registrarMovimientoPtManual({
      tipo: 'ENTRADA', cantidad: 3, fecha_operativa: '2026-09-19', motivo: 'Acta', referencia: 'ACTA-PT-01',
    });
    expect(api.post).toHaveBeenCalledWith(
      '/scm/v1/inventario/pt/movimientos',
      expect.objectContaining({ fecha_operativa: '2026-09-19', referencia: 'ACTA-PT-01' }),
      expect.objectContaining({ headers: expect.objectContaining({ 'X-Actor-Id': '7', 'Idempotency-Key': expect.any(String) }) }),
    );
  });
});
