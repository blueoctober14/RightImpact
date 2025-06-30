import {
  Box,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Legend,
  Title,
  Tooltip,
  Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import React from 'react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Legend,
  Title,
  Tooltip,
  Filler,
);

interface ChartProps {
  type: 'bar' | 'line';
  title: string;
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      borderColor?: string;
      backgroundColor?: string;
      fill?: boolean;
    }>;
  };
  options?: any;
  height?: number;
}

const Chart: React.FC<ChartProps> = ({
  type,
  title,
  data,
  options,
  height = 300,
}) => {
  const theme = useTheme();

  const defaultOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: title,
        color: theme.palette.text.primary,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: theme.palette.text.secondary,
        },
      },
      x: {
        ticks: {
          color: theme.palette.text.secondary,
        },
      },
    },
  };

  return (
    <Box>
      {type === 'bar' ? (
        <Bar data={data} options={{ ...defaultOptions, ...options }} height={height} />
      ) : (
        <Line data={data} options={{ ...defaultOptions, ...options }} height={height} />
      )}
    </Box>
  );
};

export default Chart;
