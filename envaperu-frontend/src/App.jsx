import { useState } from 'react';
import { 
  ThemeProvider, 
  createTheme, 
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Tabs,
  Tab,
  Paper
} from '@mui/material';
import FactoryIcon from '@mui/icons-material/Factory';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import ListAltIcon from '@mui/icons-material/ListAlt';
import OrdenForm from './components/OrdenForm';
import OrdenesLista from './components/OrdenesLista';

// Tema oscuro personalizado
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#4facfe',
    },
    secondary: {
      main: '#764ba2',
    },
    background: {
      default: '#0f0f23',
      paper: '#1a1a2e',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 16,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
          },
        },
      },
    },
  },
});

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index} style={{ paddingTop: 24 }}>
      {value === index && children}
    </div>
  );
}

function App() {
  const [tabValue, setTabValue] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleOrdenCreada = () => {
    setRefreshKey(prev => prev + 1);
    setTabValue(1); // Ir a lista después de crear
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', background: 'linear-gradient(180deg, #0f0f23 0%, #1a1a2e 100%)' }}>
        {/* AppBar con gradiente */}
        <AppBar 
          position="static" 
          sx={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            boxShadow: '0 4px 20px rgba(102, 126, 234, 0.3)'
          }}
        >
          <Toolbar>
            <FactoryIcon sx={{ mr: 2, fontSize: 32 }} />
            <Typography variant="h5" component="div" sx={{ flexGrow: 1, fontWeight: 700 }}>
              Envaperu Workflow
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              Sistema de Producción
            </Typography>
          </Toolbar>
        </AppBar>

        <Container maxWidth="lg" sx={{ py: 4 }}>
          {/* Tabs de navegación */}
          <Paper 
            sx={{ 
              mb: 3, 
              background: 'rgba(26, 26, 46, 0.8)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <Tabs 
              value={tabValue} 
              onChange={handleTabChange}
              variant="fullWidth"
              sx={{
                '& .MuiTab-root': {
                  py: 2,
                  fontSize: '1rem',
                },
              }}
            >
              <Tab 
                icon={<AddCircleIcon />} 
                iconPosition="start" 
                label="Crear Orden" 
              />
              <Tab 
                icon={<ListAltIcon />} 
                iconPosition="start" 
                label="Lista de Órdenes" 
              />
            </Tabs>
          </Paper>

          {/* Contenido de tabs */}
          <TabPanel value={tabValue} index={0}>
            <OrdenForm onOrdenCreada={handleOrdenCreada} />
          </TabPanel>
          
          <TabPanel value={tabValue} index={1}>
            <OrdenesLista key={refreshKey} />
          </TabPanel>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
