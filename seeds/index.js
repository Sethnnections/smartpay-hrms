// seeders/index.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const CompanySettings = require('../models/CompanySettings');
const logger = require('../utils/logger');

// Connect to database
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smartpay-hrms', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

// Seed default users
const seedUsers = async () => {
  try {
    const userCount = await User.countDocuments();
    
    if (userCount === 0) {
      const defaultUsers = [
        {
          email: process.env.ADMIN_EMAIL || 'admin@smartpay.com',
          password: process.env.ADMIN_PASSWORD || 'SmartPay@2025',
          role: 'admin',
          isActive: true
        },
        {
          email: process.env.HR_EMAIL || 'hr@smartpay.com',
          password: process.env.HR_PASSWORD || 'Hr@12345',
          role: 'hr',
          isActive: true
        },
        {
          email: process.env.EMPLOYEE_EMAIL || 'employee@smartpay.com',
          password: process.env.EMPLOYEE_PASSWORD || 'Employee@123',
          role: 'employee',
          isActive: true
        }
      ];

      // Create users
      for (const userData of defaultUsers) {
        const user = new User(userData);
        await user.save();
        logger.info(`Created ${user.role} user: ${user.email}`);
      }

      logger.info('✅ Default users created successfully');
    } else {
      logger.info('⚠️  Users already exist, skipping user creation');
    }
  } catch (error) {
    logger.error('❌ Error seeding users:', error);
    throw error;
  }
};

// Seed company settings
const seedCompanySettings = async () => {
  try {
    const settingsCount = await CompanySettings.countDocuments({ isActive: true });
    
    if (settingsCount === 0) {
      const defaultSettings = {
        companyName: process.env.COMPANY_NAME || "Team Pay",
        companyAccount: process.env.COMPANY_ACCOUNT || "123456789012",
        companyAddress: process.env.COMPANY_ADDRESS || "Umoyo Building, Blantyre, Malawi",
        bankName: process.env.BANK_NAME || "National Bank of Malawi",
        phone: process.env.COMPANY_PHONE || "",
        email: process.env.COMPANY_EMAIL || "",
        currency: process.env.DEFAULT_CURRENCY || "MWK",
        taxIdentificationNumber: process.env.TAX_ID || "",
        logo: process.env.COMPANY_LOGO || "",
        isActive: true
      };

      await CompanySettings.updateSettings(defaultSettings);
      logger.info('✅ Company settings created successfully');
    } else {
      logger.info('⚠️  Company settings already exist, skipping creation');
    }
  } catch (error) {
    logger.error('❌ Error seeding company settings:', error);
    throw error;
  }
};

// Seed tax brackets (Malawi specific)
const seedTaxBrackets = async () => {
  try {
    const TaxBracket = require('../models/TaxBracket');
    const taxCount = await TaxBracket.countDocuments();
    
    if (taxCount === 0) {
      // Malawi tax brackets for 2025 (example)
      const malawiTaxBrackets = [
        {
          bracketName: "Tax Free",
          minAmount: 0,
          maxAmount: 150000,
          taxRate: 0,
          country: "MW",
          currency: "MWK",
          isActive: true,
          effectiveFrom: new Date('2025-01-01'),
          effectiveTo: new Date('2025-12-31')
        },
        {
          bracketName: "15% Bracket",
          minAmount: 150001,
          maxAmount: 300000,
          taxRate: 15,
          country: "MW",
          currency: "MWK",
          isActive: true,
          effectiveFrom: new Date('2025-01-01'),
          effectiveTo: new Date('2025-12-31')
        },
        {
          bracketName: "30% Bracket",
          minAmount: 300001,
          maxAmount: 600000,
          taxRate: 30,
          country: "MW",
          currency: "MWK",
          isActive: true,
          effectiveFrom: new Date('2025-01-01'),
          effectiveTo: new Date('2025-12-31')
        },
        {
          bracketName: "35% Bracket",
          minAmount: 600001,
          maxAmount: 900000,
          taxRate: 35,
          country: "MW",
          currency: "MWK",
          isActive: true,
          effectiveFrom: new Date('2025-01-01'),
          effectiveTo: new Date('2025-12-31')
        },
        {
          bracketName: "40% Bracket",
          minAmount: 900001,
          maxAmount: null, // No upper limit
          taxRate: 40,
          country: "MW",
          currency: "MWK",
          isActive: true,
          effectiveFrom: new Date('2025-01-01'),
          effectiveTo: new Date('2025-12-31')
        }
      ];

      await TaxBracket.insertMany(malawiTaxBrackets);
      logger.info('✅ Tax brackets created successfully');
    } else {
      logger.info('⚠️  Tax brackets already exist, skipping creation');
    }
  } catch (error) {
    logger.error('❌ Error seeding tax brackets:', error);
    // Don't throw error here as tax brackets might not be critical for initial setup
  }
};

// Main seeding function
const seedAll = async () => {
  try {
    await connectDB();
    
    logger.info('🌱 Starting database seeding...');
    
    await seedUsers();
    await seedCompanySettings();
    await seedTaxBrackets();
    
    logger.info('✅ Database seeding completed successfully!');
    
    // Display login credentials
    console.log('\n📋 Default Login Credentials:');
    console.log('============================');
    console.log(`Admin: ${process.env.ADMIN_EMAIL || 'admin@smartpay.com'}`);
    console.log(`Password: ${process.env.ADMIN_PASSWORD || 'SmartPay@2025'}`);
    console.log(`\nHR: ${process.env.HR_EMAIL || 'hr@smartpay.com'}`);
    console.log(`Password: ${process.env.HR_PASSWORD || 'Hr@12345'}`);
    console.log(`\nEmployee: ${process.env.EMPLOYEE_EMAIL || 'employee@smartpay.com'}`);
    console.log(`Password: ${process.env.EMPLOYEE_PASSWORD || 'Employee@123'}`);
    console.log('\n⚠️  Change these passwords after first login!');
    
    process.exit(0);
  } catch (error) {
    logger.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

// Run seeds if called directly
if (require.main === module) {
  seedAll();
}

module.exports = {
  seedAll,
  seedUsers,
  seedCompanySettings,
  seedTaxBrackets
};