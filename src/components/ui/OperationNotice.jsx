import { useEffect, useEffectEvent, useId } from 'react';
import { useOperationFeedback } from '../../context/FeedbackContext';

// For result props owned by another surface (query state, upload row, auth).
// Only a changed result/event emits; changing the route's notify callback alone
// must never replay the previous page's message. Contextual recovery stays local.
export default function OperationNotice({ message, severity = 'error', eventKey, persistent }) {
  const id = useId();
  const { notify, dismiss, isFallback } = useOperationFeedback('operation-notice');
  const publish = useEffectEvent(() => {
    if (isFallback) return;
    if (message) notify(message, { severity, persistent, key: id });
    else dismiss(id);
  });
  useEffect(() => { publish(); }, [eventKey, message, severity, persistent]);
  return null;
}
