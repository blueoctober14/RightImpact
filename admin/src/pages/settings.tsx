import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Grid,
  Paper,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  Alert,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  updateSettings,
  getSettings,
  testEmail,
  testSms,
} from '../api/settings';

const Settings = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [activeTab, setActiveTab] = useState(0);
  const [settings, setSettings] = useState({
    emailProvider: '',
    emailFrom: '',
    emailPassword: '',
    smsProvider: '',
    smsApiKey: '',
    messageLimit: 100,
    dailyLimit: 1000,
    darkMode: false,
    timezone: 'UTC',
  });

  const [testEmailResult, setTestEmailResult] = useState('');
  const [testSmsResult, setTestSmsResult] = useState('');

  const { data: currentSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
    onSuccess: (data) => setSettings(data),
  });

  const updateMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      // Refresh the settings
      setSettings(currentSettings);
    },
  });

  const handleSave = () => {
    updateMutation.mutate(settings);
  };

  const handleTestEmail = async () => {
    try {
      const result = await testEmail(settings.emailProvider, settings.emailFrom, settings.emailPassword);
      setTestEmailResult(result.success ? 'Success' : 'Failed');
    } catch (error) {
      setTestEmailResult('Failed');
    }
  };

  const handleTestSms = async () => {
    try {
      const result = await testSms(settings.smsProvider, settings.smsApiKey);
      setTestSmsResult(result.success ? 'Success' : 'Failed');
    } catch (error) {
      setTestSmsResult('Failed');
    }
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setSettings({
      ...settings,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      <Tabs
        value={activeTab}
        onChange={(e, newValue) => setActiveTab(newValue)}
        sx={{ mb: 3 }}
      >
        <Tab label="General" />
        <Tab label="Email" />
        <Tab label="SMS" />
        <Tab label="Limits" />
      </Tabs>

      <Container maxWidth="md">
        <Grid container spacing={3}>
          {activeTab === 0 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  General Settings
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.darkMode}
                          onChange={handleChange}
                          name="darkMode"
                        />
                      }
                      label="Dark Mode"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Timezone"
                      name="timezone"
                      value={settings.timezone}
                      onChange={handleChange}
                      select
                      SelectProps={{
                        native: true,
                      }}
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/Chicago">America/Chicago</option>
                      <option value="America/New_York">America/New_York</option>
                    </TextField>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          )}

          {activeTab === 1 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Email Settings
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Email Provider"
                      name="emailProvider"
                      value={settings.emailProvider}
                      onChange={handleChange}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Email From"
                      name="emailFrom"
                      value={settings.emailFrom}
                      onChange={handleChange}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Email Password"
                      name="emailPassword"
                      type="password"
                      value={settings.emailPassword}
                      onChange={handleChange}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      variant="contained"
                      onClick={handleTestEmail}
                      startIcon={<span role="img" aria-label="test">📧</span>}
                    >
                      Test Email Settings
                    </Button>
                    {testEmailResult && (
                      <Alert
                        severity={testEmailResult === 'Success' ? 'success' : 'error'}
                        sx={{ mt: 2 }}
                      >
                        {testEmailResult}
                      </Alert>
                    )}
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          )}

          {activeTab === 2 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  SMS Settings
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="SMS Provider"
                      name="smsProvider"
                      value={settings.smsProvider}
                      onChange={handleChange}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="SMS API Key"
                      name="smsApiKey"
                      type="password"
                      value={settings.smsApiKey}
                      onChange={handleChange}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      variant="contained"
                      onClick={handleTestSms}
                      startIcon={<span role="img" aria-label="test">📱</span>}
                    >
                      Test SMS Settings
                    </Button>
                    {testSmsResult && (
                      <Alert
                        severity={testSmsResult === 'Success' ? 'success' : 'error'}
                        sx={{ mt: 2 }}
                      >
                        {testSmsResult}
                      </Alert>
                    )}
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          )}

          {activeTab === 3 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  System Limits
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Message Limit"
                      name="messageLimit"
                      type="number"
                      value={settings.messageLimit}
                      onChange={handleChange}
                      InputProps={{
                        inputProps: { min: 0 },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Daily Limit"
                      name="dailyLimit"
                      type="number"
                      value={settings.dailyLimit}
                      onChange={handleChange}
                      InputProps={{
                        inputProps: { min: 0 },
                      }}
                    />
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          )}

          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <CircularProgress size={24} />
                ) : (
                  'Save Changes'
                )}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default Settings;
