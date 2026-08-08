import { createTheme, ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ProcessJourney from '../components/ui/ProcessJourney';

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({ canAny: () => true }),
}));

describe('Recorrido operativo del piloto', () => {
  it('resume la etapa actual y deja el mapa completo bajo demanda', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter>
          <ProcessJourney current="fabricacion" />
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(screen.getByText('Recorrido operativo')).toBeVisible();
    expect(screen.getByText(/Etapa actual: 2\. Órdenes técnicas/i)).toBeVisible();
    expect(screen.queryByText('OP aprobada')).not.toBeInTheDocument();
    expect(screen.queryByText('OF liberada')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver etapas' }))
      .toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: /1\. Demanda/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ver etapas' }));

    expect(screen.getByRole('button', { name: 'Ocultar etapas' }))
      .toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: /1\. Demanda/i })).toBeVisible();
    expect(screen.getByText('2. Órdenes técnicas').closest('[aria-current]'))
      .toHaveAttribute('aria-current', 'step');
  });

  it('muestra el mapa abierto en Planificación sin desplazamiento horizontal obligatorio', () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter>
          <ProcessJourney current="demanda" />
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(screen.getByRole('button', { name: 'Ocultar etapas' }))
      .toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('process-journey-steps')).not.toHaveStyle({ minWidth: '760px' });
  });
});
