import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  TextField,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Snackbar,
  Alert,
  Menu,
  MenuItem,
  IconButton,
  Tooltip,
  Select,
  InputLabel,
  FormControl,
  Checkbox,
  ListItemText,
  InputAdornment,
  OutlinedInput,
  FormGroup,
  FormControlLabel
} from '@mui/material';
import { SelectChangeEvent } from '@mui/material/Select';
import { 
  Search as SearchIcon, 
  Refresh as RefreshIcon,
  Info as InfoIcon,
  FilterList as FilterListIcon,
  ViewColumn as ViewColumnIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import Layout from '../components/Layout';
import ExportButton from '../components/ExportButton';
import api from '../services/api';

type SortableField = 'id' | 'first_name' | 'last_name' | 'company' | 'email' | 'created_at' | 'user_name' | 'user_email';
type SortDirection = 'asc' | 'desc';

interface Match {
  id: number;
  target_contact_id: number;
  voter_id: string | null;
  target_list_id: number;
  target_list_name: string | null;
  match_confidence: 'high' | 'medium' | 'low';
  created_at: string;
}

interface SharedContact {
  id: number;
  first_name: string;
  last_name: string | null;
  company: string | null;
  email: string | null;
  mobile_numbers: string[];
  address: {
    street?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  } | null;
  user_id: number;
  user_name: string | null;
  user_email: string | null;
  created_at: string;
  match_count: number;
  matches?: Match[];
}

type MatchStatusFilter = 'all' | 'matched' | 'unmatched';
interface ColumnVisibility {
  [key: string]: boolean;
  company: boolean;
  phone2: boolean;
  phone3: boolean;
}

const SharedContacts: React.FC = () => {
  const [contacts, setContacts] = useState<SharedContact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  // Pagination state (single definition)
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10); // Default to 10, max 500
  const [totalCount, setTotalCount] = useState(0);
  const [matching, setMatching] = useState<boolean>(false);
  const [matchDialogOpen, setMatchDialogOpen] = useState<boolean>(false);
  const [matchConfigDialogOpen, setMatchConfigDialogOpen] = useState<boolean>(false);
  const [selectedContact, setSelectedContact] = useState<SharedContact | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>(['all']);
  const [selectedLists, setSelectedLists] = useState<string[]>(['all']);
  const [targetLists, setTargetLists] = useState<Array<{id: string, name: string}>>([]);
  interface SnackbarState {
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
    autoHideDuration?: number;
  }

  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
    autoHideDuration: 6000
  });
  const [orderBy, setOrderBy] = useState<SortableField>('created_at');
  const [order, setOrder] = useState<SortDirection>('desc');

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
    company: false,
    phone2: false,
    phone3: false,
  });

  // Filter state
  const [matchStatus, setMatchStatus] = useState<MatchStatusFilter>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');

  // Menu state
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);
  const [columnAnchorEl, setColumnAnchorEl] = useState<null | HTMLElement>(null);
  const filterMenuOpen = Boolean(filterAnchorEl);
  const columnMenuOpen = Boolean(columnAnchorEl);

  // Unique users for filter
  const uniqueUsers = useMemo(() => {
    const users = new Map<string, string>();
    
    // Ensure contacts is an array before calling forEach
    if (Array.isArray(contacts)) {
      contacts.forEach(contact => {
        if (contact?.user_id) {
          users.set(
            contact.user_id.toString(),
            contact.user_name || contact.user_email || `User ${contact.user_id}`
          );
        }
      });
    }
    
    return Array.from(users.entries()).map(([id, name]) => ({
      id,
      name: name || `User ${id}`
    }));
  }, [contacts]);

  // Reset pagination when filters change
  useEffect(() => {
    setPage(0);
  }, [matchStatus, selectedUser, searchTerm]);

  // Menu handlers
  const handleFilterMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setFilterAnchorEl(event.currentTarget);
  };
  const handleFilterMenuClose = () => {
    setFilterAnchorEl(null);
  };
  const handleColumnMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setColumnAnchorEl(event.currentTarget);
  };
  const handleColumnMenuClose = () => {
    setColumnAnchorEl(null);
  };
  const handleColumnVisibilityToggle = (column: keyof ColumnVisibility) => {
    setColumnVisibility(prev => ({
      ...prev,
      [column]: !prev[column]
    }));
  };
  const clearFilters = () => {
    setMatchStatus('all');
    setSelectedUser('all');
    setSearchTerm('');
  };
  const isFilterActive = matchStatus !== 'all' || selectedUser !== 'all' || searchTerm !== '';

  const handleSearch = () => {
    setSearchTerm(tempSearchTerm);
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };



  // Fetch target lists for matching
  const fetchTargetLists = async () => {
    try {
      const response = await api.get('/targets/lists');
      // The response should have a 'lists' property containing the array of lists
      const lists = response.data.lists || [];
      setTargetLists(lists.map((list: any) => ({
        id: list.id.toString(),
        name: list.name
      })));
    } catch (error) {
      console.error('Error fetching target lists:', error);
      // Log the full error for debugging
      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error status:', error.response.status);
      }
      setSnackbar({
        open: true,
        message: 'Failed to load target lists',
        severity: 'error',
        autoHideDuration: 6000
      });
    }
  };

  // Load target lists on component mount
  useEffect(() => {
    fetchTargetLists();
  }, []);

  // Fetch shared contacts from API with pagination
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        setLoading(true);
        // Enforce backend max limit of 500
        const limit = Math.min(rowsPerPage, 500);
        const skip = page * limit;
        
        // Build query parameters
        const params = new URLSearchParams({
          skip: skip.toString(),
          limit: limit.toString()
        });
        
        // Only include user_id if a specific user is selected and it's a valid number
        if (selectedUser !== 'all' && !isNaN(Number(selectedUser))) {
          params.append('user_id', selectedUser);
        }
        
        // Include search term if provided
        if (searchTerm) {
          params.append('search', searchTerm);
        }
        
        // Include match status filter if not 'all'
        if (matchStatus !== 'all') {
          params.append('match_status', matchStatus);
        }
        
        const response = await api.get(`/contacts/shared?${params.toString()}`);
        // Handle both response formats - array with total or object with contacts/total
        if (Array.isArray(response.data)) {
          setContacts(response.data);
          // If we get an array, we don't have a separate total, so use array length
          setTotalCount(response.data.length);
        } else {
          // Handle object response with {contacts: [...], total: number}
          setContacts(response.data.contacts || []);
          setTotalCount(response.data.total || 0);
        }
      } catch (error) {
        console.error('Error fetching contacts:', error);
        setSnackbar({
          open: true,
          message: 'Failed to load contacts',
          severity: 'error',
          autoHideDuration: 6000
        });
      } finally {
        setLoading(false);
      }
    };
    fetchContacts();
  }, [page, rowsPerPage, selectedUser, searchTerm, matchStatus]);

  // Pagination handlers (single definition)
  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const allowed = [5, 10, 25, 50];
    let newRows = parseInt(event.target.value, 10);
    if (!allowed.includes(newRows)) newRows = 10;
    setRowsPerPage(newRows);
    setPage(0);
  };



  // Fetch matches for a specific contact
  const fetchContactMatches = async (contactId: number) => {
    try {
      const response = await api.get(`/contacts/${contactId}/matches`);
      return response.data;
    } catch (error) {
      console.error('Error fetching contact matches:', error);
      return [];
    }
  };

  // Handle viewing matches for a contact
  const handleViewMatches = async (contact: SharedContact) => {
    setSelectedContact(contact);
    
    // If we don't have the matches yet, fetch them
    if (!contact.matches) {
      try {
        const matches = await fetchContactMatches(contact.id);
        setSelectedContact({
          ...contact,
          matches
        });
      } catch (error) {
        console.error('Error loading matches:', error);
        setSnackbar({
          open: true,
          message: 'Failed to load contact matches',
          severity: 'error',
          autoHideDuration: 6000
        });
      }
    }
    
    setMatchDialogOpen(true);
  };

  // Handle closing the match dialog
  const handleCloseMatchDialog = () => {
    setMatchDialogOpen(false);
  };

  // Handle opening the match configuration dialog
  const handleOpenMatchDialog = () => {
    setMatchConfigDialogOpen(true);
  };

  // Handle closing the match configuration dialog
  const handleCloseMatchConfigDialog = () => {
    setMatchConfigDialogOpen(false);
    setSelectedUsers(['all']);
    setSelectedLists(['all']);
  };

  // Handle user selection change
  const handleUserChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value as string[];
    
    // If 'all' was selected but there are other items, remove 'all'
    if (value.includes('all') && value.length > 1) {
      setSelectedUsers(value.filter(item => item !== 'all'));
    } 
    // If 'all' is selected and it's the only item, keep it
    else if (value.includes('all') && value.length === 1) {
      setSelectedUsers(['all']);
    } 
    // If no items are selected, default to 'all'
    else if (value.length === 0) {
      setSelectedUsers(['all']);
    } 
    // Otherwise, set the selected users
    else {
      setSelectedUsers(value);
    }
  };

  // Handle list selection change
  const handleListChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value as string[];
    
    // If 'all' was selected but there are other items, remove 'all'
    if (value.includes('all') && value.length > 1) {
      setSelectedLists(value.filter(item => item !== 'all'));
    } 
    // If 'all' is selected and it's the only item, keep it
    else if (value.includes('all') && value.length === 1) {
      setSelectedLists(['all']);
    } 
    // If no items are selected, default to 'all'
    else if (value.length === 0) {
      setSelectedLists(['all']);
    } 
    // Otherwise, set the selected lists
    else {
      setSelectedLists(value);
    }
  };

  // Poll for matching completion
  const pollForMatchingCompletion = useCallback(async () => {
    const maxAttempts = 60; // 5 minutes max (5 seconds * 60 = 300 seconds = 5 minutes)
    let attempts = 0;
    
    const checkStatus = async () => {
      try {
        const response = await api.get('contacts/shared', {
          params: {
            limit: 1,
            skip: 0,
            _t: new Date().getTime() // Prevent caching
          }
        });
        
        // If we get a successful response with data, consider matching complete
        if (response.data && (Array.isArray(response.data) || response.data.contacts)) {
          return true;
        }
      } catch (error) {
        console.error('Error checking matching status:', error);
      }
      
      return false;
    };
    
    while (attempts < maxAttempts) {
      const isComplete = await checkStatus();
      if (isComplete) {
        return true;
      }
      
      // Wait 5 seconds between checks
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }
    
    return false;
  }, []);

  // Handle matching new contacts with configuration
  const handleMatchNewContacts = async () => {
    try {
      setMatching(true);
      setMatchConfigDialogOpen(false);
      
      const params = new URLSearchParams();
      
      // Add user IDs to params if not 'all'
      if (!selectedUsers.includes('all')) {
        selectedUsers.forEach(userId => {
          params.append('user_ids', userId);
        });
      }
      
      // Add list IDs to params if not 'all'
      if (!selectedLists.includes('all')) {
        selectedLists.forEach(listId => {
          params.append('list_ids', listId);
        });
      }
      
      // Clear any existing data to force refresh
      setContacts([]);
      setLoading(true);
      
      // Show a more informative message
      setSnackbar({
        open: true,
        message: 'Matching contacts in progress. This may take a few minutes...',
        severity: 'info',
        autoHideDuration: 10000 // Show for 10 seconds
      });
      
      // Start the matching process
      await api.post(`contacts/match/new-contacts?${params.toString()}`);
      
      // Poll for completion
      const isComplete = await pollForMatchingCompletion();
      
      if (isComplete) {
        // Force a full page reload to ensure all data is fresh
        window.location.reload();
      } else {
        // If polling timed out, show a message and let the user refresh manually
        setSnackbar({
          open: true,
          message: 'Matching is taking longer than expected. The page will refresh automatically when complete.',
          severity: 'warning',
          autoHideDuration: 10000
        });
        
        // Continue polling in the background
        const finalStatus = await pollForMatchingCompletion();
        if (finalStatus) {
          window.location.reload();
        }
      }
      
    } catch (error) {
      console.error('Error matching contacts:', error);
      setSnackbar({
        open: true,
        message: 'Failed to match contacts',
        severity: 'error',
        autoHideDuration: 6000
      });
    } finally {
      setMatching(false);
      setSelectedUsers(['all']);
      setSelectedLists(['all']);
    }
  };

  // Handle closing the snackbar
  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({
      ...prev,
      open: false,
      autoHideDuration: prev.autoHideDuration || 6000
    }));
  };

  // Handle sorting
  const handleSort = (property: SortableField) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  // Sortable table header component
  const SortableHeader: React.FC<{ id: SortableField; label: string }> = ({ id, label }) => (
    <TableCell
      sortDirection={orderBy === id ? order : false}
      onClick={() => handleSort(id)}
      sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
    >
      <Box display="flex" alignItems="center">
        {label}
        {orderBy === id && (
          <Box component="span" ml={1}>
            {order === 'desc' ? '▼' : '▲'}
          </Box>
        )}
      </Box>
    </TableCell>
  );

  // Filter and sort contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      // Apply search term filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = (
          contact.first_name?.toLowerCase().includes(searchLower) ||
          contact.last_name?.toLowerCase().includes(searchLower) ||
          contact.email?.toLowerCase().includes(searchLower) ||
          contact.company?.toLowerCase().includes(searchLower) ||
          contact.mobile_numbers?.some(phone => phone?.toLowerCase().includes(searchLower)) ||
          contact.user_name?.toLowerCase().includes(searchLower) ||
          contact.user_email?.toLowerCase().includes(searchLower) ||
          contact.address?.street?.toLowerCase().includes(searchLower) ||
          contact.address?.city?.toLowerCase().includes(searchLower) ||
          contact.address?.state?.toLowerCase().includes(searchLower) ||
          contact.address?.zip?.includes(searchTerm)
        );
        if (!matchesSearch) return false;
      }
      // Apply match status filter
      if (matchStatus === 'matched' && contact.match_count === 0) return false;
      if (matchStatus === 'unmatched' && contact.match_count > 0) return false;
      // Apply user filter
      if (selectedUser !== 'all' && contact.user_id.toString() !== selectedUser) return false;
      return true;
    });
  }, [contacts, searchTerm, matchStatus, selectedUser]);

  // TablePagination UI
  const filteredCount = useMemo(() => {
    // Always use the total count from the API
    // The backend now handles all filtering and returns the correct total
    return totalCount;
  }, [totalCount]);

  // Reset to first page when filters change
  useEffect(() => {
    setPage(0);
  }, [selectedUser, searchTerm, matchStatus, rowsPerPage]);

  <TablePagination
    component="div"
    count={totalCount}
    page={page}
    onPageChange={handleChangePage}
    rowsPerPage={rowsPerPage}
    onRowsPerPageChange={handleChangeRowsPerPage}
    rowsPerPageOptions={[5, 10, 25, 50]}
    labelRowsPerPage="Contacts per page:"
  />

  // Sort the filtered contacts
  const sortedContacts = useMemo(() => {
    return [...filteredContacts].sort((a, b) => {
      let aValue = a[orderBy];
      let bValue = b[orderBy];

      // Handle nested properties
      if (orderBy === 'user_name') {
        aValue = a.user_name || a.user_email || '';
        bValue = b.user_name || b.user_email || '';
      }

      if (aValue === null || aValue === undefined) return order === 'asc' ? -1 : 1;
      if (bValue === null || bValue === undefined) return order === 'asc' ? 1 : -1;
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return order === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (aValue < bValue) return order === 'asc' ? -1 : 1;
      if (aValue > bValue) return order === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredContacts, orderBy, order]);



  // Export columns in table order
  const exportColumns = [
    { id: 'ID', label: 'ID', key: 'ID' },
    { id: 'First_Name', label: 'First Name', key: 'First Name' },
    { id: 'Last_Name', label: 'Last Name', key: 'Last Name' },
    { id: 'Email', label: 'Email', key: 'Email' },
    { id: 'Phone_1', label: 'Phone 1', key: 'Phone 1' },
    ...(columnVisibility.company ? [{ id: 'Company', label: 'Company', key: 'Company' }] : []),
    ...(columnVisibility.phone2 ? [{ id: 'Phone_2', label: 'Phone 2', key: 'Phone 2' }] : []),
    ...(columnVisibility.phone3 ? [{ id: 'Phone_3', label: 'Phone 3', key: 'Phone 3' }] : []),
    { id: 'Matched_Lists_Count', label: 'Matched Lists Count', key: 'Matched Lists Count' },
    { id: 'Shared_By', label: 'Shared By', key: 'Shared By' },
    { id: 'Date_Shared', label: 'Date Shared', key: 'Date Shared' },
  ];

// Export logic
  const getExportData = async () => {
    try {
      const contactIds = filteredContacts.map(contact => contact.id);
      if (contactIds.length === 0) {
        setSnackbar({
          open: true,
          message: 'No contacts to export',
          severity: 'warning'
        });
        return { data: [], columns: exportColumns };
      }
      const { fetchContactsWithMatches, prepareExportData } = await import('../utils/exportUtils');
      const contactsWithMatches = await fetchContactsWithMatches(contactIds);
      const data = prepareExportData(contactsWithMatches, columnVisibility);
      // Compute max matched lists for dynamic columns
      const maxMatches = Math.max(...data.map(row => {
        let n = 0;
        while (row[`Matched List ${n + 1} Name`] !== undefined) n++;
        return n;
      }), 0);
      const matchedColumns = [];
      for (let i = 1; i <= maxMatches; ++i) {
        matchedColumns.push({ label: `Matched List ${i} Name`, key: `Matched List ${i} Name` });
        matchedColumns.push({ label: `Matched List ${i} Voter ID`, key: `Matched List ${i} Voter ID` });
      }
      return { data, columns: [...exportColumns, ...matchedColumns] };
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to prepare export data',
        severity: 'error'
      });
      return { data: [], columns: exportColumns };
    }
  };

