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
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });
  const [questionStartTime, setQuestionStartTime] = useState(null);
  const prevQuestionIndex = React.useRef(null);

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

        try {
          // First decode from base64
          const base64Decoded = atob(participantData);
          
          // Then decode URI component
          const decodedData = decodeURIComponent(base64Decoded);
          
          const [email, name] = decodedData.split(':');

          if (!email || !name) {
            setError('Invalid participant information');
            return;
          }

          const registrationsRef = ref(rtdb, `quizzes/${quizId}/registrations`);
          const snapshot = await get(registrationsRef);
          
          if (snapshot.exists()) {
            const registrations = snapshot.val();
            
            const registration = Object.values(registrations).find(
              reg => reg.userDetails?.email === email && reg.userDetails?.name === name
            );

            if (registration) {
              setParticipant(registration);
              // Set up listeners only after participant is validated
              const cleanup = setupQuizListeners();
              return () => cleanup(); // Return cleanup function
            } else {
              setError('Invalid registration');
            }
          } else {
            setError('Quiz not found');
          }
        } catch (decodeError) {
          console.error('Error decoding participant data:', decodeError);
          setError('Invalid participant data format');
        }
      } catch (error) {
        console.error('Error validating participant:', error);
        setError('Failed to validate participant');
      }
    };

    validateParticipant();
  }, [quizId, location.search]);

  // Set up real-time quiz listeners
  const setupQuizListeners = () => {
    console.log('setupQuizListeners:', quizId);

    const quizRef = ref(rtdb, `quizzes/${quizId}`);
    
    onValue(quizRef, async (snapshot) => {
      const quizData = snapshot.val();
      console.log('Quiz Data Update:', JSON.stringify(quizData));

      if (quizData) {
        // Update quiz status with details
        setQuizStatus(prevStatus => ({
          ...prevStatus,
          title: quizData?.details?.title || 'Untitled Quiz',
          date: quizData?.details?.date || null,
          questionDuration: quizData?.status?.questionDuration || 20,
          totalQuestions: quizData?.questions ? quizData?.questions?.length : 0,
          participants: quizData?.details?.participants || 0,
          state: quizData?.status?.state || 'waiting'
        }));

        // Handle current question and timer
        if (quizData?.status?.state === 'active' && 
            typeof quizData?.status?.currentQuestion === 'number') {
          
          const currentQuestionData = quizData?.questions[quizData?.status?.currentQuestion];
          const serverQuestionStartTime = quizData?.status?.questionStartTime;
          
          // Check if it's a new question
          const isNewQuestion = quizData?.status?.currentQuestion !== prevQuestionIndex.current;
          
          if (currentQuestionData && serverQuestionStartTime) {
            setCurrentQuestion({
              ...currentQuestionData,
              duration: currentQuestionData?.timeLimit || quizData?.details?.questionDuration || 20
            });

            // Calculate remaining time based on server start time
            const duration = currentQuestionData?.timeLimit || quizData?.details?.questionDuration || 20;
            const elapsed = Math.floor((Date.now() - serverQuestionStartTime) / 1000);
            const remaining = Math.max(0, duration - elapsed);
            
            setTimeLeft(remaining);
            setQuestionStartTime(serverQuestionStartTime);

            // Reset selected answer for new questions
            if (isNewQuestion) {
              setSelectedAnswer(null);
              console.log('New question detected - resetting selected answer');
            } else if (participant) {
              // Get current answer if exists
              try {
                const participantAnswers = quizData.registrations?.[participant.id]?.answers;
                if (participantAnswers && participantAnswers[quizData?.status?.currentQuestion]) {
                  setSelectedAnswer(participantAnswers[quizData?.status?.currentQuestion]?.selectedAnswer);
                }
              } catch (error) {
                console.error('Error fetching current answer:', error);
              }
            }

            prevQuestionIndex.current = quizData?.status?.currentQuestion;
          }
        } else {
          setCurrentQuestion(null);
        }
      }
    });

    // Update remaining time every 5 seconds
    const updateTimer = setInterval(() => {
      if (quizStatus?.state === 'active' && questionStartTime) {
        const duration = currentQuestion?.duration || 20;
        const elapsed = Math.floor((Date.now() - questionStartTime) / 1000);
        const remaining = Math.max(0, duration - elapsed);

        // Update the remaining time in the database
        update(ref(rtdb, `quizzes/${quizId}/status`), {
          questionRemainingTime: remaining
        });
      }
    }, 5000);

    return () => off(quizRef);
  };

  // Update timer effect to use server time consistently
  useEffect(() => {
    let timer;

    if (quizStatus?.state === 'active' && questionStartTime) {
      timer = setInterval(() => {
        const duration = currentQuestion?.duration || 20;
        const elapsed = Math.floor((Date.now() - questionStartTime) / 1000);
        const remaining = Math.max(0, duration - elapsed);
        
        setTimeLeft(remaining);
      }, 1000);
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [quizStatus?.state, questionStartTime, currentQuestion?.duration]);

  // Update the useEffect that handles current question to set start time
  useEffect(() => {
    if (currentQuestion && !hasAnswered) {
      setQuestionStartTime(Date.now());
    }
  }, [currentQuestion]);

  // Update handleAnswerSubmit to match new structure
  const handleAnswerSubmit = async (selectedOptionIndex) => {
    if (!participant) return;

    const answerTime = Date.now();
    const timeToAnswer = questionStartTime ? answerTime - questionStartTime : 0;
    
    setSelectedAnswer(selectedOptionIndex);

    try {
      // Get current question index
      const statusRef = ref(rtdb, `quizzes/${quizId}/status`);
      const statusSnapshot = await get(statusRef);
      const currentQuestionIndex = statusSnapshot.val()?.currentQuestion;

      if (typeof currentQuestionIndex !== 'number') {
        console.error('Current question index not found in status');
        return;
      }

      // Check if answer is correct
      const isCorrect = selectedOptionIndex === (currentQuestion.correctAnswer - 1);
      
      // Create answer data
      const answerData = {
        selectedAnswer: selectedOptionIndex,
        isCorrect,
        timeToAnswer,
        answeredAt: answerTime
      };

      // Update score based on correctness
      const newScore = isCorrect ? score + 10 : score;

      const updates = {};
      // Update answer in the new structure
      updates[`quizzes/${quizId}/registrations/${participant.id}/answers/${currentQuestionIndex}`] = answerData;
      updates[`quizzes/${quizId}/registrations/${participant.id}/userDetails/score`] = newScore;

      setScore(newScore);
      await update(ref(rtdb), updates);

      console.log('Answer updated:', answerData);

    } catch (error) {
      console.error('Error submitting answer:', error);
    }
  };

  // Update the countdown timer useEffect
  useEffect(() => {
    if (quizStatus?.date) {
      const calculateTimeLeft = () => {
        const quizDate = new Date(quizStatus.date).getTime();
        const now = new Date().getTime();
        const difference = quizDate - now;

        if (difference > 0) {
          return {
            days: Math.floor(difference / (1000 * 60 * 60 * 24)),
            hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
            minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
            seconds: Math.floor((difference % (1000 * 60)) / 1000)
          };
        }
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      };

      const timer = setInterval(() => {
        setCountdown(calculateTimeLeft());
      }, 1000);

      // Initial calculation
      setCountdown(calculateTimeLeft());

      return () => clearInterval(timer);
    }
  }, [quizStatus?.date]);

  // Render functions
  const renderWaitingScreen = () => (
    <Box sx={{ textAlign: 'center', p: 4 }}>
      <Typography 
        variant="h3" 
        gutterBottom 
        sx={{ 
          fontWeight: 500,
          color: 'primary.main',
          mb: 4 
        }}
      >
        {quizStatus?.title}
      </Typography>

      {/* Quiz Details Panel */}
      <Box sx={{ 
        mb: 4, 
        p: 3, 
        bgcolor: 'background.paper', 
        borderRadius: 2,
        boxShadow: 1
      }}>
        <Grid container spacing={3} sx={{ textAlign: 'left' }}>
          <Grid item xs={12} md={6}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              <strong>Date:</strong>{' '}
              {quizStatus?.date 
                ? new Date(quizStatus.date).toLocaleString()
                : 'Not scheduled'}
            </Typography>
            <Typography variant="body1">
              <strong>Duration:</strong>{' '}
              {`${quizStatus?.questionDuration || 20} seconds per question`}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              <strong>Total Questions:</strong>{' '}
              {quizStatus?.totalQuestions || 0}
            </Typography>
            <Typography variant="body1">
              <strong>Participants:</strong>{' '}
              {quizStatus?.participants || 0}
            </Typography>
          </Grid>
        </Grid>
      </Box>
        
      {/* Countdown Timer */}
      <Box sx={{ 
        p: 4, 
        bgcolor: 'background.paper', 
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <Typography 
          variant="h6" 
          color="text.secondary" 
          gutterBottom
          sx={{ mb: 3 }}
        >
          Quiz starts in:
        </Typography>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          gap: 1,
          mb: 3
        }}>
          {[
            { value: countdown.days, label: 'Days' },
            { value: countdown.hours, label: 'Hours' },
            { value: countdown.minutes, label: 'Minutes' },
            { value: countdown.seconds, label: 'Seconds' }
          ].map((item, index) => (
            <React.Fragment key={item.label}>
              <Box sx={{ 
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: '70px'
              }}>
                <Typography 
                  variant="h3" 
                  sx={{ 
                    fontWeight: '600',
                    color: 'primary.main',
                    lineHeight: 1
                  }}
                >
                  {item.value.toString().padStart(2, '0')}
                </Typography>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: 'text.secondary',
                    mt: 0.5,
                    fontSize: '0.75rem'
                  }}
                >
                  {item.label}
                </Typography>
              </Box>
              {index < 3 && (
                <Typography 
                  variant="h3" 
                  sx={{ 
                    color: 'primary.main',
                    opacity: 0.5,
                    px: 0.5,
                    userSelect: 'none'
                  }}
                >
                  :
                </Typography>
              )}
            </React.Fragment>
          ))}
        </Box>
      </Box>

      <Box sx={{ mt: 4 }}>
        <CircularProgress size={30} />
        <Typography 
          variant="body2" 
          color="text.secondary" 
          sx={{ mt: 2 }}
        >
          Please wait for the quiz to begin. Do not refresh this page.
        </Typography>
      </Box>
    </Box>
  );

  const renderQuestion = () => (
    <Box sx={{ p: 3 }}>
      {/* Timer */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        mb: 3,
        alignItems: 'center'
      }}>
        <Typography variant="h4" color="primary.main">
          {quizStatus?.title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
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
      </Box>

      {/* Score */}
      <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
        Score: {score}
      </Typography>

      {/* Question */}
      <Typography variant="h5" gutterBottom sx={{ mb: 4 }}>
        {currentQuestion?.question}
      </Typography>

      {/* Options */}
      <Grid container spacing={2}>
        {currentQuestion?.options?.map((option, index) => (
          <Grid item xs={12} sm={6} key={index}>
            <Button
              fullWidth
              variant={selectedAnswer === index ? 'contained' : 'outlined'}
              onClick={() => handleAnswerSubmit(index)}
              sx={{
                p: 2,
                textAlign: 'left',
                backgroundColor: timeLeft === 0 ? (
                  index === currentQuestion.correctAnswer 
                    ? 'success.light'
                    : selectedAnswer === index 
                      ? 'error.light'
                      : 'inherit'
                ) : (
                  selectedAnswer === index 
                    ? 'primary.main' 
                    : 'inherit'
                ),
                '&:hover': {
                  backgroundColor: hasAnswered ? 'inherit' : undefined
                },
                '&.Mui-disabled': {
                  backgroundColor: hasAnswered && selectedAnswer === index 
                    ? 'primary.main' 
                    : undefined,
                  opacity: hasAnswered ? 1 : 0.5
                }
              }}
            >
              {option}
            </Button>
          </Grid>
        ))}
      </Grid>

      {/* Answer feedback - only show when timer is complete */}
      {timeLeft === 0 && (
        <Alert 
          severity={Number(selectedAnswer) === Number(currentQuestion.correctAnswer) ? "success" : "error"}
          sx={{ mt: 3 }}
        >
          {Number(selectedAnswer) === Number(currentQuestion.correctAnswer)
            ? "Correct answer! +10 points" 
            : `Incorrect. The correct answer was: ${currentQuestion.options[currentQuestion.correctAnswer]}`}
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
        {quizStatus?.state === 'not-started' && renderWaitingScreen()}
        {quizStatus?.state === 'active' && currentQuestion && renderQuestion()}
        {quizStatus?.state === 'active' && !currentQuestion && (
          <Box sx={{ textAlign: 'center', p: 4 }}>
            <Typography variant="h6">
              Waiting for the next question...
            </Typography>
            <CircularProgress sx={{ mt: 2 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              The quiz host will start the next question shortly.
            </Typography>
          </Box>
        )}
        {quizStatus?.state === 'finished' && renderFinishedScreen()}
        {!quizStatus?.state && (
          <Box sx={{ textAlign: 'center', p: 4 }}>
            <CircularProgress />
            <Typography variant="body2" sx={{ mt: 2 }}>
              Loading quiz...
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}

export default Quiz; 