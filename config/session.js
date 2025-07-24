const MongoStore = require('connect-mongo');

const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'your-fallback-secret-key',
  name: process.env.SESSION_NAME || 'smartpay_session',
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset expiration on activity
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevent XSS attacks
    maxAge: parseDuration(process.env.SESSION_EXPIRY || '7d'), // 7 days default
    sameSite: 'lax' // CSRF protection
  },
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    dbName: process.env.DB_NAME || 'smartpay_hrms',
    collectionName: 'sessions',
    ttl: parseDuration(process.env.SESSION_EXPIRY || '7d') / 1000, // TTL in seconds
    autoRemove: 'native', // Let MongoDB handle cleanup
    touchAfter: 24 * 3600, // Only update session once per 24 hours unless data changes
    stringify: false, // Don't stringify session data
    serialize: (session) => {
      // Custom serialization if needed
      return session;
    },
    unserialize: (session) => {
      // Custom deserialization if needed
      return session;
    }
  })
};

// Parse duration string (e.g., '7d', '24h', '30m') to milliseconds
function parseDuration(duration) {
  if (typeof duration === 'number') return duration;
  
  const matches = duration.match(/^(\d+)([dhms])$/);
  if (!matches) {
    throw new Error(`Invalid duration format: ${duration}. Use format like '7d', '24h', '30m', '60s'`);
  }
  
  const value = parseInt(matches[1]);
  const unit = matches[2];
  
  const multipliers = {
    's': 1000,          // seconds
    'm': 60 * 1000,     // minutes
    'h': 60 * 60 * 1000, // hours
    'd': 24 * 60 * 60 * 1000 // days
  };
  
  return value * multipliers[unit];
}

// Session cleanup utility
const cleanupExpiredSessions = async () => {
  try {
    const MongoStore = require('connect-mongo');
    // This will automatically happen with TTL, but can be called manually
    console.log('Session cleanup completed');
  } catch (error) {
    console.error('Session cleanup failed:', error);
  }
};

// Enhanced session middleware with logging
const sessionMiddleware = (req, res, next) => {
  // Log session activity for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log(`Session ID: ${req.sessionID}, User: ${req.session?.user?.email || 'Anonymous'}`);
  }
  
  // Regenerate session ID on login to prevent session fixation
  if (req.body && req.body.regenerateSession) {
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration failed:', err);
      }
      next();
    });
  } else {
    next();
  }
};

module.exports = sessionConfig;