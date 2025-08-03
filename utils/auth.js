const jwt = require('jsonwebtoken');
const User = require('../models/User');

// JWT Token authentication middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    
    // Get user from database to ensure they still exist and are active
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // Add user info to request object
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    console.error('Token verification error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Token verification failed'
    });
  }
};

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Admin only middleware
const requireAdmin = authorize('admin');

// HR or Admin middleware
const requireHROrAdmin = authorize('hr', 'admin');

// Any authenticated user middleware (alias for authenticateToken)
const requireAuth = authenticateToken;

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      const user = await User.findById(decoded.id);
      
      if (user && user.isActive) {
        req.user = {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role
        };
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// Check if user owns resource or is admin/hr
const requireOwnershipOrPrivileged = (resourceUserIdField = 'userId') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Admin and HR can access any resource
      if (['admin', 'hr'].includes(req.user.role)) {
        return next();
      }

      // For employees, check if they own the resource
      const resourceUserId = req.params.userId || req.body[resourceUserIdField] || req.query.userId;
      
      if (resourceUserId && resourceUserId.toString() !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You can only access your own resources'
        });
      }

      next();
    } catch (error) {
      console.error('Ownership check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization check failed'
      });
    }
  };
};

// Rate limiting middleware (simple implementation)
const createRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries
    requests.forEach((timestamp, ip) => {
      if (timestamp < windowStart) {
        requests.delete(ip);
      }
    });

    // Count requests for this IP
    const userRequests = Array.from(requests.entries())
      .filter(([ip, timestamp]) => ip === key && timestamp > windowStart)
      .length;

    if (userRequests >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later'
      });
    }

    requests.set(key, now);
    next();
  };
};

// Export all middleware functions
module.exports = {
  authenticateToken,
  authorize,
  requireAdmin,
  requireHROrAdmin,
  requireAuth,
  optionalAuth,
  requireOwnershipOrPrivileged,
  createRateLimit,
  // Aliases for backward compatibility
  auth: authenticateToken,
  verifyToken: authenticateToken
};