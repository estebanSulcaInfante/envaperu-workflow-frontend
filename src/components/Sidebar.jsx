import { useState } from 'react';
import {
  AppBar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import FactoryOutlinedIcon from '@mui/icons-material/FactoryOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  getWorkspaceNavigation,
  navigationItemIsActive,
  primaryNavigation,
  supportNavigation,
  visibleByCapabilities,
} from '../config/navigation';
import { useScmActor } from '../context/ScmActorContext';

const drawerWidth = 248;

const icons = {
  dashboard: DashboardOutlinedIcon,
  planning: EventNoteOutlinedIcon,
  materials: WarehouseOutlinedIcon,
  production: FactoryOutlinedIcon,
  catalog: CategoryOutlinedIcon,
  settings: SettingsOutlinedIcon,
  guide: HelpOutlineOutlinedIcon,
};

function NavigationList({ title, items, pathname, activeWorkspace, onNavigate }) {
  return (
    <List
      dense
      subheader={(
        <ListSubheader
          component="div"
          disableSticky
          sx={{
            bgcolor: 'transparent',
            color: 'rgba(255,255,255,0.62)',
            fontSize: 11,
            fontWeight: 800,
            lineHeight: '30px',
            textTransform: 'uppercase',
          }}
        >
          {title}
        </ListSubheader>
      )}
      sx={{ px: 1 }}
    >
      {items.map((item) => {
        const Icon = icons[item.icon] || CategoryOutlinedIcon;
        const active = item.id === activeWorkspace?.id || navigationItemIsActive(pathname, item);
        return (
          <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
            <Tooltip title={item.label} placement="right" disableHoverListener={false}>
              <ListItemButton
                component={RouterLink}
                to={item.path}
                selected={active}
                onClick={onNavigate}
                sx={{
                  minHeight: 44,
                  borderRadius: 1,
                  color: 'rgba(255,255,255,0.88)',
                  '&.Mui-selected': {
                    bgcolor: 'rgba(255,255,255,0.16)',
                    color: '#FFFFFF',
                    '&::before': {
                      content: '""',
                      width: 3,
                      height: 24,
                      bgcolor: '#68B984',
                      borderRadius: 2,
                      position: 'absolute',
                      left: 0,
                    },
                  },
                  '&.Mui-selected:hover, &:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}><Icon fontSize="small" /></ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 750 : 550 }}
                />
              </ListItemButton>
            </Tooltip>
          </ListItem>
        );
      })}
    </List>
  );
}

function Sidebar() {
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const { canAny, experience } = useScmActor();
  const activeWorkspace = getWorkspaceNavigation(location.pathname);
  const closeOnMobile = () => { if (isMobile) setMobileOpen(false); };
  const visiblePrimary = visibleByCapabilities(primaryNavigation, canAny);
  const visibleSupport = visibleByCapabilities(supportNavigation, canAny);

  const drawer = (
    <Box sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ minHeight: 72, px: 2 }}>
        <FactoryOutlinedIcon sx={{ mr: 1.25, fontSize: 28 }} />
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 850, lineHeight: 1.2 }}>EnvaPerú SCM</Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.62)' }}>Vista integral</Typography>
        </Box>
      </Toolbar>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
      <NavigationList title="Mi trabajo" items={visiblePrimary} pathname={location.pathname} activeWorkspace={activeWorkspace} onNavigate={closeOnMobile} />
      <Divider sx={{ mx: 2, my: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
      <NavigationList title="Consulta y soporte" items={visibleSupport} pathname={location.pathname} activeWorkspace={activeWorkspace} onNavigate={closeOnMobile} />
      <Box sx={{ flexGrow: 1 }} />
      <Box sx={{ px: 2, py: 2 }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.82)', display: 'block', fontWeight: 700 }}>
          {experience.label}
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.54)' }}>Piloto SCM · UAT local</Typography>
      </Box>
    </Box>
  );

  return (
    <>
      {isMobile && (
        <AppBar position="fixed" elevation={0} sx={{ bgcolor: '#17324D', borderBottom: '1px solid rgba(255,255,255,0.12)', zIndex: theme.zIndex.drawer - 1 }}>
          <Toolbar sx={{ minHeight: 56 }}>
            <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(true)} aria-label="Abrir navegación"><MenuIcon /></IconButton>
            <FactoryOutlinedIcon sx={{ ml: 1.5, mr: 1, fontSize: 24 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 750 }}>EnvaPerú SCM</Typography>
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
            bgcolor: '#17324D',
            color: '#FFFFFF',
          },
        }}
      >
        {drawer}
      </Drawer>
    </>
  );
}

export default Sidebar;
