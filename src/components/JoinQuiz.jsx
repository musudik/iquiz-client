import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { rtdb } from '../firebaseConfig';
import { ref, onValue, push, set, off } from 'firebase/database';
import {
  Box,
  Container,
  Typography,
  Button,
  TextField,
  Paper,
  CircularProgress,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  Alert,
} from '@mui/material';

function JoinQuiz() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [participant, setParticipant] = useState(null);
  const [name, setName] = useState('');
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [joined, setJoined] = useState(false);

  // Fetch quiz data
  useEffect(() => {
    const quizRef = ref(rtdb, `quizzes/${quizId}`);
    
    const unsubscribe = onValue(quizRef, (snapshot) => {
      try {
        const data = snapshot.val();
        if (data) {
          setQuiz(data);
          if (data.status === 'finished' && participant) {
            navigate(`/leaderboard/${quizId}`);
          }
        } else {
          setError('Quiz not found');
        }
      } catch (err) {
        console.error('Error fetching quiz:', err);
        setError('Error loading quiz');
      } finally {
        setLoading(false);
      }
    });

    return () => off(quizRef);
  }, [quizId, participant, navigate]);

  const handleJoin = async () => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    try {
      const participantRef = push(ref(rtdb, `quiz_participants/${quizId}`));
      const participantData = {
        name: name.trim(),
        joinedAt: new Date().toISOString(),
        score: 0,
      };
      
      await set(participantRef, participantData);
      setParticipant({ id: participantRef.key, ...participantData });
      setJoined(true);
      setError(null);
    } catch (error) {
      console.error('Error joining quiz:', error);
      setError('Failed to join quiz');
    }
  };

  const handleAnswer = async (answer) => {
    if (!participant) return;

    try {
      setCurrentAnswer(answer);
      await set(ref(rtdb, `quiz_answers/${quizId}/${participant.id}`), {
        answer,
        questionIndex: quiz.currentQuestionIndex,
        answeredAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error submitting answer:', error);
      setError('Failed to submit answer');
    }
  };

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!quiz) return <Alert severity="error">Quiz not found</Alert>;

  if (!joined) {
    return (
      <Container maxWidth="sm">
        <Paper sx={{ p: 3, mt: 4 }}>
          <Typography variant="h5" sx={{ mb: 3 }}>Join Quiz: {quiz.title}</Typography>
          <TextField
            fullWidth
            label="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mb: 3 }}
          />
          <Button
            fullWidth
            variant="contained"
            onClick={handleJoin}
            disabled={!name.trim()}
          >
            Join Quiz
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4 }}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h5">{quiz.title}</Typography>
          <Typography variant="subtitle1">
            Welcome, {participant.name}!
          </Typography>
        </Paper>

        {quiz.status === 'waiting' && (
          <Alert severity="info">
            Waiting for the quiz to start...
          </Alert>
        )}

        {quiz.status === 'active' && quiz.questions && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6">
              Question {quiz.currentQuestionIndex + 1}
            </Typography>
            <Typography variant="h5" sx={{ my: 3 }}>
              {quiz.questions[quiz.currentQuestionIndex].question}
            </Typography>
            
            <FormControl component="fieldset">
              <RadioGroup
                value={currentAnswer}
                onChange={(e) => handleAnswer(e.target.value)}
              >
                {quiz.questions[quiz.currentQuestionIndex].options.map((option, index) => (
                  <FormControlLabel
                    key={index}
                    value={option}
                    control={<Radio />}
                    label={option}
                  />
                ))}
              </RadioGroup>
            </FormControl>
          </Paper>
        )}
      </Box>
    </Container>
  );
}

export default JoinQuiz; 