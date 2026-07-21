import { Paper, Tab, Tabs } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import FactoryOutlinedIcon from '@mui/icons-material/FactoryOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import MoveToInboxOutlinedIcon from '@mui/icons-material/MoveToInboxOutlined';
import PrecisionManufacturingOutlinedIcon from '@mui/icons-material/PrecisionManufacturingOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ScaleOutlinedIcon from '@mui/icons-material/ScaleOutlined';
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';

const icons = {
  receipts: MoveToInboxOutlinedIcon,
  purchases: ReceiptLongOutlinedIcon,
  quality: FactCheckOutlinedIcon,
  inventory: Inventory2OutlinedIcon,
  reservations: AssignmentOutlinedIcon,
  documents: DescriptionOutlinedIcon,
  orders: ListAltOutlinedIcon,
  records: DescriptionOutlinedIcon,
  progress: TrendingUpOutlinedIcon,
  weighing: ScaleOutlinedIcon,
  overview: SpaceDashboardOutlinedIcon,
  products: CategoryOutlinedIcon,
  pieces: CategoryOutlinedIcon,
  molds: PrecisionManufacturingOutlinedIcon,
  materials: Inventory2OutlinedIcon,
  workers: GroupsOutlinedIcon,
  machines: FactoryOutlinedIcon,
};

function ModuleTabs({ workspace, pathname, isActive }) {
  const activeTab = workspace.tabs.find((tab) => isActive(pathname, tab));

  return (
    <Paper variant="outlined" sx={{ mb: 2.25, overflow: 'hidden', borderRadius: 1 }}>
      <Tabs
        value={activeTab?.path || false}
        variant="scrollable"
        scrollButtons="auto"
        aria-label={`Navegación de ${workspace.label}`}
      >
        {workspace.tabs.map((tab) => {
          const Icon = icons[tab.icon] || AssignmentOutlinedIcon;
          return (
            <Tab
              key={tab.path}
              component={RouterLink}
              to={tab.path}
              value={tab.path}
              icon={<Icon fontSize="small" />}
              iconPosition="start"
              label={tab.label}
              sx={{ minHeight: 48 }}
            />
          );
        })}
      </Tabs>
    </Paper>
  );
}

export default ModuleTabs;
