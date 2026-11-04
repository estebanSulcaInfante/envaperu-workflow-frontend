import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from '../components/auth/LoginPage';
import { FeedbackProvider } from '../context/FeedbackContext';
import { ThemeProvider, createTheme } from '@mui/material';

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

  it('retira el aviso al recuperarse y no lo arrastra a la sesión autenticada', async () => {
    authState.error = 'Correo o contraseña incorrectos.';
    const page = (scope, children) => <ThemeProvider theme={createTheme()}><FeedbackProvider scopeKey={scope}>{children}</FeedbackProvider></ThemeProvider>;
    const { rerender } = render(page('auth:login', <LoginPage />));
    expect(await screen.findByRole('alert', { name: 'Correo o contraseña incorrectos.' })).toBeVisible();
    authState.error = '';
    rerender(page('auth:login', <LoginPage />));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    authState.error = 'Correo o contraseña incorrectos.';
    rerender(page('auth:login', <LoginPage />));
    expect(await screen.findByRole('alert', { name: 'Correo o contraseña incorrectos.' })).toBeVisible();
    rerender(page('auth:authenticated', <p>Sesión iniciada</p>));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.getByText('Sesión iniciada')).toBeVisible();
  });
});
