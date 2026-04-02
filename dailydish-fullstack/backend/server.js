// ============================================================================
// DAILY DISH — Server with authenticated Socket.IO rooms
// Each connected user joins their own room: "user:<userId>"
// Sellers get real-time alerts when their deals are reserved.
// ============================================================================
require('dotenv').config();
const express   = require('express');
const http      = require('http');
const path      = require('path');
const cors      = require('cors');
const jwt       = require('jsonwebtoken');
const { Server } = require('socket.io');
const mongoose  = require('mongoose');
const fs        = require('fs');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ── Uploads dir ───────────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ── Security headers ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// ── Rate limiter ───────────────────────────────────────────────────────────────
const rateLimitMap = new Map();
function rateLimit(windowMs = 15 * 60 * 1000, max = 30) {
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const r = rateLimitMap.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > r.resetAt) { r.count = 0; r.resetAt = now + windowMs; }
    r.count++;
    rateLimitMap.set(key, r);
    if (r.count > max) return res.status(429).json({ success: false, message: 'Too many requests.' });
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [k, r] of rateLimitMap) if (now > r.resetAt) rateLimitMap.delete(k);
}, 15 * 60 * 1000);

// ── Core middleware ────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));
app.set('io', io);

// ── API routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',    rateLimit(15 * 60 * 1000, 30), require('./routes/auth'));
app.use('/api/deals',   require('./routes/deals'));
app.use('/api/orders',  require('./routes/orders'));
app.use('/api/reviews', require('./routes/reviews'));

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  sockets: io.engine.clientsCount,
  uptime: Math.floor(process.uptime()) + 's'
}));

// ── 404 API ────────────────────────────────────────────────────────────────────
app.use('/api/*', (req, res) =>
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` })
);

// ── SPA fallback ───────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  const htmlFile = path.join(__dirname, '../public', req.path);
  if (fs.existsSync(htmlFile) && path.extname(htmlFile) === '.html') return res.sendFile(htmlFile);
  const withExt = htmlFile + '.html';
  if (fs.existsSync(withExt)) return res.sendFile(withExt);
  res.status(404).sendFile(path.join(__dirname, '../public/404.html'));
});

// ── Global error handler ───────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Server error.' : err.message
  });
});

// ── Socket.IO — authenticated rooms ───────────────────────────────────────────
// When a client connects they MUST emit { token } to join their personal room.
// Room name: "user:<userId>"
// Sellers also join: "seller:<userId>" — for targeted deal alerts
// Buyers  also join: "buyers"          — for broadcast new-deal alerts

io.on('connection', socket => {
  console.log(`⚡ Socket connected: ${socket.id}`);

  // Client sends JWT to authenticate the socket session
  socket.on('authenticate', (token) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId  = decoded.id;

      // Leave any previously joined rooms first
      socket.rooms.forEach(r => { if (r !== socket.id) socket.leave(r); });

      // Join personal room + role room
      socket.join(`user:${userId}`);
      socket.join('buyers'); // everyone can get new_deal broadcasts

      socket.emit('authenticated', { userId });
      console.log(`⚡ Socket ${socket.id} authenticated as user ${userId}`);
    } catch (err) {
      socket.emit('auth_error', 'Invalid token');
    }
  });

  socket.on('disconnect', () => console.log(`⚡ Socket disconnected: ${socket.id}`));
});

// Helper exported so routes can emit targeted events
io.toUser  = (userId, event, data) => io.to(`user:${userId}`).emit(event, data);
io.toBuyers = (event, data) => io.to('buyers').emit(event, data);

// ── Graceful shutdown ──────────────────────────────────────────────────────────
process.on('SIGTERM', () => {
  server.close(() => mongoose.connection.close(false, () => process.exit(0)));
});

// ── Start ──────────────────────────────────────────────────────────────────────
const PORT        = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dailydish';

mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 })
  .then(() => {
    console.log('✅  MongoDB connected');
    server.listen(PORT, () => {
      console.log(`\n🍽️  Daily Dish → http://localhost:${PORT}`);
      console.log(`   Health   → http://localhost:${PORT}/api/health\n`);
    });
  })
  .catch(err => {
    console.error('❌  MongoDB failed:', err.message);
    process.exit(1);
  });
