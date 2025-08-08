require('dotenv').config();
const express = require('express');
const path = require('path');
const logger = require('morgan');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const passport = require('./config/passport');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const helmet = require('helmet');
const compression = require('compression');

const app = express();

// Production optimizations
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
  app.use(compression());
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
        connectSrc: ["'self'"]
      },
    },
  }));
}

// View engine setup (EJS)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Use express-ejs-layouts
app.use(expressLayouts);
app.set('layout', 'admin/layout');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Logging
app.use(logger('dev'));

// Body parsing middleware (only once)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files configuration - FIXED FOR VERCEL
app.use(express.static(path.join(__dirname, 'public')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Additional static file routes for better Vercel compatibility
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

// Session configuration (only once, with MongoStore)
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 3600 // lazy session update
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Flash messages
app.use(flash());

// Global variables
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.user = req.session.user || null;
  res.locals.currentPath = req.path;
  next();
});

// Routes
app.use('/api/auth', require('./routes/api/authRoutes'));
app.use('/', require('./routes/webRoutes'));
app.use('/api/departments', require('./routes/api/departmentRoutes'));
app.use('/api/grades', require('./routes/api/gradeRoutes'));
app.use('/api/positions', require('./routes/api/positionRoutes'));
app.use('/api/employees', require('./routes/api/employeeRoutes'));
app.use('/api/payroll', require('./routes/api/payrollRoutes'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date(),
    environment: process.env.NODE_ENV 
  });
});

// Debug endpoint for static files (remove after fixing)
app.get('/debug/static', (req, res) => {
  const fs = require('fs');
  try {
    const publicPath = path.join(__dirname, 'public');
    const publicExists = fs.existsSync(publicPath);
    
    let files = [];
    if (publicExists) {
      files = fs.readdirSync(publicPath, { recursive: true });
    }
    
    res.json({
      publicPath,
      publicExists,
      files: files.slice(0, 20), // First 20 files
      nodeEnv: process.env.NODE_ENV,
      isVercel: !!process.env.VERCEL
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error occurred:', err.stack);
  
  if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
    res.status(500).json({ error: 'Internal Server Error' });
  } else {
    res.status(500).render('error', { 
      title: 'Error',
      message: 'An unexpected error occurred. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? err : {}
    });
  }
});

// 404 handler
app.use((req, res, next) => {
  if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
    res.status(404).json({ error: 'Not Found' });
  } else {
    res.status(404).render('error', {
      title: 'Page Not Found',
      message: 'The page you are looking for could not be found.'
    });
  }
});

module.exports = app;