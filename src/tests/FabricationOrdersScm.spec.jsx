import { createTheme, ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import FabricationOrdersScm from '../components/FabricationOrdersScm';

vi.mock('../services/api', () => ({
  obtenerColores: vi.fn().mockResolvedValue([]),
  obtenerMaquinas: vi.fn().mockResolvedValue([]),
  obtenerMoldes: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/scmOtApi', () => ({
  configurarOrdenFabricacionScm: vi.fn(),
  liberarOrdenFabricacionScm: vi.fn(),
  listarOrdenesFabricacionScm: vi.fn().mockResolvedValue({ items: [] }),
}));

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    can: () => true,
    canAny: () => true,
    experience: { label: 'Gerencia' },
  }),
}));

import { listarOrdenesFabricacionScm } from '../services/scmOtApi';

describe('Órdenes de fabricación', () => {
  beforeEach(() => {
    listarOrdenesFabricacionScm.mockResolvedValue({ items: [] });
  });

  it('explica el siguiente paso cuando Planificación todavía no generó OF', async () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter>
          <FabricationOrdersScm />
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(await screen.findByText('Aún no hay órdenes de fabricación')).toBeVisible();
    expect(screen.queryByRole('combobox', { name: 'Orden de fabricación' }))
      .not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a Planificación' }))
      .toHaveAttribute('href', '/planificacion');
  });

  it('no confunde un fallo de carga con una colección vacía', async () => {
    listarOrdenesFabricacionScm.mockRejectedValueOnce(new Error('Servicio no disponible'));

    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter>
          <FabricationOrdersScm />
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(await screen.findByText('Servicio no disponible')).toBeVisible();
    expect(screen.queryByText('Aún no hay órdenes de fabricación')).not.toBeInTheDocument();
  });
});
