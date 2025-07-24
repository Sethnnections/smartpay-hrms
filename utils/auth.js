const bcrypt = require('bcryptjs');
const logger = require('./logger');

// Hash password
const hashPassword = async (password) => {
  try {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    return await bcrypt.hash(password, saltRounds);
  } catch (error) {
    logger.error('Password hashing failed:', error);
    throw new Error('Password hashing failed');
  }
};

// Compare password
const comparePassword = async (password, hashedPassword) => {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    logger.error('Password comparison failed:', error);
    throw new Error('Password comparison failed');
  }
};

// Require authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    logger.logSecurity('Unauthorized access attempt', {
      ip: req.ip,
      url: req.originalUrl,
      userAgent: req.get('User-Agent')
    });
    
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    req.flash('error_msg', 'Please log in to access this page');
    return res.redirect('/login');
  }
  
  // Check if user is still active
  if (!req.session.user.isActive) {
    logger.logSecurity('Inactive user access attempt', {
      user: req.session.user.email,
      ip: req.ip
    });
    
    req.session.destroy();
    
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({
        success: false,
        message: 'Account has been deactivated'
      });
    }
    
    req.flash('error_msg', 'Your account has been deactivated');
    return res.redirect('/login');
  }
  
  next();
};

// Require specific role middleware
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.session.user) {
      return requireAuth(req, res, next);
    }
    
    if (!roles.includes(req.session.user.role)) {
      logger.logSecurity('Insufficient permissions', {
        user: req.session.user.email,
        requiredRoles: roles,
        userRole: req.session.user.role,
        ip: req.ip,
        url: req.originalUrl
      });
      
      if (req.path.startsWith('/api/')) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }
      
      req.flash('error_msg', 'You do not have permission to access this page');
      return res.redirect('/dashboard');
    }
    
    next();
  };
};

// Optional authentication (don't redirect if not authenticated)
const optionalAuth = (req, res, next) => {
  // User info is already available in res.locals from server.js
  next();
};

// Check if user has permission for specific action
const hasPermission = (user, action, resource = null) => {
  const permissions = {
    admin: {
      'read': ['*'],
      'write': ['*'],
      'delete': ['*'],
      'manage': ['*']
    },
    hr: {
      'read': ['employees', 'departments', 'positions', 'grades', 'payroll', 'reports'],
      'write': ['employees', 'departments', 'positions', 'grades', 'payroll'],
      'delete': ['employees', 'departments', 'positions'],
      'manage': ['payroll', 'overtime']
    },
    employee: {
      'read': ['profile', 'payslips', 'overtime'],
      'write': ['profile', 'overtime'],
      'delete': [],
      'manage': []
    }
  };

  if (!user || !permissions[user.role]) {
    return false;
  }

  const userPermissions = permissions[user.role];
  
  if (!userPermissions[action]) {
    return false;
  }

  // Check if user has wildcard permission
  if (userPermissions[action].includes('*')) {
    return true;
  }

  // Check specific resource permission
  if (resource && userPermissions[action].includes(resource)) {
    return true;
  }

  // If no resource specified, check if user has any permission for this action
  if (!resource && userPermissions[action].length > 0) {
    return true;
  }

  return false;
};

// Middleware to check specific permission
const requirePermission = (action, resource = null) => {
  return (req, res, next) => {
    if (!req.session.user) {
      return requireAuth(req, res, next);
    }

    if (!hasPermission(req.session.user, action, resource)) {
      logger.logSecurity('Permission denied', {
        user: req.session.user.email,
        action,
        resource,
        ip: req.ip,
        url: req.originalUrl
      });

      if (req.path.startsWith('/api/')) {
        return res.status(403).json({
          success: false,
          message: `Permission denied for ${action} on ${resource || 'resource'}`
        });
      }

      req.flash('error_msg', 'You do not have permission to perform this action');
      return res.redirect('/dashboard');
    }

    next();
  };
};

// Generate secure random password
const generatePassword = (length = 12) => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  
  return password;
};

// Validate password strength
const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const errors = [];

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }

  if (!hasUpperCase) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!hasLowerCase) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }

  if (!hasSpecialChar) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength: calculatePasswordStrength(password)
  };
};

// Calculate password strength score
const calculatePasswordStrength = (password) => {
  let score = 0;
  
  // Length bonus
  score += Math.min(password.length * 2, 20);
  
  // Character variety bonus
  if (/[a-z]/.test(password)) score += 5;
  if (/[A-Z]/.test(password)) score += 5;
  if (/[0-9]/.test(password)) score += 5;
  if (/[^A-Za-z0-9]/.test(password)) score += 10;
  
  // Penalty for common patterns
  if (/(.)\1{2,}/.test(password)) score -= 10; // Repeated characters
  if (/123|abc|qwe/i.test(password)) score -= 10; // Sequential patterns
  
  // Return strength level
  if (score < 30) return 'weak';
  if (score < 60) return 'medium';
  if (score < 80) return 'strong';
  return 'very strong';
};

// Session security helpers
const regenerateSession = (req) => {
  return new Promise((resolve, reject) => {
    const userData = req.session.user;
    req.session.regenerate((err) => {
      if (err) {
        logger.error('Session regeneration failed:', err);
        return reject(err);
      }
      req.session.user = userData;
      resolve();
    });
  });
};

// Check for session hijacking
const validateSession = (req, res, next) => {
  if (req.session.user) {
    const currentIP = req.ip;
    const currentUserAgent = req.get('User-Agent');
    
    if (req.session.lastIP && req.session.lastIP !== currentIP) {
      logger.logSecurity('Potential session hijacking - IP change', {
        user: req.session.user.email,
        oldIP: req.session.lastIP,
        newIP: currentIP,
        userAgent: currentUserAgent
      });
      
      // Optionally destroy session on IP change
      if (process.env.STRICT_SESSION_SECURITY === 'true') {
        req.session.destroy();
        if (req.path.startsWith('/api/')) {
          return res.status(401).json({
            success: false,
            message: 'Session security violation detected'
          });
        }
        req.flash('error_msg', 'Security violation detected. Please log in again.');
        return res.redirect('/login');
      }
    }
    
    if (req.session.lastUserAgent && req.session.lastUserAgent !== currentUserAgent) {
      logger.logSecurity('Potential session hijacking - User Agent change', {
        user: req.session.user.email,
        oldUserAgent: req.session.lastUserAgent,
        newUserAgent: currentUserAgent,
        ip: currentIP
      });
    }
    
    // Update session tracking
    req.session.lastIP = currentIP;
    req.session.lastUserAgent = currentUserAgent;
    req.session.lastActivity = new Date();
  }
  
  next();
};

module.exports = {
  hashPassword,
  comparePassword,
  requireAuth,
  requireRole,
  requirePermission,
  optionalAuth,
  hasPermission,
  generatePassword,
  validatePassword,
  calculatePasswordStrength,
  regenerateSession,
  validateSession
};