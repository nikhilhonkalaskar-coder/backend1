// require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const axios = require('axios');
const { Pool } = require('pg');

const app = express();

/* =========================
   CORS (NODE 22 SAFE)
========================= */
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

/* =========================
   JSON FOR NORMAL APIs
========================= */
app.use(express.json());

/* =========================
   POSTGRESQL POOL
========================= */
const pool = new Pool({
  host: process.env.PG_HOST,
  database: process.env.PG_DB,
  user: process.env.PG_USER,
  password: process.env.PG_PASS,
  port: 5432,
  ssl: { rejectUnauthorized: false },
});

/* =========================
   In-memory stores (use DB later)
========================= */
const OTP_STORE = {};
const VERIFIED_USERS = {};

/* =========================
   Helpers
========================= */
const normalizePhone = (phone) => {
  if (!phone) return null;
  return phone.startsWith("91") ? phone.slice(2) : phone;
};

const interaktRequest = axios.create({
  baseURL: "https://api.interakt.ai/v1/public/message/",
  headers: {
    Authorization: `Basic ${process.env.INTERAKT_API_KEY}`,
    "Content-Type": "application/json"
  }
});

/* =========================
   SEND OTP
========================= */
app.post("/api/send-otp", async (req, res) => {
  let { phone } = req.body;
  phone = normalizePhone(phone);

  if (!/^[6-9]\d{9}$/.test(phone)) {
    return res.status(400).json({ success: false, message: "Invalid mobile number" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  OTP_STORE[phone] = {
    otp,
    expires: Date.now() + 5 * 60 * 1000
  };

  console.log("📨 OTP:", otp);

  try {
    await interaktRequest.post("", {
      countryCode: "91",
      phoneNumber: phone,
      type: "Template",
      template: {
        name: "otp_verification",
        languageCode: "en",
        bodyValues: [otp],
        buttonValues: {
          "0": [otp]
        }
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error("OTP error:", err.response?.data || err.message);
    res.status(500).json({ success: false });
  }
});

/* =========================
   VERIFY OTP
========================= */
app.post("/api/verify-otp", async (req, res) => {
  let { phone, otp, name, email, city } = req.body;
  phone = normalizePhone(phone);

  const record = OTP_STORE[phone];
  if (!record) return res.json({ verified: false, message: "OTP not found" });
  if (Date.now() > record.expires) return res.json({ verified: false, message: "OTP expired" });
  if (record.otp !== otp) return res.json({ verified: false, message: "Wrong OTP" });

  delete OTP_STORE[phone];
  VERIFIED_USERS[phone] = true;

  res.json({ verified: true,});
});

/* =========================
   SAVE CLIENT TO DB
========================= */
app.post('/api/save-client', async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      dob,
      age,
      batchMode,
      offerTitle,
      course,
      baseAmount,
      gstAmount,
      totalAmount
    } = req.body;

    const result = await pool.query(
      `INSERT INTO clients
       (name, phone, email, dob, age, batch_mode, offer_title, course, base_amount, gst_amount, total_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        name,
        phone,
        email,
        dob,
        age,
        batchMode,
        offerTitle,
        course,
        baseAmount,
        gstAmount,
        totalAmount
      ]
    );

    res.json({ success: true, id: result.rows[0].id });

  } catch (err) {
    console.error('Save client error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/* =========================
   RAZORPAY WEBHOOK
========================= */
app.post(
  '/razorpay-webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => {

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    const expected = crypto
      .createHmac('sha256', secret)
      .update(req.body)
      .digest('hex');

    if (signature !== expected) {
      return res.status(400).send('Invalid signature');
    }

    const event = JSON.parse(req.body.toString());

    if (event.event === 'payment.captured') {
      const p = event.payload.payment.entity;

      console.log('✅ PAYMENT SUCCESS');
      console.log(p.id, p.amount / 100, p.email);

      // 👉 Update DB using email / phone
    }

    res.json({ status: 'ok' });
  }
);

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});


