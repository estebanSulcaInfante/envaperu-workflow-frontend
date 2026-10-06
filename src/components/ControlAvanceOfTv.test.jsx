import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ControlAvanceOfTv from './ControlAvanceOfTv';
import { listarAvanceOfTvScm } from '../services/scmProductionObservabilityApi';

vi.mock('../services/scmProductionObservabilityApi', () => ({
  listarAvanceOfTvScm: vi.fn(),
}));

const response = {
  as_of: '2026-10-06T04:00:00+00:00',
  visibilidad: { pesaje: true },
  items: [{
    of_id: 'of-2', of: 'OF-000002', estado: 'EN_EJECUCION', salidas: [{
      corrida_id: 'run-2', corrida: 'COLOR-2', sku: 'PC-000002', nombre: 'Base botella',
      color: 'Rojo', color_hex: '#aa2233', unidad: 'KG', tipo_meta: 'ESTANDAR',
      meta: 10, avance: 6, pendiente: 4, porcentaje: 60, peso_fisico_kg: 6,
      estado_avance: 'EN_AVANCE',
    }],
  }, {
    of_id: 'of-1', of: 'OF-000001', estado: 'EN_EJECUCION', salidas: [{
      corrida_id: 'run-1', corrida: 'COLOR-1', sku: 'PC-000001', nombre: 'Cuerpo botella',
      color: 'Azul', color_hex: '#123456', unidad: 'UN', tipo_meta: 'OBJETIVO',
      meta: 100, avance: 70, pendiente: 30, porcentaje: 70, peso_fisico_kg: 8.2,
      estado_avance: 'EN_AVANCE',
    }],
  }],
};

describe('ControlAvanceOfTv', () => {
  beforeEach(() => listarAvanceOfTvScm.mockResolvedValue(response));
  afterEach(() => vi.clearAllMocks());

  it('groups outputs under their OF, exposes weight separately, and keeps last success on refresh error', async () => {
    render(<ControlAvanceOfTv />);

    expect(await screen.findAllByRole('heading', { name: 'OF-000001' })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Avance OF$/);
    expect(screen.getAllByRole('heading', { level: 5 }).map((heading) => heading.textContent)).toEqual(['OF-000001', 'OF-000002']);
    expect(screen.getByText('PC-000001')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Orden de OF' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Descendente' }));
    expect(screen.getAllByRole('heading', { level: 5 }).map((heading) => heading.textContent)).toEqual(['OF-000002', 'OF-000001']);
    expect(screen.getByText((_, element) => element?.tagName === 'P' && element.textContent.trim() === '8.2 kg')).toBeInTheDocument();
    expect(screen.getByText(/Última consulta exitosa/)).not.toHaveTextContent('Sin consulta exitosa');

    listarAvanceOfTvScm.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar ahora' }));
    expect(await screen.findByText(/No se pudo actualizar/)).toBeInTheDocument();
    expect(screen.getByText(/Última consulta exitosa/)).not.toHaveTextContent('Sin consulta exitosa');
    expect(screen.getByText('PC-000001')).toBeInTheDocument();
  });

  it('shows an explicit no-permission state without inventing zero progress', async () => {
    listarAvanceOfTvScm.mockResolvedValueOnce({
      ...response,
      visibilidad: { pesaje: false, restriccion: 'MANGA_PESAJE_VER requerido para ver avance' },
      items: [{ ...response.items[0], salidas: [{ ...response.items[0].salidas[0], avance: null, porcentaje: null, estado_avance: 'SIN_PERMISO_PESAJE' }] }],
    });
    render(<ControlAvanceOfTv />);
    expect(await screen.findByText(/Tu permiso permite ver OF, pero no los datos de pesaje/)).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
