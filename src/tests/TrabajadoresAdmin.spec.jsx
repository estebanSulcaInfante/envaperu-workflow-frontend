import { createTheme, ThemeProvider } from '@mui/material';
import {
  render, screen, waitFor, within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TrabajadoresAdmin from '../components/TrabajadoresAdmin';
import {
  crearTrabajadorWorkspace,
  listarRolesWorkspace,
  listarTrabajadoresWorkspace,
} from '../services/workspaceAdminApi';

const refreshActors = vi.fn();

vi.mock('../context/ScmActorContext', () => ({
  useScmActor: () => ({ refreshActors }),
}));

vi.mock('../services/workspaceAdminApi', () => ({
  actualizarTrabajadorWorkspace: vi.fn(),
  cambiarEstadoTrabajadorWorkspace: vi.fn(),
  crearTrabajadorWorkspace: vi.fn(),
  listarRolesWorkspace: vi.fn(),
  listarTrabajadoresWorkspace: vi.fn(),
}));

const renderPage = () => render(
  <ThemeProvider theme={createTheme()}>
    <TrabajadoresAdmin />
  </ThemeProvider>,
);

describe('Trabajadores con autorización administrativa local', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listarTrabajadoresWorkspace.mockResolvedValue([]);
    listarRolesWorkspace.mockResolvedValue([{ id: 7, codigo: 'AUDITOR', nombre: 'Auditor' }]);
    crearTrabajadorWorkspace.mockResolvedValue({ id: 20 });
  });

  it('usa el servicio administrativo para cargar y crear personas', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('heading', { name: 'Trabajadores' });
    expect(listarTrabajadoresWorkspace).toHaveBeenCalled();
    expect(listarRolesWorkspace).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Nuevo trabajador' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/^Apellidos/), 'Pérez');
    await user.type(within(dialog).getByLabelText(/^Nombres/), 'Ana');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(crearTrabajadorWorkspace).toHaveBeenCalledWith(expect.objectContaining({
      apellidos: 'Pérez',
      nombres: 'Ana',
    })));
  });
});
