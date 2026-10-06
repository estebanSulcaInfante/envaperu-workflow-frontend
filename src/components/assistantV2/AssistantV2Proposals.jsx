import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Divider, Stack, TextField, Typography } from '@mui/material';
import { decideScmAssistantProposal, listScmAssistantProposals } from '../../services/scmAssistantV2Api';

const statusLabel = {
  PENDIENTE: 'Pendiente',
  EN_PREPARACION: 'En preparación',
  LISTA_REVISION: 'Lista para revisión',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
};

export default function AssistantV2Proposals() {
  const [payload, setPayload] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true); setError('');
    try { setPayload(await listScmAssistantProposals()); } catch { setError('No se pudieron cargar las propuestas.'); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const decide = async (decision) => {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      await decideScmAssistantProposal(selected.id, {
        expected_version: selected.version,
        diff_sha256: selected.diff_sha256,
        decision,
      });
      setSelected(null);
      await load();
    } catch { setError('La decisión no se aplicó; revisa la versión y la huella exactas.'); setBusy(false); }
  };

  if (busy && !payload) return <Stack alignItems="center" sx={{ py: 3 }}><CircularProgress size={22} /></Stack>;
  return (
    <Stack spacing={1.25} sx={{ mt: 1 }}>
      <Typography variant="caption" sx={{ color: '#b6c1cc' }}>
        Las propuestas preparan un diff manual. La ejecución automática está deshabilitada; cualquier cambio posterior invalida la aprobación.
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {!(payload?.items || []).length && !error && <Typography variant="body2" sx={{ color: '#d6dee8' }}>No hay propuestas para revisar.</Typography>}
      {(payload?.items || []).map((item) => (
        <Box key={item.id} sx={{ border: '1px solid #344454', borderRadius: 1.5, p: 1.25 }}>
          <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
            <Box sx={{ minWidth: 0 }}><Typography variant="body2" sx={{ color: '#f5f7fa', fontWeight: 750 }}>{item.need}</Typography><Typography variant="caption" sx={{ color: '#9daaba' }}>v{item.version} · {item.diff_sha256 || 'sin huella'}</Typography></Box>
            <Chip size="small" label={statusLabel[item.status] || item.status || 'Estado no informado'} sx={{ color: '#f5f7fa', borderColor: '#53667a' }} variant="outlined" />
          </Stack>
          {item.summary && <Typography variant="body2" sx={{ color: '#d6dee8', mt: 0.75 }}>{item.summary}</Typography>}
          {item.diff && <Box component="pre" sx={{ maxHeight: 130, overflow: 'auto', bgcolor: '#101820', color: '#b9c7d6', p: 1, borderRadius: 1, fontSize: 11, mt: 0.75, whiteSpace: 'pre-wrap' }}>{item.diff}</Box>}
          {item.status === 'LISTA_REVISION' && (
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Button size="small" variant="outlined" onClick={() => setSelected(item)}>Revisar</Button>
              {selected?.id === item.id && <><Button size="small" color="success" variant="contained" disabled={busy} onClick={() => void decide('approve')}>Aprobar versión</Button><Button size="small" color="error" variant="outlined" disabled={busy} onClick={() => void decide('reject')}>Rechazar</Button></>}
            </Stack>
          )}
        </Box>
      ))}
      {payload?.execution_supported === false && <><Divider sx={{ borderColor: '#344454' }} /><Typography variant="caption" sx={{ color: '#f5c84c' }}>Preparada para revisión manual; no se ejecutan cambios desde aquí.</Typography></>}
    </Stack>
  );
}
