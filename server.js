// require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

/* =========================
   CORS (VERY IMPORTANT)
========================= */
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors());

/* =========================
   NORMAL JSON (ALL APIs)
========================= */
app.use(express.json());

/* =========================
   POSTGRESQL
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
   SAVE CLIENT API
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

    const query = `
      INSERT INTO clients
      (name, phone, email, dob, age, batch_mode, offer_title, course, base_amount, gst_amount, total_amount)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING id
    `;

    const values = [
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
    ];

    const result = await pool.query(query, values);

    res.status(201).json({
      success: true,
      id: result.rows[0].id
    });

  } catch (error) {
    console.error('❌ Save client error:', error);
    res.status(500).json({ error: 'Internal server error' });
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

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(req.body)
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).send('Invalid signature');
    }

    const event = JSON.parse(req.body.toString());

    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;

      console.log('✅ PAYMENT SUCCESS');
      console.log('Payment ID:', payment.id);
      console.log('Amount:', payment.amount / 100);
      console.log('Email:', payment.email);

      // TODO: Update DB payment status here
    }

    res.json({ status: 'ok' });
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
