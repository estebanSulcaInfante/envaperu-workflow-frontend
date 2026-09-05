/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, Paper, Stack, Typography, Checkbox, FormControlLabel } from '@mui/material';
import FabricationOrderReplacement from '../src/components/FabricationOrderReplacement';

const original = {
  id: 'fixture-of-24', codigo: 'OF-000024', estado: 'LIBERADA', version: 3,
  plan_produccion_id: 'plan-confirmado-fixture',
  procedencia: { op_codigo: 'OP-000006' },
  corridas: [{ color_nombre: 'Azul', salidas: [{ articulo: { nombre: 'Pieza azul', codigo: 'PC-01' }, cantidad_objetivo: '120.000', kg_estandar_objetivo: '18.000000' }] }],
};

function Preview() {
  const [conflict, setConflict] = useState(false);
  const [order, setOrder] = useState(original);
  return <><CssBaseline /><Stack spacing={3} sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
    <Typography variant="h4">Reemplazo de OF · revisión local</Typography>
    <Typography>Fixture ficticio: no conecta con la API ni modifica documentos.</Typography>
    <FormControlLabel label="Simular conflicto recuperable" control={<Checkbox checked={conflict} onChange={(event) => setConflict(event.target.checked)} />} />
    <Paper sx={{ p: 3 }} variant="outlined"><Stack spacing={2}>
      <Typography variant="h6">{order.codigo} · {order.estado}</Typography>
      <FabricationOrderReplacement order={order} allowed onSubmit={async (_, motivo) => {
        if (conflict) throw new Error('La OF cambió. Actualice la revisión antes de confirmar.');
        setOrder({ ...order, estado: 'ANULADA', reemplazo: { sucesora: { id: 'fixture-of-36', codigo: 'OF-000036' } } });
        return { sucesora: { id: 'fixture-of-36', codigo: 'OF-000036' }, motivo };
      }} />
    </Stack></Paper>
  </Stack></>;
}
createRoot(document.getElementById('root')).render(<Preview />);
