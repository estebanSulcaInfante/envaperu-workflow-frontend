import { createContext, isValidElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Alert, IconButton, Snackbar, Stack, useTheme } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

const FeedbackContext = createContext({
  notify: () => undefined,
  dismiss: () => undefined,
  dismissByKey: () => undefined,
  isFallback: true,
  contextKey: 'without-provider',
});
const DEFAULT_AUTO_HIDE_MS = 4500;

function normalizeMessage(message) {
  if (message == null || message === false) return { node: '', text: '' };
  if (isValidElement(message)) {
    const text = message.props?.['aria-label'] || normalizeMessage(message.props?.children).text || 'Notificación';
    return { node: message, text };
  }
  if (Array.isArray(message)) {
    const parts = message.map(normalizeMessage).filter((part) => part.text);
    return { node: parts.map((part) => part.node), text: parts.map((part) => part.text).join(' ') };
  }
  if (typeof message === 'string' || typeof message === 'number') {
    const text = String(message);
    return { node: text, text };
  }
  if (typeof message === 'object') {
    const nested = message.message ?? message.detail ?? message.error;
    if (nested !== undefined && nested !== message) return normalizeMessage(nested);
    // Do not render object coercion (`[object Object]`) as user-facing feedback.
    return { node: 'Ha ocurrido un error. Intenta de nuevo.', text: 'Ha ocurrido un error. Intenta de nuevo.' };
  }
  return { node: String(message), text: String(message) };
}

