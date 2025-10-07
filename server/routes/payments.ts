import express, { Request, Response } from 'express';
import { Polar } from '@polar-sh/sdk';
import Payment from '../models/Payment';
import User from '../models/User';

// Lazy initialize Polar SDK
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

// Get payment details by checkout session ID
router.get('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const payment = await Payment.findOne({ checkoutId: sessionId });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json(payment);
  } catch (error: any) {
    console.error('❌ Failed to get payment:', error);
    res.status(500).json({
      error: 'Failed to get payment',
      message: error.message || 'Unknown error',
    });
  }
});

// Get all payments for a user by email
router.get('/user/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;

    console.log('📥 Fetching payments for user:', email);

    // Find payments directly by customer email
    // This works even if User document doesn't exist
    const payments = await Payment.find({ customerEmail: email }).sort({ createdAt: -1 });

    console.log(`✅ Found ${payments.length} payments for email:`, email);
    res.json(payments);
  } catch (error: any) {
    console.error('❌ Failed to get user payments:', error);
    res.status(500).json({
      error: 'Failed to get user payments',
      message: error.message || 'Unknown error',
    });
  }
});

// Get invoice URL for a payment
router.get('/:paymentId/invoice', async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;

    console.log('📄 Fetching invoice for payment:', paymentId);

    // Find the payment to get the order ID
    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const orderId = payment.metadata?.order_id;

    if (!orderId) {
      return res.status(404).json({
        error: 'Order ID not found',
        message: 'This payment does not have an associated order ID'
      });
    }

    const polar = getPolarClient();

    try {
      // Try to get the invoice
      const invoice = await polar.orders.invoice({ id: orderId });
      console.log('✅ Invoice retrieved for payment:', paymentId);
      res.json({ url: invoice.url, orderId });
    } catch (err: any) {
      // If invoice doesn't exist, try to generate it
      if (err.statusCode === 404) {
        console.log('📄 Invoice not found, generating...');
        await polar.orders.generateInvoice({ id: orderId });

        // Wait a moment and retry
        await new Promise(resolve => setTimeout(resolve, 2000));

        const invoice = await polar.orders.invoice({ id: orderId });
        console.log('✅ Invoice generated and retrieved for payment:', paymentId);
        res.json({ url: invoice.url, orderId });
      } else {
        throw err;
      }
    }
  } catch (error: any) {
    console.error('❌ Failed to get invoice:', error);
    res.status(500).json({
      error: 'Failed to get invoice',
      message: error.message || 'Unknown error',
    });
  }
});

export default router;
