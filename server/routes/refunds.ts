import express, { Request, Response } from 'express';
import { Polar } from '@polar-sh/sdk';
import Payment from '../models/Payment';

const router = express.Router();

// Lazy initialize Polar SDK to ensure env vars are loaded
let polar: Polar | null = null;

function getPolarClient(): Polar {
  if (!polar) {
    const isSandbox = process.env.POLAR_ENVIRONMENT === 'sandbox';

    console.log(`🔧 Initializing Polar SDK in ${isSandbox ? 'SANDBOX' : 'PRODUCTION'} mode`);

    polar = new Polar({
      accessToken: process.env.POLAR_ACCESS_TOKEN,
      ...(isSandbox && { serverURL: 'https://sandbox-api.polar.sh' }),
    });
  }
  return polar;
}

// Create a refund
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { order_id, reason, amount, comment, revoke_benefits } = req.body;

    if (!order_id) {
      return res.status(400).json({ error: 'order_id is required' });
    }

    if (!reason) {
      return res.status(400).json({ error: 'reason is required' });
    }

    if (!amount || amount < 1) {
      return res.status(400).json({ error: 'amount must be at least 1 cent' });
    }

    console.log('💸 Creating refund for order:', order_id);
    console.log('📝 Reason:', reason);
    console.log('💰 Amount:', amount, 'cents');

    const polar = getPolarClient();

    // Create refund using Polar SDK
    const refund = await polar.refunds.create({
      orderId: order_id,
      reason: reason,
      amount: amount,
      ...(comment && { comment }),
      ...(revoke_benefits !== undefined && { revokeBenefits: revoke_benefits }),
    });

    console.log('✅ Refund created:', refund.id);

    res.json(refund);
  } catch (error: any) {
    console.error('❌ Failed to create refund:', error);
    console.error('Error details:', error.body || error.message);

    // Handle specific Polar errors
    if (error.statusCode === 400) {
      return res.status(400).json({
        error: 'Refund amount too high or invalid',
        message: error.body || error.message,
      });
    }

    if (error.statusCode === 403) {
      return res.status(403).json({
        error: 'Order already fully refunded',
        message: error.body || error.message,
      });
    }

    res.status(500).json({
      error: 'Failed to create refund',
      message: error.body || error.message || 'Unknown error',
    });
  }
});

// List refunds for an order
router.get('/order/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const polar = getPolarClient();

    // List refunds for this order
    const refunds = await polar.refunds.list({
      orderId: orderId,
    });

    res.json(refunds);
  } catch (error: any) {
    console.error('❌ Failed to list refunds:', error);
    res.status(500).json({
      error: 'Failed to list refunds',
      message: error.message || 'Unknown error',
    });
  }
});

export default router;
