import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material';

const {
  requestAccess, useScmActor, useAuth, refreshActors, requestReauthentication, runtime,
} = vi.hoisted(() => ({
  requestAccess: vi.fn(),
  useScmActor: vi.fn(),
  useAuth: vi.fn(),
  refreshActors: vi.fn(),
  requestReauthentication: vi.fn(),
  runtime: {
    SCM_AUTH_MODE: 'supabase',
    SCM_PERSONAL_AGENT_ENABLED: true,
    SCM_PERSONAL_AGENT_ORIGIN: 'https://approvedbridge',
    SUPABASE_URL: 'https://supabase.example',
    SUPABASE_PUBLISHABLE_KEY: 'test-key',
  },
}));

vi.mock('../../services/scmPersonalAgentApi', () => ({
  requestPersonalAgentAccess: requestAccess,
}));

vi.mock('../../context/ScmActorContext', () => ({
  useScmActor,
}));
vi.mock('../../context/AuthContext', () => ({ useAuth }));

vi.mock('../../config/runtime', () => runtime);

import PersonalAgentAccess, {
  validatePersonalAgentExchangeUrl,
} from './PersonalAgentAccess';

const renderAccess = (autoStart = true) => render(
  <ThemeProvider theme={createTheme()}>
    <MemoryRouter><PersonalAgentAccess autoStart={autoStart} /></MemoryRouter>
  </ThemeProvider>,
);

const setActor = ({ actorId = 7, can = true, loading = false, error = '' } = {}) => {
  useScmActor.mockReturnValue({
    actor: { id: actorId },
    actorId,
    can: vi.fn(() => can),
    loading,
    error,
    refreshActors,
  });
};

