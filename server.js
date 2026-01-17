// ======================
// ENV SETUP
// ======================
// require("dotenv").config();

const express = require("express");
const crypto = require("crypto");
const cors = require("cors");
const axios = require("axios");
const { Pool } = require("pg");

const app = express();

// ======================
// MIDDLEWARE
// ======================
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// ======================
// DATABASE (POSTGRES)
// ======================
const pool = new Pool({
  host: process.env.PG_HOST,
  database: process.env.PG_DB,
  user: process.env.PG_USER,
  password: process.env.PG_PASS,
  port: 5432,
  ssl: { rejectUnauthorized: false },
});

// ======================
// OTP MEMORY STORE
// ======================
const OTP_STORE = {};

// ======================
// HELPERS
// ======================
const normalizePhone = (phone) =>
  phone.replace(/\D/g, "").slice(-10);

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// ======================
// INTERAKT API
// ======================
const interakt = axios.create({
  baseURL: "https://api.interakt.ai/v1/public/message/",
  headers: {
    Authorization: `Basic ${process.env.INTERAKT_API_KEY}`,
    "Content-Type": "application/json"
  },
  timeout: 8000,
});

// ======================
// SEND OTP (FAST)
// ======================
app.post("/api/send-otp", async (req, res) => {
  let { phone } = req.body;
  phone = normalizePhone(phone);

  if (!/^[6-9]\d{9}$/.test(phone)) {
    return res.json({ success: false, message: "Invalid number" });
  }

  const otp = generateOTP();

  OTP_STORE[phone] = {
    otp,
    expires: Date.now() + 2 * 60 * 1000 // 2 min
  };

  console.log("📨 OTP:", otp);

  // ⚡ Send response instantly
  res.json({ success: true });

  // 🔥 Send WhatsApp OTP in background
  interakt.post("", {
    countryCode: "91",
    phoneNumber: phone,
    type: "Template",
    template: {
      name: "otp_verification",
      languageCode: "en",
      bodyValues: [otp]
    }
  }).catch(err => {
    console.error("WhatsApp OTP Failed:",
      err.response?.data || err.message
    );
  });
});

// ======================
// VERIFY OTP
// ======================
app.post("/api/verify-otp", (req, res) => {
  let { phone, otp } = req.body;
  phone = normalizePhone(phone);

  const record = OTP_STORE[phone];

  if (!record)
    return res.json({ verified: false, message: "OTP not found" });

  if (Date.now() > record.expires)
    return res.json({ verified: false, message: "OTP expired" });

  if (record.otp !== otp)
    return res.json({ verified: false, message: "Invalid OTP" });

  delete OTP_STORE[phone];

  res.json({ verified: true });
});

// ======================
// SAVE CLIENT
// ======================
app.post("/api/save-client", async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      dob,
      city,
      program,
      totalAmount
    } = req.body;

    const result = await pool.query(
      `INSERT INTO clients
       (name, phone, email, dob, city, program, total_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      [
        name,
        normalizePhone(phone),
        email,
        dob,
        city,
        program,
        totalAmount
      ]
    );

    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error("Save client error:", err);
    res.status(500).json({ success: false });
  }
});

// ======================
// RAZORPAY WEBHOOK
// ======================
app.post(
  "/razorpay-webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];

    const expected = crypto
      .createHmac("sha256", secret)
      .update(req.body)
      .digest("hex");

    if (signature !== expected) {
      return res.status(400).send("Invalid signature");
    }

    const event = JSON.parse(req.body.toString());

    if (event.event === "payment.captured") {
      const p = event.payload.payment.entity;
      console.log("✅ PAYMENT SUCCESS:", p.id, p.amount / 100);
      // update DB if required
    }

    res.json({ status: "ok" });
  }
);

// ======================
// SERVER START
// ======================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
