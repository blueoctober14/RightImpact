import { ReactNode, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';

interface AdminLayoutProps {
  children: ReactNode;
}

// List of public routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/unauthorized'];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { isAuthenticated, isAdmin, loading, error, user, logout } = useAuth();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Set isClient to true after component mounts (client-side only)
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Force token verification on every page load
  useEffect(() => {
    // Verify token on each route change
    const handleRouteChange = () => {
      const token = localStorage.getItem('token');
      if (!token && !PUBLIC_ROUTES.includes(router.pathname)) {
        console.log('No token found during route change, redirecting to login');
        router.push(`/login?redirect=${encodeURIComponent(router.asPath)}`);
      }
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router]);

  // Handle authentication and authorization redirects
  useEffect(() => {
    // Skip server-side rendering
    if (!isClient) return;

    // If we're still loading auth state, do nothing
    if (loading) return;

    const currentPath = router.pathname;
    const isPublicRoute = PUBLIC_ROUTES.includes(currentPath);
    
    // Case 1: Not authenticated and trying to access protected route
    if (!isAuthenticated && !isPublicRoute) {
      console.log('Not authenticated, redirecting to login');
      router.push(`/login?redirect=${encodeURIComponent(router.asPath)}`);
      return;
    }

    // Case 2: Authenticated but not admin role
    if (isAuthenticated && !isAdmin && !isPublicRoute) {
      console.log('Not admin, redirecting to unauthorized');
      router.push('/unauthorized');
      return;
    }

    // Case 3: Already authenticated and on login page
    if (isAuthenticated && currentPath === '/login') {
      console.log('Already authenticated, redirecting to home');
      router.push('/');
      return;
    }
    
    setAuthChecked(true);
  }, [isAuthenticated, isAdmin, loading, router, isClient]);

  // Show loading state while checking auth
  if (loading || !isClient) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" flexDirection="column" minHeight="100vh">
        <CircularProgress />
        <Typography variant="body1" sx={{ mt: 2 }}>
          Verifying authentication...
        </Typography>
      </Box>
    );
  }
  
  // Show error message if there's an authentication error
  if (error && !isAuthenticated) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" flexDirection="column" minHeight="100vh">
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Typography variant="body1">
          Please <a href="/login" style={{ color: 'blue', textDecoration: 'underline' }}>login</a> to continue.
        </Typography>
      </Box>
    );
  }

  // Don't render children until authentication is checked and confirmed
  if (!isAuthenticated) {
    return null;
  }

  // Only render children if user is authenticated and has admin role
  if (!isAdmin) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" flexDirection="column" minHeight="100vh">
        <Alert severity="warning" sx={{ mb: 2 }}>
          Admin access required
        </Alert>
        <Typography variant="body1">
          You don't have permission to access this area.
        </Typography>
      </Box>
    );
  }

  // Render the admin layout with children
  return <>{children}</>;
}
