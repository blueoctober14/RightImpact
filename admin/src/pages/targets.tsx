import React, { useState, useEffect, useCallback, useRef, ChangeEvent } from 'react';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// Helper function to format dates from UTC to CT
const formatToCT = (dateString: string) => {
  return dayjs.utc(dateString).tz('America/Chicago').format('MMM D, YYYY h:mm A') + ' (CT)';
};
import { 
  Box, 
  Typography, 
  Button, 
  Tabs,
  Grid, 
  Tab, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  TablePagination,
  TextField,
  IconButton,
  InputAdornment,
  Tooltip,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  useTheme,
  styled
} from '@mui/material';
import { 
  Add as AddIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon, 
  Search as SearchIcon,
  Upload as UploadIcon,
  List as ListIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { 
  getTargetLists, 
  getTargetList,
  createTargetList, 
  updateTargetList, 
  deleteTargetList, 
  uploadCSV,
  removeVoters,
  type TargetList,
  type UploadProgressEvent
} from '../services/targetLists';
import { autoMapHeaders } from '../utils/csvFieldMappings';
import Layout from '../components/Layout';

// Interfaces
export interface Contact {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  createdAt: string;
  listId: string;
  customFields?: Record<string, any>;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface TargetList {
  id: number;
  name: string;
  description?: string;
  total_contacts: number;
  imported_contacts: number;
  failed_contacts: number;
  status: string;
  updated_at: string;
  created_at: string;
  file?: File;
}

interface CreateTargetListData {
  name: string;
  description?: string;
  file?: File;
}

interface UpdateTargetListData {
  name: string;
  description?: string;
  file?: File;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// Styled Components
const StyledTab = styled(Tab)(({ theme }) => ({
  textTransform: 'none',
  minWidth: 72,
  fontWeight: theme.typography.fontWeightRegular,
  marginRight: theme.spacing(4),
  '&:hover': {
    color: theme.palette.primary.main,
    opacity: 1,
  },
  '&.Mui-selected': {
    color: theme.palette.primary.main,
    fontWeight: theme.typography.fontWeightMedium,
  },
}));

// Tab Panel Component
const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`targets-tabpanel-${index}`}
    aria-labelledby={`targets-tab-${index}`}
    {...other}
  >
    {value === index && (
      <Box sx={{ pt: 3 }}>
        {children}
      </Box>
    )}
  </div>
);

const a11yProps = (index: number) => ({
  id: `targets-tab-${index}`,
  'aria-controls': `targets-tabpanel-${index}`,
});

// Main Component
const Targets: React.FC = () => {
  // State for UI
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [mapping, setMapping] = useState<Record<string, string>>({
    voter_id: '',
    first_name: '',
    last_name: '',
    city: '',
    state: '',
    zip_code: '',
    cell_1: '',
    cell_2: '',
    cell_3: ''
  });
  
  // State for data
  const [targetLists, setTargetLists] = useState<TargetList[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedList, setSelectedList] = useState<TargetList | null>(null);
  const [selectedListForContacts, setSelectedListForContacts] = useState<TargetList | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [csvData, setCsvData] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [targetListsTempSearch, setTargetListsTempSearch] = useState('');
  const [targetListsSearch, setTargetListsSearch] = useState('');
  const [votersTempSearch, setVotersTempSearch] = useState('');
  const [votersSearchTerm, setVotersSearchTerm] = useState('');
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openDialog, setOpenDialog] = useState(false);
  // Remove targets dialog state
  const [openRemoveDialog, setOpenRemoveDialog] = useState(false);
  const [removeListId, setRemoveListId] = useState<number | ''>('');
  const [removeVoterIdsText, setRemoveVoterIdsText] = useState('');
  const [removeFile, setRemoveFile] = useState<File | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [votersPage, setVotersPage] = useState(0);
  const [votersRowsPerPage, setVotersRowsPerPage] = useState(100);
  const [votersTotalCount, setVotersTotalCount] = useState(0);

  const handleOpenRemoveDialog = () => setOpenRemoveDialog(true);
  const handleCloseRemoveDialog = () => setOpenRemoveDialog(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const theme = useTheme();

  // API functions
  const fetchLists = async (): Promise<TargetList[]> => {
    console.log('Fetching target lists...');
    try {
      const response = await getTargetLists();
      console.log('Fetched lists:', response);
      return response;
    } catch (error) {
      // Don't show an error toast here - it's already handled in getTargetLists
      console.log('Error in fetchLists (handled):', error);
      return [];
    } finally {
      console.log('Finished fetching lists');
    }
  };

  const createList = async (data: { name: string; description: string; file?: File }): Promise<TargetList | null> => {
    try {
      // Create a new object with all required fields for TargetList
      const targetListData = {
        name: data.name,
        description: data.description || '',
        total_contacts: 0,
        imported_contacts: 0,
        failed_contacts: 0,
        status: 'active',
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        file: data.file
      };
      
      const response = await createTargetList(targetListData);
      return response;
    } catch (error) {
      console.error('Error creating target list:', error);
      toast.error('Failed to create target list');
      return null;
    }
  };

  const updateList = async (id: string, data: UpdateTargetListData): Promise<TargetList | null> => {
    try {
      const response = await updateTargetList(id, data);
      return response;
    } catch (error) {
      console.error('Error updating target list:', error);
      toast.error('Failed to update target list');
      return null;
    }
  };

  const deleteList = async (id: string): Promise<boolean> => {
    try {
      await deleteTargetList(id);
      return true;
    } catch (error) {
      console.error('Error deleting target list:', error);
      toast.error('Failed to delete target list');
      return false;
    }
  };

  // Fetch contacts when a list is selected for viewing
  useEffect(() => {
    const fetchContactsForList = async () => {
      if (!selectedListForContacts) {
        setContacts([]);
        setFilteredContacts([]);
        return;
      }
      
      try {
        setLoading(true);
        const listId = selectedListForContacts.id;
        console.log('Fetching contacts for list:', listId);
        
        // Use the API base URL from environment variables and add /api prefix
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
        let apiUrl = `${apiBaseUrl}/api/targets/contacts?list_id=${listId}&limit=${votersRowsPerPage}&offset=${votersPage * votersRowsPerPage}`;
        if (votersSearchTerm) {
          apiUrl += `&search=${encodeURIComponent(votersSearchTerm)}`;
        }
        
        console.log('API URL:', apiUrl);
        
        // Call the API to get contacts for the selected list
        const response = await fetch(apiUrl, {
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Fetched contacts:', data);
        
        if (data.contacts && Array.isArray(data.contacts)) {
          // Map the API response to match the Contact interface
          const mappedContacts = data.contacts.map((contact: any) => ({
            id: contact.id.toString(),
            email: contact.email || '',
            firstName: contact.first_name || '',
            lastName: contact.last_name || '',
            phone: contact.cell_1 || contact.landline_1 || '',
            createdAt: contact.created_at,
            listId: contact.list_id ? contact.list_id.toString() : listId,
            customFields: {
              voterId: contact.voter_id,
              zipCode: contact.zip_code,
              address1: contact.address_1,
              address2: contact.address_2,
              city: contact.city,
              state: contact.state,
              county: contact.county,
              precinct: contact.precinct,
              phone2: contact.cell_2 || '',
              phone3: contact.cell_3 || ''
            }
          }));
          
          setContacts(mappedContacts);
          setFilteredContacts(mappedContacts);
          setVotersTotalCount(data.total_count || data.contacts.length);
        } else {
          console.error('Unexpected response format:', data);
          toast.error('Unexpected response format when loading contacts');
          setContacts([]);
        }
      } catch (error) {
        console.error('Error fetching contacts:', error);
        toast.error(`Failed to load contacts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setContacts([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchContactsForList();
  }, [selectedListForContacts, votersSearchTerm, votersPage, votersRowsPerPage]);

  // Update filtered contacts when contacts or search term changes
  useEffect(() => {
    if (!votersSearchTerm.trim()) {
      setFilteredContacts(contacts);
    } else {
      const searchLower = votersSearchTerm.toLowerCase().trim();
      const filtered = contacts.filter(contact => {
        return (
          (contact.customFields?.voterId || '').toLowerCase().includes(searchLower) ||
          (contact.firstName || '').toLowerCase().includes(searchLower) ||
          (contact.lastName || '').toLowerCase().includes(searchLower) ||
          (contact.customFields?.address1 || '').toLowerCase().includes(searchLower) ||
          (contact.phone || '').replace(/\D/g, '').includes(searchLower.replace(/\D/g, '')) ||
          (contact.customFields?.phone2 || '').replace(/\D/g, '').includes(searchLower.replace(/\D/g, '')) ||
          (contact.customFields?.phone3 || '').replace(/\D/g, '').includes(searchLower.replace(/\D/g, ''))
        );
      });
      setFilteredContacts(filtered);
    }
  }, [contacts, votersSearchTerm]);

  // Fetch target lists on component mount
  useEffect(() => {
    let isMounted = true;
    
    const fetchTargetLists = async (): Promise<void> => {
      console.log('Starting to fetch target lists...');
      if (isMounted) {
        setLoading(true);
      }
      
      try {
        const lists = await fetchLists();
        console.log('Setting target lists:', lists);
        if (isMounted) {
          setTargetLists(lists);
        }
      } catch (error) {
        console.error('Error in fetchTargetLists:', error);
        if (isMounted) {
          setTargetLists([]);
          toast.error('Failed to load target lists. Please try again.');
        }
      } finally {
        if (isMounted) {
          console.log('Setting loading to false');
          setLoading(false);
        }
      }
    };

    fetchTargetLists();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      setSelectedFile(file);
      
      // Always update the selectedList with the file, even if it's null
      setSelectedList(prev => {
        if (!prev) {
          // If no selectedList, create a new one with default values
          return {
            id: '',
            name: file.name.replace(/\.[^/.]+$/, ''), // Remove file extension
            description: `Uploaded from ${file.name}`,
            contactCount: 0,
            status: 'active',
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            file: file
          };
        }
        // Otherwise update the existing selectedList
        return {
          ...prev,
          file: file
        };
      });
      
      parseCSV(file);
    }
  };

  // Parse CSV file
  const parseCSV = (file: File) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        setCsvData(content);
        
        // Parse CSV content
        const lines = content.split('\n');
        if (lines.length > 0) {
          const headers = lines[0].split(',').map(h => h.trim().replace(/[^\w\s]/gi, ''));
          setCsvHeaders(headers);
          
          // Auto-map headers to fields
          const autoMapped = autoMapHeaders(headers);
          
          // Initialize mapping with auto-mapped values
          const initialMapping: Record<string, string> = { ...autoMapped };
          
          // If no voter_id was auto-mapped, use the first column as a fallback
          if (!initialMapping.voter_id && headers.length > 0) {
            initialMapping.voter_id = headers[0];
          }
          
          setMapping(initialMapping);
          
          // Parse rows
          const rows = [];
          for (let i = 1; i < Math.min(10, lines.length); i++) {
            if (!lines[i].trim()) continue;
            const values = lines[i].split(',');
            const row: Record<string, string> = {};
            headers.forEach((header, index) => {
              row[header] = values[index]?.trim() || '';
            });
            rows.push(row);
          }
          setCsvRows(rows);
        }
        
        // Show mapping modal
        setShowMappingModal(true);
      } catch (error) {
        console.error('Error parsing CSV:', error);
        toast.error('Failed to parse CSV file');
      }
    };
    
    reader.readAsText(file);
  };

  // Handle file upload
  const handleFileUpload = async (): Promise<void> => {
    if (!selectedFile) {
      toast.error('Please select a file to upload');
      return;
    }

    if (!selectedList?.name) {
      toast.error('Please enter a list name');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      const result = await uploadCSV({
        file: selectedFile,
        listName: selectedList.name,
        description: selectedList.description || `Uploaded from ${selectedFile.name}`,
        fieldMapping: mapping,
        onProgress: (progress) => setUploadProgress(progress)
      });

      if (result.success && result.list) {
        toast.success('File uploaded successfully');
        
        // Update the target lists
        const lists = await fetchLists();
        setTargetLists(lists);
        
        // Reset states and close dialogs
        setSelectedFile(null);
        setMapping({});
        setShowMappingModal(false);
        setOpenDialog(false);
      } else {
        toast.error(result.message || 'Failed to upload file');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('An error occurred during upload');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Handle mapping confirmation
  const handleConfirmMapping = () => {
    console.log('handleConfirmMapping called');
    console.log('Mapping state:', mapping);
    
    // Check if required fields are mapped (must match backend's required fields)
    const requiredFields = ['voter_id', 'first_name', 'last_name', 'zip_code', 'cell_1'];
    const missingRequired = requiredFields.filter(field => !mapping[field]);
    
    if (missingRequired.length > 0) {
      console.log('Missing required fields:', missingRequired);
      toast.error(`Please map all required fields: ${missingRequired.join(', ')}`);
      return;
    }
    
    if (!selectedFile) {
      console.error('No file selected for upload');
      toast.error('No file selected for upload');
      return;
    }
    
    console.log('Calling handleFileUpload...');
    handleFileUpload().catch(error => {
      console.error('Error in handleFileUpload:', error);
    });
  };

  // Handle dialog open/close
  const handleOpenDialog = (list: TargetList | null = null) => {
    // If no list is provided, initialize with default values for a new list
    const newList = list || {
      id: '',
      name: '',
      description: '',
      contactCount: 0,
      status: 'active',
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    setSelectedList(newList);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setSelectedList(null);
    setOpenDialog(false);
  };

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Handle pagination
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleVotersChangePage = (event: unknown, newPage: number) => {
    setVotersPage(newPage);
  };

  const handleVotersChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setVotersRowsPerPage(parseInt(event.target.value, 10));
    setVotersPage(0);
  };

  // Handle delete list
  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this list?')) {
      try {
        await deleteTargetList(id);
        setTargetLists(targetLists.filter(list => list.id !== id));
        toast.success('List deleted successfully');
      } catch (error) {
        console.error('Error deleting list:', error);
        toast.error('Failed to delete list');
      }
    }
  };

  // Handle save list
  const handleSave = async () => {
    if (!selectedList) return;
    
    try {
      if (selectedList.id) {
        // Update existing list
        const updatedList = await updateList(selectedList.id, {
          name: selectedList.name,
          description: selectedList.description
        });
        
        if (updatedList) {
          setTargetLists(targetLists.map(list => 
            list.id === selectedList.id ? updatedList : list
          ));
          toast.success('List updated successfully');
        }
      } else {
        // Create new list
        const newList = await createList({
          name: selectedList.name,
          description: selectedList.description,
          file: selectedList.file
        });
        
        if (newList) {
          // Update the selectedList with the ID from the server
          const updatedSelectedList = { ...selectedList, id: newList.id };
          setSelectedList(updatedSelectedList);
          
          // Add to target lists
          setTargetLists(prev => [...prev, newList]);
          toast.success('List created successfully');
          
          // If there's a file, show the mapping modal
          if (selectedList.file) {
            setShowMappingModal(true);
          } else {
            handleCloseDialog();
          }
        }
      }
    } catch (error) {
      console.error('Error saving list:', error);
      toast.error('Failed to save list');
    }
  };

  const handleTargetListsSearch = () => {
    setTargetListsSearch(targetListsTempSearch);
  };

  const handleTargetListsKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleTargetListsSearch();
    }
  };

  // Filter target lists based on search term
  const filteredLists = targetLists.filter(list => 
    list.name.toLowerCase().includes(targetListsSearch.toLowerCase()) ||
    (list.description && list.description.toLowerCase().includes(targetListsSearch.toLowerCase()))
  );

  // Get current page rows
  const paginatedLists = filteredLists.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleVotersSearch = () => {
    setVotersSearchTerm(votersTempSearch);
    setVotersPage(0); // Reset to first page on new search
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleVotersSearch();
    }
  };

  return (
    <>
      <Box sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange}
            aria-label="targets tabs"
          >
            <StyledTab label="Target Lists" {...a11yProps(0)} />
            <StyledTab 
              label="Voters" 
              {...a11yProps(1)} 
              disabled={!selectedListForContacts}
            />
          </Tabs>
        </Box>

        {/* Target Lists Tab */}
        <TabPanel value={activeTab} index={0}>
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <TextField
              placeholder="Search lists..."
              variant="outlined"
              size="small"
              value={targetListsTempSearch}
              onChange={(e) => setTargetListsTempSearch(e.target.value)}
              onKeyPress={handleTargetListsKeyPress}
              sx={{ width: '100%', maxWidth: 400 }}
              InputProps={{
                startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={handleTargetListsSearch}>
                      <SearchIcon />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={() => handleOpenDialog()}
              >
                New List
              </Button>
              <Button
                variant="contained"
                color="error"
                startIcon={<DeleteIcon />}
                disabled={targetLists.length === 0}
                onClick={handleOpenRemoveDialog}
              >
                Remove Targets
              </Button>
            </Box>
          </Box>

          <Paper sx={{ width: '100%', overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: 440 }}>
              <Table stickyHeader aria-label="target lists table">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Contacts</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Last Updated</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <CircularProgress size={40} sx={{ mb: 2 }} />
                          <Typography variant="h6" color="textSecondary" gutterBottom>
                            Loading target lists...
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedLists.length > 0 ? (
                      paginatedLists.map((list) => (
                        <TableRow key={list.id} hover>
                          <TableCell>{list.name}</TableCell>
                          <TableCell>{list.description || '-'}</TableCell>
                          <TableCell>{list.total_contacts} (Imported: {list.imported_contacts}, Removed: {list.imported_contacts - list.total_contacts}, Failed: {list.failed_contacts})</TableCell>
                          <TableCell>
                            <Chip 
                              label={list.status} 
                              size="small"
                              color={
                                list.status === 'active' || list.status === 'completed' ? 'success' : 
                                list.status === 'processing' ? 'warning' : 'default'
                              }
                            />
                          </TableCell>
                          <TableCell>
                            {formatToCT(list.updated_at)}
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="View Contacts">
                              <IconButton 
                                size="small" 
                                onClick={() => {
                                  setSelectedListForContacts(list);
                                  setActiveTab(1);
                                }}
                              >
                                <PersonIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit">
                              <IconButton 
                                size="small" 
                                onClick={() => handleOpenDialog(list)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton 
                                size="small" 
                                onClick={() => handleDelete(list.id)}
                                color="error"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <ListIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
                            <Typography variant="h6" color="textSecondary" gutterBottom>
                              {targetListsSearch ? 'No matching lists found' : 'No target lists found'}
                            </Typography>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 2, maxWidth: 400, textAlign: 'center' }}>
                              {targetListsSearch 
                                ? 'Try adjusting your search or clear the search to see all lists.'
                                : 'Get started by uploading your first list of contacts.'}
                            </Typography>
                            {!targetListsSearch && (
                              <Button
                                variant="contained"
                                color="primary"
                                startIcon={<UploadIcon />}
                                onClick={() => fileInputRef.current?.click()}
                                sx={{ mt: 1 }}
                              >
                                Upload Your First List
                              </Button>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={filteredLists.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </Paper>

          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv"
            style={{ display: 'none' }}
          />
        </TabPanel>

        {/* Contacts Tab */}
        <TabPanel value={activeTab} index={1}>
          {selectedListForContacts ? (
            <Box>
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    Voters in {selectedListForContacts.name}
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<ListIcon />}
                    onClick={() => setActiveTab(0)}
                  >
                    Back to Lists
                  </Button>
                </Box>
                <TextField
                  fullWidth
                  variant="outlined"
                  size="small"
                  placeholder="Search by Voter ID, Name, Address, or Phone..."
                  value={votersTempSearch}
                  onChange={(e) => setVotersTempSearch(e.target.value)}
                  onKeyPress={handleKeyPress}
                  sx={{ mb: 2, maxWidth: 500 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={handleVotersSearch}>
                          <SearchIcon />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              </Box>
              
              <Paper sx={{ 
                width: '100%', 
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '70vh'
              }}>
                <TableContainer sx={{ 
                  flex: 1,
                  overflow: 'auto',
                  '&::-webkit-scrollbar': {
                    height: '8px',
                    width: '8px',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    backgroundColor: theme.palette.grey[400],
                    borderRadius: '4px',
                  },
                  '&::-webkit-scrollbar-track': {
                    backgroundColor: theme.palette.grey[100],
                  },
                }}>
                  <Table stickyHeader size="small" sx={{ minWidth: '1200px' }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Voter ID</TableCell>
                        <TableCell>First Name</TableCell>
                        <TableCell>Last Name</TableCell>
                        <TableCell>Address 1</TableCell>
                        <TableCell>Address 2</TableCell>
                        <TableCell>City</TableCell>
                        <TableCell>State</TableCell>
                        <TableCell>ZIP</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Phone 1</TableCell>
                        <TableCell>Phone 2</TableCell>
                        <TableCell>Phone 3</TableCell>
                        <TableCell>Added On</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredContacts.length > 0 ? (
                        filteredContacts.map((contact) => (
                          <TableRow key={contact.id} hover>
                            <TableCell>{contact.customFields?.voterId || '-'}</TableCell>
                            <TableCell>{contact.firstName || '-'}</TableCell>
                            <TableCell>{contact.lastName || '-'}</TableCell>
                            <TableCell>{contact.customFields?.address1 || '-'}</TableCell>
                            <TableCell>{contact.customFields?.address2 || '-'}</TableCell>
                            <TableCell>{contact.customFields?.city || '-'}</TableCell>
                            <TableCell>{contact.customFields?.state || '-'}</TableCell>
                            <TableCell>{contact.customFields?.zipCode || '-'}</TableCell>
                            <TableCell>{contact.email || '-'}</TableCell>
                            <TableCell>{contact.phone || '-'}</TableCell>
                            <TableCell>{contact.customFields?.phone2 || '-'}</TableCell>
                            <TableCell>{contact.customFields?.phone3 || '-'}</TableCell>
                            <TableCell>
                              {contact.createdAt ? new Date(contact.createdAt).toLocaleDateString() : '-'}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={13} align="center" sx={{ py: 3 }}>
                            <Typography variant="body2" color="textSecondary">
                              {votersSearchTerm ? 'No matching contacts found' : 'No contacts found in this list'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  rowsPerPageOptions={[25, 50, 100, 250]}
                  component="div"
                  count={votersTotalCount}
                  rowsPerPage={votersRowsPerPage}
                  page={votersPage}
                  onPageChange={handleVotersChangePage}
                  onRowsPerPageChange={handleVotersChangeRowsPerPage}
                />
              </Paper>
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                No list selected
              </Typography>
              <Button
                variant="outlined"
                startIcon={<ListIcon />}
                onClick={() => setActiveTab(0)}
              >
                Back to Lists
              </Button>
            </Box>
          )}
        </TabPanel>

        {/* Upload Progress Dialog */}
        <Dialog open={showProgress} onClose={() => {}} maxWidth="sm" fullWidth>
          <DialogTitle>Uploading File</DialogTitle>
          <DialogContent>
            <Box sx={{ width: '100%', py: 2 }}>
              <LinearProgress 
                variant="determinate" 
                value={uploadProgress} 
                sx={{ mb: 2, height: 8, borderRadius: 4 }}
              />
              <Typography variant="body2" color="textSecondary" align="center">
                {uploadProgress}% Complete
              </Typography>
            </Box>
          </DialogContent>
        </Dialog>

        {/* Mapping Dialog */}
        <Dialog 
          open={showMappingModal} 
          onClose={() => setShowMappingModal(false)} 
          maxWidth="md" 
          fullWidth
        >
          <DialogTitle>Map CSV Columns</DialogTitle>
          <DialogContent>
            <Typography variant="subtitle2" color="textSecondary" gutterBottom>
              Please map the CSV columns to the corresponding contact fields.
            </Typography>
            
            <Grid container spacing={2} sx={{ mt: 2 }}>
              {/* Left Column */}
              <Grid item xs={6}>
                <TableContainer component={Paper} variant="outlined" sx={{ height: '100%' }}>
                  <Table size="small">
                    <TableBody>
                      {Object.entries({
                        voter_id: 'Voter ID',
                        first_name: 'First Name',
                        last_name: 'Last Name',
                        address_1: 'Address 1',
                        address_2: 'Address 2',
                        city: 'City'
                      }).map(([key, label]) => {
                        const isRequired = ['voter_id', 'first_name', 'last_name'].includes(key);
                        return (
                          <TableRow key={key}>
                            <TableCell component="th" scope="row" sx={{ border: 'none', p: 1 }}>
                              {label} {isRequired && <span style={{ color: 'red' }}>*</span>}
                            </TableCell>
                            <TableCell sx={{ border: 'none', p: 1 }}>
                              <FormControl fullWidth size="small" sx={{ minWidth: 150 }}>
                                <Select
                                  value={mapping[key] || ''}
                                  onChange={(e) => setMapping({ ...mapping, [key]: e.target.value })}
                                  displayEmpty
                                  required={isRequired}
                                >
                                  <MenuItem value="">
                                    <em>Select column</em>
                                  </MenuItem>
                                  {csvHeaders.map((header) => (
                                    <MenuItem key={header} value={header}>
                                      {header}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
              
              {/* Right Column */}
              <Grid item xs={6}>
                <TableContainer component={Paper} variant="outlined" sx={{ height: '100%' }}>
                  <Table size="small">
                    <TableBody>
                      {Object.entries({
                        state: 'State',
                        zip_code: 'ZIP',
                        email: 'Email',
                        cell_1: 'Phone 1',
                        cell_2: 'Phone 2',
                        cell_3: 'Phone 3'
                      }).map(([key, label]) => {
                        const isRequired = ['zip_code', 'cell_1'].includes(key);
                        const isPhone1 = key === 'cell_1';
                        
                        return (
                          <TableRow key={key}>
                            <TableCell component="th" scope="row" sx={{ border: 'none', p: 1 }}>
                              {label} {isRequired && <span style={{ color: 'red' }}>*</span>}
                              {isPhone1 && (
                                <Typography variant="caption" color="error" display="block" sx={{ fontSize: '0.7rem' }}>
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell sx={{ border: 'none', p: 1 }}>
                              <FormControl fullWidth size="small" sx={{ minWidth: 150 }}>
                                <Select
                                  value={mapping[key] || ''}
                                  onChange={(e) => setMapping({ ...mapping, [key]: e.target.value })}
                                  displayEmpty
                                  required={isRequired}
                                >
                                  <MenuItem value="">
                                    <em>Select column</em>
                                  </MenuItem>
                                  {csvHeaders.map((header) => (
                                    <MenuItem key={header} value={header}>
                                      {header}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>

            {/* CSV Preview */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Preview (first 10 rows)
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, maxHeight: 200, overflow: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {Object.entries(mapping)
                        .filter(([_, value]) => value)
                        .map(([key, header]) => (
                          <TableCell key={key}>
                            <strong>{key}</strong>
                          </TableCell>
                        ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {csvRows.slice(0, 10).map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {Object.entries(mapping)
                          .filter(([_, header]) => header)
                          .map(([key, header]) => (
                            <TableCell key={key}>
                              {row[header as string] || '-'}
                            </TableCell>
                          ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button 
              onClick={() => setShowMappingModal(false)}
              color="inherit"
            >
              Cancel
            </Button>
            <Button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Upload button clicked');
                handleConfirmMapping();
              }}
              variant="contained"
              disabled={isUploading || !mapping.voter_id || !mapping.first_name || !mapping.last_name || !mapping.zip_code || !mapping.cell_1}
              startIcon={isUploading ? <CircularProgress size={20} /> : null}
            >
              {isUploading ? 'Uploading...' : 'Confirm & Upload'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Create/Edit List Dialog */}
        <Dialog 
          open={openDialog} 
          onClose={handleCloseDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {selectedList?.id ? 'Edit Target List' : 'Create New Target List'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              {selectedList && (
                <>
                  <TextField
                    label="List Name"
                    fullWidth
                    margin="normal"
                    value={selectedList.name}
                    onChange={(e) => 
                      setSelectedList({ ...selectedList, name: e.target.value })
                    }
                    required
                  />
                  <TextField
                    label="Description"
                    fullWidth
                    margin="normal"
                    multiline
                    rows={3}
                    value={selectedList.description || ''}
                    onChange={(e) => 
                      setSelectedList({ ...selectedList, description: e.target.value })
                    }
                  />
                </>
              )}
              
              {selectedList && !selectedList.id && (
                <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Import Voters <span style={{ color: 'red' }}>*</span>
                  </Typography>
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<UploadIcon />}
                    sx={{ mt: 1 }}
                  >
                    Upload CSV File
                    <input
                      type="file"
                      hidden
                      accept=".csv"
                      onChange={handleFileChange}
                    />
                  </Button>
                  <Typography variant="caption" display="block" color="textSecondary" sx={{ mt: 1 }}>
                    Upload a CSV file with your contacts (optional)
                  </Typography>
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={handleCloseDialog} color="inherit">
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              variant="contained"
              disabled={!selectedList?.name || (!selectedList?.id && !selectedFile)}
            >
              {selectedList?.id ? 'Update List' : 'Create List'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Remove Targets Dialog */}
        <Dialog open={openRemoveDialog} onClose={() => setOpenRemoveDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Remove Targets</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <FormControl fullWidth>
              <InputLabel id="remove-list-label">Select List</InputLabel>
              <Select
                labelId="remove-list-label"
                value={removeListId}
                label="Select List"
                onChange={(e) => setRemoveListId(e.target.value as any)}
              >
                <MenuItem value="">All Lists</MenuItem>
                {targetLists.map((list) => (
                  <MenuItem key={list.id} value={list.id}>{list.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Voter IDs (one per line or comma separated)"
              multiline
              minRows={4}
              value={removeVoterIdsText}
              onChange={(e) => setRemoveVoterIdsText(e.target.value)}
            />

            <Button variant="outlined" component="label" startIcon={<UploadIcon />}>
              {removeFile ? removeFile.name : 'Upload CSV'}
              <input
                type="file"
                accept=".csv,text/plain"
                hidden
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setRemoveFile(e.target.files[0]);
                  }
                }}
              />
            </Button>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setOpenRemoveDialog(false)} color="inherit">
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              disabled={removeLoading || (!removeVoterIdsText && !removeFile)}
              onClick={async () => {
                try {
                  setRemoveLoading(true);
                  const result = await removeVoters({
                    listId: removeListId === '' ? null : (removeListId as number),
                    voterIdsText: removeVoterIdsText,
                    file: removeFile,
                  });
                  toast.success(`${result.deleted} of ${result.voter_ids_count} voters removed`);
                  // Refresh lists
                  const lists = await fetchLists();
                  setTargetLists(lists);
                  setOpenRemoveDialog(false);
                  // reset fields
                  setRemoveListId('');
                  setRemoveVoterIdsText('');
                  setRemoveFile(null);
                } catch (err) {
                  console.error(err);
                  toast.error('Failed to remove voters');
                } finally {
                  setRemoveLoading(false);
                }
              }}
            >
              {removeLoading ? <CircularProgress size={24} /> : 'Remove'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </>
  );
};

export default Targets;