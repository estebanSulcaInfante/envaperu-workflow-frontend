import { useEffect, useState } from 'react';
import { Alert, Button } from '@mui/material';
import { Navigate } from 'react-router-dom';
import { obtenerOtScm } from '../../services/scmOtApi';

export function QualityOtContextRedirect({ otId, location }) {
  const [context, setContext] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    obtenerOtScm(otId, { signal: controller.signal, vista: 'calidad' }).then(response => {
      if (controller.signal.aborted) return;
      const ot = response?.ot || response;
      if (String(ot?.public_id || ot?.id) !== otId ||
          !/^\d{4}-\d{2}-\d{2}$/.test(ot?.fecha_operativa) ||
          !['DIA', 'NOCHE', 'EXTRA'].includes(ot?.turno)) {
        throw new Error('Jornada desconocida');
      }
      setContext(ot);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [otId, attempt]);

  if (failed) {
    return <Alert severity="error" action={<Button onClick={() => setAttempt(value => value + 1)}>Reintentar</Button>}>No se pudo consultar la jornada de esta OT.</Alert>;
  }
  if (!context) return <span role="status">Cargando la jornada de la OT…</span>;
  const query = new URLSearchParams(location.search);
  if (!query.get('fecha')) query.set('fecha', context.fecha_operativa);
  if (!query.get('turno')) query.set('turno', context.turno);
  return <Navigate replace state={{ qualityOtContext: context }} to={{ pathname: location.pathname, search: query.toString(), hash: location.hash }} />;
}
