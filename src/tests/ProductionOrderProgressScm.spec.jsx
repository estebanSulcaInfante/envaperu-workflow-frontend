import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductionOrderProgressScm from '../components/ProductionOrderProgressScm';
import { listarAvanceOfScm } from '../services/scmProductionObservabilityApi';

vi.mock('../services/scmProductionObservabilityApi', () => ({ listarAvanceOfScm: vi.fn() }));
vi.mock('../context/ScmActorContext', () => ({ useScmActor: () => ({ actorId: 1 }) }));

const renderView = () => render(<MemoryRouter><ProductionOrderProgressScm /></MemoryRouter>);

describe('estados honestos de avance OF', () => {
  beforeEach(() => vi.clearAllMocks());

  it('distingue metas y evidencia, mantiene abiertas separadas y calcula el medido', async () => {
    listarAvanceOfScm.mockResolvedValue({ items: [
      { corrida_id: 'missing', of: 'OF-M', objetivo_neto_kg: null, coverage: { estado: 'INCOMPLETA' }, mangas: { total: 0, conocidas: 0 } },
      { corrida_id: 'nonpositive', of: 'OF-Z', objetivo_neto_kg: 0, coverage: { estado: 'INCOMPLETA' }, mangas: { total: 0, conocidas: 0 } },
      { corrida_id: 'unweighed', of: 'OF-S', objetivo_neto_kg: 10, coverage: { estado: 'INCOMPLETA' }, mangas: { total: 0, conocidas: 0 } },
      { corrida_id: 'partial', of: 'OF-I', objetivo_neto_kg: 10, coverage: { estado: 'INCOMPLETA' }, mangas: { total: 2, conocidas: 1 }, kg_finalizados_efectivos: 4 },
      { corrida_id: 'valid', of: 'OF-V', objetivo_neto_kg: 10, kg_finalizados_efectivos: 4, kg_medidos_en_abiertas: 2, coverage: { estado: 'COMPLETA' }, mangas: { total: 2, conocidas: 2 } },
    ], as_of: '2026-09-29', visibilidad: { pesaje: true } });
    renderView();
    expect(await screen.findByText('OF-M')).toBeVisible();
    expect(screen.getByText('Consulta aplicada: 2026-09-29 · sin filtro')).toBeVisible();
    expect(screen.getByText('Meta no registrada')).toBeVisible();
    expect(screen.getByText('Meta no positiva')).toBeVisible();
    expect(screen.getByText('Sin pesajes')).toBeVisible();
    expect(screen.getByText('Datos de peso incompletos')).toBeVisible();
    expect(screen.getByText('Avance calculable')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Expandir OF-V' }));
    expect(screen.getByText(/En proceso:/)).toHaveTextContent(/2\.00\s*kg/);
    expect(screen.getByText('60.00%')).toBeVisible();
  });

  it('prioriza restricción de pesaje y no revela cantidades', async () => {
    listarAvanceOfScm.mockResolvedValue({
      items: [{ corrida_id: 'restricted', of: 'OF-R', objetivo_neto_kg: 10, kg_finalizados_efectivos: 4, kg_medidos_en_abiertas: 2, coverage: { estado: 'COMPLETA' }, mangas: { total: 2, conocidas: 2 } }],
      visibilidad: { pesaje: false, restriccion: 'MANGA_PESAJE_VER requerido para ver pesos' },
    });
    renderView();
    expect(await screen.findByText('Acceso restringido')).toBeVisible();
    expect(screen.queryByText('4.000')).not.toBeInTheDocument();
    expect(screen.queryByText('2.000')).not.toBeInTheDocument();
  });

  it('muestra medido y porcentaje aunque la cobertura de mangas sea parcial', async () => {
    listarAvanceOfScm.mockResolvedValue({
      items: [{
        corrida_id: 'of122', of: 'OF-000122', corrida: 'C-122', color: 'Melón Pastel',
        objetivo_neto_kg: 250, kg_finalizados_efectivos: 90.6,
        kg_medidos_en_abiertas: 1.1, kg_medidos_efectivos: 91.7,
        coverage: { estado: 'INCOMPLETA', motivos: ['SUBTOTAL_PARCIAL'] },
        mangas: { total: 10, conocidas: 9 },
      }],
      visibilidad: { pesaje: true }, as_of: '2026-10-29',
    });
    renderView();
    expect(await screen.findByText('OF-000122')).toBeVisible();
    expect(screen.getByText('91.70 kg')).toBeVisible();
    expect(screen.getByText('36.68%')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Expandir OF-000122' }));
    expect(screen.getByText(/Finalizados:/)).toHaveTextContent(/90\.60\s*kg/);
    expect(screen.getByText(/En proceso:/)).toHaveTextContent(/1\.10\s*kg/);
  });

  it('separa el físico observado cuando la atribución KG es incompleta', async () => {
    listarAvanceOfScm.mockResolvedValue({
      items: [{
        corrida_id: 'attribution', of: 'OF-ATTRIBUTION', objetivo_neto_kg: 250,
        kg_finalizados_efectivos: 45.4, kg_medidos_en_abiertas: 10.9,
        kg_medidos_efectivos: 56.3, peso_fisico_kg: 67.6,
        motivos_atribucion: ['ATRIBUCION_INCOMPLETA'],
        coverage: { estado: 'INCOMPLETA', motivos: ['SUBTOTAL_PARCIAL', 'ATRIBUCION_INCOMPLETA'] },
        mangas: { total: 3, conocidas: 2 },
      }],
      visibilidad: { pesaje: true }, as_of: '2026-10-29',
    });
    renderView();

    expect(await screen.findByText('OF-ATTRIBUTION')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Expandir OF-ATTRIBUTION' }));
    const warning = await screen.findByTestId('attribution-warning');
    expect(warning).toHaveTextContent('Físico observado: 67.60 kg');
    expect(warning).toHaveTextContent('avance atribuible: 56.30 kg');
  });

  it('trata una diferencia física sin motivo como información neutral', async () => {
    listarAvanceOfScm.mockResolvedValue({
      items: [{
        corrida_id: 'shared-physical', of: 'OF-SHARED', objetivo_neto_kg: 10,
        kg_finalizados_efectivos: 4, kg_medidos_efectivos: 4, peso_fisico_kg: 10,
        motivos_atribucion: [], coverage: { estado: 'COMPLETA', motivos: [] },
        mangas: { total: 1, conocidas: 1 },
      }],
      visibilidad: { pesaje: true }, as_of: '2026-10-29',
    });
    renderView();

    expect(await screen.findByText('OF-SHARED')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Expandir OF-SHARED' }));
    const notice = await screen.findByTestId('attribution-warning');
    expect(notice).toHaveTextContent('Diferencia informativa');
    expect(notice).not.toHaveTextContent('Atribución incompleta');
  });

  it('trata ceros sin mangas como sin pesajes y conserva peso real cuando falta la meta', async () => {
    listarAvanceOfScm.mockResolvedValue({
      items: [
        { corrida_id: 'no-target', of: 'OF-900', objetivo_neto_kg: null, kg_finalizados_efectivos: 11.9, kg_medidos_en_abiertas: 0.0, coverage: { estado: 'COMPLETA' }, mangas: { total: 1, conocidas: 1 } },
        { corrida_id: 'no-weighing', of: 'OF-002', objetivo_neto_kg: 68.0, kg_finalizados_efectivos: 0.0, kg_medidos_en_abiertas: 0.0, coverage: { estado: 'INCOMPLETA' }, mangas: { total: 0, conocidas: 0 } },
      ], visibilidad: { pesaje: true }, as_of: '2026-09-29',
    });
    renderView();
    expect(await screen.findByText('OF-900')).toBeVisible();
    expect(screen.getByText('Meta no registrada')).toBeVisible();
    expect(screen.getByText(/11\.90 kg/)).toBeVisible();
    expect(screen.getByText('Sin pesajes')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Expandir OF-900' }));
    expect(screen.getByText(/Evidencia: Evidencia completa/)).toBeVisible();
    expect(screen.queryByText('Datos de peso incompletos')).not.toBeInTheDocument();
  });

  it('conserva el filtro aplicado al editar y cuando falla una nueva consulta', async () => {
    listarAvanceOfScm.mockResolvedValueOnce({ items: [{ corrida_id: 'first', of: 'OF-1', objetivo_neto_kg: 10, kg_finalizados_efectivos: 10, coverage: { estado: 'COMPLETA' }, mangas: { total: 1, conocidas: 1 } }], as_of: '2026-09-29', visibilidad: { pesaje: true } });
    renderView();
    expect(await screen.findByText('OF-1')).toBeVisible();
    const input = screen.getByLabelText(/buscar of/i);
    fireEvent.change(input, { target: { value: 'OF-NUEVA' } });
    listarAvanceOfScm.mockRejectedValueOnce(new Error('network'));
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByText('No se pudo cargar el avance de OF.')).toBeVisible();
    expect(screen.getByText('Consulta aplicada: 2026-09-29 · sin filtro')).toBeVisible();
    expect(screen.getByText('OF-1')).toBeVisible();
  });

  it('expone reintento accionable después de un error', async () => {
    listarAvanceOfScm.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ items: [], visibilidad: { pesaje: true } });
    renderView();
    expect(await screen.findByText('No se pudo cargar el avance de OF.')).toBeVisible();
    expect(screen.queryByText('No hay objetivos de producción para mostrar.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(listarAvanceOfScm).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('No hay objetivos de producción para mostrar.')).toBeVisible();
  });
});
