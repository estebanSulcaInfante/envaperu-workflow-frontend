import { describe, expect, it, vi } from 'vitest';

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('./api', () => ({ default: { get, post } }));

import {
  getPersonalAgentState,
  requestPersonalAgentAccess,
} from './scmPersonalAgentApi';

describe('scmPersonalAgentApi', () => {
  it('requests a signed exchange assertion through the authenticated API client', async () => {
    const signal = new AbortController().signal;
    post.mockResolvedValueOnce({ data: { exchange_url: 'https://approvedbridge/_scm/exchange', assertion: 'signed opaque' } });

    await expect(requestPersonalAgentAccess(signal)).resolves.toEqual({
      exchange_url: 'https://approvedbridge/_scm/exchange',
      assertion: 'signed opaque',
    });
    expect(post).toHaveBeenCalledWith('/scm/v1/agente/acceso', undefined, { signal });
  });

  it('keeps the optional state read on the same authenticated API client', async () => {
    const signal = new AbortController().signal;
    get.mockResolvedValueOnce({ data: { status: 'ready' } });
    await expect(getPersonalAgentState(signal)).resolves.toEqual({ status: 'ready' });
    expect(get).toHaveBeenCalledWith('/scm/v1/agente/estado', { signal });
  });
});
