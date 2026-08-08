import { describe, expect, it, vi } from 'vitest';
import api from '../services/api';
import {
  listarCapacidadesWorkspace,
  workspaceAdminConfig,
} from '../services/workspaceAdminApi';
import { obtenerActorScm } from '../services/scmEngineeringApi';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() },
}));

vi.mock('../services/scmEngineeringApi', () => ({
  obtenerActorScm: vi.fn(() => 42),
}));

vi.mock('../config/runtime', () => ({
  SCM_AUTH_MODE: 'supabase',
}));

describe('API administrativa del workspace en Supabase', () => {
  it('delega identidad al Bearer global y nunca envía X-Actor-Id', async () => {
    api.get.mockResolvedValue({ data: [] });

    expect(workspaceAdminConfig()).toEqual({});
    await listarCapacidadesWorkspace();

    expect(api.get).toHaveBeenCalledWith('/catalogo/capacidades', {});
    expect(obtenerActorScm).not.toHaveBeenCalled();
  });
});
