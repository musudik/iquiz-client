import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { rtdb } from '../firebaseConfig';
import { ref, set, update, onValue, off } from 'firebase/database';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  CircularProgress,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Refresh as ResetIcon,
  Group as ParticipantsIcon,
  Timer as TimerIcon,
} from '@mui/icons-material';
import quizLogo from '../assets/1EuroQuizLogo.jpg';

function ConductQuiz() {
  const { quizId } = useParams();
  const [quizStatus, setQuizStatus] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [participants, setParticipants] = useState({});                                    
  const [isStartDialogOpen, setStartDialogOpen] = useState(false);
  const [isResetDialogOpen, setResetDialogOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(20);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isTimerExpired, setIsTimerExpired] = useState(false);

  // Add buttonStyle definition
  const buttonStyle = {
    backgroundColor: '#000102',
    color: 'white',
    '&:hover': {
    backgroundColor: '#2c2c2c',
    },
    margin: '0 8px',
    textTransform: 'none',
    borderRadius: '8px',
    padding: '8px 24px',
    minWidth: '120px',
    fontWeight: 500,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    '&:disabled': {
    backgroundColor: '#cccccc',
    color: '#666666'
    }
};

  // Fetch quiz data
  useEffect(() => {
    const statusRef = ref(rtdb, `quizzes/${quizId}/status`);
    const questionsRef = ref(rtdb, `quizzes/${quizId}/questions`);
    const participantsRef = ref(rtdb, `quizzes/${quizId}/participants`);
    const unsubscribeStatus = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setQuizStatus(data);
        if (data.state === 'active') {
          setTimeLeft(20); // Reset timer when quiz becomes active
        }
      }
    });

    const unsubscribeQuestions = onValue(questionsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setQuestions(Object.values(data));
    });

    const unsubscribeParticipants = onValue(participantsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setParticipants(data);
    });

    return () => {
      off(statusRef);
      off(questionsRef);
      off(participantsRef);
    };
  }, [quizId]);

 // Timer logic
