import { createTheme, ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Sidebar from '../components/Sidebar';
import { buildAreaNavigation, workspaceFeatures } from '../config/workspaceRegistry';

const { activateScanAudio } = vi.hoisted(() => ({
  activateScanAudio: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('../services/scmScanAudio', () => ({ activateScanAudio }));
vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({ canAny: () => true, experience: { label: 'Gerente General' } }),
  useActorWorkspace: () => ({
    features: workspaceFeatures,
    areas: buildAreaNavigation({ canAny: () => true }),
  }),
}));

function renderSidebar() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <MemoryRouter initialEntries={['/produccion/kardex']}>
        <Sidebar />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('Sidebar scan audio activation', () => {
  it('activates audio synchronously from the Armado navigation click', async () => {
    const user = userEvent.setup();
    renderSidebar();

    const warehouse = screen.getByRole('button', { name: /Almac.n e inventario/i });
    if (warehouse.getAttribute('aria-expanded') !== 'true') await user.click(warehouse);
    await user.click(screen.getByRole('link', { name: /Salidas y retornos de Armado/i }));

    expect(activateScanAudio).toHaveBeenCalledTimes(1);
  });
});
