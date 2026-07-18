import { NavLink, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
  Collapse,
  AppBar,
  IconButton,
  useMediaQuery,
  useTheme
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AssignmentIcon from '@mui/icons-material/Assignment';
import InventoryIcon from '@mui/icons-material/Inventory2';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import CategoryIcon from '@mui/icons-material/Category';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import FactoryIcon from '@mui/icons-material/Factory';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import ListAltIcon from '@mui/icons-material/ListAlt';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import DescriptionIcon from '@mui/icons-material/Description';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import RateReviewIcon from '@mui/icons-material/RateReview';
import MenuIcon from '@mui/icons-material/Menu';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import MoveToInboxOutlinedIcon from '@mui/icons-material/MoveToInboxOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import ScaleOutlinedIcon from '@mui/icons-material/ScaleOutlined';
import { useState } from 'react';

const drawerWidth = 240;

const ordenesItems = [
  { path: '/ordenes', label: 'Lista de OPs', icon: <ListAltIcon /> },
  { path: '/ordenes/nueva', label: 'Nueva OP manual', icon: <AddCircleIcon /> },
];

const materialesItems = [
  { path: '/materiales/recepciones', label: 'Recepciones', icon: <MoveToInboxOutlinedIcon /> },
  { path: '/materiales', label: 'Preparación OP', icon: <Inventory2OutlinedIcon />, end: true },
];

const pesajeItems = [
  { path: '/pesaje/avance', label: 'Avance de producción', icon: <ScaleOutlinedIcon /> },
  { path: '/pesaje/ordenes', label: 'Todas las OP', icon: <ListAltIcon /> },
];

const catalogoItems = [
  { path: '/catalogo/configurar', label: 'Config. Rápida', icon: <AddCircleIcon />, highlight: true },
  { path: '/catalogo/productos', label: 'Productos (PT)', icon: <CategoryIcon /> },
  { path: '/catalogo/piezas', label: 'Piezas / SKUs', icon: <CategoryIcon /> },
  { path: '/catalogo/moldes', label: 'Moldes', icon: <PrecisionManufacturingIcon /> },
  { path: '/catalogo/trabajadores', label: 'Trabajadores', icon: <CategoryIcon /> },
  { path: '/catalogo/maquinas', label: 'Máquinas', icon: <PrecisionManufacturingIcon /> },
  { path: '/catalogo/importar', label: 'Importar Excel', icon: <CloudUploadIcon /> },
  { path: '/catalogo/revision', label: 'Revisión Datos', icon: <RateReviewIcon /> },
];

const registrosItems = [
  { path: '/registros', label: 'Lista Registros', icon: <DescriptionIcon /> },
  { path: '/registros/talonarios', label: 'Talonarios OT', icon: <MenuBookIcon /> },
];

function Sidebar() {
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ordenesOpen, setOrdenesOpen] = useState(
    location.pathname.startsWith('/ordenes')
  );
  const [materialesOpen, setMaterialesOpen] = useState(location.pathname.startsWith('/materiales'));
  const [pesajeOpen, setPesajeOpen] = useState(location.pathname.startsWith('/pesaje'));
  const [catalogoOpen, setCatalogoOpen] = useState(
    location.pathname.startsWith('/catalogo')
  );
  const [registrosOpen, setRegistrosOpen] = useState(
    location.pathname.startsWith('/registros')
  );

  const closeOnMobile = () => {
    if (isMobile) setMobileOpen(false);
  };

  return (
    <>
      {isMobile && (
        <AppBar
          position="fixed"
          elevation={0}
          sx={{ bgcolor: '#1E3A5F', borderBottom: '1px solid rgba(255,255,255,0.12)', zIndex: theme.zIndex.drawer - 1 }}
        >
          <Toolbar sx={{ minHeight: 56 }}>
            <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(true)} aria-label="Abrir navegación">
              <MenuIcon />
            </IconButton>
            <FactoryIcon sx={{ ml: 1.5, mr: 1, fontSize: 24 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Envaperu</Typography>
          </Toolbar>
        </AppBar>
      )}
      <Drawer
      variant={isMobile ? 'temporary' : 'permanent'}
      open={isMobile ? mobileOpen : true}
      onClose={() => setMobileOpen(false)}
      ModalProps={{ keepMounted: true }}
      sx={{
        width: isMobile ? 0 : drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          background: 'linear-gradient(180deg, #1E3A5F 0%, #0D2137 100%)',
          color: '#FFFFFF',
        },
      }}
    >
      <Toolbar sx={{ py: 2 }}>
        <FactoryIcon sx={{ mr: 1.5, fontSize: 28 }} />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Envaperu
        </Typography>
      </Toolbar>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
      
      <List sx={{ px: 1 }}>
        {/* Dashboard */}
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton
            component={NavLink}
            to="/"
            onClick={closeOnMobile}
            sx={{
              borderRadius: 2,
              '&.active': { backgroundColor: 'rgba(255,255,255,0.15)' },
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
              <DashboardIcon />
            </ListItemIcon>
            <ListItemText primary="Dashboard" />
          </ListItemButton>
        </ListItem>

        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton
            component={NavLink}
            to="/guia/scm"
            onClick={closeOnMobile}
            sx={{
              borderRadius: 2,
              '&.active': { backgroundColor: 'rgba(255,255,255,0.15)' },
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
              <MapOutlinedIcon />
            </ListItemIcon>
            <ListItemText primary="Guía SCM" />
          </ListItemButton>
        </ListItem>

        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton
            component={NavLink}
            to="/planificacion"
            onClick={closeOnMobile}
            sx={{
              borderRadius: 2,
              '&.active': { backgroundColor: 'rgba(255,255,255,0.15)' },
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
              <EventNoteOutlinedIcon />
            </ListItemIcon>
            <ListItemText primary="Planificación" />
          </ListItemButton>
        </ListItem>

        {/* Órdenes de Producción Submenu */}
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton
            onClick={() => setOrdenesOpen(!ordenesOpen)}
            sx={{
              borderRadius: 2,
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
              <AssignmentIcon />
            </ListItemIcon>
            <ListItemText primary="Órdenes de Producción" />
            {ordenesOpen ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
        </ListItem>
        <Collapse in={ordenesOpen} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {ordenesItems.map((item) => (
              <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  component={NavLink}
                  to={item.path}
                  end={item.path === '/ordenes'}
                  onClick={closeOnMobile}
                  sx={{
                    pl: 4,
                    borderRadius: 2,
                    ...(item.highlight && {
                      background: 'rgba(46, 125, 50, 0.3)',
                      border: '1px solid rgba(46, 125, 50, 0.5)',
                    }),
                    '&.active': { backgroundColor: 'rgba(255,255,255,0.15)' },
                    '&:hover': { 
                      backgroundColor: item.highlight ? 'rgba(46, 125, 50, 0.5)' : 'rgba(255,255,255,0.1)' 
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Collapse>

        {/* Pesaje Submenu */}
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton
            onClick={() => setPesajeOpen(!pesajeOpen)}
            sx={{
              borderRadius: 2,
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
              <ScaleOutlinedIcon />
            </ListItemIcon>
            <ListItemText primary="Pesaje" />
            {pesajeOpen ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
        </ListItem>
        <Collapse in={pesajeOpen} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {pesajeItems.map((item) => (
              <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  component={NavLink}
                  to={item.path}
                  onClick={closeOnMobile}
                  sx={{
                    pl: 4,
                    borderRadius: 2,
                    '&.active': { backgroundColor: 'rgba(255,255,255,0.15)' },
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                  }}
                >
                  <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Collapse>

        {/* Materias Primas Submenu */}
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton
            onClick={() => setMaterialesOpen(!materialesOpen)}
            sx={{
              borderRadius: 2,
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
              <WarehouseOutlinedIcon />
            </ListItemIcon>
            <ListItemText primary="Materias primas" />
            {materialesOpen ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
        </ListItem>
        <Collapse in={materialesOpen} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {materialesItems.map((item) => (
              <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  component={NavLink}
                  to={item.path}
                  end={item.end}
                  onClick={closeOnMobile}
                  sx={{
                    pl: 4,
                    borderRadius: 2,
                    '&.active': { backgroundColor: 'rgba(255,255,255,0.15)' },
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                  }}
                >
                  <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Collapse>

        {/* Catálogo Submenu */}
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton
            onClick={() => setCatalogoOpen(!catalogoOpen)}
            sx={{
              borderRadius: 2,
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
              <InventoryIcon />
            </ListItemIcon>
            <ListItemText primary="Catálogo" />
            {catalogoOpen ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
        </ListItem>
        <Collapse in={catalogoOpen} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {catalogoItems.map((item) => (
              <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  component={NavLink}
                  to={item.path}
                  onClick={closeOnMobile}
                  sx={{
                    pl: 4,
                    borderRadius: 2,
                    ...(item.highlight && {
                      background: 'rgba(2, 136, 209, 0.3)',
                      border: '1px solid rgba(2, 136, 209, 0.5)',
                    }),
                    '&.active': { backgroundColor: 'rgba(255,255,255,0.15)' },
                    '&:hover': { 
                      backgroundColor: item.highlight ? 'rgba(2, 136, 209, 0.5)' : 'rgba(255,255,255,0.1)' 
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Collapse>

        {/* Registros Submenu */}
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton
            onClick={() => setRegistrosOpen(!registrosOpen)}
            sx={{ borderRadius: 2, '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' } }}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
              <DescriptionIcon />
            </ListItemIcon>
            <ListItemText primary="Registros" />
            {registrosOpen ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
        </ListItem>
        <Collapse in={registrosOpen} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {registrosItems.map((item) => (
              <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  component={NavLink}
                  to={item.path}
                  end={item.path === '/registros'}
                  onClick={closeOnMobile}
                  sx={{
                    pl: 4,
                    borderRadius: 2,
                    '&.active': { backgroundColor: 'rgba(255,255,255,0.15)' },
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                  }}
                >
                  <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Collapse>
      </List>
      </Drawer>
    </>
  );
}

export default Sidebar;

