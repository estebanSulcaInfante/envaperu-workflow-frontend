import { createTheme, ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import RoleHome from '../components/RoleHome';

let actorState;

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => actorState,
  useActorWorkspace: () => actorState.workspace,
}));

vi.mock('../components/Dashboard', () => ({
  default: () => <div>Situación operativa</div>,
}));

const feature = (index, overrides = {}) => ({
  key: `feature.${index}`,
  areaKey: index % 2 ? 'warehouse' : 'production',
  areaLabel: index % 2 ? 'Almacén e inventario' : 'Producción',
  label: `Función ${index}`,
  description: `Consulta y trabajo ${index}.`,
  path: `/feature/${index}`,
  pinned: false,
  ...overrides,
});

const renderHome = () => render(
  <ThemeProvider theme={createTheme()}>
    <MemoryRouter><RoleHome /></MemoryRouter>
  </ThemeProvider>,
);

describe('TS-010N2: Inicio parametrizado', () => {
  it('muestra el acceso principal, funciones fijadas y todas las demás sin truncar', () => {
    const all = Array.from({ length: 8 }, (_, index) => feature(index));
    all[1] = feature(1, { pinned: true });
    actorState = {
      actor: { nombre_corto: 'Ana' },
      can: () => false,
      workspace: {
        experience: { label: 'Rol nuevo', focus: 'Revisar la operación disponible.' },
        startFeature: all[0],
        homeFeatures: all,
        configurationWarnings: [],
      },
    };

    renderHome();

    expect(screen.getByRole('heading', { name: 'Hola, Ana' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Tu acceso principal' })).toBeVisible();
    expect(screen.getByRole('link', { name: /Abrir Función 0/i })).toHaveAttribute('href', '/feature/0');
    expect(screen.getByRole('heading', { name: 'Accesos prioritarios' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Más funciones' })).toBeVisible();
    expect(screen.getByRole('list', { name: 'Funciones de Producción' })).toBeVisible();
    expect(screen.getByRole('list', { name: 'Funciones de Almacén e inventario' })).toBeVisible();
    all.forEach((item) => expect(screen.getAllByText(item.label).length).toBeGreaterThan(0));
  });

  it('presenta advertencias estructuradas sin convertirlas en tareas ficticias', () => {
    actorState = {
      actor: { nombres: 'Equipo' },
      can: () => false,
      workspace: {
        experience: { label: 'Perfil operativo', focus: 'Consulta las funciones disponibles.' },
        startFeature: null,
        homeFeatures: [],
        configurationWarnings: [{
          code: 'PRIMARY_ROLE_MISSING',
          severity: 'info',
          message: 'Tu perfil principal aún no está definido.',
        }],
      },
    };

    renderHome();

    expect(screen.getByText('Tu perfil principal aún no está definido.')).toBeVisible();
    expect(screen.getByText(/No hay accesos de trabajo adicionales/i)).toBeVisible();
    expect(screen.queryByText(/pendientes/i)).not.toBeInTheDocument();
  });
});
