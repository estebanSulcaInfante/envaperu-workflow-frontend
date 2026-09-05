import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, Paper, Stack, Typography, Checkbox, FormControlLabel } from '@mui/material';
import DraftOrderAnnulment from '../src/components/DraftOrderAnnulment';

function Preview() {
  const [fail, setFail] = useState(false);
  const [order, setOrder] = useState({ id: 'fixture', codigo: 'OF-000001', estado: 'BORRADOR', version: 1 });
  return <><CssBaseline /><Stack spacing={3} sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
    <Typography variant="h4">Anulación OF/OA · revisión local</Typography>
    <Typography>Datos ficticios. Esta página no envía comandos a la central.</Typography>
    <FormControlLabel label="Simular conflicto de versión" control={<Checkbox checked={fail} onChange={(e) => setFail(e.target.checked)} />} />
    <Paper sx={{ p: 3 }} variant="outlined"><Stack spacing={2}>
      <Typography variant="h6">{order.codigo} · {order.estado}</Typography>
      <DraftOrderAnnulment order={order} allowed onSubmit={async (_, motivo) => {
        if (fail) throw new Error('La orden cambió. Vuelva y actualice antes de anular.');
        setOrder({ ...order, estado: 'ANULADA', anulacion: { motivo, actor_id: 1, actor: { nombre: 'Responsable de prueba' }, fecha: new Date().toISOString() } });
      }} />
    </Stack></Paper>
  </Stack></>;
}
createRoot(document.getElementById('root')).render(<Preview />);
