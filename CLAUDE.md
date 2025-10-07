# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A **production-ready full-stack Polar SH payment integration** with React frontend and Express backend. Features include subscriptions, one-time payments, refunds, invoices, purchase history, discount tracking, and custom metadata (app selection + feature dates).

**Current Status:** ~1,261 lines of backend code, 22+ API endpoints, 13 webhook handlers, complete payment lifecycle management.

## Architecture

### Frontend (Client)
- **Framework**: React 18 with TypeScript + Vite
- **Styling**: Tailwind CSS with ShadCN UI components (Button, Card, Dialog, Select, Textarea)
- **Routing**: React Router DOM (/, /confirmation, /purchases)
- **API Communication**: Fetch API to backend (proxied via Vite)
- **State Management**: useState/useEffect hooks
- **UI Components**:
  - PaymentPage.tsx - Subscription selection with app/date picker
  - ConfirmationPage.tsx - Payment success with purchase details
  - PurchasesPage.tsx - Purchase history with refund/invoice management

### Backend (Server)
- **Framework**: Express.js with TypeScript
- **Database**: MongoDB with Mongoose ODM
- **Payment Provider**: Polar SH (Sandbox/Production via environment variable)
- **Webhooks**: Signature verification via @polar-sh/sdk/webhooks
- **Email**: Placeholder service ready for Resend/SendGrid integration
- **API Routes**: 7 route files, 22+ endpoints

## Key Conventions

### Field Naming (CRITICAL!)
**Always use camelCase for Polar SDK fields**, not snake_case:
- ✅ `data.customerEmail` (correct)
- ❌ `data.customer_email` (wrong)
- ✅ `data.externalCustomerId` (correct)
- ❌ `data.external_customer_id` (wrong)

Polar's TypeScript SDK uses camelCase. When writing webhook handlers or working with Polar data, always check the SDK type definitions in `node_modules/@polar-sh/sdk/dist/esm/models/components/`.

