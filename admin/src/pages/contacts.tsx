import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Input,
  CircularProgress,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useState } from 'react';

const ContactsPage = () => {
  const [contacts, setContacts] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    city: '',
    state: '',
    zipCode: '',
  });
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState(null);

  // Fetch contacts from API
  const fetchContacts = async () => {
    // Simulated data
    setContacts([
      {
        id: 1,
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: '+1234567890',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        assignedTo: 'John Doe',
        lastMessaged: '2025-05-22T11:00:00Z',
      },
      // Add more simulated contacts
    ]);
  };

  const handleEdit = (contact) => {
    setSelectedContact(contact);
    setFormData({
      firstName: contact.firstName,
      lastName: contact.lastName,
      phoneNumber: contact.phoneNumber,
      city: contact.city,
      state: contact.state,
      zipCode: contact.zipCode,
    });
    setOpenDialog(true);
  };

  const handleDelete = (contactId) => {
    // Implement delete logic
    const updatedContacts = contacts.filter((contact) => contact.id !== contactId);
    setContacts(updatedContacts);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setImporting(true);
      try {
        // Implement import logic
        setFile(file);
      } catch (error) {
        console.error('Import failed:', error);
      } finally {
        setImporting(false);
      }
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">Contacts</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setSelectedContact(null);
              setFormData({
                firstName: '',
                lastName: '',
                phoneNumber: '',
                city: '',
                state: '',
                zipCode: '',
              });
              setOpenDialog(true);
            }}
          >
            Add Contact
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            component="label"
            disabled={importing}
          >
            Import CSV
            <input
              type="file"
              hidden
              accept=".csv"
              onChange={handleImport}
            />
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => {
              // Implement export logic
            }}
          >
            Export CSV
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: 2 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>First Name</TableCell>
                <TableCell>Last Name</TableCell>
                <TableCell>Phone Number</TableCell>
                <TableCell>City</TableCell>
                <TableCell>State</TableCell>
                <TableCell>Zip Code</TableCell>
                <TableCell>Assigned To</TableCell>
                <TableCell>Last Messaged</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>{contact.firstName}</TableCell>
                  <TableCell>{contact.lastName}</TableCell>
                  <TableCell>{contact.phoneNumber}</TableCell>
                  <TableCell>{contact.city}</TableCell>
                  <TableCell>{contact.state}</TableCell>
                  <TableCell>{contact.zipCode}</TableCell>
                  <TableCell>{contact.assignedTo}</TableCell>
                  <TableCell>{contact.lastMessaged ? new Date(contact.lastMessaged).toLocaleString() : '-'}</TableCell>
                  <TableCell>
                    <IconButton onClick={() => handleEdit(contact)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton onClick={() => handleDelete(contact.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>{selectedContact ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="First Name"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              fullWidth
            />
            <TextField
              label="Last Name"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              fullWidth
            />
            <TextField
              label="Phone Number"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              fullWidth
            />
            <TextField
              label="City"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              fullWidth
            />
            <TextField
              label="State"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              fullWidth
            />
            <TextField
              label="Zip Code"
              value={formData.zipCode}
              onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button
            onClick={() => {
              // Implement save logic
              setOpenDialog(false);
            }}
            variant="contained"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ContactsPage;
