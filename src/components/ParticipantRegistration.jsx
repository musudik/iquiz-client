// src/components/ParticipantRegistration.js
import React, { useState, useEffect } from "react";
import { rtdb } from "../firebaseConfig";
import { ref, push, set, get } from "firebase/database";
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Alert,
  IconButton,
  RadioGroup,
  FormControlLabel,
  Radio,
} from "@mui/material";
import {
  AccessTime,
  Group,
  AttachMoney,
  QuestionAnswer,
  Close as CloseIcon,
} from "@mui/icons-material";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { loadStripe } from "@stripe/stripe-js";
import axios from "axios"; // Add axios for making HTTP requests

const API_URL = import.meta.env.PROD
  ? "https://iquiz-server.replit.app"
  : "http://localhost:3000";

// Add this function at the top of your component to generate a unique quiz link
const generateUniqueQuizLink = (quizId, email, name) => {
  // Handle Unicode characters properly
  const userInfo = `${email}:${name}`;
  const encodedInfo = btoa(encodeURIComponent(userInfo));
  return `${window.location.origin}/quiz/${quizId}?participant=${encodedInfo}`;
};

function ParticipantRegistration() {
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("stripe");
  const [iban, setIban] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    try {
      const quizzesRef = ref(rtdb, "quizzes");
      const snapshot = await get(quizzesRef);
      if (snapshot.exists()) {
        const quizzesData = [];
        snapshot.forEach((childSnapshot) => {
          const quiz = childSnapshot.val();
          quizzesData.push({
            id: childSnapshot.key,
            ...quiz,
          });
        });
        setQuizzes(quizzesData);
      }
    } catch (error) {
      console.error("Error fetching quizzes:", error);
      setError("Failed to load quizzes");
    }
  };

  const validateForm = () => {
    const errors = {};

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      errors.email = "Please enter a valid email address";
    }

    // Mobile validation
    const mobileRegex = /^\+?[\d\s-]{10,}$/;
    if (!mobile || !mobileRegex.test(mobile)) {
      errors.mobile = "Please enter a valid mobile number";
    }

    // Name validation
    if (!name.trim()) {
      errors.name = "Please enter your name";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async () => {
    try {
      if (!validateForm()) {
        return;
      }

      // Generate unique quiz link
      const quizLink = generateUniqueQuizLink(selectedQuiz.id, email, name);

      // Create registration under quiz's registrations node
      const registrationsRef = ref(
        rtdb,
        `quizzes/${selectedQuiz.id}/registrations`,
      );
      const newRegistrationRef = push(registrationsRef);

      await set(newRegistrationRef, {
        name,
        email,
        mobile,
        registeredAt: new Date().toISOString(),
        paymentMethod,
        paymentStatus: "completed",
        quizLink, // Store the unique link in the registration
      });

      // Send email with unique quiz link
      try {
        const response = await axios.post(`${API_URL}/api/send-email`, {
          to: email,
          name,
          quizTitle: selectedQuiz.title,
          quizDate: selectedQuiz.date,
          fees: selectedQuiz.fees,
          quizLink,
          emailType: "registration-confirmation",
        });

        console.log("Email sent:", response.data);
      } catch (emailError) {
        console.error(
          "Failed to send email:",
          emailError.response?.data || emailError,
        );
        setError(
          "Registration successful but failed to send confirmation email. Please contact support.",
        );
      }

      setSuccess(
        "Registration successful! Check your email for confirmation and quiz link.",
      );
      setName("");
      setEmail("");
      setMobile("");
      setOpenDialog(false);
      setSelectedQuiz(null);

      setTimeout(() => setSuccess(""), 5000);
    } catch (error) {
      console.error("Error registering:", error);
      setError("Failed to register. Please try again.");
    }
  };

  const validateIBAN = (iban) => {
    // Basic IBAN format validation - you might want to use a library like 'ibantools' for proper validation
    const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$/;
    return ibanRegex.test(iban.replace(/\s/g, ""));
  };

  const handlePayment = async () => {
    try {
      switch (paymentMethod) {
        case "stripe":
          const stripe = await loadStripe(
            import.meta.env.VITE_STRIPE_PUBLIC_KEY,
          );
          const { data: clientSecret } = await axios.post(
            "/create-payment-intent",
            {
              amount: selectedQuiz.fees * 100, // Convert to cents
            },
          );
          const { error } = await stripe.redirectToCheckout({
            sessionId: clientSecret,
          });
          if (error) {
            setError("Stripe payment failed. Please try again.");
            return;
          }
          break;
        case "paypal":
          // PayPal payment will be handled by PayPal component
          // Ensure registration is completed after successful PayPal transaction
          break;
        case "bank":
          if (!iban.trim() || !validateIBAN(iban.trim())) {
            setError("Please enter valid IBAN");
            return;
          }

          // Generate unique quiz link
          const quizLink = generateUniqueQuizLink(selectedQuiz.id, email, name);

          // Create registration under quiz's registrations node
          const registrationsRef = ref(
            rtdb,
            `quizzes/${selectedQuiz.id}/registrations`,
          );
          const newRegistrationRef = push(registrationsRef);

          await set(newRegistrationRef, {
            name,
            email,
            mobile,
            registeredAt: new Date().toISOString(),
            paymentMethod: "bank",
            paymentStatus: "pending",
            iban: iban.trim(),
            quizLink, // Store the unique link in the registration
          });

          // Send email with unique quiz link
          try {
            const response = await axios.post(`${API_URL}/api/send-email`, {
              to: email,
              name,
              quizTitle: selectedQuiz.title,
              quizDate: selectedQuiz.date,
              fees: selectedQuiz.fees,
              iban: iban.trim(),
              quizLink,
              emailType: "bank-transfer",
            });

            console.log("Email sent:", response.data);
          } catch (emailError) {
            console.error(
              "Failed to send email:",
              emailError.response?.data || emailError,
            );
            setError(
              "Registration successful but failed to send confirmation email. Please contact support.",
            );
          }

          setSuccess(
            "Registration pending. Please complete the bank transfer. Check your email for details and quiz link.",
          );
          setOpenDialog(false);
          break;
      }
    } catch (error) {
      console.error("Payment error:", error);
      setError("Payment failed. Please try again.");
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Typography variant="h4" gutterBottom>
        Available Quizzes
      </Typography>

      <Grid container spacing={3}>
        {quizzes.map((quiz) => (
          <Grid item xs={12} sm={6} md={4} key={quiz.id}>
            <Card
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                transition: "transform 0.2s",
                "&:hover": {
                  transform: "translateY(-4px)",
                  boxShadow: 4,
                },
              }}
            >
              <CardContent>
                <Typography variant="h5" component="div" gutterBottom>
                  {quiz.title}
                </Typography>

                <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                  <AccessTime sx={{ mr: 1, color: "text.secondary" }} />
                  <Typography variant="body2" color="text.secondary">
                    {new Date(quiz.date).toLocaleString()}
                  </Typography>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                  <Group sx={{ mr: 1, color: "text.secondary" }} />
                  <Typography variant="body2" color="text.secondary">
                    {quiz.participants} participants max
                  </Typography>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                  <AttachMoney sx={{ mr: 1, color: "text.secondary" }} />
                  <Typography variant="body2" color="text.secondary">
                    Entry Fee: ${quiz.fees}
                  </Typography>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                  <QuestionAnswer sx={{ mr: 1, color: "text.secondary" }} />
                  <Typography variant="body2" color="text.secondary">
                    {quiz.questions?.length || 0} questions
                  </Typography>
                </Box>

                <Chip
                  label={quiz.status === "active" ? "Active" : "Upcoming"}
                  color={quiz.status === "active" ? "success" : "primary"}
                  size="small"
                  sx={{ mt: 1 }}
                />
              </CardContent>

              <CardActions sx={{ mt: "auto", p: 2 }}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => {
                    setSelectedQuiz(quiz);
                    setOpenDialog(true);
                  }}
                >
                  Register Now
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Registration Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>
          Register for Quiz
          <IconButton
            aria-label="close"
            onClick={() => setOpenDialog(false)}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedQuiz && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>
                {selectedQuiz.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Date: {new Date(selectedQuiz.date).toLocaleString()}
              </Typography>
              <TextField
                required
                margin="dense"
                label="Your Name"
                type="text"
                fullWidth
                variant="outlined"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={!!formErrors.name}
                helperText={formErrors.name}
                sx={{ mb: 2 }}
              />

              <TextField
                required
                margin="dense"
                label="Email"
                type="email"
                fullWidth
                variant="outlined"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={!!formErrors.email}
                helperText={formErrors.email}
                sx={{ mb: 2 }}
              />

              <TextField
                required
                margin="dense"
                label="Mobile Number"
                type="tel"
                fullWidth
                variant="outlined"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                error={!!formErrors.mobile}
                helperText={formErrors.mobile}
                sx={{ mb: 2 }}
              />

              <Typography variant="h6" gutterBottom>
                Payment Method
              </Typography>

              <RadioGroup
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <FormControlLabel
                  value="stripe"
                  control={<Radio />}
                  label="Credit Card (Stripe)"
                />
                <FormControlLabel
                  value="paypal"
                  control={<Radio />}
                  label="PayPal"
                />
                <FormControlLabel
                  value="bank"
                  control={<Radio />}
                  label="Bank Transfer"
                />
              </RadioGroup>

              {paymentMethod === "bank" && (
                <TextField
                  margin="dense"
                  label="IBAN"
                  type="text"
                  fullWidth
                  variant="outlined"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  sx={{ mt: 2 }}
                />
              )}

              {paymentMethod === "paypal" && (
                <PayPalScriptProvider
                  options={{
                    "client-id": import.meta.env.VITE_PAYPAL_CLIENT_ID,
                    intent: "capture",
                    currency: "EUR",
                  }}
                >
                  <PayPalButtons
                    createOrder={(data, actions) => {
                      return actions.order.create({
                        purchase_units: [
                          {
                            amount: {
                              value: selectedQuiz.fees.toString(),
                            },
                          },
                        ],
                      });
                    }}
                    onApprove={async (data, actions) => {
                      await actions.order.capture();
                      await handleRegister();
                    }}
                    onError={(err) => {
                      console.error("PayPal Checkout onError", err);
                      setError("Payment failed. Please try again.");
                    }}
                  />
                </PayPalScriptProvider>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          {paymentMethod !== "paypal" && (
            <Button variant="contained" onClick={handlePayment}>
              Pay & Register
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default ParticipantRegistration;
