import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OtGlobalIndex from '../components/OtGlobalIndex';

const mocks = vi.hoisted(() => ({ listarOtScm: vi.fn() }));
vi.mock('../services/scmOtApi', () => ({ listarOtScm: mocks.listarOtScm }));
vi.mock('../services/scmEngineeringApi', () => ({
  mensajeErrorScm: (_error, fallback) => fallback,
}));

const rows = [
  {
    public_id: 'ot-fab-1', codigo_ot: 'OT-FAB-001', tipo_ot: 'FABRICACION',
    estado: 'EN_EJECUCION', fecha_operativa: '2026-10-18', turno: 'DIA',
    maquina_codigo: 'INY-01', trabajos_color: [{ color: 'VERDE', orden_fabricacion_codigo: 'OF-001' }],
    molde: { codigo: 'MD-1', nombre: 'Molde cubeta' },
  },
  {
    public_id: 'ot-arm-1', codigo_ot: 'OT-ARM-001', tipo_ot: 'ENSAMBLE',
    estado: 'PLANIFICADA', fecha_operativa: '2026-01-12', turno: 'NOCHE',
    orden_armado: { id: 'oa-1', codigo: 'OA-001', salida: { articulo: { codigo: 'PT-1', nombre: 'Producto' } } },
  },
];

const renderIndex = (path = '/produccion/ots-planta?vista=todas', props = {}) => render(
  <MemoryRouter initialEntries={[path]}><OtGlobalIndex {...props} /></MemoryRouter>,
);

