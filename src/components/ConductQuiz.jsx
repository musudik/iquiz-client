import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { rtdb } from '../firebaseConfig';
import { ref, set, update, onValue, off, serverTimestamp, get } from 'firebase/database';
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
  const [showAnswer, setShowAnswer] = useState(false);

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
        questionStartTime: serverTimestamp(),
        startTime: serverTimestamp()
      });
      setStartDialogOpen(false);
    } catch (error) {
      console.error('Error starting quiz:', error);
    }
  };

  const handleResetQuiz = async () => {
    try {
      // First get all registrations
      const registrationsRef = ref(rtdb, `quizzes/${quizId}/registrations`);
      const registrationsSnapshot = await get(registrationsRef);
      const registrations = registrationsSnapshot.val();

      if (!registrations) {
        console.log('No registrations found to reset');
        return;
      }

      // Create updates object
      const updates = {};
      
      // Reset quiz status
      updates[`quizzes/${quizId}/status`] = {
        state: 'waiting',
        currentQuestion: 0,
        startTime: null,
        questionStartTime: null
      };

      // Reset each participant's score and remove their answers
      Object.keys(registrations).forEach(registrationId => {
        // Reset score to 0
        updates[`quizzes/${quizId}/registrations/${registrationId}/score`] = 0;
        // Remove answers by setting to null
        updates[`quizzes/${quizId}/registrations/${registrationId}/answers`] = null;
      });

      console.log('Resetting quiz with updates:', updates);

      // Apply all updates in one batch
      await update(ref(rtdb), updates);
      
      setResetDialogOpen(false);
      setShowLeaderboard(false);
      console.log('Quiz reset successful');
    } catch (error) {
      console.error('Error resetting quiz:', error);
    }
  };

   // Update handleNextQuestion to be more robust
   const handleNextQuestion = async () => {
    try {
      const nextQuestionIndex = (quizStatus.currentQuestion || 0) + 1;
      if (nextQuestionIndex < questions.length) {
        await update(ref(rtdb, `quizzes/${quizId}/status`), {
          currentQuestion: nextQuestionIndex,
          questionStartTime: serverTimestamp(),
          state: 'active'
        });
      } else {
        await update(ref(rtdb, `quizzes/${quizId}/status`), {
          state: 'finished'
        });
        setShowLeaderboard(true);
      }
    } catch (error) {
      console.error('Error moving to next question:', error);
    }
  };

   // Add timer color logic
   const getTimerColor = () => {
    return timeLeft <= 5 ? '#ff0000' : '#000102';
  };

  // Add function to calculate participant statistics
  const calculateParticipantStats = useCallback((participant) => {
    if (!participant.answers) return { score: 0, avgTime: 0, correctAnswers: 0 };

    const answers = Object.values(participant.answers);
    const correctAnswers = answers.filter(a => a.isCorrect).length;
    const totalTime = answers.reduce((sum, a) => sum + a.timeToAnswer, 0);
    const avgTime = answers.length > 0 ? totalTime / answers.length : 0;

    return {
      score: participant.score || 0,
      avgTime: Math.round(avgTime / 1000), // Convert to seconds
      correctAnswers
    };
  }, []);

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
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 3 }}>
                  <Button
                    onClick={() => setShowAnswer(true)}
                    variant="outlined"
                    sx={{
                      ...buttonStyle,
                      minWidth: '200px',
                    }}
                  >
                    Show Answer
                  </Button>
                  <Button
                    onClick={() => {
                      handleNextQuestion();
                      setShowAnswer(false); // Reset show answer state
                    }}
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

              {showAnswer && isTimerExpired && quizStatus?.state === 'active' && (
                <Box sx={{ mt: 3, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
                  <Typography variant="h6" color="success.dark">
                    Correct Answer: {questions[quizStatus.currentQuestion]?.options[questions[quizStatus.currentQuestion]?.correctAnswer]}
                  </Typography>
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
        maxWidth="md"
      >
        <DialogTitle>Quiz Results</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Final Standings
            </Typography>
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: '50px 1fr 100px 120px 100px',
              gap: 2,
              p: 1,
              borderBottom: '1px solid #eee',
              fontWeight: 'bold'
            }}>
              <Typography>Rank</Typography>
              <Typography>Name</Typography>
              <Typography align="right">Score</Typography>
              <Typography align="right">Avg Time</Typography>
              <Typography align="right">Correct</Typography>
            </Box>
            {Object.entries(participants)
              .map(([id, participant]) => ({
                id,
                ...participant,
                ...calculateParticipantStats(participant)
              }))
              .sort((a, b) => b.score - a.score || a.avgTime - b.avgTime)
              .map((participant, index) => (
                <Box 
                  key={participant.id} 
                  sx={{ 
                    display: 'grid',
                    gridTemplateColumns: '50px 1fr 100px 120px 100px',
                    gap: 2,
                    p: 1,
                    bgcolor: index === 0 ? 'rgba(255, 215, 0, 0.1)' : 'transparent',
                    '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.02)' }
                  }}
                >
                  <Typography>{index + 1}</Typography>
                  <Typography>{participant.name}</Typography>
                  <Typography align="right">{participant.score}</Typography>
                  <Typography align="right">{participant.avgTime}s</Typography>
                  <Typography align="right">{participant.correctAnswers}/{questions.length}</Typography>
                </Box>
              ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLeaderboard(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ConductQuiz; 