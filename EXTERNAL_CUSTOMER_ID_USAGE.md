# External Customer ID Usage Guide

## Problem
When webhooks arrive from Polar, you need to know which user in your database made the payment. The `customerId` from Polar is different from your internal user IDs.

## Solution: Use `externalCustomerId`

Polar allows you to pass your own user identifier when creating a checkout. This ID is stored by Polar and returned in all webhook events, allowing you to link payments back to your users.

## Implementation

### 1. Frontend: Pass customer email when creating checkout

```typescript
// In src/components/PaymentPage.tsx or similar
const handlePayment = async (tier: PricingTier) => {
  // Get the logged-in user's email (from your auth system)
  const userEmail = "user@example.com"; // Replace with actual user email

  const checkoutSession = await createCheckoutSession({
    product_id: tier.polarProductId,
    success_url: `${window.location.origin}/confirmation?status=success`,
    customer_email: userEmail,  // 👈 Pass this!
  });

  window.location.href = checkoutSession.url;
};
```

### 2. Backend: Server creates checkout with externalCustomerId

The server automatically handles this in [server/routes/checkout.ts](server/routes/checkout.ts:48-52):

```typescript
if (customer_email) {
  checkoutOptions.externalCustomerId = customer_email;
  checkoutOptions.customerEmail = customer_email;
  console.log('🔗 Linking checkout to external customer ID:', customer_email);
}
```

### 3. Webhooks: Find user by externalId

All webhook handlers now use `externalCustomerId` to find users:

```typescript
// In checkout.created, order.created, subscription.created events:
const userIdentifier = data.customer?.externalId || data.customer?.email;
const user = await User.findOne({ email: userIdentifier });
```

## How It Works

1. **Checkout Creation**: You pass `customer_email: "user@example.com"` from frontend
2. **Polar Stores It**: Polar stores this as `externalCustomerId` on the customer
3. **Webhooks Return It**: All webhook events include `customer.externalId` with your value
4. **You Find Your User**: Query your database using this ID to link the payment

## Example Flow

```
1. User clicks "Buy Pro Plan"
   └─> Frontend sends: { product_id: "...", customer_email: "alice@example.com" }

2. Server creates Polar checkout
   └─> Polar stores: { externalCustomerId: "alice@example.com", ... }

3. User completes payment on Polar

4. Webhook arrives: order.created
   └─> data.customer.externalId = "alice@example.com"
   └─> Server finds: User.findOne({ email: "alice@example.com" })
   └─> Updates user's subscription tier ✅
```

## Benefits

- **Reliable**: No ambiguity about which user paid
- **Flexible**: Can use email, UUID, or any unique identifier
- **Automatic**: Polar includes it in every webhook event
- **Standard**: This is Polar's recommended approach

## What Changed

- ✅ Fixed TypeScript error in webhook signature verification
- ✅ Backend accepts `customer_email` parameter
- ✅ Backend passes it as `externalCustomerId` to Polar
- ✅ All webhook handlers use `externalId` to find users
- ✅ Fallback to email if `externalId` not present

## Next Steps

**Update your frontend** to pass the logged-in user's email:

```typescript
// Option 1: If you have user authentication
const user = useAuth(); // your auth hook
const checkoutSession = await createCheckoutSession({
  product_id: tier.polarProductId,
  customer_email: user.email,  // 👈 Add this
  success_url: "...",
});

// Option 2: If no auth yet, prompt for email first
const email = prompt("Enter your email:");
const checkoutSession = await createCheckoutSession({
  product_id: tier.polarProductId,
  customer_email: email,  // 👈 Add this
  success_url: "...",
});
```

Then when webhooks arrive, the user will be automatically linked in your database!
