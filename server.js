require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const { testEmailConnection } = require('./utils/email');

const app = express();

// ── CORS ─────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    process.env.CLIENT_URL || 'http://localhost:3000',
    'http://10.107.165.43:3000',
    'http://localhost:5173',
  ],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/customers',    require('./routes/customers'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/payments',     require('./routes/payments'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

// ── Connect MongoDB then start server ─────────────────────────────
const PORT = process.env.PORT || 5000;

console.log('');
console.log('🚀 Starting LedgerPro backend...');
console.log(`   Connecting to MongoDB: ${process.env.MONGO_URI}`);
console.log('');

mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000, // 10 second timeout
    socketTimeoutMS: 45000,
  })
  .then(async () => {
    console.log('✅ MongoDB connected  →  Database: kharchaAppDB');

    app.listen(PORT, () => {
      console.log(`✅ Backend running   →  http://localhost:${PORT}`);
      console.log(`✅ Health check      →  http://localhost:${PORT}/api/health`);
      console.log('');
    });

    await testEmailConnection();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Backend is READY. Open frontend: http://localhost:3000');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
  })
  .catch((err) => {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('❌  MONGODB CONNECTION FAILED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('   Error:', err.message);
    console.log('');
    console.log('   ✅ FIX — You have MongoDB Compass, so:');
    console.log('');
    console.log('   STEP 1: Make sure MongoDB is RUNNING on your computer.');
    console.log('           Windows: Press Windows key → search "Services"');
    console.log('                    Find "MongoDB" → right-click → Start');
    console.log('           OR open MongoDB Compass — it auto-starts MongoDB');
    console.log('');
    console.log('   STEP 2: Open MongoDB Compass and connect to:');
    console.log('           mongodb://127.0.0.1:27017');
    console.log('           (just click Connect — no password needed for local)');
    console.log('');
    console.log('   STEP 3: Once Compass connects, run npm start again here.');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    process.exit(1);
  });
