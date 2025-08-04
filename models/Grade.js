const mongoose = require('mongoose');

const gradeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Grade name is required'],
    unique: true,
    trim: true,
    maxlength: [50, 'Grade name cannot exceed 50 characters']
  },
  code: {
    type: String,
    required: [true, 'Grade code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    maxlength: [10, 'Grade code cannot exceed 10 characters'],
    match: [/^[A-Z0-9]+$/, 'Grade code must contain only uppercase letters and numbers']
  },
  level: {
    type: Number,
    required: [true, 'Grade level is required'],
    min: [1, 'Grade level must be at least 1'],
    max: [20, 'Grade level cannot exceed 20']
  },
  baseSalary: {
    type: Number,
    required: [true, 'Base salary is required'],
    min: [0, 'Base salary cannot be negative']
  },
  salaryRange: {
    minimum: {
      type: Number,
      required: [true, 'Minimum salary is required'],
      min: [0, 'Minimum salary cannot be negative']
    },
    maximum: {
      type: Number,
      required: [true, 'Maximum salary is required'],
      min: [0, 'Maximum salary cannot be negative']
    }
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NGN', 'KES', 'GHS', 'ZAR']
  },
  payrollSettings: {
    payeePercent: {
      type: Number,
      required: [true, 'PAYE percentage is required'],
      min: [0, 'PAYE percentage cannot be negative'],
      max: [100, 'PAYE percentage cannot exceed 100%'],
      default: 0
    },
    pensionPercent: {
      type: Number,
      required: [true, 'Pension percentage is required'],
      min: [0, 'Pension percentage cannot be negative'],
      max: [100, 'Pension percentage cannot exceed 100%'],
      default: 0
    },
    overtimeRate: {
      type: Number,
      required: [true, 'Overtime rate is required'],
      min: [0, 'Overtime rate cannot be negative'],
      default: 0
    },
    overtimeMultiplier: {
      type: Number,
      default: 1.5,
      min: [1, 'Overtime multiplier must be at least 1']
    }
  },
  allowances: {
    transport: {
      type: Number,
      default: 0,
      min: [0, 'Transport allowance cannot be negative']
    },
    housing: {
      type: Number,
      default: 0,
      min: [0, 'Housing allowance cannot be negative']
    },
    medical: {
      type: Number,
      default: 0,
      min: [0, 'Medical allowance cannot be negative']
    },
    meals: {
      type: Number,
      default: 0,
      min: [0, 'Meals allowance cannot be negative']
    },
    communication: {
      type: Number,
      default: 0,
      min: [0, 'Communication allowance cannot be negative']
    },
    other: {
      type: Number,
      default: 0,
      min: [0, 'Other allowance cannot be negative']
    }
  },
  benefits: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['health', 'insurance', 'retirement', 'education', 'other'],
      required: true
    },
    value: {
      type: Number,
      min: 0
    },
    description: {
      type: String,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  taxBracket: {
    bracket: {
      type: String,
      enum: ['low', 'medium', 'high', 'executive'],
      required: [true, 'Tax bracket is required']
    },
    exemptionAmount: {
      type: Number,
      default: 0,
      min: [0, 'Exemption amount cannot be negative']
    },
    additionalTaxPercent: {
      type: Number,
      default: 0,
      min: [0, 'Additional tax percentage cannot be negative'],
      max: [100, 'Additional tax percentage cannot exceed 100%']
    }
  },
  requirements: {
    education: {
      minimum: {
        type: String,
        enum: ['high_school', 'diploma', 'bachelor', 'master', 'phd'],
        default: 'high_school'
      },
      preferred: {
        type: String,
        enum: ['high_school', 'diploma', 'bachelor', 'master', 'phd']
      }
    },
    experience: {
      minimum: {
        type: Number,
        default: 0,
        min: [0, 'Minimum experience cannot be negative']
      },
      preferred: {
        type: Number,
        default: 0,
        min: [0, 'Preferred experience cannot be negative']
      }
    },
    certifications: [{
      name: String,
      required: {
        type: Boolean,
        default: false
      }
    }],
    skills: [{
      name: String,
      level: {
        type: String,
        enum: ['basic', 'intermediate', 'advanced', 'expert'],
        default: 'basic'
      },
      required: {
        type: Boolean,
        default: false
      }
    }]
  },
  promotion: {
    nextGrade: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Grade'
    },
    requiresApproval: {
      type: Boolean,
      default: true
    },
    minimumTenure: {
      type: Number, // in months
      default: 12,
      min: [0, 'Minimum tenure cannot be negative']
    },
    performanceThreshold: {
      type: Number,
      default: 3.5,
      min: [1, 'Performance threshold must be at least 1'],
      max: [5, 'Performance threshold cannot exceed 5']
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  effectiveDate: {
    type: Date,
    default: Date.now
  },
  expiryDate: {
    type: Date
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
gradeSchema.index({ name: 1 });
gradeSchema.index({ code: 1 });
gradeSchema.index({ level: 1 });
gradeSchema.index({ isActive: 1 });
gradeSchema.index({ effectiveDate: 1 });
gradeSchema.index({ 'salaryRange.minimum': 1, 'salaryRange.maximum': 1 });

// Virtual for total allowances
gradeSchema.virtual('totalAllowances').get(function() {
  return Object.values(this.allowances).reduce((sum, allowance) => sum + (allowance || 0), 0);
});

// Virtual for gross salary (base + allowances)
gradeSchema.virtual('grossSalary').get(function() {
  return this.baseSalary + this.totalAllowances;
});

// Virtual for annual salary
gradeSchema.virtual('annualSalary').get(function() {
  return this.grossSalary * 12;
});

// Virtual for positions using this grade
gradeSchema.virtual('positions', {
  ref: 'Position',
  localField: '_id',
  foreignField: 'gradeId'
});

// Virtual for employees in this grade
gradeSchema.virtual('employees', {
  ref: 'Employee',
  localField: '_id',
  foreignField: 'employmentInfo.gradeId'
});

// Virtual for employee count
gradeSchema.virtual('employeeCount', {
  ref: 'Employee',
  localField: '_id',
  foreignField: 'employmentInfo.gradeId',
  count: true
});

// Pre-save validation
gradeSchema.pre('save', function(next) {
  // Validate salary range
  if (this.salaryRange.minimum > this.salaryRange.maximum) {
    return next(new Error('Minimum salary cannot be greater than maximum salary'));
  }
  
  // Validate base salary is within range
  if (this.baseSalary < this.salaryRange.minimum || this.baseSalary > this.salaryRange.maximum) {
    return next(new Error('Base salary must be within the salary range'));
  }
  
  // Generate code if not provided
  if (!this.code && this.name) {
    const nameCode = this.name.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase();
    const levelCode = this.level.toString().padStart(2, '0');
    this.code = `${nameCode}${levelCode}`;
  }
  
  next();
});

// Pre-remove middleware
gradeSchema.pre('remove', async function(next) {
  try {
    // Check if grade has active employees
    const Employee = mongoose.model('Employee');
    const employeeCount = await Employee.countDocuments({
      'employmentInfo.gradeId': this._id,
      'employmentInfo.status': 'active'
    });
    
    if (employeeCount > 0) {
      const error = new Error('Cannot delete grade with active employees');
      error.code = 'GRADE_HAS_EMPLOYEES';
      return next(error);
    }
    
    // Check if grade has active positions
    const Position = mongoose.model('Position');
    const positionCount = await Position.countDocuments({
      gradeId: this._id,
      isActive: true
    });
    
    if (positionCount > 0) {
      const error = new Error('Cannot delete grade with active positions');
      error.code = 'GRADE_HAS_POSITIONS';
      return next(error);
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to calculate total compensation
gradeSchema.methods.calculateTotalCompensation = function(includeAnnualBenefits = false) {
  let total = this.grossSalary;
  
  if (includeAnnualBenefits) {
    const benefitValue = this.benefits.reduce((sum, benefit) => {
      return sum + (benefit.isActive ? (benefit.value || 0) : 0);
    }, 0);
    total += benefitValue;
  }
  
  return total;
};

// Instance method to calculate net salary (after deductions)
gradeSchema.methods.calculateNetSalary = function(overtimeHours = 0) {
  const grossSalary = this.grossSalary;
  const overtimePay = overtimeHours * this.payrollSettings.overtimeRate * this.payrollSettings.overtimeMultiplier;
  const totalGross = grossSalary + overtimePay;
  
  // Calculate deductions
  const payeDeduction = (totalGross * this.payrollSettings.payeePercent) / 100;
  const pensionDeduction = (totalGross * this.payrollSettings.pensionPercent) / 100;
  const additionalTax = (totalGross * this.taxBracket.additionalTaxPercent) / 100;
  
  const totalDeductions = payeDeduction + pensionDeduction + additionalTax;
  const netSalary = Math.max(0, totalGross - totalDeductions);
  
  return {
    grossSalary: totalGross,
    deductions: {
      paye: payeDeduction,
      pension: pensionDeduction,
      additionalTax: additionalTax,
      total: totalDeductions
    },
    netSalary: netSalary,
    overtimePay: overtimePay
  };
};

// Static method to get grade hierarchy
gradeSchema.statics.getHierarchy = async function() {
  try {
    const hierarchy = await this.find({ isActive: true })
      .sort({ level: 1 })
      .populate('promotion.nextGrade', 'name code level');
    
    if (!hierarchy || hierarchy.length === 0) {
      throw new Error('No active grades found');
    }
    
    return hierarchy;
  } catch (error) {
    console.error('Error building hierarchy:', error);
    throw error;
  }
};

// Static method to find grades by salary range
gradeSchema.statics.findBySalaryRange = function(minSalary, maxSalary) {
  return this.find({
    isActive: true,
    $or: [
      {
        'salaryRange.minimum': { $gte: minSalary, $lte: maxSalary }
      },
      {
        'salaryRange.maximum': { $gte: minSalary, $lte: maxSalary }
      },
      {
        'salaryRange.minimum': { $lte: minSalary },
        'salaryRange.maximum': { $gte: maxSalary }
      }
    ]
  }).sort({ level: 1 });
};

// Instance method to check promotion eligibility
gradeSchema.methods.checkPromotionEligibility = function(employee) {
  if (!this.promotion.nextGrade) {
    return { eligible: false, reason: 'No promotion path defined' };
  }
  
  const tenureMonths = employee.getTenureInMonths();
  if (tenureMonths < this.promotion.minimumTenure) {
    return {
      eligible: false,
      reason: `Minimum tenure of ${this.promotion.minimumTenure} months not met`
    };
  }
  
  // You would implement performance checking logic here
  // const performanceScore = employee.getAveragePerformanceScore();
  // if (performanceScore < this.promotion.performanceThreshold) {
  //   return {
  //     eligible: false,
  //     reason: `Performance threshold of ${this.promotion.performanceThreshold} not met`
  //   };
  // }
  
  return { eligible: true };
};

// Instance method to get statistics
gradeSchema.methods.getStatistics = async function() {
  const Employee = mongoose.model('Employee');
  const Position = mongoose.model('Position');
  
  const [employeeCount, positionCount, avgSalary] = await Promise.all([
    Employee.countDocuments({
      'employmentInfo.gradeId': this._id,
      'employmentInfo.status': 'active'
    }),
    Position.countDocuments({
      gradeId: this._id,
      isActive: true
    }),
    Employee.aggregate([
      {
        $match: {
          'employmentInfo.gradeId': this._id,
          'employmentInfo.status': 'active'
        }
      },
      {
        $group: {
          _id: null,
          avgSalary: { $avg: '$employmentInfo.currentSalary' }
        }
      }
    ])
  ]);
  
  return {
    employees: employeeCount,
    positions: positionCount,
    averageSalary: avgSalary[0]?.avgSalary || 0,
    gradeLevel: this.level,
    salaryRange: this.salaryRange,
    totalCompensation: this.calculateTotalCompensation(true)
  };
};

const Grade = mongoose.model('Grade', gradeSchema);

module.exports = Grade;