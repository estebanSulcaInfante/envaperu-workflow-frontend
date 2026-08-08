import { useEffect, useState } from 'react';
import {
  AppBar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
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
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import FactoryOutlinedIcon from '@mui/icons-material/FactoryOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import MenuIcon from '@mui/icons-material/Menu';
import MonitorHeartOutlinedIcon from '@mui/icons-material/MonitorHeartOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  getWorkspaceFeature,
  featureMatches,
} from '../config/workspaceRegistry';
import { useActorWorkspace } from '../context/ScmActorContext';

const expandedWidth = 248;
const collapsedWidth = 76;

const icons = {
  dashboard: DashboardOutlinedIcon,
  planning: EventNoteOutlinedIcon,
  production: FactoryOutlinedIcon,
  materials: Inventory2OutlinedIcon,
  warehouse: WarehouseOutlinedIcon,
  control: MonitorHeartOutlinedIcon,
  catalog: CategoryOutlinedIcon,
  settings: SettingsOutlinedIcon,
  guide: HelpOutlineOutlinedIcon,
};

function navButtonSx(active, nested = false, collapsed = false) {
  return {
    minHeight: nested ? 36 : 44,
    justifyContent: collapsed ? 'center' : 'initial',
    pl: nested ? 6.5 : 1.5,
    pr: 1.25,
    borderRadius: 1,
    color: nested ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.9)',
    '&.Mui-selected': {
      bgcolor: nested ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.16)',
      color: '#FFFFFF',
      '&::before': nested ? undefined : {
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
  };
}

function NavigationList({
  title,
  areas,
  value,
  activeFeature,
  collapsed,
  expandedAreas,
  onNavigate,
  onToggleArea,
  onExpandFromRail,
}) {
  return (
    <List
      dense
      subheader={!collapsed ? (
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
      ) : null}
      sx={{ px: 1 }}
    >
      {areas.map((area) => {
        const Icon = icons[area.icon] || CategoryOutlinedIcon;
        const active = area.key === activeFeature?.areaKey;
        const hasSections = area.childMode !== 'hub' && area.features.length > 1;
        const showChildren = hasSections && !collapsed && expandedAreas.has(area.key);
        const parentProps = hasSections ? {
          component: 'button',
          type: 'button',
          'aria-expanded': showChildren,
          onClick: () => (collapsed ? onExpandFromRail(area.key) : onToggleArea(area.key)),
        } : {
          component: RouterLink,
          to: area.path,
          'aria-current': active ? 'page' : undefined,
          onClick: onNavigate,
        };

        return (
          <Box component="li" key={area.key} sx={{ listStyle: 'none', mb: 0.5 }}>
            <Tooltip title={collapsed ? area.label : ''} placement="right">
              <ListItemButton
                {...parentProps}
                selected={active}
                sx={navButtonSx(active, false, collapsed)}
              >
                <ListItemIcon sx={{ minWidth: collapsed ? 0 : 40, color: 'inherit' }}>
                  <Icon fontSize="small" />
                </ListItemIcon>
                {!collapsed && (
                  <>
                    <ListItemText
                      primary={area.label}
                      primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 750 : 550 }}
                    />
                    {hasSections && (showChildren
                      ? <ExpandLessRoundedIcon fontSize="small" />
                      : <ExpandMoreRoundedIcon fontSize="small" />)}
                  </>
                )}
              </ListItemButton>
            </Tooltip>
            {showChildren && (
              <List component="ul" disablePadding aria-label={`Secciones de ${area.label}`}>
                {area.features.map((item) => {
                  const childActive = item.key === activeFeature?.key || featureMatches(value, item);
                  return (
                    <Box component="li" key={item.key} sx={{ listStyle: 'none' }}>
                      <ListItemButton
                        component={RouterLink}
                        to={item.path}
                        selected={childActive}
                        aria-current={childActive ? 'page' : undefined}
                        onClick={onNavigate}
                        sx={navButtonSx(childActive, true)}
                      >
                        <ListItemText
                          primary={item.label}
                          primaryTypographyProps={{ fontSize: 12.5, fontWeight: childActive ? 750 : 500 }}
                        />
                      </ListItemButton>
                    </Box>
                  );
                })}
              </List>
            )}
          </Box>
        );
      })}
    </List>
  );
}

