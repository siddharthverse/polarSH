# Discount Code Tracking Guide

## Overview

Your Polar discount setup:
- ✅ **One-time use per user** - User can only redeem once
- ✅ **Max redemption limit** - Limited number of total uses
- ✅ **Single-use (for now)** - Not recurring yet

Polar handles the enforcement (max uses, one per user), but you should track discount usage for analytics and business insights.

---

## What Gets Tracked in MongoDB

### Payment Schema Fields

```typescript
{
  discountCode: "SUMMER20",           // The code user entered
  discountId: "disc_abc123",          // Polar's internal discount ID
  discountAmount: 500,                // Amount saved in cents ($5.00)
  discountType: "fixed" | "percentage", // Type of discount
  originalAmount: 999,                 // Price before discount
  amount: 499,                        // Final price after discount
  metadata: {
    discount_name: "Summer Sale"      // Human-readable name
  }
}
```

---

## Polar's Discount Data in Webhooks

When a user applies a discount code, Polar sends:

### checkout.created webhook
```json
{
  "type": "checkout.created",
  "data": {
    "id": "co_abc123",
    "amount": 499,              // Already discounted
    "discountAmount": 500,       // How much was saved
    "discountId": "disc_xyz",    // Polar's discount ID
    "discount": {
      "id": "disc_xyz",
      "name": "Summer Sale",
      "code": "SUMMER20",        // The code user entered
      "type": "fixed",           // or "percentage"
      "amount": 500,             // Fixed: 500 cents off
      "currency": "USD"
    }
  }
}
```

---

## Discount Analytics Queries

### 1. Total Discount Usage

```javascript
// How many times has a discount code been used?
const redemptions = await Payment.countDocuments({
  discountCode: "SUMMER20",
  status: "completed"  // Only count successful payments
});

console.log(`SUMMER20 has been redeemed ${redemptions} times`);
```

### 2. Total Revenue Lost to Discounts

```javascript
// How much money did we lose to discounts?
const discountStats = await Payment.aggregate([
  { $match: { status: "completed", discountCode: { $exists: true } } },
  {
    $group: {
      _id: null,
      totalDiscounted: { $sum: "$discountAmount" },
      totalRevenue: { $sum: "$amount" },
      count: { $sum: 1 }
    }
  }
]);

console.log(`Total discounts given: $${discountStats[0].totalDiscounted / 100}`);
console.log(`Revenue after discounts: $${discountStats[0].totalRevenue / 100}`);
console.log(`Discount redemptions: ${discountStats[0].count}`);
```

### 3. Most Popular Discount Codes

```javascript
// Which discount codes are most popular?
const popularCodes = await Payment.aggregate([
  { $match: { status: "completed", discountCode: { $exists: true } } },
  {
    $group: {
      _id: "$discountCode",
      uses: { $sum: 1 },
      totalSaved: { $sum: "$discountAmount" }
    }
  },
  { $sort: { uses: -1 } },
  { $limit: 10 }
]);

popularCodes.forEach(code => {
  console.log(`${code._id}: ${code.uses} uses, $${code.totalSaved/100} saved`);
});
```

### 4. Users Who Used Specific Discount

```javascript
// Who used the SUMMER20 code?
const users = await Payment.find({
  discountCode: "SUMMER20",
  status: "completed"
}).select('customerEmail discountAmount createdAt');

users.forEach(payment => {
  console.log(`${payment.customerEmail} saved $${payment.discountAmount/100} on ${payment.createdAt}`);
});
```

### 5. Discount vs Non-Discount Revenue

```javascript
// Compare discounted vs full-price purchases
const withDiscount = await Payment.aggregate([
  { $match: { status: "completed" } },
  {
    $group: {
      _id: { hasDiscount: { $cond: [{ $gt: ["$discountAmount", 0] }, true, false] } },
      count: { $sum: 1 },
      revenue: { $sum: "$amount" }
    }
  }
]);

console.log("With discount:", withDiscount.find(x => x._id.hasDiscount === true));
console.log("Full price:", withDiscount.find(x => x._id.hasDiscount === false));
```

### 6. Check if User Already Used Discount

```javascript
// Has this user already redeemed SUMMER20?
async function hasUserUsedDiscount(email: string, code: string): Promise<boolean> {
  const existing = await Payment.findOne({
    customerEmail: email,
    discountCode: code,
    status: "completed"
  });

  return !!existing;
}

// Usage
const alreadyUsed = await hasUserUsedDiscount("user@example.com", "SUMMER20");
if (alreadyUsed) {
  console.log("User already redeemed this code!");
}
```

---

## Polar Manages Enforcement

**Important**: Polar automatically handles:
- ✅ Max redemption limit (you set this in Polar dashboard)
- ✅ One-time use per user (Polar tracks this)
- ✅ Expiration dates
- ✅ Valid/invalid codes

**You don't need to enforce** - just track for analytics!

---

## Checking Discount Stats in Real-Time

### Create API Endpoint for Discount Stats

