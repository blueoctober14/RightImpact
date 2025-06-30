import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Avatar,
  useTheme,
} from '@mui/material';
import {
  People as PeopleIcon,
  Message as MessageIcon,
} from '@mui/icons-material';

const Dashboard = () => {
  const theme = useTheme();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalContacts: 0,
    activeUsers: 0,
    messagesSent: 0,
    responseRate: 0,
  });

  // Fetch stats from API
  useEffect(() => {
    const fetchStats = async () => {
      // Simulated stats
      setStats({
        totalUsers: 125,
        totalContacts: 5000,
        activeUsers: 87,
        messagesSent: 2500,
        responseRate: 25,
      });
    };
    
    fetchStats();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 4 }}>
        Dashboard
      </Typography>
      <Box sx={{ mt: 2 }}>
        <Grid container spacing={3}>
          {/* Stats Cards */}
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardHeader title="Total Users" />
              <CardContent>
                <Typography variant="h4" component="div">
                  {stats.totalUsers}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardHeader title="Total Contacts" />
              <CardContent>
                <Typography variant="h4" component="div">
                  {stats.totalContacts}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardHeader title="Active Users" />
              <CardContent>
                <Typography variant="h4" component="div">
                  {stats.activeUsers}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardHeader title="Messages Sent" />
              <CardContent>
                <Typography variant="h4" component="div">
                  {stats.messagesSent}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Recent Activity */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Recent Activity
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                  <PeopleIcon />
                </Avatar>
                <Typography>
                  8 new users joined today
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Avatar sx={{ bgcolor: theme.palette.secondary.main }}>
                  <MessageIcon />
                </Avatar>
                <Typography>
                  500 messages sent in the last hour
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default Dashboard;
