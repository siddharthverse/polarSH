# Complete Payment Flow with externalCustomerId

## Scenario: Alice buys the Pro plan

### Step 1: Alice clicks "Buy Pro"
**Frontend** (PaymentPage.tsx)
```typescript
// Currently you DON'T pass email, but you should:
const checkoutSession = await createCheckoutSession({
  product_id: "35a2afdc-3dbc-4d68-9e0c-36527c0b48bd",  // Pro product
  customer_email: "alice@example.com",  // 👈 ADD THIS!
  success_url: "http://localhost:5173/confirmation?status=success"
});
```

**API Call**:
```http
POST /api/checkout/create
{
  "product_id": "35a2afdc-3dbc-4d68-9e0c-36527c0b48bd",
  "customer_email": "alice@example.com"
}
```

---

### Step 2: Backend creates Polar checkout
**Backend** (server/routes/checkout.ts)
```typescript
// Receives: customer_email = "alice@example.com"

const checkoutOptions = {
  products: ["35a2afdc-3dbc-4d68-9e0c-36527c0b48bd"],
  externalCustomerId: "alice@example.com",  // 👈 Sent to Polar
  customerEmail: "alice@example.com",
  successUrl: "http://localhost:5173/confirmation?status=success"
};

// Polar API call creates checkout
const checkoutSession = await polar.checkouts.create(checkoutOptions);
```

**What Polar stores**:
```json
{
  "checkout_id": "co_abc123",
  "external_customer_id": "alice@example.com",  // 👈 Polar remembers this!
  "customer_email": "alice@example.com"
}
```

---

### Step 3: Webhook arrives - checkout.created
**Webhook Payload** (Polar → Your server):
```json
{
  "type": "checkout.created",
  "data": {
    "id": "co_abc123",
    "externalCustomerId": "alice@example.com",  // 👈 Your identifier!
    "customerEmail": "alice@example.com",
    "customerId": null,  // Not assigned yet (will be created when she pays)
    "productId": "35a2afdc-3dbc-4d68-9e0c-36527c0b48bd",
    "amount": 999,
    "currency": "USD"
  }
}
```

**Your webhook handler** (server/routes/webhooks.ts):
```typescript
async function handleCheckoutCreated(data) {
  // Extract the identifier
  const userIdentifier = data.externalCustomerId || data.customerEmail;
  // userIdentifier = "alice@example.com"

  // Query MongoDB
  let user = await User.findOne({ email: "alice@example.com" });

  if (!user) {
    // Create new user in YOUR database
    user = new User({
      email: "alice@example.com",
      name: data.customerName,
      polarCustomerId: null  // Not yet assigned
    });
    await user.save();
    console.log('✅ New user created: alice@example.com');
  }

  // Create payment record
  const payment = new Payment({
    checkoutId: "co_abc123",
    customerEmail: "alice@example.com",
    productId: "35a2afdc-3dbc-4d68-9e0c-36527c0b48bd",
    amount: 999,
    status: "pending",
    metadata: {
      external_customer_id: "alice@example.com"
    }
  });
  await payment.save();

  // Link payment to user
  user.payments.push(payment._id);
  await user.save();
}
```

**MongoDB State After checkout.created**:
```javascript
// Users collection
{
  _id: ObjectId("67890..."),
  email: "alice@example.com",
  name: null,
  polarCustomerId: null,  // Not assigned yet
  subscriptionStatus: "free",
  payments: [ObjectId("payment_123")]
}

// Payments collection
{
  _id: ObjectId("payment_123"),
  checkoutId: "co_abc123",
  customerEmail: "alice@example.com",
  productId: "35a2afdc-3dbc-4d68-9e0c-36527c0b48bd",
  amount: 999,
  status: "pending",
  metadata: {
    external_customer_id: "alice@example.com"
  }
}
```

---

### Step 4: Alice completes payment

Alice enters her card details on Polar's checkout page and clicks "Pay"

---

### Step 5: Webhook arrives - customer.created
**Webhook Payload**:
```json
{
  "type": "customer.created",
  "data": {
    "id": "cus_polar_alice_456",  // 👈 Polar's internal customer ID
    "email": "alice@example.com",
    "externalId": "alice@example.com",  // 👈 Your identifier returned!
    "name": "Alice Smith"
  }
}
```

