import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { 
  ThemeProvider, 
  createTheme, 
  CssBaseline,
  Box
} from '@mui/material';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import OrdenForm from './components/OrdenForm';
import OrdenesLista from './components/OrdenesLista';
import CatalogoSKU from './components/CatalogoSKU';
import RegistrosLista from './components/RegistrosLista';
import MoldesLista from './components/MoldesLista';
import ProductosAdmin from './components/ProductosAdmin';
import PiezasAdmin from './components/PiezasAdmin';

// Tema claro corporativo ENVAPERU
const envaTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1E3A5F',
      light: '#E3F2FD',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#D32F2F',
    },
    success: {
      main: '#2E7D32',
      light: '#E8F5E9',
    },
    warning: {
      main: '#F57C00',
      light: '#FFF3E0',
    },
    info: {
      main: '#0288D1',
      light: '#E1F5FE',
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

function App() {
  return (
    <ThemeProvider theme={envaTheme}>
      <CssBaseline />
      <BrowserRouter>
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
          <Sidebar />
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              p: 3,
              background: '#F5F5F5',
              minHeight: '100vh',
            }}
          >
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/ordenes" element={<OrdenesLista />} />
              <Route path="/ordenes/nueva" element={<OrdenForm />} />
              <Route path="/catalogo/productos" element={<ProductosAdmin />} />
              <Route path="/catalogo/piezas" element={<PiezasAdmin />} />
              <Route path="/catalogo/moldes" element={<MoldesLista />} />
              <Route path="/registros" element={<RegistrosLista />} />
            </Routes>
          </Box>
        </Box>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
