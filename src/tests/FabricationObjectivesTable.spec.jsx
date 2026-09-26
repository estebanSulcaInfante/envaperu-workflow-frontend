import { ThemeProvider, createTheme } from '@mui/material';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FabricationObjectivesTable from '../components/FabricationObjectivesTable';

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