// Debug styles
  const debugStyles = {
    mainContainer: {
      outline: '2px solid red',
      position: 'relative',
      '&::before': {
        content: '"DEBUG MAIN"',
        position: 'absolute',
        top: 0,
        left: 0,
        background: 'rgba(255,0,0,0.2)',
        padding: '2px 4px',
        fontSize: '10px',
        zIndex: 9999
      }
    },
    paperContainer: {
      outline: '2px solid blue',
      position: 'relative',
      '&::before': {
        content: '"DEBUG PAPER"',
        position: 'absolute',
        top: 0,
        left: 0,
        background: 'rgba(0,0,255,0.2)',
        padding: '2px 4px',
        fontSize: '10px',
        zIndex: 9999
      }
    },
    tableContainer: {
      outline: '2px solid green',
      position: 'relative',
      '&::before': {
        content: '"DEBUG TABLE"',
        position: 'absolute',
        top: 0,
        left: 0,
        background: 'rgba(0,255,0,0.2)',
        padding: '2px 4px',
        fontSize: '10px',
        zIndex: 9999
      }
    }
  };

  return (
    <>
      <Box sx={{ width: '100%', p: 3 }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          mb: 3
        }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 0 }}>
            Shared Contacts
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleOpenMatchDialog}
              disabled={matching}
              startIcon={<RefreshIcon />}
              sx={{ whiteSpace: 'nowrap' }}
            >
              Match New Contacts
            </Button>
            <ExportButton 
  data={filteredContacts}
  columns={exportColumns}
  title="Shared Contacts Export"
  defaultFileName="shared_contacts_export.csv"
