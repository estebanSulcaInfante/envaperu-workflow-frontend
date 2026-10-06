import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import ControlAvanceOfTv from './ControlAvanceOfTv';
import { listarAvanceOfTvScm } from '../services/scmProductionObservabilityApi';

vi.mock('../services/scmProductionObservabilityApi', () => ({
  listarAvanceOfTvScm: vi.fn(),
}));

const outputs = Array.from({ length: 9 }, (_, index) => ({
  corrida_id: `goal-${index + 1}`,
  corrida: `AZUL-${index + 1}`,
  pieza_id: index < 5 ? 31 : 42,
  pieza: 'Pieza con el mismo nombre',
  pieza_color_id: `pc-${index + 1}`,
  sku: `PC-SKU-SECRET-${index + 1}`,
  codigo: `PZ-CODE-SECRET-${index < 5 ? 31 : 42}`,
  nombre: `Artículo interno ${index + 1}`,
  color: 'Azul',
  color_hex: '#123456',
  unidad: index === 0 ? 'KG' : index === 1 ? 'UN' : index === 2 ? null : 'KG',
  tipo_meta: index < 2 ? 'OBJETIVO' : null,
  meta: index === 0 ? 4 : index === 1 ? 10 : null,
  avance: index === 0 ? 2 : index === 1 ? 5 : null,
  pendiente: index === 0 ? 2 : index === 1 ? 5 : null,
  porcentaje: index < 2 ? 50 : null,
  peso_fisico_kg: index === 1 ? 1.25 : null,
  estado_avance: index === 0 || index === 1 ? 'EN_AVANCE' : index === 2 ? 'SIN_PESAJES' : 'SIN_META',
}));

const response = {
  as_of: '2026-10-06T04:00:00+00:00',
  visibilidad: { pesaje: true },
  items: [{ of_id: 'of-101', of: 'OF-000101', estado: 'EN_EJECUCION', salidas: outputs }],
};

