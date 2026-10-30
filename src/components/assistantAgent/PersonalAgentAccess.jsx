import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Paper, Stack, Typography,
} from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useNavigate } from 'react-router-dom';
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
  if (status === 403) return 'Tu permiso para usar Mi agente fue retirado. Reintenta desde SCM.';
  return 'No se pudo preparar el acceso a Mi agente. Reintenta desde SCM.';
};

const responseWasRevoked = (payload) => (
  payload?.revoked === true
  || payload?.permission_revoked === true
  || ['revoked', 'permission_revoked'].includes(String(payload?.status || '').toLowerCase())
);

export default function PersonalAgentAccess({ autoStart = false } = {}) {
  const navigate = useNavigate();
  const { session, requestReauthentication } = useAuth();
  const {
    actor, actorId, can, error: actorError, loading: actorLoading, refreshActors,
  } = useScmActor();
  const [preparing, setPreparing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState(null);
  const [blocked, setBlocked] = useState(false);
  const [retryableFailure, setRetryableFailure] = useState(false);
  const mountedRef = useRef(true);
  const actorRef = useRef(actorId);
  const sessionKey = session?.access_token || null;
  const sessionRef = useRef(sessionKey);
  const controllerRef = useRef(null);
  const autoStartAttemptedRef = useRef(false);
  const autoStartTimerRef = useRef(null);

  actorRef.current = actorId;
  sessionRef.current = sessionKey;
  const canUse = typeof can === 'function' && can(CAPABILITY);
  const capabilitySignal = Array.isArray(actor?.capacidades_efectivas)
    ? actor.capacidades_efectivas.includes(CAPABILITY)
    : canUse;

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
    setFeedbackStatus(null);
    setRetryableFailure(false);
    setFeedback('');
    autoStartAttemptedRef.current = false;
  }, [sessionKey, actorId, capabilitySignal]);

  const visible = SCM_PERSONAL_AGENT_ENABLED
    && SCM_AUTH_MODE === 'supabase'
    && Boolean(sessionKey)
    && canUse
    && !actorLoading
    && !actorError;

  const startAccess = useCallback(async () => {
    if (preparing || blocked || !visible || !mountedRef.current) return;
    const requestActorId = actorId;
    const requestSessionKey = sessionKey;
    const controller = new AbortController();
    controllerRef.current = controller;
    setPreparing(true);
    setFeedback('');
    setFeedbackStatus(null);
    setRetryableFailure(false);
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
        setFeedbackStatus(status ?? null);
        setRetryableFailure(status !== 401 && status !== 403);
        if (status === 403) {
          setBlocked(true);
          Promise.resolve(refreshActors?.()).catch(() => {});
        }
        if (status === 401) setBlocked(true);
      }
    } finally {
      if (mountedRef.current && controllerRef.current === controller) {
        controllerRef.current = null;
        setPreparing(false);
      }
    }
  }, [actorId, blocked, preparing, refreshActors, sessionKey, visible]);

  const requestLogin = useCallback(() => {
    requestReauthentication?.();
  }, [requestReauthentication]);

  useEffect(() => {
    if (!autoStart || !visible || autoStartAttemptedRef.current) return;
    const timer = globalThis.setTimeout(() => {
      if (autoStartAttemptedRef.current || !mountedRef.current) return;
      autoStartAttemptedRef.current = true;
      startAccess();
    }, 0);
    autoStartTimerRef.current = timer;
    return () => {
      globalThis.clearTimeout(timer);
      if (autoStartTimerRef.current === timer) autoStartTimerRef.current = null;
    };
  }, [autoStart, startAccess, visible]);

  const compact = !autoStart;
  if (compact && !visible && !feedback) return null;

  if (compact) {
    return (
      <Button
        size="small"
        variant="outlined"
        startIcon={<ArrowForwardRoundedIcon />}
        onClick={() => navigate('/mi-agente')}
      >
        Mi agente
      </Button>
    );
  }

  const actorReady = !actorLoading && !actorError;
  const capabilityDenied = Boolean(sessionKey) && actorReady && !canUse;
  const unavailable = !SCM_PERSONAL_AGENT_ENABLED || SCM_AUTH_MODE !== 'supabase';

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', py: { xs: 2, sm: 4 } }}>
      <Button
        size="small"
        startIcon={<ArrowBackRoundedIcon />}
        onClick={() => navigate('/')}
        sx={{ mb: 2 }}
      >
        Volver a SCM
      </Button>
      <Paper
        component="section"
        aria-labelledby="personal-agent-title"
        variant="outlined"
        sx={{ p: { xs: 2.5, sm: 4 }, borderColor: 'primary.100' }}
      >
        <Typography id="personal-agent-title" variant="h4" component="h1" sx={{ mb: 1 }}>
          Mi agente
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 62 * 8, mb: 3 }}>
          Abre tu espacio personal de consultas. La sesión se prepara con tu identidad SCM;
          no necesitas otra cuenta ni credenciales nuevas.
        </Typography>

        {unavailable && (
          <Alert severity="info" role="status">
            Mi agente no está habilitado en este entorno.
          </Alert>
        )}
        {!unavailable && !sessionKey && (
          <Alert severity="warning" role="alert">
            Tu sesión SCM no está disponible. Vuelve a SCM para iniciar sesión.
          </Alert>
        )}
        {!unavailable && sessionKey && actorLoading && (
          <Stack direction="row" spacing={1.5} alignItems="center" role="status" aria-live="polite">
            <CircularProgress size={24} aria-label="Verificando permisos" />
            <Typography>Verificando tu identidad y permiso…</Typography>
          </Stack>
        )}
        {!unavailable && sessionKey && actorError && (
          <Alert severity="warning" role="alert" action={(
            <Button color="inherit" size="small" onClick={refreshActors}>Reintentar</Button>
          )}>
            No pudimos cargar tu identidad y permisos. Reintenta desde SCM.
          </Alert>
        )}
        {!unavailable && capabilityDenied && (
          <Alert severity="error" role="alert">
            No tienes permiso para usar Mi agente. Solicita acceso al administrador de SCM.
          </Alert>
        )}
        {visible && preparing && (
          <Stack direction="row" spacing={1.5} alignItems="center" role="status" aria-live="polite">
            <CircularProgress size={24} aria-label="Preparando acceso" />
            <Typography>Preparando tu acceso seguro…</Typography>
          </Stack>
        )}
        {visible && feedback && (
          <Stack spacing={1.5} alignItems="flex-start">
            <Alert
              severity="error"
              role="alert"
              action={feedbackStatus === 401 ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={requestLogin}
                >
                  Volver a iniciar sesión
                </Button>
              ) : feedbackStatus === 403 ? (
                <Button color="inherit" size="small" onClick={() => navigate('/')}>Volver a SCM</Button>
              ) : null}
            >
              {feedback}
            </Alert>
            {retryableFailure && (
              <Button variant="contained" onClick={startAccess} disabled={preparing} loading={preparing}>
                Reintentar
              </Button>
            )}
          </Stack>
        )}
      </Paper>
    </Box>
  );
}

