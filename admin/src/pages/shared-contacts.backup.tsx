import React, { useState, useEffect, useMemo } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
  Checkbox,
  ListItemText,
  IconButton,
  Tooltip,
  TableSortLabel,
} from '@mui/material';
import { 
  Search as SearchIcon, 
  Refresh as RefreshIcon,
  Info as InfoIcon,
  FilterList as FilterListIcon,
  ViewColumn as ViewColumnIcon,
  Clear as ClearIcon,
  FileDownload as FileDownloadIcon,
  ArrowUpward,
  ArrowDownward
} from '@mui/icons-material';
import Layout from '../components/Layout';
import ExportButton from '../components/ExportButton';
import api from '../services/api';

type SortableField = 'id' | 'first_name' | 'last_name' | 'company' | 'email' | 'created_at' | 'user_name' | 'user_email';
type SortDirection = 'asc' | 'desc';

type MatchStatusFilter = 'all' | 'matched' | 'unmatched';

interface ColumnVisibility {
  [key: string]: boolean;
  company: boolean;
  phone2: boolean;
  phone3: boolean;
}

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

const SharedContacts: React.FC = () => {
  const [contacts, setContacts] = useState<SharedContact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [matching, setMatching] = useState<boolean>(false);
  const [matchDialogOpen, setMatchDialogOpen] = useState<boolean>(false);
  const [selectedContact, setSelectedContact] = useState<SharedContact | null>(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'warning' | 'info'
  });
  // State for sorting and filtering
  const [orderBy, setOrderBy] = useState<SortableField>('created_at');
  const [order, setOrder] = useState<SortDirection>('desc');
  
  // Filter states
  const [matchStatus, setMatchStatus] = useState<MatchStatusFilter>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
    company: false,
    phone2: false,
    phone3: false,
  });
  
  // Menu states
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);
  const [columnAnchorEl, setColumnAnchorEl] = useState<null | HTMLElement>(null);
  
  const filterMenuOpen = Boolean(filterAnchorEl);
  const columnMenuOpen = Boolean(columnAnchorEl);
  
  // Get unique users for filter
  const uniqueUsers = useMemo(() => {
    const users = new Map<string, string>();
    contacts.forEach(contact => {
      if (contact.user_id) {
        users.set(
          contact.user_id.toString(), 
          contact.user_name || contact.user_email || `User ${contact.user_id}`
        );
      }
    });
    return Array.from(users.entries()).map(([id, name]) => ({
      id,
      name: name || `User ${id}`
    }));
  }, [contacts]);
  
  // Reset pagination when filters change
  useEffect(() => {
    setPage(0);
  }, [matchStatus, selectedUser, searchTerm]);
  
  // Handle filter menu
  const handleFilterMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setFilterAnchorEl(event.currentTarget);
  };
  
  const handleFilterMenuClose = () => {
    setFilterAnchorEl(null);
  };
  
  // Handle column menu
  const handleColumnMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setColumnAnchorEl(event.currentTarget);
  };
  
  const handleColumnMenuClose = () => {
    setColumnAnchorEl(null);
  };
  
  // Handle column visibility toggle
  const handleColumnVisibilityToggle = (column: keyof ColumnVisibility) => {
    setColumnVisibility(prev => ({
      ...prev,
      [column]: !prev[column]
    }));
  };
  
  // Clear all filters
  const clearFilters = () => {
    setMatchStatus('all');
    setSelectedUser('all');
    setSearchTerm('');
  };
  
  // Check if any filter is active
  const isFilterActive = matchStatus !== 'all' || selectedUser !== 'all' || searchTerm !== '';

  // Get the currently displayed contacts for export
  const getExportData = async () => {
    try {
      // Get the IDs of all filtered contacts
      const contactIds = filteredContacts.map(contact => contact.id);
      
      if (contactIds.length === 0) {
        setSnackbar({
          open: true,
          message: 'No contacts to export',
          severity: 'warning'
        });
        return [];
      }
      
      // Fetch contacts with their matches
      const contactsWithMatches = await fetchContactsWithMatches(contactIds);
      
      // Prepare data for export
      return prepareExportData(contactsWithMatches, columnVisibility);
      
    } catch (error) {
      console.error('Error preparing export data:', error);
      setSnackbar({
        open: true,
        message: 'Failed to prepare export data',
        severity: 'error'
      });
      return [];
    }
  };

  // Fetch shared contacts from API
  useEffect(() => {
    const fetchSharedContacts = async () => {
      try {
        setLoading(true);
        const response = await api.get('/contacts/shared');
        setContacts(response.data);
      } catch (error) {
        console.error('Error fetching contacts:', error);
        setSnackbar({
          open: true,
          message: 'Failed to load shared contacts',
          severity: 'error'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSharedContacts();
  }, []);

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
            {order === 'desc' ? <ArrowDownward fontSize="small" /> : <ArrowUpward fontSize="small" />}
          </Box>
        )}
      </Box>
    </TableCell>
  );

  const handleSort = (property: SortableField) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

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

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Handle sorting
  const handleSort = (property: SortableField) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

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

  // Get paginated contacts
  const paginatedContacts = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return sortedContacts.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedContacts, page, rowsPerPage]);

  return (
    <Layout>
      <Box sx={{ width: '100%', p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Shared Contacts
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleMatchNewContacts}
              disabled={matching}
              startIcon={matching ? <CircularProgress size={20} /> : <RefreshIcon />}
            >
              {matching ? 'Matching...' : 'Match New'}
            </Button>
            <ExportButton
              getData={getExportData}
              fileName="shared_contacts"
              buttonText="Export"
              buttonProps={{
                variant: 'outlined',
                startIcon: <FileDownloadIcon />,
              }}
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
            <Tooltip title="Column visibility">
              <IconButton
                onClick={handleColumnMenuOpen}
                sx={{ border: '1px solid', borderColor: 'divider' }}
              >
                <ViewColumnIcon />
              </IconButton>
            </Tooltip>
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
              placeholder="Search contacts..."
              variant="outlined"
              size="small"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
              }}
              sx={{ minWidth: 250 }}
            />
          </Box>
        </Box>

        <Paper sx={{ width: '100%', mb: 2, overflow: 'hidden' }}>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 200px)' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <SortableHeader id="id" label="ID" />
                  <SortableHeader id="first_name" label="First Name" />
                  <SortableHeader id="last_name" label="Last Name" />
                  {columnVisibility.company && (
                    <SortableHeader id="company" label="Company" />
                  )}
                  <SortableHeader id="email" label="Email" />
                  <TableCell>Phone 1</TableCell>
                  {columnVisibility.phone2 && <TableCell>Phone 2</TableCell>}
                  {columnVisibility.phone3 && <TableCell>Phone 3</TableCell>}
                  <TableCell>Address</TableCell>
                  <TableCell>City</TableCell>
                  <TableCell>State</TableCell>
                  <TableCell>ZIP</TableCell>
                  <SortableHeader id="user_name" label="Shared By" />
                  <SortableHeader id="created_at" label="Date Shared" />
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={15} align="center" sx={{ py: 4 }}>
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : paginatedContacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={15} align="center" sx={{ py: 4 }}>
                      <Typography variant="body1" color="textSecondary">
                        {searchTerm || isFilterActive
                          ? 'No contacts match your search criteria'
                          : 'No shared contacts found'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedContacts.map((contact) => (
                    <TableRow key={contact.id} hover>
                      <TableCell>{contact.id}</TableCell>
                      <TableCell>{contact.first_name || '-'}</TableCell>
                      <TableCell>{contact.last_name || '-'}</TableCell>
                      {columnVisibility.company && (
                        <TableCell>{contact.company || '-'}</TableCell>
                      )}
                      <TableCell>{contact.email || '-'}</TableCell>
                      <TableCell>{contact.mobile_numbers?.[0] || '-'}</TableCell>
                      {columnVisibility.phone2 && (
                        <TableCell>{contact.mobile_numbers?.[1] || '-'}</TableCell>
                      )}
                      {columnVisibility.phone3 && (
                        <TableCell>{contact.mobile_numbers?.[2] || '-'}</TableCell>
                      )}
                      <TableCell>{contact.address?.street || '-'}</TableCell>
                      <TableCell>{contact.address?.city || '-'}</TableCell>
                      <TableCell>{contact.address?.state || '-'}</TableCell>
                      <TableCell>{contact.address?.zip || '-'}</TableCell>
                      <TableCell>
                        {contact.user_name || contact.user_email || `User ${contact.user_id}`}
                      </TableCell>
                      <TableCell>
                        {new Date(contact.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Tooltip title="View matches">
                          <IconButton
                            size="small"
                            onClick={() => handleViewMatches(contact)}
                            disabled={contact.match_count === 0}
                          >
                            <InfoIcon
                              color={contact.match_count > 0 ? 'primary' : 'disabled'}
                              fontSize="small"
                            />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={filteredContacts.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>

        {/* Match Details Dialog */}
        <Dialog
          open={matchDialogOpen}
          onClose={handleCloseMatchDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Match Details</DialogTitle>
          <DialogContent>
            {selectedContact && selectedContact.matches ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>List Name</TableCell>
                      <TableCell>Match Confidence</TableCell>
                      <TableCell>Matched Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedContact.matches.map((match) => (
                      <TableRow key={match.id}>
                        <TableCell>{match.target_list_name || 'Unknown List'}</TableCell>
                        <TableCell>
                          <Chip
                            label={match.match_confidence}
                            color={
                              match.match_confidence === 'high'
                                ? 'success'
                                : match.match_confidence === 'medium'
                                ? 'warning'
                                : 'default'
                            }
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {new Date(match.created_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress />
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
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={handleCloseSnackbar}
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Layout>
  );
};

export default SharedContacts;
      ) : (
        label
      )}
    </TableCell>
  );

  // Filtering and sorting is now handled by the API
  const filteredContacts = contacts;

  // Calculate pagination
  const startIndex = page * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedContacts = filteredContacts;

  return (
    <>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Shared Contacts
          </Typography>
          <TextField
            placeholder="Search contacts..."
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
            }}
          />
        </Box>

        <Paper sx={{ width: '100%', mb: 2 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <SortableHeader id="id" label="ID" />
                  <SortableHeader id="first_name" label="First Name" />
                  <SortableHeader id="last_name" label="Last Name" />
                  <SortableHeader id="company" label="Company" />
                  <SortableHeader id="email" label="Email" />
                  <TableCell>Phone 1</TableCell>
                  <TableCell>Phone 2</TableCell>
                  <TableCell>Phone 3</TableCell>
                  <TableCell>Address</TableCell>
                  <TableCell>City</TableCell>
                  <TableCell>State</TableCell>
                  <TableCell>ZIP</TableCell>
                  <SortableHeader id="user_name" label="Shared By" />
                  <SortableHeader id="created_at" label="Date Shared" />
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : paginatedContacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      {searchTerm ? 'No matching contacts found' : 'No shared contacts available'}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedContacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>{contact.id}</TableCell>
                      <TableCell>{contact.first_name || ''}</TableCell>
                      <TableCell>{contact.last_name || ''}</TableCell>
                      <TableCell>{contact.company || ''}</TableCell>
                      <TableCell>{contact.email || ''}</TableCell>
                      <TableCell>{contact.mobile_numbers?.[0] || ''}</TableCell>
                      <TableCell>{contact.mobile_numbers?.[1] || ''}</TableCell>
                      <TableCell>{contact.mobile_numbers?.[2] || ''}</TableCell>
                      <TableCell>{contact.address?.street || ''}</TableCell>
                      <TableCell>{contact.address?.city || ''}</TableCell>
                      <TableCell>{contact.address?.state || ''}</TableCell>
                      <TableCell>{contact.address?.zip || ''}</TableCell>
                      <TableCell>
                        {contact.user_name || contact.user_email || ''}
                      </TableCell>
                      <TableCell>
                        {new Date(contact.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={filteredContacts.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>
    </>
  );
};

export default SharedContacts;
