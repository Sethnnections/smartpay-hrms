// models/CompanySettings.js
const mongoose = require('mongoose');

const companySettingsSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    maxlength: [100, 'Company name cannot exceed 100 characters']
  },
  companyAccount: {
    type: String,
    required: [true, 'Company account number is required'],
    trim: true,
    maxlength: [30, 'Account number cannot exceed 30 characters']
  },
  companyAddress: {
    type: String,
    required: [true, 'Company address is required'],
    trim: true,
    maxlength: [200, 'Address cannot exceed 200 characters']
  },
  bankName: {
    type: String,
    required: [true, 'Bank name is required'],
    trim: true,
    maxlength: [100, 'Bank name cannot exceed 100 characters']
  },
  phone: {
    type: String,
    trim: true,
    maxlength: [20, 'Phone number cannot exceed 20 characters']
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [100, 'Email cannot exceed 100 characters']
  },
  currency: {
    type: String,
    default: 'MWK',
    enum: ['MWK', 'USD', 'GBP', 'EUR', 'ZAR']
  },
  taxIdentificationNumber: {
    type: String,
    trim: true,
    maxlength: [30, 'Tax ID cannot exceed 30 characters']
  },
  logo: {
    type: String, // URL or path to logo file
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Ensure only one company settings document exists
companySettingsSchema.statics.getCompanySettings = function() {
  return this.findOne({ isActive: true })
    .sort({ createdAt: -1 }) // Get the most recent one
    .exec();
};

// Update or create company settings
companySettingsSchema.statics.updateSettings = function(settingsData) {
  return this.findOneAndUpdate(
    { isActive: true },
    { $set: settingsData },
    { 
      new: true, 
      upsert: true, // Create if doesn't exist
      runValidators: true 
    }
  );
};

const CompanySettings = mongoose.model('CompanySettings', companySettingsSchema);
module.exports = CompanySettings;