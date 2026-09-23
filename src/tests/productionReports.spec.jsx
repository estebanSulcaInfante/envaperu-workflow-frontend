import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ProductionOrderProgressScm from '../components/ProductionOrderProgressScm';
import ProductionHistoryScm from '../components/ProductionHistoryScm';
import { listarAvanceOfScm, listarProduccionHistoricaScm } from '../services/scmProductionObservabilityApi';

vi.mock('../services/scmProductionObservabilityApi', () => ({
  listarAvanceOfScm: vi.fn(),
  listarProduccionHistoricaScm: vi.fn(),
  exportarProduccionHistoricaScm: vi.fn(),
}));

const renderInRouter = (element) => render(<MemoryRouter>{element}</MemoryRouter>);

describe('reportes de control de producción', () => {
  it('muestra avance jerárquico y cobertura sin criterio parejo', async () => {
    listarAvanceOfScm.mockResolvedValue({ items: [{ corrida_id: 'r1', of: 'OF-1', corrida: 'C-1', color: 'Rojo', objetivo_neto_kg: 10, kg_finalizados_efectivos: 4, porcentaje: 40, coverage: { estado: 'COMPLETA' }, mangas: { total: 1, conocidas: 1 }, criterio_uniformidad: 'Criterio de uniformidad no definido' }] });
    renderInRouter(<ProductionOrderProgressScm />);
    expect(await screen.findByText('Avance de OF')).toBeInTheDocument();
    expect(await screen.findByText('OF-1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expandir OF-1' }));
    expect(screen.getByText('Criterio de uniformidad no definido')).toBeInTheDocument();
    expect(screen.queryByText(/parejo/i)).not.toBeInTheDocument();
  });

  it('expone histórico con rango, medidas y estado vacío recuperable', async () => {
    listarProduccionHistoricaScm.mockResolvedValue({ items: [] });
    renderInRouter(<ProductionHistoryScm />);
    expect(await screen.findByText('Histórico de producción')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('No hay producción en el rango seleccionado.')).toBeInTheDocument());
    expect(screen.getByText('Exportar')).toBeInTheDocument();
    expect(screen.getByLabelText('Desde')).toBeInTheDocument();
  });
});
