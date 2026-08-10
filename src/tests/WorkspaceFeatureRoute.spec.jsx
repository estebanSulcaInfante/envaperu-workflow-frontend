import { createTheme, ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import WorkspaceFeatureRoute from '../components/WorkspaceFeatureRoute';

let actorState;

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => actorState,
}));

const renderRoute = (featureKey, runtimeFlags) => render(
  <ThemeProvider theme={createTheme()}>
    <MemoryRouter>
      <WorkspaceFeatureRoute featureKey={featureKey} runtimeFlags={runtimeFlags}>
        <div>Vista operativa montada</div>
      </WorkspaceFeatureRoute>
    </MemoryRouter>
  </ThemeProvider>,
);

describe('guarda unificada por función del workspace', () => {
  it('no monta la vista mientras resuelve identidad y capacidades', () => {
    actorState = {
      actor: null,
      canAny: () => true,
      error: '',
      loading: true,
      refreshActors: vi.fn(),
    };

    renderRoute('production.fabrication');

    expect(screen.queryByText('Vista operativa montada')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Cargando permisos' })).toBeVisible();
  });

  it('consume las capacidades requeridas por la función registrada', () => {
    const canAny = vi.fn((required) => required.includes('OF_VER'));
    actorState = {
      actor: { nombre_corto: 'Jefe de Producción' },
      canAny,
      error: '',
      loading: false,
      refreshActors: vi.fn(),
    };

    renderRoute('production.fabrication');

    expect(screen.getByText('Vista operativa montada')).toBeVisible();
    expect(canAny).toHaveBeenCalledWith(['OF_VER']);
  });

  it('protege Supervisión de producción con OT_VER', () => {
    const canAny = vi.fn((required) => required.includes('OT_VER'));
    actorState = {
      actor: { nombre_corto: 'Supervisor' },
      canAny,
      error: '',
      loading: false,
      refreshActors: vi.fn(),
    };

    renderRoute('control.productionSupervision');

    expect(screen.getByText('Vista operativa montada')).toBeVisible();
    expect(canAny).toHaveBeenCalledWith(['OT_VER']);
  });

  it('falla cerrado y permite reintentar cuando no puede verificar identidad', () => {
    const refreshActors = vi.fn();
    actorState = {
      actor: null,
      canAny: () => true,
      error: 'No se pudo cargar la identidad.',
      loading: false,
      refreshActors,
    };

    renderRoute('production.fabrication');

    expect(screen.queryByText('Vista operativa montada')).not.toBeInTheDocument();
    expect(screen.getByText('No pudimos verificar tu acceso')).toBeVisible();
  });

  it('aplica la frontera de madurez antes de montar el módulo', () => {
    actorState = {
      actor: { nombre_corto: 'Compras' },
      canAny: () => true,
      error: '',
      loading: false,
      refreshActors: vi.fn(),
    };

    renderRoute('external.purchases', {
      showLegacy: false,
      allowPrototype: false,
      allowOutOfPilot: false,
    });

    expect(screen.queryByText('Vista operativa montada')).not.toBeInTheDocument();
    expect(screen.getByText(/no está habilitada en el piloto/i)).toBeVisible();
  });
});
