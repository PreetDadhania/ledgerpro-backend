const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const jwt      = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const User      = require('../models/User');
const authMiddleware = require('../middleware/auth');
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} = require('../utils/email');

// ── Rate limiters ────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many attempts. Please try again in 15 minutes.' },
});
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { message: 'Too many email requests. Try again in 1 hour.' },
});

function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  return null;
}

// ════════════════════════════════════════════════════════════════
//  POST /api/auth/register
// ════════════════════════════════════════════════════════════════
router.post('/register', authLimiter, [
  body('name').trim().notEmpty().withMessage('Name is required')
    .isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().withMessage('Invalid email address').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('businessName').optional().trim(),
], async (req, res) => {
  const err = validate(req, res);
  if (err) return;

  try {
    const { name, email, password, businessName } = req.body;

    // Check duplicate
    const existing = await User.findOne({ email });
    if (existing) {
      if (!existing.isVerified) {
        return res.status(400).json({
          message: 'This email is already registered but not verified. Please check your inbox or use "Resend Verification".',
          notVerified: true,
          email,
        });
      }
      return res.status(400).json({ message: 'An account with this email already exists. Please log in.' });
    }

    // Create user
    const verifyToken = crypto.randomBytes(32).toString('hex');
    await User.create({
      name,
      email,
      password,
      businessName: businessName || '',
      verifyToken,
      verifyTokenExpiry: Date.now() + 24 * 60 * 60 * 1000, // 24 hrs
    });

    // Send email (never crashes — link is also printed in terminal)
    await sendVerificationEmail(email, name, verifyToken);

    res.status(201).json({
      message: `Registration successful! A verification link has been sent to ${email}. Please check your inbox and spam folder.\n\nIf email doesn't arrive, check the terminal/server console — the verify link is printed there too.`,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ════════════════════════════════════════════════════════════════
//  GET /api/auth/verify-email?token=...
// ════════════════════════════════════════════════════════════════
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ message: 'Verification token is missing.' });
    }

    const user = await User.findOne({
      verifyToken: token,
      verifyTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: 'This verification link is invalid or has expired. Please register again or request a new link.',
      });
    }

    user.isVerified        = true;
    user.verifyToken       = undefined;
    user.verifyTokenExpiry = undefined;
    await user.save();

    // Send welcome email silently — failure is OK
    sendWelcomeEmail(user.email, user.name).catch(() => {});

    console.log(`✅ Account verified: ${user.email}`);

    const jwtToken = signToken(user._id);
    res.json({
      message: 'Email verified! You are now logged in.',
      token: jwtToken,
      user: {
        id:           user._id,
        name:         user.name,
        email:        user.email,
        businessName: user.businessName,
      },
    });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ════════════════════════════════════════════════════════════════
//  POST /api/auth/resend-verification
// ════════════════════════════════════════════════════════════════
router.post('/resend-verification', emailLimiter, [
  body('email').isEmail().withMessage('Invalid email').normalizeEmail(),
], async (req, res) => {
  const err = validate(req, res);
  if (err) return;

  try {
    const user = await User.findOne({ email: req.body.email });

    // Always give same response to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If that email exists, a new verification link has been sent.' });
    }
    if (user.isVerified) {
      return res.status(400).json({ message: 'This account is already verified. Please log in.' });
    }

    const verifyToken = crypto.randomBytes(32).toString('hex');
    user.verifyToken       = verifyToken;
    user.verifyTokenExpiry = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    await sendVerificationEmail(user.email, user.name, verifyToken);

    res.json({ message: 'New verification link sent! Check your inbox (and spam). The link is also in the server terminal.' });
  } catch (err) {
    console.error('Resend error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ════════════════════════════════════════════════════════════════
//  POST /api/auth/login
// ════════════════════════════════════════════════════════════════
router.post('/login', authLimiter, [
  body('email').isEmail().withMessage('Invalid email').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
  const err = validate(req, res);
  if (err) return;

  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Incorrect email or password.' });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: 'Your email is not verified yet. Please check your inbox for the verification link, or click "Resend Verification" below.',
        notVerified: true,
        email,
      });
    }

    console.log(`✅ Login: ${user.email}`);
    const token = signToken(user._id);
    res.json({
      token,
      user: {
        id:           user._id,
        name:         user.name,
        email:        user.email,
        businessName: user.businessName,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ════════════════════════════════════════════════════════════════
//  POST /api/auth/forgot-password
// ════════════════════════════════════════════════════════════════
router.post('/forgot-password', emailLimiter, [
  body('email').isEmail().withMessage('Invalid email').normalizeEmail(),
], async (req, res) => {
  const err = validate(req, res);
  if (err) return;

  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user || !user.isVerified) {
      return res.json({ message: 'If that email exists and is verified, a reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetToken       = resetToken;
    user.resetTokenExpiry = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    await sendPasswordResetEmail(user.email, user.name, resetToken);

    res.json({ message: 'Password reset link sent! Check your inbox. The link is also in the server terminal.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ════════════════════════════════════════════════════════════════
//  POST /api/auth/reset-password
// ════════════════════════════════════════════════════════════════
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Token required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req, res) => {
  const err = validate(req, res);
  if (err) return;

  try {
    const user = await User.findOne({
      resetToken:       req.body.token,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: 'This reset link is invalid or has expired. Please request a new one.',
      });
    }

    user.password         = req.body.password;
    user.resetToken       = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    console.log(`✅ Password reset: ${user.email}`);
    res.json({ message: 'Password reset successfully! You can now log in with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ════════════════════════════════════════════════════════════════
//  GET /api/auth/me  (protected)
// ════════════════════════════════════════════════════════════════
router.get('/me', authMiddleware, (req, res) => {
  res.json({
    user: {
      id:           req.user._id,
      name:         req.user.name,
      email:        req.user.email,
      businessName: req.user.businessName,
    },
  });
});

module.exports = router;
