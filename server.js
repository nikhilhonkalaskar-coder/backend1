const express = require('express');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
app.use(cors());

// IMPORTANT: raw body needed for webhook
app.use('/razorpay-webhook', express.raw({type: 'application/json'}));
app.use(express.json());



/* CREATE ORDER */
app.post('/create-order', async (req,res)=>{
  const { amount, email, name } = req.body;

  const order = await razorpay.orders.create({
    amount: amount * 100,
    currency: 'INR',
    receipt: `rcpt_${Date.now()}`,
    notes: { name, email }
  });

  res.json(order);
});

/* WEBHOOK */
app.post('/razorpay-webhook', (req,res)=>{
  const webhookSecret = 'Tbipl@123';

  const razorpaySignature = req.headers['x-razorpay-signature'];

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(req.body)
    .digest('hex');

  if (expectedSignature !== razorpaySignature) {
    return res.status(400).send('Invalid signature');
  }

  const event = JSON.parse(req.body.toString());

  if (event.event === 'payment.captured') {
    const payment = event.payload.payment.entity;

    console.log('✅ Payment confirmed:', payment.id);
    console.log('Amount:', payment.amount / 100);
    console.log('Email:', payment.email);

    // 👉 SAVE TO DB
    // 👉 ENABLE COURSE ACCESS
    // 👉 SEND WHATSAPP / EMAIL
  }

  res.json({status: 'ok'});
});

app.listen(3000,()=>console.log('Server running on 3000'));
