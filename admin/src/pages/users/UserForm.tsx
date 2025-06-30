import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  FormControlLabel,
  Checkbox,
  FormGroup,
  Chip,
  Box,
  Typography,
} from '@mui/material';
import { Group, User } from '../../types';
import { createUser, updateUser, getUsers } from '../../services/users';
import { getUserGroups, addUserToGroup, removeUserFromGroup } from '../../services/groups';

interface UserFormProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  groups: Group[];
  currentUserRole: 'admin' | 'user';
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const UserForm: React.FC<UserFormProps> = ({
  open,
  onClose,
  user,
  groups,
  currentUserRole,
  onSuccess,
  onError,
}) => {
  const [formData, setFormData] = useState<Omit<User, 'id' | 'created_at' | 'updated_at' | 'groups'> & {
    password: string;
    confirmPassword: string;
    groupIds: string[];
  }>({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    role: user?.role || 'user',
    is_active: user?.is_active !== false,
    max_neighbor_messages: user?.max_neighbor_messages || null,
    has_shared_contacts: user?.has_shared_contacts ?? false,
    city: user?.city || '',
    state: user?.state || '',
    zip_code: user?.zip_code || '',
    password: '',
    confirmPassword: '',
    groupIds: []
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch user groups when editing a user
  const [loadingGroups, setLoadingGroups] = useState(false);
  
  useEffect(() => {
    const fetchUserGroups = async () => {
      if (!user) return;
      
      try {
        setLoadingGroups(true);
        const userGroups = await getUserGroups(user.id);
        console.log('Fetched user groups:', userGroups);
        
        // Update form data with the fetched groups
        // Convert the group IDs to strings to match the expected format in the Select component
        const groupIds = userGroups.map(g => g.id.toString());
        console.log('Setting group IDs:', groupIds);
        
        setFormData(prevData => ({
          ...prevData,
          groupIds: groupIds
        }));
      } catch (error) {
        console.error('Error fetching user groups:', error);
        onError('Failed to load user groups');
      } finally {
        setLoadingGroups(false);
      }
    };
    
    if (user) {
      // Set initial form data
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        role: user.role || 'user',
        is_active: user.is_active !== false,
        max_neighbor_messages: user.max_neighbor_messages || null,
        has_shared_contacts: user.has_shared_contacts ?? false,
        city: user.city || '',
        state: user.state || '',
        zip_code: user.zip_code || '',
        password: '',
        confirmPassword: '',
        groupIds: [] // Will be populated by fetchUserGroups
      });
      
      // Fetch user groups
      fetchUserGroups();
    } else {
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        role: 'user',
        is_active: true,
        max_neighbor_messages: null,
        has_shared_contacts: false,
        city: '',
        state: '',
        zip_code: '',
        password: '',
        confirmPassword: '',
        groupIds: []
      });
    }
    setShowPassword(false);
  }, [user, open, onError]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleGroupChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    // Ensure we always have an array of strings
    const selectedGroups = typeof value === 'string' ? [value] : value;
    console.log('Selected groups:', selectedGroups);
    setFormData(prev => ({
      ...prev,
      groupIds: selectedGroups,
    }));
  };

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    if (!/[!@#$%^&*(),.?\":{}|<>]/.test(password)) {
      return 'Password must contain at least one special character';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Prepare the user data
      const { first_name, last_name } = formData;
      const userData: any = {
        first_name,
        last_name,
        email: formData.email.trim(),
        role: formData.role,
        is_active: formData.is_active,
        has_shared_contacts: formData.has_shared_contacts,
        city: formData.city,
        state: formData.state,
        zip_code: formData.zip_code,
        max_neighbor_messages: formData.max_neighbor_messages,
      };

      // Handle password change if current user is admin and password fields are filled
      if (currentUserRole === 'admin' && formData.password) {
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        
        const passwordError = validatePassword(formData.password);
        if (passwordError) {
          throw new Error(passwordError);
        }
        
        userData.password = formData.password;
      }

      if (user) {
        // Update existing user (without groups)
        await updateUser(user.id, userData);
        
        // Handle group assignments separately
        if (formData.groupIds) {
          // Get current groups
          const currentGroups = await getUserGroups(user.id);
          const currentGroupIds = currentGroups.map(g => g.id.toString());
          const newGroupIds = formData.groupIds;
          
          // Add new groups
          const groupsToAdd = newGroupIds.filter(id => !currentGroupIds.includes(id));
          for (const groupId of groupsToAdd) {
            await addUserToGroup(user.id, parseInt(groupId));
          }
          
          // Remove groups that were unselected
          const groupsToRemove = currentGroupIds.filter(id => !newGroupIds.includes(id));
          for (const groupId of groupsToRemove) {
            await removeUserFromGroup(user.id, parseInt(groupId));
          }
        }
        
        onSuccess('User updated successfully');
      } else {
        // Create new user
        if (!first_name || !last_name) {
          throw new Error('First and last name are required');
        }
        if (!userData.email) {
          throw new Error('Email is required');
        }
        
        // Check if email already exists
        const users = await getUsers();
        const emailExists = users.some(u => 
          u.email.toLowerCase() === userData.email.toLowerCase()
        );
        
        if (emailExists) {
          throw new Error('A user with this email already exists');
        }
        
        // Set default password if not provided
        if (!userData.password) {
          userData.password = 'Password123!'; // Default password for new users
        }
        
        // Create the user first
        const newUser = await createUser(userData);
        
        // Add user to selected groups if any
        if (formData.groupIds && formData.groupIds.length > 0) {
          for (const groupId of formData.groupIds) {
            await addUserToGroup(newUser.id, parseInt(groupId));
          }
        }
        
        onSuccess('User created successfully');
      }
      
      onClose();
    } catch (err) {
      console.error('Error saving user:', err);
      const errorMessage = err instanceof Error ? err.message : 
        (user ? 'Failed to update user' : 'Failed to create user');
      onError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getGroupName = (groupId: string) => {
    // Convert the string ID to a number for comparison
    const numericId = parseInt(groupId, 10);
    const group = groups.find(g => g.id === numericId);
    return group ? group.name : '';
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{user ? 'Edit User' : 'Create New User'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="First Name"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              margin="normal"
              required
              disabled={loading}
            />
            <TextField
              fullWidth
              label="Last Name"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              margin="normal"
              required
              disabled={loading}
            />
            <TextField
              fullWidth
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              margin="normal"
              required
              disabled={loading || !!user}
            />
            <TextField
              fullWidth
              label="Zip Code"
              name="zip_code"
              value={formData.zip_code}
              onChange={handleChange}
              margin="normal"
              required
              disabled={loading}
            />
            <TextField
              fullWidth
              label="City"
              name="city"
              value={formData.city}
              onChange={handleChange}
              margin="normal"
              disabled={loading}
            />   
            <TextField
              fullWidth
              label="State"
              name="state"
              value={formData.state}
              onChange={handleChange}
              margin="normal"
              disabled={loading}
            />   
            <TextField
              margin="normal"
              fullWidth
              label="Max Neighbor Messages"
              type="number"
              value={formData.max_neighbor_messages ?? ''}
              onChange={(e) => setFormData({
                ...formData,
                max_neighbor_messages: e.target.value ? parseInt(e.target.value) : null
              })}
              InputLabelProps={{
                shrink: true,
              }}
              inputProps={{
                min: 0
              }}
            />
            {currentUserRole === 'admin' && (
              <>
                <TextField
                  fullWidth
                  label="New Password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password || ''}
                  onChange={handleChange}
                  margin="normal"
                  helperText="Leave blank to keep current password"
                />
                {formData.password && (
                  <TextField
                    fullWidth
                    label="Confirm New Password"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.confirmPassword || ''}
                    onChange={handleChange}
                    margin="normal"
                    error={!!(formData.password && formData.password !== formData.confirmPassword)}
                    helperText={formData.password && formData.password !== formData.confirmPassword ? 'Passwords do not match' : ''}
                  />
                )}
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={showPassword}
                      onChange={(e) => setShowPassword(e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Show password"
                />
              </>
            )}
          </Box>
          <FormControl fullWidth margin="normal">
            <InputLabel id="role-label">Role</InputLabel>
            <Select
              labelId="role-label"
              id="role"
              name="role"
              value={formData.role}
              label="Role"
              onChange={handleChange}
              disabled={loading}
            >
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="user">User</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl fullWidth margin="normal">
            <InputLabel id="groups-label">
              {loadingGroups ? 'Loading Groups...' : 'Groups (Optional)'}
            </InputLabel>
            <Select
              labelId="groups-label"
              id="groups"
              name="groups"
              multiple
              value={formData.groupIds}
              onChange={handleGroupChange}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {loadingGroups ? (
                    <Chip label="Loading..." size="small" />
                  ) : (
                    (selected as string[]).map((value) => (
                      <Chip key={value} label={getGroupName(value)} size="small" />
                    ))
                  )}
                </Box>
              )}
              disabled={loading || loadingGroups || groups.length === 0}
            >
              {groups.length === 0 ? (
                <MenuItem disabled>No groups available</MenuItem>
              ) : (
                groups.map((group) => (
                  <MenuItem key={group.id} value={group.id}>
                    {group.name}
                  </MenuItem>
                ))
              )}
            </Select>
            {groups.length === 0 && (
              <Typography variant="caption" color="textSecondary">
                No groups available. Create groups in the Groups tab.
              </Typography>
            )}
          </FormControl>

          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.is_active}
                  onChange={handleChange}
                  name="is_active"
                  color="primary"
                  disabled={loading}
                />
              }
              label="Active"
            />
          </FormGroup>
        <FormGroup>
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.has_shared_contacts}
                onChange={(e) => setFormData(prev => ({ ...prev, has_shared_contacts: e.target.checked }))}
                name="has_shared_contacts"
                color="primary"
                disabled={loading}
              />
            }
            label="Shared Contacts"
          />
        </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" color="primary" variant="contained" disabled={loading}>
            {loading ? 'Saving...' : user ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default UserForm;
