# External Customer ID: Options & Security

## Comparison Table

| Option | Privacy | Security | GDPR | Debugging | Auth Required |
|--------|---------|----------|------|-----------|---------------|
| Email | ❌ Poor | ❌ Poor | ❌ Risky | ✅ Easy | ❌ No |
| MongoDB ObjectId | ✅ Good | ✅ Good | ✅ Safe | ⚠️ Medium | ✅ Yes |
| UUID/Custom ID | ✅ Best | ✅ Best | ✅ Safe | ⚠️ Medium | ✅ Yes |

---

## Option 1: Email (Current - Not Recommended for Production)

### Implementation
```typescript
// Frontend
const checkoutSession = await createCheckoutSession({
  product_id: tier.polarProductId,
  customer_email: "alice@example.com",  // PII shared with Polar ❌
});

// Backend
checkoutOptions.externalCustomerId = "alice@example.com";

// Webhook
const user = await User.findOne({ email: data.customer.externalId });
```

### When to Use
- ✅ MVP/Prototype
- ✅ No authentication system yet
- ✅ Internal tools (not public-facing)
- ❌ **NOT for production with real users**

### Risks
- GDPR violations (€20M fine or 4% revenue)
- User privacy breach
- Email harvesting if Polar is compromised

---

## Option 2: MongoDB ObjectId (Recommended)

### Implementation

**1. User Authentication Required**
```typescript
// Assume you have authentication
const currentUser = useAuth(); // { _id: "507f...", email: "alice@example.com" }
```

**2. Frontend - Pass User ID**
```typescript
const handlePayment = async (tier: PricingTier) => {
  const currentUser = useAuth(); // Your auth system

  const checkoutSession = await createCheckoutSession({
    product_id: tier.polarProductId,
    customer_email: currentUser.email,        // For Polar's checkout form
    external_user_id: currentUser._id,        // 👈 Your anonymous ID
    success_url: `${window.location.origin}/confirmation?status=success`,
  });

  window.location.href = checkoutSession.url;
};
```

**3. Backend - Use MongoDB ID**
```typescript
// server/routes/checkout.ts
router.post('/create', async (req: Request, res: Response) => {
  const { product_id, customer_email, external_user_id } = req.body;

  const checkoutOptions: any = {
    products: [product_id],
    successUrl: success_url,
  };

  // Use MongoDB ObjectId as externalCustomerId
  if (external_user_id) {
    checkoutOptions.externalCustomerId = external_user_id; // "507f1f77bcf86cd799439011"
    checkoutOptions.customerEmail = customer_email;        // "alice@example.com"
  }

  const checkoutSession = await polar.checkouts.create(checkoutOptions);
  res.json({ url: checkoutSession.url, id: checkoutSession.id });
});
```

**4. Webhook - Query by MongoDB _id**
```typescript
// server/routes/webhooks.ts
async function handleCheckoutCreated(data: any) {
  // data.externalCustomerId = "507f1f77bcf86cd799439011"

  let user;

  // If it looks like a MongoDB ObjectId
  if (data.externalCustomerId && data.externalCustomerId.match(/^[0-9a-fA-F]{24}$/)) {
    user = await User.findById(data.externalCustomerId); // 👈 Query by _id
  } else {
    // Fallback to email for old records
    user = await User.findOne({ email: data.customerEmail });
  }

  if (user) {
    user.polarCustomerId = data.customerId;
    // ... rest of logic
  }
}
```

### What Polar Stores vs What YOU Store

**Polar's Database:**
```json
{
  "customer_id": "cus_polar_123",
  "email": "alice@example.com",
  "external_id": "507f1f77bcf86cd799439011"  // Anonymous! ✅
}
```

