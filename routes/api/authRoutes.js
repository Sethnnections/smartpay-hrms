const express = require('express');
const router = express.Router();
const authController = require('../../controllers/authController');
const { authenticateToken } = require('../../utils/auth'); // Updated import

// Initialize default users (run once when server starts)
router.get('/init-users', async (req, res) => {
  try {
    await authController.initializeDefaultUsers();
    res.status(200).json({ success: true, message: 'Default users initialization complete' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Login for all user types
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { user, token } = await authController.login(email, password);
    
    res.status(200).json({ 
      success: true, 
      user, 
      token 
    });
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Get user profile (protected route)
router.get('/profile', authenticateToken, async (req, res) => { // Updated middleware name
  try {
    const user = await authController.getProfile(req.user.id);
    res.status(200).json({ 
      success: true, 
      user 
    });
  } catch (error) {
    res.status(404).json({ 
      success: false, 
      message: error.message 
    });
  }
});

module.exports = router;