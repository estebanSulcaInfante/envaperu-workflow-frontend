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
  Collapse
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
import { useState } from 'react';

const drawerWidth = 240;

const ordenesItems = [
  { path: '/ordenes', label: 'Lista de OPs', icon: <ListAltIcon /> },
  { path: '/ordenes/nueva', label: 'Nueva OP', icon: <AddCircleIcon />, highlight: true },
];

const catalogoItems = [
  { path: '/catalogo/productos', label: 'Productos SKU', icon: <CategoryIcon /> },
  { path: '/catalogo/piezas', label: 'Piezas', icon: <InventoryIcon /> },
  { path: '/catalogo/moldes', label: 'Moldes', icon: <PrecisionManufacturingIcon /> },
];

const registrosItems = [
  { path: '/registros', label: 'Lista Registros', icon: <DescriptionIcon /> },
  { path: '/registros/talonarios', label: 'Talonarios RDP', icon: <MenuBookIcon /> },
];

function Sidebar() {
  const location = useLocation();
  const [ordenesOpen, setOrdenesOpen] = useState(
    location.pathname.startsWith('/ordenes')
  );
  const [catalogoOpen, setCatalogoOpen] = useState(
    location.pathname.startsWith('/catalogo')
  );
  const [registrosOpen, setRegistrosOpen] = useState(
    location.pathname.startsWith('/registros')
  );

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
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
  );
}

export default Sidebar;

