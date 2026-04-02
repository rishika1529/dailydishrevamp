const express = require('express');
const router  = express.Router();
const Order   = require('../models/Order');
const Deal    = require('../models/Deal');
const { protect, requireRole } = require('../middleware/auth');

// ── POST /api/orders — reserve a deal ─────────────────────────────────────────
router.post('/', protect, async (req, res) => {
  try {
    const { dealId, quantity = 1 } = req.body;
    if (!dealId) return res.status(400).json({ success: false, message: 'Deal ID required.' });

    const deal = await Deal.findById(dealId).populate('seller', 'name shopName');
    if (!deal || !deal.isActive)
      return res.status(404).json({ success: false, message: 'Deal not found or inactive.' });
    if (new Date(deal.pickupBy) < new Date())
      return res.status(400).json({ success: false, message: 'This deal has expired.' });
    if (deal.quantityAvailable < quantity)
      return res.status(400).json({ success: false, message: 'Not enough quantity available.' });

    // Atomic decrement
    const updated = await Deal.findOneAndUpdate(
      { _id: dealId, quantityAvailable: { $gte: quantity } },
      { $inc: { quantityAvailable: -quantity, quantitySold: quantity } },
      { new: true }
    );
    if (!updated)
      return res.status(400).json({ success: false, message: 'Quantity changed — please retry.' });

    const order = await Order.create({
      buyer:    req.user._id,
      deal:     deal._id,
      seller:   deal.seller._id,
      dealSnapshot: {
        name:            deal.name,
        shopName:        deal.shopName,
        originalPrice:   deal.originalPrice,
        discountedPrice: deal.discountedPrice,
        category:        deal.category,
        image:           deal.image
      },
      quantity,
      totalPaid:     deal.discountedPrice * quantity,
      totalOriginal: deal.originalPrice   * quantity,
      buyerConfirmed: false // Will be confirmed by buyer
    });

    // Don't emit socket events yet - wait for buyer confirmation

    res.status(201).json({ success: true, order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to place order.' });
  }
});

// ── POST /api/orders/confirm-code — buyer confirms they have received the OTP ──
router.post('/confirm-code', protect, async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ success: false, message: 'Order ID required.' });

    const order = await Order.findOne({ _id: orderId, buyer: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (order.buyerConfirmed) return res.status(400).json({ success: false, message: 'Already confirmed.' });

    order.buyerConfirmed = true;
    await order.save();

    // Now notify the seller
    const deal = await Deal.findById(order.deal);
    const io = req.app.get('io');
    if (io && deal) {
      // 1. Tell this seller specifically: new reservation on YOUR deal
      io.toUser(String(deal.seller._id), 'new_reservation', {
        orderId:       order._id,
        pickupCode:    order.pickupCode,
        buyerName:     req.user.name,
        dealName:      order.dealSnapshot.name,
        quantity:      order.quantity,
        totalPaid:     order.totalPaid,
        remaining:     deal.quantityAvailable,
        reservedAt:    order.createdAt
      });

      // 2. Broadcast updated stock to all buyers
      io.toBuyers('deal_stock_updated', {
        dealId:    deal._id,
        remaining: deal.quantityAvailable
      });
    }

    res.json({ success: true, message: 'OTP confirmed. Seller has been notified!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to confirm code.' });
  }
});

// ── GET /api/orders/my — current user's purchases ─────────────────────────────
router.get('/my', protect, async (req, res) => {
  try {
    const orders = await Order.find({ buyer: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch orders.' });
  }
});

// ── GET /api/orders/seller — orders for this seller's deals ───────────────────
router.get('/seller', protect, requireRole('seller'), async (req, res) => {
  try {
    const orders = await Order.find({ seller: req.user._id })
      .populate('buyer', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch orders.' });
  }
});

// ── GET /api/orders/stats — savings summary ───────────────────────────────────
router.get('/stats', protect, async (req, res) => {
  try {
    const orders     = await Order.find({ buyer: req.user._id, status: { $ne: 'cancelled' } });
    const totalPaid     = orders.reduce((s, o) => s + o.totalPaid, 0);
    const totalOriginal = orders.reduce((s, o) => s + o.totalOriginal, 0);
    res.json({ success: true, stats: {
      totalPaid, totalOriginal,
      totalSavings: totalOriginal - totalPaid,
      totalOrders:  orders.length
    }});
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch stats.' });
  }
});

// ── POST /api/orders/verify-pickup — seller enters buyer's OTP ─────────────────
// This is the ONLY way to mark an order as completed/sold.
// The seller must type the exact 6-char OTP the buyer received.
router.post('/verify-pickup', protect, requireRole('seller'), async (req, res) => {
  try {
    const { pickupCode } = req.body;
    if (!pickupCode || pickupCode.trim().length === 0)
      return res.status(400).json({ success: false, message: 'OTP is required.' });

    const code  = pickupCode.trim().toUpperCase();
    const order = await Order.findOne({
      seller:     req.user._id,
      pickupCode: code,
      status:     'reserved'
    }).populate('buyer', 'name email');

    if (!order)
      return res.status(404).json({
        success: false,
        message: 'Invalid OTP — no active reservation found with this code.'
      });

    order.status    = 'sold';
    order.updatedAt = new Date();
    await order.save();

    const io = req.app.get('io');
    if (io) {
      // Notify the buyer their sale was confirmed
      io.toUser(String(order.buyer._id), 'sale_confirmed', {
        orderId:   order._id,
        dealName:  order.dealSnapshot.name,
        shopName:  order.dealSnapshot.shopName,
        soldAt:    order.updatedAt
      });
    }

    res.json({
      success: true,
      message: `✅ OTP verified — purchase completed for ${order.buyer.name}!`,
      order
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to verify OTP.' });
  }
});

// ── PATCH /api/orders/:id/status — buyer cancels their own order ──────────────
router.patch('/:id/status', protect, async (req, res) => {
  try {
    const { status } = req.body;
    if (status !== 'cancelled')
      return res.status(400).json({ success: false, message: 'Only cancellation allowed via this route.' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    // Only the buyer can cancel
    if (String(order.buyer) !== String(req.user._id))
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    if (order.status !== 'reserved')
      return res.status(400).json({ success: false, message: 'Can only cancel a reserved order.' });

    order.status    = 'cancelled';
    order.updatedAt = new Date();
    await order.save();

    // Restore stock
    await Deal.findByIdAndUpdate(order.deal, {
      $inc: { quantityAvailable: order.quantity, quantitySold: -order.quantity }
    });

    const io = req.app.get('io');
    if (io) {
      io.toBuyers('deal_stock_updated', {
        dealId:    order.deal,
        // We don't know remaining here without a query — client will refresh
      });
      // Notify seller of cancellation
      io.toUser(String(order.seller), 'reservation_cancelled', {
        orderId:  order._id,
        dealName: order.dealSnapshot.name,
        quantity: order.quantity
      });
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to cancel.' });
  }
});

module.exports = router;
