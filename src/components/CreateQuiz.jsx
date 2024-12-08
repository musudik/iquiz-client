import React, { useState, useEffect, useRef } from 'react';
import { rtdb } from '../firebaseConfig';
import { ref, onValue, push, set, remove, off, update } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Button,
  TextField,
  Container,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from '@mui/material';
import {
  Delete,
  Settings,
  Add,
  PlayArrow,
  Edit,
  QrCode2 as QrCodeIcon,
  Link as LinkIcon,
  People as PeopleIcon,
} from '@mui/icons-material';

function CreateQuiz() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showQuizForm, setShowQuizForm] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showLinkCopied, setShowLinkCopied] = useState(false);
  const [quizData, setQuizData] = useState({
    title: '',
    date: new Date().toISOString().slice(0, 16),
    participants: 0,
    fees: 0,
    questionDuration: 20,
    questions: [],
  });
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const canvasRef = useRef(null);

  useEffect(() => {
    let quizzesRef = null;
    try {
      quizzesRef = ref(rtdb, 'quizzes');
      
      const handleData = (snapshot) => {
        try {
          const quizzesData = [];
          const data = snapshot.val();
          
          if (data) {
            Object.keys(data).forEach((key) => {
              quizzesData.push({
                id: key,
                ...data[key]
              });
            });
          }
          
          setQuizzes(quizzesData);
          setError(null);
        } catch (err) {
          console.error('Error processing data:', err);
          setError('Error loading quizzes');
        } finally {
          setLoading(false);
        }
      };

      onValue(quizzesRef, handleData, (error) => {
        console.error('Database error:', error);
        setError('Error connecting to database');
        setLoading(false);
      });

      return () => {
        if (quizzesRef) {
          off(quizzesRef);
        }
      };
    } catch (err) {
      console.error('Setup error:', err);
      setError('Error setting up database connection');
      setLoading(false);
    }
  }, []);

  const saveQuizToFirebase = async (quiz) => {
    try {
      setError(null);
      let quizRef;
      
      if (selectedQuiz) {
        quizRef = ref(rtdb, `quizzes/${selectedQuiz.id}`);
      } else {
        quizRef = push(ref(rtdb, 'quizzes'));
      }
      
      if (!quizRef) {
        throw new Error('Failed to create quiz reference');
      }

      const quizDataToSave = {
        ...quiz,
        participants: Number(quiz.participants) || 0,
        fees: Number(quiz.fees) || 0,
        questionDuration: Number(quiz.questionDuration) || 20,
        updatedAt: new Date().toISOString(),
        ...(selectedQuiz ? {} : { createdAt: new Date().toISOString() })
      };

      await (selectedQuiz ? update(quizRef, quizDataToSave) : set(quizRef, quizDataToSave));
      
      setShowQuizForm(false);
      setSelectedQuiz(null);
      resetQuizForm();
    } catch (error) {
      console.error('Error saving quiz:', error);
      setError('Failed to save quiz');
    }
  };

  const resetQuizForm = () => {
    setQuizData({
      title: '',
      date: new Date().toISOString().slice(0, 16),
      participants: 0,
      fees: 0,
      questionDuration: 20,
      questions: [],
    });
  };

  const generateQRCode = async (quizId) => {
    try {
      const url = `${window.location.origin}/join/${quizId}`;
      const qrCodeDataUrl = await QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      setQrCodeUrl(qrCodeDataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
      setError('Failed to generate QR code');
    }
  };

  const handleShowQRCode = async (quiz) => {
    setSelectedQuiz(quiz);
    await generateQRCode(quiz.id);
    setShowQRCode(true);
  };

  if (loading) {
    return (
      <Box sx={{ flexGrow: 1 }}>
        <Container maxWidth="lg" sx={{ mt: 4 }}>
          <Typography variant="h5">Loading quizzes...</Typography>
        </Container>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ flexGrow: 1 }}>
        <Container maxWidth="lg" sx={{ mt: 4 }}>
          <Typography variant="h5" color="error">{error}</Typography>
        </Container>
      </Box>
    );
  }

  const handleEditQuiz = (quiz) => {
    setSelectedQuiz(quiz);
    setQuizData({
      ...quiz,
      date: new Date(quiz.date).toISOString().slice(0, 16),
      participants: quiz.participants || 0,
      fees: quiz.fees || 0,
      questionDuration: quiz.questionDuration || 20,
    });
    setShowQuizForm(true);
  };

  const handleDeleteQuiz = async (quizId) => {
    try {
      const quizRef = ref(rtdb, `quizzes/${quizId}`);
      await remove(quizRef);
      setQuizzes(quizzes.filter(quiz => quiz.id !== quizId));
    } catch (error) {
      console.error('Error deleting quiz:', error);
      setError('Failed to delete quiz');
    }
  };

  const handleAddQuestions = (quizId) => {
    navigate(`/quiz/${quizId}/questions`);
  };

  const handleConductQuiz = async (quizId) => {
    try {
      const quizRef = ref(rtdb, `quizzes/${quizId}`);
      await update(quizRef, { status: 'active' });
      navigate(`/conduct/${quizId}`);
    } catch (error) {
      console.error('Error starting quiz:', error);
      setError('Failed to start quiz');
    }
  };

  const handleCopyLink = (quizId) => {
    const link = `${window.location.origin}/join/${quizId}`;
    navigator.clipboard.writeText(link);
    setShowLinkCopied(true);
  };

  const getQuizLink = (quizId) => {
    return `${window.location.origin}/join/${quizId}`;
  };

  const handleViewRegistrations = (quizId) => {
    navigate(`/quiz/${quizId}/registrations`);
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h5">Manage Quiz</Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setShowQuizForm(true)}
          >
            Create New Quiz
          </Button>
        </Box>

        {/* Quiz List */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Participants</TableCell>
                <TableCell>Fees</TableCell>
                <TableCell>Duration/Question</TableCell>
                <TableCell>Registered</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {quizzes.map((quiz) => (
                <TableRow key={quiz.id}>
                  <TableCell>{quiz.title}</TableCell>
                  <TableCell>{new Date(quiz.date).toLocaleString()}</TableCell>
                  <TableCell>{quiz.participants}</TableCell>
                  <TableCell>${quiz.fees}</TableCell>
                  <TableCell>{quiz.questionDuration}s</TableCell>
                  <TableCell>{quiz.registeredCount || 0}</TableCell>
                  <TableCell>
                    <Tooltip title="Edit Quiz" arrow placement="top">
                      <IconButton onClick={() => handleEditQuiz(quiz)}>
                        <Edit />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Delete Quiz" arrow placement="top">
                      <IconButton onClick={() => handleDeleteQuiz(quiz.id)}>
                        <Delete />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Add Questions" arrow placement="top">
                      <IconButton onClick={() => handleAddQuestions(quiz.id)}>
                        <Add />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Start Quiz" arrow placement="top">
                      <IconButton onClick={() => handleConductQuiz(quiz.id)}>
                        <PlayArrow />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Copy Join Link" arrow placement="top">
                      <IconButton onClick={() => handleCopyLink(quiz.id)}>
                        <LinkIcon />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Show QR Code" arrow placement="top">
                      <IconButton onClick={() => handleShowQRCode(quiz)}>
                        <QrCodeIcon />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="View Registrations" arrow placement="top">
                      <IconButton onClick={() => handleViewRegistrations(quiz.id)}>
                        <PeopleIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* QR Code Dialog */}
        <Dialog open={showQRCode} onClose={() => setShowQRCode(false)}>
          <DialogTitle>Quiz QR Code</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 2 }}>
              {selectedQuiz && (
                <>
                  {qrCodeUrl && (
                    <img 
                      src={qrCodeUrl} 
                      alt="Quiz QR Code"
                      style={{ width: 256, height: 256 }}
                    />
                  )}
                  <Typography sx={{ mt: 2 }}>{selectedQuiz.title}</Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                    Scan to join the quiz
                  </Typography>
                  <Button
                    variant="outlined"
                    sx={{ mt: 2 }}
                    onClick={() => {
                      const link = document.createElement('a');
                      link.download = `quiz-${selectedQuiz.title}-qr.png`;
                      link.href = qrCodeUrl;
                      link.click();
                    }}
                  >
                    Download QR Code
                  </Button>
                </>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowQRCode(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Link Copied Snackbar */}
        <Snackbar
          open={showLinkCopied}
          autoHideDuration={3000}
          onClose={() => setShowLinkCopied(false)}
          message="Link copied to clipboard"
        />

        {/* Error Snackbar */}
        <Snackbar
          open={!!error}
          autoHideDuration={3000}
          onClose={() => setError(null)}
          message={error}
        />

        {/* Quiz Creation/Edit Dialog */}
        <Dialog open={showQuizForm} onClose={() => setShowQuizForm(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{selectedQuiz ? 'Edit Quiz' : 'Create New Quiz'}</DialogTitle>
          <DialogContent>
            <Box component="form" sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Quiz Title"
                value={quizData.title}
                onChange={(e) => setQuizData({ ...quizData, title: e.target.value })}
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                type="datetime-local"
                label="Quiz Date & Time"
                value={quizData.date}
                onChange={(e) => setQuizData({ ...quizData, date: e.target.value })}
                sx={{ mb: 2 }}
                InputLabelProps={{ shrink: true }}
              />

              <TextField
                fullWidth
                type="number"
                label="Maximum Participants"
                value={quizData.participants}
                onChange={(e) => setQuizData({ ...quizData, participants: parseInt(e.target.value) })}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                type="number"
                label="Entry Fee ($)"
                value={quizData.fees}
                onChange={(e) => setQuizData({ ...quizData, fees: parseFloat(e.target.value) })}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                type="number"
                label="Question Duration (seconds)"
                value={quizData.questionDuration}
                onChange={(e) => setQuizData({ ...quizData, questionDuration: parseInt(e.target.value) })}
                sx={{ mb: 2 }}
              />

              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
                <Button onClick={() => {
                  setShowQuizForm(false);
                  setSelectedQuiz(null);
                  resetQuizForm();
                }}>
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={() => saveQuizToFirebase(quizData)}
                >
                  {selectedQuiz ? 'Save Changes' : 'Create Quiz'}
                </Button>
              </Box>
            </Box>
          </DialogContent>
        </Dialog>
      </Container>
    </Box>
  );
}

export default CreateQuiz;