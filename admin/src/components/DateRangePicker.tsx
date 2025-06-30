import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  useTheme,
} from '@mui/material';
import {
  CalendarMonth as CalendarMonthIcon,
  Today as TodayIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from '@/utils/dateUtils';

interface DateRangePickerProps {
  onDateRangeChange: (start: string, end: string) => void;
  value?: {
    start: string;
    end: string;
  };
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  onDateRangeChange,
  value,
}) => {
  const theme = useTheme();
  const [dateRange, setDateRange] = useState({
    start: value?.start ? dayjs(value.start) : dayjs(),
    end: value?.end ? dayjs(value.end) : dayjs(),
  });
  const [preset, setPreset] = useState('custom');

  const presets = {
    'Last 7 Days': () => ({
      start: dayjs().subtract(7, 'day'),
      end: dayjs(),
    }),
    'Last 30 Days': () => ({
      start: dayjs().subtract(30, 'day'),
      end: dayjs(),
    }),
    'This Month': () => ({
      start: dayjs().startOf('month'),
      end: dayjs().endOf('month'),
    }),
    'Last Month': () => ({
      start: dayjs().subtract(1, 'month').startOf('month'),
      end: dayjs().subtract(1, 'month').endOf('month'),
    }),
  };

  const handlePresetChange = (event: any) => {
    const presetName = event.target.value;
    if (presetName !== 'custom') {
      const range = presets[presetName]();
      setDateRange(range);
      setPreset(presetName);
      onDateRangeChange(range.start.format(), range.end.format());
    } else {
      setPreset('custom');
    }
  };

  const handleDateChange = (field: 'start' | 'end', date: any) => {
    setDateRange((prev) => ({
      ...prev,
      [field]: date,
    }));
    onDateRangeChange(
      dateRange.start.format(),
      dateRange.end.format()
    );
  };

  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      <FormControl size="small">
        <InputLabel>Range</InputLabel>
        <Select
          value={preset}
          label="Range"
          onChange={handlePresetChange}
        >
          <MenuItem value="custom">Custom Range</MenuItem>
          <MenuItem value="Last 7 Days">Last 7 Days</MenuItem>
          <MenuItem value="Last 30 Days">Last 30 Days</MenuItem>
          <MenuItem value="This Month">This Month</MenuItem>
          <MenuItem value="Last Month">Last Month</MenuItem>
        </Select>
      </FormControl>

      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <DatePicker
          label="Start Date"
          value={dateRange.start}
          onChange={(date) => handleDateChange('start', date)}
          slotProps={{
            textField: {
              fullWidth: true,
              size: 'small',
              sx: { mr: 1 }
            }
          }}
        />
        <DatePicker
          label="End Date"
          value={dateRange.end}
          onChange={(date) => handleDateChange('end', date)}
          slotProps={{
            textField: {
              fullWidth: true,
              size: 'small',
              sx: { ml: 1 }
            }
          }}
        />
      </LocalizationProvider>

      <Button
        variant="contained"
        startIcon={<CalendarMonthIcon />}
        onClick={() => {
          const range = presets['Last 7 Days']();
          setDateRange(range);
          setPreset('custom');
          onDateRangeChange(range.start.format(), range.end.format());
        }}
      >
        Last 7 Days
      </Button>
      <Button
        variant="outlined"
        startIcon={<TodayIcon />}
        onClick={() => {
          const range = presets['This Month']();
          setDateRange(range);
          setPreset('custom');
          onDateRangeChange(range.start.format(), range.end.format());
        }}
      >
        This Month
      </Button>
    </Box>
  );
};

export default DateRangePicker;
