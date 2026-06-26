import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { warmup } from './lib/semanticCache.js';

// Route Imports
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import keyRoutes from './routes/keys.js';
import healthRoutes from './routes/health.js';
import adminRoutes from './routes/admin.js';
import paymentRoutes from './routes/payments.js';
import diagnoseRoutes from './routes/diagnose.js';

const app = express();
const PORT = process.env.PORT || 3001;

// 1. Limit body parser size (64kb limit)
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));

// 2. CORS configurations whitelisting frontend origins
const allowedOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',') 
  : ['*']; // Allow all by default if not strictly configured

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy whitelist'));
    }
  },
  credentials: true
}));

// 3. Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/keys', keyRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/diagnose', diagnoseRoutes);

// 4. Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error occurred' });
});

// 5. Server Startup & Caching pipeline Warmup
app.listen(PORT, async () => {
  console.log(`🚀 VibeCore Cost Optimization Proxy Backend running on port ${PORT}`);
  try {
    await warmup();
  } catch (error) {
    console.error('Failed to trigger semantic cache warmup on boot:', error);
  }

  // 6. Keep-alive self-ping to prevent Render free tier from sleeping
  // Pings the health endpoint every 10 minutes (600,000ms)
  const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

  setInterval(async () => {
    try {
      const res = await fetch(`${SELF_URL}/api/health`);
      console.log(`🏓 Keep-alive ping sent → status: ${res.status} at ${new Date().toISOString()}`);
    } catch (err) {
      console.warn(`⚠️ Keep-alive ping failed: ${err.message}`);
    }
  }, PING_INTERVAL_MS);

  console.log(`🔁 Keep-alive self-ping scheduled every 10 minutes to ${SELF_URL}/api/health`);
});
