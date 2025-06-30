import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import CircularProgress from '@mui/material/CircularProgress';
import ContentLoader from '../components/ContentLoader';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import ListItemText from '@mui/material/ListItemText';
import Checkbox from '@mui/material/Checkbox';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import {
  Add as AddIcon,
  Message as MessageIcon,
  History as HistoryIcon,
  Send as SendIcon,
  TrendingUp as TrendingIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Image as ImageIcon,
  VideoLibrary as VideoIcon,
  Mic as AudioIcon,
  Link as LinkIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  Refresh as RefreshIcon,
  ToggleOn as ToggleOnIcon,
  ToggleOff as ToggleOffIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// Helper function to format dates from UTC to CT
const formatToCT = (dateString: string) => {
  return dayjs.utc(dateString).tz('America/Chicago').format('MM/DD/YYYY h:mm A') + ' (CT)';
};
import MessageTemplateForm from '../components/MessageTemplateForm';
import MessageStats from '../components/MessageStats';
import ExportButton from '../components/ExportButton';
import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { MessageTemplate, MessageType } from '../types/message';
import { 
  getMessageTemplates, 
  createMessageTemplate, 
  updateMessageTemplate, 
  deleteMessageTemplate 
} from '../services/messageService';

// Using shared types from ../types/message

import { getSentMessages, SentMessageEnriched } from '../services/sentMessagesService';

interface SentMessage {
  id: number;
  template_name: string;
  contact_name: string;
  contact_phone: string;
  username: string;
  sent_at: string;
}

interface MessageStats {
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
}

const MessagesPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [activeTab, setActiveTab] = useState(0);
  // Extend the MessageTemplate type to include listIds, userIds, and groupIds for form handling
  type ExtendedMessageTemplate = Omit<MessageTemplate, 'status'> & { 
    listIds?: number[]; 
    userIds?: number[];
    groupIds?: number[];
    status?: 'ACTIVE' | 'INACTIVE' | 'DRAFT' | 'ARCHIVED';
    lists: Array<{ id: number; name: string }>;
    groups: Array<{ id: number; name: string }>;
    users: Array<{ id: number; name?: string; first_name?: string; last_name?: string }>;
  };

  const [templates, setTemplates] = useState<ExtendedMessageTemplate[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: 'created_at'; direction: 'asc' | 'desc' }>({
    key: 'created_at',
    direction: 'desc' // Newest first by default
  });
  
  // Sort templates based on sortConfig
  const sortedTemplates = useMemo(() => {
    const sortableTemplates = [...templates];
    sortableTemplates.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
    return sortableTemplates;
  }, [templates, sortConfig]);

  const requestSort = (key: 'created_at') => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };
  
  const [sentMessages, setSentMessages] = useState<SentMessageEnriched[]>([]);
  const [selectedContact, setSelectedContact] = useState<string>('all');
  const [selectedSender, setSelectedSender] = useState<string>('all');
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);
  const filterMenuOpen = Boolean(filterAnchorEl);
  const [templateFormOpen, setTemplateFormOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ExtendedMessageTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MessageStats>({
    deliveryRate: 0,
    responseRate: 0,
    dailyMessages: [],
    templatePerformance: []
  });
  const [dateRange, setDateRange] = useState({
    start: dayjs().subtract(7, 'day').format(),
    end: dayjs().format(),
  });

  // Fetch message templates from API with caching
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchTemplates = async () => {
    try {
      // Use a unique ID for each timer call to avoid conflicts
      const timerId = `fetchTemplates-${Date.now()}`;
      console.time(timerId);
      
      // Force clear any message template caches before fetching
      Object.keys(localStorage).forEach(key => {
        if (key.includes('api_cache_message') || key.includes('message_templates')) {
          console.log(`[Cache] Removing key: ${key}`);
          localStorage.removeItem(key);
        }
      });
      
      // Fetch data from service with fresh data
      const data = await getMessageTemplates();
      console.timeEnd(timerId);
      
      // If we got data, update the state
      if (data && Array.isArray(data)) {
        setTemplates(data);
        setFetchError(null); // Clear any previous errors
      } else {
        console.warn('No templates data returned or invalid format');
        setFetchError('No message templates found');
        setTemplates([]); // Reset to empty array
      }
    } catch (error: any) {
      console.error('Failed to fetch templates:', error);
      setFetchError(
        error?.response?.data?.detail || 
        error?.message || 
        'Failed to load message templates'
      );
      setTemplates([]); // Reset to empty array
    } finally {
      setLoading(false);
    }
  };

  // No lazy loading needed
  
  const getMessageTypeLabel = (type: MessageType) => {
    switch (type) {
      case 'friend_to_friend':
        return 'Friend to Friend';
      case 'neighbor_to_neighbor':
        return 'Neighbor to Neighbor';
      case 'social_media':
        return 'Social Media';
      default:
        return type;
    }
  };
  
  const renderMediaIcon = (url?: string) => {
    if (!url) return null;
    
    const extension = url.split('.').pop()?.toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '');
    const isVideo = ['mp4', 'webm', 'mov', 'avi'].includes(extension || '');
    const isAudio = ['mp3', 'wav', 'ogg'].includes(extension || '');
    
    return (
      <Tooltip title="Media attached">
        <Badge
          overlap="circular"
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          badgeContent={
            isImage ? (
              <ImageIcon color="primary" fontSize="small" />
            ) : isVideo ? (
              <VideoIcon color="primary" fontSize="small" />
            ) : isAudio ? (
              <AudioIcon color="primary" fontSize="small" />
            ) : (
              <LinkIcon color="primary" fontSize="small" />
            )
          }
        >
          <MessageIcon />
        </Badge>
      </Tooltip>
    );
  };

  // Fetch stats from API with date range
  const fetchStats = async () => {
    try {
      // Simulated stats with date range filtering
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      
      // Calculate days between dates
      const days = Math.floor(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;

      setStats({
        deliveryRate: 95,
        responseRate: 25,
        dailyMessages: Array.from({ length: days }, (_, i) => ({
          date: new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000).toLocaleDateString(),
          sent: Math.floor(Math.random() * 100),
          delivered: Math.floor(Math.random() * 90),
          responses: Math.floor(Math.random() * 30),
        })),
        templatePerformance: Array.from({ length: 5 }, (_, i) => ({
          template: `Template ${i + 1}`,
          sent: Math.floor(Math.random() * 100),
          delivered: Math.floor(Math.random() * 90),
          responses: Math.floor(Math.random() * 30),
        })),
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  // Filter menu handlers
  const handleFilterMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setFilterAnchorEl(event.currentTarget);
  };
  
  const handleFilterMenuClose = () => {
    setFilterAnchorEl(null);
  };
  
  const clearFilters = () => {
    setSelectedContact('all');
    setSelectedSender('all');
  };
  
  const isFilterActive = selectedContact !== 'all' || selectedSender !== 'all';
  
  // Get unique contacts and senders for filters
  const uniqueContacts = useMemo(() => {
    const contacts = new Map<string, string>();
    sentMessages.forEach(msg => {
      if (msg.shared_contact_id) {
        const contactName = [msg.contact_first_name, msg.contact_last_name].filter(Boolean).join(' ') || 'Unknown Contact';
        contacts.set(msg.shared_contact_id, contactName);
      }
    });
    return Array.from(contacts.entries()).map(([id, name]) => ({
      id,
      name
    }));
  }, [sentMessages]);
  
  const uniqueSenders = useMemo(() => {
    const senders = new Map<string, string>();
    sentMessages.forEach(msg => {
      if (msg.user_id) {
        senders.set(
          msg.user_id.toString(),
          msg.username || `User ${msg.user_id}`
        );
      }
    });
    return Array.from(senders.entries()).map(([id, name]) => ({
      id,
      name
    }));
  }, [sentMessages]);

  // Fetch sent messages from API with debounce and caching
  const fetchSentMessages = async () => {
    try {
      setLoading(true);
      const params: { contact_id?: string; user_id?: number } = {};
      
      if (selectedContact !== 'all') {
        params.contact_id = selectedContact;
      }
      
      if (selectedSender !== 'all') {
        params.user_id = parseInt(selectedSender, 10);
      }
      
      // Create a cache key based on the filter parameters
      const cacheKey = `sent_messages_${JSON.stringify(params)}`;
      
      // Check if we have cached data (only valid for 30 seconds)
      const cachedData = sessionStorage.getItem(cacheKey);
      if (cachedData) {
        try {
          const { data, timestamp } = JSON.parse(cachedData);
          const cacheAge = Date.now() - timestamp;
          
          // Use cache if it's less than 30 seconds old
          if (cacheAge < 30000) {
            console.log('Using cached sent messages data');
            setSentMessages(data);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Failed to parse cached data:', e);
          // Continue with API call if cache parsing fails
        }
      }
      
      console.time('fetchSentMessages');
      const data = await getSentMessages(params);
      console.timeEnd('fetchSentMessages');
      
      // Store in cache with timestamp
      sessionStorage.setItem(cacheKey, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
      
      setSentMessages(data);
    } catch (error) {
      console.error('Failed to fetch sent messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditTemplate = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    setTemplateFormOpen(true);
  };

  const handleDeleteTemplate = async (templateId: number) => {
    try {
      setLoading(true);
      await deleteMessageTemplate(templateId);
      setTemplates(prev => prev.filter(t => t.id !== templateId));
    } catch (error) {
      console.error('Error deleting template:', error);
    } finally {
      setLoading(false);
    }
  };

  // Toggle message status between ACTIVE and INACTIVE
  const toggleMessageStatus = async (template: ExtendedMessageTemplate) => {
    try {
      console.log('[MessagesPage] Toggling status for template:', template.id, 'Current status:', template.status);
      setLoading(true);
      
      // Normalize current status to uppercase and default to 'INACTIVE' if undefined
      const currentStatus = template.status?.toUpperCase() || 'INACTIVE';
      // Toggle between 'ACTIVE' and 'INACTIVE' statuses (case-insensitive comparison)
      const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      
      console.log('[MessagesPage] New status will be:', newStatus);
      
      // Optimistically update the UI
      setTemplates(prevTemplates => 
        prevTemplates.map(t => 
          t.id === template.id 
            ? { ...t, status: newStatus, updated_at: new Date().toISOString() } 
            : t
        )
      );
      
      // Create a minimal update payload with only the status field changed
      const updatePayload: any = {
        status: newStatus,
        // Include required fields
        name: template.name,
        content: template.content,
        message_type: template.message_type,
        media_url: template.media_url || '',
        // Initialize empty arrays for relationships to avoid undefined
        list_ids: [],
        user_ids: [],
        group_ids: []
      };
      
      // Add relationships if they exist
      if (template.lists?.length) updatePayload.list_ids = template.lists.map(l => l.id);
      if (template.users?.length) updatePayload.user_ids = template.users.map(u => u.id);
      if (template.groups?.length) updatePayload.group_ids = template.groups.map(g => g.id);
      
      console.log('[MessagesPage] Sending update with payload:', JSON.stringify(updatePayload, null, 2));
      
      // Update the template using the message service which handles authentication
      const updatedTemplate = await updateMessageTemplate(template.id, updatePayload);
      
      console.log('[MessagesPage] Update response:', updatedTemplate);
      
      if (!updatedTemplate) {
        throw new Error('No response from server');
      }
      
      // Update the templates list with the fully updated template
      setTemplates(prev => 
        prev.map(t => t.id === updatedTemplate.id ? { ...t, ...updatedTemplate } : t)
      );
      
      toast.success(`Message ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`);
      return true;
    } catch (error) {
      console.error('[MessagesPage] Error toggling message status:', error);
      toast.error('Failed to update message status');
      
      // Revert optimistic update on error
      setTemplates(prevTemplates => 
        prevTemplates.map(t => 
          t.id === template.id 
            ? { ...t, status: template.status } // Revert to original status
            : t
        )
      );
      
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async (template: ExtendedMessageTemplate) => {
    try {
      setLoading(true);
      
      // Prepare the data to send to the API
      const { id, lists, users, groups, listIds, userIds, groupIds, ...rest } = template;
      const templateData = {
        ...rest,
        listIds: listIds || [],
        userIds: userIds || [],
        groupIds: groupIds || []
      };
      
      if (id) {
        // Update existing template
        const updatedTemplate = await updateMessageTemplate(id, templateData);
        setTemplates(prev => 
          prev.map(t => t.id === updatedTemplate.id ? { ...t, ...updatedTemplate } : t)
        );
      } else {
        // Create new template - set status to active by default
        const newTemplate = await createMessageTemplate({ ...templateData, status: 'active' });
        setTemplates(prev => [...prev, newTemplate]);
      }
      return true;
    } catch (error) {
      console.error('Error saving template:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Lazy load data based on active tab
  useEffect(() => {
    // Initial load of templates for all tabs
    fetchTemplates();
    
    // Load data based on active tab
    if (activeTab === 0) {
      // Templates tab - nothing additional to load
    } else if (activeTab === 1) {
      // History tab - load sent messages with current filters
      fetchSentMessages();
    } else if (activeTab === 2) {
      // Stats tab - load statistics
      fetchStats();
    }
  }, [activeTab]);
  
  // Refetch messages when filters change (only if on history tab)
  useEffect(() => {
    if (activeTab === 1) {
      fetchSentMessages();
    }
  }, [selectedContact, selectedSender]);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{ mb: 3 }}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab
            icon={<MessageIcon />}
            iconPosition="start"
            label="Messages"
          />
          <Tab 
            icon={<HistoryIcon />} 
            iconPosition="start" 
            label="History" 
          />
          <Tab 
            icon={<TrendingIcon />} 
            iconPosition="start" 
            label="Analytics" 
          />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h5">Messages</Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              {fetchError && (
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<RefreshIcon />}
                  onClick={fetchTemplates}
                >
                  Retry
                </Button>
              )}
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  setSelectedTemplate(null);
                  setTemplateFormOpen(true);
                }}
              >
                New Message
              </Button>
              <ExportButton
                data={templates}
                columns={[
                  { id: 'name', label: 'Name' },
                  { id: 'message_type', label: 'Type', format: (value: MessageType) => getMessageTypeLabel(value) },
                  { id: 'content', label: 'Content' },
                  { id: 'media_url', label: 'Media URL' },
                  { 
                    id: 'lists', 
                    label: 'Target Lists', 
                    format: (lists: Array<{name: string}>) => lists.map(l => l.name).join('; ') 
                  },
                  { 
                    id: 'users', 
                    label: 'Assigned Users', 
                    format: (users: Array<{name?: string, first_name?: string, last_name?: string}>) => 
                      users.map(u => u.name || [u.first_name, u.last_name].filter(Boolean).join(' ')).join('; ')
                  },
                  { 
                    id: 'groups', 
                    label: 'Assigned Groups', 
                    format: (groups: Array<{name: string}>) => groups.map(g => g.name).join('; ') 
                  },
                  { 
                    id: 'created_at', 
                    label: 'Created At',
                    format: (date: string) => new Date(date).toLocaleString()
                  },
                ]}
                title="Message Templates"
                defaultFileName="message_templates"
              />
            </Box>
          </Box>
          
          <ContentLoader
            loading={loading}
            error={fetchError}
            onRetry={fetchTemplates}
            loadingText="Loading message templates..."
            skeletonType="table"
            skeletonCount={5}
          >
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader title="Quick Stats" />
                  <CardContent>
                    <Typography variant="h4" component="div">
                      {templates.filter(t => t.status === 'ACTIVE').length} Active, {templates.filter(t => t.status === 'INACTIVE').length} Inactive
                    </Typography>
                  <Typography color="textSecondary">
                    Active Templates
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardHeader title="Recent Activity" />
                <CardContent>
                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                      <SendIcon />
                    </Avatar>
                    <Typography>
                      50 messages sent today
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Avatar sx={{ bgcolor: theme.palette.success.main }}>
                      <TrendingIcon />
                    </Avatar>
                    <Typography>
                      Response rate: 25%
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          </ContentLoader>

          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Message</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Target Lists</TableCell>
                        <TableCell>Assigned Users</TableCell>
                        <TableCell>Assigned Groups</TableCell>
                        <TableCell 
                          onClick={() => requestSort('created_at')}
                          sx={{ 
                            cursor: 'pointer',
                            '&:hover': { 
                              backgroundColor: 'action.hover',
                              '& .sort-indicator': {
                                opacity: 1
                              }
                            },
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                          }}
                        >
                          <span>Created</span>
                          <Box 
                            className="sort-indicator" 
                            sx={{ 
                              opacity: sortConfig.key === 'created_at' ? 1 : 0,
                              display: 'inline-flex',
                              flexDirection: 'column',
                              '& svg': {
                                fontSize: '0.8rem',
                                color: 'text.secondary'
                              }
                            }}
                          >
                            <KeyboardArrowUpIcon 
                              fontSize="inherit" 
                              color={sortConfig.key === 'created_at' && sortConfig.direction === 'asc' ? 'primary' : 'inherit'} 
                            />
                            <KeyboardArrowDownIcon 
                              fontSize="inherit" 
                              sx={{ marginTop: '-0.5em' }} 
                              color={sortConfig.key === 'created_at' && sortConfig.direction === 'desc' ? 'primary' : 'inherit'} 
                            />
                          </Box>
                        </TableCell>
                        <TableCell>Sent</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sortedTemplates.map((template) => (
                        <TableRow key={template.id}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {renderMediaIcon(template.media_url)}
                              <Box>
                                <Typography variant="body1">{template.name}</Typography>
                                <Typography variant="body2" color="text.secondary" noWrap>
                                  {template.content.substring(0, 50)}{template.content.length > 50 ? '...' : ''}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={getMessageTypeLabel(template.message_type)}
                              color="primary"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            {template.status === 'ACTIVE' ? (
                              <Chip label="Active" color="success" size="small" />
                            ) : template.status === 'INACTIVE' ? (
                              <Chip label="Inactive" color="default" size="small" />
                            ) : template.status === 'DRAFT' ? (
                              <Chip label="Draft" color="warning" size="small" />
                            ) : (
                              <Chip label="Archived" color="error" size="small" />
                            )}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              console.log('Template lists:', template.id, template.lists);
                              const listCount = template.lists?.length || 0;
                              return listCount > 0 ? (
                                <Chip 
                                  label={`${listCount} list${listCount !== 1 ? 's' : ''}`}
                                  color="primary"
                                  variant="outlined"
                                  size="small"
                                />
                              ) : (
                                <Chip 
                                  label="No lists" 
                                  color="default" 
                                  variant="outlined"
                                  size="small"
                                />
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            {template.users?.length > 0 ? (
                              <Chip 
                                label={`${template.users.length} user${template.users.length !== 1 ? 's' : ''}`}
                                color={template.users.length ? 'primary' : 'default'}
                                variant={template.users.length ? 'outlined' : 'outlined'}
                                size="small"
                              />
                            ) : (
                              <Chip 
                                label="No users" 
                                color="default" 
                                variant="outlined"
                                size="small"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {template.groups?.length > 0 ? (
                              <Chip 
                                label={`${template.groups.length} group${template.groups.length !== 1 ? 's' : ''}`}
                                color="secondary"
                                variant="outlined"
                                size="small"
                              />
                            ) : (
                              <Chip 
                                label="No groups" 
                                color="default" 
                                variant="outlined"
                                size="small"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(template.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </TableCell>
                          <TableCell>
                            {template.sent_count || 0}
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            <Tooltip title={template.status?.toUpperCase() === 'ACTIVE' ? 'Deactivate' : 'Activate'}>
                              <IconButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleMessageStatus(template);
                                }}
                                color={template.status?.toUpperCase() === 'ACTIVE' ? 'success' : 'default'}
                                size="small"
                              >
                                {template.status?.toUpperCase() === 'ACTIVE' ? 
                                  <ToggleOnIcon fontSize="small" /> : 
                                  <ToggleOffIcon fontSize="small" />
                                }
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit">
                              <IconButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditTemplate(template);
                                }}
                                size="small"
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTemplate(template.id);
                                }}
                                color="error"
                                size="small"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}

      {activeTab === 1 && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h5">Sent Messages</Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              {/* Filter Button */}
              <Tooltip title="Filter messages">
                <IconButton
                  onClick={handleFilterMenuOpen}
                  color={isFilterActive ? 'primary' : 'default'}
                  sx={{ border: '1px solid', borderColor: 'divider' }}
                >
                  <FilterListIcon />
                </IconButton>
              </Tooltip>
              
              {/* Filter Menu */}
              <Menu
                anchorEl={filterAnchorEl}
                open={filterMenuOpen}
                onClose={handleFilterMenuClose}
              >
                <MenuItem>
                  <FormControl fullWidth size="small">
                    <InputLabel>Contact</InputLabel>
                    <Select
                      value={selectedContact}
                      label="Contact"
                      onChange={e => setSelectedContact(e.target.value as string)}
                    >
                      <MenuItem value="all">All Contacts</MenuItem>
                      {uniqueContacts.map(contact => (
                        <MenuItem key={contact.id} value={contact.id}>{contact.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </MenuItem>
                <MenuItem>
                  <FormControl fullWidth size="small">
                    <InputLabel>Sender</InputLabel>
                    <Select
                      value={selectedSender}
                      label="Sender"
                      onChange={e => setSelectedSender(e.target.value as string)}
                    >
                      <MenuItem value="all">All Senders</MenuItem>
                      {uniqueSenders.map(sender => (
                        <MenuItem key={sender.id} value={sender.id}>{sender.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </MenuItem>
              </Menu>
              
              {/* Clear Filters Button */}
              {isFilterActive && (
                <Tooltip title="Clear all filters">
                  <IconButton
                    onClick={clearFilters}
                    size="small"
                    sx={{ color: 'text.secondary' }}
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              
              {/* Export Button */}
              <ExportButton
                data={sentMessages.map(msg => ({
                  id: msg.id,
                  template_name: msg.message_template_name || 'Unknown Template',
                  contact_name: [msg.contact_first_name, msg.contact_last_name].filter(Boolean).join(' ') || 'Unknown Contact',
                  contact_phone: msg.contact_phone || 'N/A',
                  username: msg.username || 'Unknown User',
                  sent_at: msg.sent_at
                }))}
                columns={[
                  { id: 'template_name', label: 'Template' },
                  { id: 'contact_name', label: 'Contact Name' },
                  { id: 'contact_phone', label: 'Contact Phone' },
                  { id: 'username', label: 'Sender' },
                  { 
                    id: 'sent_at', 
                    label: 'Sent At',
                    format: (date: string) => formatToCT(date)
                  },
                ]}
                title="Sent Messages"
                defaultFileName="sent_messages"
                filter={{ dateRange }}
              />
            </Box>
          </Box>
          <Paper sx={{ p: 2 }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Template</TableCell>
                    <TableCell>Contact</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Sender</TableCell>
                    <TableCell>Sent At</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <CircularProgress size={24} />
                        <Typography variant="body2" sx={{ ml: 1 }}>
                          Loading messages...
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : sentMessages.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Typography variant="body2">
                          {isFilterActive ? 'No messages match the current filters' : 'No messages found'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : sentMessages.map((message) => (
                    <TableRow key={message.id}>
                      <TableCell>{message.message_template_name || 'Unknown Template'}</TableCell>
                      <TableCell>{[message.contact_first_name, message.contact_last_name].filter(Boolean).join(' ') || 'Unknown Contact'}</TableCell>
                      <TableCell>{message.contact_phone || 'N/A'}</TableCell>
                      <TableCell>{message.username || 'Unknown User'}</TableCell>
                      <TableCell>{formatToCT(message.sent_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}

      {activeTab === 2 && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h5">Message Analytics</Typography>
            <ExportButton
              data={[
                ...stats.dailyMessages.map(d => ({ ...d, type: 'Daily' })),
                ...stats.templatePerformance.map((perf) => ({
                  ...perf,
                  type: 'Template Performance',
                })),
              ]}
              columns={[
                { id: 'date', label: 'Date' },
                { id: 'sent', label: 'Sent' },
                { id: 'delivered', label: 'Delivered' },
                { id: 'responses', label: 'Responses' },
                { 
                  id: 'delivery_rate', 
                  label: 'Delivery Rate',
                  format: (row: any) => 
                    row.sent > 0 ? `${Math.round((row.delivered / row.sent) * 100)}%` : 'N/A' 
                },
                { 
                  id: 'response_rate', 
                  label: 'Response Rate',
                  format: (row: any) =>
                    row.delivered > 0 ? `${Math.round((row.responses / row.delivered) * 100)}%` : 'N/A'
                },
                { id: 'type', label: 'Type' }
              ]}
              title="Message Analytics"
              defaultFileName="message_analytics"
              filter={{ dateRange }}
            />
          </Box>
          <MessageStats
            stats={stats}
            onDateRangeChange={(start, end) => {
              setDateRange({ start, end });
              fetchStats();
            }}
          />
        </>
      )}

      <MessageTemplateForm
        open={templateFormOpen}
        onClose={() => {
          setTemplateFormOpen(false);
          setSelectedTemplate(null);
        }}
        template={selectedTemplate}
        onSave={handleSaveTemplate}
        onDelete={selectedTemplate ? () => handleDeleteTemplate(selectedTemplate.id) : undefined}
      />
    </Box>
  );
};

export default MessagesPage;