```typescript
// server/routes/discounts.ts
import express from 'express';
import Payment from '../models/Payment';

const router = express.Router();

// Get stats for a specific discount code
router.get('/:code/stats', async (req, res) => {
  try {
    const { code } = req.params;

    const stats = await Payment.aggregate([
      {
        $match: {
          discountCode: code.toUpperCase(),
          status: "completed"
        }
      },
      {
        $group: {
          _id: null,
          totalRedemptions: { $sum: 1 },
          totalSaved: { $sum: "$discountAmount" },
          totalRevenue: { $sum: "$amount" }
        }
      }
    ]);

    if (!stats.length) {
      return res.json({
        code,
        totalRedemptions: 0,
        totalSaved: 0,
        totalRevenue: 0
      });
    }

    res.json({
      code,
      totalRedemptions: stats[0].totalRedemptions,
      totalSaved: stats[0].totalSaved / 100, // Convert to dollars
      totalRevenue: stats[0].totalRevenue / 100,
      avgDiscountAmount: stats[0].totalSaved / stats[0].totalRedemptions / 100
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch discount stats' });
  }
});

// Get all discount codes with usage
router.get('/all/stats', async (req, res) => {
  try {
    const allDiscounts = await Payment.aggregate([
      { $match: { status: "completed", discountCode: { $exists: true } } },
      {
        $group: {
          _id: "$discountCode",
          uses: { $sum: 1 },
          totalSaved: { $sum: "$discountAmount" },
          totalRevenue: { $sum: "$amount" }
        }
      },
      { $sort: { uses: -1 } }
    ]);

    res.json(allDiscounts.map(d => ({
      code: d._id,
      uses: d.uses,
      totalSaved: d.totalSaved / 100,
      totalRevenue: d.totalRevenue / 100
    })));

  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch all discount stats' });
  }
});

export default router;
```

Then in `server/index.ts`:
```typescript
import discountRouter from './routes/discounts';
app.use('/api/discounts', discountRouter);
```

**Usage:**
```bash
# Get stats for SUMMER20
curl http://localhost:3001/api/discounts/SUMMER20/stats

# Get all discount codes
curl http://localhost:3001/api/discounts/all/stats
```

---

## Example Discount Scenarios

### Scenario 1: Fixed Amount Discount

**Polar Setup:** $5 off, code "SAVE5"

**Webhook Data:**
```json
{
  "amount": 495,           // $4.95 (was $9.95)
  "discountAmount": 500,   // $5.00 off
  "discount": {
    "code": "SAVE5",
    "type": "fixed",
    "amount": 500
  }
}
```

**MongoDB:**
```javascript
{
  discountCode: "SAVE5",
  discountAmount: 500,
  originalAmount: 995,
  amount: 495,
  discountType: "fixed"
}
```

### Scenario 2: Percentage Discount

**Polar Setup:** 20% off, code "TWENTY"

**Webhook Data:**
```json
{
  "amount": 799,           // $7.99 (was $9.99)
  "discountAmount": 200,   // $2.00 off (20% of $9.99)
  "discount": {
    "code": "TWENTY",
    "type": "percentage",
    "percentage": 20
  }
}
```

**MongoDB:**
```javascript
{
  discountCode: "TWENTY",
  discountAmount: 200,
  originalAmount: 999,
  amount: 799,
  discountType: "percentage"
}
```

---

## Best Practices

### 1. Always Check `status: "completed"`
Don't count abandoned checkouts in stats:
```javascript
// Good
Payment.find({ discountCode: "SUMMER20", status: "completed" })

// Bad - includes abandoned carts
Payment.find({ discountCode: "SUMMER20" })
```

### 2. Use Indexes
Discount fields are already indexed for fast queries:
```javascript
// Fast - uses index
Payment.find({ discountCode: "SUMMER20" })

// Fast - uses index
Payment.find({ discountId: "disc_abc123" })
```

### 3. Track Original Price
Always store `originalAmount` to calculate ROI:
```javascript
const payment = await Payment.findById(id);
const discountPercentage = (payment.discountAmount / payment.originalAmount) * 100;
console.log(`User saved ${discountPercentage.toFixed(1)}%`);
```

### 4. Monitor Discount Abuse
Check for unusual patterns:
```javascript
// Users who used multiple different codes
const multiCodeUsers = await Payment.aggregate([
  { $match: { status: "completed", discountCode: { $exists: true } } },
  {
    $group: {
      _id: "$customerEmail",
      uniqueCodes: { $addToSet: "$discountCode" },
      totalSaved: { $sum: "$discountAmount" }
    }
  },
  { $match: { "uniqueCodes.1": { $exists: true } } } // More than 1 unique code
]);

console.log("Users who used multiple discount codes:", multiCodeUsers);
```

---

## Summary

### What Polar Handles
- ✅ Enforcing max redemptions
- ✅ Preventing duplicate use per user
- ✅ Validating discount codes
- ✅ Calculating discount amounts
- ✅ Expiration dates

### What You Track in MongoDB
- ✅ Which codes were used
- ✅ How much was saved
- ✅ Revenue with/without discounts
- ✅ Popular discount codes
- ✅ User discount usage history

### Your Data Fields
```javascript
{
  discountCode: string,      // "SUMMER20"
  discountId: string,        // Polar's ID
  discountAmount: number,    // Cents saved
  discountType: string,      // "fixed" | "percentage"
  originalAmount: number,    // Price before discount
  amount: number,            // Final price
  status: string,            // Always check "completed"
  metadata: {
    discount_name: string    // "Summer Sale"
  }
}
```

Everything is set up and ready to track discount usage! 🎉
