import mongoose, { Schema, Document } from 'mongoose';

export interface IPayment extends Document {
  checkoutId: string;
  customerId?: string;
  customerEmail?: string;
  productId: string;
  productName?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  eventType: string;
  appName?: string; // App to feature (Firefox, Firefox Focus, Safari)
  featureDate?: Date; // Date when app will be featured
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema: Schema = new Schema(
  {
    checkoutId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customerId: {
      type: String,
      index: true,
    },
    customerEmail: {
      type: String,
      index: true,
    },
    productId: {
      type: String,
      required: true,
    },
    productName: {
      type: String,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },
    eventType: {
      type: String,
      required: true,
    },
    appName: {
      type: String,
      enum: ['Firefox', 'Firefox Focus', 'Safari'],
      index: true,
    },
    featureDate: {
      type: Date,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IPayment>('Payment', PaymentSchema);
