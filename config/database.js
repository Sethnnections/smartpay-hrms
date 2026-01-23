// config/database.js
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Set strictQuery to false to prepare for Mongoose 7
mongoose.set('strictQuery', false);

const connectDB = async () => {
  try {
    // Hardcoded MongoDB connection string
    const MONGODB_URI = 'mongodb://127.0.0.1:27017/smartpay-hrms';
    
    logger.info(`Connecting to MongoDB at: ${MONGODB_URI}`);
    
    const conn = await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    logger.info(`MongoDB connected successfully: ${conn.connection.host}`);
    
    // Initialize default data
    await initializeDefaultData();
    
  } catch (error) {
    logger.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

// Function to initialize default data
const initializeDefaultData = async () => {
  try {
    const User = require('../models/User');
    const CompanySettings = require('../models/CompanySettings');
    
    // Check if any users exist
    const userCount = await User.countDocuments();
    
    if (userCount === 0) {
      logger.info('Creating default users...');
      
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
    }
    
    // Check if company settings exist
    const settingsCount = await CompanySettings.countDocuments({ isActive: true });
    
    if (settingsCount === 0) {
      logger.info('Creating default company settings...');
      
      const defaultSettings = {
        companyName: "Team Pay",
        companyAccount: "123456789012",
        companyAddress: "Umoyo Building, Blantyre, Malawi",
        bankName: "National Bank of Malawi",
        phone: "+265 999 123 456",
        email: "info@teampay.com",
        currency: "MWK",
        taxIdentificationNumber: "TAX-001-MW-2025",
        logo: "",
        isActive: true
      };
      
      await CompanySettings.updateSettings(defaultSettings);
      logger.info('Default company settings created successfully');
    }
    
  } catch (error) {
    logger.error('Error initializing default data:', error);
  }
};

// Handle connection events
mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error:', err);
});

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed through app termination');
  process.exit(0);
});

module.exports = { connectDB };