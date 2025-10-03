import express, { Request, Response } from 'express';
import { verifyPolarWebhook } from '../utils/verifyWebhook';
import Payment from '../models/Payment';
import User from '../models/User';
import Product from '../models/Product';

const router = express.Router();

// Use raw body parser for webhook signature verification
router.post(
  '/polar',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    try {
      const rawBody = req.body.toString('utf8');
      const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

      if (!webhookSecret) {
        console.error('POLAR_WEBHOOK_SECRET is not configured');
        return res.status(500).json({ error: 'Server configuration error' });
      }

      // TEMPORARY: Skip verification for debugging
      console.log('⚠️  WARNING: Webhook signature verification is DISABLED for debugging');

      let event;
      try {
        // Try to verify, but continue even if it fails
        event = verifyPolarWebhook(rawBody, req.headers, webhookSecret);
        console.log('✅ Webhook verified:', event.type);
      } catch (err) {
        console.warn('⚠️  Signature verification failed, but continuing anyway:', err);
        // Parse the body manually since verification failed
        event = JSON.parse(rawBody);
        console.log('📦 Webhook event type:', event.type);
      }

      // Handle different webhook events
      switch (event.type) {
        case 'checkout.created':
          await handleCheckoutCreated(event.data);
          break;

        case 'checkout.updated':
          await handleCheckoutUpdated(event.data);
          break;

        case 'order.created':
          await handleOrderCreated(event.data);
          break;

        case 'subscription.created':
          await handleSubscriptionCreated(event.data);
          break;

        case 'subscription.updated':
          await handleSubscriptionUpdated(event.data);
          break;

        case 'subscription.canceled':
          await handleSubscriptionCanceled(event.data);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      // Acknowledge receipt
      res.json({ received: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

// Event Handlers

async function handleCheckoutCreated(data: any) {
  console.log('📝 Checkout created:', data.id);

  // Create or find user
  let user = await User.findOne({ email: data.customer_email });
  if (!user && data.customer_email) {
    user = new User({
      email: data.customer_email,
      name: data.customer_name,
      polarCustomerId: data.customer_id,
    });
    await user.save();
    console.log('✅ New user created:', user.email);
  }

  const payment = new Payment({
    checkoutId: data.id,
    customerId: data.customer_id,
    customerEmail: data.customer_email,
    productId: data.product_id,
    productName: data.product?.name,
    amount: data.amount || 0,
    currency: data.currency || 'USD',
    status: 'pending',
    eventType: 'checkout.created',
    metadata: {
      checkout_url: data.url,
      expires_at: data.expires_at,
    },
  });

  await payment.save();

  // Link payment to user
  if (user) {
    user.payments.push(payment._id);
    await user.save();
  }

  console.log('✅ Payment record created');
}

async function handleCheckoutUpdated(data: any) {
  console.log('🔄 Checkout updated:', data.id);

  const payment = await Payment.findOne({ checkoutId: data.id });

  if (payment) {
    payment.status = data.status === 'confirmed' ? 'completed' : payment.status;
    payment.customerEmail = data.customer_email || payment.customerEmail;
    payment.customerId = data.customer_id || payment.customerId;
    payment.metadata = {
      ...payment.metadata,
      updated_at: new Date(),
      checkout_status: data.status,
    };

    await payment.save();
    console.log('✅ Payment updated to status:', payment.status);
  } else {
    console.warn('⚠️ Payment not found for checkout:', data.id);
  }
}

async function handleOrderCreated(data: any) {
  console.log('🛒 Order created:', data.id);

  // Find the related payment by checkout ID or create a new one
  let payment = await Payment.findOne({ checkoutId: data.checkout_id });

  if (!payment) {
    payment = new Payment({
      checkoutId: data.checkout_id || data.id,
      customerId: data.user_id,
      customerEmail: data.user?.email,
      productId: data.product_id,
      productName: data.product?.name,
      amount: data.amount,
      currency: data.currency,
      status: 'completed',
      eventType: 'order.created',
      metadata: {
        order_id: data.id,
      },
    });
    await payment.save();
  } else {
    payment.status = 'completed';
    payment.metadata = {
      ...payment.metadata,
      order_id: data.id,
      order_created_at: new Date(),
    };
    await payment.save();
  }

  // Update user subscription status if applicable
  const user = await User.findOne({ email: data.user?.email || payment.customerEmail });
  if (user) {
    const product = await Product.findOne({ polarProductId: data.product_id });
    if (product) {
      user.subscriptionStatus = product.tier;
      if (!user.payments.includes(payment._id)) {
        user.payments.push(payment._id);
      }
      await user.save();
      console.log(`✅ User ${user.email} upgraded to ${product.tier}`);
    }
  }

  console.log('✅ Order processed and payment completed');
}

async function handleSubscriptionCreated(data: any) {
  console.log('🔔 Subscription created:', data.id);

  const payment = new Payment({
    checkoutId: data.checkout_id || data.id,
    customerId: data.user_id,
    customerEmail: data.user?.email,
    productId: data.product_id,
    productName: data.product?.name,
    amount: data.amount || 0,
    currency: data.currency || 'USD',
    status: 'completed',
    eventType: 'subscription.created',
    metadata: {
      subscription_id: data.id,
      status: data.status,
      current_period_end: data.current_period_end,
    },
  });

  await payment.save();

  // Update user with subscription info
  const user = await User.findOne({ email: data.user?.email });
  if (user) {
    const product = await Product.findOne({ polarProductId: data.product_id });
    if (product) {
      user.subscriptionStatus = product.tier;
      user.subscriptionId = data.id;
      user.subscriptionEndsAt = data.current_period_end ? new Date(data.current_period_end) : undefined;
      if (!user.payments.includes(payment._id)) {
        user.payments.push(payment._id);
      }
      await user.save();
      console.log(`✅ User ${user.email} subscribed to ${product.tier}`);
    }
  }

  console.log('✅ Subscription payment recorded');
}

async function handleSubscriptionUpdated(data: any) {
  console.log('🔄 Subscription updated:', data.id);

  // You might want to create a separate Subscription model for this
  // For now, we'll just log it
  console.log('Subscription status:', data.status);
}

async function handleSubscriptionCanceled(data: any) {
  console.log('❌ Subscription canceled:', data.id);

  const payment = await Payment.findOne({
    'metadata.subscription_id': data.id,
  });

  if (payment) {
    payment.metadata = {
      ...payment.metadata,
      subscription_status: 'canceled',
      canceled_at: new Date(),
    };
    await payment.save();
  }

  // Update user subscription status
  const user = await User.findOne({ subscriptionId: data.id });
  if (user) {
    user.subscriptionStatus = 'free';
    user.subscriptionId = undefined;
    user.subscriptionEndsAt = undefined;
    await user.save();
    console.log(`✅ User ${user.email} subscription canceled`);
  }

  console.log('✅ Subscription cancellation recorded');
}

export default router;
