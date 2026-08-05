import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { getTrabajadores } from '../services/api';
import {
  guardarActorScm,
  obtenerActorScm,
} from '../services/scmEngineeringApi';

const STANDALONE_CONTEXT = {
  actor: null,
  actorId: 1,
  actors: [],
  applyActor: () => {},
  can: () => true,
  canAny: () => true,
  capabilities: new Set(),
  error: '',
  experience: {
    label: 'Perfil operativo',
    focus: 'Consulta las tareas y acciones disponibles para tu perfil.',
  },
  loading: false,
  refreshActors: async () => {},
  roleCodes: [],
};

const ScmActorContext = createContext(STANDALONE_CONTEXT);

const ROLE_EXPERIENCE = {
  GERENCIA: {
    label: 'Gerencia',
    focus: 'Decisiones, aprobaciones y visibilidad del cumplimiento.',
  },
  JEFE_PRODUCCION: {
    label: 'Jefe de Producción',
    focus: 'Liberar trabajo, resolver excepciones y mantener el flujo de planta.',
  },
  JEFE_ENSAMBLE: {
    label: 'Jefe de Ensamble',
    focus: 'Distribuir el armado diario, recibir componentes y cerrar resultados trazables.',
  },
  SUPERVISOR: {
    label: 'Supervisor',
    focus: 'Preparar la jornada, las OT y las mangas para los maquinistas.',
  },
  PLANIFICACION: {
    label: 'Planificación',
    focus: 'Convertir demanda aprobada en trabajo fabricable y trazable.',
  },
  INGENIERIA_SCM: {
    label: 'Ingeniería SCM',
    focus: 'Mantener maestros, estructuras, rutas y reglas técnicamente válidas.',
  },
  CONFIGURACION_SCM: {
    label: 'Configuración SCM',
    focus: 'Mantener catálogos y parámetros operativos confiables.',
  },
  COMPRAS: {
    label: 'Compras',
    focus: 'Asegurar documentos y abastecimiento de materias primas.',
  },
  ALMACEN_RECEPCION: {
    label: 'Almacén y recepción',
    focus: 'Recibir, identificar y conservar la trazabilidad del material.',
  },
  CALIDAD: {
    label: 'Calidad',
    focus: 'Resolver la condición de uso y liberación del material.',
  },
  OPERADOR_PESAJE: {
    label: 'Operador de pesaje',
    focus: 'Confirmar pesajes confiables sin reconstruir información.',
  },
  OPERADOR_MOLINO: {
    label: 'Operador de Molino',
    focus: 'Conciliar bolsas, ejecutar molienda y confirmar el balance de masa.',
  },
  MAQUINISTA: {
    label: 'Maquinista',
    focus: 'Ejecutar el trabajo asignado con la menor digitación posible.',
  },
};

const ROLE_PRIORITY = [
  'GERENCIA',
  'JEFE_PRODUCCION',
  'JEFE_ENSAMBLE',
  'SUPERVISOR',
  'PLANIFICACION',
  'INGENIERIA_SCM',
  'CONFIGURACION_SCM',
  'COMPRAS',
  'ALMACEN_RECEPCION',
  'CALIDAD',
  'OPERADOR_PESAJE',
  'OPERADOR_MOLINO',
  'MAQUINISTA',
];

export function ScmActorProvider({ children }) {
  const [actorId, setActorId] = useState(obtenerActorScm());
  const [actors, setActors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshActors = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
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
  const primaryRoleCode = ROLE_PRIORITY.find((code) => roleCodes.includes(code));
  const experience = useMemo(
    () => ROLE_EXPERIENCE[primaryRoleCode] || {
      label: actor?.roles?.[0]?.nombre || 'Perfil operativo',
      focus: 'Consulta las tareas y acciones disponibles para tu perfil.',
    },
    [actor, primaryRoleCode],
  );

  const can = useCallback(
    (capability) => loading || capabilities.has(capability),
    [capabilities, loading],
  );
  const canAny = useCallback(
    (required = []) => !required.length || loading
      || required.some((capability) => capabilities.has(capability)),
    [capabilities, loading],
  );

  const applyActor = useCallback((nextActorId) => {
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
  }), [
    actor, actorId, actors, applyActor, can, canAny, capabilities, error,
    experience, loading, refreshActors, roleCodes,
  ]);

  return <ScmActorContext.Provider value={value}>{children}</ScmActorContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useScmActor() {
  return useContext(ScmActorContext);
}
