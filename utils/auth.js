const passport = require('passport');
const { validationResult } = require('express-validator');
const logger = require('./logger');

const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash('error_msg', 'Please log in to view that resource');
  res.redirect('/auth/login');
};

const ensureAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'admin') {
    return next();
  }
  req.flash('error_msg', 'Unauthorized access');
  res.redirect('/');
};

const ensureHR = (req, res, next) => {
  if (req.isAuthenticated() && (req.user.role === 'admin' || req.user.role === 'hr')) {
    return next();
  }
  req.flash('error_msg', 'Unauthorized access');
  res.redirect('/');
};

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    req.flash('error_msg', errorMessages);
    return res.redirect('back');
  }
  next();
};

module.exports = {
  ensureAuthenticated,
  ensureAdmin,
  ensureHR,
  handleValidationErrors
};