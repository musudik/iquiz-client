import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { rtdb } from '../firebaseConfig';
import { ref, get, update } from 'firebase/database';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Button,
  TextField,
  Container,
  List,
  ListItem,
  Radio,
  FormControlLabel,
  Alert,
} from '@mui/material';
import {
  Delete,
  Settings,
  Image,
  Add,
  PlayArrow,
} from '@mui/icons-material';

function CreateQuizQuestions() {
  const { quizId } = useParams();
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState({
    question: '',
    options: [''],
    correctAnswer: 0, // Index of the correct answer
    timeLimit: 20,
  });
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Load existing questions when component mounts
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const quizRef = ref(rtdb, `quizzes/${quizId}`);
        const snapshot = await get(quizRef);
        if (snapshot.exists()) {
          const quizData = snapshot.val();
          if (quizData.questions) {
            setQuestions(quizData.questions);
          }
        }
      } catch (err) {
        setError('Failed to load questions');
        console.error(err);
      }
    };
    loadQuestions();
  }, [quizId]);

  const addOption = () => {
    if (currentQuestion.options.length < 4) { // Limit to 4 options
      setCurrentQuestion({
        ...currentQuestion,
        options: [...currentQuestion.options, '']
      });
    }
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...currentQuestion.options];
    newOptions[index] = value;
    setCurrentQuestion({
      ...currentQuestion,
      options: newOptions
    });
  };

  const handleCorrectAnswerChange = (index) => {
    setCurrentQuestion({
      ...currentQuestion,
      correctAnswer: index
    });
  };

  const removeOption = (indexToRemove) => {
    setCurrentQuestion({
      ...currentQuestion,
      options: currentQuestion.options.filter((_, index) => index !== indexToRemove),
      correctAnswer: currentQuestion.correctAnswer === indexToRemove ? 0 : currentQuestion.correctAnswer
    });
  };

  const addQuestion = async () => {
    // Validate question
    if (!currentQuestion.question.trim()) {
      setError('Question text is required');
      return;
    }
    if (currentQuestion.options.some(opt => !opt.trim())) {
      setError('All options must be filled');
      return;
    }

    try {
      const newQuestions = [...questions, currentQuestion];
      const quizRef = ref(rtdb, `quizzes/${quizId}`);
      await update(quizRef, { questions: newQuestions });
      
      setQuestions(newQuestions);
      setCurrentQuestion({
        question: '',
        options: [''],
        correctAnswer: 0,
        timeLimit: 20,
      });
      setSuccessMessage('Question added successfully!');
      setError(null);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to save question');
      console.error(err);
    }
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Container maxWidth="md" sx={{ mt: 4 }}>
        {/* Question Counter */}
        <Typography variant="h6" sx={{ mb: 2 }}>
          Total Questions: {questions.length}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}
        {successMessage && (
          <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>
        )}

        {/* Question Editor */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="body2">
              Quiz question • Time limit: {currentQuestion.timeLimit} sec
            </Typography>
            <Box>
              <IconButton size="small"><Image /></IconButton>
              <IconButton size="small"><Settings /></IconButton>
            </Box>
          </Box>

          <TextField
            fullWidth
            placeholder="Type your question"
            variant="standard"
            value={currentQuestion.question}
            onChange={(e) => setCurrentQuestion({
              ...currentQuestion,
              question: e.target.value
            })}
            sx={{ mb: 3 }}
          />

          <List>
            {currentQuestion.options.map((option, index) => (
              <ListItem key={index} sx={{ pl: 0 }}>
                <FormControlLabel
                  control={
                    <Radio
                      checked={currentQuestion.correctAnswer === index}
                      onChange={() => handleCorrectAnswerChange(index)}
                    />
                  }
                  label=""
                />
                <TextField
                  fullWidth
                  placeholder={`Option ${index + 1}`}
                  variant="standard"
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                />
                {currentQuestion.options.length > 1 && (
                  <IconButton size="small" onClick={() => removeOption(index)}>
                    <Delete />
                  </IconButton>
                )}
              </ListItem>
            ))}
          </List>

          {currentQuestion.options.length < 4 && (
            <Button
              startIcon={<Add />}
              onClick={addOption}
              sx={{ mt: 2 }}
            >
              Add option
            </Button>
          )}
        </Paper>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={addQuestion}
            disabled={!currentQuestion.question.trim() || currentQuestion.options.some(opt => !opt.trim())}
          >
            Save Question
          </Button>
        </Box>

        {/* Questions List */}
        {questions.length > 0 && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Added Questions</Typography>
            {questions.map((q, index) => (
              <Paper key={index} sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle1">
                  {index + 1}. {q.question}
                </Typography>
                <List dense>
                  {q.options.map((opt, optIndex) => (
                    <ListItem key={optIndex}>
                      <Radio
                        checked={q.correctAnswer === optIndex}
                        disabled
                      />
                      <Typography>{opt}</Typography>
                    </ListItem>
                  ))}
                </List>
              </Paper>
            ))}
          </Paper>
        )}
      </Container>
    </Box>
  );
}

export default CreateQuizQuestions;