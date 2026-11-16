import { useEffect, useState } from 'react';
import { isInitialClosed } from './qualityPieceModel';

const cutoffDate = (fechaOperativa, turno) => {
  const date = String(fechaOperativa || '').slice(0, 10);
  const normalizedShift = String(turno || '').toUpperCase();
  const hour = normalizedShift === 'NOCHE' ? 20 : 8;
  return date && ['DIA', 'NOCHE'].includes(normalizedShift)
    ? new Date(`${date}T${String(hour).padStart(2, '0')}:00:00-05:00`)
    : null;
};

/** Re-renders the station when its own Lima cutoff arrives, without reload. */
export function useInitialClosed({ fechaOperativa, turno } = {}) {
  const [closed, setClosed] = useState(() => isInitialClosed({ fechaOperativa, turno }));

  useEffect(() => {
    let disposed = false;
    let timer;
    const target = cutoffDate(fechaOperativa, turno);

    // Browsers clamp setTimeout to a signed 32-bit delay. Re-check in chunks
    // for future OTs and re-arm the callback until the actual cutoff arrives.
    const refresh = () => {
      if (disposed) return;
      const now = Date.now();
      const nextClosed = isInitialClosed({ fechaOperativa, turno, now });
      setClosed(nextClosed);
      const remaining = target ? target.getTime() - now : 0;
      if (!target || nextClosed || remaining <= 0) return;
      const delay = Math.min(Math.max(1, remaining + 1), 2_147_483_647);
      timer = window.setTimeout(refresh, delay);
    };

    refresh();
    return () => {
      disposed = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [fechaOperativa, turno]);

  return closed;
}