**Your webhook handler**:
```typescript
async function handleCustomerCreated(data) {
  const userIdentifier = data.externalId || data.email;
  // userIdentifier = "alice@example.com"

  let user = await User.findOne({ email: "alice@example.com" });
  // Found the user we created in Step 3!

  if (user && !user.polarCustomerId) {
    user.polarCustomerId = "cus_polar_alice_456";  // 👈 Link Polar customer
    await user.save();
    console.log('✅ User updated with Polar customer ID');
  }
}
```

**MongoDB State After customer.created**:
```javascript
// Users collection
{
  _id: ObjectId("67890..."),
  email: "alice@example.com",
  name: null,
  polarCustomerId: "cus_polar_alice_456",  // 👈 NOW LINKED!
  subscriptionStatus: "free",
  payments: [ObjectId("payment_123")]
}
```

---

### Step 6: Webhook arrives - order.created
**Webhook Payload**:
```json
{
  "type": "order.created",
  "data": {
    "id": "order_xyz789",
    "customerId": "cus_polar_alice_456",
    "customer": {
      "id": "cus_polar_alice_456",
      "email": "alice@example.com",
      "externalId": "alice@example.com"  // 👈 Still there!
    },
    "productId": "35a2afdc-3dbc-4d68-9e0c-36527c0b48bd",
    "totalAmount": 999,
    "checkoutId": "co_abc123"
  }
}
```

**Your webhook handler**:
```typescript
async function handleOrderCreated(data) {
  // Find payment by checkoutId
  let payment = await Payment.findOne({ checkoutId: "co_abc123" });

  // Update payment status
  payment.status = "completed";
  payment.metadata.order_id = "order_xyz789";
  await payment.save();

  // Find user by externalId
  const userIdentifier = data.customer?.externalId || data.customer?.email;
  const user = await User.findOne({ email: "alice@example.com" });

  // Find product
  const product = await Product.findOne({
    polarProductId: "35a2afdc-3dbc-4d68-9e0c-36527c0b48bd"
  });

  // Upgrade user to Pro!
  user.subscriptionStatus = "pro";  // 👈 UPGRADED!
  user.polarCustomerId = "cus_polar_alice_456";
  await user.save();

  console.log('✅ User alice@example.com upgraded to pro');
}
```

**Final MongoDB State**:
```javascript
// Users collection
{
  _id: ObjectId("67890..."),
  email: "alice@example.com",
  name: null,
  polarCustomerId: "cus_polar_alice_456",
  subscriptionStatus: "pro",  // 👈 UPGRADED!
  payments: [ObjectId("payment_123")]
}

// Payments collection
{
  _id: ObjectId("payment_123"),
  checkoutId: "co_abc123",
  customerEmail: "alice@example.com",
  productId: "35a2afdc-3dbc-4d68-9e0c-36527c0b48bd",
  amount: 999,
  status: "completed",  // 👈 COMPLETED!
  metadata: {
    external_customer_id: "alice@example.com",
    order_id: "order_xyz789"
  }
}
```

---

## Summary: The Three IDs

| ID Type | What It Is | Where It's Stored | Purpose |
|---------|-----------|-------------------|---------|
| **externalCustomerId** | Your user identifier (email) | Polar's database | Links Polar customer to YOUR system |
| **email** | User's email address | MongoDB `users.email` | Query field to find your users |
| **polarCustomerId** | Polar's internal customer ID | MongoDB `users.polarCustomerId` | Store Polar's customer reference |

## The Key Insight

```
externalCustomerId is NOT a MongoDB field!

It's a value you send TO Polar that Polar sends BACK to you
so you can find your user in MongoDB using: User.findOne({ email: externalCustomerId })
```

## What You Need to Do

Update your frontend to pass the user's email:

**File**: src/components/PaymentPage.tsx

```typescript
const handlePayment = async (tier: PricingTier) => {
  // Get user email (from auth system or prompt)
  const userEmail = prompt("Enter your email:"); // Temporary solution

  const checkoutSession = await createCheckoutSession({
    product_id: tier.polarProductId,
    customer_email: userEmail,  // 👈 ADD THIS!
    success_url: `${window.location.origin}/confirmation?status=success`,
  });

  window.location.href = checkoutSession.url;
};
```

Then `externalCustomerId` will flow through the entire system and link everything together!
