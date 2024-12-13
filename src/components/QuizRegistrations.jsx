import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { rtdb } from '../firebaseConfig';
import { ref, onValue, remove, off } from 'firebase/database';
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  TextField,
  InputAdornment,
} from '@mui/material';
import { Delete, ArrowBack, Search as SearchIcon } from '@mui/icons-material';

function QuizRegistrations() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [registrations, setRegistrations] = useState([]);
  const [quizDetails, setQuizDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  // Pagination states
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Sorting states
  const [orderBy, setOrderBy] = useState('registeredAt');
  const [order, setOrder] = useState('desc');

  const [searchQuery, setSearchQuery] = useState({
    name: '',
    email: '',
    mobile: ''
  });

  useEffect(() => {
    const quizRef = ref(rtdb, `quizzes/${quizId}`);
    const registrationsRef = ref(rtdb, `quizzes/${quizId}/registrations`);

    const handleQuizData = (snapshot) => {
      const quizData = snapshot.val();
      if (quizData) {
        setQuizDetails(quizData);
      }
    };

    const handleRegistrationsData = (snapshot) => {
      try {
        const data = snapshot.val();
        const quizRegistrations = [];
        
        if (data) {
          Object.entries(data).forEach(([id, registration]) => {
            quizRegistrations.push({
              id,
              ...registration
            });
          });
        }
        
        setRegistrations(quizRegistrations);
        setError(null);
      } catch (err) {
        console.error('Error processing registrations:', err);
        setError('Error loading registrations');
      } finally {
        setLoading(false);
      }
    };

    onValue(quizRef, handleQuizData);
    onValue(registrationsRef, handleRegistrationsData);

    return () => {
      // Cleanup listeners
      off(quizRef);
      off(registrationsRef);
    };
  }, [quizId]);

  const handleDeleteRegistration = async (registrationId) => {
    try {
      await remove(ref(rtdb, `quizzes/${quizId}/registrations/${registrationId}`));
      setRegistrations(registrations.filter(reg => reg.id !== registrationId));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting registration:', error);
      setError('Failed to delete registration');
    }
  };

  // Sorting function
  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  // Sorting comparator
  const comparator = (a, b, orderBy) => {
    if (!a[orderBy] && !b[orderBy]) return 0;
    if (!a[orderBy]) return 1;
    if (!b[orderBy]) return -1;

    if (orderBy === 'registeredAt' || orderBy === 'date') {
      return new Date(a[orderBy]).getTime() - new Date(b[orderBy]).getTime();
    }

    if (typeof a[orderBy] === 'string') {
      return a[orderBy].toLowerCase().localeCompare(b[orderBy].toLowerCase());
    }

    return a[orderBy] - b[orderBy];
  };

  const getFilteredRegistrations = () => {
    return registrations.filter(registration => {
      const nameMatch = registration.name?.toLowerCase().includes(searchQuery.name.toLowerCase());
      const emailMatch = registration.email?.toLowerCase().includes(searchQuery.email.toLowerCase());
      const mobileMatch = registration.mobile?.includes(searchQuery.mobile);
      
      return nameMatch && emailMatch && mobileMatch;
    });
  };

  const getSortedRegistrations = () => {
    return [...getFilteredRegistrations()].sort((a, b) => {
      const comp = comparator(a, b, orderBy);
      return order === 'desc' ? -comp : comp;
    });
  };

  // Pagination handlers
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Handle search input changes
  const handleSearchChange = (field) => (event) => {
    setSearchQuery(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    setPage(0); // Reset to first page when searching
  };

  // Table head cells configuration
  const headCells = [
    { id: 'name', label: 'Name' },
    { id: 'email', label: 'Email' },
    { id: 'mobile', label: 'Mobile' },
    { id: 'paymentMethod', label: 'Payment Method' },
    { id: 'paymentStatus', label: 'Payment Status' },
    { id: 'registeredAt', label: 'Registration Date' },
    { id: 'actions', label: 'Actions', sortable: false },
  ];

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Typography>Loading registrations...</Typography>
      </Container>
    );
  }

  const sortedRegistrations = getSortedRegistrations();
  const paginatedRegistrations = sortedRegistrations.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate(-1)}
          sx={{ mb: 2 }}
        >
          Back to Quizzes
        </Button>
        
        {quizDetails && (
          <>
            <Typography variant="h4" gutterBottom>
              {quizDetails.title} - Registrations
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" gutterBottom>
              Date: {new Date(quizDetails.date).toLocaleString()}
            </Typography>
          </>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Search Fields */}
      <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
        <TextField
          size="small"
          label="Search by Name"
          value={searchQuery.name}
          onChange={handleSearchChange('name')}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          size="small"
          label="Search by Email"
          value={searchQuery.email}
          onChange={handleSearchChange('email')}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          size="small"
          label="Search by Mobile"
          value={searchQuery.mobile}
          onChange={handleSearchChange('mobile')}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {headCells.map((headCell) => (
                <TableCell key={headCell.id}>
                  {headCell.sortable !== false ? (
                    <TableSortLabel
                      active={orderBy === headCell.id}
                      direction={orderBy === headCell.id ? order : 'asc'}
                      onClick={() => handleRequestSort(headCell.id)}
                    >
                      {headCell.label}
                    </TableSortLabel>
                  ) : (
                    headCell.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedRegistrations.map((registration) => (
              <TableRow key={registration.id}>
                <TableCell>{registration.name}</TableCell>
                <TableCell>{registration.email}</TableCell>
                <TableCell>{registration.mobile}</TableCell>
                <TableCell>{registration.paymentMethod}</TableCell>
                <TableCell>{registration.paymentStatus}</TableCell>
                <TableCell>
                  {new Date(registration.registeredAt).toLocaleString()}
                </TableCell>
                <TableCell>
                  <IconButton
                    color="error"
                    onClick={() => setDeleteConfirm(registration)}
                  >
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {paginatedRegistrations.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  {registrations.length === 0 ? 'No registrations found' : 'No matching records found'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={sortedRegistrations.length} // Update to use filtered count
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          Are you sure you want to delete the registration for {deleteConfirm?.name}?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button
            color="error"
            onClick={() => handleDeleteRegistration(deleteConfirm.id)}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default QuizRegistrations; 