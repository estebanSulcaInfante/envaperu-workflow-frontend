import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material';

const { getSupabaseClient, runtime, supabase } = vi.hoisted(() => ({
  getSupabaseClient: vi.fn(),
  runtime: {
    SCM_AUTH_MODE: 'supabase',
    SUPABASE_URL: 'https://supabase.example',
    SUPABASE_PUBLISHABLE_KEY: 'test-key',
  },
  supabase: {
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}));

vi.mock('../config/runtime', () => runtime);
vi.mock('../auth/supabaseClient', () => ({ getSupabaseClient }));

import { AuthProvider, useAuth } from './AuthContext';
import AuthGate from '../components/auth/AuthGate';

const session = (accessToken) => ({ access_token: accessToken, user: { id: 'person-A' } });

function Probe() {
  const { requestReauthentication, session: currentSession } = useAuth();
  return (
    <>
      <div data-testid="workspace">{currentSession?.access_token || 'signed-out'}</div>
      <button type="button" onClick={requestReauthentication}>Pedir reautenticación</button>
    </>
  );
}

const renderAuth = () => render(
  <ThemeProvider theme={createTheme()}>
    <AuthProvider>
      <AuthGate><Probe /></AuthGate>
    </AuthProvider>
  </ThemeProvider>,
);

describe('AuthContext reauthentication gate', () => {
  let authStateChange;

  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseClient.mockReturnValue(supabase);
    supabase.auth.getSession.mockResolvedValue({ data: { session: session('token-A') }, error: null });
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'person-A' } }, error: null });
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { session: session('token-B') },
      error: null,
    });
    supabase.auth.onAuthStateChange.mockImplementation((callback) => {
      authStateChange = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
  });

  it('shows the existing login after a local reauthentication request without network refresh', async () => {
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('workspace')).toHaveTextContent('token-A'));
    fireEvent.click(screen.getByRole('button', { name: 'Pedir reautenticación' }));
    expect(await screen.findByRole('textbox', { name: 'Correo' })).toBeVisible();
    expect(supabase.auth.getSession).toHaveBeenCalledOnce();
    expect(supabase.auth.getUser).toHaveBeenCalledOnce();
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  it('keeps login visible through TOKEN_REFRESHED and an uncorrelated SIGNED_IN event', async () => {
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('workspace')).toHaveTextContent('token-A'));
    fireEvent.click(screen.getByRole('button', { name: 'Pedir reautenticación' }));

    act(() => authStateChange('TOKEN_REFRESHED', session('token-B')));
    expect(await screen.findByRole('textbox', { name: 'Correo' })).toBeVisible();

    act(() => authStateChange('SIGNED_IN', session('token-B')));
    expect(await screen.findByRole('textbox', { name: 'Correo' })).toBeVisible();
    expect(supabase.auth.getUser).toHaveBeenCalledOnce();
  });

  it('keeps the flag and SDK session after rejected credentials or a network failure', async () => {
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('workspace')).toHaveTextContent('token-A'));
    fireEvent.click(screen.getByRole('button', { name: 'Pedir reautenticación' }));
    const email = await screen.findByRole('textbox', { name: 'Correo' });
    fireEvent.change(email, { target: { value: 'person@example.com' } });
    fireEvent.change(document.querySelector('input[type="password"]'), { target: { value: 'wrong' } });

    supabase.auth.signInWithPassword.mockResolvedValueOnce({ error: { message: 'invalid login' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Correo' })).toBeVisible();
    expect(supabase.auth.getSession).toHaveBeenCalledOnce();
    expect(supabase.auth.getUser).toHaveBeenCalledOnce();

    supabase.auth.signInWithPassword.mockRejectedValueOnce(new Error('network down'));
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByText('No pudimos iniciar sesión. Inténtalo nuevamente.')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Correo' })).toBeVisible();
    expect(supabase.auth.getSession).toHaveBeenCalledOnce();
    expect(supabase.auth.getUser).toHaveBeenCalledOnce();
  });

  it('uses the returned session before clearing reauthentication, without an auth event', async () => {
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('workspace')).toHaveTextContent('token-A'));
    fireEvent.click(screen.getByRole('button', { name: 'Pedir reautenticación' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Correo' }), { target: { value: 'person@example.com' } });
    fireEvent.change(document.querySelector('input[type="password"]'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => expect(screen.getByTestId('workspace')).toHaveTextContent('token-B'));
    expect(screen.queryByRole('textbox', { name: 'Correo' })).not.toBeInTheDocument();
    expect(supabase.auth.getUser).toHaveBeenCalledOnce();
  });

  it('does not clear reauthentication when sign-in reports no error but no session', async () => {
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('workspace')).toHaveTextContent('token-A'));
    fireEvent.click(screen.getByRole('button', { name: 'Pedir reautenticación' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Correo' }), { target: { value: 'person@example.com' } });
    fireEvent.change(document.querySelector('input[type="password"]'), { target: { value: 'secret' } });
    supabase.auth.signInWithPassword.mockResolvedValueOnce({ data: { session: null }, error: null });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(await screen.findByText('No pudimos iniciar sesión. Inténtalo nuevamente.')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Correo' })).toBeVisible();
    expect(screen.queryByTestId('workspace')).not.toBeInTheDocument();
  });

  it('clears the flag after successful password sign-in without another user lookup', async () => {
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('workspace')).toHaveTextContent('token-A'));
    fireEvent.click(screen.getByRole('button', { name: 'Pedir reautenticación' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Correo' }), { target: { value: 'person@example.com' } });
    fireEvent.change(document.querySelector('input[type="password"]'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await waitFor(() => expect(screen.getByTestId('workspace')).toHaveTextContent('token-B'));
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledOnce();
    expect(supabase.auth.getUser).toHaveBeenCalledOnce();
  });
});
