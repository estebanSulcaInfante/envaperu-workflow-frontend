import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material';
import ActorWorkspaceBar from '../components/layout/ActorWorkspaceBar';
import { ScmActorProvider } from '../context/ScmActorContext';
import { getTrabajadores } from '../services/api';
import { guardarActorScm } from '../services/scmEngineeringApi';

vi.mock('../services/api', () => ({
  getTrabajadores: vi.fn(),
}));

vi.mock('../services/scmEngineeringApi', () => ({
  obtenerActorScm: vi.fn(() => 5),
  guardarActorScm: vi.fn((actorId) => Number(actorId)),
}));

const manager = {
  id: 1,
  codigo: 'TRB-000001',
  nombre_completo: 'Gerente General',
  nombre_corto: 'Gerente General',
  activo: true,
  capacidades_efectivas: ['AUTORIZACION_SCM_ADMINISTRAR'],
  roles: [{ codigo: 'GERENTE_GENERAL', nombre: 'Gerente General' }],
};

const warehouse = (activo) => ({
  id: 5,
  codigo: 'TRB-000005',
  nombre_completo: 'Luis Pinedo',
  nombre_corto: 'Luis P.',
  activo,
  capacidades_efectivas: ['RECEPCION_MANGA_CONFIRMAR'],
  roles: [{ codigo: 'ALMACEN_RECEPCION', nombre: 'Almacén / Recepción' }],
});

const renderBar = ({ mobile = false } = {}) => render(
  <ThemeProvider theme={createTheme()}>
    <ScmActorProvider>
      <ActorWorkspaceBar mobile={mobile} />
    </ScmActorProvider>
  </ThemeProvider>,
);

describe('selector de perfiles SCM', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refresca al abrir y excluye un participante que acaba de ser desactivado', async () => {
    getTrabajadores
      .mockResolvedValueOnce([manager, warehouse(true)])
      .mockResolvedValueOnce([manager, warehouse(false)]);

    const user = userEvent.setup();
    renderBar();

    expect(await screen.findByRole('button', { name: /Luis Pinedo/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Abrir cuenta de trabajo/ }));
    await user.click(screen.getByRole('menuitem', { name: /^Cambiar perfil/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByText('Luis Pinedo')).not.toBeInTheDocument();
    expect(within(dialog).getAllByText('Gerente General')).toHaveLength(2);
    await waitFor(() => expect(guardarActorScm).toHaveBeenCalledWith(1));
  });

  it('presenta la identidad como barra utilitaria compacta', async () => {
    getTrabajadores.mockResolvedValue([manager]);

    renderBar();

    expect(await screen.findByRole('region', { name: 'Sesión de trabajo' })).toBeVisible();
    expect(screen.getAllByText('Gerente General').length).toBeGreaterThan(0);
    expect(screen.queryByText('Trabajando como')).not.toBeInTheDocument();
  });

  it('elimina la tarjeta vertical de cuenta', async () => {
    getTrabajadores.mockResolvedValue([manager]);

    renderBar();

    expect(await screen.findByRole('button', { name: /Gerente General/ })).toBeInTheDocument();
    expect(document.querySelector('.MuiPaper-root')).not.toBeInTheDocument();
  });

  it('en móvil concentra identidad y acciones en el menú del avatar', async () => {
    getTrabajadores.mockResolvedValue([manager, warehouse(true)]);

    const user = userEvent.setup();
    renderBar({ mobile: true });

    const trigger = await screen.findByRole('button', { name: /Abrir cuenta de trabajo/i });
    await user.click(trigger);

    expect(await screen.findByRole('menu', { name: 'Acciones de cuenta' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: /^Cambiar perfil/ })).toBeVisible();
  });
});
