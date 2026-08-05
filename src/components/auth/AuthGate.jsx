import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import LoginPage from './LoginPage';
import SetPasswordPage from './SetPasswordPage';

export default function AuthGate({ children }) {
  const {
    authMode, loading, passwordSetupRequired, session,
  } = useAuth();

  if (authMode !== 'supabase') return children;
  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress aria-label="Verificando sesión" />
      </Box>
    );
  }
  if (!session) return <LoginPage />;
  if (passwordSetupRequired) return <SetPasswordPage />;
  return children;
}
