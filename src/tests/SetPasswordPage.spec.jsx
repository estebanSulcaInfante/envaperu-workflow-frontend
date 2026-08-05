import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SetPasswordPage from '../components/auth/SetPasswordPage';

const authState = vi.hoisted(() => ({
  error: '',
  updatePassword: vi.fn(async () => true),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState,
}));

describe('establecimiento de contraseña', () => {
  beforeEach(() => {
    authState.error = '';
    authState.updatePassword.mockClear();
  });

  it('exige coincidencia y una longitud mínima antes de guardar', async () => {
    const user = userEvent.setup();
    render(<SetPasswordPage />);

    await user.type(screen.getByLabelText(/Nueva contraseña/), 'clave-segura-2026');
    await user.type(screen.getByLabelText(/Confirmar contraseña/), 'clave-segura-2026');
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

    expect(authState.updatePassword).toHaveBeenCalledWith('clave-segura-2026');
  });
});
