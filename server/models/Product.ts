import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  polarProductId: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year' | 'one_time' | 'forever';
  tier: 'free' | 'pro' | 'enterprise';
  features: string[];
  highlighted: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema: Schema = new Schema(
  {
    polarProductId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    interval: {
      type: String,
      enum: ['month', 'year', 'one_time', 'forever'],
      default: 'month',
    },
    tier: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      required: true,
    },
    features: [
      {
        type: String,
      },
    ],
    highlighted: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IProduct>('Product', ProductSchema);
