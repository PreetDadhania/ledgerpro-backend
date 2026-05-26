const express  = require('express');
const router   = express.Router();
const jwt      = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const User     = require('../models/User');
const authMiddleware = require('../middleware/auth');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  message: { message: 'Too many attempts. Please try again in 15 minutes.' },
});

function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
  return null;
}

// ── POST /api/auth/register ──────────────────────────────────────
// No email verification — register and immediately log in
router.post('/register', authLimiter, [
  body('name').trim().notEmpty().withMessage('Name is required')
    .isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().withMessage('Invalid email address').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('businessName').optional().trim(),
], async (req, res) => {
  const err = validate(req, res); if (err) return;
  try {
    const { name, email, password, businessName } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'An account with this email already exists. Please log in.' });
    }
    // Create user — already verified (no email verification needed)
    const user = await User.create({
      name, email, password,
      businessName: businessName || '',
      isVerified: true,  // auto-verified
    });
    console.log(`✅ New user registered: ${user.email}`);
    const token = signToken(user._id);
    res.status(201).json({
      message: 'Account created successfully! You are now logged in.',
      token,
      user: { id: user._id, name: user.name, email: user.email, businessName: user.businessName },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/login ─────────────────────────────────────────
router.post('/login', authLimiter, [
  body('email').isEmail().withMessage('Invalid email').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
  const err = validate(req, res); if (err) return;
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Incorrect email or password.' });
    }
    console.log(`✅ Login: ${user.email}`);
    const token = signToken(user._id);
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, businessName: user.businessName },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/change-password ───────────────────────────────
router.post('/change-password', authMiddleware, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
], async (req, res) => {
  const err = validate(req, res); if (err) return;
  try {
    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const isMatch = await user.comparePassword(req.body.currentPassword);
    if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect.' });
    user.password = req.body.newPassword;
    await user.save();
    console.log(`✅ Password changed: ${user.email}`);
    res.json({ message: 'Password changed successfully!' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────────
router.get('/me', authMiddleware, (req, res) => {
  res.json({
    user: { id: req.user._id, name: req.user.name, email: req.user.email, businessName: req.user.businessName },
  });
});

module.exports = router;
