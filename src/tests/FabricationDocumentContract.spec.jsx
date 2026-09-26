import { ThemeProvider, createTheme } from '@mui/material';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FabricationOrdersScm from '../components/FabricationOrdersScm';
import FabricationObjectivesTable from '../components/FabricationObjectivesTable';
import { projectOrderProgress } from '../components/fabricationOrdersModel';

const api = vi.hoisted(() => ({
  list: vi.fn(), detail: vi.fn(), progress: vi.fn(), release: vi.fn(),
  moldes: vi.fn(), maquinas: vi.fn(), colores: vi.fn(), recetas: vi.fn(),
}));
vi.mock('../services/api', () => ({
  obtenerColores: api.colores, obtenerMaquinas: api.maquinas,
  obtenerMoldes: api.moldes, obtenerRecetasColorMaestras: api.recetas, obtenerMolde: vi.fn(),
}));
vi.mock('../services/scmOtApi', () => ({
  listarOrdenesFabricacionScm: api.list, obtenerOrdenFabricacionScm: api.detail,
  liberarOrdenFabricacionScm: api.release,
  anularOrdenFabricacionScm: vi.fn(), reemplazarOrdenFabricacionScm: vi.fn(),
  cerrarOrdenFabricacionScm: vi.fn(), configurarOrdenFabricacionScm: vi.fn(),
  crearOrdenFabricacionExcepcionalScm: vi.fn(),
}));
vi.mock('../services/scmProductionObservabilityApi', () => ({ listarAvanceOfScm: api.progress }));
vi.mock('../services/scmEngineeringApi', () => ({
  mensajeErrorScm: (error, fallback) => error?.message || fallback,
  obtenerActorScm: () => 1, listarArticulosScm: vi.fn().mockResolvedValue([]),
}));
vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({ can: () => true, canAny: () => true, experience: { label: 'QA local' } }),
}));

const runs = [
  { id: 'r1', codigo: 'C01', objetivo_neto_kg: '100', color_nombre: 'Rojo', salidas: [] },
  { id: 'r2', codigo: 'C02', objetivo_neto_kg: '100', color_nombre: 'Verde', salidas: [] },
];
const order = { id: 'of-1', codigo: 'OF-DS02', estado: 'BORRADOR', version: 1, molde_id: 'M-1', corridas: runs };
const theme = createTheme();

describe('contrato de documento OF DS02', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockResolvedValue({ items: [order] });
    api.detail.mockResolvedValue(order);
    api.progress.mockResolvedValue({ items: [] });
    api.moldes.mockResolvedValue([{ codigo: 'M-1', nombre: 'Molde de prueba', activo: true, formas: [] }]);
    api.maquinas.mockResolvedValue([]);
    api.colores.mockResolvedValue([]);
    api.recetas.mockResolvedValue({ items: [] });
  });

  it('identifica una OF y conserva dos metas editadas sin permitir liberar datos viejos', async () => {
    const user = userEvent.setup();
    render(<ThemeProvider theme={theme}><MemoryRouter initialEntries={['/produccion/ordenes-fabricacion?of=of-1']}><FabricationOrdersScm /></MemoryRouter></ThemeProvider>);
    expect(await screen.findByRole('heading', { level: 1, name: 'OF-DS02' })).toBeVisible();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole('combobox', { name: 'Orden de fabricación' })).not.toBeInTheDocument();
    const first = screen.getByRole('spinbutton', { name: 'Objetivo neto (kg) · 1' });
    const second = screen.getByRole('spinbutton', { name: 'Objetivo neto (kg) · 2' });
    await user.clear(first);
    await user.type(first, '120');
    await user.clear(second);
    await user.type(second, '130');
    await user.click(screen.getByRole('button', { name: 'Mostrar composición de Rojo' }));
    await user.click(screen.getByRole('button', { name: 'Mostrar composición de Verde' }));
    expect(first).toHaveValue(120);
    expect(second).toHaveValue(130);
    expect(screen.getByRole('button', { name: 'Ocultar composición de Rojo' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Ocultar composición de Verde' })).toHaveAttribute('aria-expanded', 'true');
    const release = screen.getByRole('button', { name: 'Liberar OF' });
    expect(release).toBeDisabled();
    fireEvent.click(release);
    expect(api.release).not.toHaveBeenCalled();
    expect(screen.getByText(/Guarda los cambios pendientes antes de liberar/)).toBeVisible();
  });

  it('conserva el avance por color y su meta guardada cuando otra fila carece de pesajes', () => {
    const items = [
      { corrida_id: 'r1', objetivo_neto_kg: '100', kg_medidos_efectivos: '85', kg_finalizados_efectivos: '80', kg_medidos_en_abiertas: '5', coverage: { estado: 'COMPLETA' }, mangas: { total: 2 } },
      { corrida_id: 'r2', objetivo_neto_kg: '100', kg_medidos_efectivos: null, kg_finalizados_efectivos: null, kg_medidos_en_abiertas: '0', coverage: { estado: 'INCOMPLETA' }, mangas: { total: 0 } },
    ];
    render(<ThemeProvider theme={theme}><FabricationObjectivesTable
      order={order} form={{ corridas: [{ objetivo_neto_kg: '120' }, { objetivo_neto_kg: '100' }] }}
      selectedMold={null} recipes={[]} canEdit
      progress={projectOrderProgress(order, items)}
      onChangeRun={vi.fn()} onChangeOutput={vi.fn()} expandedRuns={{}} onToggleRun={vi.fn()}
    /></ThemeProvider>);
    const redRow = screen.getByRole('row', { name: /Rojo.*C01/ });
    const greenRow = screen.getByRole('row', { name: /Verde.*C02/ });
    expect(within(redRow).getByText('80.00 / 100.00 kg')).toBeVisible();
    expect(within(redRow).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '80');
    expect(within(redRow).getByText('5.00 kg en abiertas')).toBeVisible();
    expect(within(greenRow).getByText('Sin pesajes')).toBeVisible();
    expect(within(greenRow).queryByRole('progressbar')).not.toBeInTheDocument();
    expect(within(greenRow).queryByText('0.00 / 100.00 kg')).not.toBeInTheDocument();
    expect(screen.getByText(/Avance global: 80\.00 kg finalizados conocidos/)).toBeVisible();
    expect(screen.queryByText('80.00 / 120.00 kg')).not.toBeInTheDocument();
  });

  it('mantiene la formulación de una OF liberada en consulta aunque el actor pueda administrar recetas', () => {
    render(<ThemeProvider theme={theme}><FabricationObjectivesTable
      order={{ ...order, estado: 'LIBERADA' }}
      form={{ corridas: [{ objetivo_neto_kg: '100' }, { objetivo_neto_kg: '100' }] }}
      selectedMold={null} recipes={[]} canEdit onOpenRecipe={vi.fn()}
      progress={{ state: 'restricted', label: 'Avance restringido' }}
      onChangeRun={vi.fn()} onChangeOutput={vi.fn()} expandedRuns={{}} onToggleRun={vi.fn()}
    /></ThemeProvider>);
    expect(screen.queryByRole('button', { name: 'Crear o editar aquí' })).not.toBeInTheDocument();
    screen.getAllByRole('spinbutton').forEach((input) => expect(input).toBeDisabled());
  });
});
