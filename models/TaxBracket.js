// models/TaxBracket.js
const mongoose = require('mongoose');

const taxBracketSchema = new mongoose.Schema({
  bracketName: {
    type: String,
    required: [true, 'Bracket name is required'],
    trim: true
  },
  minAmount: {
    type: Number,
    required: [true, 'Minimum amount is required'],
    min: [0, 'Minimum amount cannot be negative']
  },
  maxAmount: {
    type: Number,
    // null represents no upper limit (infinity)
    default: null
  },
  taxRate: {
    type: Number,
    required: [true, 'Tax rate is required'],
    min: [0, 'Tax rate cannot be negative'],
    max: [100, 'Tax rate cannot exceed 100%']
  },
  country: {
    type: String,
    default: 'MW',
    required: [true, 'Country code is required']
  },
  currency: {
    type: String,
    default: 'MWK',
    required: [true, 'Currency is required']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  effectiveFrom: {
    type: Date,
    default: Date.now
  },
  effectiveTo: {
    type: Date,
    // null represents no expiration
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient querying
taxBracketSchema.index({ country: 1, currency: 1, isActive: 1, effectiveFrom: 1, effectiveTo: 1 });

// Static method to get current tax brackets
taxBracketSchema.statics.getCurrentBrackets = function(country = 'MW', currency = 'MWK') {
  const now = new Date();
  return this.find({
    country,
    currency,
    isActive: true,
    effectiveFrom: { $lte: now },
    $or: [
      { effectiveTo: null },
      { effectiveTo: { $gte: now } }
    ]
  }).sort({ minAmount: 1 });
};

// Static method to calculate tax for a given amount
taxBracketSchema.statics.calculateTax = async function(amount, country = 'MW', currency = 'MWK') {
  const brackets = await this.getCurrentBrackets(country, currency);
  let tax = 0;
  for (const bracket of brackets) {
    if (amount > bracket.minAmount) {
      const upper = bracket.maxAmount === null ? amount : Math.min(amount, bracket.maxAmount);
      tax += (upper - bracket.minAmount) * (bracket.taxRate / 100);
      if (bracket.maxAmount === null || amount <= bracket.maxAmount) break;
    }
  }
  return tax;
};



// Virtual to check if bracket is currently effective
taxBracketSchema.virtual('isCurrentlyEffective').get(function() {
  const now = new Date();
  return this.isActive && 
         this.effectiveFrom <= now && 
         (this.effectiveTo === null || this.effectiveTo >= now);
});

module.exports = mongoose.model('TaxBracket', taxBracketSchema);