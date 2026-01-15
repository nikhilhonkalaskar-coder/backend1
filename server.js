const express = require('express');
// const Razorpay = require('razorpay');
const crypto = require('crypto');
const cors = require('cors');
// require('dotenv').config();

const app = express();
app.use(cors());

// 🔴 Webhook needs RAW body
app.use('/razorpay-webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// ✅ Razorpay instance (MANDATORY)
// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET
// });

/* =============================
   CREATE ORDER API
============================= */
// app.post('/create-order', async (req, res) => {
//   try {
//     const { amount, name, email, phone, batchMode, category, age } = req.body;

//     if (!amount || !name || !email) {
//       return res.status(400).json({ error: 'Invalid data' });
//     }

//     const order = await razorpay.orders.create({
//       amount: amount * 100, // paise
//       currency: 'INR',
//       receipt: `rcpt_${Date.now()}`,
//       notes: {
//         name,
//         email,
//         phone,
//         batchMode,
//         category,
//         age
//       }
//     });

//     res.json(order);

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Order creation failed' });
//   }
// });

/* =============================
   RAZORPAY WEBHOOK
============================= */
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

    // 👉 SAVE TO DATABASE
    // 👉 ACTIVATE COURSE
    // 👉 SEND WHATSAPP MESSAGE
  }

  res.json({ status: 'ok' });
});

/* =============================
   START SERVER
============================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);

