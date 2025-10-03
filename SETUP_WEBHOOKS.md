# Polar Webhooks Setup Guide

## Overview

This project now includes a backend Express server to handle Polar payment webhooks securely with MongoDB for data persistence.

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   React     │◄────────│  Vite Proxy  │◄────────│   Express   │
│   Client    │         │  /api -> :3001│        │   Server    │
└─────────────┘         └──────────────┘         └─────────────┘
                                                        │
                                                        ▼
                                                  ┌──────────┐
                                                  │ MongoDB  │
                                                  └──────────┘
                                                        ▲
                                                        │
┌─────────────┐                                        │
│  Polar SH   │────────Webhooks─────────────────────────┘
│  Platform   │
└─────────────┘
```

## Setup Instructions

### 1. Install MongoDB

**Option A: Local MongoDB**
```bash
# macOS
brew install mongodb-community
brew services start mongodb-community

# Ubuntu
sudo apt install mongodb
sudo systemctl start mongodb
```

**Option B: MongoDB Atlas (Cloud)**
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account
3. Create a cluster
4. Get your connection string

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Update your `.env` file:

```env
# Client-side (VITE_ prefix required)
VITE_POLAR_ACCESS_TOKEN=polar_at_xxxxx
VITE_POLAR_PRODUCT_ID=prod_xxxxx

# Server-side
POLAR_ACCESS_TOKEN=polar_at_xxxxx
POLAR_WEBHOOK_SECRET=whsec_xxxxx

# MongoDB
MONGODB_URI=mongodb://localhost:27017/polarsh
# Or MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/polarsh

# Server
PORT=3001
```

### 3. Get Your Polar Webhook Secret

1. Go to [Polar Dashboard](https://polar.sh/dashboard)
2. Navigate to **Settings → Webhooks**
3. Create a new webhook endpoint
4. Set the URL to: `https://your-domain.com/api/webhooks/polar`
   - For local development, use [ngrok](https://ngrok.com/) to expose your local server
5. Select events to subscribe to:
   - ✅ `checkout.created`
   - ✅ `checkout.updated`
   - ✅ `order.created`
   - ✅ `subscription.created`
   - ✅ `subscription.updated`
   - ✅ `subscription.canceled`
6. Copy the **Webhook Secret** to your `.env` file

### 4. Local Development with ngrok

To test webhooks locally, you need to expose your server to the internet:

```bash
# Install ngrok
brew install ngrok

# Start ngrok on port 3001
ngrok http 3001

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Update your Polar webhook endpoint to: https://abc123.ngrok.io/api/webhooks/polar
```

### 5. Run the Application

```bash
# Install dependencies (if not already done)
npm install

# Run both client and server concurrently
npm run dev

# Or run them separately:
npm run dev:client  # Vite dev server on port 5173
npm run dev:server  # Express server on port 3001
```

## Webhook Events

The server handles the following Polar webhook events:

| Event | Description | Action |
|-------|-------------|--------|
| `checkout.created` | Checkout session created | Creates payment record with "pending" status |
| `checkout.updated` | Checkout status changed | Updates payment status |
| `order.created` | Order completed | Marks payment as "completed" |
| `subscription.created` | Subscription started | Creates subscription payment record |
| `subscription.updated` | Subscription modified | Logs update (extend as needed) |
| `subscription.canceled` | Subscription canceled | Records cancellation in metadata |

## Database Schema

### Payment Model

```typescript
{
  checkoutId: string;        // Unique checkout ID from Polar
  customerId?: string;       // Customer ID
  customerEmail?: string;    // Customer email
  productId: string;         // Product ID
  productName?: string;      // Product name
  amount: number;            // Amount in cents
  currency: string;          // Currency (default: USD)
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  eventType: string;         // Webhook event type
  metadata?: object;         // Additional data
  createdAt: Date;
  updatedAt: Date;
}
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/webhooks/polar` | POST | Polar webhook handler |

## Testing Webhooks

### 1. Use Polar's Webhook Testing

In the Polar Dashboard, you can send test webhook events to your endpoint.

### 2. Manual Testing with curl

```bash
# Note: This will fail signature verification
curl -X POST http://localhost:3001/api/webhooks/polar \
  -H "Content-Type: application/json" \
  -H "webhook-signature: test" \
  -d '{
    "type": "checkout.created",
    "data": {
      "id": "test_checkout_123",
      "product_id": "prod_test",
      "amount": 1000,
      "currency": "USD"
    }
  }'
```

## Security

✅ **Webhook Signature Verification**: All webhooks are verified using the `POLAR_WEBHOOK_SECRET`
✅ **Raw Body Parsing**: Webhook endpoint uses raw body parsing for signature verification
✅ **CORS**: Configured for frontend-backend communication
✅ **Environment Variables**: Sensitive data stored in `.env` (not committed)

## Troubleshooting

### Webhook signature verification fails

- Ensure `POLAR_WEBHOOK_SECRET` matches the secret in Polar Dashboard
- Check that webhook endpoint uses raw body parsing
- Verify the `webhook-signature` header is present

### MongoDB connection error

- Check MongoDB is running: `brew services list` (macOS)
- Verify `MONGODB_URI` is correct
- For Atlas, ensure IP whitelist includes your IP

### Webhooks not received

- Ensure ngrok is running and URL is updated in Polar Dashboard
- Check server logs for errors
- Verify webhook endpoint is accessible from the internet

## Production Deployment

For production, you'll need to:

1. **Deploy the Express server** (e.g., Railway, Render, Heroku)
2. **Deploy MongoDB** (MongoDB Atlas recommended)
3. **Update webhook URL** in Polar Dashboard to your production server
4. **Set environment variables** on your hosting platform
5. **Enable HTTPS** (required for webhooks)

## Next Steps

- [ ] Add email notifications for successful payments
- [ ] Create admin dashboard to view payments
- [ ] Add refund handling
- [ ] Implement subscription management
- [ ] Add retry logic for failed webhooks
- [ ] Create API endpoints for frontend to query payment status

## Resources

- [Polar Webhooks Documentation](https://docs.polar.sh/webhooks)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- [ngrok Documentation](https://ngrok.com/docs)
