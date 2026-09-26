import { useState } from 'react';
import { TextField } from '@mui/material';
import { formatKg, formatGrams } from '../../utils/weightDisplay';

export default function WeightInput({ unit = 'kg', value = '', positive = false, onChange, onFocus, onBlur, helperText, ...props }) {
  const [focused, setFocused] = useState(false);
  const formatted = unit === 'g' ? formatGrams(value) : formatKg(value);
  const numeric = Number(value);
  const minimum = props.slotProps?.htmlInput?.min ?? 0;
  const maximum = props.slotProps?.htmlInput?.max;
  const empty = value === '' || value == null;
  const invalid = (props.required && empty) || (!empty && (!Number.isFinite(numeric) || (positive && numeric <= 0) || numeric < minimum || (maximum != null && numeric > maximum)));
  const validationHint = invalid ? (empty ? 'Completa este peso.' : positive && numeric <= 0 ? `Indica un peso mayor que 0 ${unit}.` : `Indica un peso válido desde ${minimum}${maximum != null ? ` hasta ${maximum}` : ''} ${unit}.`) : '';
  const tiny = Number.isFinite(numeric) && numeric !== 0 && Math.abs(numeric) < (unit === 'g' ? 0.1 : 0.01);
  // number inputs cannot render the '<0.01' read-only label. Keep a tiny value exact.
  const displayValue = focused || tiny || value === '' || value == null || !Number.isFinite(numeric)
    ? (value ?? '') : formatted;
  const tinyHint = tiny ? `${numeric > 0 ? 'Menor que' : 'Mayor que -'} ${unit === 'g' ? '0.1 g' : '0.01 kg'}; se conserva el valor exacto.` : '';

  return (
    <TextField
      {...props}
      type="number"
      value={displayValue}
      onFocus={(event) => { setFocused(true); onFocus?.(event); }}
      onBlur={(event) => { setFocused(false); onBlur?.(event); }}
      onChange={onChange}
      error={props.error || invalid}
      helperText={(props.error && helperText) || validationHint || (tinyHint ? <>{helperText} {tinyHint}</> : helperText)}
      slotProps={{
        ...props.slotProps,
        htmlInput: {
          min: 0,
          ...props.slotProps?.htmlInput,
          step: 'any',
          title: value !== '' && value != null ? `${value} ${unit} (valor original)` : undefined,
        },
      }}
    />
  );
}
