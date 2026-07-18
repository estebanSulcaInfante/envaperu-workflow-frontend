import { Button, Tooltip } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

function ApiPendingButton({
  label,
  capability = { apiReady: false },
  onClick,
  size = 'small',
  variant = 'outlined',
  fullWidth = false,
}) {
  const enabled = capability.apiReady && typeof onClick === 'function';
  const accessibleLabel = enabled ? label : `${label} (API pendiente)`;
  const tooltip = enabled
    ? label
    : 'API pendiente: el comando no modificará datos hasta implementar su contrato backend';

  return (
    <Tooltip title={tooltip} arrow>
      <span style={{ display: fullWidth ? 'block' : 'inline-flex', width: fullWidth ? '100%' : 'auto' }}>
        <Button
          aria-label={accessibleLabel}
          disabled={!enabled}
          fullWidth={fullWidth}
          onClick={enabled ? onClick : undefined}
          size={size}
          variant={variant}
          startIcon={enabled ? undefined : <LockOutlinedIcon />}
          sx={{ minHeight: 36, whiteSpace: 'nowrap' }}
        >
          {label}
        </Button>
      </span>
    </Tooltip>
  );
}

export default ApiPendingButton;
