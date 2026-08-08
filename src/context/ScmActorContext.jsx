import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { getCurrentActor, getTrabajadores } from '../services/api';
import {
  guardarActorScm,
  obtenerActorScm,
} from '../services/scmEngineeringApi';
import { SCM_AUTH_MODE } from '../config/runtime';
import {
  buildActorWorkspace,
  GENERIC_WORKSPACE_EXPERIENCE,
} from '../services/workspaceProjection';

const STANDALONE_WORKSPACE = {
  primaryRole: null,
  experience: { ...GENERIC_WORKSPACE_EXPERIENCE },
  areas: [],
  features: [],
  homeFeatures: [],
  startFeature: null,
  configurationWarnings: [],
  status: 'error',
  error: 'No existe un proveedor de identidad SCM.',
};

const STANDALONE_CONTEXT = {
  actor: null,
  actorId: 1,
  actors: [],
  applyActor: () => {},
  can: () => false,
  canAny: (required = []) => !required.length,
  capabilities: new Set(),
  error: '',
  experience: STANDALONE_WORKSPACE.experience,
  loading: false,
  refreshActors: async () => {},
  roleCodes: [],
  workspace: STANDALONE_WORKSPACE,
};

const ScmActorContext = createContext(STANDALONE_CONTEXT);

export function ScmActorProvider({ children }) {
  const [actorId, setActorId] = useState(obtenerActorScm());
  const [actors, setActors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshActors = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (SCM_AUTH_MODE === 'supabase') {
        const currentActor = await getCurrentActor();
        setActors([currentActor]);
        setActorId(currentActor.id);
        return;
      }
      const payload = await getTrabajadores({ incluir_inactivos: true });
      const activeActors = (payload || []).filter((item) => item.activo);
      setActors(activeActors);
      setActorId((currentActorId) => {
        if (activeActors.some((item) => Number(item.id) === Number(currentActorId))) {
          return currentActorId;
        }
        const fallbackActor = activeActors.find((item) => (
          item.roles || []
        ).some((role) => role.codigo === 'GERENTE_GENERAL')) || activeActors[0];
        if (!fallbackActor) return currentActorId;
        const fallbackId = guardarActorScm(fallbackActor.id);
        globalThis.dispatchEvent?.(new CustomEvent('scm-actor-changed', {
          detail: { actorId: fallbackId },
        }));
        return fallbackId;
      });
    } catch {
      setError('No pudimos cargar la identidad y los permisos. La API seguirá validando cada acción.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshActors(); }, [refreshActors]);

  const actor = useMemo(
    () => actors.find((item) => Number(item.id) === Number(actorId)) || null,
    [actorId, actors],
  );
  const capabilities = useMemo(
    () => new Set(actor?.capacidades_efectivas || []),
    [actor],
  );
  const roleCodes = useMemo(
    () => (actor?.roles || []).map((role) => role.codigo),
    [actor],
  );
  const actorWorkspace = useMemo(() => buildActorWorkspace({ actor }), [actor]);
  const workspace = useMemo(() => ({
    ...actorWorkspace,
    status: loading ? 'loading' : (error ? 'error' : 'ready'),
    error,
  }), [actorWorkspace, error, loading]);
  const experience = workspace.experience;

  const can = useCallback(
    (capability) => !loading && !error && capabilities.has(capability),
    [capabilities, error, loading],
  );
  const canAny = useCallback(
    (required = []) => !required.length || (
      !loading
      && !error
      && required.some((capability) => capabilities.has(capability))
    ),
    [capabilities, error, loading],
  );

  const applyActor = useCallback((nextActorId) => {
    if (SCM_AUTH_MODE === 'supabase') return false;
    const nextActor = actors.find(
      (item) => Number(item.id) === Number(nextActorId) && item.activo,
    );
    if (!nextActor) return false;
    const parsed = guardarActorScm(nextActor.id);
    setActorId(parsed);
    globalThis.dispatchEvent?.(new CustomEvent('scm-actor-changed', {
      detail: { actorId: parsed },
    }));
    return true;
  }, [actors]);

  const value = useMemo(() => ({
    actor,
    actorId,
    actors,
    applyActor,
    can,
    canAny,
    capabilities,
    error,
    experience,
    loading,
    refreshActors,
    roleCodes,
    workspace,
  }), [
    actor, actorId, actors, applyActor, can, canAny, capabilities, error,
    experience, loading, refreshActors, roleCodes, workspace,
  ]);

  return <ScmActorContext.Provider value={value}>{children}</ScmActorContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useScmActor() {
  return useContext(ScmActorContext);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useActorWorkspace() {
  return useContext(ScmActorContext).workspace;
}
