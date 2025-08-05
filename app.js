require('dotenv').config();
const express = require('express');
const path = require('path');
const logger = require('morgan');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const passport = require('./config/passport');

const app = express();

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

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/api/auth', require('./routes/api/authRoutes'));
app.use('/', require('./routes/webRoutes'));
app.use('/api/departments', require('./routes/api/departmentRoutes'));
app.use('/api/grades', require('./routes/api/gradeRoutes'));
app.use('/api/positions', require('./routes/api/positionRoutes'));
app.use('/api/employees', require('./routes/api/employeeRoutes'));


// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { 
    title: 'Error',
    message: 'An unexpected error occurred. Please try again later.',
    error: err 
  });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).render('error', {
    title: 'Page Not Found',
    message: 'The page you are looking for could not be found.'
  });
});

module.exports = app;