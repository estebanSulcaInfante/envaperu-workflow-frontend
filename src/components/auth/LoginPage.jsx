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
import FactoryOutlinedIcon from '@mui/icons-material/FactoryOutlined';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const { error, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!email.trim() || !password) return;
    setSubmitting(true);
    try {
      await signIn(email, password);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        p: 2,
        bgcolor: '#EEF3F7',
      }}
    >
      <Paper component="form" onSubmit={submit} elevation={4} sx={{ width: '100%', maxWidth: 430, p: { xs: 3, sm: 4 } }}>
        <Stack spacing={2.25}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box sx={{ width: 46, height: 46, borderRadius: 1.5, bgcolor: 'primary.main', color: 'white', display: 'grid', placeItems: 'center' }}>
              <FactoryOutlinedIcon />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={850}>EnvaPerú SCM</Typography>
              <Typography variant="body2" color="text.secondary">Acceso al piloto operativo</Typography>
            </Box>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Ingresa con la cuenta asignada a tu función. El sistema mostrará únicamente las tareas autorizadas para tu perfil.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Correo"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoFocus
          />
          <TextField
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <LoginOutlinedIcon />}
            disabled={submitting || !email.trim() || !password}
          >
            {submitting ? 'Ingresando…' : 'Iniciar sesión'}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

