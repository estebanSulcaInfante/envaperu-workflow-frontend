import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material';

const { requestAccess, useScmActor, useAuth, refreshActors, runtime } = vi.hoisted(() => ({
  requestAccess: vi.fn(),
  useScmActor: vi.fn(),
  useAuth: vi.fn(),
  refreshActors: vi.fn(),
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

const renderAccess = () => render(
  <ThemeProvider theme={createTheme()}>
    <PersonalAgentAccess />
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
    useAuth.mockReturnValue({ session: { access_token: 'token-A', user: { id: 'person-A' } } });
    refreshActors.mockResolvedValue(undefined);
    requestAccess.mockResolvedValue({
      exchange_url: 'https://approvedbridge/_scm/exchange',
      assertion: 'signed opaque',
    });
    vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
  });

  it('shows only for the production assistant capability', () => {
    renderAccess();
    expect(screen.getByRole('button', { name: 'Mi agente' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /OT|MANGA/i })).not.toBeInTheDocument();
  });

  it('hides without a live SCM session despite stale actor permissions', () => {
    useAuth.mockReturnValue({ session: null });
    renderAccess();
    expect(screen.queryByRole('button', { name: 'Mi agente' })).not.toBeInTheDocument();
  });

  it('does not hand off an in-flight response after the SCM session changes', async () => {
    let resolveRequest;
    requestAccess.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    const user = userEvent.setup();
    const view = renderAccess();
    await user.click(screen.getByRole('button', { name: 'Mi agente' }));
    useAuth.mockReturnValue({ session: null });
    view.rerender(<ThemeProvider theme={createTheme()}><PersonalAgentAccess /></ThemeProvider>);
    resolveRequest({ exchange_url: 'https://approvedbridge/_scm/exchange', assertion: 'stale' });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Mi agente' })).not.toBeInTheDocument());
    expect(HTMLFormElement.prototype.submit).not.toHaveBeenCalled();
  });

  it('blocks retries and refreshes permissions after access is revoked', async () => {
    requestAccess.mockRejectedValue({ response: { status: 403 } });
    const user = userEvent.setup();
    renderAccess();
    await user.click(screen.getByRole('button', { name: 'Mi agente' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu permiso');
    expect(screen.queryByRole('button', { name: 'Mi agente' })).not.toBeInTheDocument();
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
    renderAccess();
    expect(screen.queryByRole('button', { name: 'Mi agente' })).not.toBeInTheDocument();
  });

  it('posts through the authenticated API and submits one transient same-tab form', async () => {
    const user = userEvent.setup();
    renderAccess();

    await user.click(screen.getByRole('button', { name: 'Mi agente' }));

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
    const user = userEvent.setup();
    renderAccess();
    const button = screen.getByRole('button', { name: 'Mi agente' });

    await user.click(button);
    fireEvent.click(button);
    expect(requestAccess).toHaveBeenCalledOnce();
    expect(button).toBeDisabled();
    resolveRequest({ exchange_url: 'https://approvedbridge/_scm/exchange', assertion: 'a' });
  });

  it.each([
    [401, 'Tu sesión SCM venció. Vuelve a iniciar sesión.'],
    [403, 'Tu permiso para usar Mi agente fue retirado. Vuelve a SCM.'],
    [500, 'No se pudo preparar el acceso a Mi agente. Reintenta desde SCM.'],
  ])('shows recovery copy for HTTP %s', async (status, message) => {
    requestAccess.mockRejectedValue({ response: { status } });
    const user = userEvent.setup();
    renderAccess();
    await user.click(screen.getByRole('button', { name: 'Mi agente' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(HTMLFormElement.prototype.submit).not.toHaveBeenCalled();
  });

  it('aborts and does not hand off when the actor changes mid-request', async () => {
    let resolveRequest;
    requestAccess.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    const user = userEvent.setup();
    renderAccess();
    await user.click(screen.getByRole('button', { name: 'Mi agente' }));
    globalThis.dispatchEvent(new CustomEvent('scm-actor-changed', { detail: { actorId: 8 } }));
    resolveRequest({ exchange_url: 'https://approvedbridge/_scm/exchange', assertion: 'a' });
    await waitFor(() => expect(requestAccess).toHaveBeenCalledOnce());
    expect(HTMLFormElement.prototype.submit).not.toHaveBeenCalled();
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
