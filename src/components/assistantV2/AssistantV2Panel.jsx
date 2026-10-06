import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Divider, IconButton, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import AssistantV2Results from './AssistantV2Results';
import AssistantV2Proposals from './AssistantV2Proposals';
import { getScmAssistantV2Catalog, listScmAssistantProposals, sendScmAssistantV2Chat } from '../../services/scmAssistantV2Api';

const DEFAULT_SUGGESTIONS = [
  { label: 'Avance de producción de ayer', query: '¿Cuál fue el avance de producción de ayer?' },
  { label: 'Pesajes registrados ayer', query: '¿Qué pesajes se registraron ayer?' },
  { label: 'Trazar una manga por código', query: 'Quiero consultar la trazabilidad de una manga' },
];

const normalizeSuggestion = (item) => {
  if (typeof item === 'string') return { label: item, query: item };
  const query = item?.query || item?.label;
  const label = item?.label || query;
  return query && label ? { label, query } : null;
};

export default function AssistantV2Panel({ onClose, onMinimize, canReview = false }) {
  const [tab, setTab] = useState('chat');
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [suggestions, setSuggestions] = useState(DEFAULT_SUGGESTIONS);
  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [error, setError] = useState('');
  const [serverCanReview, setServerCanReview] = useState(false);

  useEffect(() => {
    let active = true;
    getScmAssistantV2Catalog().then((payload) => {
      if (!active) return;
      const remote = (payload?.suggestions || []).map(normalizeSuggestion).filter(Boolean);
      if (remote.length) setSuggestions(remote.slice(0, 6));
    }).catch(() => { /* catalog is optional; the chat remains available */ })
      .finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!canReview) return undefined;
    let active = true;
    listScmAssistantProposals().then((payload) => {
      if (active) setServerCanReview(payload?.can_review === true);
    }).catch(() => { if (active) setServerCanReview(false); });
    return () => { active = false; };
  }, [canReview]);

  const send = async (event) => {
    event?.preventDefault();
    const value = query.trim();
    if (!value || loading) return;
    setLoading(true); setError(''); setQuery('');
    setMessages((current) => [...current, { kind: 'question', text: value }].slice(-20));
    try {
      const response = await sendScmAssistantV2Chat({ query: value });
      setMessages((current) => [...current, { kind: 'answer', response }].slice(-20));
    } catch (requestError) {
      const message = requestError?.response?.data?.error?.message
        || requestError?.response?.data?.message
        || 'No se pudo consultar el asistente. La consulta no modificó datos.';
      setError(message);
    } finally { setLoading(false); }
  };

  const recent = useMemo(() => messages.slice(-8), [messages]);
  return (
    <Box role="dialog" aria-label="Asistente SCM v2" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }} sx={{ position: 'fixed', zIndex: 1400, right: 'max(16px, env(safe-area-inset-right))', bottom: 'max(92px, calc(80px + env(safe-area-inset-bottom)))', width: 'min(430px, calc(100vw - 32px))', maxHeight: 'min(680px, calc(100vh - 120px))', display: 'flex', flexDirection: 'column', bgcolor: '#101820', color: '#f5f7fa', border: '1px solid #344454', borderRadius: 3, boxShadow: '0 20px 60px rgba(0,0,0,.38)', overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1.1, bgcolor: '#18212b' }}>
        <Box><Typography component="h2" variant="subtitle1" sx={{ fontWeight: 850, color: '#f5c84c' }}>Asistente SCM</Typography><Typography variant="caption" sx={{ color: '#b6c1cc' }}>Respuesta analítica · consulta de solo lectura</Typography></Box>
        <Stack direction="row" spacing={0.25}><IconButton aria-label="Minimizar asistente" size="small" onClick={onMinimize} sx={{ color: '#d6dee8' }}><RemoveRoundedIcon /></IconButton><IconButton aria-label="Cerrar asistente" size="small" onClick={onClose} sx={{ color: '#d6dee8' }}><CloseRoundedIcon /></IconButton></Stack>
      </Stack>
      {serverCanReview && <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="fullWidth" sx={{ minHeight: 38, bgcolor: '#18212b', '& .MuiTab-root': { color: '#b6c1cc', minHeight: 38 }, '& .Mui-selected': { color: '#f5c84c' }, '& .MuiTabs-indicator': { bgcolor: '#f5c84c' } }}><Tab value="chat" label="Consultar" /><Tab value="proposals" label="Propuestas" /></Tabs>}
      {tab === 'proposals' && serverCanReview ? <Box sx={{ p: 1.5, overflow: 'auto' }}><AssistantV2Proposals /></Box> : <>
        <Box sx={{ p: 1.5, overflow: 'auto', minHeight: 100, flex: 1 }}>
          {!recent.length && <Stack spacing={1.25}><Typography variant="body2" sx={{ color: '#d6dee8' }}>Pregunta por datos SCM disponibles para tu rol. La respuesta mostrará fuente y corte cuando el servicio los entregue.</Typography><Typography variant="caption" sx={{ color: '#9daaba' }}>{catalogLoading ? 'Cargando preguntas recomendadas…' : 'Preguntas recomendadas'}</Typography><Stack spacing={0.7}>{suggestions.map((suggestion) => <Button key={`${suggestion.label}-${suggestion.query}`} variant="outlined" size="small" onClick={() => setQuery(suggestion.query)} sx={{ justifyContent: 'flex-start', textAlign: 'left', color: '#d6dee8', borderColor: '#53667a' }}>{suggestion.label}</Button>)}</Stack></Stack>}
          <Stack spacing={1.25}>{recent.map((message, index) => message.kind === 'question' ? <Box key={`${message.text}-${index}`} sx={{ alignSelf: 'flex-end', bgcolor: '#2b4053', borderRadius: 2, px: 1.25, py: 0.9, maxWidth: '92%' }}><Typography variant="body2">{message.text}</Typography></Box> : <Box key={`answer-${index}`} sx={{ borderLeft: '2px solid #f5c84c', pl: 1 }}>{message.response?.status === 'unsupported' && <Typography variant="caption" sx={{ color: '#f5c84c' }}>Consulta fuera del alcance disponible.</Typography>} {message.response?.status === 'needs_clarification' && <Alert severity="info" sx={{ mb: 1 }}>{message.response?.clarification?.question || 'Falta un dato para completar la consulta.'}</Alert>}<AssistantV2Results response={message.response} /></Box>)}</Stack>
          {loading && <Stack direction="row" spacing={1} alignItems="center" role="status" sx={{ mt: 1.25 }}><CircularProgress size={16} sx={{ color: '#f5c84c' }} /><Typography variant="caption" sx={{ color: '#b6c1cc' }}>Consultando datos SCM…</Typography></Stack>}
          {error && <Alert severity="error" sx={{ mt: 1.25 }}>{error}</Alert>}
        </Box>
        <Divider sx={{ borderColor: '#344454' }} />
        <Box component="form" onSubmit={send} sx={{ p: 1.25 }}><Stack direction="row" spacing={0.75} alignItems="flex-end"><TextField fullWidth multiline maxRows={3} size="small" label="Pregunta" value={query} onChange={(event) => setQuery(event.target.value)} disabled={loading} InputLabelProps={{ sx: { color: '#9daaba' } }} sx={{ '& .MuiInputBase-root': { color: '#f5f7fa', bgcolor: '#18212b' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#53667a' } }} /><IconButton type="submit" aria-label="Enviar pregunta" disabled={loading || !query.trim()} sx={{ color: '#f5c84c' }}><SendRoundedIcon /></IconButton></Stack></Box>
      </>}
    </Box>
  );
}

