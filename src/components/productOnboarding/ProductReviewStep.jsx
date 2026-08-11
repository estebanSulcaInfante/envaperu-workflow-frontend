import {
  Alert,
  Checkbox,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ReadinessReviewPanel } from '../scmEngineering/editors';
import { normalizeReadiness } from './engineeringStepModel';
import {
  normalizeReviewData,
  readinessHasPendingApproval,
  reviewIsConfirmed,
} from './reviewStepModel';

export default function ProductReviewStep({
  value,
  onChange,
  readiness,
  onValidate,
  onOpenStep,
  busy = false,
  showValidation = false,
}) {
  const canonicalReadiness = normalizeReadiness(readiness);
  const data = normalizeReviewData(value, canonicalReadiness);
  const hasPendingApproval = readinessHasPendingApproval(canonicalReadiness);
  const updateConfirmation = (field, checked) => onChange({
    ...data,
    confirmaciones: { ...data.confirmaciones, [field]: checked },
  });

  return (
    <Stack spacing={2.25}>
      <Stack spacing={0.5}>
        <Typography variant="overline" color="primary.main" sx={{ fontWeight: 850 }}>
          6 · Decisión autoritativa
        </Typography>
        <Typography component="h2" variant="h5" sx={{ fontWeight: 900 }}>
          Revisión y readiness
        </Typography>
        <Typography color="text.secondary">
          El resultado consulta los maestros canónicos actuales. Esta pantalla no usa una
          checklist local para declarar que el producto está listo.
        </Typography>
      </Stack>
      <ReadinessReviewPanel
        readiness={canonicalReadiness}
        onValidate={onValidate}
        onOpenStep={onOpenStep}
        busy={busy}
      />
      {hasPendingApproval && (
        <Alert severity="warning">
          {canonicalReadiness.status === 'PENDING_APPROVAL'
            ? 'Captura completa · pendiente de aprobación. Puedes cerrar la captura, pero todavía no se mostrará como Listo para planificar.'
            : 'Hay revisiones pendientes de aprobación. Confirma que aceptas este handoff antes de cerrar la captura.'}
        </Alert>
      )}
      <Stack spacing={0.5}>
        <FormControlLabel
          control={(
            <Checkbox
              checked={data.confirmaciones.datos_fuente_revisados}
              onChange={(event) => updateConfirmation(
                'datos_fuente_revisados', event.target.checked,
              )}
            />
          )}
          label="Revisé la identidad, las fuentes y las referencias aplicadas"
        />
        <FormControlLabel
          control={(
            <Checkbox
              checked={data.confirmaciones.entiende_que_no_crea_op}
              onChange={(event) => updateConfirmation(
                'entiende_que_no_crea_op', event.target.checked,
              )}
            />
          )}
          label="Entiendo que finalizar esta captura no crea una OP ni reserva inventario"
        />
        {hasPendingApproval && (
          <FormControlLabel
            control={(
              <Checkbox
                checked={data.confirmaciones.pendientes_aceptados}
                onChange={(event) => updateConfirmation(
                  'pendientes_aceptados', event.target.checked,
                )}
              />
            )}
            label="Acepto cerrar la captura con las aprobaciones pendientes mostradas arriba"
          />
        )}
      </Stack>
      <TextField
        multiline
        minRows={3}
        label="Notas de cierre"
        value={data.notas}
        onChange={(event) => onChange({ ...data, notas: event.target.value })}
      />
      {showValidation && !reviewIsConfirmed(data, canonicalReadiness) && (
        <Alert severity="error">
          Confirma la revisión de fuentes, que este flujo no crea una OP y, si corresponde,
          la aceptación de aprobaciones pendientes.
        </Alert>
      )}
      <Alert severity="info">
        Las cinco fases y el snapshot de {data.revisiones_revisadas.length} revisión(es)
        canónica(s) quedan registrados en esta confirmación.
      </Alert>
    </Stack>
  );
}
