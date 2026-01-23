const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

const initializeDefaultUsers = async () => {
  try {
    // Check if any users exist
    const userCount = await User.countDocuments();
    
    if (userCount === 0) {
      // Create default admin
      const admin = new User({
        email: 'admin@smartpay.com',
        password: 'SmartPay@2025',
        role: 'admin',
        isActive: true
      });
      await admin.save();

      // Create default HR user
      const hr = new User({
        email: 'hr@smartpay.com',
        password: 'Hr@12345',
        role: 'hr',
        isActive: true
      });
      await hr.save();

      // Create default employee user
      const employee = new User({
        email: 'employee@smartpay.com',
        password: 'Employee@123',
        role: 'employee',
        isActive: true
      });
      await employee.save();

      logger.info('Default users created successfully');
      return true;
    }
    return false;
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

// Add these to authController.js after the existing methods

// Create new user (admin only)
const createUser = async (userData) => {
  try {
    const user = new User(userData);
    await user.save();
    return user.getPublicProfile();
  } catch (error) {
    logger.error('Error creating user:', error);
    throw error;
  }
};

// List users with pagination (admin only)
const listUsers = async (page = 1, limit = 10, filter = {}) => {
  try {
    const options = {
      page,
      limit,
      sort: { createdAt: -1 },
      select: '-password -twoFactorSecret -passwordResetToken'
    };

    const result = await User.paginate(filter, options);
    
    return {
      users: result.docs,
      total: result.totalDocs,
      pages: result.totalPages,
      page: result.page,
      limit: result.limit
    };
  } catch (error) {
    logger.error('Error listing users:', error);
    throw error;
  }
};

// Update user (admin only)
const updateUser = async (userId, updateData) => {
  try {
    // Prevent role escalation unless admin
    if (updateData.role && updateData.role === 'admin') {
      throw new Error('Only admins can create other admins');
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!user) {
      throw new Error('User not found');
    }

    return user.getPublicProfile();
  } catch (error) {
    logger.error('Error updating user:', error);
    throw error;
  }
};

// Deactivate user (admin only)
const deactivateUser = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    await user.softDelete();
    return { success: true, message: 'User deactivated successfully' };
  } catch (error) {
    logger.error('Error deactivating user:', error);
    throw error;
  }
};

// Admin password reset (no verification needed)
const adminResetPassword = async (userId, newPassword) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.password = newPassword;
    await user.save();
    
    return { success: true, message: 'Password reset successfully' };
  } catch (error) {
    logger.error('Error resetting password:', error);
    throw error;
  }
};

// Add these to the exports at the bottom of authController.js
module.exports = {
  initializeDefaultUsers,
  login,
  getProfile,
  createUser,
  listUsers,
  updateUser,
  deactivateUser,
  adminResetPassword
};
