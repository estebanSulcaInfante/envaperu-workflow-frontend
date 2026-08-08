import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { 
  ThemeProvider, 
  createTheme, 
  CssBaseline,
} from '@mui/material';
import AppShell from './components/layout/AppShell';
import RoleHome from './components/RoleHome';
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
import ProductionPlanningScm from './components/ProductionPlanningScm';
import PreparacionMateriales from './components/PreparacionMateriales';
import RecepcionMateriales from './components/RecepcionMateriales';
import ScmGuide from './components/ScmGuide';
import ProductionProgressDashboard from './components/ProductionProgressDashboard';
import LegacyProductionOrders from './components/LegacyProductionOrders';
import MasterDataHub from './components/MasterDataHub';
import ColoresRecetasAdmin from './components/ColoresRecetasAdmin';
import MaterialCatalogPage from './components/MaterialCatalogPage';
import LineasFamiliasAdmin from './components/LineasFamiliasAdmin';
import ScmEngineeringAdmin from './components/ScmEngineeringAdmin';
import OtMangasScm from './components/OtMangasScm';
import FabricationOrdersScm from './components/FabricationOrdersScm';
import AssemblyOrdersScm from './components/AssemblyOrdersScm';
import InventoryScm from './components/InventoryScm';
import ReprocessingScm from './components/ReprocessingScm';
import OperationalAlertsScm from './components/OperationalAlertsScm';
import WarehouseReceivingScm from './components/WarehouseReceivingScm';
import InternalSupplyScm from './components/InternalSupplyScm';
import ErrorBoundary from './components/ErrorBoundary';
import CapabilityRoute from './components/CapabilityRoute';
import FeatureAvailabilityRoute from './components/FeatureAvailabilityRoute';
import { ScmActorProvider } from './context/ScmActorContext';
import { AuthProvider } from './context/AuthContext';
import AuthGate from './components/auth/AuthGate';

const permitted = (element, any) => (
  <CapabilityRoute any={any}>{element}</CapabilityRoute>
);

