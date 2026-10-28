import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Divider, Drawer, IconButton, Stack, TextField, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import { buildScmAgentChatPayload, createClientRequestId, getScmAgentState, sendScmAgentChat, SCM_AGENT_UI_TIMEOUT } from '../../services/scmAgentApi';
import { AgentOrb } from './AgentOrb';

const initialAvailability = { phase: 'checking', data: null, error: null };

const errorMessage = (error) => error?.response?.data?.error?.message
  || (error?.response?.status === 403 ? 'El propietario no está vinculado al agente SCM.' : null)
  || error?.message
  || 'No se pudo consultar el agente SCM.';

export default function AssistantAgentPanel({ open, onClose, onStateChange }) {
  const [availability, setAvailability] = useState(initialAvailability);
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);
  const [retryQuery, setRetryQuery] = useState('');
  const [historyNotice, setHistoryNotice] = useState('');
  const [generation, setGeneration] = useState('idle');
  const [retryAvailability, setRetryAvailability] = useState(0);
  const requestRef = useRef(null);
  const attemptRef = useRef(0);
  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const logEndRef = useRef(null);

  const checkAvailability = useCallback(() => {
    const controller = new AbortController();
    setAvailability({ phase: 'checking', data: null, error: null });
    getScmAgentState({ signal: controller.signal }).then((data) => {
      setAvailability({ phase: 'ready', data, error: null });
    }).catch((requestError) => {
      if (requestError?.name === 'CanceledError' || requestError?.name === 'AbortError') return;
      setAvailability({ phase: 'error', data: null, error: errorMessage(requestError) });
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    return checkAvailability();
  }, [checkAvailability, open, retryAvailability]);

  useEffect(() => () => {
    requestRef.current?.abort();
    window.clearTimeout(timerRef.current);
  }, []);

  const ready = availability.phase === 'ready' && availability.data?.available === true && availability.data?.status === 'READY';
  const unavailable = availability.phase === 'ready' && !ready;
  const agentState = generation === 'loading'
    ? 'running'
    : generation === 'error'
      ? 'error'
      : generation === 'success'
        ? 'success'
        : (open && availability.phase === 'checking')
          ? 'working'
          : (availability.phase === 'error' || (availability.phase === 'ready' && !ready))
            ? 'error'
            : 'idle';

  useEffect(() => {
    onStateChange?.(agentState);
  }, [agentState, onStateChange]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [messages, generation]);

  const stopWaiting = () => {
    const activeController = requestRef.current;
    attemptRef.current += 1;
    requestRef.current = null;
    activeController?.abort();
    window.clearTimeout(timerRef.current);
    setGeneration('stopped');
  };

  const submit = async (event, explicitQuery = null) => {
    event?.preventDefault();
    if (generation === 'loading') return;
    const value = String(explicitQuery ?? query).trim();
    if (!value || availability.data?.available !== true || availability.data?.status !== 'READY') return;
    const previousHistory = history.slice(-12);
    const clientRequestId = createClientRequestId();
    const attemptId = attemptRef.current + 1;
    attemptRef.current = attemptId;
    setError(null);
    setGeneration('loading');
    setRetryQuery(value);
    if (explicitQuery === null) setMessages((current) => [...current, { role: 'user', content: value }]);
    const controller = new AbortController();
    requestRef.current = controller;
    timerRef.current = window.setTimeout(() => controller.abort(), SCM_AGENT_UI_TIMEOUT);
    const isCurrent = () => attemptRef.current === attemptId && requestRef.current === controller;
    try {
      const payloadInfo = buildScmAgentChatPayload({ query: value, history: previousHistory, clientRequestId });
      setHistoryNotice(payloadInfo.historyOmitted ? 'Se omitió parte del historial anterior para mantener acotada la consulta.' : '');
      const response = await sendScmAgentChat({ query: value, history: previousHistory, clientRequestId, signal: controller.signal });
      if (!isCurrent()) return;
      if (response?.status !== 'answered' || typeof response.answer !== 'string' || !response.answer.trim() || response.client_request_id !== clientRequestId) {
        throw new Error('La respuesta del agente no corresponde a esta consulta.');
      }
      const answer = typeof response?.answer === 'string' ? response.answer : '';
      setMessages((current) => [...current, { role: 'assistant', content: answer }]);
      setHistory((current) => [...current, { role: 'user', content: value }, { role: 'assistant', content: answer }].slice(-12));
      setQuery('');
      setRetryQuery('');
      setGeneration('success');
      requestRef.current = null;
    } catch (requestError) {
      if (!isCurrent()) return;
      if (requestError?.name === 'CanceledError' || requestError?.name === 'AbortError') {
        setGeneration('stopped');
      } else {
        setError(errorMessage(requestError));
        setGeneration('error');
      }
      requestRef.current = null;
    } finally {
      if (isCurrent()) window.clearTimeout(timerRef.current);
    }
  };

  const handleKeyDown = (event) => {
    if (event.nativeEvent?.isComposing || event.isComposing) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit(event);
    }
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose} ModalProps={{ keepMounted: true }} PaperProps={{ role: 'dialog', 'aria-label': 'Asistente SCM v2' }}>
      <Box className="assistant-agent-panel" sx={{ width: { xs: 'min(100vw, 430px)', sm: 430 }, maxWidth: '100vw', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper', color: 'text.primary' }}>
        <Stack component="header" direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" spacing={1.2} alignItems="center">
            <AgentOrb state={agentState} size={32} />
            <Box><Typography component="h2" variant="subtitle1" fontWeight={600}>Agente SCM</Typography><Typography variant="caption" color="text.secondary">Solo lectura · datos de producción</Typography></Box>
          </Stack>
          <IconButton aria-label="Cerrar agente SCM" onClick={onClose}><CloseRoundedIcon /></IconButton>
        </Stack>
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
            {availability.phase === 'checking' && <Stack direction="row" spacing={1} alignItems="center" role="status"><CircularProgress size={16} /><Typography variant="body2">Comprobando disponibilidad…</Typography></Stack>}
            {availability.phase === 'error' && <Alert severity="error" action={<Button size="small" onClick={() => setRetryAvailability((value) => value + 1)}>Reintentar</Button>}>{availability.error}</Alert>}
            {unavailable && <Alert severity="warning">{availability.data?.message || 'El agente SCM no está disponible para este propietario.'}</Alert>}
            {ready && !messages.length && <Typography variant="body2" color="text.secondary">Consulta la información empresarial disponible para este agente de solo lectura.</Typography>}
            <Stack component="div" role="log" aria-live="polite" spacing={1.5} sx={{ mt: messages.length ? 0 : 2 }}>
              {messages.map((message, index) => <Box key={`${message.role}-${index}`} role="group" aria-label={message.role === 'user' ? 'Tú' : 'Agente SCM'} sx={{ maxWidth: '92%', alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', bgcolor: message.role === 'user' ? 'action.hover' : 'transparent', border: message.role === 'assistant' ? 0 : 1, borderColor: 'divider', borderRadius: 2, px: 1.5, py: 1 }}><Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{message.content}</Typography></Box>)}
              <span ref={logEndRef} aria-hidden="true" />
            </Stack>
            {generation === 'loading' && <Stack direction="row" spacing={1} alignItems="center" role="status" sx={{ mt: 2 }}><CircularProgress size={15} /><Typography variant="caption">Esperando respuesta del agente…</Typography><Button size="small" startIcon={<StopCircleOutlinedIcon />} onClick={stopWaiting}>Dejar de esperar</Button></Stack>}
            {generation === 'stopped' && <Alert severity="info" sx={{ mt: 2 }}>Dejaste de esperar. La ejecución remota puede continuar; solo se detuvo esta espera HTTP.</Alert>}
            {error && <Alert severity="error" sx={{ mt: 2 }} action={<Button size="small" startIcon={<ReplayRoundedIcon />} onClick={() => submit(undefined, retryQuery)}>Reintentar</Button>}>{error}</Alert>}
            {historyNotice && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>{historyNotice}</Typography>}
          </Box>
          <Divider />
          <Box component="form" onSubmit={submit} sx={{ p: 1.5 }}>
            <TextField inputRef={inputRef} fullWidth multiline minRows={2} maxRows={5} label="Pregunta al agente SCM" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={handleKeyDown} disabled={!ready || generation === 'loading'} inputProps={{ maxLength: 4000 }} />
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
              <Button type="button" size="small" disabled startIcon={<AttachFileOutlinedIcon />} title="Adjuntos aún no disponibles con el agente real">Adjuntos aún no disponibles</Button>
              <IconButton type="submit" color="primary" aria-label="Enviar pregunta" disabled={!ready || generation === 'loading' || !query.trim()}><SendRoundedIcon /></IconButton>
            </Stack>
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
}
