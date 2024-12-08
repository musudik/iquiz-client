import React, { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { rtdb } from '../firebaseConfig';
import { ref, get, onValue, off, update } from 'firebase/database';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Paper,
  Grid,
  Alert
} from '@mui/material';
import { Timer as TimerIcon } from '@mui/icons-material';

function Quiz() {
  const { quizId } = useParams();
  const location = useLocation();
  const [participant, setParticipant] = useState(null);
  const [error, setError] = useState(null);
  const [quizStatus, setQuizStatus] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [score, setScore] = useState(0);

  // Validate participant and set up real-time listeners
  useEffect(() => {
    const validateParticipant = async () => {
      try {
        const searchParams = new URLSearchParams(location.search);
        const participantData = searchParams.get('participant');
        
        if (!participantData) {
          setError('Invalid quiz link');
          return;
        }

        const [email, name] = decodeURIComponent(atob(participantData)).split(':');

        const registrationsRef = ref(rtdb, `quizzes/${quizId}/registrations`);
        const snapshot = await get(registrationsRef);
        
        if (snapshot.exists()) {
          const registrations = snapshot.val();
          const registration = Object.values(registrations).find(
            reg => reg.email === email && reg.name === name
          );

          if (registration) {
            setParticipant(registration);
            
            // Set up real-time listeners after validation
            setupQuizListeners();
          } else {
            setError('Invalid registration');
          }
        } else {
          setError('Quiz not found');
        }
      } catch (error) {
        console.error('Error validating participant:', error);
        setError('Failed to validate participant');
      }
    };

    validateParticipant();

    return () => {
      // Clean up listeners
      const statusRef = ref(rtdb, `quizzes/${quizId}/status`);
      off(statusRef);
    };
  }, [quizId, location.search]);

  // Set up real-time quiz listeners
  const setupQuizListeners = () => {
    const statusRef = ref(rtdb, `quizzes/${quizId}/status`);
    
    onValue(statusRef, (snapshot) => {
      const status = snapshot.val();
      setQuizStatus(status);
      
      if (status?.state === 'active') {
        // Fetch current question
        const questionsRef = ref(rtdb, `quizzes/${quizId}/questions/${status.currentQuestion}`);
        onValue(questionsRef, (questionSnapshot) => {
          if (questionSnapshot.exists()) {
            setCurrentQuestion(questionSnapshot.val());
            setTimeLeft(20); // Reset timer for new question
            setSelectedAnswer(null);
            setHasAnswered(false);
          }
        });
      }
    });
  };

  // Timer logic
  useEffect(() => {
    let timer;
    if (quizStatus?.state === 'active' && timeLeft > 0 && !hasAnswered) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [quizStatus?.state, timeLeft, hasAnswered]);

  // Handle answer submission
  const handleAnswerSubmit = async (selectedOption) => {
    if (hasAnswered) return;

    setSelectedAnswer(selectedOption);
    setHasAnswered(true);

    // Check if answer is correct
    const isCorrect = selectedOption === currentQuestion.correctAnswer;
    
    // Update participant's score
    if (isCorrect) {
      const newScore = score + 10; // 10 points per correct answer
      setScore(newScore);
      
      // Update score in Firebase
      const participantRef = ref(rtdb, `quizzes/${quizId}/registrations/${participant.id}`);
      await update(participantRef, {
        score: newScore
      });
    }
  };

  // Render functions
  const renderWaitingScreen = () => (
    <Box sx={{ textAlign: 'center', p: 4 }}>
      <Typography variant="h5" gutterBottom>
        Waiting for quiz to start...
      </Typography>
      <CircularProgress sx={{ mt: 2 }} />
    </Box>
  );

  const renderQuestion = () => (
    <Box sx={{ p: 3 }}>
      {/* Timer */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'flex-end', 
        mb: 2,
        alignItems: 'center'
      }}>
        <TimerIcon sx={{ 
          color: timeLeft <= 5 ? 'error.main' : 'primary.main',
          mr: 1 
        }} />
        <Typography 
          variant="h5"
          color={timeLeft <= 5 ? 'error.main' : 'primary.main'}
        >
          {timeLeft}s
        </Typography>
      </Box>

      {/* Score */}
      <Typography variant="h6" gutterBottom>
        Score: {score}
      </Typography>

      {/* Question */}
      <Typography variant="h5" gutterBottom>
        {currentQuestion?.question}
      </Typography>

      {/* Options */}
      <Grid container spacing={2} sx={{ mt: 2 }}>
        {currentQuestion?.options.map((option, index) => (
          <Grid item xs={12} sm={6} key={index}>
            <Button
              fullWidth
              variant={selectedAnswer === option ? 'contained' : 'outlined'}
              onClick={() => handleAnswerSubmit(option)}
              disabled={hasAnswered || timeLeft === 0}
              sx={{
                p: 2,
                textAlign: 'left',
                backgroundColor: hasAnswered ? (
                  option === currentQuestion.correctAnswer 
                    ? 'success.light'
                    : selectedAnswer === option 
                      ? 'error.light'
                      : 'inherit'
                ) : 'inherit'
              }}
            >
              {option}
            </Button>
          </Grid>
        ))}
      </Grid>

      {/* Answer feedback */}
      {hasAnswered && (
        <Alert 
          severity={selectedAnswer === currentQuestion.correctAnswer ? "success" : "error"}
          sx={{ mt: 2 }}
        >
          {selectedAnswer === currentQuestion.correctAnswer 
            ? "Correct answer! +10 points" 
            : `Incorrect. The correct answer was: ${currentQuestion.correctAnswer}`}
        </Alert>
      )}
    </Box>
  );

  const renderFinishedScreen = () => (
    <Box sx={{ textAlign: 'center', p: 4 }}>
      <Typography variant="h5" gutterBottom>
        Quiz Completed!
      </Typography>
      <Typography variant="h6">
        Final Score: {score}
      </Typography>
    </Box>
  );

  // Main render
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!participant || !quizStatus) {
    return (
      <Box sx={{ textAlign: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          {quizStatus.title || 'Quiz'}
        </Typography>
        
        {quizStatus.state === 'waiting' && renderWaitingScreen()}
        {quizStatus.state === 'active' && currentQuestion && renderQuestion()}
        {quizStatus.state === 'finished' && renderFinishedScreen()}
      </Paper>
    </Box>
  );
}

export default Quiz; 