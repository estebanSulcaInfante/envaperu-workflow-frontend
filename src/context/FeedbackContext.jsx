import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Alert, IconButton, Snackbar, Stack, useTheme } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

const FeedbackContext = createContext({ notify: () => undefined, dismiss: () => undefined, dismissByKey: () => undefined });
const DEFAULT_AUTO_HIDE_MS = 4500;

function normalizeMessage(message) {
  if (message == null) return '';
  return typeof message === 'string' ? message : String(message);
}

export function FeedbackProvider({ children, scopeKey = 'global' }) {
  const theme = useTheme();
  const [items, setItems] = useState([]);
  const [portalHost, setPortalHost] = useState(null);
  const idRef = useRef(0);
  const dismiss = useCallback((id) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const dismissByKey = useCallback((dedupeKey) => {
    if (!dedupeKey) return;
    setItems((current) => current.filter((item) => item.dedupeKey !== dedupeKey));
  }, []);
  const notify = useCallback((input, options = {}) => {
    const normalized = typeof input === 'string' ? { message: input } : (input || {});
    const message = normalizeMessage(normalized.message);
    if (!message) return undefined;
    const severity = normalized.severity || options.severity || 'error';
    const persistent = normalized.persistent ?? options.persistent ?? (severity === 'error' || severity === 'warning');
    const dedupeKey = normalized.key || options.key || `${severity}:${message}`;
    const item = {
      id: `${Date.now()}-${idRef.current += 1}`,
      message, severity, persistent, dedupeKey,
      action: normalized.action || options.action,
      autoHideDuration: normalized.autoHideDuration || options.autoHideDuration || DEFAULT_AUTO_HIDE_MS,
      scopeKey,
    };
    setItems((current) => {
      const existing = current.find((candidate) => candidate.dedupeKey === dedupeKey);
      if (existing) return current.map((candidate) => (candidate.id === existing.id ? { ...candidate, ...item } : candidate));
      // Keep every unresolved operation. Dropping an older uncertain result
      // would remove its recovery path; the area can grow without losing data.
      return [...current, item];
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
  const value = useMemo(() => ({ notify, dismiss, dismissByKey }), [dismiss, dismissByKey, notify]);
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
            onClose={(_event, reason) => { if (reason !== 'clickaway') dismiss(item.id); }}
            sx={{ position: 'static', transform: 'none' }}
          >
            <Alert
              severity={item.severity}
              role={item.severity === 'success' ? 'status' : 'alert'}
              aria-label={item.message}
              aria-live={item.severity === 'success' ? 'polite' : 'assertive'}
              variant="outlined"
              sx={{ width: '100%', alignItems: 'flex-start', bgcolor: 'background.paper' }}
              action={(
                <>
                  {item.action}
                  <IconButton aria-label="Cerrar notificación" color="inherit" size="small" onClick={() => dismiss(item.id)}>
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
export default FeedbackProvider;
