const mongoose = require('mongoose');
const crypto   = require('crypto');

const orderSchema = new mongoose.Schema({
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  deal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deal',
    required: true
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dealSnapshot: {
    name: String,
    shopName: String,
    originalPrice: Number,
    discountedPrice: Number,
    category: String,
    image: String
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  totalPaid: {
    type: Number,
    required: true
  },
  totalOriginal: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['reserved', 'sold', 'cancelled'],
    default: 'reserved'
  },
  pickupCode: {
    type: String,
    default: () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let otp = '';
      const bytes = crypto.randomBytes(6);
      for (let i = 0; i < 6; i++) otp += chars[bytes[i] % chars.length];
      return otp;
    }
  },
  buyerConfirmed: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: Date
});

orderSchema.virtual('savings').get(function () {
  return this.totalOriginal - this.totalPaid;
});

orderSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Order', orderSchema);
