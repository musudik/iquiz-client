import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { AppBar, Toolbar, Typography, Container, Box } from "@mui/material";
import CreateQuiz from "./components/CreateQuiz";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import ParticipantRegistration from "./components/ParticipantRegistration";
import Leaderboard from "./components/Leaderboard";
import CreateQuizQuestions from "./components/CreateQuizQuestions";
import ConductQuiz from "./components/ConductQuiz";
import JoinQuiz from "./components/JoinQuiz";
import ViewRegistrations from "./components/ViewRegistrations";
import Quiz from "./components/Quiz";
import "./App.css";
import logo from "./assets/1EuroQuizLogo.jpg";

function App() {
  return (
    <Router>
      <AppBar position="static" sx={{ backgroundColor: "#000102" }}>
        <Toolbar>
          <Box
            component={Link}
            to="/"
            sx={{
              display: "flex",
              alignItems: "center",
              textDecoration: "none",
              flexGrow: 1,
            }}
          >
            <img
              src={logo}
              alt="1EuroQuiz Logo"
              style={{
                height: "40px",
                marginRight: "10px",
              }}
            />
          </Box>
          <Box sx={{ display: "flex", gap: 2 }}>
            <Typography
              component={Link}
              to="/"
              sx={{ color: "white", textDecoration: "none" }}
            >
              Home
            </Typography>
            <Typography
              component={Link}
              to="/manage-quiz"
              sx={{ color: "white", textDecoration: "none" }}
            >
              Manage Quiz
            </Typography>
            <Typography
              component={Link}
              to="/analytics"
              sx={{ color: "white", textDecoration: "none" }}
            >
              Analytics
            </Typography>
            <Typography
              component={Link}
              to="/join"
              sx={{ color: "white", textDecoration: "none" }}
            >
              Join Quiz
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      <Container sx={{ mt: 4 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/manage-quiz" element={<CreateQuiz />} />
          <Route path="/analytics" element={<AnalyticsDashboard />} />
          <Route path="/join" element={<ParticipantRegistration />} />
          <Route path="/leaderboard/:quizId" element={<Leaderboard />} />
          <Route
            path="/quiz/:quizId/questions"
            element={<CreateQuizQuestions />}
          />
          <Route path="/conduct/:quizId" element={<ConductQuiz />} />
          <Route path="/join/:quizId" element={<JoinQuiz />} />
          <Route
            path="/quiz/:quizId/registrations"
            element={<ViewRegistrations />}
          />
          <Route path="/quiz/:quizId" element={<Quiz />} />
        </Routes>
      </Container>
    </Router>
  );
}

// Home component
function Home() {
  return (
    <Box sx={{ textAlign: "center", mt: 4 }}>
      <Typography variant="h3" sx={{ mb: 4 }}>
        Welcome to Real-Time Quiz App
      </Typography>
      <Box sx={{ display: "flex", justifyContent: "center", gap: 4 }}>
        <Box
          component={Link}
          to="/admin"
          sx={{
            p: 3,
            border: "1px solid #007BFF",
            borderRadius: 2,
            textDecoration: "none",
            color: "#007BFF",
            "&:hover": {
              backgroundColor: "#f0f8ff",
            },
          }}
        >
          <Typography variant="h6">Admin Portal</Typography>
          <Typography>Create and manage quizzes</Typography>
        </Box>
        <Box
          component={Link}
          to="/join"
          sx={{
            p: 3,
            border: "1px solid #28A745",
            borderRadius: 2,
            textDecoration: "none",
            color: "#28A745",
            "&:hover": {
              backgroundColor: "#f0fff4",
            },
          }}
        >
          <Typography variant="h6">Join Quiz</Typography>
          <Typography>Participate in a quiz</Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default App;
