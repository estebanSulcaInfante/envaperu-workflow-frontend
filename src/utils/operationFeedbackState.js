import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react';
import { useOperationFeedback } from '../context/FeedbackContext';

// Explicit setter events, not a mirror effect: changing route/actor cannot
// replay an old value. Keep the local value for field errors and empty states.
export function useOperationMessage(scope, options = {}) {
  const instanceId = useId();
  const initial = Object.hasOwn(options, 'initialValue') ? options.initialValue : '';
  const [value, setValue] = useState(initial);
  const [severity, setSeverity] = useState(typeof options.severity === 'string' ? options.severity : 'error');
  const valueRef = useRef(value);
  const optionsRef = useRef(options);
  const keys = useRef(new Set());
  const { notify, dismiss, isFallback, contextKey } = useOperationFeedback(scope);
  const currentContext = useRef(contextKey);
  useLayoutEffect(() => {
    optionsRef.current = options;
    currentContext.current = contextKey;
  });
  const setOperationValue = useCallback((update, event = {}) => {
    if (currentContext.current !== contextKey) return;
    const nextValue = typeof update === 'function' ? update(valueRef.current) : update;
    valueRef.current = nextValue;
    setValue(nextValue);
    const settings = { ...optionsRef.current, ...event };
    const nextSeverity = typeof settings.severity === 'function' ? settings.severity(nextValue) : settings.severity || 'error';
    setSeverity(nextSeverity);
    if (isFallback) return;
    if (!nextValue) {
      keys.current.forEach((key) => dismiss(key));
      keys.current.clear();
      return;
    }
    const key = settings.key || `${scope}:${instanceId}:${settings.operation || 'message'}`;
    keys.current.add(key);
    notify(nextValue, {
      ...settings,
      severity: nextSeverity,
      key,
      onDismiss: () => {
        keys.current.delete(key);
        // Closing feedback must not clear the view's stale-data/validation
        // guard. A later setter call is a new event even for identical text.
        settings.onDismiss?.();
      },
    });
  }, [contextKey, dismiss, instanceId, isFallback, notify, scope]);
  return [value, setOperationValue, isFallback, severity];
}

