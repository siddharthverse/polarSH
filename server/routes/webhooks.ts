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
      const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

      if (!webhookSecret) {
        console.error('POLAR_WEBHOOK_SECRET is not configured');
        return res.status(500).json({ error: 'Server configuration error' });
      }

      // Verify webhook signature using Polar's SDK
      // req.body is a Buffer when using express.raw()
      let event;
      try {
        event = verifyPolarWebhook(req.body, req.headers, webhookSecret);
        console.log('✅ Webhook verified:', event.type);
        console.log('📦 Full event payload:', JSON.stringify(event, null, 2));
      } catch (err) {
        console.error('Webhook verification failed:', err);
        return res.status(401).json({ error: 'Invalid signature' });
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
  let user = await User.findOne({ email: data.customerEmail });
  if (!user && data.customerEmail) {
    user = new User({
      email: data.customerEmail,
      name: data.customerName,
      polarCustomerId: data.customerId,
    });
    await user.save();
    console.log('✅ New user created:', user.email);
  }

  const payment = new Payment({
    checkoutId: data.id,
    customerId: data.customerId,
    customerEmail: data.customerEmail,
    productId: data.productId,
    productName: data.product?.name,
    amount: data.amount || 0,
    currency: data.currency || 'USD',
    status: 'pending',
    eventType: 'checkout.created',
    metadata: {
      checkout_url: data.url,
      expires_at: data.expiresAt,
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
    payment.customerEmail = data.customerEmail || payment.customerEmail;
    payment.customerId = data.customerId || payment.customerId;
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
  let payment = await Payment.findOne({ checkoutId: data.checkoutId });

  if (!payment) {
    payment = new Payment({
      checkoutId: data.checkoutId || data.id,
      customerId: data.customerId,
      customerEmail: data.customer?.email,
      productId: data.productId,
      productName: data.product?.name,
      amount: data.totalAmount,
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
  const user = await User.findOne({ email: data.customer?.email || payment.customerEmail });
  if (user) {
    const product = await Product.findOne({ polarProductId: data.productId });
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
    checkoutId: data.checkoutId || data.id,
    customerId: data.customerId,
    customerEmail: data.customer?.email,
    productId: data.productId,
    productName: data.product?.name,
    amount: data.amount || 0,
    currency: data.currency || 'USD',
    status: 'completed',
    eventType: 'subscription.created',
    metadata: {
      subscription_id: data.id,
      status: data.status,
      current_period_end: data.currentPeriodEnd,
    },
  });

  await payment.save();

  // Update user with subscription info
  const user = await User.findOne({ email: data.customer?.email });
  if (user) {
    const product = await Product.findOne({ polarProductId: data.productId });
    if (product) {
      user.subscriptionStatus = product.tier;
      user.subscriptionId = data.id;
      user.subscriptionEndsAt = data.currentPeriodEnd ? new Date(data.currentPeriodEnd) : undefined;
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

  // Update user subscription info
  const user = await User.findOne({ subscriptionId: data.id });
  if (user) {
    const product = await Product.findOne({ polarProductId: data.productId });
    if (product) {
      user.subscriptionStatus = product.tier;
      user.subscriptionEndsAt = data.currentPeriodEnd ? new Date(data.currentPeriodEnd) : undefined;
      await user.save();
      console.log(`✅ User ${user.email} subscription updated (${data.status})`);
    }
  }

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
