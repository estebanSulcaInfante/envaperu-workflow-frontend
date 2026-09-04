import React from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, Paper, Stack, Typography, Alert } from '@mui/material';
import { OtCreationReview, OtAnnulmentAction } from '../src/components/OtHeaderSafety';

const ot = { public_id: 'qa-not-a-real-ot', codigo_ot: 'OT-QA-M4', estado: 'PLANIFICADA', version: 1,
  maquina_codigo: 'INY-01', fecha_operativa: '2026-09-02', turno: 'DIA', trabajos_color: [], mangas: [] };
// Static visual fixture. Do not confirm annulment: it uses a non-UUID identity.
createRoot(document.getElementById('root')).render(<><CssBaseline /><Stack spacing={2} sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
  <Typography variant="h5">M4 · Evidencia visual aislada</Typography>
  <Alert severity="info">Datos ficticios; esta página no pertenece a la UAT guiada ni acredita aceptación humana.</Alert>
  <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="h6">Revisión de creación</Typography>
    <OtCreationReview form={{ maquina_id: 1, fecha_operativa: '2026-09-02', turno: 'DIA' }} machine="INY-01 · Inyectora 1" worker="Jose Quispe" onConfirm={async () => { throw new Error('Simulación de respuesta perdida'); }} />
  </Paper>
  <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="h6">OT vacía · solo abrir y volver</Typography>
    <OtAnnulmentAction ot={ot} allowed onSuccess={async () => {}} onRefresh={async () => {}} />
  </Paper>
  <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="h6">Bloqueo por trabajo vinculado</Typography>
    <OtAnnulmentAction ot={{ ...ot, trabajos_color: [{ id: 1 }], bloqueo_anulacion: 'La OT tiene trabajos vinculados; no se anula en cascada.' }} allowed />
  </Paper>
  <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="h6">Resultado simulado</Typography>
    <OtAnnulmentAction ot={{ ...ot, estado: 'ANULADA', anulacion: { motivo: 'Se seleccionó una fecha equivocada.', actor: { nombre: 'Said Villamizar' }, fecha: '2026-09-02T20:00:00Z' } }} allowed />
  </Paper>
</Stack></>);
