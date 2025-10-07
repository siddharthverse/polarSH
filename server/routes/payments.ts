import express, { Request, Response } from 'express';
import Payment from '../models/Payment';
import User from '../models/User';

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

export default router;
