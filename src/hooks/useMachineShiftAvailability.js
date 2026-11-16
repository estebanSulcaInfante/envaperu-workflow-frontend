import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFeedback } from '../context/FeedbackContext';
import { listarJornadasPlantaScm } from '../services/scmOtApi';

const refreshEvent = 'scm:machine-shift-changed';
const availabilityRequests = new Map();

export const unavailableMachineIds = (payload) => {
  const values = payload?.maquinas_no_trabajaran
    || payload?.maquinas_no_trabajara
    || payload?.availability?.maquinas_no_trabajaran
    || payload?.availability?.off_machine_ids
    || [];
  const explicitlyUnavailable = Array.isArray(values)
    ? values.map((item) => String(item?.maquina_id ?? item?.id ?? item))
    : [];
  // Catalog state (MANTENIMIENTO/FUERA_SERVICIO/BAJA) is not a turn-level
  // “no trabajará” decision. Only an explicit schedule field may drive this
  // label; otherwise the board stays in Sin OT/its real machine state.
  return [...new Set(explicitlyUnavailable)];
};

const acquireAvailabilityRequest = (scope) => {
  const scopeKey = scope.key;
  let entry = availabilityRequests.get(scopeKey);
  if (!entry) {
    const controller = new AbortController();
    entry = {
      controller,
      users: 0,
      settled: false,
      abortTimer: null,
      promise: listarJornadasPlantaScm({ ...scope.filters, signal: controller.signal })
        .then(unavailableMachineIds)
        .finally(() => {
          entry.settled = true;
          if (entry.users === 0) availabilityRequests.delete(scopeKey);
        }),
    };
    availabilityRequests.set(scopeKey, entry);
  }
  if (entry.abortTimer != null) window.clearTimeout(entry.abortTimer);
  entry.users += 1;
  let released = false;
  return {
    promise: entry.promise,
    release: () => {
      if (released) return;
      released = true;
      entry.users = Math.max(0, entry.users - 1);
      if (entry.users > 0) return;
      if (entry.settled) {
        availabilityRequests.delete(scopeKey);
        return;
      }
      // StrictMode replays effects synchronously. Give the next effect a chance
      // to reuse the request before aborting it, while real unmounts still abort.
      entry.abortTimer = window.setTimeout(() => {
        if (entry.users === 0 && !entry.settled) {
          entry.controller.abort();
          availabilityRequests.delete(scopeKey);
        }
      }, 0);
    },
  };
};

export async function checkMachineShiftOff(date, shift, id) {
  const payload = await listarJornadasPlantaScm({ fecha_operativa: date, turno: shift, vista: 'calidad' });
  const ids = unavailableMachineIds(payload);
  return ids.includes(String(id));
}

export function useMachineShiftAvailability(date, shift, { enabled = true } = {}) {
  const { notify } = useFeedback();
  const [snapshot, setSnapshot] = useState({ scope: '', ids: [] });
  const scope = useMemo(() => (date && shift
    ? { filters: { fecha_operativa: date, turno: shift, vista: 'calidad' }, key: `${date}/${shift}` }
    : null), [date, shift]);
  const revision = useRef(0);

  useEffect(() => {
    if (!scope || !enabled) return;
    let active = true;
    let inFlight = false;
    const ownedRequests = new Set();
    async function refresh() {
      if (!active || inFlight) return;
      inFlight = true;
      const current = ++revision.current;
      const request = acquireAvailabilityRequest(scope);
      ownedRequests.add(request);
      try {
        const ids = await request.promise;
        if (!active || current !== revision.current) return;
        setSnapshot(previous => {
          const sameIds = previous.ids.length === ids.length && previous.ids.every((id, i) => id === ids[i]);
          return previous.scope === scope.key && sameIds ? previous : { scope: scope.key, ids };
        });
      } catch {
        if (active) notify('No se pudo actualizar la disponibilidad de las máquinas.');
      } finally {
        ownedRequests.delete(request);
        request.release();
        inFlight = false;
      }
    }
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener(refreshEvent, refresh);
    return () => {
      active = false;
      ownedRequests.forEach((request) => request.release());
      ownedRequests.clear();
      window.removeEventListener('focus', refresh);
      window.removeEventListener(refreshEvent, refresh);
    };
  }, [enabled, scope, notify]);

  const isOff = id => snapshot.scope === scope?.key && snapshot.ids.includes(String(id));
  const setOff = useCallback(async () => {
    if (scope && enabled) notify('La disponibilidad de jornada es de solo lectura hasta que exista un contrato central de programación.');
  }, [enabled, notify, scope]);
  return { isOff, setOff, canEdit: false };
}
