import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Chip,
  Typography,
  InputAdornment,
  FormHelperText,
  CircularProgress,
  Grid,
  ListItemText,
  IconButton,
  Checkbox,
  ListItemIcon,
} from '@mui/material';
import {
  Save as SaveIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Link as LinkIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import {
  MessageTemplate,
  MessageTemplateFormProps,
  TargetList,
} from '../types/message';
import { getTargetLists } from '../services/targetLists';
import { getUsers } from '../services/users';
import { getGroups, Group } from '../services/groups';

type MessageType = 'friend_to_friend' | 'neighbor_to_neighbor' | 'social_media';

interface FormMessageTemplate extends Omit<MessageTemplate, 'users' | 'lists' | 'groups' | 'status'> {
  users: Array<{ id: number; name?: string }>;
  lists: Array<{ id: number; name: string }>;
  groups: Array<{ id: number; name: string }>;
  listIds: number[];
  userIds: number[];
  groupIds: number[];
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | 'INACTIVE';
  message_type: MessageType;
}

const MESSAGE_TYPES: Record<MessageType, string> = {
  friend_to_friend: 'Friend to Friend',
  neighbor_to_neighbor: 'Neighbor to Neighbor',
  social_media: 'Social Media',
};

const MessageTemplateForm: React.FC<MessageTemplateFormProps> = ({
  open,
  onClose,
  template,
  onSave,
  onDelete,
}) => {
  // State for available data
  const [availableLists, setAvailableLists] = useState<TargetList[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Array<{ 
    id: number; 
    name?: string; 
    first_name?: string; 
    last_name?: string 
  }>>([]);
  const [availableGroups, setAvailableGroups] = useState<Group[]>([]);
  
  // Loading and error states
  const [loading, setLoading] = useState({
    lists: true,
    users: true,
    groups: true,
  });
  
  const [error, setError] = useState({
    lists: '',
    users: '',
    groups: ''
  });

  // Form state
  const [formData, setFormData] = useState<FormMessageTemplate>(() => {
    const now = new Date().toISOString();
    const defaultTemplate: FormMessageTemplate = {
      id: 0,
      name: '',
      content: '',
      message_type: 'friend_to_friend',
      media_url: '',
      status: 'DRAFT',
      lists: [],
      users: [],
      groups: [],
      listIds: [],
      userIds: [],
      groupIds: [],
      created_at: now,
      updated_at: now,
    };

    if (!template) return defaultTemplate;

    // Ensure we have proper arrays for lists, users, and groups
    const lists = Array.isArray(template.lists) ? template.lists : [];
    const users = Array.isArray(template.users) ? template.users : [];
    const groups = Array.isArray(template.groups) ? template.groups : [];
    
    return {
      ...defaultTemplate,
      ...template,
      lists,
      users,
      groups,
      listIds: lists.map(list => list.id),
      userIds: users.map(user => user.id),
      groupIds: groups.map(group => group.id),
    };
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [characterCount, setCharacterCount] = useState(0);
  const [showVariables, setShowVariables] = useState(false);
  
  // Available variables for insertion
  const availableVariables = [
    { label: 'User First Name', value: '%userfirst%' },
    { label: 'User Last Name', value: '%userlast%' },
    { label: 'User City', value: '%usercity%' },
    { label: 'Contact First Name', value: '%contactfirst%' },
    { label: 'Contact Last Name', value: '%contactlast%' },
    { label: 'Contact City', value: '%contactcity%' },
  ];
  
  // Insert variable at cursor position
  const insertVariable = useCallback((variable: string) => {
    const textarea = document.getElementById('message-content') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const text = formData.content;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    
    const newContent = before + variable + after;
    setFormData(prev => ({
      ...prev,
      content: newContent
    }));
    
    // Set cursor position after the inserted variable
    setTimeout(() => {
      const newCursorPos = start + variable.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  }, [formData.content]);
  
  // Handle click on variable chip
  const handleVariableClick = (variable: string) => {
    insertVariable(variable);
    setShowVariables(false);
  };

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch target lists
        const lists = await getTargetLists();
        setAvailableLists(lists);
        setLoading(prev => ({ ...prev, lists: false }));
      } catch (err) {
        console.error('Error fetching target lists:', err);
        setError(prev => ({ ...prev, lists: 'Failed to load target lists' }));
        setLoading(prev => ({ ...prev, lists: false }));
      }

      try {
        // Fetch users
        const users = await getUsers();
        setAvailableUsers(users);
        setLoading(prev => ({ ...prev, users: false }));
      } catch (err) {
        console.error('Error fetching users:', err);
        setError(prev => ({ ...prev, users: 'Failed to load users' }));
        setLoading(prev => ({ ...prev, users: false }));
      }
      
      try {
        // Fetch groups
        const groups = await getGroups();
        setAvailableGroups(groups);
        setLoading(prev => ({ ...prev, groups: false }));
      } catch (err) {
        console.error('Error fetching groups:', err);
        setError(prev => ({ ...prev, groups: 'Failed to load groups' }));
        setLoading(prev => ({ ...prev, groups: false }));
      }
    };

    fetchData();
  }, []);

  // Update character count when content changes
  useEffect(() => {
    setCharacterCount(formData.content?.length || 0);
  }, [formData.content]);
  
  // Update form data when template prop changes or reset when null
  useEffect(() => {
    const now = new Date().toISOString();
    
    if (template) {
      // Ensure we have proper arrays for lists, users, and groups
      const lists = Array.isArray(template.lists) ? template.lists : [];
      const users = Array.isArray(template.users) ? template.users : [];
      const groups = Array.isArray(template.groups) ? template.groups : [];
      
      setFormData({
        id: template.id || 0,
        name: template.name || '',
        content: template.content || '',
        message_type: template.message_type || 'friend_to_friend',
        media_url: template.media_url || '',
        status: (template.status as 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | 'INACTIVE') || 'DRAFT',
        lists,
        users,
        groups,
        listIds: lists.map(list => list.id),
        userIds: users.map(user => user.id),
        groupIds: groups.map(group => group.id),
        created_at: template.created_at || now,
        updated_at: template.updated_at || now,
      });
    } else {
      // Reset form data to defaults for a new message
      setFormData({
        id: 0,
        name: '',
        content: '',
        message_type: 'friend_to_friend',
        media_url: '',
        status: 'DRAFT',
        lists: [],
        users: [],
        groups: [],
        listIds: [],
        userIds: [],
        groupIds: [],
        created_at: now,
        updated_at: now,
      });
    }
  }, [template]);

  // Form handlers
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData(prev => ({
      ...prev,
      name: value,
    }));
    if (formErrors.name) {
      setFormErrors(prev => ({
        ...prev,
        name: '',
      }));
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { value } = e.target;
    setFormData(prev => ({
      ...prev,
      content: value,
    }));
    setCharacterCount(value.length);
    if (formErrors.content) {
      setFormErrors(prev => ({
        ...prev,
        content: '',
      }));
    }
  };

  const handleMediaUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData(prev => ({
      ...prev,
      media_url: value,
    }));
  };

  const handleMessageTypeChange = (e: SelectChangeEvent<MessageType>) => {
    const value = e.target.value as MessageType;
    setFormData(prev => ({
      ...prev,
      message_type: value,
    }));
  };

  const handleListSelect = (event: SelectChangeEvent<any>) => {
    const { value } = event.target;
    let newListIds: number[] = [];
    let newLists: Array<{ id: number; name: string }> = [];

    if (value.includes('all')) {
      if (formData.listIds.length === availableLists.length) {
        // Deselect all
        newListIds = [];
        newLists = [];
      } else {
        // Select all
        newListIds = availableLists.map(l => l.id);
        newLists = availableLists.map(({ id, name }) => ({ id, name }));
      }
    } else {
      // Handle individual selection
      newListIds = value as number[];
      newLists = availableLists
        .filter(list => newListIds.includes(list.id))
        .map(({ id, name }) => ({ id, name }));
    }

    setFormData(prev => ({
      ...prev,
      listIds: newListIds,
      lists: newLists,
    }));

    if (formErrors.lists) {
      setFormErrors(prev => ({ ...prev, lists: '' }));
    }
  };

  const handleUserSelect = (event: SelectChangeEvent<any>) => {
    const { value } = event.target;
    let newUserIds: number[] = [];
    let newUsers: Array<{ id: number; name: string }> = [];

    if (value.includes('all')) {
      if (formData.userIds.length === availableUsers.length) {
        // Deselect all
        newUserIds = [];
        newUsers = [];
      } else {
        // Select all
        newUserIds = availableUsers.map(u => u.id);
        newUsers = availableUsers.map(({ id, first_name, last_name, name }) => ({
          id,
          name: name || [first_name, last_name].filter(Boolean).join(' ') || `User ${id}`,
        }));
      }
    } else {
      // Handle individual selection
      newUserIds = value as number[];
      newUsers = availableUsers
        .filter(user => newUserIds.includes(user.id))
        .map(({ id, first_name, last_name, name }) => ({
          id,
          name: name || [first_name, last_name].filter(Boolean).join(' ') || `User ${id}`,
        }));
    }

    setFormData(prev => ({
      ...prev,
      userIds: newUserIds,
      users: newUsers,
    }));

    if (formErrors.users) {
      setFormErrors(prev => ({ ...prev, users: '' }));
    }
  };
  
  const handleGroupSelect = (event: SelectChangeEvent<any>) => {
    const { value } = event.target;
    let newGroupIds: number[] = [];
    let newGroups: Array<{ id: number; name: string }> = [];

    if (value.includes('all')) {
      if (formData.groupIds.length === availableGroups.length) {
        // Deselect all
        newGroupIds = [];
        newGroups = [];
      } else {
        // Select all
        newGroupIds = availableGroups.map(g => g.id);
        newGroups = availableGroups.map(({ id, name }) => ({ id, name }));
      }
    } else {
      // Handle individual selection
      newGroupIds = value as number[];
      newGroups = availableGroups
        .filter(group => newGroupIds.includes(group.id))
        .map(({ id, name }) => ({ id, name }));
    }

    setFormData(prev => ({
      ...prev,
      groupIds: newGroupIds,
      groups: newGroups,
    }));

    if (formErrors.groups) {
      setFormErrors(prev => ({ ...prev, groups: '' }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Message name is required';
    }

    if (!formData.content.trim()) {
      errors.content = 'Message content is required';
    }

    if (!formData.message_type) {
      errors.message_type = 'Please select a message type';
    }

    if (!formData.listIds.length) {
      errors.lists = 'Please select at least one target list';
    }

    if (!formData.userIds.length && !formData.groupIds.length) {
      errors.users = 'Please assign at least one user or group';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const now = new Date().toISOString();
    const dataToSave: MessageTemplate = {
      ...formData,
      status: template ? formData.status : 'ACTIVE', // Set to 'ACTIVE' for new templates
      updated_at: now,
      created_at: formData.created_at || now,
      // Explicitly include all target data to ensure nothing is lost
      lists: formData.lists,
      listIds: formData.listIds,
      users: formData.users,
      userIds: formData.userIds,
      groups: formData.groups,
      groupIds: formData.groupIds,
    };
    
    console.log('Saving message template with data:', dataToSave);
    onSave(dataToSave);
    onClose();
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
    }
  };

  // Loading state
  if (loading.lists || loading.users) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {template ? 'Edit Message' : 'New Message'}
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <CircularProgress />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {template ? 'Edit Message' : 'New Message'}
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            {/* Message Name */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Message Name"
                value={formData.name}
                onChange={handleNameChange}
                error={!!formErrors.name}
                helperText={formErrors.name}
                required
              />
            </Grid>

            {/* Message Type */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth error={!!formErrors.message_type} required>
                <InputLabel>Message Type</InputLabel>
                <Select
                  value={formData.message_type}
                  onChange={handleMessageTypeChange}
                  label="Message Type"
                >
                  {Object.entries(MESSAGE_TYPES).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
                {formErrors.message_type && (
                  <FormHelperText>{formErrors.message_type}</FormHelperText>
                )}
              </FormControl>
            </Grid>

            {/* Media URL */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Media URL (optional)"
                value={formData.media_url || ''}
                onChange={handleMediaUrlChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LinkIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            {/* Message Content */}
            <Grid item xs={12}>
              <Box mb={1}>
                <Button 
                  variant="outlined" 
                  size="small" 
                  onClick={() => setShowVariables(!showVariables)}
                  startIcon={<AddIcon />}
                >
                  Insert Variable
                </Button>
                {showVariables && (
                  <Box mt={1} p={1} border={1} borderColor="divider" borderRadius={1}>
                    <Typography variant="subtitle2" gutterBottom>Available Variables:</Typography>
                    <Box display="flex" flexWrap="wrap" gap={1}>
                      {availableVariables.map((variable) => (
                        <Chip
                          key={variable.value}
                          label={variable.label}
                          onClick={() => handleVariableClick(variable.value)}
                          variant="outlined"
                          clickable
                          size="small"
                          sx={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
              <TextField
                id="message-content"
                fullWidth
                multiline
                rows={6}
                label="Message Content"
                value={formData.content}
                onChange={handleContentChange}
                error={!!formErrors.content}
                helperText={formErrors.content || `${characterCount}/160 characters`}
                required
              />
              <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                Tip: Use variables like %userfirst%, %usercity%, etc. to personalize messages.
              </Typography>
            </Grid>

            {/* Target Lists */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth error={!!formErrors.lists} required>
                <InputLabel>Target Lists</InputLabel>
                <Select
                  multiple
                  value={formData.listIds}
                  onChange={handleListSelect}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.length === availableLists.length && availableLists.length > 0 ? (
                        <Chip label={`${availableLists.length} lists`} size="small" />
                      ) : (
                        selected.map((value) => {
                          const list = availableLists.find((l) => l.id === value);
                          return <Chip key={value} label={list?.name || value} size="small" />;
                        })
                      )}
                    </Box>
                  )}
                >
                  <MenuItem value="all">
                    <Checkbox
                      checked={availableLists.length > 0 && formData.listIds.length === availableLists.length}
                      indeterminate={
                        formData.listIds.length > 0 && formData.listIds.length < availableLists.length
                      }
                    />
                    <ListItemText primary={`Select All (${availableLists.length})`} />
                  </MenuItem>
                  {availableLists.map((list) => (
                    <MenuItem key={list.id} value={list.id}>
                      <Checkbox checked={formData.listIds.includes(list.id)} />
                      <ListItemText primary={list.name} />
                    </MenuItem>
                  ))}
                </Select>
                {formErrors.lists && (
                  <FormHelperText>{formErrors.lists}</FormHelperText>
                )}
              </FormControl>
            </Grid>
            
            {/* User Assignment */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth error={!!formErrors.users}>
                <InputLabel>Assign Users</InputLabel>
                <Select
                  multiple
                  value={formData.userIds}
                  onChange={handleUserSelect}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.length === availableUsers.length && availableUsers.length > 0 ? (
                        <Chip label="All Users" size="small" />
                      ) : (
                        formData.users.map((user) => (
                          <Chip key={user.id} label={user.name || `User ${user.id}`} size="small" />
                        ))
                      )}
                    </Box>
                  )}
                  MenuProps={{
                    PaperProps: {
                      style: {
                        maxHeight: 300,
                      },
                    },
                  }}
                >
                  <MenuItem value="all">
                    <ListItemIcon>
                      <Checkbox
                        checked={formData.userIds.length === availableUsers.length && availableUsers.length > 0}
                        indeterminate={
                          formData.userIds.length > 0 &&
                          formData.userIds.length < availableUsers.length
                        }
                      />
                    </ListItemIcon>
                    <ListItemText primary="Select All" />
                  </MenuItem>
                  {availableUsers.map((user) => {
                    const userName = user.name || 
                      [user.first_name, user.last_name].filter(Boolean).join(' ') || 
                      `User ${user.id}`;
                    return (
                      <MenuItem key={user.id} value={user.id}>
                        <Checkbox checked={formData.userIds.includes(user.id)} />
                        <ListItemText primary={userName} />
                      </MenuItem>
                    );
                  })}
                </Select>
                {formErrors.users && (
                  <FormHelperText>{formErrors.users}</FormHelperText>
                )}
              </FormControl>
            </Grid>

            {/* Group Assignment */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth error={!!formErrors.groups}>
                <InputLabel id="groups-select-label">Assign Groups</InputLabel>
                <Select
                  labelId="groups-select-label"
                  multiple
                  value={formData.groupIds}
                  onChange={handleGroupSelect}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.length === availableGroups.length && availableGroups.length > 0 ? (
                        <Chip label="All Groups" size="small" />
                      ) : (
                        formData.groups.map((group) => (
                          <Chip key={group.id} label={group.name || `Group ${group.id}`} size="small" />
                        ))
                      )}
                    </Box>
                  )}
                  MenuProps={{
                    PaperProps: {
                      style: {
                        maxHeight: 300,
                      },
                    },
                  }}
                >
                  <MenuItem value="all">
                    <ListItemIcon>
                      <Checkbox
                        checked={formData.groupIds.length === availableGroups.length && availableGroups.length > 0}
                        indeterminate={
                          formData.groupIds.length > 0 &&
                          formData.groupIds.length < availableGroups.length
                        }
                      />
                    </ListItemIcon>
                    <ListItemText primary="Select All" />
                  </MenuItem>
                  {availableGroups.map((group) => (
                    <MenuItem key={group.id} value={group.id}>
                      <Checkbox checked={formData.groupIds.includes(group.id)} />
                      <ListItemText primary={group.name} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          {template && onDelete && (
            <Button
              onClick={handleDelete}
              color="error"
              startIcon={<DeleteIcon />}
              sx={{ mr: 'auto' }}
            >
              Delete
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
          >
            {template ? 'Update' : 'Create'} Message
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default MessageTemplateForm;