import { ThemeProvider, createTheme } from '@mui/material';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FabricationObjectivesTable from '../components/FabricationObjectivesTable';
import FabricationProgressObjectivesTable from '../components/FabricationProgressObjectivesTable';

const renderTable = (progress, { savedObjective = '100', draftObjective = savedObjective, state = 'LIBERADA', canEdit = false } = {}) => {
  const run = { id: 'r1', codigo: 'C01', color_nombre: 'Rojo', objetivo_neto_kg: savedObjective, salidas: [] };
  return render(
    <ThemeProvider theme={createTheme()}>
      <FabricationObjectivesTable
        order={{ id: 'of-1', estado: state, corridas: [run] }}
        form={{ corridas: [{ objetivo_neto_kg: draftObjective, receta_revision_id: '' }] }}
        selectedMold={null}
        recipes={[]}
        canEdit={canEdit}
        progress={progress}
        onChangeRun={vi.fn()}
        onChangeOutput={vi.fn()}
        onOpenRecipe={undefined}
        expandedRuns={{}}
        onToggleRun={vi.fn()}
      />
    </ThemeProvider>,
  );
};

describe('tabla de objetivos de OF', () => {
  it('espera la primera respuesta diferida y conserva el snapshot durante refresh', () => {
    const order = { id: 'of-deferred', codigo: 'OF-DEFERRED', corridas: [{ id: 'r-deferred', codigo: 'C01', objetivo_neto_kg: '10', salidas: [] }] };
    const progress = [{ corrida_id: 'r-deferred', of: 'OF-DEFERRED', corrida: 'C01', objetivo_neto_kg: '10', kg_finalizados_efectivos: '4', coverage: { estado: 'COMPLETA' } }];
    const view = render(
      <ThemeProvider theme={createTheme()}>
        <FabricationProgressObjectivesTable items={[]} orders={[order]} loading />
      </ThemeProvider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Cargando objetivos');
    expect(screen.queryByText('OF-DEFERRED')).not.toBeInTheDocument();

    view.rerender(
      <ThemeProvider theme={createTheme()}>
        <FabricationProgressObjectivesTable items={progress} orders={[order]} loading />
      </ThemeProvider>,
    );
    expect(screen.getByText('OF-DEFERRED')).toBeVisible();
    expect(screen.getByTestId('fabrication-objective-comparison').querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('muestra Sin pesajes sin fabricar cero/meta cuando no hay mangas ni pesos', () => {
    renderTable({
      state: 'incomplete',
      label: 'Sin pesajes',
      rows: [{
        run: { id: 'r1', objetivo_neto_kg: '100' },
        progress: {
          corrida_id: 'r1', objetivo_neto_kg: '100', kg_medidos_efectivos: null,
          kg_finalizados_efectivos: null, kg_medidos_en_abiertas: '0',
          coverage: { estado: 'COMPLETA' }, mangas: { total: 0 },
        },
      }],
    });

    expect(screen.getByText('Sin pesajes')).toBeVisible();
    expect(screen.queryByText(/0\.00 \/ 100\.00 kg/)).not.toBeInTheDocument();
    expect(screen.queryByText(/100\.0%/)).not.toBeInTheDocument();
  });

  it('distingue meta nula de cero cuando el usuario edita un objetivo legado', () => {
    renderTable({ state: 'restricted', label: 'Avance restringido' }, {
      savedObjective: null, draftObjective: '10', state: 'BORRADOR', canEdit: true,
    });

    expect(screen.getByText(/Meta aún no guardada/)).toBeVisible();
    expect(screen.queryByText(/0\.00 kg guardados/)).not.toBeInTheDocument();
  });
});
