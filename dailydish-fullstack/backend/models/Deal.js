const mongoose = require('mongoose');

const dealSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  shopName: {
    type: String,
    required: true,
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  category: {
    type: String,
    enum: ['bakery', 'produce', 'dairy', 'meals', 'beverages', 'other'],
    default: 'other'
  },
  originalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  discountedPrice: {
    type: Number,
    required: true,
    min: 0
  },
  quantityAvailable: {
    type: Number,
    required: true,
    min: 0,
    default: 1
  },
  quantitySold: {
    type: Number,
    default: 0
  },
  image: {
    type: String,
    default: null
  },
  pickupBy: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

dealSchema.virtual('discountPercent').get(function () {
  if (!this.originalPrice) return 0;
  return Math.round(((this.originalPrice - this.discountedPrice) / this.originalPrice) * 100);
});

dealSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Deal', dealSchema);
