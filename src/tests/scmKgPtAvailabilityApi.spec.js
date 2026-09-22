import { describe, expect, it, vi } from 'vitest';
import api from '../services/api';
import {
  consultarDisponibilidadPiezasKg,
  consultarDisponibilidadPt,
  descargarDisponibilidadPtExcel,
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

  it('descarga Excel con el filtro de la consulta actual', async () => {
    api.get.mockResolvedValue({
      data: new Blob(['xlsx']),
      headers: { 'content-disposition': 'attachment; filename="disponibilidad-pt-20260922-1030.xlsx"' },
    });
    const workbook = await descargarDisponibilidadPtExcel({ q: 'PT-01', ubicacion: 'PT-LOC' });
    expect(workbook.blob).toBeInstanceOf(Blob);
    expect(workbook.filename).toBe('disponibilidad-pt-20260922-1030.xlsx');
    expect(api.get).toHaveBeenCalledWith('/scm/v1/disponibilidad/productos-terminados/export.xlsx', expect.objectContaining({
      params: { q: 'PT-01', ubicacion: 'PT-LOC' }, responseType: 'blob',
    }));
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