### User Linking Strategy
- Use `externalCustomerId` to link Polar customers to internal users
- Pass `customer_email` when creating checkouts (becomes externalCustomerId)
- Webhook handlers use `data.customer?.externalId` or `data.customer?.email` to find users
- **Payments query users by email directly** (doesn't require User document to exist)

### Webhook Implementation
- All webhooks verified using `validateEvent` from @polar-sh/sdk/webhooks
- Express raw body parser required for signature verification
- Headers must be normalized from Express format to Record<string, string>
- **13 webhook events handled**: checkout.created, checkout.updated, order.created, order.updated, order.paid, order.refunded, subscription.created, subscription.updated, subscription.canceled, customer.created, customer.updated, customer.state_changed, refund.created

### Payment Status Lifecycle
```
pending → completed → (optionally) refunded
```
- **eventType field** tracks which webhook last modified the payment
- When refunded: `status = 'refunded'`, `eventType = 'refund.created' | 'order.refunded'`

## Project Structure

```
/src                          # Frontend React app
  /components                 # UI components
    PaymentPage.tsx           # Subscription selection (3 tiers: Free/Pro/Enterprise)
    ConfirmationPage.tsx      # Payment confirmation with purchase details
    PurchasesPage.tsx         # Purchase history with refunds/invoices
    /ui                       # ShadCN components (button, card, dialog, select, textarea)
  /lib
    polar.ts                  # API helpers (checkout, payments, refunds, invoices)

/server                       # Backend Express app
  /config
    db.ts                     # MongoDB connection
  /models
    User.ts                   # User schema with subscription tracking
    Product.ts                # Product schema (polarProductId must be UUID)
    Payment.ts                # Payment schema with discount & custom metadata
  /routes
    webhooks.ts               # 13 webhook handlers (628 lines)
    checkout.ts               # Create checkout sessions with metadata
    payments.ts               # Get payment details, user payments, invoice URLs
    refunds.ts                # Create refunds, list refunds
    invoices.ts               # Generate/retrieve invoices
    products.ts               # List products
    users.ts                  # User management
  /utils
    verifyWebhook.ts          # Webhook signature verification
    emailService.ts           # Email notifications (placeholder for Resend/SendGrid)
  /scripts
    seed.ts                   # Database seeding with default products
  index.ts                    # Express app entry point

/.env                         # Environment variables (gitignored)
```

## API Endpoints (22+)

### Webhooks
- `POST /api/webhooks/polar` - Receive Polar webhooks (13 event types)

### Checkout
- `POST /api/checkout/create` - Create checkout session
- `GET /api/checkout/:sessionId` - Get checkout session details

### Payments
- `GET /api/payments/session/:sessionId` - Get payment by checkout session ID
- `GET /api/payments/user/:email` - Get all payments for user (by email)
- `GET /api/payments/:paymentId/invoice` - Get invoice URL (auto-generates if missing)

### Refunds
- `POST /api/refunds/create` - Create refund for an order
- `GET /api/refunds/order/:orderId` - List refunds for an order

### Invoices
- `POST /api/invoices/generate/:orderId` - Trigger invoice generation
- `GET /api/invoices/:orderId` - Get invoice PDF URL

### Products
- `GET /api/products` - List all active products

### Users
- `GET /api/users` - List users
- `GET /api/users/:email` - Get user by email

### Health
- `GET /api/health` - Health check

## Environment Setup

**Backend (.env):**
```env
POLAR_ENVIRONMENT=sandbox              # or 'production'
POLAR_ACCESS_TOKEN=polar_at_xxx        # Organization Access Token (NOT publishable key)
POLAR_WEBHOOK_SECRET=whsec_xxx         # From Polar Dashboard → Webhooks
POLAR_SUCCESS_URL=http://localhost:5173/confirmation?status=success
MONGODB_URI=mongodb://localhost:27017/polarsh
PORT=3001

# Optional: Email service
RESEND_API_KEY=re_xxx                  # For invoice emails
FROM_EMAIL=noreply@yourdomain.com
```

**Frontend:**
- Uses Vite proxy to forward `/api/*` to `http://localhost:3001`
- No `VITE_` env vars needed (access token stays on backend)
- Proxy config in `vite.config.ts`

## Development Workflow

1. **Start MongoDB**: `mongod` or `brew services start mongodb-community`
2. **Seed database**: `npm run seed` (creates products with UUIDs)
3. **Start dev servers**: `npm run dev` (runs client + server concurrently)
4. **Expose webhooks** (for testing): `ngrok http 3001`
5. **Configure Polar webhook**: Dashboard → Webhooks → `https://xxx.ngrok-free.app/api/webhooks/polar`
6. **Test payment flow**:
   - Select plan → Enter app name + date → Checkout
   - Complete payment in Polar sandbox
   - Webhooks fire → Database updated
   - View in /purchases page

## Common Patterns

### Creating Checkouts with Custom Metadata
```typescript
const checkout = await createCheckoutSession({
  product_id: "01234567-89ab-cdef-0123-456789abcdef", // MUST be UUID from Polar
  customer_email: "user@example.com",
  success_url: "http://localhost:5173/confirmation?status=success&plan=pro",
  app_name: "Firefox",           // Custom metadata
  feature_date: "2025-12-31",    // Custom metadata
});
```

### Handling Webhooks (Backend Pattern)
```typescript
// 1. Verify signature
const event = verifyPolarWebhook(req.body, req.headers, webhookSecret);

// 2. Handle event in switch statement
switch (event.type) {
  case 'order.created':
    await handleOrderCreated(event.data);
    break;
}

// 3. In handler: Find/create user by email
const userIdentifier = data.customer?.externalId || data.customer?.email;
let user = await User.findOne({ email: userIdentifier });

// 4. Create/update payment record
const payment = new Payment({
  checkoutId: data.checkoutId,
  customerEmail: userIdentifier,
  productId: data.productId,
  amount: data.netAmount,  // Amount after discounts
  status: 'completed',
  eventType: 'order.created',
  appName: data.metadata?.app_name,  // Custom metadata
  featureDate: data.metadata?.feature_date,
  discountCode: data.discount?.code,
  discountAmount: data.discountAmount,
});
```

### Database Queries
```typescript
// Find user by email
const user = await User.findOne({ email });

// Find product by Polar ID (must be UUID)
const product = await Product.findOne({ polarProductId: '01234567-...' });

// Find payment by checkout ID
const payment = await Payment.findOne({ checkoutId });

// Find payments by customer email (no User document required)
const payments = await Payment.find({ customerEmail: email }).sort({ createdAt: -1 });

// Find payment by order ID (for refunds)
const payment = await Payment.findOne({ 'metadata.order_id': orderId });
```

### Refund Flow
```typescript
// 1. Create refund via API
await polar.refunds.create({
  orderId: 'order-uuid',
  reason: 'customer_request',
  amount: 999,  // in cents
  revokeBenefits: true,  // Cancel subscription
});

// 2. Webhook fires: refund.created or order.refunded
// 3. Update payment:
payment.status = 'refunded';
payment.eventType = 'refund.created';
payment.metadata.refund_amount = amount;
payment.metadata.refund_reason = reason;

// 4. Revoke user subscription
user.subscriptionStatus = 'free';
```

### Invoice Generation
```typescript
// Auto-generate on order.created
await polar.orders.generateInvoice({ id: orderId });

// Retrieve invoice URL
const invoice = await polar.orders.invoice({ id: orderId });
// Returns: { url: "https://polar-sandbox-customer-invoices.s3.amazonaws.com/..." }

// Invoice URLs expire after 10 minutes (AWS S3 presigned)
```

## Data Models

### Payment Schema
```typescript
{
  checkoutId: string;           // Polar checkout ID
  customerId?: string;          // Polar customer ID
  customerEmail?: string;       // User email
  productId: string;            // Polar product ID
  productName?: string;
  amount: number;               // in cents (after discounts)
  currency: string;             // 'USD'
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  eventType: string;            // Last webhook event that modified this

  // Custom metadata (app feature selection)
  appName?: 'Firefox' | 'Firefox Focus' | 'Safari';
  featureDate?: Date;

  // Discount tracking
  discountCode?: string;        // e.g., "SUMMER20"
  discountId?: string;
  discountAmount?: number;      // in cents
  discountType?: 'fixed' | 'percentage';
  originalAmount?: number;      // Price before discount

  metadata?: {
    order_id?: string;          // Polar order ID (for refunds)
    refund_id?: string;
    refund_amount?: number;
    refund_reason?: string;
    refunded_at?: Date;
    invoice_url?: string;       // Not stored (fetched on-demand)
  };
}
```

### User Schema
```typescript
{
  email: string;
  name?: string;
  polarCustomerId?: string;
  subscriptionStatus: 'free' | 'pro' | 'enterprise';
  subscriptionId?: string;
  subscriptionEndsAt?: Date;
  payments: ObjectId[];  // References to Payment documents
}
```

### Product Schema (IMPORTANT: polarProductId must be UUID!)
```typescript
{
  polarProductId: string;  // MUST be UUID from Polar Dashboard, NOT custom string
  name: string;
  description: string;
  price: number;           // in dollars (9.99)
  currency: string;
  interval: 'month' | 'year' | 'one_time' | 'forever';
  tier: 'free' | 'pro' | 'enterprise';
  features: string[];
  highlighted: boolean;
  active: boolean;
}
```

## Webhook Events Handled (13)

### Checkout Events
- `checkout.created` - Store app_name & feature_date metadata
- `checkout.updated` - Update payment status, track discounts

### Order Events
- `order.created` - Complete payment, upgrade user, **auto-generate invoice**
- `order.updated` - Check if invoice ready, send email
- `order.paid` - Mark payment as paid
- `order.refunded` - Mark payment as refunded, downgrade user

### Subscription Events
- `subscription.created` - Track subscription, upgrade user
- `subscription.updated` - Update subscription end date
- `subscription.canceled` - Downgrade user to free

### Customer Events
- `customer.created` - Create user record
- `customer.updated` - Update user details
- `customer.state_changed` - Log state changes

### Refund Events
- `refund.created` - Mark payment as refunded, send email, revoke benefits

## Frontend Routes

- `/` - PaymentPage (subscription selection)
- `/confirmation` - ConfirmationPage (success/failure with purchase details)
- `/purchases` - PurchasesPage (purchase history, refunds, invoices)

## Key Features Implemented

### ✅ Payment Features
- Subscription plans (Free, Pro, Enterprise)
- One-time payments
- Discount code tracking (automatic via Polar)
- Custom metadata (app selection + feature date)
- Payment confirmation with details

### ✅ Refund System
- Create refunds via UI
- Refund reasons (customer_request, duplicate, fraudulent, etc.)
- Automatic subscription revocation
- Refund history tracking
- Both `refund.created` and `order.refunded` webhooks handled

### ✅ Invoice System
- Auto-generation on order creation
- On-demand retrieval/generation
- Invoice URLs (AWS S3 presigned, 10-min expiry)
- Download invoice button on purchases page
- Shows "Refunded: $X.XX" for refunded invoices
- **Note:** Polar handles credit notes internally, not exposed via API

### ✅ Purchase History
- View all purchases by email
- Status badges (completed=green, refunded=red, pending=yellow, failed=red)
- Request refund with reason selection
- Download invoices
- Email change functionality
- Works even if User document doesn't exist

### ✅ Email Notifications (Placeholder)
- Invoice emails (when `order.updated` with `isInvoiceGenerated`)
- Refund confirmation emails
- Ready for Resend/SendGrid integration
- **Sandbox mode:** Polar doesn't send emails, use custom service

## Debugging Tips

### Common Issues
1. **Product ID validation errors**: polarProductId must be UUID from Polar Dashboard, not custom string like "pro_monthly"
2. **Webhook signature fails**: Ensure raw body parser used for `/api/webhooks`
3. **Field not found errors**: Check camelCase vs snake_case (Polar SDK uses camelCase)
4. **Invoice not found**: Call `generateInvoice()` first, wait 2 seconds, then retrieve
5. **Payments not showing**: Query by `customerEmail` directly, don't require User document
6. **Refund fails**: Need `order_id` stored in `payment.metadata`

### Logging
- All webhooks log full payload: `console.log('📦 Full event payload:', ...)`
- Check MongoDB for payment records: `db.payments.find().sort({createdAt: -1}).limit(5)`
- Verify product UUIDs: `db.products.find({}, {polarProductId: 1, name: 1})`

### Testing Refunds
```bash
# Create refund via API
curl -X POST http://localhost:3001/api/refunds/create \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "order-uuid-here",
    "reason": "customer_request",
    "amount": 999,
    "revoke_benefits": true
  }'
```

### Testing Invoices
```bash
# Generate invoice
curl -X POST http://localhost:3001/api/invoices/generate/order-uuid

# Get invoice URL
curl http://localhost:3001/api/invoices/order-uuid
```

## Important Files Reference

### Backend Routes (7 files, ~1,261 lines)
- **webhooks.ts** (628 lines) - 13 webhook handlers, invoice auto-generation
- **checkout.ts** - Create checkout with custom metadata
- **payments.ts** - Get payment details, user payments, invoice URLs
- **refunds.ts** - Create/list refunds
- **invoices.ts** - Generate/retrieve invoices
- **products.ts** - List products
- **users.ts** - User management

### Frontend Components
- **PaymentPage.tsx** - Subscription selection, app/date picker, product display
- **ConfirmationPage.tsx** - Payment confirmation, purchase details, invoice link
- **PurchasesPage.tsx** - Purchase history, refund dialog, invoice downloads

### Data Models
- **User.ts** - User schema with subscriptions
- **Product.ts** - Product schema (**polarProductId must be UUID!**)
- **Payment.ts** - Payment schema with discounts & custom metadata

### Utilities
- **polar.ts** - API helpers (checkout, payments, refunds, invoices)
- **verifyWebhook.ts** - Webhook signature verification
- **emailService.ts** - Email notifications (ready for Resend/SendGrid)

## Production Checklist

Before deploying to production:

1. ✅ Update `POLAR_ENVIRONMENT=production` in .env
2. ✅ Use production Polar access token
3. ✅ Update webhook URL to production domain
4. ✅ Use real product UUIDs from Polar production dashboard
5. ✅ Configure email service (Resend/SendGrid)
6. ✅ Update success/cancel URLs to production domain
7. ✅ Secure MongoDB with authentication
8. ✅ Add rate limiting to API endpoints
9. ✅ Enable CORS only for production domain
10. ✅ Add error monitoring (Sentry, etc.)

## Additional Context for AI

### Project Goals
This is a **reference implementation** for Polar SH payment integration, demonstrating:
- Complete payment lifecycle (checkout → payment → refund)
- Webhook handling best practices
- Custom metadata usage
- Invoice generation and management
- Purchase history UI
- Discount tracking
- Email notifications (placeholder)

### Code Quality Standards
- TypeScript strict mode
- Comprehensive error handling
- Detailed console logging for debugging
- MongoDB indexing on frequently queried fields
- Webhook signature verification
- Field validation before Polar API calls

### Known Limitations
- **Invoices**: Polar doesn't expose credit notes via API (handled internally)
- **Sandbox emails**: Polar doesn't send emails in sandbox mode
- **Invoice URLs**: Expire after 10 minutes (AWS S3 presigned)
- **User auth**: Currently uses localStorage email (not production-ready)
- **Product IDs**: Must manually copy UUIDs from Polar Dashboard

### Future Enhancements
- User authentication system
- Email service integration
- Subscription management UI
- Customer portal integration
- Tax handling
- Multi-currency support
- Analytics dashboard
