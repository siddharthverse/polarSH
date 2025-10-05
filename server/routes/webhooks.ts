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

        case 'order.paid':
          await handleOrderPaid(event.data);
          break;

        case 'customer.created':
          await handleCustomerCreated(event.data);
          break;

        case 'customer.updated':
          await handleCustomerUpdated(event.data);
          break;

        case 'customer.state_changed':
          await handleCustomerStateChanged(event.data);
          break;

        default:
          console.log(`ℹ️ Unhandled event type: ${event.type}`);
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

  // Find or create user using externalCustomerId (most reliable) or email
  const userIdentifier = data.externalCustomerId || data.customerEmail;
  let user = await User.findOne({ email: userIdentifier });

  if (!user && userIdentifier) {
    user = new User({
      email: userIdentifier,
      name: data.customerName,
      polarCustomerId: data.customerId,
    });
    await user.save();
    console.log('✅ New user created:', user.email);
  } else if (user && data.customerId) {
    // Update polarCustomerId if we have it
    user.polarCustomerId = data.customerId;
    await user.save();
    console.log('✅ User updated with Polar customer ID:', data.customerId);
  }

  const payment = new Payment({
    checkoutId: data.id,
    customerId: data.customerId,
    customerEmail: data.customerEmail || userIdentifier,
    productId: data.productId,
    productName: data.product?.name,
    amount: data.amount || 0,
    currency: data.currency || 'USD',
    status: 'pending',
    eventType: 'checkout.created',
    appName: data.metadata?.app_name, // Extract from checkout metadata
    featureDate: data.metadata?.feature_date ? new Date(data.metadata.feature_date) : undefined,
    metadata: {
      checkout_url: data.url,
      expires_at: data.expiresAt,
      external_customer_id: data.externalCustomerId,
    },
  });

  await payment.save();

  if (payment.appName && payment.featureDate) {
    console.log(`📱 Payment for ${payment.appName} to be featured on ${payment.featureDate.toISOString().split('T')[0]}`);
  }

  // Link payment to user
  if (user) {
    user.payments.push(payment._id);
    await user.save();
  }

  console.log('✅ Payment record created for user:', user?.email);
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
        external_customer_id: data.customer?.externalId,
      },
    });
    await payment.save();
  } else {
    payment.status = 'completed';
    payment.metadata = {
      ...payment.metadata,
      order_id: data.id,
      order_created_at: new Date(),
      external_customer_id: data.customer?.externalId,
    };
    await payment.save();
  }

  // Find user by externalId (your system's user ID) or email
  const userIdentifier = data.customer?.externalId || data.customer?.email || payment.customerEmail;
  const user = await User.findOne({ email: userIdentifier });

  if (user) {
    const product = await Product.findOne({ polarProductId: data.productId });
    if (product) {
      user.subscriptionStatus = product.tier;
      user.polarCustomerId = data.customerId;
      if (!user.payments.includes(payment._id)) {
        user.payments.push(payment._id);
      }
      await user.save();
      console.log(`✅ User ${user.email} upgraded to ${product.tier}`);
    }
  } else {
    console.warn(`⚠️ User not found for identifier: ${userIdentifier}`);
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
      external_customer_id: data.customer?.externalId,
    },
  });

  await payment.save();

  // Find user by externalId or email
  const userIdentifier = data.customer?.externalId || data.customer?.email;
  const user = await User.findOne({ email: userIdentifier });

  if (user) {
    const product = await Product.findOne({ polarProductId: data.productId });
    if (product) {
      user.subscriptionStatus = product.tier;
      user.subscriptionId = data.id;
      user.polarCustomerId = data.customerId;
      user.subscriptionEndsAt = data.currentPeriodEnd ? new Date(data.currentPeriodEnd) : undefined;
      if (!user.payments.includes(payment._id)) {
        user.payments.push(payment._id);
      }
      await user.save();
      console.log(`✅ User ${user.email} subscribed to ${product.tier}`);
    }
  } else {
    console.warn(`⚠️ User not found for identifier: ${userIdentifier}`);
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

async function handleOrderPaid(data: any) {
  console.log('💰 Order paid:', data.id);

  // Update payment status to paid
  let payment = await Payment.findOne({ 'metadata.order_id': data.id });

  if (payment) {
    payment.status = 'completed';
    payment.metadata = {
      ...payment.metadata,
      paid_at: new Date(),
      paid: true,
    };
    await payment.save();
    console.log('✅ Payment marked as paid');
  }

  // Update user if needed
  const userIdentifier = data.customer?.externalId || data.customer?.email;
  const user = await User.findOne({ email: userIdentifier });

  if (user) {
    const product = await Product.findOne({ polarProductId: data.productId });
    if (product && user.subscriptionStatus !== product.tier) {
      user.subscriptionStatus = product.tier;
      user.polarCustomerId = data.customerId;
      await user.save();
      console.log(`✅ User ${user.email} upgraded to ${product.tier}`);
    }
  }

  console.log('✅ Order payment processed');
}

async function handleCustomerCreated(data: any) {
  console.log('👤 Customer created:', data.id);

  const userIdentifier = data.externalId || data.email;
  let user = await User.findOne({ email: userIdentifier });

  if (!user && userIdentifier) {
    user = new User({
      email: userIdentifier,
      name: data.name,
      polarCustomerId: data.id,
    });
    await user.save();
    console.log('✅ New user created from customer webhook:', user.email);
  } else if (user && !user.polarCustomerId) {
    user.polarCustomerId = data.id;
    await user.save();
    console.log('✅ User updated with Polar customer ID:', data.id);
  }

  console.log('✅ Customer creation handled');
}

async function handleCustomerUpdated(data: any) {
  console.log('🔄 Customer updated:', data.id);

  const user = await User.findOne({ polarCustomerId: data.id });

  if (user) {
    // Update user details if changed
    if (data.name && data.name !== user.name) {
      user.name = data.name;
    }
    if (data.email && data.email !== user.email) {
      user.email = data.email;
    }
    await user.save();
    console.log('✅ User updated from customer webhook:', user.email);
  } else {
    console.log('ℹ️ No user found for customer ID:', data.id);
  }

  console.log('✅ Customer update handled');
}

async function handleCustomerStateChanged(data: any) {
  console.log('🔄 Customer state changed:', data.id);

  const user = await User.findOne({ polarCustomerId: data.id });

  if (user) {
    console.log(`ℹ️ Customer ${user.email} state changed`);
    // You can add logic here based on customer state if needed
  }

  console.log('✅ Customer state change handled');
}

export default router;
