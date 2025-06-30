import React from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  CardMedia,
  CardHeader,
  Divider,
  CircularProgress,
} from '@mui/material';
import { useQuery } from 'react-query';
// Helper function to format numbers with commas
const formatNumber = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const Home = () => {
  const router = useRouter();
  
  // Mock stats data since we don't have the actual API yet
  const mockStats = {
    total_users: 125,
    active_users: 87,
    total_contacts: 5000,
    messages_sent: 2500,
    response_rate: 25
  };
  
  const { data: stats, isLoading } = useQuery(['stats'], () => Promise.resolve(mockStats));

  const statsCards = [
    {
      title: 'Total Users',
      value: stats?.total_users || 0,
      icon: 'people',
      color: '#4CAF50',
      route: '/users',
    },
    {
      title: 'Active Users',
      value: stats?.active_users || 0,
      icon: 'person',
      color: '#2196F3',
      route: '/users',
    },
    {
      title: 'Total Contacts',
      value: stats?.total_contacts || 0,
      icon: 'contacts',
      color: '#FF9800',
      route: '/contacts',
    },
    {
      title: 'Messages Sent',
      value: stats?.messages_sent || 0,
      icon: 'message',
      color: '#9C27B0',
      route: '/messages',
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statsCards.map((card) => (
          <Grid item xs={12} sm={6} md={3} key={card.title}>
            <Card
              onClick={() => router.push(card.route)}
              sx={{
                cursor: 'pointer',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {card.title}
                </Typography>
                <Typography variant="h3" component="div" sx={{ mb: 1 }}>
                  {formatNumber(card.value)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Updated just now
                </Typography>
              </CardContent>
              <Box sx={{ p: 2, bgcolor: card.color + '10' }}>
                <Typography variant="body2" color={card.color}>
                  {card.icon}
                </Typography>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Recent Activity
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ height: 300 }}>
              {/* Recent activity chart will be added here */}
              {isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Activity chart will be displayed here
                </Typography>
              )}
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => router.push('/messages/new')}
                  startIcon={<span role="img" aria-label="message">📝</span>}
                >
                  Create Message Template
                </Button>
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => router.push('/contacts/import')}
                  startIcon={<span role="img" aria-label="upload">📊</span>}
                >
                  Import Contacts
                </Button>
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => router.push('/users/new')}
                  startIcon={<span role="img" aria-label="add">👤</span>}
                >
                  Add New User
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Home;
