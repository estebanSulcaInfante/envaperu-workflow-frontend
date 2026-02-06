import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';

/**
 * ErrorBoundary - Captura errores de renderizado en componentes React hijos.
 * Muestra una pantalla de fallback amigable en caso de error.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log del error para debugging
    console.error('ErrorBoundary capturó un error:', error);
    console.error('Información del componente:', errorInfo);
    
    this.setState({ errorInfo });
    
    // Aquí podrías enviar el error a un servicio de monitoreo
    // reportError(error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            bgcolor: '#f5f5f5',
            p: 3
          }}
        >
          <Paper
            elevation={3}
            sx={{
              p: 4,
              maxWidth: 500,
              textAlign: 'center',
              borderRadius: 2
            }}
          >
            <ErrorOutlineIcon 
              sx={{ fontSize: 64, color: 'error.main', mb: 2 }} 
            />
            
            <Typography variant="h5" gutterBottom fontWeight="bold">
              ¡Algo salió mal!
            </Typography>
            
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Ha ocurrido un error inesperado. Por favor, intenta recargar la página 
              o volver al inicio.
            </Typography>

            {/* Mostrar detalles del error solo en desarrollo */}
            {import.meta.env.DEV && this.state.error && (
              <Paper 
                sx={{ 
                  p: 2, 
                  mb: 3, 
                  bgcolor: '#fff3e0', 
                  textAlign: 'left',
                  maxHeight: 150,
                  overflow: 'auto'
                }}
              >
                <Typography variant="caption" color="error" component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap' }}>
                  {this.state.error.toString()}
                </Typography>
              </Paper>
            )}

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={this.handleReload}
              >
                Recargar
              </Button>
              <Button
                variant="outlined"
                onClick={this.handleGoHome}
              >
                Ir al Inicio
              </Button>
            </Box>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
