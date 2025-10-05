# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A full-stack Polar SH payment integration with React frontend and Express backend.

## Architecture

### Frontend (Client)
- **Framework**: React 18 with TypeScript + Vite
- **Styling**: Tailwind CSS with ShadCN UI components
- **Routing**: React Router DOM
- **API Communication**: Fetch API to backend (proxied via Vite)

### Backend (Server)
- **Framework**: Express.js with TypeScript
- **Database**: MongoDB with Mongoose ODM
- **Payment Provider**: Polar SH (Sandbox environment)
- **Webhooks**: Signature verification via @polar-sh/sdk/webhooks

## Key Conventions

### Field Naming (IMPORTANT!)
**Always use camelCase for Polar SDK fields**, not snake_case:
- ✅ `data.customerEmail` (correct)
- ❌ `data.customer_email` (wrong)
- ✅ `data.externalCustomerId` (correct)
- ❌ `data.external_customer_id` (wrong)

Polar's TypeScript SDK uses camelCase. When writing webhook handlers or working with Polar data, always check the SDK type definitions in `node_modules/@polar-sh/sdk/dist/esm/models/components/`.

### User Linking Strategy
- Use `externalCustomerId` to link Polar customers to internal users
- Pass user email/ID when creating checkouts
- Webhook handlers use `data.customer?.externalId` to find users

### Webhook Implementation
- All webhooks verified using `validateEvent` from @polar-sh/sdk/webhooks
- Express raw body parser required for signature verification
- Headers must be normalized from Express format to Record<string, string>

## Project Structure

```
/src                    # Frontend React app
  /components          # UI components (PaymentPage.tsx)
  /lib                 # Utilities (polar.ts - API helpers)

/server                # Backend Express app
  /config             # Database connection
  /models             # Mongoose schemas (User, Product, Payment)
  /routes             # API routes (webhooks, checkout, products, users)
  /utils              # Webhook verification
  /scripts            # Database seeding
```

## Environment Setup

**Backend (.env):**
- `POLAR_ENVIRONMENT=sandbox` (or production)
- `POLAR_ACCESS_TOKEN=` (Organization Access Token)
- `POLAR_WEBHOOK_SECRET=` (Webhook signing secret)
- `POLAR_SUCCESS_URL=http://localhost:5173/confirmation?status=success`
- `MONGODB_URI=mongodb://localhost:27017/polarsh`
- `PORT=3001`

**Frontend:**
- Uses Vite proxy to forward `/api/*` to `http://localhost:3001`
- No `VITE_` env vars needed (access token stays on backend)

## Development Workflow

1. Start MongoDB: `mongod`
2. Start dev servers: `npm run dev` (runs both client & server)
3. Expose webhooks: `ngrok http 3001`
4. Configure Polar webhook URL: `https://xxx.ngrok-free.app/api/webhooks/polar`

## Common Patterns

### Creating Checkouts (Frontend)
```typescript
const checkout = await createCheckoutSession({
  product_id: "polar-product-id",
  customer_email: "user@example.com", // Links to your user
  success_url: "http://localhost:5173/confirmation?status=success"
});
```

### Handling Webhooks (Backend)
1. Verify signature with `validateEvent()`
2. Extract `data.customer?.externalId` or `data.customer?.email`
3. Find user: `User.findOne({ email: userIdentifier })`
4. Update user's subscription/payment status

### Database Queries
- Find user by email: `User.findOne({ email })`
- Find product: `Product.findOne({ polarProductId })`
- Find payment: `Payment.findOne({ checkoutId })`

## Debugging Tips

- Check Polar SDK types: `node_modules/@polar-sh/sdk/dist/esm/models/components/`
- Webhook payload logging: Already added `console.log('📦 Full event payload:', ...)`
- MongoDB validation errors: Usually field name mismatches (snake_case vs camelCase)
- 404 webhook errors: Missing event handlers in switch statement

## Important Files to Reference

- **Webhook handlers**: `/server/routes/webhooks.ts`
- **Checkout creation**: `/server/routes/checkout.ts`
- **User schema**: `/server/models/User.ts`
- **Payment schema**: `/server/models/Payment.ts`
- **Product schema**: `/server/models/Product.ts`
- **Frontend payment flow**: `/src/components/PaymentPage.tsx`
