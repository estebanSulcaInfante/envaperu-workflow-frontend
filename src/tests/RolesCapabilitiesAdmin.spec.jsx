import { createTheme, ThemeProvider } from '@mui/material';
import {
  render, screen, waitFor, within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RolesCapabilitiesAdmin from '../components/RolesCapabilitiesAdmin';
import {
  actualizarRolWorkspace,
  definirRolPrincipalWorkspace,
  listarCapacidadesWorkspace,
  listarRolesWorkspace,
  listarTrabajadoresWorkspace,
} from '../services/workspaceAdminApi';

vi.mock('../services/workspaceAdminApi', () => ({
  actualizarRolWorkspace: vi.fn(),
  crearRolWorkspace: vi.fn(),
  definirRolPrincipalWorkspace: vi.fn(),
  listarCapacidadesWorkspace: vi.fn(),
  listarRolesWorkspace: vi.fn(),
  listarTrabajadoresWorkspace: vi.fn(),
}));

const auditorRole = {
  id: 7,
  codigo: 'AUDITOR_INVENTARIO',
  nombre: 'Auditor de inventario',
  activo: true,
  capacidad_codigos: ['INVENTARIO_VER'],
  workspace_focus: 'Revisar existencias y movimientos trazables.',
  workspace_start_feature: 'warehouse.kardex',
  workspace_preferencias: [
    { feature_key: 'warehouse.kardex', prioridad: 10, fijada: true },
    { feature_key: 'production.fabrication', prioridad: 20, fijada: true },
  ],
  version: 2,
};

const setupResponses = () => {
  listarRolesWorkspace.mockResolvedValue([auditorRole]);
  listarCapacidadesWorkspace.mockResolvedValue([
    { id: 1, codigo: 'INVENTARIO_VER', nombre: 'Consultar inventario', activo: true },
    { id: 2, codigo: 'OF_VER', nombre: 'Consultar fabricación', activo: true },
  ]);
  listarTrabajadoresWorkspace.mockResolvedValue([
    {
      id: 15,
      nombre_completo: 'Persona multirrol',
      activo: true,
      roles: [
        { id: 7, nombre: 'Auditor de inventario', activo: true },
        { id: 8, nombre: 'Jefe de producción', activo: true },
      ],
      rol_principal: null,
    },
    {
      id: 16,
      nombre_completo: 'Persona con un rol',
      activo: true,
      roles: [{ id: 7, nombre: 'Auditor de inventario', activo: true }],
      rol_principal: null,
    },
  ]);
};

const renderAdmin = () => render(
  <ThemeProvider theme={createTheme()}>
    <RolesCapabilitiesAdmin />
  </ThemeProvider>,
);

describe('TS-010N2: administración de roles y capacidades', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupResponses();
  });

  it('previsualiza con la proyección pura sin cambiar la identidad activa', async () => {
    renderAdmin();

    expect(await screen.findByRole('heading', { name: 'Roles y capacidades' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Así verá este rol' })).toBeVisible();
    expect(screen.getByText(/Acceso principal:/)).toHaveTextContent('Kardex y existencias');
    expect(screen.getAllByText(/Fabricación · OF.*no está disponible/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Persona multirrol')).toBeVisible();
    expect(screen.getByText('Persona con un rol')).toBeVisible();
    expect(screen.getByRole('spinbutton', { name: 'Prioridad de Kardex y existencias' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Cambiar perfil' })).not.toBeInTheDocument();
  });

  it('envía capacidades, preferencias y versión esperada al actualizar', async () => {
    actualizarRolWorkspace.mockResolvedValue({ ...auditorRole, id: 7, version: 3 });
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByDisplayValue('Auditor de inventario');

    const focus = screen.getByLabelText('Foco del rol');
    await user.clear(focus);
    await user.type(focus, 'Auditar movimientos de inventario.');
    await user.click(screen.getByRole('button', { name: 'Retirar preferencia Fabricación · OF' }));
    expect(screen.queryByText(/Fabricación · OF.*no está disponible/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar rol' }));

    await waitFor(() => expect(actualizarRolWorkspace).toHaveBeenCalledWith(7, expect.objectContaining({
      codigo: 'AUDITOR_INVENTARIO',
      capacidad_codigos: ['INVENTARIO_VER'],
      workspace_focus: 'Auditar movimientos de inventario.',
      workspace_start_feature: 'warehouse.kardex',
      workspace_preferencias: [
        { feature_key: 'warehouse.kardex', prioridad: 10, fijada: true },
      ],
      expected_version: 2,
    })));
  });

  it('explica un conflicto de versión sin sobrescribir cambios concurrentes', async () => {
    actualizarRolWorkspace.mockRejectedValue({ response: { data: { code: 'VERSION_CONFLICT' } } });
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByDisplayValue('Auditor de inventario');

    await user.click(screen.getByRole('button', { name: 'Guardar rol' }));

    expect(await screen.findByText(/El rol cambió en otra sesión/i)).toBeVisible();
  });

  it('permite definir el principal de una persona multirrol', async () => {
    definirRolPrincipalWorkspace.mockResolvedValue({ id: 15, rol_principal: { id: 7 } });
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByText('Persona multirrol');

    await user.click(screen.getByLabelText('Rol principal de Persona multirrol'));
    await user.click(await screen.findByRole('option', { name: 'Auditor de inventario' }));
    await user.click(screen.getByRole('button', { name: 'Definir principal de Persona multirrol' }));

    await waitFor(() => expect(definirRolPrincipalWorkspace).toHaveBeenCalledWith(15, 7));
  });

  it('conserva visible un acceso inicial inelegible hasta que el administrador lo corrija', async () => {
    listarRolesWorkspace.mockResolvedValue([{
      ...auditorRole,
      workspace_start_feature: 'production.fabrication',
    }]);

    renderAdmin();

    expect(await screen.findByText('No disponible: production.fabrication')).toBeVisible();
    expect(screen.getByText(/acceso principal.*Fabricación · OF.*no está disponible/i)).toBeVisible();
  });

  it('previsualiza un rol inactivo sin sus capacidades ni preferencias', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByDisplayValue('Auditor de inventario');

    await user.click(screen.getByRole('switch', { name: 'Activo' }));

    const preview = screen.getByRole('region', { name: 'Así verá este rol' });
    expect(within(preview).getByText(/Un rol inactivo no aporta capacidades/i)).toBeVisible();
    expect(within(preview).queryByText('Kardex y existencias')).not.toBeInTheDocument();
  });
});