/>
            <Tooltip title="Filter options">
              <IconButton
                onClick={handleFilterMenuOpen}
                color={isFilterActive ? 'primary' : 'default'}
                sx={{ border: '1px solid', borderColor: 'divider' }}
              >
                <FilterListIcon />
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={filterAnchorEl}
              open={filterMenuOpen}
              onClose={handleFilterMenuClose}
            >
              <MenuItem>
                <FormControl fullWidth size="small">
                  <InputLabel>Match Status</InputLabel>
                  <Select
                    value={matchStatus}
                    label="Match Status"
                    onChange={e => setMatchStatus(e.target.value as 'all' | 'matched' | 'unmatched')}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="matched">Matched</MenuItem>
                    <MenuItem value="unmatched">Unmatched</MenuItem>
                  </Select>
                </FormControl>
              </MenuItem>
              <MenuItem>
                <FormControl fullWidth size="small">
                  <InputLabel>User</InputLabel>
                  <Select
                    value={selectedUser}
                    label="User"
                    onChange={e => setSelectedUser(e.target.value)}
                  >
                    <MenuItem value="all">All Users</MenuItem>
                    {uniqueUsers.map(user => (
                      <MenuItem key={user.id} value={user.id}>{user.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </MenuItem>
            </Menu>
            <Tooltip title="Column visibility">
              <IconButton
                onClick={handleColumnMenuOpen}
                sx={{ border: '1px solid', borderColor: 'divider' }}
              >
                <ViewColumnIcon />
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={columnAnchorEl}
              open={columnMenuOpen}
              onClose={handleColumnMenuClose}
            >
              <MenuItem>
                <Checkbox
                  checked={columnVisibility.company}
                  onChange={() => handleColumnVisibilityToggle('company')}
                />
                <ListItemText primary="Company" />
              </MenuItem>
              <MenuItem>
                <Checkbox
                  checked={columnVisibility.phone2}
                  onChange={() => handleColumnVisibilityToggle('phone2')}
                />
                <ListItemText primary="Phone 2" />
              </MenuItem>
              <MenuItem>
                <Checkbox
                  checked={columnVisibility.phone3}
                  onChange={() => handleColumnVisibilityToggle('phone3')}
                />
                <ListItemText primary="Phone 3" />
              </MenuItem>
            </Menu>
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
            <TextField
              placeholder="Search contacts"
              variant="outlined"
              size="small"
              value={tempSearchTerm}
              onChange={(e) => setTempSearchTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              sx={{ minWidth: 250 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={handleSearch}>
                      <SearchIcon />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Box>
        </Box>

        <Paper sx={{ 
          width: '100%',
          overflow: 'hidden', 
          boxShadow: 'none', 
          border: '1px solid rgba(224, 224, 224, 1)',
          borderRadius: 1
        }}>
          <TableContainer sx={{ 
            maxHeight: 'calc(100vh - 200px)', 
            minHeight: '400px'
          }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <SortableHeader id="id" label="ID" />
                  <SortableHeader id="first_name" label="First Name" />
                  <SortableHeader id="last_name" label="Last Name" />
                  {columnVisibility.company && <SortableHeader id="company" label="Company" />}
                  <SortableHeader id="email" label="Email" />
                  <TableCell>Phone 1</TableCell>
                  {columnVisibility.phone2 && <TableCell>Phone 2</TableCell>}
                  {columnVisibility.phone3 && <TableCell>Phone 3</TableCell>}
                  <TableCell>Matched Lists</TableCell>
                  <SortableHeader id="user_name" label="Shared By" />
                  <SortableHeader id="created_at" label="Date Shared" />
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : (searchTerm || matchStatus !== 'all' || selectedUser !== 'all') ? (
                  filteredContacts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} align="center">
                        No matching contacts found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredContacts.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((contact) => (
                      <TableRow key={contact.id} hover>
                        <TableCell>{contact.id}</TableCell>
                        <TableCell>{contact.first_name || ''}</TableCell>
                        <TableCell>{contact.last_name || ''}</TableCell>
                        {columnVisibility.company && <TableCell>{contact.company || ''}</TableCell>}
                        <TableCell>{contact.email || ''}</TableCell>
                        <TableCell>{contact.mobile_numbers?.[0] || ''}</TableCell>
                        {columnVisibility.phone2 && <TableCell>{contact.mobile_numbers?.[1] || ''}</TableCell>}
                        {columnVisibility.phone3 && <TableCell>{contact.mobile_numbers?.[2] || ''}</TableCell>}
                        <TableCell>
                          {contact.match_count ? (
                            <Chip 
                              label={`${contact.match_count} list${contact.match_count > 1 ? 's' : ''}`}
                              color="primary"
                              variant="outlined"
                              size="small"
                              onClick={() => handleViewMatches(contact)}
                              icon={<InfoIcon fontSize="small" />}
                              clickable
                              sx={{ cursor: 'pointer' }}
                            />
                          ) : (
                            'None'
                          )}
                        </TableCell>
                        <TableCell>
                          {contact.user_name || 'Unknown'}
                          {contact.user_email && ` (${contact.user_email})`}
                        </TableCell>
                        <TableCell>{new Date(contact.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )
                ) : (
                  contacts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} align="center">
                        No shared contacts available
                      </TableCell>
                    </TableRow>
                  ) : (
                    contacts.map((contact) => (
                      <TableRow key={contact.id} hover>
                        <TableCell>{contact.id}</TableCell>
                        <TableCell>{contact.first_name || ''}</TableCell>
                        <TableCell>{contact.last_name || ''}</TableCell>
                        {columnVisibility.company && <TableCell>{contact.company || ''}</TableCell>}
                        <TableCell>{contact.email || ''}</TableCell>
                        <TableCell>{contact.mobile_numbers?.[0] || ''}</TableCell>
                        {columnVisibility.phone2 && <TableCell>{contact.mobile_numbers?.[1] || ''}</TableCell>}
                        {columnVisibility.phone3 && <TableCell>{contact.mobile_numbers?.[2] || ''}</TableCell>}
                        <TableCell>
                          {contact.match_count ? (
                            <Chip 
                              label={`${contact.match_count} list${contact.match_count > 1 ? 's' : ''}`}
                              color="primary"
                              variant="outlined"
                              size="small"
                              onClick={() => handleViewMatches(contact)}
                              icon={<InfoIcon fontSize="small" />}
                              clickable
                              sx={{ cursor: 'pointer' }}
                            />
                          ) : (
                            'None'
                          )}
                        </TableCell>
                        <TableCell>
                          {contact.user_name || 'Unknown'}
                          {contact.user_email && ` (${contact.user_email})`}
                        </TableCell>
                        <TableCell>{new Date(contact.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={totalCount}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />

        {/* Match Configuration Dialog */}
        <Dialog open={matchConfigDialogOpen} onClose={handleCloseMatchConfigDialog} maxWidth="sm" fullWidth>
          <DialogTitle>Match New Contacts</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2, mb: 3 }}>
              <Typography variant="body1" gutterBottom>
                Select which users' contacts to match and which target lists to match against.
                Leave both as "All" to match all users against all lists.
              </Typography>
              
              <FormControl fullWidth sx={{ mt: 3, mb: 2 }}>
                <InputLabel id="users-select-label">Users</InputLabel>
                <Select
                  labelId="users-select-label"
                  id="users-select"
                  multiple
                  value={selectedUsers}
                  onChange={handleUserChange}
                  input={<OutlinedInput label="Users" />}
                  renderValue={(selected) => {
                    if (selected.includes('all')) return 'All Users';
                    return selected.length > 1 
                      ? `${selected.length} users selected` 
                      : uniqueUsers.find(u => u.id === selected[0])?.name || selected[0];
                  }}
                >
                  <MenuItem value="all">
                    <Checkbox checked={selectedUsers.includes('all')} />
                    <ListItemText primary="All Users" />
                  </MenuItem>
                  {uniqueUsers.map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      <Checkbox checked={selectedUsers.includes(user.id)} />
                      <ListItemText primary={user.name} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel id="lists-select-label">Target Lists</InputLabel>
                <Select
                  labelId="lists-select-label"
                  id="lists-select"
                  multiple
                  value={selectedLists}
                  onChange={handleListChange}
                  input={<OutlinedInput label="Target Lists" />}
                  renderValue={(selected) => {
                    if (selected.includes('all')) return 'All Lists';
                    return selected.length > 1 
                      ? `${selected.length} lists selected` 
                      : targetLists.find(l => l.id === selected[0])?.name || selected[0];
                  }}
                >
                  <MenuItem value="all">
                    <Checkbox checked={selectedLists.includes('all')} />
                    <ListItemText primary="All Lists" />
                  </MenuItem>
                  {targetLists.map((list) => (
                    <MenuItem key={list.id} value={list.id}>
                      <Checkbox checked={selectedLists.includes(list.id)} />
                      <ListItemText primary={list.name} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseMatchConfigDialog}>Cancel</Button>
            <Button 
              onClick={handleMatchNewContacts}
              variant="contained"
              color="primary"
              disabled={matching}
            >
              {matching ? 'Matching...' : 'Start Matching'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Matches Dialog */}
        <Dialog 
          open={matchDialogOpen} 
          onClose={handleCloseMatchDialog}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: { maxHeight: '80vh' }
          }}
        >
          <DialogTitle>
            Matches for {selectedContact?.first_name} {selectedContact?.last_name}
          </DialogTitle>
          <DialogContent dividers>
            {selectedContact?.matches?.length ? (
              <TableContainer>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>List ID</TableCell>
                      <TableCell>List Name</TableCell>
                      <TableCell>Voter ID</TableCell>
                      <TableCell>Match Confidence</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedContact.matches.map((match) => (
                      <TableRow key={match.id} hover>
                        <TableCell>{match.target_list_id}</TableCell>
                        <TableCell>{match.target_list_name || 'Unknown List'}</TableCell>
                        <TableCell>
                          <Box>
                            <div>Contact ID: {match.target_contact_id}</div>
                            {match.voter_id && <div>Voter ID: {match.voter_id}</div>}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={match.match_confidence.charAt(0).toUpperCase() + match.match_confidence.slice(1)}
                            size="small"
                            color={
                              match.match_confidence === 'high' ? 'success' : 
                              match.match_confidence === 'medium' ? 'warning' : 'default'
                            }
                            variant="outlined"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box textAlign="center" py={4}>
                <Typography variant="body1" color="textSecondary">
                  No matches found for this contact.
                </Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseMatchDialog} color="primary">
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar for notifications */}
        <Snackbar 
          open={snackbar.open}
          autoHideDuration={snackbar.autoHideDuration}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          sx={{ mt: 6 }}
        >
          <Alert 
            onClose={handleCloseSnackbar} 
            severity={snackbar.severity}
            sx={{ minWidth: 300 }}
            elevation={6}
            variant="filled"
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </>
  );
};

export default SharedContacts;
