const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Department name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Department name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Department code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^[A-Z0-9]{3,10}$/, 'Code must be 3-10 uppercase alphanumeric characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  // Organizational Structure
  parentDepartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: null
  },
  headOfDepartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  // Budget Information
  budget: {
    allocated: {
      type: Number,
      default: 0,
      min: [0, 'Budget cannot be negative']
    },
    spent: {
      type: Number,
      default: 0,
      min: [0, 'Spent amount cannot be negative']
    },
    fiscalYear: {
      type: Number,
      min: [2000, 'Invalid fiscal year'],
      max: [2100, 'Invalid fiscal year']
    },
    currency: {
      type: String,
      default: 'MWK',
      enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NGN', 'KES', 'GHS', 'ZAR', 'MWK']
    }
  },
  // Location Details
  location: {
    type: {
      type: String,
      enum: ['physical', 'virtual', 'hybrid'],
      default: 'physical'
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: {
        type: String,
        default: 'United States'
      }
    },
    building: String,
    floor: String,
    room: String,
    geoCoordinates: {
      lat: Number,
      lng: Number
    }
  },
  // Metadata
  isActive: {
    type: Boolean,
    default: true
  },
  establishedDate: {
    type: Date,
    default: Date.now
  },
  costCenter: {
    type: String,
    trim: true,
    match: [/^[A-Z0-9]{3,20}$/, 'Cost center must be 3-20 alphanumeric characters']
  },
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuals
departmentSchema.virtual('subdepartments', {
  ref: 'Department',
  localField: '_id',
  foreignField: 'parentDepartment'
});

departmentSchema.virtual('budgetUtilization').get(function() {
  if (this.budget.allocated <= 0) return 0;
  return parseFloat(((this.budget.spent / this.budget.allocated) * 100).toFixed(2));
});

departmentSchema.virtual('remainingBudget').get(function() {
  return Math.max(0, this.budget.allocated - this.budget.spent);
});

// Indexes
departmentSchema.index({ name: 1, isActive: 1 });
departmentSchema.index({ code: 1 }, { unique: true });
departmentSchema.index({ parentDepartment: 1 });
departmentSchema.index({ 'location.country': 1, 'location.city': 1 });
departmentSchema.index({ tags: 1 });

// Pre-save hooks
departmentSchema.pre('save', function(next) {
  // Auto-generate code if not provided
  if (!this.code && this.name) {
    this.code = this.name.replace(/[^A-Z0-9]/g, '')
      .substring(0, 3)
      .toUpperCase();
  }
  next();
});

// Static Methods
departmentSchema.statics.getHierarchy = async function() {
  const departments = await this.find({ isActive: true })
    .populate('headOfDepartment', 'personalInfo.firstName personalInfo.lastName')
    .lean();

  const buildTree = (parentId = null) => {
    return departments
      .filter(dept => 
        (parentId === null && !dept.parentDepartment) || 
        (dept.parentDepartment && dept.parentDepartment.toString() === parentId)
      )
      .map(dept => ({
        ...dept,
        subdepartments: buildTree(dept._id.toString())
      }));
  };

  return buildTree();
};

departmentSchema.statics.findByBudgetRange = function(min, max) {
  return this.find({
    'budget.allocated': { $gte: min, $lte: max },
    isActive: true
  }).sort({ 'budget.allocated': -1 });
};

// Instance Methods
departmentSchema.methods.addExpense = async function(amount, description = '') {
  if (amount <= 0) throw new Error('Expense amount must be positive');
  
  this.budget.spent += amount;
  if (this.budget.spent > this.budget.allocated) {
    console.warn(`Department ${this.name} has exceeded its budget`);
  }
  
  await this.save();
  return this;
};

departmentSchema.index({ isActive: 1 });
departmentSchema.index({ 'budget.allocated': 1 });
departmentSchema.index({ 'budget.spent': 1 });
departmentSchema.index({ establishedDate: 1 });

module.exports = mongoose.model('Department', departmentSchema);