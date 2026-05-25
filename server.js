require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');

const app = express();

// ── CORS — allow all origins (needed for Render deployment) ───────
app.use(cors({ origin: '*', credentials: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/customers',    require('./routes/customers'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/payments',     require('./routes/payments'));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    time: new Date().toISOString(),
  });
});

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

console.log('');
console.log('=== LedgerPro Backend Starting ===');
console.log('Node version:', process.version);
console.log('PORT:', PORT);
console.log('MONGO_URI set:', !!MONGO_URI);
console.log('MONGO_URI value:', MONGO_URI ? MONGO_URI.replace(/:([^@]+)@/, ':****@') : 'NOT SET - check environment variables on Render');
console.log('');

if (!MONGO_URI) {
  console.error('FATAL: MONGO_URI environment variable is not set!');
  console.error('Go to Render dashboard -> your service -> Environment -> add MONGO_URI');
  process.exit(1);
}

mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 60000,
    connectTimeoutMS: 30000,
  })
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log('=== Backend is READY ===');
    });
  })
  .catch((err) => {
    console.error('');
    console.error('=== MONGODB CONNECTION FAILED ===');
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    console.error('');
    console.error('Most common reasons:');
    console.error('1. Atlas Network Access does not allow 0.0.0.0/0');
    console.error('   Fix: cloud.mongodb.com -> Network Access -> Add 0.0.0.0/0');
    console.error('2. Wrong username or password in MONGO_URI');
    console.error('   Fix: Check Database Access on Atlas for correct credentials');
    console.error('3. Database name missing from URI');
    console.error('   Fix: URI must end with /kharchaAppDB?retryWrites=true&w=majority');
    console.error('');
    process.exit(1);
  });
