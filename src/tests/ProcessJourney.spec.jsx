import { createTheme, ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ProcessJourney from '../components/ui/ProcessJourney';

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({ canAny: () => true }),
}));

describe('Recorrido operativo del piloto', () => {
  it('se presenta como navegación y no afirma estados documentales', () => {
    const { rerender } = render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter>
          <ProcessJourney current="fabricacion" />
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(screen.getByText('Recorrido operativo')).toBeVisible();
    expect(screen.getByText('Navegación entre etapas')).toBeVisible();
    expect(screen.queryByText('OP aprobada')).not.toBeInTheDocument();
    expect(screen.queryByText('OF liberada')).not.toBeInTheDocument();
    expect(screen.getByText('OF y OA')).toBeVisible();
    expect(screen.getByText('2. Órdenes técnicas').closest('[aria-current]'))
      .toHaveAttribute('aria-current', 'step');
    expect(screen.queryByRole('link', { name: /2\. Órdenes técnicas/i })).not.toBeInTheDocument();

    rerender(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter>
          <ProcessJourney current="armado" />
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(screen.getByText('2. Órdenes técnicas')).toBeVisible();
    expect(screen.getByText('OF y OA')).toBeVisible();
    expect(screen.queryByText('2. Armado')).not.toBeInTheDocument();
    expect(screen.queryByText('2. Fabricación')).not.toBeInTheDocument();
  });
});