describe('ControlAvanceOfTv', () => {
  beforeEach(() => listarAvanceOfTvScm.mockResolvedValue(response));
  afterEach(() => vi.clearAllMocks());

  it('renders one OF card, groups by stable piece id, and preserves output metrics without showing item ids', async () => {
    render(<ControlAvanceOfTv />);

    const orderCard = await screen.findByTestId('of-progress-card');
    expect(screen.getAllByTestId('of-progress-card')).toHaveLength(1);
    expect(orderCard).toHaveAttribute('data-of-id', 'of-101');
    expect(within(orderCard).getByRole('heading', { name: 'OF-000101' })).toBeInTheDocument();

    const pieceGroups = within(orderCard).getAllByTestId('piece-progress-group');
    expect(pieceGroups).toHaveLength(2);
    expect(pieceGroups.map((group) => group.getAttribute('data-piece-id'))).toEqual(['31', '42']);
    expect(within(orderCard).getAllByTestId('output-progress-row')).toHaveLength(9);
    expect(within(orderCard).getByText(/Objetivo de color AZUL-1/)).toBeInTheDocument();
    expect(within(orderCard).getByText(/Objetivo de color AZUL-2/)).toBeInTheDocument();

    expect(screen.queryByText(/PC-SKU-SECRET|PZ-CODE-SECRET|goal-[0-9]+|pc-[0-9]+/)).not.toBeInTheDocument();
    expect(screen.getByText(/Última consulta exitosa/)).toBeInTheDocument();
    expect(within(pieceGroups[0]).getAllByText('Pieza con el mismo nombre')).toHaveLength(1);
    expect(within(pieceGroups[1]).getAllByText('Pieza con el mismo nombre')).toHaveLength(1);

    const rows = within(orderCard).getAllByTestId('output-progress-row');
    expect(rows[0]).toHaveTextContent('Meta (kg)');
    expect(rows[0]).toHaveTextContent('4 KG');
    expect(rows[0]).toHaveTextContent('2 KG');
    expect(rows[1]).toHaveTextContent('Meta (un)');
    expect(rows[1]).toHaveTextContent('10 UN');
    expect(rows[1]).toHaveTextContent('5 UN');
    expect(rows[2]).toHaveTextContent('Sin pesajes vigentes');
    expect(rows[2]).toHaveTextContent('-');
    expect(within(orderCard).getAllByRole('progressbar')).toHaveLength(2);
  });

  it('paginates one OF by four outputs, repeats piece headers, and exposes all nine outputs across parts', async () => {
    render(<ControlAvanceOfTv />);
    await screen.findByTestId('of-progress-card');
    fireEvent.click(screen.getByRole('button', { name: 'Modo TV' }));

    expect(await screen.findByText(/Parte 1 de 3/)).toBeInTheDocument();
    expect(screen.getAllByTestId('output-progress-row')).toHaveLength(4);
    expect(screen.getByTestId('of-progress-card')).toHaveAttribute('data-of-id', 'of-101');
    expect(screen.getAllByTestId('piece-progress-group')).toHaveLength(1);

    const seen = new Set(screen.getAllByTestId('output-progress-row').map((row) => row.getAttribute('data-output-key')));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByRole('heading', { name: /Parte 2 de 3.*Continúa/ })).toBeInTheDocument();
    expect(screen.getAllByTestId('output-progress-row')).toHaveLength(4);
    expect(screen.getAllByTestId('piece-progress-group')).toHaveLength(2);
    screen.getAllByTestId('output-progress-row').forEach((row) => seen.add(row.getAttribute('data-output-key')));

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByRole('heading', { name: /Parte 3 de 3/ })).toBeInTheDocument();
    expect(screen.getAllByTestId('output-progress-row')).toHaveLength(1);
    screen.getAllByTestId('output-progress-row').forEach((row) => seen.add(row.getAttribute('data-output-key')));
    expect(seen.size).toBe(9);
  });

  it('keeps last successful data visible after a refresh error', async () => {
    render(<ControlAvanceOfTv />);
    expect(await screen.findAllByTestId('output-progress-row')).toHaveLength(9);
    listarAvanceOfTvScm.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar ahora' }));
    expect(await screen.findByText(/No se pudo actualizar/)).toBeInTheDocument();
    expect(screen.getAllByTestId('output-progress-row')).toHaveLength(9);
  });

  it('sorts OF groups in both directions and preserves the existing no-permission state', async () => {
    const secondOf = { ...response.items[0], of_id: 'of-102', of: 'OF-000102', salidas: outputs.slice(0, 1) };
    listarAvanceOfTvScm.mockResolvedValueOnce({ ...response, items: [secondOf, response.items[0]] });
    render(<ControlAvanceOfTv />);
    await screen.findAllByTestId('of-progress-card');
    expect(screen.getAllByTestId('of-progress-card').map((card) => card.getAttribute('data-of-id'))).toEqual(['of-101', 'of-102']);
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Orden de OF' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Descendente' }));
    expect(screen.getAllByTestId('of-progress-card').map((card) => card.getAttribute('data-of-id'))).toEqual(['of-102', 'of-101']);

    cleanup();
    listarAvanceOfTvScm.mockResolvedValueOnce({
      ...response,
      visibilidad: { pesaje: false, restriccion: 'MANGA_PESAJE_VER requerido para ver avance' },
      items: [{ ...response.items[0], salidas: outputs.map((output) => ({ ...output, avance: null, pendiente: null, porcentaje: null, estado_avance: 'SIN_PERMISO_PESAJE' })) }],
    });
    render(<ControlAvanceOfTv />);
    expect(await screen.findByText(/Tu permiso permite ver OF, pero no los datos de pesaje/)).toBeInTheDocument();
    expect(screen.getAllByTestId('output-progress-row')).toHaveLength(9);
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
  });
});
