import express, { Request, Response } from 'express';
import { Polar } from '@polar-sh/sdk';
import { verifyPolarWebhook } from '../utils/verifyWebhook';
import { sendInvoiceEmail, sendRefundEmail } from '../utils/emailService';
import Payment from '../models/Payment';
import User from '../models/User';
import Product from '../models/Product';

// Initialize Polar client for invoice generation
let polar: Polar | null = null;
function getPolarClient(): Polar {
  if (!polar) {
    const isSandbox = process.env.POLAR_ENVIRONMENT === 'sandbox';
    polar = new Polar({
      accessToken: process.env.POLAR_ACCESS_TOKEN,
      ...(isSandbox && { serverURL: 'https://sandbox-api.polar.sh' }),
    });
  }
  return polar;
}

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

        case 'refund.created':
          await handleRefundCreated(event.data);
          break;

        case 'order.updated':
          await handleOrderUpdated(event.data);
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

  // Debug discount data - log ALL amount-related fields
  console.log('💵 Amount breakdown:', {
    amount: data.amount,
    discountAmount: data.discountAmount,
    netAmount: data.netAmount,
    taxAmount: data.taxAmount,
    totalAmount: data.totalAmount,
    hasDiscount: !!data.discount,
  });

  if (data.discount) {
    console.log('🔍 Discount object:', JSON.stringify(data.discount, null, 2));
  }

  const payment = new Payment({
    checkoutId: data.id,
    customerId: data.customerId,
    customerEmail: data.customerEmail || userIdentifier,
    productId: data.productId,
    productName: data.product?.name,
    amount: data.netAmount || data.amount || 0, // Use netAmount (after discount) as the final amount
    currency: data.currency || 'USD',
    status: 'pending',
    eventType: 'checkout.created',
    appName: data.metadata?.app_name, // Extract from checkout metadata
    featureDate: data.metadata?.feature_date ? new Date(data.metadata.feature_date) : undefined,
    // Discount tracking
    discountCode: data.discount?.code || undefined,
    discountId: data.discountId || data.discount?.id || undefined,
    discountAmount: data.discountAmount || 0, // Polar provides this as a calculated field
    discountType: data.discount?.type || undefined,
    originalAmount: data.amount, // Store original amount before discount
    metadata: {
      checkout_url: data.url,
      expires_at: data.expiresAt,
      external_customer_id: data.externalCustomerId,
      discount_name: data.discount?.name, // Store discount name for reference
      discount_full_data: data.discount, // Store full discount object for debugging
      net_amount: data.netAmount, // Amount after discount but before tax
    },
  });

  await payment.save();

  if (payment.appName && payment.featureDate) {
    console.log(`📱 Payment for ${payment.appName} to be featured on ${payment.featureDate.toISOString().split('T')[0]}`);
  }

  if (payment.discountCode && payment.discountAmount) {
    console.log(`💰 Discount code "${payment.discountCode}" applied - saved $${(payment.discountAmount / 100).toFixed(2)}`);
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

  // Debug discount data in update event
  console.log('💵 Amount breakdown (updated):', {
    amount: data.amount,
    discountAmount: data.discountAmount,
    netAmount: data.netAmount,
    taxAmount: data.taxAmount,
    totalAmount: data.totalAmount,
    hasDiscount: !!data.discount,
  });

  const payment = await Payment.findOne({ checkoutId: data.id });

  if (payment) {
    payment.status = data.status === 'confirmed' ? 'completed' : payment.status;
    payment.customerEmail = data.customerEmail || payment.customerEmail;
    payment.customerId = data.customerId || payment.customerId;

    // Update discount fields if they changed (discount might be applied after creation)
    if (data.discountAmount && data.discountAmount !== payment.discountAmount) {
      payment.discountAmount = data.discountAmount;
      payment.discountCode = data.discount?.code || payment.discountCode;
      payment.discountId = data.discountId || data.discount?.id || payment.discountId;
      payment.discountType = data.discount?.type || payment.discountType;
      payment.amount = data.netAmount || data.amount || payment.amount; // Update to post-discount amount
      console.log(`💰 Discount updated: ${data.discountAmount} cents`);
    }

    payment.metadata = {
      ...payment.metadata,
      updated_at: new Date(),
      checkout_status: data.status,
      net_amount: data.netAmount,
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
    payment.eventType = 'order.created'; // Update to reflect successful order
    payment.amount = data.totalAmount; // Update with actual amount
    payment.metadata = {
      ...payment.metadata,
      order_id: data.id, // Store order_id for refund lookup
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

  // Automatically generate invoice after order creation
  try {
    console.log('📄 Triggering invoice generation for order:', data.id);
    const polar = getPolarClient();
    await polar.orders.generateInvoice({ id: data.id });
    console.log('✅ Invoice generation scheduled');
  } catch (err: any) {
    if (err.statusCode === 409) {
      console.log('ℹ️ Invoice already exists for order:', data.id);
    } else {
      console.error('❌ Failed to generate invoice:', err.message);
    }
  }
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
    payment.eventType = 'order.paid'; // Update to reflect payment confirmation
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

async function handleOrderUpdated(data: any) {
  console.log('🔄 Order updated:', data.id);

  // Check if invoice was just generated
  if (data.isInvoiceGenerated) {
    console.log('📄 Invoice is now available for order:', data.id);

    // Fetch the invoice URL
    try {
      const polar = getPolarClient();
      const invoice = await polar.orders.invoice({ id: data.id });

      console.log('✅ Invoice URL retrieved:', invoice.url);

      // Find payment to get customer details
      const payment = await Payment.findOne({ 'metadata.order_id': data.id });

      if (payment && payment.customerEmail) {
        // Send invoice email to customer
        await sendInvoiceEmail({
          customerEmail: payment.customerEmail,
          invoiceUrl: invoice.url,
          orderId: data.id,
          amount: payment.amount,
          currency: payment.currency,
          productName: payment.productName,
        });
      }
    } catch (err) {
      console.error('❌ Failed to fetch/send invoice:', err);
    }
  }

  console.log('✅ Order update handled');
}

async function handleRefundCreated(data: any) {
  console.log('💸 Refund created:', data.id);
  console.log('📦 Refund data:', JSON.stringify(data, null, 2));

  // Find the payment by order ID stored in metadata
  const payment = await Payment.findOne({ 'metadata.order_id': data.orderId });

  if (payment) {
    // Update payment status to refunded
    payment.status = 'refunded';
    payment.metadata = {
      ...payment.metadata,
      refund_id: data.id,
      refund_amount: data.amount,
      refund_reason: data.reason,
      refunded_at: new Date(),
      refund_comment: data.comment,
    };

    await payment.save();
    console.log('✅ Payment marked as refunded:', payment.checkoutId);

    // Update user subscription if benefits were revoked
    if (data.revokeBenefits) {
      const user = await User.findOne({ email: payment.customerEmail });
      if (user) {
        user.subscriptionStatus = 'free';
        user.subscriptionId = undefined;
        user.subscriptionEndsAt = undefined;
        await user.save();
        console.log(`✅ User ${user.email} subscription revoked due to refund`);
      }
    }

    // Send refund confirmation email
    if (payment.customerEmail) {
      await sendRefundEmail({
        customerEmail: payment.customerEmail,
        orderId: data.orderId,
        refundAmount: data.amount,
        currency: payment.currency,
        refundReason: data.reason,
        productName: payment.productName,
      });
    }
  } else {
    console.warn('⚠️ Payment not found for order:', data.orderId);
  }

  console.log('✅ Refund webhook processed');
}

export default router;
