const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Order = require('../models/Order');
const { protect, requireRole } = require('../middleware/auth');

// GET /api/reviews  — public, optionally filter by sellerId
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.sellerId) filter.seller = req.query.sellerId;
    const reviews = await Review.find(filter)
      .populate('author', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, reviews });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch reviews.' });
  }
});

// POST /api/reviews  — any logged-in user posts review (must have a completed order)
router.post('/', protect, async (req, res) => {
  try {
    const { sellerId, orderId, rating, text } = req.body;
    if (!sellerId || !rating || !text) {
      return res.status(400).json({ success: false, message: 'sellerId, rating, and text are required.' });
    }

    // Verify buyer actually placed an order with this seller
    const order = await Order.findOne({ _id: orderId, buyer: req.user._id, seller: sellerId });
    if (!order) {
      return res.status(403).json({ success: false, message: 'You can only review sellers you have ordered from.' });
    }

    // One review per order
    const existing = await Review.findOne({ order: orderId, author: req.user._id });
    if (existing) {
      return res.status(409).json({ success: false, message: 'You already reviewed this order.' });
    }

    const review = await Review.create({
      author: req.user._id,
      seller: sellerId,
      order: orderId,
      shopName: order.dealSnapshot?.shopName || '',
      authorName: req.user.name,
      rating: Number(rating),
      text: text.trim()
    });

    res.status(201).json({ success: true, review });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to post review.' });
  }
});

// DELETE /api/reviews/:id — author can delete own review
router.delete('/:id', protect, async (req, res) => {
  try {
    const review = await Review.findOne({ _id: req.params.id, author: req.user._id });
    if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });
    await review.deleteOne();
    res.json({ success: true, message: 'Review deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete review.' });
  }
});

module.exports = router;
