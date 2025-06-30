import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Snackbar,
  Alert,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { getGroups, createGroup, deleteGroup, getGroupUsers, getGroupUserCounts, Group } from '../services/groups';

interface GroupWithUserCount extends Group {
  userCount?: number;
}

const Groups: React.FC = () => {
  const [groups, setGroups] = useState<GroupWithUserCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingUserCounts, setLoadingUserCounts] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<GroupWithUserCount | null>(null);

  // Helper: Batch fetch user counts for all groups
  const fetchUserCountsBatch = async (groupsData: GroupWithUserCount[]) => {
    setLoadingUserCounts(true);
    try {
      const counts = await getGroupUserCounts();
      // Map: group_id -> user_count
      const countMap = new Map(counts.map(({ group_id, user_count }) => [group_id, user_count]));
      setGroups(groupsData.map(g => ({ ...g, userCount: countMap.get(g.id) || 0 })));
    } catch (err) {
      setError('Failed to load group user counts');
      console.error('Error fetching group user counts:', err);
    } finally {
      setLoadingUserCounts(false);
    }
  };

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const data = await getGroups();
      setGroups(data);
      setError(null); // Clear any previous errors
      
      // After loading groups, fetch user counts for each group
      await fetchUserCountsBatch(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load groups';
      setError(message);
      console.error('Error fetching groups:', err);
      // Initialize with empty array if there's an error
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };
  


  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      setError('Group name cannot be empty');
      return;
    }

    try {
      await createGroup(newGroupName.trim());
      setNewGroupName('');
      setOpenDialog(false);
      setSuccess('Group created successfully');
      fetchGroups();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create group';
      setError(message);
      console.error('Error creating group:', err);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deletingGroup) return;

    try {
      await deleteGroup(deletingGroup.id);
      setSuccess('Group deleted successfully');
      setDeletingGroup(null);
      fetchGroups();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete group';
      setError(message);
      console.error('Error deleting group:', err);
    }
  };

  const handleCloseError = () => {
    setError(null);
  };

  const handleCloseSuccess = () => {
    setSuccess(null);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Groups
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
        >
          New Group
        </Button>
      </Box>

      <Card>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : groups.length === 0 ? (
            <Box textAlign="center" p={4}>
              <Typography variant="body1" color="textSecondary" gutterBottom>
                No groups found.
              </Typography>
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={() => setOpenDialog(true)}
              >
                Create Your First Group
              </Button>
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Group Name</TableCell>
                    <TableCell align="right">Users</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {groups.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell>{group.name}</TableCell>
                      <TableCell align="right">{group.userCount || 0}</TableCell>
                      <TableCell align="right">
                        <span>
                        <IconButton
                          onClick={() => setDeletingGroup(group)}
                          color="error"
                          size="small"
                          disabled={!!(group.userCount && group.userCount > 0)}
                          title={
                            group.userCount && group.userCount > 0
                              ? 'Cannot delete group with users'
                              : 'Delete group'
                          }
                        >
                          <DeleteIcon />
                        </IconButton>
                      </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Create Group Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Group</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Group Name"
            fullWidth
            variant="outlined"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreateGroup()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateGroup} color="primary" variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deletingGroup}
        onClose={() => setDeletingGroup(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Group</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the group "{deletingGroup?.name}"?
          </Typography>
          {deletingGroup?.userCount && deletingGroup.userCount > 0 && (
            <Typography color="error" variant="body2" mt={2}>
              Warning: This group has {deletingGroup.userCount} user(s).
              Deleting it will remove all user associations with this group.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletingGroup(null)}>Cancel</Button>
          <Button onClick={handleDeleteGroup} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error Snackbar */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={handleCloseError}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseError} severity="error">
          {error}
        </Alert>
      </Snackbar>

      {/* Success Snackbar */}
      <Snackbar
        open={!!success}
        autoHideDuration={3000}
        onClose={handleCloseSuccess}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSuccess} severity="success">
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// Disable static generation for this page
// This ensures the page is rendered on the client side
export const getServerSideProps = async () => {
  return {
    props: {}, // Will be passed to the page component as props
  };
};

export default Groups;
