require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());

// PostgreSQL pool setup
const pool = new Pool({
  host: process.env.PG_HOST,
  database: process.env.PG_DB,
  user: process.env.PG_USER,
  password: process.env.PG_PASS,
  port: 5432,
  ssl: { rejectUnauthorized: false },
});

// Raw parser for webhook
app.use('/razorpay-webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// Save client data API
app.post('/api/save-client', async (req, res) => {
  try {
    const {
      name, phone, email, dob, age, batchMode, category,
      offerTitle, course, baseAmount, gstAmount, totalAmount
    } = req.body;

    const query = `
      INSERT INTO clients
      (name, phone, email, dob, age, batch_mode, category, offer_title, course, base_amount, gst_amount, total_amount)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING id
    `;

    const values = [name, phone, email, dob, age, batchMode, category, offerTitle, course, baseAmount, gstAmount, totalAmount];

    const result = await pool.query(query, values);

    res.status(201).json({ message: 'Client saved', id: result.rows[0].id });
  } catch (error) {
    console.error('Error saving client:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Razorpay webhook
app.post('/razorpay-webhook', (req, res) => {
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

    // TODO: Update your DB here with payment details & activate user course

  }

  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
