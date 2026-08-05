import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import LoginPage from './LoginPage';

export default function AuthGate({ children }) {
  const { authMode, loading, session } = useAuth();

  if (authMode !== 'supabase') return children;
  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress aria-label="Verificando sesión" />
      </Box>
    );
  }
  if (!session) return <LoginPage />;
  return children;
}

