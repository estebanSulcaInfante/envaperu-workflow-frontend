import { createTheme, ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
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

    expect(screen.getByRole('link', { name: /Almacén e inventario/i })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: /Kardex y existencias/i })).toBeVisible();
    expect(screen.getByRole('link', { name: /Recepción y Calidad/i })).toBeVisible();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
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
