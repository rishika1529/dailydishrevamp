// ============================================================================
// DAILY DISH — Demo Seeder
// Run once to populate MongoDB with demo users and deals:
//   node backend/seed.js
// ============================================================================
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Deal = require('./models/Deal');
const Order = require('./models/Order');
const Review = require('./models/Review');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dailydish';

const demoSellers = [
  { name: 'Corner Bakery', email: 'bakery@demo.com', password: 'demo1234', role: 'seller', shopName: 'Corner Bakery', shopAddress: '12 Baker Street, Downtown' },
  { name: 'Green Eats', email: 'greeneats@demo.com', password: 'demo1234', role: 'seller', shopName: 'Green Eats', shopAddress: '5 Garden Lane, Midtown' },
  { name: 'City Deli', email: 'citydeli@demo.com', password: 'demo1234', role: 'seller', shopName: 'City Deli', shopAddress: '88 East Road, East Side' }
];

const demoBuyers = [
  { name: 'Arjun Sharma', email: 'buyer1@demo.com', password: 'demo1234', role: 'buyer' },
  { name: 'Priya Mehta', email: 'buyer2@demo.com', password: 'demo1234', role: 'buyer' }
];

async function seed() {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log('✅  Connected to MongoDB');

  // Clear existing demo data
  await Promise.all([
    User.deleteMany({ email: { $regex: '@demo.com' } }),
    Deal.deleteMany({ shopName: { $in: ['Corner Bakery', 'Green Eats', 'City Deli'] } })
  ]);
  console.log('🗑️   Cleared old demo data');

  // Create sellers and buyers
  const sellers = await User.create(demoSellers);
  const buyers = await User.create(demoBuyers);
  console.log(`👤  Created ${sellers.length} sellers, ${buyers.length} buyers`);

  // Create deals
  const now = new Date();
  const deals = await Deal.create([
    { seller: sellers[0]._id, shopName: 'Corner Bakery', name: 'Artisan Sourdough', category: 'bakery', originalPrice: 250, discountedPrice: 75, quantityAvailable: 5, pickupBy: new Date(now.getTime() + 6 * 3600000), description: 'Hand-crafted sourdough, baked this morning.' },
    { seller: sellers[0]._id, shopName: 'Corner Bakery', name: 'Box of Croissants (6)', category: 'bakery', originalPrice: 300, discountedPrice: 99, quantityAvailable: 8, pickupBy: new Date(now.getTime() + 8 * 3600000), description: 'Freshly baked buttery croissants.' },
    { seller: sellers[1]._id, shopName: 'Green Eats', name: 'Veg Lunch Box', category: 'meals', originalPrice: 180, discountedPrice: 80, quantityAvailable: 10, pickupBy: new Date(now.getTime() + 4 * 3600000), description: 'Healthy vegetarian lunch with dal, rice, and sabzi.' },
    { seller: sellers[1]._id, shopName: 'Green Eats', name: 'Fresh Salad Pack', category: 'produce', originalPrice: 120, discountedPrice: 55, quantityAvailable: 6, pickupBy: new Date(now.getTime() + 3 * 3600000), description: 'Mixed greens with house dressing.' },
    { seller: sellers[2]._id, shopName: 'City Deli', name: 'Cheese & Charcuterie Box', category: 'dairy', originalPrice: 450, discountedPrice: 175, quantityAvailable: 3, pickupBy: new Date(now.getTime() + 5 * 3600000), description: 'Assorted cheeses and cold cuts.' },
    { seller: sellers[2]._id, shopName: 'City Deli', name: 'Bakery Surprise Bag', category: 'bakery', originalPrice: 200, discountedPrice: 60, quantityAvailable: 4, pickupBy: new Date(now.getTime() + 7 * 3600000), description: 'Mystery bag of end-of-day baked goods — 70% off!' }
  ]);
  console.log(`🛒  Created ${deals.length} deals`);

  // Create a sample order
  const sampleOrder = await Order.create({
    buyer: buyers[0]._id,
    deal: deals[0]._id,
    seller: sellers[0]._id,
    dealSnapshot: { name: deals[0].name, shopName: deals[0].shopName, originalPrice: deals[0].originalPrice, discountedPrice: deals[0].discountedPrice, category: deals[0].category },
    quantity: 1,
    totalPaid: deals[0].discountedPrice,
    totalOriginal: deals[0].originalPrice,
    status: 'sold',
    buyerConfirmed: true,
    updatedAt: new Date()
  });

  // Create a sample review
  await Review.create({
    author: buyers[0]._id,
    seller: sellers[0]._id,
    order: sampleOrder._id,
    shopName: 'Corner Bakery',
    authorName: buyers[0].name,
    rating: 5,
    text: 'Amazing sourdough — super fresh and the deal was unbeatable. Will definitely come back!'
  });

  console.log('📝  Created sample order and review');
  console.log('\n✨  Seeding complete!\n');
  console.log('Demo accounts (all passwords: demo1234):');
  console.log('  Buyers:  buyer1@demo.com | buyer2@demo.com');
  console.log('  Sellers: bakery@demo.com | greeneats@demo.com | citydeli@demo.com\n');

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seeder error:', err.message);
  process.exit(1);
});
