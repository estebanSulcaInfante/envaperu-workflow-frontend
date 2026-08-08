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
    render(
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
    expect(screen.getByText('Configurar OF')).toBeVisible();
    expect(screen.getByRole('link', { name: /2\. Fabricación Configurar OF/i }))
      .toHaveAttribute('aria-current', 'step');
  });
});
