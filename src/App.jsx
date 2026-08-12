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
import ProductionSupervisionScm from './components/ProductionSupervisionScm';
import PrintJobsControlScm from './components/PrintJobsControlScm';
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
import WorkspaceFeatureRoute from './components/WorkspaceFeatureRoute';
import WorkspaceAreaRedirect from './components/WorkspaceAreaRedirect';
import { ScmActorProvider } from './context/ScmActorContext';
import { AuthProvider } from './context/AuthContext';
import AuthGate from './components/auth/AuthGate';
import RolesCapabilitiesAdmin from './components/RolesCapabilitiesAdmin';
import ProductOnboardingPage from './components/productOnboarding/ProductOnboardingPage';
import WarehouseOperationsScm from './components/WarehouseOperationsScm';
import WarehouseSetupScm from './components/WarehouseSetupScm';

const workspace = (featureKey, element) => (
  <WorkspaceFeatureRoute featureKey={featureKey}>{element}</WorkspaceFeatureRoute>
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
                <Route path="/" element={workspace('home.workspace', <RoleHome />)} />
                <Route path="/guia/scm" element={<ScmGuide />} />
                <Route path="/planificacion" element={workspace('planning.demand', <ProductionPlanningScm />)} />
                <Route path="/planificacion/:solicitudId" element={workspace('planning.demand', <PlanificacionProduccion />)} />
                <Route path="/produccion/ordenes" element={workspace('control.legacyOrders', <OrdenesLista />)} />
                <Route path="/produccion" element={<WorkspaceAreaRedirect areaKey="production" />} />
                <Route path="/produccion/ordenes/nueva-excepcional" element={workspace('planning.exceptionalOp', <OrdenForm />)} />
                <Route path="/produccion/registros" element={workspace('control.dailyRecords', <RegistrosLista />)} />
                <Route path="/produccion/talonarios" element={workspace('control.talonarios', <TalonariosAdmin />)} />
                <Route path="/control" element={<WorkspaceAreaRedirect areaKey="control" />} />
                <Route path="/control/supervision-produccion" element={workspace('control.productionSupervision', <ProductionSupervisionScm />)} />
                <Route path="/control/inventario" element={workspace('control.inventory', <WarehouseOperationsScm control />)} />
                <Route path="/control/impresion-etiquetas" element={workspace('control.printJobs', <PrintJobsControlScm />)} />
                <Route path="/produccion/supervision" element={<Navigate to="/control/supervision-produccion" replace />} />
                <Route path="/produccion/avance" element={workspace('control.progress', <ProductionProgressDashboard />)} />
                <Route path="/produccion/pesajes" element={workspace('control.weighings', <LegacyProductionOrders />)} />
                <Route path="/produccion/ots-planta" element={workspace('production.machineWork', <OtMangasScm view="landing" />)} />
                <Route path="/produccion/ots-planta/trabajo" element={workspace('production.machineWork', <OtMangasScm view="detail" />)} />
                <Route path="/produccion/ots-mangas" element={workspace('production.machineWork', <OtMangasScm view="landing" />)} />
                <Route path="/produccion/ordenes-fabricacion" element={workspace('production.fabrication', <FabricationOrdersScm />)} />
                <Route path="/produccion/ordenes-armado" element={workspace('production.assembly', <AssemblyOrdersScm />)} />
                <Route path="/produccion/ordenes-ensamble" element={<Navigate to="/produccion/ordenes-armado" replace />} />
                <Route path="/produccion/abastecimiento" element={workspace('materials.internalSupply', <InternalSupplyScm />)} />
                <Route path="/produccion/kardex" element={workspace('warehouse.kardex', <InventoryScm />)} />
                <Route path="/almacen/kardex" element={workspace('warehouse.kardex', <InventoryScm />)} />
                <Route path="/almacen/operaciones" element={workspace('warehouse.operations', <WarehouseOperationsScm />)} />
                <Route path="/almacen/transferencias" element={workspace('warehouse.transfers', <WarehouseOperationsScm transfersOnly />)} />
                <Route path="/produccion/recepcion-mangas" element={workspace('warehouse.receiving', <WarehouseReceivingScm />)} />
                <Route path="/produccion/reproceso" element={workspace('materials.reprocessing', <ReprocessingScm />)} />
                <Route path="/produccion/alertas" element={workspace('control.alerts', <OperationalAlertsScm />)} />
                <Route path="/materiales/recepciones" element={workspace('external.receiving', <RecepcionMateriales />)} />
                <Route path="/materiales/recepciones/nueva" element={workspace('external.receiving', <RecepcionMateriales />)} />
                <Route path="/materiales/recepciones/:recepcionId" element={workspace('external.receiving', <RecepcionMateriales />)} />
                <Route path="/materiales/recepciones/:recepcionId/editar" element={workspace('external.receiving', <RecepcionMateriales />)} />
                <Route path="/materiales/compras" element={workspace('external.purchases', <RecepcionMateriales />)} />
                <Route path="/materiales/calidad" element={workspace('external.quality', <RecepcionMateriales />)} />
                <Route path="/materiales/inventario" element={workspace('external.inventory', <RecepcionMateriales />)} />
                <Route path="/materiales/documentos" element={workspace('external.documents', <RecepcionMateriales />)} />
                <Route path="/materiales/cobertura" element={workspace('external.coverage', <RecepcionMateriales />)} />
                <Route path="/materiales/preparaciones" element={workspace('materials.preparation', <PreparacionMateriales />)} />
                <Route path="/materiales/preparaciones/:numeroOp" element={workspace('materials.preparation', <PreparacionMateriales />)} />
                <Route path="/ordenes/:numeroOp/materiales" element={workspace('materials.preparation', <PreparacionMateriales />)} />
                <Route path="/datos-maestros" element={workspace('masters.hub', <MasterDataHub />)} />
                <Route path="/datos-maestros/alta-producto" element={workspace('masters.productOnboarding', <ProductOnboardingPage />)} />
                <Route path="/datos-maestros/alta-producto/:draftId" element={workspace('masters.productOnboarding', <ProductOnboardingPage />)} />
                <Route path="/datos-maestros/alta-producto/:draftId/:stepId" element={workspace('masters.productOnboarding', <ProductOnboardingPage />)} />
                <Route path="/datos-maestros/productos" element={workspace('masters.products', <ProductosAdmin />)} />
                <Route path="/datos-maestros/piezas" element={workspace('masters.pieces', <PiezasAdmin />)} />
                <Route path="/datos-maestros/trabajadores" element={workspace('masters.workers', <TrabajadoresAdmin />)} />
                <Route path="/datos-maestros/maquinas" element={workspace('masters.machines', <MaquinasAdmin />)} />
                <Route path="/datos-maestros/moldes" element={workspace('masters.molds', <MoldesLista />)} />
                <Route path="/datos-maestros/moldes/:codigo" element={workspace('masters.moldDetail', <MoldeDetalle />)} />
                <Route path="/datos-maestros/configuracion-guiada" element={workspace('masters.wizard', <ConfigurarProducto />)} />
                <Route path="/datos-maestros/materiales" element={workspace('masters.materials', <MaterialCatalogPage />)} />
                <Route path="/datos-maestros/clasificacion" element={workspace('masters.classification', <LineasFamiliasAdmin />)} />
                <Route path="/datos-maestros/colores" element={workspace('masters.colors', <ColoresRecetasAdmin />)} />
                <Route path="/datos-maestros/ingenieria-scm" element={workspace('masters.engineering', <ScmEngineeringAdmin />)} />
                <Route path="/datos-maestros/reproceso" element={workspace('masters.reprocessingRules', <ReprocessingScm initialTab={4} />)} />
                <Route path="/catalogo/importar" element={workspace('masters.import', <ImportarCatalogo />)} />
                <Route path="/catalogo/configurar" element={<Navigate to="/datos-maestros/configuracion-guiada" replace />} />
                <Route path="/datos-maestros/configurar" element={<Navigate to="/datos-maestros/configuracion-guiada" replace />} />
                <Route path="/catalogo/revision" element={workspace('masters.review', <RevisionProductos />)} />
                <Route path="/configuracion" element={workspace('admin.settings', <RecepcionMateriales forcedSection="configuracion" />)} />
                <Route path="/administracion/roles-capacidades" element={workspace('admin.roles', <RolesCapabilitiesAdmin />)} />
                <Route path="/administracion/almacenes" element={workspace('admin.warehouses', <WarehouseSetupScm />)} />

                <Route path="/ordenes" element={<Navigate to="/produccion/ordenes" replace />} />
                <Route path="/ordenes/nueva" element={<Navigate to="/produccion/ordenes/nueva-excepcional" replace />} />
                <Route path="/registros" element={<Navigate to="/produccion/registros" replace />} />
                <Route path="/registros/talonarios" element={<Navigate to="/produccion/talonarios" replace />} />
                <Route path="/pesaje/avance" element={<Navigate to="/produccion/avance" replace />} />
                <Route path="/pesaje/ordenes" element={<Navigate to="/produccion/pesajes" replace />} />
                <Route path="/materiales" element={<WorkspaceAreaRedirect areaKey="materials" />} />
                <Route path="/materiales/catalogos" element={<Navigate to="/datos-maestros/materiales" replace />} />
                <Route path="/materiales/configuracion" element={<Navigate to="/configuracion" replace />} />
                <Route path="/catalogo/productos" element={<Navigate to="/datos-maestros/productos" replace />} />
                <Route path="/catalogo/piezas" element={<Navigate to="/datos-maestros/piezas" replace />} />
                <Route path="/catalogo/trabajadores" element={<Navigate to="/datos-maestros/trabajadores" replace />} />
                <Route path="/catalogo/maquinas" element={<Navigate to="/datos-maestros/maquinas" replace />} />
                <Route path="/catalogo/moldes" element={<Navigate to="/datos-maestros/moldes" replace />} />
                <Route path="/catalogo/clasificacion" element={<Navigate to="/datos-maestros/clasificacion" replace />} />
                <Route path="/catalogo/moldes/:codigo" element={workspace('masters.moldDetail', <MoldeDetalle />)} />
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

