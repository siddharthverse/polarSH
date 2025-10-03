import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Product from '../models/Product';
import User from '../models/User';

dotenv.config();

const products = [
  {
    polarProductId: 'free',
    name: 'Free',
    description: 'Perfect for getting started',
    price: 0,
    currency: 'USD',
    interval: 'forever' as const,
    tier: 'free' as const,
    features: [
      'Up to 3 projects',
      'Basic analytics',
      'Community support',
      '5GB storage',
    ],
    highlighted: false,
    active: true,
  },
  {
    polarProductId: '35a2afdc-3dbc-4d68-9e0c-36527c0b48bd',
    name: 'Pro',
    description: 'Best for growing teams',
    price: 9.99,
    currency: 'USD',
    interval: 'month' as const,
    tier: 'pro' as const,
    features: [
      'Unlimited projects',
      'Advanced analytics',
      'Priority email support',
      '100GB storage',
      'Custom integrations',
      'Team collaboration',
      'Advanced reporting',
    ],
    highlighted: true,
    active: true,
  },
  {
    polarProductId: '2c999f50-cb0b-42c0-b19f-50d12db11e71',
    name: 'Enterprise',
    description: 'For large organizations',
    price: 29.99,
    currency: 'USD',
    interval: 'month' as const,
    tier: 'enterprise' as const,
    features: [
      'Everything in Pro',
      'Dedicated account manager',
      '24/7 phone support',
      'Unlimited storage',
      'SSO & advanced security',
      'Custom contracts',
      'On-premise deployment',
      'SLA guarantees',
    ],
    highlighted: false,
    active: true,
  },
];

const sampleUsers = [
  {
    email: 'demo@example.com',
    name: 'Demo User',
    subscriptionStatus: 'free' as const,
  },
  {
    email: 'pro@example.com',
    name: 'Pro User',
    subscriptionStatus: 'pro' as const,
  },
];

async function seed() {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await Product.deleteMany({});
    await User.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Seed products
    const createdProducts = await Product.insertMany(products);
    console.log(`✅ Created ${createdProducts.length} products`);

    // Seed users
    const createdUsers = await User.insertMany(sampleUsers);
    console.log(`✅ Created ${createdUsers.length} users`);

    console.log('\n📊 Database seeded successfully!');
    console.log('\nProducts:');
    createdProducts.forEach((p) => {
      console.log(`  - ${p.name} (${p.tier}): $${p.price}/${p.interval}`);
    });

    console.log('\nUsers:');
    createdUsers.forEach((u) => {
      console.log(`  - ${u.email} (${u.subscriptionStatus})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
