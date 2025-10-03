import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  name?: string;
  polarCustomerId?: string;
  subscriptionStatus: 'free' | 'pro' | 'enterprise';
  subscriptionId?: string;
  subscriptionEndsAt?: Date;
  payments: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
    },
    polarCustomerId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    subscriptionStatus: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      default: 'free',
    },
    subscriptionId: {
      type: String,
      index: true,
    },
    subscriptionEndsAt: {
      type: Date,
    },
    payments: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Payment',
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IUser>('User', UserSchema);