**Your Database:**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "email": "alice@example.com",
  "name": "Alice Smith",
  "polarCustomerId": "cus_polar_123"
}
```

**If Polar is Breached:**
- Attacker gets: `507f1f77bcf86cd799439011`
- Attacker learns: Nothing (just a random ID)
- Your users: Protected ✅

---

## Option 3: UUID (Most Secure)

### Implementation

**1. Add UUID field to User schema**
```typescript
// server/models/User.ts
const UserSchema: Schema = new Schema({
  uuid: {
    type: String,
    unique: true,
    required: true,
    default: () => crypto.randomUUID(), // "550e8400-e29b-41d4-a716-446655440000"
  },
  email: { type: String, required: true, unique: true },
  // ... rest of fields
});
```

**2. Frontend - Pass UUID**
```typescript
const currentUser = useAuth(); // { uuid: "550e8400...", email: "alice@..." }

const checkoutSession = await createCheckoutSession({
  product_id: tier.polarProductId,
  customer_email: currentUser.email,
  external_user_id: currentUser.uuid,  // 👈 UUID
});
```

**3. Webhook - Query by UUID**
```typescript
async function handleCheckoutCreated(data: any) {
  const user = await User.findOne({ uuid: data.externalCustomerId });
  // ...
}
```

### Benefits
- ✅ Standard format (UUID v4)
- ✅ Not tied to MongoDB (can switch databases)
- ✅ Can generate before saving to DB
- ✅ URL-safe

---

## Migration Strategy (Email → ObjectId)

If you're already using emails, here's how to migrate:

**1. Support Both (Transition Period)**
```typescript
async function handleCheckoutCreated(data: any) {
  let user;

  const identifier = data.externalCustomerId || data.customerEmail;

  // Try MongoDB ObjectId first
  if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
    user = await User.findById(identifier);
  }
  // Try UUID
  else if (identifier.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/)) {
    user = await User.findOne({ uuid: identifier });
  }
  // Fallback to email (legacy)
  else {
    user = await User.findOne({ email: identifier });
  }

  // ...
}
```

**2. Update Frontend Gradually**
```typescript
// New authenticated users get ObjectId
if (currentUser) {
  externalCustomerId = currentUser._id;
} else {
  // Anonymous/legacy users still use email
  externalCustomerId = email;
}
```

---

## GDPR Compliance

### With Email
- ❌ Must have DPA with Polar
- ❌ Must disclose in privacy policy
- ❌ User must consent to sharing with 3rd party
- ❌ Must handle deletion requests in both systems

### With ObjectId/UUID
- ✅ Anonymous identifier - not PII
- ✅ No additional consent needed
- ✅ Simpler privacy policy
- ✅ Easier "right to be forgotten" (just delete from your DB)

---

## Recommendation

### For Production Apps
Use **MongoDB ObjectId** or **UUID** for these reasons:

1. **Privacy by Design**: Don't share PII with 3rd parties
2. **Security**: Breach doesn't expose user identity
3. **Legal**: Avoid GDPR complications
4. **Flexibility**: User can change email without breaking payment history

### For MVP/Testing
Email is acceptable for:
- Local development
- Internal testing
- Sandbox environment
- Non-production use

### For Enterprise/Healthcare/Finance
Use **UUID** + additional encryption if needed for:
- HIPAA compliance
- Financial regulations
- High-security requirements

---

## Example: Authentication-First Flow

```typescript
// 1. User signs up/logs in FIRST
POST /api/auth/signup
{
  "email": "alice@example.com",
  "password": "..."
}

Response:
{
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "alice@example.com"
  },
  "token": "jwt_token..."
}

// 2. THEN user can purchase (authenticated)
const currentUser = getCurrentUser(); // From JWT/session

POST /api/checkout/create
{
  "product_id": "...",
  "external_user_id": currentUser._id,  // 👈 Anonymous
  "customer_email": currentUser.email
}

// 3. Polar checkout form pre-fills email (UX)
// 4. Webhook uses externalCustomerId to find user by _id
```

---

## Security Audit Checklist

- [ ] `externalCustomerId` is NOT email (use ObjectId/UUID)
- [ ] Email only passed as `customerEmail` (for checkout form UX)
- [ ] Webhook queries by `externalCustomerId`, not email
- [ ] Can handle user email changes
- [ ] Can delete user without orphaning payment data
- [ ] Privacy policy mentions Polar integration
- [ ] Data Processing Agreement signed with Polar
