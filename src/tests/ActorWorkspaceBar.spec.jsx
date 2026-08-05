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

const renderBar = () => render(
  <ThemeProvider theme={createTheme()}>
    <ScmActorProvider>
      <ActorWorkspaceBar />
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

    expect(await screen.findByText('Luis Pinedo')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cambiar perfil' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByText('Luis Pinedo')).not.toBeInTheDocument();
    expect(within(dialog).getAllByText('Gerente General')).toHaveLength(2);
    await waitFor(() => expect(guardarActorScm).toHaveBeenCalledWith(1));
  });
});