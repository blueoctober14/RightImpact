import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Snackbar,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch,
  Checkbox,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  TablePagination,
  InputAdornment,
  Tooltip,
} from '@mui/material';
import { 
  Add as AddIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { SelectChangeEvent } from '@mui/material/Select';
import Layout from '../components/Layout';
import ExportButton from '../components/ExportButton';
import { getUsers, User } from '../services/users';
import {
  getQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  toggleQuestionActive,
  getAllAnswers,
  IdQuestion,
  IdQuestionCreate,
  AnswerWithDetails,
  AnswersFilter
} from '../services/identification';

const EMPTY_FORM: IdQuestionCreate = {
  title: '',
  question_text: '',
  response_type: 'MC_SINGLE',
  possible_choices: [],
  notes_enabled: false,
  is_active: true,
  assigned_user_ids: [],
};

const variableOptions = [
  { label: 'Contact First Name', value: '%contactfirst%' },
];

// Tab enum for better type safety
enum TabValue {
  QUESTIONS = 'questions',
  ANSWERS = 'answers'
}

const IdentificationPage: React.FC = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabValue>(TabValue.QUESTIONS);
  const [users, setUsers] = useState<User[]>([]);
  const [questions, setQuestions] = useState<IdQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showVariables, setShowVariables] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [choicesText, setChoicesText] = useState('');
  const [editQuestion, setEditQuestion] = useState<IdQuestion | null>(null);
  const [form, setForm] = useState<IdQuestionCreate>(EMPTY_FORM);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const data = await getQuestions();
      setQuestions(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
    // Load users for assignment dropdown
    (async () => {
      try {
        const allUsers = await getUsers();
        setUsers(allUsers);
      } catch (err) {
        console.error('Failed to load users', err);
      }
    })();
  }, []);

  const handleDialogOpen = (question?: IdQuestion) => {
    if (question) {
      setEditQuestion(question);
      setForm({
        title: question.title,
        question_text: question.question_text,
        response_type: question.response_type,
        possible_choices: question.possible_choices,
        notes_enabled: question.notes_enabled,
        is_active: question.is_active,
        assigned_user_ids: question.assigned_user_ids,
      });
      setChoicesText(question.possible_choices.join(', '));
    } else {
      setEditQuestion(null);
      setForm(EMPTY_FORM);
      setChoicesText('');
    }
    setDialogOpen(true);
    // focus later
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
  };

  const handleSave = async () => {
    try {
      if (editQuestion) {
        const payload = {
          ...form,
          possible_choices:
            form.response_type === 'MC_SINGLE' || form.response_type === 'MC_MULTI'
              ? choicesText.split(',').map((c) => c.trim())
              : [],
        };
        await updateQuestion(editQuestion.id, payload);
        setSuccess('Question updated');
      } else {
        const payload = {
          ...form,
          possible_choices:
            form.response_type === 'MC_SINGLE' || form.response_type === 'MC_MULTI'
              ? choicesText.split(',').map((c) => c.trim())
              : [],
        };
        await createQuestion(payload);
        setSuccess('Question created');
      }
      setDialogOpen(false);
      fetchQuestions();
    } catch (err) {
      console.error(err);
      setError('Failed to save question');
    }
  };

  const handleDelete = async (question: IdQuestion) => {
    if (!confirm('Delete this question?')) return;
    try {
      await deleteQuestion(question.id);
      setSuccess('Question deleted');
      fetchQuestions();
    } catch (err) {
      console.error(err);
      setError('Cannot delete question (maybe has answers)');
    }
  };

  const handleToggleActive = async (question: IdQuestion) => {
    try {
      const updated = await toggleQuestionActive(question.id, !question.is_active);
      setQuestions(prev => prev.map(q => (q.id === updated.id ? updated : q)));
    } catch (err) {
      console.error(err);
      setError('Failed to toggle active status');
    }
  };

  // Answers tab state
  const [answers, setAnswers] = useState<AnswerWithDetails[]>([]);
  const [answersTotalCount, setAnswersTotalCount] = useState<number>(0);
  const [answersLoading, setAnswersLoading] = useState<boolean>(false);
  const [answersPage, setAnswersPage] = useState<number>(0);
  const [answersRowsPerPage, setAnswersRowsPerPage] = useState<number>(10);
  const [answersSearchTerm, setAnswersSearchTerm] = useState<string>('');
  const [answersTempSearchTerm, setAnswersTempSearchTerm] = useState<string>('');
  const [answersFilter, setAnswersFilter] = useState<AnswersFilter>({
    page: 0,
    limit: 10,
    sort_by: 'created_at',
    sort_order: 'desc'
  });
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>('all');
  const [selectedResponseType, setSelectedResponseType] = useState<string>('all');

  // Fetch answers with filters
  const fetchAnswers = async () => {
    try {
      setAnswersLoading(true);
      const filters: AnswersFilter = {
        ...answersFilter,
        search: answersSearchTerm,
        user_id: selectedUserId !== 'all' ? selectedUserId : undefined,
        question_id: selectedQuestionId !== 'all' ? selectedQuestionId : undefined,
        response_type: selectedResponseType !== 'all' ? selectedResponseType : undefined,
      };
      
      const result = await getAllAnswers(filters);
      setAnswers(result.data);
      setAnswersTotalCount(result.total);
    } catch (err) {
      console.error('Failed to fetch answers:', err);
      setError('Failed to load answers');
    } finally {
      setAnswersLoading(false);
    }
  };

  // Handle answers search
  const handleAnswersSearch = () => {
    setAnswersSearchTerm(answersTempSearchTerm);
    setAnswersPage(0);
    setAnswersFilter(prev => ({ ...prev, page: 0 }));
  };

  // Handle answers pagination
  const handleAnswersPageChange = (event: unknown, newPage: number) => {
    setAnswersPage(newPage);
    setAnswersFilter(prev => ({ ...prev, page: newPage }));
  };

  const handleAnswersRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setAnswersRowsPerPage(newRowsPerPage);
    setAnswersPage(0);
    setAnswersFilter(prev => ({ ...prev, limit: newRowsPerPage, page: 0 }));
  };

  // Handle filter changes
  const handleUserFilterChange = (event: SelectChangeEvent) => {
    setSelectedUserId(event.target.value as string);
    setAnswersPage(0);
    setAnswersFilter(prev => ({ ...prev, page: 0 }));
  };

  const handleQuestionFilterChange = (event: SelectChangeEvent) => {
    setSelectedQuestionId(event.target.value as string);
    setAnswersPage(0);
    setAnswersFilter(prev => ({ ...prev, page: 0 }));
  };

  const handleResponseTypeFilterChange = (event: SelectChangeEvent) => {
    setSelectedResponseType(event.target.value as string);
    setAnswersPage(0);
    setAnswersFilter(prev => ({ ...prev, page: 0 }));
  };

  // Reset filters
  const resetAnswersFilters = () => {
    setSelectedUserId('all');
    setSelectedQuestionId('all');
    setSelectedResponseType('all');
    setAnswersSearchTerm('');
    setAnswersTempSearchTerm('');
    setAnswersPage(0);
    setAnswersFilter({
      page: 0,
      limit: answersRowsPerPage,
      sort_by: 'created_at',
      sort_order: 'desc'
    });
  };

  // Effect to fetch answers when filters change
  useEffect(() => {
    if (activeTab === TabValue.ANSWERS) {
      fetchAnswers();
    }
  }, [activeTab, answersFilter, answersSearchTerm, selectedUserId, selectedQuestionId, selectedResponseType]);

  // Format answer value based on response type
  const formatAnswerValue = (answer: AnswerWithDetails): string => {
    switch (answer.response_type) {
      case 'MC_SINGLE':
      case 'MC_MULTI':
        return answer.selected_choices?.join(', ') || '';
      case 'SLIDER':
        return answer.slider_answer?.toString() || '';
      case 'TEXT':
        return answer.text_answer || '';
      default:
        return '';
    }
  };

  // Unique response types for filtering
  const responseTypes = useMemo(() => [
    { value: 'MC_SINGLE', label: 'Single Choice' },
    { value: 'MC_MULTI', label: 'Multiple Choice' },
    { value: 'SLIDER', label: 'Slider' },
    { value: 'TEXT', label: 'Text' },
  ], []);

  // Render the answers tab content
  const renderAnswersTab = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Identification Answers</Typography>
        <ExportButton 
          endpoint="/api/identification/answers/export"
          filters={{
            search: answersSearchTerm,
            user_id: selectedUserId !== 'all' ? selectedUserId : undefined,
            question_id: selectedQuestionId !== 'all' ? selectedQuestionId : undefined,
            response_type: selectedResponseType !== 'all' ? selectedResponseType : undefined,
          }}
          title="Identification Answers"
          defaultFileName="identification_answers"
        />
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" flexWrap="wrap" gap={2} alignItems="center">
          {/* Search field */}
          <TextField
            label="Search"
            variant="outlined"
            size="small"
            value={answersTempSearchTerm}
            onChange={(e) => setAnswersTempSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAnswersSearch()}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={handleAnswersSearch} size="small">
                    <SearchIcon />
                  </IconButton>
                  {answersTempSearchTerm && (
                    <IconButton 
                      onClick={() => {
                        setAnswersTempSearchTerm('');
                        if (answersSearchTerm) {
                          setAnswersSearchTerm('');
                        }
                      }} 
                      size="small"
                    >
                      <ClearIcon />
                    </IconButton>
                  )}
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 250 }}
          />

          {/* User filter */}
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>User</InputLabel>
            <Select
              value={selectedUserId}
              onChange={handleUserFilterChange}
              label="User"
            >
              <MenuItem value="all">All Users</MenuItem>
              {users.map(user => (
                <MenuItem key={user.id} value={user.id.toString()}>
                  {user.email}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Question filter */}
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Question</InputLabel>
            <Select
              value={selectedQuestionId}
              onChange={handleQuestionFilterChange}
              label="Question"
            >
              <MenuItem value="all">All Questions</MenuItem>
              {questions.map(question => (
                <MenuItem key={question.id} value={question.id.toString()}>
                  {question.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Response type filter */}
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Response Type</InputLabel>
            <Select
              value={selectedResponseType}
              onChange={handleResponseTypeFilterChange}
              label="Response Type"
            >
              <MenuItem value="all">All Types</MenuItem>
              {responseTypes.map(type => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Reset filters button */}
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={resetAnswersFilters}
            size="small"
          >
            Reset
          </Button>
        </Box>
      </Paper>

      {answersLoading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Question</TableCell>
                  <TableCell>Answer</TableCell>
                  <TableCell>Notes</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {answers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      No answers found
                    </TableCell>
                  </TableRow>
                ) : (
                  answers.map((answer) => (
                    <TableRow key={answer.id}>
                      <TableCell>{answer.id}</TableCell>
                      <TableCell>
                        {answer.contact_first_name} {answer.contact_last_name}
                      </TableCell>
                      <TableCell>{answer.contact_phone}</TableCell>
                      <TableCell>
                        <Tooltip title={answer.question_text}>
                          <span>{answer.question_title}</span>
                        </Tooltip>
                      </TableCell>
                      <TableCell>{formatAnswerValue(answer)}</TableCell>
                      <TableCell>{answer.notes || '-'}</TableCell>
                      <TableCell>{answer.user_name || answer.user_email}</TableCell>
                      <TableCell>
                        {new Date(answer.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={answersTotalCount}
            page={answersPage}
            onPageChange={handleAnswersPageChange}
            rowsPerPage={answersRowsPerPage}
            onRowsPerPageChange={handleAnswersRowsPerPageChange}
            rowsPerPageOptions={[5, 10, 25, 50, 100]}
          />
        </>
      )}
    </Box>
  );

  return (
    <Layout>
      <Box>
        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button 
              variant={activeTab === TabValue.QUESTIONS ? "contained" : "outlined"}
              onClick={() => setActiveTab(TabValue.QUESTIONS)}
            >
              Questions
            </Button>
            <Button 
              variant={activeTab === TabValue.ANSWERS ? "contained" : "outlined"}
              onClick={() => setActiveTab(TabValue.ANSWERS)}
            >
              Answers
            </Button>
          </Box>
        </Box>

        {activeTab === TabValue.QUESTIONS && (
          <>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h4">Identification Questions</Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleDialogOpen()}>
                New Question
              </Button>
            </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : (
          <Card>
            <CardContent>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Title</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Active</TableCell>
                      <TableCell>Answers</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {questions.map(q => (
                      <TableRow key={q.id}>
                        <TableCell>{q.title}</TableCell>
                        <TableCell>{q.response_type}</TableCell>
                        <TableCell>
                          <Switch checked={q.is_active} onChange={() => handleToggleActive(q)} />
                        </TableCell>
                        <TableCell>{q.answers_count}</TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => handleDialogOpen(q)}>
                            <EditIcon />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleDelete(q)} disabled={q.answers_count > 0}>
                            <DeleteIcon />
                          </IconButton>
                          {/* TODO: View answers page */}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        )}
        </>)}
        
        {activeTab === TabValue.ANSWERS && renderAnswersTab()}

        {/* Dialog for create/edit */}
        <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth="sm" fullWidth>
          <DialogTitle>{editQuestion ? 'Edit Question' : 'New Question'}</DialogTitle>
          <DialogContent>
            <TextField
              label="Title"
              fullWidth
              margin="normal"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />
            <Box mb={1}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setShowVariables(!showVariables)}
              >
                Insert Variable
              </Button>
              {showVariables && (
                <Box mt={1} p={1} border={1} borderColor="divider" borderRadius={1}>
                  <Typography variant="subtitle2" gutterBottom>
                    Available Variables:
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {variableOptions.map(opt => (
                      <Chip
                        key={opt.value}
                        label={opt.label}
                        onClick={() => {
                          setForm(prev => ({ ...prev, question_text: prev.question_text + opt.value }));
                          setShowVariables(false);
                        }}
                        clickable
                        variant="outlined"
                        size="small"
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
            <TextField
              id="question-text"
              label="Question Text"
              fullWidth
              margin="normal"
              multiline
              rows={3}
              value={form.question_text}
              onChange={e => setForm({ ...form, question_text: e.target.value })}
            />

            <FormControl fullWidth margin="normal">
              <InputLabel>Response Type</InputLabel>
              <Select
                value={form.response_type}
                label="Response Type"
                onChange={e =>
                  setForm({ ...form, response_type: e.target.value as any, possible_choices: [] })
                }
              >
                <MenuItem value="MC_SINGLE">Multiple Choice (Single)</MenuItem>
                <MenuItem value="MC_MULTI">Multiple Choice (Multiple)</MenuItem>
                <MenuItem value="SLIDER">Slider (1-10)</MenuItem>
                <MenuItem value="TEXT">Text Response</MenuItem>
              </Select>
            </FormControl>

            {(form.response_type === 'MC_SINGLE' || form.response_type === 'MC_MULTI') && (
              <TextField
                label="Choices (comma separated)"
                fullWidth
                margin="normal"
                value={choicesText}
                onChange={(e) => setChoicesText(e.target.value)}
              />
            )}

            {/* User assignment */}
            <FormControl fullWidth margin="normal">
              <InputLabel>Assign to Users</InputLabel>
              <Select
                multiple
                label="Assign to Users"
                value={
                  form.assigned_user_ids && form.assigned_user_ids.length
                    ? (form.assigned_user_ids as (string | number)[])
                    : ['all']
                }
                onChange={e => {
                  const val = e.target.value as (number | string)[];
                  if (val.includes('all')) {
                    setForm({ ...form, assigned_user_ids: [] });
                  } else {
                    setForm({ ...form, assigned_user_ids: (val.filter(v => v !== 'all') as number[]) });
                  }
                }}
                renderValue={(selected) => {
                  if (selected.includes('all')) return 'All Users';
                  const names = users
                    .filter(u => selected.includes(u.id))
                    .map(u => u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : u.email);
                  return names.join(', ');
                }}
              >
                <MenuItem value="all">
                  <em>All Users</em>
                </MenuItem>
                {users.map(u => (
                  <MenuItem key={u.id} value={u.id}>
                    <Checkbox checked={(form.assigned_user_ids || []).includes(u.id)} />
                    <ListItemText primary={u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : u.email} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl margin="normal">
              <Box display="flex" alignItems="center">
                <Typography>Notes Enabled</Typography>
                <Switch
                  checked={form.notes_enabled}
                  onChange={e => setForm({ ...form, notes_enabled: e.target.checked })}
                />
              </Box>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDialogClose}>Cancel</Button>
            <Button onClick={handleSave} variant="contained">
              Save
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError(null)}>
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Snackbar>
        <Snackbar open={!!success} autoHideDuration={6000} onClose={() => setSuccess(null)}>
          <Alert severity="success" onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        </Snackbar>
      </Box>
    </Layout>
  );
};

export default IdentificationPage;
