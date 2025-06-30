import dynamic from 'next/dynamic';
import { Box, CircularProgress } from '@mui/material';
import ProtectedRoute from '../components/ProtectedRoute';

// Disable server-side rendering for this page since it uses browser APIs
const UsersTabs = dynamic(() => import('./users/UsersTabs'), {
  ssr: false,
  loading: () => (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
      <CircularProgress />
    </Box>
  ),
});

const UsersPage: React.FC = () => {
  return (
    <ProtectedRoute requiredRole="admin">
      <UsersTabs />
    </ProtectedRoute>
  );
};

// Disable static generation for this page
// This ensures the page is rendered on the client side
export const getServerSideProps = async () => {
  return {
    props: {}, // Will be passed to the page component as props
  };
};

export default UsersPage;
