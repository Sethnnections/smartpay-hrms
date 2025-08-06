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


router.use(authenticateToken); // All routes below require authentication
// Create user (admin only)
router.post('/users', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const user = await authController.createUser(req.body);
    res.status(201).json({ success: true, user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// List users with pagination (admin only)
router.get('/users', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { page = 1, limit = 10, role, isActive } = req.query;
    const filter = {};
    
    if (role) filter.role = role;
    if (isActive) filter.isActive = isActive === 'true';

    const result = await authController.listUsers(parseInt(page), parseInt(limit), filter);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update user (admin only)
router.put('/users/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const user = await authController.updateUser(req.params.id, req.body);
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Deactivate user (admin only)
router.delete('/users/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const result = await authController.deactivateUser(req.params.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Admin password reset (no verification needed)
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ success: false, message: 'New password is required' });
    }

    const result = await authController.adminResetPassword(req.params.id, newPassword);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;