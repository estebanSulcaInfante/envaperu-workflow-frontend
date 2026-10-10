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
  const initialViewportWidth = window.innerWidth;
  beforeEach(() => listarAvanceOfTvScm.mockResolvedValue(response));
  afterEach(() => {
    vi.clearAllMocks();
    window.innerWidth = initialViewportWidth;
  });

  it('renders one card per canonical group, shows color once, and keeps multipiece outputs together', async () => {
    listarAvanceOfTvScm.mockResolvedValueOnce({
      as_of: response.as_of,
      visibilidad: { pesaje: true },
      items: ['a', 'b'].map((suffix, index) => ({
        group_id: `of-1|ot-${suffix}|corrida-${suffix}|ML-1|${index + 1}`,
        identity: { identity_status: 'COMPLETA', identity_issues: [] },
        of_id: 'of-1', of: 'OF-0001', estado: 'EN_EJECUCION',
        ot_id: `ot-${suffix}`, ot: `OT-${suffix}`, corrida_id: `corrida-${suffix}`,
        corrida: 'Mismo nombre visual', molde_id: 'ML-1', molde: { codigo: 'ML-1', nombre: 'Molde común' },
        color_id: index + 1, color: 'Azul', color_hex: '#123456',
        salidas: outputs.slice(0, 2).map((output, outputIndex) => ({
          ...output, corrida_id: `corrida-${suffix}`, pieza_id: outputIndex + 1,
          pieza: `Pieza ${outputIndex + 1}`, porcentaje: 50, avance: 1, pendiente: 1,
          estado_avance: 'EN_AVANCE',
        })),
      })),
    });

    render(<ControlAvanceOfTv />);
    const cards = await screen.findAllByTestId('of-progress-card');
    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.getAttribute('data-group-id'))).toEqual([
      'of-1|ot-a|corrida-a|ML-1|1',
      'of-1|ot-b|corrida-b|ML-1|2',
    ]);
    cards.forEach((card) => {
      expect(within(card).getByTestId('group-color-swatch')).toBeInTheDocument();
      expect(within(card).getAllByTestId('output-progress-row')).toHaveLength(2);
      expect(within(card).getAllByText('Azul')).toHaveLength(1);
    });
  });

  it('keys normal-view canonical cards by group_id and renders transparent semantics once', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      listarAvanceOfTvScm.mockResolvedValueOnce({
        ...response,
        items: [
          {
            group_id: 'of-shared|ot-a|corrida-a|ML-1|1', identity: { identity_status: 'COMPLETA', identity_issues: [] },
            of_id: 'of-shared', of: 'OF-SHARED', estado: 'EN_EJECUCION', ot: 'OT-A', corrida: 'C-A',
            molde: { codigo: 'ML-1', nombre: 'Molde 1' }, color: 'TRANSPARENTE TRANSPARENTE', color_hex: null,
            salidas: [{ ...outputs[0], corrida_id: 'corrida-a', pieza_id: 1, pieza: 'Pieza A', porcentaje: null, estado_avance: 'SIN_META' }],
          },
          {
            group_id: 'of-shared|ot-b|corrida-b|ML-1|2', identity: { identity_status: 'COMPLETA', identity_issues: [] },
            of_id: 'of-shared', of: 'OF-SHARED', estado: 'EN_EJECUCION', ot: 'OT-B', corrida: 'C-B',
            molde: { codigo: 'ML-1', nombre: 'Molde 1' }, color: 'Rojo', color_hex: null,
            salidas: [{ ...outputs[0], corrida_id: 'corrida-b', pieza_id: 2, pieza: 'Pieza B', porcentaje: null, estado_avance: 'SIN_META' }],
          },
        ],
      });
      render(<ControlAvanceOfTv />);
      const cards = await screen.findAllByTestId('of-progress-card');
      expect(cards).toHaveLength(2);
      expect(cards.map((card) => card.getAttribute('data-group-id'))).toEqual([
        'of-shared|ot-a|corrida-a|ML-1|1',
        'of-shared|ot-b|corrida-b|ML-1|2',
      ]);
      expect(within(cards[0]).getByText('Transparente')).toBeInTheDocument();
      expect(within(cards[0]).getByTestId('group-color-swatch')).toHaveAttribute('data-color-kind', 'transparent');
      expect(within(cards[0]).queryByText(/muestra neutral/)).not.toBeInTheDocument();
      expect(within(cards[1]).getByText('Rojo')).toBeInTheDocument();
      expect(within(cards[1]).getByText(/muestra neutral/)).toBeInTheDocument();
      expect(consoleError.mock.calls.some(([message]) => String(message).includes('Encountered two children with the same key'))).toBe(false);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('does not render mold identity when the server redacts OF visibility', async () => {
    listarAvanceOfTvScm.mockResolvedValueOnce({
      ...response,
      items: [{
        group_id: 'tvgrp-opaque-authority',
        identity: { identity_status: 'COMPLETA', identity_issues: [] },
        of_id: 'of-hidden', of: 'OF-HIDDEN', estado: 'EN_EJECUCION',
        ot: 'OT-HIDDEN', corrida: 'C-HIDDEN', color: 'Azul', color_hex: null,
        salidas: [{ ...outputs[0], corrida_id: 'corrida-hidden', pieza_id: 1, pieza: 'Pieza oculta' }],
      }],
    });

    render(<ControlAvanceOfTv />);

    const card = await screen.findByTestId('of-progress-card');
    expect(card).toHaveAttribute('data-group-id', 'tvgrp-opaque-authority');
    expect(within(card).queryByText(/Molde/)).not.toBeInTheDocument();
    expect(within(card).queryByText(/Molde sin identificar/)).not.toBeInTheDocument();
  });

  it('paginates canonical group ids exactly once in TV mode', async () => {
    const groups = Array.from({ length: 3 }, (_, index) => ({
      group_id: `of-${index + 1}|ot-${index + 1}|corrida-${index + 1}|ML-1|${index + 1}`,
      identity: { identity_status: 'COMPLETA', identity_issues: [] },
      of_id: `of-${index + 1}`, of: `OF-${index + 1}`, estado: 'EN_EJECUCION',
      ot_id: `ot-${index + 1}`, ot: `OT-${index + 1}`, corrida_id: `corrida-${index + 1}`,
      corrida: `C-${index + 1}`, molde_id: 'ML-1', molde: { codigo: 'ML-1', nombre: 'Molde 1' },
      color_id: index + 1, color: `Color ${index + 1}`, color_hex: null,
      salidas: [{ ...outputs[0], corrida_id: `corrida-${index + 1}`, pieza_id: index + 1, pieza: `Pieza ${index + 1}`, porcentaje: null, estado_avance: 'SIN_META' }],
    }));
    listarAvanceOfTvScm.mockResolvedValueOnce({ ...response, items: groups });
    window.innerWidth = 1366;

    render(<ControlAvanceOfTv />);
    await screen.findAllByTestId('of-progress-card');
    fireEvent.click(screen.getByRole('button', { name: 'Modo TV' }));

    const seen = new Set();
    for (let page = 0; page < 2; page += 1) {
      screen.getAllByTestId('of-progress-card').forEach((card) => seen.add(card.getAttribute('data-group-id')));
      fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    }
    screen.getAllByTestId('of-progress-card').forEach((card) => seen.add(card.getAttribute('data-group-id')));
    expect(seen).toEqual(new Set(groups.map((group) => group.group_id)));
  });

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
    expect(within(orderCard).queryByText(/Objetivo de color/)).not.toBeInTheDocument();

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
    expect(await screen.findByText(/Parte 2 de 3/)).toBeInTheDocument();
    expect(screen.getAllByTestId('output-progress-row')).toHaveLength(4);
    expect(screen.getAllByTestId('piece-progress-group')).toHaveLength(2);
    screen.getAllByTestId('output-progress-row').forEach((row) => seen.add(row.getAttribute('data-output-key')));

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByText(/Parte 3 de 3/)).toBeInTheDocument();
    expect(screen.getAllByTestId('output-progress-row')).toHaveLength(1);
    screen.getAllByTestId('output-progress-row').forEach((row) => seen.add(row.getAttribute('data-output-key')));
    expect(seen.size).toBe(9);
  });

  it('keeps seven colors for one stable piece together on a single TV part', async () => {
    const sevenColors = outputs.slice(0, 7).map((output, index) => ({
      ...output,
      pieza_id: 31,
      pieza: 'Pieza con siete colores',
      corrida_id: `seven-goal-${index + 1}`,
      corrida: `COLOR-${index + 1}`,
      pieza_color_id: `seven-pc-${index + 1}`,
    }));
    listarAvanceOfTvScm.mockResolvedValueOnce({
      ...response,
      items: [{ ...response.items[0], salidas: sevenColors }],
    });
    render(<ControlAvanceOfTv />);
    await screen.findByTestId('of-progress-card');
    fireEvent.click(screen.getByRole('button', { name: 'Modo TV' }));

    expect(await screen.findByText(/Parte 1 de 1/)).toBeInTheDocument();
    expect(screen.getAllByTestId('output-progress-row')).toHaveLength(7);
    expect(screen.getAllByTestId('piece-progress-group')).toHaveLength(1);
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

  it('uses two normal columns at desktop widths and one at mobile widths', async () => {
    window.innerWidth = 1366;
    const secondOf = { ...response.items[0], of_id: 'of-202', of: 'OF-000202', salidas: outputs.slice(0, 2) };
    listarAvanceOfTvScm.mockResolvedValueOnce({ ...response, items: [response.items[0], secondOf] });
    render(<ControlAvanceOfTv />);
    await screen.findAllByTestId('of-progress-card');
    expect(screen.getByTestId('of-progress-layout')).toHaveAttribute('data-columns', '2');

    window.innerWidth = 390;
    fireEvent(window, new Event('resize'));
    expect(await screen.findByTestId('of-progress-layout')).toHaveAttribute('data-columns', '1');
  });

  it('pairs TV parts from different OFs and visits every output once, then adapts to mobile width', async () => {
    const makeOrder = (id, count, pieceIds) => ({
      of_id: id,
      of: `OF-${id}`,
      estado: 'EN_EJECUCION',
      salidas: Array.from({ length: count }, (_, index) => ({
        ...outputs[index % outputs.length],
        corrida_id: `${id}-goal-${index + 1}`,
        corrida: `COLOR-${id}-${index + 1}`,
        pieza_id: pieceIds[index],
        pieza_color_id: `${id}-pc-${index + 1}`,
        pieza: `Pieza ${pieceIds[index]}`,
      })),
    });
    const orders = [
      makeOrder('of-101', 9, [31, 31, 31, 31, 31, 42, 42, 42, 42]),
      makeOrder('of-202', 7, Array(7).fill(51)),
      makeOrder('of-303', 4, [61, 62, 63, 64]),
    ];
    window.innerWidth = 1366;
    listarAvanceOfTvScm.mockResolvedValueOnce({ ...response, items: orders });
    render(<ControlAvanceOfTv />);
    await screen.findAllByTestId('of-progress-card');
    fireEvent.click(screen.getByRole('button', { name: 'Modo TV' }));

    const firstCards = await screen.findAllByTestId('of-progress-card');
    expect(firstCards).toHaveLength(2);
    expect(new Set(firstCards.map((card) => card.getAttribute('data-of-id'))).size).toBe(2);
    const seen = new Set(screen.getAllByTestId('output-progress-row').map((row) => row.getAttribute('data-output-key')));

    const visitedOutputKeys = [...seen];
    for (let page = 1; page < 3; page += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
      const cards = await screen.findAllByTestId('of-progress-card');
      expect(new Set(cards.map((card) => card.getAttribute('data-of-id'))).size).toBe(cards.length);
      screen.getAllByTestId('output-progress-row').forEach((row) => {
        const key = row.getAttribute('data-output-key');
        visitedOutputKeys.push(key);
        seen.add(key);
      });
    }
    expect(visitedOutputKeys).toHaveLength(20);
    expect(seen.size).toBe(20);

    window.innerWidth = 390;
    fireEvent(window, new Event('resize'));
    expect(await screen.findAllByTestId('of-progress-card')).toHaveLength(1);
    expect(screen.getAllByTestId('output-progress-row').length).toBeGreaterThan(0);
  });
});