const available = (featureKey, element) => (
  <FeatureAvailabilityRoute featureKey={featureKey}>{element}</FeatureAvailabilityRoute>
);

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
        <AuthProvider>
          <AuthGate>
            <ScmActorProvider>
              <AppShell>
                <ErrorBoundary>
              <Routes>
                <Route path="/" element={<RoleHome />} />
                <Route path="/guia/scm" element={<ScmGuide />} />
                <Route path="/planificacion" element={permitted(<ProductionPlanningScm />, ['OP_VER', 'OP_CREAR', 'OP_APROBAR', 'PLANIFICACION_CALCULAR'])} />
                <Route path="/planificacion/:solicitudId" element={<PlanificacionProduccion />} />
                <Route path="/produccion/ordenes" element={<OrdenesLista />} />
                <Route path="/produccion" element={<Navigate to="/produccion/ordenes" replace />} />
                <Route path="/produccion/ordenes/nueva-excepcional" element={<OrdenForm />} />
                <Route path="/produccion/registros" element={<RegistrosLista />} />
                <Route path="/produccion/talonarios" element={<TalonariosAdmin />} />
                <Route path="/produccion/avance" element={permitted(<ProductionProgressDashboard />, ['WIP_VER'])} />
                <Route path="/produccion/pesajes" element={permitted(<LegacyProductionOrders />, ['MANGA_PESAJE_VER'])} />
                <Route path="/produccion/ots-mangas" element={permitted(<OtMangasScm />, ['OT_VER', 'PLAN_MANGA_VER'])} />
                <Route path="/produccion/ordenes-fabricacion" element={permitted(<FabricationOrdersScm />, ['OF_VER'])} />
                <Route path="/produccion/ordenes-armado" element={permitted(<AssemblyOrdersScm />, ['OA_VER'])} />
                <Route path="/produccion/ordenes-ensamble" element={<Navigate to="/produccion/ordenes-armado" replace />} />
                <Route path="/produccion/abastecimiento" element={permitted(<InternalSupplyScm />, ['ABASTECIMIENTO_VER'])} />
                <Route path="/produccion/kardex" element={permitted(<InventoryScm />, ['INVENTARIO_VER'])} />
                <Route path="/produccion/recepcion-mangas" element={permitted(<WarehouseReceivingScm />, ['RECEPCION_MANGA_VER', 'CALIDAD_MANGA_VER'])} />
                <Route path="/produccion/reproceso" element={permitted(<ReprocessingScm />, ['MOLIENDA_VER'])} />
                <Route path="/produccion/alertas" element={permitted(<OperationalAlertsScm />, ['ALERTA_VER'])} />
                <Route path="/materiales/recepciones" element={available('external.receiving', <RecepcionMateriales />)} />
                <Route path="/materiales/recepciones/nueva" element={available('external.receiving', <RecepcionMateriales />)} />
                <Route path="/materiales/recepciones/:recepcionId" element={available('external.receiving', <RecepcionMateriales />)} />
                <Route path="/materiales/recepciones/:recepcionId/editar" element={available('external.receiving', <RecepcionMateriales />)} />
                <Route path="/materiales/compras" element={available('external.purchases', <RecepcionMateriales />)} />
                <Route path="/materiales/calidad" element={available('external.quality', <RecepcionMateriales />)} />
                <Route path="/materiales/inventario" element={available('external.inventory', <RecepcionMateriales />)} />
                <Route path="/materiales/documentos" element={available('external.documents', <RecepcionMateriales />)} />
                <Route path="/materiales/cobertura" element={available('external.coverage', <RecepcionMateriales />)} />
                <Route path="/materiales/preparaciones" element={<PreparacionMateriales />} />
                <Route path="/materiales/preparaciones/:numeroOp" element={<PreparacionMateriales />} />
                <Route path="/ordenes/:numeroOp/materiales" element={<PreparacionMateriales />} />
                <Route path="/datos-maestros" element={permitted(<MasterDataHub />, ['ARTICULO_VER', 'EMPAQUE_VER', 'CONFIG_RECEPCION_ADMINISTRAR'])} />
                <Route path="/datos-maestros/productos" element={permitted(<ProductosAdmin />, ['ARTICULO_VER'])} />
                <Route path="/datos-maestros/piezas" element={permitted(<PiezasAdmin />, ['ARTICULO_VER'])} />
                <Route path="/datos-maestros/trabajadores" element={permitted(<TrabajadoresAdmin />, ['AUTORIZACION_SCM_ADMINISTRAR'])} />
                <Route path="/datos-maestros/maquinas" element={permitted(<MaquinasAdmin />, ['CATALOGO_PLANTA_ADMINISTRAR', 'OF_EDITAR_BORRADOR', 'CONFIG_RECEPCION_ADMINISTRAR'])} />
                <Route path="/datos-maestros/moldes" element={permitted(<MoldesLista />, ['ARTICULO_VER', 'RUTA_VER'])} />
                <Route path="/datos-maestros/moldes/:codigo" element={permitted(<MoldeDetalle />, ['ARTICULO_ADMINISTRAR', 'RUTA_ADMINISTRAR'])} />
                <Route path="/datos-maestros/configuracion-guiada" element={permitted(<ConfigurarProducto />, ['ARTICULO_ADMINISTRAR'])} />
                <Route path="/datos-maestros/materiales" element={permitted(<MaterialCatalogPage />, ['CATALOGO_MATERIAL_ADMINISTRAR', 'CONFIG_RECEPCION_ADMINISTRAR', 'PROVEEDOR_ADMINISTRAR'])} />
                <Route path="/datos-maestros/clasificacion" element={permitted(<LineasFamiliasAdmin />, ['ARTICULO_ADMINISTRAR'])} />
                <Route path="/datos-maestros/colores" element={permitted(<ColoresRecetasAdmin />, ['ARTICULO_ADMINISTRAR', 'EMPAQUE_ADMINISTRAR'])} />
                <Route path="/datos-maestros/ingenieria-scm" element={permitted(<ScmEngineeringAdmin />, ['ESTRUCTURA_VER', 'RUTA_VER', 'EMPAQUE_VER'])} />
                <Route path="/datos-maestros/reproceso" element={permitted(<ReprocessingScm initialTab={4} />, ['MOLIENDA_VER', 'MOLIENDA_REGLA_ADMINISTRAR'])} />
                <Route path="/catalogo/importar" element={permitted(<ImportarCatalogo />, ['ARTICULO_ADMINISTRAR', 'CATALOGO_MATERIAL_ADMINISTRAR'])} />
                <Route path="/catalogo/configurar" element={<Navigate to="/datos-maestros/configuracion-guiada" replace />} />
                <Route path="/datos-maestros/configurar" element={<Navigate to="/datos-maestros/configuracion-guiada" replace />} />
                <Route path="/catalogo/revision" element={permitted(<RevisionProductos />, ['ARTICULO_ADMINISTRAR'])} />
                <Route path="/configuracion" element={available('admin.settings', <RecepcionMateriales forcedSection="configuracion" />)} />

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
            </ScmActorProvider>
          </AuthGate>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;