function Sidebar() {
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isIntermediate = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(isIntermediate);
  const workspace = useActorWorkspace();
  const value = `${location.pathname}${location.search}`;
  const registeredFeature = getWorkspaceFeature(value);
  const activeFeature = workspace.features.find((item) => item.key === registeredFeature?.key) || null;
  const [expandedAreas, setExpandedAreas] = useState(
    () => new Set(activeFeature?.areaKey ? [activeFeature.areaKey] : []),
  );
  useEffect(() => {
    setCollapsed(isIntermediate);
  }, [isIntermediate]);
  useEffect(() => {
    if (!activeFeature?.areaKey) return;
    setExpandedAreas((current) => new Set([...current, activeFeature.areaKey]));
  }, [activeFeature?.areaKey]);
  const areas = workspace.areas;
  const primaryAreas = areas.filter((area) => !area.support);
  const supportAreas = areas.filter((area) => area.support);
  const compact = !isMobile && collapsed;
  const width = compact ? collapsedWidth : expandedWidth;
  const closeOnMobile = () => { if (isMobile) setMobileOpen(false); };
  const toggleArea = (areaKey) => setExpandedAreas((current) => {
    const next = new Set(current);
    if (next.has(areaKey)) next.delete(areaKey);
    else next.add(areaKey);
    return next;
  });
  const expandFromRail = (areaKey) => {
    setCollapsed(false);
    setExpandedAreas((current) => new Set([...current, areaKey]));
  };

  const drawer = (
    <Box sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ minHeight: 64, px: compact ? 1 : 2, justifyContent: compact ? 'center' : 'initial' }}>
        {!compact && <FactoryOutlinedIcon sx={{ mr: 1.25, fontSize: 28 }} />}
        {!compact && (
          <Box sx={{ minWidth: 0 }}>
            <Typography component="div" variant="subtitle1" noWrap sx={{ fontWeight: 850, lineHeight: 1.2 }}>EnvaPerú SCM</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.62)' }}>Workspace operativo</Typography>
          </Box>
        )}
        {!isMobile ? (
          <IconButton
            onClick={() => setCollapsed((current) => !current)}
            aria-label={compact ? 'Expandir navegación' : 'Contraer navegación'}
            sx={{ color: 'inherit', ml: compact ? 0 : 'auto' }}
          >
            {compact ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        ) : (
          <IconButton
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar navegación"
            sx={{ color: 'inherit', ml: 'auto' }}
          >
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Toolbar>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
      <NavigationList
        title="Operación"
        areas={primaryAreas}
        value={value}
        activeFeature={activeFeature}
        collapsed={compact}
        expandedAreas={expandedAreas}
        onNavigate={closeOnMobile}
        onToggleArea={toggleArea}
        onExpandFromRail={expandFromRail}
      />
      <Divider sx={{ mx: compact ? 1 : 2, my: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
      <NavigationList
        title="Gestión y ayuda"
        areas={supportAreas}
        value={value}
        activeFeature={activeFeature}
        collapsed={compact}
        expandedAreas={expandedAreas}
        onNavigate={closeOnMobile}
        onToggleArea={toggleArea}
        onExpandFromRail={expandFromRail}
      />
      <Box sx={{ flexGrow: 1 }} />
      {!compact && (
        <Box sx={{ px: 2, py: 2 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.62)' }}>Piloto SCM</Typography>
        </Box>
      )}
    </Box>
  );

  return (
    <>
      {isMobile && (
        <AppBar position="fixed" elevation={0} sx={{ bgcolor: '#17324D', borderBottom: '1px solid rgba(255,255,255,0.12)', zIndex: theme.zIndex.drawer - 1 }}>
          <Toolbar sx={{ minHeight: 56 }}>
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir navegación"
              aria-expanded={mobileOpen}
              aria-controls="workspace-navigation"
            >
              <MenuIcon />
            </IconButton>
            <FactoryOutlinedIcon sx={{ ml: 1.5, mr: 1, fontSize: 24 }} />
            <Typography component="div" variant="subtitle1" sx={{ fontWeight: 750 }}>EnvaPerú SCM</Typography>
          </Toolbar>
        </AppBar>
      )}
      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? mobileOpen : true}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        slotProps={{ paper: { id: 'workspace-navigation' } }}
        sx={{
          width: isMobile ? 0 : width,
          flexShrink: 0,
          transition: theme.transitions.create('width'),
          '& .MuiDrawer-paper': {
            width: isMobile ? expandedWidth : width,
            boxSizing: 'border-box',
            bgcolor: '#17324D',
            color: '#FFFFFF',
            overflowX: 'hidden',
            transition: theme.transitions.create('width'),
          },
        }}
      >
        {drawer}
      </Drawer>
    </>
  );
}

export default Sidebar;
