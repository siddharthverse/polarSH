import express, { Request, Response } from 'express';
import { Polar } from '@polar-sh/sdk';

const router = express.Router();

// Lazy initialize Polar SDK to ensure env vars are loaded
let polar: Polar | null = null;

function getPolarClient(): Polar {
  if (!polar) {
    const isSandbox = process.env.POLAR_ENVIRONMENT === 'sandbox';

    console.log(`🔧 Initializing Polar SDK in ${isSandbox ? 'SANDBOX' : 'PRODUCTION'} mode`);
    console.log(`🔑 Access token: ${process.env.POLAR_ACCESS_TOKEN?.substring(0, 15)}...`);

    polar = new Polar({
      accessToken: process.env.POLAR_ACCESS_TOKEN,
      ...(isSandbox && { serverURL: 'https://sandbox-api.polar.sh' }),
    });
  }
  return polar;
}

// Create checkout session
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { product_id, success_url, cancel_url } = req.body;

    if (!product_id) {
      return res.status(400).json({ error: 'product_id is required' });
    }

    console.log('🔄 Creating checkout for product:', product_id);

    const polar = getPolarClient();
    const checkoutSession = await polar.checkouts.create({
      products: [product_id], // Must be an array of product IDs
      successUrl: success_url || process.env.POLAR_SUCCESS_URL || 'http://localhost:5173/confirmation?status=success',
    });

    console.log('✅ Checkout created:', checkoutSession.id);

    res.json({
      url: checkoutSession.url,
      id: checkoutSession.id,
    });
  } catch (error: any) {
    console.error('❌ Failed to create checkout:', error);
    console.error('Error details:', error.body || error.message);
    res.status(500).json({
      error: 'Failed to create checkout',
      message: error.body || error.message || 'Unknown error',
    });
  }
});

// Get checkout session details
router.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const polar = getPolarClient();
    const session = await polar.checkouts.get({
      id: sessionId,
    });

    res.json(session);
  } catch (error: any) {
    console.error('❌ Failed to get checkout:', error);
    res.status(500).json({
      error: 'Failed to get checkout',
      message: error.message || 'Unknown error',
    });
  }
});

export default router;
