// authMiddleware.js
const jwt = require('jsonwebtoken');

const PDFauthenticateToken = (req, res, next) => {
  // Check for token in Authorization header
  let token = req.headers.authorization?.split(' ')[1];
  
  // If not in header, check query parameters
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    console.warn('Authentication failed: No token provided');
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    console.info(`User authenticated: ${decoded.email} (${decoded.role})`);
    next();
  } catch (error) {
    console.warn('Authentication failed:', error.message);
    return res.status(403).json({ success: false, message: 'Invalid token' });
  }
};

//export the middleware
module.exports = {
  PDFauthenticateToken
};