import * as React from 'react';
import { useState, useCallback } from 'react';
import LoadingBar from './LoadingBar';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Message as MessageIcon,
  ExitToApp as ExitToAppIcon,
  TrendingUp as AnalyticsIcon,
  ListAlt as ListAltIcon,
  Share as ShareIcon,
  HelpOutline as HelpIcon,
} from '@mui/icons-material';

const drawerWidth = 240;

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const theme = useTheme();
  const router = useRouter();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const { logout } = useAuth();
  
  const handleDrawerToggle = useCallback(() => {
    setMobileOpen(prev => !prev);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }, [logout, router]);

  type MenuItem = {
    text: string;
    icon: React.ReactNode;
    path?: string;
    onClick?: () => void;
    isDivider?: boolean;
    indent?: boolean;
  };

  const menuItems: MenuItem[] = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Users', icon: <PeopleIcon />, path: '/users' },
    { text: 'Messages', icon: <MessageIcon />, path: '/messages' },
    { text: 'Analytics', icon: <AnalyticsIcon />, path: '/analytics' },
    { text: 'Voter Targets', icon: <ListAltIcon />, path: '/targets' },
    { text: 'Shared Contacts', icon: <ShareIcon />, path: '/shared-contacts' },
  { text: 'Identification', icon: <HelpIcon />, path: '/identification', indent: true },
  ];

  // Add a divider before the logout button
  const menuItemsWithDivider: MenuItem[] = [
    ...menuItems,
    { isDivider: true, text: 'divider', icon: null },
    { text: 'Logout', icon: <ExitToAppIcon />, onClick: handleLogout }
  ];

  const drawer = (
    <div>
      <Toolbar />
      <Divider />
      <List>
        {menuItemsWithDivider.map((item, index) => (
          <React.Fragment key={item.text || `divider-${index}`}>
            {item.isDivider ? (
              <Divider />
            ) : (
              <ListItem disablePadding>
                <ListItemButton
                    sx={{ pl: item.indent ? 4 : 2 }}
                  selected={item.path ? router.pathname === item.path : false}
                  onClick={() => {
                    if (item.path) {
                      router.push(item.path);
                    } else if (item.onClick) {
                      item.onClick();
                    }
                    if (isMobile) setMobileOpen(false);
                  }}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            )}
          </React.Fragment>
        ))}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <LoadingBar />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            {menuItems.find((item) => item.path === router.pathname)?.text || 'Dashboard'}
          </Typography>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
