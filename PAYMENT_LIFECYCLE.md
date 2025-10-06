# Payment Lifecycle & Event Types

## Understanding Payment Records

Each checkout session creates a **separate Payment record** in MongoDB. This is correct behavior for tracking purposes.

## Normal Payment Flow

### Scenario: User completes payment successfully

```
1. User clicks "Get Started with Pro"
   ↓
2. Frontend creates checkout
   ↓
3. Webhook: checkout.created
   → MongoDB: Payment record created
      {
        checkoutId: "co_abc123",
        status: "pending",
        eventType: "checkout.created",
        appName: "Firefox",
        featureDate: "2025-10-10",
        amount: 999
      }
   ↓
4. User completes payment on Polar
   ↓
5. Webhook: order.created
   → MongoDB: SAME Payment record updated
      {
        checkoutId: "co_abc123",
        status: "completed",  ← Updated
        eventType: "order.created",  ← Updated
        amount: 999,  ← Confirmed actual amount
        metadata: {
          order_id: "order_xyz",
          ...
        }
      }
   ↓
6. Webhook: order.paid (confirmation)
   → MongoDB: SAME Payment record updated
      {
        checkoutId: "co_abc123",
        status: "completed",
        eventType: "order.paid",  ← Final state
        metadata: {
          order_id: "order_xyz",
          paid_at: "2025-10-05T...",
          paid: true,
          ...
        }
      }
```

**Final Result:** 1 Payment record with status = `completed`, eventType = `order.paid`

---

## Abandoned Checkout Flow

### Scenario: User starts checkout but doesn't complete

```
1. User clicks "Get Started with Pro"
   ↓
2. Frontend creates checkout
   ↓
3. Webhook: checkout.created
   → MongoDB: Payment record created
      {
        checkoutId: "co_abc123",
        status: "pending",
        eventType: "checkout.created",
        appName: "Firefox",
        featureDate: "2025-10-10"
      }
   ↓
4. User closes tab / doesn't complete ❌
   ↓
   NO MORE WEBHOOKS
```

**Final Result:** 1 Payment record with status = `pending`, eventType = `checkout.created`

This is an **abandoned checkout** - never completed, never paid.

---

## Multiple Checkout Attempts

### Scenario: User abandons first checkout, completes second

```
Session 1:
1. checkout.created → Payment #1 (pending, checkout.created)
2. User abandons ❌

Session 2:
3. checkout.created → Payment #2 (pending, checkout.created)  ← NEW RECORD
4. order.created → Payment #2 (completed, order.created)
5. order.paid → Payment #2 (completed, order.paid)

Database:
- Payment #1: status=pending, eventType=checkout.created (abandoned)
- Payment #2: status=completed, eventType=order.paid (successful)
```

**This is correct!** You can:
- Track conversion rate (completed vs abandoned)
- Identify users with abandoned checkouts
- Send reminder emails for abandoned checkouts

---

## Event Type Meanings

| Event Type | Status | Meaning |
|------------|--------|---------|
| `checkout.created` | `pending` | Checkout session started, not yet paid |
| `order.created` | `completed` | Order created (payment processing started) |
| `order.paid` | `completed` | Payment confirmed and processed ✅ |
| `checkout.created` (old) | `completed` | Legacy - before we updated eventType |

---

## Querying Patterns

### Get all successful payments
```javascript
Payment.find({ status: 'completed' })
```

### Get abandoned checkouts (for reminders)
```javascript
Payment.find({
  status: 'pending',
  createdAt: { $lt: new Date(Date.now() - 24*60*60*1000) } // Older than 24h
})
```

### Get payments to feature today
```javascript
Payment.find({
  status: 'completed',
  featureDate: { $lte: new Date() },
  appName: 'Firefox'
})
```

### Get conversion rate
```javascript
const total = await Payment.countDocuments();
const completed = await Payment.countDocuments({ status: 'completed' });
const conversionRate = (completed / total) * 100;
```

---

## Why Multiple Records is Correct

**Benefits of one record per checkout:**
1. ✅ **Audit trail** - See all checkout attempts
2. ✅ **Analytics** - Track abandonment rate
3. ✅ **Recovery** - Email users with pending checkouts
4. ✅ **Debugging** - Understand user behavior
5. ✅ **No data loss** - Never overwrite previous attempts

**Alternative (single record per user) would cause:**
1. ❌ Loss of historical data
2. ❌ Can't track abandonment
3. ❌ Can't see multiple purchase attempts
4. ❌ Confusion if user buys multiple times

---

## Best Practices

### 1. Filter by status when querying
Always specify status to avoid including abandoned checkouts:
```javascript
// Good
Payment.find({ status: 'completed', appName: 'Firefox' })

// Bad - includes abandoned checkouts
Payment.find({ appName: 'Firefox' })
```

### 2. Clean up old pending records (optional)
```javascript
// Delete abandoned checkouts older than 30 days
Payment.deleteMany({
  status: 'pending',
  createdAt: { $lt: new Date(Date.now() - 30*24*60*60*1000) }
})
```

### 3. Link to user for easy queries
The Payment record is already linked to the User via the payments array:
```javascript
const user = await User.findOne({ email: 'user@example.com' })
  .populate('payments');

const completedPayments = user.payments.filter(p => p.status === 'completed');
```

---

## Summary

- ✅ **Each checkout = new Payment record** (correct behavior)
- ✅ **eventType updates** as payment progresses (now fixed)
- ✅ **Abandoned checkouts** stay as `pending` (useful for analytics)
- ✅ **Always filter by status** when querying active payments
- ✅ **Use eventType** to understand payment stage
