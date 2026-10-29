import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import ControlAvanceOfTv, {
  calculateTvPageBudget,
  estimateTvPartHeight,
  packTvPages,
  packTvRows,
  splitTvLanes,
} from './ControlAvanceOfTv';
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

  it('muestra medido con dos decimales y separa finalizados de proceso abierto', async () => {
    listarAvanceOfTvScm.mockResolvedValueOnce({
      ...response,
      items: [{
        ...response.items[0],
        salidas: [{
          ...outputs[0], unidad: 'KG', meta: 250, avance: 91.7, pendiente: 158.3,
          porcentaje: 36.68, finalizados_kg: 90.6, en_proceso_kg: 1.1,
          avance_medido_kg: 91.7, pendientes_sin_peso: 1, estado_avance: 'INCOMPLETO',
        }],
      }],
    });

    render(<ControlAvanceOfTv />);

    const row = await screen.findByTestId('output-progress-row');
    expect(row).toHaveTextContent('Avance91.70 KG');
    expect(row).toHaveTextContent('Meta (kg)250.00 KG');
    expect(row).toHaveTextContent('Finalizados: 90.60 kg · En proceso: 1.10 kg');
    expect(row).toHaveTextContent('Pendientes sin peso: 1');
    expect(row).toHaveTextContent('36.68%');
  });

  it('advierte la diferencia entre físico y avance atribuible en salida y matriz canónica', async () => {
    const attributedOutput = {
      ...outputs[0],
      corrida_id: 'attribution-run',
      pieza_id: 31,
      pieza: 'Pieza KG',
      pieza_color_id: 'attribution-piece-color',
      meta: 250,
      avance: 56.3,
      porcentaje: 22.52,
      finalizados_kg: 45.4,
      en_proceso_kg: 10.9,
      avance_medido_kg: 56.3,
      peso_fisico_kg: 67.6,
      motivos_atribucion: ['ATRIBUCION_INCOMPLETA'],
      estado_avance: 'INCOMPLETO',
    };

    listarAvanceOfTvScm.mockResolvedValueOnce({
      ...response,
      items: [{ ...response.items[0], salidas: [attributedOutput] }],
    });
    render(<ControlAvanceOfTv />);

    const legacyWarning = await screen.findByTestId('output-attribution-warning');
    expect(legacyWarning).toHaveTextContent('Físico observado: 67.60 kg');
    expect(legacyWarning).toHaveTextContent('avance atribuible: 56.30 kg');

    cleanup();
    window.innerWidth = 768;
    listarAvanceOfTvScm.mockResolvedValueOnce({
      ...response,
      items: [{
        group_id: 'attribution-canonical',
        identity: { identity_status: 'COMPLETA', identity_issues: [] },
        of_id: 'of-attribution', of: 'OF-ATTRIBUTION', estado: 'EN_EJECUCION',
        ot_id: 'ot-attribution', ot: 'OT-ATTRIBUTION', corrida_id: 'attribution-run',
        ots: [{ id: 'ot-attribution', codigo: 'OT-ATTRIBUTION' }],
        molde_id: 'ML-ATTRIBUTION', molde: { codigo: 'ML-ATTRIBUTION', nombre: 'Molde atribución' },
        molde_visible: true, color_id: 1, color: 'Azul', color_hex: '#123456',
        salidas: [attributedOutput],
      }],
    });
    render(<ControlAvanceOfTv />);

    expect(await screen.findByTestId('canonical-compact-grid')).toBeInTheDocument();
    expect(screen.getByTestId('output-attribution-warning')).toHaveTextContent('Físico observado: 67.60 kg');
    fireEvent.click(screen.getByRole('button', { name: 'Modo TV' }));
    expect(await screen.findByTestId('output-attribution-warning')).toHaveTextContent('avance atribuible: 56.30 kg');
  });

  it('usa cantidad UN para el avance y no llama sin peso a una cantidad pendiente', async () => {
    const unOutput = {
      ...outputs[1],
      corrida_id: 'un-quantity-run',
      pieza_id: 31,
      pieza: 'Pieza UN',
      unidad: 'UN',
      meta: 10,
      avance: 4,
      porcentaje: 40,
      peso_fisico_kg: 2,
      pendientes_sin_peso: 0,
      pendientes_sin_cantidad_un: 1,
      motivos_atribucion: ['KG_SIN_TRAMOS_UN'],
      estado_avance: 'INCOMPLETO',
    };
    listarAvanceOfTvScm.mockResolvedValueOnce({
      ...response,
      items: [{ ...response.items[0], salidas: [unOutput] }],
    });

    render(<ControlAvanceOfTv />);

    const row = await screen.findByTestId('output-progress-row');
    expect(row).toHaveTextContent('Avance4 UN');
    expect(row).toHaveTextContent('Pendientes de cantidad UN: 1');
    expect(row).not.toHaveTextContent('Pendientes sin peso');
  });

  it('reserva el desglose en la matriz canónica para varias piezas y pendientes', async () => {
    const canonicalOutputs = [
      {
        ...outputs[0], pieza_id: 31, pieza: 'Pieza base', unidad: 'KG', meta: 250,
        avance: 91.7, pendiente: 158.3, porcentaje: 36.68,
        finalizados_kg: 90.6, en_proceso_kg: 1.1, pendientes_sin_peso: 2,
        estado_avance: 'INCOMPLETO',
      },
      {
        ...outputs[3], pieza_id: 42, pieza: 'Pieza tapa', unidad: 'KG', meta: 40,
        avance: 12.5, pendiente: 27.5, porcentaje: 31.25,
        finalizados_kg: 10, en_proceso_kg: 2.5, pendientes_sin_peso: 1,
        estado_avance: 'INCOMPLETO',
      },
    ];
    listarAvanceOfTvScm.mockResolvedValueOnce({
      ...response,
      items: [{
        group_id: 'canonical-breakdown', identity: { identity_status: 'COMPLETA', identity_issues: [] },
        of_id: 'of-breakdown', of: 'OF-BREAKDOWN', estado: 'EN_EJECUCION', corrida_id: 'run-breakdown',
        color_id: 1, color: 'Azul', color_hex: '#123456', molde_id: 'ML-1', molde_visible: true,
        molde: { codigo: 'ML-1', nombre: 'Molde 1' }, ots: [{ id: 'ot-1', codigo: 'OT-1' }],
        provenance: { issues: [] }, salidas: canonicalOutputs,
      }],
    });

    render(<ControlAvanceOfTv />);

    const board = await screen.findByTestId('of-progress-card');
    expect(within(board).getAllByTestId('output-kg-breakdown')).toHaveLength(2);
    expect(within(board).getAllByText(/Pendientes sin peso:/).map((element) => element.textContent)).toEqual([
      'Pendientes sin peso: 2', 'Pendientes sin peso: 1',
    ]);
    expect(within(board).getAllByTestId('output-kg-breakdown').map((element) => element.textContent)).toEqual([
      'Finalizados: 90.60 kg · En proceso: 1.10 kg',
      'Finalizados: 10.00 kg · En proceso: 2.50 kg',
    ]);
  });

  it('renders one shared OF-mold board, keeps group ids and multipiece outputs together', async () => {
    listarAvanceOfTvScm.mockResolvedValueOnce({
      as_of: response.as_of,
      visibilidad: { pesaje: true },
      items: ['a', 'b'].map((suffix, index) => ({
        group_id: `of-1|ot-${suffix}|corrida-${suffix}|ML-1|${index + 1}`,
        identity: { identity_status: 'COMPLETA', identity_issues: [] },
        of_id: 'of-1', of: 'OF-0001', estado: 'EN_EJECUCION',
        ot_id: `ot-${suffix}`, ot: `OT-${suffix}`, corrida_id: `corrida-${suffix}`,
        ots: [{ id: `ot-${suffix}`, codigo: `OT-${suffix}` }], ot_ids: [`ot-${suffix}`],
        corrida: 'Mismo nombre visual', molde_id: 'ML-1', molde: { codigo: 'ML-1', nombre: 'Molde común' },
        color_id: 1, color: 'Azul', color_hex: '#123456', molde_visible: true,
        salidas: outputs.slice(0, 2).map((output, outputIndex) => ({
          ...output, corrida_id: `corrida-${suffix}`, pieza_id: outputIndex + 1,
          pieza: `Pieza ${outputIndex + 1}`, porcentaje: 50, avance: 1, pendiente: 1,
          estado_avance: 'EN_AVANCE',
        })),
      })),
    });

    render(<ControlAvanceOfTv />);
    const cards = await screen.findAllByTestId('of-progress-card');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveAttribute('data-board-key', 'of-1|ML-1');
    const canonicalGroups = within(cards[0]).getAllByTestId('canonical-progress-group');
    expect(canonicalGroups.map((group) => group.getAttribute('data-group-id'))).toEqual([
      'of-1|ot-a|corrida-a|ML-1|1',
      'of-1|ot-b|corrida-b|ML-1|2',
    ]);
    expect(within(cards[0]).getAllByTestId('canonical-color-lane')).toHaveLength(2);
    expect(within(cards[0]).getAllByTestId('group-color-swatch')).toHaveLength(2);
    expect(within(cards[0]).getAllByTestId('output-progress-row')).toHaveLength(4);
    expect(within(cards[0]).getAllByText('Azul')).toHaveLength(2);
    expect(within(cards[0]).queryByText(/Corrida/)).not.toBeInTheDocument();
    expect(within(cards[0]).queryByText('Pendiente')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filtrar OF, pieza o objetivo de color'), { target: { value: 'OT-B' } });
    const filteredBoard = await screen.findByTestId('of-progress-card');
    expect(within(filteredBoard).getByTestId('canonical-progress-group')).toHaveAttribute(
      'data-group-id', 'of-1|ot-b|corrida-b|ML-1|2',
    );
  });

  it('uses the agreed 80/95 traffic light and keeps the over-target note beside the bar', async () => {
    const percentages = [79.9, 80, 95, 120];
    listarAvanceOfTvScm.mockResolvedValueOnce({
      ...response,
      items: percentages.map((porcentaje, index) => ({
        group_id: `traffic-${index + 1}`,
        identity: { identity_status: 'COMPLETA', identity_issues: [] },
        of_id: 'of-traffic', of: 'OF-TRAFFIC', estado: 'EN_EJECUCION',
        ot: `OT-${index + 1}`, molde_id: 'ML-TRAFFIC',
        molde: { codigo: 'ML-TRAFFIC', nombre: 'Molde semáforo' }, molde_visible: true,
        color_id: index + 1, color: `Color ${index + 1}`, color_hex: '#123456',
        salidas: [{
          ...outputs[0], corrida_id: `traffic-run-${index + 1}`, pieza_id: 1,
          pieza: 'Pieza semáforo', pieza_color_id: `traffic-pc-${index + 1}`,
          meta: 100, avance: porcentaje, porcentaje,
          estado_avance: index === 3 ? 'SOBRE_REFERENCIA' : 'EN_AVANCE',
        }],
      })),
    });

    render(<ControlAvanceOfTv />);

    const board = await screen.findByTestId('of-progress-card');
    expect(within(board).getAllByRole('progressbar').map((bar) => bar.getAttribute('data-progress-tone'))).toEqual([
      'error', 'warning', 'success', 'success',
    ]);
    const note = within(board).getByTestId('over-target-label');
    expect(note).toHaveTextContent('Exceso');
    expect(note.parentElement).toHaveTextContent('Exceso');
    expect(note.parentElement).toHaveTextContent('120.00 / 100.00 KG');
    expect(within(board).queryByText('Meta superada · exceso')).not.toBeInTheDocument();
    expect(within(board).getAllByRole('progressbar')[3]).toHaveAttribute(
      'aria-valuetext', '120%; estado Meta superada',
    );
    expect(within(board).getAllByTestId('output-progress-row')[3]).toHaveAttribute(
      'aria-label', expect.stringContaining('estado Meta superada'),
    );
    expect(within(board).queryByText('Sobre referencia estándar')).not.toBeInTheDocument();
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
            molde: { codigo: 'ML-1', nombre: 'Molde 1' }, molde_visible: true, color: 'TRANSPARENTE TRANSPARENTE', color_hex: null,
            salidas: [{ ...outputs[0], corrida_id: 'corrida-a', pieza_id: 1, pieza: 'Pieza A', porcentaje: null, estado_avance: 'SIN_META' }],
          },
          {
            group_id: 'of-shared|ot-b|corrida-b|ML-1|2', identity: { identity_status: 'COMPLETA', identity_issues: [] },
            of_id: 'of-shared', of: 'OF-SHARED', estado: 'EN_EJECUCION', ot: 'OT-B', corrida: 'C-B',
            molde: { codigo: 'ML-1', nombre: 'Molde 1' }, molde_visible: true, color: 'Rojo', color_hex: null,
            salidas: [{ ...outputs[0], corrida_id: 'corrida-b', pieza_id: 2, pieza: 'Pieza B', porcentaje: null, estado_avance: 'SIN_META' }],
          },
        ],
      });
      render(<ControlAvanceOfTv />);
      const cards = await screen.findAllByTestId('of-progress-card');
      expect(cards).toHaveLength(1);
      const canonicalGroups = within(cards[0]).getAllByTestId('canonical-progress-group');
      expect(canonicalGroups.map((group) => group.getAttribute('data-group-id'))).toEqual([
        'of-shared|ot-a|corrida-a|ML-1|1',
        'of-shared|ot-b|corrida-b|ML-1|2',
      ]);
      const lanes = within(cards[0]).getAllByTestId('canonical-color-lane');
      expect(lanes).toHaveLength(2);
      expect(within(lanes[0]).getByText('Transparente')).toBeInTheDocument();
      expect(within(lanes[0]).getByTestId('group-color-swatch')).toHaveAttribute('data-color-kind', 'transparent');
      expect(within(lanes[0]).queryByText(/neutral/)).not.toBeInTheDocument();
      expect(within(lanes[1]).getByText('Rojo')).toBeInTheDocument();
      expect(within(lanes[1]).getByText(/neutral/)).toBeInTheDocument();
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
    expect(within(card).getByTestId('canonical-progress-group')).toHaveAttribute('data-group-id', 'tvgrp-opaque-authority');
    expect(within(card).queryByText(/Molde/)).not.toBeInTheDocument();
    expect(within(card).queryByText(/Molde sin identificar/)).not.toBeInTheDocument();
  });

  it('does not merge opaque groups when mold identity is unavailable', async () => {
    listarAvanceOfTvScm.mockResolvedValueOnce({
      ...response,
      items: ['a', 'b'].map((suffix, index) => ({
        group_id: `opaque-of|${suffix}`,
        identity: { identity_status: 'COMPLETA', identity_issues: [] },
        of_id: 'opaque-of', of: 'OF-OPAQUE', estado: 'EN_EJECUCION',
        molde_visible: false, color_id: index + 1, color: index === 0 ? 'Azul' : 'Rojo', color_hex: null,
        salidas: [{ ...outputs[0], corrida_id: `opaque-${suffix}`, pieza_id: index + 1, pieza: `Pieza ${suffix}`, porcentaje: 25, avance: 1, meta: 4, estado_avance: 'EN_AVANCE' }],
      })),
    });

    render(<ControlAvanceOfTv />);

    const cards = await screen.findAllByTestId('of-progress-card');
    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.getAttribute('data-board-key'))).toEqual(['group:opaque-of|a', 'group:opaque-of|b']);
    expect(screen.queryByText(/Molde/)).not.toBeInTheDocument();
  });

  it('paginates canonical group ids exactly once in TV mode', async () => {
    const groups = Array.from({ length: 3 }, (_, index) => ({
      group_id: `of-${index + 1}|ot-${index + 1}|corrida-${index + 1}|ML-1|${index + 1}`,
      identity: { identity_status: 'COMPLETA', identity_issues: [] },
      of_id: `of-${index + 1}`, of: `OF-${index + 1}`, estado: 'EN_EJECUCION',
      ot_id: `ot-${index + 1}`, ot: `OT-${index + 1}`, corrida_id: `corrida-${index + 1}`,
      corrida: `C-${index + 1}`, molde_id: 'ML-1', molde: { codigo: 'ML-1', nombre: 'Molde 1' }, molde_visible: true,
      color_id: index + 1, color: `Color ${index + 1}`, color_hex: null,
      salidas: [{ ...outputs[0], corrida_id: `corrida-${index + 1}`, pieza_id: index + 1, pieza: `Pieza ${index + 1}`, porcentaje: null, estado_avance: 'SIN_META' }],
    }));
    listarAvanceOfTvScm.mockResolvedValueOnce({ ...response, items: groups });
    window.innerWidth = 1366;

    render(<ControlAvanceOfTv />);
    await screen.findAllByTestId('of-progress-card');
    fireEvent.click(screen.getByRole('button', { name: 'Modo TV' }));
    expect(screen.getByTestId('of-progress-layout')).toHaveAttribute('data-page-columns', '2');

    expect(screen.getByTestId('of-progress-layout')).toHaveAttribute('data-page-rows', '2');
    const layout = screen.getByTestId('of-progress-layout');
    expect(Number(layout.getAttribute('data-tv-used-height'))).toBeLessThanOrEqual(
      Number(layout.getAttribute('data-tv-viewport-height')) - 180,
    );
    expect(screen.getAllByTestId('tv-page-row')).toHaveLength(2);
    const seen = new Set();
    screen.getAllByTestId('canonical-progress-group').forEach((group) => seen.add(group.getAttribute('data-group-id')));
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
    expect(rows[0]).toHaveTextContent('4.00 KG');
    expect(rows[0]).toHaveTextContent('2.00 KG');
    expect(rows[1]).toHaveTextContent('Meta (un)');
    expect(rows[1]).toHaveTextContent('10 UN');
    expect(rows[1]).toHaveTextContent('5 UN');
    expect(rows[2]).toHaveTextContent('Sin pesajes vigentes');
    expect(rows[2]).toHaveTextContent('-');
    expect(within(orderCard).getAllByRole('progressbar')).toHaveLength(2);
  });

  it('paginates one OF by four outputs, repeats piece headers, and exposes all nine outputs across parts', async () => {
    render(<ControlAvanceOfTv />);
    await screen.findAllByTestId('of-progress-card');
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

  it('renders five accessory color lanes against four aligned pieces', async () => {
    const pieceNames = ['ESTRELLA', 'CANGREJO', 'CABALLITO DE MAR', 'PEZ'];
    const accessoryGroups = ['Crema', 'Rojo', 'Azul', 'Verde', 'Amarillo'].map((color, index) => ({
      group_id: `acc-of|acc-ot-${index}|acc-run-${index}|M-ACC|${index}`,
      identity: { identity_status: 'COMPLETA', identity_issues: [] },
      of_id: 'acc-of', of: 'OF-ACCESORIOS', estado: 'EN_EJECUCION',
      ot: 'OT-ACCESORIOS', corrida: `RUN-${index}`, molde_id: 'M-ACC',
      molde: { codigo: 'M-ACC', nombre: 'Molde accesorios' }, molde_visible: true,
      color, color_hex: index === 0 ? '#F5E7C8' : null,
      salidas: pieceNames.map((pieza, pieceIndex) => ({
        ...outputs[pieceIndex], corrida_id: `acc-run-${index}`, pieza_id: 700 + pieceIndex,
        pieza, color, color_hex: null, pieza_color_id: `acc-${index}-${pieceIndex}`,
        meta: 8, avance: pieceIndex + 2, porcentaje: (pieceIndex + 2) * 12.5,
        pendiente: 8 - (pieceIndex + 2), estado_avance: 'EN_AVANCE', unidad: 'KG',
      })),
    }));
    listarAvanceOfTvScm.mockResolvedValueOnce({ ...response, items: accessoryGroups });
    window.innerWidth = 1366;

    render(<ControlAvanceOfTv />);

    const board = await screen.findByTestId('of-progress-card');
    expect(screen.getAllByTestId('of-progress-card')).toHaveLength(1);
    expect(within(board).getByRole('heading', { name: 'Molde accesorios' })).toBeInTheDocument();
    expect(within(board).getByText('OF-ACCESORIOS')).toHaveClass('MuiChip-label');
    expect(within(board).getAllByTestId('canonical-progress-group')).toHaveLength(5);
    expect(within(board).getAllByTestId('output-progress-row')).toHaveLength(20);
    expect(within(board).getAllByTestId('canonical-piece-header')).toHaveLength(4);
    pieceNames.forEach((piece) => {
      expect(within(board).getAllByText(piece)).toHaveLength(1);
    });
    expect(within(board).getAllByTestId('group-color-swatch')).toHaveLength(5);
    expect(within(board).queryByText(/Corrida|Pendiente/)).not.toBeInTheDocument();
    expect(within(board).getAllByTestId('output-percent')).toHaveLength(20);
    expect(within(board).getAllByTestId('output-progress-row')[0]).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Color Crema; pieza ESTRELLA; avance/meta'),
    );

    window.innerWidth = 390;
    fireEvent(window, new Event('resize'));
    expect(await screen.findByTestId('canonical-compact-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('canonical-matrix')).not.toBeInTheDocument();
    expect(within(board).getAllByTestId('output-progress-row')).toHaveLength(20);
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
    expect(screen.getAllByTestId('tv-page-row')[0]).toHaveAttribute('data-row-columns', '2');
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

  it('pauses and resumes deterministic TV rotation without changing page order', async () => {
    const timerItems = Array.from({ length: 4 }, (_, boardIndex) => ({
      group_id: `timer-board-${boardIndex}`,
      identity: { identity_status: 'COMPLETA', identity_issues: [] },
      of_id: `timer-of-${boardIndex}`, of: `OF-TIMER-${boardIndex}`, estado: 'EN_EJECUCION',
      molde_id: `timer-mold-${boardIndex}`, molde: { codigo: `TM-${boardIndex}`, nombre: `Molde timer ${boardIndex}` }, molde_visible: true,
      ots: [{ id: `timer-ot-${boardIndex}`, codigo: `OT-TIMER-${boardIndex}` }], provenance: { issues: [] },
      salidas: Array.from({ length: 8 }, (_, pieceIndex) => ({
        ...outputs[0], corrida_id: `timer-run-${boardIndex}`, pieza_id: 1000 + boardIndex * 10 + pieceIndex,
        pieza: `Pieza timer ${pieceIndex}`, pieza_color_id: `timer-pc-${boardIndex}-${pieceIndex}`,
      })),
    }));
    listarAvanceOfTvScm.mockResolvedValueOnce({ ...response, items: timerItems });
    window.innerWidth = 1366;
    render(<ControlAvanceOfTv />);
    await screen.findAllByTestId('of-progress-card');

    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Modo TV' }));
      expect(screen.getByText('Pantalla 1 de 2')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Pausar' }));
      act(() => { vi.advanceTimersByTime(24_000); });
      expect(screen.getByText('Pantalla 1 de 2')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Reanudar' }));
      act(() => { vi.advanceTimersByTime(12_000); });
      expect(screen.getByText('Pantalla 2 de 2')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders one consolidated color-piece bar and keeps OT provenance secondary', async () => {
    const output = {
      ...outputs[0], corrida_id: 'run-shared', pieza_id: 31, pieza: 'Pieza azul',
      pieza_color_id: 'pc-shared', meta: 5, avance: 5, pendiente: 0, porcentaje: 100,
      estado_avance: 'COMPLETADA',
    };
    listarAvanceOfTvScm.mockResolvedValueOnce({
      ...response,
      items: [{
        group_id: 'of-shared|run-shared|ML-1|7', identity: { identity_status: 'COMPLETA', identity_issues: [] },
        of_id: 'of-shared', of: 'OF-SHARED', estado: 'EN_EJECUCION', corrida_id: 'run-shared',
        color_id: 7, color: 'Azul', color_hex: '#123456', molde_id: 'ML-1', molde_visible: true,
        molde: { codigo: 'ML-1', nombre: 'Molde 1' }, ots: [{ id: 'ot-a', codigo: 'OT-A' }, { id: 'ot-b', codigo: 'OT-B' }],
        ot_ids: ['ot-a', 'ot-b'], provenance: { issues: [] }, salidas: [output],
      }],
    });

    render(<ControlAvanceOfTv />);
    const board = await screen.findByTestId('of-progress-card');

    expect(within(board).getAllByTestId('output-progress-row')).toHaveLength(1);
    expect(within(board).getAllByRole('progressbar')).toHaveLength(1);
    expect(within(board).getByText('2 OTs vinculadas')).toBeInTheDocument();
    expect(within(board).getByTestId('output-progress-row')).toHaveAttribute(
      'aria-label',
      expect.not.stringContaining('OT-'),
    );
    expect(screen.queryByText(/OT_ID_AUSENTE/)).not.toBeInTheDocument();
  });

  it('explains attributable missing OT without exposing internal issue codes', async () => {
    listarAvanceOfTvScm.mockResolvedValueOnce({
      ...response,
      items: [{
        group_id: 'of-history|run-history|ML-1|7', identity: { identity_status: 'COMPLETA', identity_issues: ['OT_ID_AUSENTE'] },
        of_id: 'of-history', of: 'OF-HISTORY', estado: 'EN_EJECUCION', corrida_id: 'run-history',
        color_id: 7, color: 'Azul', color_hex: '#123456', molde_id: 'ML-1', molde_visible: true,
        molde: { codigo: 'ML-1', nombre: 'Molde 1' }, ots: [], ot_ids: [], provenance: { issues: ['OT_ID_AUSENTE'] },
        salidas: [{ ...outputs[0], corrida_id: 'run-history', pieza_id: 31, pieza: 'Pieza azul', meta: 5, avance: 4, porcentaje: 80, estado_avance: 'EN_AVANCE' }],
      }],
    });

    render(<ControlAvanceOfTv />);

    expect(await screen.findByTestId('provenance-note')).toHaveTextContent('Incluye producción histórica sin OT vinculada');
    expect(screen.queryByText(/OT_ID_AUSENTE/)).not.toBeInTheDocument();
  });

  it('uses a compact blocking recovery note for unlinked production', async () => {
    listarAvanceOfTvScm.mockResolvedValueOnce({
      ...response,
      items: [{
        group_id: 'of-blocked|run-blocked|ML-1|?', identity: { identity_status: 'INCOMPLETA', identity_issues: ['COLOR_ID_AUSENTE', 'OT_ID_AUSENTE'] },
        of_id: 'of-blocked', of: 'OF-BLOCKED', estado: 'EN_EJECUCION', corrida_id: 'run-blocked',
        color: 'Azul', color_hex: null, molde_id: 'ML-1', molde_visible: true,
        molde: { codigo: 'ML-1', nombre: 'Molde 1' }, ots: [], provenance: { issues: ['COLOR_ID_AUSENTE', 'OT_ID_AUSENTE'] },
        salidas: [{ ...outputs[0], corrida_id: 'run-blocked', pieza_id: 31, pieza: 'Pieza azul', meta: 5, avance: null, porcentaje: null, estado_avance: 'INCOMPLETO' }],
      }],
    });

    render(<ControlAvanceOfTv />);

    expect(await screen.findByText('Avance no calculable: falta vincular producción')).toBeInTheDocument();
    expect(screen.queryByText(/COLOR_ID_AUSENTE|OT_ID_AUSENTE/)).not.toBeInTheDocument();
  });

  it('splits a dense consolidated OF by color lanes with no TV scroll', async () => {
    const denseItems = Array.from({ length: 7 }, (_, index) => ({
      group_id: `of-dense|run-${index}|ML-1|${index + 1}`,
      identity: { identity_status: index === 0 ? 'INCOMPLETA' : 'COMPLETA', identity_issues: index === 0 ? ['COLOR_ID_AUSENTE'] : [] },
      of_id: 'of-dense', of: 'OF-DENSE', estado: 'EN_EJECUCION', corrida_id: `run-${index}`,
      color_id: index + 1, color: `Color ${index + 1}`, color_hex: '#123456', molde_id: 'ML-1', molde_visible: true,
      molde: { codigo: 'ML-1', nombre: 'Molde 1' }, ots: [{ id: `ot-${index}`, codigo: `OT-${index}` }],
      provenance: { issues: [] },
      salidas: [31, 42].map((pieceId, pieceIndex) => ({ ...outputs[pieceIndex], corrida_id: `run-${index}`, pieza_id: pieceId, pieza: `Pieza ${pieceId}`, pieza_color_id: `pc-${index}-${pieceId}`, meta: 5, avance: 2, porcentaje: 40, estado_avance: index === 0 ? 'INCOMPLETO' : 'EN_AVANCE' })),
    }));
    listarAvanceOfTvScm.mockResolvedValueOnce({ ...response, items: denseItems });
    window.innerWidth = 1366;

    render(<ControlAvanceOfTv />);
    await screen.findByTestId('of-progress-card');
    fireEvent.click(screen.getByRole('button', { name: 'Modo TV' }));

    expect(screen.getByTestId('control-avance-of-tv')).toHaveAttribute('data-tv-scroll', 'disabled');
    const pageLabel = await screen.findByText(/Pantalla 1 de/);
    const pageCount = Number(pageLabel.textContent.match(/de (\d+)/)?.[1]);
    expect(pageCount).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('of-progress-layout')).toHaveAttribute('data-page-columns', '1');
    expect(screen.getAllByTestId('of-progress-card')).toHaveLength(1);
    const seen = new Set();
    for (let page = 0; page < pageCount; page += 1) {
      screen.getAllByTestId('output-progress-row').forEach((row) => seen.add(row.getAttribute('data-output-key')));
      if (page < pageCount - 1) fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    }
    expect(seen).toHaveLength(14);
    expect(screen.queryByText(/OT_ID_AUSENTE/)).not.toBeInTheDocument();
  });

  it('keeps wide matrices full-width when two OFs would make a 7-piece half-screen overflow', async () => {
    const wideItems = Array.from({ length: 2 }, (_, ofIndex) => ({
      group_id: `of-wide-${ofIndex}|run-wide-${ofIndex}|ML-1|${ofIndex + 1}`,
      identity: { identity_status: 'COMPLETA', identity_issues: [] },
      of_id: `of-wide-${ofIndex}`, of: `OF-WIDE-${ofIndex}`, estado: 'EN_EJECUCION', corrida_id: `run-wide-${ofIndex}`,
      color_id: ofIndex + 1, color: `Color ${ofIndex + 1}`, color_hex: '#123456', molde_id: 'ML-1', molde_visible: true,
      molde: { codigo: 'ML-1', nombre: 'Molde 1' }, ots: [{ id: `ot-wide-${ofIndex}`, codigo: `OT-WIDE-${ofIndex}` }], provenance: { issues: [] },
      salidas: Array.from({ length: 7 }, (_, pieceIndex) => ({
        ...outputs[0], corrida_id: `run-wide-${ofIndex}`, pieza_id: 100 + pieceIndex,
        pieza_color_id: `wide-${ofIndex}-${pieceIndex}`, pieza: `Pieza ${pieceIndex + 1}`,
      })),
    }));
    listarAvanceOfTvScm.mockResolvedValueOnce({ ...response, items: wideItems });
    window.innerWidth = 1366;

    render(<ControlAvanceOfTv />);
    await screen.findAllByTestId('of-progress-card');
    fireEvent.click(screen.getByRole('button', { name: 'Modo TV' }));

    const pageLabel = await screen.findByText(/Pantalla 1 de/);
    const pageCount = Number(pageLabel.textContent.match(/de (\d+)/)?.[1]);
    expect(pageCount).toBe(1);
    expect(screen.getByTestId('of-progress-layout')).toHaveAttribute('data-page-columns', '1');
    const seen = [];
    for (let page = 0; page < pageCount; page += 1) {
      seen.push(...screen.getAllByTestId('output-progress-row').map((row) => row.getAttribute('data-output-key')));
      if (page < pageCount - 1) fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    }
    expect(seen).toHaveLength(14);
    expect(new Set(seen).size).toBe(14);
  });

  it('walks every column part for a 14-piece OF without losing or duplicating outputs', async () => {
    const fourteenPieces = {
      group_id: 'of-columns|run-columns|ML-1|1',
      identity: { identity_status: 'COMPLETA', identity_issues: [] },
      of_id: 'of-columns', of: 'OF-COLUMNS', estado: 'EN_EJECUCION', corrida_id: 'run-columns',
      color_id: 1, color: 'Azul', color_hex: '#123456', molde_id: 'ML-1', molde_visible: true,
      molde: { codigo: 'ML-1', nombre: 'Molde 1' }, ots: [{ id: 'ot-columns', codigo: 'OT-COLUMNS' }], provenance: { issues: [] },
      salidas: Array.from({ length: 14 }, (_, pieceIndex) => ({
        ...outputs[0], corrida_id: 'run-columns', pieza_id: 200 + pieceIndex,
        pieza_color_id: `columns-${pieceIndex}`, pieza: `Pieza ${pieceIndex + 1}`,
      })),
    };
    listarAvanceOfTvScm.mockResolvedValueOnce({ ...response, items: [fourteenPieces] });
    window.innerWidth = 1366;

    render(<ControlAvanceOfTv />);
    await screen.findByTestId('of-progress-card');
    fireEvent.click(screen.getByRole('button', { name: 'Modo TV' }));

    const pageLabel = await screen.findByText(/Pantalla 1 de/);
    const pageCount = Number(pageLabel.textContent.match(/de (\d+)/)?.[1]);
    expect(pageCount).toBe(1);
    const seen = [];
    for (let page = 0; page < pageCount; page += 1) {
      seen.push(...screen.getAllByTestId('output-progress-row').map((row) => row.getAttribute('data-output-key')));
      if (page < pageCount - 1) fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    }
    const expected = fourteenPieces.salidas.map((output) => `${output.corrida_id}-${output.pieza_color_id}`);
    expect(seen.slice().sort()).toEqual(expected.slice().sort());
    expect(new Set(seen).size).toBe(expected.length);
  });

  it('uses the measured wide-TV budget without losing lanes at 900p or 640p', () => {
    const compact = calculateTvPageBudget({ viewportHeight: 640, pieceCount: 2 });
    const large = calculateTvPageBudget({ viewportHeight: 900, pieceCount: 2 });
    expect(compact.availableHeight).toBe(444);
    expect(large.availableHeight).toBe(704);
    expect(large.maxLanes).toBeGreaterThanOrEqual(compact.maxLanes);
    const groups = Array.from({ length: 7 }, (_, index) => ({
      id: `lane-${index}`,
      identity: { identity_status: index === 0 ? 'INCOMPLETA' : 'COMPLETA' },
      salidas: [{ id: index }, { id: `${index}-piece-2` }],
    }));
    const pages900 = splitTvLanes(groups, { viewportHeight: 900, pieceCount: 2, layout: 'wide' });
    const pages640 = splitTvLanes(groups, { viewportHeight: 640, pieceCount: 2, layout: 'wide' });
    const pages768FourPieces = splitTvLanes(groups, { viewportHeight: 768, pieceCount: 4, layout: 'wide' });
    expect(pages900).toHaveLength(1);
    expect(pages640.length).toBeLessThanOrEqual(2);
    expect(pages640[0]).toHaveLength(4);
    expect(pages768FourPieces.flat().map((group) => group.id)).toEqual(groups.map((group) => group.id));
    expect(pages768FourPieces.length).toBeGreaterThan(1);
    expect([...pages900, ...pages640].flat().map((group) => group.id)).toEqual([
      ...groups.map((group) => group.id),
      ...groups.map((group) => group.id),
    ]);
    expect(splitTvLanes(
      groups,
      { viewportHeight: 640, pieceCount: 2, layout: 'narrow' },
    ).flat()).toHaveLength(7);
    const diagnosticGroups = Array.from({ length: 4 }, (_, index) => ({
      id: `diagnostic-lane-${index}`,
      identity: { identity_status: 'COMPLETA' },
      salidas: [{ unidad: 'KG', finalizados_kg: 90.6, en_proceso_kg: 1.1, pendientes_sin_peso: 1 }],
    }));
    const diagnosticPages = splitTvLanes(diagnosticGroups, { viewportHeight: 640, pieceCount: 1, layout: 'wide' });
    expect(diagnosticPages[0]).toHaveLength(3);
    const narrowLanes = Array.from({ length: 6 }, (_, index) => ({
      id: `narrow-lane-${index}`,
      identity: { identity_status: 'COMPLETA' },
      salidas: [{ id: `narrow-output-${index}` }],
    }));
    const narrowPages = splitTvLanes(narrowLanes, { viewportHeight: 844, pieceCount: 1, layout: 'narrow', titleLineCount: 3 });
    expect(narrowPages.flat()).toHaveLength(6);
    expect(narrowPages.length).toBeGreaterThan(1);
  });

  it('packs four distinct one-lane OFs into two rows on one 640/768 TV page', () => {
    const parts = Array.from({ length: 4 }, (_, index) => ({
      key: `of-${index + 1}`,
      of_id: `of-${index + 1}`,
      estimatedHeight: 180,
      exclusive: false,
      requiresFullWidth: false,
    }));

    [460, 588].forEach((availableHeight) => {
      const rows = packTvRows(parts, { availableHeight, maxColumns: 2 });
      const pages = packTvPages(parts, { availableHeight, maxColumns: 2 });
      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row.parts.map((part) => part.of_id))).toEqual([
        ['of-1', 'of-2'],
        ['of-3', 'of-4'],
      ]);
      expect(pages).toHaveLength(1);
      expect(pages[0].rows).toHaveLength(2);
      expect(pages[0].usedHeight).toBeLessThanOrEqual(availableHeight);
    });
  });

  it('keeps exclusive and full-width cards solitary while pairing normals globally', () => {
    const parts = [
      { key: 'normal-1', of_id: 'of-1', estimatedHeight: 120 },
      { key: 'full', of_id: 'of-2', estimatedHeight: 140, requiresFullWidth: true },
      { key: 'normal-3', of_id: 'of-3', estimatedHeight: 120 },
      { key: 'exclusive', of_id: 'of-4', estimatedHeight: 140, exclusive: true },
      { key: 'normal-5', of_id: 'of-5', estimatedHeight: 120 },
    ];
    const rows = packTvRows(parts, { availableHeight: 640, maxColumns: 2 });
    expect(rows.map((row) => row.parts.map((part) => part.key))).toEqual([
      ['normal-1', 'normal-3'], ['full'], ['exclusive'], ['normal-5'],
    ]);
    expect(rows.every((row) => row.parts.length === 1 || row.parts[0].of_id !== row.parts[1].of_id)).toBe(true);
  });

  it('counts the 8px inter-row gap when deciding whether a page fits', () => {
    const parts = Array.from({ length: 4 }, (_, index) => ({
      key: `gap-of-${index + 1}`,
      of_id: `gap-of-${index + 1}`,
      estimatedHeight: 100,
    }));
    const pages = packTvPages(parts, { availableHeight: 207, maxColumns: 2 });
    expect(pages).toHaveLength(2);
    expect(pages[0].usedHeight).toBe(100);
    expect(pages[1].usedHeight).toBe(100);
  });

  it('fits similarly sized later cards instead of pairing a large card with the first small card', () => {
    const parts = [
      { key: 'large-a', of_id: 'of-a', estimatedHeight: 300 },
      { key: 'small-b', of_id: 'of-b', estimatedHeight: 100 },
      { key: 'small-c', of_id: 'of-c', estimatedHeight: 110 },
      { key: 'large-d', of_id: 'of-d', estimatedHeight: 290 },
    ];

    const rows = packTvRows(parts, { availableHeight: 460, maxColumns: 2 });

    expect(rows.map((row) => row.parts.map((part) => part.key))).toEqual([
      ['large-a', 'large-d'],
      ['small-b', 'small-c'],
    ]);
  });

  it('maximizes distinct-OF pairs before optimizing their height similarity', () => {
    const parts = [
      { key: 'same-a', of_id: 'of-a', estimatedHeight: 100 },
      { key: 'same-b', of_id: 'of-a', estimatedHeight: 110 },
      { key: 'other-a', of_id: 'of-b', estimatedHeight: 200 },
      { key: 'other-b', of_id: 'of-c', estimatedHeight: 201 },
    ];

    const rows = packTvRows(parts, { availableHeight: 460, maxColumns: 2 });

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.parts.length === 2)).toBe(true);
    expect(rows.every((row) => row.parts[0].of_id !== row.parts[1].of_id)).toBe(true);
  });

  it('keeps maximum cardinality with three repeated OF groups', () => {
    const parts = Array.from({ length: 9 }, (_, index) => ({
      key: `triple-${index}`,
      of_id: `of-${index % 3}`,
      estimatedHeight: 150 + index,
    }));
    const rows = packTvRows(parts, { maxColumns: 2 });

    expect(rows).toHaveLength(5);
    expect(rows.filter((row) => row.parts.length === 2)).toHaveLength(4);
    expect(rows.every((row) => row.parts.length < 2 || row.parts[0].of_id !== row.parts[1].of_id)).toBe(true);
  });

  it('keeps a full-width card solitary while allowing normals on both sides to pair', () => {
    const parts = [
      { key: 'normal-a', of_id: 'of-a', estimatedHeight: 300 },
      { key: 'full', of_id: 'of-full', estimatedHeight: 140, requiresFullWidth: true },
      { key: 'normal-b', of_id: 'of-b', estimatedHeight: 300 },
    ];

    const rows = packTvRows(parts, { availableHeight: 460, maxColumns: 2 });

    expect(rows.map((row) => row.parts.map((part) => part.key))).toEqual([
      ['normal-a', 'normal-b'],
      ['full'],
    ]);
  });

  it('fills a recoverable gap on an earlier page with a later row without duplicates', () => {
    const parts = [
      { key: 'tall', of_id: 'of-tall', estimatedHeight: 300, exclusive: true },
      { key: 'medium', of_id: 'of-medium', estimatedHeight: 200, exclusive: true },
      { key: 'short', of_id: 'of-short', estimatedHeight: 100, exclusive: true },
    ];

    const pages = packTvPages(parts, { availableHeight: 420, maxColumns: 2 });

    expect(pages).toHaveLength(2);
    expect(pages[0].rows.flatMap((row) => row.parts.map((part) => part.key))).toEqual(['tall', 'short']);
    expect(pages[1].rows.flatMap((row) => row.parts.map((part) => part.key))).toEqual(['medium']);
    expect(new Set(pages.flatMap((page) => page.rows.flatMap((row) => row.parts.map((part) => part.key)))).size).toBe(3);
  });

  it('accounts for long mold titles in the deterministic card-height estimate', () => {
    const short = { of_id: 'of-short', title: 'Molde 1', groups: [] };
    const long = { of_id: 'of-long', title: 'Molde de inyección para línea industrial de accesorios grandes', groups: [], titleLineCount: 3 };

    expect(estimateTvPartHeight(long)).toBeGreaterThan(estimateTvPartHeight(short));
    const measured = estimateTvPartHeight(long);
    expect(estimateTvPartHeight({ ...long, estimatedHeight: measured, heightIncludesTitle: true })).toBe(measured);
  });

  it('never pairs parts from the same OF and remains stable for repeated packing', () => {
    const parts = [
      { key: 'same-a', of_id: 'of-same', estimatedHeight: 180 },
      { key: 'other', of_id: 'of-other', estimatedHeight: 175 },
      { key: 'same-b', of_id: 'of-same', estimatedHeight: 170 },
      { key: 'third', of_id: 'of-third', estimatedHeight: 165 },
    ];

    const first = packTvPages(parts, { availableHeight: 460, maxColumns: 2 });
    const second = packTvPages(parts, { availableHeight: 460, maxColumns: 2 });
    const rows = first.flatMap((page) => page.rows);

    expect(second).toEqual(first);
    expect(rows.every((row) => row.parts.length < 2 || row.parts[0].of_id !== row.parts[1].of_id)).toBe(true);
    expect(new Set(rows.flatMap((row) => row.parts.map((part) => part.key)))).toEqual(new Set(parts.map((part) => part.key)));
  });

  it('keeps large distinct-OF packing bounded and complete', () => {
    [100, 500, 1000].forEach((count) => {
      const parts = Array.from({ length: count }, (_, index) => ({
        key: `scale-${count}-${index}`,
        of_id: `scale-of-${index}`,
        estimatedHeight: 140 + (index % 7),
      }));
      const started = performance.now();
      const rows = packTvRows(parts, { maxColumns: 2 });
      const elapsed = performance.now() - started;
      expect(rows.flatMap((row) => row.parts)).toHaveLength(count);
      expect(rows.every((row) => row.parts.length <= 2)).toBe(true);
      expect(elapsed).toBeLessThan(1000);
    });
    const repeated = Array.from({ length: 1000 }, (_, index) => ({
      key: `repeated-${index}`,
      of_id: `repeated-of-${index % 2}`,
      estimatedHeight: 140 + (index % 11),
    }));
    const repeatedRows = packTvRows(repeated, { maxColumns: 2 });
    expect(repeatedRows.flatMap((row) => row.parts)).toHaveLength(1000);
    expect(repeatedRows.every((row) => row.parts.length < 2 || row.parts[0].of_id !== row.parts[1].of_id)).toBe(true);
  });
});
