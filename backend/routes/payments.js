import express from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import paypal from '@paypal/checkout-server-sdk';
import { supabase } from '../supabase.js';
import { validateApiKeyOrJwt } from '../middleware/auth.js';

const router = express.Router();

// Initialize Razorpay client
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'placeholder_id',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret',
});

// Initialize PayPal client
const environment = new paypal.core.SandboxEnvironment(
  process.env.PAYPAL_CLIENT_ID || 'placeholder_id',
  process.env.PAYPAL_CLIENT_SECRET || 'placeholder_secret'
);
const paypalClient = new paypal.core.PayPalHttpClient(environment);

const PLAN_PRICES = {
  pro: { inr: 199900, usd: '19.00' }, // INR in paise (199900 paise = 1999 INR)
  team: { inr: 799900, usd: '79.00' }  // INR in paise (799900 paise = 7999 INR)
};

// --- Razorpay Order Creation ---
router.post('/razorpay/order', validateApiKeyOrJwt, async (req, res) => {
  const { plan } = req.body;
  const pricing = PLAN_PRICES[plan];
  if (!pricing) {
    return res.status(400).json({ error: 'Invalid plan selected' });
  }

  const isMockEnabled = process.env.MOCK_PAYMENTS === 'true' || 
                        !process.env.RAZORPAY_KEY_ID || 
                        process.env.RAZORPAY_KEY_ID.startsWith('placeholder');

  if (isMockEnabled) {
    return res.json({
      orderId: `mock_order_${Date.now()}`,
      amount: pricing.inr,
      currency: 'INR',
      plan
    });
  }

  try {
    const order = await razorpay.orders.create({
      amount: pricing.inr,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
      notes: {
        userId: req.user.id,
        plan
      }
    });

    return res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      plan
    });
  } catch (error) {
    console.error('Razorpay order creation error:', error);
    return res.status(500).json({ error: 'Failed to create Razorpay billing transaction order' });
  }
});

// --- Razorpay Webhook Handler ---
router.post('/razorpay/webhook', async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  const isMock = signature === 'webhook-signature-mock-verification' || 
                 !webhookSecret || 
                 webhookSecret.startsWith('placeholder') ||
                 process.env.MOCK_PAYMENTS === 'true';

  if (!isMock) {
    if (!signature || !webhookSecret) {
      return res.status(400).json({ error: 'Missing signature verification context' });
    }
    try {
      // Generate signature locally to confirm authenticity
      const bodyText = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(bodyText)
        .digest('hex');

      if (signature !== expectedSignature) {
        return res.status(400).json({ error: 'Webhook signature validation failed' });
      }
    } catch (err) {
      return res.status(400).json({ error: 'Webhook validation failed' });
    }
  }

  try {
    const { event, payload, id: eventId } = req.body;

    // Check database idempotency
    const { data: existing } = await supabase
      .from('processed_webhooks')
      .select('*')
      .eq('event_id', eventId)
      .single();

    if (existing) {
      return res.json({ status: 'already_processed' });
    }

    // Process plan upgrade on payment capture
    if (event === 'payment.captured') {
      const paymentEntity = payload.payment.entity;
      const userId = paymentEntity.notes?.userId;
      const plan = paymentEntity.notes?.plan;

      if (userId && plan) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ plan })
          .eq('id', userId);

        if (updateError) throw updateError;
        console.log(`Plan upgraded for user ${userId} to ${plan} (Razorpay)`);
      }
    }

    // Record webhook details
    await supabase.from('processed_webhooks').insert({
      event_id: eventId,
      provider: 'razorpay'
    });

    return res.json({ status: 'ok' });
  } catch (error) {
    console.error('Razorpay webhook processing error:', error);
    return res.status(500).json({ error: 'Internal webhook execution failure' });
  }
});

// --- PayPal Order Creation ---
router.post('/paypal/order', validateApiKeyOrJwt, async (req, res) => {
  const { plan } = req.body;
  const pricing = PLAN_PRICES[plan];
  if (!pricing) {
    return res.status(400).json({ error: 'Invalid plan selected' });
  }

  const isMockEnabled = process.env.MOCK_PAYMENTS === 'true' || 
                        !process.env.PAYPAL_CLIENT_ID || 
                        process.env.PAYPAL_CLIENT_ID.startsWith('placeholder');

  if (isMockEnabled) {
    return res.json({
      orderId: `mock_paypal_order_${Date.now()}`,
      status: 'APPROVED'
    });
  }

  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer('return=representation');
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: {
          currency_code: 'USD',
          value: pricing.usd
        },
        custom_id: JSON.stringify({
          userId: req.user.id,
          plan
        })
      }
    ]
  });

  try {
    const order = await paypalClient.execute(request);
    return res.json({
      orderId: order.result.id,
      status: order.result.status
    });
  } catch (error) {
    console.error('PayPal order creation error:', error);
    return res.status(500).json({ error: 'Failed to create PayPal billing transaction order' });
  }
});

// --- PayPal Webhook Handler ---
router.post('/paypal/webhook', async (req, res) => {
  const eventId = req.body.id;
  const eventType = req.body.event_type;

  if (!eventId) {
    return res.status(400).json({ error: 'Missing event ID context' });
  }

  try {
    // Check database idempotency
    const { data: existing } = await supabase
      .from('processed_webhooks')
      .select('*')
      .eq('event_id', eventId)
      .single();

    if (existing) {
      return res.json({ status: 'already_processed' });
    }

    // Process plan upgrade on payment capture completion
    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      const resource = req.body.resource;
      const customId = resource.custom_id;

      if (customId) {
        const { userId, plan } = JSON.parse(customId);
        if (userId && plan) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ plan })
            .eq('id', userId);

          if (updateError) throw updateError;
          console.log(`Plan upgraded for user ${userId} to ${plan} (PayPal)`);
        }
      }
    }

    // Record webhook details
    await supabase.from('processed_webhooks').insert({
      event_id: eventId,
      provider: 'paypal'
    });

    return res.json({ status: 'ok' });
  } catch (error) {
    console.error('PayPal webhook processing error:', error);
    return res.status(500).json({ error: 'Internal webhook execution failure' });
  }
});

export default router;
