import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PortfolioDemoHub from '../components/portfolioDemo/PortfolioDemoHub';
import {
  getPortfolioDemoStatus,
  resetPortfolioDemo,
} from '../services/portfolioDemoApi';

const applyActor = vi.fn();
const refreshActors = vi.fn().mockResolvedValue(undefined);

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    actors: [
      { id: 2, codigo: 'TRB-002' },
      { id: 3, codigo: 'TRB-003' },
      { id: 4, codigo: 'TRB-004' },
      { id: 8, codigo: 'TRB-008' },
    ],
    applyActor,
    refreshActors,
  }),
}));

vi.mock('../services/portfolioDemoApi', () => ({
  getPortfolioDemoStatus: vi.fn(),
  resetPortfolioDemo: vi.fn(),
}));

const status = {
  status: 'ready',
  counts: {
    actors: 10,
    articles: 4,
    production_orders: 1,
    operation_orders: 2,
    mangas: 2,
    weighings: 1,
    inventory_movements: 2,
  },
  highlights: { active_ot: 'OT-000001' },
};

const renderHub = () => render(
  <ThemeProvider theme={createTheme()}>
    <MemoryRouter>
      <PortfolioDemoHub />
    </MemoryRouter>
  </ThemeProvider>,
);

describe('recorrido público del piloto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPortfolioDemoStatus.mockResolvedValue(status);
    resetPortfolioDemo.mockResolvedValue(status);
  });

  it('expone el proceso por evidencia y distingue el hardware simulado', async () => {
    renderHub();

    expect(screen.getByRole('heading', { name: 'Recorrido del primer piloto SCM' })).toBeVisible();
    expect(await screen.findByText('10')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Ingeniería y maestros' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Almacén, Calidad y Kardex' })).toBeVisible();
    expect(screen.getByText('Hardware simulado')).toBeVisible();
    expect(screen.getAllByRole('button', { name: 'Abrir evidencia' })).toHaveLength(5);
  });

  it('restablece los datos solamente después de confirmarlo', async () => {
    const user = userEvent.setup();
    renderHub();

    await user.click(screen.getByRole('button', { name: 'Restablecer demo' }));
    const confirmation = await screen.findByRole('dialog', { name: 'Restablecer escenario' });
    await user.click(screen.getByRole('button', { name: 'Restablecer' }));

    expect(resetPortfolioDemo).toHaveBeenCalledTimes(1);
    expect(refreshActors).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(confirmation).not.toBeInTheDocument());
  });
});
