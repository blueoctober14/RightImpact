import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardHeader,
  LinearProgress,
  useTheme,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import DateRangePicker from '../components/DateRangePicker';

export default function Analytics() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    end: new Date(),
  });

  // Mock data - replace with actual API calls
  const [stats, setStats] = useState({
    totalMessages: 0,
    deliveredRate: 0,
    responseRate: 0,
    messagesOverTime: [],
    messageStatus: [],
    topTemplates: [],
  });

  useEffect(() => {
    // Simulate API call
    const fetchAnalytics = async () => {
      setLoading(true);
      
      // Mock data - replace with actual API call
      setTimeout(() => {
        setStats({
          totalMessages: 1250,
          deliveredRate: 92.5,
          responseRate: 18.7,
          messagesOverTime: [
            { date: '2023-06-01', sent: 120, delivered: 110, responses: 25 },
            { date: '2023-06-02', sent: 150, delivered: 140, responses: 30 },
            { date: '2023-06-03', sent: 180, delivered: 165, responses: 35 },
            { date: '2023-06-04', sent: 200, delivered: 190, responses: 40 },
            { date: '2023-06-05', sent: 220, delivered: 210, responses: 45 },
          ],
          messageStatus: [
            { name: 'Delivered', value: 75 },
            { name: 'Failed', value: 5 },
            { name: 'Pending', value: 20 },
          ],
          topTemplates: [
            { name: 'Welcome Message', usage: 45 },
            { name: 'Follow-up', usage: 30 },
            { name: 'Event Invite', usage: 15 },
            { name: 'Survey', usage: 10 },
          ],
        });
        setLoading(false);
      }, 1000);
    };

    fetchAnalytics();
  }, [dateRange]);

  const handleDateRangeChange = (start: Date, end: Date) => {
    setDateRange({ start, end });
  };

  if (loading) {
    return (
      <Box sx={{ width: '100%', p: 3 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        Analytics
      </Typography>

      <Box sx={{ mb: 3 }}>
        <DateRangePicker
          startDate={dateRange.start}
          endDate={dateRange.end}
          onChange={handleDateRangeChange}
        />
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader title="Total Messages" />
            <CardContent>
              <Typography variant="h4">{stats.totalMessages.toLocaleString()}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader title="Delivery Rate" />
            <CardContent>
              <Typography variant="h4">{stats.deliveredRate}%</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader title="Response Rate" />
            <CardContent>
              <Typography variant="h4">{stats.responseRate}%</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader title="Messages Over Time" />
            <CardContent sx={{ height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.messagesOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="sent"
                    name="Sent"
                    stroke={theme.palette.primary.main}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="delivered"
                    name="Delivered"
                    stroke={theme.palette.success.main}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="responses"
                    name="Responses"
                    stroke={theme.palette.secondary.main}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 3 }}>
            <CardHeader title="Message Status" />
            <CardContent sx={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.messageStatus}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill={theme.palette.primary.main} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="Top Templates" />
            <CardContent>
              {stats.topTemplates.map((template) => (
                <Box key={template.name} sx={{ mb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">{template.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {template.usage}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={template.usage}
                    sx={{ height: 8, borderRadius: 1 }}
                  />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
