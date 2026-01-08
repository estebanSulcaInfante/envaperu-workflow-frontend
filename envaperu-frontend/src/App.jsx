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
import InventoryIcon from '@mui/icons-material/Inventory2';
import AssignmentIcon from '@mui/icons-material/Assignment';
import OrdenForm from './components/OrdenForm';
import OrdenesLista from './components/OrdenesLista';
import CatalogoSKU from './components/CatalogoSKU';
import RegistrosLista from './components/RegistrosLista';

// Tema claro corporativo ENVAPERU
const envaTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1E3A5F',      // Azul oscuro corporativo
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#D32F2F',      // Rojo corporativo
    },
    success: {
      main: '#2E7D32',
    },
    warning: {
      main: '#F57C00',
    },
    background: {
      default: '#F5F5F5',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1A1A1A',
      secondary: '#666666',
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
          borderRadius: 8,
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
    <ThemeProvider theme={envaTheme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', background: '#F5F5F5' }}>
        {/* AppBar corporativo */}
        <AppBar 
          position="static" 
          sx={{ 
            background: 'linear-gradient(135deg, #1E3A5F 0%, #0D2137 100%)',
            boxShadow: '0 2px 8px rgba(30, 58, 95, 0.3)'
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
              background: '#FFFFFF',
              border: '1px solid #E0E0E0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
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
              <Tab 
                icon={<InventoryIcon />} 
                iconPosition="start" 
                label="Catálogo SKU" 
              />
              <Tab 
                icon={<AssignmentIcon />} 
                iconPosition="start" 
                label="Registros Diarios" 
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
          
          <TabPanel value={tabValue} index={2}>
            <CatalogoSKU />
          </TabPanel>
          
          <TabPanel value={tabValue} index={3}>
            <RegistrosLista />
          </TabPanel>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
