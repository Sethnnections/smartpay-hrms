const session = require('express-session');
const MongoStore = require('connect-mongo');

const sessionConfig = {
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URL,
    dbName: process.env.DB_NAME,
    collectionName: 'sessions',
    ttl: parseInt(process.env.SESSION_EXPIRY) || 7 * 24 * 60 * 60 // 7 days
  }),
  cookie: {
    maxAge: parseInt(process.env.SESSION_EXPIRY) || 7 * 24 * 60 * 60 * 1000, // 7 days
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict'
  }
};

module.exports = sessionConfig;