useEffect(() => {
    let timer;
    if (quizStatus?.state === 'active' && timeLeft > 0) {
      setIsTimerExpired(false);
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsTimerExpired(true);
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
  }, [quizStatus?.state, timeLeft]);
  

  const handleStartQuiz = async () => {
    try {
      await update(ref(rtdb, `quizzes/${quizId}/status`), {
        state: 'active',
        currentQuestion: 0,
        startTime: Date.now()
      });
      setStartDialogOpen(false);
    } catch (error) {
      console.error('Error starting quiz:', error);
    }
  };

  const handleResetQuiz = async () => {
    try {
      const updates = {};
      
      // Reset quiz status
      updates[`quizzes/${quizId}/status`] = {
        state: 'waiting',
        currentQuestion: 0,
        startTime: null
      };

      // Reset all participant scores
      Object.keys(participants).forEach(participantId => {
        updates[`quizzes/${quizId}/participants/${participantId}/score`] = 0;
      });

      await update(ref(rtdb), updates);
      setResetDialogOpen(false);
      setShowLeaderboard(false);
    } catch (error) {
      console.error('Error resetting quiz:', error);
    }
  };

   // Update handleNextQuestion to be more robust
   const handleNextQuestion = useCallback(async () => {
    if (!quizStatus || quizStatus.state !== 'active') return;
  
    const currentQuestion = quizStatus.currentQuestion;
    if (currentQuestion < questions.length - 1) {
      try {
        await update(ref(rtdb, `quizzes/${quizId}/status`), {
          currentQuestion: currentQuestion + 1,
        });
        setTimeLeft(20);
        setIsTimerExpired(false);
      } catch (error) {
        console.error('Error updating question:', error);
      }
    } else {
      // End of quiz
      try {
        await update(ref(rtdb, `quizzes/${quizId}/status`), {
          state: 'finished',
        });
        setShowLeaderboard(true);
      } catch (error) {
        console.error('Error ending quiz:', error);
      }
    }
  }, [quizStatus, questions.length, quizId]);

   // Add timer color logic
   const getTimerColor = () => {
    return timeLeft <= 5 ? '#ff0000' : '#000102';
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header Section */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        mb: 4,
        borderBottom: '2px solid #eee',
        pb: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <img 
            src={quizLogo} 
            alt="Quiz Logo" 
            style={{ 
              height: '40px',
              width: 'auto'
            }}
          />
          <Typography variant="h4" component="h1">
            Bollywood Quiz
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center',
            backgroundColor: '#f5f5f5',
            padding: '8px 16px',
            borderRadius: '20px'
          }}>
            <ParticipantsIcon sx={{ mr: 1 }} />
            <Typography>
              {Object.keys(participants).length} PARTICIPANTS
            </Typography>
          </Box>

          <Button
            startIcon={<PlayIcon />}
            onClick={() => setStartDialogOpen(true)}
            disabled={quizStatus?.state === 'active'}
            sx={buttonStyle}
          >
            Start Quiz
          </Button>

          <Button
            startIcon={<ResetIcon />}
            onClick={() => setResetDialogOpen(true)}
            sx={buttonStyle}
          >
            Reset
          </Button>
        </Box>
      </Box>

      {/* Question Section */}
      <Box sx={{ 
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        p: 3
      }}>
        {questions.length > 0 && quizStatus ? (
          quizStatus.state === 'waiting' ? (
            <Typography variant="h6" align="center">
              Quiz not started. Click "Start Quiz" to begin.
            </Typography>
          ) : (
            <>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                mb: 3
              }}>
                <Typography variant="h6">
                  {
                  quizStatus?.currentQuestion !== undefined &&
                    `Question ${quizStatus?.currentQuestion + 1} of ${questions.length}`
                  }
                  {
                    quizStatus?.currentQuestion == undefined &&
                    'Quiz not started'                    
                  }
                </Typography>
                
                {quizStatus?.state === 'active' && (
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    gap: 1,
                    backgroundColor: '#f5f5f5',
                    padding: '12px 24px',
                    borderRadius: '12px'
                  }}>
                    <TimerIcon sx={{ 
                      fontSize: '2rem',
                      color: getTimerColor()
                    }} />
                    <Typography sx={{ 
                      fontSize: '2rem',
                      fontWeight: 'bold',
                      color: getTimerColor(),
                      minWidth: '60px',
                      textAlign: 'center'
                    }}>
                      {timeLeft}s
                    </Typography>
                  </Box>
                )}
              </Box>

              <Typography variant="h5" sx={{ mb: 3 }}>
                {questions[quizStatus.currentQuestion]?.question}
              </Typography>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                {questions[quizStatus.currentQuestion]?.options.map((option, index) => (
                  <Button
                    key={index}
                    variant="outlined"
                    sx={{
                      p: 2,
                      justifyContent: 'center',
                      textAlign: 'center',
                      borderColor: '#000102',
                      color: '#000102',
                      '&:hover': {
                        backgroundColor: '#000102',
                        color: 'white',
                        borderColor: '#000102',
                      },
                    }}
                  >
                    {option}
                  </Button>
                ))}
              </Box>

              {/* Next Question button */}
              {isTimerExpired && quizStatus?.state === 'active' && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                  <Button
                    onClick={handleNextQuestion}
                    variant="contained"
                    sx={{
                      ...buttonStyle,
                      minWidth: '200px',
                    }}
                  >
                    Next Question
                  </Button>
                </Box>
              )}
            </>
          )
        ) : (
          <Box sx={{ textAlign: 'center', p: 3 }}>
            <CircularProgress />
            <Typography sx={{ mt: 2 }}>Loading quiz...</Typography>
          </Box>
        )}
      </Box>

      {/* Start Quiz Dialog */}
      <Dialog open={isStartDialogOpen} onClose={() => setStartDialogOpen(false)}>
        <DialogTitle>Start Quiz</DialogTitle>
        <DialogContent>
          Are you sure you want to start the quiz? Once started, the timer will begin.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStartDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleStartQuiz}
            sx={buttonStyle}
          >
            Start
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Quiz Dialog */}
      <Dialog open={isResetDialogOpen} onClose={() => setResetDialogOpen(false)}>
        <DialogTitle>Reset Quiz</DialogTitle>
        <DialogContent>
          Are you sure you want to reset the quiz? All progress will be lost.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleResetQuiz}
            color="error"
          >
            Reset
          </Button>
        </DialogActions>
      </Dialog>

      {/* Leaderboard Dialog */}
      <Dialog 
        open={showLeaderboard} 
        fullWidth 
        maxWidth="sm"
      >
        <DialogTitle>Quiz Results</DialogTitle>
        <DialogContent>
          {Object.entries(participants)
            .sort(([, a], [, b]) => (b.score || 0) - (a.score || 0))
            .map(([id, participant], index) => (
              <Box 
                key={id} 
                sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  p: 1,
                  backgroundColor: index === 0 ? '#ffd700' : 'transparent'
                }}
              >
                <Typography>
                  {index + 1}. {participant.name}
                </Typography>
                <Typography>
                  {participant.score || 0} points
                </Typography>
              </Box>
            ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLeaderboard(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ConductQuiz; 