describe('OT global index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listarOtScm.mockResolvedValue({ items: rows });
  });

  it('loads complete collection once and renders compact rows', async () => {
    renderIndex();
    expect(await screen.findByRole('heading', { name: 'Todas las OT' })).toBeVisible();
    expect(mocks.listarOtScm).toHaveBeenCalledWith(undefined, undefined, {});
    expect(screen.getByRole('row', { name: /OT-FAB-001/ })).toHaveTextContent(/Molde cubeta.*MD-1.*OF-001.*VERDE/);
    expect(screen.getByText(/2 visibles de 2 OT cargadas/)).toBeVisible();
  });

  it('searches nested mold, OF and color values without another request', async () => {
    const user = userEvent.setup();
    renderIndex();
    const search = await screen.findByLabelText('Omnibúsqueda');
    await user.type(search, 'cubeta');
    expect(screen.getByRole('row', { name: /OT-FAB-001/ })).toBeVisible();
    expect(screen.queryByRole('row', { name: /OT-ARM-001/ })).not.toBeInTheDocument();
    expect(mocks.listarOtScm).toHaveBeenCalledTimes(1);
  });

  it('enriches every nested color work from OF and mold catalogs', async () => {
    const user = userEvent.setup();
    mocks.listarOtScm.mockResolvedValueOnce({ items: [
      {
        public_id: 'ot-real-1', codigo_ot: 'OT-REAL-001', tipo_ot: 'FABRICACION',
        trabajos_color: [{ orden_fabricacion_id: 'of-1', color: 'ROJO', fabricacion: { molde_id: 'M-ALC' } }],
      },
      {
        public_id: 'ot-real-2', codigo_ot: 'OT-REAL-002', tipo_ot: 'FABRICACION',
        trabajos_color: [{ orden_fabricacion_id: 'of-2', color: 'AZUL', fabricacion: { molde_id: 'M-ALC' } }],
      },
    ] });
    renderIndex('/produccion/ots-planta?vista=todas', {
      orders: [{ id: 'of-1', codigo: 'OF-001', molde_id: 'M-ALC' }, { id: 'of-2', codigo: 'OF-002', molde_id: 'M-ALC' }],
      molds: [{ id: 'mold-1', codigo: 'M-ALC', nombre: 'Molde soplado Alcancia Pablo Grande' }],
    });
    const search = await screen.findByLabelText('Omnibúsqueda');
    await user.type(search, 'alcancia pablo grande');
    expect(screen.getByRole('row', { name: /OT-REAL-001/ })).toBeVisible();
    expect(screen.getByRole('row', { name: /OT-REAL-002/ })).toBeVisible();
  });

  it('completa un molde parcial con el catálogo coincidente sin cruzar otro molde', async () => {
    mocks.listarOtScm.mockResolvedValueOnce({ items: [{
      public_id: 'ot-partial-mold', codigo_ot: 'OT-PARTIAL-MOLD', tipo_ot: 'FABRICACION',
      estado: 'PLANIFICADA', fecha_operativa: '2026-10-19', turno: 'DIA',
      orden_fabricacion_id: 'of-partial', molde: { codigo: 'M-ALC' },
      trabajos_color: [{ orden_fabricacion_id: 'of-partial', molde: { codigo: 'M-ALC' }, color: 'ROJO' }],
    }] });
    renderIndex('/produccion/ots-planta?vista=todas', {
      orders: [{ id: 'of-partial', codigo: 'OF-PARTIAL', molde_id: 'mold-partial' }],
      molds: [
        { id: 'mold-partial', codigo: 'M-ALC', nombre: 'Molde autorizado' },
        { id: 'mold-other', codigo: 'M-OTHER', nombre: 'Molde no relacionado' },
      ],
    });
    const row = await screen.findByRole('row', { name: /OT-PARTIAL-MOLD/ });
    expect(row).toHaveTextContent(/Molde autorizado/);
    expect(row).toHaveTextContent(/M-ALC/);
    expect(row).not.toHaveTextContent(/Molde no relacionado/);
  });

  it('keeps name primary while searching paired machine, center and mold identifiers', async () => {
    const user = userEvent.setup();
    mocks.listarOtScm.mockResolvedValueOnce({ items: [{
      public_id: 'ot-paired', codigo_ot: 'OT-PAIRED-001', tipo_ot: 'ENSAMBLE',
      estado: 'PLANIFICADA', fecha_operativa: '2026-10-19', turno: 'DIA',
      maquina_id: 'machine-1',
      centro_trabajo: { id: 'center-1', codigo: 'MESA-09', nombre: 'Mesa Norte' },
      molde: { id: 'mold-1', codigo: 'MOLD-09', nombre: 'Molde Norte' },
      trabajos_color: [{ molde: { id: 'mold-1', codigo: 'MOLD-09', nombre: 'Molde Norte' }, color: 'AZUL' }],
    }] });
    renderIndex('/produccion/ots-planta?vista=todas', {
      machines: [{ id: 'machine-1', codigo: 'INY-09', nombre: 'Inyectora Norte' }],
    });
    const search = await screen.findByLabelText('Omnibúsqueda');
    const row = () => screen.getByRole('row', { name: /OT-PAIRED-001/ });
    for (const query of ['Inyectora Norte', 'INY-09', 'machine-1', 'Mesa Norte', 'MESA-09', 'center-1', 'Molde Norte', 'MOLD-09', 'mold-1']) {
      await user.clear(search);
      await user.type(search, query);
      expect(row()).toBeVisible();
    }
    expect(row()).toHaveTextContent(/Mesa Norte/);
    expect(row()).toHaveTextContent(/MESA-09/);
    expect(row()).toHaveTextContent(/Molde Norte/);
    expect(row()).toHaveTextContent(/MOLD-09/);
  });

  it('does not collapse same-name machine resources and keeps each code/id searchable', async () => {
    const user = userEvent.setup();
    mocks.listarOtScm.mockResolvedValueOnce({ items: [
      {
        public_id: 'ot-machine-a', codigo_ot: 'OT-MACHINE-A', tipo_ot: 'FABRICACION',
        estado: 'PLANIFICADA', fecha_operativa: '2026-10-19', turno: 'DIA', maquina_id: 'machine-a',
      },
      {
        public_id: 'ot-machine-b', codigo_ot: 'OT-MACHINE-B', tipo_ot: 'FABRICACION',
        estado: 'PLANIFICADA', fecha_operativa: '2026-10-19', turno: 'DIA', maquina_id: 'machine-b',
      },
    ] });
    renderIndex('/produccion/ots-planta?vista=todas', {
      machines: [
        { id: 'machine-a', codigo: 'INY-01', nombre: 'Inyectora compartida' },
        { id: 'machine-b', codigo: 'INY-02', nombre: 'Inyectora compartida' },
      ],
    });
    const resourceFilter = await screen.findByLabelText('Máquina / centro');
    await user.click(resourceFilter);
    expect(screen.getByRole('option', { name: 'Inyectora compartida · INY-01' })).toBeVisible();
    expect(screen.getByRole('option', { name: 'Inyectora compartida · INY-02' })).toBeVisible();
    await user.click(screen.getByRole('option', { name: 'Inyectora compartida · INY-01' }));
    expect(screen.getByRole('row', { name: /OT-MACHINE-A/ })).toBeVisible();
    expect(screen.queryByRole('row', { name: /OT-MACHINE-B/ })).not.toBeInTheDocument();
    await user.click(resourceFilter);
    await user.click(screen.getByRole('option', { name: 'Todos los recursos' }));
    const search = await screen.findByLabelText('Omnibúsqueda');
    for (const [query, visible, hidden] of [
      ['INY-01', 'OT-MACHINE-A', 'OT-MACHINE-B'],
      ['machine-b', 'OT-MACHINE-B', 'OT-MACHINE-A'],
    ]) {
      await user.clear(search);
      await user.type(search, query);
      expect(screen.getByRole('row', { name: new RegExp(visible) })).toBeVisible();
      expect(screen.queryByRole('row', { name: new RegExp(hidden) })).not.toBeInTheDocument();
    }
  });

  it('shows recoverable error and retry', async () => {
    const user = userEvent.setup();
    mocks.listarOtScm.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce({ items: rows });
    renderIndex();
    expect(await screen.findByText('No se pudieron cargar todas las OT.')).toBeVisible();
    expect(screen.queryByText(/última carga válida sigue visible/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('row', { name: /OT-FAB-001/ })).toBeVisible();
    expect(mocks.listarOtScm).toHaveBeenCalledTimes(2);
  });

  it('marks a valid collection stale when a later refresh fails', async () => {
    mocks.listarOtScm.mockResolvedValueOnce({ items: rows }).mockRejectedValueOnce(new Error('down'));
    const view = render(
      <MemoryRouter initialEntries={['/produccion/ots-planta?vista=todas']}>
        <OtGlobalIndex reloadSignal={0} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('row', { name: /OT-FAB-001/ })).toBeVisible();
    view.rerender(
      <MemoryRouter initialEntries={['/produccion/ots-planta?vista=todas']}>
        <OtGlobalIndex reloadSignal={1} />
      </MemoryRouter>,
    );
    expect(await screen.findByText('No se pudieron cargar todas las OT.')).toBeVisible();
    expect(screen.getByText(/última carga válida sigue visible/i)).toBeVisible();
    expect(screen.getByRole('row', { name: /OT-FAB-001/ })).toBeVisible();
  });

  it('invalidates rows and refetches when the actor scope changes', async () => {
    mocks.listarOtScm
      .mockResolvedValueOnce({ items: rows })
      .mockResolvedValueOnce({ items: [rows[1]] });
    const view = render(
      <MemoryRouter initialEntries={['/produccion/ots-planta?vista=todas']}>
        <OtGlobalIndex actorId={1} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('row', { name: /OT-FAB-001/ })).toBeVisible();
    view.rerender(
      <MemoryRouter initialEntries={['/produccion/ots-planta?vista=todas']}>
        <OtGlobalIndex actorId={2} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('row', { name: /OT-ARM-001/ })).toBeVisible();
    expect(screen.queryByRole('row', { name: /OT-FAB-001/ })).not.toBeInTheDocument();
  });
});
