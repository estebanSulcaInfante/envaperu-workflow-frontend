import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { 
  ThemeProvider, 
  createTheme, 
  CssBaseline,
} from '@mui/material';
import AppShell from './components/layout/AppShell';
import Dashboard from './components/Dashboard';
import OrdenForm from './components/OrdenForm';
import OrdenesLista from './components/OrdenesLista';
import RegistrosLista from './components/RegistrosLista';
import MoldesLista from './components/MoldesLista';
import MoldeDetalle from './components/MoldeDetalle';
import ProductosAdmin from './components/ProductosAdmin';
import PiezasAdmin from './components/PiezasAdmin';
import TrabajadoresAdmin from './components/TrabajadoresAdmin';
import MaquinasAdmin from './components/MaquinasAdmin';
import TalonariosAdmin from './components/TalonariosAdmin';
import ImportarCatalogo from './components/ImportarCatalogo';
import ConfigurarProducto from './components/ConfigurarProducto';
import RevisionProductos from './components/RevisionProductos';
import PlanificacionProduccion from './components/PlanificacionProduccion';
import PreparacionMateriales from './components/PreparacionMateriales';
import RecepcionMateriales from './components/RecepcionMateriales';
import ScmGuide from './components/ScmGuide';
import ProductionProgressDashboard from './components/ProductionProgressDashboard';
import LegacyProductionOrders from './components/LegacyProductionOrders';
import MasterDataHub from './components/MasterDataHub';
import ColoresRecetasAdmin from './components/ColoresRecetasAdmin';
import MaterialCatalogPage from './components/MaterialCatalogPage';
import LineasFamiliasAdmin from './components/LineasFamiliasAdmin';
import ErrorBoundary from './components/ErrorBoundary';

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
    MuiTableCell: {
      styleOverrides: {
        head: {
          backgroundColor: '#EEF2F5',
          color: '#243746',
          fontWeight: 750,
          whiteSpace: 'nowrap',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 650,
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
        <AppShell>
          <ErrorBoundary>
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/guia/scm" element={<ScmGuide />} />
                <Route path="/planificacion" element={<PlanificacionProduccion />} />
                <Route path="/planificacion/:solicitudId" element={<PlanificacionProduccion />} />
                <Route path="/produccion/ordenes" element={<OrdenesLista />} />
                <Route path="/produccion" element={<Navigate to="/produccion/ordenes" replace />} />
                <Route path="/produccion/ordenes/nueva-excepcional" element={<OrdenForm />} />
                <Route path="/produccion/registros" element={<RegistrosLista />} />
                <Route path="/produccion/talonarios" element={<TalonariosAdmin />} />
                <Route path="/produccion/avance" element={<ProductionProgressDashboard />} />
                <Route path="/produccion/pesajes" element={<LegacyProductionOrders />} />
                <Route path="/materiales/recepciones" element={<RecepcionMateriales />} />
                <Route path="/materiales/recepciones/nueva" element={<RecepcionMateriales />} />
                <Route path="/materiales/recepciones/:recepcionId" element={<RecepcionMateriales />} />
                <Route path="/materiales/recepciones/:recepcionId/editar" element={<RecepcionMateriales />} />
                <Route path="/materiales/compras" element={<RecepcionMateriales />} />
                <Route path="/materiales/calidad" element={<RecepcionMateriales />} />
                <Route path="/materiales/inventario" element={<RecepcionMateriales />} />
                <Route path="/materiales/documentos" element={<RecepcionMateriales />} />
                <Route path="/materiales/cobertura" element={<RecepcionMateriales />} />
                <Route path="/materiales/preparaciones" element={<PreparacionMateriales />} />
                <Route path="/materiales/preparaciones/:numeroOp" element={<PreparacionMateriales />} />
                <Route path="/ordenes/:numeroOp/materiales" element={<PreparacionMateriales />} />
                <Route path="/datos-maestros" element={<MasterDataHub />} />
                <Route path="/datos-maestros/productos" element={<ProductosAdmin />} />
                <Route path="/datos-maestros/piezas" element={<PiezasAdmin />} />
                <Route path="/datos-maestros/trabajadores" element={<TrabajadoresAdmin />} />
                <Route path="/datos-maestros/maquinas" element={<MaquinasAdmin />} />
                <Route path="/datos-maestros/moldes" element={<MoldesLista />} />
                <Route path="/datos-maestros/moldes/:codigo" element={<MoldeDetalle />} />
                <Route path="/datos-maestros/configuracion-guiada" element={<ConfigurarProducto />} />
                <Route path="/datos-maestros/materiales" element={<MaterialCatalogPage />} />
                <Route path="/datos-maestros/clasificacion" element={<LineasFamiliasAdmin />} />
                <Route path="/datos-maestros/colores" element={<ColoresRecetasAdmin />} />
                <Route path="/catalogo/importar" element={<ImportarCatalogo />} />
                <Route path="/catalogo/configurar" element={<Navigate to="/datos-maestros/configuracion-guiada" replace />} />
                <Route path="/datos-maestros/configurar" element={<Navigate to="/datos-maestros/configuracion-guiada" replace />} />
                <Route path="/catalogo/revision" element={<RevisionProductos />} />
                <Route path="/configuracion" element={<RecepcionMateriales forcedSection="configuracion" />} />

                <Route path="/ordenes" element={<Navigate to="/produccion/ordenes" replace />} />
                <Route path="/ordenes/nueva" element={<Navigate to="/produccion/ordenes/nueva-excepcional" replace />} />
                <Route path="/registros" element={<Navigate to="/produccion/registros" replace />} />
                <Route path="/registros/talonarios" element={<Navigate to="/produccion/talonarios" replace />} />
                <Route path="/pesaje/avance" element={<Navigate to="/produccion/avance" replace />} />
                <Route path="/pesaje/ordenes" element={<Navigate to="/produccion/pesajes" replace />} />
                <Route path="/materiales" element={<Navigate to="/materiales/preparaciones" replace />} />
                <Route path="/materiales/catalogos" element={<Navigate to="/datos-maestros/materiales" replace />} />
                <Route path="/materiales/configuracion" element={<Navigate to="/configuracion" replace />} />
                <Route path="/catalogo/productos" element={<Navigate to="/datos-maestros/productos" replace />} />
                <Route path="/catalogo/piezas" element={<Navigate to="/datos-maestros/piezas" replace />} />
                <Route path="/catalogo/trabajadores" element={<Navigate to="/datos-maestros/trabajadores" replace />} />
                <Route path="/catalogo/maquinas" element={<Navigate to="/datos-maestros/maquinas" replace />} />
                <Route path="/catalogo/moldes" element={<Navigate to="/datos-maestros/moldes" replace />} />
                <Route path="/catalogo/clasificacion" element={<Navigate to="/datos-maestros/clasificacion" replace />} />
                <Route path="/catalogo/moldes/:codigo" element={<MoldeDetalle />} />
            </Routes>
          </ErrorBoundary>
        </AppShell>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;

