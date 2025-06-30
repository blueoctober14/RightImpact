import { Box, Button, Container, Typography } from '@mui/material';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';

const UnauthorizedPage = () => {
  const router = useRouter();
  const { logout } = useAuth();

  const handleGoBack = () => {
    router.back();
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <Container component="main" maxWidth="md">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <Typography variant="h3" component="h1" gutterBottom>
          Access Denied
        </Typography>
        <Typography variant="h6" color="textSecondary" paragraph>
          You don't have permission to access this page.
        </Typography>
        <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleGoBack}
          >
            Go Back
          </Button>
          <Button
            variant="outlined"
            color="primary"
            onClick={handleLogout}
          >
            Logout
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default UnauthorizedPage;
