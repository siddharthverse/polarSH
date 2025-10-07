import express, { Request, Response } from 'express';
import { Polar } from '@polar-sh/sdk';

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

// Generate invoice for an order
router.post('/generate/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    console.log('📄 Generating invoice for order:', orderId);

    const polar = getPolarClient();

    // Trigger invoice generation (returns 202 Accepted)
    await polar.orders.generateInvoice({
      id: orderId,
    });

    console.log('✅ Invoice generation scheduled for order:', orderId);

    res.status(202).json({
      message: 'Invoice generation scheduled',
      orderId: orderId,
      note: 'Invoice will be ready in a few seconds. Check order.updated webhook.',
    });
  } catch (error: any) {
    console.error('❌ Failed to generate invoice:', error);

    // Handle specific errors
    if (error.statusCode === 409) {
      return res.status(409).json({
        error: 'Invoice already exists',
        message: 'This order already has an invoice generated',
      });
    }

    if (error.statusCode === 422) {
      return res.status(422).json({
        error: 'Cannot generate invoice',
        message: error.body || 'Order may not be paid or missing billing details',
      });
    }

    res.status(500).json({
      error: 'Failed to generate invoice',
      message: error.body || error.message || 'Unknown error',
    });
  }
});

// Get invoice URL for an order
router.get('/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    console.log('📥 Fetching invoice for order:', orderId);

    const polar = getPolarClient();

    // Get invoice (returns { url: "https://..." })
    const invoice = await polar.orders.invoice({
      id: orderId,
    });

    console.log('✅ Invoice retrieved:', invoice.url);

    res.json({
      url: invoice.url,
      orderId: orderId,
    });
  } catch (error: any) {
    console.error('❌ Failed to get invoice:', error);

    if (error.statusCode === 404) {
      return res.status(404).json({
        error: 'Invoice not found',
        message: 'No invoice exists for this order. Generate it first.',
      });
    }

    res.status(500).json({
      error: 'Failed to get invoice',
      message: error.message || 'Unknown error',
    });
  }
});

export default router;
