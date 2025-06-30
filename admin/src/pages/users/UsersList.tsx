import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  IconButton,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar,
  Alert,
  TablePagination,
  Chip,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { Group, User } from '../../types';
import { getGroups } from '../../services/groups';
import { getUsers, deleteUser, createUser, updateUser, UserRole } from '../../services/users';
import dynamic from 'next/dynamic';

// Dynamically import UserForm with no SSR to avoid window is not defined errors
const UserForm = dynamic(() => import('./UserForm'), { ssr: false });

// Current user - in a real app, this would come from your auth context
const currentUser = {
  id: 1,
  email: 'admin@admin.com',
  first_name: 'Admin',
  last_name: 'User',
  role: 'admin',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as User;

const UsersList: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (e) {
      return 'N/A';
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      // Force a small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 300));
      const [usersData, groupsData] = await Promise.all([
        getUsers(),
        getGroups(),
      ]);
      setUsers(usersData);
      setGroups(groupsData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(message);
      console.error('Error in fetchData:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateUser = () => {
    setEditingUser(null);
    setOpenDialog(true);
  };

  const handleSubmit = async (userData: Omit<User, 'id' | 'created_at' | 'updated_at'> & { password?: string }) => {
    try {
      if (editingUser) {
        await updateUser(editingUser.id, userData);
        setSuccess('User updated successfully');
        await fetchData();
      } else {
        await createUser({
          ...userData,
          password: userData.password || 'defaultPassword'
        });
        setSuccess('User created successfully');
        await fetchData();
      }
      setOpenDialog(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setOpenDialog(true);
  };

  const handleDeleteClick = (userId: number) => {
    setDeletingUserId(userId);
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      await deleteUser(userId);
      setSuccess('User deleted successfully');
      setDeletingUserId(null);
      fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete user';
      setError(message);
    }
  };

  const confirmDelete = async () => {
    if (!deletingUserId) return;
    
    try {
      await deleteUser(deletingUserId);
      setSuccess('User deleted successfully');
      fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete user';
      setError(message);
      console.error('Error deleting user:', err);
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingUser(null);
  };

  const handleError = (message: string) => {
    setError(message);
  };

  const handleCloseError = () => {
    setError(null);
  };

  const handleCloseSuccess = () => {
    setSuccess(null);
  };

  const handleChangePage = (event: React.MouseEvent<HTMLButtonElement> | null, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Avoid a layout jump when reaching the last page with empty rows.
  const emptyRows = page > 0 ? Math.max(0, (1 + page) * rowsPerPage - users.length) : 0;
  
  // Get the current page of users
  const currentUsers = users.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );



  // Helper to safely get user role with default
  const getUserRole = (role?: UserRole): UserRole => {
    return role === 'admin' ? 'admin' : 'user';
  };

  const getStatusChip = (isActive?: boolean) => {
    const active = isActive !== false; // Default to true if undefined
    return (
      <Chip
        label={active ? 'Active' : 'Inactive'}
        color={active ? 'success' : 'default'}
        size="small"
      />
    );
  };

  return (
    <Box sx={{ width: '100%', mt: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" component="h1">
          Users
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleCreateUser}
          disabled={loading}
        >
          Add User
        </Button>
      </Box>

      {/* Error and Success Messages */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={handleCloseError}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={handleCloseSuccess}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSuccess} severity="success" sx={{ width: '100%' }}>
          {success}
        </Alert>
      </Snackbar>

      {/* Users Table */}
      <Paper sx={{ width: '100%', mb: 2 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Groups</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Shared Contacts</TableCell>
                <TableCell>Zip Code</TableCell>
                <TableCell>Max Neighbor Messages</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 3 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 3 }}>
                    <Typography>No users found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                currentUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.id}</TableCell>
                    <TableCell>{`${user.first_name || ''} ${user.last_name || ''}`.trim() || 'No name'}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Chip
                        label={getUserRole(user.role)}
                        color={getUserRole(user.role) === 'admin' ? 'primary' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {user.groups && user.groups.length > 0
                        ? user.groups.map((g: any) => g.name).join(', ')
                        : 'None'}
                    </TableCell>
                    <TableCell>
                      {getStatusChip(user.is_active)}
                    </TableCell>
                    <TableCell>
                      {user.has_shared_contacts ? 'Yes' : 'No'}
                    </TableCell>
                    <TableCell>
                      {user.zip_code}
                    </TableCell>
                    <TableCell>
                      {user.max_neighbor_messages || 'No limit'}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton
                          onClick={() => handleEditUser(user)}
                          size="small"
                          color="primary"
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          onClick={() => handleDeleteClick(user.id)}
                          size="small"
                          color="error"
                          disabled={user.id === currentUser.id}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
              {emptyRows > 0 && (
                <TableRow style={{ height: 53 * emptyRows }}>
                  <TableCell colSpan={11} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={users.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* User Form Dialog */}
      <UserForm
        open={openDialog}
        onClose={handleCloseDialog}
        user={editingUser}
        groups={groups}
        currentUserRole={currentUser.role}
        onSuccess={(message) => {
          setSuccess(message);
          setOpenDialog(false);
          fetchData();
        }}
        onError={handleError}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deletingUserId}
        onClose={() => setDeletingUserId(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this user? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletingUserId(null)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsersList;
