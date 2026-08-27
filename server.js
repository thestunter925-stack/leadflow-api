require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(helmet());

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());


/* =========================
   HEALTH CHECK
========================= */

app.get("/", (req, res) => {

  res.json({
    success: true,
    service: "LeadFlow AI Backend",
    status: "online"
  });

});


/* =========================
   API HEALTH
========================= */

app.get("/api/health", (req, res) => {

  res.json({
    success: true,
    message: "LeadFlow AI API is running"
  });

});


/* =========================
   AUTH PLACEHOLD
========================= */

app.post("/api/auth/signup", (req, res) => {

  res.status(501).json({
    success: false,
    message: "Signup backend will be connected in the next step."
  });

});


app.post("/api/auth/login", (req, res) => {

  res.status(501).json({
    success: false,
    message: "Login backend will be connected in the next step."
  });

});


app.post("/api/auth/logout", (req, res) => {

  res.json({
    success: true
  });

});


/* =========================
   CURRENT USER
========================= */

app.get("/api/me", (req, res) => {

  res.status(401).json({
    success: false,
    message: "Authentication required."
  });

});


/* =========================
   USAGE
========================= */

app.get("/api/usage", (req, res) => {

  res.status(401).json({
    success: false,
    message: "Authentication required."
  });

});


/* =========================
   LEADS
========================= */

app.get("/api/leads", (req, res) => {

  res.json({
    success: true,
    leads: []
  });

});


app.post("/api/leads/search", (req, res) => {

  res.status(501).json({
    success: false,
    message: "Verified prospect data source is not connected yet."
  });

});


app.get("/api/leads/:id", (req, res) => {

  res.status(404).json({
    success: false,
    message: "Lead not found."
  });

});


app.post("/api/leads/:id/save", (req, res) => {

  res.status(501).json({
    success: false,
    message: "Lead storage will be connected in the database step."
  });

});


app.patch("/api/leads/:id/status", (req, res) => {

  res.status(501).json({
    success: false,
    message: "Lead status storage will be connected in the database step."
  });

});


/* =========================
   OUTREACH
========================= */

app.post("/api/outreach/generate", (req, res) => {

  res.status(501).json({
    success: false,
    message: "AI outreach service is not connected yet."
  });

});


/* =========================
   PAYMENT
========================= */

app.post("/api/payment/create", (req, res) => {

  res.status(501).json({
    success: false,
    message: "Payment provider will be connected after authentication and database setup."
  });

});


app.get("/api/payment/status", (req, res) => {

  res.status(401).json({
    success: false,
    message: "Authentication required."
  });

});


/* =========================
   PAYMENT WEBHOOK
========================= */

app.post("/api/payment/webhook", (req, res) => {

  res.status(501).json({
    success: false,
    message: "Webhook verification will be implemented with the payment provider."
  });

});


/* =========================
   404
========================= */

app.use((req, res) => {

  res.status(404).json({
    success: false,
    message: "API endpoint not found."
  });

});


/* =========================
   SERVER
========================= */

app.listen(PORT, () => {

  console.log(
    `LeadFlow AI Backend running on port ${PORT}`
  );

});