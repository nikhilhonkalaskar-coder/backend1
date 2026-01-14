require('dotenv').config();
const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const cors = require('cors');

const app = express();

/* ---------------- CORS ---------------- */
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST']
}));

/* ---------------- JSON (normal APIs) ---------------- */
app.use(express.json());

/* ---------------- RAZORPAY INSTANCE ---------------- */
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET
});

/* ---------------- HEALTH CHECK ---------------- */
app.get('/', (req, res) => {
  res.send('Backend running OK');
});

/* ---------------- SEND KEY (SAFE) ---------------- */
app.get('/razorpay-key', (req, res) => {
  res.json({ key: process.env.RAZORPAY_KEY_ID });
});

/* ---------------- CREATE ORDER ---------------- */
app.post('/create-order', async (req, res) => {
  try {
    const { amount, name, email } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Amount missing' });
    }

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
      notes: { name, email }
    });

    res.json(order);

  } catch (err) {
    console.error('Order Error:', err);
    res.status(500).json({ error: 'Order creation failed' });
  }
});

/* ---------------- WEBHOOK (RAW BODY ONLY) ---------------- */
app.post(
  '/razorpay-webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    try {
      const webhookSecret = process.env.WEBHOOK_SECRET;
      const signature = req.headers['x-razorpay-signature'];

      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(req.body)
        .digest('hex');

      if (signature !== expectedSignature) {
        return res.status(400).send('Invalid signature');
      }

      const event = JSON.parse(req.body.toString());

      if (event.event === 'payment.captured') {
        const payment = event.payload.payment.entity;

        console.log('✅ PAYMENT CONFIRMED');
        console.log('Payment ID:', payment.id);
        console.log('Amount:', payment.amount / 100);
        console.log('Email:', payment.email);

        // 👉 SAVE TO DB
        // 👉 UNLOCK COURSE
        // 👉 SEND WHATSAPP / EMAIL
      }

      res.json({ status: 'ok' });

    } catch (err) {
      console.error('Webhook Error:', err);
      res.status(500).send('Webhook error');
    }
  }
);

/* ---------------- START SERVER ---------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
