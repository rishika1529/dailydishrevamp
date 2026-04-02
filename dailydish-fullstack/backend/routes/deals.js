const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Deal = require('../models/Deal');
const { protect, requireRole } = require('../middleware/auth');

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../public/uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `deal-${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

// GET /api/deals  — public, list active deals
router.get('/', async (req, res) => {
  try {
    const { category, search, sellerId } = req.query;
    const filter = { isActive: true, quantityAvailable: { $gt: 0 }, pickupBy: { $gte: new Date() } };
    if (category && category !== 'all') filter.category = category;
    if (sellerId) filter.seller = sellerId;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const deals = await Deal.find(filter)
      .populate('seller', 'name shopName shopAddress')
      .sort({ createdAt: -1 });

    res.json({ success: true, deals });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch deals.' });
  }
});

// GET /api/deals/my  — seller's own deals
router.get('/my', protect, requireRole('seller'), async (req, res) => {
  try {
    const deals = await Deal.find({ seller: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, deals });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch your deals.' });
  }
});

// GET /api/deals/:id
router.get('/:id', async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id).populate('seller', 'name shopName shopAddress');
    if (!deal) return res.status(404).json({ success: false, message: 'Deal not found.' });
    res.json({ success: true, deal });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch deal.' });
  }
});

// POST /api/deals  — seller creates deal
router.post('/', protect, requireRole('seller'), upload.single('image'), async (req, res) => {
  try {
    const { name, description, category, originalPrice, discountedPrice, quantityAvailable, pickupBy } = req.body;
    if (!name || !originalPrice || !discountedPrice || !quantityAvailable || !pickupBy) {
      return res.status(400).json({ success: false, message: 'Please fill all required fields.' });
    }
    if (Number(discountedPrice) >= Number(originalPrice)) {
      return res.status(400).json({ success: false, message: 'Discounted price must be less than original price.' });
    }

    const deal = await Deal.create({
      seller: req.user._id,
      shopName: req.user.shopName || req.user.name,
      name,
      description,
      category: category || 'other',
      originalPrice: Number(originalPrice),
      discountedPrice: Number(discountedPrice),
      quantityAvailable: Number(quantityAvailable),
      pickupBy: new Date(pickupBy),
      image: req.file ? `/uploads/${req.file.filename}` : null
    });

    // Emit real-time event
    if (req.app.get('io')) {
      req.app.get('io').emit('new_deal', deal);
    }

    res.status(201).json({ success: true, deal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to create deal.' });
  }
});

// PATCH /api/deals/:id  — seller updates their deal
router.patch('/:id', protect, requireRole('seller'), async (req, res) => {
  try {
    const deal = await Deal.findOne({ _id: req.params.id, seller: req.user._id });
    if (!deal) return res.status(404).json({ success: false, message: 'Deal not found.' });

    const allowed = ['name', 'description', 'discountedPrice', 'quantityAvailable', 'isActive', 'pickupBy'];
    allowed.forEach(f => { if (req.body[f] !== undefined) deal[f] = req.body[f]; });
    await deal.save();

    res.json({ success: true, deal });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update deal.' });
  }
});

// DELETE /api/deals/:id  — seller deletes deal
router.delete('/:id', protect, requireRole('seller'), async (req, res) => {
  try {
    const deal = await Deal.findOne({ _id: req.params.id, seller: req.user._id });
    if (!deal) return res.status(404).json({ success: false, message: 'Deal not found or you do not have permission to delete it.' });
    
    // Check if there are any active orders for this deal
    const Order = require('../models/Order');
    const activeOrders = await Order.countDocuments({ 
      deal: deal._id, 
      status: { $in: ['reserved'] }
    });
    
    if (activeOrders > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete deal with ${activeOrders} active reservation(s). Please wait for them to complete or cancel.` 
      });
    }
    
    await Deal.findByIdAndDelete(deal._id);
    res.json({ success: true, message: 'Deal deleted successfully.' });
  } catch (err) {
    console.error('Delete deal error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete deal: ' + err.message });
  }
});

module.exports = router;
