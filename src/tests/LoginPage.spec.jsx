import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from '../components/auth/LoginPage';

const authState = vi.hoisted(() => ({
  error: '',
  signIn: vi.fn(async () => true),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState,
}));

describe('inicio de sesión SCM', () => {
  beforeEach(() => {
    authState.error = '';
    authState.signIn.mockClear();
  });

  it('envía correo y contraseña al contexto de autenticación', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/Correo/), 'uat@envaperu.pe');
    await user.type(screen.getByLabelText(/Contraseña/), 'frase-segura');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(authState.signIn).toHaveBeenCalledWith(
      'uat@envaperu.pe',
      'frase-segura',
    );
  });

  it('muestra el error de autenticación sin revelar detalles técnicos', () => {
    authState.error = 'Correo o contraseña incorrectos.';
    render(<LoginPage />);

    expect(screen.getByText('Correo o contraseña incorrectos.')).toBeInTheDocument();
  });
});
