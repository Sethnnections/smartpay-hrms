const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Department name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Department name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  headOfDepartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  code: {
    type: String,
    required: [true, 'Department code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    maxlength: [10, 'Department code cannot exceed 10 characters'],
    match: [/^[A-Z0-9]+$/, 'Department code must contain only uppercase letters and numbers']
  },
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
    currency: {
      type: String,
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD']
    }
  },
  location: {
    building: {
      type: String,
      trim: true
    },
    floor: {
      type: String,
      trim: true
    },
    room: {
      type: String,
      trim: true
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    }
  },
  contact: {
    phone: {
      type: String,
      match: [/^\+?[\d\s\-\(\)]+$/, 'Please enter a valid phone number']
    },
    email: {
      type: String,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
    },
    extension: {
      type: String,
      match: [/^\d{1,6}$/, 'Extension must be 1-6 digits']
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  establishedDate: {
    type: Date,
    default: Date.now
  },
  parentDepartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: null
  },
  costCenter: {
    type: String,
    trim: true,
    maxlength: [20, 'Cost center cannot exceed 20 characters']
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  metadata: {
    type: Map,
    of: String,
    default: new Map()
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
departmentSchema.index({ name: 1 });
departmentSchema.index({ code: 1 });
departmentSchema.index({ isActive: 1 });
departmentSchema.index({ headOfDepartment: 1 });
departmentSchema.index({ parentDepartment: 1 });
departmentSchema.index({ tags: 1 });

// Virtual for subdepartments
departmentSchema.virtual('subdepartments', {
  ref: 'Department',
  localField: '_id',
  foreignField: 'parentDepartment'
});

// Virtual for positions in this department
departmentSchema.virtual('positions', {
  ref: 'Position',
  localField: '_id',
  foreignField: 'departmentId'
});

// Virtual for employees in this department
departmentSchema.virtual('employees', {
  ref: 'Employee',
  localField: '_id',
  foreignField: 'employmentInfo.departmentId'
});

// Virtual for employee count
departmentSchema.virtual('employeeCount', {
  ref: 'Employee',
  localField: '_id',
  foreignField: 'employmentInfo.departmentId',
  count: true
});

// Virtual for budget utilization percentage
departmentSchema.virtual('budgetUtilization').get(function() {
  if (this.budget.allocated === 0) return 0;
  return Math.round((this.budget.spent / this.budget.allocated) * 100);
});

// Virtual for remaining budget
departmentSchema.virtual('remainingBudget').get(function() {
  return Math.max(0, this.budget.allocated - this.budget.spent);
});

// Pre-save middleware to generate department code if not provided
departmentSchema.pre('save', function(next) {
  if (!this.code && this.name) {
    // Generate code from name (first 3 letters + random number)
    const nameCode = this.name.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase();
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.code = `${nameCode}${randomNum}`;
  }
  next();
});

// Pre-remove middleware to handle cascading deletes
departmentSchema.pre('remove', async function(next) {
  try {
    // Check if department has employees
    const Employee = mongoose.model('Employee');
    const employeeCount = await Employee.countDocuments({
      'employmentInfo.departmentId': this._id
    });
    
    if (employeeCount > 0) {
      const error = new Error('Cannot delete department with active employees');
      error.code = 'DEPARTMENT_HAS_EMPLOYEES';
      return next(error);
    }
    
    // Check if department has positions
    const Position = mongoose.model('Position');
    const positionCount = await Position.countDocuments({
      departmentId: this._id
    });
    
    if (positionCount > 0) {
      const error = new Error('Cannot delete department with active positions');
      error.code = 'DEPARTMENT_HAS_POSITIONS';
      return next(error);
    }
    
    // Update subdepartments to remove parent reference
    await mongoose.model('Department').updateMany(
      { parentDepartment: this._id },
      { $unset: { parentDepartment: 1 } }
    );
    
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to get hierarchy path
departmentSchema.methods.getHierarchyPath = async function() {
  const path = [this.name];
  let current = this;
  
  while (current.parentDepartment) {
    current = await this.constructor.findById(current.parentDepartment);
    if (current) {
      path.unshift(current.name);
    } else {
      break;
    }
  }
  
  return path.join(' > ');
};

// Static method to get department hierarchy
departmentSchema.statics.getHierarchy = async function() {
  const departments = await this.find({ isActive: true })
    .populate('parentDepartment', 'name')
    .populate('subdepartments', 'name code')
    .sort('name');
  
  // Build hierarchy tree
  const hierarchy = [];
  const departmentMap = new Map();
  
  // First pass: create map
  departments.forEach(dept => {
    departmentMap.set(dept._id.toString(), {
      ...dept.toObject(),
      children: []
    });
  });
  
  // Second pass: build tree
  departments.forEach(dept => {
    const deptObj = departmentMap.get(dept._id.toString());
    
    if (dept.parentDepartment) {
      const parent = departmentMap.get(dept.parentDepartment._id.toString());
      if (parent) {
        parent.children.push(deptObj);
      }
    } else {
      hierarchy.push(deptObj);
    }
  });
  
  return hierarchy;
};

// Static method to find departments with budget overrun
departmentSchema.statics.findBudgetOverruns = function() {
  return this.find({
    isActive: true,
    'budget.allocated': { $gt: 0 },
    $expr: { $gt: ['$budget.spent', '$budget.allocated'] }
  });
};

// Instance method to add budget expense
departmentSchema.methods.addExpense = function(amount, description = '') {
  this.budget.spent += amount;
  
  // Log the expense (you might want to create a separate ExpenseLog model)
  const expense = {
    amount,
    description,
    date: new Date(),
    remainingBudget: this.remainingBudget
  };
  
  return this.save();
};

// Instance method to reset budget
departmentSchema.methods.resetBudget = function() {
  this.budget.spent = 0;
  return this.save();
};

// Method to get department statistics
departmentSchema.methods.getStatistics = async function() {
  const Employee = mongoose.model('Employee');
  const Position = mongoose.model('Position');
  
  const [employeeCount, positionCount, subdepartmentCount] = await Promise.all([
    Employee.countDocuments({
      'employmentInfo.departmentId': this._id,
      'employmentInfo.status': 'active'
    }),
    Position.countDocuments({
      departmentId: this._id,
      isActive: true
    }),
    this.constructor.countDocuments({
      parentDepartment: this._id,
      isActive: true
    })
  ]);
  
  return {
    employees: employeeCount,
    positions: positionCount,
    subdepartments: subdepartmentCount,
    budgetUtilization: this.budgetUtilization,
    remainingBudget: this.remainingBudget
  };
};

const Department = mongoose.model('Department', departmentSchema);

module.exports = Department;