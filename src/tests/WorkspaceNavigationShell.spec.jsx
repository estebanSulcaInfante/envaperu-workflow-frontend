import { createTheme, ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Sidebar from '../components/Sidebar';
import FeatureAvailabilityRoute from '../components/FeatureAvailabilityRoute';

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({
    canAny: () => true,
    experience: { label: 'Gerente General' },
  }),
}));

const renderWithShell = (ui, path = '/produccion/kardex') => render(
  <ThemeProvider theme={createTheme()}>
    <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
  </ThemeProvider>,
);

describe('US-010N1: shell de navegación', () => {
  it('muestra áreas y secciones de Almacén sin pestañas horizontales', () => {
    renderWithShell(<Sidebar />);

    expect(screen.getByRole('button', { name: /Almacén e inventario/i }))
      .toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: /Kardex y existencias/i })).toBeVisible();
    expect(screen.getByRole('link', { name: /Kardex y existencias/i }))
      .toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Recepción y Calidad/i })).toBeVisible();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('despliega otra área sin navegar a una función arbitraria', async () => {
    const user = userEvent.setup();
    renderWithShell(<Sidebar />);

    const production = screen.getByRole('button', { name: /Producción/i });
    expect(production).toHaveAttribute('aria-expanded', 'false');

    await user.click(production);

    expect(production).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: /Fabricación · OF/i })).toBeVisible();
    expect(screen.getByRole('link', { name: /Armado · OA/i })).toBeVisible();
  });

  it('permite contraer el área activa sin anunciar un toggle inerte', async () => {
    const user = userEvent.setup();
    renderWithShell(<Sidebar />);

    const warehouse = screen.getByRole('button', { name: /Almacén e inventario/i });
    expect(warehouse).toHaveAttribute('aria-expanded', 'true');

    await user.click(warehouse);

    expect(warehouse).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: /Kardex y existencias/i }))
      .not.toBeInTheDocument();
  });

  it('no monta un corte fuera del piloto mediante URL directa', () => {
    renderWithShell(
      <FeatureAvailabilityRoute
        featureKey="external.receiving"
        runtimeFlags={{ allowOutOfPilot: false }}
      >
        <div>CRUD externo montado</div>
      </FeatureAvailabilityRoute>,
      '/materiales/recepciones',
    );

    expect(screen.queryByText('CRUD externo montado')).not.toBeInTheDocument();
    expect(screen.getByText(/no está habilitada en el piloto/i)).toBeVisible();
  });
});
