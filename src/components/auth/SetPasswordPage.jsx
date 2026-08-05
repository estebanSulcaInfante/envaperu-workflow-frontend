import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import { useAuth } from '../../context/AuthContext';

export default function SetPasswordPage() {
  const { error, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const mismatch = Boolean(confirmation) && password !== confirmation;
  const valid = password.length >= 10 && password === confirmation;

  const submit = async (event) => {
    event.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    try {
      await updatePassword(password);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2, bgcolor: '#EEF3F7' }}>
      <Paper component="form" onSubmit={submit} elevation={4} sx={{ width: '100%', maxWidth: 430, p: { xs: 3, sm: 4 } }}>
        <Stack spacing={2.25}>
          <Box sx={{ width: 46, height: 46, borderRadius: 1.5, bgcolor: 'primary.main', color: 'white', display: 'grid', placeItems: 'center' }}>
            <KeyOutlinedIcon />
          </Box>
          <Typography variant="h5" fontWeight={850}>Define tu contraseña</Typography>
          <Typography variant="body2" color="text.secondary">
            Crea una contraseña personal de al menos 10 caracteres. No la compartas con otras personas.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            helperText={password && password.length < 10 ? 'Usa al menos 10 caracteres.' : ' '}
            error={Boolean(password) && password.length < 10}
            required
            autoFocus
          />
          <TextField
            label="Confirmar contraseña"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            helperText={mismatch ? 'Las contraseñas no coinciden.' : ' '}
            error={mismatch}
            required
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={submitting || !valid}
            startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <KeyOutlinedIcon />}
          >
            {submitting ? 'Guardando…' : 'Guardar contraseña'}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
