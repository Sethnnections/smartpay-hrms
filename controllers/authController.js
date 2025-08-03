const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

// Initialize default users (run once at startup)
const initializeDefaultUsers = async () => {
  try {
    // Check if any users exist
    const userCount = await User.countDocuments();
    
    if (userCount === 0) {
      // Create default admin
      const admin = new User({
        email: process.env.ADMIN_EMAIL || 'admin@smartpay.com',
        password: process.env.ADMIN_PASSWORD || 'SmartPay@2025',
        role: 'admin',
        isActive: true
      });
      await admin.save();

      // Create default HR user
      const hr = new User({
        email: process.env.HR_EMAIL || 'hr@smartpay.com',
        password: process.env.HR_PASSWORD || 'Hr@12345',
        role: 'hr',
        isActive: true
      });
      await hr.save();

      // Create default employee user
      const employee = new User({
        email: process.env.EMPLOYEE_EMAIL || 'employee@smartpay.com',
        password: process.env.EMPLOYEE_PASSWORD || 'Employee@123',
        role: 'employee',
        isActive: true
      });
      await employee.save();

      logger.info('Default users created successfully');
    }
  } catch (error) {
    logger.error('Error creating default users:', error);
    throw error;
  }
};

// User login for all roles
const login = async (email, password) => {
  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    // Generate token with role information
    const token = user.generateAuthToken();

    return {
      user: user.getPublicProfile(),
      token
    };
  } catch (error) {
    logger.error('Login failed:', error);
    throw error;
  }
};

// Get user profile based on role
const getProfile = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user.getPublicProfile();
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    throw error;
  }
};

module.exports = {
  initializeDefaultUsers,
  login,
  getProfile
};