export function FeedbackProvider({ children, scopeKey = 'global' }) {
  const theme = useTheme();
  const [items, setItems] = useState([]);
  const [portalHost, setPortalHost] = useState(null);
  const idRef = useRef(0);
  const dismiss = useCallback((id) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const dismissByKey = useCallback((dedupeKey) => {
    if (!dedupeKey) return;
    setItems((current) => current.filter((item) => item.scopeKey !== scopeKey || item.dedupeKey !== dedupeKey));
  }, [scopeKey]);
  const notify = useCallback((input, options = {}) => {
    const normalized = typeof input === 'string' ? { message: input } : (input || {});
    const normalizedMessage = normalizeMessage(normalized.message);
    if (!normalizedMessage.text) return undefined;
    const severity = normalized.severity || options.severity || 'error';
    const persistent = normalized.persistent ?? options.persistent ?? (severity === 'error' || severity === 'warning');
    const explicitKey = normalized.key || options.key;
    const dedupeKey = explicitKey || (
      typeof normalized.message === 'string'
        ? `${severity}:${normalizedMessage.text}`
        : `${severity}:rich:${Date.now()}-${idRef.current + 1}`
    );
    const item = {
      id: `${Date.now()}-${idRef.current += 1}`,
      message: normalizedMessage.node,
      messageText: normalizedMessage.text,
      severity, persistent, dedupeKey,
      action: normalized.action || options.action,
      onDismiss: normalized.onDismiss || options.onDismiss,
      autoHideDuration: normalized.autoHideDuration || options.autoHideDuration || DEFAULT_AUTO_HIDE_MS,
      scopeKey,
    };
    const clearKey = normalized.clearKey || options.clearKey;
    setItems((current) => {
      const retained = clearKey ? current.filter((candidate) => candidate.scopeKey !== scopeKey || candidate.dedupeKey !== clearKey) : current;
      const existing = retained.find((candidate) => candidate.dedupeKey === dedupeKey);
      if (existing) return retained.map((candidate) => (candidate.id === existing.id ? { ...candidate, ...item } : candidate));
      // Keep every unresolved operation. Dropping an older uncertain result
      // would remove its recovery path; the area can grow without losing data.
      return [...retained, item];
    });
    return item.id;
  }, [scopeKey]);
  useEffect(() => {
    const updateHost = () => {
      const dialogs = [...document.querySelectorAll('.MuiDialog-container [role="dialog"]')]
        .filter((dialog) => {
          const style = window.getComputedStyle(dialog);
          return dialog.getAttribute('aria-hidden') !== 'true'
            && style.visibility !== 'hidden'
            && style.display !== 'none';
        });
      // The last visible portal is the active/topmost dialog, which keeps
      // announcements inside the current modal's accessible subtree.
      setPortalHost(dialogs.at(-1) || document.body);
    };
    updateHost();
    const observer = new MutationObserver(updateHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.scopeKey === scopeKey));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [scopeKey]);
  const value = useMemo(() => ({ notify, dismiss, dismissByKey, isFallback: false, contextKey: scopeKey }), [dismiss, dismissByKey, notify, scopeKey]);
  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {portalHost && createPortal(<Stack
        data-testid="feedback-notification-area"
        spacing={1}
        sx={{
          position: 'fixed', right: { xs: 12, sm: 24 }, bottom: { xs: 12, sm: 24 },
          width: { xs: 'calc(100vw - 24px)', sm: 420 }, maxWidth: 'calc(100vw - 24px)',
          maxHeight: 'calc(100dvh - 24px)', overflowY: 'auto', overscrollBehavior: 'contain',
          zIndex: (theme.zIndex.modal || 1300) + 1, pointerEvents: 'none',
          '& > *': { pointerEvents: 'auto' },
        }}
      >
        {items.filter((item) => item.scopeKey === scopeKey).slice().reverse().map((item) => (
          <Snackbar
            key={item.id}
            open
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            autoHideDuration={item.persistent ? null : item.autoHideDuration}
            onClose={(_event, reason) => { if (reason !== 'clickaway') { dismiss(item.id); item.onDismiss?.(); } }}
            sx={{ position: 'static', transform: 'none' }}
          >
            <Alert
              severity={item.severity}
              role={item.severity === 'success' ? 'status' : 'alert'}
              aria-label={item.messageText}
              aria-live={item.severity === 'success' ? 'polite' : 'assertive'}
              variant="outlined"
              sx={{ width: '100%', alignItems: 'flex-start', bgcolor: 'background.paper' }}
              action={(
                <>
                  {item.action}
                  <IconButton aria-label="Cerrar notificación" color="inherit" size="small" onClick={() => { dismiss(item.id); item.onDismiss?.(); }}>
                    <CloseRoundedIcon fontSize="small" />
                  </IconButton>
                </>
              )}
            >
              {item.message}
            </Alert>
          </Snackbar>
        ))}
      </Stack>, portalHost)}
    </FeedbackContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFeedback() { return useContext(FeedbackContext); }

// Explicit operation-level extension. Consumers provide a stable key so a
// repeated failure can reappear after dismissal without duplicating a live item.
// `isFallback` lets isolated tests/auth-boundary consumers retain their inline
// fallback instead of silently losing feedback when no provider is mounted.
// eslint-disable-next-line react-refresh/only-export-components
export function useOperationFeedback(scope) {
  const { notify, dismissByKey, isFallback, contextKey } = useFeedback();
  const resolveKey = useCallback((message, options = {}) => {
    if (options.key) return options.key;
    // Rich JSX must opt into dedupe/correlation explicitly; collapsing two
    // unrelated JSX announcements would silently drop an action or retry.
    if (typeof message !== 'string' || !scope) return undefined;
    return `${scope}:${options.operation || options.severity || 'event'}:${message}`;
  }, [scope]);
  const notifyOperation = useCallback((message, options = {}) => {
    const descriptor = message && typeof message === 'object' && !isValidElement(message)
      && !Array.isArray(message) && Object.hasOwn(message, 'message');
    const input = descriptor ? { ...message, ...options } : { ...options, message };
    const key = resolveKey(input.message, input);
    return notify({ ...input, ...(key ? { key } : {}) });
  }, [notify, resolveKey]);
  const dismissOperation = useCallback((key) => {
    if (key) dismissByKey(key);
  }, [dismissByKey]);
  return { notify: notifyOperation, dismiss: dismissOperation, clear: dismissOperation, isFallback, contextKey };
}
export default FeedbackProvider;
