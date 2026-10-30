import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Stack } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { useAuth } from '../../context/AuthContext';
import { useScmActor } from '../../context/ScmActorContext';
import {
  SCM_AUTH_MODE,
  SCM_PERSONAL_AGENT_ENABLED,
  SCM_PERSONAL_AGENT_ORIGIN,
} from '../../config/runtime';
import { requestPersonalAgentAccess } from '../../services/scmPersonalAgentApi';

const CAPABILITY = 'ASISTENTE_PRODUCCION_USAR';
const EXCHANGE_PATH = '/_scm/exchange';

const isLoopback = (hostname) => (
  hostname === 'localhost'
  || hostname === '127.0.0.1'
  || hostname === '[::1]'
  || hostname === '::1'
);

const configuredOrigin = () => {
  if (!SCM_PERSONAL_AGENT_ORIGIN) return null;
  try {
    const url = new URL(SCM_PERSONAL_AGENT_ORIGIN);
    const isHttps = url.protocol === 'https:';
    const isDevLoopbackHttp = import.meta.env.DEV
      && url.protocol === 'http:'
      && isLoopback(url.hostname);
    if ((!isHttps && !isDevLoopbackHttp)
      || url.username
      || url.password
      || url.search
      || url.hash
      || (url.pathname !== '' && url.pathname !== '/')) return null;
    return url;
  } catch {
    return null;
  }
};

// eslint-disable-next-line react-refresh/only-export-components
export const validatePersonalAgentExchangeUrl = (exchangeUrl) => {
  const origin = configuredOrigin();
  if (!origin || typeof exchangeUrl !== 'string' || !exchangeUrl.trim()) return false;
  try {
    const target = new URL(exchangeUrl);
    return target.origin === origin.origin
      && target.pathname === EXCHANGE_PATH
      && !target.username
      && !target.password
      && !target.search
      && !target.hash;
  } catch {
    return false;
  }
};

const submitExchangeForm = ({ exchangeUrl, assertion }) => {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = exchangeUrl;
  form.target = '_self';
  form.hidden = true;

  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'assertion';
  input.value = assertion;
  form.appendChild(input);
  document.body.appendChild(form);
  try {
    form.submit();
  } finally {
    form.remove();
  }
};

const accessErrorMessage = (error) => {
  const status = error?.response?.status ?? error?.status;
  if (status === 401) return 'Tu sesión SCM venció. Vuelve a iniciar sesión.';
  if (status === 403) return 'Tu permiso para usar Mi agente fue retirado. Vuelve a SCM.';
  return 'No se pudo preparar el acceso a Mi agente. Reintenta desde SCM.';
};

const responseWasRevoked = (payload) => (
  payload?.revoked === true
  || payload?.permission_revoked === true
  || ['revoked', 'permission_revoked'].includes(String(payload?.status || '').toLowerCase())
);

export default function PersonalAgentAccess() {
  const { session } = useAuth();
  const {
    actorId, can, error: actorError, loading: actorLoading, refreshActors,
  } = useScmActor();
  const [preparing, setPreparing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [blocked, setBlocked] = useState(false);
  const mountedRef = useRef(true);
  const actorRef = useRef(actorId);
  const sessionKey = session?.access_token || null;
  const sessionRef = useRef(sessionKey);
  const controllerRef = useRef(null);

  actorRef.current = actorId;
  sessionRef.current = sessionKey;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const previousActorIdRef = useRef(actorId);
  useEffect(() => {
    if (previousActorIdRef.current !== actorId) {
      controllerRef.current?.abort();
      controllerRef.current = null;
      if (mountedRef.current) setPreparing(false);
    }
    previousActorIdRef.current = actorId;
  }, [actorId]);

  useEffect(() => {
    const onActorChange = (event) => {
      const nextActorId = event.detail?.actorId;
      actorRef.current = nextActorId;
      controllerRef.current?.abort();
      controllerRef.current = null;
      if (mountedRef.current) setPreparing(false);
    };
    globalThis.addEventListener?.('scm-actor-changed', onActorChange);
    return () => globalThis.removeEventListener?.('scm-actor-changed', onActorChange);
  }, []);

  useEffect(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setPreparing(false);
    setBlocked(false);
    setFeedback('');
  }, [sessionKey, actorId]);

  const canUse = typeof can === 'function' && can(CAPABILITY);
  const visible = SCM_PERSONAL_AGENT_ENABLED
    && SCM_AUTH_MODE === 'supabase'
    && Boolean(sessionKey)
    && canUse
    && !actorLoading
    && !actorError;

  if (!visible && !feedback) return null;

  const startAccess = async () => {
    if (preparing || blocked || !visible || !mountedRef.current) return;
    const requestActorId = actorId;
    const requestSessionKey = sessionKey;
    const controller = new AbortController();
    controllerRef.current = controller;
    setPreparing(true);
    setFeedback('');
    try {
      const payload = await requestPersonalAgentAccess(controller.signal);
      const exchangeUrl = payload?.exchange_url;
      const assertion = payload?.assertion;
      if (responseWasRevoked(payload)) {
        throw Object.assign(new Error('permission revoked'), { status: 403 });
      }
      if (typeof assertion !== 'string' || !assertion || !validatePersonalAgentExchangeUrl(exchangeUrl)) {
        throw new Error('invalid exchange response');
      }
      if (!mountedRef.current
        || controller.signal.aborted
        || actorRef.current !== requestActorId
        || sessionRef.current !== requestSessionKey
        || controllerRef.current !== controller) return;
      submitExchangeForm({ exchangeUrl, assertion });
    } catch (error) {
      if (error?.name === 'AbortError' || controller.signal.aborted) return;
      if (mountedRef.current) {
        const status = error?.response?.status ?? error?.status;
        setFeedback(accessErrorMessage(error));
        if (status === 401 || status === 403) {
          setBlocked(true);
          Promise.resolve(refreshActors?.()).catch(() => {});
        }
      }
    } finally {
      if (mountedRef.current && controllerRef.current === controller) {
        controllerRef.current = null;
        setPreparing(false);
      }
    }
  };

  return (
    <Stack direction="row" alignItems="center" spacing={0.75}>
      {visible && !blocked && <Button
        size="small"
        variant="outlined"
        startIcon={<ArrowForwardRoundedIcon />}
        loading={preparing}
        disabled={preparing}
        aria-busy={preparing ? 'true' : undefined}
        onClick={startAccess}
      >
        Mi agente
      </Button>}
      {feedback && <Alert severity="error" role="alert" sx={{ py: 0 }}>{feedback}</Alert>}
    </Stack>
  );
}

