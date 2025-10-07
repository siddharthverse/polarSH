import dotenv from 'dotenv';

// Load environment variables FIRST before any other imports
dotenv.config();

import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db';
import webhookRouter from './routes/webhooks';
import productRouter from './routes/products';
import userRouter from './routes/users';
import checkoutRouter from './routes/checkout';
import paymentRouter from './routes/payments';
import refundRouter from './routes/refunds';
import invoiceRouter from './routes/invoices';

const app = express();
const PORT = process.env.PORT || 3001;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());

// Webhook routes - IMPORTANT: Keep raw body for signature verification
app.use('/api/webhooks', webhookRouter);

// Regular JSON parsing for other routes
app.use(express.json());

// API Routes
app.use('/api/products', productRouter);
app.use('/api/users', userRouter);
app.use('/api/checkout', checkoutRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/refunds', refundRouter);
app.use('/api/invoices', invoiceRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
