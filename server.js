require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');

const app = express();

// ── CORS — allow all origins ──────────────────────────────────────
app.use(cors({ origin: '*', credentials: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/customers',    require('./routes/customers'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/payments',     require('./routes/payments'));

// ── Health check ──────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    time: new Date().toISOString(),
  });
});

// ── Fix all existing unverified users ────────────────────────────
// Call this once: GET /api/fix-users
// It sets isVerified=true for ALL users so old accounts work
app.get('/api/fix-users', async (req, res) => {
  try {
    const User = require('./models/User');
    const result = await User.updateMany(
      { isVerified: { $ne: true } },
      { $set: { isVerified: true } }
    );
    console.log(`✅ Fixed ${result.modifiedCount} unverified users`);
    res.json({
      message: `Fixed ${result.modifiedCount} users. All users can now log in.`,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error('Fix users error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── 404 ───────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// ── Error handler ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

// ── Connect and start ─────────────────────────────────────────────
const PORT       = process.env.PORT || 5000;
const MONGO_URI  = process.env.MONGO_URI;

console.log('');
console.log('=== LedgerPro Backend Starting ===');
console.log('Node version :', process.version);
console.log('PORT         :', PORT);
console.log('MONGO_URI set:', !!MONGO_URI);
if (MONGO_URI) {
  console.log('MONGO_URI    :', MONGO_URI.replace(/:([^@]+)@/, ':****@'));
}
console.log('');

if (!MONGO_URI) {
  console.error('FATAL: MONGO_URI is not set. Add it in Render → Environment.');
  process.exit(1);
}

mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS:          60000,
    connectTimeoutMS:         30000,
  })
  .then(async () => {
    console.log('✅ MongoDB connected — Database: kharchaAppDB');

    // Auto-fix all unverified users on every startup
    try {
      const User   = require('./models/User');
      const result = await User.updateMany(
        { isVerified: { $ne: true } },
        { $set: { isVerified: true } }
      );
      if (result.modifiedCount > 0) {
        console.log(`✅ Auto-fixed ${result.modifiedCount} unverified user(s)`);
      } else {
        console.log('✅ All users already verified');
      }
    } catch (e) {
      console.warn('Warning: Could not auto-fix users:', e.message);
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log('=== Backend is READY ===');
      console.log('');
    });
  })
  .catch((err) => {
    console.error('');
    console.error('=== MONGODB CONNECTION FAILED ===');
    console.error('Error:', err.message);
    console.error('');
    console.error('Fix options:');
    console.error('1. Atlas Network Access → allow 0.0.0.0/0');
    console.error('2. Check username/password in MONGO_URI');
    console.error('3. Check database name is kharchaAppDB');
    console.error('');
    process.exit(1);
  });
