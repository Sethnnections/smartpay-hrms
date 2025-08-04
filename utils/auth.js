const jwt = require('jsonwebtoken');
const logger = require('./logger');

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    logger.warn('Authentication failed: No token provided');
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      role: decoded.role,
      email: decoded.email
    };
    logger.info(`User authenticated: ${decoded.email} (${decoded.role})`);
    next();
  } catch (error) {
    logger.error('Authentication failed:', error.message);
    return res.status(403).json({ success: false, message: 'Invalid or expired token' });
  }
};

// Middleware to require admin role
const requireAdmin = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'admin') {
      logger.warn(`Admin access denied for ${req.user.email} (role: ${req.user.role})`);
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    logger.info(`Admin access granted to ${req.user.email}`);
    next();
  });
};

// Middleware to require either HR or Admin role
const requireHROrAdmin = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'hr' && req.user.role !== 'admin') {
      logger.warn(`HR/Admin access denied for ${req.user.email} (role: ${req.user.role})`);
      return res.status(403).json({ 
        success: false, 
        message: 'HR or Admin access required' 
      });
    }
    logger.info(`HR/Admin access granted to ${req.user.email}`);
    next();
  });
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireHROrAdmin
};