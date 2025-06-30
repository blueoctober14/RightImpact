import {
  Box,
  Typography,
  Grid,
  Paper,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import Chart from './Chart';
import DateRangePicker from './DateRangePicker';
import React, { useState } from 'react';
import dayjs from '@/utils/dateUtils';

interface MessageStatsProps {
  stats: {
    deliveryRate: number;
    responseRate: number;
    dailyMessages: Array<{
      date: string;
      sent: number;
      delivered: number;
      responses: number;
    }>;
    templatePerformance: Array<{
      template: string;
      sent: number;
      delivered: number;
      responses: number;
    }>;
  };
  onDateRangeChange?: (start: string, end: string) => void;
}

const MessageStats: React.FC<MessageStatsProps> = ({ stats, onDateRangeChange }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Generate random data for demonstration
  const generateRandomData = () => {
    const dates = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toLocaleDateString();
    });

    return {
      labels: dates,
      datasets: [
        {
          label: 'Sent Messages',
          data: dates.map(() => Math.floor(Math.random() * 100)),
          borderColor: theme.palette.primary.main,
          backgroundColor: theme.palette.primary.light,
          tension: 0.4,
        },
        {
          label: 'Delivered',
          data: dates.map(() => Math.floor(Math.random() * 100)),
          borderColor: theme.palette.success.main,
          backgroundColor: theme.palette.success.light,
          tension: 0.4,
        },
        {
          label: 'Responses',
          data: dates.map(() => Math.floor(Math.random() * 50)),
          borderColor: theme.palette.secondary.main,
          backgroundColor: theme.palette.secondary.light,
          tension: 0.4,
        },
      ],
    };
  };

  const generateTemplateData = () => {
    return {
      labels: Array.from({ length: 5 }, (_, i) => `Template ${i + 1}`),
      datasets: [
        {
          label: 'Sent',
          data: Array.from({ length: 5 }, () => Math.floor(Math.random() * 100)),
          backgroundColor: theme.palette.primary.main,
        },
        {
          label: 'Delivered',
          data: Array.from({ length: 5 }, () => Math.floor(Math.random() * 100)),
          backgroundColor: theme.palette.success.main,
        },
        {
          label: 'Responses',
          data: Array.from({ length: 5 }, () => Math.floor(Math.random() * 50)),
          backgroundColor: theme.palette.secondary.main,
        },
      ],
    };
  };

  const [dateRange, setDateRange] = useState({
    start: dayjs().subtract(7, 'day').format(),
    end: dayjs().format(),
  });

  const handleDateRangeChange = (start: string, end: string) => {
    setDateRange({ start, end });
    if (onDateRangeChange) {
      onDateRangeChange(start, end);
    }
  };

  return (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2, mb: 3 }}>
            <DateRangePicker
              value={dateRange}
              onDateRangeChange={handleDateRangeChange}
            />
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Daily Message Performance
            </Typography>
            <Chart
              type="line"
              title="Daily Message Performance"
              data={generateRandomData()}
              options={{
                plugins: {
                  legend: {
                    position: 'bottom' as const,
                  },
                },
              }}
            />
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Template Performance
            </Typography>
            <Chart
              type="bar"
              title="Template Performance"
              data={generateTemplateData()}
              options={{
                plugins: {
                  legend: {
                    position: 'bottom' as const,
                  },
                },
              }}
            />
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Key Metrics
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={4}>
                <Box
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    backgroundColor: theme.palette.background.paper,
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="h4" color="primary">
                    {stats.deliveryRate.toFixed(1)}%
                  </Typography>
                  <Typography color="textSecondary">
                    Delivery Rate
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    backgroundColor: theme.palette.background.paper,
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="h4" color="success">
                    {stats.responseRate.toFixed(1)}%
                  </Typography>
                  <Typography color="textSecondary">
                    Response Rate
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    backgroundColor: theme.palette.background.paper,
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="h4" color="secondary">
                    {stats.dailyMessages.reduce((sum, day) => sum + day.sent, 0)}
                  </Typography>
                  <Typography color="textSecondary">
                    Total Messages Sent
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default MessageStats;