describe('PersonalAgentAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtime.SCM_AUTH_MODE = 'supabase';
    runtime.SCM_PERSONAL_AGENT_ENABLED = true;
    runtime.SCM_PERSONAL_AGENT_ORIGIN = 'https://approvedbridge';
    setActor();
    useAuth.mockReturnValue({
      session: { access_token: 'token-A', user: { id: 'person-A' } },
      requestReauthentication,
    });
    refreshActors.mockResolvedValue(undefined);
    requestAccess.mockResolvedValue({
      exchange_url: 'https://approvedbridge/_scm/exchange',
      assertion: 'signed opaque',
    });
    vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
  });

  it('shows only for the production assistant capability', () => {
    renderAccess(false);
    expect(screen.getByRole('button', { name: 'Mi agente' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /OT|MANGA/i })).not.toBeInTheDocument();
  });

  it('hides without a live SCM session despite stale actor permissions', () => {
    useAuth.mockReturnValue({ session: null });
    renderAccess(false);
    expect(screen.queryByRole('button', { name: 'Mi agente' })).not.toBeInTheDocument();
  });

  it('does not hand off an in-flight response after the SCM session changes', async () => {
    let resolveRequest;
    requestAccess.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    const view = renderAccess();
    await waitFor(() => expect(requestAccess).toHaveBeenCalledOnce());
    useAuth.mockReturnValue({ session: null });
    view.rerender(<ThemeProvider theme={createTheme()}><MemoryRouter><PersonalAgentAccess autoStart /></MemoryRouter></ThemeProvider>);
    resolveRequest({ exchange_url: 'https://approvedbridge/_scm/exchange', assertion: 'stale' });
    await waitFor(() => expect(screen.getByText(/sesión SCM no está disponible/i)).toBeInTheDocument());
    expect(HTMLFormElement.prototype.submit).not.toHaveBeenCalled();
  });

  it('blocks retries and refreshes permissions after access is revoked', async () => {
    requestAccess.mockRejectedValue({ response: { status: 403 } });
    renderAccess();
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu permiso');
    expect(refreshActors).toHaveBeenCalledOnce();
  });

  it.each([
    ['local actor mode', { SCM_AUTH_MODE: 'local_actor' }],
    ['feature off', { SCM_PERSONAL_AGENT_ENABLED: false }],
    ['unauthorized actor', { can: false }],
    ['actor loading', { loading: true }],
    ['actor error', { error: 'No se pudo cargar' }],
  ])('hides for %s', (_label, overrides) => {
    if (overrides.SCM_AUTH_MODE) runtime.SCM_AUTH_MODE = overrides.SCM_AUTH_MODE;
    if (overrides.SCM_PERSONAL_AGENT_ENABLED !== undefined) {
      runtime.SCM_PERSONAL_AGENT_ENABLED = overrides.SCM_PERSONAL_AGENT_ENABLED;
    }
    setActor(overrides);
    renderAccess(false);
    expect(screen.queryByRole('button', { name: 'Mi agente' })).not.toBeInTheDocument();
  });

  it('posts through the authenticated API and submits one transient same-tab form', async () => {
    renderAccess();

    await waitFor(() => expect(requestAccess).toHaveBeenCalledWith(expect.any(AbortSignal)));
    expect(HTMLFormElement.prototype.submit).toHaveBeenCalledOnce();
    const form = HTMLFormElement.prototype.submit.mock.instances[0];
    expect(form.action).toBe('https://approvedbridge/_scm/exchange');
    expect(form.target).toBe('_self');
    expect(form.querySelector('input[name="assertion"]').value).toBe('signed opaque');
    expect(document.querySelector('form')).not.toBeInTheDocument();
  });

  it('does not issue a second request while access is preparing', async () => {
    let resolveRequest;
    requestAccess.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    renderAccess();
    await waitFor(() => expect(requestAccess).toHaveBeenCalledOnce());
    expect(requestAccess).toHaveBeenCalledOnce();
    expect(screen.getByText(/Preparando tu acceso seguro/i)).toBeVisible();
    resolveRequest({ exchange_url: 'https://approvedbridge/_scm/exchange', assertion: 'a' });
  });

  it.each([
    [401, 'Tu sesión SCM venció. Vuelve a iniciar sesión.'],
    [403, 'Tu permiso para usar Mi agente fue retirado. Reintenta desde SCM.'],
    [500, 'No se pudo preparar el acceso a Mi agente. Reintenta desde SCM.'],
  ])('shows recovery copy for HTTP %s', async (status, message) => {
    requestAccess.mockRejectedValue({ response: { status } });
    renderAccess();
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(HTMLFormElement.prototype.submit).not.toHaveBeenCalled();
  });

  it('revalidates the SCM session from the 401 recovery CTA', async () => {
    requestAccess.mockRejectedValue({ response: { status: 401 } });
    const user = userEvent.setup();
    renderAccess();
    const loginButton = await screen.findByRole('button', { name: 'Volver a iniciar sesión' });
    await user.click(loginButton);
    expect(requestReauthentication).toHaveBeenCalledOnce();
    expect(refreshActors).not.toHaveBeenCalled();
  });

  it('aborts and does not hand off when the actor changes mid-request', async () => {
    let resolveRequest;
    requestAccess.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    renderAccess();
    await waitFor(() => expect(requestAccess).toHaveBeenCalledOnce());
    globalThis.dispatchEvent(new CustomEvent('scm-actor-changed', { detail: { actorId: 8 } }));
    resolveRequest({ exchange_url: 'https://approvedbridge/_scm/exchange', assertion: 'a' });
    await waitFor(() => expect(requestAccess).toHaveBeenCalledOnce());
    expect(HTMLFormElement.prototype.submit).not.toHaveBeenCalled();
  });

  it('starts exactly once when the route is mounted in StrictMode', async () => {
    render(<ThemeProvider theme={createTheme()}><MemoryRouter><StrictMode><PersonalAgentAccess autoStart /></StrictMode></MemoryRouter></ThemeProvider>);
    await waitFor(() => expect(requestAccess).toHaveBeenCalledOnce());
    await waitFor(() => expect(HTMLFormElement.prototype.submit).toHaveBeenCalledOnce());
    expect(screen.queryByText(/Preparando tu acceso seguro/i)).not.toBeInTheDocument();
  });

  it('waits for actor readiness before starting the route handoff', async () => {
    setActor({ loading: true });
    const view = renderAccess();
    expect(requestAccess).not.toHaveBeenCalled();
    setActor({ loading: false });
    view.rerender(<ThemeProvider theme={createTheme()}><MemoryRouter><PersonalAgentAccess autoStart /></MemoryRouter></ThemeProvider>);
    await waitFor(() => expect(requestAccess).toHaveBeenCalledOnce());
  });

  it('shows a clear capability denial without requesting access', () => {
    setActor({ can: false });
    renderAccess();
    expect(screen.getByRole('alert')).toHaveTextContent('No tienes permiso para usar Mi agente. Solicita acceso al administrador de SCM.');
    expect(requestAccess).not.toHaveBeenCalled();
  });

  it('offers an explicit retry after a temporary failure', async () => {
    requestAccess.mockRejectedValueOnce({ response: { status: 503 } }).mockResolvedValueOnce({
      exchange_url: 'https://approvedbridge/_scm/exchange',
      assertion: 'retry assertion',
    });
    const user = userEvent.setup();
    renderAccess();
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(requestAccess).toHaveBeenCalledTimes(2));
    expect(HTMLFormElement.prototype.submit).toHaveBeenCalledOnce();
  });

  it('restarts once for a new valid session and actor without submitting stale data', async () => {
    let resolveStaleRequest;
    requestAccess
      .mockReturnValueOnce(new Promise((resolve) => { resolveStaleRequest = resolve; }))
      .mockResolvedValueOnce({
        exchange_url: 'https://approvedbridge/_scm/exchange',
        assertion: 'fresh assertion',
      });
    const view = renderAccess();
    await waitFor(() => expect(requestAccess).toHaveBeenCalledOnce());
    expect(requestAccess.mock.calls[0][0]).toBeInstanceOf(AbortSignal);

    useAuth.mockReturnValue({
      session: { access_token: 'token-B', user: { id: 'person-B' } },
      requestReauthentication,
    });
    setActor({ actorId: 8 });
    view.rerender(<ThemeProvider theme={createTheme()}><MemoryRouter><PersonalAgentAccess autoStart /></MemoryRouter></ThemeProvider>);
    resolveStaleRequest({
      exchange_url: 'https://approvedbridge/_scm/exchange',
      assertion: 'stale assertion',
    });

    await waitFor(() => expect(requestAccess).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(HTMLFormElement.prototype.submit).toHaveBeenCalledOnce());
    expect(requestAccess.mock.calls[0][0].aborted).toBe(true);
    expect(HTMLFormElement.prototype.submit.mock.instances[0]
      .querySelector('input[name="assertion"]').value).toBe('fresh assertion');
  });

  it('re-enters after a revoked capability is re-granted without a stale block', async () => {
    requestAccess
      .mockRejectedValueOnce({ response: { status: 403 } })
      .mockResolvedValueOnce({
        exchange_url: 'https://approvedbridge/_scm/exchange',
        assertion: 're-granted assertion',
      });
    const view = renderAccess();
    expect(await screen.findByRole('alert')).toHaveTextContent('Reintenta desde SCM');

    setActor({ can: false, loading: true });
    view.rerender(<ThemeProvider theme={createTheme()}><MemoryRouter><PersonalAgentAccess autoStart /></MemoryRouter></ThemeProvider>);
    expect(screen.getByText(/Verificando tu identidad/i)).toBeVisible();

    setActor({ can: true, loading: false });
    view.rerender(<ThemeProvider theme={createTheme()}><MemoryRouter><PersonalAgentAccess autoStart /></MemoryRouter></ThemeProvider>);
    await waitFor(() => expect(requestAccess).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(HTMLFormElement.prototype.submit).toHaveBeenCalledOnce());
  });

  it('accepts only the configured bridge origin and exact exchange path', () => {
    expect(validatePersonalAgentExchangeUrl('https://approvedbridge/_scm/exchange')).toBe(true);
    expect(validatePersonalAgentExchangeUrl('https://evil.example/_scm/exchange')).toBe(false);
    expect(validatePersonalAgentExchangeUrl('https://approvedbridge/_scm/exchange?next=https://evil.example')).toBe(false);
    expect(validatePersonalAgentExchangeUrl('https://approvedbridge/_scm/exchange#x')).toBe(false);
    expect(validatePersonalAgentExchangeUrl('https://approvedbridge.evil/_scm/exchange')).toBe(false);
    expect(validatePersonalAgentExchangeUrl('https://approvedbridge/_scm/other')).toBe(false);
    expect(validatePersonalAgentExchangeUrl('https://user:pass@approvedbridge/_scm/exchange')).toBe(false);
  });
});
