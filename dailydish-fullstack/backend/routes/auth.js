const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

function signToken(userId) {
  const secret = process.env.JWT_SECRET || 'dev_secret_fallback_please_set_env';
  return jwt.sign({ id: userId }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role, shopName, shopAddress } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Please fill all required fields.' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const user = await User.create({ name, email, password, role, shopName, shopAddress });
    const token = signToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, shopName: user.shopName }
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, message: 'Server error during signup.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = signToken(user._id);

    res.json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, shopName: user.shopName }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// GET /api/auth/me  (protected)
router.get('/me', protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// POST /api/auth/logout  (stateless JWT — client clears token)
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out.' });
});

// PATCH /api/auth/me/update  — update name, shopName, shopAddress
router.patch('/me/update', protect, async (req, res) => {
  try {
    const { name, shopName, shopAddress } = req.body;
    const updates = {};
    if (name && name.trim().length >= 2) updates.name = name.trim();
    if (shopName !== undefined) updates.shopName = shopName.trim();
    if (shopAddress !== undefined) updates.shopAddress = shopAddress.trim();

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    res.json({ success: true, user: { id: user._id, name: user.name, email: user.email, role: user.role, shopName: user.shopName, shopAddress: user.shopAddress } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
});

// PATCH /api/auth/me/password  — change password (re-login required)
router.patch('/me/password', protect, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }
    const user = await User.findById(req.user._id);
    user.password = password; // pre-save hook will hash it
    await user.save();
    res.json({ success: true, message: 'Password updated. Please log in again.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update password.' });
  }
});

module.exports = router;
